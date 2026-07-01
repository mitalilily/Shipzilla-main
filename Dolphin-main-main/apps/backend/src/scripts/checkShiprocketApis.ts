import * as dotenv from 'dotenv'
import path from 'path'
import {
  checkCourierServiceability,
  getPickupLocations,
  getShiprocketToken,
  getWalletBalance,
  listCouriersWithCounts,
} from '../models/services/shiprocketExtended.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type CheckResult = {
  name: string
  ok: boolean
  details: string
}

const formatError = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function runCheck(name: string, fn: () => Promise<unknown>): Promise<CheckResult> {
  process.stdout.write(`[Shiprocket B2B check] ${name} ... `)
  try {
    const result = await fn()
    const details =
      result && typeof result === 'object'
        ? JSON.stringify(result).slice(0, 240)
        : String(result ?? 'ok')
    console.log('ok')
    return { name, ok: true, details }
  } catch (error) {
    const details = formatError(error)
    console.log('failed')
    return { name, ok: false, details }
  }
}

async function main() {
  const checks = await Promise.all([
    runCheck('Auth token', async () => {
      const token = await getShiprocketToken({ skipCache: true })
      return { tokenLength: token.length }
    }),
    runCheck('Courier catalog', async () => {
      const response = await listCouriersWithCounts({ type: 'active' })
      const data = Array.isArray((response as any)?.data) ? (response as any).data : []
      return { activeCouriers: data.length }
    }),
    runCheck('Pickup locations', async () => {
      const response = await getPickupLocations()
      const data = Array.isArray((response as any)?.data) ? (response as any).data : []
      return { pickupLocations: data.length }
    }),
    runCheck('Wallet balance', async () => {
      const response = await getWalletBalance()
      return {
        balance:
          (response as any)?.data?.balance ??
          (response as any)?.balance ??
          (response as any)?.wallet_balance ??
          null,
      }
    }),
    runCheck('B2B serviceability', async () => {
      const response = await checkCourierServiceability({
        pickup_postcode: Number(process.env.SHIPROCKET_TEST_PICKUP_PINCODE || 122001),
        delivery_postcode: Number(process.env.SHIPROCKET_TEST_DELIVERY_PINCODE || 110001),
        cod: 0,
        weight: Number(process.env.SHIPROCKET_TEST_WEIGHT_KG || 1),
        length: Number(process.env.SHIPROCKET_TEST_LENGTH_CM || 20),
        breadth: Number(process.env.SHIPROCKET_TEST_BREADTH_CM || 20),
        height: Number(process.env.SHIPROCKET_TEST_HEIGHT_CM || 20),
        declared_value: Number(process.env.SHIPROCKET_TEST_DECLARED_VALUE || 1000),
      })

      const data = Array.isArray((response as any)?.data) ? (response as any).data : []
      return { serviceableOptions: data.length }
    }),
  ])

  const failed = checks.filter((check) => !check.ok)
  console.log('\n[Shiprocket B2B check] Summary')
  for (const check of checks) {
    console.log(`- ${check.name}: ${check.ok ? 'ok' : 'failed'} (${check.details})`)
  }

  if (failed.length) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`[Shiprocket B2B check] failed: ${formatError(error)}`)
  process.exit(1)
})
