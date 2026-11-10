"use strict";
/**
 * Payment Waterfall Allocation
 *
 * Distributes advance/booking receipts (those with no demand_id and no
 * installment_index) across demands in installment_index ASC order, filling
 * each demand fully before moving to the next.
 *
 * Receipts that already carry a demand_id are counted directly against that
 * demand and do not enter the advance pool.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInterestRows = buildInterestRows;
exports.applyWaterfall = applyWaterfall;
exports.resolveBookingScope = resolveBookingScope;
exports.recomputeBookingAmount = recomputeBookingAmount;
exports.recomputeBookingPaymentTaxes = recomputeBookingPaymentTaxes;
exports.checkAndAutoRaiseInstallment1 = checkAndAutoRaiseInstallment1;
const gst_resolver_js_1 = require("./gst-resolver.js");
const gst_backward_derive_js_1 = require("./gst-backward-derive.js");
const business_date_js_1 = require("./business-date.js");
function buildInterestRows(receipts, demands, penalRate, options) {
    const sortedDemands = [...demands].sort((a, b) => a.installment_index - b.installment_index);
    const startDate = options?.interestStartDate ?? null;
    const graceDays = options?.gracePeriodDays ?? 0;
    const active = receipts.filter(r => !['cancelled', 'bounced'].includes(r.status));
    const sorted = [...active].sort((a, b) => {
        const ta = new Date(a.received_date || a.created_at || 0).getTime();
        const tb = new Date(b.received_date || b.created_at || 0).getTime();
        return ta - tb;
    });
    // Interest runs on the BASIC amount, the way the client's own file does it: a receipt counts without its CGST and SGST, a demand without its tax.
    // Money is matched to the oldest installment first, by date received, whatever installment the receipt was filed under
    // (a receipt entered while an earlier cheque was still pending was filed under the wrong installment and charged interest that was not due).
    const pool = [];
    for (const r of sorted) {
        const gross = parseFloat(String(r.amount_received_inr));
        const amt = Math.max(0, gross - (parseFloat(String(r.cgst_amount ?? 0)) || 0) - (parseFloat(String(r.sgst_amount ?? 0)) || 0));
        pool.push({ remaining: amt, received_date: r.received_date ? new Date(r.received_date) : null });
    }
    const rows = [];
    for (const demand of sortedDemands) {
        // The basic amount of the installment (plus the base of an add-on charge), without GST
        const dueAmt = parseFloat(String(demand.amount_due_inr || 0))
            + parseFloat(String(demand.addon_charge_amount || 0));
        const dueDate = demand.due_date ? new Date(demand.due_date) : null;
        let balance = dueAmt;
        let isFirst = true;
        let anyApplied = false;
        let lastEventDate = dueDate;
        const effectiveRate = (demand.interest_rate_percent != null && demand.interest_rate_percent > 0)
            ? Number(demand.interest_rate_percent)
            : penalRate;
        const applyCredit = (applied, rcvdDate) => {
            const balanceBeforePayment = balance;
            balance -= applied;
            let delayDays = 0;
            if (dueDate && lastEventDate && rcvdDate) {
                const diff = Math.floor((rcvdDate.getTime() - lastEventDate.getTime()) / 86400000);
                delayDays = Math.max(0, diff);
            }
            const delayAmt = Math.max(0, balanceBeforePayment);
            const afterStartDate = startDate ? (rcvdDate != null && rcvdDate >= startDate) : true;
            const intPeriod = Math.max(0, delayDays - graceDays);
            const intAmt = delayAmt > 0 && intPeriod > 0 && afterStartDate
                ? Math.round(delayAmt * effectiveRate / 100 / 365 * intPeriod * 100) / 100
                : 0;
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: applied,
                date_received: rcvdDate,
                delay_amount: intAmt > 0 ? Math.max(0, delayAmt) : Math.max(0, balance),
                delay_days: delayDays,
                grace_period: graceDays,
                interest_period: intPeriod,
                roi: effectiveRate,
                interest_amount: intAmt,
                is_first_receipt: isFirst,
            });
            isFirst = false;
            anyApplied = true;
            // A payment made before the due date does not start the clock: later delay is counted from the due date (same rule as the trailing row below)
            lastEventDate = rcvdDate && dueDate && rcvdDate < dueDate ? dueDate : rcvdDate;
        };
        // Oldest money first
        for (const entry of pool) {
            if (balance <= 0)
                break;
            if (entry.remaining <= 0)
                continue;
            const applied = Math.min(entry.remaining, balance);
            entry.remaining -= applied;
            applyCredit(applied, entry.received_date);
        }
        if (anyApplied && balance > 0) {
            const asOf = options?.asOfDate ?? null;
            let delayDays = 0;
            let intPeriod = 0;
            let intAmt = 0;
            if (dueDate) {
                const anchorDate = lastEventDate
                    ? new Date(Math.max(lastEventDate.getTime(), dueDate.getTime()))
                    : dueDate;
                delayDays = asOf
                    ? Math.max(0, Math.floor((asOf.getTime() - anchorDate.getTime()) / 86400000))
                    : 0;
                intPeriod = Math.max(0, delayDays - graceDays);
                intAmt = balance > 0 && intPeriod > 0
                    ? Math.round(balance * effectiveRate / 100 / 365 * intPeriod * 100) / 100
                    : 0;
            }
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: 0,
                date_received: null,
                delay_amount: balance,
                delay_days: delayDays,
                grace_period: graceDays,
                interest_period: intPeriod,
                roi: effectiveRate,
                interest_amount: intAmt,
                is_first_receipt: false,
            });
        }
        if (!anyApplied) {
            const asOf = options?.asOfDate ?? null;
            const delayDays = asOf && dueDate
                ? Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000))
                : 0;
            const intPeriod = Math.max(0, delayDays - graceDays);
            const intAmt = dueAmt > 0 && intPeriod > 0
                ? Math.round(dueAmt * effectiveRate / 100 / 365 * intPeriod * 100) / 100
                : 0;
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: 0,
                date_received: null,
                delay_amount: dueAmt,
                delay_days: delayDays,
                grace_period: graceDays,
                interest_period: intPeriod,
                roi: effectiveRate,
                interest_amount: intAmt,
                is_first_receipt: true,
            });
        }
    }
    return rows;
}
function applyWaterfall(receipts, demands) {
    // Eligible money only (Q13): cleared receipts that are not ADV copies, and that name a demand or an instalment. A receipt with neither is
    // customer credit and is never spread over demands here; it reaches a demand only through an explicit allocation.
    receipts = receipts.filter((r) => r.status === 'cleared' && r.is_advance !== true && (!!r.demand_id || (r.installment_index !== null && r.installment_index !== undefined)));
    const sorted = [...demands].sort((a, b) => a.installment_index - b.installment_index);
    // Linked receipts → count directly against their demand
    const linkedMap = {};
    for (const r of receipts) {
        if (r.demand_id && r.status !== 'cancelled') {
            linkedMap[r.demand_id] = (linkedMap[r.demand_id] || 0) + Number(r.amount_received_inr);
        }
    }
    // Index-targeted orphans: demand_id=NULL but installment_index is set
    // These were recorded before the demand existed; credit them by matching index
    const indexOrphanMap = {};
    for (const r of receipts) {
        if (!r.demand_id && r.installment_index !== null && r.status !== 'cancelled') {
            const idx = Number(r.installment_index);
            indexOrphanMap[idx] = (indexOrphanMap[idx] || 0) + Number(r.amount_received_inr);
        }
    }
    // Advance pool: receipts with no demand_id AND no installment_index
    let pool = receipts
        .filter(r => !r.demand_id && r.installment_index === null && r.status !== 'cancelled')
        .reduce((s, r) => s + Number(r.amount_received_inr), 0);
    const results = [];
    for (const d of sorted) {
        // Addon charges included so waterfall
        // fills installment to its real capacity
        // (BSP+OC+GST+addon+addonGST) before
        // overflowing to the next installment.
        // Non-addon bookings unaffected:
        // addon columns default 0 (mig 081).
        const totalDue = Number(d.amount_due_inr)
            + Number(d.cgst_amount)
            + Number(d.sgst_amount)
            + Number(d.addon_charge_amount || 0)
            + Number(d.addon_cgst_amount || 0)
            + Number(d.addon_sgst_amount || 0);
        // Merge demand-linked + index-orphan amounts for this installment
        const linked = (linkedMap[d.id] || 0) + (indexOrphanMap[d.installment_index] || 0);
        const gap = Math.max(0, totalDue - linked);
        const fromPool = Math.min(pool, gap);
        pool -= fromPool;
        const rawPaid = linked + fromPool;
        const paid = Math.min(rawPaid, totalDue);
        results.push({
            installment_index: d.installment_index,
            demand_id: d.id,
            paid,
            fully_covered: totalDue > 0 && rawPaid >= totalDue,
        });
    }
    return results;
}
// ── booking_amount auto-recompute ───────────────────────────────────────────
/**
 * Resolves the (unit_id, project_id) a receipt's payments apply to, so a
 * booking_amount recompute can be scoped to the single correct booking
 * instead of all of a consumer's bookings. booking_records.payment_plan_id
 * is never populated at booking creation, so this goes through payment_plans
 * instead of joining on it directly.
 */
