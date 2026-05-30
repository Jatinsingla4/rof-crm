-- Migration: Add document_versions table for document edit history and versioning
-- Purpose: Stores version history of generated documents, tracking edits and changes

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  html_content TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edit_reason VARCHAR(500),
  fields_changed JSONB DEFAULT '[]'::jsonb,
  is_original BOOLEAN DEFAULT FALSE,
  UNIQUE(document_id, version_number)
);

CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_versions_created_at ON document_versions(created_at DESC);

-- Columns and their purposes:
-- id: Unique identifier for each version
-- document_id: References the parent document
-- version_number: Sequential version number (1 = original, 2+ = edits)
-- html_content: The HTML content of this version
-- created_by_user_id: User who created/edited this version
-- created_at: Timestamp of this version
-- edit_reason: Why this edit was made (required for edits, 'Original generation' for v1)
-- fields_changed: JSONB array of {field_key, field_label, old_value, new_value} objects
-- is_original: TRUE only for version 1, FALSE for edits
