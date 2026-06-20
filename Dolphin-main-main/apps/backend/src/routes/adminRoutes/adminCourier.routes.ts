// routes/shippingRateRoutes.ts
import { Router } from 'express'
import {
  getCourierCredentialsController,
  deleteShippingRateController,
  fetchAvailableCouriersForAdmin,
  getAllCouriersController,
  getShippingRatesController,
  importShippingRatesController,
  updateIcarryCredentialsController,
  updateShiprocketCredentialsController,
  updateShipmozoCredentialsController,
  updateShippingRateController,
} from '../../controllers/admin/courier.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'
import { upload } from '../../middlewares/upload'

const router = Router()

router.get('/shipping-rates', getShippingRatesController)
router.get('/list', getAllCouriersController)

router.put(
  '/shipping-rate/:id/:planId',
  requireAuth,
  isAdminMiddleware,
  updateShippingRateController,
)
router.post(
  '/shipping-rates/import',
  requireAuth,
  isAdminMiddleware,
  upload.single('file'),
  importShippingRatesController,
)
router.post('/available', requireAuth, fetchAvailableCouriersForAdmin)
router.get('/credentials', requireAuth, isAdminMiddleware, getCourierCredentialsController)
router.put(
  '/credentials/shiprocket',
  requireAuth,
  isAdminMiddleware,
  updateShiprocketCredentialsController,
)
router.put(
  '/credentials/shipmozo',
  requireAuth,
  isAdminMiddleware,
  updateShipmozoCredentialsController,
)
router.put(
  '/credentials/icarry',
  requireAuth,
  isAdminMiddleware,
  updateIcarryCredentialsController,
)
router.delete(
  '/shipping-rates/:planId/:id',
  requireAuth,
  isAdminMiddleware,
  deleteShippingRateController,
)

export default router
