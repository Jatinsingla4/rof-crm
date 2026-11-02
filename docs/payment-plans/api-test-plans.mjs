// Payment plan checks: row rules, 100% cap, duplicates, copy, delete, plans frozen once a booking uses them, roles.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-plans.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const PM = call(await login('project_manager@test.local'));
const SE = call(await login('sales_executive@test.local'));
const RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const U = Date.now().toString(36).slice(-5);
const NIL = '00000000-0000-0000-0000-000000000000';
let r;

const co = (await A('POST', '/companies', { name: 'Plan Co ' + U })).j.data.id;
const proj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Plan ${tag} ${U}`, reraNumber: `PL${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await proj('A'), P2 = await proj('B');
const row = (o = {}) => ({ plan_name: 'Plan ' + U, installment_name: 'Booking', installment_type: 'booking', percentage: 10, due_date_offset_days: 0, installment_index: 1, ...o });
const plan = 'Plan ' + U;

// ---------- Roles ----------
r = await SE('POST', `/projects/${P1}/plan-templates`, row()); t('roles: sales_executive cannot add a row -> 403', r.s === 403, r.s);
r = await RO('POST', `/projects/${P1}/plan-templates`, row()); t('roles: read_only_viewer cannot add a row -> 403', r.s === 403, r.s);
r = await RO('GET', `/projects/${P1}/plans`); t('roles: read_only_viewer can read the plan list', r.s === 200, r.s);

// ---------- Row rules ----------
const bad = async (n, o, re) => { const x = await A('POST', `/projects/${P1}/plan-templates`, row(o)); t('row: ' + n + ' -> 400', x.s === 400 && (!re || re.test(x.j?.error || '')), x.s + ' ' + JSON.stringify(x.j)); };
await bad('no name', { installment_name: '' }, /name/i);
await bad('name of spaces', { installment_name: '   ' }, /name/i);
await bad('markup in name', { installment_name: '<b>x' }, /</);
await bad('name over 100', { installment_name: 'x'.repeat(101) }, /100/);
await bad('markup in plan name', { plan_name: '<i>p' }, /</);
await bad('plan name over 100', { plan_name: 'p'.repeat(101) }, /100/);
await bad('unknown type', { installment_type: 'magic' }, /Type/);
await bad('percentage text', { percentage: 'abc' }, /Percentage/);
await bad('percentage negative', { percentage: -5 }, /Percentage/);
await bad('percentage over 100', { percentage: 100.5 }, /Percentage/);
await bad('percentage with 4 decimals', { percentage: 1.2345 }, /decimals/);
await bad('percentage missing', { percentage: null }, /required/i);
await bad('due days negative', { due_date_offset_days: -1 }, /Due days/);
await bad('due days fraction', { due_date_offset_days: 1.5 }, /Due days/);
await bad('due days too large', { due_date_offset_days: 99999 }, /Due days/);
await bad('order number 0', { installment_index: 0 }, /Order/);
await bad('notes over 500', { notes: 'n'.repeat(501) }, /500/);
await bad('other charge without amount', { installment_type: 'other_charge', percentage: null }, /amount/i);
await bad('other charge with negative amount', { installment_type: 'other_charge', flat_amount_inr: -5 }, /Amount/);
r = await A('POST', `/projects/${NIL}/plan-templates`, row()); t('row: unknown project -> 404', r.s === 404, r.s);
r = await A('POST', `/projects/abc/plan-templates`, row()); t('row: bad project id -> 400', r.s === 400, r.s);

// ---------- Build a plan ----------
r = await A('POST', `/projects/${P1}/plan-templates`, row()); t('row: add booking row 10%', r.s === 201 && r.j.data.installment_index === 1, JSON.stringify(r.j)); const r1 = r.j?.data?.id;
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'booking' })); t('row: same name in another letter case -> 409', r.s === 409, r.s);
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'Other', installment_type: 'installment' })); t('row: same order number -> 409', r.s === 409, r.s);
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'On Allotment', installment_type: 'installment', percentage: 30, installment_index: undefined, due_date_offset_days: 15 }));
t('row: order number is filled in (next one)', r.s === 201 && r.j.data.installment_index === 2, JSON.stringify(r.j)); const r2 = r.j?.data?.id;
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'Too much', installment_type: 'installment', percentage: 70.001, installment_index: 3 })); t('cap: 10 + 30 + 70.001 is over 100 -> 400', r.s === 400 && /100/.test(r.j.error), JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'Possession', installment_type: 'possession', percentage: 60, installment_index: 3 })); t('row: add possession row 60% (total 100)', r.s === 201, JSON.stringify(r.j)); const r3 = r.j?.data?.id;
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'One more', installment_type: 'installment', percentage: 0.001, installment_index: 4 })); t('cap: plan at 100% takes nothing more -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'Maintenance', installment_type: 'other_charge', flat_amount_inr: 50000, percentage: 99, installment_index: 4 }));
t('row: other charge is a fixed amount, percentage is ignored', r.s === 201 && r.j.data.percentage === null && Number(r.j.data.flat_amount_inr) === 50000, JSON.stringify(r.j)); const r4 = r.j?.data?.id;
r = await A('GET', `/projects/${P1}/plans`); const pl = r.j?.data?.find(x => x.plan_name === plan);
t('plans: one line with rows, total and complete flag', r.s === 200 && pl && pl.rows === 4 && pl.total_pct === 100 && pl.complete === true && pl.bookings === 0, JSON.stringify(pl));

// ---------- Edit ----------
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { percentage: 80 }); t('edit: raising a row past 100 is refused (cap holds on edit)', r.s === 400, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { percentage: 50 }); t('edit: lowering a row works', r.s === 200 && Number(r.j.data.percentage) === 50 && r.j.data.installment_name === 'Possession', JSON.stringify(r.j));
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { percentage: 60 }); t('edit: back to 60', r.s === 200, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { installment_name: 'on allotment' }); t('edit: rename to an existing name -> 409', r.s === 409, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { installment_index: 2 }); t('edit: order number of another row -> 409', r.s === 409, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { percentage: -1 }); t('edit: negative percentage -> 400', r.s === 400, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { installment_type: 'zzz' }); t('edit: unknown type -> 400', r.s === 400, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r2}`, { due_date_offset_days: 0 }); t('edit: due days can be set to 0 (before, 0 was ignored)', r.s === 200 && r.j.data.due_date_offset_days === 0, JSON.stringify(r.j));
r = await A('PATCH', `/projects/${P1}/plan-templates/${r2}`, { due_date_offset_days: 15 }); t('edit: and back to 15', r.s === 200, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r4}`, { flat_amount_inr: 60000 }); t('edit: other charge amount changes', r.s === 200 && Number(r.j.data.flat_amount_inr) === 60000, JSON.stringify(r.j));
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { notes: 'x'.repeat(501) }); t('edit: notes over 500 -> 400', r.s === 400, r.s);
r = await A('PATCH', `/projects/${P2}/plan-templates/${r3}`, { percentage: 10 }); t('edit: a row through another project -> 404', r.s === 404, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${NIL}`, { percentage: 10 }); t('edit: unknown row -> 404', r.s === 404, r.s);
r = await PM('PATCH', `/projects/${P1}/plan-templates/${r2}`, { notes: 'pm note' }); t('roles: project_manager can edit a row', r.s === 200 && r.j.data.notes === 'pm note', r.s);
r = await SE('PATCH', `/projects/${P1}/plan-templates/${r2}`, { notes: 'x' }); t('roles: sales_executive cannot edit -> 403', r.s === 403, r.s);

// ---------- Add-on percentages ----------
const ch = psql(`INSERT INTO addon_charge_master (project_id, charge_name, default_amount, cgst_pct, sgst_pct, is_active) VALUES ('${P1}', 'Club ${U}', 100000, 9, 9, true) RETURNING id`).split('\n')[0];
const chOther = psql(`INSERT INTO addon_charge_master (project_id, charge_name, default_amount, cgst_pct, sgst_pct, is_active) VALUES ('${P2}', 'Other ${U}', 1, 9, 9, true) RETURNING id`).split('\n')[0];
const ad = (id, b) => A('POST', `/projects/${P1}/plan-templates/${id}/addon-charges`, b);
r = await ad(r1, { charge_master_id: ch, pct: 40 }); t('addon: 40% on the first row', r.s === 200, JSON.stringify(r.j));
r = await ad(r2, { charge_master_id: ch, pct: 60.001 }); t('addon: one charge over 100% across rows -> 400', r.s === 400, JSON.stringify(r.j));
r = await ad(r2, { charge_master_id: ch, pct: 60 }); t('addon: 60% on the second row (total 100)', r.s === 200, r.s);
r = await ad(r2, { charge_master_id: ch, pct: -1 }); t('addon: negative -> 400', r.s === 400, r.s);
r = await ad(r2, { charge_master_id: ch, pct: 'x' }); t('addon: text -> 400', r.s === 400, r.s);
r = await ad(r2, { charge_master_id: NIL, pct: 5 }); t('addon: unknown charge -> 400', r.s === 400, r.s);
r = await ad(r2, { charge_master_id: chOther, pct: 5 }); t('addon: a charge of another project -> 400', r.s === 400, r.s);
r = await ad(r2, { pct: 5 }); t('addon: no charge -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P2}/plan-templates/${r1}/addon-charges`, { charge_master_id: chOther, pct: 5 }); t('addon: a row through another project -> 404', r.s === 404, r.s);
r = await A('GET', `/projects/${P1}/plan-templates/${r2}/addon-charges`); const adId = r.j?.data?.[0]?.id; t('addon: list shows the charge with its percentage', r.s === 200 && r.j.data.length === 1 && Number(r.j.data[0].pct) === 60, JSON.stringify(r.j));
r = await A('DELETE', `/projects/${P1}/plan-templates/${r1}/addon-charges/${adId}`); t('addon: deleting through the wrong row -> 404', r.s === 404, r.s);

