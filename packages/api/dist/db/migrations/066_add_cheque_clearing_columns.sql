-- Migration 066: Add cheque clearing columns to receipts table
-- Part of: Cheque Clearing feature
-- Adds deposit_date, clearing_date, hold_remark, clearing_bank_id

SET search_path TO public;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS deposit_date     DATE,
  ADD COLUMN IF NOT EXISTS clearing_date    DATE,
  ADD COLUMN IF NOT EXISTS hold_remark      TEXT,
  ADD COLUMN IF NOT EXISTS clearing_bank_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- status is varchar — no enum change needed
-- New valid values: deposited, cleared, on_hold
-- Existing values:  pending, cancelled, bounced

COMMENT ON COLUMN receipts.status IS
  'Values: pending, deposited, cleared, bounced, cancelled, on_hold';

COMMENT ON COLUMN receipts.deposit_date IS
  'Date cheque was deposited to company bank';

COMMENT ON COLUMN receipts.clearing_date IS
  'Date cheque was confirmed cleared by bank';

COMMENT ON COLUMN receipts.hold_remark IS
  'Reason cheque is on hold - free text';

COMMENT ON COLUMN receipts.clearing_bank_id IS
  'FK to bank_accounts - which company bank account the cheque cleared into';
