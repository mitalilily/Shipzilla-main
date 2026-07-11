import axios, { AxiosRequestConfig, Method } from 'axios'
import {
  DEFAULT_SHIPROCKET_BASE_URL,
  DEFAULT_SHIPROCKET_CARGO_BASE_URL,
  getEffectiveCourierConfig,
  ShiprocketConfig,
} from './courierCredentials.service'

type ShiprocketCargoAuthOverrides = {
  accessToken?: string
  refreshToken?: string
  apiBase?: string
}

type ShiprocketCargoAuthResponse = {
  accessToken: string
  expiresAt: number | null
  raw: any
}

type ShiprocketCargoRequestOptions = {
  accessToken?: string
  refreshToken?: string
  apiBase?: string
  skipRefresh?: boolean
  query?: Record<string, unknown>
}

export type ShiprocketCargoPackagingUnit = {
  units: number
  weight: number
  length: number
  height: number
  width: number
}

export type ShiprocketCargoOrderCreationPayload = {
  no_of_packages: number
  invoice_value: number
  approx_weight: number | string
  is_insured?: boolean
  is_to_pay?: boolean
  to_pay_amount?: number | null
  source_warehouse_name: string
  source_address_line1: string
  source_address_line2?: string
  source_pincode: string
  source_city: string
  source_state: string
  sender_contact_person_name: string
  sender_contact_person_email: string
  sender_contact_person_contact_no: string
  destination_warehouse_name: string
  destination_address_line1: string
  destination_address_line2?: string
  destination_pincode: string
  destination_city: string
  destination_state: string
  recipient_contact_person_name: string
  recipient_contact_person_email: string
  recipient_contact_person_contact_no: string
  client_id: number
  packaging_unit_details: ShiprocketCargoPackagingUnit[]
  is_cod?: boolean
  cod_amount?: number | null
  mode_name: 'surface' | 'air' | string
  channel_partner?: string | null
  tenant_id?: string | number | null
  po_no?: string | null
  po_expiry_date?: string | null
  is_appointment_taken: boolean
  source?: string
  supporting_docs?: string[]
}

export type ShiprocketCargoOrderCreationResponse = {
  success?: boolean
  order_id?: number
  from_warehouse_id?: number
  to_warehouse_id?: number
  mode?: string
  mode_id?: number
  delivery_partner_name?: string
  delivery_partner_id?: number
  transportar_id?: string
  [key: string]: unknown
}

export type ShiprocketCargoShipmentCreationPayload = {
  client_id: number
  order_id: number
  remarks: string
  recipient_GST?: string | null
  to_pay_amount?: string | number | null
  mode_id: number
  delivery_partner_id: number
  pickup_date_time: string
  eway_bill_no?: string | null
  invoice_value?: number
  invoice_number: string
  invoice_date: string
  supporting_docs: string[]
  source?: string
}

export type ShiprocketCargoShipmentCreationResponse = {
  id?: number
  client_id?: number
  from_warehouse_id?: number
  to_warehouse_id?: number
  pickup_date_time?: string
  approx_weight?: string
  packaging_unit_details?: unknown[]
  mode?: unknown
  invoice_value?: string
  recipient_contact_person_name?: string
  recipient_contact_person_email?: string
  recipient_contact_person_contact_no?: string
  no_of_units?: number
  eway_bill_no?: string | null
  remarks?: string
  is_insured?: boolean
  recipient_GST?: string | null
  invoice_number?: string
  shipment_p?: unknown
  [key: string]: unknown
}

export type ShiprocketCargoShipmentDetailsResponse = {
  id?: number
  waybill_no?: string | null
  child_waybill_nos?: string[]
  status?: string | null
  status_dp?: string | null
  pickup_date_time?: string | null
  original_edd?: string | null
  edd?: string | null
  label_url?: string | null
  pod_url?: string | null
  api_error?: string | null
  order_id?: number
  source?: string | null
  lrn?: string | null
  supporting_docs?: string[]
  invoice_date?: string | null
  shipment_type?: string | null
  tracking_status?: boolean | null
  client_order_id?: string | null
  [key: string]: unknown
}

export type ShiprocketCargoOrderDetailsResponse = {
  id?: number
  pickup_date_time?: string | null
  no_of_units?: number
  source?: string | null
  approx_weight?: string | null
  invoice_value?: string | null
  volumetric_weight?: string | null
  invoice_number?: string | null
  from_warehouse?: unknown
  to_warehouse?: unknown
  packaging_unit_details?: unknown[]
  mode?: unknown
  delivery_partner?: unknown
  client?: unknown
  [key: string]: unknown
}

