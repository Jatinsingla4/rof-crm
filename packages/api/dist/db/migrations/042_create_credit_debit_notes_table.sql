-- Migration 042: Create credit_debit_notes table for GST invoicing
-- Date: 2026-05-02
-- Purpose: Store credit notes (reversals) and debit notes against GST invoices

CREATE TABLE IF NOT EXISTS credit_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES gst_invoices(id) ON DELETE CASCADE,
  note_number VARCHAR(50) NOT NULL UNIQUE,
  note_type VARCHAR(20) NOT NULL,  -- 'credit-note' or 'debit-note'
  original_invoice_no VARCHAR(50) NOT NULL,
  adjustment_amount NUMERIC(15,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  gst_amount NUMERIC(15,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'issued',
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_invoice_id ON credit_debit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_note_number ON credit_debit_notes(note_number);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_note_type ON credit_debit_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_original_invoice_no ON credit_debit_notes(original_invoice_no);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_status ON credit_debit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_debit_notes_created_at ON credit_debit_notes(created_at);
