import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'

import zoneCatalog from './data/b2bZoneSheetCatalog.json'
import { db, pool } from '../models/client'
import { locations } from '../models/schema/locations'
import { b2bPincodes, zones } from '../models/schema/zones'
import { createPincode } from '../models/services/b2bAdmin.service'

type ZoneCatalogRow = {
  code: string
  name: string
  description: string
  region: string
  coverageType: 'default_state' | 'exception_city'
  states: string[]
  sheetCities: string[]
  locationAliases?: string[]
}

type LocationRow = {
  pincode: string
  city: string
  state: string
}

const b2bZoneCatalog = zoneCatalog as ZoneCatalogRow[]
const INSERT_CHUNK_SIZE = 2000

const normalizeComparableText = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const buildMetadata = (row: ZoneCatalogRow) => ({
  source: 'boss-sheet-b2b-zones-2026-06',
  coverage_type: row.coverageType,
  sheet_states: row.states,
  sheet_cities: row.sheetCities,
  location_aliases: row.locationAliases ?? row.sheetCities,
})

const collectCanonicalStates = async () => {
  const distinctStates = await db
    .select({
      state: locations.state,
      total: count(),
    })
    .from(locations)
    .groupBy(locations.state)
    .orderBy(desc(count()))

  const canonicalMap = new Map<string, string>()
  for (const row of distinctStates) {
    const state = row.state?.trim()
    if (!state) continue
    const key = normalizeComparableText(state)
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, state)
    }
  }

  return canonicalMap
}

const canonicalizeStates = (states: string[], stateMap: Map<string, string>) => {
  const resolved: string[] = []
  const unresolved: string[] = []
  const seen = new Set<string>()

  for (const rawState of states) {
    const key = normalizeComparableText(rawState)
    const canonical = stateMap.get(key)
    if (!canonical) {
      unresolved.push(rawState)
      continue
    }
    if (!seen.has(canonical)) {
      resolved.push(canonical)
      seen.add(canonical)
    }
  }

  return { resolved, unresolved }
}

const locationMatchesAlias = (locationCity: string, aliases: Set<string>) => {
  const normalizedCity = normalizeComparableText(locationCity)
  if (!normalizedCity) return false

  for (const alias of aliases) {
    if (!alias) continue
    if (normalizedCity === alias) return true
    if (normalizedCity.includes(alias) || alias.includes(normalizedCity)) return true
  }

  return false
}

