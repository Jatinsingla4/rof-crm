"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeReceiptGstSplit = computeReceiptGstSplit;
const gst_resolver_js_1 = require("./gst-resolver.js");
const gst_backward_derive_js_1 = require("./gst-backward-derive.js");
/**
 * Resolves cgst_amount/sgst_amount for a receipt, always independently of
 * any linked demand. REPLACES the demand-derived model from commit b361e4d
 * (full-copy on completion / exact-remainder on completion of a partial /
 * proportional-share while still partial) -- that model made a receipt's
 * GST depend on which demand it happened to be linked to and its payment
 * completeness, which is no longer the rule.
 *
 * The new rule: unconditional, receipt-only, inclusive backward-derivation.
 * Every receipt -- pending, cleared, bounced, or cancelled -- gets its GST
 * computed purely from its own amount, project, and received_date. Demand
 * status/linkage plays no part in this calculation.
 *
 * resolveRate() returns a FRACTION (0.005 for 0.5%) -- it is multiplied by
 * 100 here before being passed to computeInclusiveGstSplit(), which expects
 * PERCENTAGE POINTS (0.5 for 0.5%).
 */
async function computeReceiptGstSplit(db, receiptAmount, projectId, receivedDate) {
    if (!projectId || !receivedDate)
        return { cgstAmount: 0, sgstAmount: 0 };
    const projectRow = await db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
    const projectName = projectRow.rows[0]?.name || projectId;
    const rate = await (0, gst_resolver_js_1.resolveRate)(db, projectId, projectName, 'BASIC', receivedDate);
    return (0, gst_backward_derive_js_1.computeInclusiveGstSplit)(receiptAmount, rate.cgstPct * 100, rate.sgstPct * 100);
}
//# sourceMappingURL=gst-receipt-split.js.map