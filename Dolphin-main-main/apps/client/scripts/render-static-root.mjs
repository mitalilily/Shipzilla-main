import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const shouldSync =
  process.env.RENDER === 'true' || process.env.SYNC_STATIC_ROOT === 'true'
const outDir = process.argv[2] || 'dist'
const isDryRun = process.argv.includes('--dry-run')
const rootDir = process.cwd()
const sourceDir = resolve(rootDir, outDir)

if (!existsSync(join(sourceDir, 'index.html'))) {
  console.warn(`[render-static-root] ${outDir}/index.html was not found; skipping root sync`)
  process.exit(0)
}

const indexFile = join(sourceDir, 'index.html')
const spaRoutes = [
  'login',
  'signup',
  'app',
  'preview',
  'tracking',
  'onboarding-questions',
  'settings',
  'settings/manage_pickups',
  'settings/invoice_preferences',
  'settings/label_config',
  'settings/users_management',
  'settings/courier_priority',
  'settings/api-integration',
  'billing/wallet_transactions',
  'billing/invoice_management',
  'orders/list',
  'orders/create',
  'orders/b2c/list',
  'orders/b2b/list',
  'support/about_us',
  'support/tickets',
  'profile',
  'profile/user_profile',
  'profile/company',
  'profile/password',
  'profile/bank_details',
  'profile/kyc_details',
  'dashboard',
  'tools/rate_card',
  'tools/rate_calculator',
  'tools/order_tracking',
  'home',
  'couriers/partners',
  'cod-remittance',
  'reports',
  'reconciliation/weight',
  'reconciliation/weight/settings',
  'ops/ndr',
  'ops/rto',
  'channels/connected',
  'channels/channel_list',
  'policies/refund_cancellation',
  'policies/privacy_policy',
  'policies/terms_of_service',
  'policies/contact_us',
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
