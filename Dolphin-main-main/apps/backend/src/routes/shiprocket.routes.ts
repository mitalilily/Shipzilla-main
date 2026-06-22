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
  createChannelSpecificOrder,
  createCustomOrder,
  logoutShiprocket,
  updateOrderPickupLocation,
} from '../models/services/shiprocketExtended.service'
import { requireAuth } from '../middlewares/requireAuth'

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
router.post('/returns/create', requireAuth, createReturnOrderController)

// Pickup Schedules
router.post('/pickup/schedule', requireAuth, schedulePickupController)
router.post('/pickup/address/:pickupId', requireAuth, updatePickupAddressController)

export default router
