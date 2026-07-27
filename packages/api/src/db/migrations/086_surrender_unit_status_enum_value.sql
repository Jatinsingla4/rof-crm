-- Migration 086: Add the 'temp_surrender' label to the unit_status enum type.
-- Required for migration 085's snapshot column to be usable -- the surrender
-- write path needs units.status to accept this value. Idempotent (IF NOT EXISTS).

ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'temp_surrender';
