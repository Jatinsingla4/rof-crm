"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.headGst = exports.billableDemands = exports.isCancelledBooking = void 0;
exports.gstReconciliation = gstReconciliation;
// QA-032: one rule for which demands feed the Applicant File. A cancelled demand is never billed, and a cancelled booking bills nothing,
// so neither may feed the header GST, the schedule rows or the payable total. Without live demands the agreement basis is used everywhere.
const isCancelledBooking = (b) => String(b?.status || '').toLowerCase() === 'cancelled';
exports.isCancelledBooking = isCancelledBooking;
const billableDemands = (b, demands) => (0, exports.isCancelledBooking)(b) ? [] : (demands || []).filter((d) => String(d.status || '').toLowerCase() !== 'cancelled');
exports.billableDemands = billableDemands;
// Reconciliation of one booking's GST on its three bases. Returns the variance, never hides it; rounding is only up to 1 rupee per row.
function gstReconciliation(agreementGst, scheduleGst, rows) {
    const variance = scheduleGst - agreementGst, tolerance = Math.max(1, rows);
    return { variance, tolerance, status: Math.abs(variance) <= tolerance ? 'rounding' : 'exception' };
}
// QA-001: GST on basic and PLC, each at its own rate (percent), rounded per head: the one rule the breakup, the header and the schedule share.
const headGst = (basic, plc, basicPct, plcPct) => Math.round(basic * basicPct / 100) + Math.round(plc * plcPct / 100);
exports.headGst = headGst;
//# sourceMappingURL=agreement-reconcile.js.map