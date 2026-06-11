import { pool } from '../models/client'
import { purgeUnsupportedCourierData } from '../models/services/courierCleanup.service'

const main = async () => {
  const result = await purgeUnsupportedCourierData()

  console.log('Integrated providers:', result.integratedProviders.join(', '))
  console.log('Courier rows before purge:')
  console.table(result.courierBefore)
  console.log('Shipping rate rows before purge:')
  console.table(result.shippingRateBefore)
  console.log(`Deleted unsupported shipping rates: ${result.deletedRates.length}`)
  console.log(`Deleted unsupported couriers: ${result.deletedCouriers.length}`)
  console.log('Courier rows after purge:')
  console.table(result.courierAfter)
  console.log('Shipping rate rows after purge:')
  console.table(result.shippingRateAfter)
}

main()
  .catch((error) => {
    console.error('Failed to purge unsupported couriers:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
