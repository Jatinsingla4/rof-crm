-- The balcony rate row is what Booking reads; put it back (same default as 083) if it was ever removed.
INSERT INTO charge_master_config (charge_key, charge_name, rate_value, rate_unit, cap_value, is_cap_configurable)
VALUES ('balcony_charge', 'Balcony Charge', 1300.00, 'per_sqft', 100000.00, false)
ON CONFLICT (charge_key) DO NOTHING;
