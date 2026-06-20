import { pool } from '../models/client'
import { purgeUnsupportedCourierCredentials } from '../models/services/courierCleanup.service'

const main = async () => {
  const result = await purgeUnsupportedCourierCredentials()

  console.log('Allowed credential providers:', result.allowedProviders.join(', '))
  console.log('Courier credential rows before purge:')
  console.table(result.courierCredentialBefore)
  console.log(`Deleted unsupported credential rows: ${result.deletedCredentials.length}`)
  if (result.deletedCredentials.length) {
    console.table(result.deletedCredentials)
  }
  console.log('Courier credential rows after purge:')
  console.table(result.courierCredentialAfter)
}

main()
  .catch((error) => {
    console.error('Failed to purge unsupported courier credentials:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
