-- removes the row only while it is still 'off' (a value finance has switched on is never deleted by a rollback)
DELETE FROM global_settings WHERE key = 'commission_requires_cleared_v1' AND value = 'off';
