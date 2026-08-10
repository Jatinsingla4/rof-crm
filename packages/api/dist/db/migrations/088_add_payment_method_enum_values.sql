-- Migration 088: Add missing payment_method enum values.
-- payment_method previously had only bank_transfer, cheque, neft, rtgs, upi --
-- the Payment Receipt popup's 8 tabs (Cheque/Draft/Online/Cash/Card/Adjust/
-- Dealer Adjustment/TDS Challan) had no valid value for Draft, Cash, Card, or
-- TDS Challan, causing those saves to fail with an enum rejection. Idempotent
-- (IF NOT EXISTS). Each ADD VALUE must not share a transaction with any later
-- use of that value -- this file only adds values, it does not use them.

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'demand_draft';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'card';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'tds_challan';
