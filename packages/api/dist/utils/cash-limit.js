"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashLimitCheck = cashLimitCheck;
async function cashLimitCheck(c, o) {
    const s = new Map((await c.query(`SELECT key, value FROM global_settings WHERE key IN ('cash_receipt_limit_inr', 'cash_receipt_limit_scope', 'cash_receipt_limit_mode')`)).rows.map((r) => [r.key, r.value]));
    const limit = Number(s.get('cash_receipt_limit_inr'));
    if (!(limit > 0))
        return null;
    const scope = s.get('cash_receipt_limit_scope') === 'customer_day' ? 'customer_day' : 'receipt';
    const block = s.get('cash_receipt_limit_mode') === 'block';
    let total = o.amount;
    if (scope === 'customer_day') {
        total += Number((await c.query(`SELECT COALESCE(SUM(amount_received_inr), 0) AS n FROM receipts
        WHERE consumer_id = $1 AND payment_method = 'cash' AND received_date = $2::date AND status NOT IN ('cancelled', 'bounced') AND is_advance IS NOT TRUE`, [o.consumerId, o.date])).rows[0].n);
    }
    if (total <= limit)
        return null;
    const inr = (n) => 'Rs ' + n.toLocaleString('en-IN');
    const message = scope === 'receipt'
        ? `A cash receipt of ${inr(o.amount)} is above the configured cash limit of ${inr(limit)}.`
        : `Cash received from this applicant on ${o.date} would total ${inr(total)}, above the configured limit of ${inr(limit)} per applicant per day.`;
    return block ? { block: message } : { warn: message };
}
//# sourceMappingURL=cash-limit.js.map