// ---------- Copy ----------
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: plan }); t('copy: same name -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plans/copy`, { from: 'No such plan', to: 'X ' + U }); t('copy: unknown plan -> 404', r.s === 404, r.s);
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: plan.toUpperCase() }); t('copy: same name in another letter case -> 400', r.s === 400, r.s);
const copy = 'Copy ' + U;
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: copy }); t('copy: same project', r.s === 201 && r.j.data.rows === 4, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: copy.toUpperCase() }); t('copy: a name that exists in another letter case -> 409', r.s === 409, r.s);
r = await A('GET', `/projects/${P1}/plan-templates?planName=${encodeURIComponent(copy)}`); const crow = r.j?.data?.find(x => x.installment_name === 'On Allotment');
r = crow ? await A('GET', `/projects/${P1}/plan-templates/${crow.id}/addon-charges`) : { s: 0 };
t('copy: add-on percentages come along', r.s === 200 && r.j.data.length === 1 && Number(r.j.data[0].pct) === 60, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: 'Other project ' + U, toProjectId: P2 }); t('copy: into another project', r.s === 201, JSON.stringify(r.j));
r = await A('GET', `/projects/${P2}/plans`); t('copy: other project has it, complete', r.j?.data?.[0]?.complete === true && r.j.data[0].rows === 4, JSON.stringify(r.j));
r = await SE('POST', `/projects/${P1}/plans/copy`, { from: plan, to: 'S ' + U }); t('roles: sales_executive cannot copy -> 403', r.s === 403, r.s);

