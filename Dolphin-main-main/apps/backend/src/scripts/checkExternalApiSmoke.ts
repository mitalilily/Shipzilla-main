import * as dotenv from 'dotenv'
import path from 'path'
import axios, { AxiosInstance } from 'axios'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type SmokeResult = {
  name: string
  status: number
  ok: boolean
  details?: string
}

const baseUrl = (process.env.API_SMOKE_BASE_URL || process.env.API_URL || 'https://api.shipzilla.in').replace(
  /\/+$/,
  '',
)
const adminEmail = process.env.API_SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@shipzilla.in'
const adminPassword = process.env.API_SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@12345!'
const includeShiprocket = process.env.API_SMOKE_INCLUDE_SHIPROCKET === 'true'

let createdApiKeyId: string | null = null
let createdApiKeyValue: string | null = null
let createdWebhookId: string | null = null

const adminHttp = axios.create({
  baseURL: baseUrl,
  timeout: 30_000,
})

let apiHttp: AxiosInstance | null = null

const summarizeError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const payload = error.response?.data
    const message =
      payload?.message ||
      payload?.error ||
      error.message ||
      (typeof payload === 'string' ? payload : JSON.stringify(payload))

    return {
      status: status || 0,
      details: message,
    }
  }

  return {
    status: 0,
    details: error instanceof Error ? error.message : String(error),
  }
}

const runStep = async (
  name: string,
  request: () => Promise<{ status: number; data?: any }>,
  expectedStatuses: number[] = [200],
) => {
  process.stdout.write(`[External API smoke] ${name} ... `)

  try {
    const response = await request()
    const ok = expectedStatuses.includes(response.status)
    if (!ok) {
      throw new Error(`Expected ${expectedStatuses.join('/')} but got ${response.status}`)
    }
    console.log(`ok (${response.status})`)
    return {
      name,
      status: response.status,
      ok: true,
      details: response.data?.message,
    } satisfies SmokeResult
  } catch (error) {
    const summary = summarizeError(error)
    console.log(`fail (${summary.status || 'error'})`)
    return {
      name,
      status: summary.status,
      ok: false,
      details: summary.details,
    } satisfies SmokeResult
  }
}

const ensureAdminSession = async () => {
  const response = await adminHttp.post('/api/auth/admin/login', {
    email: adminEmail,
    password: adminPassword,
  })

  const token = response.data?.token
  if (!token) {
    throw new Error('Admin login did not return a token')
  }

  adminHttp.defaults.headers.common.Authorization = `Bearer ${token}`
}

const ensureApiKeySession = async () => {
  const response = await adminHttp.post('/api/v1/api-keys', {
    key_name: `Smoke Test ${Date.now()}`,
  })

  createdApiKeyId = response.data?.data?.id || null
  createdApiKeyValue = response.data?.data?.api_key || null

  if (!createdApiKeyId || !createdApiKeyValue) {
    throw new Error('API key creation did not return a usable key')
  }

  apiHttp = axios.create({
    baseURL: baseUrl,
    timeout: 30_000,
    headers: {
      'X-API-Key': createdApiKeyValue,
    },
  })
}

const cleanup = async () => {
  if (createdWebhookId) {
    try {
      await adminHttp.delete(`/api/v1/webhooks/${createdWebhookId}`)
    } catch {
      // best effort cleanup
    }
  }

  if (createdApiKeyId) {
    try {
      await adminHttp.delete(`/api/v1/api-keys/${createdApiKeyId}`)
    } catch {
      // best effort cleanup
    }
  }
}

const requireApiHttp = () => {
  if (!apiHttp) {
    throw new Error('API key session is not initialized')
  }

  return apiHttp
}

