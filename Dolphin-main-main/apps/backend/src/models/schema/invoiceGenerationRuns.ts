import {
  date,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { billingInvoices } from './billingInvoices'
import { users } from './users'

export const invoiceGenerationRunStatusEnum = pgEnum('invoice_generation_run_status', [
  'started',
  'succeeded',
  'skipped',
  'failed',
])

export const invoiceGenerationRunSourceEnum = pgEnum('invoice_generation_run_source', [
  'cron',
  'manual',
  'regeneration',
  'script',
])

export const invoiceGenerationRuns = pgTable('invoice_generation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),

  sellerId: uuid('seller_id').references(() => users.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => billingInvoices.id, { onDelete: 'set null' }),
  invoiceNo: varchar('invoice_no', { length: 50 }),

  source: invoiceGenerationRunSourceEnum('source').default('cron').notNull(),
  status: invoiceGenerationRunStatusEnum('status').default('started').notNull(),

  billingStart: date('billing_start'),
  billingEnd: date('billing_end'),
  ordersCount: integer('orders_count').default(0),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }),

  message: text('message'),
  error: text('error'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
