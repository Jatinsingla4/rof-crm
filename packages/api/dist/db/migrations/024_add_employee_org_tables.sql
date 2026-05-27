-- Migration 024: Employee Organisation Structure
-- Departments, Employee Profiles, Teams, Team Members, Manager assignments

CREATE TABLE IF NOT EXISTS departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(150) NOT NULL UNIQUE,
  description  TEXT,
  head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department_id      UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_code      VARCHAR(50) UNIQUE,
  designation        VARCHAR(150),
  joining_date       DATE,
  salary_grade       VARCHAR(50),
  manager_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  mobile_office      VARCHAR(20),
  mobile_personal    VARCHAR(20),
  emergency_contact  VARCHAR(20),
  address            TEXT,
  city               VARCHAR(100),
  state              VARCHAR(100),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(150) NOT NULL,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  team_head_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_team VARCHAR(100) DEFAULT 'member',
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_user       ON employee_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_dept       ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_profiles_manager    ON employee_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team            ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user            ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_department             ON teams(department_id);

-- Seed default departments for ROF
INSERT INTO departments (name, description) VALUES
  ('Sales',           'Sales and pre-sales team'),
  ('Accounts',        'Accounts and finance team'),
  ('Operations',      'Operations and project delivery'),
  ('CRM',             'Customer relationship management'),
  ('Legal',           'Legal and documentation'),
  ('Marketing',       'Marketing and campaigns'),
  ('Administration',  'HR and administration')
ON CONFLICT (name) DO NOTHING;
