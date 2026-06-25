import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../models/client'
import { replaceShippingRateSlabs, type RateCardSlabInput } from '../models/services/b2cRateCard.service'
import { couriers } from '../models/schema/couriers'
import { plans } from '../models/schema/plans'
import { shippingRates } from '../models/schema/shippingRates'
import { zones } from '../models/schema/zones'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type Template = {
  key: string
  displayName: string
  mode: string
  type: 'forward' | 'rto'
  baseWeightKg: number
  additionalWeightUnitKg: number
  codCharges: number
  codPercent: number
  otherCharges: number
  zoneBaseRates: Record<string, number>
  zoneAdditionalRates: Record<string, number>
}

type Assignment = {
  courierName: string
  templateKey: string
  note?: string
}

type SheetFile = {
  serviceName: string
  rateIncreasePercent: number
  planName: string
  serviceProvider: string
  businessType: 'b2c'
  notes?: string[]
  zoneMappings: Record<string, string>
  templates: Template[]
  assignments: Assignment[]
}

const parseArgs = () => {
  const args = process.argv.slice(2)
  const getArg = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }

  return {
    planName: getArg('--plan-name') || '',
    serviceProvider: getArg('--service-provider') || '',
    apply: args.includes('--apply'),
    sheetPath:
      getArg('--sheet') ||
      path.resolve(__dirname, './data/b2c/shipmozo-icarry-basic-rate-card.json'),
  }
}

const readSheet = (sheetPath: string): SheetFile => {
  const raw = fs.readFileSync(sheetPath, 'utf8')
  return JSON.parse(raw) as SheetFile
}

const toMoney = (value: number) => Number(value.toFixed(2))

const upliftRate = (value: number, percent: number) => toMoney(value * (1 + percent / 100))

async function resolvePlan(planName: string) {
  const [plan] = await db
    .select({ id: plans.id, name: plans.name })
    .from(plans)
    .where(eq(plans.name, planName))
    .limit(1)

  if (!plan) {
    throw new Error(`Plan not found for name=${planName}`)
  }

  return plan
}

async function resolveZoneMap(zoneCodes: string[]) {
  const zoneRows = await db
    .select({ id: zones.id, code: zones.code })
    .from(zones)
    .where(and(eq(zones.business_type, 'B2C'), inArray(zones.code, zoneCodes)))

  const zoneMap = new Map(zoneRows.map((zone) => [zone.code, zone.id]))
  const missing = zoneCodes.filter((code) => !zoneMap.has(code))
  if (missing.length) {
    throw new Error(`Missing B2C zones: ${missing.join(', ')}`)
  }
  return zoneMap
}

async function resolveCourierTargets(serviceProvider: string, assignments: Assignment[]) {
  const courierRows = await db
    .select({
      id: couriers.id,
      name: couriers.name,
      serviceProvider: couriers.serviceProvider,
    })
    .from(couriers)
    .where(eq(couriers.serviceProvider, serviceProvider))

  const courierMap = new Map(courierRows.map((row) => [row.name, row]))
  const missing = assignments.filter((assignment) => !courierMap.has(assignment.courierName))
  if (missing.length) {
    throw new Error(
      `Missing ${serviceProvider} couriers in catalog: ${missing
        .map((assignment) => assignment.courierName)
        .join(', ')}`,
    )
  }

  return courierMap
}

async function upsertRateCardRow(params: {
  planId: string
  courierId: number
  courierName: string
  serviceProvider: string
  mode: string
  zoneId: string
  type: 'forward' | 'rto'
  codCharges: number
  codPercent: number
  otherCharges: number
  slab: RateCardSlabInput
}) {
  const existing = await db
    .select({ id: shippingRates.id })
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.plan_id, params.planId),
        eq(shippingRates.courier_id, params.courierId),
        eq(shippingRates.business_type, 'b2c'),
        eq(shippingRates.zone_id, params.zoneId),
        eq(shippingRates.type, params.type),
        eq(sql`lower(${shippingRates.mode})`, params.mode.toLowerCase()),
        eq(sql`lower(${shippingRates.service_provider})`, params.serviceProvider.toLowerCase()),
      ),
    )
    .limit(1)

  const payload = {
    plan_id: params.planId,
    courier_id: params.courierId,
    courier_name: params.courierName,
    service_provider: params.serviceProvider.toLowerCase(),
    mode: params.mode.toLowerCase(),
    business_type: 'b2c',
    zone_id: params.zoneId,
    type: params.type,
    min_weight: params.slab.weight_to?.toFixed(3) || params.slab.weight_from.toFixed(3),
    rate: params.slab.rate.toFixed(2),
    cod_charges: params.codCharges.toFixed(2),
    cod_percent: params.codPercent.toFixed(2),
    other_charges: params.otherCharges.toFixed(2),
    last_updated: new Date(),
  }

  if (existing.length) {
    await db.update(shippingRates).set(payload).where(eq(shippingRates.id, existing[0].id))
    await replaceShippingRateSlabs(existing[0].id, [params.slab])
    return 'updated'
  }

  const [created] = await db
    .insert(shippingRates)
    .values({
      ...payload,
      created_at: new Date(),
    })
    .returning({ id: shippingRates.id })

  await replaceShippingRateSlabs(created.id, [params.slab])
  return 'created'
}

