// What booking and surrender need to know about brokers and their commission.
import { bad } from './input.js';

// The broker of a booking exists and is active; a direct booking has none
export const brokerOk = async (q: any, type: string, brokerId: string | null, mainBrokerId: string | null) => {
  if (type === 'direct' && (brokerId || mainBrokerId)) throw bad('A direct booking cannot have a broker. Choose the Broker sale type, or clear the broker.');
  for (const [label, id] of [['broker', brokerId], ['main broker', mainBrokerId]] as const) {
    if (!id) continue;
    const b = (await q.query(`SELECT status FROM brokers WHERE id = $1`, [id])).rows[0];
    if (!b) throw bad(`The ${label} does not exist`);
    if (b.status !== 'active') throw bad(`The ${label} is ${b.status}, only an active broker can take a booking`);
  }
};

// The booking ended after its commission was already paid: the commission stays 'paid' (the money has gone out) and says so
export const flagPaidCommission = (q: any, consumerId: string, unitId: string | null) =>
  q.query(
    `UPDATE broker_commissions SET notes = TRIM(BOTH E'\n' FROM COALESCE(notes, '') || E'\nBooking ended after this commission was paid: recover it from the broker')
      WHERE consumer_id = $1 AND unit_id IS NOT DISTINCT FROM $2 AND status = 'paid' AND COALESCE(notes, '') NOT LIKE '%recover it from the broker%'`, [consumerId, unitId]);
