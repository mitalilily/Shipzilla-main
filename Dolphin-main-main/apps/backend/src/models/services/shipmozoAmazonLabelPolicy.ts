import axios from 'axios'
import { PDFDocument } from 'pdf-lib'

const AMAZON_LABEL_KEYS = [
  'label',
  'label_url',
  'labelUrl',
  'shipping_label',
  'shipping_label_url',
  'pdf',
]

export const isHttpDocumentUrl = (value?: unknown) =>
  typeof value === 'string' && /^https?:\/\//i.test(value.trim())

export const isAmazonCourierName = (...values: unknown[]) =>
  values.some((value) => /amazon/i.test(String(value ?? '')))

export const isShipmozoAmazonOrder = (order: any) => {
  if (
    !isAmazonCourierName(
      order?.courier_partner,
      order?.courier_name,
      order?.courier_company,
      order?.courier_company_service,
    )
  ) {
    return false
  }

  const provider = String(order?.integration_type || '').trim().toLowerCase()
  return !provider || provider === 'shipmozo'
}

export const shouldFetchShipmozoAmazonOriginalLabel = ({
  integrationType,
  awbNumber,
  returnedCourierName,
  selectedCourierName,
  courierPartner,
}: {
  integrationType?: unknown
  awbNumber?: unknown
  returnedCourierName?: unknown
  selectedCourierName?: unknown
  courierPartner?: unknown
}) =>
  String(integrationType || '').trim().toLowerCase() === 'shipmozo' &&
  Boolean(String(awbNumber || '').trim()) &&
  isAmazonCourierName(returnedCourierName, selectedCourierName, courierPartner)

const extractLabelUrl = (
  payload: any,
  depth: number,
  acceptDirectString: boolean,
): string | null => {
  if (!payload || depth > 5) return null

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!acceptDirectString) return null
    if (isHttpDocumentUrl(trimmed) || /^data:[^;]+;base64,/i.test(trimmed)) return trimmed
    // Shipmozo's Amazon label endpoint commonly returns a raw base64 PNG.
    return trimmed.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed) ? trimmed : null
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractLabelUrl(item, depth + 1, acceptDirectString)
      if (found) return found
    }
    return null
  }

  if (typeof payload === 'object') {
    // Only accept known label fields. A generic nested `url` can be a tracking,
    // invoice, or API link and must never be stored as the Amazon label.
    for (const key of AMAZON_LABEL_KEYS) {
      const found = extractLabelUrl(payload[key], depth + 1, true)
      if (found) return found
    }

    for (const child of Object.values(payload)) {
      const found = extractLabelUrl(child, depth + 1, false)
      if (found) return found
    }
  }

  return null
}

export const extractShipmozoLabelUrl = (payload: any): string | null =>
  extractLabelUrl(payload, 0, true)

export const fetchShipmozoAmazonProviderLabel = async (
  awbNumber?: string | number | null,
) => {
  const normalizedAwb = String(awbNumber ?? '').trim()
  if (!normalizedAwb) return null

  const { ShipmozoService } = await import('./couriers/shipmozo.service')
  const response = await new ShipmozoService().getOrderLabel(normalizedAwb)
  return extractShipmozoLabelUrl(response?.data ?? response)
}

const decodeProviderDocument = async (providerDocument: string) => {
  const normalized = String(providerDocument || '').trim()
  if (!normalized) throw new Error('Shipmozo returned an empty Amazon label.')

  if (isHttpDocumentUrl(normalized)) {
    const response = await axios.get(normalized, {
      responseType: 'arraybuffer',
      timeout: 60000,
    })
    return Buffer.from(response.data)
  }

  const base64 = normalized.replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '')
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('Shipmozo returned an invalid Amazon label.')
  return buffer
}

export const convertShipmozoAmazonLabelToPdf = async (providerDocument: string) => {
  const source = await decodeProviderDocument(providerDocument)

  if (source.subarray(0, 4).toString('ascii') === '%PDF') return source

  const pdf = await PDFDocument.create()
  let image
  if (
    source.length >= 8 &&
    source[0] === 0x89 &&
    source.subarray(1, 4).toString('ascii') === 'PNG'
  ) {
    image = await pdf.embedPng(source)
  } else if (source[0] === 0xff && source[1] === 0xd8) {
    image = await pdf.embedJpg(source)
  } else {
    throw new Error('Shipmozo Amazon label is neither a PDF nor a supported image.')
  }

  const page = pdf.addPage([image.width, image.height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  })
  return Buffer.from(await pdf.save())
}