// ---------- A booking uses the plan: its numbers freeze ----------
const cons = psql(`INSERT INTO consumers (name, mobile) VALUES ('Plan Buyer ${U}', '9${String(Date.now()).slice(-9)}') RETURNING id`).split('\n')[0];
const tower = (await A('POST', `/projects/${P1}/towers`, { towerName: 'T' + U })).j.data.id;
const unit = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor) VALUES ('${P1}', '${tower}', 'PL-${U}', 'available', '2BHK', 1) RETURNING id`).split('\n')[0];
const bk = psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}', '${unit}', '${P1}', '${plan.replace(/'/g, "''")}', 'draft') RETURNING id`).split('\n')[0];
r = await A('GET', `/projects/${P1}/plans`); t('freeze: the plan list counts the booking', r.j?.data?.find(x => x.plan_name === plan)?.bookings === 1, JSON.stringify(r.j?.data));
r = await A('PATCH', `/projects/${P1}/plan-templates/${r3}`, { percentage: 55 }); t('freeze: changing a percentage -> 409', r.s === 409 && /booking/i.test(r.j.error), JSON.stringify(r.j));
r = await A('PATCH', `/projects/${P1}/plan-templates/${r2}`, { due_date_offset_days: 30 }); t('freeze: changing due days -> 409', r.s === 409, r.s);
r = await A('PATCH', `/projects/${P1}/plan-templates/${r2}`, { notes: 'still allowed' }); t('freeze: a note can still change', r.s === 200, r.s);
r = await A('DELETE', `/projects/${P1}/plan-templates/${r3}`); t('freeze: deleting a row -> 409', r.s === 409, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent(plan)}`); t('freeze: deleting the plan -> 409', r.s === 409, r.s);
r = await A('POST', `/projects/${P1}/plan-templates`, row({ installment_name: 'Extra', installment_index: 9, percentage: 1 })); t('freeze: adding a row -> 409', r.s === 409, r.s);
r = await ad(r2, { charge_master_id: ch, pct: 10 }); t('freeze: changing an add-on percentage -> 409', r.s === 409, r.s);
psql(`UPDATE booking_records SET status = 'cancelled' WHERE id = '${bk}'`);
r = await A('GET', `/projects/${P1}/plans`); t('freeze: a cancelled booking no longer counts', r.j?.data?.find(x => x.plan_name === plan)?.bookings === 0, JSON.stringify(r.j?.data));
psql(`UPDATE booking_records SET status = 'draft' WHERE id = '${bk}'`);

// ---------- Booking only completes on a plan of exactly 100% ----------
const short = 'Short ' + U;
await A('POST', `/projects/${P1}/plan-templates`, row({ plan_name: short, installment_name: 'Only part', installment_type: 'installment', percentage: 80 }));
psql(`UPDATE booking_records SET selected_plan_name = '${short}' WHERE id = '${bk}'`);
r = await A('PATCH', `/booking/${bk}`, { booking_amount: 100000, payment_mode: 'cheque', payment_ref: 'PLAN' + U, bank_name: 'HDFC' });
t('booking: a plan of 80% cannot be booked -> 400 with the reason', r.s === 400 && /80%/.test(r.j?.error || '') && /100%/.test(r.j.error), r.s + ' ' + JSON.stringify(r.j));
t('booking: the booking stayed unfinished', psql(`SELECT status FROM booking_records WHERE id = '${bk}'`) === 'draft');

// ---------- Delete ----------
psql(`UPDATE booking_records SET status = 'cancelled' WHERE id = '${bk}'`);
r = await PM('DELETE', `/projects/${P1}/plan-templates/${r3}`); t('roles: project_manager cannot delete -> 403', r.s === 403, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName=`); t('delete plan: no name -> 400', r.s === 400, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent('No such ' + U)}`); t('delete plan: unknown -> 404', r.s === 404, r.s);
r = await A('DELETE', `/projects/${P1}/plan-templates/${NIL}`); t('delete row: unknown -> 404', r.s === 404, r.s);
r = await A('DELETE', `/projects/${P1}/plan-templates/${r4}`); t('delete row works', r.s === 200, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent(copy)}`); t('delete plan: the copy goes with its rows', r.s === 200 && r.j.deleted === 4, JSON.stringify(r.j));
t('delete plan: its add-on percentages went too', psql(`SELECT COUNT(*) FROM plan_addon_charge_pct a JOIN plan_schedule_templates p ON p.id = a.plan_schedule_template_id WHERE p.plan_name = '${copy}'`) === '0');
const audit = (await A('GET', '/users/audit-logs?pageSize=100')).j?.data || [];
t('audit: plan changes are logged', audit.some(x => /payment_plan/.test(x.resource_type || '')), JSON.stringify(audit.slice(0, 2)));


