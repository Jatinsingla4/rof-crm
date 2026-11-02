// Set Projects parity with the client CRM: the whole unit type master (areas to 4 decimals, rate basis, group, salable, costs, unit of measure,
// areas shown on the payment file) and reminder rules per project with rank and prefix. Own data, roles, hostile input, random run.
// Run: BASE=http://localhost:3010/api node docs/set-projects-parity/api-test-set-projects-parity.mjs   (psql on the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), NO = call();
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED; const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const no5 = (xs) => xs.every((x) => x.s < 500);
const co = (await A('GET', '/companies')).j?.data?.[0]?.id || (await A('POST', '/companies', { name: `Co ${U}` })).j?.data?.id;
const P = (await A('POST', '/projects', { name: `SPP ${U}`, reraNumber: `R-${U}`, tcpLicence: `T-${U}`, companyId: co })).j?.data?.id;
const P2 = (await A('POST', '/projects', { name: `SPP2 ${U}`, reraNumber: `R2-${U}`, tcpLicence: `T2-${U}`, companyId: co })).j?.data?.id;
const ut = (b) => A('POST', '/master/unit-types', { project_id: P, ...b });

// ---------- unit type: the client's own rows ----------
let r = await ut({ name: `510 Sq. Ft. ${U}`, group_name: 'Shop', super_area_sqft: 510, carpet_area_sqft: 255, base_rate_sqft: 5000, rate_basis: 'Super Area', rate_type: 'Per Area', area_type: 'Salable', show_on_payment_file: ['Super Area', 'Carpet Area'], unit_of_measurement: 'Sq. Ft.', rate_date: '2022-12-24', construction_cost: 0, udsl_cost: 0 });
t('unit type: the client shop row (510 super, 255 carpet, 5000 on super area, shown on payment file)', r.s === 201 && r.j.data.rate_basis === 'Super Area' && r.j.data.group_name === 'Shop' && JSON.stringify(r.j.data.show_on_payment_file) === '["Super Area","Carpet Area"]' && String(r.j.data.rate_date).startsWith('2022-12-2'), r);
const T1 = r.j?.data?.id;
r = await ut({ name: `Type 4 ${U}`, group_name: 'Type 4 (2BHK)', carpet_area_sqft: 493.206, balcony_area_sqft: 125.078, base_rate_sqft: 4200.5, rate_basis: 'Carpet Area', show_on_payment_file: ['Carpet Area', 'Balcony Area'] });
t('unit type: 3 decimals of area and a rate with paise are kept (493.206, 125.078, 4200.50)', r.s === 201 && Number(r.j.data.carpet_area_sqft) === 493.206 && Number(r.j.data.balcony_area_sqft) === 125.078 && Number(r.j.data.base_rate_sqft) === 4200.5, r);
r = await ut({ name: `Shop 950 ${U}`, super_area_sqft: 950, carpet_area_sqft: 475.735, base_rate_sqft: 5000, rate_basis: 'Super Area' });
t('unit type: carpet 475.735 (the client 950 sq ft shop) is accepted', r.s === 201 && Number(r.j.data.carpet_area_sqft) === 475.735, r);
r = await ut({ name: `Old style ${U}`, carpet_area_sqft: 100, base_rate_sqft: 1000 });
t('unit type: the old minimal body still works and defaults to Per Area, Salable, Carpet Area', r.s === 201 && r.j.data.rate_type === 'Per Area' && r.j.data.area_type === 'Salable' && r.j.data.rate_basis === 'Carpet Area' && Array.isArray(r.j.data.show_on_payment_file), r);
for (const [n, b] of [
  ['super less than carpet', { super_area_sqft: 100, carpet_area_sqft: 200, base_rate_sqft: 1, rate_basis: 'Super Area' }],
  ['built-up less than carpet', { built_up_area_sqft: 50, carpet_area_sqft: 200, base_rate_sqft: 1 }],
  ['rate on super area but no super area', { carpet_area_sqft: 200, base_rate_sqft: 5000, rate_basis: 'Super Area' }],
  ['rate on plot area but no plot area', { carpet_area_sqft: 200, base_rate_sqft: 5000, rate_basis: 'Plot Area' }],
  ['unknown rate basis', { carpet_area_sqft: 200, base_rate_sqft: 5000, rate_basis: 'Roof' }],
  ['unknown type', { carpet_area_sqft: 200, rate_type: 'Free' }], ['unknown area type', { carpet_area_sqft: 200, area_type: 'Both' }],
  ['payment file area not filled in', { carpet_area_sqft: 200, base_rate_sqft: 1, show_on_payment_file: ['UDSL Area'] }],
  ['payment file not a list', { carpet_area_sqft: 200, show_on_payment_file: 'Carpet Area' }], ['payment file unknown area', { carpet_area_sqft: 200, show_on_payment_file: ['Garden'] }], ['payment file repeats an area', { carpet_area_sqft: 200, show_on_payment_file: ['Carpet Area', 'Carpet Area'] }],
  ['unit of measurement not in Area Types', { carpet_area_sqft: 200, unit_of_measurement: 'Furlong' }], ['plot unit not in Area Types', { carpet_area_sqft: 200, plot_area: 5, plot_area_unit: 'Furlong' }],
  ['bad rate date', { carpet_area_sqft: 200, rate_date: '2022-13-45' }], ['5 decimals of area', { carpet_area_sqft: 200.12345 }], ['negative cost', { carpet_area_sqft: 200, construction_cost: -5 }],
  ['group too long', { carpet_area_sqft: 200, group_name: 'g'.repeat(101) }], ['markup in group', { carpet_area_sqft: 200, group_name: '<b>x</b>' }],
]) { const x = await ut({ name: `Bad ${n} ${U}`.slice(0, 90), ...b }); t(`unit type: ${n} is 400`, x.s === 400, x); }
r = await A('PUT', `/master/unit-types/${T1}`, { group_name: 'Shops' }); t('unit type: edit one field keeps all the others', r.s === 200 && r.j.data.group_name === 'Shops' && r.j.data.rate_basis === 'Super Area' && Number(r.j.data.super_area_sqft) === 510 && r.j.data.show_on_payment_file.length === 2, r);
r = await A('PUT', `/master/unit-types/${T1}`, { rate_basis: 'Plot Area' }); t('unit type: switching the rate to an area that is empty is 400', r.s === 400, r);
r = await A('PUT', `/master/unit-types/${T1}`, { show_on_payment_file: [] }); t('unit type: payment-file list can be emptied', r.s === 200 && r.j.data.show_on_payment_file.length === 0, r);
t('unit type: the list shows the new fields', ((await A('GET', '/master/unit-types')).j?.data || []).some((x) => x.id === T1 && 'rate_basis' in x && 'group_name' in x));
t('unit type: viewer and sales cannot write, no login is 401', (await RO('PUT', `/master/unit-types/${T1}`, { group_name: 'x' })).s === 403 && (await SE('POST', '/master/unit-types', { project_id: P, name: 'z' })).s === 403 && (await NO('GET', '/master/unit-types')).s === 401);

// ---------- reminders per project ----------
const rm = (b) => A('POST', '/master/reminder-master', b);
r = await rm({ name: `Reminder 1 ${U}`, days_before: 10, prefix_name: 'R1', rank: 1, project_id: P }); t('reminder: Reminder 1 = 10 days, prefix R1, rank 1 for a project', r.s === 201 && r.j.data.rank === 1 && r.j.data.prefix_name === 'R1' && r.j.data.project_id === P, r); const R1 = r.j?.data?.id;
r = await rm({ name: `Reminder 2 ${U}`, days_before: 20, prefix_name: 'R2', rank: 2, project_id: P }); t('reminder: Reminder 2 = 20 days, rank 2', r.s === 201, r);
r = await rm({ name: `Reminder 1 ${U}`, days_before: 15, prefix_name: 'R1', rank: 1, project_id: P2 }); t('reminder: another project can have its own Reminder 1 with its own days', r.s === 201 && r.j.data.days_before === 15, r);
t('reminder: the same rank twice in one project is 409', (await rm({ name: `Other ${U}`, days_before: 5, rank: 1, project_id: P })).s === 409);
t('reminder: the same name and days twice in one project is 409', (await rm({ name: `REMINDER 1 ${U}`, days_before: 10, project_id: P })).s === 409);
t('reminder: list for one project shows only its own, in rank order', (await A('GET', `/master/reminder-master?projectId=${P}`)).j.data.map((x) => x.rank).join() === '1,2');
t('reminder: a bad project filter is 400', (await A('GET', '/master/reminder-master?projectId=zzz')).s === 400);
t('reminder: the old body (name, days_before, channel) still works', (await rm({ name: `Old ${U}`, days_before: 3, channel: 'sms' })).s === 201);
for (const [n, b] of [['unknown project', { name: `a${U}`, days_before: 1, project_id: NIL }], ['project not an id', { name: `b${U}`, days_before: 1, project_id: 'x' }], ['rank 1.5', { name: `c${U}`, days_before: 1, rank: 1.5 }], ['rank negative', { name: `d${U}`, days_before: 1, rank: -1 }], ['rank text', { name: `e${U}`, days_before: 1, rank: 'first' }], ['days 4000', { name: `f${U}`, days_before: 4000 }], ['no days', { name: `g${U}` }], ['no name', { days_before: 1 }], ['prefix markup', { name: `h${U}`, days_before: 1, prefix_name: '<i>' }]]) t(`reminder: ${n} is 400 or 404`, [400, 404].includes((await rm(b)).s), n);
t('reminder: viewer 403; delete works and then 404', (await RO('POST', '/master/reminder-master', { name: 'q', days_before: 1 })).s === 403 && (await A('DELETE', `/master/reminder-master/${R1}`)).s === 200 && (await A('DELETE', `/master/reminder-master/${R1}`)).s === 404);

