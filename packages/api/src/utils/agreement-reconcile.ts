// QA-032: one rule for which demands feed the Applicant File. A cancelled demand is never billed, and a cancelled booking bills nothing,
// so neither may feed the header GST, the schedule rows or the payable total. Without live demands the agreement basis is used everywhere.
export const isCancelledBooking = (b: any): boolean => String(b?.status || '').toLowerCase() === 'cancelled';

export const billableDemands = (b: any, demands: any[]): any[] =>
  isCancelledBooking(b) ? [] : (demands || []).filter((d: any) => String(d.status || '').toLowerCase() !== 'cancelled');

// Reconciliation of one booking's GST on its three bases. Returns the variance, never hides it; rounding is only up to 1 rupee per row.
export function gstReconciliation(agreementGst: number, scheduleGst: number, rows: number) {
  const variance = scheduleGst - agreementGst, tolerance = Math.max(1, rows);
  return { variance, tolerance, status: Math.abs(variance) <= tolerance ? 'rounding' : 'exception' } as const;
}

// QA-001: GST on basic and PLC, each at its own rate (percent), rounded per head: the one rule the breakup, the header and the schedule share.
export const headGst = (basic: number, plc: number, basicPct: number, plcPct: number): number =>
  Math.round(basic * basicPct / 100) + Math.round(plc * plcPct / 100);
