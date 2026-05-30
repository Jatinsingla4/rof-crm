-- Migration: Add address1 column to companies table
-- Purpose: Store company's registered/main address for ATS and Conveyance documents

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS address1 VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_companies_id
  ON companies(id);
