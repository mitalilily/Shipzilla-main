import axios, { AxiosInstance } from 'axios'
import { HttpError } from '../../../utils/classes'
import {
  DEFAULT_ICARRY_BASE_URL,
  IcarryConfig,
  getEffectiveCourierConfig,
} from '../courierCredentials.service'

type AnyRecord = Record<string, any>

type IcarryResponse = AnyRecord & {
  success?: any
  error?: any
  api_token?: string
  shipment_id?: string | number
  pickup_id?: string | number
  warehouse_id?: string | number
  awb?: string | number
}

export type IcarryCreatePickupAddressPayload = {
  nickname?: string
  name?: string
  email?: string
  phone?: string
  alt_phone?: string
  street1?: string
  street2?: string
  locality?: string
  city?: string
  pincode?: string | number
  zone_id?: string | number
  country_id?: string | number
  state?: string
}

export type IcarryBillingSyncRecord = {
  shipment_id?: string | number
  awb?: string | number
  date?: string
  miles?: string | number
  mode?: string
  zone?: string
  weight?: string | number
  [key: string]: any
}

export type IcarryShipmentStatusSyncRecord = {
  shipment_id?: string | number
  status?: string | number
  date_delivered?: string
  date_picked?: string
  'date_picked '?: string
  [key: string]: any
}

type IcarryBillingSyncResponse = IcarryResponse & {
  msg?: IcarryBillingSyncRecord[] | string
  data?: IcarryBillingSyncRecord[] | string
}

type IcarryShipmentStatusSyncResponse = IcarryResponse & {
  msg?: IcarryShipmentStatusSyncRecord[] | string
  data?: IcarryShipmentStatusSyncRecord[] | string
}

type CachedToken = {
  value: string
  expiresAt: number
}

const STATE_CODE_TO_ZONE_ID: Record<string, number> = {
  AN: 1475,
  AP: 1476,
  AR: 1477,
  AS: 1478,
  BI: 1479,
  CH: 1480,
  DA: 1481,
  DM: 1482,
  DE: 1483,
  GO: 1484,
  GU: 1485,
  HA: 1486,
  HP: 1487,
  JA: 1488,
  KA: 1489,
  KE: 1490,
  LI: 1491,
  MP: 1492,
  MA: 1493,
  MN: 1494,
  ME: 1495,
  MI: 1496,
  NA: 1497,
  OD: 1498,
  PO: 1499,
  PU: 1500,
  RA: 1501,
  SI: 1502,
  TN: 1503,
  TR: 1504,
  UP: 1505,
  WB: 1506,
  TS: 4231,
  JH: 4239,
  UK: 4240,
  CG: 4241,
  LA: 4242,
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  'andaman and nicobar islands': 'AN',
  'andhra pradesh': 'AP',
  'arunachal pradesh': 'AR',
  assam: 'AS',
  bihar: 'BI',
  chandigarh: 'CH',
  'dadra and nagar haveli': 'DA',
  'daman and diu': 'DM',
  delhi: 'DE',
  goa: 'GO',
  gujarat: 'GU',
  haryana: 'HA',
  'himachal pradesh': 'HP',
  'jammu and kashmir': 'JA',
  karnataka: 'KA',
  kerala: 'KE',
  'lakshadweep islands': 'LI',
  'madhya pradesh': 'MP',
  maharashtra: 'MA',
  manipur: 'MN',
  meghalaya: 'ME',
  mizoram: 'MI',
  nagaland: 'NA',
  odisha: 'OD',
  puducherry: 'PO',
  punjab: 'PU',
  rajasthan: 'RA',
  sikkim: 'SI',
  'tamil nadu': 'TN',
  tripura: 'TR',
  'uttar pradesh': 'UP',
  'west bengal': 'WB',
  telangana: 'TS',
  jharkhand: 'JH',
  uttarakhand: 'UK',
  chattisgarh: 'CG',
  chhattisgarh: 'CG',
  ladakh: 'LA',
}

const ZONE_ID_TO_STATE_NAME: Record<number, string> = {
  1475: 'Andaman and Nicobar Islands',
  1476: 'Andhra Pradesh',
  1477: 'Arunachal Pradesh',
  1478: 'Assam',
  1479: 'Bihar',
  1480: 'Chandigarh',
  1481: 'Dadra and Nagar Haveli',
  1482: 'Daman and Diu',
  1483: 'Delhi',
  1484: 'Goa',
  1485: 'Gujarat',
  1486: 'Haryana',
  1487: 'Himachal Pradesh',
  1488: 'Jammu and Kashmir',
  1489: 'Karnataka',
  1490: 'Kerala',
  1491: 'Lakshadweep Islands',
  1492: 'Madhya Pradesh',
  1493: 'Maharashtra',
  1494: 'Manipur',
  1495: 'Meghalaya',
  1496: 'Mizoram',
  1497: 'Nagaland',
  1498: 'Odisha',
  1499: 'Puducherry',
  1500: 'Punjab',
  1501: 'Rajasthan',
  1502: 'Sikkim',
  1503: 'Tamil Nadu',
  1504: 'Tripura',
  1505: 'Uttar Pradesh',
  1506: 'West Bengal',
  4231: 'Telangana',
  4239: 'Jharkhand',
  4240: 'Uttarakhand',
  4241: 'Chattisgarh',
  4242: 'Ladakh',
}

