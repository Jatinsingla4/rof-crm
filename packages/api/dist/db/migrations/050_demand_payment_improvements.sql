-- Migration 050: Demand/payment flow improvements
-- Adds advance tracking columns needed by the partial/excess payment logic.

-- Excess advance balance tracked per payment plan
ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(12,2) DEFAULT 0;

-- Mark a receipt as an auto-generated advance (created from excess payment)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS is_advance BOOLEAN DEFAULT false;

-- Link advance receipt back to the demand whose excess generated it
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS advance_from_demand_id UUID REFERENCES demands(id);
