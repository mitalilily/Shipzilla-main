import { Request, Response, Router } from 'express'
import {
  loginShiprocketController,
  checkCourierServiceabilityController,
  getSelfServiceabilityController,
  cancelOrdersController,
  getOrderDetailsController,
  listAllOrdersController,
  duplicateOrderController,
  printOrderInvoiceController,
  deleteOrderController,
  generateAwbController,
  generateLabelController,
  generatePickupManifestController,
  exportShipmentsController,
  listShipmentsController,
  trackShipmentController,
  trackShipmentByOrderIdController,
  getPickupLocationsController,
  addPickupLocationController,
  editPickupLocationController,
  addAddressController,
  getAddressesController,
  listNdrController,
  updateNdrActionController,
  listRescheduledNdrController,
  rescheduleNdrController,
  registerWebhookController,
  getWebhooksController,
  listChannelsController,
  addChannelController,
  generateInvoiceController,
  printInvoiceController,
  createCustomerController,
  listCustomersController,
  createReturnOrderController,
  getRecommendedCouriersController,
  schedulePickupController,
  updatePickupAddressController,
} from '../controllers/shiprocketExtended.controller'
import {
  assignAwbToShipment,
  createChannelSpecificOrder,
  createCustomOrder,
  importOrdersBulk,
  logoutShiprocket,
  listCouriersWithCounts,
  exportOrders,
  getBlockedPincodes,
  requestShipmentPickup,
  updateBlockedPincodes,
  updateOrderPickupLocation,
  updateCustomerDeliveryAddress,
  updateCustomOrder,
  listReturnOrders,
  fulfillOrderedProducts,
  mapUnmappedProducts,
} from '../models/services/shiprocketExtended.service'
import { requireAuth } from '../middlewares/requireAuth'
import { upload } from '../middlewares/upload'

const router = Router()

