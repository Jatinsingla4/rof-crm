-- The rate per sqft is price / area (A-101: 55,00,000 / 700 = 7857.142857). At 2 decimals every booking was
-- priced a few rupees short (7857.14 x 700 = 54,99,998). 4 decimals keeps rate x area within 50 paise up to 10,000 sqft.
ALTER TABLE booking_records ALTER COLUMN basic_rate_inr_sqft TYPE NUMERIC(14,4);
