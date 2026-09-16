ALTER TABLE receipts ADD COLUMN IF NOT EXISTS company_bank_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE draw_refunds ADD COLUMN IF NOT EXISTS company_bank_account_id UUID REFERENCES company_bank_accounts(id) ON DELETE SET NULL;