const chunkArray = <T>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function seedB2BZones() {
  const now = new Date()
  const stateMap = await collectCanonicalStates()
  const seeded: Array<{
    id: string
    code: string
    name: string
    states: number
    coverageType: string
    unresolvedStates: string[]
  }> = []

  for (const row of b2bZoneCatalog) {
    const { resolved: canonicalStates, unresolved } = canonicalizeStates(row.states, stateMap)

    const [zone] = await db
      .insert(zones)
      .values({
        code: row.code,
        name: row.name,
        description: row.description,
        region: row.region,
        business_type: 'B2B',
        states: canonicalStates,
        metadata: buildMetadata({ ...row, states: canonicalStates }),
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: row.name,
          description: row.description,
          region: row.region,
          states: canonicalStates,
          metadata: buildMetadata({ ...row, states: canonicalStates }),
          updated_at: now,
        },
      })
      .returning({
        id: zones.id,
        code: zones.code,
        name: zones.name,
      })

    seeded.push({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      states: canonicalStates.length,
      coverageType: row.coverageType,
      unresolvedStates: unresolved,
    })
  }

  const allowedCodes = b2bZoneCatalog.map((row) => row.code)

  const obsoleteUnusedZones = await db
    .select({
      id: zones.id,
      code: zones.code,
      name: zones.name,
    })
    .from(zones)
    .where(
      and(
        eq(zones.business_type, 'B2B'),
        notInArray(zones.code, allowedCodes),
        sql`NOT EXISTS (
          SELECT 1 FROM meracourierwala_b2b_pincodes p WHERE p.zone_id = ${zones.id}
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM meracourierwala_b2b_zone_to_zone_rates r
          WHERE r.origin_zone_id = ${zones.id} OR r.destination_zone_id = ${zones.id}
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM meracourierwala_b2b_zone_states zs WHERE zs.zone_id = ${zones.id}
        )`,
      ),
    )

  const obsoleteIds = obsoleteUnusedZones.map((row) => row.id)
  if (obsoleteIds.length) {
    await db.delete(zones).where(inArray(zones.id, obsoleteIds))
  }

  const b2bZones = await db
    .select({
      id: zones.id,
      code: zones.code,
      states: zones.states,
      metadata: zones.metadata,
    })
    .from(zones)
    .where(eq(zones.business_type, 'B2B'))

  const zoneByCode = new Map(b2bZones.map((zone) => [zone.code, zone]))

  const allLocations = await db
    .select({
      pincode: locations.pincode,
      city: locations.city,
      state: locations.state,
    })
    .from(locations)

  const existingManualRows = await db
    .select({
      pincode: b2bPincodes.pincode,
    })
    .from(b2bPincodes)
    .where(eq(b2bPincodes.mapping_source, 'manual'))

  const manualPincodeSet = new Set(existingManualRows.map((row) => row.pincode))

  await db.delete(b2bPincodes).where(eq(b2bPincodes.mapping_source, 'auto_state'))

  const defaultRows: typeof b2bPincodes.$inferInsert[] = []
  const assignedPincodes = new Set<string>()

  for (const zone of b2bZones) {
    if (!Array.isArray(zone.states) || zone.states.length === 0) continue

    const normalizedStates = new Set(zone.states.map((state) => normalizeComparableText(state)))

    for (const location of allLocations) {
      if (!normalizedStates.has(normalizeComparableText(location.state))) continue
      if (manualPincodeSet.has(location.pincode)) continue
      if (assignedPincodes.has(location.pincode)) continue

      defaultRows.push({
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        zone_id: zone.id,
        mapping_source: 'auto_state',
        courier_id: null,
        service_provider: null,
        is_oda: false,
        is_remote: false,
        is_mall: false,
        is_sez: false,
        is_airport: false,
        is_high_security: false,
        is_csd: false,
        metadata: null,
      })
      assignedPincodes.add(location.pincode)
    }
  }

  for (const chunk of chunkArray(defaultRows, INSERT_CHUNK_SIZE)) {
    if (!chunk.length) continue
    await db.insert(b2bPincodes).values(chunk)
  }

  const overrideStats: Array<{ code: string; mapped: number; aliases: string[] }> = []

  for (const row of b2bZoneCatalog) {
    const zone = zoneByCode.get(row.code)
    if (!zone) continue

    const aliasValues = row.locationAliases?.length ? row.locationAliases : row.sheetCities
    const normalizedAliases = new Set(aliasValues.map((value) => normalizeComparableText(value)))
    if (!normalizedAliases.size) continue

    const matchedLocations = allLocations.filter((location) =>
      locationMatchesAlias(location.city, normalizedAliases),
    )
    const uniqueLocations = new Map<string, LocationRow>()
    for (const location of matchedLocations) {
      if (!uniqueLocations.has(location.pincode)) {
        uniqueLocations.set(location.pincode, location)
      }
    }

    for (const location of uniqueLocations.values()) {
      await createPincode({
        pincode: location.pincode,
        city: location.city,
        state: location.state,
        zoneId: zone.id,
      })
    }

    overrideStats.push({
      code: row.code,
      mapped: uniqueLocations.size,
      aliases: aliasValues,
    })
  }

  const mappingCounts = await db
    .select({
      code: zones.code,
      total: count(b2bPincodes.id),
    })
    .from(zones)
    .leftJoin(b2bPincodes, eq(b2bPincodes.zone_id, zones.id))
    .where(eq(zones.business_type, 'B2B'))
    .groupBy(zones.code)
    .orderBy(zones.code)

  console.log('Seeded or updated B2B zones from boss sheet:')
  console.table(seeded)
  console.log('Applied city/manual overrides:')
  console.table(overrideStats)
  console.log('B2B mapping counts after sync:')
  console.table(mappingCounts)

  if (obsoleteUnusedZones.length) {
    console.log('Removed unused obsolete B2B zones:')
    console.table(obsoleteUnusedZones)
  } else {
    console.log('No obsolete unused B2B zones needed cleanup.')
  }
}

seedB2BZones()
  .catch((error) => {
    console.error('Failed to seed B2B zones from boss sheet:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
