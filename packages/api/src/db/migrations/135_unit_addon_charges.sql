-- Charges attached to a unit in advance (parking, restoration ...), with a quantity; a booking of the unit puts them on the customer. Idempotent.
CREATE TABLE IF NOT EXISTS unit_addon_charges (
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  charge_master_id uuid NOT NULL REFERENCES addon_charge_master(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unit_id, charge_master_id),
  CONSTRAINT unit_addon_charges_qty_chk CHECK (quantity BETWEEN 1 AND 20)
);
SELECT rof_apply_project_scope();
