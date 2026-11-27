"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropMaskedIds = exports.maskPeople = exports.isMaskedValue = exports.maskTail = exports.PEOPLE_ID_KEYS = void 0;
exports.peopleFullRoles = peopleFullRoles;
// QA-027 (V1.1): who sees an applicant's PAN, Aadhaar and passport number in full. WHICH roles may is ROF's decision (still open): this is the mechanism, and until the setting
// `people_id_full_roles` is given a list of roles (comma separated, for example "super_admin,accounts_finance") every role sees the numbers in full, as before.
// A role that is not on the list gets the last four characters. A masked value sent back by an edit form is ignored on save (it is never written over the real number).
exports.PEOPLE_ID_KEYS = ['pan_no', 'aadhaar_no', 'passport_no'];
const maskTail = (v) => (typeof v === 'string' && v.length > 0 ? 'XXXX' + v.slice(-4) : v);
exports.maskTail = maskTail;
const isMaskedValue = (v) => typeof v === 'string' && /^XXXX/.test(v);
exports.isMaskedValue = isMaskedValue;
// null = everybody sees everything (the setting is empty)
async function peopleFullRoles(db) {
    const v = (await db.query(`SELECT value FROM global_settings WHERE key = 'people_id_full_roles'`)).rows[0]?.value;
    const list = String(v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    return list.length ? new Set(list) : null;
}
const maskPeople = (row, role, full) => {
    if (!row || !full || full.has(String(role || '').toLowerCase()))
        return row;
    const c = { ...row };
    for (const k of exports.PEOPLE_ID_KEYS)
        if (typeof c[k] === 'string' && c[k])
            c[k] = (0, exports.maskTail)(c[k]);
    return c;
};
exports.maskPeople = maskPeople;
// drops a masked placeholder from an edit body, so a form that was shown a masked number cannot overwrite the real one
const dropMaskedIds = (b) => { for (const k of exports.PEOPLE_ID_KEYS)
    if ((0, exports.isMaskedValue)(b[k]))
        delete b[k]; };
exports.dropMaskedIds = dropMaskedIds;
//# sourceMappingURL=people-mask.js.map