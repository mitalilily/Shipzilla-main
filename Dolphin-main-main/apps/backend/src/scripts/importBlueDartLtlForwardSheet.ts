import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { and, eq } from 'drizzle-orm'
import { db } from '../models/client'
import { upsertZoneToZoneRate, upsertOverheadRule } from '../models/services/b2bAdmin.service'
import {
  upsertAdditionalCharges,
  upsertVolumetricRules,
} from '../models/services/b2bPricingConfig.service'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { zones } from '../models/schema/zones'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type SheetRule = {
  code: string
  name: string
  description?: string
  type:
    | 'flat_awb'
    | 'flat'
    | 'percent'
    | 'per_kg'
    | 'per_awb_day'
    | 'per_kg_or_flat'
    | 'percent_or_flat'
  amount?: number
  percent?: number
  appliesTo?: 'freight' | 'final' | 'cod' | 'all'
  priority?: number
  condition?: Record<string, unknown>
}

type SheetFile = {
  serviceName: string
  matrixRateIncreasePercent: number
  zoneCodes: string[]
  matrix: Array<{
    origin: string
    rates: Record<string, number>
  }>
  additionalCharges: {
    awbCharges?: number
    cftFactor?: number
    minimumChargeableAmount?: number
    minimumChargeableWeight?: number
    minimumChargeableMethod?: 'whichever_is_higher' | 'whichever_is_lower'
    fuelSurchargePercentage?: number
    odaCharges?: number
    odaPerKgCharge?: number
    odaMethod?: 'whichever_is_higher' | 'whichever_is_lower'
    rovFixedAmount?: number
    rovPercentage?: number
    rovMethod?: 'whichever_is_higher' | 'whichever_is_lower'
  }
  volumetricRules?: {
    volumetricDivisor?: number
    cftFactor?: number
    minimumVolumetricWeight?: number
  }
  overheadRules?: SheetRule[]
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const getArg = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }

  return {
    courierId: Number(getArg('--courier-id') || ''),
    serviceProvider: getArg('--service-provider') || '',
    planId: getArg('--plan-id') || '',
    apply: args.includes('--apply'),
    sheetPath:
      getArg('--sheet') ||
      path.resolve(__dirname, './data/b2b/bluedart-ltl-forward-sheet.json'),
  }
}

const readSheet = (sheetPath: string): SheetFile => {
  const raw = fs.readFileSync(sheetPath, 'utf8')
  return JSON.parse(raw) as SheetFile
}

const toRatePerKg = (baseRate: number, upliftPercent: number) =>
  Number((baseRate * (1 + upliftPercent / 100)).toFixed(4))

async function main() {
  const { courierId, serviceProvider, planId, apply, sheetPath } = parseArgs()

  if (!courierId || !serviceProvider || !planId) {
    throw new Error(
      'Usage: ts-node src/scripts/importBlueDartLtlForwardSheet.ts --courier-id <id> --service-provider <provider> --plan-id <uuid> [--apply] [--sheet <path>]',
    )
  }

  const sheet = readSheet(sheetPath)

  const [courier] = await db
    .select()
    .from(couriers)
    .where(and(eq(couriers.id, courierId), eq(couriers.serviceProvider, serviceProvider)))
    .limit(1)

  if (!courier) {
    throw new Error(`Courier scope not found for id=${courierId} serviceProvider=${serviceProvider}`)
  }

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
  if (!plan) {
    throw new Error(`Plan not found for id=${planId}`)
  }

  const zoneRows = await db
    .select({ id: zones.id, code: zones.code })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))

  const zoneMap = new Map(zoneRows.map((zone) => [String(zone.code).toUpperCase(), zone.id]))
  const missingZones = sheet.zoneCodes.filter((code) => !zoneMap.has(code.toUpperCase()))
  if (missingZones.length > 0) {
    throw new Error(`Missing B2B zones: ${missingZones.join(', ')}`)
  }

  const matrixPayload = sheet.matrix.flatMap((row) =>
    sheet.zoneCodes.map((destinationCode) => ({
      originZoneCode: row.origin,
      destinationZoneCode: destinationCode,
      baseRate: Number(row.rates[destinationCode]),
      upliftedRate: toRatePerKg(Number(row.rates[destinationCode]), sheet.matrixRateIncreasePercent),
    })),
  )

  console.log(`Preparing ${matrixPayload.length} matrix rows for ${sheet.serviceName}`)
  console.log(
    `Target scope: courier=${courier.name} (${serviceProvider}) plan=${plan.name} (${planId})`,
  )
  console.log(`Matrix uplift: ${sheet.matrixRateIncreasePercent}%`)
  console.log(
    `Example uplift: ${matrixPayload[0].originZoneCode} -> ${matrixPayload[0].destinationZoneCode} ${matrixPayload[0].baseRate} => ${matrixPayload[0].upliftedRate}`,
  )

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to import the sheet into the database.')
    return
  }

  for (const row of matrixPayload) {
    await upsertZoneToZoneRate({
      originZoneId: zoneMap.get(row.originZoneCode.toUpperCase()) as string,
      destinationZoneId: zoneMap.get(row.destinationZoneCode.toUpperCase()) as string,
      ratePerKg: row.upliftedRate,
      planId,
      courierScope: {
        courierId,
        serviceProvider,
      },
    })
  }

  await upsertAdditionalCharges({
    ...sheet.additionalCharges,
    planId,
    courierScope: {
      courierId,
      serviceProvider,
    },
  })

  if (sheet.volumetricRules) {
    await upsertVolumetricRules({
      ...sheet.volumetricRules,
      courierScope: {
        courierId,
        serviceProvider,
      },
    })
  }

  for (const rule of sheet.overheadRules || []) {
    await upsertOverheadRule({
      ...rule,
      planId,
      courierScope: {
        courierId,
        serviceProvider,
      },
    })
  }

  console.log('BlueDart LTL B2B sheet imported successfully.')
}

main().catch((error) => {
  console.error('Failed to import BlueDart LTL B2B sheet:', error)
  process.exit(1)
})
