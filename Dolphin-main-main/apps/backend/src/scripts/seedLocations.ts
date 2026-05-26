// src/scripts/seedLocations.ts
import fs from 'fs'
import path from 'path'
import { sql } from 'drizzle-orm'
import XLSX from 'xlsx'
import { db, pool } from '../models/client'
import { locations } from '../schema/schema'

const DATA_DIR = path.resolve('src/scripts/data')
const CHUNK_SIZE = 500

type Row = {
  pincode: string
  city: string
  state: string
  country: string
  tags: string[]
}

function normalize(x: any): string {
  return (x ?? '').toString().trim()
}

const SPECIAL_ZONE_STATES = new Set(
  [
    'Arunachal Pradesh',
    'Assam',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Tripura',
    'Jammu and Kashmir',
  ].map((s) => s.toLowerCase()),
)

function mapRow(raw: Record<string, any>): Row | null {
  const pincode = normalize(raw['Pincode'])
  if (!pincode || !/^\d{6}$/.test(pincode)) return null

  const state = normalize(raw['HubState'])
  const city = normalize(raw['BillingCity'])
  const billingZone = normalize(raw['BillingZone'])
  const cityType = normalize(raw['City Type'])

  const tags: string[] = []
  if (billingZone) tags.push(billingZone.toLowerCase())
  if (cityType) tags.push(cityType.toLowerCase())
  if (state && SPECIAL_ZONE_STATES.has(state.toLowerCase())) {
    tags.push('special_zone')
  }

  return { pincode, city, state, country: 'India', tags }
}

async function insertBatch(rows: Row[]) {
  if (!rows.length) return

  const values = rows.map((r) => ({
    pincode: r.pincode,
    city: r.city,
    state: r.state,
    country: r.country,
    tags: Array.isArray(r.tags) ? r.tags : [],
    created_at: new Date(),
  }))

  try {
    await db
      .insert(locations)
      .values(values)
      .onConflictDoUpdate({
        target: locations.pincode,
        set: {
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          country: sql`excluded.country`,
          tags: sql`excluded.tags`,
        },
      })

    console.log(`Upserted ${rows.length} rows`)
  } catch (err) {
    console.warn(
      `Batch upsert failed for ${rows.length} rows. Falling back to row-by-row import.`,
      (err as Error).message,
    )

    for (const value of values) {
      await db
        .insert(locations)
        .values(value)
        .onConflictDoUpdate({
          target: locations.pincode,
          set: {
            city: sql`excluded.city`,
            state: sql`excluded.state`,
            country: sql`excluded.country`,
            tags: sql`excluded.tags`,
          },
        })
    }

    console.log(`Upserted ${rows.length} rows via fallback`)
  }
}

async function ensureLocationsTable() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.shipzilla_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pincode varchar(15) NOT NULL,
      city varchar(120) NOT NULL,
      state varchar(120) NOT NULL,
      country varchar(120) NOT NULL DEFAULT 'India',
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    DELETE FROM public.shipzilla_locations a
    USING public.shipzilla_locations b
    WHERE a.ctid < b.ctid
      AND a.pincode = b.pincode
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS locations_pincode_unique_idx
    ON public.shipzilla_locations (pincode)
  `)
}

async function importXlsx(filename: string) {
  const fullPath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(fullPath)) {
    console.error('File not found:', fullPath)
    return
  }
  console.log('Reading XLSX:', fullPath)
  await ensureLocationsTable()

  const wb = XLSX.readFile(fullPath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log('Total rows parsed:', jsonRows.length)

  let batch: Row[] = []
  let processed = 0

  for (const raw of jsonRows) {
    const mapped = mapRow(raw)
    if (!mapped) continue

    batch.push(mapped)

    if (batch.length >= CHUNK_SIZE) {
      await insertBatch(batch)
      processed += batch.length
      if (processed % 1000 === 0) console.log(`Processed ${processed} rows...`)
      batch = []
    }
  }

  if (batch.length) {
    await insertBatch(batch)
    processed += batch.length
  }

  console.log(`Import finished. Total rows processed: ${processed}`)
}

;(async () => {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: node dist/scripts/seedLocations.js <file.xlsx>')
    process.exit(1)
  }

  try {
    await importXlsx(arg)
  } catch (err) {
    console.error('Import failed:', (err as Error).message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
})()
