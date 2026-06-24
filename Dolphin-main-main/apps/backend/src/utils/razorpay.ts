import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import Razorpay from 'razorpay'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type RazorpayMode = 'test' | 'live'

export const razorpayMode: RazorpayMode =
  (process.env.RAZORPAY_MODE as RazorpayMode) ??
  (process.env.NODE_ENV === 'production' ? 'live' : 'test')

const firstDefinedEnv = (...names: string[]) =>
  names.map((name) => process.env[name]?.trim()).find(Boolean) ?? ''

const CREDENTIALS: Record<RazorpayMode, { key_id: string; key_secret: string }> = {
  test: {
    key_id: firstDefinedEnv('RAZORPAY_TEST_KEY_ID', 'RAZORPAY_KEY_ID'),
    key_secret: firstDefinedEnv('RAZORPAY_TEST_KEY_SECRET', 'RAZORPAY_KEY_SECRET'),
  },
  live: {
    key_id: firstDefinedEnv('RAZORPAY_LIVE_KEY_ID', 'RAZORPAY_KEY_ID_PROD', 'RAZORPAY_KEY_ID'),
    key_secret: firstDefinedEnv(
      'RAZORPAY_LIVE_KEY_SECRET',
      'RAZORPAY_KEY_SECRET_PROD',
      'RAZORPAY_KEY_SECRET',
    ),
  },
}

const activeCredentials = () => CREDENTIALS[razorpayMode]
const activeWebhookSecret = () =>
  razorpayMode === 'live'
    ? firstDefinedEnv(
        'RAZORPAY_LIVE_WEBHOOK_SECRET',
        'RAZORPAY_WEBHOOK_SECRET_PROD',
        'RAZORPAY_WEBHOOK_SECRET',
      )
    : firstDefinedEnv('RAZORPAY_TEST_WEBHOOK_SECRET', 'RAZORPAY_WEBHOOK_SECRET')

export const isRazorpayConfigured = Boolean(
  activeCredentials().key_id && activeCredentials().key_secret,
)

if (!isRazorpayConfigured) {
  console.warn(
    `[Razorpay] Missing credentials for ${razorpayMode.toUpperCase()} mode. Wallet topups are disabled until env vars are set.`,
  )
}

export const razorpay = new Razorpay({
  key_id: activeCredentials().key_id || 'disabled',
  key_secret: activeCredentials().key_secret || 'disabled',
})

if (isRazorpayConfigured) {
  const expectedPrefix = razorpayMode === 'live' ? 'rzp_live_' : 'rzp_test_'
  if (!activeCredentials().key_id.startsWith(expectedPrefix)) {
    console.warn(
      `[Razorpay] ${razorpayMode.toUpperCase()} mode is using a key that does not start with ${expectedPrefix}. Please verify the env configuration.`,
    )
  }

  console.info(
    `[Razorpay] Initialised in ${razorpayMode.toUpperCase()} mode with key ${activeCredentials().key_id}`,
  )
}

export const getActiveRazorpayKeyId = () => activeCredentials().key_id

const getActiveRazorpaySecret = () => activeCredentials().key_secret

export const razorpayApi = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username: getActiveRazorpayKeyId() || 'disabled',
    password: getActiveRazorpaySecret() || 'disabled',
  },
})

export function isValidSig(body: string, sig: string) {
  const expected = crypto
    .createHmac('sha256', activeWebhookSecret())
    .update(body)
    .digest('hex')
  return expected === sig
}

export function isValidPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto
    .createHmac('sha256', getActiveRazorpaySecret())
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  return expected === signature
}
