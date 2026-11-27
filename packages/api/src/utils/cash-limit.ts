// QA-018 (V1.1): a configurable control on cash receipts. It is OFF until ROF Finance sets a limit (global_settings, Set Master): the amount, whether it applies to one receipt or to the cash taken
// from one applicant in one day, and whether going over only WARNS (the receipt is recorded and the screen is told) or BLOCKS (refused, 422). The amount, the scope and the mode are the
// client's decision (the statutory limit and how it is counted are for ROF Finance and their tax adviser); the software supplies none.
//   cash_receipt_limit_inr    0 or empty = off
//   cash_receipt_limit_scope  receipt (default) | customer_day
//   cash_receipt_limit_mode   warn (default) | block
export interface CashLimitResult { warn?: string; block?: string }

export async function cashLimitCheck(c: any, o: { consumerId: string; amount: number; date: string }): Promise<CashLimitResult | null> {
  const s = new Map<string, string>((await c.query(`SELECT key, value FROM global_settings WHERE key IN ('cash_receipt_limit_inr', 'cash_receipt_limit_scope', 'cash_receipt_limit_mode')`)).rows.map((r: any) => [r.key, r.value]));
  const limit = Number(s.get('cash_receipt_limit_inr'));
  if (!(limit > 0)) return null;
  const scope = s.get('cash_receipt_limit_scope') === 'customer_day' ? 'customer_day' : 'receipt';
  const block = s.get('cash_receipt_limit_mode') === 'block';
  let total = o.amount;
  if (scope === 'customer_day') {
    total += Number((await c.query(
      `SELECT COALESCE(SUM(amount_received_inr), 0) AS n FROM receipts
        WHERE consumer_id = $1 AND payment_method = 'cash' AND received_date = $2::date AND status NOT IN ('cancelled', 'bounced') AND is_advance IS NOT TRUE`, [o.consumerId, o.date])).rows[0].n);
  }
  if (total <= limit) return null;
  const inr = (n: number) => 'Rs ' + n.toLocaleString('en-IN');
  const message = scope === 'receipt'
    ? `A cash receipt of ${inr(o.amount)} is above the configured cash limit of ${inr(limit)}.`
    : `Cash received from this applicant on ${o.date} would total ${inr(total)}, above the configured limit of ${inr(limit)} per applicant per day.`;
  return block ? { block: message } : { warn: message };
}
