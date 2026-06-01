-- Migration 065: Add remaining missing columns to companies table
-- Purpose: Complete the companies table schema on Neon
-- Issue: phone, website, email columns were missing from migration 064
-- Affects: demand_letter generation (documents.ts:376)
--
-- These columns exist locally and are needed by the demand_letter query

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255);
