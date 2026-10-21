-- Booking documents are kept in the database (a serverless host does not keep files written to disk)
ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS file_data BYTEA;
