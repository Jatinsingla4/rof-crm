-- Migration 035: Collection Workflow & Communication Setup

-- 1. Enhance Consumers for Debt Recovery
ALTER TABLE consumers 
  ADD COLUMN IF NOT EXISTS last_call_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_call_sub_status VARCHAR(100),
  ADD COLUMN IF NOT EXISTS promise_to_pay_date DATE,
  ADD COLUMN IF NOT EXISTS next_call_date DATE,
  ADD COLUMN IF NOT EXISTS total_overdue_amt NUMERIC(15,2) DEFAULT 0;

-- 2. Communication Status Codes
CREATE TABLE IF NOT EXISTS communication_status_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50), -- Calling, Email, SMS
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Status Codes
INSERT INTO communication_status_codes (code, category) VALUES 
('Call Again', 'Calling'),
('Next Followup', 'Calling'),
('Promise to Pay', 'Calling'),
('Not Reachable', 'Calling'),
('Disconnected', 'Calling'),
('Wrong Number', 'Calling'),
('Interested', 'Calling'),
('Not Interested', 'Calling')
ON CONFLICT DO NOTHING;

-- 3. Project-Specific SMTP Configuration
CREATE TABLE IF NOT EXISTS project_smtp_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 587,
  username VARCHAR(255),
  password_encrypted TEXT,
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  use_ssl BOOLEAN DEFAULT TRUE,
  cc_emails TEXT,
  bcc_emails TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- 4. Interaction Log for Calling
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  call_date TIMESTAMPTZ DEFAULT NOW(),
  status_code VARCHAR(50) REFERENCES communication_status_codes(code),
  sub_status_code VARCHAR(100),
  ptp_date DATE,
  remarks TEXT,
  next_call_date DATE
);

CREATE INDEX IF NOT EXISTS idx_consumers_overdue ON consumers(total_overdue_amt) WHERE total_overdue_amt > 0;
CREATE INDEX IF NOT EXISTS idx_call_logs_consumer ON call_logs(consumer_id);
