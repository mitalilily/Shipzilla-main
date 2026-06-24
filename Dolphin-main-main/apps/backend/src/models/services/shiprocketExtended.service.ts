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

export const SHIPROCKET_STATUS_CODE_MAP: Record<number, string> = {
  6: 'Shipped',
  7: 'Delivered',
  8: 'Canceled',
  9: 'RTO Initiated',
  10: 'RTO Delivered',
  12: 'Lost',
  13: 'Pickup Error',
  14: 'RTO Acknowledged',
  15: 'Pickup Rescheduled',
  16: 'Cancellation Requested',
  17: 'Out For Delivery',
  18: 'In Transit',
  19: 'Out For Pickup',
  20: 'Pickup Exception',
  21: 'Undelivered',
  22: 'Delayed',
  23: 'Partial_Delivered',
  24: 'DESTROYED',
  25: 'DAMAGED',
  26: 'FULFILLED',
  27: 'Pickup Booked',
  38: 'REACHED AT DESTINATION HUB',
  39: 'MISROUTED',
  40: 'RTO_NDR',
  41: 'RTO_OFD',
  42: 'PICKED UP',
  43: 'SELF FULFILLED',
  44: 'DISPOSED OFF',
  45: 'CANCELLED_BEFORE_DISPATCHED',
  46: 'RTO IN INTRANSIT',
  47: 'QC FAILED',
  48: 'Reached Warehouse',
  49: 'Custom Cleared',
  50: 'In Flight',
  51: 'Handover to Courier',
  52: 'Shipment Booked',
  54: 'In Transit Overseas',
  55: 'Connection Aligned',
  56: 'Reached Overseas Warehouse',
  57: 'Custom Cleared Overseas',
  59: 'Box Packing',
  60: 'FC Allocated',
  61: 'Picklist Generated',
  62: 'Ready To Pack',
  63: 'Packed',
  67: 'FC MANIFEST GENERATED',
  68: 'PROCESSED AT WAREHOUSE',
  71: 'HANDOVER EXCEPTION',
  72: 'PACKED EXCEPTION',
  75: 'RTO_LOCK',
  76: 'UNTRACEABLE',
  77: 'ISSUE_RELATED_TO_THE_RECIPIENT',
  78: 'REACHED_BACK_AT_SELLER_CITY',
}

const SHIPROCKET_STATUS_LABEL_TO_CODE_MAP: Record<string, number> = Object.fromEntries(
  Object.entries(SHIPROCKET_STATUS_CODE_MAP).map(([code, label]) => [label.toLowerCase(), Number(code)]),
) as Record<string, number>

export const getShiprocketStatusLabel = (statusCode: number | string | null | undefined): string | null => {
  if (statusCode === null || statusCode === undefined || statusCode === '') return null
  const normalized = Number(statusCode)
  if (!Number.isFinite(normalized)) return null
  return SHIPROCKET_STATUS_CODE_MAP[normalized] || null
}

export const getShiprocketStatusCode = (statusLabel: string | null | undefined): number | null => {
  const normalized = statusLabel?.trim().toLowerCase()
  if (!normalized) return null
  return SHIPROCKET_STATUS_LABEL_TO_CODE_MAP[normalized] ?? null
}

type ShiprocketAuthCredentials = {
  email?: string
  password?: string
  apiToken?: string
}

type ShiprocketAuthOptions = {
  skipCache?: boolean
  skipStoredToken?: boolean
}

type ShiprocketRequestOptions = {
  authToken?: string
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
  let apiToken =
    overrides?.apiToken?.trim() ||
    process.env.SHIPROCKET_API_TOKEN ||
    process.env.SHIPROCKET_API_KEY
  let apiBase = process.env.SHIPROCKET_API_BASE || 'https://apiv2.shiprocket.in/v1/external'

  try {
    const config = await getEffectiveCourierConfig<ShiprocketConfig>('shiprocket', 'b2c')
    if (config) {
      email = overrides?.email?.trim() || config.email || email
      password = overrides?.password || config.password || password
      apiToken = overrides?.apiToken?.trim() || config.apiToken || apiToken
      apiBase = config.apiBase || apiBase
    }
  } catch {
    // ignore db errors, use env fallback
  }

  return {
    email,
    password,
    apiToken,
    apiBase: apiBase.replace(/\/+$/, ''),
  }
}

