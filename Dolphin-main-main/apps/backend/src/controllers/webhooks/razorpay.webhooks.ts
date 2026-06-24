import { Request, Response } from 'express'
import { markBankRejected, markBankVerified } from '../../models/services/bankAccount.service'
import { confirmFailure, confirmSuccess } from '../../models/services/walletTopupService'
import { isValidSig } from '../../utils/razorpay'

export const razorpayWebhook = async (req: Request, res: Response): Promise<any> => {
  const timestamp = new Date().toISOString()
  const sig = req.headers['x-razorpay-signature'] as string
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {})

  console.log('='.repeat(80))
  console.log(`[${timestamp}] Razorpay webhook received`)
  console.log(`   IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`)
  console.log(`   Signature Present: ${!!sig}`)
  console.log('='.repeat(80))

  if (!isValidSig(rawBody, sig)) {
    console.error('Razorpay webhook rejected: invalid signature')
    return res.status(400).send('Invalid signature')
  }

  try {
    const payload = JSON.parse(rawBody)
    const event = payload.event

    console.log(`Razorpay webhook signature verified for event: ${event || 'unknown'}`)

    switch (event) {
      case 'payment.captured': {
        const pay = payload.payload.payment.entity
        await confirmSuccess(pay.order_id, pay.id)
        break
      }

      case 'payment.failed': {
        const pay = payload.payload.payment.entity
        await confirmFailure(pay.order_id, pay.id, pay.error_description)
        break
      }

      case 'fund.account.validation.completed': {
        const validation = payload.payload.fund_account_validation.entity

        if (validation.status === 'success') {
          await markBankVerified(validation.fund_account_id)
        } else {
          const reason =
            validation.results?.reason_description ||
            validation.results?.reason ||
            'Unknown failure'
          await markBankRejected(validation.fund_account_id, reason)
        }

        break
      }

      default:
        console.warn(`Unhandled Razorpay webhook event: ${event}`)
    }

    return res.json({ received: true })
  } catch (error: any) {
    console.error('='.repeat(80))
    console.error(`[${timestamp}] Razorpay webhook handler error`)
    console.error(`   Error Message: ${error?.message || error}`)
    console.error(`   Error Stack:`, error?.stack)
    console.error('='.repeat(80))
    return res.status(500).json({ error: 'Internal webhook handler error' })
  }
}
