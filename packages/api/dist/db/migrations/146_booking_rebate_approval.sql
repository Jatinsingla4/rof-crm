-- Company rebate approval (QA-007, owner decisions Q10 and Q11).
-- A rebate entered on a booking starts as "pending" and changes no price, demand, balance or report until a different authorised
-- user approves it. approved_rebate_amount is the rupee amount that is actually applied (0 unless the status is "approved").
-- Existing bookings: a rebate that was typed on a booking before this change was never used in any price. It is marked "legacy" and is
-- NOT applied silently; the booking has to be edited and the rebate submitted again to go through approval.
-- Idempotent: CI runs every migration twice. The backfill runs only the first time (when the status column is created).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_records' AND column_name = 'company_rebate_status') THEN
    ALTER TABLE booking_records
      ADD COLUMN company_rebate_status   text          NOT NULL DEFAULT 'none',
      ADD COLUMN approved_rebate_amount  numeric(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN rebate_requested_by     uuid REFERENCES users(id),
      ADD COLUMN rebate_requested_at     timestamptz,
      ADD COLUMN rebate_decided_by       uuid REFERENCES users(id),
      ADD COLUMN rebate_decided_at       timestamptz,
      ADD COLUMN rebate_decision_reason  text;
    UPDATE booking_records
       SET company_rebate_status = 'legacy'
     WHERE COALESCE(company_rebate_rs, 0) <> 0 OR COALESCE(company_rebate_sqft, 0) <> 0 OR COALESCE(company_rebate_pct, 0) <> 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_rebate_status_ck') THEN
    ALTER TABLE booking_records ADD CONSTRAINT booking_rebate_status_ck
      CHECK (company_rebate_status IN ('none', 'pending', 'approved', 'rejected', 'legacy'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_rebate_amount_ck') THEN
    ALTER TABLE booking_records ADD CONSTRAINT booking_rebate_amount_ck
      CHECK (approved_rebate_amount >= 0 AND (company_rebate_status = 'approved' OR approved_rebate_amount = 0));
  END IF;
END $$;
