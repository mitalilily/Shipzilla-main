BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shipzilla_locations'
  ) THEN
    DELETE FROM public.shipzilla_locations a
    USING public.shipzilla_locations b
    WHERE a.ctid < b.ctid
      AND a.pincode = b.pincode;

    CREATE UNIQUE INDEX IF NOT EXISTS locations_pincode_unique_idx
      ON public.shipzilla_locations (pincode);
  END IF;
END $$;

COMMIT;
