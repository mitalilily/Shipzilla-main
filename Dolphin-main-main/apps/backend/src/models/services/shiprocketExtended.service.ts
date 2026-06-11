import axios from 'axios'
import { getEffectiveCourierConfig, ShiprocketConfig } from './courierCredentials.service'

/**
 * Shiprocket API service for all endpoints (extended version)
 * Covers all endpoints from https://apidocs.shiprocket.in
 */

// ───────────────────────────── Token Management ─────────────────────────────
let cachedToken: string | null = null
let tokenExpiry: number | null = null

export const getShiprocketToken = async (): Promise<string> => {
  try {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
      return cachedToken
    }

    // Try DB credentials first, fallback to env
    let email = process.env.SHIPROCKET_EMAIL
    let password = process.env.SHIPROCKET_PASSWORD
    let apiBase = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in/v1/external'

    try {
      const config = await getEffectiveCourierConfig<ShiprocketConfig>('shiprocket', 'b2c')
      if (config) {
        email = config.email || email
        password = config.password || password
        apiBase = config.apiBase || apiBase
      }
    } catch {
      // ignore db errors, use env fallback
    }

    if (!email || !password) {
      throw new Error('Shiprocket credentials not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in env.')
    }

    const res = await axios.post(`${apiBase}/auth/login`, {
      email,
      password,
    })

    cachedToken = res.data?.token || res.data?.jwt_token || ''
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000 // ~23 hours
    return cachedToken ?? ''
  } catch (error: any) {
    console.error('Shiprocket auth error:', error.response?.data || error.message)
    throw new Error('Failed to authenticate with Shiprocket')
  }
}

const getApiBase = async (): Promise<string> => {
  try {
    const config = await getEffectiveCourierConfig<ShiprocketConfig>('shiprocket', 'b2c')
    if (config?.apiBase) return config.apiBase.replace(/\/+$/, '')
  } catch {
    // ignore
  }
  return (process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in/v1/external').replace(/\/+$/, '')
}

const shiprocketRequest = async (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: any,
) => {
  const token = await getShiprocketToken()
  const apiBase = await getApiBase()
  const url = `${apiBase}${endpoint}`
  
  const config: any = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }

  if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    config.data = data
  }
  if (params) {
    config.params = params
  }

  try {
    const response = await axios(config)
    return response.data
  } catch (error: any) {
    const errorData = error.response?.data || error.message
    console.error(`[Shiprocket API Error] ${method} ${endpoint}:`, errorData)
    throw new Error(errorData?.message || errorData?.error || JSON.stringify(errorData) || 'Shiprocket API error')
  }
}

// ───────────────────────────── 1. COURIER / SERVICEABILITY ─────────────────────────────

/**
 * GET /courier/serviceability/
 * Check if a pincode is serviceable by a specific courier
 */
export const checkCourierServiceability = async (params: {
  pickup_postcode?: string
  delivery_postcode: string
  cod?: boolean
  weight?: number
  deliveryslot?: string
  coupon_id?: number
}) => {
  return shiprocketRequest('GET', '/courier/serviceability/', undefined, params)
}

/**
 * GET /courier/serviceability/self
 * Get self-serviceable pincodes
 */
export const getSelfServiceability = async (params?: {
  pickup_postcode?: string
  delivery_postcode?: string
  payment_type?: string
}) => {
  return shiprocketRequest('GET', '/courier/serviceability/self', undefined, params)
}

// ───────────────────────────── 2. ORDERS ─────────────────────────────

/**
 * POST /orders/cancel
 * Cancel orders by shipment IDs or AWB numbers
 */
export const cancelOrders = async (params: {
  ids?: number[]
  awbs?: string[]
}) => {
  return shiprocketRequest('POST', '/orders/cancel', params)
}

/**
 * GET /orders/show/{order_id}
 * Get order details by order ID
 */
export const getOrderDetails = async (orderId: number) => {
  return shiprocketRequest('GET', `/orders/show/${orderId}`)
}

/**
 * GET /orders
 * List all orders with filters
 */
export const listAllOrders = async (params?: {
  page?: number
  per_page?: number
  sort?: string
  status?: string
  payment_mode?: string
  from_date?: string
  to_date?: string
  search?: string
}) => {
  return shiprocketRequest('GET', '/orders', undefined, params)
}

/**
 * POST /orders/duplicate/{order_id}
 * Duplicate a shipment
 */