const trim = (value: unknown) => String(value ?? '').trim()

const digits = (value: unknown) => trim(value).replace(/\D/g, '')

const phone10 = (value: unknown) => {
  const raw = digits(value)
  return raw.length > 10 ? raw.slice(-10) : raw
}

const isNonEmpty = (value: unknown) => trim(value).length > 0

const normalizeBaseUrl = (value: string) => {
  const raw = trim(value).replace(/\/+$/, '')
  if (!raw) return ''
  return raw.replace(/\/api-frontend$/i, '')
}

const normalizeStateCode = (value: unknown, fallback = '') => {
  const raw = trim(value)
  if (!raw) return fallback

  if (/^[A-Z]{2}$/.test(raw.toUpperCase())) {
    return raw.toUpperCase()
  }

  const lookup = STATE_NAME_TO_CODE[raw.toLowerCase()]
  if (lookup) return lookup

  const compact = raw.replace(/\s+/g, '').toUpperCase()
  if (/^[A-Z]{2}$/.test(compact)) return compact
  return fallback
}

const normalizeShipmentMode = (value: unknown, fallback: 'S' | 'E' | 'H' = 'S'): 'S' | 'E' | 'H' => {
  const raw = trim(value).toLowerCase()
  if (!raw) return fallback
  if (['e', 'air', 'express', 'exp', 'fast', 'flight'].includes(raw)) return 'E'
  if (['h', 'hyperlocal', 'hyper local', 'same day', 'sameday'].includes(raw)) return 'H'
  if (['s', 'surface', 'ground', 'road'].includes(raw)) return 'S'
  return fallback
}

const normalizeShipmentType = (value: unknown, fallback: 'P' | 'C' = 'P'): 'P' | 'C' => {
  const raw = trim(value).toLowerCase()
  if (!raw) return fallback
  if (['c', 'cod', 'collect', 'cash on delivery'].includes(raw)) return 'C'
  if (['p', 'prepaid', 'pre paid', 'ppd'].includes(raw)) return 'P'
  return fallback
}

const zoneIdForState = (value: unknown) => {
  const code = normalizeStateCode(value)
  if (!code) return null
  return STATE_CODE_TO_ZONE_ID[code] ?? null
}

export const getIcarryStateNameForZoneId = (value: unknown) => {
  const zoneId = Number(value)
  if (!Number.isFinite(zoneId)) return null
  return ZONE_ID_TO_STATE_NAME[zoneId] ?? null
}

const sanitizeNickname = (...parts: unknown[]) => {
  const normalizedCandidates = parts
    .map((part) => trim(part))
    .filter(Boolean)
    .map((part) => String(part).replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)

  const firstValidCandidate = normalizedCandidates.find((candidate) => candidate.length >= 3)
  if (firstValidCandidate) {
    return firstValidCandidate.slice(0, 25)
  }

  const combinedFallback = normalizedCandidates.join('')
  if (combinedFallback.length >= 3) {
    return combinedFallback.slice(0, 25)
  }

  return 'ShipzillaPickup'
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeWeightUnit = (value: unknown): 'gm' | 'kg' | '' => {
  const raw = trim(value).toLowerCase()
  if (raw === 'gm' || raw === 'g' || raw === 'grams' || raw === 'gram') return 'gm'
  if (raw === 'kg' || raw === 'kgs' || raw === 'kilogram' || raw === 'kilograms') return 'kg'
  return ''
}

const normalizeIcarryWeight = (value: unknown, explicitUnit?: unknown) => {
  const numericValue = toNumber(value, 0)
  if (numericValue <= 0) {
    return {
      weight: 0,
      weight_unit: 'gm' as const,
    }
  }

  const unit = normalizeWeightUnit(explicitUnit) || (numericValue > 50 ? 'gm' : 'kg')
  return {
    weight: unit === 'gm' ? Math.round(numericValue) : Number(numericValue.toFixed(3)),
    weight_unit: unit as 'gm' | 'kg',
  }
}

const compactObject = (value: unknown): AnyRecord | null => {
  if (!value || typeof value !== 'object') return null
  const entries = Object.entries(value as AnyRecord).filter(([, v]) => {
    if (v === undefined || v === null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    return true
  })
  return entries.length ? (value as AnyRecord) : null
}

const tryParseJson = (value: unknown) => {
  if (typeof value !== 'string') return value
  const raw = value.trim()
  if (!raw) return value
  try {
    return JSON.parse(raw)
  } catch {
    return value
  }
}

const appendFormValue = (form: URLSearchParams, key: string, value: any) => {
  if (value === undefined || value === null) return
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormValue(form, `${key}[${index}]`, item)
    })
    return
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendFormValue(form, key ? `${key}[${childKey}]` : childKey, childValue)
    }
    return
  }
  form.append(key, String(value))
}

