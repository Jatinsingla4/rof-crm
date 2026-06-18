-- ============================================
-- Migration 078: Company Bank Accounts
-- Creates company_bank_accounts table for
-- multiple bank accounts per company.
-- Migrates existing flat bank columns from
-- companies table into new table.
-- Fully idempotent.
-- ============================================

-- TABLE: company_bank_accounts
-- One company can have many bank accounts.
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_name   VARCHAR(200),
  bank_name      VARCHAR(200) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  ifsc_code      VARCHAR(20),
  branch         VARCHAR(200),
  payable_at     VARCHAR(200),
  account_type   VARCHAR(50)  NOT NULL DEFAULT 'current',
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  is_primary     BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_by     UUID         REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cba_company_id ON company_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_cba_is_active   ON company_bank_accounts(is_active);

-- Migrate existing flat bank data from companies into new table.
-- Only runs if data exists in flat columns AND not already migrated.
INSERT INTO company_bank_accounts (
  company_id, bank_name, account_number, ifsc_code,
  branch, payable_at, account_type, is_primary, is_active
)
SELECT
  id,
  bank_name,
  COALESCE(bank_account_no, 'UNKNOWN'),
  bank_ifsc,
  bank_branch,
  payable_at,
  'current',
  true,
  true
FROM companies
WHERE bank_name IS NOT NULL
  AND bank_account_no IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_bank_accounts cba
    WHERE cba.company_id = companies.id
  );

-- Add company_id to bank_accounts so project bank accounts can
-- optionally also link to a company (keep project_id for backward compat).
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON bank_accounts(company_id);
