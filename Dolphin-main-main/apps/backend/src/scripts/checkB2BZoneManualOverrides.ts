import { asc, eq, sql } from 'drizzle-orm'

import { db } from '../models/client'
import { createPincode } from '../models/services/b2bAdmin.service'
import { createZone, deleteZone, remapZonePincodes } from '../models/services/zone.service'
import { locations } from '../models/schema/locations'
import { b2bPincodes } from '../models/schema/zones'

type SampleLocation = {
  pincode: string
  city: string
  state: string
}

const pickSampleLocations = async (): Promise<[SampleLocation, SampleLocation]> => {
  const states = await db
    .select({
      state: locations.state,
      total: sql<number>`count(*)::int`,
    })
    .from(locations)
    .groupBy(locations.state)
    .orderBy(asc(sql`count(*)`))

  for (const candidate of states) {
    if (!candidate.state) continue

    const rows = await db
      .select({
        pincode: locations.pincode,
        city: locations.city,
        state: locations.state,
      })
      .from(locations)
      .where(eq(locations.state, candidate.state))
      .limit(2)

    if (rows.length >= 2) {
      return [rows[0], rows[1]]
    }
  }

  throw new Error('Could not find a state with at least two locations for the B2B override test')
}

async function main() {
  const suffix = Date.now().toString().slice(-8)
  const [overrideSample, defaultSample] = await pickSampleLocations()

  let defaultZoneId: string | null = null
  let exceptionZoneId: string | null = null

  try {
    const defaultZone = await createZone(
      {
        code: `TST${suffix}D`,
        name: `Test Default ${suffix}`,
        description: 'Temporary zone for B2B state default smoke test',
        states: [overrideSample.state],
      },
      'b2b',
    )
    defaultZoneId = defaultZone.id

    const exceptionZone = await createZone(
      {
        code: `TST${suffix}X`,
        name: `Test Exception ${suffix}`,
        description: 'Temporary zone for B2B manual override smoke test',
        states: [],
      },
      'b2b',
    )
    exceptionZoneId = exceptionZone.id

    const [initialDefault] = await db
      .select()
      .from(b2bPincodes)
      .where(eq(b2bPincodes.pincode, overrideSample.pincode))
      .limit(1)

    if (!initialDefault || initialDefault.zone_id !== defaultZoneId) {
      throw new Error('Default state remap did not create the expected B2B pincode mapping')
    }

    if (initialDefault.mapping_source !== 'auto_state') {
      throw new Error(`Expected auto_state mapping, got ${initialDefault.mapping_source}`)
    }

    await createPincode({
      pincode: overrideSample.pincode,
      city: overrideSample.city,
      state: overrideSample.state,
      zoneId: exceptionZoneId,
    })

    const [manualOverride] = await db
      .select()
      .from(b2bPincodes)
      .where(eq(b2bPincodes.pincode, overrideSample.pincode))
      .limit(1)

    if (!manualOverride || manualOverride.zone_id !== exceptionZoneId) {
      throw new Error('Manual override did not move the pincode into the exception zone')
    }

    if (manualOverride.mapping_source !== 'manual') {
      throw new Error(`Expected manual mapping after override, got ${manualOverride.mapping_source}`)
    }

    await remapZonePincodes(defaultZoneId)

    const [overrideAfterRemap] = await db
      .select()
      .from(b2bPincodes)
      .where(eq(b2bPincodes.pincode, overrideSample.pincode))
      .limit(1)

    if (!overrideAfterRemap || overrideAfterRemap.zone_id !== exceptionZoneId) {
      throw new Error('State remap incorrectly overwrote the manual exception mapping')
    }

    const [defaultAfterRemap] = await db
      .select()
      .from(b2bPincodes)
      .where(eq(b2bPincodes.pincode, defaultSample.pincode))
      .limit(1)

    if (!defaultAfterRemap || defaultAfterRemap.zone_id !== defaultZoneId) {
      throw new Error('Default state pincode was not preserved during remap')
    }

    if (defaultAfterRemap.mapping_source !== 'auto_state') {
      throw new Error(
        `Expected untouched default mapping to remain auto_state, got ${defaultAfterRemap.mapping_source}`,
      )
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          state: overrideSample.state,
          overridePincode: overrideSample.pincode,
          defaultPincode: defaultSample.pincode,
          defaultZoneId,
          exceptionZoneId,
        },
        null,
        2,
      ),
    )
  } finally {
    if (exceptionZoneId) {
      await deleteZone(exceptionZoneId)
    }
    if (defaultZoneId) {
      await deleteZone(defaultZoneId)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[checkB2BZoneManualOverrides] failed:', error)
    process.exit(1)
  })
