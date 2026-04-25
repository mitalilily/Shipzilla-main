import axiosInstance from './axiosInstance'
import type { AxiosRequestConfig } from 'axios'
import { UI_ONLY_AUTH } from '../utils/authMode'

export interface Pickup {
  id: string
  awb_number: string | null
  courier_partner: string | null
  order_number: string
  status?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pickup_details: any
  created_at: string
}

export interface PendingActions {
  ndrCount: number
  rtoCount: number
  weightDiscrepancyCount: number
}

export interface InvoiceStatus {
  pending: { count: number; totalAmount: number }
  paid: { count: number; totalAmount: number }
  overdue: { count: number; totalAmount: number }
}

export interface TopDestination {
  city: string
  state: string
  count: number
}

export interface CourierDistribution {
  courier: string
  count: number
}

const buildRecentDates = (days: number, baseValue: number, step: number) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - index - 1))

    return {
      date: date.toISOString().slice(0, 10),
      orders: baseValue + index * step,
    }
  })

const buildRevenueDates = (days: number, baseValue: number, step: number) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - index - 1))

    return {
      date: date.toISOString().slice(0, 10),
      revenue: baseValue + index * step,
    }
  })

const demoMerchantDashboardStats: MerchantDashboardStats = {
  todayOperations: {
    orders: 42,
    pending: 9,
    inTransit: 18,
    delivered: 15,
  },
  financial: {
    walletBalance: 28540,
    todayRevenue: 12480,
    totalRevenue: 482650,
    totalShippingCharges: 113920,
    totalFreightCharges: 18450,
    profit: 96780,
    codAmount: 74200,
    codRemittanceDue: 18240,
    codRemittanceCredited: 55960,
  },
  operational: {
    deliverySuccessRate: 94,
    ndrRate: 4.5,
    rtoRate: 2.1,
    avgDeliveryTime: 2.4,
    totalOrders: 1438,
    deliveredOrders: 1353,
    ndrCount: 29,
    rtoCount: 13,
  },
  actions: {
    ndrCount: 7,
    rtoCount: 3,
    weightDiscrepancyCount: 2,
    openTickets: 4,
    inProgressTickets: 2,
    pendingInvoices: 3,
    pendingInvoiceAmount: 12450,
    overdueInvoices: 1,
    overdueInvoiceAmount: 3180,
  },
  couriers: {
    performance: {
      Delhivery: { count: 420, delivered: 398, revenue: 132400, deliveryRate: 94.8 },
      Bluedart: { count: 288, delivered: 276, revenue: 114900, deliveryRate: 95.8 },
      Xpressbees: { count: 346, delivered: 321, revenue: 98600, deliveryRate: 92.8 },
      Ecom: { count: 184, delivered: 171, revenue: 36750, deliveryRate: 92.9 },
    },
    distribution: [
      { courier: 'Delhivery', count: 420 },
      { courier: 'Xpressbees', count: 346 },
      { courier: 'Bluedart', count: 288 },
      { courier: 'Ecom', count: 184 },
    ],
  },
  geographic: {
    topDestinations: [
      { city: 'Mumbai', state: 'Maharashtra', count: 188 },
      { city: 'Bengaluru', state: 'Karnataka', count: 160 },
      { city: 'Delhi', state: 'Delhi', count: 144 },
      { city: 'Hyderabad', state: 'Telangana', count: 121 },
      { city: 'Pune', state: 'Maharashtra', count: 116 },
    ],
  },
  charts: {
    ordersByDate: buildRecentDates(7, 22, 3),
    revenueByDate: buildRevenueDates(7, 8200, 520),
    ordersByDate30: buildRecentDates(30, 12, 1),
    revenueByDate30: buildRevenueDates(30, 4100, 170),
    ordersByStatus: [
      { status: 'Delivered', count: 845 },
      { status: 'In Transit', count: 291 },
      { status: 'Pending', count: 176 },
      { status: 'NDR', count: 82 },
      { status: 'RTO', count: 44 },
    ],
    revenueByOrderType: [
      { type: 'Prepaid', revenue: 296500 },
      { type: 'COD', revenue: 186150 },
    ],
    ordersByCourier: [
      { courier: 'Delhivery', count: 420 },
      { courier: 'Xpressbees', count: 346 },
      { courier: 'Bluedart', count: 288 },
      { courier: 'Ecom', count: 184 },
    ],
    revenueByCourier: [
      { courier: 'Delhivery', revenue: 132400 },
      { courier: 'Bluedart', revenue: 114900 },
      { courier: 'Xpressbees', revenue: 98600 },
      { courier: 'Ecom', revenue: 36750 },
    ],
  },
  metrics: {
    avgOrderValue: 336,
    totalPrepaidOrders: 876,
    totalCodOrders: 562,
    prepaidRevenue: 296500,
    codRevenue: 186150,
    topRevenueCities: [
      { city: 'Mumbai', revenue: 76400 },
      { city: 'Bengaluru', revenue: 68800 },
      { city: 'Delhi', revenue: 61400 },
    ],
  },
  recentOrders: [
    { id: 'ord_1001', orderNumber: 'SZ-1001', status: 'Delivered', amount: 520, createdAt: new Date().toISOString() },
    { id: 'ord_1002', orderNumber: 'SZ-1002', status: 'In Transit', amount: 340, createdAt: new Date().toISOString() },
  ],
  trends: {
    ordersGrowth: 18.4,
    revenueGrowth: 14.2,
    thisWeekOrders: 238,
    lastWeekOrders: 201,
    thisWeekRevenue: 82450,
    lastWeekRevenue: 72180,
  },
  recentActivity: {
    transactions: [
      {
        id: 'txn_1',
        type: 'credit',
        amount: 6400,
        reason: 'COD remittance credited',
        createdAt: new Date(),
      },
      {
        id: 'txn_2',
        type: 'debit',
        amount: 1850,
        reason: 'Shipping charges deducted',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      },
    ],
    recentOrders: [
      {
        id: 'ord_1003',
        orderNumber: 'SZ-1003',
        status: 'Picked Up',
        amount: 410,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord_1004',
        orderNumber: 'SZ-1004',
        status: 'Manifested',
        amount: 290,
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
    ],
  },
}

export const getIncomingPickups = async (config?: AxiosRequestConfig): Promise<Pickup[]> => {
  if (UI_ONLY_AUTH) return []
  const { data } = await axiosInstance.get('/dashboard/incoming', config)
  return data.success ? data.pickups : []
}

export const getPendingActions = async (config?: AxiosRequestConfig): Promise<PendingActions> => {
  if (UI_ONLY_AUTH) {
    return {
      ndrCount: demoMerchantDashboardStats.actions.ndrCount,
      rtoCount: demoMerchantDashboardStats.actions.rtoCount,
      weightDiscrepancyCount: demoMerchantDashboardStats.actions.weightDiscrepancyCount,
    }
  }
  const { data } = await axiosInstance.get('/dashboard/pending-actions', config)
  return data.success
    ? {
        ndrCount: data.ndrCount || 0,
        rtoCount: data.rtoCount || 0,
        weightDiscrepancyCount: data.weightDiscrepancyCount || 0,
      }
    : { ndrCount: 0, rtoCount: 0, weightDiscrepancyCount: 0 }
}

export const getInvoiceStatus = async (config?: AxiosRequestConfig): Promise<InvoiceStatus> => {
  if (UI_ONLY_AUTH) {
    return {
      pending: {
        count: demoMerchantDashboardStats.actions.pendingInvoices,
        totalAmount: demoMerchantDashboardStats.actions.pendingInvoiceAmount,
      },
      paid: { count: 18, totalAmount: 284500 },
      overdue: {
        count: demoMerchantDashboardStats.actions.overdueInvoices,
        totalAmount: demoMerchantDashboardStats.actions.overdueInvoiceAmount,
      },
    }
  }
  const { data } = await axiosInstance.get('/dashboard/invoice-status', config)
  return data.success ? data.status : { pending: { count: 0, totalAmount: 0 }, paid: { count: 0, totalAmount: 0 }, overdue: { count: 0, totalAmount: 0 } }
}

export const getTopDestinations = async (
  limit = 10,
  config?: AxiosRequestConfig,
): Promise<TopDestination[]> => {
  if (UI_ONLY_AUTH) return demoMerchantDashboardStats.geographic.topDestinations.slice(0, limit)
  const axiosConfig: AxiosRequestConfig = {
    ...config,
    params: {
      limit,
      ...(config?.params ?? {}),
    },
  }
  const { data } = await axiosInstance.get('/dashboard/top-destinations', axiosConfig)
  return data.success ? data.destinations : []
}

export const getCourierDistribution = async (
  config?: AxiosRequestConfig,
): Promise<CourierDistribution[]> => {
  if (UI_ONLY_AUTH) return demoMerchantDashboardStats.couriers.distribution
  const { data } = await axiosInstance.get('/dashboard/courier-distribution', config)
  return data.success ? data.distribution : []
}

// Merchant Dashboard Stats
export interface MerchantDashboardStats {
  todayOperations: {
    orders: number
    pending: number
    inTransit: number
    delivered: number
  }
  financial: {
    walletBalance: number
    todayRevenue: number
    totalRevenue: number
    totalShippingCharges: number
    totalFreightCharges: number
    profit: number
    codAmount: number
    codRemittanceDue: number
    codRemittanceCredited: number
  }
  operational: {
    deliverySuccessRate: number
    ndrRate: number
    rtoRate: number
    avgDeliveryTime: number
    totalOrders: number
    deliveredOrders: number
    ndrCount: number
    rtoCount: number
  }
  actions: {
    ndrCount: number
    rtoCount: number
    weightDiscrepancyCount: number
    openTickets: number
    inProgressTickets: number
    pendingInvoices: number
    pendingInvoiceAmount: number
    overdueInvoices: number
    overdueInvoiceAmount: number
  }
  couriers: {
    performance: Record<string, { count: number; delivered: number; revenue: number; deliveryRate: number }>
    distribution: CourierDistribution[]
  }
  geographic: {
    topDestinations: TopDestination[]
  }
  charts: {
    ordersByDate: { date: string; orders: number }[]
    revenueByDate: { date: string; revenue: number }[]
    ordersByDate30: { date: string; orders: number }[]
    revenueByDate30: { date: string; revenue: number }[]
    ordersByStatus: { status: string; count: number }[]
    revenueByOrderType: { type: string; revenue: number }[]
    ordersByCourier: { courier: string; count: number }[]
    revenueByCourier: { courier: string; revenue: number }[]
  }
  metrics: {
    avgOrderValue: number
    totalPrepaidOrders: number
    totalCodOrders: number
    prepaidRevenue: number
    codRevenue: number
    topRevenueCities: Array<{ city: string; revenue: number }>
  }
  recentOrders: Array<Record<string, unknown>>
  trends: {
    ordersGrowth: number
    revenueGrowth: number
    thisWeekOrders: number
    lastWeekOrders: number
    thisWeekRevenue: number
    lastWeekRevenue: number
  }
  recentActivity: {
    transactions: Array<{
      id: string
      type: 'credit' | 'debit'
      amount: number
      reason: string | null
      createdAt: Date | null
    }>
    recentOrders: Array<{
      id: string
      orderNumber: string
      status: string
      amount: number
      createdAt: Date | string
    }>
  }
}

export const getMerchantDashboardStats = async (
  config?: AxiosRequestConfig,
): Promise<MerchantDashboardStats> => {
  if (UI_ONLY_AUTH) return demoMerchantDashboardStats
  const { data } = await axiosInstance.get('/dashboard/stats', config)
  return data.success ? data.data : ({} as MerchantDashboardStats)
}
