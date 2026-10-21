-- Transfer fee, admin charges and transfer amount keep paise like the tax amounts beside them (they were whole-rupee columns)
ALTER TABLE ownership_transfers
  ALTER COLUMN transfer_fee_inr TYPE NUMERIC(14,2),
  ALTER COLUMN admin_charges_inr TYPE NUMERIC(14,2),
  ALTER COLUMN transfer_amount_inr TYPE NUMERIC(14,2);
