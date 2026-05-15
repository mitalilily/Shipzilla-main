import { desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { codRemittances } from '../schema/codRemittance'
import { couriers } from '../schema/couriers'
import { kyc } from '../schema/kyc'
import { ndr_events } from '../schema/ndr'
import { rto_events } from '../schema/rto'
import { supportTickets } from '../schema/supportTickets'
import { users } from '../schema/users'
import { weight_discrepancies } from '../schema/weightDiscrepancies'

type AdminDashboardOrder = Record<string, any> & {
  shipmentType: 'b2c' | 'b2b'
}

const DAY_MS = 24 * 60 * 60 * 1000

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

const parseDate = (value: unknown): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value as string | number)
  return Number.isNaN(date.getTime()) ? null : date
}

const getFirstValidDate = (...values: unknown[]) => {
  for (const value of values) {
    const date = parseDate(value)
    if (date) return date
  }
  return null
}

const getOrderTimestamp = (order: AdminDashboardOrder) =>
  getFirstValidDate(order.order_date, order.orderDate, order.created_at, order.createdAt)

const getUpdatedTimestamp = (order: AdminDashboardOrder) =>
  getFirstValidDate(order.delivered_at, order.deliveredAt, order.updated_at, order.updatedAt)

const isSameLocalDay = (date: Date, target: Date) =>
  date.getFullYear() === target.getFullYear() &&
  date.getMonth() === target.getMonth() &&
  date.getDate() === target.getDate()

const formatLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const getStatus = (order: AdminDashboardOrder) =>
  normalizeText(order.order_status || order.orderStatus).toLowerCase()

const getCourierName = (order: AdminDashboardOrder) =>
  normalizeText(
    order.courier_partner || order.courierPartner || order.integration_type || order.integrationType,
    'Unknown',
  )

const getPickupCity = (order: AdminDashboardOrder) => {
  const pickupDetails = order.pickup_details || order.pickupDetails || {}
  return normalizeText(
    order.pickup_city || order.pickupCity || pickupDetails?.city || order.city,
    'Unknown',
  )
}

const getDestinationCity = (order: AdminDashboardOrder) =>
  normalizeText(order.destination_city || order.destinationCity || order.city, 'Unknown')

const getShippingCharge = (order: AdminDashboardOrder) =>
  toNumber(order.shipping_charges ?? order.shippingCharge ?? order.shipping_charge)

const getFreightCharge = (order: AdminDashboardOrder) =>
  toNumber(order.freight_charges ?? order.freightCharges)

const getCourierCost = (order: AdminDashboardOrder) =>
  toNumber(order.courier_cost ?? order.courierCost)

const getPlatformRevenue = (order: AdminDashboardOrder) => {
  const freightCharge = getFreightCharge(order)
  const courierCost = getCourierCost(order)
  return freightCharge > 0 && courierCost > 0 ? freightCharge - courierCost : 0
}

const getCodAmount = (order: AdminDashboardOrder) =>
  toNumber(order.cod_amount ?? order.codAmount ?? order.order_amount ?? order.orderAmount)

const isCodOrder = (order: AdminDashboardOrder) => {
  const orderType = normalizeText(order.order_type || order.orderType).toLowerCase()
  const paymentMethod = normalizeText(order.payment_method || order.paymentMethod).toUpperCase()
  return orderType === 'cod' || paymentMethod === 'COD'
}

const serviceProviderLabel = (provider: unknown) => {
  const value = normalizeText(provider, 'unknown').toLowerCase()
  const labels: Record<string, string> = {
    delhivery: 'Delhivery',
    ekart: 'Ekart',
    xpressbees: 'Xpressbees',
    shipmozo: 'Shipmozo',
    shipway: 'Shipway',
  }
  return labels[value] || 'Other'
}

const getLastDays = (today: Date, days: number) =>
  Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - 1 - index))
    return date
  })

