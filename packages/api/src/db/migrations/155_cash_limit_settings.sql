-- QA-018: the cash receipt control. All three rows are written OFF (limit 0): nothing changes until ROF Finance sets an amount in Set Master.
-- ON CONFLICT DO NOTHING keeps a value that was already set. Safe to run twice.
INSERT INTO global_settings (key, value, description) VALUES
  ('cash_receipt_limit_inr', '0', 'QA-018: cash limit in rupees; 0 = off. The amount is ROF Finance''s decision'),
  ('cash_receipt_limit_scope', 'receipt', 'QA-018: receipt = one receipt, customer_day = all cash from one applicant on one day'),
  ('cash_receipt_limit_mode', 'warn', 'QA-018: warn = record and tell the screen, block = refuse')
ON CONFLICT (key) DO NOTHING;
