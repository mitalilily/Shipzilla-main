import { count, isNull, notInArray, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { couriers } from '../schema/couriers'
import { shippingRates } from '../schema/shippingRates'
import { getIntegratedCourierProviders } from '../../utils/courierProviders'

const courierProvider = sql<string>`LOWER(${couriers.serviceProvider})`
const shippingRateProvider = sql<string>`COALESCE(LOWER(${shippingRates.service_provider}), '<missing>')`

const getCourierProviderSummary = () =>
  db
    .select({
      serviceProvider: courierProvider,
      total: count(),
    })
    .from(couriers)
    .groupBy(courierProvider)
    .orderBy(courierProvider)

const getShippingRateProviderSummary = () =>
  db
    .select({
      serviceProvider: shippingRateProvider,
      total: count(),
    })
    .from(shippingRates)
    .groupBy(shippingRateProvider)
    .orderBy(shippingRateProvider)

export const purgeUnsupportedCourierData = async () => {
  const integratedProviders = getIntegratedCourierProviders()

  const courierBefore = await getCourierProviderSummary()
  const shippingRateBefore = await getShippingRateProviderSummary()

  const deletedRates = await db
    .delete(shippingRates)
    .where(
      or(
        isNull(shippingRates.service_provider),
        notInArray(sql`LOWER(${shippingRates.service_provider})`, integratedProviders),
      ),
    )
    .returning({
      id: shippingRates.id,
      courierName: shippingRates.courier_name,
      serviceProvider: shippingRates.service_provider,
    })

  const deletedCouriers = await db
    .delete(couriers)
    .where(notInArray(sql`LOWER(${couriers.serviceProvider})`, integratedProviders))
    .returning({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
    })

  const courierAfter = await getCourierProviderSummary()
  const shippingRateAfter = await getShippingRateProviderSummary()

  return {
    integratedProviders,
    courierBefore,
    shippingRateBefore,
    deletedRates,
    deletedCouriers,
    courierAfter,
    shippingRateAfter,
  }
}
