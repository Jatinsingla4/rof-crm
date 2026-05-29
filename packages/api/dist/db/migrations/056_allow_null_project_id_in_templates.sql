-- Migration 056: Allow NULL project_id in document_templates
-- Required to support global (fallback) templates that apply to all projects

-- Make project_id nullable to support global templates
ALTER TABLE document_templates
  ALTER COLUMN project_id DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'document_templates'
AND column_name = 'project_id';
