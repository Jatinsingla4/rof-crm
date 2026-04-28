-- Migration: Add documents and document_vault tables for document generation and storage
-- Date: 2026-04-27
-- Purpose: Creates documents table for generated documents from templates and document_vault table for scanned/uploaded documents
--          Referenced by POST /api/documents/generate, POST /api/documents/:id/send, GET /api/documents, DELETE /api/documents/:id
--          and POST /api/documents/vault, GET /api/documents/vault/:consumerId endpoints

-- Create documents table for generated documents from templates
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  allocation_id UUID REFERENCES allocations(id),
  template_id UUID NOT NULL REFERENCES document_templates(id),
  document_type VARCHAR(100) NOT NULL,
  html_content TEXT NOT NULL,
  delivery_method VARCHAR(50) DEFAULT 'email',
  delivery_status VARCHAR(50) DEFAULT 'pending',
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_by_user_id UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  deleted_by_user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_documents_consumer ON documents(consumer_id);
CREATE INDEX idx_documents_allocation ON documents(allocation_id);
CREATE INDEX idx_documents_template ON documents(template_id);
CREATE INDEX idx_documents_delivery_status ON documents(delivery_status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- Create document_vault table for scanned contracts and uploaded documents
CREATE TABLE document_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  allocation_id UUID REFERENCES allocations(id),
  document_category VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_vault_consumer ON document_vault(consumer_id);
CREATE INDEX idx_document_vault_allocation ON document_vault(allocation_id);
CREATE INDEX idx_document_vault_category ON document_vault(document_category);

-- Columns and their purposes (documents table):
-- id: Unique identifier for the generated document
-- consumer_id: Links document to the consumer/buyer
-- allocation_id: Links document to a specific unit allocation (for allocation letters, demand letters, etc.)
-- template_id: References the document template used to generate this document
-- document_type: Type of document (allotment_letter, demand_letter, receipt, agreement, noc, possession_letter, etc.)
-- html_content: Rendered HTML content with merge fields substituted
-- delivery_method: How document is delivered (email, whatsapp, print)
-- delivery_status: Current status (pending, sent, delivered, read, failed)
-- created_by_user_id: User who triggered document generation
-- created_at: Timestamp when document was generated
-- sent_at: Timestamp when document was sent to recipient
-- sent_by_user_id: User who sent the document
-- deleted_at: Timestamp when document was soft-deleted (null if active)
-- deleted_by_user_id: User who deleted the document

-- Columns and their purposes (document_vault table):
-- id: Unique identifier for the vault document
-- consumer_id: Links document to the consumer
-- allocation_id: Links document to a specific unit allocation
-- document_category: Category of uploaded document (kyc, application, agreement, noc, possession_checklist, etc.)
-- file_url: URL/path to the uploaded file
-- file_name: Original filename as uploaded
-- uploaded_by_user_id: User who uploaded the document
-- created_at: Timestamp when document was uploaded