const authenticateShiprocket = async (
  overrides?: ShiprocketAuthCredentials,
  options?: ShiprocketAuthOptions,
): Promise<ShiprocketAuthResponse> => {
  const shouldUseCache =
    !options?.skipCache && !overrides?.email && !overrides?.password && !overrides?.apiToken
  if (shouldUseCache && cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return {
      token: cachedToken,
      expiresAt: tokenExpiry,
      raw: { token: cachedToken },
    }
  }

  const { email, password, apiToken, apiBase } = await resolveShiprocketCredentials(overrides)

  const shouldPreferPasswordLogin =
    Boolean(overrides?.email?.trim() || overrides?.password) && !overrides?.apiToken?.trim()

  if (!options?.skipStoredToken && apiToken && !shouldPreferPasswordLogin) {
    const expiresAt = parseJwtExpiry(apiToken)
    const tokenIsUsable = !expiresAt || Date.now() < expiresAt - 30_000

    if (tokenIsUsable) {
      const auth = {
        token: apiToken,
        expiresAt,
        raw: { token: apiToken },
      }
      cacheShiprocketToken(auth)
      return auth
    }
  }

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

export const getShiprocketToken = async (options?: ShiprocketAuthOptions): Promise<string> => {
  try {
    const auth = await authenticateShiprocket(undefined, options)
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

/**
 * GET /account/details/wallet-balance
 * Fetch the current Shiprocket wallet balance
 */
export const getWalletBalance = async () => {
  return shiprocketRequest('GET', '/account/details/wallet-balance')
}

/**
 * GET /account/details/statement
 * Fetch the Shiprocket account statement details
 */
export const getStatementDetails = async (params?: {
  page?: number
  per_page?: number
  from?: string
  to?: string
}) => {
  return shiprocketRequest('GET', '/account/details/statement', undefined, params)
}

/**
 * GET /billing/discrepancy
 * Fetch billing discrepancy data
 */
export const getDiscrepancyData = async () => {
  return shiprocketRequest('GET', '/billing/discrepancy')
}

const getShiprocketServiceabilityBase = async (): Promise<string> => {
  return (
    process.env.SHIPROCKET_SERVICEABILITY_API_BASE ||
    'https://serviceability.shiprocket.in/v1/external'
  ).replace(/\/+$/, '')
}

const getShiprocketErrorMessage = (errorData: any) =>
  errorData?.message ||
  errorData?.error ||
  (typeof errorData === 'string' ? errorData : JSON.stringify(errorData)) ||
  'Shiprocket API error'

const shouldRetryShiprocketAuth = (error: any) => {
  const status = Number(error?.response?.status)
  return status === 401 || status === 403
}

const performShiprocketRequest = async (
  baseUrl: string,
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: any,
) => {
  const url = `${baseUrl}${endpoint}`

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

  return axios(config)
}

const shiprocketRequest = async (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: any,
  options?: ShiprocketRequestOptions,
) => {
  const apiBase = await getApiBase()
  const token = options?.authToken?.trim() || (await getShiprocketToken())

  try {
    const response = await performShiprocketRequest(apiBase, token, method, endpoint, data, params)
    return response.data
  } catch (error: any) {
    if (!options?.authToken && shouldRetryShiprocketAuth(error)) {
      clearShiprocketTokenCache()

      try {
        const freshAuth = await authenticateShiprocket(undefined, {
          skipCache: true,
          skipStoredToken: true,
        })
        const retryResponse = await performShiprocketRequest(
          apiBase,
          freshAuth.token,
          method,
          endpoint,
          data,
          params,
        )
        return retryResponse.data
      } catch (retryError: any) {
        console.error(
          `[Shiprocket API Retry Error] ${method} ${endpoint}:`,
          retryError.response?.data || retryError.message,
        )
      }
    }

    const errorData = error.response?.data || error.message
    console.error(`[Shiprocket API Error] ${method} ${endpoint}:`, errorData)
    throw new Error(getShiprocketErrorMessage(errorData))
  }
}

const shiprocketServiceabilityRequest = async (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  params?: any,
  options?: ShiprocketRequestOptions,
) => {
  const apiBase = await getShiprocketServiceabilityBase()
  const token = options?.authToken?.trim() || (await getShiprocketToken())

  try {
    const response = await performShiprocketRequest(apiBase, token, method, endpoint, data, params)
    return response.data
  } catch (error: any) {
    if (!options?.authToken && shouldRetryShiprocketAuth(error)) {
      clearShiprocketTokenCache()

      try {
        const freshAuth = await authenticateShiprocket(undefined, {
          skipCache: true,
          skipStoredToken: true,
        })
        const retryResponse = await performShiprocketRequest(
          apiBase,
          freshAuth.token,
          method,
          endpoint,
          data,
          params,
        )
        return retryResponse.data
      } catch (retryError: any) {
        console.error(
          `[Shiprocket Serviceability API Retry Error] ${method} ${endpoint}:`,
          retryError.response?.data || retryError.message,
        )
      }
    }

    const errorData = error.response?.data || error.message
    console.error(`[Shiprocket Serviceability API Error] ${method} ${endpoint}:`, errorData)
    throw new Error(getShiprocketErrorMessage(errorData))
  }
}

// ───────────────────────────── 1. COURIER / SERVICEABILITY ─────────────────────────────

/**
 * GET /courier/serviceability/
 * Check if a pincode is serviceable by a specific courier
 */
export const checkCourierServiceability = async (params: {
  pickup_postcode: number | string
  delivery_postcode: number | string
  order_id?: number | string
  cod?: boolean | number | string
  weight?: number | string
  is_new_hyperlocal?: boolean | number | string
  lat_from?: number | string
  long_from?: number | string
  lat_to?: number | string
  long_to?: number | string
  length?: number | string
  breadth?: number | string
  height?: number | string
  declared_value?: number | string
  mode?: 'Surface' | 'Air' | string
  is_return?: number | string
  couriers_type?: number | string
  only_local?: number | string
  qc_check?: number | string
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

/**
 * GET /open/postcode/details
 * Get locality details for a postcode
 */
export const getPostcodeDetails = async (postcode: number | string) => {
  return shiprocketRequest('GET', '/open/postcode/details', undefined, { postcode })
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
  sort?: 'ASC' | 'DESC' | string
  sort_by?: 'id' | 'status' | string
  from?: string
  to?: string
  updated_from?: string
  updated_to?: string
  search?: string
  filter_by?: 'status' | 'payment_method' | 'delivery_country' | 'channel_order_id' | string
  filter?: string
  pickup_location?: string
  channel_id?: number | string
  fbs?: number | string
  fbs_all_orders?: number | string
}) => {
  return shiprocketRequest('GET', '/orders', undefined, params)
}

/**
 * POST /orders/export
 * Export orders as a CSV download job
 */
export const exportOrders = async () => {
  return shiprocketRequest('POST', '/orders/export', {})
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
  is_return?: number | string
}) => {
  return shiprocketRequest('POST', '/courier/assign/awb', params)
}

/**
 * POST /courier/generate/label
 * Generate shipping label for an AWB
 */
export const generateLabel = async (params: {
  shipment_id: Array<number | string> | number | string
  awb_number?: string
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
  sort?: 'ASC' | 'DESC' | string
  sort_by?: string
  filter?: string
  filter_by?: string
}) => {
  return shiprocketRequest('GET', '/shipments', undefined, params)
}

/** GET /shipments/{shipment_id} */
export const getShipmentDetails = async (shipmentId: number | string) => {
  return shiprocketRequest('GET', `/shipments/${shipmentId}`)
}

/** POST /orders/cancel/shipment/awbs */
export const cancelShipmentsByAwb = async (params: { awbs: string[] }) => {
  return shiprocketRequest('POST', '/orders/cancel/shipment/awbs', params)
}

/** POST /manifests/generate */
export const generateManifest = async (params: {
  shipment_id: Array<number | string>
}) => {
  return shiprocketRequest('POST', '/manifests/generate', params)
}

/** POST /manifests/print */
export const printManifest = async (params: {
  order_ids: Array<number | string>
}) => {
  return shiprocketRequest('POST', '/manifests/print', params)
}

// ───────────────────────────── 4. TRACKING ─────────────────────────────

/**
 * GET /courier/track
 * Track shipment by AWB or order ID
 */
export const trackShipment = async (params: {
  awb?: string
  order_id?: string
  channel_id?: number | string
}) => {
  return shiprocketRequest('GET', '/courier/track', undefined, params)
}

/**
 * GET /courier/track/orders/{order_id}
 * Track shipment by order ID
 */
export const trackShipmentByOrderId = async (orderId: number) => {
  return shiprocketRequest('GET', `/courier/track/orders/${orderId}`)
}

/** GET /courier/track/shipment/{shipment_id} */
export const trackShipmentByShipmentId = async (shipmentId: number | string) => {
  return shiprocketRequest('GET', `/courier/track/shipment/${encodeURIComponent(String(shipmentId))}`)
}

/** GET /courier/track/awb/{awb_code} */
export const trackShipmentByAwb = async (awb: string) => {
  return shiprocketRequest('GET', `/courier/track/awb/${encodeURIComponent(awb)}`)
}

/** POST /courier/track/awbs */
export const trackShipmentsByAwbs = async (params: { awbs: string[] }) => {
  return shiprocketRequest('POST', '/courier/track/awbs', params)
}

// ───────────────────────────── 5. PICKUP LOCATIONS ─────────────────────────────

/**
 * GET /settings/company/pickup
 * Get all pickup locations
 */
export const getPickupLocations = async () => {
  return shiprocketRequest('GET', '/settings/company/pickup')
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
  lat?: number | string
  long?: number | string
  address_type?: string
  vendor_name?: string
  gstin?: string
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

/** GET /ndr/all */
export const listAllNdrShipments = async (params?: {
  page?: number
  per_page?: number
  from?: string
  to?: string
  search?: string
}) => {
  return shiprocketRequest('GET', '/ndr/all', undefined, params)
}

/** GET /ndr/{awb} */
export const getNdrShipmentDetails = async (awb: string) => {
  return shiprocketRequest('GET', `/ndr/${encodeURIComponent(awb)}`)
}

/** POST /ndr/{awb}/action */
export const actionNdrShipment = async (
  awb: string,
  params: {
    action: 'fake-attempt' | 're-attempt' | 'return' | string
    comments: string
    phone?: string
    proof_audio?: string
    proof_image?: string
    remarks?: string
    address1?: string
    address2?: string
    deferred_date?: string
  },
) => {
  return shiprocketRequest('POST', `/ndr/${encodeURIComponent(awb)}/action`, params)
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
  brand_name?: string
  channel?: string
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

/**
 * POST /orders/print/invoice
 * Generate one invoice document for one or more Shiprocket order IDs
 */
export const generateBulkInvoice = async (params: {
  ids: Array<number | string>
}) => {
  return shiprocketRequest('POST', '/orders/print/invoice', params)
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

/**
 * GET /products
 * List all products in the Shiprocket account
 */
export const listProducts = async (params?: {
  page?: number
  per_page?: number
  sort?: 'ASC' | 'DESC' | string
  sort_by?: string
  filter?: string
  filter_by?: string
}) => {
  return shiprocketRequest('GET', '/products', undefined, params)
}

/**
 * GET /inventory
 * Get inventory details for product SKUs
 */
export const listInventory = async (params?: {
  page?: number
  per_page?: number
  sort?: 'ASC' | 'DESC' | string
  sort_by?: string
}) => {
  return shiprocketRequest('GET', '/inventory', undefined, params)
}

/**
 * PUT /inventory/{product_id}/update
 * Update inventory quantity for a product SKU
 */
export const updateInventory = async (
  productId: number | string,
  params: {
    quantity: number | string
    action: 'add' | 'replace' | 'remove' | string
  },
) => {
  return shiprocketRequest('PUT', `/inventory/${productId}/update`, params)
}

/**
 * GET /countries
 * Get country codes and metadata from Shiprocket
 */
export const listCountries = async () => {
  return shiprocketRequest('GET', '/countries')
}

/**
 * GET /countries/show/{country_id}
 * Get zones/details for a specific country
 */
export const listCountryZones = async (countryId: number | string) => {
  return shiprocketRequest('GET', `/countries/show/${countryId}`)
}

/**
 * GET /listings
 * List all product listings in the Shiprocket account
 */
export const listListings = async (params?: {
  page?: number
  per_page?: number
  sort?: 'ASC' | 'DESC' | string
  sort_by?: string
  filter?: string
  filter_by?: string
}) => {
  return shiprocketRequest('GET', '/listings', undefined, params)
}

/**
 * POST /listings/link
 * Map a channel listing to a master product
 */
export const linkListingToProduct = async (params: {
  product_id: number | string
  listing_id: number | string
  ID?: number | string
}) => {
  return shiprocketRequest('POST', '/listings/link', params)
}

/**
 * GET /products/show/{product_id}
 * Get details for a specific Shiprocket product
 */
export const getProductDetails = async (productId: number | string) => {
  return shiprocketRequest('GET', `/products/show/${productId}`)
}

/**
 * POST /products
 * Create a new product in the Shiprocket account
 */
export const createProduct = async (params: {
  sku: string
  HSN?: string
  name: string
  tax_code?: string | number
  type: 'Single' | 'Multiple' | string
  qty: number | string
  low_stock?: string | number
  category_code?: string
  description?: string
  brand?: string
  size?: number | string
  weight?: number | string
  length?: number | string
  width?: number | string
  height?: number | string
  ean?: string
  upc?: string
  isbn?: string
  color?: string
  imei_serialnumber?: string
  cost_price?: number | string
  mrp?: number | string
  status?: boolean | number | string
  image_url?: string
  qc_details?: Record<string, any>
}) => {
  return shiprocketRequest('POST', '/products', params)
}

/**
 * POST /products/qc-product-update/{productID}
 * Convert an existing product into a QC product
 */
export const updateQcProduct = async (
  productId: number | string,
  params: {
    sku: string
    product_image: string
    serial_no?: string
    size?: string
    color?: string
    brand?: string
    brand_box?: string
    product_imei?: string
    check_damaged_product?: number | boolean | string
  },
) => {
  return shiprocketRequest('POST', `/products/qc-product-update/${productId}`, params)
}

// ───────────────────────────── 12. RETURNS / RTO ─────────────────────────────

/**
 * POST /orders/create/return
 * Create a return order
 */
export const createReturnOrder = async (params: {
  order_id: number | string
  order_date: string
  channel_id?: number | string
  pickup_customer_name: string
  pickup_last_name?: string
  company_name?: string
  pickup_address: string
  pickup_address_2?: string
  pickup_city: string
  pickup_state: string
  pickup_country: string
  pickup_pincode: number | string
  pickup_email: string
  pickup_phone: number | string
  pickup_isd_code?: string
  shipping_customer_name: string
  shipping_last_name?: string
  shipping_address: string
  shipping_address_2?: string
  shipping_city: string
  shipping_country: string
  shipping_pincode: number | string
  shipping_state: string
  shipping_email?: string
  shipping_isd_code?: string
  shipping_phone: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    selling_price: number | string
    discount?: number | string
    hsn?: number | string
    qc_enable?: boolean | string
    qc_color?: string
    qc_brand?: string
    qc_serial_no?: string
    qc_ean_barcode?: string
    qc_size?: string
    qc_product_name?: string
    qc_product_image?: string
    qc_product_imei?: string
    qc_brand_tag?: number | boolean | string
    qc_used_check?: number | boolean | string
    qc_sealtag_check?: number | boolean | string
    qc_check_damaged_product?: string
    return_reason?: string
  }>
  payment_method: string
  total_discount?: number | string
  sub_total: number | string
  length: number | string
  breadth: number | string
  height: number | string
  weight: number | string
}) => {
  return shiprocketRequest('POST', '/orders/create/return', params)
}

// ───────────────────────────── 13. RECOMMENDED COURIERS ─────────────────────────────

/**
 * POST /orders/create/exchange
 * Create an exchange order
 */
/**
 * POST /orders/edit
 * Update a return order
 */
/**
 * POST /shipments/create/return-shipment
 * Create a return shipment and optionally request pickup
 */
export const createReturnShipment = async (params: {
  order_id: string
  order_date: string
  channel_id?: number | string
  pickup_customer_name: string
  pickup_last_name?: string
  company_name?: string
  pickup_address: string
  pickup_address_2?: string
  pickup_city: string
  pickup_state: string
  pickup_country: string
  pickup_pincode: number | string
  pickup_email: string
  pickup_phone: number | string
  pickup_isd_code?: string
  shipping_customer_name: string
  shipping_last_name?: string
  shipping_address: string
  shipping_address_2?: string
  shipping_city: string
  shipping_country: string
  shipping_pincode: number | string
  shipping_state: string
  shipping_email: string
  shipping_isd_code?: string
  shipping_phone: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    selling_price: number | string
    discount?: number | string
    hsn?: number | string
    qc_enable?: boolean | string
    qc_color?: string
    qc_brand?: string
    qc_serial_no?: string
    qc_ean_barcode?: string
    qc_size?: string
    qc_product_name?: string
    qc_product_image?: string
    qc_product_imei?: string
    qc_brand_tag?: number | boolean | string
    qc_used_check?: number | boolean | string
    qc_sealtag_check?: number | boolean | string
    qc_check_damaged_product?: string
  }>
  payment_method: string
  total_discount?: number | string
  sub_total: number | string
  length: number | string
  breadth: number | string
  height: number | string
  weight: number | string
  request_pickup?: boolean | string
}) => {
  return shiprocketRequest('POST', '/shipments/create/return-shipment', params)
}

export const updateReturnOrder = async (params: {
  order_id: string
  action: Array<'product_details' | 'warehouse_address' | string>
  length?: number | string
  breadth?: number | string
  height?: number | string
  weight?: number | string
  return_warehouse_id?: number | string
}) => {
  return shiprocketRequest('POST', '/orders/edit', params)
}

export const createExchangeOrder = async (params: {
  exchange_order_id: string
  seller_pickup_location_id: string
  seller_shipping_location_id: string
  return_order_id: string
  order_date: string
  payment_method: string
  buyer_shipping_first_name: string
  buyer_shipping_last_name?: string
  buyer_shipping_email?: string
  buyer_shipping_address: string
  buyer_shipping_address_2?: string
  buyer_shipping_city: string
  buyer_shipping_state: string
  buyer_shipping_country: string
  buyer_shipping_pincode: number | string
  buyer_shipping_phone: number | string
  buyer_pickup_first_name: string
  buyer_pickup_last_name?: string
  buyer_pickup_email?: string
  buyer_pickup_address: string
  buyer_pickup_address_2?: string
  buyer_pickup_city: string
  buyer_pickup_state: string
  buyer_pickup_country: string
  buyer_pickup_pincode: number | string
  buyer_pickup_phone: number | string
  order_items: Array<{
    name: string
    selling_price: number | string
    units: number | string
    hsn: number | string
    sku: string
    tax?: number | string
    discount?: number | string
    exchange_item_id?: number | string
    exchange_item_name?: string
    exchange_item_sku?: string
    qc_enable?: boolean | string
    qc_color?: string
    qc_brand?: string
    qc_serial_no?: string
    qc_ean_barcode?: string
    qc_size?: string
    qc_product_name?: string
    qc_product_image?: string
    qc_product_imei?: string
    qc_brand_tag?: number | boolean | string
    qc_used_check?: number | boolean | string
    qc_sealtag_check?: number | boolean | string
    qc_check_damaged_product?: string
  }>
  sub_total: number | string
  shipping_charges?: number | string
  giftwrap_charges?: number | string
  total_discount?: number | string
  transaction_charges?: number | string
  return_length: number | string
  return_breadth: number | string
  return_height: number | string
  return_weight: number | string
  exchange_length: number | string
  exchange_breadth: number | string
  exchange_height: number | string
  exchange_weight: number | string
  return_reason: string
  channel_id?: number | string
  existing_order_id?: number | string
  qc_check?: boolean | string
}) => {
  return shiprocketRequest('POST', '/orders/create/exchange', params)
}

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
 * POST /shipments/create/forward-shipment
 * Create a forward shipment and optionally request pickup, label, and manifest
 */
export const createForwardShipment = async (params: {
  mode?: 'Surface' | 'Air' | string
  request_pickup?: boolean | string
  print_label?: boolean | string
  generate_manifest?: boolean | string
  courier_id?: number | string
  reseller_name?: string
  order_id: string
  isd_code?: string
  billing_isd_code?: string
  order_date: string
  channel_id?: string | number
  company_name?: string
  billing_customer_name: string
  billing_last_name?: string
  billing_address: string
  billing_address_2?: string
  billing_city: string
  billing_state: string
  billing_country: string
  billing_pincode: number | string
  billing_email: string
  billing_phone: number | string
  billing_alternate_phone?: number | string
  shipping_is_billing: boolean | number | string
  shipping_customer_name?: string
  shipping_last_name?: string
  shipping_address?: string
  shipping_address_2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_country?: string
  shipping_pincode?: number | string
  shipping_email?: string
  shipping_phone?: number | string
  order_items: Array<{
    name: string
    sku: string
    units: number | string
    hsn?: number | string
    selling_price: number | string
    tax?: number | string
    discount?: number | string
  }>
  payment_method: string
  shipping_charges?: number | string
  giftwrap_charges?: number | string
  transaction_charges?: number | string
  total_discount?: number | string
  sub_total: number | string
  weight: number | string
  length: number | string
  breadth: number | string
  height: number | string
  pickup_location: string
  customer_gstin?: string
  vendor_details?: {
    email?: string
    phone?: number | string
    name?: string
    address?: string
    address_2?: string
    city?: string
    state?: string
    country?: string
    pin_code?: number | string
    pickup_location?: string
  }
  order_type?: string
  longitude?: number | string
  latitude?: number | string
  what3words_address?: string
  is_document?: number | boolean
  ewaybill_no?: string
}) => {
  return shiprocketRequest('POST', '/shipments/create/forward-shipment', params)
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
 * POST /products/import
 * Import products in bulk from a CSV file
 */
export const importProductsBulk = async (file: {
  buffer: Buffer
  originalname?: string
  mimetype?: string
}) => {
  const token = await getShiprocketToken()
  const apiBase = await getApiBase()
  const form = new FormData()
  form.append('file', file.buffer, {
    filename: file.originalname || 'products.csv',
    contentType: file.mimetype || 'text/csv',
  })

  const response = await axios.post(`${apiBase}/products/import`, form, {
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
 * GET /products/sample
 * Get a sample CSV format for bulk product import
 */
export const getProductsSampleCsv = async () => {
  return shiprocketRequest('GET', '/products/sample')
}

/**
 * POST /listings/import
 * Import catalog mappings from a CSV file
 */
export const importListingMappingsBulk = async (file: {
  buffer: Buffer
  originalname?: string
  mimetype?: string
}) => {
  const token = await getShiprocketToken()
  const apiBase = await getApiBase()
  const form = new FormData()
  form.append('file', file.buffer, {
    filename: file.originalname || 'listings.csv',
    contentType: file.mimetype || 'text/csv',
  })

  const response = await axios.post(`${apiBase}/listings/import`, form, {
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
 * GET /listings/export/mapped
 * Export mapped channel listings as a CSV download URL
 */
export const exportMappedListings = async () => {
  return shiprocketRequest('GET', '/listings/export/mapped')
}

/**
 * GET /listings/export/unmapped
 * Export unmapped channel listings as a CSV download URL
 */
export const exportUnmappedListings = async () => {
  return shiprocketRequest('GET', '/listings/export/unmapped')
}

/**
 * GET /listings/sample
 * Get a sample catalogue sheet for reference
 */
export const exportListingsSample = async () => {
  return shiprocketRequest('GET', '/listings/sample')
}

/**
 * GET /errors/{import_id}/check
 * Check import results for file imports
 */
export const checkImportErrors = async (importId: number | string) => {
  return shiprocketRequest('GET', `/errors/${importId}/check`)
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
}, options?: ShiprocketRequestOptions) => {
  return shiprocketServiceabilityRequest('POST', '/blocked-pincodes/upload', params, undefined, options)
}

/**
 * GET /block-pincodes/get
 * Read blocked pincodes with download/search/paginated modes
 */
export const getBlockedPincodes = async (params?: {
  is_download?: number | string
  search?: string
  per_page?: number | string
  current_page?: number | string
}, options?: ShiprocketRequestOptions) => {
  return shiprocketServiceabilityRequest('GET', '/block-pincodes/get', undefined, params, options)
}
