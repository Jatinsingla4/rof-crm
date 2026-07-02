-- Migration 080: Add seller balance snapshot columns to ownership_transfers.
-- These are captured at transfer time (before financial records are moved
-- to the new consumer) so the Transfer Letter remains accurate after the fix.

ALTER TABLE ownership_transfers
  ADD COLUMN IF NOT EXISTS seller_total_paid_inr NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_total_due_inr  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_balance_inr    NUMERIC(14,2) DEFAULT 0;
