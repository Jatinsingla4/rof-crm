-- One reminder per name and number of days (any letter case). Created only when there are no duplicates yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reminder_master GROUP BY lower(reminder_name), days HAVING count(*) > 1) THEN
    RAISE NOTICE 'uq_reminder_name_days not created: duplicate reminders exist';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_name_days ON reminder_master (lower(reminder_name), days);
  END IF;
END $$;
