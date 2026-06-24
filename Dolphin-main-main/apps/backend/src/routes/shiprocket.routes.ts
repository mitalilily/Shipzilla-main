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
  createReturnShipmentController,
  updateReturnOrderController,
  createExchangeOrderController,
  createForwardShipmentController,
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
  getWalletBalance,
  getStatementDetails,
  getDiscrepancyData,
  listProducts,
  listInventory,
  updateInventory,
  listCountries,
  listCountryZones,
  getPostcodeDetails,
  listListings,
  linkListingToProduct,
  getProductDetails,
  createProduct,
  updateQcProduct,
  importProductsBulk,
  getProductsSampleCsv,
  importListingMappingsBulk,
  exportMappedListings,
  exportUnmappedListings,
  exportListingsSample,
  checkImportErrors,
  actionNdrShipment,
  cancelShipmentsByAwb,
  generateBulkInvoice,
  generateLabel,
  generateManifest,
  getNdrShipmentDetails,
  getShipmentDetails,
  listAllNdrShipments,
  printManifest,
  trackShipmentByAwb,
  trackShipmentByShipmentId,
  trackShipmentsByAwbs,
} from '../models/services/shiprocketExtended.service'
import { requireAuth } from '../middlewares/requireAuth'
import { upload } from '../middlewares/upload'

const router = Router()

