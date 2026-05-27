-- Migration: 032_advanced_modules
-- Purpose: Schema for Registry, Loan Process, Transfer, and Banking enhancements.

-- 1. Registry & Conveyance Module
CREATE TABLE IF NOT EXISTS registry_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES allocations(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    consumer_id UUID NOT NULL REFERENCES consumers(id),
    appointment_date DATE,
    registry_date DATE,
    stamp_duty_amount BIGINT DEFAULT 0,
    conveyance_deed_no VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, completed
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Loan & TPA Module
CREATE TABLE IF NOT EXISTS loan_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumers(id),
    bank_name VARCHAR(255),
    branch_name VARCHAR(255),
    loan_amount BIGINT DEFAULT 0,
    sanction_letter_date DATE,
    tpa_signed_date DATE,
    loan_status VARCHAR(50) DEFAULT 'applied', -- applied, sanctioned, disbursed, closed
    disbursement_percentage INT DEFAULT 0,
    bank_contact_person VARCHAR(100),
    bank_contact_mobile VARCHAR(20),
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ownership Transfer Module
CREATE TABLE IF NOT EXISTS ownership_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    old_consumer_id UUID NOT NULL REFERENCES consumers(id),
    new_consumer_id UUID NOT NULL REFERENCES consumers(id),
    transfer_date DATE DEFAULT CURRENT_DATE,
    transfer_fee_inr BIGINT DEFAULT 0,
    admin_charges_inr BIGINT DEFAULT 0,
    approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    transfer_remarks TEXT,
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Banking Enhancements
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    bank_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    account_type VARCHAR(50), -- RERA, Main, Maintenance
    balance_inr BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cheque Bounce Tracking
CREATE TABLE IF NOT EXISTS cheque_bounce_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id),
    consumer_id UUID NOT NULL REFERENCES consumers(id),
    bounce_date DATE DEFAULT CURRENT_DATE,
    penalty_amount_inr BIGINT DEFAULT 500,
    reason TEXT,
    is_penalty_raised BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_registry_unit ON registry_details(unit_id);
CREATE INDEX IF NOT EXISTS idx_loan_consumer ON loan_details(consumer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_unit ON ownership_transfers(unit_id);
