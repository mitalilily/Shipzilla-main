import { readFileSync } from 'fs'
import path from 'path'
import { pool } from '../models/client'

async function ensureInvoiceGenerationRunsTable() {
  const migrationPath = path.resolve(__dirname, '../../migration_create_invoice_generation_runs.sql')
  const sql = readFileSync(migrationPath, 'utf8')

  const client = await pool.connect()
  try {
    console.log('Ensuring invoice_generation_runs table exists...')
    await client.query(sql)
    console.log('invoice_generation_runs table is ready.')
  } finally {
    client.release()
    await pool.end()
  }
}

ensureInvoiceGenerationRunsTable()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to ensure invoice_generation_runs table:', err)
    process.exit(1)
  })
