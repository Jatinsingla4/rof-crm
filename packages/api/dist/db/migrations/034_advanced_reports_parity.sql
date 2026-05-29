-- Migration 034: Advanced Reports Parity (Inventory & Applicant Detail)

-- 1. Extend Consumers with Legacy Tracking Fields
ALTER TABLE consumers 
ADD COLUMN IF NOT EXISTS registration_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS form_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_classification VARCHAR(100) DEFAULT 'General',
ADD COLUMN IF NOT EXISTS booking_date DATE;

-- 2. Extend Units with Registry Status
ALTER TABLE units
ADD COLUMN IF NOT EXISTS registry_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS registry_date DATE,
ADD COLUMN IF NOT EXISTS mortgage_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hold_status BOOLEAN DEFAULT FALSE;

-- 3. Extend Projects with Grouping
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) DEFAULT 'Affordable';

-- 4. Create Indexes for Report Performance
CREATE INDEX IF NOT EXISTS idx_consumers_reg_no ON consumers(registration_no);
CREATE INDEX IF NOT EXISTS idx_consumers_classification ON consumers(customer_classification);
CREATE INDEX IF NOT EXISTS idx_units_registry_status ON units(registry_status);
