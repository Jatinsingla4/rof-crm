-- Money integrity (owner decisions Q13, D1 to D8): stage A, additive tables only.
--  receipt_returns            a linked reversal of a CLEARED receipt (bank return). The receipt row itself is never changed.
--  credit_allocations         customer credit moved to one demand, maker-checker.
--  credit_allocation_reversals the maker-checker reversal of an allocation (a return approval can record them in its own transaction).
-- Old code ignores these tables, so this migration is safe to apply before the new code is deployed. Safe to run twice.

CREATE TABLE IF NOT EXISTS receipt_returns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id       uuid NOT NULL REFERENCES receipts(id),
  consumer_id      uuid NOT NULL REFERENCES consumers(id),
  payment_plan_id  uuid REFERENCES payment_plans(id),
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  reason           text NOT NULL CHECK (length(btrim(reason)) > 0),
  bank_return_date date NOT NULL,                       -- when the bank returned it (D6)
  status           varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by     uuid NOT NULL REFERENCES users(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  approved_by      uuid REFERENCES users(id),
  posted_at        timestamptz,                         -- when the system posted the approved return (D6)
  rejected_reason  text,
  journal_entry_id uuid UNIQUE REFERENCES journal_entries(id),
  idempotency_key  varchar(120) NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'approved') = (posted_at IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_returns_key ON receipt_returns (requested_by, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_returns_one_pending ON receipt_returns (receipt_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_receipt_returns_receipt ON receipt_returns (receipt_id, status);
CREATE INDEX IF NOT EXISTS ix_receipt_returns_plan ON receipt_returns (payment_plan_id, status);

CREATE TABLE IF NOT EXISTS credit_allocations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id      uuid NOT NULL REFERENCES consumers(id),
  payment_plan_id  uuid NOT NULL REFERENCES payment_plans(id),
  demand_id        uuid NOT NULL REFERENCES demands(id),
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  reason           text NOT NULL CHECK (length(btrim(reason)) > 0),
  status           varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reversed')),
  requested_by     uuid NOT NULL REFERENCES users(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  approved_by      uuid REFERENCES users(id),
  posted_at        timestamptz,
  rejected_reason  text,
  idempotency_key  varchar(120) NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_allocations_key ON credit_allocations (requested_by, idempotency_key);
CREATE INDEX IF NOT EXISTS ix_credit_allocations_plan ON credit_allocations (payment_plan_id, status);
CREATE INDEX IF NOT EXISTS ix_credit_allocations_demand ON credit_allocations (demand_id, status);

CREATE TABLE IF NOT EXISTS credit_allocation_reversals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id    uuid NOT NULL REFERENCES credit_allocations(id),
  origin_return_id uuid REFERENCES receipt_returns(id),  -- set when a return approval recorded this reversal (D7)
  reason           text NOT NULL CHECK (length(btrim(reason)) > 0),
  status           varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by     uuid NOT NULL REFERENCES users(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  approved_by      uuid REFERENCES users(id),
  posted_at        timestamptz,
  idempotency_key  varchar(120) NOT NULL,
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_allocation_reversals_key ON credit_allocation_reversals (requested_by, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_allocation_reversals_live ON credit_allocation_reversals (allocation_id) WHERE status IN ('pending', 'approved');
