-- Migration 055: Seed global (fallback) templates
-- Creates templates with project_id = NULL as fallback for all projects
-- When a project doesn't have a specific template, the API will use these global ones

INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at, updated_at)
SELECT
  NULL AS project_id,
  'buyer_builder_agreement',
  'Global ATS Template',
  'FILE:ats_rof_alante.html',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE document_type = 'buyer_builder_agreement'
  AND project_id IS NULL
);

INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at, updated_at)
SELECT
  NULL AS project_id,
  'conveyance_deed',
  'Global Conveyance Deed Template',
  'FILE:conveyance_rof_alante.html',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE document_type = 'conveyance_deed'
  AND project_id IS NULL
);

-- Verify global templates were created
SELECT
  document_type,
  project_id,
  name,
  COUNT(*) as count
FROM document_templates
WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
GROUP BY document_type, project_id, name
ORDER BY document_type, project_id NULLS FIRST;
