-- Applicant photos live in the database (a serverless host does not keep files written to disk)
CREATE TABLE IF NOT EXISTS applicant_photos (
  kind         TEXT NOT NULL CHECK (kind IN ('consumer', 'co', 'addl')),
  owner_id     UUID NOT NULL,
  content_type TEXT NOT NULL,
  data         BYTEA NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, owner_id)
);
