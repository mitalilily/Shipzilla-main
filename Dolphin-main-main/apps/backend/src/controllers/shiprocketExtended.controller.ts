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
  createExchangeOrder,
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
    const { shipment_id, awb_number, is_return } = req.body
    if (!shipment_id || !awb_number) {
      return res.status(400).json({ success: false, error: 'shipment_id and awb_number are required' })
    }
    const data = await generateLabel({ shipment_id, awb_number, is_return })
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
    const { awb } = req.query
    if (!awb) return res.status(400).json({ success: false, error: 'AWB number is required' })
    const data = await trackShipment(String(awb))
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
    const data = await addChannel(req.body)
    res.json({ success: true, data })
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

    const data = await createReturnOrder(req.body)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── RECOMMENDED COURIERS ────────────────────

export const createExchangeOrderController = async (req: Request, res: Response) => {
  try {
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

    const data = await createExchangeOrder(req.body)
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
