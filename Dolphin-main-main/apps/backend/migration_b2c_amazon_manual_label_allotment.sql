ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS awb_released_at timestamp;
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS provider_label text;
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS label_uploaded_at timestamp;
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS label_uploaded_by uuid REFERENCES users(id);
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS label_source varchar(50);
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS label_allotment_status varchar(50);
ALTER TABLE b2c_orders ADD COLUMN IF NOT EXISTS label_allotment_note text;

CREATE TABLE IF NOT EXISTS b2c_label_allotment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  b2c_order_id uuid NOT NULL REFERENCES b2c_orders(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES users(id),
  action varchar(50) NOT NULL,
  previous_awb varchar(100),
  submitted_awb varchar(100) NOT NULL,
  label_key varchar(500) NOT NULL,
  manifest_key varchar(500),
  note text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS b2c_label_allotment_status_idx
  ON b2c_orders(label_allotment_status, created_at DESC);
