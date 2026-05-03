-- Migration 016: Add deleted_at column to towers table
-- Date: 2026-05-02
-- Purpose: Support soft delete of towers for audit trail

ALTER TABLE towers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_towers_deleted_at
ON towers(deleted_at);
