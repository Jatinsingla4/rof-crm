-- Owner decision D-RECEIPTCTRL: "authorized" means approved, and the approve action sets approval_status = 'approved'.
-- Before this change the approve action set status = 'authorized' only, so approval_status stayed 'pending' for every receipt a checker had authorized.
-- This fills that field for the receipts a checker really authorized (authorized_by is set), so history and the new rules agree.
-- It changes no amount, status, date or user and rewrites no audit row. Safe to run twice.
UPDATE receipts
   SET approval_status = 'approved'
 WHERE authorized_by IS NOT NULL
   AND status IN ('authorized', 'deposited', 'on_hold', 'cleared')
   AND approval_status IS DISTINCT FROM 'approved';