async function resolveBookingScope(client, receipt) {
    let paymentPlanId = receipt.payment_plan_id;
    if (!paymentPlanId && receipt.demand_id) {
        const demandPlan = await client.query(`SELECT payment_plan_id FROM demands WHERE id = $1`, [receipt.demand_id]);
        paymentPlanId = demandPlan.rows[0]?.payment_plan_id;
    }
    if (!paymentPlanId)
        return null;
    const plan = await client.query(`SELECT unit_id, project_id FROM payment_plans WHERE id = $1`, [paymentPlanId]);
    if (plan.rows.length === 0)
        return null;
    return { unitId: plan.rows[0].unit_id, projectId: plan.rows[0].project_id, paymentPlanId };
}
/**
 * booking_amount = amount of the earliest CLEARED receipt (by created_at) tied
 * to this specific booking's payment plan (directly via payment_plan_id, or
 * indirectly via a demand belonging to that plan). Scoping by payment_plan_id
 * (not just consumer_id) prevents a receipt from an unrelated booking of the
 * same consumer from being picked up. Zero cleared receipts → booking_amount = 0.
 * Auto-recompute always wins over any manual document-writeback edit.
 */
async function recomputeBookingAmount(client, consumerId, unitId, projectId, paymentPlanId) {
    // Q13 money basis: a legacy ADV row never counts, and an approved return is taken off (dynamic import: money-basis imports this file)
    const { returnedSql } = await Promise.resolve().then(() => __importStar(require('./money-basis.js')));
    const result = await client.query(`SELECT amount_received_inr - ${returnedSql('receipts')} AS amount_received_inr FROM receipts
     WHERE consumer_id = $1 AND status = 'cleared' AND is_advance IS NOT TRUE
       AND (payment_plan_id = $2
            OR demand_id IN (SELECT id FROM demands WHERE payment_plan_id = $2))
     ORDER BY created_at ASC LIMIT 1`, [consumerId, paymentPlanId]);
    const newAmount = result.rows.length > 0 ? result.rows[0].amount_received_inr : 0;
    await client.query(`UPDATE booking_records
     SET booking_amount = $1
     WHERE consumer_id = $2 AND unit_id = $3
       AND project_id = $4 AND status != 'cancelled'`, [newAmount, consumerId, unitId, projectId]);
}
/**
 * Keeps booking_payment_taxes.cgst_amount/sgst_amount in sync with
 * booking_records.booking_amount after recomputeBookingAmount() runs (receipt
 * cancel / bounce paths). Without this, a receipt cancel/bounce silently
 * desyncs the stored tax amounts from the now-changed booking_amount --
 * the amounts stay frozen at whatever they were computed from at the last
 * PATCH /:id, permanently mismatched from the new booking_amount.
 *
 * No-op if the booking has no booking_payment_taxes row yet (never
 * confirmed via PATCH /:id).
 */
