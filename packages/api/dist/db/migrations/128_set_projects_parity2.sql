-- Set Projects parity, second part (docs/set-projects-parity/README.md): add-on charge master options, interest master type and basis,
-- project type and land area unit, tower prefix / sort order / completion date. Idempotent.
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS charge_type varchar(30) NOT NULL DEFAULT 'Other';
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS apply_date_type varchar(20) NOT NULL DEFAULT 'Customer Wise Date';
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS calculate_rate_type varchar(30) NOT NULL DEFAULT 'Old Area';
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS include_in_dues boolean NOT NULL DEFAULT true;
ALTER TABLE addon_charge_master DROP CONSTRAINT IF EXISTS addon_charge_master_apply_chk;
ALTER TABLE addon_charge_master ADD CONSTRAINT addon_charge_master_apply_chk CHECK (apply_date_type IN ('Possession','Customer Wise Date'));

ALTER TABLE project_interest_rates ADD COLUMN IF NOT EXISTS interest_type varchar(10) NOT NULL DEFAULT 'Simple';
ALTER TABLE project_interest_rates ADD COLUMN IF NOT EXISTS compound_frequency varchar(20);
ALTER TABLE project_interest_rates ADD COLUMN IF NOT EXISTS calculated_on varchar(30) NOT NULL DEFAULT 'Receipt Date Wise';
ALTER TABLE project_interest_rates DROP CONSTRAINT IF EXISTS project_interest_rates_type_chk;
ALTER TABLE project_interest_rates ADD CONSTRAINT project_interest_rates_type_chk CHECK (interest_type IN ('Simple','Compound') AND (interest_type = 'Compound' OR compound_frequency IS NULL));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type varchar(40);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS land_area_unit varchar(50);

ALTER TABLE towers ADD COLUMN IF NOT EXISTS address_prefix varchar(20);
ALTER TABLE towers ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE towers ADD COLUMN IF NOT EXISTS completion_date date;
