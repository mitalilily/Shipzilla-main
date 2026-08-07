import { Request, Response } from 'express'
import {
  allotB2CAmazonAwb,
  getPendingB2CAmazonLabelAllotmentCount,
  getPendingB2CAmazonLabelAllotments,
} from '../../../models/services/b2cAmazonLabelAllotment.service'

export const listPendingB2CAmazonLabelsController = async (req: Request, res: Response) => {
  try {
    const result = await getPendingB2CAmazonLabelAllotments({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 25),
      search: req.query.search as string,
      status: req.query.status as string,
    })
    res.json({ success: true, data: result.rows, pagination: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load pending Amazon labels' })
  }
}

export const pendingB2CAmazonLabelCountController = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, count: await getPendingB2CAmazonLabelAllotmentCount() })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to load pending Amazon count' })
  }
}

export const allotB2CAmazonAwbController = async (req: any, res: Response) => {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const result = await allotB2CAmazonAwb({
      orderId: req.params.orderId,
      awb: req.body.awb,
      courierName: req.body.courierName,
      note: req.body.note,
      adminUserId: req.user?.sub,
      labelFile: files?.label?.[0],
      manifestFile: files?.manifest?.[0],
    })
    res.json({ success: true, data: result })
  } catch (error: any) {
    const message = error?.message || 'Failed to allot Amazon AWB'
    res.status(/not found/i.test(message) ? 404 : 400).json({ success: false, error: message })
  }
}
