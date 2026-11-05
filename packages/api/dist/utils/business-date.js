"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqlDayEnd = exports.sqlDayStart = exports.startOfBusinessDay = exports.businessDayStart = exports.sqlDay = exports.SQL_TODAY = exports.addYears = exports.businessTomorrow = exports.addDays = exports.businessYear = exports.businessToday = exports.businessDate = exports.BUSINESS_TZ = void 0;
/**
 * Business dates. The application stores and exchanges instants (timestamptz, ISO strings) in UTC, and decides what "today", "yesterday",
 * "this month" and a date range mean on the calendar of ONE business timezone, Asia/Kolkata. Neither the machine timezone (TZ) nor the
 * PostgreSQL session timezone takes part: a server on UTC with a database on IST, or the other way round, gives the same answer.
 * A DATE column is a calendar day and is never shifted; a timestamptz becomes a business day only through SQL_DAY / businessDate.
 */
exports.BUSINESS_TZ = 'Asia/Kolkata';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: exports.BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
// The business calendar day (YYYY-MM-DD) of an instant; now by default
const businessDate = (instant = Date.now()) => fmt.format(instant);
exports.businessDate = businessDate;
const businessToday = () => (0, exports.businessDate)();
exports.businessToday = businessToday;
const businessYear = () => Number((0, exports.businessToday)().slice(0, 4));
exports.businessYear = businessYear;
// Calendar arithmetic on a YYYY-MM-DD text (no timezone involved)
const addDays = (ymd, days) => {
    const d = new Date(`${ymd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
exports.addDays = addDays;
// Tomorrow's business day: the upper bound of "cannot be in the future" checks, a day of grace for a browser clock a little ahead
const businessTomorrow = () => (0, exports.addDays)((0, exports.businessToday)(), 1);
exports.businessTomorrow = businessTomorrow;
// The same day one year earlier or later, clamped like SQL does for 29 February
const addYears = (ymd, years) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const out = new Date(Date.UTC(y + years, m - 1, d));
    if (out.getUTCMonth() !== m - 1)
        out.setUTCDate(0);
    return out.toISOString().slice(0, 10);
};
exports.addYears = addYears;
// SQL fragments (the timezone is written in the expression, so the session timezone never matters)
exports.SQL_TODAY = `((NOW() AT TIME ZONE 'Asia/Kolkata')::date)`;
// The business day of a timestamptz column or expression:  sqlDay('r.created_at')
const sqlDay = (col) => `((${col}) AT TIME ZONE 'Asia/Kolkata')::date`;
exports.sqlDay = sqlDay;
// A Date at 00:00 UTC of the business day: for code that formats or does calendar arithmetic with Date getters. The process runs on UTC
// (db/pool.ts), so those getters read the business calendar day; the time of day is deliberately dropped.
const businessDayStart = () => new Date(`${(0, exports.businessToday)()}T00:00:00Z`);
exports.businessDayStart = businessDayStart;
// The business day start of a timestamp or date value
const startOfBusinessDay = (v) => new Date(`${(0, exports.businessDate)(new Date(v))}T00:00:00Z`);
exports.startOfBusinessDay = startOfBusinessDay;
// SQL: the first instant of a business day given as a date parameter, and of the day after it (a range is  col >= start AND col < end)
const sqlDayStart = (p) => `((${p})::date::timestamp AT TIME ZONE 'Asia/Kolkata')`;
exports.sqlDayStart = sqlDayStart;
const sqlDayEnd = (p) => `(((${p})::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
exports.sqlDayEnd = sqlDayEnd;
//# sourceMappingURL=business-date.js.map