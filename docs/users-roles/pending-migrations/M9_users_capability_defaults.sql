-- M9 (UR-007), draft number 149, Batch 1. NOT in packages/api/src/db/migrations on purpose: a schema change goes through its release batch.
-- Defaults only; no row is updated (existing logins keep what they have; per-user grants are data operation D7). Idempotent and compatible with old
-- code, which inserts explicit values. The application already treats NULL, missing and unknown as "no access" and creates logins with explicit
-- 'none' and false; this makes a direct insert behave the same.
ALTER TABLE users ALTER COLUMN authorized_print SET DEFAULT false;
ALTER TABLE users ALTER COLUMN authorized_download SET DEFAULT false;
ALTER TABLE users ALTER COLUMN unit_status_access SET DEFAULT 'none';
