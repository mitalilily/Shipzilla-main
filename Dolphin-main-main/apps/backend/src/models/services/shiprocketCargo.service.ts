import axios, { AxiosRequestConfig, Method } from 'axios'

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

const DEFAULT_SHIPROCKET_CARGO_BASE_URL = 'https://api-cargo.shiprocket.in'

let cachedCargoAccessToken: string | null = null
let cargoTokenExpiry: number | null = null

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

const resolveShiprocketCargoCredentials = (overrides?: ShiprocketCargoAuthOverrides) => {
  const accessToken =
    overrides?.accessToken?.trim() || process.env.SHIPROCKET_CARGO_API_TOKEN?.trim() || ''
  const refreshToken =
    overrides?.refreshToken?.trim() || process.env.SHIPROCKET_CARGO_REFRESH_TOKEN?.trim() || ''
  const apiBase = (
    overrides?.apiBase?.trim() ||
    process.env.SHIPROCKET_CARGO_API_BASE?.trim() ||
    DEFAULT_SHIPROCKET_CARGO_BASE_URL
  ).replace(/\/+$/, '')

  return {
    accessToken,
    refreshToken,
    apiBase,
  }
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
  const { accessToken, refreshToken, apiBase } = resolveShiprocketCargoCredentials(overrides)

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
  const { apiBase } = resolveShiprocketCargoCredentials()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const query = options?.query
  const token = options?.skipRefresh
    ? resolveShiprocketCargoCredentials({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
      }).accessToken
    : await getShiprocketCargoAccessToken({
        accessToken: options?.accessToken,
        refreshToken: options?.refreshToken,
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
