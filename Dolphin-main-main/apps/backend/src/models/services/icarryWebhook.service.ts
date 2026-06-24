import { and, eq, or, sql } from 'drizzle-orm'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { ndr_events } from '../schema/ndr'
import {
  ICARRY_STATUS_LABELS,
  mapIcarryStatusToInternal,
  resolveIcarryWebhookEvent,
} from './icarryStatusMapping.service'
import {
  calculateChargedWeight,
  calculateVolumetricWeight,
} from './courierWeightCalculation.service'
import { createNotificationService } from './notifications.service'
import { recordNdrEvent } from './ndr.service'
import { logTrackingEvent } from './trackingEvents.service'
import { createWeightDiscrepancy } from './weightReconciliation.service'

const trim = (value: unknown) => String(value ?? '').trim()
const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const gramsToKg = (value: unknown) => {
  const grams = toNumber(value)
  return grams > 0 ? Number((grams / 1000).toFixed(3)) : 0
}
const parseDimensionString = (value: unknown) => {
  const raw = trim(value)
  if (!raw) return null
  const parts = raw
    .split(/[xX*]/)
    .map((part) => Number(String(part).replace(/[^\d.]/g, '')))
    .filter((part) => Number.isFinite(part) && part > 0)

  if (parts.length !== 3) return null
  return {
    length: Number(parts[0].toFixed(3)),
    breadth: Number(parts[1].toFixed(3)),
    height: Number(parts[2].toFixed(3)),
  }
}

const normalizeComparableText = (value: unknown) => String(value || '').trim().toLowerCase()

const shouldSkipDuplicateIcarryNdrEvent = async (params: {
  orderId: string
  status: string
  reason?: string | null
  remarks?: string | null
  attemptNo?: string | null
}) => {
  const [latest] = await db
    .select({
      created_at: ndr_events.created_at,
      status: ndr_events.status,
      reason: ndr_events.reason,
      remarks: ndr_events.remarks,
      attempt_no: ndr_events.attempt_no,
    })
    .from(ndr_events)
    .where(eq(ndr_events.order_id, params.orderId))
    .orderBy(sql`${ndr_events.created_at} desc`)
    .limit(1)

  if (!latest?.created_at) return false

  const ageMs = Date.now() - new Date(latest.created_at).getTime()
  const withinDuplicateWindow = ageMs >= 0 && ageMs <= 10 * 60 * 1000
  if (!withinDuplicateWindow) return false

  return (
    normalizeComparableText(latest.status) === normalizeComparableText(params.status) &&
    normalizeComparableText(latest.reason) === normalizeComparableText(params.reason) &&
    normalizeComparableText(latest.remarks) === normalizeComparableText(params.remarks) &&
    normalizeComparableText(latest.attempt_no) === normalizeComparableText(params.attemptNo)
  )
}

