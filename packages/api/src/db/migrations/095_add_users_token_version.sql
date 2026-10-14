-- Lets logout and password changes invalidate previously issued JWTs
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