// ---------- Worst cases: things that go wrong, at the same time, or that nobody would predict ----------
const W = 'Worst ' + U;
const wrow = (o = {}) => ({ plan_name: W, installment_name: 'Row ' + Math.random().toString(36).slice(2, 8), installment_type: 'installment', percentage: 10, ...o });
const ok = (x) => x.s === 201;
// two requests at the same moment cannot both pass the 100% check
let burst = await Promise.all(Array.from({ length: 8 }, (_, i) => A('POST', `/projects/${P1}/plan-templates`, wrow({ percentage: 20, installment_name: 'Burst ' + i, installment_index: i + 1 }))));
t('race: 8 rows of 20% at once, exactly 5 fit', burst.filter(ok).length === 5 && burst.filter((x) => x.s === 400).length === 3, burst.map((x) => x.s).join(','));
r = await A('GET', `/projects/${P1}/plans`); t('race: the plan total is exactly 100, not more', r.j.data.find((x) => x.plan_name === W)?.total_pct === 100, JSON.stringify(r.j.data.find((x) => x.plan_name === W)));
const W2 = 'Worst2 ' + U;
burst = await Promise.all(Array.from({ length: 6 }, () => A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: W2, installment_name: 'Same', percentage: 1 }))));
t('race: the same row name sent 6 times at once is created once', burst.filter(ok).length === 1 && burst.filter((x) => x.s === 409).length === 5, burst.map((x) => x.s).join(','));
burst = await Promise.all(Array.from({ length: 6 }, (_, i) => A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: W2, installment_name: 'Idx ' + i, installment_index: 50, percentage: 1 }))));
t('race: the same order number sent 6 times at once is used once', burst.filter(ok).length === 1, burst.map((x) => x.s).join(','));
burst = await Promise.all(Array.from({ length: 6 }, () => A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Auto ' + U, percentage: 1 }))));
t('race: with no order number given, each row gets its own number', burst.filter(ok).length === 6 && new Set(burst.map((x) => x.j.data.installment_index)).size === 6, burst.map((x) => x.s + ':' + x.j?.data?.installment_index).join(','));
burst = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: 'Racy copy ' + U })));
t('race: copying to the same new name 5 times at once makes one plan', burst.filter(ok).length === 1 && burst.filter((x) => x.s === 409).length === 4, burst.map((x) => x.s).join(','));
burst = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/projects/${P1}/plans/standard`, { plan_name: 'Racy standard ' + U })));
t('race: the standard plan asked 5 times at once is made once, with 9 rows', burst.filter(ok).length === 1 && psql(`SELECT COUNT(*) FROM plan_schedule_templates WHERE plan_name = 'Racy standard ${U}'`) === '9', burst.map((x) => x.s).join(','));
// two edits at once that together would pass 100
const E = 'Edits ' + U;
const e1 = (await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: E, installment_name: 'A', percentage: 50 }))).j.data.id;
const e2 = (await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: E, installment_name: 'B', percentage: 10 }))).j.data.id;
const e3 = (await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: E, installment_name: 'C', percentage: 10 }))).j.data.id;
burst = await Promise.all([e1, e2, e3].map((id) => A('PATCH', `/projects/${P1}/plan-templates/${id}`, { percentage: 40 })));
r = await A('GET', `/projects/${P1}/plans`); t('race: three edits at once never pass 100%', r.j.data.find((x) => x.plan_name === E).total_pct <= 100, JSON.stringify(r.j.data.find((x) => x.plan_name === E)));
const dbl = await Promise.all([1, 2].map(() => A('DELETE', `/projects/${P1}/plan-templates/${e3}`)));
t('race: deleting the same row twice at once: one 200, one 404', dbl.map((x) => x.s).sort().join() === '200,404', dbl.map((x) => x.s).join());

// numbers nobody should be able to sneak in
const num = async (n, v, field = 'percentage') => { const x = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, [field]: v, installment_index: undefined, ...(field === 'flat_amount_inr' ? { installment_type: 'other_charge', percentage: undefined } : {}) })); t(`number: ${n} -> 400`, x.s === 400, x.s + ' ' + JSON.stringify(x.j)); };
for (const [n, v] of [['"1e2"', '1e2'], ['"0x10"', '0x10'], ['" 12 "', ' 12 '], ['"12,5"', '12,5'], ['"1.2.3"', '1.2.3'], ['"+5"', '+5'], ['"-0.5"', '-0.5'], ['an array [5]', [5]], ['an object', { a: 1 }], ['true', true], ['"Infinity"', 'Infinity'], ['"NaN"', 'NaN'], ['1e308', 1e308], ['-1e-9', -1e-9], ['Arabic digit', '٣'], ['full-width digits', '１２'], ['an empty array', []], ['"٣"', '٣']]) await num(n, v);
await num('amount "1e3"', '1e3', 'flat_amount_inr'); await num('amount 1.5', 1.5, 'flat_amount_inr'); await num('amount 1e30', 1e30, 'flat_amount_inr'); await num('amount an array', [100], 'flat_amount_inr');
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, percentage: '0.001', installment_index: 1 })); t('number: "0.001" as a text is fine', r.s === 201, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, installment_type: 'possession', percentage: -0, installment_index: 2 })); t('number: -0 is just 0', r.s === 201 && Number(r.j.data.percentage) === 0, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, percentage: 1, installment_index: '07' })); t('number: order "07" is the number 7', r.s === 201 && r.j.data.installment_index === 7, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, percentage: 1, installment_index: 1000 })); t('number: order 1000 -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Num ' + U, percentage: 1, installment_index: 99999999999999999999 })); t('number: order past any size -> 400', r.s === 400, r.s);

// text nobody should be able to sneak in
const txt = async (n, o, want = 400) => { const x = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: 'Txt ' + U, percentage: 1, installment_index: undefined, ...o })); t(`text: ${n} -> ${want}`, x.s === want, x.s + ' ' + JSON.stringify(x.j)); return x; };
await txt('a line break in the name', { installment_name: 'a\nb' });
await txt('a tab in the name', { installment_name: 'a\tb' });
await txt('a null character in the name', { installment_name: 'a\u0000b' });
await txt('a bell character in the name', { installment_name: 'a\u0007b' });
await txt('a right-to-left override in the name', { installment_name: 'abc‮def' });
await txt('only zero-width characters', { installment_name: '​​' });
await txt('only non-breaking spaces', { installment_name: '  ' });
await txt('a name that is a number, not text', { installment_name: 12345 });
await txt('a name that is an array', { installment_name: ['x'] });
await txt('a name that is an object', { installment_name: { a: 1 } });
await txt('notes that are an object', { installment_name: 'N1', notes: { a: 1 } });
await txt('a plan name with a line break', { plan_name: 'a\nb', installment_name: 'N2' });
await txt('a plan name that is an object', { plan_name: { a: 1 }, installment_name: 'N3' });
await txt('a plan name that is an array', { plan_name: ['a'], installment_name: 'N4' });
await txt('a plan name that is a number', { plan_name: 42, installment_name: 'N5' });
await txt('a plan name of only spaces', { plan_name: '   ', installment_name: 'N6' });
const sqlName = `x'); DROP TABLE plan_schedule_templates; --`;
r = await txt('SQL in a name is only text (stored as it is)', { installment_name: sqlName }, 201);
t('text: the table is still there and the SQL name is stored as plain text', psql(`SELECT COUNT(*) FROM plan_schedule_templates WHERE plan_name = 'Txt ${U}' AND installment_name = $$${sqlName}$$`) === '1');
r = await txt('emoji and accents are fine', { installment_name: 'Möbel 🏠 ₹ 第二期' }, 201);
t('text: and they come back unchanged', r.j?.data?.installment_name === 'Möbel 🏠 ₹ 第二期');
r = await txt('the name with spaces around it is trimmed', { installment_name: '   Padded   ' }, 201);
t('text: trimmed in the database', r.j?.data?.installment_name === 'Padded');
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: ('txt ' + U).toUpperCase(), installment_name: 'Other case', percentage: 1, installment_index: 500 }));
t('text: the plan name in another letter case joins the same plan', r.s === 201 && r.j.data.plan_name === 'Txt ' + U, JSON.stringify(r.j));
r = await A('GET', `/projects/${P1}/plans`); t('text: so there is still one plan of that name', r.j.data.filter((x) => x.plan_name.toLowerCase() === 'txt ' + U).length === 1);

