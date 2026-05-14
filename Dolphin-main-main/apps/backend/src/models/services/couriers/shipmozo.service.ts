import axios, { AxiosInstance } from 'axios'
import qs from 'qs'
import { HttpError } from '../../../utils/classes'
import {
  DEFAULT_SHIPMOZO_BASE_URL,
  ShipmozoConfig,
  getEffectiveCourierConfig,
} from '../courierCredentials.service'

export type ShipmozoApiResponse<T = any> = {
  result: '0' | '1' | string
  message?: string
  data?: T
}

export type ShipmozoRateRecord = {
  courier_id?: number | string
  id?: number | string
  courier?: string
  courier_name?: string
  courier_company?: string
  freight_charges?: number | string
  cod_charges?: number | string
  total_charges?: number | string
  rate?: number | string
  chargeable_weight?: number | string
  pickups_automatically_scheduled?: string
  [key: string]: any
}

export type ShipmozoServiceabilityResponse = {
  serviceable: boolean
  records: ShipmozoRateRecord[]
  codAvailable: boolean
  prepaidAvailable: boolean
  tat: number | null
  raw: any
}

export type ShipmozoShipmentResponse = {
  status: boolean
  data?: {
    order_id?: string
    reference_id?: string
    awb_number?: string
    lr_number?: string
    courier?: string
    courier_company?: string
    courier_company_service?: string
    label?: string
    manifest?: string
  }
  message?: string
  raw?: any
}

type ShipmozoKeys = {
  publicKey: string
  privateKey: string
}

const trim = (value: unknown) => String(value ?? '').trim()

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toDigits = (value: unknown) => trim(value).replace(/\D/g, '')

const toPhone = (value: unknown) => Number(toDigits(value).slice(-10) || 0)

const toPincode = (value: unknown) => Number(toDigits(value).slice(0, 6) || 0)

const toAwbPayloadValue = (value: unknown) => {
  const raw = trim(value)
  return /^\d+$/.test(raw) ? Number(raw) : raw
}

