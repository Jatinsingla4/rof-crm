-- Migration 075: Extend surrender_applications and cancellations
-- with all fields needed for the surrender/cancellation form.
-- Fully idempotent.

ALTER TABLE surrender_applications
  ADD COLUMN IF NOT EXISTS booking_record_id    UUID REFERENCES booking_records(id),
  ADD COLUMN IF NOT EXISTS surrender_type       VARCHAR(50) DEFAULT 'voluntary',
  ADD COLUMN IF NOT EXISTS refund_mode          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS penalty_base_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_gst_amount   NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_total_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_addon_charges  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_included         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_tax_included BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_included         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_included    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS premium_amount       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_noc             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS broker_noc           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS noc_document_path    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS remark               TEXT,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now();

ALTER TABLE cancellations
  ADD COLUMN IF NOT EXISTS booking_record_id    UUID REFERENCES booking_records(id),
  ADD COLUMN IF NOT EXISTS surrender_type       VARCHAR(50) DEFAULT 'builder_cancellation',
  ADD COLUMN IF NOT EXISTS refund_mode          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS penalty_base_amount  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_total_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_addon_charges  NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_included         BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS interest_included    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS premium_amount       NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_noc             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS broker_noc           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS remark               TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id   UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT now();