// ---------- random hostile run ----------
const junk = () => pick([null, '', ' ', 0, -1, 1e21, 'x'.repeat(300), '<script>', [], {}, [1, 2], true, 'ü', '9'.repeat(30), NIL, 'Super Area', ['Carpet Area'], '2022-02-30']);
const keys = ['name', 'description', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft', 'super_area_sqft', 'built_up_area_sqft', 'udsl_area_sqft', 'plot_area', 'plot_area_unit', 'group_name', 'rate_type', 'area_type', 'rate_basis', 'show_on_payment_file', 'construction_cost', 'udsl_cost', 'unit_of_measurement', 'rate_date', 'unit_map_url', 'project_id', 'days_before', 'rank', 'prefix_name', 'channel'];
const hostile = [];
for (let i = 0; i < 180; i++) { const b = {}; for (const k of keys) if (rnd() < 0.4) b[k] = junk(); const [m, p] = pick([['POST', '/master/unit-types'], ['PUT', `/master/unit-types/${T1}`], ['POST', '/master/reminder-master']]); hostile.push(await A(m, p, rnd() < 0.1 ? junk() : b)); }
t('random run: 180 hostile bodies, no server error', no5(hostile), hostile.filter((x) => x.s >= 500).slice(0, 2));
t('random run: the project still has its valid unit type rows and none with markup', psql(`select count(*) from unit_types where project_id='${P}' and (name ~ '[<>]' or coalesce(group_name,'') ~ '[<>]')`) === '0');

// ---------- batch 2: add-on options, interest master type and frequency, project card, tower ----------
const AF = call(await login('accounts_finance@test.local'));
const am = (b) => A('POST', '/addon-charges/master', { projectId: P, ...b });
r = await am({ chargeName: `Restoration ${U}`, rateType: 'per_sqft', ratePerSqftInr: 25, chargeType: 'Restoration', applyDateType: 'Possession', calculateRateType: 'Old Area', includeInDues: false });
t('add-on: charge type, apply date, calculate rate type and include in dues are kept', r.s === 201 && r.j.data.charge_type === 'Restoration' && r.j.data.apply_date_type === 'Possession' && r.j.data.include_in_dues === false, r);
const AM1 = r.j?.data?.id;
r = await am({ chargeName: `Plain ${U}`, defaultAmount: 1000 });
t('add-on: old body defaults to Customer Wise Date, Carpet Area, in dues', r.s === 201 && r.j.data.apply_date_type === 'Customer Wise Date' && r.j.data.calculate_rate_type === 'Carpet Area' && r.j.data.include_in_dues === true, r);
for (const [n, b] of [['apply date unknown', { applyDateType: 'Tomorrow' }], ['include in dues text', { includeInDues: 'yes' }], ['charge type markup', { chargeType: '<b>' }], ['charge type 31 chars', { chargeType: 'c'.repeat(31) }]]) t(`add-on: ${n} is 400`, (await am({ chargeName: `Bad ${n} ${U}`.slice(0, 60), defaultAmount: 5, ...b })).s === 400, n);
r = await A('PATCH', `/addon-charges/master/${AM1}`, { applyDateType: 'Customer Wise Date' }); t('add-on: edit one option keeps the rest', r.s === 200 && r.j.data.apply_date_type === 'Customer Wise Date' && r.j.data.charge_type === 'Restoration' && r.j.data.include_in_dues === false, r);
t('add-on: edit with a bad option is 400', (await A('PATCH', `/addon-charges/master/${AM1}`, { applyDateType: 'x' })).s === 400);

const im = (b) => AF('POST', '/payments/interest-master', { project_id: P, ...b });
r = await im({ rate_percent: 15, effective_from: '2022-01-01', interest_type: 'Simple', calculated_on: 'Receipt Date Wise' });
t('interest: 15% simple from 2022-01-01 calculated on receipt date', r.s === 200 && r.j.data.interest_type === 'Simple' && r.j.data.compound_frequency === null && r.j.data.calculated_on === 'Receipt Date Wise', r); const IM1 = r.j?.data?.id;
r = await im({ rate_percent: 12, effective_from: '2023-01-01', interest_type: 'Compound', compound_frequency: 'Quarterly' }); t('interest: compound quarterly is kept', r.s === 200 && r.j.data.compound_frequency === 'Quarterly', r); const IM2 = r.j?.data?.id;
t('interest: old body (rate and date) still works as Simple', (await im({ rate_percent: 9, effective_from: '2024-01-01' })).j?.data?.interest_type === 'Simple');
for (const [n, b] of [['compound without frequency', { interest_type: 'Compound' }], ['simple with a frequency', { interest_type: 'Simple', compound_frequency: 'Monthly' }], ['unknown type', { interest_type: 'Flat' }], ['unknown frequency', { interest_type: 'Compound', compound_frequency: 'Daily' }], ['calculated_on markup', { calculated_on: '<x>' }]]) t(`interest: ${n} is 400`, (await im({ rate_percent: 5, effective_from: '2030-01-01', ...b })).s === 400, n);
r = await AF('PUT', `/payments/interest-master/${IM2}`, { rate_percent: 12, interest_type: 'Simple' }); t('interest: switching compound to simple clears the frequency', r.s === 200 && r.j.data.interest_type === 'Simple' && r.j.data.compound_frequency === null, r);
t('interest: sales and viewer cannot write', (await SE('POST', '/payments/interest-master', { project_id: P, rate_percent: 5 })).s === 403 && (await RO('PUT', `/payments/interest-master/${IM1}`, { rate_percent: 5 })).s === 403);

r = await A('PATCH', `/projects/${P}/card`, { projectType: 'Commercial', landAreaUnit: 'Sq. Ft.' }); t('card: project type and land area unit are kept', r.s === 200 && r.j.data.project_type === 'Commercial', r);
for (const [n, b] of [['unknown type', { projectType: 'Hotel' }], ['unit not in Area Types', { landAreaUnit: 'Furlong' }], ['empty body', {}]]) t(`card: ${n} is 400`, (await A('PATCH', `/projects/${P}/card`, b)).s === 400, n);
t('card: unknown project is 404, viewer 403, no login 401', (await A('PATCH', `/projects/${NIL}/card`, { projectType: 'SCO' })).s === 404 && (await RO('PATCH', `/projects/${P}/card`, { projectType: 'SCO' })).s === 403 && (await NO('PATCH', `/projects/${P}/card`, { projectType: 'SCO' })).s === 401);
r = await A('PATCH', `/projects/${P}/card`, { projectType: null }); t('card: type can be cleared', r.s === 200 && r.j.data.project_type === null, r);

r = await A('POST', `/projects/${P}/towers`, { towerName: `Tower A ${U}` }); const TW = r.j?.data?.id || r.j?.data?.[0]?.id;
r = await A('PATCH', `/projects/${P}/towers/${TW}`, { towerName: `Tower B ${U}`, addressPrefix: 'B-', sortOrder: 2, completionDate: '2026-03-31' });
t('tower: new name, address prefix, sort order and completion date', r.s === 200 && r.j.data.address_prefix === 'B-' && r.j.data.sort_order === 2 && r.j.data.completion_date === '2026-03-31', r);
for (const [n, b] of [['sort order 1.5', { sortOrder: 1.5 }], ['sort order negative', { sortOrder: -1 }], ['bad date', { completionDate: '2026-02-30' }], ['prefix 21 chars', { addressPrefix: 'p'.repeat(21) }], ['empty body', {}], ['empty name', { towerName: '  ' }]]) t(`tower: ${n} is 400`, (await A('PATCH', `/projects/${P}/towers/${TW}`, b)).s === 400, n);
await A('POST', `/projects/${P}/towers`, { towerName: `Tower C ${U}` });
t('tower: a name used by another tower is 409', (await A('PATCH', `/projects/${P}/towers/${TW}`, { towerName: `tower c ${U}` })).s === 409);
t('tower: of another project is 404, viewer 403', (await A('PATCH', `/projects/${P2}/towers/${TW}`, { sortOrder: 1 })).s === 404 && (await RO('PATCH', `/projects/${P}/towers/${TW}`, { sortOrder: 1 })).s === 403);
r = await A('PATCH', `/projects/${P}/towers/${TW}`, { completionDate: null, sortOrder: '' }); t('tower: date and sort order can be cleared', r.s === 200 && r.j.data.completion_date === null && r.j.data.sort_order === null, r);

// ---------- Other Charge master flags ----------
r = await am({ chargeName: `Covered Parking ${U}`, defaultAmount: 300000, chargeType: 'Parking', isMandatory: true, isParking: true, inventoryBase: true, multipleBooking: true, isAgreement: true, quantity: 2, effectiveDate: '2022-12-24', description: 'Car parking, one or two slots' });
t('other charge: all flags, quantity, effective date and description are kept', r.s === 201 && r.j.data.is_mandatory && r.j.data.is_parking && r.j.data.inventory_base && r.j.data.multiple_booking && r.j.data.is_agreement && !r.j.data.is_alteration && r.j.data.quantity === 2 && String(r.j.data.effective_date).startsWith('2022-12-2') && r.j.data.description.startsWith('Car parking'), r);
const OC = r.j?.data?.id;
t('other charge: plain body leaves every flag off and quantity empty', (await am({ chargeName: `Plain2 ${U}`, defaultAmount: 5 })).j?.data?.is_mandatory === false);
for (const [n, b] of [['inventory base without parking', { inventoryBase: true }], ['flag as text', { isMandatory: 'yes' }], ['quantity 1.5', { quantity: 1.5 }], ['quantity negative', { quantity: -1 }], ['quantity text', { quantity: 'two' }], ['bad effective date', { effectiveDate: '2022-02-31' }], ['description 501 chars', { description: 'd'.repeat(501) }], ['description markup', { description: '<script>' }]]) t(`other charge: ${n} is 400`, (await am({ chargeName: `Bad ${n} ${U}`.slice(0, 60), defaultAmount: 5, ...b })).s === 400, n);
r = await A('PATCH', `/addon-charges/master/${OC}`, { isAlteration: true }); t('other charge: edit one flag keeps the rest', r.s === 200 && r.j.data.is_alteration && r.j.data.is_parking && r.j.data.quantity === 2, r);
r = await A('PATCH', `/addon-charges/master/${OC}`, { quantity: null, effectiveDate: null, description: null }); t('other charge: quantity, date and description can be cleared', r.s === 200 && r.j.data.quantity === null && r.j.data.effective_date === null && r.j.data.description === null, r);
t('other charge: turning parking off while inventory base is on is 400', (await A('PATCH', `/addon-charges/master/${OC}`, { isParking: false })).s === 400);
t('other charge: viewer and sales cannot write', (await RO('PATCH', `/addon-charges/master/${OC}`, { isMandatory: false })).s === 403 && (await SE('POST', '/addon-charges/master', { projectId: P, chargeName: 'z' })).s === 403);

// ---------- the rate date comes back as the same day (no one-day-early shift) and survives an edit ----------
r = await ut({ name: `Dated ${U}`, carpet_area_sqft: 100, base_rate_sqft: 10, rate_date: '2022-12-24' });
t('unit type: rate date is returned as the day saved', r.s === 201 && r.j.data.rate_date === '2022-12-24', r);
const DT = r.j?.data?.id;
r = await A('PUT', `/master/unit-types/${DT}`, { group_name: 'G' }); t('unit type: an edit keeps the rate date', r.s === 200 && r.j.data.rate_date === '2022-12-24', r);
t('unit type: the list shows the same day', ((await A('GET', `/master/unit-types?project_id=${P}`)).j?.data || []).find((x) => x.id === DT)?.rate_date === '2022-12-24');

// ---------- plan header: type and note ----------
r = await A('POST', `/projects/${P}/plans/standard`, { plan_name: `Std ${U}` }); t('plan: standard plan made', r.s === 201, r);
r = await A('GET', `/projects/${P}/plans`); t('plan: a plan without a header is Time Linked with no note', r.j.data.find((x) => x.plan_name === `Std ${U}`)?.plan_type === 'Time Linked');
r = await A('PUT', `/projects/${P}/plans/header`, { plan_name: `Std ${U}`, plan_type: 'Construction Linked', description: 'Linked to the stages' }); t('plan: type and note are saved', r.s === 200 && r.j.data.plan_type === 'Construction Linked', r);
r = await A('GET', `/projects/${P}/plans`); t('plan: the list shows them', r.j.data.find((x) => x.plan_name === `Std ${U}`)?.description === 'Linked to the stages');
t('plan: the name is matched without case', (await A('PUT', `/projects/${P}/plans/header`, { plan_name: `STD ${U}`, plan_type: 'Flexi' })).s === 200 && (await A('GET', `/projects/${P}/plans`)).j.data.filter((x) => x.plan_name.toLowerCase() === `std ${U}`.toLowerCase()).length === 1);
for (const [n, b] of [['unknown type', { plan_type: 'Weekly' }], ['note 501 chars', { plan_type: 'Flexi', description: 'd'.repeat(501) }], ['note markup', { plan_type: 'Flexi', description: '<b>' }], ['no plan name', { plan_name: '', plan_type: 'Flexi' }]]) t(`plan: ${n} is 400`, (await A('PUT', `/projects/${P}/plans/header`, { plan_name: `Std ${U}`, ...b })).s === 400, n);
t('plan: a plan that does not exist is 404', (await A('PUT', `/projects/${P}/plans/header`, { plan_name: `Nope ${U}`, plan_type: 'Flexi' })).s === 404);
t('plan: viewer and sales cannot write, no login is 401', (await RO('PUT', `/projects/${P}/plans/header`, { plan_name: `Std ${U}`, plan_type: 'Flexi' })).s === 403 && (await NO('PUT', `/projects/${P}/plans/header`, {})).s === 401);
r = await A('POST', `/projects/${P}/plans/copy`, { from: `Std ${U}`, to: `Copy ${U}` }); t('plan: a copy keeps the type', r.s === 201 && (await A('GET', `/projects/${P}/plans`)).j.data.find((x) => x.plan_name === `Copy ${U}`)?.plan_type === 'Flexi', r);
await A('DELETE', `/projects/${P}/plans?planName=${encodeURIComponent('Copy ' + U)}`);
t('plan: deleting a plan removes its header', psql(`select count(*) from plan_headers where project_id='${P}' and lower(plan_name)=lower('Copy ${U}')`) === '0');
await A('DELETE', `/projects/${P}/plans?planName=${encodeURIComponent('Std ' + U)}`);

// ---------- customer classification per project ----------
const cc = (b) => A('POST', '/master/customer-classifications', { project_id: P, ...b });
r = await A('GET', `/master/customer-classifications?projectId=${P}`); t('classification: a new project has no own list and uses the standard three', r.s === 200 && r.j.using_defaults === true && r.j.defaults.join() === 'EWS,LIG,MIG', r);
r = await cc({ name: `Staff ${U}` }); t('classification: the first own name starts the list with the standard three kept', r.s === 201 && (await A('GET', `/master/customer-classifications?projectId=${P}`)).j.data.map((x) => x.name).sort().join() === ['EWS', 'LIG', 'MIG', `Staff ${U}`].sort().join(), r); const CC1 = r.j?.data?.id;
t('classification: the same name again (any case) is 409', (await cc({ name: `STAFF ${U}` })).s === 409);
t('classification: another project keeps the standard list', (await A('GET', `/master/customer-classifications?projectId=${P2}`)).j.using_defaults === true);
for (const [n, b] of [['empty name', { name: '' }], ['51 chars', { name: 'n'.repeat(51) }], ['markup', { name: '<b>' }], ['no project', { project_id: undefined, name: 'x' }], ['unknown project', { project_id: NIL, name: 'x' }]]) t(`classification: ${n} is 400 or 404`, [400, 404].includes((await cc(b)).s), n);
t('classification: defaults on a project that has its own list is 409', (await A('POST', '/master/customer-classifications/defaults', { project_id: P })).s === 409);
r = await A('POST', '/master/customer-classifications/defaults', { project_id: P2 }); t('classification: defaults copies EWS, LIG, MIG into the project', r.s === 201 && r.j.data.length === 3, r);
// the booking / applicant rule follows the project list
const cn = (name, cls, proj = P) => A('POST', '/consumers', { name, mobile: '9' + String(ri(100000000, 999999999)), projectId: proj, incomeCategory: cls });
t('classification: an applicant can carry the project own name', (await cn(`Class A ${U}`, `Staff ${U}`)).s === 201);
t('classification: a name that is not in the project list is 400', (await cn(`Class B ${U}`, 'Gold')).s === 400);
t('classification: a project without its own list still takes EWS and refuses others', (await cn(`Class C ${U}`, 'EWS', (await A('POST', '/projects', { name: `SPP3 ${U}`, reraNumber: `R3-${U}`, tcpLicence: `T3-${U}`, companyId: co })).j?.data?.id)).s === 201);
r = await A('PUT', `/master/customer-classifications/${CC1}`, { name: `Staff2 ${U}` }); t('classification: rename follows the customers of the project', r.s === 200 && r.j.customers_updated === 1, r);
t('classification: a name carried by a customer cannot be deleted', (await A('DELETE', `/master/customer-classifications/${CC1}`)).s === 409);
const sp = (await A('GET', `/master/customer-classifications?projectId=${P}`)).j.data.find((x) => x.name === 'MIG')?.id;
t('classification: an unused name can be deleted', (await A('DELETE', `/master/customer-classifications/${sp}`)).s === 200);
t('classification: viewer and sales cannot write, no login is 401', (await RO('POST', '/master/customer-classifications', { project_id: P, name: 'z' })).s === 403 && (await SE('DELETE', `/master/customer-classifications/${CC1}`)).s === 403 && (await NO('GET', `/master/customer-classifications?projectId=${P}`)).s === 401);

// ---------- rate history ----------
r = await ut({ name: `Hist ${U}`, super_area_sqft: 500, carpet_area_sqft: 250, base_rate_sqft: 4000, rate_basis: 'Super Area', rate_date: '2023-01-01' }); const HT = r.j?.data?.id;
t('rate history: a new rate is the first line', (await A('GET', `/master/unit-types/${HT}/rate-history`)).j?.data?.length === 1);
await A('PUT', `/master/unit-types/${HT}`, { group_name: 'Only a note' }); t('rate history: an edit that keeps the rate adds no line', (await A('GET', `/master/unit-types/${HT}/rate-history`)).j?.data?.length === 1);
await A('PUT', `/master/unit-types/${HT}`, { base_rate_sqft: 4500, rate_date: '2024-01-01' });
r = await A('GET', `/master/unit-types/${HT}/rate-history`); t('rate history: a changed rate adds a line, newest first, with the rate date', r.j?.data?.length === 2 && Number(r.j.data[0].base_rate) === 4500 && r.j.data[0].rate_date === '2024-01-01' && Number(r.j.data[1].base_rate) === 4000, r);
await A('PUT', `/master/unit-types/${HT}`, { rate_basis: 'Carpet Area' }); t('rate history: a changed basis adds a line', (await A('GET', `/master/unit-types/${HT}/rate-history`)).j?.data?.length === 3);
t('rate history: bad id is 400, no login is 401', (await A('GET', '/master/unit-types/zzz/rate-history')).s === 400 && (await NO('GET', `/master/unit-types/${HT}/rate-history`)).s === 401);

// ---------- project dates come back as the day saved ----------
r = await A('PATCH', `/projects/${P}`, { licenseDate: '2022-05-04', saleDeedDate: '2023-01-01', villageName: 'Sohna' }); t('project: legal dates and village are saved', r.s === 200, r);
r = await A('GET', `/projects/${P}`); t('project: the dates are returned as the same day (no one-day-early shift)', r.j?.data?.license_date === '2022-05-04' && r.j.data.sale_deed_date === '2023-01-01' && r.j.data.village_name === 'Sohna', r.j?.data);

// ---------- units: unit type fills the type, location, edit ----------
r = await A('POST', '/projects/' + P + '/towers', { towerName: `UT Tower ${U}` }); const UTW = r.j?.data?.id;
r = await A('POST', `/projects/${P}/unit-locations`, { name: `Corner ${U}` }); const LOC = r.j?.data?.id;
r = await A('POST', `/projects/${P2}/unit-locations`, { name: `Other ${U}` }); const LOC2 = r.j?.data?.id;
const mkUnit = (b) => A('POST', '/units', { projectId: P, towerId: UTW, floor: 1, ...b });
r = await mkUnit({ unitNumber: `U1-${U}`, unitTypeId: T1, superAreaSqft: 510, carpetAreaSqft: 255, basePriceInr: 2550000, totalPriceInr: 2550000, unitLocationId: LOC }); t('unit: a unit type without a typed BHK type takes the type name, and the location is kept', r.s === 201 && r.j.data.bhk_type.startsWith('510 Sq. Ft.'), r); const U1 = r.j?.data?.id;
r = await A('GET', `/units/${U1}`); t('unit: the detail shows type and location ids', r.j?.data?.unit_type_id === T1 && r.j.data.unit_location_id === LOC, r.j?.data);
t('unit: no unit type and no BHK type is 400', (await mkUnit({ unitNumber: `U2-${U}` })).s === 400);
t('unit: a location of another project is 400', (await mkUnit({ unitNumber: `U3-${U}`, unitTypeId: T1, unitLocationId: LOC2 })).s === 400);
t('unit: a unit type of another project is 400', (await A('POST', '/units', { projectId: P2, towerId: (await A('POST', `/projects/${P2}/towers`, { towerName: 'Tw ' + U })).j.data.id, floor: 1, unitNumber: 'X1', unitTypeId: T1 })).s === 400);
r = await A('PATCH', `/units/${U1}`, { unitNumber: `U1b-${U}`, floor: 2, facing: 'East', unitLocationId: null }); t('unit edit: number, floor, facing and location can change on a free unit', r.s === 200 && r.j.data.unit_number === `U1b-${U}`, r);
r = await A('GET', `/units/${U1}`); t('unit edit: they were saved', r.j.data.floor === 2 && r.j.data.facing === 'East' && r.j.data.unit_location_id === null, r.j?.data);
const U2 = (await mkUnit({ unitNumber: `U4-${U}`, unitTypeId: T1 })).j?.data?.id;
t('unit edit: a number used in the tower is 409 (any case)', (await A('PATCH', `/units/${U2}`, { unitNumber: `u1b-${U}` })).s === 409);
t('unit edit: a location of another project is 400', (await A('PATCH', `/units/${U2}`, { unitLocationId: LOC2 })).s === 400);
t('unit edit: a floor of 301 is 400', (await A('PATCH', `/units/${U2}`, { floor: 301 })).s === 400);
psql(`update units set status = 'allotted' where id = '${U2}'`);
t('unit edit: a unit that is allotted keeps its number and type', (await A('PATCH', `/units/${U2}`, { unitNumber: `Z-${U}` })).s === 409 && (await A('PATCH', `/units/${U2}`, { unitTypeId: null })).s === 409);
t('unit edit: but its floor and facing can still change', (await A('PATCH', `/units/${U2}`, { floor: 3, facing: 'West' })).s === 200);
t('unit edit: viewer and sales cannot, no login is 401', (await RO('PATCH', `/units/${U1}`, { floor: 5 })).s === 403 && (await NO('PATCH', `/units/${U1}`, { floor: 5 })).s === 401);
psql(`update units set status = 'available' where id = '${U2}'`);

// ---------- a unit type carried to its units ----------
r = await ut({ name: `Carry ${U}`, super_area_sqft: 400, carpet_area_sqft: 200, base_rate_sqft: 1000, rate_basis: 'Super Area' }); const CT = r.j?.data?.id;
const cu = [];
for (const n of [1, 2, 3]) cu.push((await A('POST', '/units', { projectId: P, towerId: UTW, floor: 1, unitNumber: `K${n}-${U}`, unitTypeId: CT, superAreaSqft: 1, carpetAreaSqft: 1, basePriceInr: 1, totalPriceInr: 1 })).j?.data?.id);
psql(`update units set status = 'allotted' where id = '${cu[2]}'`);
r = await A('POST', `/master/unit-types/${CT}/apply-to-units`, { preview: true }); t('apply: preview counts the units that can change and the one that is sold, and changes nothing', r.s === 200 && r.j.data.matching === 3 && r.j.data.updatable === 2 && r.j.data.booked === 1 && r.j.data.updated === 0 && r.j.data.price === 400000, r.j);
t('apply: the preview changed no unit', psql(`select count(*) from units where unit_type_id = '${CT}' and base_price_inr = 1`) === '3');
r = await A('POST', `/master/unit-types/${CT}/apply-to-units`, {}); t('apply: two units are updated', r.s === 200 && r.j.data.updated === 2, r.j);
t('apply: they have the type areas and price, the sold one is as it was', psql(`select string_agg(super_area_sqft::text || '/' || base_price_inr::text, ',' order by unit_number) from units where unit_type_id = '${CT}'`) === '400.000/400000,400.000/400000,1.000/1', psql(`select string_agg(super_area_sqft::text || '/' || base_price_inr::text, ',' order by unit_number) from units where unit_type_id = '${CT}'`));
t('apply: unknown type 404, bad id 400, viewer 403, no login 401', (await A('POST', `/master/unit-types/${NIL}/apply-to-units`, {})).s === 404 && (await A('POST', '/master/unit-types/zzz/apply-to-units', {})).s === 400 && (await RO('POST', `/master/unit-types/${CT}/apply-to-units`, {})).s === 403 && (await NO('POST', `/master/unit-types/${CT}/apply-to-units`, {})).s === 401);
psql(`update units set status = 'available' where id = '${cu[2]}'`);

// ---------- CSV import names the unit type and location ----------
const imp = (csvText, preview) => A('POST', preview ? '/import/preview' : '/import', { csvText, projectId: P, importType: 'units', fileName: 'u.csv' });
const unitsOf = (tag) => psql(`select count(*) from units where unit_number like '${tag}%' and project_id = '${P}'`);
r = await imp(`unitNumber,tower,floor,unitType,location,facing\nI1-${U},IT${U},1,510 sq. ft. ${U},Corner ${U},East\nI2-${U},IT${U},2,510 Sq. Ft. ${U},,`);
t('csv: unitNumber, tower, floor and unitType are enough; areas and price come from the type', r.s === 200 && r.j.data.created === 2, r);
t('csv: the unit has the type, its price (510 x 5000), the location and the type name', psql(`select u.base_price_inr || '/' || u.super_area_sqft || '/' || (u.unit_type_id is not null) || '/' || (u.unit_location_id is not null) || '/' || u.bhk_type from units u where unit_number = 'I1-${U}' and project_id = '${P}'`) === `2550000/510.000/true/true/510 Sq. Ft. ${U}`, psql(`select u.base_price_inr || '/' || u.super_area_sqft || '/' || (u.unit_type_id is not null) || '/' || (u.unit_location_id is not null) || '/' || u.bhk_type from units u where unit_number = 'I1-${U}' and project_id = '${P}'`));
r = await imp(`unitNumber,tower,floor,unitType,totalPriceInr\nI3-${U},IT${U},3,510 Sq. Ft. ${U},9999999`); t('csv: a price in the file beats the type price', r.s === 200 && psql(`select total_price_inr from units where unit_number = 'I3-${U}' and project_id = '${P}'`) === '9999999', r);
r = await imp(`unitNumber,tower,floor,unitType\nI4-${U},IT${U},1,510 Sq. Ft. ${U}\nI5-${U},IT${U},1,No such type`); t('csv: an unknown unit type stops the whole file, nothing is saved', r.s === 422 && unitsOf('I4-') === '0' && String(r.j.error).includes('No such type'), r);
t('csv: an unknown location stops the file', (await imp(`unitNumber,tower,floor,unitType,location\nI6-${U},IT${U},1,510 Sq. Ft. ${U},Nowhere`)).s === 422);
t('csv: the old columns (bhkType, totalPriceInr) still work', (await imp(`unitNumber,tower,floor,bhkType,totalPriceInr\nI7-${U},IT${U},1,2BHK,5000000`)).s === 200);
t('csv: no unitType and no bhkType is 400', (await imp(`unitNumber,tower,floor\nI8-${U},IT${U},1`)).s === 400);
r = await imp(`unitNumber,tower,floor,unitType\nI9-${U},IT${U},1,510 Sq. Ft. ${U}`, true); t('csv: preview checks the unit type too and saves nothing', r.s === 200 && r.j.data.validRows === 1 && unitsOf('I9-') === '0', r);
t('csv: the same unit twice in the file is refused', (await imp(`unitNumber,tower,floor,unitType\nIA-${U},IT${U},1,510 Sq. Ft. ${U}\nia-${U},IT${U},1,510 Sq. Ft. ${U}`)).s === 422);

// ---------- price of many units ----------
r = await ut({ name: `Bulk ${U}`, carpet_area_sqft: 100, base_rate_sqft: 100 }); const BT = r.j?.data?.id;
const bu = []; for (const n of [1, 2, 3]) bu.push((await A('POST', '/units', { projectId: P, towerId: UTW, floor: 1, unitNumber: `BP${n}-${U}`, unitTypeId: BT, basePriceInr: 1000000, totalPriceInr: 1100000 })).j?.data?.id);
psql(`update units set status = 'allotted' where id = '${bu[2]}'`);
const bp = (b) => A('POST', '/units/bulk-price', { projectId: P, unitTypeId: BT, ...b });
r = await bp({ mode: 'percent', value: 10, preview: true }); t('bulk price: preview counts the two unbooked units and shows one example, saving nothing', r.s === 200 && r.j.data.units === 2 && r.j.data.sample.after === 1100000 && psql(`select count(*) from units where unit_type_id = '${BT}' and base_price_inr = 1000000`) === '3', r);
r = await bp({ mode: 'percent', value: 10 }); t('bulk price: +10% is applied to the two unbooked units, base and total move together', r.s === 200 && r.j.data.updated === 2 && psql(`select string_agg(base_price_inr || '/' || total_price_inr, ',' order by unit_number) from units where unit_type_id = '${BT}'`) === '1100000/1200000,1100000/1200000,1000000/1100000', psql(`select string_agg(base_price_inr || '/' || total_price_inr, ',' order by unit_number) from units where unit_type_id = '${BT}'`));
r = await bp({ mode: 'amount', value: -100000 }); t('bulk price: minus 100000 lowers them again', r.s === 200 && psql(`select base_price_inr from units where unit_number = 'BP1-${U}'`) === '1000000', r);
for (const [n, b] of [['value zero', { mode: 'percent', value: 0 }], ['minus 100%', { mode: 'percent', value: -100 }], ['a price that falls to zero', { mode: 'amount', value: -1000000 }], ['unknown mode', { mode: 'half', value: 5 }], ['value text', { mode: 'amount', value: 'ten' }]]) t(`bulk price: ${n} is 400`, (await bp(b)).s === 400, n);
t('bulk price: unknown project is 404, viewer 403, no login 401', (await A('POST', '/units/bulk-price', { projectId: NIL, mode: 'amount', value: 5 })).s === 404 && (await RO('POST', '/units/bulk-price', { projectId: P, mode: 'amount', value: 5 })).s === 403 && (await NO('POST', '/units/bulk-price', {})).s === 401);
psql(`update units set status = 'available' where id = '${bu[2]}'`);

// ---------- edit project: the five fields that only the new-project form had ----------
const PE = (b) => A('PATCH', `/projects/${P}`, b);
r = await PE({ reraNumber: `RERA-E-${U}`, tcpLicence: `TCP-E-${U}`, landAreaSqft: 4.5, possessionDate: '2028-12-31', incomeCategory: 'MIG' });
const pg = (await A('GET', `/projects/${P}`)).j?.data || {};
t('edit project: RERA, licence, land area, possession date and category are saved and read back', r.s === 200 && pg.rera_number === `RERA-E-${U}` && pg.tcp_licence === `TCP-E-${U}` && Number(pg.land_area_sqft) === 4.5 && pg.possession_date === '2028-12-31' && pg.group_name === 'MIG', pg);
t('edit project: a blank RERA or licence is 400 and the stored value stays', (await PE({ reraNumber: '  ' })).s === 400 && (await PE({ tcpLicence: '' })).s === 400 && (await A('GET', `/projects/${P}`)).j?.data?.rera_number === `RERA-E-${U}`);
t('edit project: another project\'s RERA number is 409', (await A('PATCH', `/projects/${P2}`, { reraNumber: `rera-e-${U}` })).s === 409);
t('edit project: land area minus or text is 400, bad date is 400', (await PE({ landAreaSqft: -1 })).s === 400 && (await PE({ landAreaSqft: 'big' })).s === 400 && (await PE({ possessionDate: 'tomorrow' })).s === 400);
t('edit project: a field left out keeps its value', (await PE({ location: 'Somewhere' })).s === 200 && (await A('GET', `/projects/${P}`)).j?.data?.possession_date === '2028-12-31');

// ---------- the floors-x-units tool (bulk-import) ties each unit to its type ----------
r = await A('POST', '/units/bulk-import', { projectId: P, rows: [{ towerId: UTW, floor: 4, unitNumber: `GN1-${U}`, unitTypeId: BT, carpetAreaSqft: 100, balconyAreaSqft: 12.5, basePriceInr: 5000, totalPriceInr: 5000 }] });
t('bulk-import: a row with unitTypeId is tied to the type, takes its name and keeps the balcony area', r.s === 200 && r.j.data.created === 1 && psql(`select unit_type_id || '/' || bhk_type || '/' || balcony_area_sqft::float8 from units where unit_number = 'GN1-${U}'`) === `${BT}/Bulk ${U}/12.5`, psql(`select unit_type_id || '/' || bhk_type || '/' || balcony_area_sqft::float8 from units where unit_number = 'GN1-${U}'`));
r = await A('POST', '/units/bulk-import', { projectId: P, rows: [{ towerId: UTW, floor: 4, unitNumber: `GN2-${U}`, unitTypeId: NIL, carpetAreaSqft: 100, totalPriceInr: 5000 }] });
t('bulk-import: a unit type of another project or a missing one is skipped with a reason', r.s === 200 && r.j.data.created === 0 && /unit type/.test(r.j.data.errors[0]?.reason || ''), r);

// ---------- balcony charge limits per project ----------
const BS = (b) => A('PUT', `/projects/${P}/settings`, b);
r = await BS({ balcony_max_area_sqft: 100, balcony_max_charge_inr: 40000.5 });
t('balcony limits: area and amount are saved with the project and read back', r.s === 200 && r.j.data.balcony_max_area_sqft === 100 && r.j.data.balcony_max_charge_inr === 40000.5 && (await A('GET', `/projects/${P}/settings`)).j?.data?.balcony_max_area_sqft === 100, r);
t('balcony limits: saving numbering alone keeps them', (await BS({ receipt_prefix: 'ZZ' })).j?.data?.balcony_max_charge_inr === 40000.5);
for (const [n, b] of [['zero area', { balcony_max_area_sqft: 0 }], ['zero amount', { balcony_max_charge_inr: 0 }], ['minus area', { balcony_max_area_sqft: -5 }], ['text amount', { balcony_max_charge_inr: 'lots' }], ['four decimals of area', { balcony_max_area_sqft: 1.2345 }]]) t(`balcony limits: ${n} is 400 and nothing changes`, (await BS(b)).s === 400 && (await A('GET', `/projects/${P}/settings`)).j?.data?.balcony_max_area_sqft === 100, n);
t('balcony limits: viewer cannot save, other project is not touched', (await RO('PUT', `/projects/${P}/settings`, { balcony_max_area_sqft: 5 })).s === 403 && (await A('GET', `/projects/${P2}/settings`)).j?.data?.balcony_max_area_sqft === null);
const { computeBalconyCharge } = await import('../../packages/api/dist/utils/balcony-charge.js');
const bc = (area, cap, maxA, g = 0) => computeBalconyCharge(area, 500, cap, g, g, maxA).balconyChargeAmount;
t('balcony charge: whole area when the project has no area limit, first N sqft when it has', bc(120, null, null) === 60000 && bc(120, null, 100) === 50000 && bc(80, null, 100) === 40000);
t('balcony charge: the amount cap applies after the area limit, whichever is smaller', bc(120, 40000, 100) === 40000 && bc(120, 70000, 100) === 50000 && bc(120, 40000, null) === 40000);
t('balcony charge: GST goes on top of the limited amount', computeBalconyCharge(120, 500, 40000, 0.025, 0.025, 100).balconyCgstAmount === 1000);
r = await BS({ balcony_max_area_sqft: null, balcony_max_charge_inr: '' });
t('balcony limits: blank clears both (no project rule)', r.s === 200 && r.j.data.balcony_max_area_sqft === null && r.j.data.balcony_max_charge_inr === null, r);

// ---------- delete a unit made by mistake ----------
r = await A('POST', '/units', { projectId: P, towerId: UTW, floor: 7, unitNumber: `DEL1-${U}`, bhkType: '2BHK', carpetAreaSqft: 100, basePriceInr: 1000, totalPriceInr: 1000 }); const DU = r.j?.data?.id;
t('unit delete: viewer is refused, bad id 400, unknown id 404, no login 401', (await RO('DELETE', `/units/${DU}`)).s === 403 && (await A('DELETE', '/units/not-an-id')).s === 400 && (await A('DELETE', `/units/${NIL}`)).s === 404 && (await NO('DELETE', `/units/${DU}`)).s === 401);
psql(`update units set status = 'allotted' where id = '${DU}'`);
r = await A('DELETE', `/units/${DU}`);
t('unit delete: a unit that is not available (sold, allotted) is 409 and stays', r.s === 409 && /available/.test(r.j?.error || '') && psql(`select count(*) from units where id = '${DU}'`) === '1', r);
psql(`update units set status = 'available' where id = '${DU}'`);
r = await A('DELETE', `/units/${DU}`);
t('unit delete: an available unit nothing uses is deleted (its charges go with it)', r.s === 200 && psql(`select count(*) from units where id = '${DU}'`) === '0', r);
t('unit delete: deleting it again is 404', (await A('DELETE', `/units/${DU}`)).s === 404);

// ---------- renaming a unit type renames its units ----------
r = await A('POST', '/master/unit-types', { project_id: P, name: `Ren ${U}`, carpet_area_sqft: 100, base_rate_sqft: 100 }); const RT = r.j?.data?.id;
await A('POST', '/units', { projectId: P, towerId: UTW, floor: 8, unitNumber: `REN1-${U}`, unitTypeId: RT });
r = await A('PUT', `/master/unit-types/${RT}`, { project_id: P, name: `Renamed ${U}`, carpet_area_sqft: 100, base_rate_sqft: 100 });
t('unit type rename: its units take the new name (booking form and Rate Report read it)', r.s === 200 && psql(`select bhk_type from units where unit_number = 'REN1-${U}'`) === `Renamed ${U}`, psql(`select bhk_type from units where unit_number = 'REN1-${U}'`));

// ---------- a per-sqft charge says which area it is multiplied by ----------
r = await am({ chargeName: `Club ${U}`, rateType: 'per_sqft', ratePerSqftInr: 10, calculateRateType: 'Super Area' });
t('per-sqft charge: the area it is calculated on (Super Area) is kept', r.s === 201 && r.j.data.calculate_rate_type === 'Super Area', r);
t('per-sqft charge: an unknown area is 400', (await am({ chargeName: `Bad ${U}`, rateType: 'per_sqft', ratePerSqftInr: 10, calculateRateType: 'Gaj' })).s === 400);
r = await am({ chargeName: `NoArea ${U}`, rateType: 'per_sqft', ratePerSqftInr: 10 });
t('per-sqft charge: a charge with no area chosen counts on the carpet area', r.s === 201 && r.j?.data?.calculate_rate_type === 'Carpet Area', r);

// ---------- clean up ----------
// ---------- later fixes: facing list, location rename, reminder edit, charge on plot area ----------
const FU = (await mkUnit({ unitNumber: `F1-${U}`, unitTypeId: T1 })).j?.data?.id;
const face = async (v) => { const x = await A('PATCH', `/units/${FU}`, { facing: v }); return { s: x.s, f: x.s === 200 ? (await A('GET', `/units/${FU}`)).j.data.facing : null }; };
t('facing: a direction, a short code and a spaced name are stored in full', (await face('East')).f === 'East' && (await face('sw')).f === 'South-West' && (await face('north east')).f === 'North-East');
t('facing: a made-up direction is 400 and the old value stays', (await face('Up')).s === 400 && (await face('x'.repeat(31))).s === 400 && (await face('<b>')).s === 400 && (await A('GET', `/units/${FU}`)).j.data.facing === 'North-East');
t('facing: blank clears it', (await face('')).f === null);
r = await mkUnit({ unitNumber: `F2-${U}`, facing: 'Up' }); t('facing: a new unit with a made-up direction is 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P}/unit-locations`, { name: `Rename ${U}` }); const RL = r.j?.data?.id;
t('location: rename and describe', (await A('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: `Renamed ${U}`, description: 'd' })).s === 200 && psql(`select name from unit_locations where id = '${RL}'`) === `Renamed ${U}`);
t('location: a name taken in the project is 409, blank 400, unknown 404, bad id 400, other project 404', (await A('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: `Corner ${U}` })).s === 409 && (await A('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: ' ' })).s === 400 && (await A('PATCH', `/projects/${P}/unit-locations/${NIL}`, { name: 'q' })).s === 404 && (await A('PATCH', `/projects/${P}/unit-locations/zzz`, { name: 'q' })).s === 400 && (await A('PATCH', `/projects/${P2}/unit-locations/${RL}`, { name: `Z ${U}` })).s === 404);
t('location: viewer and sales cannot rename, no login is 401', (await RO('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: 'x' })).s === 403 && (await SE('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: 'x' })).s === 403 && (await NO('PATCH', `/projects/${P}/unit-locations/${RL}`, { name: 'x' })).s === 401);
r = await A('POST', '/master/reminder-master', { name: `Rem ${U}`, days_before: 5, project_id: P, rank: 71 }); const RM = r.j?.data?.id;
r = await A('POST', '/master/reminder-master', { name: `Rem2 ${U}`, days_before: 6, project_id: P, rank: 72 }); const RM2 = r.j?.data?.id;
r = await A('PATCH', `/master/reminder-master/${RM}`, { name: `Rem ${U}b`, days_before: 9, prefix_name: 'RB', rank: 73 });
t('reminder: edit name, days, prefix and rank', r.s === 200 && r.j.data.days_before === 9 && r.j.data.prefix_name === 'RB' && r.j.data.rank === 73 && r.j.data.project_id === P, r);
t('reminder: a rank used in the project is 409, the same name and days is 409, days 99999 and blank name are 400', (await A('PATCH', `/master/reminder-master/${RM}`, { rank: 72 })).s === 409 && (await A('PATCH', `/master/reminder-master/${RM2}`, { name: `Rem ${U}b`, days_before: 9 })).s === 409 && (await A('PATCH', `/master/reminder-master/${RM}`, { days_before: 99999 })).s === 400 && (await A('PATCH', `/master/reminder-master/${RM}`, { name: ' ' })).s === 400);
t('reminder: saving itself unchanged is fine, unknown 404, bad id 400, viewer 403, no login 401', (await A('PATCH', `/master/reminder-master/${RM}`, { rank: 73 })).s === 200 && (await A('PATCH', `/master/reminder-master/${NIL}`, { name: 'q' })).s === 404 && (await A('PATCH', `/master/reminder-master/zzz`, { name: 'q' })).s === 400 && (await RO('PATCH', `/master/reminder-master/${RM}`, { name: 'q' })).s === 403 && (await NO('PATCH', `/master/reminder-master/${RM}`, { name: 'q' })).s === 401);
r = await ut({ name: `Plot ${U}`, plot_area: 200, base_rate_sqft: 1000, rate_basis: 'Plot Area' }); const PT = r.j?.data?.id;
r = await A('POST', '/addon-charges/master', { projectId: P, chargeName: `PlotRate ${U}`, rateType: 'per_sqft', ratePerSqftInr: 7, calculateRateType: 'Plot Area', cgstPct: 9, sgstPct: 9 });
t('charge: a per-sqft charge can be on the plot area', r.s === 201 && r.j.data.calculate_rate_type === 'Plot Area', r);
r = await A('POST', '/addon-charges/master', { projectId: P, chargeName: `Bad ${U}`, rateType: 'per_sqft', ratePerSqftInr: 7, calculateRateType: 'Garden Area' }); t('charge: a made-up area is 400', r.s === 400, r.s);
// ---------- floors, plots and villas, unit wise area, unit status columns ----------
const FW = `${U}`; r = await A('POST', '/projects/' + P + '/towers', { towerName: `Floors ${FW}` }); const FT = r.j?.data?.id;
const flr = (url, m = 'GET', b) => A(m, `/projects/${P}/towers/${FT}/floors${url}`, b);
await mkUnit({ unitNumber: `FL1-${U}` }).catch(() => 0);
for (const [no, fl] of [['F-G', 0], ['F-1', 1], ['F-2', 2]]) await A('POST', '/units', { projectId: P, towerId: FT, unitNumber: `${no}-${U}`, floor: fl, bhkType: 'X', carpetAreaSqft: 100, superAreaSqft: 120, basePriceInr: 1000000, totalPriceInr: 1000000 });
r = await flr(''); t('floors: the list has every floor with its unit count and the default label', r.s === 200 && r.j.data.length === 3 && r.j.data[0].label === 'Ground Floor' && r.j.data[1].label === '1st Floor' && r.j.data[2].units === 1, r);
r = await flr('/pattern', 'POST', { from: 0, to: 3, style: 'ordinal', suffix: ' Floor', preview: true }); t('floors: a pattern can be looked at first and saves nothing', r.s === 200 && r.j.data.floors.map((x) => x.floor_name).join() === 'Ground Floor,1st Floor,2nd Floor,3rd Floor' && psql(`select count(*) from floors where tower_id = '${FT}'`) === '0', r);
r = await flr('/pattern', 'POST', { from: 1, to: 3, style: 'words', prefix: 'The ', suffix: ' Level' }); t('floors: First, Second, Third with a prefix and a suffix are saved', r.s === 200 && psql(`select string_agg(floor_name, ',' order by floor_number) from floors where tower_id = '${FT}'`) === 'The First Level,The Second Level,The Third Level', r);
r = await flr(''); t('floors: the list now shows the names, and a floor without a name keeps the default', r.j.data.find((x) => x.floor_number === 1).label === 'The First Level' && r.j.data.find((x) => x.floor_number === 0).label === 'Ground Floor');
r = await flr('/1', 'PUT', { floorName: 'Shops' }); t('floors: rename one floor', r.s === 200 && r.j.data.label === 'Shops', r);
t('floors: a name used by another floor is 409, a 51 character name and markup are 400, a missing floorName is 400', (await flr('/2', 'PUT', { floorName: 'shops' })).s === 409 && (await flr('/2', 'PUT', { floorName: 'x'.repeat(51) })).s === 400 && (await flr('/2', 'PUT', { floorName: '<b>' })).s === 400 && (await flr('/2', 'PUT', {})).s === 400);
t('floors: a blank name goes back to the default', (await flr('/1', 'PUT', { floorName: '' })).j?.data?.label === '1st Floor' && psql(`select count(*) from floors where tower_id = '${FT}' and floor_number = 1`) === '0');
t('floors: a floor outside -5..300, a text floor and 1.5 are 400', (await flr('/301', 'PUT', { floorName: 'x' })).s === 400 && (await flr('/-6', 'PUT', { floorName: 'x' })).s === 400 && (await flr('/abc', 'PUT', { floorName: 'x' })).s === 400 && (await flr('/1.5', 'PUT', { floorName: 'x' })).s === 400);
t('floors: a bad pattern (from above to, unknown style, words past 100, markup affix, 21 characters) is 400', (await flr('/pattern', 'POST', { from: 3, to: 1 })).s === 400 && (await flr('/pattern', 'POST', { from: 1, to: 2, style: 'roman' })).s === 400 && (await flr('/pattern', 'POST', { from: 1, to: 150, style: 'words' })).s === 400 && (await flr('/pattern', 'POST', { from: 1, to: 2, suffix: '<b>' })).s === 400 && (await flr('/pattern', 'POST', { from: 1, to: 2, prefix: 'p'.repeat(21) })).s === 400 && (await flr('/pattern', 'POST', { from: 1, to: 2, preview: 'yes' })).s === 400);
r = await flr('/pattern', 'POST', { from: -2, to: 0, style: 'number', preview: true }); t('floors: below ground is Basement 2, Basement 1, then Ground', r.j?.data?.floors.map((x) => x.floor_name).join() === 'Basement 2,Basement 1,Ground', r);
r = await flr('/pattern', 'POST', { from: 19, to: 23, style: 'words', preview: true }); t('floors: words read Nineteenth, Twentieth, Twenty-First ...', r.j?.data?.floors.map((x) => x.floor_name).join() === 'Nineteenth,Twentieth,Twenty-First,Twenty-Second,Twenty-Third', r);
r = await flr('/pattern', 'POST', { from: 11, to: 13, style: 'ordinal', preview: true }); t('floors: 11th 12th 13th (not 11st)', r.j?.data?.floors.map((x) => x.floor_name).join() === '11th,12th,13th', r);
t('floors: unknown tower 404, tower of another project 404, bad ids 400, viewer and sales cannot write, no login 401', (await A('GET', `/projects/${P}/towers/${NIL}/floors`)).s === 404 && (await A('GET', `/projects/${P2}/towers/${FT}/floors`)).s === 404 && (await A('GET', `/projects/${P}/towers/zzz/floors`)).s === 400 && (await RO('PUT', `/projects/${P}/towers/${FT}/floors/1`, { floorName: 'x' })).s === 403 && (await SE('PUT', `/projects/${P}/towers/${FT}/floors/1`, { floorName: 'x' })).s === 403 && (await NO('GET', `/projects/${P}/towers/${FT}/floors`)).s === 401);
r = await A('GET', `/units?projectId=${P}&pageSize=1000`); const fl2 = (r.j?.data || []).find((x) => x.unit_number === `F-2-${U}`);
t('unit status: the unit list carries the floor name, the type group and the location name', fl2 && fl2.floor_name === 'The Second Level' && 'location_name' in fl2 && 'unit_group' in fl2, fl2);
const u1g = (r.j?.data || []).find((x) => x.unit_number === `U1b-${U}`);
const u1gType = ((await A('GET', '/master/unit-types')).j?.data || []).find((x) => x.id === u1g?.unit_type_id);
t('unit status: Group is the unit type\'s group, not its name', !!u1gType?.group_name && u1g.unit_group === u1gType.group_name && u1g.unit_group !== u1g.bhk_type && u1g.location_name === null, { g: u1g?.unit_group, grp: u1gType?.group_name, l: u1g?.location_name });

// plots and villas: more units of a type in a block, areas and price from the type
r = await A('POST', '/projects/' + P + '/towers', { towerName: `Block ${U}` }); const MBT = r.j?.data?.id;
const more = (b, who = A) => who('POST', '/units/add-more', { projectId: P, towerId: MBT, unitTypeId: T1, ...b });
r = await more({ count: 3, preview: true }); t('more units: preview says which numbers and the price, and creates nothing', r.s === 200 && r.j.data.first === '001' && r.j.data.last === '003' && r.j.data.basePrice === 2550000 && psql(`select count(*) from units where tower_id = '${MBT}'`) === '0', r);
r = await more({ count: 3 }); t('more units: 3 units, floor 0, the type\'s areas and price', r.s === 201 && r.j.data.created === 3 && psql(`select string_agg(unit_number || ':' || floor || ':' || super_area_sqft::int || ':' || base_price_inr, ',' order by unit_number) from units where tower_id = '${MBT}'`) === '001:0:510:2550000,002:0:510:2550000,003:0:510:2550000', r);
r = await more({ count: 2 }); t('more units: the next call continues the numbers (004, 005)', r.s === 201 && r.j.data.first === '004' && r.j.data.last === '005', r);
await A('PATCH', `/projects/${P}/towers/${MBT}`, { addressPrefix: 'PL-' }); psql(`update units set unit_number = 'PL-' || unit_number where tower_id = '${MBT}'`);
r = await more({ count: 1 }); t('more units: it continues a pattern with a prefix (PL-006)', r.s === 201 && r.j.data.first === 'PL-006', r);
t('more units: 0, 2001, 1.5, text, missing are 400', (await more({ count: 0 })).s === 400 && (await more({ count: 2001 })).s === 400 && (await more({ count: 1.5 })).s === 400 && (await more({ count: 'x' })).s === 400 && (await more({})).s === 400);
t('more units: a tower or a type of another project is 404, bad ids 400', (await A('POST', '/units/add-more', { projectId: P2, towerId: MBT, unitTypeId: T1, count: 1 })).s === 404 && (await A('POST', '/units/add-more', { projectId: P, towerId: MBT, unitTypeId: NIL, count: 1 })).s === 404 && (await A('POST', '/units/add-more', { projectId: P, towerId: 'zzz', unitTypeId: T1, count: 1 })).s === 400);
t('more units: viewer and sales cannot add, no login is 401', (await more({ count: 1 }, RO)).s === 403 && (await more({ count: 1 }, SE)).s === 403 && (await more({ count: 1 }, NO)).s === 401);

// unit wise area: 12 fields, effective date, history; a booked unit keeps super, carpet and balcony 1
const AUr = await mkUnit({ unitNumber: `AR1-${U}`, bhkType: 'X', carpetAreaSqft: 400, superAreaSqft: 500, balconyAreaSqft: 30, basePriceInr: 1000000, totalPriceInr: 1000000 }); const AU = AUr.j?.data?.id; t('unit area: setup unit', !!AU, AUr);
const ar = (b, id = AU, who = A) => who('PUT', `/units/${id}/areas`, b);
r = await A('GET', `/units/${AU}/areas`); t('unit area: the 12 fields (super, carpet, balcony 1 from the unit, the rest empty)', r.s === 200 && r.j.data.superAreaSqft === 500 && r.j.data.carpetAreaSqft === 400 && r.j.data.balcony1AreaSqft === 30 && r.j.data.basementAreaSqft === null && r.j.data.sold === false, r);
r = await ar({ basementAreaSqft: 120.5, stiltAreaSqft: 60, commonAreaSqft: 15, balcony2AreaSqft: 22.25, balcony3AreaSqft: 10, builtUpAreaSqft: 450, udslAreaSqft: 80, plotArea: 0, areaMeasurement: 'Sq. Ft.', effectiveDate: '2026-01-15', note: 'sanction plan' });
t('unit area: the other nine are saved with a date and a note', r.s === 200 && r.j.data.changed.length === 9 && psql(`select basement_area_sqft || ':' || common_area_sqft || ':' || area_measurement from unit_areas where unit_id = '${AU}'`) === '120.5000:15.0000:Sq. Ft.', r);
r = await ar({ carpetAreaSqft: 410, superAreaSqft: 520, balcony1AreaSqft: 35, effectiveDate: '2026-02-01' }); t('unit area: an unbooked unit can change super, carpet and balcony 1, and the unit follows', r.s === 200 && psql(`select super_area_sqft::int || ':' || carpet_area_sqft::int || ':' || balcony_area_sqft::int from units where id = '${AU}'`) === '520:410:35', r);
r = await A('GET', `/units/${AU}/areas/history`); t('unit area: the history lists both changes with their dates, newest first', r.s === 200 && r.j.data.length === 2 && r.j.data[0].effective_date === '2026-02-01' && r.j.data[0].before.carpetAreaSqft === 400 && r.j.data[0].after.carpetAreaSqft === 410 && r.j.data[1].note === 'sanction plan', r);
t('unit area: saving the same values again records nothing', (await ar({ carpetAreaSqft: 410 })).j.data.changed.length === 0 && (await A('GET', `/units/${AU}/areas/history`)).j.data.length === 2);
t('unit area: a blank clears a field', (await ar({ stiltAreaSqft: null })).j?.data?.stiltAreaSqft === null);
t('unit area: negative, text, 7 digits, 5 decimals are 400', (await ar({ commonAreaSqft: -1 })).s === 400 && (await ar({ commonAreaSqft: 'x' })).s === 400 && (await ar({ commonAreaSqft: 10000000 })).s === 400 && (await ar({ commonAreaSqft: 1.23456 })).s === 400);
t('unit area: super below carpet, unknown measure, bad date, markup note, empty body are 400', (await ar({ superAreaSqft: 100 })).s === 400 && (await ar({ areaMeasurement: 'Miles' })).s === 400 && (await ar({ commonAreaSqft: 5, effectiveDate: '2026-02-31' })).s === 400 && (await ar({ commonAreaSqft: 5, note: '<b>' })).s === 400 && (await ar({})).s === 400);
t('unit area: unknown unit 404, bad id 400, viewer and sales cannot save, no login 401', (await ar({ commonAreaSqft: 5 }, NIL)).s === 404 && (await ar({ commonAreaSqft: 5 }, 'zzz')).s === 400 && (await ar({ commonAreaSqft: 5 }, AU, RO)).s === 403 && (await ar({ commonAreaSqft: 5 }, AU, SE)).s === 403 && (await ar({ commonAreaSqft: 5 }, AU, NO)).s === 401);
r = await A('GET', `/units/areas/report?projectId=${P}`); t('unit area: the report has a row per unit with all 12 fields', r.s === 200 && r.j.data.some((x) => x.unit_number === `AR1-${U}` && x.basementAreaSqft === 120.5 && x.areaMeasurement === 'Sq. Ft.'), r.s);
t('unit area: the report with a tower, a bad project, a bad tower', (await A('GET', `/units/areas/report?projectId=${P}&towerId=${MBT}`)).j?.data?.every((x) => x.tower_name === `Block ${U}`) && (await A('GET', `/units/areas/report?projectId=${NIL}`)).s === 404 && (await A('GET', '/units/areas/report?projectId=zzz')).s === 400 && (await A('GET', `/units/areas/report?projectId=${P}&towerId=zzz`)).s === 400);
// ---------- the client's own inventory sheet, saved as CSV ----------
const sheet = (rows) => ['S.No.,Tower,Floor,Group,Unit Type,Area (Sq. Ft.),Balcony9Sq.Ft),Unit No.', ...rows].join('\r\n') + '\r\n';
const INV = [`1,Tower Q${U},1st Floor,3 BHK,Type-A,645.743,121.536,Q-101`, ',,,,,,,', `2,Tower Q${U},1st Floor,3 BHK,Type-A,645.743,121.536,Q-102`, ',,,,,,,', `3,Tower Q${U},1st Floor,2 BHK+ST,Type-D,645.549,104.787,Q-103`, ',,,,,,,', `4,Tower Q${U},Ground Floor,2 BHK+ST,Type-D,645.549,104.787,Q-G01`, `5,Tower Q${U},2nd Floor,3 BHK,Type-A,645.743,121.536,Q-201`];
const impS = (csvText, extra = {}, path = '/import', who = A, proj = P) => who('POST', path, { projectId: proj, importType: 'units', csvText, fileName: 'Inventory.csv', ...extra });
r = await impS(sheet(INV)); t('inventory sheet: without "make the unit types" the types the project lacks are named in the error and nothing is saved', r.s === 422 && /Type-A.*not in this project/.test(r.j?.error || '') && psql(`select count(*) from units where project_id = '${P}' and unit_number like 'Q-%'`) === '0', r);
r = await impS(sheet(INV), { createTypes: true }, '/import/preview'); t('inventory sheet: the preview reads the sheet\'s own headers, drops its blank lines and lists the types it would make', r.s === 200 && r.j.data.totalRows === 5 && r.j.data.validRows === 5 && r.j.data.errorRows === 0 && r.j.data.newUnitTypes.length === 2 && r.j.data.newUnitTypes.find((x) => x.name === 'Type-A')?.units === 3 && r.j.data.newUnitTypes.find((x) => x.name === 'Type-A')?.group === '3 BHK', r);
r = await impS(sheet(INV), { createTypes: true }); t('inventory sheet: imported with its unit types made', r.s === 200 && r.j.data.created === 5 && r.j.data.createdUnitTypes === 2, r);
t('inventory sheet: floors "1st Floor", "Ground Floor", "2nd Floor" are 1, 0, 2', psql(`select string_agg(unit_number || ':' || floor, ',' order by unit_number) from units where project_id = '${P}' and unit_number like 'Q-%'`) === 'Q-101:1,Q-102:1,Q-103:1,Q-201:2,Q-G01:0');
t('inventory sheet: each unit has its type, carpet and balcony area, and no price yet', psql(`select count(*) from units u join unit_types t on t.id = u.unit_type_id where u.project_id = '${P}' and u.unit_number like 'Q-%' and u.carpet_area_sqft is not null and u.balcony_area_sqft is not null and u.base_price_inr is null`) === '5');
t('inventory sheet: the made types keep their group and areas and are charged on the carpet area', psql(`select group_name || ':' || carpet_area_sqft::numeric(14,3) || ':' || balcony_area_sqft::numeric(14,3) || ':' || rate_basis from unit_types where project_id = '${P}' and name = 'Type-D'`) === '2 BHK+ST:645.549:104.787:Carpet Area');
r = await impS(sheet(INV), { createTypes: true }); t('inventory sheet: the same file again skips every unit and makes no type again', r.s === 200 && r.j.data.created === 0 && r.j.data.skipped === 5 && psql(`select count(*) from unit_types where project_id = '${P}' and name in ('Type-A','Type-D')`) === '2', r);
r = await impS(sheet([`1,Tower Q${U},1st Floor,3 BHK,Type-A,645.743,121.536,Q-301`, `2,Tower Q${U},1st Floor,3 BHK,Type-A,700,121.536,Q-302`]).replace(/Type-A/g, 'Type-Z'), { createTypes: true });
t('inventory sheet: one type with two different areas in the file is a row error', r.s === 422 && /other areas or another group than in row 2/.test(r.j?.error || ''), r);
r = await impS(sheet([`1,Tower Q${U},7th Floor,3 BHK,Type-A,645.743,121.536,Q-701`, `2,Tower Q${U},Floor X,3 BHK,Type-A,645.743,121.536,Q-702`, `3,Tower Q${U},1st Floor,3 BHK,Type-A,abc,121.536,Q-703`, `4,Tower Q${U},1st Floor,3 BHK,Type-A,100,121.536,`]), { createTypes: true });
t('inventory sheet: a bad floor word, a text area and a missing unit number are named by row', r.s === 422 && /Row 3/.test(r.j?.error || '') && /Row 4/.test(r.j?.error || '') && /Row 5/.test(r.j?.error || ''), r);
t('inventory sheet: createTypes must be true or false (400); the sheet needs its columns (400)', (await impS(sheet(INV), { createTypes: 'yes' })).s === 400 && (await impS('Tower,Floor\r\nT,1\r\n', { createTypes: true })).s === 400);
t('inventory sheet: viewer and sales cannot import, no login is 401', (await impS(sheet(INV), { createTypes: true }, '/import', RO)).s === 403 && (await impS(sheet(INV), { createTypes: true }, '/import', SE)).s === 403 && (await impS(sheet(INV), {}, '/import', NO)).s === 401);
r = await impS(sheet([`Q-901`]).replace('S.No.,Tower,Floor,Group,Unit Type,Area (Sq. Ft.),Balcony9Sq.Ft),Unit No.', 'Unit No.,Tower,Floor,Unit Type').replace('Q-901', `Q-901,Tower Q${U},3rd Floor,Type-A`), { createTypes: true });
t('inventory sheet: only unit no., tower, floor and unit type are enough when the type already exists', r.s === 200 && r.j.data.created === 1, r);
// ---------- an "In Fix" unit type: the rate is the price of the unit, not a rate per area ----------
r = await ut({ name: `Villa Fix ${U}`, rate_type: 'In Fix', area_type: 'Non Salable', super_area_sqft: 3000, carpet_area_sqft: 2200, base_rate_sqft: 9500000 }); const VF = r.j?.data?.id;
t('in fix: the type is saved as In Fix with its price in the rate', r.s === 201 && r.j.data.rate_type === 'In Fix' && Number(r.j.data.base_rate_sqft) === 9500000, r);
r = await A('POST', '/projects/' + P + '/towers', { towerName: `Fix ${U}` }); const FXT = r.j?.data?.id;
r = await A('POST', '/units/add-more', { projectId: P, towerId: FXT, unitTypeId: VF, count: 2 });
t('in fix: more units of the type are priced 95,00,000 each, not rate x area', r.s === 201 && r.j.data.basePrice === 9500000 && psql(`select string_agg(base_price_inr::text || '/' || total_price_inr::text, ',') from units where tower_id = '${FXT}'`) === '9500000/9500000,9500000/9500000', r);
r = await impS(sheet([`1,Fix ${U},1st Floor,Villa,Villa Fix ${U},3000,0,FX-9`]).replace('Balcony9Sq.Ft)', 'Balcony'), { createTypes: true });
t('in fix: a CSV row of that type takes the fixed price too', r.s === 200 && r.j.data.created === 1 && psql(`select base_price_inr from units where tower_id = '${FXT}' and unit_number = 'FX-9'`) === '9500000', r);
r = await A('PUT', `/master/unit-types/${VF}`, { base_rate_sqft: 10000000 }); r = await A('POST', `/master/unit-types/${VF}/apply-to-units`, {});
t('in fix: "Update units" carries the new fixed price to the unbooked units', r.s === 200 && psql(`select string_agg(distinct base_price_inr::text, ',') from units where unit_type_id = '${VF}'`) === '10000000', r);
// ---------- tower list used by the report and charge page filters ----------
r = await A('GET', `/units/towers?projectId=${P}`);
t('towers list: gives this project\'s towers under both name keys', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.project_id === P && x.name === x.tower_name) && r.j.data.some((x) => x.id === FXT), r);
t('towers list: another project\'s towers do not appear', (await A('GET', `/units/towers?projectId=${P2}`)).j.data.every((x) => x.project_id === P2));
t('towers list: no project given still answers', (await A('GET', '/units/towers')).s === 200);
t('towers list: a bad project id is a 400, not a server error', (await A('GET', '/units/towers?projectId=abc')).s === 400);
t('towers list: a sales executive can read it', (await SE('GET', `/units/towers?projectId=${P}`)).s === 200);
psql(`delete from units where project_id in ('${P}','${P2}')`);
for (const x of (await A('GET', '/master/unit-types')).j?.data || []) if (x.project_id === P) await A('DELETE', `/master/unit-types/${x.id}`);
for (const x of (await A('GET', '/master/reminder-master')).j?.data || []) if ([P, P2].includes(x.project_id) || x.name.endsWith(U)) await A('DELETE', `/master/reminder-master/${x.id}`);
console.log(`RESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
