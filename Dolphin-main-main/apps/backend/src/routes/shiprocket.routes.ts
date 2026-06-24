import { Request, Response, Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth'
import { listCouriersWithCounts } from '../models/services/shiprocketExtended.service'

const router = Router()

router.get('/courier/courierListWithCounts', requireAuth, async (req: Request, res: Response) => {
  try {
    const type = typeof req.query?.type === 'string' ? req.query.type.trim() : undefined
    if (type && !['active', 'inactive', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "type must be 'active', 'inactive', or 'all'",
      })
    }

    const data = await listCouriersWithCounts(
      type ? { type: type as 'active' | 'inactive' | 'all' } : undefined,
    )

    res.status(200).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
