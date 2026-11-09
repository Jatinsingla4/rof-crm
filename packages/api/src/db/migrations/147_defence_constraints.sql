-- 147: the database refuses what no screen should ever send (TA-11, defence in depth).
-- Idempotent and safe on existing data: CHECKs are added NOT VALID (enforced for every new or changed row, old rows are not re-checked),
-- and a unique index is created only when the data has no duplicate today (otherwise it is skipped with a NOTICE for someone to clean up first).

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('receipts',        'amount_received_inr', '> 0'),
    ('receipts',        'cgst_amount',         '>= 0'),
    ('receipts',        'sgst_amount',         '>= 0'),
    ('demands',         'amount_due_inr',      '>= 0'),
    ('demands',         'cgst_amount',         '>= 0'),
    ('demands',         'sgst_amount',         '>= 0'),
    ('payment_plans',   'total_amount_inr',    '>= 0'),
    ('booking_records', 'booking_amount',      '>= 0'),
    ('booking_records', 'approved_rebate_amount', '>= 0'),
    ('units',           'base_price_inr',      '>= 0')
  ) AS v(t, col, rule)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_' || c.t || '_' || c.col || '_sane' AND conrelid = c.t::regclass) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I %s) NOT VALID', c.t, 'chk_' || c.t || '_' || c.col || '_sane', c.col, c.rule);
    END IF;
  END LOOP;
END $$;

-- Unique numbers: a registration number or a form number belongs to one booking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_booking_records_registration_no') THEN
    IF EXISTS (SELECT 1 FROM booking_records WHERE registration_no IS NOT NULL GROUP BY registration_no HAVING COUNT(*) > 1) THEN
      RAISE NOTICE 'uq_booking_records_registration_no skipped: duplicate registration numbers exist';
    ELSE CREATE UNIQUE INDEX uq_booking_records_registration_no ON booking_records (registration_no) WHERE registration_no IS NOT NULL; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_booking_records_form_no') THEN
    IF EXISTS (SELECT 1 FROM booking_records WHERE form_no IS NOT NULL GROUP BY form_no HAVING COUNT(*) > 1) THEN
      RAISE NOTICE 'uq_booking_records_form_no skipped: duplicate form numbers exist';
    ELSE CREATE UNIQUE INDEX uq_booking_records_form_no ON booking_records (form_no) WHERE form_no IS NOT NULL; END IF;
  END IF;
  -- unique (project_id, mobile) ignores a NULL project, so an applicant with no project could be entered twice with one mobile
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_consumers_mobile_no_project') THEN
    IF EXISTS (SELECT 1 FROM consumers WHERE project_id IS NULL AND mobile IS NOT NULL GROUP BY mobile HAVING COUNT(*) > 1) THEN
      RAISE NOTICE 'uq_consumers_mobile_no_project skipped: duplicate mobiles with no project exist';
    ELSE CREATE UNIQUE INDEX uq_consumers_mobile_no_project ON consumers (mobile) WHERE project_id IS NULL AND mobile IS NOT NULL; END IF;
  END IF;
END $$;

-- The audit log is append-only for the application: no UPDATE and no DELETE from the API or any login that is not a database superuser.
-- (A superuser, the test databases' cleanup and a DBA doing maintenance by hand, is not stopped; the application never runs as one in production.)
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('is_superuser') = 'on' THEN RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'audit_logs is append-only (% refused)', TG_OP USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
