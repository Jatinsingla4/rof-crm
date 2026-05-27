-- Migration 025: Add Legacy Bridge Masters (Revised)
-- This migration adds the remaining missing masters for full legacy compatibility.

-- 1. Unit Types (Master for categorizing units)
CREATE TABLE IF NOT EXISTS unit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  carpet_area_sqft NUMERIC(10, 2),
  balcony_area_sqft NUMERIC(10, 2),
  base_rate_sqft BIGINT, -- in Paise
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- 2. Floors Master
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id UUID NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
  floor_number INT NOT NULL,
  floor_name VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tower_id, floor_number)
);

-- 3. Tax Slabs (For GST Mapping in demands/invoices)
CREATE TABLE IF NOT EXISTS tax_slabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  cgst_percent NUMERIC(5, 2) DEFAULT 0.00,
  sgst_percent NUMERIC(5, 2) DEFAULT 0.00,
  igst_percent NUMERIC(5, 2) DEFAULT 0.00,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update units to reference unit_types and floors (optional but recommended for master-driven UI)
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_type_id UUID REFERENCES unit_types(id);
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor_id UUID REFERENCES floors(id);

-- 5. Add tax_slab_id to demands for dynamic GST calculation
ALTER TABLE demands ADD COLUMN IF NOT EXISTS tax_slab_id UUID REFERENCES tax_slabs(id);

-- 6. Seed some initial tax slabs
INSERT INTO tax_slabs (name, cgst_percent, sgst_percent, igst_percent)
VALUES 
  ('Residential GST (1%)', 0.5, 0.5, 0.0),
  ('Residential GST (5%)', 2.5, 2.5, 0.0),
  ('Commercial GST (12%)', 6.0, 6.0, 0.0),
  ('Commercial GST (18%)', 9.0, 9.0, 0.0)
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unit_types_project ON unit_types(project_id);
CREATE INDEX IF NOT EXISTS idx_floors_tower ON floors(tower_id);
