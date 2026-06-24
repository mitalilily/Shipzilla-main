import crypto from 'crypto'
import { Request, Response } from 'express'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db } from '../../models/client'
import { courier_credentials } from '../../models/schema/courierCredentials'
import { processIcarryWebhookPayload } from '../../models/services/icarryWebhook.service'
import { pending_webhooks } from '../../schema/schema'

const trim = (value: unknown) => String(value ?? '').trim()

const timingSafeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

const getConfiguredIcarryWebhookTokens = async () => {
  const tokens = new Set<string>()

  try {
    const [row] = await db
      .select({
        apiKey: courier_credentials.apiKey,
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, 'icarry'))
      .limit(1)

    ;[row?.webhookSecret, row?.apiKey].forEach((value) => {
      const token = trim(value)
      if (token) tokens.add(token)
    })
  } catch (err: any) {
    console.error('Failed to load iCarry webhook token:', err?.message || err)
  }

  ;[
    process.env.ICARRY_WEBHOOK_SECRET,
    process.env.ICARRY_API_TOKEN,
    process.env.ICARRY_API_KEY,
    process.env.ICARRY_KEY,
    process.env.ICARRY_PASSWORD,
  ].forEach((value) => {
    const token = trim(value)
    if (token) tokens.add(token)
  })

  return [...tokens]
}

const queuePendingIcarryWebhook = async (awb: string, status: string, payload: any) => {
  const dedupeWindowStart = new Date(Date.now() - 10 * 60 * 1000)
  const [existingPending] = await db
    .select({ id: pending_webhooks.id })
    .from(pending_webhooks)
    .where(
      and(
        eq(pending_webhooks.awb_number, awb),
        eq(pending_webhooks.status, status),
        isNull(pending_webhooks.processed_at),
        gte(pending_webhooks.created_at, dedupeWindowStart),
      ),
    )
    .limit(1)

  if (!existingPending) {
    await db.insert(pending_webhooks).values({
      awb_number: awb,
      status,
      payload: {
        __provider: 'icarry',
        body: payload,
      },
    })
    return true
  }

  return false
}

