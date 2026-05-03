-- Migration 045: Add registration number to booking_records
-- Implements project-based sequential registration number generation

-- Add registration number columns to booking_records
ALTER TABLE booking_records
ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100);

ALTER TABLE booking_records
ADD COLUMN IF NOT EXISTS form_no VARCHAR(100);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_booking_records_registration_no
  ON booking_records(registration_no);

CREATE INDEX IF NOT EXISTS idx_booking_records_form_no
  ON booking_records(form_no);

-- Create counter table for sequential numbers per project
CREATE TABLE IF NOT EXISTS booking_counters (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  last_number INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_booking_counters_project
  ON booking_counters(project_id);
