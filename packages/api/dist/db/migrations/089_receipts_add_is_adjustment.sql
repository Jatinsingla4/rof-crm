-- Migration 089: Add is_adjustment flag to receipts.
-- Adjust / Dealer Adjustment payment modes move no real money -- they need to
-- be distinguishable from real receipts so money-sum reports (reports.ts,
-- dashboard.ts) can exclude them later. Separate file from 088 since it must
-- not run in the same transaction as the ADD VALUE statements that add the
-- new payment_method values this feature relies on. Idempotent (IF NOT EXISTS).

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT FALSE;
