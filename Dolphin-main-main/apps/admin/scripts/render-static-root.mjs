import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const shouldSync =
  process.env.RENDER === 'true' || process.env.SYNC_STATIC_ROOT === 'true'
const outDir = process.argv[2] || 'build'
const isDryRun = process.argv.includes('--dry-run')
const rootDir = process.cwd()
const sourceDir = resolve(rootDir, outDir)

if (!shouldSync && !isDryRun) {
  process.exit(0)
}

if (!existsSync(join(sourceDir, 'index.html'))) {
  console.warn(`[render-static-root] ${outDir}/index.html was not found; skipping root sync`)
  process.exit(0)
}

const entries = readdirSync(sourceDir)
const protectedEntries = new Set(['node_modules', '.git', outDir])

for (const entry of entries) {
  if (protectedEntries.has(entry)) continue

  const from = join(sourceDir, entry)
  const to = join(rootDir, entry)

  if (isDryRun) {
    console.log(`[render-static-root] would copy ${entry}`)
    continue
  }

  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
}

console.log(
  isDryRun
    ? `[render-static-root] dry run complete for ${outDir}`
    : `[render-static-root] synced ${outDir} output to app root`,
)
