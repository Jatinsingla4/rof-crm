"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeOf = exports.INCOME_CATS = exports.LEAD_STAGES = exports.titleCase = exports.children = exports.phoneNo = exports.pinCode = exports.genderOf = exports.birthDay = exports.pastDay = exports.passportNo = exports.gstinNo = exports.aadhaarNo = exports.panNo = exports.emailAddr = exports.mobileNo = exports.gstinOk = void 0;
// Input rules for applicants (consumers, co-applicants, additional applicants). Each helper returns a clean value (null when blank) or throws a 400 with a message for the user.
const input_js_1 = require("./input.js");
const business_date_js_1 = require("./business-date.js");
const gstinOk = (g) => {
    const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (!/^(0[1-9]|[1-2][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g))
        return false;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
        const p = A.indexOf(g[i]) * (i % 2 ? 2 : 1);
        sum += Math.floor(p / 36) + (p % 36);
    }
    return A[(36 - (sum % 36)) % 36] === g[14];
};
exports.gstinOk = gstinOk;
// 10-digit Indian mobile (+91 / 91 / spaces / dashes are dropped) or an international number written with +
const mobileNo = (v, label = 'Mobile number', required = false) => {
    if (!(0, input_js_1.has)(v)) {
        if (required)
            throw (0, input_js_1.bad)(`${label} is required`);
        return null;
    }
    if (typeof v !== 'string' && typeof v !== 'number')
        throw (0, input_js_1.bad)(`${label} must be text`);
    let s = String(v).replace(/[\s\-().]/g, '');
    if (/^\+91\d{10}$/.test(s))
        s = s.slice(3);
    else if (/^91\d{10}$/.test(s))
        s = s.slice(2);
    else if (/^0\d{10}$/.test(s))
        s = s.slice(1);
    if (/^[6-9]\d{9}$/.test(s) || /^\+(?!91)[1-9]\d{7,14}$/.test(s))
        return s;
    throw (0, input_js_1.bad)(`${label} must be a 10-digit Indian mobile number (starting 6-9) or an international number starting with +`);
};
exports.mobileNo = mobileNo;
const emailAddr = (v, label = 'Email') => {
    const t = (0, input_js_1.text)(v, label, 255, false);
    if (t === null)
        return null;
    const e = t.toLowerCase();
    if (!/^[a-z0-9._%+'-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(e) || e.includes('..'))
        throw (0, input_js_1.bad)(`${label} is not a valid email address`);
    return e;
};
exports.emailAddr = emailAddr;
const panNo = (v, label = 'PAN') => {
    const t = (0, input_js_1.text)(v, label, 20, false);
    if (t === null)
        return null;
    const p = t.toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p))
        throw (0, input_js_1.bad)(`${label} must look like ABCDE1234F`);
    return p;
};
exports.panNo = panNo;
const aadhaarNo = (v, label = 'Aadhaar') => {
    if (!(0, input_js_1.has)(v))
        return null;
    if (typeof v !== 'string' && typeof v !== 'number')
        throw (0, input_js_1.bad)(`${label} must be text`);
    const a = String(v).replace(/[\s-]/g, '');
    if (!/^[2-9]\d{11}$/.test(a))
        throw (0, input_js_1.bad)(`${label} must be 12 digits (not starting with 0 or 1)`);
    return a;
};
exports.aadhaarNo = aadhaarNo;
const gstinNo = (v, label = 'GSTIN') => {
    const t = (0, input_js_1.text)(v, label, 20, false);
    if (t === null)
        return null;
    const g = t.toUpperCase().replace(/\s/g, '');
    if (!(0, exports.gstinOk)(g))
        throw (0, input_js_1.bad)(`${label} is not a valid GSTIN`);
    return g;
};
exports.gstinNo = gstinNo;
const passportNo = (v, label = 'Passport number') => {
    const t = (0, input_js_1.text)(v, label, 20, false);
    if (t === null)
        return null;
    const p = t.toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]{6,12}$/.test(p))
        throw (0, input_js_1.bad)(`${label} must be 6-12 letters or digits`);
    return p;
};
exports.passportNo = passportNo;
// A real date not in the future, from 1900
const pastDay = (v, label) => {
    if (!(0, input_js_1.has)(v))
        return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)
        throw (0, input_js_1.bad)(`${label} must be a real date (YYYY-MM-DD)`);
    if (v < '1900-01-01')
        throw (0, input_js_1.bad)(`${label} is too far in the past`);
    if (v > (0, business_date_js_1.businessTomorrow)())
        throw (0, input_js_1.bad)(`${label} cannot be in the future`);
    return v;
};
exports.pastDay = pastDay;
// Date of birth: a buyer must be at least 18 years old
const birthDay = (v, label = 'Date of birth', minAge = 18) => {
    const d = (0, exports.pastDay)(v, label);
    if (d && minAge) {
        if (d > (0, business_date_js_1.addYears)((0, business_date_js_1.businessToday)(), -minAge))
            throw (0, input_js_1.bad)(`${label}: the applicant must be at least ${minAge} years old`);
    }
    return d;
};
exports.birthDay = birthDay;
const GENDER = { male: 'male', m: 'male', female: 'female', f: 'female', trans: 'trans', transgender: 'trans', other: 'other' };
const genderOf = (v) => {
    const t = (0, input_js_1.text)(v, 'Gender', 20, false);
    if (t === null)
        return null;
    const g = GENDER[t.toLowerCase()];
    if (!g)
        throw (0, input_js_1.bad)('Gender must be male, female, trans or other');
    return g;
};
exports.genderOf = genderOf;
const pinCode = (v, label = 'PIN code', country) => {
    const t = (0, input_js_1.text)(v, label, 12, false);
    if (t === null)
        return null;
    const indian = !(0, input_js_1.has)(country) || /^india$/i.test(String(country).trim());
    if (indian && !/^[1-9]\d{5}$/.test(t))
        throw (0, input_js_1.bad)(`${label} must be 6 digits`);
    if (!indian && !/^[A-Za-z0-9 -]{3,12}$/.test(t))
        throw (0, input_js_1.bad)(`${label} is not valid`);
    return t;
};
exports.pinCode = pinCode;
const phoneNo = (v, label) => {
    const t = (0, input_js_1.text)(v, label, 20, false);
    if (t === null)
        return null;
    if (!/^[0-9+()\- ]{5,20}$/.test(t))
        throw (0, input_js_1.bad)(`${label} can have only digits, spaces, + - ( )`);
    return t;
};
exports.phoneNo = phoneNo;
const children = (v, label = 'Number of children') => ((0, input_js_1.has)(v) ? (0, input_js_1.num)(v, label, 20, 0) : null);
exports.children = children;
const titleCase = (s) => s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
exports.titleCase = titleCase;
exports.LEAD_STAGES = ['enquiry', 'interested', 'application_filed', 'draw_entered', 'allotted', 'onboarded', 'cancelled', 'transferred'];
exports.INCOME_CATS = ['EWS', 'LIG', 'MIG'];
// Escapes % and _ so a search for "50%" finds the text, not everything
const likeOf = (s) => '%' + String(s).trim().replace(/[\\%_]/g, '\\$&') + '%';
exports.likeOf = likeOf;
//# sourceMappingURL=applicant.js.map