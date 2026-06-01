import { db, pool } from '../models/client'
import { zones } from '../schema/schema'

type ZoneSeed = {
  code: string
  name: string
  description: string
  region: string
  metadata?: Record<string, unknown>
  states?: string[]
}

const b2cZoneSeeds: ZoneSeed[] = [
  {
    code: 'WITHIN CITY',
    name: 'Within City',
    description: 'B2C shipments where pickup and delivery are in the same city and state.',
    region: 'Within City',
  },
  {
    code: 'WITHIN STATE',
    name: 'Within State',
    description: 'B2C shipments that move within the same state but across cities.',
    region: 'Within State',
  },
  {
    code: 'METRO TO METRO',
    name: 'Metro to Metro',
    description: 'B2C shipments between different metro cities.',
    region: 'Metro to Metro',
  },
  {
    code: 'WITHIN REGION',
    name: 'Within Region',
    description: 'B2C shipments moving within a common north/south/east/west region.',
    region: 'Within Region',
  },
  {
    code: 'ROI',
    name: 'Rest of India',
    description: 'Fallback B2C zone for routes outside city, state, metro, region, or special rules.',
    region: 'Rest of India',
  },
  {
    code: 'SPECIAL ZONE',
    name: 'Special Zone',
    description: 'B2C shipments that need special handling based on location tags.',
    region: 'Special Zone',
  },
]

async function seedB2CZones() {
  const seeded = []

  for (const seed of b2cZoneSeeds) {
    const [zone] = await db
      .insert(zones)
      .values({
        code: seed.code,
        name: seed.name,
        description: seed.description,
        region: seed.region,
        business_type: 'B2C',
        metadata: seed.metadata ?? null,
        states: seed.states ?? [],
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [zones.code, zones.business_type],
        set: {
          name: seed.name,
          description: seed.description,
          region: seed.region,
          metadata: seed.metadata ?? null,
          states: seed.states ?? [],
          updated_at: new Date(),
        },
      })
      .returning({
        id: zones.id,
        code: zones.code,
        name: zones.name,
        businessType: zones.business_type,
      })

    seeded.push(zone)
  }

  const legacyAliasCodes = [
    'METRO_TO_METRO',
    'SPECIAL_ZONE',
    'WITHIN_CITY',
    'WITHIN_REGION',
    'WITHIN_STATE',
  ]
  const removedLegacyAliases = await pool.query(
    `
      DELETE FROM meracourierwala_zones z
      WHERE z.business_type = 'B2C'
        AND z.code = ANY($1::text[])
        AND NOT EXISTS (
          SELECT 1 FROM shipping_rates sr WHERE sr.zone_id = z.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM meracourierwala_zone_mappings zm WHERE zm.zone_id = z.id
        )
      RETURNING z.code, z.name, z.business_type
    `,
    [legacyAliasCodes],
  )

  console.table(seeded)
  if (removedLegacyAliases.rows.length) {
    console.log('Removed unreferenced legacy B2C zone aliases:')
    console.table(removedLegacyAliases.rows)
  }
  console.log(`Seeded ${seeded.length} B2C zones.`)
}

seedB2CZones()
  .catch((error) => {
    console.error('Failed to seed B2C zones:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
