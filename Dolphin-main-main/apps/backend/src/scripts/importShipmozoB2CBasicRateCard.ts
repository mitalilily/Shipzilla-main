import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { plans } from '../models/schema/plans'
import { importShippingRatesFromCsv } from '../models/services/shippingRateImport.service'

const parseArgs = () => {
  const args = process.argv.slice(2)
  const getArg = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }

  return {
    csvPath:
      getArg('--csv') ||
      path.resolve(__dirname, './data/b2c/shipmozo_b2c_rate_card_filled.csv'),
    planName: getArg('--plan-name') || 'Basic',
    allowFailures: args.includes('--allow-failures'),
  }
}

async function main() {
  const { csvPath, planName, allowFailures } = parseArgs()
  const csvContent = fs.readFileSync(csvPath, 'utf8')

  const [plan] = await db.select().from(plans).where(eq(plans.name, planName)).limit(1)
  if (!plan) {
    throw new Error(`Plan not found for name=${planName}`)
  }

  const result = await importShippingRatesFromCsv({
    planId: plan.id,
    businessType: 'b2c',
    csvContent,
  })

  console.log(
    JSON.stringify(
      {
        planId: plan.id,
        planName: plan.name,
        csvPath,
        ...result,
      },
      null,
      2,
    ),
  )

  if (result.imported === 0) {
    throw new Error('Shipmozo B2C Basic rate-card import did not import any rows.')
  }

  if (result.failed > 0 && !allowFailures) {
    throw new Error(`Shipmozo B2C Basic rate-card import failed for ${result.failed} rows.`)
  }
}

main()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error(error)
    await pool.end()
    process.exit(1)
  })
