-- Migration 046: Add applicant_type to consumers and extend co_applicants table

-- Add applicant_type to consumers table
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS applicant_type VARCHAR(20) DEFAULT 'individual';

-- Add company applicant fields to consumers
ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS company_reg_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS company_gstin VARCHAR(20),
  ADD COLUMN IF NOT EXISTS authorized_person VARCHAR(200),
  ADD COLUMN IF NOT EXISTS authorized_designation VARCHAR(100);

-- Extend co_applicants with plaintext and additional fields
ALTER TABLE co_applicants
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS salutation VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS pan_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS aadhaar_no VARCHAR(20);
