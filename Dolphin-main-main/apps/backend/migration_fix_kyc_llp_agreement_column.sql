DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc'
      AND column_name = '  llpAgreementUrl'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc'
      AND column_name = 'llpAgreementUrl'
  ) THEN
    ALTER TABLE "kyc" RENAME COLUMN "  llpAgreementUrl" TO "llpAgreementUrl";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc'
      AND column_name = '  llpAgreementUrl'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kyc'
      AND column_name = 'llpAgreementUrl'
  ) THEN
    UPDATE "kyc"
    SET "llpAgreementUrl" = COALESCE("llpAgreementUrl", "  llpAgreementUrl")
    WHERE "llpAgreementUrl" IS NULL
      AND "  llpAgreementUrl" IS NOT NULL;

    ALTER TABLE "kyc" DROP COLUMN "  llpAgreementUrl";
  END IF;
END $$;
