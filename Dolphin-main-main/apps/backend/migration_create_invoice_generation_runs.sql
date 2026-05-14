DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_generation_run_status') THEN
    CREATE TYPE invoice_generation_run_status AS ENUM ('started', 'succeeded', 'skipped', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_generation_run_source') THEN
    CREATE TYPE invoice_generation_run_source AS ENUM ('cron', 'manual', 'regeneration', 'script');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS invoice_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES users(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES "billingInvoices"(id) ON DELETE SET NULL,
  invoice_no varchar(50),
  source invoice_generation_run_source NOT NULL DEFAULT 'cron',
  status invoice_generation_run_status NOT NULL DEFAULT 'started',
  billing_start date,
  billing_end date,
  orders_count integer DEFAULT 0,
  total_amount numeric(12, 2),
  message text,
  error text,
  metadata jsonb,
  started_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_generation_runs_seller_id
  ON invoice_generation_runs (seller_id);

CREATE INDEX IF NOT EXISTS idx_invoice_generation_runs_invoice_id
  ON invoice_generation_runs (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_generation_runs_status
  ON invoice_generation_runs (status);

CREATE INDEX IF NOT EXISTS idx_invoice_generation_runs_started_at
  ON invoice_generation_runs (started_at DESC);
