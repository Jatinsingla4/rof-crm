-- document_types.required_at holds a stage name such as 'On Booking', not a timestamp.
-- The reconstructed baseline created it as TIMESTAMPTZ, so saving a document type failed.
-- Safe to run on a database where the column is already text: it does nothing there.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'document_types'
      AND column_name = 'required_at' AND data_type <> 'character varying'
  ) THEN
    ALTER TABLE document_types ALTER COLUMN required_at TYPE VARCHAR(100) USING required_at::text;
  END IF;
END $$;
