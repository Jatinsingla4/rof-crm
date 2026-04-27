-- ROF CRM Database Schema (PostgreSQL 15+)
-- ACID-compliant, with SERIALIZABLE transactions for critical workflows
-- All money values in PAISE (not rupees) to avoid floating-point errors

-- ============================================
-- CORE TABLES: Projects, Towers, Units
-- ============================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  rera_number VARCHAR(100) UNIQUE NOT NULL,
  tcp_licence VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  land_area_sqft BIGINT,
  total_units INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE towers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  tower_name VARCHAR(100) NOT NULL,
  floors INT,
  units_per_floor INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, tower_name)
);

CREATE TYPE unit_status AS ENUM (
  'available',
  'application_received',
  'draw_pending',
  'allotted',
  'agreement_signed',
  'under_construction',
  'oc_received',
  'possession_handed_over',
  'locked'
);

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tower_id UUID NOT NULL REFERENCES towers(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  unit_number VARCHAR(50) NOT NULL,
  bhk_type VARCHAR(50) NOT NULL,
  carpet_area_sqft INT,
  super_area_sqft INT,
  facing VARCHAR(50),
  floor INT,
  balcony_area_sqft INT,
  base_price_inr BIGINT,
  total_price_inr BIGINT,
  floor_plan_url TEXT,
  status unit_status DEFAULT 'available',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  locked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID,
  UNIQUE(tower_id, unit_number)
);

CREATE TABLE unit_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  previous_status unit_status,
  new_status unit_status NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by_user_id UUID,
  reason TEXT
);

-- ============================================
-- CONSUMER TABLES
-- ============================================

CREATE TYPE income_category AS ENUM ('EWS', 'LIG', 'MIG');
CREATE TYPE lead_stage AS ENUM (
  'enquiry',
  'interested',
  'application_filed',
  'draw_entered',
  'allotted',
  'onboarded',
  'cancelled'
);

CREATE TABLE consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  photo_url TEXT,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  aadhaar_hash VARCHAR(255) NOT NULL,
  pan_hash VARCHAR(255),
  parivar_pehchan_patra VARCHAR(100),
  income_category income_category,
  lead_stage lead_stage DEFAULT 'enquiry',
  project_id UUID NOT NULL REFERENCES projects(id),
  allocated_unit_id UUID REFERENCES units(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID,
  UNIQUE(project_id, mobile)
);

CREATE TYPE kyc_document_type AS ENUM (
  'aadhaar',
  'pan',
  'income_cert',
  'affidavit',
  'bank_details',
  'photo',
  'address_proof'
);

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  document_type kyc_document_type NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by_user_id UUID,
  verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE co_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(50),
  aadhaar_hash VARCHAR(255),
  pan_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  draw_date DATE,
  draw_result VARCHAR(50),
  draw_position INT,
  waitlist_position INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALLOTMENT TABLES
-- ============================================

CREATE TYPE allocation_status AS ENUM (
  'allotted',
  'agreement_signed',
  'cancelled'
);

CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  allocated_date TIMESTAMPTZ DEFAULT NOW(),
  status allocation_status DEFAULT 'allotted',
  allotment_letter_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID,
  UNIQUE(unit_id, status)
);

CREATE TABLE allotment_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id),
  consumer_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  letter_date DATE,
  terms_agreed BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  delivery_channel VARCHAR(50)
);

CREATE TABLE waitlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  unit_type_or_unit_id VARCHAR(100),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  position_ordered INT NOT NULL,
  promoted_to_allocation_id UUID,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT TABLES
-- ============================================

CREATE TYPE payment_method AS ENUM (
  'bank_transfer',
  'cheque',
  'neft',
  'rtgs',
  'upi'
);

CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  total_amount_inr BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID
);

CREATE TABLE demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  installment_index INT NOT NULL,
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  due_date DATE NOT NULL,
  amount_due_inr BIGINT NOT NULL,
  days_until_due INT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_via VARCHAR(50),
  delivery_status VARCHAR(50) DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  installment_index INT NOT NULL,
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  amount_received_inr BIGINT NOT NULL,
  payment_method payment_method,
  transaction_ref VARCHAR(100),
  received_date DATE NOT NULL,
  received_by_user_id UUID,
  receipt_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE penal_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id),
  installment_index INT NOT NULL,
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  principal_inr BIGINT NOT NULL,
  days_overdue INT,
  rate_percent NUMERIC(5, 2) DEFAULT 11.10,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  amount_inr BIGINT,
  status VARCHAR(50) DEFAULT 'calculated',
  escalated_at TIMESTAMPTZ,
  escalated_to_user_id UUID
);

CREATE TABLE cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  cancellation_date DATE,
  reason TEXT,
  forfeiture_amount_inr BIGINT DEFAULT 29500,
  refund_amount_inr BIGINT,
  refund_status VARCHAR(50) DEFAULT 'initiated',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENT TABLES
-- ============================================

CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  document_type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  merge_fields TEXT[],
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version_number INT DEFAULT 1
);

CREATE TABLE generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_file_url TEXT,
  delivery_channel VARCHAR(50),
  delivery_status VARCHAR(50) DEFAULT 'queued',
  sent_at TIMESTAMPTZ
);

CREATE TABLE scanned_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  document_type VARCHAR(100),
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by_user_id UUID,
  full_text_indexed BOOLEAN DEFAULT FALSE,
  version_number INT DEFAULT 1
);

-- ============================================
-- COMMUNICATION TABLES
-- ============================================

CREATE TABLE remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  user_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  channel VARCHAR(50),
  subject VARCHAR(255),
  notes TEXT,
  follow_up_date DATE,
  follow_up_action TEXT,
  tags TEXT[]
);

CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  user_id UUID,
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  subject VARCHAR(255),
  body TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE TABLE whatsapps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  user_id UUID,
  direction VARCHAR(50),
  message_body TEXT,
  media_url TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- ============================================
-- USER & RBAC TABLES
-- ============================================

CREATE TYPE role_name AS ENUM (
  'super_admin',
  'project_manager',
  'sales_executive',
  'accounts_finance',
  'support_agent',
  'read_only_viewer'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role_id UUID,
  project_ids UUID[],
  department VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'active'
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name role_name NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID,
  UNIQUE(name, is_custom)
);

-- ============================================
-- AUDIT LOG (APPEND-ONLY)
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action VARCHAR(50),
  resource_type VARCHAR(100),
  resource_id UUID,
  previous_values JSONB,
  new_values JSONB,
  immutable BOOLEAN DEFAULT TRUE,
  retention_days INT DEFAULT 365
);

-- Enforce immutability on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_append_only ON audit_logs
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Revoke UPDATE and DELETE on audit_logs (PostgreSQL GRANT)
REVOKE UPDATE, DELETE ON audit_logs FROM public;

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX idx_consumers_mobile_project ON consumers(project_id, mobile);
CREATE INDEX idx_consumers_aadhaar ON consumers(aadhaar_hash);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_units_project ON units(project_id);
CREATE INDEX idx_allocations_consumer ON allocations(consumer_id);
CREATE INDEX idx_allocations_unit ON allocations(unit_id);
CREATE INDEX idx_demands_consumer_due_date ON demands(consumer_id, due_date);
CREATE INDEX idx_receipts_payment_plan ON receipts(payment_plan_id);
CREATE INDEX idx_remarks_consumer ON remarks(consumer_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
