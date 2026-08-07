import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { b2c_orders } from './b2cOrders'
import { users } from './users'

export const b2c_label_allotment_audit = pgTable('b2c_label_allotment_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  b2c_order_id: uuid('b2c_order_id').references(() => b2c_orders.id, { onDelete: 'cascade' }).notNull(),
  admin_user_id: uuid('admin_user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  previous_awb: varchar('previous_awb', { length: 100 }),
  submitted_awb: varchar('submitted_awb', { length: 100 }).notNull(),
  label_key: varchar('label_key', { length: 500 }).notNull(),
  manifest_key: varchar('manifest_key', { length: 500 }),
  note: text('note'),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})
