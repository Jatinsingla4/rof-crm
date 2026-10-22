-- Parking: (the old empty parking_types table is not used) the price list per type lived only in each browser (localStorage). Now it is a table. Checks on the slots, new or changed rows only (NOT VALID).
CREATE TABLE IF NOT EXISTS parking_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  parking_type VARCHAR(50) NOT NULL,
  price_inr NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (price_inr >= 0),
  description VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT parking_prices_type_chk CHECK (parking_type IN ('covered','open','stilt','ev','visitor')),
  CONSTRAINT parking_prices_unique UNIQUE (project_id, parking_type)
);
SELECT rof_apply_project_scope();

ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS parking_slots_type_chk;
ALTER TABLE parking_slots ADD CONSTRAINT parking_slots_type_chk CHECK (parking_type IN ('covered','open','stilt','ev','visitor')) NOT VALID;
ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS parking_slots_amount_chk;
ALTER TABLE parking_slots ADD CONSTRAINT parking_slots_amount_chk CHECK (amount_inr >= 0) NOT VALID;
ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS parking_slots_floor_chk;
ALTER TABLE parking_slots ADD CONSTRAINT parking_slots_floor_chk CHECK (floor BETWEEN -10 AND 200) NOT VALID;
ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS parking_slots_state_chk;
ALTER TABLE parking_slots ADD CONSTRAINT parking_slots_state_chk CHECK (
  (status = 'available' AND allotted_to_consumer_id IS NULL) OR (status = 'allotted' AND allotted_to_consumer_id IS NOT NULL)) NOT VALID;
