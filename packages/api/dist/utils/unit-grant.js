"use strict";
// The unit status grant, as pure functions (no database, no app start), so tests and the middleware share one definition.
// Fail closed (plan 8.2): NULL, missing, malformed or unknown means NO inventory access. 'all' is an explicit grant a super admin makes, never a default.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUnitGrantFilter = exports.grantClause = exports.effectiveUnitAccess = exports.unitStatusFilterFor = exports.UNIT_STATUS_MAP = void 0;
// Maps unit_status_access value to the allowed DB status values (null = no filter)
exports.UNIT_STATUS_MAP = {
    none: [],
    unit_hold: ['held', 'locked'],
    available: ['available'],
    available_hold: ['available', 'held', 'locked'],
    all: null,
};
const known = (access) => typeof access === 'string' && Object.prototype.hasOwnProperty.call(exports.UNIT_STATUS_MAP, access);
const unitStatusFilterFor = (access) => (known(access) ? exports.UNIT_STATUS_MAP[access] : []);
exports.unitStatusFilterFor = unitStatusFilterFor;
// The value shown to the browser: super_admin is 'all', anything that is not a known grant is 'none'
const effectiveUnitAccess = (isAdmin, stored) => (isAdmin ? 'all' : known(stored) ? stored : 'none');
exports.effectiveUnitAccess = effectiveUnitAccess;
// The grant as a SQL condition on a status column, for counts and lists outside units.ts: '' for all and super_admin (filter null), otherwise the status must be
// one of the granted ones; a grant that was not loaded counts as none (fail closed). The list is pushed onto params as the next parameter.
const grantClause = (filter, col, params) => {
    if (filter === null)
        return '';
    params.push(Array.isArray(filter) ? filter : []);
    return ` AND ${col}::text = ANY($${params.length}::text[])`;
};
exports.grantClause = grantClause;
// A login may only book, allocate, shift to or hold a unit whose CURRENT status its grant covers (filter null = all)
const assertUnitGrantFilter = (filter, unitStatus) => {
    if (filter === null)
        return;
    if (Array.isArray(filter) && unitStatus && filter.includes(String(unitStatus)))
        return;
    throw Object.assign(new Error('Your login is not allowed to use this unit (inventory access)'), { http: 403, status: 403 });
};
exports.assertUnitGrantFilter = assertUnitGrantFilter;
//# sourceMappingURL=unit-grant.js.map