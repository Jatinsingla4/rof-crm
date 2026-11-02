-- Timely discount: a plan can give a discount % on every installment a customer pays in full by its due date; a customer can have his own %.
-- An earned discount becomes a credit note on the installment's invoice (timely_discount_awards records it, or that it waits for an invoice). Idempotent.
ALTER TABLE plan_headers ADD COLUMN IF NOT EXISTS timely_discount boolean NOT NULL DEFAULT false;
ALTER TABLE plan_headers ADD COLUMN IF NOT EXISTS discount_pct numeric(7,4) NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_headers_discount_chk') THEN
    ALTER TABLE plan_headers ADD CONSTRAINT plan_headers_discount_chk CHECK (discount_pct >= 0 AND discount_pct <= 100 AND (NOT timely_discount OR discount_pct > 0));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS customer_timely_discount (
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  discount_pct numeric(7,4) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  note varchar(300),
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id, project_id)
);
CREATE TABLE IF NOT EXISTS timely_discount_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL UNIQUE REFERENCES demands(id) ON DELETE CASCADE,
  installment_name varchar(255),
  base_amount numeric(14,2) NOT NULL,
  discount_pct numeric(7,4) NOT NULL,
  discount_amount numeric(14,2) NOT NULL,
  due_date date,
  paid_on date,
  credit_note_id uuid,
  status varchar(20) NOT NULL CHECK (status IN ('issued', 'waiting')),
  note varchar(300),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON customer_timely_discount, timely_discount_awards TO rof_app;
SELECT public.rof_apply_project_scope();
