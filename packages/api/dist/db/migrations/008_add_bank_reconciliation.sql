-- Migration 008: Add bank reconciliation tables
-- Allows finance team to import bank statements and match to expected payments

-- ============================================
-- BANK STATEMENT IMPORTS TABLE
-- ============================================

CREATE TABLE bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  file_name VARCHAR(255) NOT NULL,
  imported_by_user_id UUID NOT NULL REFERENCES users(id),
  import_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_transactions INTEGER DEFAULT 0,
  matched_count INTEGER DEFAULT 0,
  unmatched_count INTEGER DEFAULT 0,
  total_amount_inr NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BANK TRANSACTIONS TABLE
-- ============================================

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES bank_statement_imports(id),
  transaction_date DATE NOT NULL,
  description TEXT,
  amount_inr NUMERIC(15,2) NOT NULL,
  transaction_ref VARCHAR(255),
  bank_account VARCHAR(100),
  matched_receipt_id UUID REFERENCES receipts(id),
  matched_demand_id UUID REFERENCES demands(id),
  match_status VARCHAR(50) DEFAULT 'unmatched',
  match_confidence NUMERIC(5,2),
  matched_by_user_id UUID REFERENCES users(id),
  matched_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_bank_statement_imports_project ON bank_statement_imports(project_id);
CREATE INDEX idx_bank_statement_imports_status ON bank_statement_imports(status);
CREATE INDEX idx_bank_transactions_import ON bank_transactions(import_id);
CREATE INDEX idx_bank_transactions_match_status ON bank_transactions(match_status);
CREATE INDEX idx_bank_transactions_ref ON bank_transactions(transaction_ref);
CREATE INDEX idx_bank_transactions_amount ON bank_transactions(amount_inr);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_receipt ON bank_transactions(matched_receipt_id);
CREATE INDEX idx_bank_transactions_demand ON bank_transactions(matched_demand_id);
