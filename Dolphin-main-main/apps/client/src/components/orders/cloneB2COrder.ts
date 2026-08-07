import type { B2CFormData, Product } from './b2c/B2COrderForm'

type CloneableB2COrder = object

const today = () => new Date().toISOString().split('T')[0]
const cloneOrderNumber = () => `ORD-${Date.now()}`

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toStringValue = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback
  return String(value)
}

const normalizeProducts = (products: unknown): Product[] => {
  if (!Array.isArray(products) || products.length === 0) {
    return [{ productName: '', price: 0, quantity: 1 }]
  }

  return products.map((item: Record<string, unknown>) => ({
    productName: toStringValue(item.productName ?? item.name, 'Product'),
    price: toNumber(item.price),
    quantity: toNumber(item.quantity ?? item.qty, 1),
    discount: toNumber(item.discount),
    taxRate: toNumber(item.taxRate ?? item.tax_rate),
    hsnCode: toStringValue(item.hsnCode ?? item.hsn),
    sku: toStringValue(item.sku, 'NA'),
  }))
}

export const buildB2CCloneInitialValues = (order: CloneableB2COrder): Partial<B2CFormData> => {
  const source = order as Record<string, unknown>
  const pickup = (source.pickup_details || {}) as Record<string, unknown>
  const rto = (source.rto_details || {}) as Record<string, unknown>
  const isRtoDifferent = Boolean(source.is_rto_different)

  return {
    orderId: cloneOrderNumber(),
    orderDate: today(),
    orderType: source.order_type === 'cod' ? 'cod' : 'prepaid',
    buyerName: toStringValue(source.buyer_name),
    buyerPhone: toStringValue(source.buyer_phone),
    buyerEmail: toStringValue(source.buyer_email),
    address: toStringValue(source.address),
    pincode: toStringValue(source.pincode),
    city: toStringValue(source.city),
    state: toStringValue(source.state),
    country: toStringValue(source.country, 'India'),
    products: normalizeProducts(source.products),
    weight: toNumber(source.weight),
    length: toNumber(source.length),
    breadth: toNumber(source.breadth),
    height: toNumber(source.height),
    shippingCharges: toNumber(source.shipping_charges),
    transactionFee: toNumber(source.transaction_fee),
    giftWrap: toNumber(source.gift_wrap),
    discount: toNumber(source.discount),
    prepaidAmount: toNumber(source.prepaid_amount),
    courierCod: toNumber(source.cod_charges),
    forwardCharges: toNumber(source.freight_charges),
    otherCharges: toNumber(source.other_charges),
    courierCost: source.courier_cost === null || source.courier_cost === undefined
      ? null
      : toNumber(source.courier_cost),
    courierPartner: toStringValue(source.courier_partner),
    courierPartnerId: toStringValue(source.courier_id),
    integrationType: toStringValue(source.integration_type, 'shipmozo') as B2CFormData['integrationType'],
    selectedMaxSlabWeight:
      source.selected_max_slab_weight === null || source.selected_max_slab_weight === undefined
        ? null
        : toNumber(source.selected_max_slab_weight),
    zone: toStringValue(source.delivery_location),
    pickupDate: today(),
    pickupTime: '10:00',
    pickupLocationId: toStringValue(source.pickup_location_id),
    pickupLocationName: toStringValue(pickup.warehouse_name),
    pickupLocationPOCName: toStringValue(pickup.name),
    pickupLocationPOCPhone: toStringValue(pickup.phone),
    pickupAddress: toStringValue(pickup.address),
    pickupCity: toStringValue(pickup.city),
    pickupState: toStringValue(pickup.state),
    pickupLocationPincode: toStringValue(pickup.pincode),
    isRtoSame: !isRtoDifferent,
    rtoLocationName: toStringValue(rto.warehouse_name),
    rtoLocationPOCName: toStringValue(rto.name),
    rtoLocationPOCPhone: toStringValue(rto.phone),
    rtoAddress: toStringValue(rto.address),
    rtoCity: toStringValue(rto.city),
    rtoState: toStringValue(rto.state),
    rtoLocationPincode: toStringValue(rto.pincode),
  }
}
