import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { IcarryService, type IcarryBillingSyncRecord } from './couriers/icarry.service'
import { HttpError } from '../../utils/classes'

type SyncCandidateOrder = {
  id: string
  order_number: string
  shipment_id: string | null
  awb_number: string | null
  weight: number | null
  charged_weight: number | null
  courier_cost: number | null
  shipping_mode: string | null
}

export type IcarryShipmentChargeSyncItem = {
  order_id: string
  order_number: string
  shipment_id: string
  awb: string
  billed_at: string | null
  billed_amount: number | null
  mode: string | null
  zone: string | null
  weight: number | null
  previous_courier_cost: number | null
  updated_courier_cost: number | null
}

export type IcarryShipmentChargeSyncResult = {
  message: string
  requested_shipment_ids: string[]
  synced: IcarryShipmentChargeSyncItem[]
  missing_local_shipment_ids: string[]
  missing_provider_shipment_ids: string[]
}

const normalizeShipmentIds = (value: unknown): string[] => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  const normalized = rawList
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)

  return [...new Set(normalized)]
}

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeMode = (value: unknown): string | null => {
  const raw = String(value ?? '').trim().toUpperCase()
  return raw || null
}

const toIsoDateOrNull = (value: unknown): string | null => {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

export const syncIcarryShipmentChargesForUser = async (
  userId: string,
  shipmentIds: unknown,
): Promise<IcarryShipmentChargeSyncResult> => {
  const normalizedShipmentIds = normalizeShipmentIds(shipmentIds)

  if (!normalizedShipmentIds.length) {
    throw new HttpError(400, 'shipment_ids must be a non-empty array')
  }

  const localOrders = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      shipment_id: b2c_orders.shipment_id,
      awb_number: b2c_orders.awb_number,
      weight: b2c_orders.weight,
      charged_weight: b2c_orders.charged_weight,
      courier_cost: b2c_orders.courier_cost,
      shipping_mode: b2c_orders.shipping_mode,
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
    throw new HttpError(404, 'No iCarry B2C orders were found for the provided shipment_ids')
  }

  const missingLocalShipmentIds = normalizedShipmentIds.filter((id) => !ordersByShipmentId.has(id))

  const icarry = new IcarryService()
  const response = await icarry.syncShipmentCharges(localShipmentIds)
  const records = response.records
  const recordsByShipmentId = new Map<string, IcarryBillingSyncRecord>()

  for (const record of records) {
    const shipmentId = String(record.shipment_id ?? '').trim()
    if (shipmentId) {
      recordsByShipmentId.set(shipmentId, record)
    }
  }

  const synced: IcarryShipmentChargeSyncItem[] = []
  const missingProviderShipmentIds: string[] = []

  for (const shipmentId of localShipmentIds) {
    const order = ordersByShipmentId.get(shipmentId)
    const record = recordsByShipmentId.get(shipmentId)

    if (!order || !record) {
      missingProviderShipmentIds.push(shipmentId)
      continue
    }

    const billedAmount = toNullableNumber(record.miles)
    const billedWeight = toNullableNumber(record.weight)
    const billedMode = normalizeMode(record.mode)
    const awb = String(record.awb ?? '').trim() || order.awb_number || ''

    await db
      .update(b2c_orders)
      .set({
        awb_number: awb || order.awb_number,
        courier_cost: billedAmount ?? order.courier_cost,
        charged_weight: billedWeight ?? order.charged_weight,
        shipping_mode: billedMode ?? order.shipping_mode,
        weight_discrepancy:
          billedWeight !== null && order.weight !== null
            ? Number(order.weight) !== billedWeight
            : undefined,
        updated_at: new Date(),
      })
      .where(eq(b2c_orders.id, order.id))

    synced.push({
      order_id: order.id,
      order_number: order.order_number,
      shipment_id: shipmentId,
      awb,
      billed_at: toIsoDateOrNull(record.date),
      billed_amount: billedAmount,
      mode: billedMode,
      zone: String(record.zone ?? '').trim() || null,
      weight: billedWeight,
      previous_courier_cost: order.courier_cost,
      updated_courier_cost: billedAmount ?? order.courier_cost,
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
