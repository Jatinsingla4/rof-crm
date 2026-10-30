-- Set Master parity with the client CRM (see docs/set-master-parity/README.md). Idempotent: CI runs every migration twice.

-- Country Master: abbreviation, ISO code, ISD code and the number of digits of a mobile number in that country
ALTER TABLE countries ADD COLUMN IF NOT EXISTS abbreviation varchar(10);
ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso_code varchar(3);
ALTER TABLE countries ADD COLUMN IF NOT EXISTS isd_code varchar(6);
ALTER TABLE countries ADD COLUMN IF NOT EXISTS mobile_digits integer NOT NULL DEFAULT 10;
ALTER TABLE countries DROP CONSTRAINT IF EXISTS countries_mobile_digits_chk;
ALTER TABLE countries ADD CONSTRAINT countries_mobile_digits_chk CHECK (mobile_digits BETWEEN 4 AND 15);
UPDATE countries c SET abbreviation = v.ab, iso_code = v.iso, isd_code = v.isd, mobile_digits = v.d
  FROM (VALUES ('India','In','IN','91',10), ('Saudi Arabia','SA','SA','966',10), ('Singapore','SG','SG','65',8),
               ('U.K','UK','GB','44',10), ('United Arab Emirates','UAE','AE','971',10), ('USA','US','US','1',10)) AS v(nm,ab,iso,isd,d)
 WHERE lower(c.name) = lower(v.nm) AND c.iso_code IS NULL;

-- Area Type master (Sq. Ft., Acres, ...) and Currency master
CREATE TABLE IF NOT EXISTS area_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(50) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_area_types_name_ci ON area_types (lower(name));
INSERT INTO area_types (name) VALUES ('Sq. Ft.'), ('Acres'), ('Sq. Yrd.'), ('Sq. Mt.') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS currencies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(50) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_currencies_name_ci ON currencies (lower(name));
INSERT INTO currencies (name) VALUES ('Rs.') ON CONFLICT DO NOTHING;

-- Banks: one list, two uses (customer bank, loan bank); a loan bank can be approved for chosen projects (no row = approved everywhere)
ALTER TABLE banks ADD COLUMN IF NOT EXISTS is_customer_bank boolean NOT NULL DEFAULT true;
ALTER TABLE banks ADD COLUMN IF NOT EXISTS is_loan_bank boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS loan_bank_projects (
  bank_id uuid NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_id, project_id));

-- Document master: the same name can exist for Individual and for Firm or Company, and in every project
ALTER TABLE document_types DROP CONSTRAINT IF EXISTS document_types_name_key;
DROP INDEX IF EXISTS document_types_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_types_scope
  ON document_types (lower(name), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), document_from);

-- Document Dispatch Master: the kinds of document that go out (name, single or multiple, per project)
CREATE TABLE IF NOT EXISTS document_dispatch_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  dispatch_type varchar(10) NOT NULL DEFAULT 'Single' CHECK (dispatch_type IN ('Single','Multiple')),
  description varchar(150),
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_master_scope
  ON document_dispatch_master (lower(name), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Every table that holds a project_id needs the project scope policy (a test checks this)
SELECT rof_apply_project_scope();
