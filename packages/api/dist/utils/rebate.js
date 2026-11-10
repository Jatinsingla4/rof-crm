"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repriceBooking = exports.planTotal = exports.checkRebate = exports.basicPriceOf = exports.rebateMethodOf = exports.REBATE_STATUS = void 0;
/**
 * Company rebate on a booking (QA-007, owner decisions Q10 and Q11).
 *  - Three boxes on the booking form: fixed Rs, Rs per sq. ft., percent. Exactly one may be filled; all zero means no rebate.
 *  - Rs = the amount; per sq. ft. = rate x the unit's carpet area; percent = basic price x percent / 100.
 *  - It starts as "pending" and changes no price until a different authorised user approves it. The rupee amount that is applied
 *    is booking_records.approved_rebate_amount (0 unless the status is "approved"); every price calculation subtracts that column.
 *  - Any change to the rebate, or to what it is calculated from, after approval sends it back to "pending".
 */
const input_js_1 = require("./input.js");
const money_basis_js_1 = require("./money-basis.js");
exports.REBATE_STATUS = ['none', 'pending', 'approved', 'rejected', 'legacy'];
const r2 = (n) => Math.round(n * 100) / 100;
// Which of the three boxes is filled. More than one is refused; none means no rebate.
const rebateMethodOf = (rs, sqft, pct) => {
    const f = [['fixed', Number(rs) || 0], ['per_sqft', Number(sqft) || 0], ['percent', Number(pct) || 0]];
    for (const [, v] of f)
        if (v < 0)
            throw (0, input_js_1.bad)('A rebate cannot be negative');
    const used = f.filter(([, v]) => v > 0);
    if (used.length > 1)
        throw (0, input_js_1.bad)('Only one rebate method can be used at a time: fixed amount, rate per sq. ft. or percentage. Clear the other boxes.');
    return used.length ? { method: used[0][0], value: used[0][1] } : { method: 'none', value: 0 };
};
exports.rebateMethodOf = rebateMethodOf;
// The basic price a rebate is measured against: the same figure the booking checks its discount against.
const basicPriceOf = (rate, unit) => {
    const r = Number(rate) || 0, c = Number(unit.carpet_area_sqft) || 0;
    return r > 0 && c > 0 ? Math.round(r * c) : Number(unit.base_price_inr) || 0;
};
exports.basicPriceOf = basicPriceOf;
// The rupee rebate for the chosen method, refused when it is more than the basic price (or, with the inaugural discount, would take the price below zero).
const checkRebate = (rs, sqft, pct, basic, unit, inaugural = 0) => {
    const { method, value } = (0, exports.rebateMethodOf)(rs, sqft, pct);
    let amount = 0;
    if (method === 'fixed')
        amount = r2(value);
    if (method === 'per_sqft') {
        const area = Number(unit.carpet_area_sqft) || 0;
        if (area <= 0)
            throw (0, input_js_1.bad)('This unit has no carpet area, so a rebate per sq. ft. cannot be calculated');
        amount = r2(value * area);
    }
    if (method === 'percent')
        amount = r2(basic * value / 100);
    if (method !== 'none') {
        if (basic <= 0)
            throw (0, input_js_1.bad)('This unit has no basic price, so a rebate cannot be checked');
        if (amount > basic)
            throw (0, input_js_1.bad)(`The rebate (Rs ${amount.toLocaleString('en-IN')}) is more than the basic price (Rs ${basic.toLocaleString('en-IN')})`);
        if (amount + (Number(inaugural) || 0) > basic)
            throw (0, input_js_1.bad)('The rebate and the inaugural discount together are more than the basic price');
    }
    return { method, value, amount };
};
exports.checkRebate = checkRebate;
// Total price of a booking, the same sum the plan is made from (Math.round is applied by the caller where the plan stores it).
const planTotal = (b, unit) => (0, exports.basicPriceOf)(b.basic_rate_inr_sqft, unit) + (Number(b.plc_amount) || 0) + (Number(b.other_charge_amount) || 0)
    - (Number(b.company_inaugural_disc) || 0) - (Number(b.approved_rebate_amount) || 0) + (Number(b.balcony_charge_amount) || 0);
exports.planTotal = planTotal;
/**
 * Re-price the plan of a booking that is already complete after its approved rebate changed (approved, or sent back to pending).
 * Every confirmed booking has its first demand raised automatically and carries the booking payment, so those demands must be re-priced
 * too. Only the demand AMOUNT changes: GST is left as it is (the GST basis is a separate open decision, Q12). The change is refused, and
 * nothing is changed, if a demand is already paid, if its letter was sent to the customer, or if the money received on it would be more
 * than its new amount.
 */
