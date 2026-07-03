-- Migration 081: Add addon GST columns
-- to demands table.
-- addon_cgst_amount and addon_sgst_amount
-- store the GST component of addon charges
-- per installment, computed by
-- recomputeAddonDemands() alongside
-- the existing addon_charge_amount.
-- Existing rows default to 0 (correct —
-- recomputeAddonDemands will backfill
-- when called for existing consumers).

ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS
    addon_cgst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS
    addon_sgst_amount NUMERIC DEFAULT 0;
