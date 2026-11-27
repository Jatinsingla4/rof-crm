-- QA-009: the commission payout gate flag had no row in global_settings (a missing row meant off, and nobody could see it). This adds the row, OFF.
-- It does not switch the gate on: only finance does that, after reviewing docs/remediation/wave1/paid-commissions-without-cleared-DRYRUN.sql.
-- ON CONFLICT DO NOTHING: a value finance has already set is kept. Safe to run twice.
INSERT INTO global_settings (key, value, description)
VALUES ('commission_requires_cleared_v1', 'off', 'QA-009: a broker commission can be paid only when the booking amount has cleared (on/off). Off = old rule (booking active or complete).')
ON CONFLICT (key) DO NOTHING;