const getShiprocketTokenOverride = (req: Request) => {
  const headerToken = req.headers['x-shiprocket-token']
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim()
  }

  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : ''
  if (queryToken) {
    return queryToken
  }

  const bodyToken = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  return bodyToken || undefined
}

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
      order_id,
      order_date,
      pickup_location,
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
      shipping_method,
      order_type,
      latitude,
      longitude,
    } = req.body || {}

    if (
      !order_id ||
      !order_date ||
      !pickup_location ||
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
          'order_id, order_date, pickup_location, billing_customer_name, billing_address, billing_city, billing_pincode, billing_state, billing_country, billing_email, billing_phone, shipping_is_billing, order_items, payment_method, sub_total, length, breadth, height and weight are required',
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

    const shippingIsBilling = normalizeBooleanFlag(shipping_is_billing)
    if (shippingIsBilling === null) {
      return res.status(400).json({
        success: false,
        error: 'shipping_is_billing must be a boolean value',
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
      if (!String(item.name ?? '').trim()) return true
      if (!String(item.sku ?? '').trim()) return true
      if (!Number.isInteger(Number(item.units)) || Number(item.units) <= 0) return true
      if (!isPositiveNumber(item.selling_price)) return true
      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error: 'each order_items entry must include name, sku, units and selling_price',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (!['cod', 'prepaid'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'COD' or 'Prepaid'",
      })
    }

    if (
      !isPositiveNumber(sub_total) ||
      !isPositiveNumber(weight) ||
      !isPositiveNumber(length, 0.5) ||
      !isPositiveNumber(breadth, 0.5) ||
      !isPositiveNumber(height, 0.5)
    ) {
      return res.status(400).json({
        success: false,
        error: 'sub_total and weight must be greater than 0, and dimensions must be greater than 0.5',
      })
    }

    if (
      !shippingIsBilling &&
      (!req.body?.shipping_customer_name ||
        !req.body?.shipping_address ||
        !req.body?.shipping_city ||
        !req.body?.shipping_pincode ||
        !req.body?.shipping_country ||
        !req.body?.shipping_state ||
        !req.body?.shipping_phone)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'shipping_customer_name, shipping_address, shipping_city, shipping_pincode, shipping_country, shipping_state and shipping_phone are required when shipping_is_billing is false',
      })
    }

    if (String(billing_city).trim().length > 30) {
      return res.status(400).json({
        success: false,
        error: 'billing_city must be 30 characters or fewer',
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

    if (shipping_method !== undefined) {
      const normalizedShippingMethod = String(shipping_method).trim()
      if (normalizedShippingMethod && normalizedShippingMethod !== 'HL') {
        return res.status(400).json({
          success: false,
          error: "shipping_method must be 'HL' when provided",
        })
      }

      if (normalizedShippingMethod === 'HL') {
        if (!isPositiveNumber(latitude) || !isPositiveNumber(longitude)) {
          return res.status(400).json({
            success: false,
            error: 'latitude and longitude are required and must be valid numbers when shipping_method is HL',
          })
        }
      }
    }

    const data = await createCustomOrder({
      ...req.body,
      shipping_is_billing: shippingIsBilling,
      payment_method:
        normalizedPaymentMethod === 'cod'
          ? 'COD'
          : normalizedPaymentMethod === 'prepaid'
            ? 'Prepaid'
            : payment_method,
    })
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
    const { shipment_id, courier_id, status, is_return } = req.body || {}
    if (!shipment_id) {
      return res.status(400).json({
        success: false,
        error: 'shipment_id is required',
      })
    }

    const normalizedIsReturn =
      is_return === undefined || is_return === null || String(is_return).trim() === ''
        ? undefined
        : String(is_return).trim()

    if (normalizedIsReturn !== undefined && !['0', '1'].includes(normalizedIsReturn)) {
      return res.status(400).json({
        success: false,
        error: 'is_return must be 0 or 1 when provided',
      })
    }

    const data = await assignAwbToShipment({
      shipment_id,
      ...(courier_id !== undefined ? { courier_id } : {}),
      ...(typeof status === 'string' && status.trim() ? { status: status.trim() } : {}),
      ...(normalizedIsReturn !== undefined ? { is_return: Number(normalizedIsReturn) } : {}),
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
router.get('/account/details/wallet-balance', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await getWalletBalance()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/account/details/statement', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query || {}
    const params = {
      ...(query.page !== undefined ? { page: Number(query.page) } : {}),
      ...(query.per_page !== undefined ? { per_page: Number(query.per_page) } : {}),
      ...(typeof query.from === 'string' && query.from.trim() ? { from: query.from.trim() } : {}),
      ...(typeof query.to === 'string' && query.to.trim() ? { to: query.to.trim() } : {}),
    }

    const data = await getStatementDetails(params)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/billing/discrepancy', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await getDiscrepancyData()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query || {}
    const params = {
      ...(query.page !== undefined ? { page: Number(query.page) } : {}),
      ...(query.per_page !== undefined ? { per_page: Number(query.per_page) } : {}),
      ...(typeof query.sort === 'string' && query.sort.trim() ? { sort: query.sort.trim() } : {}),
      ...(typeof query.sort_by === 'string' && query.sort_by.trim() ? { sort_by: query.sort_by.trim() } : {}),
      ...(typeof query.filter === 'string' && query.filter.trim() ? { filter: query.filter.trim() } : {}),
      ...(typeof query.filter_by === 'string' && query.filter_by.trim() ? { filter_by: query.filter_by.trim() } : {}),
    }

    const data = await listProducts(params)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query || {}
    const params = {
      ...(query.page !== undefined ? { page: Number(query.page) } : {}),
      ...(query.per_page !== undefined ? { per_page: Number(query.per_page) } : {}),
      ...(typeof query.sort === 'string' && query.sort.trim() ? { sort: query.sort.trim() } : {}),
      ...(typeof query.sort_by === 'string' && query.sort_by.trim() ? { sort_by: query.sort_by.trim() } : {}),
    }

    const data = await listInventory(params)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.put('/inventory/:productId/update', requireAuth, async (req: Request, res: Response) => {
  try {
    const productId = req.params?.productId?.trim()
    const quantityRaw = req.body?.quantity
    const actionRaw = typeof req.body?.action === 'string' ? req.body.action.trim().toLowerCase() : ''

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
      })
    }

    if (quantityRaw === undefined || quantityRaw === null || quantityRaw === '') {
      return res.status(400).json({
        success: false,
        error: 'quantity is required',
      })
    }

    if (!['add', 'replace', 'remove'].includes(actionRaw)) {
      return res.status(400).json({
        success: false,
        error: "action must be 'add', 'replace', or 'remove'",
      })
    }

    const data = await updateInventory(productId, {
      quantity: quantityRaw,
      action: actionRaw,
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/countries', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await listCountries()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/countries/show/:countryId', requireAuth, async (req: Request, res: Response) => {
  try {
    const countryId = req.params?.countryId?.trim()
    if (!countryId) {
      return res.status(400).json({
        success: false,
        error: 'countryId is required',
      })
    }

    const data = await listCountryZones(countryId)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/open/postcode/details', requireAuth, async (req: Request, res: Response) => {
  try {
    const postcode = typeof req.query?.postcode === 'string' ? req.query.postcode.trim() : ''
    if (!postcode) {
      return res.status(400).json({
        success: false,
        error: 'postcode is required',
      })
    }

    const data = await getPostcodeDetails(postcode)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/listings', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = req.query || {}
    const params = {
      ...(query.page !== undefined ? { page: Number(query.page) } : {}),
      ...(query.per_page !== undefined ? { per_page: Number(query.per_page) } : {}),
      ...(typeof query.sort === 'string' && query.sort.trim() ? { sort: query.sort.trim() } : {}),
      ...(typeof query.sort_by === 'string' && query.sort_by.trim() ? { sort_by: query.sort_by.trim() } : {}),
      ...(typeof query.filter === 'string' && query.filter.trim() ? { filter: query.filter.trim() } : {}),
      ...(typeof query.filter_by === 'string' && query.filter_by.trim() ? { filter_by: query.filter_by.trim() } : {}),
    }

    const data = await listListings(params)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/listings/link', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {}
    const productId = body.product_id
    const listingId = body.listing_id
    const legacyId = body.ID

    const hasProductId = productId !== undefined && productId !== null && String(productId).trim() !== ''
    const hasListingId = listingId !== undefined && listingId !== null && String(listingId).trim() !== ''

    if (!hasProductId || !hasListingId) {
      return res.status(400).json({
        success: false,
        error: 'product_id and listing_id are required',
      })
    }

    const payload = {
      product_id: productId,
      listing_id: listingId,
      ...(legacyId !== undefined && legacyId !== null && String(legacyId).trim() !== '' ? { ID: legacyId } : {}),
    }

    const data = await linkListingToProduct(payload)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/products/show/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const productId = req.params?.productId?.trim()
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
      })
    }

    const data = await getProductDetails(productId)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {}
    const sku = typeof body.sku === 'string' ? body.sku.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const typeRaw = typeof body.type === 'string' ? body.type.trim() : ''
    const qty = body.qty
    const categoryCode = typeof body.category_code === 'string' && body.category_code.trim() ? body.category_code.trim() : 'default'

    if (!sku || !name || !typeRaw || qty === undefined || qty === null || qty === '') {
      return res.status(400).json({
        success: false,
        error: 'sku, name, type and qty are required',
      })
    }

    const normalizedType =
      typeRaw.toLowerCase() === 'single'
        ? 'Single'
        : typeRaw.toLowerCase() === 'multiple'
          ? 'Multiple'
          : typeRaw

    if (!['Single', 'Multiple'].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        error: "type must be 'Single' or 'Multiple'",
      })
    }

    const payload = {
      ...body,
      sku,
      name,
      type: normalizedType,
      qty,
      category_code: categoryCode,
    }

    const data = await createProduct(payload)
    res.status(201).json({ success: true, data: data ?? null })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/products/qc-product-update/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const productId = req.params?.productId?.trim()
    const body = req.body || {}
    const sku = typeof body.sku === 'string' ? body.sku.trim() : ''
    const productImage = typeof body.product_image === 'string' ? body.product_image.trim() : ''

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'productId is required',
      })
    }

    if (!sku || !productImage) {
      return res.status(400).json({
        success: false,
        error: 'sku and product_image are required',
      })
    }

    const payload = {
      ...body,
      sku,
      product_image: productImage,
    }

    const data = await updateQcProduct(productId, payload)
    res.status(200).json({
      success: true,
      data: data ?? null,
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/products/import', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'CSV file is required' })
    }

    const data = await importProductsBulk({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/products/sample', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await getProductsSampleCsv()
    res.status(200).type('text/csv; charset=utf-8').send(data)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/listings/import', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, error: 'CSV file is required' })
    }

    const data = await importListingMappingsBulk({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    })

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/listings/export/mapped', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await exportMappedListings()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/listings/export/unmapped', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await exportUnmappedListings()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/listings/sample', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await exportListingsSample()
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/errors/:importId/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const importId = req.params?.importId?.trim()
    if (!importId) {
      return res.status(400).json({
        success: false,
        error: 'importId is required',
      })
    }

    const data = await checkImportErrors(importId)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/blocked-pincodes/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action.trim().toLowerCase() : ''
    const deliveryBlocked = req.body?.postcode?.delivery_blocked
    const authToken = getShiprocketTokenOverride(req)

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
    }, authToken ? { authToken } : undefined)

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get(
  ['/blocked-pincodes/get', '/block-pincodes/get'],
  requireAuth,
  async (req: Request, res: Response) => {
  try {
    const isDownload = String(req.query?.is_download ?? '').trim() === '1'
    const search = typeof req.query?.search === 'string' ? req.query.search.trim() : ''
    const perPage = typeof req.query?.per_page === 'string' ? req.query.per_page.trim() : ''
    const currentPage =
      typeof req.query?.current_page === 'string' ? req.query.current_page.trim() : ''
    const authToken = getShiprocketTokenOverride(req)

    const params = isDownload
      ? { is_download: 1 }
      : search
        ? { search }
        : {
            ...(perPage ? { per_page: perPage } : {}),
            ...(currentPage ? { current_page: currentPage } : {}),
          }

    const data = await getBlockedPincodes(params, authToken ? { authToken } : undefined)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
  },
)
router.post('/orders/update/adhoc', requireAuth, async (req: Request, res: Response) => {
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
      order_id,
      order_date,
      pickup_location,
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
      shipping_method,
      order_type,
      latitude,
      longitude,
    } = req.body || {}

    if (
      !order_id ||
      !order_date ||
      !pickup_location ||
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
          'order_id, order_date, pickup_location, billing_customer_name, billing_address, billing_city, billing_pincode, billing_state, billing_country, billing_email, billing_phone, shipping_is_billing, order_items, payment_method, sub_total, length, breadth, height and weight are required',
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

    const shippingIsBilling = normalizeBooleanFlag(shipping_is_billing)
    if (shippingIsBilling === null) {
      return res.status(400).json({
        success: false,
        error: 'shipping_is_billing must be a boolean value',
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
      if (!String(item.name ?? '').trim()) return true
      if (!String(item.sku ?? '').trim()) return true
      if (!Number.isInteger(Number(item.units)) || Number(item.units) <= 0) return true
      if (!isPositiveNumber(item.selling_price)) return true
      return false
    })

    if (invalidOrderItem) {
      return res.status(400).json({
        success: false,
        error: 'each order_items entry must include name, sku, units and selling_price',
      })
    }

    const normalizedPaymentMethod = String(payment_method || '').trim().toLowerCase()
    if (!['cod', 'prepaid'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "payment_method must be 'COD' or 'Prepaid'",
      })
    }

    if (
      !isPositiveNumber(sub_total) ||
      !isPositiveNumber(weight) ||
      !isPositiveNumber(length, 0.5) ||
      !isPositiveNumber(breadth, 0.5) ||
      !isPositiveNumber(height, 0.5)
    ) {
      return res.status(400).json({
        success: false,
        error: 'sub_total and weight must be greater than 0, and dimensions must be greater than 0.5',
      })
    }

    if (
      !shippingIsBilling &&
      (!req.body?.shipping_customer_name ||
        !req.body?.shipping_address ||
        !req.body?.shipping_city ||
        !req.body?.shipping_pincode ||
        !req.body?.shipping_country ||
        !req.body?.shipping_state ||
        !req.body?.shipping_phone)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'shipping_customer_name, shipping_address, shipping_city, shipping_pincode, shipping_country, shipping_state and shipping_phone are required when shipping_is_billing is false',
      })
    }

    if (String(billing_city).trim().length > 30) {
      return res.status(400).json({
        success: false,
        error: 'billing_city must be 30 characters or fewer',
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

    if (shipping_method !== undefined) {
      const normalizedShippingMethod = String(shipping_method).trim()
      if (normalizedShippingMethod && normalizedShippingMethod !== 'HL') {
        return res.status(400).json({
          success: false,
          error: "shipping_method must be 'HL' when provided",
        })
      }

      if (normalizedShippingMethod === 'HL') {
        if (!isPositiveNumber(latitude) || !isPositiveNumber(longitude)) {
          return res.status(400).json({
            success: false,
            error: 'latitude and longitude are required and must be valid numbers when shipping_method is HL',
          })
        }
      }
    }

    const data = await updateCustomOrder({
      ...req.body,
      shipping_is_billing: shippingIsBilling,
      payment_method:
        normalizedPaymentMethod === 'cod'
          ? 'COD'
          : normalizedPaymentMethod === 'prepaid'
            ? 'Prepaid'
            : payment_method,
    })
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
router.post('/courier/generate/label', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipmentIds = Array.isArray(req.body?.shipment_id)
      ? req.body.shipment_id.filter((value: unknown) => String(value ?? '').trim())
      : []

    if (shipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'shipment_id must be a non-empty array',
      })
    }

    const data = await generateLabel({ shipment_id: shipmentIds })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/manifests/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipmentIds = Array.isArray(req.body?.shipment_id)
      ? req.body.shipment_id.filter((value: unknown) => String(value ?? '').trim())
      : []

    if (shipmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'shipment_id must be a non-empty array',
      })
    }

    const data = await generateManifest({ shipment_id: shipmentIds })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/manifests/print', requireAuth, async (req: Request, res: Response) => {
  try {
    const orderIds = Array.isArray(req.body?.order_ids)
      ? req.body.order_ids.filter((value: unknown) => String(value ?? '').trim())
      : []

    if (orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_ids must be a non-empty array',
      })
    }

    const data = await printManifest({ order_ids: orderIds })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/print/invoice', requireAuth, async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((value: unknown) => String(value ?? '').trim())
      : []

    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' })
    }

    const data = await generateBulkInvoice({ ids })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/orders/cancel/shipment/awbs', requireAuth, async (req: Request, res: Response) => {
  try {
    const awbs = Array.isArray(req.body?.awbs)
      ? req.body.awbs.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
      : []

    if (awbs.length === 0 || awbs.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'awbs must be a non-empty array containing at most 2000 values',
      })
    }

    await cancelShipmentsByAwb({ awbs })
    res.status(204).end()
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
router.get('/courier/serviceability', requireAuth, checkCourierServiceabilityController)
router.get('/courier/serviceability/self', getSelfServiceabilityController)
router.get('/courier/recommended', getRecommendedCouriersController)

// Orders
router.post('/orders/cancel', requireAuth, cancelOrdersController)
router.get('/orders', requireAuth, listAllOrdersController)
router.get('/orders/show/:orderId', requireAuth, getOrderDetailsController)
router.get('/orders/:orderId', requireAuth, getOrderDetailsController)
router.post('/orders/:orderId/duplicate', requireAuth, duplicateOrderController)
router.post('/orders/:orderId/print', requireAuth, printOrderInvoiceController)
router.delete('/orders/:orderId', requireAuth, deleteOrderController)

// Shipments / AWB / Label
router.post('/shipments/create/forward-shipment', requireAuth, createForwardShipmentController)
router.post('/shipments/awb/generate', requireAuth, generateAwbController)
router.post('/shipments/label/generate', requireAuth, generateLabelController)
router.post('/shipments/manifest/generate', requireAuth, generatePickupManifestController)
router.post('/shipments/export', requireAuth, exportShipmentsController)
router.get('/shipments', requireAuth, listShipmentsController)
router.get('/shipments/:shipmentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipmentId = String(req.params?.shipmentId ?? '').trim()
    if (!shipmentId) {
      return res.status(400).json({ success: false, error: 'shipmentId is required' })
    }
    const data = await getShipmentDetails(shipmentId)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Tracking
router.get('/track', trackShipmentController)
router.get('/courier/track', requireAuth, trackShipmentController)
router.get('/track/orders/:orderId', trackShipmentByOrderIdController)
router.get('/courier/track/shipment/:shipmentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const shipmentId = String(req.params?.shipmentId ?? '').trim()
    if (!shipmentId) return res.status(400).json({ success: false, error: 'shipmentId is required' })
    const data = await trackShipmentByShipmentId(shipmentId)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/courier/track/awb/:awb', requireAuth, async (req: Request, res: Response) => {
  try {
    const awb = String(req.params?.awb ?? '').trim()
    if (!awb) return res.status(400).json({ success: false, error: 'awb is required' })
    const data = await trackShipmentByAwb(awb)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/courier/track/awbs', requireAuth, async (req: Request, res: Response) => {
  try {
    const awbs = Array.isArray(req.body?.awbs)
      ? req.body.awbs.map((value: unknown) => String(value ?? '').trim()).filter(Boolean)
      : []

    if (awbs.length === 0 || awbs.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'awbs must be a non-empty string array containing at most 50 values',
      })
    }

    const data = await trackShipmentsByAwbs({ awbs })
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

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
router.get('/ndr/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await listAllNdrShipments(req.query as any)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.post('/ndr/:awb/action', requireAuth, async (req: Request, res: Response) => {
  try {
    const awb = String(req.params?.awb ?? '').trim()
    const action = typeof req.body?.action === 'string' ? req.body.action.trim() : ''
    const comments = typeof req.body?.comments === 'string' ? req.body.comments.trim() : ''
    const allowedActions = ['fake-attempt', 're-attempt', 'return']

    if (!awb || !allowedActions.includes(action) || !comments) {
      return res.status(400).json({
        success: false,
        error: "awb, comments and action ('fake-attempt', 're-attempt', or 'return') are required",
      })
    }

    if (action === 'fake-attempt') {
      const proofAudio = typeof req.body?.proof_audio === 'string' ? req.body.proof_audio.trim() : ''
      const proofImage = typeof req.body?.proof_image === 'string' ? req.body.proof_image.trim() : ''
      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : ''

      if (!proofAudio || !proofImage || !remarks) {
        return res.status(400).json({
          success: false,
          error: 'proof_audio, proof_image and remarks are required when action is fake-attempt',
        })
      }
    }

    const deferredDate =
      typeof req.body?.deferred_date === 'string' ? req.body.deferred_date.trim() : ''
    if (deferredDate) {
      const parsedDeferredDate = new Date(deferredDate)
      if (Number.isNaN(parsedDeferredDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'deferred_date must be a valid date',
        })
      }
    }

    const data = await actionNdrShipment(awb, { ...req.body, action, comments })
    res.status(202).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})
router.get('/ndr/:awb', requireAuth, async (req: Request, res: Response) => {
  try {
    const awb = String(req.params?.awb ?? '').trim()
    if (!awb) return res.status(400).json({ success: false, error: 'awb is required' })
    const data = await getNdrShipmentDetails(awb)
    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

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
router.post('/shipments/create/return-shipment', requireAuth, createReturnShipmentController)
router.post('/orders/edit', requireAuth, updateReturnOrderController)
router.post('/orders/create/exchange', requireAuth, createExchangeOrderController)

// Pickup Schedules
router.post('/pickup/schedule', requireAuth, schedulePickupController)
router.post('/pickup/address/:pickupId', requireAuth, updatePickupAddressController)

export default router
