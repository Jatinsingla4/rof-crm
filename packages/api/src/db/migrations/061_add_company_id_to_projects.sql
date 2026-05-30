-- Migration: Add company_id column to projects table
-- Purpose: Link projects to companies for relationship joins
--
-- The ATS and Conveyance handlers need to LEFT JOIN companies on projects.company_id
-- to fetch company details like CIN, GSTIN, address, phone, etc.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS company_id UUID
    REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_company_id
  ON projects(company_id);
