-- Migration 020: Extend consumers table for booking form + create booking records table

-- Make aadhaar_hash and project_id nullable (booking form may not always have these initially)
ALTER TABLE consumers ALTER COLUMN aadhaar_hash DROP NOT NULL;
ALTER TABLE consumers ALTER COLUMN project_id DROP NOT NULL;

-- Add extended consumer fields for booking form
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS salutation VARCHAR(20);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS profession VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS annual_income NUMERIC(15,2);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS education VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS company VARCHAR(200);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS ppp_id VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS pan_no VARCHAR(20);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS alt_mobile VARCHAR(20);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS source_of_enquiry VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS referred_by VARCHAR(200);

-- Present address
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_address TEXT;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_address_line2 VARCHAR(255);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_city VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_state VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_pin VARCHAR(10);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS present_country VARCHAR(100) DEFAULT 'India';

-- Permanent address
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS perm_address TEXT;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS perm_city VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS perm_state VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS perm_pin VARCHAR(10);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS perm_country VARCHAR(100) DEFAULT 'India';

-- Office address
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS office_address TEXT;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS office_city VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS office_state VARCHAR(100);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS office_pin VARCHAR(10);

-- Nominee details
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS nominee_name VARCHAR(200);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS nominee_relation VARCHAR(50);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS nominee_dob DATE;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS nominee_share NUMERIC(5,2) DEFAULT 100;

-- Finance / loan details
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS finance_bank VARCHAR(200);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS loan_amount NUMERIC(15,2);
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS loan_sanction_date DATE;

-- Booking form records table
CREATE TABLE IF NOT EXISTS booking_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID NOT NULL REFERENCES consumers(id),
  project_id          UUID REFERENCES projects(id),
  unit_id             UUID REFERENCES units(id),
  booking_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  booking_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_mode        VARCHAR(50),
  payment_ref         VARCHAR(100),
  bank_name           VARCHAR(200),
  cheque_date         DATE,
  discount_value      NUMERIC(15,2) DEFAULT 0,
  discount_reason     TEXT,
  discount_authorized_by UUID REFERENCES users(id),
  broker_id           UUID,
  broker_commission   NUMERIC(15,2) DEFAULT 0,
  broker_commission_type VARCHAR(20) DEFAULT 'flat',
  sales_employee_id   UUID REFERENCES users(id),
  nominee_name        VARCHAR(200),
  nominee_relation    VARCHAR(50),
  loan_amount         NUMERIC(15,2),
  finance_bank        VARCHAR(200),
  remarks             TEXT,
  status              VARCHAR(50) DEFAULT 'active',
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_records_consumer ON booking_records(consumer_id);
CREATE INDEX IF NOT EXISTS idx_booking_records_project ON booking_records(project_id);
