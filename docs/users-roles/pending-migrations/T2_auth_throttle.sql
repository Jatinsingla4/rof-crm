-- T2 (authentication), draft. NOT in packages/api/src/db/migrations on purpose: it is a schema change and goes through a release batch.
-- A shared, atomic store for the sign-in and current-password throttles (src/utils/throttle.ts). The application starts using it by itself as soon as
-- the table exists (it looks again every minute); without it the counts are per process, which a serverless host makes weak. Idempotent; new table only.
CREATE TABLE IF NOT EXISTS public.auth_throttle (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  first_at     timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
CREATE INDEX IF NOT EXISTS auth_throttle_first_at_idx ON public.auth_throttle (first_at);
-- Old keys are harmless and small; a reviewed clean-up (DELETE FROM auth_throttle WHERE first_at < now() - interval '2 days') may run any time.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_throttle TO rof_app;
