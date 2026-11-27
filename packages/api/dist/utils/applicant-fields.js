"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLetter = exports.personName = exports.checkNumbers = exports.checkIdentity = exports.conflict = exports.lock = exports.sha = exports.forAudit = exports.mask = exports.asText = exports.coSource = exports.cleanFields = exports.CO_COLS = exports.ALIAS = exports.FIELDS = exports.addr = exports.flagOf = exports.money = exports.T = void 0;
// Rules for the personal fields of an applicant, shared by Applicants and Booking edit (one table drives create, update, co-applicant and additional applicants).
const crypto_1 = require("crypto");
const input_js_1 = require("./input.js");
const applicant_js_1 = require("./applicant.js");
// ---------- field rules (one table drives create, update, co-applicant and additional applicants) ----------
const T = (label, max) => (v) => (0, input_js_1.text)(v, label, max, false);
exports.T = T;
const money = (label, max) => (v) => ((0, input_js_1.has)(v) ? (0, input_js_1.num)(v, label, max, 2) : null);
exports.money = money;
const flagOf = (label) => (v) => {
    if (v === null || v === '')
        return false;
    if (v === true || v === 'true')
        return true;
    if (v === false || v === 'false')
        return false;
    throw (0, input_js_1.bad)(`${label} must be true or false`);
};
exports.flagOf = flagOf;
const addr = (label) => (0, exports.T)(label, 300);
exports.addr = addr;
exports.FIELDS = {
    first_name: (0, exports.T)('First name', 100), last_name: (0, exports.T)('Last name', 100), middle_name: (0, exports.T)('Middle name', 100),
    salutation: (0, exports.T)('Salutation', 20), dob: v => (0, applicant_js_1.birthDay)(v), gender: applicant_js_1.genderOf, profession: (0, exports.T)('Profession', 100), nationality: (0, exports.T)('Nationality', 100),
    annual_income: (0, exports.money)('Annual income', 1e11), education: (0, exports.T)('Education', 100), company: (0, exports.T)('Company', 200), ppp_id: (0, exports.T)('Parivar Pehchan Patra', 100),
    alt_mobile: v => (0, applicant_js_1.mobileNo)(v, 'Alternate mobile'), source_of_enquiry: (0, exports.T)('Source of enquiry', 100), referred_by: (0, exports.T)('Referred by', 200),
    email: v => (0, applicant_js_1.emailAddr)(v), email_2: v => (0, applicant_js_1.emailAddr)(v, 'Second email'), pan_no: v => (0, applicant_js_1.panNo)(v), aadhaar_no: v => (0, applicant_js_1.aadhaarNo)(v),
    passport_no: v => (0, applicant_js_1.passportNo)(v), father_name: (0, exports.T)('Father name', 150), anniversary_date: v => (0, applicant_js_1.pastDay)(v, 'Anniversary date'),
    marital_status: (0, exports.T)('Marital status', 30), no_of_children: v => (0, applicant_js_1.children)(v), designation: (0, exports.T)('Designation', 100), has_poa: (0, exports.flagOf)('Has POA'),
    phone_no: v => (0, applicant_js_1.phoneNo)(v, 'Phone'), fax_no: v => (0, applicant_js_1.phoneNo)(v, 'Fax'), form_no: (0, exports.T)('Form number', 100), registration_no: (0, exports.T)('Registration number', 100),
    mailing_address_type: (0, exports.T)('Mailing address type', 30), communication_mode: (0, exports.T)('Communication mode', 30), poa_details: (0, exports.T)('POA details', 1000),
    company_name: (0, exports.T)('Company name', 200), company_reg_no: (0, exports.T)('Company registration number', 50), company_gstin: v => (0, applicant_js_1.gstinNo)(v, 'Company GSTIN'),
    authorized_person: (0, exports.T)('Authorised person', 150), authorized_designation: (0, exports.T)('Authorised designation', 100),
    nominee_name: (0, exports.T)('Nominee name', 150), nominee_relation: (0, exports.T)('Nominee relation', 50), nominee_dob: v => (0, applicant_js_1.pastDay)(v, 'Nominee date of birth'),
    nominee_share: (0, exports.money)('Nominee share', 100), finance_bank: (0, exports.T)('Finance bank', 150), loan_amount: (0, exports.money)('Loan amount', 1e10), loan_sanction_date: v => (0, input_js_1.day)(v, 'Loan sanction date'),
    relationship: (0, exports.T)('Relation', 50), applicant_type: v => {
        const t = (0, input_js_1.text)(v, 'Applicant type', 30, false);
        if (t !== null && !/^[a-z_]{2,30}$/.test(t))
            throw (0, input_js_1.bad)('Applicant type is not valid');
        return t;
    },
};
// address blocks: present / office / perm (+ comm for the main applicant)
for (const blk of ['present', 'office', 'perm', 'comm']) {
    exports.FIELDS[`${blk}_${blk === 'comm' ? 'address_line1' : 'address'}`] = (0, exports.addr)('Address');
    exports.FIELDS[`${blk}_city`] = (0, exports.T)('City', 100);
    exports.FIELDS[`${blk}_state`] = (0, exports.T)('State', 100);
    exports.FIELDS[`${blk}_country`] = (0, exports.T)('Country', 100);
    exports.FIELDS[`${blk}_pin`] = (v, b) => (0, applicant_js_1.pinCode)(v, 'PIN code', b[`${blk}_country`]);
    for (const k of ['phone', 'fax', 'mobile'])
        exports.FIELDS[`${blk}_${k}_no`] = v => (0, applicant_js_1.phoneNo)(v, `${blk} ${k}`);
}
exports.FIELDS.present_address_line2 = (0, exports.addr)('Address line 2');
// the body names differ from the column names for the first address line
exports.ALIAS = { present_address_line1: 'present_address', office_address_line1: 'office_address', perm_address_line1: 'perm_address', pan: 'pan_no', aadhaar: 'aadhaar_no', relation: 'relationship' };
exports.CO_COLS = new Set(['first_name', 'last_name', 'middle_name', 'salutation', 'relationship', 'pan_no', 'aadhaar_no', 'mobile', 'email', 'dob', 'gender', 'father_name', 'anniversary_date', 'marital_status', 'no_of_children', 'passport_no', 'email_2', 'designation', 'has_poa', 'nationality', 'profession', 'applicant_type', 'poa_details', 'mailing_address_type', 'communication_mode',
    ...['present', 'office', 'perm'].flatMap(p => [`${p}_address`, `${p}_city`, `${p}_state`, `${p}_pin`, `${p}_country`, `${p}_phone_no`, `${p}_fax_no`, `${p}_mobile_no`])]);
