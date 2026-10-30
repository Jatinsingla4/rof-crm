// Reports: every route and its guard, roles, project scope, hostile filters, and the NUMBERS (dues, balance, ageing, collection, percentages, bank views)
// proved against an independent SQL read of the base tables (demands, receipts, booking_records, payment_plans), on data this script makes itself.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-reports.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const go = () => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let r; try { r = await go(); } catch { r = await go(); } let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(await login('accounts_finance@test.local'));
const SA = call(await login('support_agent@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e9 }).trim().split('\n')[0];
const rows = (sql) => JSON.parse(execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `select coalesce(json_agg(t), '[]'::json) from (${sql}) t`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e9 }).trim() || '[]');
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100, near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) < e;
const sum = (xs, f) => r2(xs.reduce((s, x) => s + Number(f(x)), 0));
const J = (v) => JSON.stringify(v) ?? 'undefined';
let r, r2x;
const extraSql = []; const PROJECT_CLEAN = [];

// ---------- set-up: a company, bank accounts, three projects, plans, GST, buyers ----------
const co = (await A('POST', '/companies', { name: 'Reports Co ' + U })).j.data.id;
const bank1 = psql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active) values ('${co}', 'Rep Bank A ${U}', 'RA${U}', true) returning id`);
const bank2 = psql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active) values ('${co}', 'Rep Bank B ${U}', 'RB${U}', true) returning id`);
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Rep ${tag} ${U}`, reraNumber: `RP${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B'), P3 = await mkProj('C');
const tw = async (P, n) => (await A('POST', `/projects/${P}/towers`, { towerName: `${n}${U}` })).j.data.id;
const T1 = await tw(P1, 'T1'), T1b = await tw(P1, 'T2'), T2 = await tw(P2, 'T1'), T3 = await tw(P3, 'T1');
let un = 0; const unit = async (P, T, base, carpet = 1000, bhk = '2BHK') => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `R${++un}-${U}`, floor: ri(1, 9), bhkType: bhk, carpetAreaSqft: carpet, superAreaSqft: carpet + 200, basePriceInr: base, totalPriceInr: base + 500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN1 = await plan(P1, 'RepPlan ' + U, [20, 30, 50]), PLAN2 = await plan(P2, 'RepPlanB ' + U, [40, 60]), PLAN3 = await plan(P3, 'RepPlanC ' + U, [100]);
const planOf = { [P1]: PLAN1, [P2]: PLAN2, [P3]: PLAN3 };
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `RP ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2, P3]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const made = []; let ap = 0;
const person = async (P) => { const x = await A('POST', '/consumers', { name: `Rep Buyer ${++ap} ${U}`, mobile: mob(), project_id: P }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };
// a completed booking: applicant, unit (random price, so GST has paise), plan, three (or two, or one) demands and the booking receipt
const buyer = async (P = P1, T = T1, o = {}) => {
  const c = await person(P), base = o.base ?? ri(40, 120) * 100000 + ri(0, 99999), u = await unit(P, T, base, o.carpet ?? 1000, o.bhk ?? '2BHK');
  const x = await A('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: planOf[P], booking_date: today }); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await A('PATCH', `/booking/${x.j.data.id}`, { booking_amount: o.booking ?? ri(2, 20) * 1000, payment_mode: 'cash' }); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  // the booking carries its price: rate per sq ft, PLC, other charge and a dealer adjustment (the unit cost the percentages are worked on)
  psql(`update booking_records set basic_rate_inr_sqft = ${r2(base / (o.carpet ?? 1000))}, plc_amount = ${ri(0, 5) * 10000}, other_charge_amount = ${ri(0, 3) * 1000}, dealer_adjustment_amount = ${ri(0, 3) * 5000} where id='${x.j.data.id}' returning 1`);
  return { c, u, P, bk: x.j.data.id, reg: x.j.data.registration_no, plan: psql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`) };
};
let rn = 0;
const receipt = async (S, amount, idx, o = {}) => { const x = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: amount, paymentMode: o.mode || 'neft', referenceNumber: `RP${U}R${++rn}`, paymentDate: today, installmentIndex: idx, companyBankAccountId: o.bank, ...(o.mode === 'cheque' ? { chequeNo: `CQ${U}${rn}` } : {}) }); if (x.s !== 201) throw new Error('receipt ' + JSON.stringify(x)); return x.j.data.id; };
const clear = async (id) => { const x = await A('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }); if (x.s !== 200) throw new Error('clear ' + JSON.stringify(x)); return id; };
const bounce = async (id) => { const x = await A('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'test' }); if (x.s !== 200) throw new Error('bounce ' + JSON.stringify(x)); return id; };
const cancel = async (id) => { const x = await A('POST', `/payments/receipts/${id}/cancel`, { reason: 'test' }); if (x.s !== 200) throw new Error('cancel ' + JSON.stringify(x)); return id; };
const rais = (S, idx, days) => psql(`update demands set status='demanded', due_date = current_date - ${days}, raised_at = now() where payment_plan_id='${S.plan}' and installment_index=${idx} returning 1`);
const bookingReceipt = (S) => psql(`select id from receipts where consumer_id='${S.c}' and installment_index is null and demand_id is null order by created_at limit 1`);
const demandsOf = (S) => rows(`select id, installment_index idx, status, amount_due_inr + cgst_amount + sgst_amount total from demands where payment_plan_id='${S.plan}' order by installment_index`);

// ---- the customers ----
const S = {};
// C1: demand 1 (20 days late) and 2 (70 days late) raised; the booking money cleared (pool), a part payment on 2, plus a bounced, a cancelled, a pending and an on-hold receipt that must not count
S.c1 = await buyer(P1, T1, { base: 8000000 + ri(0, 99999), bhk: '3BHK' }); rais(S.c1, 1, 20); rais(S.c1, 2, 70);
await clear(bookingReceipt(S.c1)); await clear(await receipt(S.c1, ri(5, 9) * 100000 + ri(0, 999), 2, { bank: bank1 }));
await bounce(await receipt(S.c1, 777777, 1)); await cancel(await receipt(S.c1, 666666, 2)); await receipt(S.c1, 55555, 2); const oh = await receipt(S.c1, 44444, 3); await A('PATCH', `/payments/receipts/${oh}/hold`, { hold_remark: 'x' });
// C2: demand 1 paid in full, demand 2 raised and not yet late with a part payment, 3 not raised
S.c2 = await buyer(P1, T1b, { base: 5000000 + ri(0, 99999) }); rais(S.c2, 1, 40); rais(S.c2, 2, -15);
const d2 = demandsOf(S.c2); await clear(await receipt(S.c2, d2[0].total, 1, { mode: 'cheque', bank: bank2 })); await clear(await receipt(S.c2, Math.floor(d2[1].total / 3), 2, { bank: bank1 })); await clear(bookingReceipt(S.c2));
// C3: all three raised and late (200, 100, 5 days), nothing cleared except what the booking brought (left pending)
S.c3 = await buyer(P1, T1, { base: 6500000 + ri(0, 99999) }); rais(S.c3, 1, 200); rais(S.c3, 2, 100); rais(S.c3, 3, 5);
// C4: pays, then surrenders: out of the dues reports, the money stays in collection
S.c4 = await buyer(P1, T1, { base: 7000000 + ri(0, 99999) }); rais(S.c4, 1, 30); await clear(bookingReceipt(S.c4)); const c4pay = ri(2, 6) * 100000; await clear(await receipt(S.c4, c4pay, 1));
S.c4.al = psql(`select id from allocations where consumer_id='${S.c4.c}' and status not in ('cancelled','transferred') order by created_at desc limit 1`);
r = await A('POST', '/surrender', { consumerId: S.c4.c, allocationId: S.c4.al, bookingId: S.c4.bk, unitId: S.c4.u, projectId: P1, type: 'surrender', surrenderDate: today });
if (r.s !== 200 && r.s !== 201) throw new Error('surrender ' + JSON.stringify(r));
// C5: transferred: the seller's plan, demands and receipts go to the buyer
S.c5 = await buyer(P1, T1, { base: 9000000 + ri(0, 99999) }); rais(S.c5, 1, 10); await clear(bookingReceipt(S.c5)); await clear(await receipt(S.c5, 250000, 1));
const c5new = await person(P1); r = await A('POST', '/transfers', { unitId: S.c5.u, oldConsumerId: S.c5.c, newConsumerId: c5new }); if (r.s !== 201 && r.s !== 200) throw new Error('transfer ' + JSON.stringify(r));
S.c5.seller = S.c5.c; S.c5.c = c5new;
// C6: has an older payment plan too (its raised demand must not count: only the latest plan does) and one more booking of the same applicant on another unit (dirty data)
S.c6 = await buyer(P1, T1, { base: 6000000 + ri(0, 99999) }); rais(S.c6, 1, 45); await clear(bookingReceipt(S.c6));
{
  const alloc = psql(`select allocation_id from payment_plans where id='${S.c6.plan}'`);
  const old = psql(`insert into payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_at) select allocation_id, consumer_id, unit_id, project_id, total_amount_inr, now() - interval '10 days' from payment_plans where id='${S.c6.plan}' returning id`);
  psql(`insert into demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, status, demand_type, cgst_amount, sgst_amount) values ('${old}', 1, '${S.c6.c}', current_date - 90, 123456, 'demanded', 'installment', 0, 0) returning 1`);
  S.c6.old = old; void alloc;
}
// C7: P2, a plan of two instalments; overpaid on instalment 1 (the excess is credit), instalment 2 not raised
S.c7 = await buyer(P2, T2, { base: 5500000 + ri(0, 99999) }); rais(S.c7, 1, 15); const d7 = demandsOf(S.c7); await clear(await receipt(S.c7, d7[0].total + 12345, 1)); await clear(bookingReceipt(S.c7));
// C8: P2, raised and late, paid by two receipts on instalment 1 (one cleared, one pending)
S.c8 = await buyer(P2, T2, { base: 4800000 + ri(0, 99999) }); rais(S.c8, 1, 95); rais(S.c8, 2, 35); const d8 = demandsOf(S.c8); await clear(await receipt(S.c8, 100000 + ri(0, 999), 1)); await receipt(S.c8, 50000, 1);
// C9: P3 (a one-instalment plan), nothing raised, nothing cleared: only "undue"
S.c9 = await buyer(P3, T3, { base: 3000000 + ri(0, 99999) });
// C10: P3, for the interest numbers: one instalment, 40 days late, no receipt at all
S.c10 = await buyer(P3, T3, { base: 2000000 + ri(0, 99999) }); rais(S.c10, 1, 40);
// the booking money of C3, C8, C9, C10 stays pending (not cleared)
const allCust = [S.c1, S.c2, S.c3, S.c5, S.c6, S.c7, S.c8, S.c9, S.c10];
const liveCust = allCust;                 // the surrendered C4 is not a live customer
const ALLP = [P1, P2, P3];
const idsSql = (xs) => xs.map(x => `'${x}'`).join(',');
const IN_P = idsSql(ALLP);

// ---------- the independent read of the base tables ----------
// one row per demand of a live booking's latest plan (cancelled demands out), with the share of the cleared receipts that covers it (linked, instalment-only, then the advance pool in order)
const ledgerSql = (projects) => `
  with live as (select distinct on (b.consumer_id, b.unit_id) b.id booking_id, b.consumer_id, b.unit_id, b.selected_plan_name plan_name, b.main_broker_id, b.booking_date from booking_records b where b.status in ('complete','pending_payment','active') and b.unit_id is not null order by b.consumer_id, b.unit_id, b.created_at desc),
  pl as (select l.*, u.project_id, p.name project_name, u.tower_id, t.tower_name, u.unit_number, u.bhk_type, (select id from payment_plans pp where pp.consumer_id=l.consumer_id and pp.unit_id=l.unit_id order by pp.created_at desc limit 1) plan_id from live l join units u on u.id=l.unit_id join projects p on p.id=u.project_id left join towers t on t.id=u.tower_id where u.project_id in (${projects})),
  dm as (select pl.*, d.id demand_id, d.installment_index idx, d.status dstatus, d.due_date, d.demand_type,
                d.amount_due_inr + coalesce(d.addon_charge_amount,0) base, coalesce(d.cgst_amount,0)+coalesce(d.addon_cgst_amount,0) cgst, coalesce(d.sgst_amount,0)+coalesce(d.addon_sgst_amount,0) sgst,
                d.amount_due_inr+coalesce(d.cgst_amount,0)+coalesce(d.sgst_amount,0)+coalesce(d.addon_charge_amount,0)+coalesce(d.addon_cgst_amount,0)+coalesce(d.addon_sgst_amount,0) total
           from pl join demands d on d.payment_plan_id = pl.plan_id where d.status <> 'cancelled'),
  rc as (select payment_plan_id plan_id, demand_id, installment_index idx, amount_received_inr amt from receipts where status='cleared'),
  pool as (select plan_id, sum(amt) pool from rc where demand_id is null and idx is null group by plan_id),
  direct as (select dm.*, coalesce((select sum(amt) from rc where rc.demand_id = dm.demand_id),0) + coalesce((select sum(amt) from rc where rc.demand_id is null and rc.idx = dm.idx and rc.plan_id = dm.plan_id),0) direct from dm),
  gap as (select direct.*, greatest(0, total - direct) gap from direct),
  al as (select g.*, least(g.gap, greatest(0, coalesce(po.pool,0) - coalesce(sum(g.gap) over (partition by g.plan_id order by g.idx rows between unbounded preceding and 1 preceding),0))) frompool from gap g left join pool po on po.plan_id = g.plan_id)
  select al.*, least(total, direct + frompool) paid, (dstatus in ('demanded','raised','paid')) raised, (current_date - due_date) days_late from al`;
const L = rows(ledgerSql(IN_P));
const byProject = (P, xs = L) => xs.filter(x => x.project_id === P);
const raisedOf = (xs, upTo) => xs.filter(x => x.raised && (!upTo || (x.due_date && x.due_date <= upTo)));
const overdue = (xs) => xs.filter(x => x.raised && x.due_date && x.days_late >= 1 && x.total - x.paid > 0.004);
// per customer (live booking): cash received (cleared, not the advance copies), not yet cleared, unit cost
const cust = rows(`select b.consumer_id, b.unit_id, u.project_id,
    (select id from payment_plans pp where pp.consumer_id=b.consumer_id and pp.unit_id=b.unit_id order by pp.created_at desc limit 1) plan_id
  from (select distinct on (consumer_id, unit_id) * from booking_records where status in ('complete','pending_payment','active') and unit_id is not null order by consumer_id, unit_id, created_at desc) b join units u on u.id=b.unit_id where u.project_id in (${IN_P})`);
const cash = Object.fromEntries(rows(`select payment_plan_id plan_id, coalesce(sum(amount_received_inr) filter (where status='cleared' and is_advance is not true),0) clear, coalesce(sum(amount_received_inr) filter (where status in ('pending','authorized','deposited','on_hold') and is_advance is not true),0) pend,
    coalesce(sum(cgst_amount) filter (where status='cleared' and is_advance is not true),0) cgst, coalesce(sum(sgst_amount) filter (where status='cleared' and is_advance is not true),0) sgst, coalesce(sum(interest_amount) filter (where status='cleared' and is_advance is not true),0) interest,
    count(*) filter (where status='cleared' and is_advance is not true) n from receipts where payment_plan_id in (select (select id from payment_plans pp where pp.consumer_id=b.consumer_id and pp.unit_id=b.unit_id order by pp.created_at desc limit 1) from booking_records b where b.status in ('complete','pending_payment','active')) group by 1`).map(x => [x.plan_id, x]));
const cost = Object.fromEntries(rows(`select b.consumer_id, (case when b.balcony_charge_amount is not null then coalesce(b.basic_rate_inr_sqft,0)*coalesce(u.carpet_area_sqft,0)+coalesce(b.balcony_charge_amount,0) else coalesce(b.basic_rate_inr_sqft,0)*(coalesce(u.carpet_area_sqft,0)+coalesce(u.balcony_area_sqft,0)) end - coalesce(b.dealer_adjustment_amount,0) - coalesce(b.company_inaugural_disc,0) + coalesce(b.plc_amount,0) + coalesce(b.other_charge_amount,0)) cost, b.unit_id from booking_records b join units u on u.id=b.unit_id where b.status in ('complete','pending_payment','active') and u.project_id in (${IN_P})`).map(x => [x.consumer_id + ':' + x.unit_id, Number(x.cost)]));
const custMoney = (c, upTo) => {
  const ds = L.filter(x => x.consumer_id === c.consumer_id && x.unit_id === c.unit_id), c0 = cash[c.plan_id] || { clear: 0, pend: 0, cgst: 0, sgst: 0, interest: 0, n: 0 };
  const due = raisedOf(ds, upTo), demanded = sum(due, x => x.total), paid = sum(due, x => x.paid), rcv = Number(c0.clear);
  return { ds, due, demanded, paid, os: r2(demanded - paid), recv: rcv, pend: Number(c0.pend), credit: r2(Math.max(0, rcv - sum(ds.filter(x => x.raised), x => x.paid))), cost: cost[c.consumer_id + ':' + c.unit_id] || 0,
    pct: (cost[c.consumer_id + ':' + c.unit_id] || 0) > 0 ? Math.round((rcv - Number(c0.cgst) - Number(c0.sgst) - Number(c0.interest)) * 10000 / cost[c.consumer_id + ':' + c.unit_id]) / 100 : 0, n: c0.n };
};
const custOf = (S1) => cust.find(c => c.consumer_id === S1.c);
const cm = (S1, upTo) => custMoney(custOf(S1), upTo);

t('set-up: ten customers, nine of them live (the surrendered one is not)', cust.length === 9 + 0 && !cust.some(c => c.consumer_id === S.c4.c) && L.length > 0, `${cust.length} customers`);
t('set-up: the older plan of C6 is not in the ledger', !L.some(x => x.plan_id === S.c6.old), '');
t('set-up: C5 sits with the buyer', cust.some(c => c.consumer_id === S.c5.c) && !cust.some(c => c.consumer_id === S.c5.seller), '');
const hasReceiptPools = L.some(x => x.frompool > 0);
t('set-up: the advance pool really fed an instalment somewhere (so the pool rule is under test)', hasReceiptPools, '');

// ===================================================================================================================
// 1. every route, its guard and the six callers
// ===================================================================================================================
const GET_ROUTES = ['/sales-dashboard', '/financial-dashboard', '/project-dashboard', '/campaign-roi', '/lead-source-analysis', '/payment-ageing', '/monthly-collection', '/custom-reports', '/allotment-dashboard', '/inventory-full', '/unit-wise-plc', '/unit-sold-area', '/unit-cost',
  '/inventory-details', '/tower-floor-sales', '/applicant-payment-file', '/collection-pivot', '/project-details', '/project-collection', '/receipt-wise-collection', '/due-report', '/customer-balance', '/customer-dues', '/stage-wise-dues', '/percentage-wise-dues',
  '/project-wise-dues', '/ageing-project', '/ageing-installment', '/ageing-tower', '/ageing-plan', '/ageing-summary-project', '/ageing-summary-tower', '/ageing-summary-plan', '/ageing-summary-customer', '/month-wise-dues', '/month-wise-dues-customer?fromMonth=1&fromYear=2026&toMonth=12&toYear=2026',
  '/customer-dues-detail', '/customer-due-summary', '/other-charges', '/opening-details', '/booking-authentication', '/tds-status', '/customer-forecasting', '/conveyance-deed-date', '/all-applicants', '/customer-payment-mismatch', '/year-month-collection', '/booking-record',
  '/cash-bank-summary', `/ledger-monthly-summary/${bank1}`, '/addon-charges-report', '/addon-charge-names', '/bank-ledger', '/bank-ledger-company-banks', '/stock-report', '/summary-report'];
t('routes: 56 report routes are covered', GET_ROUTES.length === 56, GET_ROUTES.length);
const sp = (p) => p + (p.includes('?') ? '&' : '?') + `projectId=${P1}`;
for (const p of GET_ROUTES) {
  const nl = (await fetch(B + '/reports' + p)).status; t(`guard: ${p.split('?')[0].replace(bank1, ':bank')} without login -> 401`, nl === 401, nl);
  r = await SA('GET', '/reports' + p); t(`guard: ${p.split('?')[0].replace(bank1, ':bank')} support_agent (no reports right) -> 403`, r.s === 403, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM], ['accounts_finance', AF], ['super_admin', A]]) { r = await who('GET', '/reports' + sp(p)); t(`roles: ${n} reads ${p.split('?')[0].replace(bank1, ':bank')} -> 200`, r.s === 200 && r.j?.success !== false, r.s + ' ' + JSON.stringify(r.j).slice(0, 120)); }
}
r = await A('POST', '/reports/custom-report', { reportType: 'dues', name: 'x' }); t('guard: custom-report create by super_admin works', r.s === 201, r.s + JSON.stringify(r.j));
for (const [n, who, code] of [['read_only_viewer', RO, 403], ['sales_executive', SE, 403], ['project_manager', PM, 403], ['accounts_finance', AF, 201]]) { r = await who('POST', '/reports/custom-report', { reportType: 'dues', name: 'x' }); t(`guard: custom-report create by ${n} -> ${code}`, r.s === code, r.s); }
r = await fetch(B + '/reports/custom-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); t('guard: custom-report create without login -> 401', r.status === 401, r.status);

// ===================================================================================================================
// 2. the numbers: customer wise reports
// ===================================================================================================================
const get = async (path, who = A) => { const x = await who('GET', '/reports' + path); if (x.s !== 200) throw new Error(path + ' -> ' + x.s + ' ' + J(x.j).slice(0, 200)); return x.j; };
const custIn = (P) => cust.filter(c => c.project_id === P);
const byId = (xs, k = 'consumer_id') => Object.fromEntries(xs.map(x => [x[k], x]));
for (const P of ALLP) {
  const mine = custIn(P), M = Object.fromEntries(mine.map(c => [c.consumer_id, custMoney(c)]));
  const pn = `P${ALLP.indexOf(P) + 1}`;
  // ---- customer balance ----
  let j = await get(`/customer-balance?projectId=${P}`); let rowsB = byId(j.data);
  t(`${pn} customer-balance: one row per live customer (${mine.length}), the surrendered one is not there`, j.data.length === mine.length && !rowsB[S.c4.c], `${j.data.length}/${mine.length}`);
  t(`${pn} customer-balance: demanded, received, balance, received %, unit cost and receipt count of every customer match the base tables`, mine.every(c => { const x = rowsB[c.consumer_id], m = M[c.consumer_id]; return x && near(x.total_demanded, m.demanded) && near(x.total_received, m.recv) && near(x.balance, m.demanded - m.recv) && near(x.received_pct, m.pct, 0.011) && near(x.unit_cost, m.cost) && x.receipt_count === m.n; }),
    J(mine.filter(c => { const x = rowsB[c.consumer_id], m = M[c.consumer_id]; return !(x && near(x.total_demanded, m.demanded) && near(x.total_received, m.recv) && near(x.balance, m.demanded - m.recv) && near(x.received_pct, m.pct) && near(x.unit_cost, m.cost) && x.receipt_count === m.n); }).map(c => [rowsB[c.consumer_id], M[c.consumer_id]])).slice(0, 400));
  t(`${pn} customer-balance: summary = sum of the rows = sum of the base tables`, j.summary.totalConsumers === mine.length && near(j.summary.totalReceived, sum(mine, c => M[c.consumer_id].recv)) && near(j.summary.totalBalance, sum(mine, c => M[c.consumer_id].demanded - M[c.consumer_id].recv)) && near(j.summary.totalUnitCost, sum(mine, c => M[c.consumer_id].cost)), J(j.summary));
  for (const [bt, f] of [['outstanding', (m) => m.demanded - m.recv > 0], ['overpaid', (m) => m.demanded - m.recv < 0]]) { const k = await get(`/customer-balance?projectId=${P}&balanceType=${bt}`); t(`${pn} customer-balance: balanceType=${bt} keeps exactly the customers that are ${bt}`, k.data.length === mine.filter(c => f(M[c.consumer_id])).length && k.data.every(x => f(M[x.consumer_id])), `${k.data.length}`); }
  if (mine.length > 1) { const pg = await get(`/customer-balance?projectId=${P}&pageSize=1&page=2`); t(`${pn} customer-balance: page 2 of size 1 has one row, total and summary still cover everyone`, pg.data.length === 1 && pg.total === mine.length && pg.summary.totalConsumers === mine.length, J(pg).slice(0, 150)); }
  // ---- customer dues ----
  j = await get(`/customer-dues?projectId=${P}`); let rowsD = byId(j.data);
  t(`${pn} customer-dues: dues, received (clear / pending), outstanding, credit and undue of every customer match`, mine.every(c => { const x = rowsD[c.consumer_id], m = M[c.consumer_id]; return x && near(x.dues_total, m.demanded) && near(x.received_clear, m.recv) && near(x.received_pending, m.pend) && near(x.outstanding_total, m.os) && near(x.credit_amount, m.credit) && near(x.undue_amount, sum(m.ds.filter(d => !d.raised), d => d.total)); }),
    J(mine.filter(c => { const x = rowsD[c.consumer_id], m = M[c.consumer_id]; return !(x && near(x.dues_total, m.demanded) && near(x.received_clear, m.recv) && near(x.received_pending, m.pend) && near(x.outstanding_total, m.os) && near(x.credit_amount, m.credit)); }).map(c => [rowsD[c.consumer_id], M[c.consumer_id].demanded, M[c.consumer_id].os])).slice(0, 500));
  t(`${pn} customer-dues: demanded - paid = outstanding, and amount + CGST + SGST = total, on every row`, j.data.every(x => near(x.dues_amount + x.dues_cgst + x.dues_sgst, x.dues_total) && near(x.outstanding_amount + x.outstanding_cgst + x.outstanding_sgst, x.outstanding_total) && x.outstanding_total >= 0), J(j.data.find(x => !near(x.dues_amount + x.dues_cgst + x.dues_sgst, x.dues_total))).slice(0, 200));
  for (const k of ['pending', 'clear', 'total']) t(`${pn} customer-dues: summary ${k}: amount + CGST + SGST + interest = total (no component counted twice)`, near(j.summary[k].amount + j.summary[k].cgst + j.summary[k].sgst + j.summary[k].interest, j.summary[k].total), J(j.summary[k]));
  t(`${pn} customer-dues: summary clear total = sum of cleared receipts, pending total = sum of pending ones`, near(j.summary.clear.total, sum(mine, c => M[c.consumer_id].recv)) && near(j.summary.pending.total, sum(mine, c => M[c.consumer_id].pend)) && near(j.summary.total.total, j.summary.clear.total + j.summary.pending.total), J(j.summary));
  const dd = later(-60); j = await get(`/customer-dues?projectId=${P}&dueDate=${dd}`); rowsD = byId(j.data);
  t(`${pn} customer-dues: dueDate filter counts only demands due up to that day (dues AND outstanding)`, mine.every(c => { const x = rowsD[c.consumer_id], m = custMoney(c, dd); return x && near(x.dues_total, m.demanded) && near(x.outstanding_total, m.os); }), '');
  j = await get(`/customer-dues?projectId=${P}&duesCriteria=pending`); rowsD = byId(j.data);
  t(`${pn} customer-dues: criteria "pending" counts only demands not raised yet`, mine.every(c => { const x = rowsD[c.consumer_id], m = M[c.consumer_id]; return x && near(x.dues_total, sum(m.ds.filter(d => !d.raised), d => d.total)); }), '');
  j = await get(`/customer-dues?projectId=${P}&inPercent=1`); t(`${pn} customer-dues: inPercent=1 keeps only customers that paid 1% or less`, j.data.every(x => x.received_pct <= 1) && j.data.length === mine.filter(c => M[c.consumer_id].pct <= 1).length, `${j.data.length}`);
  // ---- due report and details ----
  const nonCancelled = L.filter(x => x.project_id === P);
  j = await get(`/due-report?projectId=${P}`); const rowsR = byId(j.data, 'demand_id');
  t(`${pn} due-report: one row per demand of a live booking (${nonCancelled.length}), cancelled demands and old plans are not there`, j.total === nonCancelled.length && j.data.length === nonCancelled.length && !j.data.some(x => x.consumer_id === S.c4.c), `${j.total}/${nonCancelled.length}`);
  t(`${pn} due-report: total due, paid and balance of every demand match; balance = total - paid, never below 0`, nonCancelled.every(d => { const x = rowsR[d.demand_id]; return x && near(x.total_due, d.total) && near(x.paid_amount, d.paid) && near(x.balance_amount, Math.max(0, d.total - d.paid)); }), '');
  t(`${pn} due-report: summary totals = sum of base tables`, near(j.summary.totalDueWithGst, sum(nonCancelled, d => d.total)) && near(j.summary.totalPaid, sum(nonCancelled, d => d.paid)) && j.summary.totalDemands === nonCancelled.length, J(j.summary));
  const rsd = await get(`/due-report?projectId=${P}&status=demanded`); t(`${pn} due-report: status=demanded keeps the raised, not fully paid ones`, rsd.total === nonCancelled.filter(d => d.dstatus === 'demanded').length, `${rsd.total}`);
  const rsp = await get(`/due-report?projectId=${P}&status=pending`); t(`${pn} due-report: status=pending keeps the not raised ones`, rsp.total === nonCancelled.filter(d => d.dstatus === 'pending').length, `${rsp.total}`);
  const ri1 = await get(`/due-report?projectId=${P}&installmentIndex=1`); t(`${pn} due-report: installmentIndex=1`, ri1.total === nonCancelled.filter(d => d.idx === 1).length, `${ri1.total}`);
  const pg2 = await get(`/due-report?projectId=${P}&pageSize=2&page=2`); t(`${pn} due-report: page 2 of size 2: two rows at most, total and summary still for all`, pg2.data.length === Math.min(2, Math.max(0, nonCancelled.length - 2)) && pg2.total === nonCancelled.length && near(pg2.summary.totalDueWithGst, sum(nonCancelled, d => d.total)), `${pg2.data.length}`);
  const fr = await get(`/due-report?projectId=${P}&fromDate=${later(-120)}&toDate=${later(-30)}`); t(`${pn} due-report: due date range from-to`, fr.total === nonCancelled.filter(d => d.due_date && d.due_date >= later(-120) && d.due_date <= later(-30)).length, `${fr.total}`);
  j = await get(`/customer-dues-detail?projectId=${P}`); t(`${pn} customer-dues-detail: the same demands with paid and balance`, j.total === nonCancelled.length && j.data.every(x => { const d = nonCancelled.find(y => y.demand_id === x.demand_id); return d && near(x.paid, d.paid) && near(x.balance, Math.max(0, d.total - d.paid)) && near(x.total_due, d.total); }), `${j.total}`);
  // ---- stage wise ----
  j = await get(`/stage-wise-dues?projectId=${P}`);
  const raised = raisedOf(nonCancelled), idxs = [...new Set(raised.map(x => x.idx))].sort((a, b) => a - b);
  t(`${pn} stage-wise-dues: one row per raised instalment number (${idxs.join(',')})`, j.data.map(x => x.installment_index).join() === idxs.join(), j.data.map(x => x.installment_index).join());
  t(`${pn} stage-wise-dues: due, received, outstanding and paid / unpaid counts of every stage match (paid is compared with the total incl. GST)`, idxs.every(i => { const x = j.data.find(y => y.installment_index === i), ds = raised.filter(d => d.idx === i); return near(x.total_due, sum(ds, d => d.total)) && near(x.total_received, sum(ds, d => d.paid)) && near(x.total_outstanding, sum(ds, d => d.total - d.paid)) && x.paid_count === ds.filter(d => d.total - d.paid <= 0.004).length && x.unpaid_count === ds.filter(d => d.total - d.paid > 0.004).length && near(x.total_demanded + x.total_cgst + x.total_sgst, x.total_due) && x.consumer_count === new Set(ds.map(d => d.consumer_id)).size; }), J(j.data).slice(0, 300));
  t(`${pn} stage-wise-dues: the screen total of consumers is the number of different customers, not the biggest stage`, j.totals.consumer_count === new Set(raised.map(d => d.consumer_id)).size, J(j.totals));
  const sdd = later(-60); j = await get(`/stage-wise-dues?projectId=${P}&dueDate=${sdd}`); const rr = raisedOf(nonCancelled, sdd);
  t(`${pn} stage-wise-dues: with a due date, due AND received AND outstanding are all limited to that date (outstanding is never negative)`, near(j.totals.total_due, sum(rr, d => d.total)) && near(j.totals.total_received, sum(rr, d => d.paid)) && near(j.totals.total_outstanding, sum(rr, d => d.total - d.paid)) && j.totals.total_outstanding >= 0, J(j.totals));
  // ---- percentage wise ----
  j = await get(`/percentage-wise-dues?projectId=${P}`);
  const bucketOf = (p) => p === 0 ? '0%' : p >= 100 ? '100%+' : p < 90 ? `${Math.floor((p - 0.0000001) / 10) * 10}-${Math.floor((p - 0.0000001) / 10) * 10 + 10}%` : '90-100%';
  const expB = {}; for (const c of mine) (expB[bucketOf(M[c.consumer_id].pct)] ||= []).push(c);
  t(`${pn} percentage-wise-dues: every customer sits in the bucket of its received % (${Object.keys(expB).sort().join(' ')})`, Object.entries(expB).every(([b, cs]) => (j.consumers_by_bucket[b] || []).length === cs.length && cs.every(c => (j.consumers_by_bucket[b] || []).some(x => x.consumer_id === c.consumer_id))) && Object.keys(j.consumers_by_bucket).length === Object.keys(expB).length, J(Object.keys(j.consumers_by_bucket)) + J(Object.entries(expB).map(([b, cs]) => [b, cs.length])));
  t(`${pn} percentage-wise-dues: totals (customers, cost, received, outstanding) match`, j.totals.total_consumers === mine.length && near(j.totals.total_cost, sum(mine, c => M[c.consumer_id].cost)) && near(j.totals.total_received, sum(mine, c => M[c.consumer_id].recv)) && near(j.totals.total_outstanding, sum(mine, c => M[c.consumer_id].os)), J(j.totals));
  t(`${pn} percentage-wise-dues: no NaN / null percentage anywhere`, !J(j).match(/NaN|undefined|"received_pct":null/), '');
  // ---- project / tower / unit type / plan / broker wise ----
  const myDemanded = sum(raised, d => d.total), myBase = sum(raised, d => d.base), myPaid = sum(raised, d => d.paid), myRecv = sum(mine, c => M[c.consumer_id].recv), myPend = sum(mine, c => M[c.consumer_id].pend), myCredit = sum(mine, c => M[c.consumer_id].credit), myCost = sum(mine, c => M[c.consumer_id].cost);
  for (const gb of ['project', 'tower', 'bhk_type', 'plan', 'broker']) {
    j = await get(`/project-wise-dues?projectId=${P}&groupBy=${gb}`); const T = j.totals;
    t(`${pn} project-wise-dues (${gb}): totals = base tables: demanded (with and without tax), received clear / pending, outstanding, credit, cost`, near(T.total_demanded_with_tax, myDemanded) && near(T.total_demanded, myBase) && near(T.received_clear, myRecv) && near(T.received_pending, myPend) && near(T.total_received, myRecv + myPend) && near(T.outstanding_with_tax, myDemanded - myPaid) && near(T.credit_amount, myCredit) && near(T.total_cost, myCost) && T.consumer_count === mine.length, J(T).slice(0, 400));
    t(`${pn} project-wise-dues (${gb}): the groups add up to the screen total (no customer in two groups)`, near(sum(j.data, x => x.total_demanded_with_tax), T.total_demanded_with_tax) && near(sum(j.data, x => x.received_clear), T.received_clear) && sum(j.data, x => x.consumer_count) === T.consumer_count, '');
    t(`${pn} project-wise-dues (${gb}): demanded - received on demands = outstanding; percentages are numbers`, j.data.every(x => [x.due_pct, x.received_pct, x.outstanding_pct, x.due_pct_with_tax, x.outstanding_pct_with_tax].every(v => Number.isFinite(v))) && Object.values(T).every(v => v === null || Number.isFinite(Number(v))), '');
    for (const k of ['pending', 'clear', 'total']) if (gb === 'project') t(`${pn} project-wise-dues: summary ${k}: amount + CGST + SGST + interest = total`, near(j.summary[k].amount + j.summary[k].cgst + j.summary[k].sgst + j.summary[k].interest, j.summary[k].total), J(j.summary[k]));
  }
  j = await get(`/project-wise-dues?projectId=${P}&groupBy=project`);
  t(`${pn} project-wise-dues: received % = (cleared - GST - interest) / unit cost; due % and outstanding % from the same totals`, near(j.totals.received_pct, myCost > 0 ? Math.round((sum(mine, c => M[c.consumer_id].recv - Number((cash[c.plan_id] || {}).cgst || 0) - Number((cash[c.plan_id] || {}).sgst || 0) - Number((cash[c.plan_id] || {}).interest || 0))) * 10000 / myCost) / 100 : 0, 0.02) && near(j.totals.due_pct, Math.round(myBase * 10000 / myCost) / 100, 0.02), J(j.totals).slice(0, 300));
  // ---- customer due summary ----
  j = await get(`/customer-due-summary?projectId=${P}`);
  t(`${pn} customer-due-summary: due amount (with tax), received clear / pending / total, total unit cost match`, mine.every(c => { const x = j.data.find(y => y.consumer_id === c.consumer_id), m = M[c.consumer_id]; return x && near(x.due_amount_with_tax, m.demanded) && near(x.received_clear, m.recv) && near(x.received_pending, m.pend) && near(x.received_total, m.recv + m.pend) && near(x.total_unit_cost, m.cost); }), '');
  j = await get(`/customer-due-summary?projectId=${P}&pctOperator=gt&pctValue=0`); t(`${pn} customer-due-summary: "paid % greater than 0" keeps those who paid something`, j.data.length === mine.filter(c => M[c.consumer_id].pct > 0).length, `${j.data.length}`);
}

// ===================================================================================================================
// 3. ageing, month wise, forecast, pivot, dashboards, applicant payment file
// ===================================================================================================================
const A_B = (d) => d <= 30 ? 'bucket_0_30' : d <= 60 ? 'bucket_31_60' : d <= 90 ? 'bucket_61_90' : d <= 180 ? 'bucket_91_180' : 'bucket_180_plus';
const B_B = (d) => d <= 30 ? 'bucket_0_30' : d <= 60 ? 'bucket_31_60' : d <= 120 ? 'bucket_61_120' : d <= 180 ? 'bucket_121_180' : 'bucket_180_plus';
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const odOf = (xs, asOn) => xs.filter(d => d.raised && d.due_date && d.total - d.paid > 0.004 && (asOn || today) > d.due_date).map(d => ({ ...d, days: dayDiff(d.due_date, asOn || today), bal: r2(d.total - d.paid) }));
const grp = (xs, key) => { const m = new Map(); for (const x of xs) { if (!m.has(key(x))) m.set(key(x), []); m.get(key(x)).push(x); } return m; };
const monthName = (iso) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
const interestRate = Number(psql(`select coalesce((select value from global_settings where key='penal_interest_rate_percent' limit 1), '15')`)) || 15;
for (const P of ALLP) {
  const pn = `P${ALLP.indexOf(P) + 1}`, LP = byProject(P), mine = custIn(P);
  for (const asOn of [null, later(-50)]) {
    const od = odOf(LP, asOn), q = `projectId=${P}` + (asOn ? `&asOnDate=${asOn}` : ''), tag = asOn ? 'as on a past date' : 'as on today';
    const checkBuckets = (row, xs, scheme, names) => names.every(b => near(row[b], sum(xs.filter(d => scheme(d.days) === b), d => d.bal))) && near(row.total_overdue ?? sum(xs, d => d.bal), sum(xs, d => d.bal));
    let j = await get(`/ageing-project?${q}`);
    t(`${pn} ageing-project ${tag}: every age band (amount and number of customers) matches; a fully paid demand is not overdue`, od.length === 0 ? j.data.length === 0 : (j.data.length === 1 && checkBuckets(j.data[0], od, A_B, ['bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_91_180', 'bucket_180_plus']) && ['0_30', '31_60', '61_90', '91_180', '180_plus'].every(k => j.data[0]['count_' + k] === new Set(od.filter(d => A_B(d.days) === 'bucket_' + k).map(d => d.consumer_id)).size)), J(j.data).slice(0, 300));
    t(`${pn} ageing-project ${tag}: totals = sum of the base tables`, near(j.totals.total_overdue, sum(od, d => d.bal)) && near(j.totals.bucket_0_30 + j.totals.bucket_31_60 + j.totals.bucket_61_90 + j.totals.bucket_91_180 + j.totals.bucket_180_plus, j.totals.total_overdue), J(j.totals));
    j = await get(`/ageing-installment?${q}`);
    t(`${pn} ageing-installment ${tag}: per instalment number`, [...grp(od, d => d.idx)].every(([i, xs]) => { const row = j.data.find(x => x.installment_index === i); return row && checkBuckets(row, xs, A_B, ['bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_91_180', 'bucket_180_plus']); }) && j.data.length === new Set(od.map(d => d.idx)).size, J(j.data).slice(0, 300));
    j = await get(`/ageing-tower?${q}`);
    t(`${pn} ageing-tower ${tag}: per tower`, [...grp(od, d => d.tower_name)].every(([n, xs]) => { const row = j.data.find(x => x.tower_name === n); return row && checkBuckets(row, xs, A_B, ['bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_91_180', 'bucket_180_plus']); }) && j.data.length === new Set(od.map(d => d.tower_name)).size, J(j.data).slice(0, 300));
    j = await get(`/ageing-plan?${q}`);
    t(`${pn} ageing-plan ${tag}: per plan`, [...grp(od, d => d.plan_name)].every(([n, xs]) => { const row = j.data.find(x => x.plan_name === n); return row && checkBuckets(row, xs, A_B, ['bucket_0_30', 'bucket_31_60', 'bucket_61_90', 'bucket_91_180', 'bucket_180_plus']); }), J(j.data).slice(0, 300));
    // ageing summary: A due, B received on it, C credit, D = A - B, E = D / A, and the legacy age bands
    const dueRows = raisedOf(LP, asOn);
    for (const [ep, keyf] of [['project', (d) => d.project_id], ['tower', (d) => d.tower_name], ['plan', (d) => d.plan_name], ['customer', (d) => d.consumer_id]]) {
      j = await get(`/ageing-summary-${ep}?${q}`);
      const groups = grp(dueRows, keyf), allGroups = grp(LP.filter(d => true), keyf);
      const okRows = [...allGroups].every(([k, xs]) => {
        const label = ep === 'project' ? xs[0].project_name : ep === 'tower' ? xs[0].tower_name : ep === 'plan' ? `${xs[0].plan_name || '(No Plan)'} (${xs[0].project_name})` : xs[0].consumer_name;
        const row = j.data.find(x => ep === 'project' ? x.group_id === k : ep === 'customer' ? x.group_id === k : x.group_label === label);
        if (!row) return false;
        const ds = groups.get(k) || [], o = odOf(xs, asOn);
        const credit = sum([...new Set(xs.map(d => d.consumer_id + ':' + d.unit_id))], key => { const c = cust.find(c0 => c0.consumer_id + ':' + c0.unit_id === key); return custMoney(c).credit; });
        return near(row.due_amount, sum(ds, d => d.total)) && near(row.received_amount, sum(ds, d => d.paid)) && near(row.outstanding_amount, sum(ds, d => d.total - d.paid)) && near(row.credit_amount, credit)
          && ['bucket_0_30', 'bucket_31_60', 'bucket_61_120', 'bucket_121_180', 'bucket_180_plus'].every(b => near(row[b], sum(o.filter(d => B_B(d.days) === b), d => d.bal)));
      });
      t(`${pn} ageing-summary-${ep} ${tag}: due (A), received (B), credit (C), outstanding (D = A - B) and the five age bands of every group match`, okRows, J(j.data).slice(0, 300));
      t(`${pn} ageing-summary-${ep} ${tag}: totals add up; outstanding % = D / A; D = A - B in the total`, near(j.totals.due_amount, sum(dueRows, d => d.total)) && near(j.totals.outstanding_amount, j.totals.due_amount - j.totals.received_amount) && near(j.totals.outstanding_pct, j.totals.due_amount > 0 ? Math.round(j.totals.outstanding_amount * 10000 / j.totals.due_amount) / 100 : 0, 0.02), J(j.totals));
    }
    j = await get(`/payment-ageing?projectId=${P}`);
    if (!asOn) {
      const pb = (d) => d <= 30 ? '1-30 days' : d <= 90 ? '31-90 days' : d <= 180 ? '91-180 days' : '180+ days';
      t(`${pn} payment-ageing: the four bands carry the unpaid overdue amount and demand count`, ['1-30 days', '31-90 days', '91-180 days', '180+ days'].every(b => { const xs = od.filter(d => pb(d.days) === b), row = j.data.find(x => x.ageing_bucket === b); return xs.length ? row && row.count_demands === xs.length && near(row.total_due_inr, sum(xs, d => d.bal)) : !row; }), J(j.data));
    }
  }
  // ---- month wise ----
  let j = await get(`/month-wise-dues?projectId=${P}`); const withDate = raisedOf(LP).filter(d => d.due_date), months = grp(withDate, d => d.due_date.slice(0, 7));
  t(`${pn} month-wise-dues: every month of a raised demand (open or paid): due, GST, received and outstanding match`, j.data.length === months.size && [...months].every(([m, xs]) => { const row = j.data.find(x => x.month_label === monthName(m + '-01')); return row && near(row.total_due_with_gst, sum(xs, d => d.total)) && near(row.total_received, sum(xs, d => d.paid)) && near(row.total_outstanding, sum(xs, d => d.total - d.paid)) && near(row.total_gst, sum(xs, d => d.cgst + d.sgst)) && row.demand_count === xs.length && row.consumer_count === new Set(xs.map(d => d.consumer_id)).size; }), J(j.data).slice(0, 300));
  t(`${pn} month-wise-dues: totals`, j.totals.demand_count === withDate.length && near(j.totals.total_outstanding, sum(withDate, d => d.total - d.paid)) && j.totals.consumer_count === new Set(withDate.map(d => d.consumer_id)).size, J(j.totals));
  const yr = String(new Date().getFullYear()); j = await get(`/month-wise-dues?projectId=${P}&year=${yr}`); t(`${pn} month-wise-dues: year filter`, j.totals.demand_count === withDate.filter(d => d.due_date.slice(0, 4) === yr).length, J(j.totals));
  const y0 = new Date().getFullYear() - 1; j = await get(`/month-wise-dues-customer?projectId=${P}&fromMonth=1&fromYear=${y0}&toMonth=12&toYear=${y0 + 2}`);
  t(`${pn} month-wise-dues-customer: dues, paid and outstanding of every customer and month; the row total is the sum of its months`, j.months.length === 36 && mine.every(c => { const row = j.data.find(x => x.consumer_id === c.consumer_id); const ds = raisedOf(LP.filter(d => d.consumer_id === c.consumer_id)); return row && near(row.total_dues, sum(ds.filter(d => d.due_date), d => d.total)) && near(row.total_paid, sum(ds.filter(d => d.due_date), d => d.paid)) && near(row.total_os, row.total_dues - row.total_paid) && near(Object.values(row.months).reduce((a, m) => a + m.dues, 0), row.total_dues); }), J(j.totals));
  // ---- forecast ----
  j = await get(`/customer-forecasting?projectId=${P}`); const fut = LP.filter(d => d.due_date && d.due_date >= today && d.total - d.paid > 0.004);
  t(`${pn} customer-forecasting: the unpaid part of every demand due today or later`, j.detail.length === fut.length && near(j.totals.projected, sum(fut, d => d.total - d.paid)) && near(j.totals.demanded, sum(fut.filter(d => d.raised), d => d.total - d.paid)) && near(j.totals.pending, sum(fut.filter(d => !d.raised), d => d.total - d.paid)), J(j.totals));
  t(`${pn} customer-forecasting: the months add up to the detail`, near(sum(j.monthly, m => m.projected_amount), sum(j.detail, d => d.balance)) && j.monthly.every(m => m.installment_count === j.detail.filter(d => monthName(d.due_date.slice(0, 7) + '-01') === m.month_label).length), '');
  // ---- pivot ----
  j = await get(`/collection-pivot?projectId=${P}`); const pv = j.data.consumers;
  t(`${pn} collection-pivot: due and outstanding of every customer and month`, mine.every(c => { const ds = raisedOf(LP.filter(d => d.consumer_id === c.consumer_id)); const row = pv.find(x => x.consumer_id === c.consumer_id); if (!ds.length) return !row; return row && near(Object.values(row.months).reduce((a, m) => a + m.due, 0), sum(ds, d => d.total)) && near(Object.values(row.months).reduce((a, m) => a + m.os, 0), sum(ds, d => d.total - d.paid)); }) && j.data.months.length === new Set(pv.flatMap(x => Object.keys(x.months))).size, J(j.data.months));
  // ---- dashboards ----
  const lp = LP, receivables = sum(lp, d => d.total), collected = sum(mine, c => cash[c.plan_id]?.clear || 0);
  j = await get(`/financial-dashboard?projectId=${P}`); const m = j.data.metrics;
  t(`${pn} financial-dashboard: receivables, collected, outstanding, demand count, overdue count (unpaid and late only), collection %`, near(m.total_receivables, receivables) && near(m.total_collected, collected) && near(m.outstanding, receivables - collected) && m.total_demands === lp.length && m.overdue_count === odOf(lp).length && m.collectionPercentage === (receivables > 0 ? Math.round(collected / receivables * 100) : 0), J(m));
  j = await get(`/project-dashboard?projectId=${P}`);
  const uc = rows(`select count(*) total, count(*) filter (where status='available') avail from units where project_id='${P}'`)[0];
  t(`${pn} project-dashboard: units and collection`, j.data.inventory.total_units === Number(uc.total) && j.data.inventory.available === Number(uc.avail) && near(j.data.payment.total_collected, collected) && near(j.data.payment.total_receivables, receivables), J(j.data));
  // ---- applicant payment file ----
  j = await get(`/applicant-payment-file?projectId=${P}`);
  t(`${pn} applicant-payment-file: one row per live customer; dues, received, outstanding, credit match; the surrendered customer is not there`, j.total === mine.length && mine.every(c => { const x = j.data.find(y => y.consumer_id === c.consumer_id), mm = custMoney(c); return x && near(x.dues_total, mm.demanded) && near(x.received_amount, mm.recv) && near(x.outstanding_amount, mm.os) && near(x.credit_amount, mm.credit) && near(x.dues_amount + x.dues_cgst + x.dues_sgst, x.dues_total) && near(x.total_unit_cost, mm.cost); }) && !j.data.some(x => x.consumer_id === S.c4.c), J(j.data[0]).slice(0, 300));
  t(`${pn} applicant-payment-file: received %, received CGST / SGST and the split of the outstanding (amount + CGST + SGST = total) are real numbers of each customer`, mine.every(c => { const x = j.data.find(y => y.consumer_id === c.consumer_id), mm = custMoney(c), c0 = cash[c.plan_id] || { cgst: 0, sgst: 0 }; return x && near(x.received_pct, mm.pct) && near(x.received_cgst, Number(c0.cgst)) && near(x.received_sgst, Number(c0.sgst)) && near(x.outstanding_net + x.outstanding_cgst + x.outstanding_sgst, x.outstanding_amount); }), J(j.data[0]).slice(0, 300));
  t(`${pn} applicant-payment-file: every name is filled (an applicant saved with one name field shows it)`, j.data.every(x => x.consumer_name && x.consumer_name.length > 2), J(j.data.map(x => x.consumer_name)));
  t(`${pn} applicant-payment-file: summary covers all rows, not only the page`, near(j.summary.totalReceived, sum(mine, c => custMoney(c).recv)) && j.summary.totalConsumers === mine.length, J(j.summary));
  if (mine.length > 1) { const pg = await get(`/applicant-payment-file?projectId=${P}&pageSize=1&page=2`); t(`${pn} applicant-payment-file: page 2 of size 1`, pg.data.length === 1 && pg.total === mine.length && pg.totalPages === mine.length && near(pg.summary.totalReceived, j.summary.totalReceived), J(pg.summary)); }
}
// ---- interest: charged once, waiver taken off once ----
// Interest runs on the BASIC amount of the installment, without GST (owner decision 2026-10-29, same as the client's own file)
{
  const dm = rows(`select id, amount_due_inr total from demands where payment_plan_id='${S.c10.plan}' and installment_index=1`)[0];
  const exp = r2(Math.round(Number(dm.total) * interestRate / 100 / 365 * 40 * 100) / 100);
  let j = await get(`/applicant-payment-file?projectId=${P3}`); let x = j.data.find(y => y.consumer_id === S.c10.c);
  t('interest: a demand 40 days late with no payment is charged amount x rate / 365 x 40 days', near(x.interest_charged, exp, 0.02) && x.interest_waived === 0 && near(x.interest_outstanding, exp, 0.02), `${x.interest_charged} vs ${exp} at ${interestRate}%`);
  psql(`insert into penal_interests (payment_plan_id, installment_index, consumer_id, principal_inr, days_overdue, rate_percent, amount_inr, interest_waived_inr, status) values ('${S.c10.plan}', 1, '${S.c10.c}', ${dm.total.split?.('.')[0] ?? Math.round(dm.total)}, 40, ${interestRate}, 1000, 400, 'calculated') returning 1`);
  j = await get(`/applicant-payment-file?projectId=${P3}`); x = j.data.find(y => y.consumer_id === S.c10.c);
  t('interest: a stored instalment (interest scheduler) replaces the computed one once; the waiver comes off once (1000 - 400 = 600)', near(x.interest_charged, 1000, 0.02) && near(x.interest_waived, 400, 0.02) && near(x.interest_outstanding, 600, 0.02), J({ c: x.interest_charged, w: x.interest_waived, o: x.interest_outstanding }));
  const sr = await get(`/summary-report`); const pr = sr.data.find(y => y.project_id === P3);
  t('summary-report: the company summary of P3 carries the same interest', pr && near(pr.due_interest, sum(custIn(P3), c => { const xx = j.data.find(y => y.consumer_id === c.consumer_id); return xx.interest_outstanding; })), J(pr).slice(0, 300));
  t('summary-report: demanded, received, balance recoverable (= current O/S) and credit of P3 match', pr && near(pr.upto_demanded, sum(custIn(P3), c => custMoney(c).demanded)) && near(pr.upto_received, sum(custIn(P3), c => custMoney(c).recv)) && near(pr.balance_recoverable, sum(custIn(P3), c => custMoney(c).os)) && near(pr.current_os, pr.balance_recoverable), J(pr).slice(0, 300));
}

// ===================================================================================================================
// 4. collection and the bank views
// ===================================================================================================================
// every receipt of my customers, with the project it belongs to (its plan's project, else the applicant's): the money that really came in is status 'cleared' and not an advance copy
const allIds = made.map(x => `'${x}'`).join(',');
const RC = rows(`select r.id, r.status, r.payment_method::text pm, r.amount_received_inr::numeric amt, r.received_date::text rd, r.is_advance adv, r.company_bank_account_id bank, coalesce(pp.project_id, c.project_id) project_id
                   from receipts r join consumers c on c.id=r.consumer_id left join payment_plans pp on pp.id=r.payment_plan_id where r.consumer_id in (${allIds})`);
const isCash = (x) => x.status === 'cleared' && !x.adv;
t('collection set-up: the overpayment left an advance copy, a bounced, a cancelled, a pending and an on-hold receipt (so each rule is under test)', RC.some(x => x.adv) && ['bounced', 'cancelled', 'pending', 'on_hold', 'cleared'].every(st => RC.some(x => x.status === st)), RC.map(x => x.status).join());
for (const P of ALLP) {
  const pn = `P${ALLP.indexOf(P) + 1}`, mine = RC.filter(x => x.project_id === P), cash1 = mine.filter(isCash);
  let j = await get(`/project-collection?projectId=${P}`); const row = j.data[0];
  const meth = (ms) => sum(cash1.filter(x => ms.includes(x.pm)), x => x.amt);
  t(`${pn} project-collection: cheque, draft, online, cash and total are the CLEARED receipts only (bounced / cancelled / pending not in the total)`, near(row.cheque_amount, meth(['cheque'])) && near(row.draft_amount, meth(['demand_draft'])) && near(row.online_amount, meth(['neft', 'rtgs', 'upi', 'bank_transfer', 'card'])) && near(row.cash_amount, meth(['cash'])) && near(row.total_amount, sum(cash1, x => x.amt)) && near(row.total_collection, row.total_amount) && near(row.cheque_amount + row.draft_amount + row.online_amount + row.cash_amount + row.other_amount, row.total_amount), J(row));
  t(`${pn} project-collection: normal / cancelled / bounced counts and the not yet cleared amount`, row.normal_count === cash1.length && row.cancel_count === mine.filter(x => x.status === 'cancelled').length && row.bounce_count === mine.filter(x => x.status === 'bounced').length && near(row.uncleared_amount, sum(mine.filter(x => ['pending', 'authorized', 'deposited', 'on_hold'].includes(x.status) && !x.adv), x => x.amt)), J(row));
  t(`${pn} project-collection: totals row = the row`, near(j.totals.total_amount, row.total_amount) && j.totals.normal_count === row.normal_count, J(j.totals));
  j = await get(`/project-collection?projectId=${P}&fromDate=${later(-400)}&toDate=${later(-300)}`); t(`${pn} project-collection: a date range with no receipts gives zeros (no NaN)`, j.data[0].total_amount === 0 && j.data[0].normal_count === 0, J(j.data[0]));
  j = await get(`/project-collection?projectId=${P}&fromDate=${today}&toDate=${today}`); t(`${pn} project-collection: today only = everything (all receipts are of today)`, near(j.data[0].total_amount, sum(cash1, x => x.amt)), J(j.data[0]));
  j = await get(`/monthly-collection?projectId=${P}`); t(`${pn} monthly-collection: the month's cleared receipts (count and amount)`, cash1.length === 0 ? j.data.length === 0 : (j.data.length === 1 && j.data[0].receipt_count === cash1.length && near(j.data[0].amount_collected_inr, sum(cash1, x => x.amt))), J(j.data));
  j = await get(`/year-month-collection?projectId=${P}`); const cy = new Date().getFullYear(), cmn = new Date().getMonth(), gy = j.data.find(g => g.year === cy);
  t(`${pn} year-month-collection: the month cell, the year total and the grand total are the cleared receipts`, gy && near(gy.months[cmn], sum(cash1, x => x.amt)) && near(gy.total, sum(cash1, x => x.amt)) && near(j.grandTotal, sum(cash1, x => x.amt)) && near(j.monthTotals[cmn], sum(cash1, x => x.amt)), J(j.data));
  j = await get(`/receipt-wise-collection?projectId=${P}`); t(`${pn} receipt-wise-collection: one row per receipt of the project, every status, advance copies marked`, j.data.length === mine.length && j.data.filter(x => x.is_advance).length === mine.filter(x => x.adv).length && !j.truncated, `${j.data.length}/${mine.length}`);
  for (const st of ['cleared', 'pending', 'bounced', 'cancelled', 'on_hold']) { const k = await get(`/receipt-wise-collection?projectId=${P}&status=${st}`); t(`${pn} receipt-wise-collection: status=${st}`, k.data.length === mine.filter(x => x.status === st).length && k.data.every(x => x.status === st), `${k.data.length}`); }
  for (const pm of ['neft', 'cheque', 'cash']) { const k = await get(`/receipt-wise-collection?projectId=${P}&paymentMethod=${pm}`); t(`${pn} receipt-wise-collection: paymentMethod=${pm}`, k.data.length === mine.filter(x => x.pm === pm).length, `${k.data.length}`); }
  j = await get(`/bank-ledger?projectId=${P}`); t(`${pn} bank-ledger: every receipt of the project (also an applicant who no longer holds a unit), advance copies left out`, j.data.length === mine.filter(x => !x.adv).length, `${j.data.length}/${mine.filter(x => !x.adv).length}`);
}
// the surrendered customer's money stays in collection, in the project it was paid for
t('collection: the surrendered customer\'s cleared money is in P1 collection (it is not lost with the booking)', near(sum(RC.filter(x => x.project_id === P1 && isCash(x)), x => x.amt), Number((await get(`/project-collection?projectId=${P1}`)).data[0].total_amount)) && RC.some(x => x.project_id === P1 && isCash(x)), '');
// the bank views: company banks, cleared receipts as credit, cleared outgoing payments as debit, the running balance by month
{
  const op = psql(`insert into outgoing_payments (company_bank_account_id, amount_inr, payment_date, payee, status) values ('${bank1}', 1234.56, current_date, 'Rep payee ${U}', 'cleared') returning id`);
  psql(`insert into outgoing_payments (company_bank_account_id, amount_inr, payment_date, payee, status) values ('${bank1}', 999.99, current_date, 'Rep payee pending ${U}', 'pending') returning id`);
  extraSql.push(`delete from outgoing_payments where company_bank_account_id in ('${bank1}','${bank2}')`);
  let j = await get(`/cash-bank-summary?companyId=${co}`);
  for (const [b, name] of [[bank1, 'A'], [bank2, 'B']]) {
    const cr = sum(RC.filter(x => x.bank === b && isCash(x)), x => x.amt), db_ = b === bank1 ? 1234.56 : 0, row = j.data.find(x => x.id === b);
    t(`bank ${name}: credit = cleared receipts of that bank, debit = cleared outgoing payments, closing = credit - debit`, row && near(row.credit, cr) && near(row.debit, db_) && near(row.closing_balance, cr - db_), J(row));
  }
  j = await get(`/cash-bank-summary?companyId=${co}&fromDate=${later(1)}`); t('bank: a date range with nothing gives zeros', j.data.every(x => x.credit === 0 && x.debit === 0 && x.closing_balance === 0), J(j.data));
  j = await get(`/cash-bank-summary?projectId=${P1}&companyBankAccountId=${bank2}`); t('bank: filtered by project and one account', j.data.length === 1 && j.data[0].id === bank2, J(j.data));
  const crMonth = sum(RC.filter(x => x.bank === bank1 && isCash(x)), x => x.amt);
  j = await get(`/ledger-monthly-summary/${bank1}`); const mr = j.data[1];
  t('ledger-monthly-summary: opening row, then the month with its credit, debit and closing balance (Cr / Dr)', j.data[0].label === 'Opening Balance' && mr && near(mr.credit, crMonth) && near(mr.debit, 1234.56) && near(mr.closing_balance, Math.abs(crMonth - 1234.56)) && mr.closing_notation === (crMonth - 1234.56 >= 0 ? 'Cr' : 'Dr'), J(j.data));
  r = await A('GET', `/reports/ledger-monthly-summary/abc`); t('ledger-monthly-summary: a bank id "abc" -> 400', r.s === 400, r.s);
  j = await get(`/bank-ledger?companyBankAccountId=${bank1}&dateType=clearing`); t('bank-ledger: by bank and clearing date (cleared today)', j.data.length === RC.filter(x => x.bank === bank1 && !x.adv && x.status === 'cleared').length, `${j.data.length}`);
  r = await A('GET', '/reports/bank-ledger?dateType=zzz'); t('bank-ledger: dateType "zzz" -> 400', r.s === 400, r.s);
}

// ===================================================================================================================
// 5. inventory and the smaller reports
// ===================================================================================================================
{
  const US = rows(`select u.id, u.project_id, u.tower_id, t.tower_name, u.status, u.bhk_type, u.floor, coalesce(u.carpet_area_sqft,0) carpet from units u join towers t on t.id=u.tower_id where u.project_id in (${IN_P})`);
  const stat = (x) => x.status === 'available' ? 'unsold' : 'sold';
  let j = await get(`/inventory-details?projectId=${P1}`);
  t('inventory-details: the default (project) view answers (it used to be a 500) with total, sold and unsold units and area', j.data.length === 1 && Number(j.data[0].total_units) === US.filter(x => x.project_id === P1).length && Number(j.data[0].sold_units) === US.filter(x => x.project_id === P1 && x.status !== 'available').length && near(j.data[0].total_area, sum(US.filter(x => x.project_id === P1), x => x.carpet)), J(j.data));
  for (const gb of ['project', 'tower', 'bhk_type', 'matrix', 'project_bhk_type']) { j = await get(`/inventory-details?projectId=${P1}&groupBy=${gb}&companyId=${co}`); t(`inventory-details: groupBy=${gb} adds up to the project's units`, sum(j.data, x => x.total_units) === US.filter(x => x.project_id === P1).length && sum(j.data, x => x.sold_units) + sum(j.data, x => x.unsold_units) === sum(j.data, x => x.total_units), J(j.data).slice(0, 200)); }
  r = await A('GET', `/reports/inventory-details?groupBy=zzz`); t('inventory-details: groupBy=zzz -> 400', r.s === 400, r.s);
  j = await get(`/inventory-full?projectId=${P1}`); const u1 = US.filter(x => x.project_id === P1);
  t('inventory-full: summary buckets cover every unit (unmapped = 0) and the list has one row per unit', j.data.summary.total_units === u1.length && j.data.units.length === u1.length && j.data.summary.unmapped_count === 0 && j.data.summary.available === u1.filter(x => x.status === 'available').length, J(j.data.summary));
  j = await get(`/unit-wise-plc?projectId=${P1}`); t('unit-wise-plc: one row per unit (a second booking draft does not repeat the unit)', j.data.length === u1.length, `${j.data.length}/${u1.length}`);
  j = await get(`/unit-cost?projectId=${P1}`); t('unit-cost: one row per unit', j.data.length === u1.length, `${j.data.length}`);
  j = await get(`/unit-sold-area?projectId=${P1}`); t('unit-sold-area: counts add up to the units; sold % is a number', sum(j.data, x => x.total_count) === u1.length && j.data.every(x => Number.isFinite(Number(x.sold_pct))), J(j.data).slice(0, 200));
  j = await get(`/project-details?projectId=${P1}`);
  t('project-details: units, sold, towers and the COLLECTION (cleared receipts, not the booking amounts)', Number(j.data[0].total_units) === u1.length && Number(j.data[0].total_towers) === 2 && near(j.data[0].total_collection, sum(RC.filter(x => x.project_id === P1 && isCash(x)), x => x.amt)), J(j.data[0]));
  j = await get(`/stock-report?companyId=${co}`); t('stock-report: units of the three projects', sum(j.data, x => x.stock_unit) === US.length, J(j.data).slice(0, 200));
  j = await get(`/tower-floor-sales?projectId=${P1}`);
  const soldU = u1.filter(x => !['available', 'locked', 'held', 'temp_surrender'].includes(x.status));
  const liveBuyerCash = sum(custIn(P1), c => cash[c.plan_id]?.clear || 0);
  t('tower-floor-sales: total stock, sold (balance) units and the RECEIVED amount (the live buyers\' cleared money, in lakhs)', j.totals.total_stock_units === u1.length && j.totals.balance_units === soldU.length && near(j.totals.received_amount_lakhs * 100000, liveBuyerCash, 1) && Number.isFinite(j.totals.pct_sold_vs_total_stock), J(j.totals) + ' ' + liveBuyerCash);
  j = await get(`/allotment-dashboard?projectId=${P1}`); t('allotment-dashboard: by project and by unit type give the same unit count', j.data.byUnitType.reduce((a, x) => a + x.totalUnits, 0) === u1.length && j.data.byProject.length === 1, J(j.data.byProject));
  j = await get(`/opening-details?projectId=${P1}`); t('opening-details: the live customers only (the surrendered booking is not listed)', j.data.length === custIn(P1).length && !j.data.some(x => x.consumer_id === S.c4.c), `${j.data.length}`);
  j = await get(`/booking-record?projectId=${P1}`); t('booking-record: a row per booking incl. the cancelled one', j.data.length >= custIn(P1).length + 1, `${j.data.length}`);
  j = await get(`/booking-authentication?projectId=${P1}`); t('booking-authentication: a row per booking', j.total >= custIn(P1).length, `${j.total}`);
  j = await get(`/all-applicants?projectId=${P1}`); t('all-applicants: live bookings only, one row each', j.data.length === custIn(P1).length, `${j.data.length}`);
  j = await get(`/customer-payment-mismatch?projectId=${P1}`);
  const mism = rows(`select distinct b.consumer_id from booking_records b join units u on u.id=b.unit_id where b.status in ('complete','pending_payment','active') and u.project_id='${P1}' and exists (select 1 from receipts r where r.consumer_id=b.consumer_id and r.demand_id is null and r.installment_index is null and r.status not in ('cancelled','bounced'))`).map(x => x.consumer_id);
  t('customer-payment-mismatch: customers with a payment not tied to an instalment (a bounced one does not count)', j.data.length === mism.length && mism.every(c => j.data.some(x => x.id === c)), `${j.data.length}/${mism.length}`);
  // other charges: only cleared receipts
  psql(`update receipts set plc_amount = 100 where consumer_id='${S.c1.c}' returning 1`);
  j = await get(`/other-charges?projectId=${P1}`); const oc = j.data.find(x => x.consumer_id === S.c1.c);
  const c1clear = RC.filter(x => x.project_id === P1 && isCash(x)).length; void c1clear;
  const nClear = Number(psql(`select count(*) from receipts where consumer_id='${S.c1.c}' and status='cleared' and is_advance is not true`));
  t('other-charges: received PLC counts cleared receipts only (not the cancelled, bounced or pending ones)', oc && near(oc.received_plc, 100 * nClear), J(oc));
  r = await A('GET', `/reports/other-charges?chargeType=zzz`); t('other-charges: chargeType=zzz -> 400', r.s === 400, r.s);
  // TDS status: a released assignment is no TDS paid
  const ch = psql(`insert into tds_challans (challan_number, challan_date, amount, financial_year, quarter, status) values ('RP${U}1', current_date, 5000, '2026-27', 'Q3', 'available') returning id`);
  const rid = bookingReceipt(S.c1);
  psql(`insert into tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned) values ('${ch}','${S.c1.c}','${rid}', 1500) returning 1`);
  psql(`insert into tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned, released_at, release_reason) values ('${ch}','${S.c1.c}','${rid}', 2500, now(), 'cancelled') returning 1`);
  extraSql.push(`delete from tds_assignments where challan_id='${ch}'`, `delete from tds_challans where id='${ch}'`);
  j = await get(`/tds-status?projectId=${P1}`); const tds = j.data.filter(x => x.consumer_id === S.c1.c);
  t('tds-status: only the live assignment (1,500); the released one (2,500) is not TDS paid', tds.length === 1 && near(tds[0].tds_paid, 1500), J(tds));
  // add-on charge report: active charges only
  const mst = psql(`insert into addon_charge_master (project_id, charge_name, default_amount) values ('${P1}', 'RepAddon ${U}', 5000) returning id`);
  psql(`insert into consumer_addon_charges (consumer_id, project_id, charge_master_id, charge_name, amount, status) values ('${S.c1.c}','${P1}','${mst}','RepAddon ${U}', 5000, 'active'), ('${S.c1.c}','${P1}','${mst}','RepAddon ${U}', 7000, 'cancelled'), ('${S.c1.c}','${P1}','${mst}','RepAddon ${U}', 9000, 'waived') returning 1`);
  extraSql.push(`delete from consumer_addon_charges where charge_master_id='${mst}'`, `delete from addon_charge_master where id='${mst}'`);
  j = await get(`/addon-charges-report?projectId=${P1}&chargeName=${encodeURIComponent('RepAddon ' + U)}`); t('addon-charges-report: only the active charge (5,000); cancelled and waived ones are not listed', j.data.length === 1 && near(j.data[0].amount, 5000), J(j.data));
  j = await get('/addon-charge-names'); t('addon-charge-names: lists the name once', j.data.filter(x => x === 'RepAddon ' + U).length === 1, '');
  j = await get('/bank-ledger-company-banks'); t('bank-ledger-company-banks: lists the active banks', j.data.some(x => x.id === bank1), '');
  j = await get('/conveyance-deed-date'); t('conveyance-deed-date answers', Array.isArray(j.data), '');
  // custom report definitions
  r = await A('POST', '/reports/custom-report', { reportType: 'dues', name: 'My dues ' + U, projectId: P1, filters: { a: 1 }, columns: ['name', 'amount'] }); t('custom-report: saved with project, filters and columns (it used to be a 500)', r.s === 201 && r.j.data.name === 'My dues ' + U, r.s + J(r.j));
  j = await get(`/custom-reports?projectId=${P1}`); t('custom-reports: the saved definition is listed with its name', j.data.some(x => x.name === 'My dues ' + U && x.type === 'dues'), J(j.data));
  for (const [n, b] of [['no type', { name: 'x' }], ['type 101 characters', { reportType: 'x'.repeat(101) }], ['project "abc"', { reportType: 'x', projectId: 'abc' }], ['unknown project', { reportType: 'x', projectId: NIL }], ['columns not a list', { reportType: 'x', columns: 'a' }], ['columns with a number', { reportType: 'x', columns: [1] }], ['61 columns', { reportType: 'x', columns: Array(61).fill('a') }], ['filters a list', { reportType: 'x', filters: [1] }], ['name with <b>', { reportType: 'x', name: '<b>' }], ['name 300 characters', { reportType: 'x', name: 'n'.repeat(300) }]]) { r = await A('POST', '/reports/custom-report', b); t(`custom-report: ${n} -> 400/404, not 500`, r.s === 400 || r.s === 404, r.s + J(r.j)); }
  r = await A('POST', '/reports/custom-report', [1, 2]); t('custom-report: a list as the body -> 400', r.s === 400, r.s);
  r = await A('POST', '/reports/custom-report', undefined, '{bad json'); t('custom-report: broken JSON -> 400', r.s === 400, r.s);
}

// ===================================================================================================================
// 6. hostile filters on every route: never a 500, never SQL built from the text
// ===================================================================================================================
{
  const hostile = ['projectId=abc', 'projectId[]=x', 'projectId=a&projectId=b', 'projectId[a]=b', `projectId=${NIL}`, `towerId=abc`, 'consumerId=1', 'companyId=zz', 'companyBankAccountId=zz', 'dueDate=2026-02-31', 'dueDate=abc', 'asOnDate=1990-00-00', 'fromDate=2030-01-01&toDate=2020-01-01', 'dateFrom=2030-01-01&dateTo=2020-01-01',
    'bookingFromDate=2030-01-01&bookingToDate=2020-01-01', 'page=0', 'page=-1', 'page=1e3', 'page=abc', 'pageSize=999999', 'pageSize=0', 'pageSize=abc', 'pageSize[]=2', 'year=99999', 'year=abc', 'installmentIndex=abc', 'installmentIndex=-5', 'installmentIndex=99999999999', 'inPercent=abc', 'pctValue=1e9x',
    'balanceType=zzz', 'groupBy=zzz', 'status=zzz', 'view=zzz', 'chargeType=zzz', 'dateType=zzz', 'duesCriteria=zzz', 'pctOperator=zzz&pctValue=5', 'paymentMethod=zzz', 'fromMonth=13&fromYear=2026&toMonth=1&toYear=2026', 'fromMonth=1&fromYear=1&toMonth=1&toYear=2026',
    `registrationNo=${encodeURIComponent("%")}`, `registrationNo=${encodeURIComponent("_")}`, `name=${encodeURIComponent("' OR 1=1 --")}`, `name=${encodeURIComponent("'; DROP TABLE receipts;--")}`, `firstName=${encodeURIComponent('<script>alert(1)</script>')}`, `unitNo=${encodeURIComponent('\\')}`, `broker=${encodeURIComponent('%%%')}`,
    `planName=${encodeURIComponent("{{7*7}}")}`, `x=${'a'.repeat(5000)}`, `projectId=${'a'.repeat(5000)}`, 'projectId=%00', `name=${encodeURIComponent('=cmd|calc')}`, 'floor=abc', 'floor=1e9', 'bhkType=%27', 'towerName=%25'];
  const paths = GET_ROUTES.map(p => p.split('?')[0]).filter((x, i, a) => a.indexOf(x) === i).map(p => p.replace(bank1, bank1));
  let bad5 = [], badCodes = [];
  for (const p of paths) for (const q of hostile) {
    const x = await A('GET', '/reports' + p + '?' + q + (q.includes('projectId') ? '' : `&projectId=${P1}`) + (p.startsWith('/month-wise-dues-customer') && !q.includes('fromMonth') ? '&fromMonth=1&fromYear=2026&toMonth=2&toYear=2026' : ''));
    if (x.s >= 500) bad5.push(`${p}?${q.slice(0, 40)} -> ${x.s} ${J(x.j).slice(0, 100)}`);
    if (![200, 400].includes(x.s)) badCodes.push(`${p}?${q.slice(0, 40)} -> ${x.s}`);
  }
  t(`hostile: ${paths.length} routes x ${hostile.length} hostile filters: no 5xx`, bad5.length === 0, bad5.slice(0, 6).join(' | ') + ` (${bad5.length})`);
  t('hostile: every answer is 200 or 400', badCodes.length === 0, badCodes.slice(0, 6).join(' | '));
  // which are refused (400) and which are read as plain text
  const code = async (p, q) => (await A('GET', '/reports' + p + '?' + q)).s;
  for (const [q, want] of [['projectId=abc', 400], ['projectId[]=x', 400], ['projectId=a&projectId=b', 400], ['dueDate=2026-02-31', 400], ['asOnDate=abc', 400], ['fromDate=2030-01-01&toDate=2020-01-01', 400], ['page=0', 400], ['pageSize=abc', 400], ['balanceType=zzz', 400], ['x=' + 'a'.repeat(300), 400], ['projectId=%00', 400]]) {
    t(`hostile: customer-balance?${q.slice(0, 40)} -> ${want}`, await code('/customer-balance', q) === want, await code('/customer-balance', q));
  }
  for (const p of ['/customer-dues', '/due-report', '/ageing-project', '/stage-wise-dues', '/month-wise-dues', '/project-collection', '/financial-dashboard']) t(`hostile: ${p} with projectId=abc -> 400 (it used to be a 500)`, await code(p, 'projectId=abc') === 400, await code(p, 'projectId=abc'));
  // % _ \ and quotes are plain characters: they match nothing instead of everything
  for (const [p, key] of [['/customer-balance', 'registrationNo'], ['/customer-balance', 'name'], ['/customer-dues', 'registrationNo'], ['/customer-due-summary', 'registrationNo'], ['/customer-due-summary', 'name'], ['/customer-due-summary', 'unitNo'], ['/applicant-payment-file', 'registrationNo'], ['/applicant-payment-file', 'name'], ['/applicant-payment-file', 'unitNo'], ['/all-applicants', 'registrationNo'], ['/all-applicants', 'firstName'], ['/all-applicants', 'unitNumber'], ['/all-applicants', 'broker'], ['/customer-payment-mismatch', 'registrationNo'], ['/addon-charges-report', 'registrationNo']]) {
    for (const w of ['%', '_', "' OR '1'='1", '\\']) { const x = await A('GET', `/reports${p}?projectId=${P1}&${key}=${encodeURIComponent(w)}`); const n = (x.j?.data || []).length; t(`hostile: ${p} ${key}=${w} matches nothing`, x.s === 200 && n === 0, x.s + ' ' + n); }
  }
}

// ===================================================================================================================
// 7. empty results: a project with nothing in it, every route, no NaN / undefined / null in a number
// ===================================================================================================================
{
  const PE = await mkProj('E');
  let badN = [], bad5 = [];
  for (const p of GET_ROUTES) {
    const path = p.split('?')[0], x = await A('GET', '/reports' + path + '?projectId=' + PE + (path.startsWith('/month-wise-dues-customer') ? '&fromMonth=1&fromYear=2026&toMonth=2&toYear=2026' : ''));
    if (x.s !== 200) { bad5.push(path + ' ' + x.s); continue; }
    const txt = JSON.stringify(x.j);
    if (path !== '/addon-charge-names' && /:(NaN|undefined|Infinity)|"(NaN|undefined)"/.test(txt)) badN.push(path);   // (the add-on names list is every project's text as typed)
  }
  t('empty: every route answers 200 for a project with no data', bad5.length === 0, bad5.join(' '));
  t('empty: no NaN / undefined / Infinity in any answer', badN.length === 0, badN.join(' '));
  for (const [p, f] of [['/customer-balance', j => j.data.length === 0 && j.summary.totalBalance === 0], ['/customer-dues', j => j.total === 0 && j.summary.total.total === 0], ['/due-report', j => j.total === 0 && j.summary.totalDue === 0], ['/stage-wise-dues', j => j.data.length === 0 && j.totals.total_due === 0],
    ['/percentage-wise-dues', j => j.buckets.length === 0 && j.totals.total_consumers === 0], ['/ageing-project', j => j.data.length === 0 && j.totals.total_overdue === 0], ['/financial-dashboard', j => j.data.metrics.collectionPercentage === 0 && j.data.metrics.total_receivables === 0],
    ['/project-collection', j => j.data[0].total_amount === 0 && j.totals.normal_count === 0], ['/year-month-collection', j => j.grandTotal === 0 && j.data.length === 1], ['/project-wise-dues', j => j.data[0].due_pct === 0 && j.data[0].outstanding_pct === 0 && j.totals.received_pct === 0]]) {
    const j = await get(p + '?projectId=' + PE); t(`empty: ${p} gives zeros, no division by zero`, f(j), J(j).slice(0, 200));
  }
  extraSql.push(`delete from towers where project_id='${PE}'`, `delete from projects where id='${PE}'`);
  made.push(); // (projects are cleaned below)
  PROJECT_CLEAN.push(PE);
}

// ===================================================================================================================
// 8. project scope: a login limited to a project sees only that project's rows and totals
// ===================================================================================================================
{
  const afId = psql(`select id from users where email='accounts_finance@test.local'`);
  r = await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [P1] }); t('scope: (set-up) accounts_finance limited to project 1', r.s === 200, r.s + J(r.j)); await new Promise(x => setTimeout(x, 150));
  try {
    const only = async (path, f, name) => { const x = await AF('GET', '/reports' + path); t(`scope: ${name}`, x.s === 200 && f(x.j), x.s + ' ' + J(x.j).slice(0, 220)); return x.j; };
    const a1 = await get(`/financial-dashboard?projectId=${P1}`), a1c = await get(`/customer-balance?projectId=${P1}`), a1d = await get(`/customer-dues?projectId=${P1}`), a1r = await get(`/due-report?projectId=${P1}`), a1p = await get(`/project-collection?projectId=${P1}`), a1t = await get(`/tower-floor-sales?projectId=${P1}`);
    await only('/financial-dashboard', j => near(j.data.metrics.total_receivables, a1.data.metrics.total_receivables) && near(j.data.metrics.total_collected, a1.data.metrics.total_collected) && j.data.metrics.total_demands === a1.data.metrics.total_demands, 'financial-dashboard without a project = project 1 only');
    await only('/customer-balance', j => j.summary.totalConsumers === a1c.summary.totalConsumers && near(j.summary.totalReceived, a1c.summary.totalReceived) && j.data.every(x => x.project_id === P1), 'customer-balance rows and totals are project 1 only');
    await only('/customer-dues', j => j.total === a1d.total && near(j.summary.clear.total, a1d.summary.clear.total), 'customer-dues');
    await only('/due-report', j => j.total === a1r.total && near(j.summary.totalDueWithGst, a1r.summary.totalDueWithGst), 'due-report');
    await only('/project-collection', j => j.data.length === 1 && j.data[0].project_id === P1 && near(j.totals.total_amount, a1p.totals.total_amount), 'project-collection lists only project 1');
    await only('/project-wise-dues?groupBy=project', j => j.data.length === 1 && j.data[0].group_id === P1, 'project-wise-dues lists only project 1');
    await only('/project-wise-dues?groupBy=tower', j => j.data.every(x => x.project_name === `Rep A ${U}`), 'project-wise-dues by tower: only project 1 towers');
    await only('/ageing-project', j => j.data.every(x => x.project_id === P1), 'ageing-project');
    await only('/ageing-summary-project', j => j.data.every(x => x.group_id === P1), 'ageing-summary-project');
    await only('/stock-report', j => j.data.every(x => x.project_id === P1), 'stock-report');
    await only('/summary-report', j => j.data.every(x => x.project_id === P1), 'summary-report');
    await only('/project-details', j => j.data.length === 1 && j.data[0].id === P1, 'project-details');
    await only('/inventory-details', j => j.data.length === 1 && j.data[0].group_id === P1, 'inventory-details');
    await only('/tower-floor-sales', j => j.totals.total_stock_units === a1t.totals.total_stock_units && near(j.totals.received_amount_lakhs, a1t.totals.received_amount_lakhs), 'tower-floor-sales');
    await only('/allotment-dashboard', j => j.data.byProject.length === 1, 'allotment-dashboard');
    // rows with no project at all (old applicants without a project) are open to every login by the scope rule, so they may show; the other projects' rows never
    const others = new Set(RC.filter(x => x.project_id !== P1).map(x => x.id));
    await only('/receipt-wise-collection', j => j.data.every(x => !others.has(x.id)) && RC.filter(x => x.project_id === P1).every(x => j.data.some(y => y.id === x.id)), 'receipt-wise-collection: project 1 receipts, none of the other projects\'');
    await only('/bank-ledger', j => j.data.every(x => !others.has(x.id)) && RC.filter(x => x.project_id === P1 && !x.adv).every(x => j.data.some(y => y.id === x.id)), 'bank-ledger: project 1 receipts, none of the other projects\'');
    const visible = Number(psql(`select coalesce(sum(r.amount_received_inr),0) from receipts r join consumers c on c.id=r.consumer_id where r.status='cleared' and r.is_advance is not true and (c.project_id='${P1}' or c.project_id is null)`));
    await only('/monthly-collection', j => near(sum(j.data, x => x.amount_collected_inr), visible), 'monthly-collection: the receipts of the applicants this login can see (project 1 and applicants with no project), nothing of the other projects');
    await only('/applicant-payment-file', j => j.total === custIn(P1).length, 'applicant-payment-file');
    await only('/all-applicants', j => j.data.length === custIn(P1).length, 'all-applicants');
    await only('/unit-cost', j => j.data.every(x => x.project_name === `Rep A ${U}`), 'unit-cost');
    await only('/customer-forecasting', j => j.detail.every(x => x.project_name === `Rep A ${U}`), 'customer-forecasting');
    for (const p of ['/customer-balance', '/customer-dues', '/due-report', '/ageing-project', '/stage-wise-dues', '/percentage-wise-dues', '/month-wise-dues', '/customer-dues-detail', '/customer-due-summary', '/applicant-payment-file', '/project-collection', '/receipt-wise-collection', '/financial-dashboard', '/project-details', '/unit-wise-plc', '/opening-details', '/booking-record', '/customer-forecasting', '/collection-pivot', '/bank-ledger', '/other-charges', '/monthly-collection']) {
      const x = await AF('GET', `/reports${p}?projectId=${P2}`); const body = x.j || {};
      const empty = x.s === 200 && !J(body).includes(`Rep B ${U}`) && !J(body).includes(S.c7.c) && (body.data === undefined || (Array.isArray(body.data) ? body.data.every(y => !(y.project_id === P2)) : true)) && !(Array.isArray(body.data) && body.data.length && p !== '/project-collection' && p !== '/project-details');
      t(`scope: ${p}?projectId=<the other project> shows nothing of it`, empty, x.s + ' ' + J(body).slice(0, 200));
    }
    for (const p of ['/cash-bank-summary', `/ledger-monthly-summary/${bank1}`]) { const x = await AF('GET', '/reports' + p); t(`scope: ${p.split('/').slice(0, 2).join('/')} (company wide, outgoing payments have no project) -> 403 for a limited login`, x.s === 403, x.s + J(x.j)); }
    const x = await AF('GET', '/reports/bank-ledger-company-banks'); t('scope: the list of company banks (names only) stays readable', x.s === 200, x.s);
    const sa = await A('GET', '/reports/cash-bank-summary'); t('scope: the same company wide report works for a super admin', sa.s === 200, sa.s);
  } finally {
    r = await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] }); await new Promise(x => setTimeout(x, 150));
  }
  r = await AF('GET', `/reports/customer-balance?projectId=${P2}`); t('scope: with the limit lifted the other project is readable again', r.s === 200 && r.j.data.length === custIn(P2).length, r.s);
}

