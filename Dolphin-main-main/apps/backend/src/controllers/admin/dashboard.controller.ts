import { Request, Response } from 'express'
import { getAdminDashboardStats } from '../../models/services/adminDashboard.service'

export const getAdminDashboardStatsController = async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminDashboardStats()
    return res.json(stats)
  } catch (error: any) {
    console.error('Error fetching admin dashboard stats:', error?.message || error)
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch admin dashboard stats',
    })
  }
}
