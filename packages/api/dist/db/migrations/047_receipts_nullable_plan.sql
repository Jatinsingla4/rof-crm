-- Migration 047: Make payment_plan_id and installment_index nullable in receipts
-- Reason: Consumers may receive payments (e.g. booking amount) before a payment plan
-- is created. The receipt form must support these "plan-less" consumers.

ALTER TABLE receipts
  ALTER COLUMN payment_plan_id DROP NOT NULL,
  ALTER COLUMN installment_index DROP NOT NULL;
