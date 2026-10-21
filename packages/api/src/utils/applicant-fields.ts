// Rules for the personal fields of an applicant, shared by Applicants and Booking edit (one table drives create, update, co-applicant and additional applicants).
import { createHash } from 'crypto';
import { bad, has, num, text, day } from './input.js';
import {
  mobileNo, emailAddr, panNo, aadhaarNo, gstinNo, passportNo, pastDay, birthDay, genderOf, pinCode, phoneNo,
  children, titleCase,
} from './applicant.js';

// ---------- field rules (one table drives create, update, co-applicant and additional applicants) ----------
export const T = (label: string, max: number) => (v: any) => text(v, label, max, false);
export const money = (label: string, max: number) => (v: any) => (has(v) ? num(v, label, max, 2) : null);
export const flagOf = (label: string) => (v: any) => {
  if (v === null || v === '' ) return false;
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  throw bad(`${label} must be true or false`);
};
export const addr = (label: string) => T(label, 300);
type Clean = (v: any, b: any, prefix: string) => any;
export const FIELDS: Record<string, Clean> = {
  first_name: T('First name', 100), last_name: T('Last name', 100), middle_name: T('Middle name', 100),
  salutation: T('Salutation', 20), dob: v => birthDay(v), gender: genderOf, profession: T('Profession', 100), nationality: T('Nationality', 100),
  annual_income: money('Annual income', 1e11), education: T('Education', 100), company: T('Company', 200), ppp_id: T('Parivar Pehchan Patra', 100),
  alt_mobile: v => mobileNo(v, 'Alternate mobile'), source_of_enquiry: T('Source of enquiry', 100), referred_by: T('Referred by', 200),
  email: v => emailAddr(v), email_2: v => emailAddr(v, 'Second email'), pan_no: v => panNo(v), aadhaar_no: v => aadhaarNo(v),
  passport_no: v => passportNo(v), father_name: T('Father name', 150), anniversary_date: v => pastDay(v, 'Anniversary date'),
  marital_status: T('Marital status', 30), no_of_children: v => children(v), designation: T('Designation', 100), has_poa: flagOf('Has POA'),
  phone_no: v => phoneNo(v, 'Phone'), fax_no: v => phoneNo(v, 'Fax'), form_no: T('Form number', 100), registration_no: T('Registration number', 100),
  mailing_address_type: T('Mailing address type', 30), communication_mode: T('Communication mode', 30), poa_details: T('POA details', 1000),
  company_name: T('Company name', 200), company_reg_no: T('Company registration number', 50), company_gstin: v => gstinNo(v, 'Company GSTIN'),
  authorized_person: T('Authorised person', 150), authorized_designation: T('Authorised designation', 100),
  nominee_name: T('Nominee name', 150), nominee_relation: T('Nominee relation', 50), nominee_dob: v => pastDay(v, 'Nominee date of birth'),
  nominee_share: money('Nominee share', 100), finance_bank: T('Finance bank', 150), loan_amount: money('Loan amount', 1e10), loan_sanction_date: v => day(v, 'Loan sanction date'),
  relationship: T('Relation', 50), applicant_type: v => {
    const t = text(v, 'Applicant type', 30, false);
    if (t !== null && !/^[a-z_]{2,30}$/.test(t)) throw bad('Applicant type is not valid');
    return t;
  },
};
// address blocks: present / office / perm (+ comm for the main applicant)
for (const blk of ['present', 'office', 'perm', 'comm']) {
  FIELDS[`${blk}_${blk === 'comm' ? 'address_line1' : 'address'}`] = addr('Address');
  FIELDS[`${blk}_city`] = T('City', 100); FIELDS[`${blk}_state`] = T('State', 100); FIELDS[`${blk}_country`] = T('Country', 100);
  FIELDS[`${blk}_pin`] = (v, b) => pinCode(v, 'PIN code', b[`${blk}_country`]);
  for (const k of ['phone', 'fax', 'mobile']) FIELDS[`${blk}_${k}_no`] = v => phoneNo(v, `${blk} ${k}`);
}
FIELDS.present_address_line2 = addr('Address line 2');
// the body names differ from the column names for the first address line
export const ALIAS: Record<string, string> = { present_address_line1: 'present_address', office_address_line1: 'office_address', perm_address_line1: 'perm_address', pan: 'pan_no', aadhaar: 'aadhaar_no', relation: 'relationship' };
export const CO_COLS = new Set(['first_name', 'last_name', 'middle_name', 'salutation', 'relationship', 'pan_no', 'aadhaar_no', 'mobile', 'email', 'dob', 'gender', 'father_name', 'anniversary_date', 'marital_status', 'no_of_children', 'passport_no', 'email_2', 'designation', 'has_poa', 'nationality', 'profession', 'applicant_type', 'poa_details', 'mailing_address_type', 'communication_mode',
  ...['present', 'office', 'perm'].flatMap(p => [`${p}_address`, `${p}_city`, `${p}_state`, `${p}_pin`, `${p}_country`, `${p}_phone_no`, `${p}_fax_no`, `${p}_mobile_no`])]);
