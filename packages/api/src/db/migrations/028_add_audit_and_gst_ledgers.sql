-- Migration: Add GST Ledgers and Financial Audit Logs
-- Date: 2026-04-30
-- Purpose: Adds CGST and SGST columns to demands and receipts. Creates financial_audit_logs table.

-- Add GST to demands
ALTER TABLE demands ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE demands ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15,2) DEFAULT 0.00;

-- Add GST to receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(15,2) DEFAULT 0.00;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(15,2) DEFAULT 0.00;

-- Create Audit Logs
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumers(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- e.g., 'BASE_RATE_UPDATE', 'INSTALLMENT_DATE_UPDATE'
    old_value JSONB,
    new_value JSONB,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_audit_consumer ON financial_audit_logs(consumer_id);
