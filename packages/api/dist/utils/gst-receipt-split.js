"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeReceiptGstSplit = computeReceiptGstSplit;
const gst_resolver_js_1 = require("./gst-resolver.js");
const gst_backward_derive_js_1 = require("./gst-backward-derive.js");
/**
 * Resolves cgst_amount/sgst_amount for a receipt row that's already been
 * inserted (receiptId must exist so it can exclude itself from running-total
 * queries against its own demand).
 *
 * - demandId present: derives from the linked demand's own already-resolved
 *   GST split -- full copy (first/sole receipt reaching full or overpay),
 *   exact remainder (receipt that completes a previously-partial demand),
 *   or proportional share (still partial after this receipt). Never
 *   re-resolves a rate -- the demand's stored split is the source of truth.
 * - demandId null (e.g. Step-G/booking-confirmation receipts with no
 *   installment link): resolves a fresh rate for the receipt's own
 *   project + booking date and backward-derives from the receipt amount.
 *   resolveRate() returns a FRACTION (0.005 for 0.5%) -- it is multiplied
 *   by 100 here before being passed to computeInclusiveGstSplit(), which
 *   expects PERCENTAGE POINTS (0.5 for 0.5%).
 */
async function computeReceiptGstSplit(db, receiptId, receiptAmount, demandId, projectId, bookingDate) {
    if (!demandId) {
        if (!projectId || !bookingDate)
            return { cgstAmount: 0, sgstAmount: 0 };
        const projectRow = await db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
        const projectName = projectRow.rows[0]?.name || projectId;
        const rate = await (0, gst_resolver_js_1.resolveRate)(db, projectId, projectName, 'BASIC', bookingDate);
        const split = (0, gst_backward_derive_js_1.computeInclusiveGstSplit)(receiptAmount, rate.cgstPct * 100, rate.sgstPct * 100);
        return { cgstAmount: split.cgstAmount, sgstAmount: split.sgstAmount };
    }
    const demandRes = await db.query(`SELECT amount_due_inr, cgst_amount, sgst_amount FROM demands WHERE id = $1`, [demandId]);
    const demand = demandRes.rows[0];
    if (!demand)
        return { cgstAmount: 0, sgstAmount: 0 };
    const demandCgst = parseFloat(demand.cgst_amount || 0);
    const demandSgst = parseFloat(demand.sgst_amount || 0);
    const amountDueBase = parseFloat(demand.amount_due_inr);
    const amountDueTotal = amountDueBase + demandCgst + demandSgst;
    const paidRes = await db.query(`SELECT COALESCE(SUM(amount_received_inr), 0) as total_paid
     FROM receipts WHERE demand_id = $1 AND status != 'cancelled' AND id != $2`, [demandId, receiptId]);
    const paidBefore = parseFloat(paidRes.rows[0].total_paid);
    const newTotal = paidBefore + receiptAmount;
    if (newTotal >= amountDueTotal) {
        if (paidBefore === 0) {
            // sole/first receipt reaching full (or overpay) -- straight copy
            return { cgstAmount: demandCgst, sgstAmount: demandSgst };
        }
        // completing a previously-partial demand -- exact remainder, not a
        // fresh proportional share, so the sum always ties to the demand's total
        const alreadyRes = await db.query(`SELECT COALESCE(SUM(cgst_amount), 0) as sum_cgst, COALESCE(SUM(sgst_amount), 0) as sum_sgst
       FROM receipts WHERE demand_id = $1 AND status != 'cancelled' AND id != $2`, [demandId, receiptId]);
        const sumCgstAlready = parseFloat(alreadyRes.rows[0].sum_cgst);
        const sumSgstAlready = parseFloat(alreadyRes.rows[0].sum_sgst);
        return {
            cgstAmount: Math.round((demandCgst - sumCgstAlready) * 100) / 100,
            sgstAmount: Math.round((demandSgst - sumSgstAlready) * 100) / 100,
        };
    }
    // still partial after this receipt -- proportional share
    if (amountDueBase === 0 || amountDueTotal === 0)
        return { cgstAmount: 0, sgstAmount: 0 };
    return {
        cgstAmount: Math.round((receiptAmount / amountDueTotal) * demandCgst * 100) / 100,
        sgstAmount: Math.round((receiptAmount / amountDueTotal) * demandSgst * 100) / 100,
    };
}
//# sourceMappingURL=gst-receipt-split.js.map