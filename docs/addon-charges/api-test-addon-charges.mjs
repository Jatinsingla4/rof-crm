// Add-on charge checks: roles, bad input, duplicates, races, demand totals, cancel/waive rules, audit, customer list.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-addon-charges.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), SA = call(await login('support_agent@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
let r;
const co = (await A('POST', '/companies', { name: 'Addon Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Addon ${tag} ${U}`, reraNumber: `AD${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const M = (p, b) => A('POST', '/addon-charges/master', { projectId: p, chargeName: 'x', ...b });

// ---------- master: roles ----------
for (const [n, c] of [['sales_executive', SE], ['accounts_finance', AF], ['read_only_viewer', RO], ['support_agent', SA]]) {
  r = await c('POST', '/addon-charges/master', { projectId: P1, chargeName: 'Nope ' + n, defaultAmount: 1 }); t(`roles: ${n} cannot create a master -> 403`, r.s === 403, r.s);
}
r = await RO('GET', `/addon-charges/master?projectId=${P1}`); t('roles: read_only_viewer can read masters', r.s === 200, r.s);
r = await PM('POST', '/addon-charges/master', { projectId: P1, chargeName: 'PM Charge ' + U, defaultAmount: 1000 }); t('roles: project_manager can create', r.s === 201, r.s);
r = await PM('DELETE', `/addon-charges/master/${r.j?.data?.id}`); t('roles: project_manager cannot delete (matrix) -> 403', r.s === 403, r.s);

// ---------- master: bad input ----------
const bm = async (n, o, re) => { r = await M(P1, { chargeName: 'Bad ' + n + U, defaultAmount: 10, ...o }); t('master: ' + n + ' -> 400', r.s === 400 && (!re || re.test(r.j?.error || '')), r.s + ' ' + JSON.stringify(r.j)); };
await bm('no name', { chargeName: '' }, /name/i); await bm('name spaces', { chargeName: '   ' }, /name/i); await bm('markup name', { chargeName: '<b>x' }, /character/);
await bm('name over 200', { chargeName: 'x'.repeat(201) }, /200/); await bm('numeric name', { chargeName: 123 }, /text/); await bm('array name', { chargeName: ['a'] }, /text/);
await bm('negative amount', { defaultAmount: -1 }, /Amount/); await bm('text amount', { defaultAmount: 'abc' }, /Amount/); await bm('exponent amount', { defaultAmount: '1e3' }, /Amount/);
await bm('3 decimals', { defaultAmount: '1.234' }, /Amount/); await bm('huge amount', { defaultAmount: 1e12 }, /Amount/); await bm('boolean amount', { defaultAmount: true }, /Amount/);
await bm('cgst over 50', { cgstPct: 51 }, /CGST/); await bm('sgst negative', { sgstPct: -1 }, /SGST/); await bm('cgst text', { cgstPct: 'x' }, /CGST/);
await bm('unknown rate type', { rateType: 'magic' }, /Rate type/); await bm('per sq.ft. with no rate', { rateType: 'per_sqft' }, /Rate/); await bm('per sq.ft. rate 0', { rateType: 'per_sqft', ratePerSqftInr: 0 }, /more than 0/);
r = await M('abc', { defaultAmount: 1 }); t('master: project id not valid -> 400', r.s === 400, r.s);
r = await M(NIL, { defaultAmount: 1 }); t('master: unknown project -> 404', r.s === 404, r.s);
r = await A('POST', '/addon-charges/master', undefined, '[1]'); t('master: array body -> 400', r.s === 400, r.s);
r = await A('POST', '/addon-charges/master', undefined, '{oops'); t('master: broken JSON -> 4xx', r.s >= 400 && r.s < 500, r.s);
r = await A('GET', '/addon-charges/master'); t('master list: no project -> 400', r.s === 400, r.s);
r = await A('GET', `/addon-charges/master?projectId=${P1}&projectId=${P2}`); t('master list: repeated project -> 400', r.s === 400, r.s);

// ---------- master: create, duplicates, races ----------
r = await M(P1, { chargeName: ' Club House ' + U, defaultAmount: 50000 }); t('master: create (name trimmed)', r.s === 201 && r.j.data.charge_name === 'Club House ' + U, JSON.stringify(r.j)); const M1 = r.j.data.id;
r = await M(P1, { chargeName: 'club house ' + U, defaultAmount: 1 }); t('master: same name other case -> 400', r.s === 400 && /already exists/.test(r.j.error), JSON.stringify(r.j));
r = await M(P2, { chargeName: 'Club House ' + U, defaultAmount: 1 }); t('master: same name in another project is fine', r.s === 201, r.s);
const race = await Promise.all(Array.from({ length: 6 }, () => M(P1, { chargeName: 'Race ' + U, defaultAmount: 5 }))); t('master: 6 parallel same-name creates -> exactly 1', race.filter(x => x.s === 201).length === 1 && race.every(x => x.s === 201 || x.s === 400), race.map(x => x.s).join());
r = await M(P1, { chargeName: 'Sqft ' + U, rateType: 'per_sqft', ratePerSqftInr: 100, defaultAmount: 999 }); t('master: per sq.ft. keeps amount 0', r.s === 201 && Number(r.j.data.default_amount) === 0 && Number(r.j.data.rate_per_sqft_inr) === 100, JSON.stringify(r.j)); const MS = r.j.data.id;

// ---------- master: edit ----------
const pm = (id, b) => A('PATCH', `/addon-charges/master/${id}`, b);
r = await pm('abc', { chargeName: 'q' }); t('master edit: bad id -> 400', r.s === 400, r.s);
r = await pm(NIL, { chargeName: 'q' }); t('master edit: unknown -> 404', r.s === 404, r.s);
r = await pm(M1, { chargeName: 'club house ' + U + '' }); t('master edit: own name in other case is fine', r.s === 200, r.s);
r = await pm(M1, { chargeName: 'Sqft ' + U }); t('master edit: name of another charge -> 400', r.s === 400, r.s);
r = await pm(M1, { defaultAmount: -5 }); t('master edit: negative -> 400', r.s === 400, r.s);
r = await pm(M1, { isActive: false }); t('master edit: isActive false is refused (use Deactivate) -> 400', r.s === 400, r.s);
r = await pm(M1, { isActive: 'yes' }); t('master edit: isActive text -> 400', r.s === 400, r.s);
r = await pm(M1, { rateType: 'per_sqft' }); t('master edit: switching to per sq.ft. without a rate -> 400', r.s === 400, r.s);
r = await pm(M1, {}); t('master edit: empty body changes nothing, 200', r.s === 200 && Number(r.j.data.default_amount) === 50000, JSON.stringify(r.j));
r = await pm(M1, { cgstPct: '2.5', sgstPct: 2.5 }); t('master edit: GST change', r.s === 200 && Number(r.j.data.cgst_pct) === 2.5, JSON.stringify(r.j)); await pm(M1, { cgstPct: 9, sgstPct: 9 });

// ---------- customers, bookings, demands ----------
const mkCust = async (P, tag, area) => {
  const cons = psql(`INSERT INTO consumers (name, mobile) VALUES ('Addon ${tag} ${U}', '9${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}') RETURNING id`);
  const tower = psql(`SELECT id FROM towers WHERE project_id='${P}' LIMIT 1`) || (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
  const unit = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor, carpet_area_sqft) VALUES ('${P}', '${tower}', '${tag}-${U}', 'available', '2BHK', 1, ${area}) RETURNING id`);
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id) VALUES ('${cons}','${unit}','${P}') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${cons}','${unit}','${P}', 1000000) RETURNING id`);
  psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}','${unit}','${P}','AP ${U}','draft') RETURNING id`);
  for (const i of [1, 2]) psql(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, amount_due_inr, status) VALUES ('${pp}', ${i}, '${cons}', 500000, 'raised') RETURNING id`);
  return { cons, pp, unit };
};
// plan AP (50/50) in P1; the club-house charge is billed 100% on the first instalment
for (const [i, n, pct] of [[1, 'First', 50], [2, 'Second', 50]]) await A('POST', `/projects/${P1}/plan-templates`, { plan_name: 'AP ' + U, installment_name: n, installment_type: 'installment', percentage: pct, due_date_offset_days: i * 30, installment_index: i });
const tpl1 = psql(`SELECT id FROM plan_schedule_templates WHERE project_id='${P1}' AND installment_index=1`);
r = await A('POST', `/projects/${P1}/plan-templates/${tpl1}/addon-charges`, { charge_master_id: M1, pct: 100 }); t('setup: plan bills the charge 100% on instalment 1', r.s === 200, JSON.stringify(r.j));
const C1 = await mkCust(P1, 'C1', 1000), C2 = await mkCust(P1, 'C2', 500), C3 = await mkCust(P2, 'C3', 800), C4 = await mkCust(P1, 'C4', 700);
const dem = (cust, i) => psql(`SELECT addon_charge_amount||'/'||addon_cgst_amount||'/'||addon_sgst_amount FROM demands WHERE payment_plan_id='${cust.pp}' AND installment_index=${i}`);
const ch = (o) => ({ consumerId: C1.cons, projectId: P1, chargeMasterId: M1, amount: 50000, ...o });

// ---------- customer charge: roles and bad input ----------
r = await SE('POST', '/addon-charges/consumer', ch()); t('roles: sales_executive cannot add a customer charge -> 403', r.s === 403, r.s);
r = await RO('POST', '/addon-charges/consumer', ch()); t('roles: read_only_viewer cannot -> 403', r.s === 403, r.s);
r = await RO('GET', `/addon-charges/consumer?consumerId=${C1.cons}`); t('roles: read_only_viewer can read', r.s === 200, r.s);
const bc = async (n, o, re) => { r = await A('POST', '/addon-charges/consumer', ch(o)); t('customer charge: ' + n + ' -> 400', r.s === 400 && (!re || re.test(r.j?.error || '')), r.s + ' ' + JSON.stringify(r.j)); };
await bc('zero amount', { amount: 0 }, /more than 0/); await bc('negative', { amount: -5 }, /Amount/); await bc('text', { amount: 'abc' }, /Amount/); await bc('missing amount', { amount: undefined }, /Amount/);
await bc('exponent', { amount: '1e3' }, /Amount/); await bc('3 decimals', { amount: '1.005' }, /Amount/); await bc('huge', { amount: 1e10 }, /Amount/); await bc('array amount', { amount: [5] }, /Amount/);
await bc('bad consumer id', { consumerId: 'x' }, /consumerId/); await bc('bad project id', { projectId: 'x' }, /projectId/); await bc('bad master id', { chargeMasterId: 'x' }, /chargeMasterId/);
await bc('customer not in this project', { consumerId: C3.cons }, /no active booking/); await bc('unknown customer', { consumerId: NIL }, /no active booking/);
await bc('master of another project', { chargeMasterId: (await M(P2, { chargeName: 'Other ' + U, defaultAmount: 1 })).j.data.id }, /does not exist in this project/);
await bc('no master and no name', { chargeMasterId: undefined, chargeName: undefined }, /name/i); await bc('long remark', { remark: 'x'.repeat(1001) }, /1000/); await bc('markup remark', { remark: '<script>' }, /character/);
await bc('impossible date', { effectiveDate: '2026-02-30' }, /date/i); await bc('date text', { effectiveDate: 'soon' }, /date/i); await bc('cgst 99', { cgstPct: 99 }, /CGST/);
r = await A('POST', '/addon-charges/consumer', undefined, '"text"'); t('customer charge: plain string body -> 400', r.s === 400, r.s);

// ---------- customer charge: add, totals, duplicates, race ----------
r = await A('POST', '/addon-charges/consumer', ch({ remark: ' first ' })); t('customer charge: add', r.s === 201 && Number(r.j.data.total_amount) === 59000 && r.j.data.remark === 'first', JSON.stringify(r.j)); const CH1 = r.j.data.id;
t('demand 1 now carries the charge + GST', dem(C1, 1) === '50000.00/4500/4500', dem(C1, 1)); t('demand 2 untouched', dem(C1, 2) === '0.00/0/0', dem(C1, 2));
r = await A('POST', '/addon-charges/consumer', ch()); t('customer charge: same charge twice -> 400', r.s === 400 && /already added/.test(r.j.error), JSON.stringify(r.j));
const rc = await Promise.all(Array.from({ length: 8 }, () => A('POST', '/addon-charges/consumer', ch({ consumerId: C2.cons })))); t('customer charge: 8 parallel adds -> exactly 1', rc.filter(x => x.s === 201).length === 1 && rc.every(x => x.s === 201 || x.s === 400), rc.map(x => x.s).join());
t('race: demand counted once', dem(C2, 1) === '50000.00/4500/4500', dem(C2, 1));
r = await A('POST', '/addon-charges/consumer', ch({ chargeMasterId: undefined, chargeName: 'Custom ' + U, consumerId: C4.cons, amount: '100.5' })); t('customer charge: custom name without master, GST default 9+9', r.s === 201 && Number(r.j.data.total_amount) === 118.6, JSON.stringify(r.j));
r = await A('POST', '/addon-charges/consumer', ch({ chargeMasterId: undefined, chargeName: 'custom ' + U, consumerId: C4.cons })); t('customer charge: same custom name other case -> 400', r.s === 400, r.s);

// ---------- customer charge: edit ----------
const pc = (id, b, raw) => A('PATCH', `/addon-charges/consumer/${id}`, b, raw);
r = await pc('x', { amount: 1 }); t('edit: bad id -> 400', r.s === 400, r.s); r = await pc(NIL, { amount: 1 }); t('edit: unknown -> 404', r.s === 404, r.s);
r = await pc(CH1, { amount: -1 }); t('edit: negative -> 400', r.s === 400, r.s); r = await pc(CH1, { amount: 0 }); t('edit: zero -> 400', r.s === 400, r.s); r = await pc(CH1, { increaseAmount: 'abc' }); t('edit: bad increase -> 400', r.s === 400, r.s);
r = await pc(CH1, { increaseAmount: 10000 }); t('edit: increase only keeps the amount', r.s === 200 && Number(r.j.data.amount) === 50000 && Number(r.j.data.increase_amount) === 10000 && Number(r.j.data.total_amount) === 70800, JSON.stringify(r.j));
t('demand follows the increase', dem(C1, 1) === '60000.00/5400/5400', dem(C1, 1));
r = await pc(CH1, { remark: 'only a note' }); t('edit: remark only keeps amount and increase', r.s === 200 && Number(r.j.data.amount) === 50000 && Number(r.j.data.increase_amount) === 10000, JSON.stringify(r.j));
r = await pc(CH1, undefined, '[]'); t('edit: array body changes nothing, 200', r.s === 200 && Number(r.j.data.total_amount) === 70800, JSON.stringify(r.j));

// ---------- master change cascades ----------
r = await pm(M1, { defaultAmount: 80000 }); t('master edit: cascades to customers', r.s === 200 && r.j.affectedConsumers === 2, JSON.stringify(r.j));
t('cascade: customer charge keeps its increase (80000+10000) and GST', psql(`SELECT amount||'/'||increase_amount||'/'||total_amount FROM consumer_addon_charges WHERE id='${CH1}'`) === '80000.00/10000.00/106200.00');
t('cascade: demand follows', dem(C1, 1) === '90000.00/8100/8100', dem(C1, 1)); t('cascade: other customer demand too', dem(C2, 1) === '80000.00/7200/7200', dem(C2, 1));
r = await pm(MS, { ratePerSqftInr: 120 }); t('per sq.ft. master edit ok', r.s === 200, r.s);
r = await A('POST', '/addon-charges/consumer', ch({ chargeMasterId: MS, consumerId: C4.cons, amount: 84000 })); const CHS = r.j?.data?.id; t('per sq.ft. customer charge added', r.s === 201, r.s);
r = await pm(MS, { ratePerSqftInr: 150 }); t('per sq.ft. master edit prices from the unit (700 sq.ft. x 150)', r.s === 200 && psql(`SELECT amount FROM consumer_addon_charges WHERE id='${CHS}'`) === '105000.00', JSON.stringify(r.j));

// ---------- cancel and waive ----------
const cancel = (id) => A('PATCH', `/addon-charges/consumer/${id}/cancel`), waive = (id, b) => A('PATCH', `/addon-charges/consumer/${id}/waive`, b);
r = await cancel('x'); t('cancel: bad id -> 400', r.s === 400, r.s); r = await cancel(NIL); t('cancel: unknown -> 404', r.s === 404, r.s);
r = await SE('PATCH', `/addon-charges/consumer/${CH1}/cancel`); t('cancel: sales_executive -> 403', r.s === 403, r.s);
r = await AF('PATCH', `/addon-charges/consumer/${CH1}/cancel`); t('cancel: accounts_finance allowed', r.s === 200, r.s);
t('cancel: demand back to 0', dem(C1, 1) === '0.00/0/0', dem(C1, 1));
r = await cancel(CH1); t('cancel twice -> 400', r.s === 400 && /already cancelled/.test(r.j.error), JSON.stringify(r.j));
r = await waive(CH1, { waiveRemark: 'x' }); t('waive a cancelled charge -> 400', r.s === 400, r.s);
r = await pc(CH1, { amount: 5 }); t('edit a cancelled charge -> 400', r.s === 400, r.s);
const c2 = psql(`SELECT id FROM consumer_addon_charges WHERE consumer_id='${C2.cons}' AND status='active'`);
r = await waive(c2, {}); t('waive: remark is required -> 400', r.s === 400, r.s); r = await waive(c2, { waiveRemark: '   ' }); t('waive: blank remark -> 400', r.s === 400, r.s);
r = await waive(c2, { waiveRemark: ['a'] }); t('waive: array remark -> 400', r.s === 400, r.s);
r = await waive(c2, { waiveRemark: 'Goodwill for delay' }); t('waive: ok', r.s === 200 && r.j.data.status === 'waived', JSON.stringify(r.j)); t('waive: demand back to 0', dem(C2, 1) === '0.00/0/0', dem(C2, 1));
r = await waive(c2, { waiveRemark: 'again' }); t('waive twice -> 400', r.s === 400, r.s); r = await cancel(c2); t('cancel a waived charge -> 400', r.s === 400, r.s);
r = await Promise.all([cancel(CHS), cancel(CHS), waive(CHS, { waiveRemark: 'race' })]); t('cancel/cancel/waive in parallel -> exactly one wins', r.filter(x => x.s === 200).length === 1, r.map(x => x.s).join());
r = await A('POST', '/addon-charges/consumer', ch({ consumerId: C2.cons })); t('after waive the charge can be added again', r.s === 201, JSON.stringify(r.j));

// ---------- deactivate a master ----------
r = await A('DELETE', `/addon-charges/master/${M1}`); t('deactivate: cancels active customer charges', r.s === 200 && r.j.affectedConsumers === 1, JSON.stringify(r.j));
t('deactivate: demand back to 0', dem(C2, 1) === '0.00/0/0', dem(C2, 1));
r = await A('DELETE', `/addon-charges/master/${M1}`); t('deactivate twice -> 404', r.s === 404, r.s);
r = await A('DELETE', '/addon-charges/master/x'); t('deactivate: bad id -> 400', r.s === 400, r.s);
r = await A('POST', '/addon-charges/consumer', ch({ consumerId: C4.cons })); t('a deactivated master cannot be given to a customer -> 400', r.s === 400, r.s);
r = await A('GET', `/addon-charges/master?projectId=${P1}`); t('deactivated master leaves the list', !r.j.data.some(x => x.id === M1), '');
r = await M(P1, { chargeName: 'Club House ' + U, defaultAmount: 1 }); t('its name can be used again after deactivation', r.s === 201, JSON.stringify(r.j));

// ---------- customer list ----------
const L = (q) => A('GET', '/addon-charges/consumers?' + q);
r = await L(`projectId=${P1}`); t('list: customers of the project', r.s === 200 && r.j.data.length === 3 && r.j.data.every(x => x.project_name.startsWith('Addon A')), r.s + ' ' + r.j?.data?.length);
r = await L(`projectId=${P1}&name=${encodeURIComponent('%')}`); t('list: % is searched literally, finds nobody', r.s === 200 && r.j.data.length === 0, r.j?.data?.length);
r = await L(`projectId=${P1}&unitNo=${encodeURIComponent('C1-')}`); t('list: unit search', r.s === 200 && r.j.data.length === 1, r.j?.data?.length);
r = await L(`projectId=${P1}&name=${encodeURIComponent("x' or '1'='1")}`); t('list: SQL text is only text', r.s === 200 && r.j.data.length === 0, r.s);
for (const [n, q] of [['no project', ''], ['bad project', 'projectId=x'], ['bad tower', `projectId=${P1}&towerId=x`], ['repeated name', `projectId=${P1}&name=a&name=b`], ['name over 100', `projectId=${P1}&name=${'x'.repeat(101)}`]]) { r = await L(q); t(`list: ${n} -> 400`, r.s === 400, r.s); }
r = await RO('GET', `/addon-charges/consumers?projectId=${P1}`); t('list: read_only_viewer can read', r.s === 200, r.s);

// ---------- money already received: frozen demands ----------
const P3 = await mkProj('C');
for (const [i, pct] of [[1, 40], [2, 30], [3, 30]]) await A('POST', `/projects/${P3}/plan-templates`, { plan_name: 'FZ ' + U, installment_name: 'I' + i, installment_type: 'installment', percentage: pct, due_date_offset_days: i * 30, installment_index: i });
const MF = (await M(P3, { chargeName: 'Frozen test ' + U, defaultAmount: 100000 })).j.data.id;
for (const [i, pct] of [[1, 50], [2, 25], [3, 25]]) await A('POST', `/projects/${P3}/plan-templates/${psql(`SELECT id FROM plan_schedule_templates WHERE project_id='${P3}' AND installment_index=${i}`)}/addon-charges`, { charge_master_id: MF, pct });
const mkF = (tag) => {
  const cons = psql(`INSERT INTO consumers (name, mobile) VALUES ('Frozen ${tag} ${U}', '9${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}') RETURNING id`);
  const tower = psql(`SELECT id FROM towers WHERE project_id='${P3}' LIMIT 1`) || psql(`INSERT INTO towers (project_id, tower_name) VALUES ('${P3}','F${U}') RETURNING id`);
  const unit = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor, carpet_area_sqft) VALUES ('${P3}','${tower}','${tag}-${U}','available','2BHK',1,900) RETURNING id`);
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id) VALUES ('${cons}','${unit}','${P3}') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${cons}','${unit}','${P3}',1000000) RETURNING id`);
  psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}','${unit}','${P3}','FZ ${U}','draft') RETURNING id`);
  for (const [i, a] of [[1, 400000], [2, 300000], [3, 300000]]) psql(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, amount_due_inr, status) VALUES ('${pp}',${i},'${cons}',${a},'raised') RETURNING id`);
  return { cons, pp };
};
const pay = (f, idx, status = 'cleared', withIdx = true) => psql(`INSERT INTO receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, status, received_date) VALUES ('${f.cons}','${f.pp}',${withIdx ? idx : 'NULL'},1000,'cash','${status}', CURRENT_DATE) RETURNING id`);
const fd = (f) => [1, 2, 3].map(i => psql(`SELECT addon_charge_amount FROM demands WHERE payment_plan_id='${f.pp}' AND installment_index=${i}`)).join('/');
const fch = (f, o) => ({ consumerId: f.cons, projectId: P3, chargeMasterId: MF, amount: 100000, ...o });

// F1: instalment 1 is paid, then the charge is added -> its share moves to the next unpaid instalment
const F1 = mkF('F1'); pay(F1, 1);
r = await A('POST', '/addon-charges/consumer', fch(F1)); t('frozen: add after instalment 1 is paid -> 201 with a note', r.s === 201 && /instalment 2/.test(r.j.note || ''), JSON.stringify(r.j)); const F1c = r.j?.data?.id;
t('frozen: paid instalment untouched, its share moved to instalment 2, total stays 100000', fd(F1) === '0.00/75000.00/25000.00', fd(F1));
r = await A('PATCH', `/addon-charges/consumer/${F1c}/cancel`); t('frozen: cancelling a charge that never touched the paid instalment works', r.s === 200 && fd(F1) === '0.00/0.00/0.00', r.s + ' ' + fd(F1));
// F2: charge added first, instalment 1 paid after -> cut/cancel/waive refused, raise allowed
const F2 = mkF('F2'); r = await A('POST', '/addon-charges/consumer', fch(F2)); const F2c = r.j.data.id; t('frozen: normal add spreads 50/25/25', fd(F2) === '50000.00/25000.00/25000.00', fd(F2));
const rcp = pay(F2, 1);
r = await A('PATCH', `/addon-charges/consumer/${F2c}/cancel`); t('frozen: cancel after payment -> 400 naming the instalment', r.s === 400 && /Instalment 1 already has a payment/.test(r.j.error), JSON.stringify(r.j));
r = await A('PATCH', `/addon-charges/consumer/${F2c}/waive`, { waiveRemark: 'try' }); t('frozen: waive after payment -> 400', r.s === 400, r.s);
r = await A('PATCH', `/addon-charges/consumer/${F2c}`, { amount: 60000 }); t('frozen: lowering the amount after payment -> 400', r.s === 400, r.s);
t('frozen: refused changes left charge and demands as they were', fd(F2) === '50000.00/25000.00/25000.00' && psql(`SELECT status||amount FROM consumer_addon_charges WHERE id='${F2c}'`) === 'active100000.00', fd(F2));
r = await A('PATCH', `/addon-charges/consumer/${F2c}`, { amount: 200000 }); t('frozen: raising the amount is allowed; the extra for the paid instalment moves forward', r.s === 200 && /instalment 2/.test(r.j.note || '') && fd(F2) === '50000.00/100000.00/50000.00', r.s + ' ' + fd(F2) + JSON.stringify(r.j.note));
r = await A('PATCH', `/addon-charges/consumer/${F2c}`, { amount: 200000 }); t('frozen: saving the same amount again changes nothing', r.s === 200 && !r.j.note && fd(F2) === '50000.00/100000.00/50000.00', fd(F2));
// the carried amount now sits on instalment 2, which has no payment: cutting back the carried part is blocked only by the paid instalment's own share
r = await A('PATCH', `/addon-charges/consumer/${F2c}`, { amount: 100000 }); t('frozen: back to 100000 is allowed (the paid instalment keeps its 50000, only the carried part goes)', r.s === 200 && fd(F2) === '50000.00/25000.00/25000.00', r.s + ' ' + fd(F2));
// a bounced cheque frees the demand
psql(`UPDATE receipts SET status='bounced' WHERE id='${rcp}'`);
r = await A('PATCH', `/addon-charges/consumer/${F2c}/cancel`); t('frozen: a bounced receipt no longer freezes -> cancel works', r.s === 200 && fd(F2) === '0.00/0.00/0.00', r.s + ' ' + fd(F2));
// F3: other kinds of receipt
const F3 = mkF('F3'); pay(F3, 1, 'cancelled'); pay(F3, 1, 'cleared', false);
r = await A('POST', '/addon-charges/consumer', fch(F3)); t('frozen: a cancelled receipt, and a receipt with no instalment, do not freeze', r.s === 201 && !r.j.note && fd(F3) === '50000.00/25000.00/25000.00', fd(F3));
const F3c = r.j.data.id; pay(F3, 2, 'pending');
r = await A('PATCH', `/addon-charges/consumer/${F3c}/cancel`); t('frozen: a pending cheque counts as money received -> cancel refused', r.s === 400 && /Instalment 2/.test(r.j.error), JSON.stringify(r.j));
// F4: demand marked paid with no receipt row (old data) freezes too; cancelled demand is ignored
const F4 = mkF('F4'); psql(`UPDATE demands SET status='paid' WHERE payment_plan_id='${F4.pp}' AND installment_index=1`); psql(`UPDATE demands SET status='cancelled' WHERE payment_plan_id='${F4.pp}' AND installment_index=3`);
r = await A('POST', '/addon-charges/consumer', fch(F4)); t('frozen: status paid freezes; a cancelled instalment is skipped (25000 + moved 50000)', r.s === 201 && fd(F4) === '0.00/75000.00/0.00', r.s + ' ' + fd(F4));
// F5: everything paid
const F5 = mkF('F5'); for (const i of [1, 2, 3]) pay(F5, i);
r = await A('POST', '/addon-charges/consumer', fch(F5)); t('frozen: every instalment paid -> 400, nothing saved', r.s === 400 && /separate demand/.test(r.j.error) && psql(`SELECT count(*) FROM consumer_addon_charges WHERE consumer_id='${F5.cons}'`) === '0', JSON.stringify(r.j));
// master changes hit the same rule, all or nothing
r = await pm(MF, { defaultAmount: 50000 }); t('frozen: lowering the master while a customer has paid -> 400 naming them, nothing changed', r.s === 400 && /Frozen F3/.test(r.j.error) && psql(`SELECT default_amount FROM addon_charge_master WHERE id='${MF}'`) === '100000.00' && psql(`SELECT amount FROM consumer_addon_charges WHERE id='${F3c}'`) === '100000.00', JSON.stringify(r.j));
r = await A('DELETE', `/addon-charges/master/${MF}`); t('frozen: deactivating the master while a customer has paid -> 400, master stays on', r.s === 400 && psql(`SELECT is_active FROM addon_charge_master WHERE id='${MF}'`) === 't', JSON.stringify(r.j));
r = await pm(MF, { defaultAmount: 120000 }); t('frozen: raising the master is fine', r.s === 200, JSON.stringify(r.j));
// races with a receipt arriving between checks cannot be tested here; parallel changes on one customer still serialise
const F6 = mkF('F6'); r = await A('POST', '/addon-charges/consumer', fch(F6)); const F6c = r.j.data.id; pay(F6, 1);
const rr = await Promise.all([1, 2, 3, 4].map(() => A('PATCH', `/addon-charges/consumer/${F6c}`, { amount: 150000 }))); t('frozen: 4 parallel raises all succeed and the total is billed once', rr.every(x => x.s === 200) && psql(`SELECT sum(addon_charge_amount)::int FROM demands WHERE payment_plan_id='${F6.pp}'`) === '150000', rr.map(x => x.s).join() + ' ' + fd(F6));

// ---------- audit ----------
const au = (ty, a) => Number(psql(`SELECT count(*) FROM audit_logs WHERE resource_type='${ty}' AND action='${a}'`));
t('audit: master created / updated / deleted', au('addon_charge_master', 'create') >= 5 && au('addon_charge_master', 'update') >= 5 && au('addon_charge_master', 'delete') >= 1);
t('audit: customer charge created / updated', au('consumer_addon_charge', 'create') >= 4 && au('consumer_addon_charge', 'update') >= 6);
t('refused writes left nothing half-done', psql(`SELECT count(*) FROM consumer_addon_charges WHERE project_id='${P1}'`) === '5', psql(`SELECT count(*) FROM consumer_addon_charges WHERE project_id='${P1}'`));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
