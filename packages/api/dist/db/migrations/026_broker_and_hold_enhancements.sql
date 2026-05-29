-- Migration 026: Broker & Investor/Hold Enhancements
-- Adds hierarchy, mapping, tax config, and inventory hold system

-- 1. Update Unit Status to include 'held'
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'held';

-- 2. Enhance Brokers table
ALTER TABLE brokers 
  ADD COLUMN IF NOT EXISTS parent_broker_id UUID REFERENCES brokers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_id_gst VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tax_id_pan VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bank_account_details JSONB,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- Update status constraint/enum if needed (currently it's a VARCHAR)
-- active | inactive | suspended | pending | rejected
ALTER TABLE brokers DROP CONSTRAINT IF EXISTS brokers_status_check;
ALTER TABLE brokers ADD CONSTRAINT brokers_status_check 
  CHECK (status IN ('active', 'inactive', 'suspended', 'pending', 'rejected'));

-- 3. Broker Project Mapping (Many-to-Many)
CREATE TABLE IF NOT EXISTS broker_project_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  mapped_at TIMESTAMPTZ DEFAULT NOW(),
  mapped_by UUID REFERENCES users(id),
  UNIQUE(broker_id, project_id)
);

-- 4. Broker Tax Configuration (Compliance)
CREATE TABLE IF NOT EXISTS broker_tax_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  tds_rate_pct NUMERIC(5,2) DEFAULT 5.00,
  gst_rate_pct NUMERIC(5,2) DEFAULT 18.00,
  is_gst_exempt BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(broker_id)
);

-- 5. Unit Holds (Inventory Governance)
CREATE TABLE IF NOT EXISTS unit_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  client_name VARCHAR(255),
  client_mobile VARCHAR(20),
  held_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active | expired | converted | cancelled
  notes TEXT,
  created_by UUID REFERENCES users(id),
  UNIQUE(unit_id, status) -- Only one active hold per unit
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_unit_holds_expiry ON unit_holds(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_broker_parent ON brokers(parent_broker_id);
