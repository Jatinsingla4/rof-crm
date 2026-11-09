-- Migration 148: an advance part made from an overpayment remembers which receipt it came from.
-- Before, the part carried only the demand it was taken from, so cancelling the paying receipt left its advance parts behind and the same money
-- stayed counted against the next instalments. Old rows keep NULL (their source is not recorded and is not guessed).
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS advance_source_receipt_id uuid;
CREATE INDEX IF NOT EXISTS idx_receipts_advance_source ON receipts (advance_source_receipt_id) WHERE advance_source_receipt_id IS NOT NULL;