export type ShiprocketCargoChargeCalculatorPackagingUnit = {
  units: number
  length: number
  height: number
  weight: number
  width: number
  unit?: string
}

export type ShiprocketCargoChargeCalculatorPayload = {
  from_pincode: string
  from_city: string
  from_state: string
  to_pincode: string
  to_city: string
  to_state: string
  quantity: number
  invoice_value: number
  calculator_page: string
  packaging_unit_details: ShiprocketCargoChargeCalculatorPackagingUnit[]
}

export type ShiprocketCargoChargeCalculatorRate = {
  logo?: string | null
  id?: number
  common_name?: string | null
  is_public?: boolean
  is_shipment_ready?: boolean
  is_pickup_ready?: boolean
  mode_name?: string | null
  mode_id?: number
  delivery_partner?: string | null
  is_rocketbox_account?: boolean
  rates?: number
  working?: Record<string, unknown>
  transporter_id?: string | null
  [key: string]: unknown
}

export type ShiprocketCargoChargeCalculatorResponse = Record<
  string,
  ShiprocketCargoChargeCalculatorRate
>

export type ShiprocketCargoTrackingHistoryEntry = {
  reason?: string | null
  status?: string | null
  status_dp?: string | null
  location?: string | null
  created_at?: string | null
  [key: string]: unknown
}

export type ShiprocketCargoTrackShipmentResponse = {
  id?: number
  waybill_no?: string | null
  status?: string | null
  status_dp?: string | null
  edd_date?: string | null
  add_date?: string | null
  created_at_date?: string | null
  status_history?: ShiprocketCargoTrackingHistoryEntry[]
  [key: string]: unknown
}

export type ShiprocketCargoBulkTrackShipmentResponse =
  | ShiprocketCargoTrackShipmentResponse
  | ShiprocketCargoTrackShipmentResponse[]
  | Record<string, unknown>

export type ShiprocketCargoWarehouseAddressPayload = {
  address_line_1: string
  address_line_2?: string
  pincode: string
  city: string
  state: string
  country: string
}

export type ShiprocketCargoCreateWarehousePayload = {
  name: string
  client_id: number
  address: ShiprocketCargoWarehouseAddressPayload
  warehouse_code: string
  contact_person_name: string
  contact_person_email: string
  contact_person_contact_no: string
}

export type ShiprocketCargoCreateWarehouseResponse = {
  id?: number
  name?: string
  client?: {
    id?: number
    client_name?: string
    [key: string]: unknown
  }
  address?: {
    id?: number
    address_line_1?: string
    address_line_2?: string
    pincode?: string
    city?: string
    state?: string
    country?: string
    landmark?: string | null
    [key: string]: unknown
  }
  for_one_time_use?: boolean
  contact_person_name?: string
  contact_person_email?: string
  contact_person_contact_no?: string
  warehouse_code?: string
  [key: string]: unknown
}

export type ShiprocketCargoUpdateWarehousePayload = {
  name: string
  client_id: number
  address: ShiprocketCargoWarehouseAddressPayload
  warehouse_code?: string | null
  contact_person_name: string
  contact_person_email?: string
  contact_person_contact_no: string
}

export type ShiprocketCargoWarehouseListItem = {
  id?: number
  name?: string
  client?: {
    id?: number
    client_name?: string
    [key: string]: unknown
  }
  address?: {
    id?: number
    address_line_1?: string
    address_line_2?: string
    pincode?: string
    city?: string
    state?: string
    country?: string
    landmark?: string | null
    [key: string]: unknown
  }
  warehouse_code?: string
  contact_person_name?: string
  contact_person_email?: string
  contact_person_contact_no?: string
  [key: string]: unknown
}

export type ShiprocketCargoWarehouseListResponse = {
  next?: string | null
  previous?: string | null
  current_page?: number
  count?: number
  results?: ShiprocketCargoWarehouseListItem[]
  [key: string]: unknown
}

export type ShiprocketCargoAddAppointmentPayload = {
  is_appointment_taken: boolean
  new_appointment_date?: string | null
  appointment_date?: string | null
  supporting_docs?: string[]
  po_no?: string | null
  po_expiry_date?: string | null
  appointment_end_date?: string | null
  new_appointment_end_date?: string | null
}

export type ShiprocketCargoAddAppointmentResponse = Record<string, unknown> | null

let cachedCargoAccessToken: string | null = null
let cargoTokenExpiry: number | null = null

const normalizeShiprocketCargoBaseUrl = (value?: string | null) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '')
  if (!normalized) return ''

  if (normalized === DEFAULT_SHIPROCKET_BASE_URL || /\/v1\/external$/i.test(normalized)) {
    return DEFAULT_SHIPROCKET_CARGO_BASE_URL
  }

  return normalized
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

