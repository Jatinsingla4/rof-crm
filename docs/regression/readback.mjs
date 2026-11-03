// Save-and-read-back: every field sent on create must come back the same on read. Silent loss or change of a value is a defect.
//   BASE=http://localhost:3010/api node docs/regression/readback.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const api = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t: t.slice(0, 200) }; };
const same = (a, b) => (a == null && (b == null || b === '')) || String(a).trim() === String(b).trim() || (a !== '' && !isNaN(a) && !isNaN(b) && Number(a) === Number(b));
let ok = 0, bad = 0; const diffs = [];
const cmp = (what, sent, got, map = {}) => { for (const [k, v] of Object.entries(sent)) { const g = got[map[k] || k]; if (same(v, g) || (typeof v === 'string' && String(g).startsWith(v.slice(0, 10)))) ok++; else { bad++; diffs.push(`${what}.${k}: sent ${JSON.stringify(v)} got ${JSON.stringify(g)}`); } } };
const RUN = 'RB' + Date.now().toString(36).toUpperCase();
const co = (await api('POST', '/companies', { name: RUN + ' Co', pan_no: 'ABCDE1234F', gstin: '07ABCDE1234F1Z5', address1: '1 Test Road', city: 'Delhi', pin_code: '110001', cin: 'U12345DL2020PTC123456', email: 'co@example.com', phone: '9876543210' })).j;
const coId = co.data?.id; const coGet = coId ? (await api('GET', '/companies/' + coId)).j : null;
if (coGet) cmp('company', { name: RUN + ' Co', pan_no: 'ABCDE1234F', gstin: '07ABCDE1234F1Z5', address1: '1 Test Road', city: 'Delhi', pin_code: '110001', cin: 'U12345DL2020PTC123456', email: 'co@example.com', phone: '9876543210' }, coGet.data || coGet); else diffs.push('company create/get failed ' + JSON.stringify(co).slice(0, 150));
const pr = await api('POST', '/projects', { companyId: coId, name: RUN + ' Proj', reraNumber: RUN, tcpLicence: 'TCP-' + RUN, location: 'Sector 99, Gurugram' });
const P = pr.j?.data?.id; const prGet = P ? (await api('GET', '/projects/' + P)).j : null;
if (prGet) cmp('project', { name: RUN + ' Proj', location: 'Sector 99, Gurugram' }, prGet.data || prGet); else diffs.push('project failed ' + pr.t);
const sets = { receipt_prefix: 'RB', registration_prefix: 'RBR', balcony_max_charge_inr: 45678, balcony_max_area_sqft: 123.45 };
await api('PUT', `/projects/${P}/settings`, sets); const sg = (await api('GET', `/projects/${P}/settings`)).j.data; cmp('settings', sets, sg);
const tw = (await api('POST', `/projects/${P}/towers`, { towerName: 'RB Tower' })).j?.data?.id;
const unit = { unitNumber: 'RB-101', floor: 7, bhkType: '3BHK', carpetAreaSqft: 612.345, superAreaSqft: 780.5, balconyAreaSqft: 48.5, basePriceInr: 2646207, totalPriceInr: 2700000 };
const un = await api('POST', '/units', { projectId: P, towerId: tw, ...unit }); const uid = un.j?.data?.id;
const ug = (await api('GET', '/units?projectId=' + P + '&limit=50')).j.data; const u = (ug.units || ug).find((x) => x.id === uid) || {};
cmp('unit', { unit_number: 'RB-101', floor: 7, bhk_type: '3BHK', carpet_area_sqft: 612.345, super_area_sqft: 780.5, balcony_area_sqft: 48.5, base_price_inr: 2646207 }, u);
const cons = { first_name: 'Read', last_name: 'Back ' + RUN, salutation: 'Mrs.', mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), email: RUN.toLowerCase() + '@example.com', pan_no: 'ABCDE1234F', aadhaar_no: '234123412341', dob: '1980-02-29', present_address: 'Flat 9, Lane 3, Mumbai 400001', gender: 'female', father_name: 'Father Name' };
const cc = await api('POST', '/consumers', { name: 'Read Back', project_id: P, ...cons, communication_mode: 'email' }); const cid = cc.j?.data?.id;
const cg = cid ? (await api('GET', '/consumers/' + cid)).j : null; cg ? cmp('consumer', cons, cg.data || cg, { dob: 'dob' }) : diffs.push('consumer failed ' + cc.t);
const upd = { first_name: 'Edited', present_address: 'New Address 5, Pune 411001', email: 'edited' + RUN.toLowerCase() + '@example.com' };
const pu = await api('PATCH', '/consumers/' + cid, upd); const cg2 = (await api('GET', '/consumers/' + cid)).j; pu.s < 300 ? cmp('consumer edit', upd, cg2.data || cg2) : diffs.push('consumer edit refused ' + pu.t);
console.log(`read-back: ${ok} fields came back the same, ${bad} did not`); console.log(diffs.join('\n') || 'no differences');