// requests that are not what the screen sends
const raw = async (m, p, body, headers = { 'content-type': 'application/json' }, tok) => { const x = await fetch(B + p, { method: m, headers: { ...headers, authorization: 'Bearer ' + (tok || ADMIN) }, body }); return { s: x.status, j: await x.json().catch(() => null) }; };
const ADMIN = await login('super_admin@test.local');
r = await raw('POST', `/projects/${P1}/plan-templates`, '[1,2]'); t('shape: a list as the body -> 400, not a crash', r.s === 400, r.s);
r = await raw('POST', `/projects/${P1}/plan-templates`, '"just text"'); t('shape: plain text as the body -> 400', r.s === 400, r.s);
r = await raw('POST', `/projects/${P1}/plan-templates`, '{broken json'); t('shape: broken JSON -> 400', r.s === 400, r.s);
r = await raw('POST', `/projects/${P1}/plan-templates`, 'installment_name=x', { 'content-type': 'text/plain' }); t('shape: a body of the wrong type -> 400', r.s === 400, r.s);
r = await raw('POST', `/projects/${P1}/plan-templates`, JSON.stringify({ installment_name: 'x'.repeat(5 * 1024 * 1024) })); t('shape: a 5 MB name is refused without a crash', r.s >= 400 && r.s < 500, r.s);
r = await A('GET', `/projects/${P1}/plans`); t('shape: the server is still up after all that', r.s === 200, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName=a&planName=b`); t('shape: planName twice in the URL -> 400', r.s === 400, r.s);
r = await A('DELETE', `/projects/${P1}/plans?planName[x]=1`); t('shape: planName as an object in the URL -> 400', r.s === 400, r.s);
r = await A('GET', `/projects/${encodeURIComponent("x'; DROP TABLE projects;--")}/plans`); t('shape: SQL as the project id -> 400', r.s === 400, r.s);
r = await A('GET', `/projects/${P1.toUpperCase()}/plans`); t('shape: a project id in capital letters still works', r.s === 200, r.s);
r = await A('GET', `/projects/${P1}/plan-templates?planName=${encodeURIComponent("' OR '1'='1")}`); t('shape: SQL in the planName filter finds nothing', r.s === 200 && r.j.data.length === 0, JSON.stringify(r.j));
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: 'Nowhere ' + U, toProjectId: NIL }); t('copy: into a project that does not exist -> 404', r.s === 404, r.s);
r = await A('POST', `/projects/${P1}/plans/copy`, { from: plan, to: 'Nowhere ' + U, toProjectId: 'nonsense' }); t('copy: into a project id that is nonsense -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plans/copy`, { from: ['a'], to: 'X ' + U }); t('copy: names as lists -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plans/standard`, {}); t('standard: no name -> 400', r.s === 400, r.s);
r = await A('POST', `/projects/${P1}/plans/standard`, { plan_name: W }); t('standard: a name that exists (the burst plan) -> 409', r.s === 409, r.s);
t('standard: nothing was half-made after those refusals', psql(`SELECT COUNT(*) FROM plan_schedule_templates WHERE plan_name = '${W}' AND installment_name = 'Booking Amount'`) === '0');
// a double click on Add: the second is refused, the plan has the row once
const D = 'Dbl ' + U;
r = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: D, installment_name: 'Once', percentage: 5, installment_index: 1 }));
const again = await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: D, installment_name: 'Once', percentage: 5, installment_index: 1 }));
t('double click: the second add is refused', r.s === 201 && again.s === 409, `${r.s} ${again.s}`);
// plans of the same name in two projects are separate
const same = 'Twin ' + U;
await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: same, installment_name: 'T', percentage: 10, installment_index: 1 }));
await A('POST', `/projects/${P2}/plan-templates`, wrow({ plan_name: same, installment_name: 'T', percentage: 10, installment_index: 1 }));
r = await A('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent(same)}`);
t('projects: deleting a plan in one project leaves the same name in the other', r.s === 200 && psql(`SELECT COUNT(*) FROM plan_schedule_templates WHERE project_id = '${P2}' AND plan_name = '${same}'`) === '1');
// the freeze counts only live bookings, and a plan name only counts in its own project
const bk2 = psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}', '${unit}', '${P2}', '${same}', 'draft') RETURNING id`).split('\n')[0];
await A('POST', `/projects/${P1}/plan-templates`, wrow({ plan_name: same, installment_name: 'T', percentage: 10, installment_index: 1 }));
r = await A('PATCH', `/projects/${P1}/plan-templates/${(await A('GET', `/projects/${P1}/plan-templates?planName=${same}`)).j.data[0].id}`, { percentage: 20 });
t('projects: a booking in project B does not freeze the same plan name in project A', r.s === 200, r.s + ' ' + JSON.stringify(r.j));
psql(`DELETE FROM booking_records WHERE id = '${bk2}'`);

