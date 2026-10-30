-- Other Charge master flags of the client CRM (docs/set-projects-parity/README.md): mandatory, parking, inventory base, multiple booking,
-- alteration, agreement, quantity, effective date, description. Idempotent.
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS is_parking boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS inventory_base boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS multiple_booking boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS is_alteration boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS is_agreement boolean NOT NULL DEFAULT false;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS effective_date date;
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS description varchar(500);
ALTER TABLE addon_charge_master DROP CONSTRAINT IF EXISTS addon_charge_master_flags_chk;
ALTER TABLE addon_charge_master ADD CONSTRAINT addon_charge_master_flags_chk CHECK ((quantity IS NULL OR quantity >= 0) AND (NOT inventory_base OR is_parking));