const toFormBody = (payload: AnyRecord) => {
  const form = new URLSearchParams()
  for (const [key, value] of Object.entries(payload)) {
    appendFormValue(form, key, value)
  }
  return form
}

const mapItems = (items: any[] | undefined) => {
  if (!Array.isArray(items)) return undefined
  const mapped = items
    .map((item, index) => ({
      name: trim(item?.name || item?.title || item?.sku || `item-${index + 1}`).slice(0, 50),
      pid: trim(item?.pid || item?.sku || item?.id || `item-${index + 1}`).slice(0, 100),
      price: toNumber(item?.price ?? item?.amount ?? 0, 0),
      quantity: Math.max(1, Math.floor(toNumber(item?.quantity ?? item?.qty ?? 1, 1))),
    }))
    .filter((item) => item.name && item.pid)
  return mapped.length ? mapped : undefined
}

const mapBoxes = (boxes: any[] | undefined) => {
  if (!Array.isArray(boxes)) return undefined
  const mapped = boxes
    .map((box) => {
      const normalizedWeight = normalizeIcarryWeight(
        box?.weight ?? box?.Weight ?? 0,
        box?.weight_unit || box?.unit || box?.WeightUnit,
      )

      return {
        quantity: Math.max(1, Math.floor(toNumber(box?.quantity ?? box?.qty ?? 1, 1))),
        length: toNumber(box?.length ?? box?.Length ?? 0, 0),
        breadth: toNumber(box?.breadth ?? box?.width ?? box?.Breadth ?? box?.Width ?? 0, 0),
        height: toNumber(box?.height ?? box?.Height ?? 0, 0),
        dimension_unit: 'cm',
        weight: normalizedWeight.weight,
        weight_unit: normalizedWeight.weight_unit,
      }
    })
    .filter((box) => box.length > 0 || box.weight > 0)
  return mapped.length ? mapped : undefined
}

const extractFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const raw = trim(value)
    if (raw) return raw
  }
  return ''
}

export class IcarryService {
  private baseUrl =
    process.env.ICARRY_API_BASE ||
    process.env.ICARRY_BASE_URL ||
    DEFAULT_ICARRY_BASE_URL

  private username = process.env.ICARRY_USERNAME || process.env.ICARRY_EMAIL || ''
  private apiKey = process.env.ICARRY_API_KEY || process.env.ICARRY_KEY || process.env.ICARRY_PASSWORD || ''
  private pickupAddressId = process.env.ICARRY_PICKUP_ADDRESS_ID || ''
  private returnAddressId = process.env.ICARRY_RETURN_ADDRESS_ID || ''
  private rtoAddressId = process.env.ICARRY_RTO_ADDRESS_ID || ''
  private pickupEmail = process.env.ICARRY_PICKUP_EMAIL || ''

  private static cachedConfig: IcarryConfig | null | undefined
  private static cachedToken: CachedToken | null = null
  private static pickupAddressCache = new Map<string, string>()

  static clearCachedConfig() {
    IcarryService.cachedConfig = undefined
    IcarryService.cachedToken = null
    IcarryService.pickupAddressCache.clear()
  }

  private async ensureConfigLoaded() {
    if (IcarryService.cachedConfig === undefined) {
      IcarryService.cachedConfig = await getEffectiveCourierConfig<IcarryConfig>('icarry', 'b2c')
    }

    const cfg = IcarryService.cachedConfig
    if (cfg) {
      this.baseUrl = cfg.apiBase || this.baseUrl
      this.username = cfg.email || this.username
      this.apiKey = cfg.apiToken || this.apiKey
      this.pickupAddressId = cfg.pickupAddressId || this.pickupAddressId
    }

    this.baseUrl = normalizeBaseUrl(this.baseUrl) || DEFAULT_ICARRY_BASE_URL
  }

  private getRootUrl() {
    return normalizeBaseUrl(this.baseUrl) || DEFAULT_ICARRY_BASE_URL
  }