export const getAdminDashboardStats = async () => {
  const [
    b2cOrdersRaw,
    b2bOrdersRaw,
    userRows,
    kycRows,
    ticketRows,
    courierRows,
    codRows,
    weightRows,
    ndrRows,
    rtoRows,
  ] = await Promise.all([
    db.select().from(b2c_orders),
    db.select().from(b2b_orders),
    db
      .select({
        id: users.id,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, 'customer')),
    db
      .select({
        userId: kyc.userId,
        status: kyc.status,
      })
      .from(kyc),
    db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)),
    db.select().from(couriers),
    db.select().from(codRemittances),
    db.select().from(weight_discrepancies),
    db
      .select({
        orderId: ndr_events.order_id,
      })
      .from(ndr_events),
    db
      .select({
        orderId: rto_events.order_id,
      })
      .from(rto_events),
  ])

  const orders: AdminDashboardOrder[] = [
    ...b2cOrdersRaw.map((order) => ({ ...order, shipmentType: 'b2c' as const })),
    ...b2bOrdersRaw.map((order) => ({ ...order, shipmentType: 'b2b' as const })),
  ]

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastMonth = new Date(today)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const ndrOrderIds = new Set(ndrRows.map((row) => String(row.orderId)))
  const rtoOrderIds = new Set(rtoRows.map((row) => String(row.orderId)))
  const ndrKeywords = ['ndr', 'undelivered', 'delivery_attempt_failed', 'door_closed', 'address_issue']

  const isNdrOrder = (order: AdminDashboardOrder) => {
    const status = getStatus(order)
    return ndrOrderIds.has(String(order.id)) || ndrKeywords.some((keyword) => status.includes(keyword))
  }

  const isRtoOrder = (order: AdminDashboardOrder) => {
    const status = getStatus(order)
    return rtoOrderIds.has(String(order.id)) || status.includes('rto') || status === 'returned_to_origin'
  }

  const nonCancelledOrders = orders.filter((order) => getStatus(order) !== 'cancelled')
  const operationalBaseCount = nonCancelledOrders.length

  const todayOrders = orders.filter((order) => {
    const orderDate = getOrderTimestamp(order)
    return orderDate ? isSameLocalDay(orderDate, today) : false
  })

  const todayPendingOrders = todayOrders.filter((order) =>
    ['pending', 'booked', 'pickup_initiated'].includes(getStatus(order)),
  )
  const todayInTransitOrders = todayOrders.filter((order) =>
    ['shipment_created', 'in_transit', 'out_for_delivery'].includes(getStatus(order)),
  )
  const deliveredToday = orders.filter((order) => {
    const deliveredDate = getUpdatedTimestamp(order)
    return getStatus(order) === 'delivered' && deliveredDate
      ? isSameLocalDay(deliveredDate, today)
      : false
  })
  const todayNdrOrders = todayOrders.filter(isNdrOrder)
  const todayStuckOrders = todayOrders.filter((order) => {
    const orderDate = getOrderTimestamp(order)
    if (!orderDate) return false
    const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / DAY_MS)
    return ['in_transit', 'out_for_delivery'].includes(getStatus(order)) && daysDiff > 5
  })

  const totalShippingCharges = orders.reduce((sum, order) => sum + getShippingCharge(order), 0)
  const totalFreightCharges = orders.reduce((sum, order) => sum + getFreightCharge(order), 0)
  const totalCourierCosts = orders.reduce((sum, order) => sum + getCourierCost(order), 0)
  const totalRevenue = orders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  const todayShippingCharges = todayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0)
  const todayRevenue = todayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0)
  const codOrders = orders.filter(isCodOrder)
  const codAmount = codOrders.reduce((sum, order) => sum + getCodAmount(order), 0)
  const codRemittanceDue = codRows
    .filter((row) => row.status === 'pending')
    .reduce((sum, row) => sum + toNumber(row.remittableAmount), 0)

  const deliveredOrders = orders.filter((order) => getStatus(order) === 'delivered')
  const deliverySuccessRate =
    operationalBaseCount > 0 ? Math.round((deliveredOrders.length / operationalBaseCount) * 100) : 0
  const activeNdrOrders = orders.filter(isNdrOrder)
  const ndrRate =
    operationalBaseCount > 0 ? Math.round((activeNdrOrders.length / operationalBaseCount) * 100) : 0
  const rtoOrders = orders.filter(isRtoOrder)
  const rtoRate =
    operationalBaseCount > 0 ? Math.round((rtoOrders.length / operationalBaseCount) * 100) : 0

  const deliveredOrdersWithDates = deliveredOrders.filter((order) => {
    const created = getOrderTimestamp(order)
    const delivered = getUpdatedTimestamp(order)
    return Boolean(created && delivered)
  })
  const avgDeliveryTime =
    deliveredOrdersWithDates.length > 0
      ? Math.round(
          deliveredOrdersWithDates.reduce((sum, order) => {
            const created = getOrderTimestamp(order)
            const delivered = getUpdatedTimestamp(order)
            if (!created || !delivered) return sum
            return sum + Math.max(0, Math.floor((delivered.getTime() - created.getTime()) / DAY_MS))
          }, 0) / deliveredOrdersWithDates.length,
        )
      : 0

  const openTickets = ticketRows.filter((ticket) => ticket.status === 'open')
  const inProgressTickets = ticketRows.filter((ticket) => ticket.status === 'in_progress')
  const overdueTickets = ticketRows.filter((ticket) => {
    const dueDate = parseDate(ticket.dueDate)
    return dueDate && dueDate < now && ['open', 'in_progress'].includes(ticket.status || '')
  })
  const pendingKyc = kycRows.filter((row) =>
    ['pending', 'verification_in_progress'].includes(row.status || ''),
  )
  const activeWeightDiscrepancies = weightRows.filter((row) =>
    ['pending', 'disputed'].includes(normalizeText(row.status).toLowerCase()),
  )

  const courierPerformance = orders.reduce<Record<string, any>>((acc, order) => {
    const courierName = getCourierName(order)
    if (!acc[courierName]) {
      acc[courierName] = {
        count: 0,
        delivered: 0,
        ndr: 0,
        rto: 0,
        revenue: 0,
        shippingCharges: 0,
        freightCharges: 0,
        courierCosts: 0,
        avgDeliveryTime: 0,
        deliveryTimes: [] as number[],
      }
    }

    if (getStatus(order) !== 'cancelled') acc[courierName].count += 1
    acc[courierName].shippingCharges += getShippingCharge(order)
    acc[courierName].freightCharges += getFreightCharge(order)
    acc[courierName].courierCosts += getCourierCost(order)
    acc[courierName].revenue += getPlatformRevenue(order)

    if (getStatus(order) === 'delivered') {
      acc[courierName].delivered += 1
      const created = getOrderTimestamp(order)
      const delivered = getUpdatedTimestamp(order)
      if (created && delivered) {
        acc[courierName].deliveryTimes.push(
          Math.max(0, Math.floor((delivered.getTime() - created.getTime()) / DAY_MS)),
        )
      }
    }
    if (isNdrOrder(order)) acc[courierName].ndr += 1
    if (isRtoOrder(order)) acc[courierName].rto += 1

    return acc
  }, {})

  Object.keys(courierPerformance).forEach((courierName) => {
    const courier = courierPerformance[courierName]
    courier.deliveryRate =
      courier.count > 0 ? Math.round((courier.delivered / courier.count) * 100) : 0
    courier.ndrRate = courier.count > 0 ? Math.round((courier.ndr / courier.count) * 100) : 0
    courier.rtoRate = courier.count > 0 ? Math.round((courier.rto / courier.count) * 100) : 0
    courier.avgDeliveryTime =
      courier.deliveryTimes.length > 0
        ? Math.round(
            courier.deliveryTimes.reduce((sum: number, days: number) => sum + days, 0) /
              courier.deliveryTimes.length,
          )
        : 0
    delete courier.deliveryTimes
  })

  const originCities = orders.reduce<Record<string, number>>((acc, order) => {
    const city = getPickupCity(order)
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const destinationCities = orders.reduce<Record<string, number>>((acc, order) => {
    const city = getDestinationCity(order)
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {})
  const orderStatusCounts = orders.reduce<Record<string, number>>((acc, order) => {
    const status = normalizeText(order.order_status || order.orderStatus, 'unknown')
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  const chartDays = getLastDays(today, 7)
  const ordersByDate = chartDays.map((date) => {
    const dayOrders = orders.filter((order) => {
      const orderDate = getOrderTimestamp(order)
      return orderDate ? isSameLocalDay(orderDate, date) : false
    })
    return {
      date: formatLocalDateKey(date),
      orders: dayOrders.length,
    }
  })

  const revenueByDate = chartDays.map((date) => {
    const dayOrders = orders.filter((order) => {
      const orderDate = getOrderTimestamp(order)
      return orderDate ? isSameLocalDay(orderDate, date) : false
    })
    return {
      date: formatLocalDateKey(date),
      revenue: dayOrders.reduce((sum, order) => sum + getPlatformRevenue(order), 0),
    }
  })

  const shippingChargesByDate = chartDays.map((date) => {
    const dayOrders = orders.filter((order) => {
      const orderDate = getOrderTimestamp(order)
      return orderDate ? isSameLocalDay(orderDate, date) : false
    })
    return {
      date: formatLocalDateKey(date),
      shippingCharges: dayOrders.reduce((sum, order) => sum + getShippingCharge(order), 0),
    }
  })

  const ordersByIntegration = chartDays.map((date) => {
    const dayOrders = orders.filter((order) => {
      const orderDate = getOrderTimestamp(order)
      return orderDate ? isSameLocalDay(orderDate, date) : false
    })
    return dayOrders.reduce<Record<string, number | string>>(
      (acc, order) => {
        const courierName = getCourierName(order)
        acc[courierName] = toNumber(acc[courierName]) + 1
        return acc
      },
      { date: formatLocalDateKey(date) },
    )
  })

  const todayUsers = userRows.filter((user) => {
    const createdAt = parseDate(user.createdAt)
    return createdAt ? isSameLocalDay(createdAt, today) : false
  })
  const lastWeekUsers = userRows.filter((user) => {
    const createdAt = parseDate(user.createdAt)
    return createdAt ? createdAt >= lastWeek : false
  })
  const activeUserIds = new Set<string>()
  const veryActiveUserIds = new Set<string>()
  orders.forEach((order) => {
    const orderDate = getOrderTimestamp(order)
    if (!orderDate || getStatus(order) === 'cancelled' || !order.user_id) return
    if (orderDate >= lastMonth) activeUserIds.add(String(order.user_id))
    if (orderDate >= lastWeek) veryActiveUserIds.add(String(order.user_id))
  })

  const couriersByServiceProvider = courierRows.reduce<Record<string, number>>((acc, courier) => {
    const label = serviceProviderLabel(courier.serviceProvider)
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})

  const recentOrders = [...orders]
    .sort((a, b) => (getOrderTimestamp(b)?.getTime() || 0) - (getOrderTimestamp(a)?.getTime() || 0))
    .slice(0, 10)

  return {
    success: true,
    data: {
      todayOperations: {
        orders: todayOrders.length,
        pending: todayPendingOrders.length,
        inTransit: todayInTransitOrders.length,
        delivered: deliveredToday.length,
        ndr: todayNdrOrders.length,
        stuck: todayStuckOrders.length,
      },
      financial: {
        todayShippingCharges,
        todayRevenue,
        totalShippingCharges,
        totalFreightCharges,
        totalCourierCosts,
        totalRevenue,
        codAmount,
        codRemittanceDue,
        codStats: {
          totalCollected: codRows
            .filter((row) => row.status === 'credited')
            .reduce((sum, row) => sum + toNumber(row.remittableAmount), 0),
          remitted: codRows
            .filter((row) => {
              const creditedAt = parseDate(row.creditedAt)
              return row.status === 'credited' && creditedAt ? isSameLocalDay(creditedAt, today) : false
            })
            .reduce((sum, row) => sum + toNumber(row.remittableAmount), 0),
          pendingRemittance: codRemittanceDue,
        },
      },
      operational: {
        deliverySuccessRate,
        ndrRate,
        rtoRate,
        avgDeliveryTime,
        totalOrders: orders.length,
        deliveredOrders: deliveredOrders.length,
        ndrOrders: activeNdrOrders.length,
        rtoOrders: rtoOrders.length,
      },
      alerts: {
        openTickets: openTickets.length,
        inProgressTickets: inProgressTickets.length,
        overdueTickets: overdueTickets.length,
        pendingKyc: pendingKyc.length,
        weightDiscrepancies: activeWeightDiscrepancies.length,
        ndrKpis: {
          totalEvents: ndrRows.length,
          affectedOrders: ndrOrderIds.size,
        },
        rtoKpis: {
          totalEvents: rtoRows.length,
          affectedOrders: rtoOrderIds.size,
        },
      },
      couriers: {
        performance: courierPerformance,
        total: courierRows.length,
        byServiceProvider: couriersByServiceProvider,
      },
      geographic: {
        topOriginCities: Object.entries(originCities)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([city, cityCount]) => ({ city, count: cityCount })),
        topDestinationCities: Object.entries(destinationCities)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([city, cityCount]) => ({ city, count: cityCount })),
      },
      users: {
        total: userRows.length,
        today: todayUsers.length,
        lastWeek: lastWeekUsers.length,
        active: activeUserIds.size,
        veryActive: veryActiveUserIds.size,
        pendingKyc: pendingKyc.length,
      },
      charts: {
        ordersByDate,
        ordersByIntegration,
        shippingChargesByDate,
        revenueByDate,
      },
      orderStatusCounts,
      recentOrders,
      recentTickets: ticketRows.slice(0, 10),
    },
  }
}
