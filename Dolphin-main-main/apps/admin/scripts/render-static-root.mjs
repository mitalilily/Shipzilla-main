import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const shouldSync =
  process.env.RENDER === 'true' || process.env.SYNC_STATIC_ROOT === 'true'
const outDir = process.argv[2] || 'build'
const isDryRun = process.argv.includes('--dry-run')
const rootDir = process.cwd()
const sourceDir = resolve(rootDir, outDir)

if (!existsSync(join(sourceDir, 'index.html'))) {
  console.warn(`[render-static-root] ${outDir}/index.html was not found; skipping root sync`)
  process.exit(0)
}

const indexFile = join(sourceDir, 'index.html')
const spaRoutes = [
  'admin',
  'admin/dashboard',
  'admin/orders',
  'admin/ops/ndr',
  'admin/ops/rto',
  'admin/users-management',
  'admin/notifications',
  'admin/plans',
  'admin/couriers',
  'admin/courier-credentials',
  'admin/service-providers',
  'admin/zones-mappings',
  'admin/serviceability',
  'admin/pricing/b2b',
  'admin/pricing/b2c',
  'admin/billing',
  'admin/billing-invoices',
  'admin/billing-preferences',
  'admin/cod-remittance',
  'admin/wallet',
  'admin/weight-reconciliation',
  'admin/dispute-management',
  'admin/tools',
  'admin/rate-calculator',
  'admin/order-tracking',
  'admin/api-integration',
  'admin/about-us',
  'admin/support',
  'admin/settings/payment-options',
  'admin/settings/change-password',
  'admin/developer',
  'auth',
  'auth/signin',
  'rtl',
]

for (const route of spaRoutes) {
  const routeDir = join(sourceDir, route)
  const routeIndex = join(routeDir, 'index.html')

  if (isDryRun) {
    console.log(`[render-static-root] would create SPA route ${route}/index.html`)
    continue
  }

  mkdirSync(routeDir, { recursive: true })
  copyFileSync(indexFile, routeIndex)
}

if (!isDryRun) {
  copyFileSync(indexFile, join(sourceDir, '404.html'))
  copyFileSync(indexFile, join(sourceDir, '200.html'))
}

if (!shouldSync && !isDryRun) {
  console.log(`[render-static-root] prepared SPA route fallbacks for ${outDir}`)
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
