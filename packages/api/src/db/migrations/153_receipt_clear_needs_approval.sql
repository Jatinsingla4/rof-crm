-- QA-010 / QA-036 / QA-042: the database itself refuses to make a receipt 'cleared' unless a checker approved it.
-- Before this, only the clear route checked it, so any other writer (script, console, a future route) could create money without approval.
-- The trigger fires only when a row BECOMES cleared (insert as cleared, or a status change to cleared). Rows that are already cleared are never
-- touched or re-checked, so the historical cleared-but-unapproved receipts stay exactly as they are until ROF decides what to do with them
-- (see docs/remediation/wave1/historical-unapproved-receipts-DRYRUN.sql, read only).
CREATE OR REPLACE FUNCTION receipts_cleared_needs_approval() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'cleared'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cleared')
     AND NEW.approval_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'A receipt cannot be cleared before a checker has approved it (receipt %)', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipts_cleared_needs_approval ON receipts;
CREATE TRIGGER trg_receipts_cleared_needs_approval
  BEFORE INSERT OR UPDATE OF status ON receipts
  FOR EACH ROW EXECUTE FUNCTION receipts_cleared_needs_approval();
