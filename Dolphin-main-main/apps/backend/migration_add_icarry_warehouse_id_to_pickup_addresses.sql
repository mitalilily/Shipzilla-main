ALTER TABLE pickup_addresses
ADD COLUMN IF NOT EXISTS "icarryWarehouseId" varchar(100);

CREATE INDEX IF NOT EXISTS idx_pickup_addresses_icarry_warehouse_id
ON pickup_addresses("icarryWarehouseId");