export const processIcarryStatusWebhook = async (payload: any, tx = db) => {
  const awb = trim(payload?.awb || payload?.waybill || payload?.tracking_number)
  const statusCode = trim(payload?.status)

  if (!awb) return { success: false as const, reason: 'missing_awb' as const }
  if (!statusCode) return { success: false as const, reason: 'missing_status' as const }

  const [order] = await tx
    .select({
      id: b2c_orders.id,
      user_id: b2c_orders.user_id,
      order_number: b2c_orders.order_number,
      shipment_id: b2c_orders.shipment_id,
      awb_number: b2c_orders.awb_number,
      order_status: b2c_orders.order_status,
      pickup_status: b2c_orders.pickup_status,
      delivery_message: b2c_orders.delivery_message,
      courier_partner: b2c_orders.courier_partner,
    })
    .from(b2c_orders)
    .where(and(eq(b2c_orders.integration_type, 'icarry'), eq(b2c_orders.awb_number, awb)))
    .limit(1)

  if (!order) {
    console.warn(`No local iCarry order found for AWB ${awb}`)
    return { success: false as const, reason: 'order_not_found' as const }
  }

  const statusLabel = ICARRY_STATUS_LABELS[statusCode] || 'Unknown'
  const mappedStatus = mapIcarryStatusToInternal(statusCode)
  const previousOrderStatus = order.order_status
  const previousPickupStatus = order.pickup_status

  await tx
    .update(b2c_orders)
    .set({
      order_status: mappedStatus.orderStatus,
      pickup_status: mappedStatus.pickupStatus,
      delivery_message: statusLabel,
      updated_at: new Date(),
    })
    .where(eq(b2c_orders.id, order.id))

  const hasMeaningfulStatusChange =
    previousOrderStatus !== mappedStatus.orderStatus ||
    previousPickupStatus !== mappedStatus.pickupStatus ||
    trim(order.delivery_message) !== statusLabel

  if (hasMeaningfulStatusChange) {
    await logTrackingEvent({
      orderId: order.id,
      userId: order.user_id,
      awbNumber: order.awb_number || awb,
      courier: order.courier_partner || 'iCarry',
      statusCode,
      statusText: statusLabel,
      raw: payload,
    })

    await sendWebhookEvent(order.user_id, 'tracking.updated', {
      order_id: order.id,
      order_number: order.order_number,
      awb_number: order.awb_number || awb,
      shipment_id: order.shipment_id,
      status: mappedStatus.orderStatus,
      pickup_status: mappedStatus.pickupStatus,
      raw_status_code: statusCode,
      raw_status_label: statusLabel,
      courier_partner: order.courier_partner || 'iCarry',
    })

    await sendWebhookEvent(order.user_id, resolveIcarryWebhookEvent(mappedStatus.orderStatus), {
      order_id: order.id,
      order_number: order.order_number,
      awb_number: order.awb_number || awb,
      shipment_id: order.shipment_id,
      status: mappedStatus.orderStatus,
      pickup_status: mappedStatus.pickupStatus,
      raw_status_code: statusCode,
      raw_status_label: statusLabel,
      courier_partner: order.courier_partner || 'iCarry',
    })
  }

  return {
    success: true as const,
    awb,
    status_code: statusCode,
    status_label: statusLabel,
    order_id: order.id,
    order_number: order.order_number,
    shipment_id: order.shipment_id,
    changed: hasMeaningfulStatusChange,
  }
}

