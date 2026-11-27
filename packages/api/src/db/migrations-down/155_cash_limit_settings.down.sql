-- removes the rows only while they are still at their OFF values (a limit ROF has set is never deleted by a rollback)
DELETE FROM global_settings WHERE (key = 'cash_receipt_limit_inr' AND value = '0') OR (key = 'cash_receipt_limit_scope' AND value = 'receipt') OR (key = 'cash_receipt_limit_mode' AND value = 'warn');
