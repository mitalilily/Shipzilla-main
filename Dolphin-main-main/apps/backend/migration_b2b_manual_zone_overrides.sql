ALTER TABLE meracourierwala_b2b_pincodes
ADD COLUMN IF NOT EXISTS mapping_source VARCHAR(32) NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN meracourierwala_b2b_pincodes.mapping_source IS
'manual = explicit override/import/create, auto_state = derived from B2B zone state defaults';
