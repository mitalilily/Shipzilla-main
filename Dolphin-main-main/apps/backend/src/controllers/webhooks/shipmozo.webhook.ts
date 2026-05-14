import { Request, Response } from 'express'
import { and, eq, gte, isNull } from 'drizzle-orm'
import crypto from 'crypto'
import { db } from '../../models/client'
import { courier_credentials } from '../../models/schema/courierCredentials'
import { processShipmozoWebhook } from '../../models/services/webhookProcessor'
import { pending_webhooks } from '../../schema/schema'

const SHIPMOZO_WEBHOOK_SECRET_HEADERS = [
  'x-shipmozo-webhook-secret',
  'x-shipmozo-webhook-signature',
  'x-shipmozo-signature',
  'x-webhook-secret',
  'x-webhook-signature',
  'authorization',
]

const findSecretHeader = (headers: Request['headers']) => {
  const normalized = headers as Record<string, string | string[] | undefined>
  for (const header of SHIPMOZO_WEBHOOK_SECRET_HEADERS) {
    const value = normalized[header] || normalized[header.toLowerCase()]
    if (!value) continue
    if (Array.isArray(value) && value.length) return String(value[0]).trim()
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

const fetchShipmozoWebhookSecret = async () => {
  try {
    const [row] = await db
      .select({
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'shipmozo'))
      .limit(1)
    return (row?.webhookSecret || '').trim()
  } catch (err: any) {
    console.error('Failed to load Shipmozo webhook secret:', err?.message || err)
    return ''
  }
}

const extractShipmozoEvent = (payload: any) => {
  if (payload?.__provider === 'shipmozo' && payload?.body) return payload.body
  if (Array.isArray(payload?.data) && payload.data.length > 0) return payload.data[0]
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

export const shipmozoWebhookHandler = async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString()
  const payload = req.body
  const event = extractShipmozoEvent(payload)
  const configuredSecret = await fetchShipmozoWebhookSecret()
  const receivedSecret = findSecretHeader(req.headers)
  const rawBody = (req as any).rawBody || (req.body ? JSON.stringify(req.body) : '')

  const awb =
    event?.awb_number ||
    event?.awb ||
    event?.waybill ||
    event?.tracking_number ||
    event?.tracking_id ||
    null
  const orderRef =
    event?.order_id ||
    event?.reference_id ||
    event?.reference_number ||
    event?.order_number ||
    null
  const status =
    event?.current_status ||
    event?.shipment_status ||
    event?.status ||
    event?.event ||
    event?.scan_status ||
    'unknown'

  console.log('='.repeat(80))
  console.log(`[${timestamp}] Shipmozo Webhook Received`)
  console.log(`   AWB: ${awb || 'N/A'}`)
  console.log(`   Order Ref: ${orderRef || 'N/A'}`)
  console.log(`   Status: ${status}`)
  console.log(`   IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`)
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2))
  console.log(`   Full Payload:`, JSON.stringify(payload, null, 2))
  console.log('='.repeat(80))

  try {
    if (configuredSecret) {
      if (!receivedSecret) {
        console.warn('Shipmozo webhook missing signature/secret header')
        return res.status(401).json({ success: false, message: 'missing webhook secret' })
      }

      const normalizedHeader = receivedSecret.startsWith('Bearer ')
        ? receivedSecret.slice('Bearer '.length).trim()
        : receivedSecret
      const expectedHmac =
        'sha256=' + crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('hex')
      const candidateValues = [
        normalizedHeader,
        normalizedHeader.startsWith('sha256=') ? normalizedHeader : `sha256=${normalizedHeader}`,
      ]
      const matchesRawSecret = candidateValues.some((value) => value === configuredSecret)
      const matchesHmac = candidateValues.some((value) => {
        const expectedBuf = Buffer.from(expectedHmac)
        const providedBuf = Buffer.from(value)
        return expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)
      })

      if (!matchesRawSecret && !matchesHmac) {
        console.warn('Shipmozo webhook rejected: invalid secret/signature')
        return res.status(401).json({ success: false, message: 'invalid webhook secret' })
      }
    }

    const result = await processShipmozoWebhook(payload)

    if (!result.success && result.reason === 'missing_awb') {
      return res.status(400).json({ success: false, message: 'Missing AWB/order reference' })
    }

    if (!result.success && result.reason === 'order_not_found') {
      const dedupeWindowStart = new Date(Date.now() - 10 * 60 * 1000)
      const pendingAwb = String(awb || orderRef || 'unknown')
      const pendingStatus = `shipmozo:${String(status || 'unknown')}`
      const [existingPending] = await db
        .select({ id: pending_webhooks.id })
        .from(pending_webhooks)
        .where(
          and(
            eq(pending_webhooks.awb_number, pendingAwb),
            eq(pending_webhooks.status, pendingStatus),
            isNull(pending_webhooks.processed_at),
            gte(pending_webhooks.created_at, dedupeWindowStart),
          ),
        )
        .limit(1)

      if (!existingPending) {
        await db.insert(pending_webhooks).values({
          awb_number: pendingAwb,
          status: pendingStatus,
          payload: {
            __provider: 'shipmozo',
            body: payload,
          },
        })
        console.warn(`Stored Shipmozo webhook for ${pendingAwb} (order not yet created).`)
      } else {
        console.warn(`Duplicate pending Shipmozo webhook skipped for ${pendingAwb}.`)
      }

      return res.status(202).json({ success: true, queued: true })
    }

    if (!result.success) {
      return res.status(202).json({ success: false, reason: result.reason })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Shipmozo webhook processing failed:', err?.message || err)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}
