import { Request, Response } from 'express'
import { confirmSuccess, createWalletOrder, markTopupProcessing } from '../models/services/walletTopupService'
import { getPaymentOptions } from '../models/services/paymentOptions.service'
import { isValidPaymentSignature, razorpay } from '../utils/razorpay'

export const createTopup = async (req: Request, res: Response): Promise<any> => {
  const amt = Number(req.body.amount)
  const { name, email, phone } = req.body

  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing customer details' })
  }

  try {
    // Enforce minimum wallet recharge amount (if configured)
    const paymentSettings = await getPaymentOptions()
    const minWalletRecharge = paymentSettings.minWalletRecharge ?? 0

    if (minWalletRecharge > 0 && amt < minWalletRecharge) {
      return res.status(400).json({
        error: `Minimum wallet recharge amount is ₹${minWalletRecharge}`,
        minWalletRecharge,
      })
    }

    const userId = (req as any).user?.sub

    // Razorpay order creation
    const data = await createWalletOrder(userId, amt, { name, email, phone })

    // returns { orderId, amount, currency, key, name, description, prefill, theme }
    res.status(201).json(data)
  } catch (err) {
    console.error('Razorpay top-up error:', err)
    res.status(500).json({ error: 'Top-up failed' })
  }
}

export const confirmFromClient = async (req: Request, res: Response) => {
  const { orderId, paymentId, signature } = req.body

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'orderId, paymentId, and signature are required' })
  }

  if (!isValidPaymentSignature(orderId, paymentId, signature)) {
    return res.status(400).json({ error: 'Invalid payment signature' })
  }

  try {
    const payment = await razorpay.payments.fetch(paymentId)

    if (payment.order_id !== orderId) {
      return res.status(400).json({ error: 'Payment does not belong to the provided order' })
    }

    if (payment.status === 'captured') {
      await confirmSuccess(orderId, paymentId)
      return res.json({ ok: true, status: 'captured' })
    }

    await markTopupProcessing(orderId, paymentId)
    return res.json({ ok: true, status: payment.status })
  } catch (error) {
    console.error('Razorpay confirm error:', error)
    return res.status(500).json({ error: 'Unable to confirm payment' })
  }
}
