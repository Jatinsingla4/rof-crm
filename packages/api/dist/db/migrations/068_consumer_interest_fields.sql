-- Migration 068: Consumer interest fields for grace period and interest start date

ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS interest_start_date DATE DEFAULT NULL;

ALTER TABLE consumers
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;
