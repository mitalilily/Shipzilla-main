import axios from 'axios'
import { and, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { b2c_label_allotment_audit } from '../schema/b2cLabelAllotmentAudit'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { users } from '../schema/users'
import { isShipmozoAmazonOrder } from './shipmozoAmazonLabelPolicy'
import { presignDownload, presignUpload } from './upload.service'

const PENDING_STATUSES = ['awaiting_awb_allotment', 'label_processing', 'allotment_failed']

const assertPdf = (file: Express.Multer.File | undefined, required: boolean, field: string) => {
  if (!file) {
    if (required) throw new Error(`${field} PDF is required`)
    return
  }
  if (
    file.mimetype !== 'application/pdf' ||
    file.buffer.length < 5 ||
    file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-'
  ) {
    throw new Error(`${field} must be a valid PDF`)
  }
  if (file.size > 15 * 1024 * 1024) throw new Error(`${field} PDF must be 15 MB or smaller`)
}

const uploadPdf = async (file: Express.Multer.File, userId: string, folderKey: string, filename: string) => {
  const descriptor = await presignUpload({ filename, contentType: 'application/pdf', userId, folderKey })
  await axios.put(descriptor.uploadUrl, file.buffer, {
    headers: { 'Content-Type': 'application/pdf' },
    maxBodyLength: Infinity,
  })
  return descriptor.key
}

export async function getPendingB2CAmazonLabelAllotments(params: {
  page?: number
  limit?: number
  search?: string
  status?: string
}) {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 25))
  const conditions: any[] = []
  conditions.push(sql`lower(coalesce(${b2c_orders.order_status}, '')) <> 'cancelled'`)
  conditions.push(
    params.status && params.status !== 'pending'
      ? eq(b2c_orders.label_allotment_status, params.status)
      : inArray(b2c_orders.label_allotment_status, PENDING_STATUSES),
  )
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`
    conditions.push(
      or(
        ilike(b2c_orders.order_number, term),
        ilike(b2c_orders.awb_number, term),
        ilike(b2c_orders.buyer_name, term),
        ilike(users.email, term),
      ),
    )
  }
  const where = and(...conditions)
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: b2c_orders.id,
        order_number: b2c_orders.order_number,
        client_email: users.email,
        created_at: b2c_orders.created_at,
        updated_at: b2c_orders.updated_at,
        courier_partner: b2c_orders.courier_partner,
        provider_awb: b2c_orders.awb_number,
        shipment_id: b2c_orders.shipment_id,
        provider_order_id: b2c_orders.order_id,
        pickup_details: b2c_orders.pickup_details,
        destination_pincode: b2c_orders.pincode,
        destination_city: b2c_orders.city,
        buyer_name: b2c_orders.buyer_name,
        weight: b2c_orders.weight,
        payment_mode: b2c_orders.order_type,
        order_status: b2c_orders.order_status,
        label_allotment_status: b2c_orders.label_allotment_status,
        label_allotment_note: b2c_orders.label_allotment_note,
      })
      .from(b2c_orders)
      .leftJoin(users, eq(users.id, b2c_orders.user_id))
      .where(where)
      .orderBy(desc(b2c_orders.created_at))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)::int` }).from(b2c_orders).where(where),
  ])
  return { rows, total: Number(countRows[0]?.count || 0), page, limit }
}

export async function getPendingB2CAmazonLabelAllotmentCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(b2c_orders)
    .where(and(
      inArray(b2c_orders.label_allotment_status, PENDING_STATUSES),
      sql`lower(coalesce(${b2c_orders.order_status}, '')) <> 'cancelled'`,
    ))
  return Number(row?.count || 0)
}

export async function allotB2CAmazonAwb(params: {
  orderId: string
  awb: string
  courierName?: string
  note?: string
  adminUserId?: string
  labelFile?: Express.Multer.File
  manifestFile?: Express.Multer.File
}) {
  const awb = String(params.awb || '').trim()
  if (!awb) throw new Error('AWB number is required')
  if (!/^[A-Za-z0-9/_-]{5,100}$/.test(awb)) throw new Error('Enter a valid AWB number')
  assertPdf(params.labelFile, true, 'Label')
  assertPdf(params.manifestFile, false, 'Manifest')

  const [order] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, params.orderId)).limit(1)
  if (!order) throw new Error('B2C order not found')
  if (!isShipmozoAmazonOrder(order)) throw new Error('Manual B2C allotment is available only for Shipmozo Amazon orders')
  if (String(order.order_status || '').toLowerCase() === 'cancelled') {
    throw new Error('A cancelled shipment cannot receive an AWB')
  }

  const [duplicateB2C, duplicateB2B] = await Promise.all([
    db.select({ order_number: b2c_orders.order_number }).from(b2c_orders).where(and(
      ne(b2c_orders.id, order.id),
      sql`lower(trim(${b2c_orders.awb_number})) = lower(${awb})`,
      sql`lower(coalesce(${b2c_orders.order_status}, '')) <> 'cancelled'`,
    )).limit(1),
    db.select({ order_number: b2b_orders.order_number }).from(b2b_orders).where(and(
      sql`lower(trim(${b2b_orders.awb_number})) = lower(${awb})`,
      sql`lower(coalesce(${b2b_orders.order_status}, '')) <> 'cancelled'`,
    )).limit(1),
  ])
  const duplicate = duplicateB2C[0] || duplicateB2B[0]
  if (duplicate) throw new Error(`AWB already belongs to ${duplicate.order_number}`)

  await db.update(b2c_orders).set({ label_allotment_status: 'label_processing', updated_at: new Date() }).where(eq(b2c_orders.id, order.id))

  try {
    const safeOrder = order.order_number.replace(/[^A-Za-z0-9_-]/g, '_')
    const revision = Date.now()
    const labelKey = await uploadPdf(params.labelFile!, order.user_id, 'b2c-labels', `${safeOrder}-${awb}-${revision}.pdf`)
    const manifestKey = params.manifestFile
      ? await uploadPdf(params.manifestFile, order.user_id, 'b2c-manifests', `${safeOrder}-manifest-${revision}.pdf`)
      : null
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx.update(b2c_orders).set({
        awb_number: awb,
        courier_partner: params.courierName?.trim() || order.courier_partner,
        label: labelKey,
        manifest: manifestKey || order.manifest,
        awb_released_at: now,
        label_uploaded_at: now,
        label_uploaded_by: params.adminUserId || null,
        label_source: 'admin_manual',
        label_allotment_status: 'awb_allotted',
        label_allotment_note: params.note?.trim() || null,
        delivery_message: 'AWB and label allotted',
        updated_at: now,
      }).where(eq(b2c_orders.id, order.id))
      await tx.insert(b2c_label_allotment_audit).values({
        b2c_order_id: order.id,
        admin_user_id: params.adminUserId || null,
        action: order.awb_released_at ? 'reallotted' : 'allotted',
        previous_awb: order.awb_number,
        submitted_awb: awb,
        label_key: labelKey,
        manifest_key: manifestKey,
        note: params.note?.trim() || null,
        metadata: { originalLabelName: params.labelFile!.originalname },
      })
    })
    return { orderId: order.id, orderNumber: order.order_number, awb, labelUrl: await presignDownload(labelKey), status: 'awb_allotted' }
  } catch (error) {
    await db.update(b2c_orders).set({
      label_allotment_status: 'allotment_failed',
      label_allotment_note: error instanceof Error ? error.message : 'Upload failed',
      updated_at: new Date(),
    }).where(eq(b2c_orders.id, order.id))
    throw error
  }
}
