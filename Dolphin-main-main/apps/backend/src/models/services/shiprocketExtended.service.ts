import axios from 'axios'
import FormData from 'form-data'
import { getEffectiveCourierConfig, ShiprocketConfig } from './courierCredentials.service'

/**
 * Shiprocket API service for all endpoints (extended version)
 * Covers all endpoints from https://apidocs.shiprocket.in
 */

// ───────────────────────────── Token Management ─────────────────────────────
let cachedToken: string | null = null
let tokenExpiry: number | null = null

type ShiprocketAuthCredentials = {
  email?: string
  password?: string
}

type ShiprocketAuthResponse = {
  token: string
  refreshToken?: string
  expiresAt?: number | null
  raw: any
}

const parseJwtExpiry = (token: string): number | null => {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    const exp = decoded?.exp
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      return exp < 1e12 ? exp * 1000 : exp
    }
  } catch {
    // ignore malformed tokens
  }

  return null
}

const extractShiprocketAuthResponse = (data: any): ShiprocketAuthResponse => {
  const token = String(
    data?.token ||
      data?.jwt_token ||
      data?.access_token ||
      data?.data?.token ||
      data?.data?.jwt_token ||
      data?.data?.access_token ||
      '',
  ).trim()

  const refreshToken = String(
    data?.refresh_token ||
      data?.refreshToken ||
      data?.reference_token ||
      data?.referenceToken ||
      data?.data?.refresh_token ||
      data?.data?.refreshToken ||
      data?.data?.reference_token ||
      data?.data?.referenceToken ||
      '',
  ).trim()

  const apiExpiry =
    data?.expires_at ??
    data?.expiresAt ??
    data?.data?.expires_at ??
    data?.data?.expiresAt ??
    null

  let expiresAt: number | null = null
  if (typeof apiExpiry === 'number' && Number.isFinite(apiExpiry)) {
    expiresAt = apiExpiry < 1e12 ? apiExpiry * 1000 : apiExpiry
  } else if (token) {
    expiresAt = parseJwtExpiry(token)
  }

  return {
    token,
    refreshToken: refreshToken || undefined,
    expiresAt,
    raw: data,
  }
}

const cacheShiprocketToken = (auth: ShiprocketAuthResponse) => {
  if (!auth.token) return
  cachedToken = auth.token
  tokenExpiry = auth.expiresAt ?? Date.now() + 23 * 60 * 60 * 1000
}

const clearShiprocketTokenCache = () => {
  cachedToken = null
  tokenExpiry = null
}

const resolveShiprocketCredentials = async (overrides?: ShiprocketAuthCredentials) => {
  let email = overrides?.email?.trim() || process.env.SHIPROCKET_EMAIL
  let password = overrides?.password || process.env.SHIPROCKET_PASSWORD
  let apiBase = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in/v1/external'

  try {
    const config = await getEffectiveCourierConfig<ShiprocketConfig>('shiprocket', 'b2c')
    if (config) {
      email = overrides?.email?.trim() || config.email || email
      password = overrides?.password || config.password || password
      apiBase = config.apiBase || apiBase
    }
  } catch {
    // ignore db errors, use env fallback
  }

  return {
    email,
    password,
    apiBase: apiBase.replace(/\/+$/, ''),
  }
}