const resolveShiprocketCargoCredentials = async (overrides?: ShiprocketCargoAuthOverrides) => {
  let savedConfig: ShiprocketConfig | null = null
  try {
    savedConfig = await getEffectiveCourierConfig<ShiprocketConfig>('shiprocket', 'b2b')
  } catch (error: any) {
    console.warn(
      '[Shiprocket Cargo] Saved credentials unavailable, using env fallback:',
      error?.message || error,
    )
  }

  const accessToken =
    overrides?.accessToken?.trim() ||
    savedConfig?.accessToken?.trim() ||
    savedConfig?.apiToken?.trim() ||
    process.env.SHIPROCKET_CARGO_API_TOKEN?.trim() ||
    ''
  const refreshToken =
    overrides?.refreshToken?.trim() ||
    savedConfig?.refreshToken?.trim() ||
    process.env.SHIPROCKET_CARGO_REFRESH_TOKEN?.trim() ||
    ''
  const apiBase =
    normalizeShiprocketCargoBaseUrl(overrides?.apiBase) ||
    normalizeShiprocketCargoBaseUrl(savedConfig?.apiBase) ||
    normalizeShiprocketCargoBaseUrl(process.env.SHIPROCKET_CARGO_API_BASE) ||
    DEFAULT_SHIPROCKET_CARGO_BASE_URL
  const clientId =
    savedConfig?.clientId?.trim() || process.env.SHIPROCKET_CARGO_CLIENT_ID?.trim() || ''

  return {
    accessToken,
    refreshToken,
    apiBase,
    clientId,
  }
}

export const getShiprocketCargoClientId = async (): Promise<number> => {
  const { clientId } = await resolveShiprocketCargoCredentials()
  const parsedClientId = Number(clientId)

  try {
    const warehouseResponse = await getShiprocketCargoWarehouses(1, {
      query: { page_size: 1 },
    })
    const discoveredClientId = Number(warehouseResponse?.results?.[0]?.client?.id)
    if (Number.isInteger(discoveredClientId) && discoveredClientId > 0) {
      if (parsedClientId > 0 && parsedClientId !== discoveredClientId) {
        console.warn(
          `[Shiprocket Cargo] Overriding configured client ID ${parsedClientId} with live warehouse client ID ${discoveredClientId}.`,
        )
      }
      return discoveredClientId
    }
  } catch (error: any) {
    console.warn(
      '[Shiprocket Cargo] Unable to auto-discover client ID from warehouses, using configured value:',
      error?.message || error,
    )
  }

  if (!Number.isInteger(parsedClientId) || parsedClientId <= 0) {
    throw new Error(
      'Shiprocket Cargo Client ID is not configured. Save the numeric Client ID in Courier Credentials.',
    )
  }

  return parsedClientId
}

const cacheShiprocketCargoToken = (accessToken: string) => {
  cachedCargoAccessToken = accessToken
  cargoTokenExpiry = parseJwtExpiry(accessToken)
}

export const clearShiprocketCargoTokenCache = () => {
  cachedCargoAccessToken = null
  cargoTokenExpiry = null
}

export const refreshShiprocketCargoAccessToken = async (
  overrides?: ShiprocketCargoAuthOverrides,
): Promise<ShiprocketCargoAuthResponse> => {
  const { accessToken, refreshToken, apiBase } = await resolveShiprocketCargoCredentials(overrides)

  if (!accessToken) {
    throw new Error(
      'Shiprocket Cargo access token not configured. Set SHIPROCKET_CARGO_API_TOKEN or pass accessToken.',
    )
  }

  if (!refreshToken) {
    throw new Error(
      'Shiprocket Cargo refresh token not configured. Set SHIPROCKET_CARGO_REFRESH_TOKEN or pass refreshToken.',
    )
  }

  const response = await axios.post(
    `${apiBase}/api/token/refresh/`,
    { refresh: refreshToken },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  const nextAccessToken = String(response.data?.access || '').trim()
  if (!nextAccessToken) {
    throw new Error('Shiprocket Cargo refresh response did not include an access token.')
  }

  cacheShiprocketCargoToken(nextAccessToken)

  return {
    accessToken: nextAccessToken,
    expiresAt: parseJwtExpiry(nextAccessToken),
    raw: response.data,
  }
}

export const getShiprocketCargoAccessToken = async (
  overrides?: ShiprocketCargoAuthOverrides,
): Promise<string> => {
  if (
    !overrides?.accessToken &&
    !overrides?.refreshToken &&
    cachedCargoAccessToken &&
    cargoTokenExpiry &&
    Date.now() < cargoTokenExpiry - 30_000
  ) {
    return cachedCargoAccessToken
  }

  const auth = await refreshShiprocketCargoAccessToken(overrides)
  return auth.accessToken
}

export const shiprocketCargoRequest = async <T = any>(
  method: Method,
  path: string,
  body?: unknown,
  options?: ShiprocketCargoRequestOptions,
): Promise<T> => {
  const resolvedCredentials = await resolveShiprocketCargoCredentials({
    accessToken: options?.accessToken,
    refreshToken: options?.refreshToken,
    apiBase: options?.apiBase,
  })
  const { apiBase } = resolvedCredentials
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const query = options?.query
  const token = options?.skipRefresh
    ? resolvedCredentials.accessToken
    : await getShiprocketCargoAccessToken({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
        apiBase: options?.apiBase,
      })

  if (!token) {
    throw new Error('Shiprocket Cargo access token is required to make API requests.')
  }

  const config: AxiosRequestConfig = {
    method,
    url: `${apiBase}${normalizedPath}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params: query,
    data: body,
  }

  try {
    const response = await axios.request<T>(config)
    return response.data
  } catch (error: any) {
    if (error?.response?.status === 401 && !options?.skipRefresh) {
      const refreshedAccessToken = await getShiprocketCargoAccessToken({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
      })
      const retryResponse = await axios.request<T>({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${refreshedAccessToken}`,
        },
      })
      return retryResponse.data
    }

    throw error
  }
}

