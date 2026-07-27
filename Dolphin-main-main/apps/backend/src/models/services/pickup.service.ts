import { eq, or } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { ShipmozoService } from './couriers/shipmozo.service'
import { applyCancellationRefundOnce } from './webhookProcessor'

export async function cancelOrderShipment(orderId: string) {
  console.log('🔍 Starting cancellation for orderId:', orderId)

  const [order] = await db
    .select()
    .from(b2c_orders)
    .where(or(eq(b2c_orders.id, orderId), eq(b2c_orders.order_number, orderId)))

  if (!order) {
    const [b2bOrder] = await db
      .select({
        id: b2b_orders.id,
        order_number: b2b_orders.order_number,
        awb_number: b2b_orders.awb_number,
        shipment_id: b2b_orders.shipment_id,
        courier_partner: b2b_orders.courier_partner,
        order_status: b2b_orders.order_status,
      })
      .from(b2b_orders)
      .where(or(eq(b2b_orders.id, orderId), eq(b2b_orders.order_number, orderId)))

    if (b2bOrder) {
      console.error('B2B cancellation requested but no supported B2B cancellation provider is configured:', {
        orderId: b2bOrder.id,
        orderNumber: b2bOrder.order_number,
        awbNumber: b2bOrder.awb_number,
        shipmentId: b2bOrder.shipment_id,
        courierPartner: b2bOrder.courier_partner,
        currentStatus: b2bOrder.order_status,
      })
      throw new Error('B2B Shiprocket Cargo cancellation is not supported yet. Please cancel it from the Shiprocket Cargo panel or contact support.')
    }
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
      .set({ order_status: finalStatus, updated_at: new Date() })
      .where(eq(b2c_orders.id, orderId))

    await applyCancellationRefundOnce(tx, order, 'pickup_cancel_api')
  })

  console.log(`✅ Order status updated to ${finalStatus} successfully:`, { orderId, integration })

  return cancellationResult
}