// ===================================================================================================================
// 9. a few thousand rows: right numbers, no N+1, fast
// ===================================================================================================================
{
  const N = Number(process.env.PERF_ROWS || 2400), PB = await mkProj('Big'), TB = await tw(PB, 'TB'), base = 100000000 + (Date.now() % 1000) * 100000;
  PROJECT_CLEAN.push(PB);
  const planName = await plan(PB, 'RepPlanBig ' + U, [30, 30, 40]);
  for (const sql of [
    `insert into consumers (name, first_name, last_name, mobile, project_id, registration_no, lead_stage) select 'Perf '||g||' ${U}', 'Perf', g::text, (7000000000 + ${base % 100000000} + g)::text, '${PB}', 'PF${U}-'||g, 'allotted' from generate_series(1, ${N}) g`,
    `insert into units (project_id, tower_id, unit_number, floor, bhk_type, carpet_area_sqft, super_area_sqft, status) select '${PB}', '${TB}', 'PF${U}-'||g, 1 + g % 12, case when g % 3 = 0 then '3BHK' else '2BHK' end, 900 + g % 150, 1100, 'booked' from generate_series(1, ${N}) g`,
    `insert into booking_records (consumer_id, project_id, unit_id, booking_date, booking_amount, status, basic_rate_inr_sqft, selected_plan_name, plc_amount) select c.id, '${PB}', u.id, current_date - (g % 300), 10000, 'complete', 4000 + g % 900, '${planName}', (g % 5) * 10000 from generate_series(1, ${N}) g join consumers c on c.registration_no = 'PF${U}-'||g join units u on u.unit_number = 'PF${U}-'||g and u.project_id = '${PB}'`,
    `update consumers c set allocated_unit_id = b.unit_id from booking_records b where b.consumer_id = c.id and c.project_id = '${PB}'`,
    `insert into allocations (consumer_id, unit_id, project_id, status, allotment_date) select b.consumer_id, b.unit_id, '${PB}', 'allotted', b.booking_date from booking_records b where b.project_id = '${PB}'`,
    `insert into payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) select a.id, a.consumer_id, a.unit_id, '${PB}', 5000000 from allocations a where a.project_id = '${PB}'`,
    `insert into demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount, status, demand_type) select pp.id, i, pp.consumer_id, current_date - (i * 55 - 130 + (abs(hashtext(pp.id::text)) % 40)), 1000000 + i * 1000, 25000 + i, 25000 + i, case when i <= 2 then 'demanded' else 'pending' end, 'installment' from payment_plans pp, generate_series(1, 3) i where pp.project_id = '${PB}'`,
    `insert into receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, received_date, receipt_number, status) select pp.consumer_id, pp.id, i, 300000 + (abs(hashtext(pp.id::text || i)) % 800000), (case when i = 1 then 'cheque' else 'neft' end)::payment_method, current_date - (abs(hashtext(pp.id::text)) % 120), 'PF${U}-R-' || pp.id || i, (case when abs(hashtext(pp.id::text || i)) % 5 = 0 then 'bounced' when abs(hashtext(pp.id::text || i)) % 4 = 0 then 'pending' else 'cleared' end), (case when i = 1 then 'x' else 'y' end) from payment_plans pp, generate_series(1, 2) i where pp.project_id = '${PB}'`,
  ]) { try { psql(sql.replace(", (case when i = 1 then 'x' else 'y' end) from", ' from').replace(", status) select pp.consumer_id", ", status) select pp.consumer_id")); } catch (e) { throw new Error('perf set-up: ' + (e.stderr || e.message).toString().slice(0, 300) + ' IN ' + sql.slice(0, 80)); } }
  const LB = rows(ledgerSql(`'${PB}'`)), custB = rows(`select consumer_id, unit_id from booking_records where project_id='${PB}' and status='complete'`);
  t(`perf: ${N} customers and ${LB.length} demands made`, custB.length === N && LB.length === N * 3, `${custB.length} ${LB.length}`);
  // the API counts the queries of a request when asked (X-Count-Queries: 1) and answers X-Db-Queries
  const timed = async (path) => { const t0 = Date.now(); const go = () => fetch(B + '/reports' + path, { headers: { authorization: 'Bearer ' + tokA, 'x-count-queries': '1' } }); const x = await go().catch(() => go());   /* a keep-alive socket the server just closed */ const j = await x.json().catch(() => null); return { x: { s: x.status, j }, ms: Date.now() - t0, tx: Number(x.headers.get('x-db-queries')) }; };
  const expDemanded = sum(LB.filter(x => x.raised), x => x.total), expPaid = sum(LB.filter(x => x.raised), x => x.paid), expRecv = Number(psql(`select coalesce(sum(amount_received_inr),0) from receipts r join consumers c on c.id=r.consumer_id where c.project_id='${PB}' and r.status='cleared' and r.is_advance is not true`));
  let q = await timed(`/customer-balance?projectId=${PB}&pageSize=5000`);
  t(`perf: customer-balance for ${N} customers answers in under 6 s (${q.ms} ms) with a handful of queries, not one per customer (${q.tx})`, q.x.s === 200 && q.ms < 6000 && q.tx <= 12, `${q.x.s} ${q.ms}ms ${q.tx} queries`);
  t('perf: its totals are right (received, balance, count)', q.x.j.summary.totalConsumers === N && near(q.x.j.summary.totalReceived, expRecv, 0.5) && near(q.x.j.summary.totalBalance, expDemanded - expRecv, 0.5), J(q.x.j.summary));
  t('perf: pageSize is capped (1 to 5000)', (await A('GET', `/reports/customer-balance?projectId=${PB}&pageSize=5001`)).s === 400 && q.x.j.data.length === N, '');
  q = await timed(`/customer-dues?projectId=${PB}&pageSize=5000`); t(`perf: customer-dues ${q.ms} ms, ${q.tx} queries`, q.x.s === 200 && q.ms < 6000 && q.tx <= 12 && near(q.x.j.summary.clear.total, expRecv, 0.5), `${q.x.s} ${q.ms} ${q.tx}`);
  t('perf: customer-dues outstanding total = demanded - paid on the demands', near(sum(q.x.j.data, x => x.outstanding_total), expDemanded - expPaid, 0.5), `${sum(q.x.j.data, x => x.outstanding_total)} vs ${expDemanded - expPaid}`);
  q = await timed(`/due-report?projectId=${PB}&pageSize=5000`); t(`perf: due-report ${q.ms} ms, ${q.tx} queries, ${q.x.j?.total} rows, totals`, q.x.s === 200 && q.ms < 6000 && q.tx <= 12 && q.x.j.total === N * 3 && near(q.x.j.summary.totalPaid, sum(LB, x => x.paid), 0.5), `${q.x.s} ${q.ms}`);
  for (const p of ['/project-wise-dues?groupBy=tower', '/ageing-project', '/ageing-summary-customer', '/ageing-tower', '/stage-wise-dues', '/percentage-wise-dues', '/month-wise-dues', '/customer-forecasting', '/applicant-payment-file?pageSize=500', '/summary-report', '/financial-dashboard', '/customer-due-summary', '/collection-pivot', '/customer-dues-detail', '/project-collection', '/receipt-wise-collection', '/year-month-collection']) {
    q = await timed(p + (p.includes('?') ? '&' : '?') + `projectId=${PB}`); t(`perf: ${p.split('?')[0]} ${N} customers: ${q.ms} ms, ${q.tx} queries`, q.x.s === 200 && q.ms < 8000 && q.tx <= 15, `${q.x.s} ${q.ms} ${q.tx}`);
  }
  q = await timed(`/project-wise-dues?projectId=${PB}&groupBy=project`); t('perf: project-wise-dues totals right at this size', near(q.x.j.totals.total_demanded_with_tax, expDemanded, 0.5) && near(q.x.j.totals.received_clear, expRecv, 0.5) && near(q.x.j.totals.outstanding_with_tax, expDemanded - expPaid, 0.5), J(q.x.j.totals).slice(0, 300));
  const od = odOf(LB); q = await timed(`/ageing-project?projectId=${PB}`); t('perf: ageing-project total overdue right at this size', near(q.x.j.totals.total_overdue, sum(od, d => d.bal), 0.5), `${q.x.j.totals.total_overdue} vs ${sum(od, d => d.bal)}`);
  extraSql.unshift(`delete from receipts where consumer_id in (select id from consumers where project_id='${PB}')`, `delete from demands where consumer_id in (select id from consumers where project_id='${PB}')`, `delete from payment_plans where project_id='${PB}'`, `delete from allocations where project_id='${PB}'`, `delete from booking_records where project_id='${PB}'`, `update consumers set allocated_unit_id = null where project_id='${PB}'`, `delete from consumers where project_id='${PB}'`, `delete from units where project_id='${PB}'`, `delete from plan_schedule_templates where project_id='${PB}'`);
}

