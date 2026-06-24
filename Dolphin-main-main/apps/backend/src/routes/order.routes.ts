import { Router } from 'express'
import {
  checkOrderNumberAvailabilityController,
  createB2BShipmentController,
  createB2CShipmentController,
  generateManifestController,
  getAllOrdersController,
  getB2BOrdersController,
  getB2COrdersController,
  printIcarryShipmentLabelController,
  regenerateOrderDocumentsController,
  retryFailedManifestController,
  syncIcarryShipmentChargesController,
  syncIcarryShipmentStatusesController,
  trackOrderController,
} from '../controllers/order.controller'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

// POST /b2c/shipment
router.post('/b2c/create', requireAuth, createB2CShipmentController)
router.post('/b2b/create', requireAuth, createB2BShipmentController)
router.get('/check-order-number', requireAuth, checkOrderNumberAvailabilityController)
router.get('/b2c/list', requireAuth, getB2COrdersController)
router.get('/b2b/list', requireAuth, getB2BOrdersController)
router.post('/b2c/manifest', requireAuth, generateManifestController)
router.post('/b2c/shipment-charges/sync', requireAuth, syncIcarryShipmentChargesController)
router.post('/b2c/shipment-status/sync', requireAuth, syncIcarryShipmentStatusesController)
router.post('/b2c/shipment-label/print', requireAuth, printIcarryShipmentLabelController)
router.post('/b2c/:orderId/retry-manifest', requireAuth, retryFailedManifestController)
router.post('/:orderId/regenerate-documents', requireAuth, regenerateOrderDocumentsController)
router.get('/all', requireAuth, getAllOrdersController)

router.get('/track', trackOrderController)

export default router
