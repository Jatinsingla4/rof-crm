// The yearly penal interest rate for late payments: one setting (global_settings.penal_interest_rate_percent), one default, read here only.
export const DEFAULT_PENAL_RATE = 15;
export const penalRateFrom = (settings: Record<string, string> | undefined | null): number => {
  const n = parseFloat(String(settings?.['penal_interest_rate_percent'] ?? ''));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_PENAL_RATE;
};
export const getPenalRate = async (q: { query: (sql: string, p?: any[]) => Promise<any> }): Promise<number> => {
  const r = await q.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent' LIMIT 1`);
  return penalRateFrom({ penal_interest_rate_percent: r.rows[0]?.value });
};