// Cleans every field that is present in the body (blank text becomes null). Unknown keys are ignored.
// With `errors` given, a field that fails its rule is collected instead of thrown (update uses it to let old, untouched data pass).
const cleanFields = (src, only, errors) => {
    const b = {};
    for (const [k, v] of Object.entries(src))
        b[exports.ALIAS[k] ?? k] = v;
    const out = {};
    for (const [col, fn] of Object.entries(exports.FIELDS)) {
        if (b[col] === undefined || (only && !only.has(col)) || (!only && col === 'relationship'))
            continue; // relationship exists only for co-applicants
        try {
            out[col] = fn(b[col], b, col);
        }
        catch (e) {
            if (!errors || !e?.http)
                throw e;
            errors[col] = { e, raw: b[col] };
        }
    }
    return out;
};
exports.cleanFields = cleanFields;
// Body keys of the co-applicant (Booking form) → the same names as the main applicant
const coSource = (b) => {
    const s = {};
    for (const [k, v] of Object.entries(b)) {
        if (k.startsWith('co_applicant_'))
            s[k.slice(13) === 'relation' ? 'relationship' : k.slice(13)] = v;
        else if (/^co_(present|office|perm)_/.test(k))
            s[k.slice(3)] = v;
        else if (k === 'co_mailing_address_type' || k === 'co_communication_mode' || k === 'co_poa_details')
            s[k.slice(3)] = v;
    }
    return s;
};
exports.coSource = coSource;
const asText = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v === null || v === undefined ? '' : /^-?\d+(\.\d+)?$/.test(String(v)) ? String(Number(v)) : String(v));
exports.asText = asText;
const mask = (v) => (typeof v === 'string' && v.length > 4 ? 'XXXX' + v.slice(-4) : v);
exports.mask = mask;
const forAudit = (o) => { const c = { ...o }; for (const k of Object.keys(c))
    if (/(^|_)(aadhaar_no|pan_no|passport_no)$/.test(k))
        c[k] = (0, exports.mask)(c[k]); return c; };
