import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { replaceShippingRateSlabs, type RateCardSlabInput } from '../models/services/b2cRateCard.service'
import { couriers, plans, shippingRates, zones } from '../schema/schema'
import { getIntegratedCourierProviders } from '../utils/courierProviders'
import {
  SHIPMOZO_B2C_RATE_CARD_DATA,
  type ShipmozoB2CRateCardSeed,
  type ShipmozoZoneRates,
} from './shipmozoB2CRateCardData'

const B2C_ZONE_CODES = [
  'WITHIN CITY',
  'WITHIN STATE',
  'METRO TO METRO',
  'WITHIN REGION',
  'ROI',
  'SPECIAL ZONE',
] as const

const B2C_ZONE_RATE_KEYS: Record<(typeof B2C_ZONE_CODES)[number], keyof ShipmozoZoneRates> = {
  'WITHIN CITY': 'zoneA',
  'WITHIN STATE': 'zoneB',
  'METRO TO METRO': 'zoneC',
  // The source PDF exposes a single "Rest of India" column, so we reuse it
  // for both "WITHIN REGION" and "ROI" in the existing rate-card model.
  'WITHIN REGION': 'zoneD',
  ROI: 'zoneD',
  'SPECIAL ZONE': 'zoneE',
}

const BASE_RATE_MULTIPLIER = 1.3

type PreparedRateCardPayload = {
  mode: string
  minWeight: string
  rate: string
  codCharges: string
  codPercent: string
  otherCharges: string
  slabs: RateCardSlabInput[]
}

function getArgValue(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function shouldDryRun() {
  return process.argv.includes('--dry-run')
}

function normaliseModeFilter(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw || raw === 'all') return ''
  if (['air', 'a', 'express'].includes(raw)) return 'air'
  if (['surface', 's', 'ground'].includes(raw)) return 'surface'
  return raw
}

function normaliseCourierName(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function formatDecimal(value: number, digits = 2) {
  return value.toFixed(digits)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function applyBaseRateMarkup(value: number) {
  return roundMoney(value * BASE_RATE_MULTIPLIER)
}

function getZoneRate(seedRates: ShipmozoZoneRates, zoneCode: (typeof B2C_ZONE_CODES)[number]) {
  return seedRates[B2C_ZONE_RATE_KEYS[zoneCode]]
}

function buildRateCardPayload(
  seed: ShipmozoB2CRateCardSeed,
  zoneCode: (typeof B2C_ZONE_CODES)[number],
): PreparedRateCardPayload {
  const baseRate = applyBaseRateMarkup(getZoneRate(seed.baseRates, zoneCode))
  const additionalRate =
    seed.additionalRates && seed.additionalWeightUnit
      ? getZoneRate(seed.additionalRates, zoneCode)
      : null

  return {
    mode: seed.mode,
    minWeight: formatDecimal(seed.minWeight, 3),
    rate: formatDecimal(baseRate),
    codCharges: formatDecimal(seed.codCharges ?? 0),
    codPercent: formatDecimal(seed.codPercent ?? 0),
    otherCharges: formatDecimal(seed.otherCharges ?? 0),
    slabs:
      additionalRate === null
        ? []
        : [
            {
              weight_from: 0,
              weight_to: seed.minWeight,
              rate: baseRate,
              extra_rate: additionalRate,
              extra_weight_unit: seed.additionalWeightUnit ?? null,
            },
          ],
  }
}

const RATE_CARD_LOOKUP = new Map<string, ShipmozoB2CRateCardSeed>()

for (const seed of SHIPMOZO_B2C_RATE_CARD_DATA) {
  for (const alias of seed.aliases) {
    RATE_CARD_LOOKUP.set(`${seed.type}:${normaliseCourierName(alias)}`, seed)
  }
}

function findRateCardSeed(courierName: string, type: 'forward' | 'rto') {
  return RATE_CARD_LOOKUP.get(`${type}:${normaliseCourierName(courierName)}`) ?? null
}

async function getActivePlans() {
  return db.select().from(plans).where(eq(plans.is_active, true))
}

async function getB2CZones() {
  const rows = await db
    .select()
    .from(zones)
    .where(and(eq(zones.business_type, 'B2C'), inArray(zones.code, [...B2C_ZONE_CODES])))

  const missingCodes = B2C_ZONE_CODES.filter((code) => !rows.some((zone) => zone.code === code))
  if (missingCodes.length) {
    throw new Error(`Missing B2C zones: ${missingCodes.join(', ')}. Run the B2C zone setup first.`)
  }

  return rows.sort((a, b) => B2C_ZONE_CODES.indexOf(a.code as (typeof B2C_ZONE_CODES)[number]) - B2C_ZONE_CODES.indexOf(b.code as (typeof B2C_ZONE_CODES)[number]))
}

async function getEnabledB2CCouriers() {
  return db
    .select()
    .from(couriers)
    .where(
      and(
        eq(couriers.isEnabled, true),
        inArray(couriers.serviceProvider, getIntegratedCourierProviders()),
        sql`${couriers.businessType} @> '["b2c"]'::jsonb`,
      ),
    )
}

async function createOrUpdateRateCardRow(params: {
  planId: string
  courierId: number
  courierName: string
  serviceProvider: string
  zoneId: string
  type: 'forward' | 'rto'
  dryRun: boolean
  rateCard: PreparedRateCardPayload
}) {
  const existingRows = await db
    .select({ id: shippingRates.id })
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.plan_id, params.planId),
        eq(shippingRates.courier_id, params.courierId),
        eq(shippingRates.business_type, 'b2c'),
        eq(shippingRates.zone_id, params.zoneId),
        eq(shippingRates.type, params.type),
        eq(sql`lower(${shippingRates.service_provider})`, params.serviceProvider.toLowerCase()),
        eq(sql`lower(${shippingRates.mode})`, params.rateCard.mode),
      ),
    )

  if (params.dryRun) {
    return existingRows.length ? 'would-update' : 'would-create'
  }

  const payload = {
    plan_id: params.planId,
    courier_id: params.courierId,
    courier_name: params.courierName,
    service_provider: params.serviceProvider.toLowerCase(),
    mode: params.rateCard.mode,
    business_type: 'b2c',
    min_weight: params.rateCard.minWeight,
    zone_id: params.zoneId,
    type: params.type,
    rate: params.rateCard.rate,
    cod_charges: params.rateCard.codCharges,
    cod_percent: params.rateCard.codPercent,
    other_charges: params.rateCard.otherCharges,
    last_updated: new Date(),
  }

  if (existingRows.length) {
    await db
      .update(shippingRates)
      .set(payload)
      .where(inArray(shippingRates.id, existingRows.map((row) => row.id)))

    for (const row of existingRows) {
      await replaceShippingRateSlabs(row.id, params.rateCard.slabs)
    }

    return 'updated'
  }

  const [created] = await db.insert(shippingRates).values(payload).returning({ id: shippingRates.id })
  await replaceShippingRateSlabs(created.id, params.rateCard.slabs)
  return 'created'
}