export const icarryWebhookHandler = async (req: Request, res: Response) => {
  const timestamp = new Date().toISOString()
  const payload = req.body || {}
  const clientName = trim(payload?.client_name).toLowerCase()
  const callbackType = trim(payload?.callback_type).toLowerCase()
  const awb = trim(payload?.awb || payload?.waybill || payload?.tracking_number)
  const status = trim(payload?.status)
  const ndrData = Array.isArray(payload?.ndr_data) ? payload.ndr_data : []
  const token = trim(payload?.token)

  console.log('='.repeat(80))
  console.log(`[${timestamp}] iCarry Webhook Received`)
  console.log(`   Client: ${clientName || 'N/A'}`)
  console.log(`   Callback Type: ${callbackType || 'N/A'}`)
  console.log(`   AWB: ${awb || 'N/A'}`)
  console.log(`   Status: ${status || 'N/A'}`)
  console.log(`   IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`)
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2))
  console.log(`   Full Payload:`, JSON.stringify(payload, null, 2))
  console.log('='.repeat(80))

  try {
    if (clientName && clientName !== 'icarry') {
      return res.status(400).json({ success: false, message: 'invalid client_name' })
    }

    if (callbackType && !['sync_status', 'ndr_status', 'new_weight_discrepancy'].includes(callbackType)) {
      return res.status(400).json({ success: false, message: 'invalid callback_type' })
    }

    if (callbackType === 'ndr_status') {
      if (!ndrData.length) {
        return res.status(400).json({ success: false, message: 'Missing ndr_data entries' })
      }
    } else if (callbackType === 'new_weight_discrepancy') {
      const shipmentId = trim(payload?.shipment_id || payload?.shipmentId)
      if (!awb && !shipmentId) {
        return res.status(400).json({ success: false, message: 'Missing AWB/shipment_id' })
      }
      if (!status) {
        return res.status(400).json({ success: false, message: 'Missing status code' })
      }
      if (!trim(payload?.old_weight) || !trim(payload?.new_weight)) {
        return res.status(400).json({ success: false, message: 'Missing old_weight/new_weight' })
      }
    } else {
      if (!awb) {
        return res.status(400).json({ success: false, message: 'Missing AWB/tracking number' })
      }

      if (!status) {
        return res.status(400).json({ success: false, message: 'Missing status code' })
      }
    }

    const configuredTokens = await getConfiguredIcarryWebhookTokens()
    if (!configuredTokens.length) {
      return res.status(503).json({
        success: false,
        message: 'iCarry webhook token is not configured',
      })
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'missing webhook token' })
    }

    const hasValidToken = configuredTokens.some((expected) => timingSafeEquals(expected, token))
    if (!hasValidToken) {
      return res.status(401).json({ success: false, message: 'invalid webhook token' })
    }

    const result = await processIcarryWebhookPayload(payload)

    if (!result.success && result.reason === 'order_not_found' && callbackType === 'ndr_status') {
      const ndrResult = result as typeof result & { missing_orders?: any[] }
      let queuedCount = 0
      for (const item of ndrResult.missing_orders || []) {
        const entryAwb = trim(item?.awb)
        if (!entryAwb) continue
        const entryStatus = `icarry:ndr:${trim(item?.type || 'MANUAL-VERIFY')}:${trim(item?.date_added || 'unknown')}`
        const queued = await queuePendingIcarryWebhook(entryAwb, entryStatus, {
          client_name: 'icarry',
          callback_type: 'ndr_status',
          ndr_data: [item],
        })
        if (queued) {
          queuedCount++
          console.warn(`Stored iCarry NDR webhook for AWB ${entryAwb} (order not yet created).`)
        } else {
          console.warn(`Duplicate pending iCarry NDR webhook skipped for AWB ${entryAwb}.`)
        }
      }

      return res.status(202).json({ success: true, queued: true, queued_count: queuedCount })
    }

    if (!result.success && result.reason === 'order_not_found') {
      const pendingStatus = `icarry:${status || 'unknown'}`
      const queued = await queuePendingIcarryWebhook(awb, pendingStatus, payload)
      if (queued) {
        console.warn(`Stored iCarry webhook for AWB ${awb} (order not yet created).`)
      } else {
        console.warn(`Duplicate pending iCarry webhook skipped for AWB ${awb}.`)
      }
      return res.status(202).json({ success: true, queued: true })
    }

    if (!result.success && result.reason === 'missing_ndr_data') {
      return res.status(400).json({ success: false, message: 'Missing ndr_data entries' })
    }

    if (!result.success && result.reason === 'missing_weight') {
      return res.status(400).json({ success: false, message: 'Missing old_weight/new_weight' })
    }

    if (!result.success) {
      return res.status(400).json({ success: false, reason: result.reason })
    }

    if (callbackType === 'ndr_status') {
      const ndrResult = result as typeof result & {
        processed?: any[]
        duplicates?: any[]
        missing_orders?: any[]
        invalid_entries?: any[]
      }
      let queuedCount = 0
      for (const item of ndrResult.missing_orders || []) {
        const entryAwb = trim(item?.awb)
        if (!entryAwb) continue
        const entryStatus = `icarry:ndr:${trim(item?.type || 'MANUAL-VERIFY')}:${trim(item?.date_added || 'unknown')}`
        const queued = await queuePendingIcarryWebhook(entryAwb, entryStatus, {
          client_name: 'icarry',
          callback_type: 'ndr_status',
          ndr_data: [item],
        })
        if (queued) queuedCount++
      }

      return res.status(200).json({
        success: true,
        processed_count: ndrResult.processed?.length || 0,
        duplicate_count: ndrResult.duplicates?.length || 0,
        queued_count: queuedCount,
        invalid_count: ndrResult.invalid_entries?.length || 0,
      })
    }

    if (callbackType === 'new_weight_discrepancy') {
      const weightResult = result as typeof result & { discrepancy_id?: string }
      return res.status(200).json({
        success: true,
        discrepancy_id: weightResult.discrepancy_id || null,
      })
    }

    const statusResult = result as typeof result & { changed?: boolean }
    return res.status(200).json({ success: true, changed: statusResult.changed === true })
  } catch (err: any) {
    console.error('iCarry webhook processing failed:', err?.message || err)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}
