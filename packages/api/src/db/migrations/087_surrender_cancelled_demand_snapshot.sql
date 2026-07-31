-- Migration 087: Snapshot the demands cancelled during a surrender onto
-- surrender_applications so a later restore can reverse them to their exact
-- prior status instead of leaving them cancelled forever. Nullable, no
-- backfill -- historical rows (created before this migration) will read
-- back NULL.

ALTER TABLE surrender_applications
  ADD COLUMN IF NOT EXISTS cancelled_demand_snapshot JSONB;