  private client(headers: Record<string, string> = {}) {
    return axios.create({
      baseURL: this.getRootUrl(),
      timeout: 30000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        ...headers,
      },
    })
  }

  private buildUrl(path: string, apiToken: string) {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.getRootUrl())
    url.searchParams.set('api_token', apiToken)
    return url
  }

  private extractErrorMessage(error: any, fallback: string) {
    const response = error?.response?.data
    return (
      trim(response?.error) ||
      trim(response?.message) ||
      trim(response?.success) ||
      trim(error?.message) ||
      fallback
    )
  }

  private buildPickupAddressBody(
    payload: AnyRecord,
    options?: {
      includeNickname?: boolean
    },
  ) {
    const pickup = compactObject(payload?.pickup) || {}
    const zoneIdValue =
      toNumber(
        payload?.zone_id ??
          payload?.zoneId ??
          pickup?.zone_id ??
          pickup?.zoneId ??
          zoneIdForState(extractFirstString(pickup?.state, payload?.state)),
        0,
      ) || null

    const stateValue = extractFirstString(
      pickup?.state,
      payload?.state,
      getIcarryStateNameForZoneId(zoneIdValue),
    )

    const zoneId = zoneIdValue || zoneIdForState(stateValue)
    if (!zoneId) {
      throw new HttpError(400, `icarry pickup address requires a supported Indian state. Got "${stateValue}"`)
    }

    const email =
      trim(
        payload?.pickup_email ||
          payload?.email ||
          pickup?.email ||
          this.pickupEmail ||
          (this.username.includes('@') ? this.username : ''),
      ) || 'shipzilla@shipzilla.local'

    const phone = phone10(
      extractFirstString(payload?.phone, pickup?.phone, pickup?.mobile, payload?.mobile),
    )
    if (!phone) {
      throw new HttpError(400, 'icarry pickup address requires a 10 digit phone number.')
    }

    const nickname = sanitizeNickname(
      payload?.nickname,
      pickup?.addressNickname,
      pickup?.nickname,
      pickup?.warehouse_name,
      pickup?.city,
      stateValue,
      'ShipzillaPickup',
    )

    const body: AnyRecord = {
      name: extractFirstString(
        payload?.name,
        pickup?.name,
        payload?.company?.name,
        payload?.seller_name,
        'Shipzilla',
      ),
      email,
      phone,
      alt_phone: phone10(payload?.alt_phone || pickup?.alt_phone || pickup?.alternate_phone || ''),
      street1: extractFirstString(
        payload?.street1,
        pickup?.address,
        pickup?.street1,
        payload?.pickup_address,
        '',
      ),
      street2: extractFirstString(payload?.street2, pickup?.address_2, pickup?.street2, ''),
      locality: extractFirstString(
        payload?.locality,
        pickup?.locality,
        pickup?.warehouse_name,
        payload?.pickup_location_alias,
        '',
      ),
      city: extractFirstString(payload?.city, pickup?.city, ''),
      pincode: trim(payload?.pincode || pickup?.pincode || payload?.pickup_pincode || ''),
      zone_id: zoneId,
      country_id: toNumber(payload?.country_id ?? payload?.countryId ?? 99, 99),
    }

    if (options?.includeNickname !== false) {
      body.nickname = nickname
    }

    if (!body.street1 || !body.city || !body.pincode) {
      throw new HttpError(
        400,
        'icarry pickup address requires pickup street1, city, and pincode before booking.',
      )
    }

    if (String(body.country_id) !== '99') {
      throw new HttpError(400, "icarry pickup address only supports country_id '99'.")
    }

    return body
  }

  private pickApiToken(response: IcarryResponse) {
    return trim(response?.api_token || response?.token)
  }

  private isTokenValid() {
    return !!(IcarryService.cachedToken && Date.now() < IcarryService.cachedToken.expiresAt)
  }

  async authenticate(forceRefresh = false): Promise<string> {
    await this.ensureConfigLoaded()

    if (!forceRefresh && this.isTokenValid() && IcarryService.cachedToken) {
      return IcarryService.cachedToken.value
    }

    if (!this.username || !this.apiKey) {
      throw new HttpError(
        400,
        'icarry credentials are missing. Provide username and API key before booking shipments.',
      )
    }

    try {
      const response = await this.client().post<IcarryResponse>(
        '/api_login',
        toFormBody({
          username: this.username,
          Key: this.apiKey,
        }),
      )

      const parsedResponse = tryParseJson(response.data) as IcarryResponse
      const token = this.pickApiToken(parsedResponse)
      if (!token) {
        throw new HttpError(502, 'icarry login succeeded but no api_token was returned.')
      }

      IcarryService.cachedToken = {
        value: token,
        expiresAt: Date.now() + 55 * 60 * 1000,
      }

      return token
    } catch (error: any) {
      if (error instanceof HttpError) throw error
      throw new HttpError(
        Number(error?.response?.status || 502),
        this.extractErrorMessage(error, 'icarry authentication failed'),
      )
    }
  }

  private async request<T>(
    path: string,
    body: AnyRecord,
    token?: string,
  ): Promise<T> {
    const apiToken = token || (await this.authenticate())
    const response = await this.client().post<T>(
      this.buildUrl(path, apiToken).toString(),
      toFormBody(body),
    )
    return tryParseJson(response.data) as T
  }

  async estimateRates(payload: {
    length?: number
    breadth?: number
    height?: number
    weight?: number
    destination_pincode?: string | number
    origin_pincode?: string | number
    destination_country_code?: string
    origin_country_code?: string
    payment_type?: string
    shipment_mode?: string
    shipment_type?: string
    shipment_value?: string | number
    sender_address?: string
    sender_city?: string
    consignee_address?: string
    consignee_city?: string
  }) {
    const shipmentMode = normalizeShipmentMode(payload.shipment_mode)
    const shipmentType = normalizeShipmentType(payload.shipment_type || payload.payment_type)

    if (
      shipmentMode === 'H' &&
      (!isNonEmpty(payload.sender_address) ||
        !isNonEmpty(payload.sender_city) ||
        !isNonEmpty(payload.consignee_address) ||
        !isNonEmpty(payload.consignee_city))
    ) {
      throw new HttpError(
        400,
        'icarry hyperlocal estimates require sender_address, sender_city, consignee_address, and consignee_city.',
      )
    }

    const body: AnyRecord = {
      length: toNumber(payload.length ?? 0, 0),
      breadth: toNumber(payload.breadth ?? 0, 0),
      height: toNumber(payload.height ?? 0, 0),
      weight: toNumber(payload.weight ?? 0, 0),
      destination_pincode: trim(payload.destination_pincode),
      origin_pincode: trim(payload.origin_pincode),
      destination_country_code:
        trim(payload.destination_country_code || 'IN').toUpperCase() || 'IN',
      origin_country_code: trim(payload.origin_country_code || 'IN').toUpperCase() || 'IN',
      shipment_mode: shipmentMode,
      shipment_type: shipmentType,
      shipment_value: toNumber(payload.shipment_value ?? 0, 0),
    }

    if (shipmentMode === 'H') {
      body.sender_address = trim(payload.sender_address)
      body.sender_city = trim(payload.sender_city)
      body.consignee_address = trim(payload.consignee_address)
      body.consignee_city = trim(payload.consignee_city)
    }

    return this.request<IcarryResponse>('/api_get_estimate', body)
  }

  private getConsignee(payload: AnyRecord, international = false) {
    const consignee = compactObject(payload?.consignee) || {}
    const countryCodeRaw = extractFirstString(
      consignee?.country_code,
      consignee?.country,
      payload?.country_code,
      payload?.country,
      'IN',
    )
    const countryCode = countryCodeRaw.length >= 2 ? countryCodeRaw.slice(0, 2).toUpperCase() : 'IN'

    return {
      name: extractFirstString(consignee?.name, payload?.consignee_name, payload?.buyer_name, 'Customer'),
      mobile: phone10(extractFirstString(consignee?.mobile, consignee?.phone, payload?.phone, payload?.mobile)),
      alt_mobile: phone10(consignee?.alt_mobile || consignee?.alternate_phone || payload?.alt_mobile),
      address: extractFirstString(consignee?.address, payload?.delivery_address, payload?.address),
      city: extractFirstString(consignee?.city, payload?.city),
      pincode: trim(consignee?.pincode || payload?.destination_pincode || payload?.pincode),
      state: international
        ? extractFirstString(consignee?.state, payload?.state, '')
        : normalizeStateCode(extractFirstString(consignee?.state, payload?.state), ''),
      country_code: countryCode,
    }
  }

  private getParcel(payload: AnyRecord, international = false) {
    const items = mapItems(payload?.order_items)
    const boxes = mapBoxes(payload?.boxes || payload?.parcel?.boxes)
    const paymentType = trim(payload?.payment_type || payload?.parcel?.type || 'prepaid').toLowerCase()
    const isCod = paymentType === 'cod'

    const parcel: AnyRecord = {
      type: international ? 'Prepaid' : isCod ? 'COD' : 'Prepaid',
      value: toNumber(
        payload?.parcel?.value ??
          payload?.order_amount ??
          payload?.invoice_amount ??
          payload?.collectable_amount ??
          0,
        0,
      ),
      currency: trim(payload?.parcel?.currency || payload?.currency || 'INR') || 'INR',
      contents: extractFirstString(
        payload?.parcel?.contents,
        payload?.category_of_goods,
        payload?.description,
        items?.[0]?.name,
        'Shipment',
      ).slice(0, 255),
    }

    const dimensions = payload?.parcel?.dimensions || {}
    const weight = payload?.parcel?.weight || {}
    const derivedLength = toNumber(payload?.package_length ?? payload?.length ?? dimensions?.length, 0)
    const derivedBreadth = toNumber(payload?.package_breadth ?? payload?.breadth ?? dimensions?.breadth, 0)
    const derivedHeight = toNumber(payload?.package_height ?? payload?.height ?? dimensions?.height, 0)
    const normalizedParcelWeight = normalizeIcarryWeight(
      payload?.package_weight ?? payload?.weight ?? weight?.weight,
      weight?.unit,
    )

    if (boxes?.length) {
      parcel.boxes = boxes
    }

    if (items?.length) {
      parcel.items = items
    }

    if (derivedLength || derivedBreadth || derivedHeight) {
      parcel.dimensions = {
        length: derivedLength,
        breadth: derivedBreadth,
        height: derivedHeight,
        unit: 'cm',
      }
    }

    if (normalizedParcelWeight.weight) {
      parcel.weight = {
        weight: normalizedParcelWeight.weight,
        unit: normalizedParcelWeight.weight_unit,
      }
    }

    if (isNonEmpty(payload?.ewbn || payload?.ewb || payload?.ewbn_number || payload?.ewaybill_number)) {
      parcel.ewbn = extractFirstString(
        payload?.ewbn,
        payload?.ewb,
        payload?.ewbn_number,
        payload?.ewaybill_number,
      )
    }

    if (isNonEmpty(payload?.eway_filename)) {
      parcel.eway_filename = trim(payload.eway_filename)
    }

    if (isNonEmpty(payload?.invoice_filename)) {
      parcel.invoice_filename = trim(payload.invoice_filename)
    }

    return parcel
  }

  private async addPickupAddress(payload: AnyRecord) {
    const created = await this.createPickupAddress(payload)
    return created.warehouse_id
  }

  async createPickupAddress(payload: AnyRecord | IcarryCreatePickupAddressPayload) {
    const body = this.buildPickupAddressBody(payload as AnyRecord, { includeNickname: true })
    const response = await this.request<IcarryResponse>('/api_add_pickup_address', body)
    const warehouseId = trim(response?.warehouse_id || response?.pickup_id)

    if (!warehouseId || response?.error) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry pickup address creation failed'),
      )
    }

    return {
      status: true,
      message: trim(response?.success || response?.message || 'icarry pickup address created successfully'),
      warehouse_id: warehouseId,
      raw: response,
    }
  }

  async updatePickupAddress(
    payload:
      | (AnyRecord &
          IcarryCreatePickupAddressPayload & {
            warehouse_id?: string | number
            warehouseId?: string | number
          })
      | {
          warehouse_id?: string | number
          warehouseId?: string | number
          name?: string
          email?: string
          phone?: string
          alt_phone?: string
          street1?: string
          street2?: string
          locality?: string
          city?: string
          pincode?: string | number
          zone_id?: string | number
          country_id?: string | number
          state?: string
        },
  ) {
    const warehouseId = trim((payload as AnyRecord)?.warehouse_id || (payload as AnyRecord)?.warehouseId)
    if (!warehouseId) {
      throw new HttpError(400, 'icarry pickup address update requires a warehouse_id.')
    }

    const body = this.buildPickupAddressBody(payload as AnyRecord, { includeNickname: false })
    body.warehouse_id = warehouseId

    const response = await this.request<IcarryResponse>('/api_edit_pickup_address', body)
    const updatedWarehouseId = trim(response?.warehouse_id || response?.pickup_id || warehouseId)

    if (!updatedWarehouseId || response?.error) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry pickup address update failed'),
      )
    }

    return {
      status: true,
      message: trim(response?.success || response?.message || 'icarry pickup address updated successfully'),
      warehouse_id: updatedWarehouseId,
      raw: response,
    }
  }

  async deletePickupAddress(
    payload:
      | string
      | number
      | {
          warehouse_id?: string | number
          warehouseId?: string | number
        },
  ) {
    const warehouseId =
      typeof payload === 'object' && payload !== null
        ? trim((payload as AnyRecord)?.warehouse_id || (payload as AnyRecord)?.warehouseId)
        : trim(payload)

    if (!warehouseId) {
      throw new HttpError(400, 'icarry pickup address delete requires a warehouse_id.')
    }

    const response = await this.request<IcarryResponse>('/api_delete_pickup_address', {
      warehouse_id: warehouseId,
    })

    const deletedWarehouseId = trim(response?.warehouse_id || response?.pickup_id || warehouseId)

    if (!deletedWarehouseId || response?.error) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry pickup address delete failed'),
      )
    }

    return {
      status: true,
      message: trim(response?.success || response?.message || 'icarry pickup address deleted successfully'),
      warehouse_id: deletedWarehouseId,
      raw: response,
    }
  }

  private async resolvePickupAddressId(payload: AnyRecord) {
    const directId = trim(
      payload?.pickup_address_id ||
        payload?.pickupAddressId ||
        payload?.pickup_address ||
        this.pickupAddressId,
    )
    if (directId) return directId

    const pickup = compactObject(payload?.pickup) || {}
    const signature = [
      trim(pickup?.name),
      trim(pickup?.address),
      trim(pickup?.address_2),
      trim(pickup?.city),
      trim(pickup?.state),
      trim(pickup?.pincode),
      trim(pickup?.phone),
    ]
      .filter(Boolean)
      .join('|')

    if (signature && IcarryService.pickupAddressCache.has(signature)) {
      return IcarryService.pickupAddressCache.get(signature) as string
    }

    const created = await this.addPickupAddress(payload)
    if (signature) {
      IcarryService.pickupAddressCache.set(signature, created)
    }
    return created
  }

  private buildShipmentBody(
    payload: AnyRecord,
    pickupAddressId: string,
    returnAddressId?: string,
    rtoAddressId?: string,
  ): AnyRecord {
    const consignee = this.getConsignee(payload)
    const parcel = this.getParcel(payload)
    const clientOrderId = extractFirstString(payload?.client_order_id, payload?.order_number, payload?.order_id)
    const courierId = trim(payload?.courier_id)
    const shipmentMode = normalizeShipmentMode(
      payload?.shipment_mode || payload?.shipping_mode || payload?.transport_speed || payload?.mode,
    )
    const saveOnly = ['1', 'true', 'yes'].includes(trim(payload?.save_only).toLowerCase())

    return {
      pickup_address_id: pickupAddressId,
      return_address_id: returnAddressId || undefined,
      rto_address_id: rtoAddressId || undefined,
      client_order_id: clientOrderId || undefined,
      courier_id: courierId || undefined,
      shipment_mode: shipmentMode,
      save_only: saveOnly ? 1 : undefined,
      consignee,
      parcel,
    }
  }

  private shouldUseInternational(payload: AnyRecord) {
    const consignee = compactObject(payload?.consignee) || {}
    const countryCode = extractFirstString(
      consignee?.country_code,
      consignee?.country,
      payload?.country_code,
      payload?.country,
      'IN',
    ).toUpperCase()
    return countryCode && countryCode !== 'IN'
  }

  private shouldUseAir(payload: AnyRecord) {
    const hint = extractFirstString(
      payload?.shipment_mode,
      payload?.shipping_mode,
      payload?.transport_speed,
      payload?.mode,
    ).toLowerCase()
    return ['air', 'express', 'e', 'plane'].includes(hint)
  }

  async createShipment(payload: AnyRecord) {
    const international = this.shouldUseInternational(payload)
    const pickupAddressId = await this.resolvePickupAddressId(payload)
    const returnAddressId = trim(payload?.return_address_id || payload?.returnAddressId || this.returnAddressId) || pickupAddressId
    const rtoAddressId = trim(payload?.rto_address_id || payload?.rtoAddressId || this.rtoAddressId) || pickupAddressId

    const body = this.buildShipmentBody(payload, pickupAddressId, returnAddressId, rtoAddressId)
    const endpoint = international
      ? '/api_add_shipment_international'
      : normalizeShipmentMode(
            payload?.shipment_mode || payload?.shipping_mode || payload?.transport_speed || payload?.mode,
          ) === 'E'
        ? '/api_add_shipment_air'
        : '/api_add_shipment_surface'

    if (international) {
      body.parcel.type = 'Prepaid'
      body.consignee.state = extractFirstString(payload?.consignee?.state, payload?.state, '')
      body.consignee.country_code = extractFirstString(
        payload?.consignee?.country_code,
        payload?.country_code,
        payload?.country,
        'US',
      )
    }

    const mappedBoxes = mapBoxes(payload?.boxes || payload?.parcel?.boxes)
    if (mappedBoxes?.length) {
      body.parcel = {
        ...body.parcel,
        boxes: mappedBoxes,
      }
      if (!international) {
        body.mode =
          normalizeShipmentMode(
            payload?.shipment_mode || payload?.shipping_mode || payload?.transport_speed || payload?.mode,
          ) === 'E'
            ? 'E'
            : 'S'
        const response = await this.request<IcarryResponse>('/api_add_multibox_shipment', body)
        return this.normalizeCreateResponse(response, pickupAddressId, body)
      }
    }

    const response = await this.request<IcarryResponse>(endpoint, body)
    return this.normalizeCreateResponse(response, pickupAddressId, body)
  }

  async createReverseShipment(
    payload:
      | AnyRecord
      | {
          shipment_id?: string | number
          shipmentId?: string | number
          courier_id?: string | number
          courierId?: string | number
        }
      | string
      | number,
  ) {
    const objectPayload =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as AnyRecord)
        : null
    const shipmentId = objectPayload
      ? trim(objectPayload.shipment_id || objectPayload.shipmentId)
      : trim(payload)

    if (!shipmentId) {
      throw new HttpError(400, 'icarry reverse shipment requires a shipment_id.')
    }

    const response = await this.request<IcarryResponse>('/api_add_reverse_shipment', {
      shipment_id: shipmentId,
    })

    return this.normalizeCreateResponse(
      response,
      '',
      {
        courier_id: objectPayload?.courier_id || objectPayload?.courierId,
      },
      'icarry reverse shipment created successfully',
    )
  }

  private normalizeCreateResponse(
    response: IcarryResponse,
    pickupAddressId: string,
    body: AnyRecord,
    fallbackMessage = 'icarry shipment created successfully',
  ) {
    const shipmentId = trim(response?.shipment_id)
    const pickupId = trim(response?.pickup_id || pickupAddressId)
    const awb = trim(response?.awb)
    const courierId = trim(response?.courier_id || body?.courier_id)
    const courierName = trim(response?.courier_name || 'icarry')
    const successMessage = trim(response?.success || response?.message || fallbackMessage)

    if (response?.error || (!shipmentId && !awb)) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry shipment creation failed'),
      )
    }

    return {
      status: true,
      message: successMessage,
      data: {
        shipment_id: shipmentId || pickupId,
        pickup_id: pickupId || undefined,
        awb_number: awb || shipmentId || pickupId,
        tracking_number: awb || shipmentId || pickupId,
        courier_id: courierId || undefined,
        courier_name: courierName,
        label: response?.label ?? null,
        manifest: response?.manifest ?? null,
        tracking_url: response?.tracking_url ?? null,
      },
      raw: response,
    }
  }

  async trackOrder(shipmentIdOrAwb: string | number) {
    const shipmentId = trim(shipmentIdOrAwb)
    if (!shipmentId) {
      throw new HttpError(400, 'icarry tracking requires a shipment_id.')
    }
    return this.request<IcarryResponse>('/api_track_shipment', { shipment_id: shipmentId })
  }

  async cancelShipment(shipmentIdOrAwb: string | number) {
    const shipmentId = trim(shipmentIdOrAwb)
    if (!shipmentId) {
      throw new HttpError(400, 'icarry cancellation requires a shipment_id.')
    }
    return this.request<IcarryResponse>('/api_cancel_shipment', { shipment_id: shipmentId })
  }

  async getPackagingSlip(shipmentIdOrAwb: string | number) {
    const shipmentId = trim(shipmentIdOrAwb)
    if (!shipmentId) {
      throw new HttpError(400, 'icarry label generation requires a shipment_id.')
    }
    return this.request<IcarryResponse>('/api_print_shipment_label', { shipment_id: shipmentId })
  }

  async checkPincode(pincode: string | number) {
    const value = trim(pincode)
    if (!value) {
      throw new HttpError(400, 'icarry pincode lookup requires a pincode.')
    }
    return this.request<IcarryResponse>('/api_check_pincode', { pincode: value })
  }

  async syncShipmentCharges(shipmentIds: Array<string | number>) {
    const normalizedShipmentIds = shipmentIds
      .map((shipmentId) => trim(shipmentId))
      .filter(Boolean)

    if (!normalizedShipmentIds.length) {
      throw new HttpError(400, 'icarry shipment billing sync requires at least one shipment_id.')
    }

    const response = await this.request<IcarryBillingSyncResponse>(
      '/api_shipment_billing_sync',
      {
        shipment_ids: normalizedShipmentIds,
      },
    )

    const records = Array.isArray(response?.msg)
      ? response.msg
      : Array.isArray(response?.data)
        ? response.data
        : []

    if (response?.error) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry shipment billing sync failed'),
      )
    }

    return {
      message:
        trim(response?.success || response?.message) || 'Shipment billing synced successfully',
      records,
      raw: response,
    }
  }

  async syncShipmentStatuses(shipmentIds: Array<string | number>) {
    const normalizedShipmentIds = shipmentIds
      .map((shipmentId) => trim(shipmentId))
      .filter(Boolean)

    if (!normalizedShipmentIds.length) {
      throw new HttpError(400, 'icarry shipment status sync requires at least one shipment_id.')
    }

    const response = await this.request<IcarryShipmentStatusSyncResponse>(
      '/api_shipment_status_sync',
      {
        shipment_ids: normalizedShipmentIds,
      },
    )

    const records = Array.isArray(response?.msg)
      ? response.msg
      : Array.isArray(response?.data)
        ? response.data
        : []

    if (response?.error) {
      throw new HttpError(
        502,
        this.extractErrorMessage({ response: { data: response } }, 'icarry shipment status sync failed'),
      )
    }

    return {
      message:
        trim(response?.success || response?.message) || 'Shipment statuses synced successfully',
      records,
      raw: response,
    }
  }
}
