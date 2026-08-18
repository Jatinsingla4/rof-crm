-- Prevent duplicate co-applicant rows for the same (consumer_id, applicant_number).
-- ADD CONSTRAINT has no IF NOT EXISTS form, so a unique index is used instead --
-- functionally identical to a UNIQUE CONSTRAINT, and usable as an ON CONFLICT
-- target, while staying idempotent on repeated migration runs (matches the
-- pattern already used in 082_prevent_duplicate_unit_booking.sql).
CREATE UNIQUE INDEX IF NOT EXISTS
  co_applicants_consumer_applicant_unique
ON co_applicants(consumer_id, applicant_number);