const testExternalApiRoutes = async () => {
  const results: SmokeResult[] = []
  let extraKeyId: string | null = null
  const webhookPayload = {
    url: 'https://example.com/webhooks/shipzilla-smoke',
    name: `Smoke Webhook ${Date.now()}`,
    events: ['order.created', 'tracking.updated'],
  }

  results.push(
    await runStep('GET /api/v1/api-keys', () => adminHttp.get('/api/v1/api-keys')),
  )
  results.push(
    await runStep(
      'POST /api/v1/api-keys',
      async () => {
        const response = await adminHttp.post('/api/v1/api-keys', {
          key_name: `Adhoc Smoke ${Date.now()}`,
        })
        extraKeyId = response.data?.data?.id || null
        return response
      },
      [201],
    ),
  )

  if (extraKeyId) {
    results.push(
      await runStep('PUT /api/v1/api-keys/:id disable', () =>
        adminHttp.put(`/api/v1/api-keys/${extraKeyId}`, { is_active: false }),
      ),
    )
    results.push(
      await runStep('DELETE /api/v1/api-keys/:id', () =>
        adminHttp.delete(`/api/v1/api-keys/${extraKeyId}`),
      ),
    )
  }

  results.push(
    await runStep('GET /api/v1/webhooks', () => adminHttp.get('/api/v1/webhooks')),
  )

  const createWebhookResult = await runStep(
    'POST /api/v1/webhooks',
    async () => {
      const response = await adminHttp.post('/api/v1/webhooks', webhookPayload)
      createdWebhookId = response.data?.data?.id || null
      return response
    },
    [201],
  )
  results.push(createWebhookResult)

  if (createdWebhookId) {
    results.push(
      await runStep('GET /api/v1/webhooks/:id', () =>
        adminHttp.get(`/api/v1/webhooks/${createdWebhookId}`),
      ),
    )
    results.push(
      await runStep('PUT /api/v1/webhooks/:id', () =>
        adminHttp.put(`/api/v1/webhooks/${createdWebhookId}`, {
          name: 'Updated Smoke Webhook',
          is_active: false,
        }),
      ),
    )
    results.push(
      await runStep('POST /api/v1/webhooks/:id/regenerate-secret', () =>
        adminHttp.post(`/api/v1/webhooks/${createdWebhookId}/regenerate-secret`),
      ),
    )
  }

  const client = requireApiHttp()

  results.push(
    await runStep('GET /api/v1/serviceability', () =>
      client.get('/api/v1/serviceability', {
        params: {
          origin: '110001',
          destination: '400001',
          payment_type: 'prepaid',
          weight: '500',
          length: '10',
          breadth: '10',
          height: '10',
        },
      }),
    ),
  )
  results.push(
    await runStep('POST /api/v1/serviceability', () =>
      client.post('/api/v1/serviceability', {
        origin: '110001',
        destination: '400001',
        payment_type: 'prepaid',
        weight: '500',
        length: '10',
        breadth: '10',
        height: '10',
      }),
    ),
  )
  results.push(
    await runStep('POST /api/v1/shipping/rates', () =>
      client.post('/api/v1/shipping/rates', {
        origin: '110001',
        destination: '400001',
        payment_type: 'prepaid',
        weight: '500',
        length: '10',
        breadth: '10',
        height: '10',
      }),
    ),
  )

  for (const path of ['/api/v1/orders', '/api/v1/pickup-addresses', '/api/v1/ndr', '/api/v1/rto']) {
    results.push(await runStep(`GET ${path}`, () => client.get(path)))
  }

  return results
}

const testShiprocketRoutes = async () => {
  const routes = [
    '/api/shiprocket/account/details/wallet-balance',
    '/api/shiprocket/account/details/statement',
    '/api/shiprocket/billing/discrepancy',
    '/api/shiprocket/products',
    '/api/shiprocket/inventory',
    '/api/shiprocket/countries',
    '/api/shiprocket/open/postcode/details?postcode=110001',
    '/api/shiprocket/listings',
    '/api/shiprocket/blocked-pincodes/get',
    '/api/shiprocket/courier/courierListWithCounts',
    '/api/shiprocket/orders',
    '/api/shiprocket/shipments',
    '/api/shiprocket/ndr/list',
    '/api/shiprocket/ndr/all',
    '/api/shiprocket/ndr/rescheduled',
    '/api/shiprocket/pickup-locations',
    '/api/shiprocket/addresses',
  ]

  const results: SmokeResult[] = []
  for (const route of routes) {
    results.push(
      await runStep(`GET ${route}`, () => adminHttp.get(route)),
    )
  }

  return results
}

async function main() {
  const allResults: SmokeResult[] = []

  try {
    await ensureAdminSession()
    await ensureApiKeySession()

    allResults.push(...(await testExternalApiRoutes()))

    if (includeShiprocket) {
      allResults.push(...(await testShiprocketRoutes()))
    } else {
      console.log(
        '[External API smoke] Shiprocket wrapper checks skipped. Set API_SMOKE_INCLUDE_SHIPROCKET=true to include them.',
      )
    }
  } finally {
    await cleanup()
  }

  const failed = allResults.filter((result) => !result.ok)
  if (failed.length > 0) {
    console.error('[External API smoke] failures detected:')
    for (const result of failed) {
      console.error(`- ${result.name}: ${result.status} ${result.details || ''}`.trim())
    }
    process.exit(1)
  }

  console.log(`[External API smoke] all ${allResults.length} checks passed`)
}

main().catch((error) => {
  const summary = summarizeError(error)
  console.error(`[External API smoke] failed: ${summary.details}`)
  process.exit(1)
})