export const processIcarryNdrWebhook = async (payload: any, tx = db) => {
  const ndrItems = Array.isArray(payload?.ndr_data) ? payload.ndr_data : []

  if (!ndrItems.length) {
    return { success: false as const, reason: 'missing_ndr_data' as const }
  }

  const processed: Array<Record<string, any>> = []
  const duplicates: Array<Record<string, any>> = []
  const missingOrders: Array<Record<string, any>> = []
  const invalidEntries: Array<Record<string, any>> = []

  for (const item of ndrItems) {
    const awb = trim(item?.awb || item?.waybill || item?.tracking_number)
    const shipmentId = trim(item?.shipment_id || item?.shipmentId)
    const ndrType = trim(item?.type) || 'MANUAL-VERIFY'
    const dateAdded = trim(item?.date_added)
    const remarks = dateAdded ? `iCarry NDR detected on ${dateAdded}` : 'iCarry NDR detected'

    if (!awb && !shipmentId) {
      invalidEntries.push({
        shipment_id: shipmentId || null,
        awb: awb || null,
        type: ndrType,
        date_added: dateAdded || null,
      })
      continue
    }

    const [order] = await tx
      .select({
        id: b2c_orders.id,
        user_id: b2c_orders.user_id,
        order_number: b2c_orders.order_number,
        shipment_id: b2c_orders.shipment_id,
        awb_number: b2c_orders.awb_number,
        order_status: b2c_orders.order_status,
        pickup_status: b2c_orders.pickup_status,
        courier_partner: b2c_orders.courier_partner,
      })
      .from(b2c_orders)
      .where(
        and(
          eq(b2c_orders.integration_type, 'icarry'),
          or(
            awb ? eq(b2c_orders.awb_number, awb) : undefined,
            shipmentId ? eq(b2c_orders.shipment_id, shipmentId) : undefined,
          )!,
        ),
      )
      .limit(1)

    if (!order) {
      missingOrders.push({
        shipment_id: shipmentId || null,
        awb: awb || null,
        type: ndrType,
        date_added: dateAdded || null,
      })
      continue
    }

    const finalAwb = trim(order.awb_number || awb)
    const duplicate = await shouldSkipDuplicateIcarryNdrEvent({
      orderId: order.id,
      status: 'ndr',
      reason: ndrType,
      remarks,
      attemptNo: null,
    })

    if (duplicate) {
      duplicates.push({
        order_id: order.id,
        order_number: order.order_number,
        shipment_id: order.shipment_id,
        awb: finalAwb || null,
        type: ndrType,
        date_added: dateAdded || null,
      })
      continue
    }

    const currentOrderStatus = trim(order.order_status).toLowerCase()
    const shouldUpdateOrderStatus = !['delivered', 'cancelled', 'rto', 'rto_delivered'].includes(
      currentOrderStatus,
    )

    if (shouldUpdateOrderStatus) {
      await tx
        .update(b2c_orders)
        .set({
          order_status: 'ndr',
          delivery_message: ndrType,
          updated_at: new Date(),
        })
        .where(eq(b2c_orders.id, order.id))
    }

    await logTrackingEvent({
      orderId: order.id,
      userId: order.user_id,
      awbNumber: finalAwb || null,
      courier: order.courier_partner || 'iCarry',
      statusCode: 'ndr',
      statusText: ndrType,
      raw: item,
    })

    await sendWebhookEvent(order.user_id, 'tracking.updated', {
      order_id: order.id,
      order_number: order.order_number,
      awb_number: finalAwb || null,
      shipment_id: order.shipment_id,
      status: shouldUpdateOrderStatus ? 'ndr' : order.order_status,
      raw_status_code: 'ndr',
      raw_status_label: ndrType,
      courier_partner: order.courier_partner || 'iCarry',
      date_added: dateAdded || null,
    })

    await recordNdrEvent({
      orderId: order.id,
      userId: order.user_id,
      awbNumber: finalAwb || undefined,
      status: 'ndr',
      reason: ndrType,
      remarks,
      payload: item,
    })

    await createNotificationService({
      targetRole: 'user',
      userId: order.user_id,
      title: 'Delivery attempt issue (iCarry)',
      message: `Order ${order.order_number} marked as ndr.`,
    })
    await createNotificationService({
      targetRole: 'admin',
      title: 'NDR captured (iCarry)',
      message: `User ${order.user_id} order ${order.order_number} status ndr`,
    })

    processed.push({
      order_id: order.id,
      order_number: order.order_number,
      shipment_id: order.shipment_id,
      awb: finalAwb || null,
      type: ndrType,
      date_added: dateAdded || null,
      updated_order_status: shouldUpdateOrderStatus ? 'ndr' : order.order_status,
    })
  }

  if (!processed.length && !duplicates.length && missingOrders.length) {
    return {
      success: false as const,
      reason: 'order_not_found' as const,
      missing_orders: missingOrders,
      invalid_entries: invalidEntries,
    }
  }

  if (!processed.length && !duplicates.length && invalidEntries.length) {
    return {
      success: false as const,
      reason: 'missing_awb' as const,
      invalid_entries: invalidEntries,
    }
  }

  return {
    success: true as const,
    callback_type: 'ndr_status' as const,
    processed,
    duplicates,
    missing_orders: missingOrders,
    invalid_entries: invalidEntries,
  }
}

