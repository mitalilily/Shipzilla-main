import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { HttpError } from '../../utils/classes'
import { IcarryService } from './couriers/icarry.service'
import { downloadAndUploadToR2, presignDownload } from './upload.service'

type LocalIcarryOrder = {
  id: string
  order_number: string
  shipment_id: string | null
  awb_number: string | null
  label: string | null
  sort_code: string | null
}

type IcarryShipmentLabelDocument = {
  url: string
  type: string
}

export type IcarryPrintedShipmentLabelResult = {
  order_id: string
  order_number: string
  shipment_id: string
  awb: string | null
  parcel_type: string | null
  parcel_value: string | null
  courier_name: string | null
  courier_id: string | null
  sort_code: string | null
  barcode_img: string | null
  return_address: string | null
  consignee_address: string | null
  consignee_mobile: string | null
  shipment_labels: IcarryShipmentLabelDocument[]
  stored_label_key: string | null
  stored_label_url: string | null
  raw: any
}

const normalizeShipmentId = (value: unknown) => String(value ?? '').trim()

const normalizeString = (value: unknown): string | null => {
  const raw = String(value ?? '').trim()
  return raw || null
}

const normalizeShipmentLabels = (value: unknown): IcarryShipmentLabelDocument[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => ({
      url: String((item as any)?.url ?? '').trim(),
      type: String((item as any)?.type ?? '').trim().toLowerCase(),
    }))
    .filter((item) => item.url)
}

const contentTypeForLabel = (type: string) => {
  if (type === 'png') return 'image/png'
  if (type === 'jpg' || type === 'jpeg') return 'image/jpeg'
  return 'application/pdf'
}

export const printIcarryShipmentLabelForUser = async (
  userId: string,
  shipmentIdInput: unknown,
): Promise<IcarryPrintedShipmentLabelResult> => {
  const shipmentId = normalizeShipmentId(shipmentIdInput)
  if (!shipmentId) {
    throw new HttpError(400, 'shipment_id is required')
  }

  const [order] = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      shipment_id: b2c_orders.shipment_id,
      awb_number: b2c_orders.awb_number,
      label: b2c_orders.label,
      sort_code: b2c_orders.sort_code,
    })
    .from(b2c_orders)
    .where(
      and(
        eq(b2c_orders.user_id, userId),
        eq(b2c_orders.integration_type, 'icarry'),
        eq(b2c_orders.shipment_id, shipmentId),
      ),
    )
    .limit(1)

  if (!order) {
    throw new HttpError(404, `No icarry B2C order was found for shipment_id ${shipmentId}`)
  }

  const icarry = new IcarryService()
  const response = await icarry.getPackagingSlip(shipmentId)

  const shipmentLabels = normalizeShipmentLabels((response as any)?.shipment_label)
  const firstReadyLabel = shipmentLabels[0] ?? null

  let storedLabelKey: string | null = null
  let storedLabelUrl: string | null = null

  if (firstReadyLabel?.url) {
    const extension = firstReadyLabel.type === 'png' ? 'png' : 'pdf'
    storedLabelKey = await downloadAndUploadToR2({
      url: firstReadyLabel.url,
      userId,
      filename: `icarry-label-${shipmentId}.${extension}`,
      folderKey: 'labels',
      contentType: contentTypeForLabel(firstReadyLabel.type),
    })

    if (storedLabelKey) {
      const signed = await presignDownload(storedLabelKey, {
        disposition: 'inline',
        downloadName: `icarry-label-${shipmentId}.${extension}`,
        contentType: contentTypeForLabel(firstReadyLabel.type),
      })

      storedLabelUrl = Array.isArray(signed) ? signed[0] || null : signed
    }
  }

  const nextAwb = normalizeString((response as any)?.awb) || order.awb_number
  const nextSortCode = normalizeString((response as any)?.sort_code) || order.sort_code

  await db
    .update(b2c_orders)
    .set({
      awb_number: nextAwb,
      sort_code: nextSortCode,
      label: storedLabelKey || order.label,
      updated_at: new Date(),
    })
    .where(eq(b2c_orders.id, order.id))

  return {
    order_id: order.id,
    order_number: order.order_number,
    shipment_id: shipmentId,
    awb: nextAwb,
    parcel_type: normalizeString((response as any)?.parcel_type),
    parcel_value: normalizeString((response as any)?.parcel_value),
    courier_name: normalizeString((response as any)?.courier_name),
    courier_id: normalizeString((response as any)?.courier_id),
    sort_code: nextSortCode,
    barcode_img: normalizeString((response as any)?.barcode_img),
    return_address: normalizeString((response as any)?.return_address),
    consignee_address: normalizeString((response as any)?.consignee_address),
    consignee_mobile: normalizeString((response as any)?.consignee_mobile),
    shipment_labels: shipmentLabels,
    stored_label_key: storedLabelKey || order.label,
    stored_label_url: storedLabelUrl,
    raw: response,
  }
}
