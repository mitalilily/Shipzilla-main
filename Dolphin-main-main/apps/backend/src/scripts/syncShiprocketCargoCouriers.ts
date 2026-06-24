import { getShiprocketCargoShipmentCharges } from '../models/services/shiprocketCargo.service'
import cargoCourierCatalog from './shiprocketCargoCourierCatalog.json'

type SyncedCourierRecord = {
  id: number
  name: string
  businessType: ('b2c' | 'b2b')[]
}

const KNOWN_CARGO_COURIER_NAMES = new Set(cargoCourierCatalog.map((carrier) => carrier.name))

const PROBES = [
  ['400076', 'Mumbai', 'Maharashtra', '110017', 'New Delhi', 'Delhi', 2, 1111, 12, 11, 11, 11],
  ['560001', 'Bengaluru', 'Karnataka', '700001', 'Kolkata', 'West Bengal', 4, 5000, 8, 20, 18, 16],
  ['110001', 'Delhi', 'Delhi', '600001', 'Chennai', 'Tamil Nadu', 1, 20000, 30, 40, 30, 25],
  ['500001', 'Hyderabad', 'Telangana', '682001', 'Kochi', 'Kerala', 3, 9000, 15, 35, 28, 22],
  ['302001', 'Jaipur', 'Rajasthan', '781001', 'Guwahati', 'Assam', 5, 15000, 25, 50, 40, 35],
  ['382421', 'Ahmedabad', 'Gujarat', '751001', 'Bhubaneswar', 'Odisha', 2, 12000, 40, 60, 45, 35],
  ['160017', 'Chandigarh', 'Chandigarh', '800001', 'Patna', 'Bihar', 2, 18000, 22, 55, 35, 30],
  ['400001', 'Mumbai', 'Maharashtra', '400703', 'Navi Mumbai', 'Maharashtra', 1, 2500, 3, 18, 18, 18],
  ['400001', 'Mumbai', 'Maharashtra', '201301', 'Noida', 'Uttar Pradesh', 1, 1000, 1, 10, 10, 10],
  ['122001', 'Gurugram', 'Haryana', '560001', 'Bengaluru', 'Karnataka', 1, 3000, 2, 15, 15, 15],
  ['700001', 'Kolkata', 'West Bengal', '400001', 'Mumbai', 'Maharashtra', 2, 8000, 18, 45, 25, 25],
  ['110017', 'New Delhi', 'Delhi', '110017', 'New Delhi', 'Delhi', 1, 500, 1, 8, 8, 8],
  ['600001', 'Chennai', 'Tamil Nadu', '500001', 'Hyderabad', 'Telangana', 6, 25000, 50, 70, 50, 40],
  ['201301', 'Noida', 'Uttar Pradesh', '122001', 'Gurugram', 'Haryana', 2, 700, 5, 12, 12, 12],
  ['781001', 'Guwahati', 'Assam', '110001', 'Delhi', 'Delhi', 2, 10000, 12, 30, 25, 20],
  ['452001', 'Indore', 'Madhya Pradesh', '395003', 'Surat', 'Gujarat', 2, 3500, 6, 20, 20, 20],
] as const

