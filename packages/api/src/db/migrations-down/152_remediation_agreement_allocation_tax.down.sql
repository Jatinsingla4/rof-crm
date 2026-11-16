-- Reverses 152. Drops the new tables and column; nothing else read them while the flags were off.
DELETE FROM global_settings WHERE key IN ('agreement_snapshot_v1', 'receipt_allocation_v1');
DROP TABLE IF EXISTS tax_rate;
ALTER TABLE demands DROP COLUMN IF EXISTS booking_id;
DROP TABLE IF EXISTS receipt_allocation;
DROP TRIGGER IF EXISTS booking_agreement_immutable ON booking_agreement;
DROP TABLE IF EXISTS booking_agreement;
DROP FUNCTION IF EXISTS booking_agreement_immutable();