async function recomputeBookingPaymentTaxes(client, consumerId, unitId, projectId) {
    const bookingRes = await client.query(`SELECT id, booking_amount, booking_date
     FROM booking_records
     WHERE consumer_id = $1 AND unit_id = $2 AND project_id = $3 AND status != 'cancelled'
     LIMIT 1`, [consumerId, unitId, projectId]);
    if (bookingRes.rows.length === 0)
        return;
    const booking = bookingRes.rows[0];
    const bptRes = await client.query(`SELECT id FROM booking_payment_taxes WHERE booking_record_id = $1`, [booking.id]);
    if (bptRes.rows.length === 0)
        return;
    const bookingDateForGst = booking.booking_date
        ? new Date(booking.booking_date).toISOString().split('T')[0]
        : (0, business_date_js_1.businessToday)();
    const projectRow = await client.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    const projectName = projectRow.rows[0]?.name || projectId;
    const consumerRow = await client.query('SELECT nationality FROM consumers WHERE id = $1', [consumerId]);
    const isNri = ['nri', 'NRI', 'oci', 'OCI', 'pio', 'PIO'].includes(consumerRow.rows[0]?.nationality);
    const gstRate = isNri
        ? { cgstPct: 0, sgstPct: 0 }
        : await (0, gst_resolver_js_1.resolveRate)(client, projectId, projectName, 'BASIC', bookingDateForGst);
    const gstSplit = (0, gst_backward_derive_js_1.computeInclusiveGstSplit)(parseFloat(booking.booking_amount), gstRate.cgstPct * 100, gstRate.sgstPct * 100);
    await client.query(`UPDATE booking_payment_taxes
     SET cgst_amount = $1, sgst_amount = $2
     WHERE booking_record_id = $3`, [gstSplit.cgstAmount, gstSplit.sgstAmount, booking.id]);
}
// ── installment-1 auto-raise on first receipt ───────────────────────────────
/**
 * Fires when a newly-created receipt lands on installment_index=1. If no
 * OTHER receipt already holds a valid (non-bounced/cancelled) claim on
 * installment_index=1 for this plan, this receipt is the first valid one --
 * raise the installment 1 demand using this receipt's own received_date,
 * replicating PATCH /demands/activate's effect (payments.ts) exactly,
 * including its audit_logs entry and orphan-receipt-linking side effect.
 * No-op if installment 1's demand already has a due_date (either raised
 * manually by staff before this receipt existed, or already auto-raised --
 * both are treated as "already has its date", never overwritten), or if a
 * different valid idx1 receipt already exists (this receipt is a duplicate/
 * extra, not the first). Guarding on due_date rather than status also
 * covers the case where this same receipt fully covers the demand and the
 * pre-existing auto-match logic (payments.ts POST /receipts) has already
 * flipped it straight to 'paid' -- due_date still gets set in that case,
 * without downgrading status back to 'demanded'.
 */
