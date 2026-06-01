import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { replaceShippingRateSlabs, type RateCardSlabInput } from '../models/services/b2cRateCard.service'
import { getIntegratedCourierProviders } from '../utils/courierProviders'
import { couriers, plans, shippingRates, zones } from '../schema/schema'

const B2C_ZONE_CODES = [
  'WITHIN CITY',
  'WITHIN STATE',
  'METRO TO METRO',
  'WITHIN REGION',
  'ROI',
  'SPECIAL ZONE',
]

const DEFAULT_MODE = 'surface'
const DEFAULT_RATE = '10.00'
const DEFAULT_COD_CHARGES = '10.00'
const DEFAULT_COD_PERCENT = '2.00'
const DEFAULT_OTHER_CHARGES = '0.00'
const DEFAULT_MIN_WEIGHT = '0.50'

const DEFAULT_SLABS: RateCardSlabInput[] = [
  {
    weight_from: 0,
    weight_to: 0.5,
    rate: 10,
    extra_rate: 10,
    extra_weight_unit: 1,
  },
]

function getArgValue(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function shouldDryRun() {
  return process.argv.includes('--dry-run')
}

function normaliseMode(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return DEFAULT_MODE
  if (['air', 'a', 'express'].includes(raw)) return 'air'
  if (['surface', 's', 'ground'].includes(raw)) return 'surface'
  return raw
}

async function getActivePlans() {
  return db.select().from(plans).where(eq(plans.is_active, true))
}

async function getB2CZones() {
  const rows = await db
    .select()
    .from(zones)
    .where(and(eq(zones.business_type, 'B2C'), inArray(zones.code, B2C_ZONE_CODES)))

  const missingCodes = B2C_ZONE_CODES.filter((code) => !rows.some((zone) => zone.code === code))
  if (missingCodes.length) {
    throw new Error(`Missing B2C zones: ${missingCodes.join(', ')}. Run the B2C zone setup first.`)
  }

  return rows.sort((a, b) => B2C_ZONE_CODES.indexOf(a.code) - B2C_ZONE_CODES.indexOf(b.code))
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
  mode: string
  zoneId: string
  type: 'forward' | 'rto'
  dryRun: boolean
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
        eq(sql`lower(${shippingRates.mode})`, params.mode),
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
    mode: params.mode,
    business_type: 'b2c',
    min_weight: DEFAULT_MIN_WEIGHT,
    zone_id: params.zoneId,
    type: params.type,
    rate: DEFAULT_RATE,
    cod_charges: DEFAULT_COD_CHARGES,
    cod_percent: DEFAULT_COD_PERCENT,
    other_charges: DEFAULT_OTHER_CHARGES,
    last_updated: new Date(),
  }

  if (existingRows.length) {
    await db
      .update(shippingRates)
      .set(payload)
      .where(inArray(shippingRates.id, existingRows.map((row) => row.id)))

    for (const row of existingRows) {
      await replaceShippingRateSlabs(row.id, DEFAULT_SLABS)
    }

    return 'updated'
  }

  const [created] = await db.insert(shippingRates).values(payload).returning({ id: shippingRates.id })
  await replaceShippingRateSlabs(created.id, DEFAULT_SLABS)
  return 'created'
}

async function createB2CRateCards() {
  const mode = normaliseMode(getArgValue('mode') || process.env.B2C_RATE_CARD_MODE)
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

  for (const plan of planRows) {
    for (const courier of courierRows) {
      for (const zone of zoneRows) {
        for (const type of ['forward', 'rto'] as const) {
          const result = await createOrUpdateRateCardRow({
            planId: plan.id,
            courierId: courier.id,
            courierName: courier.name,
            serviceProvider: courier.serviceProvider,
            mode,
            zoneId: zone.id,
            type,
            dryRun,
          })
          totals[result] = (totals[result] || 0) + 1
        }
      }
    }
  }

  console.table({
    plans: planRows.length,
    zones: zoneRows.length,
    couriers: courierRows.length,
    mode,
    dryRun,
    ...totals,
  })
  console.log(
    'B2C rate card template: 0-0.5 kg at Rs 10, then Rs 10 per extra 1 kg; COD Rs 10 or 2%.',
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
