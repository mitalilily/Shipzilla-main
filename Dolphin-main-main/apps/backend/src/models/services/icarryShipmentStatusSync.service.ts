import { and, eq, inArray } from 'drizzle-orm'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'
import { HttpError } from '../../utils/classes'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { IcarryService, type IcarryShipmentStatusSyncRecord } from './couriers/icarry.service'
import {
  ICARRY_STATUS_LABELS,
  mapIcarryStatusToInternal,
  resolveIcarryWebhookEvent,
} from './icarryStatusMapping.service'
import { logTrackingEvent } from './trackingEvents.service'

type SyncCandidateOrder = {
  id: string
  user_id: string
  order_number: string
  shipment_id: string | null
  awb_number: string | null
  order_status: string | null
  pickup_status: string | null
  delivery_message: string | null
  courier_partner: string | null
}

export type IcarryShipmentStatusSyncItem = {
  order_id: string
  order_number: string
  shipment_id: string
  status_code: string
  status_label: string
  date_picked: string | null
  date_delivered: string | null
  previous_order_status: string | null
  updated_order_status: string | null
  previous_pickup_status: string | null
  updated_pickup_status: string | null
}

export type IcarryShipmentStatusSyncResult = {
  message: string
  requested_shipment_ids: string[]
  synced: IcarryShipmentStatusSyncItem[]
  missing_local_shipment_ids: string[]
  missing_provider_shipment_ids: string[]
}

const normalizeShipmentIds = (value: unknown): string[] => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  const normalized = rawList.map((item) => String(item ?? '').trim()).filter(Boolean)
  return [...new Set(normalized)]
}

const toIsoDateOrNull = (value: unknown): string | null => {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

export const syncIcarryShipmentStatusesForUser = async (
  userId: string,
  shipmentIds: unknown,
): Promise<IcarryShipmentStatusSyncResult> => {
  const normalizedShipmentIds = normalizeShipmentIds(shipmentIds)

  if (!normalizedShipmentIds.length) {
    throw new HttpError(400, 'shipment_ids must be a non-empty array')
  }

  const localOrders = await db
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
    .where(
      and(
        eq(b2c_orders.user_id, userId),
        eq(b2c_orders.integration_type, 'icarry'),
        inArray(b2c_orders.shipment_id, normalizedShipmentIds),
      ),
    )

  const ordersByShipmentId = new Map<string, SyncCandidateOrder>()
  for (const order of localOrders) {
    const shipmentId = String(order.shipment_id ?? '').trim()
    if (shipmentId) {
      ordersByShipmentId.set(shipmentId, order)
    }
  }

  const localShipmentIds = [...ordersByShipmentId.keys()]
  if (!localShipmentIds.length) {
    throw new HttpError(404, 'No icarry B2C orders were found for the provided shipment_ids')
  }

  const missingLocalShipmentIds = normalizedShipmentIds.filter((id) => !ordersByShipmentId.has(id))

  const icarry = new IcarryService()
  const response = await icarry.syncShipmentStatuses(localShipmentIds)
  const recordsByShipmentId = new Map<string, IcarryShipmentStatusSyncRecord>()

  for (const record of response.records) {
    const shipmentId = String(record.shipment_id ?? '').trim()
    if (shipmentId) {
      recordsByShipmentId.set(shipmentId, record)
    }
  }

  const synced: IcarryShipmentStatusSyncItem[] = []
  const missingProviderShipmentIds: string[] = []

  for (const shipmentId of localShipmentIds) {
    const order = ordersByShipmentId.get(shipmentId)
    const record = recordsByShipmentId.get(shipmentId)

    if (!order || !record) {
      missingProviderShipmentIds.push(shipmentId)
      continue
    }

    const statusCode = String(record.status ?? '').trim()
    const statusLabel = ICARRY_STATUS_LABELS[statusCode] || 'Unknown'
    const mapped = mapIcarryStatusToInternal(statusCode)
    const datePicked = toIsoDateOrNull(record.date_picked ?? record['date_picked '])
    const dateDelivered = toIsoDateOrNull(record.date_delivered)
    const previousOrderStatus = order.order_status
    const previousPickupStatus = order.pickup_status

    await db
      .update(b2c_orders)
      .set({
        order_status: mapped.orderStatus,
        pickup_status: mapped.pickupStatus,
        delivery_message: statusLabel,
        updated_at: new Date(),
      })
      .where(eq(b2c_orders.id, order.id))

    const hasMeaningfulStatusChange =
      previousOrderStatus !== mapped.orderStatus ||
      previousPickupStatus !== mapped.pickupStatus ||
      String(order.delivery_message ?? '').trim() !== statusLabel

    if (hasMeaningfulStatusChange) {
      await logTrackingEvent({
        orderId: order.id,
        userId: order.user_id,
        awbNumber: order.awb_number,
        courier: order.courier_partner || 'icarry',
        statusCode,
        statusText: statusLabel,
        raw: {
          ...record,
          date_picked: datePicked,
          date_delivered: dateDelivered,
        },
      })

      await sendWebhookEvent(order.user_id, 'tracking.updated', {
        order_id: order.id,
        order_number: order.order_number,
        awb_number: order.awb_number,
        shipment_id: shipmentId,
        status: mapped.orderStatus,
        raw_status_code: statusCode,
        raw_status_label: statusLabel,
        date_picked: datePicked,
        date_delivered: dateDelivered,
        courier_partner: order.courier_partner || 'icarry',
      })

      await sendWebhookEvent(order.user_id, resolveIcarryWebhookEvent(mapped.orderStatus), {
        order_id: order.id,
        order_number: order.order_number,
        awb_number: order.awb_number,
        shipment_id: shipmentId,
        status: mapped.orderStatus,
        pickup_status: mapped.pickupStatus,
        raw_status_code: statusCode,
        raw_status_label: statusLabel,
        date_picked: datePicked,
        date_delivered: dateDelivered,
      })
    }

    synced.push({
      order_id: order.id,
      order_number: order.order_number,
      shipment_id: shipmentId,
      status_code: statusCode,
      status_label: statusLabel,
      date_picked: datePicked,
      date_delivered: dateDelivered,
      previous_order_status: previousOrderStatus,
      updated_order_status: mapped.orderStatus,
      previous_pickup_status: previousPickupStatus,
      updated_pickup_status: mapped.pickupStatus,
    })
  }

  return {
    message: response.message,
    requested_shipment_ids: normalizedShipmentIds,
    synced,
    missing_local_shipment_ids: missingLocalShipmentIds,
    missing_provider_shipment_ids: missingProviderShipmentIds,
  }
}
