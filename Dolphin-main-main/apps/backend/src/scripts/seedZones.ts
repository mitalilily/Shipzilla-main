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
    code: 'WITHIN_CITY',
    name: 'Within City',
    description: 'B2C shipments where pickup and delivery are in the same city and state.',
    region: 'Within City',
  },
  {
    code: 'WITHIN_STATE',
    name: 'Within State',
    description: 'B2C shipments that move within the same state but across cities.',
    region: 'Within State',
  },
  {
    code: 'METRO_TO_METRO',
    name: 'Metro to Metro',
    description: 'B2C shipments between different metro cities.',
    region: 'Metro to Metro',
  },
  {
    code: 'WITHIN_REGION',
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
    code: 'SPECIAL_ZONE',
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

  console.table(seeded)
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