const repriceBooking = async (c, b, userId = null) => {
    const plan = (await c.query(`SELECT pp.id FROM payment_plans pp WHERE pp.consumer_id = $1 AND pp.unit_id = $2
        AND pp.allocation_id IN (SELECT id FROM allocations WHERE consumer_id = $1 AND unit_id = $2 AND status NOT IN ('cancelled','transferred'))
      ORDER BY pp.created_at DESC LIMIT 1 FOR UPDATE`, [b.consumer_id, b.unit_id])).rows[0];
    if (!plan)
        return; // no plan yet: the plan will be made from the approved amount when the booking is confirmed
    const ds = (await c.query(`SELECT d.id, d.installment_index, d.status, d.sent_at, d.delivery_status,
            d.cgst_amount, d.sgst_amount, d.addon_charge_amount, d.addon_cgst_amount, d.addon_sgst_amount,
            COALESCE((SELECT SUM(r.amount_received_inr - ${(0, money_basis_js_1.returnedSql)('r')}) FROM receipts r WHERE r.demand_id = d.id AND r.status = 'cleared' AND NOT COALESCE(r.is_advance, false)), 0)::numeric AS received
       FROM demands d WHERE d.payment_plan_id = $1 AND d.status <> 'cancelled' FOR UPDATE OF d`, [plan.id])).rows;
    const pct = (await c.query(`SELECT 1 FROM consumer_addon_charges cac JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
      WHERE cac.consumer_id = $1 AND cac.project_id = $2 AND cac.status <> 'cancelled' AND acm.rate_type = 'percent' AND acm.percent_basis = 'after_discount' LIMIT 1`, [b.consumer_id, b.project_id])).rows[0];
    if (pct)
        throw (0, input_js_1.bad)('This booking has an add-on charge worked out "after discount". Change that charge first, then approve or withdraw the rebate.', 409);
    const unit = (await c.query(`SELECT carpet_area_sqft, base_price_inr FROM units WHERE id = $1`, [b.unit_id])).rows[0];
    const total = Math.round((0, exports.planTotal)(b, unit));
    const tmpl = (await c.query(`SELECT installment_index, percentage, flat_amount_inr FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 ORDER BY installment_index`, [b.project_id, b.selected_plan_name])).rows;
    // The same split as the booking confirmation: a plan of percentages is cut on the running share, so the instalments add up to the plan total exactly
    const runShares = [];
    {
        let run = 0;
        for (const tt of tmpl)
            runShares.push(Math.round((run += parseFloat(tt.percentage || 0) / 100) * 1e6) / 1e6);
    }
    const byShare = tmpl.length > 0 && tmpl.every((tt) => !tt.flat_amount_inr) && Math.abs(runShares[runShares.length - 1] - 1) < 1e-6;
    const moves = [];
    for (const [ti, t] of tmpl.entries()) {
        if (t.flat_amount_inr)
            continue; // a fixed-amount row does not move with the price
        const d = ds.find((x) => x.installment_index === t.installment_index);
        if (!d)
            continue;
        const amount = byShare ? Math.round(total * runShares[ti]) - Math.round(total * (ti ? runShares[ti - 1] : 0)) : Math.round(total * (parseFloat(t.percentage || 0) / 100));
        // the money received on a demand includes its GST: it is compared with the new demand total on the same basis (amount, GST and add-ons)
        const gross = amount + Number(d.cgst_amount || 0) + Number(d.sgst_amount || 0) + Number(d.addon_charge_amount || 0) + Number(d.addon_cgst_amount || 0) + Number(d.addon_sgst_amount || 0);
        const why = !['pending', 'demanded', 'raised', 'partial'].includes(d.status) ? 'is already paid or closed'
            : (d.sent_at || ['sent', 'delivered', 'read'].includes(d.delivery_status)) ? 'was already sent to the customer'
                : Number(d.received) > gross + 0.005 ? 'has more money received on it than its new amount' : '';
        if (why)
            throw (0, input_js_1.bad)(`The rebate cannot be applied or withdrawn now: demand ${d.installment_index} of this booking ${why}. Unraise or settle it first.`, 409);
        moves.push({ id: d.id, amount });
    }
    await c.query(`UPDATE payment_plans SET total_amount_inr = $2, updated_at = NOW() WHERE id = $1`, [plan.id, total]);
    for (const m of moves)
        await c.query(`UPDATE demands SET amount_due_inr = $2, updated_at = NOW() WHERE id = $1`, [m.id, m.amount]);
    // the statuses follow the new amounts and the money already received (D1, Q13); dates are never touched
    await (0, money_basis_js_1.recomputePlan)(c, plan.id, userId);
};
exports.repriceBooking = repriceBooking;
//# sourceMappingURL=rebate.js.map