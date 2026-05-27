-- Migration: Add Document Checklists for Compliance Tracking
-- Date: 2026-04-30
-- Purpose: Creates document_checklists table to track physical storage and barcode numbers for KYC documents.

CREATE TABLE document_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  booking_record_id UUID REFERENCES booking_records(id),
  document_type VARCHAR(100) NOT NULL,
  is_provided BOOLEAN DEFAULT FALSE,
  barcode_no VARCHAR(100),
  physical_storage_no VARCHAR(100),
  scan_reference_no VARCHAR(100),
  verified_by_user_id UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_checklists_consumer ON document_checklists(consumer_id);
