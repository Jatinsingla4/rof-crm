-- Migration: Add user permissions and company access tables
-- Purpose: Store user process permissions and company access relationships

CREATE TABLE user_process_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  process_name VARCHAR(100) NOT NULL,
  is_maker BOOLEAN DEFAULT FALSE,
  is_checker BOOLEAN DEFAULT FALSE,
  is_approver BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id),
  UNIQUE(user_id, process_name)
);

CREATE INDEX idx_user_process_permissions_user ON user_process_permissions(user_id);
CREATE INDEX idx_user_process_permissions_process ON user_process_permissions(process_name);

CREATE TABLE user_company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  access_level VARCHAR(50) DEFAULT 'read',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id),
  UNIQUE(user_id, company_id)
);

CREATE INDEX idx_user_company_access_user ON user_company_access(user_id);
CREATE INDEX idx_user_company_access_company ON user_company_access(company_id);

-- Columns and their purposes:
-- user_process_permissions:
--   id: Unique identifier
--   user_id: References the user
--   process_name: Name of the process (e.g., 'payment_approval', 'document_generation')
--   is_maker: Can initiate/create the process
--   is_checker: Can review/check the process
--   is_approver: Can approve/authorize the process
--   created_at: Timestamp of creation
--   created_by_user_id: User who assigned this permission

-- user_company_access:
--   id: Unique identifier
--   user_id: References the user
--   company_id: References the company (link to companies table)
--   access_level: Level of access ('read', 'edit', 'admin')
--   created_at: Timestamp of creation
--   created_by_user_id: User who granted this access
