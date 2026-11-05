// The unit status grant, as pure functions (no database, no app start), so tests and the middleware share one definition.
// Fail closed (plan 8.2): NULL, missing, malformed or unknown means NO inventory access. 'all' is an explicit grant a super admin makes, never a default.

// Maps unit_status_access value to the allowed DB status values (null = no filter)
export const UNIT_STATUS_MAP: Record<string, string[] | null> = {
  none:           [],
  unit_hold:      ['held', 'locked'],
  available:      ['available'],
  available_hold: ['available', 'held', 'locked'],
  all:            null,
};

const known = (access: unknown): access is string => typeof access === 'string' && Object.prototype.hasOwnProperty.call(UNIT_STATUS_MAP, access);

export const unitStatusFilterFor = (access: unknown): string[] | null => (known(access) ? UNIT_STATUS_MAP[access] : []);

// The value shown to the browser: super_admin is 'all', anything that is not a known grant is 'none'
export const effectiveUnitAccess = (isAdmin: boolean, stored: unknown): string => (isAdmin ? 'all' : known(stored) ? stored : 'none');

// A login may only book, allocate, shift to or hold a unit whose CURRENT status its grant covers (filter null = all)
export const assertUnitGrantFilter = (filter: string[] | null | undefined, unitStatus: string | null | undefined): void => {
  if (filter === null) return;
  if (Array.isArray(filter) && unitStatus && filter.includes(String(unitStatus))) return;
  throw Object.assign(new Error('Your login is not allowed to use this unit (inventory access)'), { http: 403, status: 403 });
};
