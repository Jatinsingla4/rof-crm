-- Migration 052: ATS and Conveyance Deed legal document fields
-- Adds fields required for Agreement to Sale and Conveyance Deed generation

-- 1. Add legal tracking fields to allocations table
ALTER TABLE allocations
  ADD COLUMN IF NOT EXISTS
    agreement_execute_date DATE,
  ADD COLUMN IF NOT EXISTS
    registry_status VARCHAR(50)
    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS
    conveyance_deed_date DATE,
  ADD COLUMN IF NOT EXISTS
    agreement_date DATE;

-- 2. Add KYC and personal detail fields to consumers table
ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS
    father_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    aadhaar_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS
    date_of_birth_alt DATE,
  ADD COLUMN IF NOT EXISTS
    age INTEGER,
  ADD COLUMN IF NOT EXISTS
    mailing_address TEXT,
  ADD COLUMN IF NOT EXISTS
    son_daughter_wife_of VARCHAR(200);

-- 3. Add write-back capability columns to document_field_overrides
ALTER TABLE document_field_overrides
  ADD COLUMN IF NOT EXISTS
    source_table VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    source_column VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    source_record_id UUID,
  ADD COLUMN IF NOT EXISTS
    write_back_done BOOLEAN
    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS
    write_back_at TIMESTAMPTZ;

-- 4. Add missing legal and regulatory fields to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS
    license_date DATE,
  ADD COLUMN IF NOT EXISTS
    license_valid_upto DATE,
  ADD COLUMN IF NOT EXISTS
    env_clearance_no VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    env_clearance_date DATE,
  ADD COLUMN IF NOT EXISTS
    building_plan_memo_no VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    building_plan_date DATE,
  ADD COLUMN IF NOT EXISTS
    collaboration_agreement_date DATE,
  ADD COLUMN IF NOT EXISTS
    collaboration_agreement_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    land_owner_name VARCHAR(300),
  ADD COLUMN IF NOT EXISTS
    land_owner_llpin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS
    land_owner_pan VARCHAR(20),
  ADD COLUMN IF NOT EXISTS
    land_owner_address TEXT,
  ADD COLUMN IF NOT EXISTS
    land_owner_gpa_vasika_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    land_owner_gpa_date DATE,
  ADD COLUMN IF NOT EXISTS
    sale_deed_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    sale_deed_date DATE,
  ADD COLUMN IF NOT EXISTS
    occupation_cert_memo_no VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    occupation_cert_date DATE,
  ADD COLUMN IF NOT EXISTS
    deed_of_declaration_vasika_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    deed_of_declaration_date DATE,
  ADD COLUMN IF NOT EXISTS
    khasra_details TEXT,
  ADD COLUMN IF NOT EXISTS
    village_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    sector_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS
    sub_registrar_office VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    authorised_signatory_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS
    authorised_signatory_aadhaar VARCHAR(20),
  ADD COLUMN IF NOT EXISTS
    board_resolution_date DATE;

-- 5. Seed project legal data for ROF ALANTE_TEST from ATS PDF
UPDATE projects SET
  license_date = '2019-03-05'::date,
  env_clearance_no = 'SEIAA/HR/2020/72',
  env_clearance_date = '2020-02-06'::date,
  building_plan_memo_no = 'ZP1348/AD(RA)/2019/28186',
  building_plan_date = '2019-11-15'::date,
  collaboration_agreement_date = '2019-08-02'::date,
  collaboration_agreement_no = 'LLA/2019/001',
  land_owner_name = 'M/s MRA Infrastructure Development LLP',
  land_owner_llpin = 'AAO-7853',
  land_owner_pan = 'ABLFM2142D',
  land_owner_address = 'M-18, Greater Kailash-II, New Delhi-110048',
  land_owner_gpa_vasika_no = '29',
  land_owner_gpa_date = '2019-08-02'::date,
  sale_deed_no = '4969',
  sale_deed_date = '2019-07-26'::date,
  khasra_details = 'Khewat/Khata No. 44/26 Khatoni no. 67, Rect. No. 1 Killa No. 16/1(0-16), 25/2(0-15), Rect No. 2, Killa No. 11/2/2(1-10), 12(3-8), 18/2/2(2-2), 19/2(8-5), 20(8-0), 21/1(7-11), 22/1(7-4), 27(0-3), 28(0-6)',
  village_name = 'Village Dharampur',
  sector_name = 'Sector-108',
  sub_registrar_office = 'Sub-Registrar, Kadipur'
WHERE name ILIKE '%ALANTE%';