export const processIcarryWeightDiscrepancyWebhook = async (payload: any, tx = db) => {
  const awb = trim(payload?.awb || payload?.waybill || payload?.tracking_number)
  const shipmentId = trim(payload?.shipment_id || payload?.shipmentId)
  const status = trim(payload?.status)
  const oldWeightKg = gramsToKg(payload?.old_weight)
  const newWeightKg = gramsToKg(payload?.new_weight)

  if (!awb && !shipmentId) {
    return { success: false as const, reason: 'missing_awb' as const }
  }

  if (!status) {
    return { success: false as const, reason: 'missing_status' as const }
  }

  if (!oldWeightKg || !newWeightKg) {
    return { success: false as const, reason: 'missing_weight' as const }
  }

  const [order] = await tx
    .select({
      id: b2c_orders.id,
      user_id: b2c_orders.user_id,
      order_number: b2c_orders.order_number,
      shipment_id: b2c_orders.shipment_id,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      weight: b2c_orders.weight,
      length: b2c_orders.length,
      breadth: b2c_orders.breadth,
      height: b2c_orders.height,
      freight_charges: b2c_orders.freight_charges,
      order_status: b2c_orders.order_status,
    })
    .from(b2c_orders)
    .where(
      and(
        eq(b2c_orders.integration_type, 'icarry'),
        or(
          awb ? eq(b2c_orders.awb_number, awb) : undefined,
          shipmentId ? eq(b2c_orders.shipment_id, shipmentId) : undefined,
        )!,
      ),
    )
    .limit(1)

  if (!order) {
    console.warn(`No local iCarry order found for weight discrepancy AWB ${awb || 'N/A'} shipment ${shipmentId || 'N/A'}`)
    return { success: false as const, reason: 'order_not_found' as const }
  }

  const declaredDimensions =
    parseDimensionString(payload?.old_dimensions) || {
      length: toNumber(order.length),
      breadth: toNumber(order.breadth),
      height: toNumber(order.height),
    }
  const actualDimensions = parseDimensionString(payload?.new_dimensions) || undefined
  const volumetricWeight =
    actualDimensions && actualDimensions.length && actualDimensions.breadth && actualDimensions.height
      ? calculateVolumetricWeight(actualDimensions, order.courier_partner || 'iCarry')
      : undefined
  const chargedWeight = volumetricWeight
    ? calculateChargedWeight(newWeightKg, volumetricWeight, order.courier_partner || 'iCarry')
    : newWeightKg

  const discrepancy = await createWeightDiscrepancy({
    orderType: 'b2c',
    orderId: order.id,
    userId: order.user_id,
    orderNumber: order.order_number,
    awbNumber: order.awb_number || awb || undefined,
    courierPartner: order.courier_partner || 'iCarry',
    declaredWeight: oldWeightKg || toNumber(order.weight),
    actualWeight: newWeightKg,
    volumetricWeight,
    chargedWeight,
    declaredDimensions,
    actualDimensions,
    originalShippingCharge: order.freight_charges ? Number(order.freight_charges) : undefined,
    courierRemarks: trim(payload?.courier_products || 'iCarry weight discrepancy detected'),
    weighingMetadata: {
      source: 'icarry_webhook',
      timestamp: new Date().toISOString(),
    },
  })

  await logTrackingEvent({
    orderId: order.id,
    userId: order.user_id,
    awbNumber: order.awb_number || awb,
    courier: order.courier_partner || 'iCarry',
    statusCode: 'weight_discrepancy',
    statusText: 'Weight discrepancy detected',
    raw: payload,
  })

  await sendWebhookEvent(order.user_id, 'tracking.updated', {
    order_id: order.id,
    order_number: order.order_number,
    awb_number: order.awb_number || awb,
    shipment_id: order.shipment_id,
    status: order.order_status || 'weight_discrepancy',
    raw_status_code: 'weight_discrepancy',
    raw_status_label: 'Weight discrepancy detected',
    courier_partner: order.courier_partner || 'iCarry',
    old_weight_kg: oldWeightKg,
    new_weight_kg: newWeightKg,
    charged_weight_kg: chargedWeight,
    volumetric_weight_kg: volumetricWeight,
    discrepancy_id: discrepancy.id,
  })

  return {
    success: true as const,
    callback_type: 'new_weight_discrepancy' as const,
    order_id: order.id,
    order_number: order.order_number,
    shipment_id: order.shipment_id,
    awb: order.awb_number || awb || null,
    discrepancy_id: discrepancy.id,
    old_weight_kg: oldWeightKg,
    new_weight_kg: newWeightKg,
    charged_weight_kg: chargedWeight,
    volumetric_weight_kg: volumetricWeight || null,
  }
}

export const processIcarryWebhookPayload = async (payload: any, tx = db) => {
  const callbackType = trim(payload?.callback_type).toLowerCase()
  if (callbackType === 'ndr_status') {
    return processIcarryNdrWebhook(payload, tx)
  }
  if (callbackType === 'new_weight_discrepancy') {
    return processIcarryWeightDiscrepancyWebhook(payload, tx)
  }
  return processIcarryStatusWebhook(payload, tx)
}
