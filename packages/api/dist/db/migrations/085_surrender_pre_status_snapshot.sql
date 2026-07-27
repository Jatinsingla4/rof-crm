-- Migration 085: Snapshot the unit's pre-surrender status onto
-- surrender_applications so a later restore can return the unit to its
-- exact prior state instead of a hardcoded value. Nullable, no backfill --
-- historical rows (created before this migration) will read back NULL.

ALTER TABLE surrender_applications
  ADD COLUMN IF NOT EXISTS pre_surrender_unit_status TEXT;
