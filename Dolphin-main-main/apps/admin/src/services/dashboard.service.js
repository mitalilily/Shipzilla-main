import api from './axios'

// Get comprehensive admin dashboard statistics
export const getAdminDashboardStats = async () => {
  const { data } = await api.get('/admin/dashboard/stats')
  if (!data?.success) throw new Error(data?.message || 'Failed to fetch dashboard stats')
  return data
}
