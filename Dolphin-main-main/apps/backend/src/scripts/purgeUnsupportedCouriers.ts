import { count, notInArray } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { couriers } from '../models/schema/couriers'
import { getIntegratedCourierProviders } from '../utils/courierProviders'

const main = async () => {
  const integratedProviders = getIntegratedCourierProviders()

  const before = await db
    .select({
      serviceProvider: couriers.serviceProvider,
      total: count(),
    })
    .from(couriers)
    .groupBy(couriers.serviceProvider)
    .orderBy(couriers.serviceProvider)

  const deleted = await db
    .delete(couriers)
    .where(notInArray(couriers.serviceProvider, integratedProviders))
    .returning({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
    })

  const after = await db
    .select({
      serviceProvider: couriers.serviceProvider,
      total: count(),
    })
    .from(couriers)
    .groupBy(couriers.serviceProvider)
    .orderBy(couriers.serviceProvider)

  console.log('Integrated providers:', integratedProviders.join(', '))
  console.table(before)
  console.log(`Deleted unsupported couriers: ${deleted.length}`)
  console.table(after)
}

main()
  .catch((error) => {
    console.error('Failed to purge unsupported couriers:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
