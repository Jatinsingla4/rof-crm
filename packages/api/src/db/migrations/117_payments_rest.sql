-- Payments (refunds, waivers, interest, GST invoices): a refund can now be rejected, an invoice remembers its receipt (one live invoice per receipt),
-- and the database refuses amounts that make no sense. The checks are NOT VALID so rows already stored are not re-checked, every new or changed row is.
ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES users(id);
ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE payment_refunds ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE gst_invoices ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES receipts(id);
CREATE UNIQUE INDEX IF NOT EXISTS gst_invoices_live_receipt_uq ON gst_invoices (receipt_id) WHERE receipt_id IS NOT NULL AND status <> 'cancelled';

DO $$ BEGIN
  ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_amount_pos CHECK (refund_amount_inr > 0) NOT VALID;
  ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_status_ck CHECK (status IN ('pending','approved','processed','rejected')) NOT VALID;
  ALTER TABLE interest_waivers ADD CONSTRAINT interest_waivers_amount_pos CHECK (waiver_amount_inr > 0) NOT VALID;
  ALTER TABLE interest_waivers ADD CONSTRAINT interest_waivers_status_ck CHECK (status IN ('pending','approved','rejected')) NOT VALID;
  ALTER TABLE penal_interests ADD CONSTRAINT penal_interests_waived_ck CHECK (interest_waived_inr IS NULL OR (interest_waived_inr >= 0 AND interest_waived_inr <= COALESCE(amount_inr, interest_waived_inr))) NOT VALID;
  ALTER TABLE credit_debit_notes ADD CONSTRAINT credit_debit_notes_amount_pos CHECK (adjustment_amount > 0) NOT VALID;
  ALTER TABLE credit_debit_notes ADD CONSTRAINT credit_debit_notes_type_ck CHECK (note_type IN ('credit','debit')) NOT VALID;
  ALTER TABLE draw_refunds ADD CONSTRAINT draw_refunds_status_ck CHECK (refund_status IN ('pending','initiated','completed')) NOT VALID;
  ALTER TABLE project_interest_rates ADD CONSTRAINT project_interest_rates_rate_ck CHECK (rate_percent >= 0 AND rate_percent <= 100) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