export const duplicateOrder = async (orderId: number) => {
  return shiprocketRequest('POST', `/orders/duplicate/${orderId}`)
}

/**
 * POST /orders/print/{order_id}
 * Print order invoice
 */
export const printOrderInvoice = async (orderId: number) => {
  return shiprocketRequest('POST', `/orders/print/${orderId}`)
}

/**
 * DELETE /orders/{order_id}
 * Delete order by ID
 */
export const deleteOrder = async (orderId: number) => {
  return shiprocketRequest('DELETE', `/orders/${orderId}`)
}

// ───────────────────────────── 3. SHIPMENTS / AWB ─────────────────────────────

/**
 * POST /courier/generate/awb
 * Generate AWB for an order
 */
export const generateAwb = async (params: {
  shipment_id: number | string
  courier_id: number | string
  is_return?: number
}) => {
  return shiprocketRequest('POST', '/courier/generate/awb', params)
}

/**
 * POST /courier/generate/label
 * Generate shipping label for an AWB
 */
export const generateLabel = async (params: {
  shipment_id: number | string
  awb_number: string
  is_return?: number
}) => {
  return shiprocketRequest('POST', '/courier/generate/label', params)
}

/**
 * POST /courier/generate/manifest
 * Generate manifest (pickup) for shipments
 */
export const generatePickupManifest = async (params: {
  shipment_id: number[] | string[]
}) => {
  return shiprocketRequest('POST', '/courier/generate/manifest', params)
}

/**
 * POST /shipments/export
 * Export shipments data
 */
export const exportShipments = async (params?: {
  from_date?: string
  to_date?: string
  status?: string
  payment_mode?: string
}) => {
  return shiprocketRequest('POST', '/shipments/export', params)
}

/**
 * GET /shipments
 * List shipments
 */
export const listShipments = async (params?: {
  page?: number
  per_page?: number
  sort?: string
  status?: string
  payment_mode?: string
  from_date?: string
  to_date?: string
}) => {
  return shiprocketRequest('GET', '/shipments', undefined, params)
}

// ───────────────────────────── 4. TRACKING ─────────────────────────────

/**
 * GET /courier/track
 * Track shipment by AWB
 */
export const trackShipment = async (awb: string) => {
  return shiprocketRequest('GET', '/courier/track', undefined, { awb })
}

/**
 * GET /courier/track/orders/{order_id}
 * Track shipment by order ID
 */
export const trackShipmentByOrderId = async (orderId: number) => {
  return shiprocketRequest('GET', `/courier/track/orders/${orderId}`)
}

// ───────────────────────────── 5. PICKUP LOCATIONS ─────────────────────────────

/**
 * GET /settings/company/addpickup
 * Get all pickup locations
 */
export const getPickupLocations = async () => {
  return shiprocketRequest('GET', '/settings/company/addpickup')
}

/**
 * POST /settings/company/addpickup
 * Add a new pickup location
 */
export const addPickupLocation = async (params: {
  pickup_location: string
  name: string
  email: string
  phone: string
  address: string
  address_2?: string
  city: string
  state: string
  country: string
  pin_code: string
  latitude?: string
  longitude?: string
}) => {
  return shiprocketRequest('POST', '/settings/company/addpickup', params)
}

/**
 * POST /settings/company/editpickup
 * Edit an existing pickup location
 */
export const editPickupLocation = async (params: {
  pickup_location: string
  name?: string
  email?: string
  phone?: string
  address?: string
  address_2?: string
  city?: string
  state?: string
  country?: string
  pin_code?: string
  latitude?: string
  longitude?: string
}) => {
  return shiprocketRequest('POST', '/settings/company/editpickup', params)
}

// ───────────────────────────── 6. ADDRESSES ─────────────────────────────

/**
 * POST /settings/company/addaddress
 * Add a new address
 */
export const addAddress = async (params: {
  name: string
  address: string
  address_2?: string
  city: string
  state: string
  country: string
  pin_code: string
  phone: string
  email?: string
  gst_no?: string
}) => {
  return shiprocketRequest('POST', '/settings/company/addaddress', params)
}

/**
 * GET /settings/company/addresses
 * Get all addresses
 */
export const getAddresses = async () => {
  return shiprocketRequest('GET', '/settings/company/addresses')
}

// ───────────────────────────── 7. NDR (Non-Delivery Report) ─────────────────────────────

/**
 * GET /ndr/list
 * List all NDRs
 */