exports.forAudit = forAudit;
const sha = (s) => (0, crypto_1.createHash)('sha256').update(s).digest('hex');
exports.sha = sha;
const lock = (c, key) => c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
exports.lock = lock;
const conflict = (m) => (0, input_js_1.bad)(m, 409);
exports.conflict = conflict;
// The same PAN / mobile cannot belong to two applicants of one project
const checkIdentity = async (c, project, selfId, mobile, pan) => {
    if (pan) {
        const o = (await c.query(`SELECT name, mobile FROM consumers WHERE project_id IS NOT DISTINCT FROM $1 AND upper(pan_no) = $2 AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [project, pan, selfId])).rows[0];
        if (o)
            throw (0, exports.conflict)(`This PAN already belongs to applicant "${o.name}" (mobile ${o.mobile}) in this project. Use that applicant instead of creating another.`);
    }
    if (mobile) {
        const o = (await c.query(`SELECT name FROM consumers WHERE project_id IS NOT DISTINCT FROM $1 AND mobile = $2 AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [project, mobile, selfId])).rows[0];
        if (o)
            throw (0, exports.conflict)(`This mobile number already belongs to applicant "${o.name}" in this project.`);
    }
};
exports.checkIdentity = checkIdentity;
// QA-022 (V1.1): a registration number or a form number belongs to ONE applicant. Editing an applicant, editing a booking and editing a document could each write
// consumers.registration_no or form_no with no check, so two applicants could end up with the same number. Case and spaces do not make a number different.
// Only a number that actually changes is checked (an old record that already shares one can still be saved unchanged).
const checkNumbers = async (c, selfId, registration, form) => {
    const taken = async (col, v) => (await c.query(`SELECT 1 FROM consumers WHERE lower(btrim(${col})) = lower(btrim($1)) AND id <> $2 LIMIT 1`, [v, selfId])).rows.length > 0
        || (await c.query(`SELECT 1 FROM booking_records WHERE lower(btrim(${col})) = lower(btrim($1)) AND consumer_id <> $2 LIMIT 1`, [v, selfId])).rows.length > 0;
    if (registration && await taken('registration_no', registration))
        throw (0, exports.conflict)(`The registration number ${registration} already belongs to another applicant.`);
    if (form && await taken('form_no', form))
        throw (0, exports.conflict)(`The form number ${form} already belongs to another applicant.`);
};
exports.checkNumbers = checkNumbers;
// Names for the NOT NULL name column
const personName = (name, first, last, type) => {
    const n = (0, input_js_1.has)(name) ? (0, input_js_1.text)(name, 'Name', 255, false) : null;
    if (n)
        return type === 'company' ? n : (0, applicant_js_1.titleCase)(n);
    const f = [first, last].filter(Boolean).map(s => (0, applicant_js_1.titleCase)(String(s))).join(' ');
    return f || null;
};
exports.personName = personName;
const hasLetter = (s) => /\p{L}/u.test(s);
exports.hasLetter = hasLetter;
//# sourceMappingURL=applicant-fields.js.map