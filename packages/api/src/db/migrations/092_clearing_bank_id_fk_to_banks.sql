-- Migration 092: Repoint receipts.clearing_bank_id from bank_accounts to banks
-- Part of: Pending Cheque Clearing Bank dropdown fix
-- The Clearing Bank Name dropdown on Verify Pending Cheque Status now
-- populates from Bank Master (banks table) instead of the always-empty
-- company_bank_accounts/bank_accounts tables. The FK must point at the
-- table the dropdown actually submits ids from.

SET search_path TO public;

ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_clearing_bank_id_fkey;

ALTER TABLE receipts
  ADD CONSTRAINT receipts_clearing_bank_id_fkey
  FOREIGN KEY (clearing_bank_id) REFERENCES banks(id) ON DELETE SET NULL;

COMMENT ON COLUMN receipts.clearing_bank_id IS
  'FK to banks (Bank Master) - which bank the cheque cleared into';