async function checkAndAutoRaiseInstallment1(client, paymentPlanId, receiptId, receivedDate, userId) {
    const otherValid = await client.query(`SELECT id FROM receipts
     WHERE payment_plan_id = $1 AND installment_index = 1
       AND id != $2 AND status NOT IN ('bounced', 'cancelled')
     LIMIT 1`, [paymentPlanId, receiptId]);
    if (otherValid.rows.length > 0)
        return;
    const demandRes = await client.query(`SELECT id, consumer_id, status, due_date FROM demands
     WHERE payment_plan_id = $1 AND installment_index = 1 AND demand_type IN ('installment', 'booking')
     ORDER BY created_at ASC LIMIT 1`, [paymentPlanId]);
    if (demandRes.rows.length === 0)
        return;
    const demand = demandRes.rows[0];
    if (demand.due_date != null)
        return;
    await client.query(`UPDATE demands
     SET due_date = $1, generated_at = NOW(), raised_at = NOW(),
         status = CASE WHEN status = 'pending' THEN 'demanded' ELSE status END,
         delivery_status = CASE WHEN status = 'pending' THEN 'queued' ELSE delivery_status END
     WHERE id = $2`, [receivedDate, demand.id]);
    await client.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
     VALUES ($1, 'DEMAND_RAISE', 'demand', $2, $3)`, [userId, demand.id, JSON.stringify({
            installment_date: receivedDate, due_date: receivedDate,
            consumer_id: demand.consumer_id, installment_index: 1,
            auto_raised: true, trigger_receipt_id: receiptId,
        })]);
    // Directly link the triggering receipt itself -- Step-G receipts always
    // carry installment_index = NULL, so the installment_index=1 query below
    // never matches them on its own.
    await client.query(`UPDATE receipts SET demand_id = $1, updated_at = NOW()
     WHERE id = $2 AND demand_id IS NULL`, [demand.id, receiptId]);
    const retroResult = await client.query(`UPDATE receipts
     SET demand_id = $1, updated_at = NOW()
     WHERE consumer_id = $2 AND installment_index = 1
       AND demand_id IS NULL AND status != 'cancelled'
     RETURNING receipt_number, amount_received_inr`, [demand.id, demand.consumer_id]);
    if (retroResult.rows.length > 0) {
        const totalLinked = retroResult.rows.reduce((s, r) => s + parseFloat(r.amount_received_inr), 0);
        try {
            await client.query(`INSERT INTO financial_audit_logs
           (consumer_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, $3, $4, $5)`, [
                demand.consumer_id,
                'receipts_retroactively_linked',
                JSON.stringify({ demand_id: null }),
                JSON.stringify({ demand_id: demand.id }),
                `${retroResult.rows.length} receipt(s) totalling ₹${totalLinked} retroactively linked to demand ${demand.id} (installment_index=1, auto-raise)`,
            ]);
        }
        catch (auditErr) {
            console.error('Retro-link audit log failed (non-fatal):', auditErr.message);
        }
    }
    // The raise never marks the demand paid (D2, Q13): its status follows cleared money only
    const { recomputePlan } = await Promise.resolve().then(() => __importStar(require('./money-basis.js')));
    await recomputePlan(client, paymentPlanId, userId);
}
//# sourceMappingURL=payment-waterfall.js.map