-- Migration: 029_fix_dashboard_schema_gaps
-- Date: 2026-04-30
-- Purpose: Adds missing status columns and aligns table names for the dashboard.

-- Add status to receipts (pending, approved, rejected, deposited, cleared)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Add status to demands (if not already covered by delivery_status)
ALTER TABLE demands ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Ensure booking_records has a status column if used for sales metrics
ALTER TABLE booking_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
