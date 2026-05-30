-- Migration: Seed test user for development and testing
-- Purpose: Create a test user account for login testing during development

-- Hash of "password123" using bcrypt (generated with bcryptjs at cost 12)
-- This is: $2a$12$L9/VLY4YZGHf1LpzfqTEGuNDVPRZhk4.fE/oHPK/xqQ7vCXKPHxIW
INSERT INTO users (
  id,
  name,
  email,
  mobile,
  role,
  password_hash,
  assigned_project_ids,
  is_active,
  created_at,
  created_by_user_id
)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
  'Test User',
  'testuser@rof.com',
  '9999999999',
  'super_admin',
  '$2a$12$L9/VLY4YZGHf1LpzfqTEGuNDVPRZhk4.fE/oHPK/xqQ7vCXKPHxIW',
  '[]'::jsonb,
  true,
  NOW(),
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = '$2a$12$L9/VLY4YZGHf1LpzfqTEGuNDVPRZhk4.fE/oHPK/xqQ7vCXKPHxIW',
  is_active = true;