// Cleans every field that is present in the body (blank text becomes null). Unknown keys are ignored.
// With `errors` given, a field that fails its rule is collected instead of thrown (update uses it to let old, untouched data pass).
export const cleanFields = (src: Record<string, any>, only?: Set<string>, errors?: Record<string, { e: any; raw: any }>): Record<string, any> => {
  const b: Record<string, any> = {};
  for (const [k, v] of Object.entries(src)) b[ALIAS[k] ?? k] = v;
  const out: Record<string, any> = {};
  for (const [col, fn] of Object.entries(FIELDS)) {
    if (b[col] === undefined || (only && !only.has(col))) continue;
    try { out[col] = fn(b[col], b, col); } catch (e: any) { if (!errors || !e?.http) throw e; errors[col] = { e, raw: b[col] }; }
  }
  return out;
};
// Body keys of the co-applicant (Booking form) → the same names as the main applicant
export const coSource = (b: any): Record<string, any> => {
  const s: Record<string, any> = {};
  for (const [k, v] of Object.entries(b)) {
    if (k.startsWith('co_applicant_')) s[k.slice(13) === 'relation' ? 'relationship' : k.slice(13)] = v;
    else if (/^co_(present|office|perm)_/.test(k)) s[k.slice(3)] = v;
    else if (k === 'co_mailing_address_type' || k === 'co_communication_mode' || k === 'co_poa_details') s[k.slice(3)] = v;
  }
  return s;
};
export const asText = (v: any) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v === null || v === undefined ? '' : /^-?\d+(\.\d+)?$/.test(String(v)) ? String(Number(v)) : String(v));
export const mask = (v: any) => (typeof v === 'string' && v.length > 4 ? 'XXXX' + v.slice(-4) : v);
export const forAudit = (o: Record<string, any>) => { const c = { ...o }; for (const k of Object.keys(c)) if (/(^|_)(aadhaar_no|pan_no|passport_no)$/.test(k)) c[k] = mask(c[k]); return c; };
export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const lock = (c: any, key: string) => c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
export const conflict = (m: string) => bad(m, 409);

// The same PAN / mobile cannot belong to two applicants of one project
export const checkIdentity = async (c: any, project: string | null, selfId: string | null, mobile: string | null, pan: string | null) => {
  if (pan) {
    const o = (await c.query(`SELECT name, mobile FROM consumers WHERE project_id IS NOT DISTINCT FROM $1 AND upper(pan_no) = $2 AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [project, pan, selfId])).rows[0];
    if (o) throw conflict(`This PAN already belongs to applicant "${o.name}" (mobile ${o.mobile}) in this project. Use that applicant instead of creating another.`);
  }
  if (mobile) {
    const o = (await c.query(`SELECT name FROM consumers WHERE project_id IS NOT DISTINCT FROM $1 AND mobile = $2 AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [project, mobile, selfId])).rows[0];
    if (o) throw conflict(`This mobile number already belongs to applicant "${o.name}" in this project.`);
  }
};
// Names for the NOT NULL name column
export const personName = (name: any, first: any, last: any, type: any): string | null => {
  const n = has(name) ? text(name, 'Name', 255, false) : null;
  if (n) return type === 'company' ? n : titleCase(n);
  const f = [first, last].filter(Boolean).map(s => titleCase(String(s))).join(' ');
  return f || null;
};
export const hasLetter = (s: string) => /\p{L}/u.test(s);

