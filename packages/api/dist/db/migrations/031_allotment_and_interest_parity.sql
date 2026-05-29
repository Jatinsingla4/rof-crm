-- Migration: 031_allotment_and_interest_parity
-- Purpose: Adds manual override fields for allotments and configurable interest settings.

-- Add manual override fields to allocations
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS allotment_date DATE;

-- Add remarks to allotment_letters
ALTER TABLE allotment_letters ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Add interest waiver support
ALTER TABLE penal_interests ADD COLUMN IF NOT EXISTS interest_waived_inr BIGINT DEFAULT 0;

-- Create settings table for global parameters
CREATE TABLE IF NOT EXISTS global_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial interest rate (15% as per legacy CRM)
INSERT INTO global_settings (key, value, description)
VALUES ('penal_interest_rate_percent', '15.0', 'Annual interest rate for late payments (Legacy standard)')
ON CONFLICT (key) DO UPDATE SET value = '15.0';
