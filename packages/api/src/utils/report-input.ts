// Query-string guard for every /api/reports route. One place that refuses a bad filter with a 400 (never a 500, never SQL built from it).
// A report filter is always one plain value: ?x=a&x=b and ?x[a]=b are refused, ids must be uuids, dates real dates, numbers whole numbers.
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, day } from './input.js';

const UUID_KEYS = new Set([
  'projectId', 'companyId', 'towerId', 'consumerId', 'brokerId', 'employeeId', 'salesEmployeeId', 'teamId',
  'companyBankAccountId', 'paymentPlanId',
]);
const DATE_KEYS = new Set([
  'dateFrom', 'dateTo', 'fromDate', 'toDate', 'dueDate', 'asOnDate', 'bookingFromDate', 'bookingToDate',
]);
// name -> [min, max]
const INT_KEYS: Record<string, [number, number]> = {
  installmentIndex: [0, 1000], year: [1990, 2100], fromYear: [1990, 2100], toYear: [1990, 2100],
  fromMonth: [1, 12], toMonth: [1, 12], page: [1, 100000], pageSize: [1, 5000],
};
const PAIRS: [string, string][] = [['dateFrom', 'dateTo'], ['fromDate', 'toDate'], ['bookingFromDate', 'bookingToDate']];

export const checkQuery = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    for (const [k, v] of Object.entries(q)) {
      if (typeof v !== 'string') throw bad(`${k} is not valid`);
      if (v === '') continue;
      if (v.length > 200 || /[\u0000-\u001F\u007F]/.test(v)) throw bad(`${k} is not valid`);
      if (UUID_KEYS.has(k)) uuid(v, k);
      else if (DATE_KEYS.has(k)) day(v, k);
      else if (INT_KEYS[k]) {
        const [lo, hi] = INT_KEYS[k];
        if (!/^\d{1,6}$/.test(v) || +v < lo || +v > hi) throw bad(`${k} must be a whole number from ${lo} to ${hi}`);
      } else if (k === 'inPercent' || k === 'pctValue') {
        if (!/^\d{1,6}(\.\d{1,2})?$/.test(v)) throw bad(`${k} must be a number`);
      }
    }
    for (const [a, b] of PAIRS) if (q[a] && q[b] && q[a] > q[b]) throw bad(`${a} must not be after ${b}`);
    next();
  } catch (err) { failWith(err, res, next); }
};

export const checkParams = (name: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
  try { uuid(req.params[name], name); next(); } catch (err) { failWith(err, res, next); }
};

// A search word for ILIKE with % _ and \ taken literally (they used to match everything)
export const like = (v: string) => '%' + v.replace(/[\\%_]/g, (c) => '\\' + c) + '%';

// One of a fixed list, or 400 (a typo used to fall back silently)
export const pick = <T extends string>(v: any, label: string, allowed: readonly T[], dflt: T): T => {
  if (v === undefined || v === '') return dflt;
  if (!(allowed as readonly string[]).includes(v)) throw bad(`${label} must be one of: ${allowed.join(', ')}`);
  return v as T;
};

// ?page and ?pageSize for a report list
export const pageOf = (q: any, dflt = 100, max = 500) => {
  const size = q.pageSize ? Math.min(max, +q.pageSize) : dflt;
  const page = q.page ? +q.page : 1;
  return { size, page, offset: (page - 1) * size };
};