// who is asking
const SEc = SE;
for (const [who, c] of [['sales_executive', SE], ['read_only_viewer', RO]]) {
  r = await c('POST', `/projects/${P1}/plans/standard`, { plan_name: 'Nope ' + U }); t(`roles: ${who} cannot make the standard plan -> 403`, r.s === 403, r.s);
  r = await c('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent(plan)}`); t(`roles: ${who} cannot delete a plan -> 403`, r.s === 403, r.s);
  r = await c('POST', `/projects/${P1}/plan-templates/${r2}/addon-charges`, { charge_master_id: ch, pct: 1 }); t(`roles: ${who} cannot change add-on % -> 403`, r.s === 403, r.s);
}
r = await PM('DELETE', `/projects/${P1}/plans?planName=${encodeURIComponent(plan)}`); t('roles: project_manager cannot delete a whole plan -> 403', r.s === 403, r.s);
r = await call('')('GET', `/projects/${P1}/plans`); t('roles: no token -> 401', r.s === 401, r.s);
const bad401 = await fetch(B + `/projects/${P1}/plans`, { headers: { authorization: 'Bearer not.a.token' } }); t('roles: a made-up token -> 401', bad401.status === 401, bad401.status);

// ---------- a 0% row would raise a demand of nothing; only the possession row may be 0% ----------
{ const P0 = await proj('Z'), zp = 'Zero ' + U;
  r = await A('POST', `/projects/${P0}/plan-templates`, row({ plan_name: zp, installment_name: 'Nil', installment_type: 'installment', percentage: 0, installment_index: 1 }));
  t('0%: an installment row at 0% -> 400', r.s === 400 && /more than 0/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  r = await A('POST', `/projects/${P0}/plan-templates`, row({ plan_name: zp, installment_name: 'Nil booking', installment_type: 'booking', percentage: 0, installment_index: 1 }));
  t('0%: a booking row at 0% -> 400', r.s === 400, r.s);
  r = await A('POST', `/projects/${P0}/plan-templates`, row({ plan_name: zp, installment_name: 'Possession', installment_type: 'possession', percentage: 0, installment_index: 2 }));
  t('0%: the possession row may be 0%', r.s === 201, r.s + ' ' + JSON.stringify(r.j));
  r = await A('POST', `/projects/${P0}/plans/standard`, { plan_name: 'Std ' + U });
  t('0%: the usual 9-row schedule still builds (its possession row is 0%)', r.s === 201, r.s + ' ' + JSON.stringify(r.j)); }
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
