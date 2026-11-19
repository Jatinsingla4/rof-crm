// QA-012: money may not move on a cancelled booking. A plan is "cancelled" when its applicant's booking of that unit is cancelled and no live booking of it remains
// (a re-booked unit stays live). History is never touched: this only refuses NEW receipts, demands and approvals; a cancelled booking is settled by refund.
export const CANCELLED_MSG = 'This booking is cancelled, so no new receipt, demand or approval can be made on it. Settle the money through a refund.';

export async function planIsCancelled(db: any, planId: string | null | undefined): Promise<boolean> {
  if (!planId) return false;
  return (await db.query(
    `SELECT 1 FROM payment_plans pp JOIN booking_records br ON br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status = 'cancelled'
      WHERE pp.id = $1 AND NOT EXISTS (SELECT 1 FROM booking_records b2 WHERE b2.consumer_id = pp.consumer_id AND b2.unit_id = pp.unit_id AND b2.status <> 'cancelled') LIMIT 1`, [planId])).rows.length > 0;
}

// The same rule as a SQL expression on a payment_plans alias, for lists that must mark (not hide) money held on a cancelled booking.
export const cancelledPlanSql = (pp: string) =>
  `(EXISTS (SELECT 1 FROM booking_records bc WHERE bc.consumer_id = ${pp}.consumer_id AND bc.unit_id = ${pp}.unit_id AND bc.status = 'cancelled')
    AND NOT EXISTS (SELECT 1 FROM booking_records bl WHERE bl.consumer_id = ${pp}.consumer_id AND bl.unit_id = ${pp}.unit_id AND bl.status <> 'cancelled'))`;
