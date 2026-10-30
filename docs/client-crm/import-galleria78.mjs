// Enters the client's project ROF GALLERIA@78 (structure from captured/09-project-galleria78.md) into OUR CRM through its own API,
// then reads every item back and prints what our CRM could hold and what it could not. No customer data is used.
// Run against a LOCAL api only:  BASE=http://localhost:3020/api node docs/client-crm/import-galleria78.mjs
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) { console.log('refusing: local API only'); process.exit(2); }
const rows = []; const say = (item, ok, note = '') => { rows.push([ok === null ? 'CHK' : ok ? 'OK ' : 'GAP', item, note]); }; // CHK = not decided by this script, open it in the app
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(call.tok ? { authorization: 'Bearer ' + call.tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
call.tok = (await call('POST', '/auth/login', { email: 'super_admin@test.local', password: 'Test#Pass1234' })).j?.token;
const U = Date.now().toString(36).slice(-4);
const err = (r) => r.j?.error || r.j?.message || JSON.stringify(r.j).slice(0, 120);

// 1 company
let r = await call('POST', '/companies', { name: `Pegasus Land and Housing Private Limited ${U}` });
const companyId = r.j?.data?.id || r.j?.id; say('Company "Pegasus Land and Housing Private Limited"', r.s === 201 || r.s === 200, r.s >= 300 ? err(r) : '');

// 2 project card
r = await call('POST', '/projects', { name: `ROF GALLERIA@78 ${U}`, location: 'SECTOR - 78', landAreaSqft: Math.round(2.45 * 43560), totalUnits: 32, companyId, reraNumber: 'TO-FILL-' + U, tcpLicence: 'TO-FILL-' + U });
const P = r.j?.data?.id; say('Project card (name, location, land area 2.45 Acres, 32 units, company)', !!P, P ? '' : err(r));
say('Project type "Commercial" (Commercial / Residential / Plotting / Group Housing / SCO)', 'type' in (r.j?.data || {}) || 'project_type' in (r.j?.data || {}), 'no project type field on the project');
say('Land area kept with its unit (Acres)', false, 'stored only as square feet; the client keeps a number plus a unit (Acres, Sq. Ft., Sq. Yrd.)');
say('RERA no and TCP licence may be left blank (the client project has neither on its card)', false, 'both are required to create a project here');

// 3 tower and floor
r = await call('POST', `/projects/${P}/towers`, { towerName: 'Ground' }); const T = r.j?.data?.id; say('Tower "Ground"', !!T, T ? '' : err(r));
const fl = await call('POST', '/master/floors', { tower_id: T, floor_number: 0, floor_name: 'Ground Floor' });
say('Floor "Ground Floor" on the tower', fl.s === 201 || fl.s === 200, fl.s >= 300 ? err(fl) : '');
say('Tower fields: New Name, Prefix for unit address, Sort order, Completion certificate date', false, 'tower has name, floors, units per floor only');

// 4 unit types (3 rows: group Shop, rate 5000 on super area, carpet 255 / 296 / 475.735)
const ut = {};
for (const [n, sup, car] of [['510 Sq. Ft.', 510, 255], ['550 Sq. Ft.', 550, 296], ['950 Sq. Ft.', 950, 475.735]]) {
  r = await call('POST', '/master/unit-types', { project_id: P, name: n, carpet_area_sqft: car, balcony_area_sqft: 0, base_rate_sqft: 5000, description: 'Shop' });
  ut[n] = r.j?.data?.id; say(`Unit type ${n} (carpet ${car}, rate 5000)`, !!ut[n], ut[n] ? '' : err(r));
}
for (const f of ['Super area on the unit type', 'Built-up area', 'UDSL area', 'Plot area (+ unit)', 'Group name ("Shop")', 'Type Per Area / In Fix', 'Salable / Non salable', 'Rate effective on Super / Carpet / Built-up / Plot', 'Areas to show on payment file', 'Construction cost, UDSL cost', 'Unit of measurement', 'Rate date (24/12/2022)', 'Unit map file'])
  say(`Unit type field: ${f}`, false, 'the unit type has name, description, carpet area, balcony area and rate only');

// 5 units G-01..G-32
let made = 0, first = '';
for (let i = 1; i <= 32; i++) {
  const [ty, sup, car] = i === 1 || i === 31 ? ['950 Sq. Ft.', 950, 475.735] : i === 32 ? ['550 Sq. Ft.', 550, 296] : ['510 Sq. Ft.', 510, 255];
  r = await call('POST', '/units', { projectId: P, towerId: T, unitNumber: `G-${String(i).padStart(2, '0')}`, bhkType: 'Shop', floor: 0, superAreaSqft: sup, carpetAreaSqft: car, unitTypeId: ut[ty], basePriceInr: sup * 5000 });
  if (r.s === 201 || r.s === 200) made++; else if (!first) first = err(r);
}
say('Units G-01 to G-32 (type, super and carpet area, base price = area x 5000)', made === 32, made === 32 ? '' : `${made}/32 made; first error: ${first}`);
say('Unit "Location" pick list, "New address" and image upload per unit', null, 'check unit-address screen; location master exists, per-unit image not checked');

// 6 payment plans (10)
const plans = {
  'CLP@78': [['At the time of booking', 10], ['Within 30 Days of Booking', 30], ['On the Start of Excavation', 20], ['On Casting of Ground Floor Slab', 30], ['On Intimation for Offer of Possession', 10]],
  'PLP@78': [['At the time of booking', 10], ['Within 30 Days of Booking', 30], ['On Completion of Super Structure', 30], ['On Intimation for Offer of Possession', 30]],
  'PLP@78 40:60': [['At the time of booking', 10], ['Within 30 Days of Booking', 30], ['On Intimation for Offer of Possession', 60]],
  'PLP@78 30:70': [['At the time of booking', 10], ['Within 30 Days of Booking', 20], ['On Intimation for Offer of Possession', 70]],
  'Payment Plan 9:10:81': [['At the time of booking', 9], ['Within 30 Days of Booking', 10], ['On Intimation for Offer of Possession', 81]],
  'Possession link plan 15:25:30:30': [['At the time of booking', 15], ['Within 30 Days of Booking', 25], ['On Super-Structure or 12 Months whichever is earlier', 30], ['On Intimation for Offer of Possession', 30]],
  'Payment plan CLP 5:5:30:30:30': [['At the time of submission of application', 5], ['On Allotment', 5], ['with in 30 Days', 30], ['On Completion of Super Structure', 30], ['On Intimation for Offer of Possession', 30]],
  'Payment Plan 5:95': [['At the time of booking', 5], ['On Intimation for Offer of Possession', 95]],
  'Payment Plan 10:90': [['At the time of booking', 10], ['On Intimation for Offer of Possession', 90]],
  'Payment Plan 10:40:50': [['At the time of booking', 10], ['Within 30 Days of Booking', 40], ['On Intimation for Offer of Possession', 50]],
};
for (const [name, inst] of Object.entries(plans)) {
  let ok = true, why = '';
  for (const [i, [n, pct]] of inst.entries()) { r = await call('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: n, installment_type: i === 0 ? 'booking' : /Possession/.test(n) ? 'possession' : 'installment', percentage: pct, installment_index: i + 1, due_date_offset_days: 0 }); if (r.s >= 300) { ok = false; why = err(r); break; } }
  say(`Plan "${name}" (${inst.length} installments, ${inst.reduce((a, x) => a + x[1], 0)}%)`, ok, why);
}
say('Plan fields: plan type (Construction / Down payment / Flexi / Time), % or fixed, timely discount, "100%" vs "100-discount", description', null, 'check plan screen: only name, installment rows, percentage / flat amount and offset days were found');

// 7 reminders per project
for (const [n, d, pre, rank] of [['Reminder 1', 10, 'R1', 1], ['Reminder 2', 20, 'R2', 2]]) {
  r = await call('POST', '/master/reminder-master', { name: n, days_before: d, channel: pre, project_id: P, rank });
  say(`Reminder "${n}" = ${d} days (prefix ${pre}, rank ${rank}) for this project`, false, r.s < 300 ? 'saved, but the route stores only name, days and prefix: no project, no rank (it is one global list)' : err(r));
}

// 8 documents (7)
const docs = [['Physical Application Form', 'Individual', true], ['Document 2', 'Individual', false], ['Document 3', 'Individual', false], ['Document 4', 'Individual', false], ['Document 5', 'Individual', false], ['Physical Application Form', 'Firm or Company', true], ['Document 1', 'Individual', false]];
let dm = 0, dwhy = '';
for (const [n, from, man] of docs) { r = await call('POST', '/master/document-types', { name: n, project_id: P, document_from: from, is_mandatory: man, required_at: 'On Booking' }); if (r.s < 300) dm++; else dwhy = err(r); }
say('Document master: 7 rows "On Booking" (individual / company, mandatory)', dm === 7, dm === 7 ? '' : `${dm}/7 saved: ${dwhy}`);

// 9 interest master 15% simple from 01 Jan 2022, calculated on receipt date
const adminTok = call.tok; call.tok = (await call('POST', '/auth/login', { email: 'accounts_finance@test.local', password: 'Test#Pass1234' })).j?.token; // interest rates are accounts-only
r = await call('POST', '/payments/interest-master', { project_id: P, rate_percent: 15, interest_rate_percent: 15, effective_from: '2022-01-01', from_date: '2022-01-01' });
call.tok = adminTok;
say('Project interest 15.00 % from 01 Jan 2022', r.s < 300, r.s < 300 ? '' : err(r));
say('Interest type Simple / Compound, compound frequency, "calculated on Receipt Date Wise"', false, 'project_interest_rates has rate and effective date only');

// 10 numbering and authentication switches
for (const f of ['Receipt number prefix "ROF-GALLER" per project and receipt type (Normal, Cr Note, Dr Note, Refund, Journal)', 'Registration number mode Manual + size 6', 'Booking authentication switches (applicant add/delete, journal, unit shifting) Automatic / Manual', 'Transfer authentication Automatic / Manual'])
  say(f, false, 'no per-project switch found (see GAP-LIST section 2)');

// read-back
const rb = await call('GET', `/units?projectId=${P}&limit=100`); const n = (rb.j?.data?.units || rb.j?.data || []).length;
rows.push(['--', 'read-back: units listed for the new project', String(n)]);
const pl = await call('GET', `/projects/${P}/plans`); rows.push(['--', 'read-back: plans listed', String((pl.j?.data || pl.j || []).length)]);
console.log(rows.map((x) => x.join(' | ')).join('\n'));
const gaps = rows.filter((x) => x[0] === 'GAP').length, oks = rows.filter((x) => x[0] === 'OK ').length, chk = rows.filter((x) => x[0] === 'CHK').length;
console.log(`(${chk} rows marked CHK need a look in the app)`);
console.log(`RESULT: ${oks} passed, ${gaps} failed (a "failed" row here is a place our CRM cannot hold something the client's project has)`);
console.log('PROJECT_ID=' + P);
