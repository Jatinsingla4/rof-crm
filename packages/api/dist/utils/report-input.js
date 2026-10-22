"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pageOf = exports.pick = exports.like = exports.checkParams = exports.checkQuery = void 0;
const input_js_1 = require("./input.js");
const UUID_KEYS = new Set([
    'projectId', 'companyId', 'towerId', 'consumerId', 'brokerId', 'employeeId', 'salesEmployeeId', 'teamId',
    'companyBankAccountId', 'paymentPlanId',
]);
const DATE_KEYS = new Set([
    'dateFrom', 'dateTo', 'fromDate', 'toDate', 'dueDate', 'asOnDate', 'bookingFromDate', 'bookingToDate',
]);
// name -> [min, max]
const INT_KEYS = {
    installmentIndex: [0, 1000], year: [1990, 2100], fromYear: [1990, 2100], toYear: [1990, 2100],
    fromMonth: [1, 12], toMonth: [1, 12], page: [1, 100000], pageSize: [1, 5000],
};
const PAIRS = [['dateFrom', 'dateTo'], ['fromDate', 'toDate'], ['bookingFromDate', 'bookingToDate']];
const checkQuery = (req, res, next) => {
    try {
        const q = req.query;
        for (const [k, v] of Object.entries(q)) {
            if (typeof v !== 'string')
                throw (0, input_js_1.bad)(`${k} is not valid`);
            if (v === '')
                continue;
            if (v.length > 200 || /[\u0000-\u001F\u007F]/.test(v))
                throw (0, input_js_1.bad)(`${k} is not valid`);
            if (UUID_KEYS.has(k))
                (0, input_js_1.uuid)(v, k);
            else if (DATE_KEYS.has(k))
                (0, input_js_1.day)(v, k);
            else if (INT_KEYS[k]) {
                const [lo, hi] = INT_KEYS[k];
                if (!/^\d{1,6}$/.test(v) || +v < lo || +v > hi)
                    throw (0, input_js_1.bad)(`${k} must be a whole number from ${lo} to ${hi}`);
            }
            else if (k === 'inPercent' || k === 'pctValue') {
                if (!/^\d{1,6}(\.\d{1,2})?$/.test(v))
                    throw (0, input_js_1.bad)(`${k} must be a number`);
            }
        }
        for (const [a, b] of PAIRS)
            if (q[a] && q[b] && q[a] > q[b])
                throw (0, input_js_1.bad)(`${a} must not be after ${b}`);
        next();
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
};
exports.checkQuery = checkQuery;
const checkParams = (name) => (req, res, next) => {
    try {
        (0, input_js_1.uuid)(req.params[name], name);
        next();
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
};
exports.checkParams = checkParams;
// A search word for ILIKE with % _ and \ taken literally (they used to match everything)
const like = (v) => '%' + v.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
exports.like = like;
// One of a fixed list, or 400 (a typo used to fall back silently)
const pick = (v, label, allowed, dflt) => {
    if (v === undefined || v === '')
        return dflt;
    if (!allowed.includes(v))
        throw (0, input_js_1.bad)(`${label} must be one of: ${allowed.join(', ')}`);
    return v;
};
exports.pick = pick;
// ?page and ?pageSize for a report list
const pageOf = (q, dflt = 100, max = 500) => {
    const size = q.pageSize ? Math.min(max, +q.pageSize) : dflt;
    const page = q.page ? +q.page : 1;
    return { size, page, offset: (page - 1) * size };
};
exports.pageOf = pageOf;
//# sourceMappingURL=report-input.js.map