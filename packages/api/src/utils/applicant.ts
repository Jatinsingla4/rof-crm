// Input rules for applicants (consumers, co-applicants, additional applicants). Each helper returns a clean value (null when blank) or throws a 400 with a message for the user.
import { bad, has, text, num } from './input.js';
import { addYears, businessToday, businessTomorrow } from './business-date.js';

export { gstinOk } from './gstin.js';
import { gstinOk } from './gstin.js';

// 10-digit Indian mobile (+91 / 91 / spaces / dashes are dropped) or an international number written with +
export const mobileNo = (v: any, label = 'Mobile number', required = false): string | null => {
  if (!has(v)) { if (required) throw bad(`${label} is required`); return null; }
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} must be text`);
  let s = String(v).replace(/[\s\-().]/g, '');
  if (/^\+91\d{10}$/.test(s)) s = s.slice(3); else if (/^91\d{10}$/.test(s)) s = s.slice(2); else if (/^0\d{10}$/.test(s)) s = s.slice(1);
  if (/^[6-9]\d{9}$/.test(s) || /^\+(?!91)[1-9]\d{7,14}$/.test(s)) return s;
  throw bad(`${label} must be a 10-digit Indian mobile number (starting 6-9) or an international number starting with +`);
};
export const emailAddr = (v: any, label = 'Email'): string | null => {
  const t = text(v, label, 255, false);
  if (t === null) return null;
  const e = t.toLowerCase();
  if (!/^[a-z0-9._%+'-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(e) || e.includes('..')) throw bad(`${label} is not a valid email address`);
  return e;
};
export const panNo = (v: any, label = 'PAN'): string | null => {
  const t = text(v, label, 20, false);
  if (t === null) return null;
  const p = t.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)) throw bad(`${label} must look like ABCDE1234F`);
  return p;
};
export const aadhaarNo = (v: any, label = 'Aadhaar'): string | null => {
  if (!has(v)) return null;
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} must be text`);
  const a = String(v).replace(/[\s-]/g, '');
  if (!/^[2-9]\d{11}$/.test(a)) throw bad(`${label} must be 12 digits (not starting with 0 or 1)`);
  return a;
};
export const gstinNo = (v: any, label = 'GSTIN'): string | null => {
  const t = text(v, label, 20, false);
  if (t === null) return null;
  const g = t.toUpperCase().replace(/\s/g, '');
  if (!gstinOk(g)) throw bad(`${label} is not a valid GSTIN`);
  return g;
};
export const passportNo = (v: any, label = 'Passport number'): string | null => {
  const t = text(v, label, 20, false);
  if (t === null) return null;
  const p = t.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z0-9]{6,12}$/.test(p)) throw bad(`${label} must be 6-12 letters or digits`);
  return p;
};
// A real date not in the future, from 1900
export const pastDay = (v: any, label: string): string | null => {
  if (!has(v)) return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) throw bad(`${label} must be a real date (YYYY-MM-DD)`);
  if (v < '1900-01-01') throw bad(`${label} is too far in the past`);
  if (v > businessTomorrow()) throw bad(`${label} cannot be in the future`);
  return v;
};
// Date of birth: a buyer must be at least 18 years old
export const birthDay = (v: any, label = 'Date of birth', minAge = 18): string | null => {
  const d = pastDay(v, label);
  if (d && minAge) { if (d > addYears(businessToday(), -minAge)) throw bad(`${label}: the applicant must be at least ${minAge} years old`); }
  return d;
};
const GENDER: Record<string, string> = { male: 'male', m: 'male', female: 'female', f: 'female', trans: 'trans', transgender: 'trans', other: 'other' };
export const genderOf = (v: any): string | null => {
  const t = text(v, 'Gender', 20, false);
  if (t === null) return null;
  const g = GENDER[t.toLowerCase()];
  if (!g) throw bad('Gender must be male, female, trans or other');
  return g;
};
export const pinCode = (v: any, label = 'PIN code', country?: any): string | null => {
  const t = text(v, label, 12, false);
  if (t === null) return null;
  const indian = !has(country) || /^india$/i.test(String(country).trim());
  if (indian && !/^[1-9]\d{5}$/.test(t)) throw bad(`${label} must be 6 digits`);
  if (!indian && !/^[A-Za-z0-9 -]{3,12}$/.test(t)) throw bad(`${label} is not valid`);
  return t;
};
export const phoneNo = (v: any, label: string): string | null => {
  const t = text(v, label, 20, false);
  if (t === null) return null;
  if (!/^[0-9+()\- ]{5,20}$/.test(t)) throw bad(`${label} can have only digits, spaces, + - ( )`);
  return t;
};
export const children = (v: any, label = 'Number of children'): number | null => (has(v) ? num(v, label, 20, 0) : null);
// Each run of letters gets a capital (also after - ' .); a run of exactly two capitals (QA, AK) stays as typed, so initials and short acronyms survive. RAM becomes Ram.
export const titleCase = (s: string) => s.trim().split(/\s+/).join(' ').replace(/[^\s\-'’.]+/gu, w => /^\p{Lu}{2}$/u.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
export const LEAD_STAGES = ['enquiry', 'interested', 'application_filed', 'draw_entered', 'allotted', 'onboarded', 'cancelled', 'transferred'];
export const INCOME_CATS = ['EWS', 'LIG', 'MIG'];
// Escapes % and _ so a search for "50%" finds the text, not everything
export const likeOf = (s: any) => '%' + String(s).trim().replace(/[\\%_]/g, '\\$&') + '%';
