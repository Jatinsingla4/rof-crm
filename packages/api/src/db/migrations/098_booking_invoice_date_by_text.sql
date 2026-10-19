-- booking_records.invoice_date_by holds a word ('receipt_date' or 'booking_date'), not an id.
-- The reconstructed baseline created it as uuid, so saving any booking failed with
-- 'invalid input syntax for type uuid: "receipt_date"'. Safe to run again: it only acts while the column is still uuid.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'booking_records'
      AND column_name = 'invoice_date_by' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE booking_records ALTER COLUMN invoice_date_by TYPE VARCHAR(50) USING invoice_date_by::text;
  END IF;
END $$;
