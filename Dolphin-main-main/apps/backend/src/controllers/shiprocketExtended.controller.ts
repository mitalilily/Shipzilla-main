import { Request, Response } from 'express'
import {
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
  getRecommendedCouriers,
  schedulePickup,
  updatePickupAddress,
} from '../models/services/shiprocketExtended.service'

// ──────────────────── COURIER / SERVICEABILITY ────────────────────

export const checkCourierServiceabilityController = async (req: Request, res: Response) => {
  try {
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
    if (!ids && !awbs) {
      return res.status(400).json({ success: false, error: 'Provide ids or awbs to cancel' })
    }
    const data = await cancelOrders({ ids, awbs })
    res.json({ success: true, data })
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
    const data = await listAllOrders(req.query as any)
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
    const data = await createReturnOrder(req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ──────────────────── RECOMMENDED COURIERS ────────────────────

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