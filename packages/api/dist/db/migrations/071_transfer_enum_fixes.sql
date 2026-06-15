-- Migration 071: Transfer Module — enum additions
-- Adds 'transferred' to lead_stage and allocation_status enums.
-- Fully idempotent — checks before ALTER TYPE to avoid duplicate-value errors.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Add 'transferred' to lead_stage enum
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'lead_stage'
    AND e.enumlabel = 'transferred'
  ) THEN
    ALTER TYPE lead_stage ADD VALUE 'transferred';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Add 'transferred' to allocation_status enum
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'allocation_status'
    AND e.enumlabel = 'transferred'
  ) THEN
    ALTER TYPE allocation_status ADD VALUE 'transferred';
  END IF;
END $$;