export const listNdr = async (params?: {
  page?: number
  per_page?: number
  status?: string
  from_date?: string
  to_date?: string
}) => {
  return shiprocketRequest('GET', '/ndr/list', undefined, params)
}

/**
 * POST /ndr/update
 * Update NDR action
 */
export const updateNdrAction = async (params: {
  ndr_id: number | string
  action: 'reschedule' | 'cancel' | 'return' | 'rto' | 'attempt_2' | 'attempt_3'
  reason?: string
  pickup_date?: string
  pickup_time?: string
  comments?: string
}) => {
  return shiprocketRequest('POST', '/ndr/update', { ndr: params })
}

/**
 * GET /ndr/reschedule
 * List rescheduled NDRs
 */
export const listRescheduledNdr = async () => {
  return shiprocketRequest('GET', '/ndr/reschedule')
}

/**
 * POST /ndr/reschedule
 * Reschedule NDR delivery
 */
export const rescheduleNdr = async (params: {
  ndr_id: number
  pickup_date: string
  pickup_time_slot: string
  remark?: string
}) => {
  return shiprocketRequest('POST', '/ndr/reschedule', params)
}

// ───────────────────────────── 8. WEBHOOKS ─────────────────────────────

/**
 * POST /settings/webhook
 * Register/update webhook URL
 */
export const registerWebhook = async (params: {
  url: string
  events?: string[]
}) => {
  return shiprocketRequest('POST', '/settings/webhook', params)
}

/**
 * GET /settings/webhook
 * Get registered webhooks
 */
export const getWebhooks = async () => {
  return shiprocketRequest('GET', '/settings/webhook')
}

// ───────────────────────────── 9. CHANNELS / STORES ─────────────────────────────

/**
 * GET /channels
 * List all channels/stores
 */
export const listChannels = async () => {
  return shiprocketRequest('GET', '/channels')
}

/**
 * POST /channels
 * Add a new channel/store
 */
export const addChannel = async (params: {
  name: string
  channel: string
  url?: string
}) => {
  return shiprocketRequest('POST', '/channels', params)
}

// ───────────────────────────── 10. INVOICE ─────────────────────────────

/**
 * POST /orders/invoice/{order_id}
 * Generate invoice for an order
 */
export const generateInvoice = async (orderId: number) => {
  return shiprocketRequest('POST', `/orders/invoice/${orderId}`)
}

/**
 * POST /orders/print/invoice/{order_id}
 * Print invoice for order
 */
export const printInvoice = async (orderId: number) => {
  return shiprocketRequest('POST', `/orders/print/invoice/${orderId}`)
}

// ───────────────────────────── 11. CUSTOMER ─────────────────────────────

/**
 * POST /customers
 * Create a new customer
 */
export const createCustomer = async (params: {
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  pin_code?: string
}) => {
  return shiprocketRequest('POST', '/customers', params)
}

/**
 * GET /customers
 * List all customers
 */
export const listCustomers = async (params?: {
  page?: number
  per_page?: number
  search?: string
}) => {
  return shiprocketRequest('GET', '/customers', undefined, params)
}

// ───────────────────────────── 12. RETURNS / RTO ─────────────────────────────

/**
 * POST /orders/create/return
 * Create a return order
 */
export const createReturnOrder = async (params: {
  order_id: number | string
}) => {
  return shiprocketRequest('POST', '/orders/create/return', params)
}

// ───────────────────────────── 13. RECOMMENDED COURIERS ─────────────────────────────

/**
 * GET /courier/recommended
 * Get recommended couriers for a shipment
 */
export const getRecommendedCouriers = async (params: {
  pickup_postcode?: string
  delivery_postcode: string
  cod?: boolean
  weight?: number
  order_id?: number
  payment_type?: string
}) => {
  return shiprocketRequest('GET', '/courier/recommended', undefined, params)
}

// ───────────────────────────── 14. PICKUP ─────────────────────────────

/**
 * POST /courier/pickup
 * Schedule a pickup for shipment
 */
export const schedulePickup = async (params: {
  shipment_id: number[] | number
  pickup_date: string
  pickup_time: string
  pickup_location?: string
}) => {
  return shiprocketRequest('POST', '/courier/pickup', params)
}

/**
 * POST /courier/pickup/address/{pickup_id}
 * Update pickup address for shipment
 */
export const updatePickupAddress = async (pickupId: string, params: {
  shipment_id: number
}) => {
  return shiprocketRequest('POST', `/courier/pickup/address/${pickupId}`, params)
}