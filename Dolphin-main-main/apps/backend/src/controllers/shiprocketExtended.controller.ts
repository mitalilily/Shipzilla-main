import { Request, Response } from 'express'
import {
  loginShiprocket,
  checkCourierServiceability,
  getSelfServiceability,
  cancelOrders,
  getOrderDetails,
  listAllOrders,
  duplicateOrder,
  printOrderInvoice,
  deleteOrder,
  generateAwb,
  generateLabel,
  generatePickupManifest,
  exportShipments,
  listShipments,
  trackShipment,
  trackShipmentByOrderId,
  getPickupLocations,
  addPickupLocation,
  editPickupLocation,
  addAddress,
  getAddresses,
  listNdr,
  updateNdrAction,
  listRescheduledNdr,
  rescheduleNdr,
  registerWebhook,
  getWebhooks,
  listChannels,
  addChannel,
  generateInvoice,
  printInvoice,
  createCustomer,
  listCustomers,
  createReturnOrder,
  createReturnShipment,
  updateReturnOrder,
  createExchangeOrder,
  createForwardShipment,
  getRecommendedCouriers,
  schedulePickup,
  updatePickupAddress,
} from '../models/services/shiprocketExtended.service'

export const loginShiprocketController = async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : undefined
    const password = typeof req.body?.password === 'string' ? req.body.password : undefined
    const data = await loginShiprocket({ email, password })

    res.status(200).json({
      success: true,
      data,
    })
  } catch (err: any) {
    const message = err?.message || 'Failed to authenticate with Shiprocket'
    const statusCode = /not configured/i.test(message) ? 400 : 502
    res.status(statusCode).json({ success: false, error: message })
  }
}

// ──────────────────── COURIER / SERVICEABILITY ────────────────────

