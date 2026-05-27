-- Migration: 030_demand_raise_schema_sync
-- Purpose: Ensures all columns for the World-Class Demand Raise module exist.

-- Add missing columns to demands
ALTER TABLE demands ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE demands ADD COLUMN IF NOT EXISTS demand_type VARCHAR(100);
ALTER TABLE demands ADD COLUMN IF NOT EXISTS raised_at TIMESTAMPTZ;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS raised_by UUID REFERENCES users(id);

-- Ensure receipts has status for total_paid calculations
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
