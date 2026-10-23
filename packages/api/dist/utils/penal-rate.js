"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPenalRate = exports.penalRateFrom = exports.DEFAULT_PENAL_RATE = void 0;
// The yearly penal interest rate for late payments: one setting (global_settings.penal_interest_rate_percent), one default, read here only.
exports.DEFAULT_PENAL_RATE = 15;
const penalRateFrom = (settings) => {
    const n = parseFloat(String(settings?.['penal_interest_rate_percent'] ?? ''));
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : exports.DEFAULT_PENAL_RATE;
};
exports.penalRateFrom = penalRateFrom;
const getPenalRate = async (q) => {
    const r = await q.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent' LIMIT 1`);
    return (0, exports.penalRateFrom)({ penal_interest_rate_percent: r.rows[0]?.value });
};
exports.getPenalRate = getPenalRate;
//# sourceMappingURL=penal-rate.js.map