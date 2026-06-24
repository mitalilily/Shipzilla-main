import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'

import zoneCatalog from './data/b2bZoneSheetCatalog.json'
import { db, pool } from '../models/client'
import { zones } from '../models/schema/zones'

type ZoneCatalogRow = {
  code: string
  name: string
  description: string
  region: string
  coverageType: 'default_state' | 'exception_city'
  states: string[]
  sheetCities: string[]
}

const b2bZoneCatalog = zoneCatalog as ZoneCatalogRow[]

const buildMetadata = (row: ZoneCatalogRow) => ({
  source: 'boss-sheet-b2b-zones-2026-06',
  coverage_type: row.coverageType,
  sheet_states: row.states,
  sheet_cities: row.sheetCities,
})

async function seedB2BZones() {
  const now = new Date()
  const seeded: Array<{
    id: string
    code: string
    name: string
    states: number
    coverageType: string
  }> = []

  for (const row of b2bZoneCatalog) {
    const [zone] = await db
      .insert(zones)
      .values({
        code: row.code,
        name: row.name,
        description: row.description,
        region: row.region,
        business_type: 'B2B',
        states: row.states,
        metadata: buildMetadata(row),
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: row.name,
          description: row.description,
          region: row.region,
          states: row.states,
          metadata: buildMetadata(row),
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
      states: row.states.length,
      coverageType: row.coverageType,
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

  console.log('Seeded or updated B2B zones from boss sheet:')
  console.table(seeded)

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
