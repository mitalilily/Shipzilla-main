BEGIN;

ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS awb_released_at timestamp,
  ADD COLUMN IF NOT EXISTS provider_label varchar(500),
  ADD COLUMN IF NOT EXISTS label_uploaded_at timestamp,
  ADD COLUMN IF NOT EXISTS label_uploaded_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS label_source varchar(50),
  ADD COLUMN IF NOT EXISTS label_allotment_status varchar(50),
  ADD COLUMN IF NOT EXISTS label_allotment_note text;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text;

-- Preserve all historical shipments exactly as customers see them today.
UPDATE b2b_orders
SET
  awb_released_at = COALESCE(awb_released_at, updated_at, created_at, NOW()),
  label_allotment_status = 'awb_allotted',
  label_source = COALESCE(label_source, CASE WHEN label IS NOT NULL THEN 'legacy' ELSE NULL END)
WHERE label_allotment_status IS NULL;

CREATE TABLE IF NOT EXISTS b2b_label_allotment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_order_id uuid NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES users(id),
  action varchar(50) NOT NULL,
  previous_awb varchar(100),
  submitted_awb varchar(100),
  label_key varchar(500),
  manifest_key varchar(500),
  note varchar(1000),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS b2b_orders_label_allotment_status_idx
  ON b2b_orders (label_allotment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS b2b_label_allotment_audit_order_idx
  ON b2b_label_allotment_audit (b2b_order_id, created_at DESC);
COMMIT;
