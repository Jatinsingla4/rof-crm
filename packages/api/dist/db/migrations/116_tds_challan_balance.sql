-- TDS challans: a locked running balance, the scanned file kept in the database, and assignments that can be released
-- (a cancelled or bounced receipt gives its challan amount back) without losing the history.
ALTER TABLE tds_challans
  ADD COLUMN IF NOT EXISTS assigned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

ALTER TABLE tds_assignments
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_reason TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);

UPDATE tds_challans c SET assigned_amount = COALESCE((
  SELECT SUM(a.amount_assigned) FROM tds_assignments a WHERE a.challan_id = c.id AND a.released_at IS NULL), 0);

DO $$ BEGIN
  ALTER TABLE tds_challans ADD CONSTRAINT tds_challans_amount_pos CHECK (amount > 0) NOT VALID;
  ALTER TABLE tds_challans ADD CONSTRAINT tds_challans_balance CHECK (assigned_amount >= 0 AND assigned_amount <= amount) NOT VALID;
  ALTER TABLE tds_assignments ADD CONSTRAINT tds_assignments_amount_pos CHECK (amount_assigned > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tds_challans_number_ci ON tds_challans (lower(challan_number));
CREATE UNIQUE INDEX IF NOT EXISTS tds_assignments_live ON tds_assignments (challan_id, receipt_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS tds_assignments_receipt ON tds_assignments (receipt_id);

-- Journal entries were numbered from a sequence that no migration ever created, so adding one always failed with a 500
CREATE SEQUENCE IF NOT EXISTS journal_entry_seq;
