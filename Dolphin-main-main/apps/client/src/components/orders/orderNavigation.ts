type TrackableOrder = {
  awb_number?: string | null
  order_number?: string | null
  buyer_phone?: string | null
  buyer_email?: string | null
}

const sanitizeTrackingValue = (value?: string | null) => {
  const trimmed = String(value || '').trim()
  return trimmed.length ? trimmed : null
}

export const buildOrderTrackingParams = (order: TrackableOrder) => {
  const awb = sanitizeTrackingValue(order.awb_number)
  if (awb) {
    return { awb }
  }

  const orderNumber = sanitizeTrackingValue(order.order_number)
  const contact = sanitizeTrackingValue(order.buyer_phone || order.buyer_email)
  if (orderNumber && contact) {
    return { orderNumber, contact }
  }

  return null
}

export const buildOrderTrackingPath = (order: TrackableOrder) => {
  const params = buildOrderTrackingParams(order)
  if (!params) return null

  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value)
  })

  const search = searchParams.toString()
  return search ? `/tracking?${search}` : null
}