const dedupeCourierCatalog = (records: SyncedCourierRecord[]) => {
  const byId = new Map<number, SyncedCourierRecord>()

  for (const record of records) {
    const existing = byId.get(record.id)
    if (!existing) {
      byId.set(record.id, record)
      continue
    }

    byId.set(record.id, {
      id: record.id,
      name: existing.name.length >= record.name.length ? existing.name : record.name,
      businessType: Array.from(new Set([...existing.businessType, ...record.businessType])) as (
        | 'b2c'
        | 'b2b'
      )[],
    })
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const upsertCargoCouriers = async (records: SyncedCourierRecord[]) => {
  const [{ and, eq, inArray, sql }, { db }, { couriers }] = await Promise.all([
    import('drizzle-orm'),
    import('../models/client'),
    import('../models/schema/couriers'),
  ])
  const normalizedRecords = dedupeCourierCatalog(records)
  if (!normalizedRecords.length) {
    return { total: 0, created: 0, updated: 0 }
  }

  const ids = normalizedRecords.map((record) => record.id)
  const existingRows = await db
    .select({ id: couriers.id })
    .from(couriers)
    .where(and(eq(couriers.serviceProvider, 'shiprocket'), inArray(couriers.id, ids)))

  const existingIds = new Set(existingRows.map((row) => Number(row.id)))

  await db
    .insert(couriers)
    .values(
      normalizedRecords.map((record) => ({
        id: record.id,
        name: record.name,
        serviceProvider: 'shiprocket',
        isEnabled: true,
        businessType: record.businessType,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: [couriers.id, couriers.serviceProvider],
      set: {
        name: sql.raw(`excluded."${couriers.name.name}"`),
        businessType: sql.raw(`excluded."${couriers.businessType.name}"`),
        isEnabled: sql.raw(`excluded."${couriers.isEnabled.name}"`),
        updatedAt: new Date(),
      },
    })

  const created = normalizedRecords.filter((record) => !existingIds.has(record.id)).length
  return {
    total: normalizedRecords.length,
    created,
    updated: normalizedRecords.length - created,
  }
}

const run = async () => {
  const discovered = new Map<
    number,
    SyncedCourierRecord & { commonName: string | null; modes: string[] }
  >()

  for (const probe of PROBES) {
    const [fromPincode, fromCity, fromState, toPincode, toCity, toState, quantity, invoiceValue, weight, length, height, width] =
      probe

    const response = await getShiprocketCargoShipmentCharges({
      from_pincode: fromPincode,
      from_city: fromCity,
      from_state: fromState,
      to_pincode: toPincode,
      to_city: toCity,
      to_state: toState,
      quantity,
      invoice_value: invoiceValue,
      calculator_page: 'true',
      packaging_unit_details: [
        {
          units: quantity,
          length,
          height,
          weight,
          width,
          unit: 'cm',
        },
      ],
    })

    for (const value of Object.values(response || {})) {
      if (!value || typeof value !== 'object') continue

      const id = Number((value as any).id ?? 0)
      const name = String((value as any).delivery_partner || '').trim()
      const commonName = String((value as any).common_name || '').trim() || null
      const mode = String((value as any).mode_name || '').trim()

      if (!id || !name || !KNOWN_CARGO_COURIER_NAMES.has(name)) continue

      const existing = discovered.get(id)
      discovered.set(id, {
        id,
        name,
        businessType: ['b2c', 'b2b'],
        commonName,
        modes: Array.from(new Set([...(existing?.modes || []), mode].filter(Boolean))),
      })
    }
  }

  const records = [...discovered.values()].sort((a, b) => a.name.localeCompare(b.name))
  const matchedNames = records.map((record) => record.name)
  const missingNames = [...KNOWN_CARGO_COURIER_NAMES].filter((name) => !matchedNames.includes(name))
  const catalogWithDiscovery = cargoCourierCatalog.map((carrier) => {
    const discoveredRecord = records.find((record) => record.name === carrier.name)
    return {
      ...carrier,
      discoveredLive: Boolean(discoveredRecord),
      discoveredId: discoveredRecord?.id ?? null,
      discoveredModes: discoveredRecord?.modes ?? [],
      commonName: discoveredRecord?.commonName ?? null,
    }
  })

  const summary = {
    totalCatalog: cargoCourierCatalog.length,
    totalDiscovered: records.length,
    discovered: records,
    catalog: catalogWithDiscovery,
    missingFromLiveProbes: missingNames,
  }

  if (String(process.env.SHIPROCKET_CARGO_SYNC_WRITE_DB || '').toLowerCase() === 'true') {
    const writeSummary = await upsertCargoCouriers(records)
    console.log(JSON.stringify({ ...summary, db: writeSummary }, null, 2))
    return
  }

  console.log(JSON.stringify(summary, null, 2))
}

run().catch((error: any) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error?.message || 'Unknown error',
        status: error?.response?.status ?? null,
        data: error?.response?.data ?? null,
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
