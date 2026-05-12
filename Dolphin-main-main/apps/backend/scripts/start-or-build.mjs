import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const entry = resolve(process.cwd(), 'dist/index.js')
const isRender = process.env.RENDER === 'true'
const checkOnly = process.argv.includes('--check')

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
