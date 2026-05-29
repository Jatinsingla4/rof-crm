-- Migration 017: Add tables required by Phase 2 frontend pages
-- tasks, automation_rules, brokers, broker_commissions, parking_slots, import_history

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',          -- pending | completed
  priority VARCHAR(20) DEFAULT 'normal',          -- normal | high | urgent
  due_date DATE,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  consumer_id UUID REFERENCES consumers(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,  -- lead_created | payment_received | payment_overdue | unit_allotted | ...
  action_type VARCHAR(100) NOT NULL,    -- send_whatsapp | send_email | send_sms | create_task | ...
  message_template TEXT,
  delay_minutes INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  firm_name VARCHAR(255),
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  rera_number VARCHAR(100),
  pan VARCHAR(20),
  address TEXT,
  status VARCHAR(50) DEFAULT 'active',   -- active | inactive | suspended
  commission_pct NUMERIC(5,2) DEFAULT 2.00,
  total_referrals INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  consumer_id UUID REFERENCES consumers(id),
  project_id UUID REFERENCES projects(id),
  unit_id UUID REFERENCES units(id),
  commission_amount_inr NUMERIC(14,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',  -- pending | approved | paid
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  slot_number VARCHAR(50) NOT NULL,
  parking_type VARCHAR(50) DEFAULT 'covered',  -- covered | open | basement
  floor INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'available',       -- available | allotted | reserved
  allotted_to_consumer_id UUID REFERENCES consumers(id),
  allotted_unit_id UUID REFERENCES units(id),
  amount_inr NUMERIC(14,2) DEFAULT 0,
  allotted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, slot_number)
);

CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  import_type VARCHAR(50) NOT NULL,   -- units | consumers | edraw | payments
  total_rows INT DEFAULT 0,
  created_rows INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'completed',  -- completed | partial | failed
  errors JSONB DEFAULT '[]',
  imported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_consumer ON tasks(consumer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_automation_active ON automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_broker_commissions_broker ON broker_commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_parking_project ON parking_slots(project_id);
CREATE INDEX IF NOT EXISTS idx_parking_consumer ON parking_slots(allotted_to_consumer_id);
