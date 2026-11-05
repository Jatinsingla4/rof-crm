/**
 * Business dates. The application stores and exchanges instants (timestamptz, ISO strings) in UTC, and decides what "today", "yesterday",
 * "this month" and a date range mean on the calendar of ONE business timezone, Asia/Kolkata. Neither the machine timezone (TZ) nor the
 * PostgreSQL session timezone takes part: a server on UTC with a database on IST, or the other way round, gives the same answer.
 * A DATE column is a calendar day and is never shifted; a timestamptz becomes a business day only through SQL_DAY / businessDate.
 */
export const BUSINESS_TZ = 'Asia/Kolkata';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// The business calendar day (YYYY-MM-DD) of an instant; now by default
export const businessDate = (instant: Date | number = Date.now()): string => fmt.format(instant);
export const businessToday = (): string => businessDate();
export const businessYear = (): number => Number(businessToday().slice(0, 4));

// Calendar arithmetic on a YYYY-MM-DD text (no timezone involved)
export const addDays = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Tomorrow's business day: the upper bound of "cannot be in the future" checks, a day of grace for a browser clock a little ahead
export const businessTomorrow = (): string => addDays(businessToday(), 1);

// The same day one year earlier or later, clamped like SQL does for 29 February
export const addYears = (ymd: string, years: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const out = new Date(Date.UTC(y + years, m - 1, d));
  if (out.getUTCMonth() !== m - 1) out.setUTCDate(0);
  return out.toISOString().slice(0, 10);
};

// SQL fragments (the timezone is written in the expression, so the session timezone never matters)
export const SQL_TODAY = `((NOW() AT TIME ZONE 'Asia/Kolkata')::date)`;
// The business day of a timestamptz column or expression:  sqlDay('r.created_at')
export const sqlDay = (col: string): string => `((${col}) AT TIME ZONE 'Asia/Kolkata')::date`;

// A Date at 00:00 UTC of the business day: for code that formats or does calendar arithmetic with Date getters. The process runs on UTC
// (db/pool.ts), so those getters read the business calendar day; the time of day is deliberately dropped.
export const businessDayStart = (): Date => new Date(`${businessToday()}T00:00:00Z`);

// The business day start of a timestamp or date value
export const startOfBusinessDay = (v: Date | string | number): Date => new Date(`${businessDate(new Date(v))}T00:00:00Z`);

// SQL: the first instant of a business day given as a date parameter, and of the day after it (a range is  col >= start AND col < end)
export const sqlDayStart = (p: string): string => `((${p})::date::timestamp AT TIME ZONE 'Asia/Kolkata')`;
export const sqlDayEnd = (p: string): string => `(((${p})::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
