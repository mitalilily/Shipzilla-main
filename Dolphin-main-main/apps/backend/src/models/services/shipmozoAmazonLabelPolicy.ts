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
    return acceptDirectString && isHttpDocumentUrl(trimmed) ? trimmed : null
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
