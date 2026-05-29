-- Migration 053: Seed ATS and Conveyance Deed templates
-- Adds document_templates records for legal document generation

-- Insert ATS template record
INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at)
SELECT
  id,
  'buyer_builder_agreement',
  'Standard ATS - ROF ALANTE',
  'FILE:ats_rof_alante.html',
  NOW()
FROM projects
WHERE name ILIKE '%ALANTE%'
AND NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE project_id = projects.id
  AND document_type = 'buyer_builder_agreement'
);

-- Insert Conveyance Deed template record
INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at)
SELECT
  id,
  'conveyance_deed',
  'Standard Conveyance Deed - ROF ALANTE',
  'FILE:conveyance_rof_alante.html',
  NOW()
FROM projects
WHERE name ILIKE '%ALANTE%'
AND NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE project_id = projects.id
  AND document_type = 'conveyance_deed'
);

-- Verify insertion
SELECT document_type, COUNT(*) as count FROM document_templates 
WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
GROUP BY document_type;