// ===================================================================================================================
// done: clean up
// ===================================================================================================================
const ids = made.map(x => `'${x}'`).join(',');
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
for (const sql of [
  `delete from custom_reports where report_type = 'dues' and created_by_user_id in (select id from users)`,
  ...extraSql,
  `delete from audit_logs where resource_type in ('surrender','cancellation') and resource_id in (select id from surrender_applications where consumer_id in (${ids}) union select id from cancellations where consumer_id in (${ids}))`,
  `delete from surrender_applications where consumer_id in (${ids})`, `delete from cancellations where consumer_id in (${ids})`,
  `delete from audit_logs where resource_type = 'ownership_transfer' and resource_id in (select id from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids}))`,
  `delete from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids})`,
  `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
  `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from penal_interests where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
  `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
  `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
  `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  `delete from company_bank_accounts where id in ('${bank1}','${bank2}')`,
  ...[P1, P2, P3, ...PROJECT_CLEAN].flatMap(p => [`delete from plan_schedule_templates where project_id='${p}'`, `delete from gst_tax_charge_mapping where project_id='${p}'`, `delete from unit_status_history where unit_id in (select id from units where project_id='${p}')`, `delete from units where project_id='${p}'`, `delete from towers where project_id='${p}'`, `delete from projects where id='${p}'`]),
  `delete from companies where id='${co}'`,
]) { try { psql(sql); } catch (e) { if (process.env.DEBUG_CLEAN) console.log('CLEAN FAILED', sql.slice(0, 90), String(e.stderr || e).slice(0, 160)); /* leftovers are harmless, names carry the run id */ } }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
