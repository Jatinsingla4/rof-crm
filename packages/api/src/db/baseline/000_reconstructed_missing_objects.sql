-- Reconstructed schema objects that the code uses but no migration in this repository creates.
-- Source: column usage in packages/api/src (routes, utils) and ALTER migrations 052, 061 to 065.
-- NOT part of the migration chain (src/db/migrations). Apply by hand to a NEW database only,
-- after the base schema, BEFORE migrations 052 and 061 onward.
-- Every statement is idempotent. Types are best effort and must be compared with production
-- (see docs/DEFERRED_TASKS.md, DT-001) when production schema access is available.

CREATE TABLE IF NOT EXISTS companies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255) NOT NULL,
  code               VARCHAR(100),
  group_name         VARCHAR(255),
  address1           VARCHAR(500),
  address2           TEXT,
  address3           TEXT,
  city               VARCHAR(100),
  state              VARCHAR(100),
  country            VARCHAR(100) DEFAULT 'India',
  pin_code           VARCHAR(20),
  phone              VARCHAR(20),
  fax                VARCHAR(20),
  email              VARCHAR(255),
  website            VARCHAR(255),
  gstin              VARCHAR(50),
  cin                VARCHAR(50),
  pan_no             VARCHAR(50),
  service_tax_no     VARCHAR(50),
  vat_no             VARCHAR(50),
  reg_address        TEXT,
  place_of_supply    VARCHAR(100),
  logo_url           TEXT,
  bank_company_name  VARCHAR(255),
  bank_account_no    VARCHAR(50),
  bank_ifsc          VARCHAR(20),
  bank_name          VARCHAR(255),
  bank_branch        VARCHAR(255),
  payable_at         VARCHAR(100),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_id ON companies(id);

CREATE TABLE IF NOT EXISTS nav_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route       VARCHAR(200) NOT NULL UNIQUE,
  label       VARCHAR(200) NOT NULL,
  category    VARCHAR(100),
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS role_page_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name  VARCHAR(100) NOT NULL,
  page_id    UUID NOT NULL REFERENCES nav_pages(id) ON DELETE CASCADE,
  can_view   BOOLEAN DEFAULT TRUE,
  UNIQUE (role_name, page_id)
);

CREATE TABLE IF NOT EXISTS user_ip_restrictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address  VARCHAR(64) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ip_address)
);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID NOT NULL REFERENCES consumers(id),
  payment_plan_id     UUID,
  original_receipt_id UUID,
  refund_amount_inr   NUMERIC(14,2) NOT NULL,
  reason              TEXT,
  refund_mode         VARCHAR(50),
  refund_reference    VARCHAR(255),
  refund_date         DATE,
  status              VARCHAR(50) DEFAULT 'pending',
  requested_by        UUID REFERENCES users(id),
  requested_at        TIMESTAMPTZ DEFAULT NOW(),
  approved_by         UUID REFERENCES users(id),
  approved_at         TIMESTAMPTZ,
  processed_by        UUID REFERENCES users(id),
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_field_overrides (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        UUID NOT NULL,
  field_key          VARCHAR(150) NOT NULL,
  field_label        VARCHAR(255),
  section            VARCHAR(100) DEFAULT 'general',
  original_value     TEXT,
  current_value      TEXT,
  value_type         VARCHAR(50) DEFAULT 'text',
  edit_reason        TEXT,
  edited_by_user_id  UUID REFERENCES users(id),
  edited_at          TIMESTAMPTZ DEFAULT NOW(),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  source_table       VARCHAR(100),
  source_column      VARCHAR(100),
  source_record_id   UUID,
  write_back_done    BOOLEAN DEFAULT FALSE,
  write_back_at      TIMESTAMPTZ,
  UNIQUE (document_id, field_key)
);
