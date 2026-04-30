-- Migration 021: Add unit_shifts table for unit shifting history
CREATE TABLE IF NOT EXISTS unit_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  old_unit_id     UUID REFERENCES units(id),
  new_unit_id     UUID REFERENCES units(id),
  reason          TEXT,
  shift_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  shifted_by_user_id UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_shifts_consumer ON unit_shifts(consumer_id);
CREATE INDEX IF NOT EXISTS idx_unit_shifts_date ON unit_shifts(shift_date);
