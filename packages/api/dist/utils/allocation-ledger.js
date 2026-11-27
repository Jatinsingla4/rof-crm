"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAllocationLedger = buildAllocationLedger;
exports.loadLedgerInput = loadLedgerInput;
exports.ledgerReconciliation = ledgerReconciliation;
// The allocation LEDGER (QA-008, 014, 033, 037, 039): for one payment plan, where every rupee of every receipt went, as a list a person can read, and the checks that show the books agree.
// It is DERIVED from the facts (receipts, approved returns, approved credit allocations, demands) by the same money rules the status uses, so it is reproducible and cannot drift from them; it
// stores nothing and changes nothing. The persisted table receipt_allocation (flag receipt_allocation_v1, still off) is a separate, later step.
//
// Entry kinds:
//   applied            cleared money that names a demand or an instalment, put against that demand, with its principal / CGST / SGST split (the demand's own lines in proportion)
//   returned           an approved bank return taken off a receipt (it reduces what the receipt can pay, credit first)
//   unapplied          the part of a cleared receipt that settled no instalment, with the reason (excess over the instalment it names, it names none, or its instalment is not open)
//   credit_allocation  approved customer credit allocated to a demand by a checker
//   not_money          receipts that are not money yet or any more: pending, authorized, deposited, on hold, bounced, cancelled, and legacy advance copies
// What happens to the unapplied part (allocate, refund or hold) is a business decision (BR-09): the ledger shows it, it does not spread it.
const receipt_allocation_js_1 = require("./receipt-allocation.js");
const money_basis_js_1 = require("./money-basis.js");
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const num = (v) => (v == null || v === '' ? 0 : Number(v));
function buildAllocationLedger(input) {
    const live = input.demands.filter((d) => d.status !== 'cancelled');
    const byId = new Map(live.map((d) => [String(d.id), d]));
    const byIndex = new Map(live.map((d) => [Number(d.installment_index), String(d.id)]));
    const entries = [];
    const money = input.receipts.filter((r) => r.status === 'cleared' && r.is_advance !== true);
    const eligible = new Map(money.map((r) => [r.id, r2(Math.max(0, r.gross - r.returned))]));
    for (const r of input.receipts) {
        if (!(r.status === 'cleared' && r.is_advance !== true))
            entries.push({ kind: 'not_money', receipt_id: r.id, receipt_number: r.receipt_number, status: r.is_advance ? 'advance copy (legacy)' : r.status, amount: r2(r.gross) });
        else if (r.returned > 0.004)
            entries.push({ kind: 'returned', receipt_id: r.id, receipt_number: r.receipt_number, amount: r2(r.returned) });
    }
    // applied: the same function the persisted allocation uses (money that names a demand or an instalment, capped at the demand)
    const rows = (0, receipt_allocation_js_1.allocateReceipts)(money.filter((r) => (eligible.get(r.id) || 0) > 0.004).map((r) => ({ id: r.id, amount: eligible.get(r.id), demand_id: r.demand_id || null, installment_index: r.installment_index ?? null })), live);
    const applied = new Map();
    for (const a of rows) {
        const d = byId.get(a.demand_id);
        applied.set(a.receipt_id, r2((applied.get(a.receipt_id) || 0) + a.amount));
        entries.push({ kind: 'applied', receipt_id: a.receipt_id, demand_id: a.demand_id, installment_index: d?.installment_index, amount: a.amount, ...(0, receipt_allocation_js_1.splitLines)(a.amount, d) });
    }
    // unapplied, with the reason
    const perReceipt = [];
    for (const r of money) {
        const e = eligible.get(r.id) || 0, a = applied.get(r.id) || 0, u = r2(e - a);
        const names = r.demand_id ? String(r.demand_id) : r.installment_index != null ? byIndex.get(Number(r.installment_index)) : undefined;
        const reason = !(r.demand_id || r.installment_index != null) ? 'names_no_instalment' : names && byId.has(names) ? 'excess_over_instalment' : 'instalment_not_open';
        if (u > 0.004)
            entries.push({ kind: 'unapplied', receipt_id: r.id, receipt_number: r.receipt_number, amount: u, reason });
        perReceipt.push({ receipt_id: r.id, receipt_number: r.receipt_number, approved: r.approval_status === 'approved', gross: r2(r.gross), returned: r2(r.returned), eligible: e, applied: a, unapplied: u > 0.004 ? u : 0 });
    }
    // credit allocations
    const credit = new Map();
    for (const c of input.credits)
        if (c.status === 'approved') {
            credit.set(String(c.demand_id), r2((credit.get(String(c.demand_id)) || 0) + c.amount));
            entries.push({ kind: 'credit_allocation', demand_id: c.demand_id, installment_index: byId.get(String(c.demand_id))?.installment_index, amount: r2(c.amount) });
        }
    // per demand, as the status engine would count it (never above the demand total)
    const fromReceipts = new Map();
    for (const a of rows)
        fromReceipts.set(a.demand_id, r2((fromReceipts.get(a.demand_id) || 0) + a.amount));
    const perDemand = live.map((d) => {
        const total = r2((0, money_basis_js_1.demandTotal)(d)), fr = fromReceipts.get(String(d.id)) || 0, fc = credit.get(String(d.id)) || 0, paid = r2(Math.min(total, fr + fc));
        return { demand_id: d.id, installment_index: d.installment_index, raised: !!d.raised, total, from_receipts: fr, from_credit: fc, paid, balance: r2(Math.max(0, total - paid)) };
    });
    const unappliedTotal = r2(perReceipt.reduce((s, x) => s + x.unapplied, 0)), allocatedTotal = r2([...credit.values()].reduce((s, v) => s + v, 0));
    const appliedOnUnraised = r2(perDemand.filter((x) => !x.raised).reduce((s, x) => s + x.from_receipts, 0));
    const eligibleTotal = r2(perReceipt.reduce((s, x) => s + x.eligible, 0)), appliedTotal = r2(perReceipt.reduce((s, x) => s + x.applied, 0));
    // checks that do not depend on how the ledger was built
    const checks = [];
    const conserve = perReceipt.filter((x) => Math.abs(x.eligible - x.applied - x.unapplied) > 0.011);
    checks.push({ key: 'every_receipt_conserved', ok: !conserve.length, detail: conserve.map((x) => x.receipt_id) });
    const over = perDemand.filter((x) => x.from_receipts + x.from_credit > x.total + 0.011);
    checks.push({ key: 'no_demand_over_paid', ok: !over.length, detail: over.map((x) => ({ demand_id: x.demand_id, total: x.total, applied: r2(x.from_receipts + x.from_credit) })) });
    checks.push({ key: 'credit_allocated_within_unapplied', ok: allocatedTotal <= unappliedTotal + 0.011, detail: { unapplied: unappliedTotal, allocated: allocatedTotal } });
    if (input.paidByDemandCheck) {
        const diff = perDemand.filter((x) => Math.abs(x.paid - (input.paidByDemandCheck.get(String(x.demand_id)) || 0)) > 0.011).map((x) => ({ demand_id: x.demand_id, ledger_paid: x.paid, status_engine_paid: r2(input.paidByDemandCheck.get(String(x.demand_id)) || 0) }));
        checks.push({ key: 'agrees_with_the_status_engine', ok: !diff.length, detail: diff });
    }
    return {
        entries, per_receipt: perReceipt, per_demand: perDemand,
        totals: { eligible: eligibleTotal, applied: appliedTotal, applied_on_unraised_instalments: appliedOnUnraised, unapplied: unappliedTotal, credit_allocated: allocatedTotal, credit_available: r2(unappliedTotal - allocatedTotal),
            returned: r2(perReceipt.reduce((s, x) => s + x.returned, 0)), eligible_but_unapproved: r2(perReceipt.filter((x) => !x.approved).reduce((s, x) => s + x.eligible, 0)) },
        checks, ok: checks.every((c) => c.ok),
    };
}
// The facts of one plan, read only
async function loadLedgerInput(db, planId) {
    const receipts = (await db.query(`SELECT r.id, r.receipt_number, r.status, r.approval_status, r.is_advance, r.demand_id, r.installment_index, r.amount_received_inr::float8 AS gross,
            (SELECT COALESCE(SUM(x.amount), 0)::float8 FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved') AS returned,
            COALESCE(r.clearing_date, r.received_date)::text AS at
       FROM receipts r WHERE r.payment_plan_id = $1 ORDER BY COALESCE(r.clearing_date, r.received_date, r.created_at), r.id`, [planId])).rows;
    const demands = (await db.query(`SELECT id, installment_index, status, (raised_at IS NOT NULL) AS raised, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount, demand_type
       FROM demands WHERE payment_plan_id = $1`, [planId])).rows;
    const credits = (await db.query(`SELECT id, demand_id, amount::float8 AS amount, status FROM credit_allocations WHERE payment_plan_id = $1`, [planId])).rows;
    return { receipts, demands, credits };
}
// Read-only reconciliation of every plan that has a receipt (optionally one project): the ledger built for each, and the checks above. Run it before the allocation flag is considered.
// Nothing is changed. A violation is a plan finance must look at; an unapplied amount is not a violation (what to do with it is BR-09).
async function ledgerReconciliation(db, projectId = null) {
    var _a, _b;
    const plans = (await db.query(`SELECT pp.id, pp.consumer_id FROM payment_plans pp WHERE EXISTS (SELECT 1 FROM receipts r WHERE r.payment_plan_id = pp.id) AND ($1::uuid IS NULL OR pp.project_id = $1::uuid) ORDER BY pp.created_at`, [projectId])).rows;
    const violations = [];
    const sum = { eligible: 0, applied: 0, applied_on_unraised_instalments: 0, unapplied: 0, credit_allocated: 0, returned: 0, eligible_but_unapproved: 0 };
    const unappliedBy = {}, notMoney = {};
    let plansWithViolations = 0, receiptsSeen = 0;
    for (const p of plans) {
        const input = await loadLedgerInput(db, p.id);
        const ds = (await db.query(`SELECT ${money_basis_js_1.DEMAND_COLS} FROM demands WHERE payment_plan_id = $1`, [p.id])).rows;
        const paid = (0, money_basis_js_1.paidByDemand)(await (0, money_basis_js_1.loadEligible)(db, p.id), await (0, money_basis_js_1.loadAllocations)(db, p.id), ds);
        const l = buildAllocationLedger({ ...input, paidByDemandCheck: paid });
        receiptsSeen += input.receipts.length;
        for (const k of Object.keys(sum))
            sum[k] = r2(sum[k] + (l.totals[k] || 0));
        for (const e of l.entries) {
            if (e.kind === 'unapplied') {
                const u = (unappliedBy[_a = e.reason] || (unappliedBy[_a] = { receipts: 0, amount: 0 }));
                u.receipts++;
                u.amount = r2(u.amount + e.amount);
            }
            if (e.kind === 'not_money') {
                const u = (notMoney[_b = e.status] || (notMoney[_b] = { receipts: 0, amount: 0 }));
                u.receipts++;
                u.amount = r2(u.amount + e.amount);
            }
        }
        const bad = l.checks.filter((c) => !c.ok);
        if (bad.length) {
            plansWithViolations++;
            for (const c of bad)
                if (violations.length < 50)
                    violations.push({ payment_plan_id: p.id, consumer_id: p.consumer_id, check: c.key, detail: c.detail });
        }
    }
    return { plans_checked: plans.length, receipts_seen: receiptsSeen, plans_with_violations: plansWithViolations, violations, totals: sum, unapplied_by_reason: unappliedBy, not_money_by_status: notMoney };
}
//# sourceMappingURL=allocation-ledger.js.map