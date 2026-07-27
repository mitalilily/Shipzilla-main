import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { b2b_orders } from '../models/schema/b2bOrders'
import { getShiprocketCargoShipmentDetails } from '../models/services/shiprocketCargo.service'

const readPath = (payload: any, path: string[]) =>
  path.reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return current[key]
  }, payload)

const readFirstString = (payload: any, paths: string[][]) => {
  for (const path of paths) {
    const value = readPath(payload, path)
    const normalized = String(value || '').trim()
    if (normalized) return normalized
  }
  return null
}

const extractShiprocketCargoAwb = (payload: any) =>
  readFirstString(payload, [
    ['waybill_no'],
    ['awb_number'],
    ['awb_code'],
    ['tracking_number'],
    ['awb'],
    ['lrn'],
    ['data', 'waybill_no'],
    ['data', 'awb_number'],
    ['data', 'awb_code'],
    ['data', 'tracking_number'],
    ['data', 'awb'],
    ['data', 'lrn'],
    ['data', 'shipment', 'waybill_no'],
    ['data', 'shipment', 'awb_number'],
    ['data', 'shipment_p', 'waybill_no'],
    ['data', 'shipment_p', 'awb_number'],
    ['result', 'waybill_no'],
    ['result', 'awb_number'],
    ['result', 'awb_code'],
    ['result', 'shipment', 'waybill_no'],
    ['result', 'shipment', 'awb_number'],
    ['child_waybill_nos', '0'],
  ])

const extractShiprocketCargoStatus = (payload: any) =>
  readFirstString(payload, [
    ['status_dp'],
    ['status'],
    ['tracking_status'],
    ['data', 'status_dp'],
    ['data', 'status'],
    ['result', 'status_dp'],
    ['result', 'status'],
  ])

export async function recoverMissingShiprocketCargoAwbs(batchSize = 25) {
  const pending = await db
    .select({
      id: b2b_orders.id,
      order_number: b2b_orders.order_number,
      shipment_id: b2b_orders.shipment_id,
      awb_number: b2b_orders.awb_number,
      courier_partner: b2b_orders.courier_partner,
    })
    .from(b2b_orders)
    .where(
      and(
        eq(b2b_orders.order_status, 'booked'),
        isNotNull(b2b_orders.shipment_id),
        sql`coalesce(nullif(trim(${b2b_orders.shipment_id}), ''), '') <> ''`,
        sql`coalesce(nullif(trim(${b2b_orders.awb_number}), ''), '') = ''`,
      ),
    )
    .limit(batchSize)

  if (!pending.length) return { checked: 0, updated: 0 }

  let updated = 0

  for (const order of pending) {
    const shipmentId = String(order.shipment_id || '').trim()
    if (!shipmentId) continue

    try {
      const details = await getShiprocketCargoShipmentDetails(shipmentId)
      const awbNumber = extractShiprocketCargoAwb(details)
      if (!awbNumber) continue

      const statusMessage = extractShiprocketCargoStatus(details) || 'AWB recovered from Shiprocket Cargo'

      await db
        .update(b2b_orders)
        .set({
          awb_number: awbNumber,
          delivery_message: statusMessage.slice(0, 100),
          updated_at: new Date(),
        })
        .where(eq(b2b_orders.id, order.id))

      updated += 1
      console.log('[Cron] Recovered Shiprocket Cargo AWB for B2B order', {
        orderId: order.id,
        orderNumber: order.order_number,
        shipmentId,
        awbNumber,
        courierPartner: order.courier_partner,
      })
    } catch (error: any) {
      console.error('[Cron] Failed to recover Shiprocket Cargo AWB for B2B order', {
        orderId: order.id,
        orderNumber: order.order_number,
        shipmentId,
        error: error?.message || error,
      })
    }
  }

  return { checked: pending.length, updated }
}
