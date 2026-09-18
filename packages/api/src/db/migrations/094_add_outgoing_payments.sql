-- Phase 4: outgoing_payments table (DEBIT side of Cash/Bank Ledger, Phase 6)
CREATE TABLE outgoing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_bank_account_id UUID NOT NULL REFERENCES company_bank_accounts(id),
    amount_inr NUMERIC(15,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payee VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outgoing_payments_bank_account ON outgoing_payments(company_bank_account_id);
CREATE INDEX idx_outgoing_payments_status ON outgoing_payments(status);
CREATE INDEX idx_outgoing_payments_date ON outgoing_payments(payment_date);