const toDateOnly = (value: unknown) => {
  const raw = trim(value)
  if (raw) {
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if (iso) return iso[1]
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

const toWeightGrams = (value: unknown) => {
  const numeric = toNumber(value, 0)
  if (numeric <= 0) return 0
  return numeric <= 50 ? Math.round(numeric * 1000) : Math.round(numeric)
}

const toWeightKg = (value: unknown) => {
  const numeric = toNumber(value, 0)
  if (numeric <= 0) return 0
  return numeric > 50 ? Number((numeric / 1000).toFixed(3)) : numeric
}

const mask = (value: string) =>
  value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value ? '***' : ''

export class ShipmozoService {
  private baseApi =
    process.env.SHIPMOZO_API_BASE ||
    process.env.SHIPMOZO_API_BASE_URL ||
    DEFAULT_SHIPMOZO_BASE_URL
  private username = process.env.SHIPMOZO_USERNAME || ''
  private password = process.env.SHIPMOZO_PASSWORD || ''
  private publicKey =
    process.env.SHIPMOZO_PUBLIC_KEY || process.env.SHIPMOZO_CLIENT_ID || ''
  private privateKey =
    process.env.SHIPMOZO_PRIVATE_KEY ||
    process.env.SHIPMOZO_API_KEY ||
    process.env.SHIPMOZO_API_TOKEN ||
    ''
  private webhookSecret = process.env.SHIPMOZO_WEBHOOK_SECRET || ''
  private static cachedConfig: ShipmozoConfig | null | undefined
  private static cachedKeys: ShipmozoKeys | null = null

  static clearCachedConfig() {
    ShipmozoService.cachedConfig = undefined
    ShipmozoService.cachedKeys = null
  }

  private log(prefix: string, details: Record<string, any>) {
    console.log(`[Shipmozo] ${prefix}`, details)
  }

  private normalizeBaseApi(value: string) {
    const normalized = (value || DEFAULT_SHIPMOZO_BASE_URL).replace(/\/+$/, '')
    if (/^https?:\/\/api\.shipmozo\.com$/i.test(normalized)) return DEFAULT_SHIPMOZO_BASE_URL
    return normalized
  }

  private async ensureConfigLoaded() {
    if (ShipmozoService.cachedConfig === undefined) {
      ShipmozoService.cachedConfig = await getEffectiveCourierConfig<ShipmozoConfig>(
        'shipmozo',
        'b2c',
      )
    }

    const cfg = ShipmozoService.cachedConfig
    if (cfg) {
      this.baseApi = cfg.apiBase || this.baseApi
      this.publicKey = cfg.publicKey || this.publicKey
      this.privateKey = cfg.privateKey || this.privateKey
      this.username = cfg.username || this.username
      this.password = cfg.password || this.password
      this.webhookSecret = cfg.webhookSecret || this.webhookSecret
    }
    this.baseApi = this.normalizeBaseApi(this.baseApi)
  }

  private http(headers: Record<string, string> = {}): AxiosInstance {
    return axios.create({
      baseURL: this.baseApi,
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  }

  private isSuccess<T>(response: ShipmozoApiResponse<T>) {
    return String(response?.result ?? '') === '1'
  }

  private assertSuccess<T>(response: ShipmozoApiResponse<T>, action: string) {
    if (this.isSuccess(response)) return response
    const message =
      trim(response?.message) ||
      trim((response?.data as any)?.error) ||
      `${action} failed in Shipmozo`
    throw new HttpError(502, message)
  }

  private extractErrorMessage(err: any, fallback: string) {
    return (
      trim(err?.response?.data?.message) ||
      trim(err?.response?.data?.data?.error) ||
      trim(err?.message) ||
      fallback
    )
  }

  private authHeaders(keys: ShipmozoKeys) {
    return {
      public_key: keys.publicKey,
      private_key: keys.privateKey,
      publickey: keys.publicKey,
      privatekey: keys.privateKey,
      'public-key': keys.publicKey,
      'private-key': keys.privateKey,
      'Public-Key': keys.publicKey,
      'Private-Key': keys.privateKey,
    }
  }

  async getApiKeys(forceLogin = false): Promise<ShipmozoKeys> {
    await this.ensureConfigLoaded()
    if (!forceLogin && ShipmozoService.cachedKeys) return ShipmozoService.cachedKeys

    if (!forceLogin && this.publicKey && this.privateKey) {
      ShipmozoService.cachedKeys = {
        publicKey: this.publicKey,
        privateKey: this.privateKey,
      }
      return ShipmozoService.cachedKeys
    }

    if (!this.username || !this.password) {
      throw new HttpError(
        400,
        'Shipmozo credentials are missing. Save public/private keys or username/password before running Shipmozo APIs.',
      )
    }

    try {
      const response = await this.http({
        'Content-Type': 'application/x-www-form-urlencoded',
      }).post<ShipmozoApiResponse<any[]>>(
        '/login',
        qs.stringify({
          username: this.username,
          password: this.password,
        }),
      )
      const data = this.assertSuccess(response.data, 'Shipmozo login').data
      const firstUser = Array.isArray(data) ? data[0] : data
      const publicKey = trim(firstUser?.public_key)
      const privateKey = trim(firstUser?.private_key)
      if (!publicKey || !privateKey) {
        throw new HttpError(502, 'Shipmozo login did not return public_key/private_key.')
      }

      ShipmozoService.cachedKeys = { publicKey, privateKey }
      this.publicKey = publicKey
      this.privateKey = privateKey
      this.log('Login succeeded', {
        publicKey: mask(publicKey),
        privateKey: mask(privateKey),
      })
      return ShipmozoService.cachedKeys
    } catch (err: any) {
      if (err instanceof HttpError) throw err
      throw new HttpError(
        Number(err?.response?.status || 502),
        this.extractErrorMessage(err, 'Shipmozo login failed'),
      )
    }
  }

  private async get<T>(path: string, params?: Record<string, any>) {
    const keys = await this.getApiKeys()
    const response = await this.http(this.authHeaders(keys)).get<ShipmozoApiResponse<T>>(path, {
      params,
    })
    return response.data
  }

  private async post<T>(path: string, data: Record<string, any>) {
    const keys = await this.getApiKeys()
    const response = await this.http(this.authHeaders(keys)).post<ShipmozoApiResponse<T>>(
      path,
      data,
    )
    return response.data
  }

  async info() {
    await this.ensureConfigLoaded()
    const response = await this.http().get<ShipmozoApiResponse<{ Info?: string }>>('/info')
    return this.assertSuccess(response.data, 'Shipmozo info')
  }

  async pincodeServiceability(payload: {
    pickup_pincode: string | number
    delivery_pincode: string | number
  }) {
    const raw = await this.post<{ serviceable?: boolean }>('/pincode-serviceability', {
      pickup_pincode: toPincode(payload.pickup_pincode),
      delivery_pincode: toPincode(payload.delivery_pincode),
    })
    return this.assertSuccess(raw, 'Shipmozo pincode serviceability')
  }

  async rateCalculator(payload: {
    order_id?: string
    pickup_pincode: string | number
    delivery_pincode: string | number
    payment_type: 'PREPAID' | 'COD'
    shipment_type?: 'FORWARD' | 'RETURN' | string
    order_amount: string | number
    type_of_package?: string
    rov_type?: string
    cod_amount?: string | number
    weight: string | number
    length?: string | number
    width?: string | number
    height?: string | number
    dimensions?: Array<Record<string, any>>
  }) {
    const dimensions =
      Array.isArray(payload.dimensions) && payload.dimensions.length
        ? payload.dimensions
        : [
            {
              no_of_box: '1',
              length: String(payload.length ?? 10),
              width: String(payload.width ?? 10),
              height: String(payload.height ?? 10),
            },
          ]

    const raw = await this.post<any>('/rate-calculator', {
      order_id: payload.order_id || '',
      pickup_pincode: toPincode(payload.pickup_pincode),
      delivery_pincode: toPincode(payload.delivery_pincode),
      payment_type: payload.payment_type,
      shipment_type: payload.shipment_type || 'FORWARD',
      order_amount: toNumber(payload.order_amount, 0),
      type_of_package: payload.type_of_package || 'SPS',
      rov_type: payload.rov_type || 'ROV_OWNER',
      cod_amount: payload.payment_type === 'COD' ? String(payload.cod_amount ?? payload.order_amount) : '',
      weight: toWeightGrams(payload.weight),
      dimensions,
    })
    return this.assertSuccess(raw, 'Shipmozo rate calculator')
  }

  async checkServiceability(payload: {
    origin: string
    destination: string
    payment_type: 'cod' | 'prepaid'
    order_amount: string
    weight: string
    length: string
    breadth: string
    height: string
  }): Promise<ShipmozoServiceabilityResponse> {
    const pinRaw = await this.pincodeServiceability({
      pickup_pincode: payload.origin,
      delivery_pincode: payload.destination,
    })
    const serviceable = pinRaw.data?.serviceable === true
    if (!serviceable) {
      return {
        serviceable: false,
        records: [],
        codAvailable: false,
        prepaidAvailable: false,
        tat: null,
        raw: pinRaw,
      }
    }

    const rateRaw = await this.rateCalculator({
      pickup_pincode: payload.origin,
      delivery_pincode: payload.destination,
      payment_type: payload.payment_type === 'cod' ? 'COD' : 'PREPAID',
      shipment_type: 'FORWARD',
      order_amount: payload.order_amount,
      cod_amount: payload.payment_type === 'cod' ? payload.order_amount : '',
      weight: payload.weight,
      length: payload.length,
      width: payload.breadth,
      height: payload.height,
    })

    const data = rateRaw.data
    const records = Array.isArray(data)
      ? data
      : Array.isArray(data?.rates)
        ? data.rates
        : Array.isArray(data?.couriers)
          ? data.couriers
          : Array.isArray(data?.available_couriers)
            ? data.available_couriers
            : data && typeof data === 'object'
              ? [data]
              : []

    return {
      serviceable: records.length > 0,
      records,
      codAvailable: payload.payment_type === 'cod' ? records.length > 0 : true,
      prepaidAvailable: true,
      tat: null,
      raw: { pincode: pinRaw, rates: rateRaw },
    }
  }

  async getWarehouses() {
    const raw = await this.get<any[]>('/get-warehouses')
    return this.assertSuccess(raw, 'Shipmozo get warehouses')
  }

  async createWarehouse(payload: any) {
    const raw = await this.post<{ warehouse_id?: string | number }>('/create-warehouse', {
      address_title: trim(payload.address_title || payload.alias || payload.warehouse_name || payload.name),
      name: trim(payload.name),
      phone: payload.phone ? toPhone(payload.phone) : undefined,
      alternate_phone: payload.alternate_phone ? toPhone(payload.alternate_phone) : undefined,
      email: trim(payload.email),
      address_line_one: trim(payload.address_line_one || payload.address || payload.addressLine1),
      address_line_two: trim(payload.address_line_two || payload.address_2 || payload.addressLine2),
      pin_code: toPincode(payload.pin_code || payload.pincode),
    })
    return this.assertSuccess(raw, 'Shipmozo create warehouse')
  }

  private async resolveWarehouseId(payload: any): Promise<string> {
    const direct = trim(payload?.warehouse_id || payload?.pickup?.warehouse_id)
    if (direct) return direct

    const warehouses = await this.getWarehouses()
    const rows = Array.isArray(warehouses.data) ? warehouses.data : []
    const pickupTitle = trim(payload?.pickup?.warehouse_name || payload?.pickup?.name)
    const activeRows = rows.filter((row: any) => trim(row?.status).toUpperCase() !== 'INACTIVE')
    const matched =
      activeRows.find((row: any) => trim(row?.address_title).toLowerCase() === pickupTitle.toLowerCase()) ||
      activeRows.find((row: any) => trim(row?.default).toUpperCase() === 'YES') ||
      activeRows[0]
    if (matched?.id) return String(matched.id)

    const created = await this.createWarehouse({
      address_title: pickupTitle || `Shipzilla-${toPincode(payload?.pickup?.pincode)}`,
      name: payload?.pickup?.name,
      phone: payload?.pickup?.phone,
      email: payload?.pickup?.email,
      address_line_one: payload?.pickup?.address,
      address_line_two: payload?.pickup?.address_2,
      pin_code: payload?.pickup?.pincode,
    })
    const warehouseId = trim(created.data?.warehouse_id)
    if (!warehouseId) throw new HttpError(502, 'Shipmozo did not return a warehouse_id.')
    return warehouseId
  }

  private buildProductDetail(payload: any) {
    const directProducts = Array.isArray(payload?.product_detail) ? payload.product_detail : []
    if (directProducts.length) {
      return directProducts.map((item: any) => ({
        name: trim(item?.name) || 'Product',
        sku_number: trim(item?.sku_number ?? item?.sku) || 'SKU',
        quantity: toNumber(item?.quantity ?? item?.qty, 1),
        discount: item?.discount ?? '',
        hsn: trim(item?.hsn ?? item?.hsnCode),
        unit_price: toNumber(item?.unit_price ?? item?.price, 0),
        product_category: trim(item?.product_category || payload?.category_of_goods) || 'Other',
      }))
    }

    const items = Array.isArray(payload?.order_items) ? payload.order_items : []
    const normalized = items.map((item: any) => ({
      name: trim(item?.name) || 'Product',
      sku_number: trim(item?.sku) || 'SKU',
      quantity: toNumber(item?.qty ?? item?.quantity, 1),
      discount: item?.discount ?? '',
      hsn: trim(item?.hsn ?? item?.hsnCode),
      unit_price: toNumber(item?.price, 0),
      product_category: trim(item?.product_category || payload?.category_of_goods) || 'Other',
    }))

    return normalized.length
      ? normalized
      : [
          {
            name: 'Package',
            sku_number: 'PKG',
            quantity: 1,
            discount: '',
            hsn: '',
            unit_price: toNumber(payload?.order_amount, 0),
            product_category: 'Other',
          },
        ]
  }

  private async pushOrder(payload: any) {
    const warehouseId = await this.resolveWarehouseId(payload)
    const paymentType = payload?.payment_type === 'cod' ? 'COD' : 'PREPAID'
    const raw = await this.post<any>('/push-order', {
      order_id: trim(payload.order_number),
      order_date: toDateOnly(payload.order_date),
      order_type: trim(payload.order_type || payload.category_of_goods) || 'ESSENTIALS',
      consignee_name: trim(payload?.consignee?.name),
      consignee_phone: toPhone(payload?.consignee?.phone),
      consignee_alternate_phone: payload?.consignee?.alternate_phone
        ? toPhone(payload.consignee.alternate_phone)
        : undefined,
      consignee_email: trim(payload?.consignee?.email),
      consignee_address_line_one: trim(payload?.consignee?.address),
      consignee_address_line_two: trim(payload?.consignee?.address_2),
      consignee_pin_code: toPincode(payload?.consignee?.pincode),
      consignee_city: trim(payload?.consignee?.city),
      consignee_state: trim(payload?.consignee?.state),
      product_detail: this.buildProductDetail(payload),
      payment_type: paymentType,
      cod_amount: paymentType === 'COD' ? String(payload?.collectable_amount ?? payload?.order_amount ?? 0) : '',
      weight: toWeightGrams(payload?.package_weight ?? payload?.weight),
      length: toNumber(payload?.package_length ?? payload?.length, 10),
      width: toNumber(payload?.package_breadth ?? payload?.breadth, 10),
      height: toNumber(payload?.package_height ?? payload?.height, 10),
      warehouse_id: warehouseId,
      gst_ewaybill_number: trim(payload?.gst_ewaybill_number || payload?.ewbn || payload?.ewaybill_number),
      gstin_number: trim(payload?.gstin_number || payload?.company?.gst),
    })
    return this.assertSuccess(raw, 'Shipmozo push order')
  }

  private async pushReturnOrder(payload: any) {
    const paymentType = trim(payload?.payment_type).toUpperCase()
    const normalizedPaymentType = ['PREPAID', 'COD'].includes(paymentType) ? paymentType : 'PREPAID'
    const raw = await this.post<any>('/push-return-order', {
      order_id: trim(payload.return_order_id || payload.order_number || payload.order_id),
      order_date: toDateOnly(payload.order_date),
      order_type: trim(payload.order_type || payload.category_of_goods) || 'ESSENTIALS',
      pickup_name: trim(payload?.pickup_name || payload?.consignee?.name || payload?.pickup?.name),
      pickup_phone: toPhone(payload?.pickup_phone || payload?.consignee?.phone || payload?.pickup?.phone),
      pickup_email: trim(payload?.pickup_email || payload?.consignee?.email || payload?.pickup?.email),
      pickup_address_line_one: trim(
        payload?.pickup_address_line_one || payload?.consignee?.address || payload?.pickup?.address,
      ),
      pickup_address_line_two: trim(
        payload?.pickup_address_line_two || payload?.consignee?.address_2 || payload?.pickup?.address_2,
      ),
      pickup_pin_code: toPincode(
        payload?.pickup_pin_code || payload?.consignee?.pincode || payload?.pickup?.pincode,
      ),
      pickup_city: trim(payload?.pickup_city || payload?.consignee?.city || payload?.pickup?.city),
      pickup_state: trim(payload?.pickup_state || payload?.consignee?.state || payload?.pickup?.state),
      product_detail: this.buildProductDetail(payload),
      payment_type: normalizedPaymentType,
      weight: toWeightKg(payload?.weight ?? payload?.package_weight ?? payload?.packageWeight),
      length: toNumber(payload?.length ?? payload?.package_length, 10),
      width: toNumber(payload?.width ?? payload?.package_breadth ?? payload?.breadth, 10),
      height: toNumber(payload?.height ?? payload?.package_height, 10),
      warehouse_id: trim(payload?.warehouse_id),
      return_reason_id: toNumber(payload?.return_reason_id, 14),
      customer_request: trim(payload?.customer_request) || 'REFUND',
      reason_comment: trim(payload?.reason_comment),
    })
    return this.assertSuccess(raw, 'Shipmozo push return order')
  }

  async assignCourier(orderId: string, courierId: string | number) {
    const raw = await this.post<any>('/assign-courier', {
      order_id: orderId,
      courier_id: Number(courierId),
    })
    return this.assertSuccess(raw, 'Shipmozo assign courier')
  }

  async autoAssignOrder(orderId: string) {
    const raw = await this.post<any>('/auto-assign-order', { order_id: orderId })
    return this.assertSuccess(raw, 'Shipmozo auto assign order')
  }

  async schedulePickup(orderId: string) {
    const raw = await this.post<any>('/schedule-pickup', { order_id: orderId })
    return this.assertSuccess(raw, 'Shipmozo schedule pickup')
  }

  async getOrderDetail(orderId: string) {
    const raw = await this.get<any>(`/get-order-detail/${encodeURIComponent(orderId)}`)
    return this.assertSuccess(raw, 'Shipmozo get order detail')
  }

  async getOrderLabel(awbNumber: string) {
    const raw = await this.get<any[]>(`/get-order-label/${encodeURIComponent(awbNumber)}`)
    return this.assertSuccess(raw, 'Shipmozo get order label')
  }

  async trackOrder(awbNumber: string) {
    const raw = await this.get<any>('/track-order', { awb_number: awbNumber })
    return this.assertSuccess(raw, 'Shipmozo track order')
  }

  async getReturnReasons() {
    const raw = await this.get<any[]>('/get-return-reason')
    return this.assertSuccess(raw, 'Shipmozo return reasons')
  }

  async updateWarehouse(orderId: string, warehouseId: string | number) {
    const raw = await this.post<any>('/order/update-warehouse', {
      order_id: orderId,
      warehouse_id: Number(warehouseId),
    })
    return this.assertSuccess(raw, 'Shipmozo update warehouse')
  }

  private normalizeShipmentResponse(raw: any): ShipmozoShipmentResponse {
    const data = raw?.data || {}
    const awb =
      trim(data?.awb_number) ||
      trim(data?.awb) ||
      trim(data?.waybill) ||
      trim(data?.tracking_number)
    const courier =
      trim(data?.courier_company_service) ||
      trim(data?.courier_company) ||
      trim(data?.courier) ||
      'Shipmozo'
    return {
      status: Boolean(awb),
      data: {
        order_id: trim(data?.order_id),
        reference_id: trim(data?.reference_id),
        awb_number: awb,
        lr_number: trim(data?.lr_number),
        courier,
        courier_company: trim(data?.courier_company) || courier,
        courier_company_service: trim(data?.courier_company_service) || courier,
      },
      message: raw?.message,
      raw,
    }
  }

  private async finalizeShipment(orderId: string, courierId?: string | number) {
    let finalRaw: any = null
    if (courierId !== undefined && courierId !== null && trim(courierId)) {
      finalRaw = await this.assignCourier(orderId, courierId)
    } else {
      finalRaw = await this.autoAssignOrder(orderId)
    }

    let normalized = this.normalizeShipmentResponse(finalRaw)
    if (!normalized.data?.awb_number) {
      try {
        finalRaw = await this.schedulePickup(orderId)
        normalized = this.normalizeShipmentResponse(finalRaw)
      } catch (err: any) {
        this.log('Schedule pickup did not return AWB', {
          orderId,
          message: err?.message || err,
        })
      }
    }

    if (!normalized.data?.awb_number) {
      try {
        finalRaw = await this.getOrderDetail(orderId)
        normalized = this.normalizeShipmentResponse(finalRaw)
      } catch (err: any) {
        this.log('Order detail did not return AWB', {
          orderId,
          message: err?.message || err,
        })
      }
    }

    if (!normalized.data?.awb_number) {
      throw new HttpError(
        502,
        'Shipmozo order was pushed, but no AWB was returned by assign/schedule/order-detail APIs.',
      )
    }

    return normalized
  }

  async createShipment(payload: any): Promise<ShipmozoShipmentResponse> {
    const pushed = await this.pushOrder(payload)
    const orderId = trim(pushed.data?.order_id || pushed.data?.reference_id || payload.order_number)
    if (!orderId) throw new HttpError(502, 'Shipmozo push-order did not return an order_id.')
    return this.finalizeShipment(orderId, payload?.courier_id)
  }

  async createReverseShipment(payload: any): Promise<ShipmozoShipmentResponse> {
    const pushed = await this.pushReturnOrder(payload)
    const orderId = trim(
      pushed.data?.order_id ||
        pushed.data?.reference_id ||
        payload.return_order_id ||
        payload.order_number ||
        payload.order_id,
    )
    if (!orderId) {
      throw new HttpError(502, 'Shipmozo push-return-order did not return an order_id.')
    }
    return this.finalizeShipment(orderId, payload?.courier_id)
  }

  async cancelShipment(input: { orderId: string; awbNumber: string | number } | string) {
    const orderId = typeof input === 'string' ? '' : input.orderId
    const awbNumber = typeof input === 'string' ? input : input.awbNumber
    if (!orderId) {
      throw new HttpError(400, 'Shipmozo cancellation requires both order_id and awb_number.')
    }
    const raw = await this.post<any>('/cancel-order', {
      order_id: orderId,
      awb_number: toAwbPayloadValue(awbNumber),
    })
    return this.assertSuccess(raw, 'Shipmozo cancel order')
  }
}
