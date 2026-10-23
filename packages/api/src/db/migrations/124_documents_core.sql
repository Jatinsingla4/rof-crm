-- Demand letters and check lists are built from an inline shell, so they have no template row: documents.template_id must allow NULL
-- (with NOT NULL every demand letter failed with a 500). Also write the penal interest rate setting down so one value is read everywhere.
ALTER TABLE documents ALTER COLUMN template_id DROP NOT NULL;
INSERT INTO global_settings (key, value, description)
SELECT 'penal_interest_rate_percent', '15.0', 'Annual interest rate for late payments'
WHERE NOT EXISTS (SELECT 1 FROM global_settings WHERE key = 'penal_interest_rate_percent');
-- The field editor keeps the first version of a document in original_html_content; the column was missing, so every edit failed with a 500.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_html_content TEXT;
ALTER TABLE documents ALTER COLUMN version_number SET DEFAULT 1;
ALTER TABLE documents ALTER COLUMN edit_count SET DEFAULT 0;
ALTER TABLE documents ALTER COLUMN is_edited SET DEFAULT FALSE;
UPDATE documents SET version_number = 1 WHERE version_number IS NULL;
UPDATE documents SET edit_count = 0 WHERE edit_count IS NULL;
UPDATE documents SET is_edited = FALSE WHERE is_edited IS NULL;
-- The document vault stored only a link, but the screens upload real files (applicant documents, unit documents). Keep the file itself, and allow a unit-only document.
ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);
ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);
ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS file_size_bytes INT;
ALTER TABLE document_vault ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE document_vault ALTER COLUMN consumer_id DROP NOT NULL;
ALTER TABLE document_vault ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE document_vault DROP CONSTRAINT IF EXISTS document_vault_owner_chk;
ALTER TABLE document_vault ADD CONSTRAINT document_vault_owner_chk CHECK (consumer_id IS NOT NULL OR unit_id IS NOT NULL) NOT VALID;
ALTER TABLE document_vault DROP CONSTRAINT IF EXISTS document_vault_content_chk;
ALTER TABLE document_vault ADD CONSTRAINT document_vault_content_chk CHECK (file_url IS NOT NULL OR file_data IS NOT NULL) NOT VALID;
CREATE INDEX IF NOT EXISTS idx_document_vault_unit ON document_vault (unit_id);
