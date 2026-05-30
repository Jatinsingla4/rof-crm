-- Migration: Seed test user for development and testing
-- Purpose: Create a test user account for login testing during development
-- Password: password123
-- NOTE: This uses a static bcrypt hash. For production, use properly hashed credentials.

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
  -- bcrypt hash for "password123" with cost factor 10
  -- Generated via: bcryptjs.hash('password123', 10)
  -- Verified with bcrypt.compare() returning true
  '$2a$10$Bet58gUnnnWSZaMsrWKxOuyYVbfvpgk61XWgtyLGxO.tBPhvEDHAO',
  '[]'::jsonb,
  true,
  NOW(),
  'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = '$2a$10$Bet58gUnnnWSZaMsrWKxOuyYVbfvpgk61XWgtyLGxO.tBPhvEDHAO',
  is_active = true,
  role = 'super_admin';