export const checkCourierServiceabilityController = async (req: Request, res: Response) => {
  try {
    const { pickup_postcode, delivery_postcode, order_id, cod, weight } = req.query as any

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    if (!pickup_postcode || !delivery_postcode) {
      return res.status(400).json({
        success: false,
        error: 'pickup_postcode and delivery_postcode are required',
      })
    }

    const hasOrderId = order_id !== undefined && order_id !== null && String(order_id).trim() !== ''
    const hasCodAndWeight =
      cod !== undefined &&
      cod !== null &&
      String(cod).trim() !== '' &&
      weight !== undefined &&
      weight !== null &&
      String(weight).trim() !== ''

    if (!hasOrderId && !hasCodAndWeight) {
      return res.status(400).json({
        success: false,
        error: 'Either order_id or both cod and weight are required',
      })
    }

    if (!/^\d+$/.test(String(pickup_postcode).trim()) || !/^\d+$/.test(String(delivery_postcode).trim())) {
      return res.status(400).json({
        success: false,
        error: 'pickup_postcode and delivery_postcode must be numeric',
      })
    }

    const mode = typeof req.query?.mode === 'string' ? req.query.mode.trim().toLowerCase() : ''
    if (mode && !['surface', 'air'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: "mode must be 'Surface' or 'Air'",
      })
    }

    const isReturn = String(req.query?.is_return ?? '').trim()
    if (isReturn && !['0', '1'].includes(isReturn)) {
      return res.status(400).json({
        success: false,
        error: 'is_return must be 0 or 1 when provided',
      })
    }

    if (hasCodAndWeight) {
      const normalizedCod = String(cod).trim().toLowerCase()
      if (!['0', '1', 'true', 'false'].includes(normalizedCod)) {
        return res.status(400).json({
          success: false,
          error: 'cod must be a boolean value',
        })
      }

      if (!isPositiveNumber(weight)) {
        return res.status(400).json({
          success: false,
          error: 'weight must be greater than 0',
        })
      }
    }

    const isNewHyperlocal = String(req.query?.is_new_hyperlocal ?? '').trim()
    if (isNewHyperlocal && !['0', '1', 'true', 'false'].includes(isNewHyperlocal.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'is_new_hyperlocal must be a boolean value when provided',
      })
    }

    const hyperlocalEnabled = ['1', 'true'].includes(isNewHyperlocal.toLowerCase())
    if (hyperlocalEnabled) {
      for (const field of ['lat_from', 'long_from', 'lat_to', 'long_to'] as const) {
        const rawValue = req.query?.[field]
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '' || !Number.isFinite(Number(rawValue))) {
          return res.status(400).json({
            success: false,
            error: `${field} is required and must be a valid number when is_new_hyperlocal is enabled`,
          })
        }
      }
    }

    for (const [field, min] of [
      ['length', 0],
      ['breadth', 0],
      ['height', 0],
      ['declared_value', 0],
    ] as const) {
      const rawValue = req.query?.[field]
      if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '' && !isPositiveNumber(rawValue, min)) {
        return res.status(400).json({
          success: false,
          error: `${field} must be greater than 0`,
        })
      }
    }

    const qcCheck = String(req.query?.qc_check ?? '').trim()
    if (qcCheck && !['0', '1'].includes(qcCheck)) {
      return res.status(400).json({
        success: false,
        error: 'qc_check must be 0 or 1',
      })
    }

    if (qcCheck && isReturn !== '1') {
      return res.status(400).json({
        success: false,
        error: 'is_return must be 1 when qc_check is provided',
      })
    }

    const data = await checkCourierServiceability(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getSelfServiceabilityController = async (req: Request, res: Response) => {
  try {
    const data = await getSelfServiceability(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── ORDERS ────────────────────

export const cancelOrdersController = async (req: Request, res: Response) => {
  try {
    const { ids, awbs } = req.body
    if ((!ids || !Array.isArray(ids) || ids.length === 0) && (!awbs || !Array.isArray(awbs) || awbs.length === 0)) {
      return res.status(400).json({ success: false, error: 'Provide ids to cancel' })
    }
    const data = await cancelOrders({ ids, awbs })
    if (data !== undefined) {
      // Shiprocket returns 204 No Content on success; mirror that contract.
      return res.status(204).end()
    }
    return res.status(204).end()
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getOrderDetailsController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await getOrderDetails(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const listAllOrdersController = async (req: Request, res: Response) => {
  try {
    const query = { ...(req.query as any) }
    if (typeof query.filterBy === 'string' && !query.filter_by) {
      query.filter_by = query.filterBy
    }
    if (typeof query.filterValue === 'string' && !query.filter) {
      query.filter = query.filterValue
    }

    const allowedFilterBy = new Set(['status', 'payment_method', 'delivery_country', 'channel_order_id'])
    if (query.filter_by && !allowedFilterBy.has(String(query.filter_by))) {
      return res.status(400).json({
        success: false,
        error: 'filter_by must be one of status, payment_method, delivery_country, or channel_order_id',
      })
    }

    if (query.filter && typeof query.filter !== 'string') {
      query.filter = String(query.filter)
    }

    const updatedFrom = typeof query.updated_from === 'string' ? query.updated_from : ''
    const updatedTo = typeof query.updated_to === 'string' ? query.updated_to : ''

    const normalizeDateStart = (value: string) => {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return null
      date.setHours(0, 0, 0, 0)
      return date
    }

    if (updatedTo && !updatedFrom) {
      return res.status(400).json({
        success: false,
        error: 'updated_from is required when updated_to is provided',
      })
    }

    if (updatedFrom) {
      const fromDate = normalizeDateStart(updatedFrom)
      if (!fromDate) {
        return res.status(400).json({
          success: false,
          error: 'Invalid updated_from date',
        })
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const oldestAllowedDate = new Date(today)
      oldestAllowedDate.setDate(oldestAllowedDate.getDate() - 30)

      if (fromDate < oldestAllowedDate) {
        return res.status(400).json({
          success: false,
          error: 'updated_from date should not be more than 30 days older than the current date',
        })
      }
    }

    if (updatedFrom && updatedTo) {
      const fromDate = normalizeDateStart(updatedFrom)
      const toDate = normalizeDateStart(updatedTo)

      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: 'Invalid updated date range',
        })
      }

      const differenceInDays =
        (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)

      if (!Number.isFinite(differenceInDays) || differenceInDays < 0) {
        return res.status(400).json({ success: false, error: 'Invalid updated date range' })
      }
      if (differenceInDays > 30) {
        return res.status(400).json({
          success: false,
          error: 'Difference between updated_from and updated_to must not exceed 30 days',
        })
      }
    }

    const data = await listAllOrders(query)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const duplicateOrderController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await duplicateOrder(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const printOrderInvoiceController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await printOrderInvoice(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const deleteOrderController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await deleteOrder(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── SHIPMENTS / AWB ────────────────────

export const generateAwbController = async (req: Request, res: Response) => {
  try {
    const { shipment_id, courier_id, is_return } = req.body
    if (!shipment_id || !courier_id) {
      return res.status(400).json({ success: false, error: 'shipment_id and courier_id are required' })
    }
    const data = await generateAwb({ shipment_id, courier_id, is_return })
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const generateLabelController = async (req: Request, res: Response) => {
  try {
    const shipmentIds = Array.isArray(req.body?.shipment_id)
      ? req.body.shipment_id.filter((value: unknown) => String(value ?? '').trim())
      : []

    if (shipmentIds.length === 0) {
      return res.status(400).json({ success: false, error: 'shipment_id must be a non-empty array' })
    }

    const payload = {
      shipment_id: shipmentIds,
      ...(req.body?.is_return !== undefined ? { is_return: req.body.is_return } : {}),
    }

    const data = await generateLabel(payload)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const generatePickupManifestController = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.body
    if (!shipment_id || !Array.isArray(shipment_id)) {
      return res.status(400).json({ success: false, error: 'shipment_id array is required' })
    }
    const data = await generatePickupManifest({ shipment_id })
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const exportShipmentsController = async (req: Request, res: Response) => {
  try {
    const data = await exportShipments(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const listShipmentsController = async (req: Request, res: Response) => {
  try {
    const data = await listShipments(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── TRACKING ────────────────────

export const trackShipmentController = async (req: Request, res: Response) => {
  try {
    const awb = typeof req.query?.awb === 'string' ? req.query.awb.trim() : ''
    const orderId = typeof req.query?.order_id === 'string' ? req.query.order_id.trim() : ''
    const channelId =
      typeof req.query?.channel_id === 'string' && req.query.channel_id.trim()
        ? req.query.channel_id.trim()
        : undefined

    if (!awb && !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Either awb or order_id is required',
      })
    }

    const data = await trackShipment({
      ...(awb ? { awb } : {}),
      ...(orderId ? { order_id: orderId } : {}),
      ...(channelId ? { channel_id: channelId } : {}),
    })
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const trackShipmentByOrderIdController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await trackShipmentByOrderId(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── PICKUP LOCATIONS ────────────────────

export const getPickupLocationsController = async (req: Request, res: Response) => {
  try {
    const data = await getPickupLocations()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const addPickupLocationController = async (req: Request, res: Response) => {
  try {
    const {
      pickup_location,
      name,
      email,
      phone,
      address,
      address_2,
      city,
      state,
      country,
      pin_code,
      lat,
      long,
      address_type,
      vendor_name,
    } = req.body || {}

    if (
      !pickup_location ||
      !name ||
      !email ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !country ||
      !pin_code
    ) {
      return res.status(400).json({
        success: false,
        error:
          'pickup_location, name, email, phone, address, city, state, country and pin_code are required',
      })
    }

    const normalizedPickupLocation = String(pickup_location).trim()
    if (!normalizedPickupLocation || normalizedPickupLocation.length > 36) {
      return res.status(400).json({
        success: false,
        error: 'pickup_location must be 36 characters or fewer',
      })
    }

    if (String(address).trim().length > 80) {
      return res.status(400).json({
        success: false,
        error: 'address must be 80 characters or fewer',
      })
    }

    const normalizedAddressType = typeof address_type === 'string' ? address_type.trim() : ''
    if (normalizedAddressType && normalizedAddressType !== 'vendor') {
      return res.status(400).json({
        success: false,
        error: "address_type must be 'vendor' when provided",
      })
    }

    if (normalizedAddressType === 'vendor' && !String(vendor_name ?? '').trim()) {
      return res.status(400).json({
        success: false,
        error: 'vendor_name is required when address_type is vendor',
      })
    }

    for (const [field, value] of [
      ['lat', lat],
      ['long', long],
    ] as const) {
      if (value !== undefined && value !== null && String(value).trim() !== '' && !Number.isFinite(Number(value))) {
        return res.status(400).json({
          success: false,
          error: `${field} must be a valid number`,
        })
      }
    }

    const data = await addPickupLocation(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const editPickupLocationController = async (req: Request, res: Response) => {
  try {
    const data = await editPickupLocation(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── ADDRESSES ────────────────────

export const addAddressController = async (req: Request, res: Response) => {
  try {
    const data = await addAddress(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getAddressesController = async (req: Request, res: Response) => {
  try {
    const data = await getAddresses()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── NDR ────────────────────

export const listNdrController = async (req: Request, res: Response) => {
  try {
    const data = await listNdr(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const updateNdrActionController = async (req: Request, res: Response) => {
  try {
    const data = await updateNdrAction(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const listRescheduledNdrController = async (req: Request, res: Response) => {
  try {
    const data = await listRescheduledNdr()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const rescheduleNdrController = async (req: Request, res: Response) => {
  try {
    const data = await rescheduleNdr(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── WEBHOOKS ────────────────────

export const registerWebhookController = async (req: Request, res: Response) => {
  try {
    const data = await registerWebhook(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getWebhooksController = async (req: Request, res: Response) => {
  try {
    const data = await getWebhooks()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── CHANNELS ────────────────────

export const listChannelsController = async (req: Request, res: Response) => {
  try {
    const data = await listChannels()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const addChannelController = async (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const brandName = typeof req.body?.brand_name === 'string' ? req.body.brand_name.trim() : ''

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }

    if (name.length > 12) {
      return res.status(400).json({ success: false, error: 'name must be 12 characters or fewer' })
    }

    if (brandName.length > 50) {
      return res.status(400).json({ success: false, error: 'brand_name must be 50 characters or fewer' })
    }

    const data = await addChannel({
      name,
      ...(brandName ? { brand_name: brandName } : {}),
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── INVOICE ────────────────────

export const generateInvoiceController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await generateInvoice(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const printInvoiceController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId)
    if (isNaN(orderId)) return res.status(400).json({ success: false, error: 'Invalid order ID' })
    const data = await printInvoice(orderId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── CUSTOMERS ────────────────────

export const createCustomerController = async (req: Request, res: Response) => {
  try {
    const data = await createCustomer(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const listCustomersController = async (req: Request, res: Response) => {
  try {
    const data = await listCustomers(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── RETURNS ────────────────────

export const createReturnOrderController = async (req: Request, res: Response) => {
  try {
    const normalizeBooleanFlag = (value: unknown) => {
      if ([true, 1, '1', 'true', 'True', 'TRUE'].includes(value as any)) return true
      if ([false, 0, '0', 'false', 'False', 'FALSE', '', null, undefined].includes(value as any)) return false
      return null
    }

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    const {
      order_id,
      order_date,
      pickup_customer_name,
      pickup_address,
      pickup_city,
      pickup_state,
      pickup_country,
      pickup_pincode,
      pickup_email,
      pickup_phone,
      shipping_customer_name,
      shipping_address,
      shipping_city,
      shipping_country,
      shipping_pincode,
      shipping_state,
      shipping_phone,
      order_items,
      payment_method,
      sub_total,
      length,
      breadth,
      height,
      weight,
    } = req.body || {}

    if (
      !order_id ||
      !order_date ||
      !pickup_customer_name ||
      !pickup_address ||
      !pickup_city ||
      !pickup_state ||
      !pickup_country ||
      !pickup_pincode ||
      !pickup_email ||
      !pickup_phone ||
      !shipping_customer_name ||
      !shipping_address ||
      !shipping_city ||
      !shipping_country ||
      !shipping_pincode ||
      !shipping_state ||
      !shipping_phone ||
      !Array.isArray(order_items) ||
      !payment_method ||
      sub_total === undefined ||
      length === undefined ||
      breadth === undefined ||
      height === undefined ||
      weight === undefined
    ) {
      return res.status(400).json({
        success: false,
        error:
          'order_id, order_date, pickup_customer_name, pickup_address, pickup_city, pickup_state, pickup_country, pickup_pincode, pickup_email, pickup_phone, shipping_customer_name, shipping_address, shipping_city, shipping_country, shipping_pincode, shipping_state, shipping_phone, order_items, payment_method, sub_total, length, breadth, height and weight are required',
      })
    }

    if (String(order_id).trim().length > 50) {
      return res.status(400).json({
        success: false,
        error: 'order_id must be 50 characters or fewer',
      })
    }

    if (Number.isNaN(new Date(String(order_date)).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'order_date must be a valid date',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (normalizedPaymentMethod !== 'prepaid') {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'Prepaid'",
      })
    }

    if (!Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_items must be a non-empty array',
      })
    }

    const invalidOrderItem = order_items.find((item: any) => {
      if (!item || typeof item !== 'object') return true
      if (!String(item.name || '').trim()) return true
      if (!String(item.sku || '').trim()) return true
      if (!isPositiveNumber(item.units)) return true
      if (!isPositiveNumber(item.selling_price, -1)) return true

      const qcEnabled = normalizeBooleanFlag(item.qc_enable)
      if (qcEnabled === null) return true
      if (qcEnabled) {
        if (!String(item.qc_product_name || '').trim()) return true
        if (!String(item.qc_product_image || '').trim()) return true
      }

      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error:
          'Each order item must include name, sku, units, selling_price, and valid QC fields when qc_enable is true',
      })
    }

    const qcEnabledItemsCount = order_items.filter(
      (item: any) => normalizeBooleanFlag(item?.qc_enable) === true,
    ).length
    if (qcEnabledItemsCount > 1) {
      return res.status(400).json({
        success: false,
        error: 'QC can only be enabled for a single SKU per return order',
      })
    }

    if (
      !isPositiveNumber(weight) ||
      !isPositiveNumber(length) ||
      !isPositiveNumber(breadth) ||
      !isPositiveNumber(height)
    ) {
      return res.status(400).json({
        success: false,
        error: 'length, breadth, height and weight must be greater than 0',
      })
    }

    const data = await createReturnOrder({
      ...req.body,
      payment_method: 'Prepaid',
    })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── RECOMMENDED COURIERS ────────────────────

export const createReturnShipmentController = async (req: Request, res: Response) => {
  try {
    const normalizeBooleanFlag = (value: unknown) => {
      if ([true, 1, '1', 'true', 'True', 'TRUE'].includes(value as any)) return true
      if ([false, 0, '0', 'false', 'False', 'FALSE', '', null, undefined].includes(value as any)) return false
      return null
    }

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    const {
      order_id,
      order_date,
      pickup_customer_name,
      pickup_address,
      pickup_city,
      pickup_state,
      pickup_country,
      pickup_pincode,
      pickup_email,
      pickup_phone,
      shipping_customer_name,
      shipping_address,
      shipping_city,
      shipping_country,
      shipping_pincode,
      shipping_state,
      shipping_email,
      shipping_phone,
      order_items,
      payment_method,
      sub_total,
      length,
      breadth,
      height,
      weight,
      request_pickup,
    } = req.body || {}

    if (
      !order_id ||
      !order_date ||
      !pickup_customer_name ||
      !pickup_address ||
      !pickup_city ||
      !pickup_state ||
      !pickup_country ||
      !pickup_pincode ||
      !pickup_email ||
      !pickup_phone ||
      !shipping_customer_name ||
      !shipping_address ||
      !shipping_city ||
      !shipping_country ||
      !shipping_pincode ||
      !shipping_state ||
      !shipping_email ||
      !shipping_phone ||
      !Array.isArray(order_items) ||
      !payment_method ||
      sub_total === undefined ||
      length === undefined ||
      breadth === undefined ||
      height === undefined ||
      weight === undefined
    ) {
      return res.status(400).json({
        success: false,
        error:
          'order_id, order_date, pickup_customer_name, pickup_address, pickup_city, pickup_state, pickup_country, pickup_pincode, pickup_email, pickup_phone, shipping_customer_name, shipping_address, shipping_city, shipping_country, shipping_pincode, shipping_state, shipping_email, shipping_phone, order_items, payment_method, sub_total, length, breadth, height and weight are required',
      })
    }

    if (String(order_id).trim().length > 50) {
      return res.status(400).json({
        success: false,
        error: 'order_id must be 50 characters or fewer',
      })
    }

    const parsedOrderDate = new Date(String(order_date))
    if (Number.isNaN(parsedOrderDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'order_date must be a valid date',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (!['cod', 'prepaid'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'COD' or 'Prepaid'",
      })
    }

    if (!Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_items must be a non-empty array',
      })
    }

    const invalidOrderItem = order_items.find((item: any) => {
      if (!item || typeof item !== 'object') return true

      const qcEnabled = normalizeBooleanFlag(item.qc_enable)

      if (
        !String(item.name ?? '').trim() ||
        !String(item.sku ?? '').trim() ||
        !Number.isInteger(Number(item.units)) ||
        Number(item.units) <= 0 ||
        !isPositiveNumber(item.selling_price)
      ) {
        return true
      }

      if (item.qc_enable !== undefined && qcEnabled === null) {
        return true
      }

      if (
        qcEnabled &&
        (!String(item.qc_product_name ?? '').trim() || !String(item.qc_product_image ?? '').trim())
      ) {
        return true
      }

      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error:
          'each order_items entry must include name, sku, units, selling_price, and qc_product_name/qc_product_image when qc_enable is true',
      })
    }

    const qcEnabledItemsCount = order_items.filter(
      (item: any) => normalizeBooleanFlag(item?.qc_enable) === true,
    ).length

    if (qcEnabledItemsCount > 1) {
      return res.status(400).json({
        success: false,
        error: 'QC can only be enabled for a single SKU per return shipment',
      })
    }

    if (
      !isPositiveNumber(sub_total) ||
      !isPositiveNumber(weight) ||
      !isPositiveNumber(length) ||
      !isPositiveNumber(breadth) ||
      !isPositiveNumber(height)
    ) {
      return res.status(400).json({
        success: false,
        error: 'sub_total, length, breadth, height and weight must be greater than 0',
      })
    }

    const requestPickup = request_pickup === undefined ? true : normalizeBooleanFlag(request_pickup)
    if (requestPickup === null) {
      return res.status(400).json({
        success: false,
        error: 'request_pickup must be a boolean value',
      })
    }

    const normalizedOrderItems = order_items.map((item: any) => {
      const normalizedQcEnable = normalizeBooleanFlag(item.qc_enable)

      return normalizedQcEnable === null
        ? item
        : {
            ...item,
            qc_enable: normalizedQcEnable,
          }
    })

    const data = await createReturnShipment({
      ...req.body,
      payment_method:
        normalizedPaymentMethod === 'cod'
          ? 'COD'
          : normalizedPaymentMethod === 'prepaid'
            ? 'Prepaid'
            : payment_method,
      request_pickup: requestPickup,
      order_items: normalizedOrderItems,
    })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const updateReturnOrderController = async (req: Request, res: Response) => {
  try {
    const { order_id, action, length, breadth, height, weight, return_warehouse_id } =
      req.body || {}

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    const actions = Array.isArray(action)
      ? action.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
      : []

    if (!order_id || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_id and action are required',
      })
    }

    const allowedActions = ['product_details', 'warehouse_address']
    const invalidAction = actions.find((value) => !allowedActions.includes(value))
    if (invalidAction) {
      return res.status(400).json({
        success: false,
        error: "action must contain only 'product_details' or 'warehouse_address'",
      })
    }

    const requiresProductDetails = actions.includes('product_details')
    const requiresWarehouseAddress = actions.includes('warehouse_address')

    if (
      (requiresProductDetails &&
        (length === undefined ||
          breadth === undefined ||
          height === undefined ||
          weight === undefined)) ||
      (requiresWarehouseAddress && return_warehouse_id === undefined)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'length, breadth, height and weight are required for product_details; return_warehouse_id is required for warehouse_address',
        })
      }

    if (
      requiresProductDetails &&
      (!isPositiveNumber(length, 0.5) ||
        !isPositiveNumber(breadth, 0.5) ||
        !isPositiveNumber(height, 0.5) ||
        !isPositiveNumber(weight))
    ) {
      return res.status(400).json({
        success: false,
        error: 'length, breadth and height must be greater than 0.5, and weight must be greater than 0',
      })
    }

    if (
      requiresWarehouseAddress &&
      (!Number.isInteger(Number(return_warehouse_id)) || Number(return_warehouse_id) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        error: 'return_warehouse_id must be a positive integer',
      })
    }

    const data = await updateReturnOrder({
      order_id,
      action: actions,
      ...(length !== undefined ? { length } : {}),
      ...(breadth !== undefined ? { breadth } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(weight !== undefined ? { weight } : {}),
      ...(return_warehouse_id !== undefined ? { return_warehouse_id } : {}),
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const createExchangeOrderController = async (req: Request, res: Response) => {
  try {
    const normalizeBooleanFlag = (value: unknown) => {
      if ([true, 1, '1', 'true', 'True', 'TRUE'].includes(value as any)) return true
      if ([false, 0, '0', 'false', 'False', 'FALSE', '', null, undefined].includes(value as any)) return false
      return null
    }

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    const {
      exchange_order_id,
      seller_pickup_location_id,
      seller_shipping_location_id,
      return_order_id,
      order_date,
      payment_method,
      buyer_shipping_first_name,
      buyer_shipping_address,
      buyer_shipping_city,
      buyer_shipping_state,
      buyer_shipping_country,
      buyer_shipping_pincode,
      buyer_shipping_phone,
      buyer_pickup_first_name,
      buyer_pickup_address,
      buyer_pickup_city,
      buyer_pickup_state,
      buyer_pickup_country,
      buyer_pickup_pincode,
      buyer_pickup_phone,
      order_items,
      sub_total,
      return_length,
      return_breadth,
      return_height,
      return_weight,
      exchange_length,
      exchange_breadth,
      exchange_height,
      exchange_weight,
      return_reason,
    } = req.body || {}

    if (
      !exchange_order_id ||
      !seller_pickup_location_id ||
      !seller_shipping_location_id ||
      !return_order_id ||
      !order_date ||
      !payment_method ||
      !buyer_shipping_first_name ||
      !buyer_shipping_address ||
      !buyer_shipping_city ||
      !buyer_shipping_state ||
      !buyer_shipping_country ||
      !buyer_shipping_pincode ||
      !buyer_shipping_phone ||
      !buyer_pickup_first_name ||
      !buyer_pickup_address ||
      !buyer_pickup_city ||
      !buyer_pickup_state ||
      !buyer_pickup_country ||
      !buyer_pickup_pincode ||
      !buyer_pickup_phone ||
      !Array.isArray(order_items) ||
      order_items.length === 0 ||
      sub_total === undefined ||
      return_length === undefined ||
      return_breadth === undefined ||
      return_height === undefined ||
      return_weight === undefined ||
      exchange_length === undefined ||
      exchange_breadth === undefined ||
      exchange_height === undefined ||
      exchange_weight === undefined ||
      !return_reason
    ) {
      return res.status(400).json({
        success: false,
        error:
          'exchange_order_id, seller_pickup_location_id, seller_shipping_location_id, return_order_id, order_date, payment_method, buyer_shipping_first_name, buyer_shipping_address, buyer_shipping_city, buyer_shipping_state, buyer_shipping_country, buyer_shipping_pincode, buyer_shipping_phone, buyer_pickup_first_name, buyer_pickup_address, buyer_pickup_city, buyer_pickup_state, buyer_pickup_country, buyer_pickup_pincode, buyer_pickup_phone, order_items, sub_total, return_length, return_breadth, return_height, return_weight, exchange_length, exchange_breadth, exchange_height, exchange_weight and return_reason are required',
      })
    }

    if (String(exchange_order_id).trim().length > 50) {
      return res.status(400).json({
        success: false,
        error: 'exchange_order_id must be 50 characters or fewer',
      })
    }

    if (!String(seller_pickup_location_id).trim() || !String(seller_shipping_location_id).trim()) {
      return res.status(400).json({
        success: false,
        error: 'seller_pickup_location_id and seller_shipping_location_id must be non-empty strings',
      })
    }

    if (!String(return_order_id).trim()) {
      return res.status(400).json({
        success: false,
        error: 'return_order_id is required',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (normalizedPaymentMethod !== 'prepaid') {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'prepaid'",
      })
    }

    const parsedOrderDate = new Date(String(order_date))
    if (Number.isNaN(parsedOrderDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'order_date must be a valid date',
      })
    }

    const invalidOrderItem = order_items.find((item: any) => {
      if (!item || typeof item !== 'object') return true

      const qcEnabled = normalizeBooleanFlag(item.qc_enable)

      if (
        !String(item.name ?? '').trim() ||
        !String(item.hsn ?? '').trim() ||
        !String(item.sku ?? '').trim() ||
        !String(item.exchange_item_name ?? '').trim() ||
        !String(item.exchange_item_sku ?? '').trim() ||
        !isPositiveNumber(item.selling_price) ||
        !Number.isInteger(Number(item.units)) ||
        Number(item.units) <= 0
      ) {
        return true
      }

      if (item.qc_enable !== undefined && qcEnabled === null) {
        return true
      }

      if (
        qcEnabled &&
        (!String(item.qc_product_name ?? '').trim() || !String(item.qc_product_image ?? '').trim())
      ) {
        return true
      }

      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error:
          'each order_items entry must include name, hsn, sku, exchange_item_name, exchange_item_sku, units, selling_price, and qc_product_name/qc_product_image when qc_enable is true',
      })
    }

    const qcEnabledItemsCount = order_items.filter(
      (item: any) => normalizeBooleanFlag(item?.qc_enable) === true,
    ).length

    if (qcEnabledItemsCount > 1) {
      return res.status(400).json({
        success: false,
        error: 'QC can only be enabled for a single SKU per exchange order',
      })
    }

    if (
      !isPositiveNumber(sub_total) ||
      !isPositiveNumber(return_length) ||
      !isPositiveNumber(return_breadth) ||
      !isPositiveNumber(return_height) ||
      !isPositiveNumber(return_weight) ||
      !isPositiveNumber(exchange_length) ||
      !isPositiveNumber(exchange_breadth) ||
      !isPositiveNumber(exchange_height) ||
      !isPositiveNumber(exchange_weight)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'sub_total, return_length, return_breadth, return_height, return_weight, exchange_length, exchange_breadth, exchange_height and exchange_weight must be greater than 0',
      })
    }

    const normalizedOrderItems = order_items.map((item: any) => {
      const normalizedQcEnable = normalizeBooleanFlag(item.qc_enable)

      return normalizedQcEnable === null
        ? item
        : {
            ...item,
            qc_enable: normalizedQcEnable,
          }
    })

    const data = await createExchangeOrder({
      ...req.body,
      payment_method: 'prepaid',
      order_items: normalizedOrderItems,
    })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const createForwardShipmentController = async (req: Request, res: Response) => {
  try {
    const normalizeBooleanFlag = (value: unknown) => {
      if ([true, 1, '1', 'true', 'True', 'TRUE'].includes(value as any)) return true
      if ([false, 0, '0', 'false', 'False', 'FALSE'].includes(value as any)) return false
      return null
    }

    const isPositiveNumber = (value: unknown, min = 0) => {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) && numericValue > min
    }

    const {
      mode,
      request_pickup,
      print_label,
      generate_manifest,
      order_id,
      order_date,
      billing_customer_name,
      billing_address,
      billing_city,
      billing_state,
      billing_country,
      billing_pincode,
      billing_email,
      billing_phone,
      shipping_is_billing,
      order_items,
      payment_method,
      sub_total,
      weight,
      length,
      breadth,
      height,
      pickup_location,
      vendor_details,
      order_type,
    } = req.body || {}

    const shippingIsBilling = normalizeBooleanFlag(shipping_is_billing)
    const requestPickup = request_pickup === undefined ? true : normalizeBooleanFlag(request_pickup)
    const printLabel = print_label === undefined ? true : normalizeBooleanFlag(print_label)
    const generateManifestFlag =
      generate_manifest === undefined ? true : normalizeBooleanFlag(generate_manifest)

    if (shippingIsBilling === null) {
      return res.status(400).json({
        success: false,
        error: 'shipping_is_billing must be a boolean value',
      })
    }

    for (const [field, value] of [
      ['request_pickup', requestPickup],
      ['print_label', printLabel],
      ['generate_manifest', generateManifestFlag],
    ] as const) {
      if (value === null) {
        return res.status(400).json({
          success: false,
          error: `${field} must be a boolean value`,
        })
      }
    }

    if (mode !== undefined) {
      const normalizedMode = String(mode).trim().toLowerCase()
      if (normalizedMode && !['surface', 'air'].includes(normalizedMode)) {
        return res.status(400).json({
          success: false,
          error: "mode must be 'Surface' or 'Air'",
        })
      }
    }

    const parsedOrderDate = new Date(String(order_date ?? ''))
    if (Number.isNaN(parsedOrderDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'order_date must be a valid date',
      })
    }

    if (order_type !== undefined) {
      const normalizedOrderType = String(order_type).trim()
      if (normalizedOrderType && !['ESSENTIALS', 'NON ESSENTIALS'].includes(normalizedOrderType)) {
        return res.status(400).json({
          success: false,
          error: "order_type must be 'ESSENTIALS' or 'NON ESSENTIALS'",
        })
      }
    }

    if (!Array.isArray(order_items) || order_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_items must be a non-empty array',
      })
    }

    const invalidOrderItem = order_items.find((item: any) => {
      if (!item || typeof item !== 'object') return true
      if (!String(item.name || '').trim()) return true
      if (!String(item.sku || '').trim()) return true
      if (!isPositiveNumber(item.units)) return true
      if (!isPositiveNumber(item.selling_price, -1)) return true
      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error:
          'Each order item must include name, sku, units, and selling_price',
      })
    }

    if (!isPositiveNumber(weight) || !isPositiveNumber(length, 0.5) || !isPositiveNumber(breadth, 0.5) || !isPositiveNumber(height, 0.5)) {
      return res.status(400).json({
        success: false,
        error: 'weight must be greater than 0 and dimensions must be greater than 0.5',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (normalizedPaymentMethod && !['cod', 'prepaid'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'COD' or 'Prepaid'",
      })
    }

    const shippingDetailsRequired = !shippingIsBilling

    if (
      !order_id ||
      !order_date ||
      !billing_customer_name ||
      !billing_address ||
      !billing_city ||
      !billing_state ||
      !billing_country ||
      !billing_pincode ||
      !billing_email ||
      !billing_phone ||
      !Array.isArray(order_items) ||
      !payment_method ||
      sub_total === undefined ||
      weight === undefined ||
      length === undefined ||
      breadth === undefined ||
      height === undefined ||
      !pickup_location
    ) {
      return res.status(400).json({
        success: false,
        error:
          'order_id, order_date, billing_customer_name, billing_address, billing_city, billing_state, billing_country, billing_pincode, billing_email, billing_phone, shipping_is_billing, order_items, payment_method, sub_total, weight, length, breadth, height and pickup_location are required',
      })
    }

    if (
      shippingDetailsRequired &&
      (!req.body?.shipping_customer_name ||
        !req.body?.shipping_address ||
        !req.body?.shipping_city ||
        !req.body?.shipping_state ||
        !req.body?.shipping_country ||
        !req.body?.shipping_pincode ||
        !req.body?.shipping_email ||
        !req.body?.shipping_phone)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'shipping_customer_name, shipping_address, shipping_city, shipping_state, shipping_country, shipping_pincode, shipping_email and shipping_phone are required when shipping_is_billing is false',
      })
    }

    if (vendor_details !== undefined) {
      if (!vendor_details || typeof vendor_details !== 'object' || Array.isArray(vendor_details)) {
        return res.status(400).json({
          success: false,
          error: 'vendor_details must be an object when provided',
        })
      }

      const requiredVendorFields = [
        'email',
        'phone',
        'name',
        'address',
        'city',
        'state',
        'country',
        'pin_code',
        'pickup_location',
      ]

      const missingVendorField = requiredVendorFields.find(
        (field) => !String(vendor_details[field] ?? '').trim(),
      )

      if (missingVendorField) {
        return res.status(400).json({
          success: false,
          error: `vendor_details.${missingVendorField} is required when vendor_details is provided`,
        })
      }

      if (String(vendor_details.address || '').trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'vendor_details.address must be at least 10 characters long',
        })
      }

      if (
        vendor_details.address_2 !== undefined &&
        String(vendor_details.address_2 || '').trim() &&
        String(vendor_details.address_2 || '').trim().length < 10
      ) {
        return res.status(400).json({
          success: false,
          error: 'vendor_details.address_2 must be at least 10 characters long when provided',
        })
      }

      const vendorPickupLocation = String(vendor_details.pickup_location || '').trim()
      if (!/^[a-z0-9 ]{1,36}$/i.test(vendorPickupLocation)) {
        return res.status(400).json({
          success: false,
          error: 'vendor_details.pickup_location must be alphanumeric and 36 characters or fewer',
        })
      }

      if (vendorPickupLocation !== String(pickup_location || '').trim()) {
        return res.status(400).json({
          success: false,
          error: 'pickup_location must match vendor_details.pickup_location when vendor_details is provided',
        })
      }
    }

    const normalizedPayload = {
      ...req.body,
      shipping_is_billing: shippingIsBilling,
      request_pickup: requestPickup,
      print_label: printLabel,
      generate_manifest: generateManifestFlag,
      payment_method:
        normalizedPaymentMethod === 'cod'
          ? 'COD'
          : normalizedPaymentMethod === 'prepaid'
            ? 'Prepaid'
            : payment_method,
      ...(mode !== undefined
        ? {
            mode:
              String(mode).trim().toLowerCase() === 'surface'
                ? 'Surface'
                : String(mode).trim().toLowerCase() === 'air'
                  ? 'Air'
                  : mode,
          }
        : {}),
    }

    const data = await createForwardShipment(normalizedPayload)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const getRecommendedCouriersController = async (req: Request, res: Response) => {
  try {
    const data = await getRecommendedCouriers(req.query as any)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── PICKUP ────────────────────

export const schedulePickupController = async (req: Request, res: Response) => {
  try {
    const data = await schedulePickup(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export const updatePickupAddressController = async (req: Request, res: Response) => {
  try {
    const { pickupId } = req.params
    if (!pickupId) return res.status(400).json({ success: false, error: 'pickupId is required' })
    const data = await updatePickupAddress(pickupId, req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}