export const createShiprocketCargoOrder = async (
  payload: ShiprocketCargoOrderCreationPayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoOrderCreationResponse>(
    'POST',
    '/api/external/order_creation/',
    payload,
    options,
  )

export const createShiprocketCargoShipment = async (
  payload: ShiprocketCargoShipmentCreationPayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoShipmentCreationResponse>(
    'POST',
    '/api/order_shipment_association/',
    payload,
    options,
  )

export const getShiprocketCargoShipmentDetails = async (
  shipmentId: string | number,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoShipmentDetailsResponse>(
    'GET',
    `/api/external/get_shipment/${encodeURIComponent(String(shipmentId))}/`,
    undefined,
    options,
  )

export const getShiprocketCargoOrderDetails = async (
  orderId: string | number,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoOrderDetailsResponse>(
    'GET',
    `/api/external/get_order/${encodeURIComponent(String(orderId))}/`,
    undefined,
    options,
  )

export const getShiprocketCargoShipmentCharges = async (
  payload: ShiprocketCargoChargeCalculatorPayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoChargeCalculatorResponse>(
    'POST',
    '/api/shipment/charges/',
    payload,
    options,
  )

export const trackShiprocketCargoShipment = async (
  waybillNumber: string | number,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoTrackShipmentResponse>(
    'GET',
    `/api/shipment/track/${encodeURIComponent(String(waybillNumber))}/`,
    undefined,
    options,
  )

export const bulkTrackShiprocketCargoShipments = async (
  waybillNumbers: Array<string | number> | string,
  options?: ShiprocketCargoRequestOptions,
) => {
  const normalized = Array.isArray(waybillNumbers)
    ? waybillNumbers.map((value) => String(value).trim()).filter(Boolean).join(',')
    : String(waybillNumbers).trim()

  return shiprocketCargoRequest<ShiprocketCargoBulkTrackShipmentResponse>(
    'GET',
    `/api/shipment/track/${encodeURIComponent(normalized)}/`,
    undefined,
    options,
  )
}

export const createShiprocketCargoWarehouse = async (
  payload: ShiprocketCargoCreateWarehousePayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoCreateWarehouseResponse>(
    'POST',
    '/api/warehouses/',
    payload,
    options,
  )

export const getShiprocketCargoWarehouses = async (
  page = 1,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoWarehouseListResponse>(
    'GET',
    '/api/warehouses/',
    undefined,
    {
      ...options,
      query: {
        ...(options?.query || {}),
        page,
      },
    },
  )

export const updateShiprocketCargoWarehouse = async (
  warehouseId: string | number,
  payload: ShiprocketCargoUpdateWarehousePayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoCreateWarehouseResponse>(
    'PUT',
    `/api/warehouses/${encodeURIComponent(String(warehouseId))}/`,
    payload,
    options,
  )

export const addShiprocketCargoAppointment = async (
  shipmentId: string | number,
  payload: ShiprocketCargoAddAppointmentPayload,
  options?: ShiprocketCargoRequestOptions,
) =>
  shiprocketCargoRequest<ShiprocketCargoAddAppointmentResponse>(
    'PUT',
    `/api/external/add_appointment/${encodeURIComponent(String(shipmentId))}/`,
    payload,
    options,
  )
