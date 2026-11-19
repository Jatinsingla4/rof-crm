-- throwaway fixture for rof_remed_b1 only: one live booking and one cancelled booking, each with a plan and a pending receipt and a pending cheque and a transfer
DO $$
DECLARE pj uuid; tw uuid; u1 uuid; u2 uuid; c1 uuid; c2 uuid; a1 uuid; a2 uuid; p1 uuid; p2 uuid;
BEGIN
  INSERT INTO projects (name, rera_number, tcp_licence) VALUES ('FX', 'R1', 'T1') RETURNING id INTO pj;
  INSERT INTO towers (project_id, tower_name) VALUES (pj, 'T') RETURNING id INTO tw;
  INSERT INTO units (project_id, tower_id, unit_number, bhk_type) VALUES (pj, tw, 'L1', '2BHK') RETURNING id INTO u1;
  INSERT INTO units (project_id, tower_id, unit_number, bhk_type) VALUES (pj, tw, 'C1', '2BHK') RETURNING id INTO u2;
  SELECT id INTO c1 FROM consumers LIMIT 1;
  INSERT INTO consumers (name, mobile, project_id) VALUES ('Cancelled Cust', '9000000001', pj) RETURNING id INTO c2;
  INSERT INTO allocations (consumer_id, project_id, unit_id) VALUES (c1, pj, u1) RETURNING id INTO a1;
  INSERT INTO allocations (consumer_id, project_id, unit_id) VALUES (c2, pj, u2) RETURNING id INTO a2;
  INSERT INTO payment_plans (allocation_id, consumer_id, project_id, unit_id, total_amount_inr) VALUES (a1, c1, pj, u1, 1000000) RETURNING id INTO p1;
  INSERT INTO payment_plans (allocation_id, consumer_id, project_id, unit_id, total_amount_inr) VALUES (a2, c2, pj, u2, 1000000) RETURNING id INTO p2;
  INSERT INTO booking_records (consumer_id, unit_id, project_id, status) VALUES (c1, u1, pj, 'active');
  INSERT INTO booking_records (consumer_id, unit_id, project_id, status) VALUES (c2, u2, pj, 'cancelled');
  INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method) VALUES
    (c1, p1, 100, current_date, 'pending', 'cheque'), (c1, p1, 400, current_date, 'pending', 'bank_transfer'),
    (c2, p2, 500, current_date, 'pending', 'cheque');
  RAISE NOTICE 'live plan %, cancelled plan %', p1, p2;
END $$;
