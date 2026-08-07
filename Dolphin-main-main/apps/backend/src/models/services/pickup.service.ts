import { eq, or } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { ShipmozoService } from './couriers/shipmozo.service'
import { cancelOrders as cancelShiprocketOrders, cancelShipmentsByAwb } from './shiprocketExtended.service'
import { applyCancellationRefundOnce } from './webhookProcessor'

const isProviderCancellationAccepted = (payload: any) => {
  const statusText = String(payload?.status || payload?.message || payload?.remark || '').toLowerCase()
  return (
    payload?.success === true ||
    payload?.status === true ||
    payload?.result === '1' ||
    statusText.includes('cancel') ||
    statusText.includes('success') ||
    Array.isArray(payload?.data) ||
    Array.isArray(payload?.response)
  )
}

const cancelB2BShiprocketShipment = async (orderId: string) => {
  const [order] = await db
    .select()
    .from(b2b_orders)
    .where(or(eq(b2b_orders.id, orderId), eq(b2b_orders.order_number, orderId)))

  if (!order) return null

  const status = String(order.order_status || '').trim().toLowerCase()
  const cancellableStatuses = new Set([
    'pending',
    'booked',
    'shipment_booked',
    'pickup_initiated',
    'pickup_scheduled',
  ])

  if (!cancellableStatuses.has(status)) {
    throw new Error(`B2B shipment cannot be cancelled in current status: ${order.order_status || '-'}`)
  }

  const providerAttempts: Array<() => Promise<any>> = []
  const shiprocketOrderId = Number(order.order_id)
  const awbNumber = String(order.awb_number || '').trim()

  if (Number.isFinite(shiprocketOrderId) && shiprocketOrderId > 0) {
    providerAttempts.push(() => cancelShiprocketOrders({ ids: [shiprocketOrderId] }))
  }

  if (awbNumber) {
    providerAttempts.push(() => cancelShipmentsByAwb({ awbs: [awbNumber] }))
  }

  if (!providerAttempts.length) {
    throw new Error('Cancellation requires AWB or Shiprocket order ID. Please wait for AWB generation and try again.')
  }

  let lastError: any = null
  let cancellationResult: any = null

  for (const attempt of providerAttempts) {
    try {
      cancellationResult = await attempt()
      if (isProviderCancellationAccepted(cancellationResult)) break
    } catch (error: any) {
      lastError = error
      cancellationResult = null
    }
  }

  if (!cancellationResult || !isProviderCancellationAccepted(cancellationResult)) {
    throw new Error(
      lastError?.message ||
        cancellationResult?.message ||
        'Shiprocket did not accept the B2B cancellation request.',
    )
  }

  await db
    .update(b2b_orders)
    .set({
      order_status: 'cancelled',
      label_allotment_status: order.awb_released_at
        ? order.label_allotment_status
        : 'allotment_cancelled',
      delivery_message: 'Cancellation requested',
      updated_at: new Date(),
    })
    .where(eq(b2b_orders.id, order.id))

  return {
    provider: 'shiprocket',
    type: 'b2b',
    orderId: order.id,
    orderNumber: order.order_number,
    awbNumber,
    result: cancellationResult,
  }
}

export async function cancelOrderShipment(orderId: string) {
  console.log('🔍 Starting cancellation for orderId:', orderId)

  const [order] = await db
    .select()
    .from(b2c_orders)
    .where(or(eq(b2c_orders.id, orderId), eq(b2c_orders.order_number, orderId)))

  if (!order) {
    const b2bCancellationResult = await cancelB2BShiprocketShipment(orderId)
    if (b2bCancellationResult) return b2bCancellationResult

    console.error('❌ Order not found:', orderId)
    throw new Error('Order not found')
  }

  console.log('📦 Order found:', {
    orderId: order.id,
    orderNumber: order.order_number,
    integrationType: order.integration_type,
    awbNumber: order.awb_number,
    shipmentId: order.shipment_id,
    currentStatus: order.order_status,
  })

  const integration = (order.integration_type || '').toLowerCase()
  if (integration !== 'shipmozo') {
    console.error('❌ Unsupported integration type:', { orderId, integration })
    throw new Error('Only Shipmozo is supported for cancellation')
  }

  if (!order.awb_number) {
    console.error('❌ Courier cancellation failed: Missing AWB number', { orderId, integration })
    throw new Error('Cancellation requires an AWB number')
  }

  console.log('🚚 Attempting courier cancellation:', {
    orderId,
    awbNumber: order.awb_number,
    integration,
  })

  const cancellationResult: any = await new ShipmozoService().cancelShipment({
    orderId: order.order_number || order.id,
    awbNumber: order.awb_number,
  })

  // Validate courier response
  // Check for various success indicators: boolean status, string status, success flags, or cancellation remark
  const isSuccess =
    cancellationResult?.success === true ||
    (typeof cancellationResult?.success === 'string' &&
      cancellationResult.success.toLowerCase().includes('cancel')) ||
    cancellationResult?.result === '1' ||
    cancellationResult?.Success === true ||
    cancellationResult?.status === true || // Boolean true (most common)
    cancellationResult?.status === 'Success' ||
    cancellationResult?.status === 'success' ||
    cancellationResult?.response?.status === true ||
    (cancellationResult?.remark &&
      cancellationResult.remark.toLowerCase().includes('cancelled')) || // Check remark field for cancellation confirmation
    (cancellationResult?.message &&
      cancellationResult?.message.toLowerCase().includes('success') &&
      !cancellationResult?.error) ||
    (cancellationResult?.message &&
      cancellationResult?.message.toLowerCase().includes('cancelled') &&
      !cancellationResult?.error)

  console.log('🔍 Courier response validation:', {
    integration,
    isSuccess,
    success: cancellationResult?.success,
    Success: cancellationResult?.Success,
    status: cancellationResult?.status,
    statusType: typeof cancellationResult?.status,
    remark: cancellationResult?.remark,
    message: cancellationResult?.message,
    error: cancellationResult?.error,
    fullResponse: cancellationResult,
  })

  if (!isSuccess) {
    const errorMsg =
      cancellationResult?.error || cancellationResult?.message || 'Courier cancellation not accepted'
    console.error('❌ Courier cancellation failed:', {
      orderId,
      integration,
      response: cancellationResult,
      message: errorMsg,
    })
    throw new Error(errorMsg)
  }

  console.log('✅ Courier cancellation successful')

  const finalStatus = 'cancelled'

  console.log(`💾 Updating order status to ${finalStatus}:`, { orderId, integration })

  await db.transaction(async (tx) => {
    await tx
      .update(b2c_orders)
      .set({
        order_status: finalStatus,
        label_allotment_status:
          order.label_allotment_status && !order.awb_released_at
            ? 'allotment_cancelled'
            : order.label_allotment_status,
        updated_at: new Date(),
      })
      .where(eq(b2c_orders.id, orderId))

    await applyCancellationRefundOnce(tx, order, 'pickup_cancel_api')
  })

  console.log(`✅ Order status updated to ${finalStatus} successfully:`, { orderId, integration })

  return cancellationResult
}
