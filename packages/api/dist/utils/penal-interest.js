"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextNumber = exports.persistInterest = void 0;
const input_js_1 = require("./input.js");
const business_date_js_1 = require("./business-date.js");
// Saves a fresh interest calculation for one applicant: the stored 'calculated' rows are replaced (manual rows stay).
// What was waived is never lost: the amount waived per installment comes back from the approved waivers, up to the new interest.
// Call inside a transaction. Returns installment_index -> new penal_interests id.
const persistInterest = async (c, consumerId, planId, rows) => {
    await (0, input_js_1.lock)(c, 'pi:' + consumerId);
    const waived = new Map((await c.query(`SELECT installment_index, SUM(waiver_amount_inr)::bigint AS w FROM interest_waivers WHERE consumer_id = $1 AND status = 'approved' AND installment_index IS NOT NULL GROUP BY installment_index`, [consumerId])).rows.map((r) => [r.installment_index, Number(r.w)]));
    await c.query(`DELETE FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated'`, [consumerId]);
    const ids = {};
    for (const row of rows) {
        const amount = Math.round(row.interest_amount);
        const r = await c.query(`INSERT INTO penal_interests (payment_plan_id, installment_index, consumer_id, principal_inr, days_overdue, rate_percent, amount_inr, interest_waived_inr, calculated_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),'calculated') RETURNING id`, [planId, row.installment_index, consumerId, Math.round(row.delay_amount), row.delay_days, row.roi, amount, Math.min(amount, waived.get(row.installment_index) || 0)]);
        ids[row.installment_index] = r.rows[0].id;
    }
    return ids;
};
exports.persistInterest = persistInterest;
// Next number of a series such as INV/2026/00007 (one writer at a time, so two requests never get the same number)
const nextNumber = async (c, table, column, prefix, width) => {
    await (0, input_js_1.lock)(c, 'num:' + table);
    const year = (0, business_date_js_1.businessYear)();
    const n = (await c.query(`SELECT COALESCE(MAX(substring(${column} from '[0-9]+$')::bigint), 0) + 1 AS n FROM ${table} WHERE ${column} ~ $1`, [`^${prefix}/${year}/[0-9]+$`])).rows[0].n;
    return `${prefix}/${year}/${String(n).padStart(width, '0')}`;
};
exports.nextNumber = nextNumber;
//# sourceMappingURL=penal-interest.js.map