router.post('/auth/login', loginShiprocketController)
router.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const bearerHeader = req.headers.authorization || (req.headers as any).Authorization
    const headerToken =
      typeof bearerHeader === 'string' && bearerHeader.toLowerCase().startsWith('bearer ')
        ? bearerHeader.slice(7).trim()
        : undefined
    const bodyToken = typeof req.body?.token === 'string' ? req.body.token.trim() : undefined
    const data = await logoutShiprocket(headerToken || bodyToken)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    const message = err?.message || 'Failed to logout from Shiprocket'
    const statusCode = /no shiprocket token/i.test(message) ? 400 : 502
    res.status(statusCode).json({ success: false, error: message })
  }
})
router.post('/orders/create/adhoc', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await createCustomOrder(req.body)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/create/channel-specific', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await createChannelSpecificOrder(req.body)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/courier/assign/awb', requireAuth, async (req: Request, res: Response) => {
  try {
    const { shipment_id, courier_id, status } = req.body || {}
    if (!shipment_id) {
      return res.status(400).json({
        success: false,
        error: 'shipment_id is required',
      })
    }

    const data = await assignAwbToShipment({
      shipment_id,
      ...(courier_id !== undefined ? { courier_id } : {}),
      ...(typeof status === 'string' && status.trim() ? { status: status.trim() } : {}),
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/courier/courierListWithCounts', requireAuth, async (req: Request, res: Response) => {
  try {
    const type = typeof req.query?.type === 'string' ? req.query.type.trim() : undefined
    if (type && !['active', 'inactive', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "type must be 'active', 'inactive', or 'all'",
      })
    }

    const data = await listCouriersWithCounts(type ? { type: type as 'active' | 'inactive' | 'all' } : undefined)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/blocked-pincodes/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action.trim().toLowerCase() : ''
    const deliveryBlocked = req.body?.postcode?.delivery_blocked

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "action must be 'block' or 'unblock'",
      })
    }

    if (!Array.isArray(deliveryBlocked) || deliveryBlocked.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'postcode.delivery_blocked must be a non-empty array',
      })
    }

    const pincodes = deliveryBlocked
      .map((value: unknown) => String(value ?? '').trim())
      .filter(Boolean)

    if (pincodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'postcode.delivery_blocked must contain at least one valid pincode',
      })
    }

    const data = await updateBlockedPincodes({
      postcode: {
        delivery_blocked: pincodes,
      },
      action,
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/blocked-pincodes/get', requireAuth, async (req: Request, res: Response) => {
  try {
    const isDownload = String(req.query?.is_download ?? '').trim() === '1'
    const search = typeof req.query?.search === 'string' ? req.query.search.trim() : ''
    const perPage = typeof req.query?.per_page === 'string' ? req.query.per_page.trim() : ''
    const currentPage =
      typeof req.query?.current_page === 'string' ? req.query.current_page.trim() : ''

    const params = isDownload
      ? { is_download: 1 }
      : search
        ? { search }
        : {
            ...(perPage ? { per_page: perPage } : {}),
            ...(currentPage ? { current_page: currentPage } : {}),
          }

    const data = await getBlockedPincodes(params)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/update/adhoc', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      order_id,
      order_date,
      billing_customer_name,
      billing_address,
      billing_city,
      billing_pincode,
      billing_state,
      billing_country,
      billing_email,
      billing_phone,
      shipping_is_billing,
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
      !billing_customer_name ||
      !billing_address ||
      !billing_city ||
      !billing_pincode ||
      !billing_state ||
      !billing_country ||
      !billing_email ||
      !billing_phone ||
      shipping_is_billing === undefined ||
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
          'order_id, order_date, billing_customer_name, billing_address, billing_city, billing_pincode, billing_state, billing_country, billing_email, billing_phone, shipping_is_billing, order_items, payment_method, sub_total, length, breadth, height and weight are required',
      })
    }

    const data = await updateCustomOrder(req.body)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/export', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await exportOrders()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/courier/generate/pickup', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipmentIds = req.body?.shipment_id
    const isArray = Array.isArray(shipmentIds)
    const normalizedIds = isArray ? shipmentIds.filter(Boolean) : shipmentIds ? [shipmentIds] : []

    if (normalizedIds.length !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Exactly one shipment_id is required',
      })
    }

    const status = typeof req.body?.status === 'string' ? req.body.status.trim() : undefined
    const pickupDate = Array.isArray(req.body?.pickup_date)
      ? req.body.pickup_date.filter((value: unknown) => typeof value === 'string' && value.trim())
      : undefined

    const data = await requestShipmentPickup({
      shipment_id: normalizedIds,
      ...(status ? { status } : {}),
      ...(pickupDate ? { pickup_date: pickupDate } : {}),
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/orders/processing/return', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await listReturnOrders(req.query as any)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.patch('/orders/fulfill', requireAuth, async (req: Request, res: Response) => {
  try {
    type FulfillItem = {
      order_id?: number | string
      order_product_id?: number | string
      quantity?: number | string
      action?: string
    }
    type FulfillOrderItem = {
      order_id: number | string
      order_product_id: number | string
      quantity: number | string
      action: string
    }

    const payload = Array.isArray(req.body?.data) ? req.body.data : undefined
    if (!payload || payload.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'data array with order_id, order_product_id, quantity and action is required',
      })
    }

    const normalizedData: FulfillOrderItem[] = payload.map((item: FulfillItem) => ({
      order_id: item?.order_id,
      order_product_id: item?.order_product_id,
      quantity: item?.quantity,
      action: item?.action,
    })) as FulfillOrderItem[]

    const hasInvalidItem = normalizedData.some((item: FulfillOrderItem) =>
        item.order_id === undefined ||
        item.order_product_id === undefined ||
        item.quantity === undefined ||
        !item.action,
    )

    if (hasInvalidItem) {
      return res.status(400).json({
        success: false,
        error: 'Each data item must include order_id, order_product_id, quantity and action',
      })
    }

    const data = await fulfillOrderedProducts({ data: normalizedData })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.patch('/orders/mapping', requireAuth, async (req: Request, res: Response) => {
  try {
    type MappingItem = {
      order_id?: number | string
      order_product_id?: number | string
      master_sku?: string
    }
    type MappingOrderItem = {
      order_id: number | string
      order_product_id: number | string
      master_sku: string
    }

    const payload = Array.isArray(req.body?.data) ? req.body.data : undefined
    if (!payload || payload.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'data array with order_id, order_product_id and master_sku is required',
      })
    }

    const normalizedData: MappingOrderItem[] = payload.map((item: MappingItem) => ({
      order_id: item?.order_id,
      order_product_id: item?.order_product_id,
      master_sku: item?.master_sku || '',
    })) as MappingOrderItem[]

    const hasInvalidItem = normalizedData.some((item: MappingOrderItem) =>
      item.order_id === undefined ||
      item.order_product_id === undefined ||
      !item.master_sku,
    )

    if (hasInvalidItem) {
      return res.status(400).json({
        success: false,
        error: 'Each data item must include order_id, order_product_id and master_sku',
      })
    }

    const data = await mapUnmappedProducts({ data: normalizedData })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/import', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'CSV file is required' })
    }

    const data = await importOrdersBulk({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.patch('/orders/address/pickup', requireAuth, async (req: Request, res: Response) => {
  try {
    const { order_id, pickup_location } = req.body || {}
    if (!order_id || !pickup_location) {
      return res.status(400).json({
        success: false,
        error: 'order_id and pickup_location are required',
      })
    }

    const data = await updateOrderPickupLocation({
      order_id,
      pickup_location: String(pickup_location),
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/address/update', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      order_id,
      shipping_customer_name,
      shipping_phone,
      shipping_address,
      shipping_city,
      shipping_state,
      shipping_country,
      shipping_pincode,
    } = req.body || {}

    if (
      !order_id ||
      !shipping_customer_name ||
      !shipping_phone ||
      !shipping_address ||
      !shipping_city ||
      !shipping_state ||
      !shipping_country ||
      !shipping_pincode
    ) {
      return res.status(400).json({
        success: false,
        error: 'order_id, shipping_customer_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_country and shipping_pincode are required',
      })
    }

    const data = await updateCustomerDeliveryAddress({
      order_id,
      shipping_customer_name: String(shipping_customer_name),
      shipping_phone,
      shipping_address: String(shipping_address),
      shipping_address_2:
        typeof req.body?.shipping_address_2 === 'string' ? req.body.shipping_address_2 : undefined,
      shipping_city: String(shipping_city),
      shipping_state: String(shipping_state),
      shipping_country: String(shipping_country),
      shipping_pincode,
      shipping_email:
        typeof req.body?.shipping_email === 'string' ? req.body.shipping_email : undefined,
      billing_alternate_phone:
        req.body?.billing_alternate_phone !== undefined ? req.body.billing_alternate_phone : undefined,
    })

    res.status(202).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Courier / Serviceability
router.get('/courier/serviceability', checkCourierServiceabilityController)
router.get('/courier/serviceability/self', getSelfServiceabilityController)
router.get('/courier/recommended', getRecommendedCouriersController)

// Orders
router.post('/orders/cancel', requireAuth, cancelOrdersController)
router.get('/orders', requireAuth, listAllOrdersController)
router.get('/orders/:orderId', requireAuth, getOrderDetailsController)
router.post('/orders/:orderId/duplicate', requireAuth, duplicateOrderController)
router.post('/orders/:orderId/print', requireAuth, printOrderInvoiceController)
router.delete('/orders/:orderId', requireAuth, deleteOrderController)

// Shipments / AWB / Label
router.post('/shipments/awb/generate', requireAuth, generateAwbController)
router.post('/shipments/label/generate', requireAuth, generateLabelController)
router.post('/shipments/manifest/generate', requireAuth, generatePickupManifestController)
router.post('/shipments/export', requireAuth, exportShipmentsController)
router.get('/shipments', requireAuth, listShipmentsController)

// Tracking
router.get('/track', trackShipmentController)
router.get('/track/orders/:orderId', trackShipmentByOrderIdController)

// Pickup Locations
router.get('/pickup-locations', requireAuth, getPickupLocationsController)
router.post('/pickup-locations', requireAuth, addPickupLocationController)
router.put('/pickup-locations', requireAuth, editPickupLocationController)

// Addresses
router.get('/addresses', requireAuth, getAddressesController)
router.post('/addresses', requireAuth, addAddressController)

// NDR
router.get('/ndr/list', requireAuth, listNdrController)
router.post('/ndr/update', requireAuth, updateNdrActionController)
router.get('/ndr/rescheduled', requireAuth, listRescheduledNdrController)
router.post('/ndr/reschedule', requireAuth, rescheduleNdrController)

// Webhooks
router.post('/webhook/register', requireAuth, registerWebhookController)
router.get('/webhooks', requireAuth, getWebhooksController)

// Channels
router.get('/channels', requireAuth, listChannelsController)
router.post('/channels', requireAuth, addChannelController)

// Invoice
router.post('/orders/:orderId/invoice/generate', requireAuth, generateInvoiceController)
router.post('/orders/:orderId/invoice/print', requireAuth, printInvoiceController)

// Customers
router.get('/customers', requireAuth, listCustomersController)
router.post('/customers', requireAuth, createCustomerController)

// Returns
router.post('/orders/create/return', requireAuth, createReturnOrderController)
router.post('/returns/create', requireAuth, createReturnOrderController)

// Pickup Schedules
router.post('/pickup/schedule', requireAuth, schedulePickupController)
router.post('/pickup/address/:pickupId', requireAuth, updatePickupAddressController)

export default router
