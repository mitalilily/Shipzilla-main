export const ICARRY_STATUS_LABELS: Record<string, string> = {
  '1': 'Pending Pickup',
  '2': 'Processing',
  '3': 'Shipped',
  '7': 'Canceled',
  '12': 'Damaged',
  '14': 'Lost',
  '16': 'Voided',
  '21': 'Delivered',
  '22': 'In Transit',
  '23': 'Returned to Origin',
  '24': 'Manifested',
  '25': 'Pickup Scheduled',
  '26': 'Out For Delivery',
  '27': 'Pending Return',
}

export const mapIcarryStatusToInternal = (statusCode: string) => {
  switch (statusCode) {
    case '1':
      return { orderStatus: 'booked', pickupStatus: 'pending' }
    case '2':
      return { orderStatus: 'pickup_initiated', pickupStatus: 'processing' }
    case '24':
      return { orderStatus: 'shipment_created', pickupStatus: 'manifested' }
    case '25':
      return { orderStatus: 'pickup_initiated', pickupStatus: 'scheduled' }
    case '3':
    case '22':
      return { orderStatus: 'in_transit', pickupStatus: 'picked' }
    case '26':
      return { orderStatus: 'out_for_delivery', pickupStatus: 'picked' }
    case '21':
      return { orderStatus: 'delivered', pickupStatus: 'delivered' }
    case '23':
    case '27':
      return { orderStatus: 'rto', pickupStatus: 'returned' }
    case '7':
    case '16':
      return { orderStatus: 'cancelled', pickupStatus: 'cancelled' }
    case '12':
    case '14':
      return { orderStatus: 'failed', pickupStatus: 'failed' }
    default:
      return { orderStatus: 'in_transit', pickupStatus: 'processing' }
  }
}

export const resolveIcarryWebhookEvent = (status: string) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'delivered') return 'order.delivered' as const
  if (normalized === 'cancelled') return 'order.cancelled' as const
  if (normalized === 'rto') return 'order.rto' as const
  if (['shipment_created', 'in_transit', 'out_for_delivery'].includes(normalized)) {
    return 'order.shipped' as const
  }
  return 'order.updated' as const
}
