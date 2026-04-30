-- Migration 018: Reference CRM Full Schema
-- Adds all tables, statuses, and seed data required to match the reference CRM

-- ─────────────────────────────────────────────
-- 1. EXTEND UNIT STATUS ENUM / CHECK CONSTRAINT
-- ─────────────────────────────────────────────
-- Add new statuses if units.status is a VARCHAR with check constraint
DO $$
BEGIN
  -- Try to alter check constraint (drop old, add new with more statuses)
  -- This is safe since we're only adding values, not removing
  ALTER TABLE units DROP CONSTRAINT IF EXISTS units_status_check;
  ALTER TABLE units ADD CONSTRAINT units_status_check CHECK (status IN (
    'available','application_received','draw_pending','allotted',
    'agreement_signed','under_construction','oc_received','possession_handed_over','locked',
    'mortgage','unapproved','rera_registered','registry','temp_surrender','booked','hold'
  ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not alter units status constraint: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────
-- 2. SEED PROJECT NAMES
-- ─────────────────────────────────────────────
INSERT INTO projects (id, name, rera_number, tcp_licence, location, created_at)
VALUES
  (gen_random_uuid(), 'ROF ALANTE',          'HRERA-PENDING-001', 'TCP-001', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ATULYAS BY ROF',      'HRERA-PENDING-002', 'TCP-002', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF INSIGNIA SOUK',   'HRERA-PENDING-003', 'TCP-003', 'Gurugram', NOW()),
  (gen_random_uuid(), 'GALLERIA-93 BY ROF',  'HRERA-PENDING-004', 'TCP-004', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF INSIGNIA PARK',   'HRERA-PENDING-005', 'TCP-005', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF INSIGNIA PARK II','HRERA-PENDING-006', 'TCP-006', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF AMBLISS',         'HRERA-PENDING-007', 'TCP-007', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF I CITY',          'HRERA-PENDING-008', 'TCP-008', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF GALLERIA-108',    'HRERA-PENDING-009', 'TCP-009', 'Gurugram', NOW()),
  (gen_random_uuid(), 'ROF GALLERIA@78',     'HRERA-PENDING-010', 'TCP-010', 'Gurugram', NOW())
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. MASTER DATA TABLES (Set Master)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salutations (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO salutations (name) VALUES ('Mr.'),('Mrs.'),('Ms.'),('Dr.'),('Er.'),('CA'),('Adv.')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS professions (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO professions (name) VALUES
  ('Business'),('Service'),('Professional'),('Self Employed'),('Retired'),('Homemaker'),('Student'),('Other')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS nationalities (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO nationalities (name) VALUES ('Indian'),('NRI'),('OCI'),('Foreign National')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS sources_of_enquiry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sources_of_enquiry (name) VALUES
  ('Walk-in'),('Website'),('Referral'),('Broker'),('Advertisement'),('Social Media'),
  ('Hoarding/Banner'),('Exhibition'),('Cold Call'),('Email Campaign'),('WhatsApp'),('Other')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS document_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL UNIQUE,
  category    VARCHAR(100),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_dispatch (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type   VARCHAR(150),
  dispatch_mode   VARCHAR(100),  -- courier, hand, email, etc.
  tracking_no     VARCHAR(100),
  consumer_id     UUID REFERENCES consumers(id),
  dispatched_at   TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. BROKER TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_applications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_code          VARCHAR(50) UNIQUE,
  company_name         VARCHAR(200),
  estd_year            INT,
  first_name           VARCHAR(100),
  middle_name          VARCHAR(100),
  last_name            VARCHAR(100),
  designation          VARCHAR(100),
  date_of_birth        DATE,
  anniversary_date     DATE,
  deposit_money        BOOLEAN DEFAULT FALSE,
  -- Government Tax
  gst_status           VARCHAR(20) DEFAULT 'unregistered', -- registered / unregistered
  rera_reg_no          VARCHAR(100),
  tan_no               VARCHAR(50),
  pan_no               VARCHAR(50),
  service_tax          BOOLEAN DEFAULT FALSE,
  -- Other Info
  references_info      TEXT,
  poa_date             DATE,
  strength_of_force    VARCHAR(100),
  manager_name         VARCHAR(100),
  officer_name         VARCHAR(100),
  remark               TEXT,
  -- Contact
  address              TEXT,
  phone_code           VARCHAR(10),
  phone_no             VARCHAR(30),
  city                 VARCHAR(100),
  mobile_no            VARCHAR(20),
  state                VARCHAR(100),
  email                VARCHAR(200),
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id       UUID REFERENCES broker_applications(id),
  project_id      UUID REFERENCES projects(id),
  commission_pct  NUMERIC(5,2),   -- e.g. 1.50 for 1.5%
  commission_flat NUMERIC(15,2),
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. BOOKING FORM EXTENDED TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_forms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id             UUID REFERENCES consumers(id),
  project_id              UUID REFERENCES projects(id),
  unit_id                 UUID REFERENCES units(id),
  broker_id               UUID REFERENCES broker_applications(id),
  main_broker_id          UUID REFERENCES broker_applications(id),
  registration_no         VARCHAR(100) UNIQUE,
  form_no                 VARCHAR(100),
  application_date        DATE DEFAULT CURRENT_DATE,
  customer_classification VARCHAR(50),  -- Individual/Multiple/Company
  booking_type            VARCHAR(20) DEFAULT 'normal',  -- normal / hold
  basic_price_inr         NUMERIC(15,2),
  gstin                   VARCHAR(20),
  payment_plan_id         UUID REFERENCES payment_plans(id),
  -- Discounts
  company_inaugural_disc  NUMERIC(15,2) DEFAULT 0,
  company_rebate_rs       NUMERIC(15,2) DEFAULT 0,
  company_rebate_sqft     NUMERIC(15,2) DEFAULT 0,
  company_rebate_pct      NUMERIC(5,2)  DEFAULT 0,
  broker_rebate_rs        NUMERIC(15,2) DEFAULT 0,
  broker_rebate_sqft      NUMERIC(15,2) DEFAULT 0,
  broker_rebate_pct       NUMERIC(5,2)  DEFAULT 0,
  -- Other costs (flags)
  has_plc                 BOOLEAN DEFAULT FALSE,
  has_other_charge        BOOLEAN DEFAULT FALSE,
  has_alteration          BOOLEAN DEFAULT FALSE,
  has_ifms                BOOLEAN DEFAULT FALSE,
  has_additional_charge   BOOLEAN DEFAULT FALSE,
  has_extra_charge        BOOLEAN DEFAULT FALSE,
  has_finance             BOOLEAN DEFAULT FALSE,
  has_nominee             BOOLEAN DEFAULT FALSE,
  -- Sales
  sales_employee_id       UUID REFERENCES users(id),
  sales_remarks           TEXT,
  -- Status
  status                  VARCHAR(50) DEFAULT 'active',
  created_by_user_id      UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applicant_details (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id   UUID REFERENCES booking_forms(id),
  applicant_order   INT DEFAULT 1,  -- 1=first, 2=second, 3=third
  salutation        VARCHAR(20),
  first_name        VARCHAR(100),
  middle_name       VARCHAR(100),
  last_name         VARCHAR(100),
  father_name       VARCHAR(200),  -- S/o
  date_of_birth     DATE,
  anniversary_date  DATE,
  nationality       VARCHAR(50),   -- resident/nri/oci
  marital_status    VARCHAR(30),   -- married/unmarried/not_specified
  gender            VARCHAR(20),   -- male/female/transgender
  no_of_children    INT DEFAULT 0,
  passport_no       VARCHAR(50),
  pan_no            VARCHAR(50),
  aadhaar_no_hash   VARCHAR(64),   -- SHA-256
  email_1           VARCHAR(200),
  email_2           VARCHAR(200),
  profession        VARCHAR(100),
  designation       VARCHAR(100),
  company_firm      VARCHAR(200),
  photo_url         TEXT,
  has_poa           BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applicant_addresses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     UUID REFERENCES applicant_details(id),
  address_type     VARCHAR(30),  -- present / office / permanent
  address_line     TEXT,
  pin_code         VARCHAR(20),
  country          VARCHAR(100) DEFAULT 'India',
  state            VARCHAR(100),
  city             VARCHAR(100),
  mobile_no        VARCHAR(20),
  phone_no         VARCHAR(30),
  fax_no           VARCHAR(30),
  is_mailing       BOOLEAN DEFAULT FALSE,
  comm_courier     BOOLEAN DEFAULT FALSE,
  comm_email       BOOLEAN DEFAULT FALSE,
  comm_sms         BOOLEAN DEFAULT FALSE,
  comm_no_comm     BOOLEAN DEFAULT FALSE,
  comm_by_hand     BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. GST INVOICING TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gst_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no          VARCHAR(50) UNIQUE,
  invoice_date        DATE DEFAULT CURRENT_DATE,
  invoice_type        VARCHAR(50) DEFAULT 'invoice',  -- invoice/manual/reversal/cancellation/advance/credit/debit
  project_id          UUID REFERENCES projects(id),
  consumer_id         UUID REFERENCES consumers(id),
  unit_id             UUID REFERENCES units(id),
  payment_plan_id     UUID REFERENCES payment_plans(id),
  installment_name    VARCHAR(100),
  base_amount_inr     NUMERIC(15,2) DEFAULT 0,
  taxable_amount_inr  NUMERIC(15,2) DEFAULT 0,
  cgst_rate           NUMERIC(5,2) DEFAULT 9.00,
  sgst_rate           NUMERIC(5,2) DEFAULT 9.00,
  igst_rate           NUMERIC(5,2) DEFAULT 0,
  cgst_amount_inr     NUMERIC(15,2) DEFAULT 0,
  sgst_amount_inr     NUMERIC(15,2) DEFAULT 0,
  igst_amount_inr     NUMERIC(15,2) DEFAULT 0,
  total_amount_inr    NUMERIC(15,2) DEFAULT 0,
  supply_type         VARCHAR(20) DEFAULT 'intrastate',  -- intrastate / interstate
  place_of_supply     VARCHAR(100),
  hsn_sac_code        VARCHAR(20),
  status              VARCHAR(30) DEFAULT 'pending',  -- pending/generated/cancelled/reversed
  cancelled_at        TIMESTAMPTZ,
  cancelled_reason    TEXT,
  linked_invoice_id   UUID REFERENCES gst_invoices(id),  -- for credit/debit notes
  created_by_user_id  UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gst_process_rights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) UNIQUE,
  can_generate   BOOLEAN DEFAULT FALSE,
  can_cancel     BOOLEAN DEFAULT FALSE,
  can_reverse    BOOLEAN DEFAULT FALSE,
  can_manual     BOOLEAN DEFAULT FALSE,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. SURRENDER / CANCELLATION TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surrender_applications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id            UUID REFERENCES consumers(id),
  allocation_id          UUID REFERENCES allocations(id),
  project_id             UUID REFERENCES projects(id),
  unit_id                UUID REFERENCES units(id),
  surrender_date         DATE DEFAULT CURRENT_DATE,
  reason                 TEXT,
  forfeiture_amount_inr  NUMERIC(15,2) DEFAULT 29500,
  refund_amount_inr      NUMERIC(15,2),
  status                 VARCHAR(30) DEFAULT 'pending',  -- pending/approved/refunded
  approved_by            UUID REFERENCES users(id),
  approved_at            TIMESTAMPTZ,
  created_by_user_id     UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 8. PARKING TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parking_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,  -- Car, Scooter, Bike, etc.
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO parking_types (name) VALUES ('Car Parking'),('Scooter Parking'),('Bike Parking')
ON CONFLICT DO NOTHING;

-- Extend parking_slots if it exists, else create
CREATE TABLE IF NOT EXISTS parking_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id),
  parking_type_id  UUID REFERENCES parking_types(id),
  slot_no          VARCHAR(50),
  tower            VARCHAR(20),
  floor            VARCHAR(20),
  status           VARCHAR(30) DEFAULT 'available',  -- available/allotted/reserved
  consumer_id      UUID REFERENCES consumers(id),
  allocation_id    UUID REFERENCES allocations(id),
  allotted_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 9. SET PROJECTS ADDITIONAL TABLES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id),
  name         VARCHAR(200) NOT NULL,
  description  VARCHAR(500),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_master (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID REFERENCES projects(id),
  reminder_name  VARCHAR(200) NOT NULL,
  prefix_name    VARCHAR(100),
  rank           INT,
  days           INT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conveyance_deeds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID REFERENCES consumers(id),
  project_id      UUID REFERENCES projects(id),
  unit_id         UUID REFERENCES units(id),
  deed_date       DATE,
  deed_no         VARCHAR(100),
  registry_office VARCHAR(200),
  stamp_duty_inr  NUMERIC(15,2),
  status          VARCHAR(30) DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 10. HEAD WISE COSTS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS head_wise_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id UUID REFERENCES booking_forms(id),
  cost_head       VARCHAR(100),   -- PLC, IFMS, Extra Charge etc.
  amount_inr      NUMERIC(15,2),
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 11. UNIT STATUS HISTORY (if not exists)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unit_status_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id             UUID REFERENCES units(id),
  previous_status     VARCHAR(50),
  new_status          VARCHAR(50),
  changed_by_user_id  UUID REFERENCES users(id),
  reason              TEXT,
  changed_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 12. ADD USEFUL INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_forms_consumer    ON booking_forms(consumer_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_project     ON booking_forms(project_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_reg_no      ON booking_forms(registration_no);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_project      ON gst_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_consumer     ON gst_invoices(consumer_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoices_status       ON gst_invoices(status);
CREATE INDEX IF NOT EXISTS idx_parking_slots_project     ON parking_slots(project_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_status      ON parking_slots(status);
CREATE INDEX IF NOT EXISTS idx_surrender_consumer        ON surrender_applications(consumer_id);
