-- ============================================
-- Migration 076: GST Configuration Tables
-- 8 new tables for GST Configuration module.
-- Fully idempotent — CREATE TABLE IF NOT EXISTS
-- ============================================

-- TABLE 1: Financial Years
-- Defines accounting periods for GST.
CREATE TABLE IF NOT EXISTS financial_years (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  name        VARCHAR(50) NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id)
);

-- TABLE 2: HSN/SAC Codes
-- Goods and Services Tax commodity codes.
CREATE TABLE IF NOT EXISTS hsn_sac_codes (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL,
  type        VARCHAR(20) NOT NULL
              CHECK (type IN ('Goods','Service')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT hsn_sac_codes_code_unique
    UNIQUE (code)
);

-- TABLE 3: HSN/SAC Code Assignment
-- Links HSN code to project + charge type.
CREATE TABLE IF NOT EXISTS hsn_sac_code_assign (
  id              UUID PRIMARY KEY
                  DEFAULT gen_random_uuid(),
  hsn_sac_id      UUID NOT NULL
                  REFERENCES hsn_sac_codes(id)
                  ON DELETE CASCADE,
  project_id      UUID NOT NULL
                  REFERENCES projects(id)
                  ON DELETE CASCADE,
  charge_type     VARCHAR(30) NOT NULL
                  CHECK (charge_type IN (
                    'BASIC','PLC',
                    'OTHER CHARGE','IFMS',
                    'EXTRA ADD ON','OTHERS'
                  )),
  created_at      TIMESTAMPTZ NOT NULL
                  DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL
                  DEFAULT now(),
  created_by      UUID REFERENCES users(id),
  CONSTRAINT hsn_sac_assign_unique
    UNIQUE (project_id, charge_type)
);

-- TABLE 4: GST Slabs
-- Defines tax period date ranges.
CREATE TABLE IF NOT EXISTS gst_slabs (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT gst_slabs_date_unique
    UNIQUE (from_date, to_date)
);

-- TABLE 5: GST Tax Setup
-- Defines GST rates per slab + code + type.
CREATE TABLE IF NOT EXISTS gst_tax_setup (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  slab_id     UUID NOT NULL
              REFERENCES gst_slabs(id)
              ON DELETE CASCADE,
  gst_code    VARCHAR(50) NOT NULL,
  type        VARCHAR(10) NOT NULL
              CHECK (type IN (
                'INTER','INTRA','UT'
              )),
  cgst_pct    NUMERIC(6,3) NOT NULL DEFAULT 0,
  sgst_pct    NUMERIC(6,3) NOT NULL DEFAULT 0,
  utgst_pct   NUMERIC(6,3) NOT NULL DEFAULT 0,
  igst_pct    NUMERIC(6,3) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT gst_tax_setup_unique
    UNIQUE (slab_id, gst_code, type)
);

-- TABLE 6: GST Tax Charge Mapping
-- Maps project + slab to charge types.
CREATE TABLE IF NOT EXISTS gst_tax_charge_mapping (
  id              UUID PRIMARY KEY
                  DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL
                  REFERENCES projects(id)
                  ON DELETE CASCADE,
  slab_id         UUID NOT NULL
                  REFERENCES gst_slabs(id)
                  ON DELETE CASCADE,
  gst_tax_id      UUID
                  REFERENCES gst_tax_setup(id)
                  ON DELETE SET NULL,
  charge_type     VARCHAR(30) NOT NULL
                  CHECK (charge_type IN (
                    'BASIC','PLC',
                    'OTHER CHARGE','IFMS',
                    'EXTRA ADD ON','OTHERS'
                  )),
  created_at      TIMESTAMPTZ NOT NULL
                  DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL
                  DEFAULT now(),
  created_by      UUID REFERENCES users(id),
  CONSTRAINT gst_charge_mapping_unique
    UNIQUE (project_id, slab_id, charge_type)
);

-- TABLE 7: Project Wise GSTIN
-- Per-project GST registration number.
CREATE TABLE IF NOT EXISTS project_gstin (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL
              REFERENCES projects(id)
              ON DELETE CASCADE,
  gstin       VARCHAR(20) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT project_gstin_unique
    UNIQUE (project_id)
);

-- TABLE 8: Project Wise RERA Numbers
-- Per-project per-tower RERA registration.
CREATE TABLE IF NOT EXISTS project_rera_numbers (
  id          UUID PRIMARY KEY
              DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL
              REFERENCES projects(id)
              ON DELETE CASCADE,
  tower_id    UUID
              REFERENCES towers(id)
              ON DELETE SET NULL,
  rera_number VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT project_rera_unique
    UNIQUE (project_id, tower_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS
  idx_financial_years_active
  ON financial_years(is_active);

CREATE INDEX IF NOT EXISTS
  idx_hsn_sac_codes_type
  ON hsn_sac_codes(type);

CREATE INDEX IF NOT EXISTS
  idx_hsn_sac_assign_project
  ON hsn_sac_code_assign(project_id);

CREATE INDEX IF NOT EXISTS
  idx_gst_slabs_dates
  ON gst_slabs(from_date, to_date);

CREATE INDEX IF NOT EXISTS
  idx_gst_tax_setup_slab
  ON gst_tax_setup(slab_id);

CREATE INDEX IF NOT EXISTS
  idx_gst_charge_mapping_project
  ON gst_tax_charge_mapping(project_id);

CREATE INDEX IF NOT EXISTS
  idx_project_gstin_project
  ON project_gstin(project_id);

CREATE INDEX IF NOT EXISTS
  idx_project_rera_project
  ON project_rera_numbers(project_id);
