import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { b2b_orders } from './b2bOrders'
import { users } from './users'

export const b2b_label_allotment_audit = pgTable('b2b_label_allotment_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  b2b_order_id: uuid('b2b_order_id')
    .notNull()
    .references(() => b2b_orders.id, { onDelete: 'cascade' }),
  admin_user_id: uuid('admin_user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  previous_awb: varchar('previous_awb', { length: 100 }),
  submitted_awb: varchar('submitted_awb', { length: 100 }),
  label_key: varchar('label_key', { length: 500 }),
  manifest_key: varchar('manifest_key', { length: 500 }),
  note: varchar('note', { length: 1000 }),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})
