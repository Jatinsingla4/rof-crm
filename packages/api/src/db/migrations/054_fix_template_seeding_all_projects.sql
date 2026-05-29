-- Migration 054: Fix template seeding to work for ALL projects
-- Previous migration 053 only seeded for ALANTE projects
-- This migration ensures templates exist for all projects

-- First, get all projects and seed templates for each one that doesn't have them
INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at)
SELECT
  p.id,
  'buyer_builder_agreement',
  'Standard ATS - ' || p.name,
  'FILE:ats_rof_alante.html',
  NOW()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates dt
  WHERE dt.project_id = p.id
  AND dt.document_type = 'buyer_builder_agreement'
);

INSERT INTO document_templates
  (project_id, document_type, name, body_html, created_at)
SELECT
  p.id,
  'conveyance_deed',
  'Standard Conveyance Deed - ' || p.name,
  'FILE:conveyance_rof_alante.html',
  NOW()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates dt
  WHERE dt.project_id = p.id
  AND dt.document_type = 'conveyance_deed'
);

-- Verify results
SELECT document_type, COUNT(*) as count FROM document_templates 
WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
GROUP BY document_type;
