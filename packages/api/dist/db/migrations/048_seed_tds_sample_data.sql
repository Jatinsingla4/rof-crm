-- Migration 048: Seed sample TDS data for demo/testing
-- Consumers: Vikram Nair (e5d50168), Avi Gupta/b28 (b28f9825), Avi Gupta/afa (afa9ed3d)

DO $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
BEGIN
  INSERT INTO tds_challans (challan_number, challan_date, amount, financial_year, quarter, status)
  VALUES ('OLTAS/2025-26/Q3/001', '2026-01-15', 3718.85, '2025-26', 'Q3', 'filed')
  RETURNING id INTO c1;

  INSERT INTO tds_challans (challan_number, challan_date, amount, financial_year, quarter, status)
  VALUES ('OLTAS/2025-26/Q3/002', '2026-01-20', 1000.00, '2025-26', 'Q3', 'filed')
  RETURNING id INTO c2;

  INSERT INTO tds_challans (challan_number, challan_date, amount, financial_year, quarter, status)
  VALUES ('OLTAS/2025-26/Q4/003', '2026-03-10', 1850.00, '2025-26', 'Q4', 'pending')
  RETURNING id INTO c3;

  INSERT INTO tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned) VALUES
    (c1, 'e5d50168-c1e3-49d1-8d32-8fb746cf2605', NULL, 3718.85),
    (c2, 'b28f9825-0bea-4f64-b29c-3aba4ee475c5', NULL, 1000.00),
    (c3, 'afa9ed3d-c4de-4400-86f0-fbe452991d44', NULL, 1850.00);
END $$;
