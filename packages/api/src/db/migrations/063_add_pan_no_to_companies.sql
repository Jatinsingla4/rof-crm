-- Migration: Add pan_no column to companies table
-- Purpose: Store PAN number for companies, used in ATS and Conveyance documents as company_pan

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS pan_no VARCHAR(50);
