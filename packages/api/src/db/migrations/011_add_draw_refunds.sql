-- Migration 011: Add draw_refunds table for unsuccessful draw applicants
-- Tracks refunds due within 15-30 days per Haryana AHP policy

CREATE TABLE IF NOT EXISTS draw_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID NOT NULL REFERENCES consumers(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  draw_result VARCHAR(50) NOT NULL DEFAULT 'unsuccessful',
  booking_amount_paid_inr BIGINT NOT NULL,
  refund_amount_inr BIGINT NOT NULL,
  refund_due_by DATE NOT NULL,
  refund_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  refund_initiated_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,
  refund_reference VARCHAR(255),
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_refunds_consumer ON draw_refunds(consumer_id);
CREATE INDEX IF NOT EXISTS idx_draw_refunds_status ON draw_refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_draw_refunds_due_by ON draw_refunds(refund_due_by);
CREATE INDEX IF NOT EXISTS idx_draw_refunds_project ON draw_refunds(project_id);