async function main() {
  const { planName, serviceProvider, apply, sheetPath } = parseArgs()
  const sheet = readSheet(sheetPath)

  const targetPlanName = planName || sheet.planName
  const targetServiceProvider = serviceProvider || sheet.serviceProvider

  if (!targetPlanName || !targetServiceProvider) {
    throw new Error('Plan name and service provider are required.')
  }

  const plan = await resolvePlan(targetPlanName)
  const templateMap = new Map(sheet.templates.map((template) => [template.key, template]))
  const allZoneCodes = Array.from(
    new Set([
      ...Object.keys(sheet.zoneMappings),
      ...Object.values(sheet.zoneMappings),
      ...sheet.templates.flatMap((template) => Object.keys(template.zoneBaseRates)),
      ...sheet.templates.flatMap((template) => Object.keys(template.zoneAdditionalRates)),
    ]),
  ).filter((code) =>
    [
      'WITHIN CITY',
      'WITHIN STATE',
      'METRO TO METRO',
      'WITHIN REGION',
      'ROI',
      'SPECIAL ZONE',
    ].includes(code),
  )

  const zoneMap = await resolveZoneMap(allZoneCodes)
  const courierMap = await resolveCourierTargets(targetServiceProvider, sheet.assignments)

  console.log(`Preparing ${sheet.assignments.length} courier assignments for ${sheet.serviceName}`)
  console.log(`Target provider: ${targetServiceProvider}`)
  console.log(`Target plan: ${plan.name} (${plan.id})`)
  console.log(`Freight uplift: ${sheet.rateIncreasePercent}%`)

  for (const assignment of sheet.assignments) {
    const template = templateMap.get(assignment.templateKey)
    if (!template) {
      throw new Error(`Template not found: ${assignment.templateKey}`)
    }

    const sampleBase = template.zoneBaseRates['WITHIN CITY']
    const sampleUplifted = upliftRate(sampleBase, sheet.rateIncreasePercent)
    console.log(
      `${assignment.courierName} -> ${template.displayName} | sample WITHIN CITY ${sampleBase} => ${sampleUplifted}${assignment.note ? ` | ${assignment.note}` : ''}`,
    )
  }

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to import the rate cards.')
    return
  }

  const totals = { created: 0, updated: 0 }

  for (const assignment of sheet.assignments) {
    const template = templateMap.get(assignment.templateKey) as Template
    const courier = courierMap.get(assignment.courierName)
    if (!courier) {
      throw new Error(`Courier target not found: ${assignment.courierName}`)
    }

    for (const [zoneCode, zoneId] of zoneMap.entries()) {
      const sourceZoneCode = sheet.zoneMappings[zoneCode] || zoneCode
      const baseRate = template.zoneBaseRates[sourceZoneCode]
      const extraRate = template.zoneAdditionalRates[sourceZoneCode]

      if (baseRate == null || extraRate == null) {
        throw new Error(
          `Missing zone rate for template=${template.key} zone=${zoneCode} sourceZone=${sourceZoneCode}`,
        )
      }

      const slab: RateCardSlabInput = {
        weight_from: 0,
        weight_to: template.baseWeightKg,
        rate: upliftRate(baseRate, sheet.rateIncreasePercent),
        extra_rate: upliftRate(extraRate, sheet.rateIncreasePercent),
        extra_weight_unit: template.additionalWeightUnitKg,
      }

      const result = await upsertRateCardRow({
        planId: plan.id,
        courierId: courier.id,
        courierName: courier.name,
        serviceProvider: courier.serviceProvider,
        mode: template.mode,
        zoneId,
        type: template.type,
        codCharges: template.codCharges,
        codPercent: template.codPercent,
        otherCharges: template.otherCharges,
        slab,
      })

      if (result === 'created') totals.created += 1
      if (result === 'updated') totals.updated += 1
    }
  }

  console.log(
    `Imported ${sheet.serviceName} for ${sheet.assignments.length} ${targetServiceProvider} couriers. Created=${totals.created}, Updated=${totals.updated}`,
  )
}

main().catch((error) => {
  console.error('Failed to import Shipmozo icarry rate cards:', error)
  process.exit(1)
})
