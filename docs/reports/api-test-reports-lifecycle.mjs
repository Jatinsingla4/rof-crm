// Reports after the other modules have moved a unit around (second look at the numbers, own data, separate from api-test-reports.mjs):
//  1. a booking with NO rate (made through the API or imported) is priced at the unit's base price, like Booking does when it confirms the payment
//     (the reports used to show unit cost 0 and received % 0 for it), and a booking with a rate costs rate x carpet area; on every report that shows cost.
//  2. a surrendered applicant is not a customer, but the cash stays in Collection; a transferred unit has ONE customer (the buyer) with the money paid so far;
//     a shifted applicant moves to the new unit; a restored surrender is a customer again.
//  3. Collection = the CLEARED receipts of the project (not bounced, not pending), also against an independent SQL read.
// Run:  BASE=http://localhost:3014/api node api-test-reports-lifecycle.mjs   (psql must reach the same database)
let pass = 0, fail = 0; const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
import { secondAdminToken } from '../_shared/second-admin.mjs';
export const B = process.env.BASE || 'http://localhost:3014/api';
const login = async (r) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: r + '@test.local', password: 'Test#Pass1234' }) })).json()).token;
export const mk = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
export const A = mk(await login('super_admin'));
export const CK = mk(await secondAdminToken(B, A));   // clears and bounces receipts: whoever recorded a receipt does not clear or bounce it
export const psql = (q) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
export const U = Date.now().toString(36).slice(-5);
export const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
let mob = 0; const mobv = () => '9' + String((Date.now() % 1e7) * 100 + (++mob) + 300000000).slice(-9).padStart(9, '0');
const must = async (l, p) => { const x = await p; if (x.s >= 300) throw new Error(l + ' ' + x.s + JSON.stringify(x.j).slice(0, 250)); return x.j.data ?? x.j; };
export const S = {};
const co = (await must('co', A('POST', '/companies', { name: 'RP Co ' + U }))).id;
S.name = `RP ${U}`;
S.P = (await must('proj', A('POST', '/projects', { companyId: co, name: S.name, reraNumber: 'RP-' + U, tcpLicence: 'x' }))).id;
S.T = (await must('tw', A('POST', `/projects/${S.P}/towers`, { towerName: 'RT' + U }))).id;
S.plan = 'RPlan ' + U; let k = 0; for (const pc of [20, 30, 50]) await must('plan', A('POST', `/projects/${S.P}/plan-templates`, { plan_name: S.plan, installment_name: 'R' + (++k), installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k }));
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(x => x.from_date <= today && x.to_date >= today)?.id;
if (!slab) slab = (await must('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
const tax = (await must('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: 'RP ' + U, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.P, slabId: slab, gstTaxId: tax, chargeType: ct });
let un = 0; export const unit = async (carpet = 900 + Math.floor(Math.random() * 300)) => (await must('unit', A('POST', '/units', { projectId: S.P, towerId: S.T, unitNumber: `R${++un}-${U}`, floor: 3, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet + 150, basePriceInr: 8000000 + un * 100000, totalPriceInr: 8500000 + un * 100000 }))).id;
export const person = async (n) => (await must('person', A('POST', '/consumers', { name: `RP ${n} ${U}`, mobile: mobv(), project_id: S.P }))).id;
export const sell = async (n, amt = 25000) => { const c = await person(n), u = await unit(); const b = await must('book', A('POST', '/booking', { consumer_id: c, project_id: S.P, unit_id: u, selected_plan_name: S.plan, booking_date: today })); await must('confirm', A('PATCH', `/booking/${b.id}`, { booking_amount: amt, payment_mode: 'cash' })); return { c, u, b: b.id, plan: psql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`) }; };
let rn = 0; export const receipt = async (c, amt, st = 'cleared', extra = {}) => { const x = await must('receipt', A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: amt, paymentMode: 'neft', referenceNumber: `RP${U}${++rn}`, paymentDate: today, ...extra })); if (st === 'cleared') await must('clear', CK('PATCH', `/payments/receipts/${x.id}/clear`, { clearing_date: today })); else if (st === 'deposited') await must('dep', A('PATCH', `/payments/receipts/${x.id}/deposit`, { deposit_date: today })); else if (st === 'bounced') { await must('clear', CK('PATCH', `/payments/receipts/${x.id}/clear`, { clearing_date: today })); await must('bounce', CK('PATCH', `/payments/receipts/${x.id}/bounce`, { reason: 'test', penaltyAmount: 500 })); } return x.id; };
export const raise = async (c, idx, due = later(10)) => { const ds = psql(`select id from demands where consumer_id='${c}' and installment_index=${idx} and status='pending'`); if (ds) await must('raise', A('PATCH', '/payments/demands/activate', { demandIds: ds.split('\n'), installmentDate: due })); };

const rep = async (p) => (await A('GET', '/reports' + p)).j;
const bal = async () => (await rep(`/customer-balance?projectId=${S.P}`)).data;
const near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) <= e;
const baseOf = (u) => Number(psql(`select base_price_inr from units where id='${u}'`));
const carpetOf = (u) => Number(psql(`select carpet_area_sqft from units where id='${u}'`));

// 1. cost of a booking with no rate / with a rate
const R0 = await sell('NoRate');
let row = (await bal()).find(r => r.consumer_id === R0.c);
t('no-rate booking: unit cost is the unit base price on Customer Balance', row && near(row.unit_cost, baseOf(R0.u)), JSON.stringify(row));
t('no-rate booking: received % is not 0 once money is cleared', (await receipt(R0.c, 100000), (await bal()).find(r => r.consumer_id === R0.c).received_pct > 0));
const apf = (await rep(`/applicant-payment-file?projectId=${S.P}`)).data.find(r => r.consumer_id === R0.c);
t('no-rate booking: Applicant Payment File shows the same base price', apf && near(apf.base_price_inr, baseOf(R0.u)), JSON.stringify(apf && apf.base_price_inr));
const cD = (await rep(`/customer-dues?projectId=${S.P}`)).data.find(r => r.consumer_id === R0.c);
t('no-rate booking: Customer Wise Dues shows the same unit cost', cD && near(cD.unit_cost, baseOf(R0.u)), JSON.stringify(cD && cD.unit_cost));
const rate = 7000, c1 = await person('Rated'), u1 = await unit(1000);
const b1 = await A('POST', '/booking', { consumer_id: c1, project_id: S.P, unit_id: u1, selected_plan_name: S.plan, booking_date: today, basic_price: rate });
t('booking with a rate is accepted', b1.s === 201, JSON.stringify(b1.j).slice(0, 150));
await A('PATCH', `/booking/${b1.j.data.id}`, { booking_amount: 25000, payment_mode: 'cash' });
row = (await bal()).find(r => r.consumer_id === c1);
const balc = Number(psql(`select coalesce(balcony_charge_amount,0) from booking_records where id='${b1.j.data.id}'`)), disc = Number(psql(`select coalesce(company_inaugural_disc,0)+coalesce(dealer_adjustment_amount,0) from booking_records where id='${b1.j.data.id}'`));
t('rated booking: unit cost = rate x carpet area (+ balcony charge - discounts)', row && near(row.unit_cost, rate * carpetOf(u1) + balc - disc, 1), JSON.stringify(row && row.unit_cost) + ' want ' + (rate * carpetOf(u1) + balc - disc));
const uc = (await rep(`/unit-cost?projectId=${S.P}`)); const ucRows = uc.data || uc.rows || [];
t('Unit Cost report lists the unit of the no-rate booking at the same cost', JSON.stringify(uc).includes(String(baseOf(R0.u))), JSON.stringify(uc).slice(0, 200));

// 2. moves of a unit
const Sg = await sell('Surr'); await receipt(Sg.c, 40000);
const al = psql(`select id from allocations where consumer_id='${Sg.c}' and status not in ('cancelled','transferred')`);
const su = await A('POST', '/surrender', { consumerId: Sg.c, allocationId: al, type: 'surrender', surrenderDate: today, forfeitureAmount: 5000, refundAmount: 35000 });
t('surrender is accepted', su.s === 201, JSON.stringify(su.j).slice(0, 150));
t('surrendered applicant is not a customer on Customer Balance', !(await bal()).some(r => r.consumer_id === Sg.c));
t('surrendered applicant is not a customer on Customer Wise Dues', !(await rep(`/customer-dues?projectId=${S.P}`)).data.some(r => r.consumer_id === Sg.c));
const clearedSql = () => Number(psql(`select coalesce(sum(r.amount_received_inr),0) from receipts r join consumers c on c.id=r.consumer_id where c.project_id='${S.P}' and r.status='cleared' and coalesce(r.is_advance,false)=false`));
t('the surrendered money stays in Collection: total = cleared receipts of the project (SQL)', near((await rep(`/project-collection?projectId=${S.P}`)).totals.total_amount, clearedSql()), `${(await rep(`/project-collection?projectId=${S.P}`)).totals.total_amount} vs ${clearedSql()}`);
const rs = await A('POST', '/surrender/restore', { surrenderId: su.j.data.surrenderId, type: 'surrender' });
t('restore is accepted', rs.s === 200, JSON.stringify(rs.j).slice(0, 150));
t('a restored applicant is a customer again, with the money', (await bal()).some(r => r.consumer_id === Sg.c && near(r.total_received, 40000)));
const Tr = await sell('Seller'); await receipt(Tr.c, 70000); const Bu = await person('Buyer');
const tr = await A('POST', '/transfers', { unitId: Tr.u, oldConsumerId: Tr.c, newConsumerId: Bu, transferDate: today });
t('transfer is accepted', tr.s === 201, JSON.stringify(tr.j).slice(0, 150));
const rowsU = (await bal()).filter(r => r.unit_number === psql(`select unit_number from units where id='${Tr.u}'`));
t('a transferred unit has ONE customer, the buyer, with the money paid so far', rowsU.length === 1 && rowsU[0].consumer_id === Bu && near(rowsU[0].total_received, 70000), JSON.stringify(rowsU));
const Sh = await sell('Shift'); await receipt(Sh.c, 50000); const nu = await unit();
const sh = await A('POST', '/allocations/shift', { consumerId: Sh.c, newUnitId: nu });
t('shift is accepted', sh.s === 200, JSON.stringify(sh.j).slice(0, 150));
const shRows = (await bal()).filter(r => r.consumer_id === Sh.c);
t('a shifted applicant is on the new unit only, once', shRows.length === 1 && shRows[0].unit_number === psql(`select unit_number from units where id='${nu}'`), JSON.stringify(shRows.map(r => r.unit_number)));

// 3. bounced and pending money
const Bo = await sell('Bounce'); await receipt(Bo.c, 60000, 'bounced'); await receipt(Bo.c, 20000, 'deposited');
const rowB = (await bal()).find(r => r.consumer_id === Bo.c);
t('bounced and deposited receipts are not received on Customer Balance', rowB && near(rowB.total_received, 0), JSON.stringify(rowB && rowB.total_received));
t('Collection total still equals the cleared receipts of the project (SQL) after the bounce', near((await rep(`/project-collection?projectId=${S.P}`)).totals.total_amount, clearedSql()));
const fd = (await rep(`/financial-dashboard?projectId=${S.P}`)).data.metrics;
t('Financial Dashboard collected = the same cleared total', near(fd.total_collected, clearedSql()), JSON.stringify(fd));
for (const [n, p] of [['customer-balance', `/customer-balance?projectId=${S.P}&pageSize=0`], ['customer-dues', `/customer-dues?projectId=${S.P}&page=abc`], ['unit-cost', `/unit-cost?projectId=abc`]]) t(`bad query on ${n} is a 400, not a 500`, (await A('GET', '/reports' + p)).s === 400);
const txt = JSON.stringify([await rep(`/customer-balance?projectId=${S.P}`), await rep(`/project-collection?projectId=${S.P}`), await rep(`/stage-wise-dues?projectId=${S.P}`)]);
t('no NaN / undefined / null amount in these reports', !/NaN|undefined|"total_[a-z_]*":null/.test(txt));

// clean up
const ids = psql(`select string_agg(quote_literal(id::text), ',') from consumers where project_id='${S.P}'`);
if (ids) for (const q of [`delete from ownership_transfers where unit_id in (select id from units where project_id='${S.P}')`, `delete from surrender_applications where project_id='${S.P}'`, `delete from cancellations where consumer_id in (${ids})`, `delete from draw_refunds where consumer_id in (${ids})`, `delete from tds_assignments where consumer_id in (${ids})`, `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`, `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`, `delete from booking_records where consumer_id in (${ids})`, `update consumers set allocated_unit_id=null where id in (${ids})`, `delete from consumers where id in (${ids})`, `delete from unit_status_history where unit_id in (select id from units where project_id='${S.P}')`, `delete from units where project_id='${S.P}'`, `delete from towers where project_id='${S.P}'`, `delete from plan_schedule_templates where project_id='${S.P}'`, `delete from gst_tax_charge_mapping where project_id='${S.P}'`, `delete from projects where id='${S.P}'`]) { try { psql(q); } catch (e) { if (process.env.DEBUG_CLEAN) console.log('CLEAN FAILED', q.slice(0, 80), String(e.stderr || e).slice(0, 140)); } }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
