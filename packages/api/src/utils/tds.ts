// TDS challan balance. A challan's assigned_amount is only ever moved by a delta while its row is locked
// (summing the assignments would miss other projects' rows for a user who is scoped to one project).
export const challanStatus = `CASE WHEN assigned_amount >= amount THEN 'fully_assigned' WHEN assigned_amount > 0 THEN 'partially_assigned' ELSE 'available' END`;

// A cancelled or bounced receipt gives back what was assigned to it; the rows stay as history. Call with the receipt row already locked.
export const releaseTdsForReceipt = async (c: any, receiptId: string, reason: string): Promise<number> => {
  const rows = (await c.query(
    `UPDATE tds_assignments SET released_at = NOW(), release_reason = $2 WHERE receipt_id = $1 AND released_at IS NULL RETURNING challan_id, amount_assigned`,
    [receiptId, reason]
  )).rows;
  const back = new Map<string, number>();
  for (const r of rows) back.set(r.challan_id, (back.get(r.challan_id) || 0) + Number(r.amount_assigned));
  for (const [id, amt] of [...back].sort()) {
    await c.query(`UPDATE tds_challans SET assigned_amount = GREATEST(assigned_amount - $2, 0), status = ${challanStatus.replace(/assigned_amount/g, 'GREATEST(assigned_amount - $2, 0)')} WHERE id = $1`, [id, amt]);
  }
  return rows.length;
};