async function createB2CRateCards() {
  const modeFilter = normaliseModeFilter(getArgValue('mode') || process.env.B2C_RATE_CARD_MODE)
  const dryRun = shouldDryRun()
  const [planRows, zoneRows, courierRows] = await Promise.all([
    getActivePlans(),
    getB2CZones(),
    getEnabledB2CCouriers(),
  ])

  if (!planRows.length) {
    throw new Error('No active plans found. Create or activate a plan before creating B2C rate cards.')
  }

  if (!courierRows.length) {
    throw new Error('No enabled B2C couriers found for the integrated providers.')
  }

  const totals: Record<string, number> = {}
  const seededCouriers = new Set<number>()
  const matchedCourierNames = new Set<string>()

  for (const plan of planRows) {
    for (const courier of courierRows) {
      for (const type of ['forward', 'rto'] as const) {
        const seed = findRateCardSeed(courier.name, type)
        if (!seed) continue
        if (modeFilter && seed.mode !== modeFilter) continue

        matchedCourierNames.add(courier.name)
        seededCouriers.add(courier.id)

        for (const zone of zoneRows) {
          const result = await createOrUpdateRateCardRow({
            planId: plan.id,
            courierId: courier.id,
            courierName: courier.name,
            serviceProvider: courier.serviceProvider,
            zoneId: zone.id,
            type,
            dryRun,
            rateCard: buildRateCardPayload(
              seed,
              zone.code as (typeof B2C_ZONE_CODES)[number],
            ),
          })
          totals[result] = (totals[result] || 0) + 1
        }
      }
    }
  }

  const unmatchedCouriers = courierRows
    .filter((courier) => !matchedCourierNames.has(courier.name))
    .map((courier) => courier.name)
    .sort((a, b) => a.localeCompare(b))

  console.table({
    plans: planRows.length,
    zones: zoneRows.length,
    couriers: courierRows.length,
    seeded_couriers: seededCouriers.size,
    skipped_couriers: unmatchedCouriers.length,
    mode: modeFilter || 'all',
    dryRun,
    ...totals,
  })

  if (unmatchedCouriers.length) {
    const preview = unmatchedCouriers.slice(0, 20).join(', ')
    const suffix = unmatchedCouriers.length > 20 ? ', ...' : ''
    console.log(`Skipped couriers without Shipmozo B2C data: ${preview}${suffix}`)
  }

  console.log(
    'Applied Shipmozo B2C rate data with a 30% uplift on base rates only. Zone D is reused for WITHIN REGION and ROI because the supplied PDF includes one Rest of India column.',
  )
}

createB2CRateCards()
  .catch((error) => {
    console.error('Failed to create B2C rate cards:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
