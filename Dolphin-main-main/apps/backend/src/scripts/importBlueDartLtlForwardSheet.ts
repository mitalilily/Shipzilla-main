import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { and, eq, sql } from 'drizzle-orm'
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
  planName?: string
  serviceProvider?: string
  businessType?: 'b2b' | 'b2c'
  notes?: string[]
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

type CourierTarget = {
  id: number
  name: string
  serviceProvider: string
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
    businessType: getArg('--business-type') || '',
    planId: getArg('--plan-id') || '',
    planName: getArg('--plan-name') || '',
    allCouriers: args.includes('--all-couriers'),
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

const normalizeBusinessType = (value?: string) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'b2b' || normalized === 'b2c') {
    return normalized as 'b2b' | 'b2c'
  }

  throw new Error(`Invalid business type: ${value}. Expected "b2b" or "b2c".`)
}

const buildBusinessTypeFilter = (businessType: 'b2b' | 'b2c') =>
  businessType === 'b2b'
    ? sql`${couriers.businessType} @> '["b2b"]'::jsonb`
    : sql`${couriers.businessType} @> '["b2c"]'::jsonb`

const resolvePlan = async (params: { planId?: string; planName?: string }) => {
  if (params.planId) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, params.planId)).limit(1)
    if (!plan) {
      throw new Error(`Plan not found for id=${params.planId}`)
    }
    return plan
  }

  if (params.planName) {
    const [plan] = await db.select().from(plans).where(eq(plans.name, params.planName)).limit(1)
    if (!plan) {
      throw new Error(`Plan not found for name=${params.planName}`)
    }
    return plan
  }

  throw new Error('Provide either --plan-id <uuid> or --plan-name <name>.')
}

const resolveCourierTargets = async (params: {
  courierId?: number
  serviceProvider?: string
  businessType: 'b2b' | 'b2c'
  allCouriers?: boolean
}): Promise<CourierTarget[]> => {
  if (params.allCouriers) {
    if (!params.serviceProvider) {
      throw new Error('When using --all-couriers, --service-provider is required.')
    }

    const providerCouriers = await db
      .select({
        id: couriers.id,
        name: couriers.name,
        serviceProvider: couriers.serviceProvider,
      })
      .from(couriers)
      .where(
        and(
          eq(couriers.serviceProvider, params.serviceProvider),
          eq(couriers.isEnabled, true),
          buildBusinessTypeFilter(params.businessType),
        ),
      )

    if (!providerCouriers.length) {
      throw new Error(
        `No enabled ${params.businessType.toUpperCase()} couriers found for serviceProvider=${params.serviceProvider}`,
      )
    }

    return providerCouriers
  }

  if (!params.courierId || !params.serviceProvider) {
    throw new Error(
      'Usage: ts-node src/scripts/importBlueDartLtlForwardSheet.ts --courier-id <id> --service-provider <provider> (--plan-id <uuid> | --plan-name <name>) [--apply] [--sheet <path>]',
    )
  }

  const [courier] = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
    })
    .from(couriers)
    .where(
      and(
        eq(couriers.id, params.courierId),
        eq(couriers.serviceProvider, params.serviceProvider),
        eq(couriers.isEnabled, true),
        buildBusinessTypeFilter(params.businessType),
      ),
    )
    .limit(1)

  if (!courier) {
    throw new Error(
      `Courier scope not found for id=${params.courierId} serviceProvider=${params.serviceProvider} businessType=${params.businessType}`,
    )
  }

  return [courier]
}

const applySheetToCourier = async (params: {
  courier: CourierTarget
  planId: string
  matrixPayload: Array<{
    originZoneCode: string
    destinationZoneCode: string
    baseRate: number
    upliftedRate: number
  }>
  sheet: SheetFile
  zoneMap: Map<string, string>
}) => {
  for (const row of params.matrixPayload) {
    await upsertZoneToZoneRate({
      originZoneId: params.zoneMap.get(row.originZoneCode.toUpperCase()) as string,
      destinationZoneId: params.zoneMap.get(row.destinationZoneCode.toUpperCase()) as string,
      ratePerKg: row.upliftedRate,
      planId: params.planId,
      courierScope: {
        courierId: params.courier.id,
        serviceProvider: params.courier.serviceProvider,
      },
    })
  }

  await upsertAdditionalCharges({
    ...params.sheet.additionalCharges,
    planId: params.planId,
    courierScope: {
      courierId: params.courier.id,
      serviceProvider: params.courier.serviceProvider,
    },
  })

  if (params.sheet.volumetricRules) {
    await upsertVolumetricRules({
      ...params.sheet.volumetricRules,
      courierScope: {
        courierId: params.courier.id,
        serviceProvider: params.courier.serviceProvider,
      },
    })
  }

  for (const rule of params.sheet.overheadRules || []) {
    await upsertOverheadRule({
      ...rule,
      planId: params.planId,
      courierScope: {
        courierId: params.courier.id,
        serviceProvider: params.courier.serviceProvider,
      },
    })
  }
}

async function main() {
  const {
    courierId,
    serviceProvider,
    businessType,
    planId,
    planName,
    allCouriers,
    apply,
    sheetPath,
  } = parseArgs()

  const sheet = readSheet(sheetPath)
  const targetPlanName = planName || sheet.planName || ''
  const targetServiceProvider = serviceProvider || sheet.serviceProvider || ''
  const targetBusinessType = normalizeBusinessType(businessType || sheet.businessType || 'b2b')

  const plan = await resolvePlan({ planId, planName: targetPlanName })
  const courierTargets = await resolveCourierTargets({
    courierId,
    serviceProvider: targetServiceProvider,
    businessType: targetBusinessType,
    allCouriers,
  })

  const zoneRows = await db.select({ id: zones.id, code: zones.code }).from(zones).where(
    eq(zones.business_type, targetBusinessType === 'b2b' ? 'B2B' : 'B2C'),
  )

  const zoneMap = new Map(zoneRows.map((zone) => [String(zone.code).toUpperCase(), zone.id]))
  const missingZones = sheet.zoneCodes.filter((code) => !zoneMap.has(code.toUpperCase()))
  if (missingZones.length > 0) {
    throw new Error(`Missing ${targetBusinessType.toUpperCase()} zones: ${missingZones.join(', ')}`)
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
  console.log(`Target scope count: ${courierTargets.length}`)
  console.log(`Target plan: ${plan.name} (${plan.id})`)
  console.log(`Target business type: ${targetBusinessType}`)
  console.log(
    `Target couriers: ${courierTargets
      .map((courier) => `${courier.name} [${courier.id}]`)
      .join(', ')}`,
  )
  console.log(`Matrix uplift: ${sheet.matrixRateIncreasePercent}%`)
  console.log(
    `Example uplift: ${matrixPayload[0].originZoneCode} -> ${matrixPayload[0].destinationZoneCode} ${matrixPayload[0].baseRate} => ${matrixPayload[0].upliftedRate}`,
  )

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to import the sheet into the database.')
    return
  }

  for (const courier of courierTargets) {
    console.log(
      `Applying sheet to courier=${courier.name} (${courier.id}) provider=${courier.serviceProvider} plan=${plan.name}`,
    )
    await applySheetToCourier({
      courier,
      planId: plan.id,
      matrixPayload,
      sheet,
      zoneMap,
    })
  }

  console.log(
    `BlueDart LTL B2B sheet imported successfully for ${courierTargets.length} courier scope(s).`,
  )
}

main().catch((error) => {
  console.error('Failed to import BlueDart LTL B2B sheet:', error)
  process.exit(1)
})