const authenticateShiprocket = async (
  overrides?: ShiprocketAuthCredentials,
): Promise<ShiprocketAuthResponse> => {
  const shouldUseCache = !overrides?.email && !overrides?.password
  if (shouldUseCache && cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return {
      token: cachedToken,
      expiresAt: tokenExpiry,
      raw: { token: cachedToken },
    }
  }

  const { email, password, apiBase } = await resolveShiprocketCredentials(overrides)

  if (!email || !password) {
    throw new Error(
      'Shiprocket credentials not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in env.',
    )
  }

  const res = await axios.post(
    `${apiBase}/auth/login`,
    {
      email,
      password,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )

  const auth = extractShiprocketAuthResponse(res.data)
  cacheShiprocketToken(auth)
  return auth
}

export const getShiprocketToken = async (): Promise<string> => {
  try {
    const auth = await authenticateShiprocket()
    return auth.token
  } catch (error: any) {
    console.error('Shiprocket auth error:', error.response?.data || error.message)
    throw new Error('Failed to authenticate with Shiprocket')
  }
}

export const loginShiprocket = async (credentials?: ShiprocketAuthCredentials) => {
  try {
    return await authenticateShiprocket(credentials)
  } catch (error: any) {
    console.error('Shiprocket auth error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || error.response?.data?.error || 'Failed to authenticate with Shiprocket',
    )
  }
}

export const logoutShiprocket = async (authToken?: string) => {
  const { apiBase } = await resolveShiprocketCredentials()
  const token = authToken?.trim() || cachedToken || (await getShiprocketToken())

  if (!token) {
    throw new Error('No Shiprocket token available to logout')
  }

  try {
    const response = await axios.post(
      `${apiBase}/auth/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    clearShiprocketTokenCache()

    return {
      raw: response.data,
      status: response.status,
      token,
    }
  } catch (error: any) {
    console.error('Shiprocket logout error:', error.response?.data || error.message)
    throw new Error(
      error.response?.data?.message || error.response?.data?.error || 'Failed to logout from Shiprocket',
    )
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

const getShiprocketServiceabilityBase = async (): Promise<string> => {
  return (
    process.env.SHIPROCKET_SERVICEABILITY_API_BASE ||
    'https://serviceability.shiprocket.in/v1/external'
  ).replace(/\/+$/, '')
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

const shiprocketServiceabilityRequest = async (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: any,
) => {
  const token = await getShiprocketToken()
  const apiBase = await getShiprocketServiceabilityBase()
  const url = `${apiBase}${endpoint}`

  const config: any = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
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
    console.error(`[Shiprocket Serviceability API Error] ${method} ${endpoint}:`, errorData)
    throw new Error(errorData?.message || errorData?.error || JSON.stringify(errorData) || 'Shiprocket serviceability API error')
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
 * POST /courier/assign/awb
 * Assign AWB for a shipment
 */
export const assignAwbToShipment = async (params: {
  shipment_id: number | string
  courier_id?: number | string
  status?: 'reassign' | string
}) => {
  return shiprocketRequest('POST', '/courier/assign/awb', params)
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
 * POST /courier/generate/pickup
 * Request shipment pickup
 */
export const requestShipmentPickup = async (params: {
  shipment_id: number | string | Array<number | string>
  status?: 'retry' | string
  pickup_date?: Array<string>
}) => {
  return shiprocketRequest('POST', '/courier/generate/pickup', params)
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
/**
 * POST /orders/create/adhoc
 * Create a quick custom order without product catalogue linkage
 */
export const createCustomOrder = async (params: {
  order_id: string
  order_date: string
  pickup_location: string
  channel_id?: number
  comment?: string
  reseller_name?: string
  company_name?: string
  billing_customer_name: string
  billing_last_name?: string
  billing_address: string
  billing_address_2?: string
  billing_city: string
  billing_pincode: number | string
  billing_state: string
  billing_country: string
  billing_email: string
  billing_phone: number | string
  billing_alternate_phone?: number | string
  shipping_is_billing: boolean
  shipping_customer_name?: string
  shipping_last_name?: string
  shipping_address?: string
  shipping_address_2?: string
  billing_isd_code?: string
  shipping_city?: string
  shipping_pincode?: number | string
  shipping_country?: string
  shipping_state?: string
  shipping_email?: string
  shipping_phone?: number | string
  longitude?: number | string
  latitude?: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    selling_price: number | string
    discount?: number | string
    tax?: number | string
    hsn?: number | string
  }>
  payment_method: 'COD' | 'Prepaid' | string
  shipping_charges?: number | string
  giftwrap_charges?: number | string
  transaction_charges?: number | string
  total_discount?: number | string
  sub_total: number | string
  length: number | string
  breadth: number | string
  height: number | string
  weight: number | string
  ewaybill_no?: string
  customer_gstin?: string
  invoice_number?: string
  order_type?: string
  checkout_shipping_method?: string
  what3words_address?: string
  is_insurance_opt?: boolean
  is_document?: number | boolean
  order_tag?: string
}) => {
  return shiprocketRequest('POST', '/orders/create/adhoc', params)
}

/**
 * POST /orders/update/adhoc
 * Update a quick custom order before AWB assignment
 */
export const updateCustomOrder = async (params: {
  order_id: string
  order_date: string
  pickup_location: string
  channel_id?: number
  comment?: string
  reseller_name?: string
  company_name?: string
  billing_customer_name: string
  billing_last_name?: string
  billing_address: string
  billing_address_2?: string
  billing_city: string
  billing_pincode: number | string
  billing_state: string
  billing_country: string
  billing_email: string
  billing_phone: number | string
  billing_alternate_phone?: number | string
  shipping_is_billing: boolean
  shipping_customer_name?: string
  shipping_last_name?: string
  shipping_address?: string
  shipping_address_2?: string
  billing_isd_code?: string
  shipping_city?: string
  shipping_pincode?: number | string
  shipping_country?: string
  shipping_state?: string
  shipping_email?: string
  shipping_phone?: number | string
  longitude?: number | string
  latitude?: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    selling_price: number | string
    discount?: number | string
    tax?: number | string
    hsn?: number | string
  }>
  payment_method: 'COD' | 'Prepaid' | string
  shipping_charges?: number | string
  giftwrap_charges?: number | string
  transaction_charges?: number | string
  total_discount?: number | string
  sub_total: number | string
  length: number | string
  breadth: number | string
  height: number | string
  weight: number | string
  ewaybill_no?: string
  customer_gstin?: string
  invoice_number?: string
  order_type?: string
  checkout_shipping_method?: string
  what3words_address?: string
  is_insurance_opt?: boolean
  is_document?: number | boolean
  order_tag?: string
}) => {
  return shiprocketRequest('POST', '/orders/update/adhoc', params)
}

/**
 * POST /orders/create
 * Create a channel-specific order with a required channel_id
 */
export const createChannelSpecificOrder = async (params: {
  order_id: string
  order_date: string
  pickup_location?: string
  channel_id: number
  comment?: string
  billing_customer_name: string
  billing_last_name?: string
  billing_address: string
  billing_address_2?: string
  billing_city: string
  billing_pincode: number | string
  billing_state: string
  billing_country: string
  billing_email: string
  billing_phone: number | string
  shipping_is_billing: boolean | number | string
  shipping_customer_name?: string
  shipping_last_name?: string
  shipping_address?: string
  shipping_address_2?: string
  shipping_city?: string
  shipping_pincode?: number | string
  shipping_country?: string
  shipping_state?: string
  shipping_email?: string
  shipping_phone?: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    selling_price: number | string
    discount?: number | string
    tax?: number | string
    hsn?: number | string
  }>
  payment_method: 'COD' | 'Prepaid' | string
  shipping_charges?: number | string
  giftwrap_charges?: number | string
  transaction_charges?: number | string
  total_discount?: number | string
  sub_total: number | string
  length: number | string
  breadth: number | string
  height: number | string
  weight: number | string
  invoice_number?: string
  order_type?: string
  customer_gstin?: string
}) => {
  return shiprocketRequest('POST', '/orders/create', params)
}

/**
 * PATCH /orders/address/pickup
 * Update pickup location for an already created order
 */
export const updateOrderPickupLocation = async (params: {
  order_id: number | string | Array<number | string>
  pickup_location: string
}) => {
  return shiprocketRequest('PATCH', '/orders/address/pickup', params)
}

/**
 * POST /orders/address/update
 * Update customer delivery address for an already created order
 */
export const updateCustomerDeliveryAddress = async (params: {
  order_id: number | string
  shipping_customer_name: string
  shipping_phone: number | string
  shipping_address: string
  shipping_address_2?: string
  shipping_city: string
  shipping_state: string
  shipping_country: string
  shipping_pincode: number | string
  shipping_email?: string
  billing_alternate_phone?: number | string
}) => {
  return shiprocketRequest('POST', '/orders/address/update', params)
}

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

/**
 * GET /orders/processing/return
 * List all return orders
 */
export const listReturnOrders = async (params?: {
  page?: number
  per_page?: number
  from?: string
  to?: string
}) => {
  return shiprocketRequest('GET', '/orders/processing/return', undefined, params)
}

/**
 * PATCH /orders/fulfill
 * Add inventory for ordered products
 */
export const fulfillOrderedProducts = async (params: {
  data: Array<{
    order_id: number | string
    order_product_id: number | string
    quantity: number | string
    action: 'add' | string
  }>
}) => {
  return shiprocketRequest('PATCH', '/orders/fulfill', params)
}

/**
 * PATCH /orders/mapping
 * Map unmapped inventory products
 */
export const mapUnmappedProducts = async (params: {
  data: Array<{
    order_id: number | string
    order_product_id: number | string
    master_sku: string
  }>
}) => {
  return shiprocketRequest('PATCH', '/orders/mapping', params)
}

/**
 * POST /orders/import
 * Import orders in bulk from a CSV file
 */
export const importOrdersBulk = async (file: {
  buffer: Buffer
  originalname?: string
  mimetype?: string
}) => {
  const token = await getShiprocketToken()
  const apiBase = await getApiBase()
  const form = new FormData()
  form.append('file', file.buffer, {
    filename: file.originalname || 'orders.csv',
    contentType: file.mimetype || 'text/csv',
  })

  const response = await axios.post(`${apiBase}/orders/import`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...form.getHeaders(),
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })

  return response.data
}

/**
 * GET /courier/courierListWithCounts
 * List couriers with counts and filter by type
 */
export const listCouriersWithCounts = async (params?: {
  type?: 'active' | 'inactive' | 'all'
}) => {
  return shiprocketRequest('GET', '/courier/courierListWithCounts', undefined, params)
}

/**
 * POST /blocked-pincodes/upload
 * Block or unblock delivery pincodes
 */
export const updateBlockedPincodes = async (params: {
  postcode: {
    delivery_blocked: string[]
  }
  action: 'block' | 'unblock' | string
}) => {
  return shiprocketServiceabilityRequest('POST', '/blocked-pincodes/upload', params)
}
