-- Migration 015: Add missing auth/RBAC columns to users table
-- Date: 2026-04-29
-- Purpose: The users.ts routes and auth login use role, mobile, password_hash,
--          is_active, assigned_project_ids, created_by_user_id — add them to the table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'sales_executive',
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS assigned_project_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Seed the test user with a working role + password (base64 of 'admin123')
UPDATE users
SET role = 'super_admin',
    password_hash = 'YWRtaW4xMjM=',
    is_active = TRUE,
    assigned_project_ids = '[]'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
