// QA-027 (V1.1): who sees an applicant's PAN, Aadhaar and passport number in full. WHICH roles may is ROF's decision (still open): this is the mechanism, and until the setting
// `people_id_full_roles` is given a list of roles (comma separated, for example "super_admin,accounts_finance") every role sees the numbers in full, as before.
// A role that is not on the list gets the last four characters. A masked value sent back by an edit form is ignored on save (it is never written over the real number).
export const PEOPLE_ID_KEYS = ['pan_no', 'aadhaar_no', 'passport_no'] as const;
export const maskTail = (v: any) => (typeof v === 'string' && v.length > 0 ? 'XXXX' + v.slice(-4) : v);
export const isMaskedValue = (v: any) => typeof v === 'string' && /^XXXX/.test(v);

// null = everybody sees everything (the setting is empty)
export async function peopleFullRoles(db: any): Promise<Set<string> | null> {
  const v = (await db.query(`SELECT value FROM global_settings WHERE key = 'people_id_full_roles'`)).rows[0]?.value;
  const list = String(v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return list.length ? new Set(list) : null;
}
export const maskPeople = <T extends Record<string, any>>(row: T, role: string | undefined, full: Set<string> | null): T => {
  if (!row || !full || full.has(String(role || '').toLowerCase())) return row;
  const c: Record<string, any> = { ...row };
  for (const k of PEOPLE_ID_KEYS) if (typeof c[k] === 'string' && c[k]) c[k] = maskTail(c[k]);
  return c as T;
};
// drops a masked placeholder from an edit body, so a form that was shown a masked number cannot overwrite the real one
export const dropMaskedIds = (b: Record<string, any>) => { for (const k of PEOPLE_ID_KEYS) if (isMaskedValue(b[k])) delete b[k]; };
