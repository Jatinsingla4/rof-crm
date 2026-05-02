-- Migration 033: Receipt Process Extensions (TDS & Journals)

-- 1. TDS Management
CREATE TABLE tds_challans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_number VARCHAR(100) UNIQUE NOT NULL,
    challan_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    bank_name VARCHAR(255),
    bsr_code VARCHAR(50),
    financial_year VARCHAR(20),
    quarter VARCHAR(10),
    file_url TEXT, -- Scanned copy
    status VARCHAR(50) DEFAULT 'available', -- available, fully_assigned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tds_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challan_id UUID REFERENCES tds_challans(id),
    consumer_id UUID REFERENCES consumers(id),
    receipt_id UUID REFERENCES receipts(id),
    amount_assigned NUMERIC(15,2) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Journal Entries (Manual Adjustments)
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    consumer_id UUID REFERENCES consumers(id),
    debit_amount NUMERIC(15,2) DEFAULT 0,
    credit_amount NUMERIC(15,2) DEFAULT 0,
    ledger_head VARCHAR(100) NOT NULL, -- e.g., 'Discount', 'Transfer Fee', 'Interest Waiver'
    remarks TEXT,
    approved_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enhance Receipts table for Print/Approval status
ALTER TABLE receipts ADD COLUMN print_status VARCHAR(20) DEFAULT 'not_printed';
ALTER TABLE receipts ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE receipts ADD COLUMN approved_by UUID REFERENCES users(id);
ALTER TABLE receipts ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
