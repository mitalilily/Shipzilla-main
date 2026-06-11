import { count, isNull, notInArray, or, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { shippingRates } from '../models/schema/shippingRates'
import { getIntegratedCourierProviders } from '../utils/courierProviders'

const main = async () => {
  const integratedProviders = getIntegratedCourierProviders()
  const courierProvider = sql<string>`LOWER(${couriers.serviceProvider})`
  const shippingRateProvider = sql<string>`COALESCE(LOWER(${shippingRates.service_provider}), '<missing>')`

  const courierBefore = await db
    .select({
      serviceProvider: courierProvider,
      total: count(),
    })
    .from(couriers)
    .groupBy(courierProvider)
    .orderBy(courierProvider)

  const shippingRateBefore = await db
    .select({
      serviceProvider: shippingRateProvider,
      total: count(),
    })
    .from(shippingRates)
    .groupBy(shippingRateProvider)
    .orderBy(shippingRateProvider)

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

  const courierAfter = await db
    .select({
      serviceProvider: courierProvider,
      total: count(),
    })
    .from(couriers)
    .groupBy(courierProvider)
    .orderBy(courierProvider)

  const shippingRateAfter = await db
    .select({
      serviceProvider: shippingRateProvider,
      total: count(),
    })
    .from(shippingRates)
    .groupBy(shippingRateProvider)
    .orderBy(shippingRateProvider)

  console.log('Integrated providers:', integratedProviders.join(', '))
  console.log('Courier rows before purge:')
  console.table(courierBefore)
  console.log('Shipping rate rows before purge:')
  console.table(shippingRateBefore)
  console.log(`Deleted unsupported shipping rates: ${deletedRates.length}`)
  console.log(`Deleted unsupported couriers: ${deletedCouriers.length}`)
  console.log('Courier rows after purge:')
  console.table(courierAfter)
  console.log('Shipping rate rows after purge:')
  console.table(shippingRateAfter)
}

main()
  .catch((error) => {
    console.error('Failed to purge unsupported couriers:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
