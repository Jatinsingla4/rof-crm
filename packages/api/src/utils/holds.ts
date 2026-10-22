// Unit holds: closing a hold, freeing the unit, and what a booking does with a held unit.
// Order of locks everywhere: the unit first, then its hold (so booking, release and expiry cannot deadlock).
import { db } from '../index.js';
import { bad, inTx } from './input.js';

// Closes the active hold of a unit and frees the unit when it is still 'held'. Returns false when there was no active hold.
export const closeHold = async (c: any, holdId: string, status: 'expired' | 'cancelled' | 'converted', userId: string | null, reason: string): Promise<boolean> => {
  const unit = (await c.query(`SELECT unit_id FROM unit_holds WHERE id = $1`, [holdId])).rows[0]?.unit_id;
  if (!unit) return false;
  await c.query(`SELECT 1 FROM units WHERE id = $1 FOR UPDATE`, [unit]);
  const closed = (await c.query(`UPDATE unit_holds SET status = $2, released_at = NOW(), released_by = $3 WHERE id = $1 AND status = 'active' RETURNING id`, [holdId, status, userId])).rows.length > 0;
  if (!closed) return false;
  const freed = (await c.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1 AND status = 'held' RETURNING id`, [unit])).rows.length > 0;
  if (freed) await c.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason) VALUES ($1, 'held', 'available', $2, $3)`, [unit, userId, reason]);
  return true;
};

// Every active hold whose time is up is expired (run by the scheduler, and before holds are listed or made)
export const expireDueHolds = async (): Promise<number> => {
  const due = (await db.query(`SELECT id FROM unit_holds WHERE status = 'active' AND expires_at <= NOW()`)).rows;
  let n = 0;
  for (const h of due) if (await inTx((c) => closeHold(c, h.id, 'expired', null, 'Hold expired'))) n++;
  return n;
};

// A booking is made on a unit that is 'held' (the caller has the unit locked). The unit is freed for the booking when the hold has expired,
// belongs to the same broker as the booking (the hold becomes 'converted'), or has no hold record at all; otherwise the booking is refused.
export const settleHold = async (c: any, unitId: string, bookingBrokerId: string | null, userId: string | null): Promise<void> => {
  const h = (await c.query(
    `SELECT uh.id, uh.broker_id, (uh.expires_at <= NOW()) AS due, b.firm_name, b.name, uh.expires_at
       FROM unit_holds uh JOIN brokers b ON b.id = uh.broker_id WHERE uh.unit_id = $1 AND uh.status = 'active' FOR UPDATE OF uh`, [unitId])).rows[0];
  if (!h) {
    await c.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1 AND status = 'held'`, [unitId]);
    await c.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason) VALUES ($1, 'held', 'available', $2, 'Held unit had no hold record')`, [unitId, userId]);
    return;
  }
  if (h.due) { await closeHold(c, h.id, 'expired', null, 'Hold expired'); return; }
  if (bookingBrokerId && bookingBrokerId === h.broker_id) { await closeHold(c, h.id, 'converted', userId, 'Hold converted to a booking'); return; }
  throw bad(`This unit is held by ${h.firm_name || h.name} until ${new Date(h.expires_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. Only that broker can book it, or the hold has to be released first.`, 409);
};
