-- Migration 064: Add missing columns to companies table
-- Purpose: Sync Neon production companies table with local schema
-- Issue: Neon companies table is missing columns that exist locally
-- Affects: demand_letter generation (documents.ts:376) and other features
-- Error: "column c.reg_address does not exist"
--
-- This migration safely adds all missing columns using IF NOT EXISTS
-- so it can be re-run without errors if some columns already exist.
-- Local schema has 32 columns; Neon appears to have a subset.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS group_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address2 TEXT,
  ADD COLUMN IF NOT EXISTS address3 TEXT,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fax VARCHAR(20),
  ADD COLUMN IF NOT EXISTS service_tax_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vat_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reg_address TEXT,
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS bank_company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payable_at VARCHAR(100);

-- Create index on companies id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_companies_id ON companies(id);
