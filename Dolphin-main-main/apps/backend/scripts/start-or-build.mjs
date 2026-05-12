import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const entry = resolve(process.cwd(), 'dist/index.js')
const isRender = process.env.RENDER === 'true'
const checkOnly = process.argv.includes('--check')
const shouldRunMigrations =
  process.env.SKIP_DB_MIGRATIONS !== 'true' &&
  (isRender || process.env.RUN_DB_MIGRATIONS === 'true')

const runDatabaseMigrations = () => {
  if (!shouldRunMigrations) return

  if (!process.env.DATABASE_URL) {
    console.warn('[start] DATABASE_URL is missing; skipping database migrations')
    return
  }

  console.log('[start] Running database migrations before boot')
  const result = spawnSync('npm', ['run', 'migrate'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })

  if (result.status !== 0) {
    console.error('[start] Database migrations failed; refusing to boot with an out-of-date schema')
    process.exit(result.status ?? 1)
  }
}

if (checkOnly) {
  if (!existsSync(entry)) {
    console.error('[start] dist/index.js is missing. Run npm run build first.')
    process.exit(1)
  }

  console.log('[start] dist/index.js is ready')
  process.exit(0)
}

if (!existsSync(entry)) {
  if (!isRender) {
    console.error('[start] dist/index.js is missing. Run npm run build first.')
    process.exit(1)
  }

  console.warn(
    '[start] Render ran the start command before build output existed. Building once and exiting build phase.',
  )
  const result = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true,
  })

  process.exit(result.status ?? 1)
}

runDatabaseMigrations()

const child = spawn(process.execPath, [entry], {
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
