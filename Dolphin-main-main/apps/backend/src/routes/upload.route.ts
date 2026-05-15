import { raw, Router } from 'express'
import {
  createPresignedUrl,
  downloadLocalFile,
  getPresignedDownloadUrl,
  uploadLocalFile,
} from '../controllers/upload.controller'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

router.post('/presign', requireAuth, createPresignedUrl)
router.post('/presign-download-url', requireAuth, getPresignedDownloadUrl)
router.put('/local-upload', raw({ type: '*/*', limit: '25mb' }), uploadLocalFile)
router.get('/local-download', downloadLocalFile)

export default router

