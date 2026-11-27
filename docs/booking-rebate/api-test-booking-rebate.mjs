// Company rebate with approval (QA-007, owner decisions Q10 and Q11), checked against database values and the report API.
//  Q10: fixed Rs, Rs per sq. ft. or percent: exactly one, never added together; refused when negative, doubled up, or above the basic price.
//  Q11: a rebate starts "pending" and changes nothing until a DIFFERENT authorised user approves it; rejection keeps the reason; a change after
//       approval needs a new approval; the permission is enforced by the API; old rebates are not applied silently.
// Own project, units and applicants (new every run), own synthetic users, removed or deactivated at the end.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-booking-rebate.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const U = Date.now().toString(36).slice(-5), today = new Date().toISOString().slice(0, 10);
const A = call(await login('super_admin@test.local')), SE = call(await login('sales_executive@test.local')), PM = call(await login('project_manager@test.local')), RO = call(await login('read_only_viewer@test.local'));
const hash = psql(`select password_hash from users where email='super_admin@test.local'`);
const mkUser = (role, tag) => { const e = `rebate_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${e}','Rebate ${tag} ${U}','${role}','${hash}',true,'rebate_${tag}_${U}')`); return e; };
const checkerMail = mkUser('super_admin', 'chk'), financeMail = mkUser('accounts_finance', 'fin');
const C = call(await login(checkerMail)), F = call(await login(financeMail));
const uid = (e) => psql(`select id from users where email='${e}'`), adminId = uid('super_admin@test.local'), checkerId = uid(checkerMail), financeId = uid(financeMail);
const mustOk = async (label, p) => { const x = await p; if (x.s >= 300) { console.log(`FAIL setup: ${label} -> ${x.s} ${JSON.stringify(x.j).slice(0, 250)}`); fail++; cleanup(); console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(1); } return x.j.data ?? x.j; };
const cleanup = () => { try { psql(`delete from user_process_permissions where user_id in ('${financeId}','${checkerId}')`); psql(`update users set is_active=false where id in ('${checkerId}','${financeId}')`); psql(`delete from gst_tax_charge_mapping where gst_tax_id='${tax}'`); psql(`delete from gst_tax_setup where id='${tax}'`); if (madeSlab) psql(`delete from gst_slabs where id='${slab}'`); } catch (e) { console.log('cleanup problem: ' + e.message.slice(0, 120)); } };
let tax = '00000000-0000-0000-0000-000000000000', slab = tax, madeSlab = false;

// ---------- set-up: company, project, tower, plan 10/20/30/40, GST 2.5 + 2.5 ----------
const co = (await mustOk('company', A('POST', '/companies', { name: 'Rebate Co ' + U }))).id;
const proj = (await mustOk('project', A('POST', '/projects', { companyId: co, name: 'Rebate Project ' + U, reraNumber: 'RB-' + U, tcpLicence: 'x', totalUnits: 40, landAreaSqft: 50000 }))).id;
const tw = (await mustOk('tower', A('POST', `/projects/${proj}/towers`, { towerName: 'RB ' + U }))).id;
const planName = 'Rebate Plan ' + U;
for (const [i, p] of [10, 20, 30, 40].entries()) await mustOk('plan row', A('POST', `/projects/${proj}/plan-templates`, { plan_name: planName, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 }));
slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
madeSlab = !slab;
if (!slab) slab = (await mustOk('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: new Date(Date.now() - 864e5).toISOString().slice(0, 10), toDate: new Date(Date.now() + 864e5 * 5).toISOString().slice(0, 10) }))).id;
tax = (await mustOk('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: 'RB' + U, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await mustOk('mapping ' + ct, A('POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: tax, chargeType: ct }));

let seq = 0;
const newUnit = async () => (await mustOk('unit', A('POST', '/units', { projectId: proj, towerId: tw, unitNumber: `R${U}${++seq}`, floor: 2, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 }))).id;
const newApplicant = async (tag) => (await mustOk('applicant', A('POST', '/consumers', { name: `Rebate ${tag} ${U}${seq}`, mobile: '9' + String(Math.random()).slice(2, 11) }))).id;
const bookBody = (cons, unit, extra) => ({ consumer_id: cons, project_id: proj, unit_id: unit, selected_plan_name: planName, booking_date: today, booking_amount: 10000, payment_mode: 'cash', ...extra });
// a booking that is booked and confirmed (plan and demands exist), as who, with the given rebate boxes
const book = async (extra = {}, { complete = true, who = A } = {}) => {
  const unit = await newUnit(), cons = await newApplicant('B');
  const r = await who('POST', '/booking', bookBody(cons, unit, extra));
  if (r.s !== 201) return { r, cons, unit };
  const id = r.j.data.id;
  if (complete) await mustOk('confirm', A('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash' }));
  return { r, id, cons, unit };
};
const state = (b) => JSON.parse(psql(`select json_build_object('status',company_rebate_status,'approved',approved_rebate_amount,'by',rebate_requested_by,'decidedBy',rebate_decided_by,'reason',rebate_decision_reason,'booking',status,
  'plan',(select total_amount_inr from payment_plans where consumer_id='${b.cons}' order by created_at desc limit 1),
  'demands',(select json_agg(amount_due_inr order by installment_index) from demands where consumer_id='${b.cons}'),
  'cgst',(select json_agg(cgst_amount order by installment_index) from demands where consumer_id='${b.cons}'),
  'dstat',(select json_agg(status order by installment_index) from demands where consumer_id='${b.cons}')) from booking_records where id='${b.id}'`));
const reports = async (b) => {
  const bal = (await A('GET', `/reports/customer-balance?consumerId=${b.cons}`)).j.data[0], ds = (await A('GET', `/reports/customer-due-summary?consumerId=${b.cons}`)).j.data[0], ap = (await A('GET', `/reports/applicant-payment-file?consumerId=${b.cons}`)).j.data.find((x) => x.consumer_id === b.cons);
  return { balanceUnitCost: Number(bal.unit_cost), summaryNet: Number(ds.net_basic_price), fileNet: Number(ap.net_basic_price), summaryCost: Number(ds.total_unit_cost) };
};
const pctRows = [10, 20, 30, 40], rows = (total) => pctRows.map(p => Math.round(total * p / 100));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const auditCount = (id, who) => Number(psql(`select count(*) from audit_logs where resource_type='booking_rebate' and resource_id='${id}'${who ? ` and user_id='${who}'` : ''}`));

// ============ 1. Validation (Q10): one method, no negatives, not above the basic price ============
{
  const unit = await newUnit(), cons = await newApplicant('V');
  const tryIt = async (extra) => A('POST', '/booking', bookBody(cons, unit, extra));
  let r;
  for (const [n, x] of [['fixed + per sq. ft.', { company_rebate_rs: 1000, company_rebate_sqft: 10 }], ['fixed + percent', { company_rebate_rs: 1000, company_rebate_pct: 1 }], ['per sq. ft. + percent', { company_rebate_sqft: 10, company_rebate_pct: 1 }], ['all three', { company_rebate_rs: 1000, company_rebate_sqft: 10, company_rebate_pct: 1 }]]) {
    r = await tryIt(x); t(`two or more methods are refused (${n})`, r.s === 400 && /only one rebate method/i.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  }
  for (const [n, x] of [['fixed', { company_rebate_rs: -1 }], ['per sq. ft.', { company_rebate_sqft: -1 }], ['percent', { company_rebate_pct: -1 }]]) { r = await tryIt(x); t(`negative ${n} rebate is refused`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
  r = await tryIt({ company_rebate_rs: 'abc' }); t('a text rebate is refused', r.s === 400, r.s);
  r = await tryIt({ company_rebate_rs: 3000001 }); t('fixed rebate above the basic price (3,00,00,01 vs 30,00,000) is refused', r.s === 400 && /more than the basic price/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  r = await tryIt({ company_rebate_sqft: 6001 }); t('per sq. ft. rebate above the basic price (6001 x 500 = 30,00,500) is refused', r.s === 400 && /more than the basic price/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  r = await tryIt({ company_rebate_pct: 101 }); t('percentage above 100 is refused', r.s === 400, r.s);
  r = await tryIt({ company_rebate_rs: 1500000, company_inaugural_disc: 2000000 }); t('rebate plus inaugural discount above the basic price is refused', r.s === 400, r.s + ' ' + JSON.stringify(r.j));
  t('nothing was saved by the refused attempts', psql(`select count(*) from booking_records where unit_id='${unit}'`) === '0');
  r = await tryIt({ company_rebate_rs: 0, company_rebate_sqft: 0, company_rebate_pct: 0 });
  t('all three at zero means no rebate (booking accepted, status none)', r.s === 201 && psql(`select company_rebate_status||'|'||approved_rebate_amount from booking_records where id='${r.j?.data?.id}'`) === 'none|0.00', r.s + ' ' + JSON.stringify(r.j));
  r = await A('POST', '/booking', bookBody(await newApplicant('V2'), await newUnit(), {}));
  t('a booking with no rebate box at all is accepted with status none', r.s === 201 && r.j.data.company_rebate_status !== 'pending', r.s);
}

// ============ 2. Three methods: pending changes nothing, approval applies the exact amount ============
const METHODS = [
  { name: 'fixed Rs 1,00,000', extra: { company_rebate_rs: 100000 }, amount: 100000 },
  { name: 'Rs 120 per sq. ft. x 500 sq. ft.', extra: { company_rebate_sqft: 120 }, amount: 60000 },
  { name: '5% of the basic price', extra: { company_rebate_pct: 5 }, amount: 150000 },
];
const made = [];
for (const m of METHODS) {
  const b = await book(m.extra); const entry = { ...m, ...b }; made.push(entry);
  const s0 = state(b), r0 = await reports(b);
  t(`${m.name}: booking accepted, rebate is pending, nothing applied`, b.r.s === 201 && s0.status === 'pending' && Number(s0.approved) === 0 && s0.by === adminId, JSON.stringify(s0));
  t(`${m.name}: pending rebate leaves the plan total (30,00,000) and demands (${rows(3000000).join(', ')}) unchanged`, Number(s0.plan) === 3000000 && eq(s0.demands.map(Number), rows(3000000)), JSON.stringify(s0));
  t(`${m.name}: pending rebate changes no report (balance, due summary, applicant file all 30,00,000)`, r0.balanceUnitCost === 3000000 && r0.summaryNet === 3000000 && r0.fileNet === 3000000, JSON.stringify(r0));
  entry.cgstBefore = s0.cgst.map(Number);
}

// ============ 3. Who may approve ============
{
  const m = made[0];
  let r = await A('POST', `/booking/${m.id}/rebate/approve`, {});
  t('maker cannot approve their own rebate (super admin who entered it) -> 403', r.s === 403 && /yourself/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  r = await A('POST', `/booking/${m.id}/rebate/reject`, { reason: 'self' });
  t('maker cannot reject their own rebate either -> 403', r.s === 403, r.s);
  for (const [n, who] of [['sales executive', SE], ['project manager', PM], ['read-only viewer', RO], ['accounts finance without the permission', F]]) {
    r = await who('POST', `/booking/${m.id}/rebate/approve`, {});
    t(`${n} cannot approve -> 403`, r.s === 403, r.s + ' ' + JSON.stringify(r.j));
  }
  r = await call('')('POST', `/booking/${m.id}/rebate/approve`, {});
  t('no login -> 401', r.s === 401, r.s);
  const s = state(m);
  t('refused attempts changed nothing (still pending, plan unchanged)', s.status === 'pending' && Number(s.approved) === 0 && Number(s.plan) === 3000000, JSON.stringify(s));
}

// ============ 4. Approval by a different authorised user applies the net price everywhere ============
{
  psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker) values ('${financeId}','company_rebate',false,true)`);
  for (const [i, m] of made.entries()) {
    const approver = i === 0 ? F : C, approverId = i === 0 ? financeId : checkerId;        // the first one by a non-admin who holds only the checker permission
    const r = await approver('POST', `/booking/${m.id}/rebate/approve`, {});
    t(`${m.name}: a different authorised user approves -> 200${i === 0 ? ' (accounts finance holding the company_rebate checker permission)' : ''}`, r.s === 200 && r.j?.data?.company_rebate_status === 'approved', r.s + ' ' + JSON.stringify(r.j));
    const s = state(m), r1 = await reports(m), net = 3000000 - m.amount;
    t(`${m.name}: approved amount is exactly ${m.amount} and is stored with who approved it`, Number(s.approved) === m.amount && s.status === 'approved' && s.decidedBy === approverId, JSON.stringify(s));
    t(`${m.name}: plan total is now ${net}`, Number(s.plan) === net, JSON.stringify(s));
    t(`${m.name}: every demand is the plan percentage of the net price (${rows(net).join(', ')})`, eq(s.demands.map(Number), rows(net)), JSON.stringify(s.demands));
    t(`${m.name}: customer balance, due summary and applicant file all show net basic price ${net}`, r1.balanceUnitCost === net && r1.summaryNet === net && r1.fileNet === net && r1.summaryCost === net, JSON.stringify(r1));
    t(`${m.name}: GST on the demands is untouched (the GST basis is a separate open decision)`, eq(s.cgst.map(Number), m.cgstBefore), JSON.stringify([s.cgst, m.cgstBefore]));
    t(`${m.name}: the request and the approval are both in the audit trail`, auditCount(m.id, adminId) >= 1 && auditCount(m.id, approverId) >= 1, `${auditCount(m.id)} rows`);
    const again = await C('POST', `/booking/${m.id}/rebate/approve`, {});
    t(`${m.name}: approving again -> 409 (not waiting for a decision)`, again.s === 409, again.s);
  }
}

// ============ 5. Rejection keeps the reason and applies nothing ============
{
  const b = await book({ company_rebate_rs: 250000 });
  let r = await C('POST', `/booking/${b.id}/rebate/reject`, {});
  t('rejecting without a reason -> 400', r.s === 400, r.s + ' ' + JSON.stringify(r.j));
  r = await C('POST', `/booking/${b.id}/rebate/reject`, { reason: 'Not within the sales policy' });
  const s = state(b), r1 = await reports(b);
  t('rejection is saved with the reason and the user who decided', r.s === 200 && s.status === 'rejected' && s.reason === 'Not within the sales policy' && s.decidedBy === checkerId && Number(s.approved) === 0, r.s + ' ' + JSON.stringify(s));
  t('a rejected rebate leaves plan, demands and reports at the full price', Number(s.plan) === 3000000 && eq(s.demands.map(Number), rows(3000000)) && r1.balanceUnitCost === 3000000 && r1.summaryNet === 3000000, JSON.stringify([s, r1]));
  t('the rejection is in the audit trail with the reason', Number(psql(`select count(*) from audit_logs where resource_type='booking_rebate' and resource_id='${b.id}' and new_values::text like '%Not within the sales policy%'`)) === 1);
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('a rejected rebate cannot be approved without being sent again -> 409', r.s === 409, r.s);
  // sent again after a rejection (resubmit) and approved
  r = await A('PATCH', `/booking/${b.id}/edit`, { resubmit_rebate: true });
  t('the maker can send a rejected rebate for approval again', r.s === 200 && state(b).status === 'pending' && state(b).reason === null, r.s + ' ' + JSON.stringify(state(b)));
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('and it is applied after the new approval (30,00,000 - 2,50,000 = 27,50,000)', r.s === 200 && Number(state(b).plan) === 2750000, r.s + ' ' + JSON.stringify(state(b)));
}

// ============ 6. A change after approval needs a new approval ============
{
  const m = made[0];                                    // approved fixed 1,00,000
  let r = await A('PATCH', `/booking/${m.id}/edit`, { company_rebate_rs: 100000 });
  t('saving the same rebate again keeps the approval', r.s === 200 && state(m).status === 'approved' && Number(state(m).approved) === 100000, r.s + ' ' + JSON.stringify(state(m)));
  const auditBefore = auditCount(m.id);
  r = await A('PATCH', `/booking/${m.id}/edit`, { company_rebate_rs: 50000 });
  let s = state(m), r1 = await reports(m);
  t('changing the amount after approval sends it back to pending and removes it from the price', r.s === 200 && s.status === 'pending' && Number(s.approved) === 0 && s.decidedBy === null && Number(s.plan) === 3000000 && eq(s.demands.map(Number), rows(3000000)) && r1.balanceUnitCost === 3000000 && r1.summaryNet === 3000000, r.s + ' ' + JSON.stringify([s, r1]));
  t('the change is in the audit trail', auditCount(m.id) === auditBefore + 1);
  r = await A('POST', `/booking/${m.id}/rebate/approve`, {});
  t('the editor cannot approve the new amount either -> 403', r.s === 403, r.s);
  r = await C('POST', `/booking/${m.id}/rebate/approve`, {});
  s = state(m);
  t('fresh approval applies the new amount (30,00,000 - 50,000 = 29,50,000)', r.s === 200 && Number(s.approved) === 50000 && Number(s.plan) === 2950000 && eq(s.demands.map(Number), rows(2950000)), r.s + ' ' + JSON.stringify(s));
  r = await A('PATCH', `/booking/${m.id}/edit`, { company_rebate_rs: 0, company_rebate_pct: 2 });
  s = state(m);
  t('changing the method after approval also needs a new approval (fixed -> percent)', r.s === 200 && s.status === 'pending' && Number(s.approved) === 0 && Number(s.plan) === 3000000, r.s + ' ' + JSON.stringify(s));
  r = await A('PATCH', `/booking/${m.id}/edit`, { company_rebate_rs: 10, company_rebate_pct: 2 });
  t('editing into two methods at once is refused', r.s === 400 && /only one rebate method/i.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${m.id}/edit`, { company_rebate_pct: 0, company_rebate_rs: 0, company_rebate_sqft: 0 });
  s = state(m);
  t('clearing every box removes the rebate (status none, full price)', r.s === 200 && s.status === 'none' && Number(s.plan) === 3000000, r.s + ' ' + JSON.stringify(s));
  r = await C('POST', `/booking/${m.id}/rebate/approve`, {});
  t('nothing is left to approve -> 409', r.s === 409, r.s);
}

// ============ 7. Paid, sent or over-received demands block approval and withdrawal; nothing changes ============
{
  const b = await book({ company_rebate_rs: 90000 });
  const s0 = state(b);
  t('a confirmed booking has its first demand raised and the booking payment on it (the usual case the rebate must handle)', s0.dstat[0] === 'demanded' && Number(psql(`select count(*) from receipts where demand_id=(select id from demands where consumer_id='${b.cons}' and installment_index=1)`)) === 1, JSON.stringify(s0));
  psql(`update demands set sent_at=now(), delivery_status='sent' where consumer_id='${b.cons}' and installment_index=1`);
  let r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  let s = state(b);
  t('approval is refused when a demand letter was already sent to the customer -> 409, nothing changes', r.s === 409 && /already sent to the customer/.test(r.j?.error || '') && s.status === 'pending' && Number(s.plan) === 3000000 && eq(s.demands.map(Number), rows(3000000)), r.s + ' ' + JSON.stringify([r.j, s]));
  psql(`update demands set sent_at=null, delivery_status='queued' where consumer_id='${b.cons}' and installment_index=1`);
  psql(`update demands set status='paid' where consumer_id='${b.cons}' and installment_index=2`);
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  s = state(b);
  t('approval is refused when a demand is already paid -> 409, nothing changes', r.s === 409 && /already paid or closed/.test(r.j?.error || '') && s.status === 'pending' && Number(s.plan) === 3000000, r.s + ' ' + JSON.stringify([r.j, s]));
  psql(`update demands set status='pending' where consumer_id='${b.cons}' and installment_index=2`);
  psql(`update receipts set amount_received_inr=400000, status='cleared', approval_status='approved' where demand_id=(select id from demands where consumer_id='${b.cons}' and installment_index=1)`);
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('approval is refused when more money is received on a demand than its new amount (4,00,000 on a 2,91,000 demand)', r.s === 409 && /more money received/.test(r.j?.error || '') && state(b).status === 'pending', r.s + ' ' + JSON.stringify(r.j));
  psql(`update receipts set amount_received_inr=10000, status='pending' where demand_id=(select id from demands where consumer_id='${b.cons}' and installment_index=1)`);
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  s = state(b);
  t('with the demand raised (letter not sent) and the booking payment on it, approval works and re-prices it (2,91,000 first demand)', r.s === 200 && Number(s.plan) === 2910000 && eq(s.demands.map(Number), rows(2910000)) && s.dstat[0] === 'demanded', r.s + ' ' + JSON.stringify([r.j, s]));
  psql(`update demands set sent_at=now(), delivery_status='sent' where consumer_id='${b.cons}' and installment_index=1`);
  r = await A('PATCH', `/booking/${b.id}/edit`, { company_rebate_rs: 80000 });
  s = state(b);
  t('changing an approved rebate after the demand letter was sent is refused and the approval stays', r.s === 409 && s.status === 'approved' && Number(s.approved) === 90000 && Number(s.plan) === 2910000, r.s + ' ' + JSON.stringify([r.j, s]));
}

// ============ 8. Approved before the booking is confirmed: the plan is made from the net price ============
{
  const b = await book({ company_rebate_pct: 10 }, { complete: false });
  const r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('a rebate can be approved while the booking is not yet confirmed', r.s === 200 && psql(`select approved_rebate_amount from booking_records where id='${b.id}'`) === '300000.00', r.s + ' ' + JSON.stringify(r.j));
  await mustOk('confirm', A('PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
  const s = state(b), r1 = await reports(b);
  t('confirming afterwards makes the plan from the net price (30,00,000 - 3,00,000 = 27,00,000) and its demands', Number(s.plan) === 2700000 && eq(s.demands.map(Number), rows(2700000)) && r1.balanceUnitCost === 2700000 && r1.summaryNet === 2700000, JSON.stringify([s, r1]));
}

// ============ 9. Old rebates are not applied silently ============
{
  const b = await book({});
  psql(`update booking_records set company_rebate_rs=70000, company_rebate_status='legacy' where id='${b.id}'`);          // as migration 146 leaves a rebate typed before this change
  const s = state(b), r1 = await reports(b);
  t('a legacy rebate (typed before approval existed) changes no price', s.status === 'legacy' && Number(s.plan) === 3000000 && r1.balanceUnitCost === 3000000 && r1.summaryNet === 3000000, JSON.stringify([s, r1]));
  let r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('a legacy rebate cannot be approved as it stands -> 409', r.s === 409, r.s);
  r = await A('PATCH', `/booking/${b.id}/edit`, { resubmit_rebate: true });
  t('resubmitting a legacy rebate puts it through approval (pending)', r.s === 200 && state(b).status === 'pending', r.s + ' ' + JSON.stringify(state(b)));
  r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('and then it is applied (30,00,000 - 70,000)', r.s === 200 && Number(state(b).plan) === 2930000, r.s + ' ' + JSON.stringify(state(b)));
  t('database invariant: an amount is applied only on an approved rebate', psql(`select count(*) from booking_records where company_rebate_status<>'approved' and approved_rebate_amount<>0`) === '0');
  t('database invariant: every approved rebate has an approver and a different requester', psql(`select count(*) from booking_records where company_rebate_status='approved' and (rebate_decided_by is null or rebate_decided_by = rebate_requested_by)`) === '0');
}

// ============ 10. Cancelled booking ============
{
  const b = await book({ company_rebate_rs: 5000 }, { complete: false });
  await mustOk('cancel', A('POST', `/booking/${b.id}/cancel`, { reason: 'test' }));
  const r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('a cancelled booking cannot get a rebate approved -> 409', r.s === 409, r.s + ' ' + JSON.stringify(r.j));
}

// ============ 11. Approved rebate through transfer and surrender (database and reports) ============
const NET = 2900000;                                         // 30,00,000 - fixed rebate 1,00,000
const approved = async (extra = { company_rebate_rs: 100000 }) => { const b = await book(extra); const r = await C('POST', `/booking/${b.id}/rebate/approve`, {}); if (r.s !== 200) throw new Error('approve ' + JSON.stringify(r.j)); return b; };
const money = (b) => JSON.parse(psql(`select json_build_object('receipts',(select count(*)||'/'||coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${b.cons}'),'demands',(select coalesce(sum(amount_due_inr),0) from demands where consumer_id='${b.cons}'),'cgst',(select coalesce(sum(cgst_amount),0) from demands where consumer_id='${b.cons}'))`));
const asObj = (b) => JSON.parse(psql(`select row_to_json(x) from booking_records x where id='${b.id}'`));
const stripKeys = (o, keys) => { const c = { ...o }; for (const k of keys) delete c[k]; return c; };
{
  const b = await approved();
  const before = asObj(b), m0 = money(b), s0 = state(b);
  const nb = (await mustOk('buyer', A('POST', '/consumers', { name: `Rebate Buyer ${U}${++seq}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: proj }))).id;
  const r = await A('POST', '/transfers', { unitId: b.unit, oldConsumerId: b.cons, newConsumerId: nb });
  t('transfer: an applicant with an approved rebate can transfer the unit -> 201', r.s === 201, r.s + ' ' + JSON.stringify(r.j));
  const after = asObj(b), nbState = JSON.parse(psql(`select json_build_object('plan',(select total_amount_inr from payment_plans where consumer_id='${nb}' order by created_at desc limit 1),'demands',(select json_agg(amount_due_inr order by installment_index) from demands where consumer_id='${nb}'),'receipts',(select count(*)||'/'||coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${nb}'),'cgst',(select coalesce(sum(cgst_amount),0) from demands where consumer_id='${nb}')) from (select 1) q`));
  t('transfer: the booking now belongs to the buyer and the approved rebate (status, amount, approver) is exactly as it was', after.consumer_id === nb && eq(stripKeys(after, ['consumer_id', 'updated_at']), stripKeys(before, ['consumer_id', 'updated_at'])) && after.company_rebate_status === 'approved' && Number(after.approved_rebate_amount) === 100000, JSON.stringify([stripKeys(after, ['updated_at']).company_rebate_status, after.approved_rebate_amount]));
  t('transfer: plan total, demands, demand GST and receipts moved to the buyer unchanged (net 29,00,000)', Number(nbState.plan) === NET && eq(nbState.demands.map(Number), rows(NET)) && Number(nbState.cgst) === Number(m0.cgst) && nbState.receipts === m0.receipts, JSON.stringify([nbState, m0]));
  const rb = (await A('GET', `/reports/customer-balance?consumerId=${nb}`)).j.data, rs = (await A('GET', `/reports/customer-due-summary?consumerId=${nb}`)).j.data, rf = (await A('GET', `/reports/applicant-payment-file?consumerId=${nb}`)).j.data.find((x) => x.consumer_id === nb), old = (await A('GET', `/reports/customer-balance?consumerId=${b.cons}`)).j.data;
  t('transfer: balance, due summary and applicant file of the buyer all show net basic price 29,00,000; the seller no longer appears', rb.length === 1 && Number(rb[0].unit_cost) === NET && Number(rs[0].net_basic_price) === NET && Number(rf.net_basic_price) === NET && old.length === 0, JSON.stringify([rb.map((x) => x.unit_cost), rs.map((x) => x.net_basic_price), rf?.net_basic_price, old.length]));
  t('transfer: demanded total in the balance report (raised demands only: 2,90,000 + GST 15,000) equals the database', Math.abs(Number(rb[0].total_demanded) - Number(psql(`select coalesce(sum(amount_due_inr + cgst_amount + sgst_amount),0) from demands where consumer_id='${nb}' and status in ('demanded','raised','paid')`))) < 1 && Number(rb[0].total_demanded) === 290000 + 15000, JSON.stringify([rb[0].total_demanded, nbState]));
}
{
  const b = await approved({ company_rebate_rs: 100000, basic_price: 6000, carpet_area_sqft: 500 });       // priced by rate (6,000 x 500 = 30,00,000), the way the surrender screen reads it
  const al = psql(`select id from allocations where consumer_id='${b.cons}' and status not in ('cancelled','transferred') order by created_at desc limit 1`);
  const before = asObj(b), m0 = money(b);
  const det = (await A('GET', `/surrender/detail/${b.cons}`)).j.data;
  const fin = det.financials;
  t('surrender: the surrender screen shows net basic price and agreement value 29,00,000 (30,00,000 - approved rebate 1,00,000)', Number(fin.netBasicPrice) === NET && Number(fin.agreementValue) === NET, JSON.stringify(fin));
  t('surrender: the screen figure equals the plan total in the database', Number(fin.agreementValue) === Number(state(b).plan), JSON.stringify([fin.agreementValue, state(b).plan]));
  const r = await A('POST', '/surrender', { consumerId: b.cons, allocationId: al, bookingId: b.id, unitId: b.unit, projectId: proj, type: 'surrender', surrenderDate: today });
  t('surrender: an applicant with an approved rebate can surrender -> 201', r.s === 201, r.s + ' ' + JSON.stringify(r.j));
  const sid = r.j?.data?.id ?? r.j?.data?.surrenderId;
  const mid = asObj(b);
  t('surrender: the booking is cancelled and the rebate record (status, amount, approver) is untouched', mid.status === 'cancelled' && eq(stripKeys(mid, ['status', 'updated_at']), stripKeys(before, ['status', 'updated_at'])), JSON.stringify([mid.status, mid.company_rebate_status, mid.approved_rebate_amount]));
  t('surrender: receipts and demands are kept as they were (no money record deleted or changed)', eq(money(b), m0), JSON.stringify([money(b), m0]));
  t('surrender: the surrendered applicant is not a customer in the balance report', (await A('GET', `/reports/customer-balance?consumerId=${b.cons}`)).j.data.length === 0);
  const rr = await A('POST', '/surrender/restore', { surrenderId: sid, type: 'surrender', consumerId: b.cons, allocationId: al, unitId: b.unit, bookingId: b.id });
  t('surrender: restore -> 200', rr.s === 200, rr.s + ' ' + JSON.stringify(rr.j));
  const end = asObj(b), s1 = state(b), r1 = await reports(b);
  t('surrender: after restore the rebate is still approved (1,00,000) and the booking is live again', end.status !== 'cancelled' && end.company_rebate_status === 'approved' && Number(end.approved_rebate_amount) === 100000, JSON.stringify([end.status, end.company_rebate_status]));
  t('surrender: after restore the plan total and demands are net (29,00,000) and the reports reconcile', Number(s1.plan) === NET && eq(s1.demands.map(Number), rows(NET)) && r1.balanceUnitCost === NET && r1.summaryNet === NET && r1.fileNet === NET, JSON.stringify([s1, r1]));
}

// ============ 12. First-demand repricing with a booking payment: receipts and allocations stay as they are ============
const dump = (b) => JSON.parse(psql(`select json_build_object(
  'receipts',(select json_agg(row_to_json(r) order by r.created_at, r.id) from receipts r where r.consumer_id='${b.cons}'),
  'allocations',(select json_agg(row_to_json(a) order by a.id) from allocations a where a.consumer_id='${b.cons}'),
  'plan',(select row_to_json(p) from payment_plans p where p.consumer_id='${b.cons}' order by p.created_at desc limit 1),
  'demands',(select json_agg(row_to_json(d) order by d.installment_index) from demands d where d.consumer_id='${b.cons}'),
  'addons',(select json_agg(row_to_json(c) order by c.id) from consumer_addon_charges c where c.consumer_id='${b.cons}'),
  'booking',(select row_to_json(x) from booking_records x where x.id='${b.id}'),
  'audit',(select count(*) from audit_logs where resource_id='${b.id}'),
  'unit',(select row_to_json(u) from units u where u.id='${b.unit}')) from (select 1) q`));
{
  const b = await book({ company_rebate_rs: 90000 });
  const rc = await A('POST', '/payments/receipts', { consumerId: b.cons, bookingId: b.id, amountReceivedInr: 100000, paymentMode: 'neft', referenceNumber: 'RB' + U + 'x1', paymentDate: today });
  t('first-demand: a 1,00,000 receipt is recorded on top of the 10,000 booking payment', rc.s === 201, rc.s + ' ' + JSON.stringify(rc.j));
  const rid = rc.j?.data?.id;
  await C('PATCH', `/payments/receipts/${rid}/approve`, {}); await C('PATCH', `/payments/receipts/${rid}/deposit`, { deposit_date: today }); const cl = await C('PATCH', `/payments/receipts/${rid}/clear`, { clearing_date: today });
  t('first-demand: that receipt is approved, deposited and cleared', cl.s === 200, cl.s + ' ' + JSON.stringify(cl.j).slice(0, 160));
  const d0 = dump(b), s0 = state(b), r0 = await reports(b);
  const onFirst = Number(psql(`select coalesce(sum(amount_received_inr),0) from receipts where demand_id=(select id from demands where consumer_id='${b.cons}' and installment_index=1) and status not in ('cancelled','bounced')`));
  t('first-demand: before the approval the first demand is raised, unsent, part covered by cleared money (partial) (3,00,000 demand, ' + onFirst + ' received)', s0.dstat[0] === 'partial' && onFirst > 0 && onFirst <= 300000, JSON.stringify([s0, onFirst]));
  const r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  const d1 = dump(b), s1 = state(b), r1 = await reports(b), net = 3000000 - 90000;
  t('first-demand: approval succeeds (letter not sent, not paid, received money below the new amount)', r.s === 200 && Number(s1.plan) === net && eq(s1.demands.map(Number), rows(net)), r.s + ' ' + JSON.stringify([r.j, s1]));
  t('first-demand: receipts are byte-for-byte the same rows (amounts, status, demand link, GST, dates, numbers)', eq(d1.receipts, d0.receipts) && d1.receipts.length >= 2, JSON.stringify([d0.receipts.length, d1.receipts.length]));
  t('first-demand: allocations are byte-for-byte the same rows', eq(d1.allocations, d0.allocations));
  t('first-demand: of the demand rows only the amount (and its updated_at) changed; status, GST, dates, delivery are as they were', eq(d1.demands.map((x) => stripKeys(x, ['amount_due_inr', 'updated_at'])), d0.demands.map((x) => stripKeys(x, ['amount_due_inr', 'updated_at']))));
  t('first-demand: of the plan row only the total (and updated_at) changed', eq(stripKeys(d1.plan, ['total_amount_inr', 'updated_at']), stripKeys(d0.plan, ['total_amount_inr', 'updated_at'])));
  t('first-demand: the unit is untouched', eq(d1.unit, d0.unit));
  t('first-demand: money received is the same in the reports and the balance moves only by the lower demand (reconciled)', r1.balanceUnitCost === net && Number(r1.summaryCost) === net && r1.summaryNet === net, JSON.stringify([r0, r1]));
}

// ============ 13. Every refused (409) approval leaves booking, demands, receipts, add-ons, audit history and totals unchanged ============
const frozen = async (label, b, expectText, setup, undo) => {
  if (setup) setup();
  const d0 = dump(b), rp0 = JSON.stringify([(await A('GET', `/reports/customer-balance?consumerId=${b.cons}`)).j.data, (await A('GET', `/reports/customer-due-summary?consumerId=${b.cons}`)).j.data]);
  const r = await C('POST', `/booking/${b.id}/rebate/approve`, {});
  const d1 = dump(b), rp1 = JSON.stringify([(await A('GET', `/reports/customer-balance?consumerId=${b.cons}`)).j.data, (await A('GET', `/reports/customer-due-summary?consumerId=${b.cons}`)).j.data]);
  t(`409 ${label}: refused with the reason`, r.s === 409 && expectText.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
  t(`409 ${label}: booking row, plan, demands, receipts, allocations, add-ons, unit and audit history are unchanged`, eq(d1, d0), Object.keys(d0).filter((k) => !eq(d0[k], d1[k])).join(','));
  t(`409 ${label}: balance and due summary totals are unchanged`, rp1 === rp0);
  t(`409 ${label}: the rebate is still pending and nothing is applied`, d1.booking.company_rebate_status === 'pending' && Number(d1.booking.approved_rebate_amount) === 0 && Number(d1.plan.total_amount_inr) === 3000000);
  if (undo) undo();
};
{
  let b = await book({ company_rebate_rs: 90000 });
  await frozen('letter already sent', b, /already sent to the customer/, () => psql(`update demands set sent_at=now(), delivery_status='sent' where consumer_id='${b.cons}' and installment_index=1`));
  b = await book({ company_rebate_rs: 90000 });
  await frozen('demand already paid', b, /already paid or closed/, () => psql(`update demands set status='paid' where consumer_id='${b.cons}' and installment_index=2`));
  b = await book({ company_rebate_rs: 90000 });
  await frozen('money received above the new amount', b, /more money received/, () => psql(`update receipts set amount_received_inr=400000, status='cleared', approval_status='approved' where demand_id=(select id from demands where consumer_id='${b.cons}' and installment_index=1)`));
  // withdrawal of an approved rebate refused: nothing changes
  const w = await book({ company_rebate_rs: 90000 }); await C('POST', `/booking/${w.id}/rebate/approve`, {});
  psql(`update demands set sent_at=now(), delivery_status='sent' where consumer_id='${w.cons}' and installment_index=1`);
  const w0 = dump(w), wr0 = JSON.stringify((await A('GET', `/reports/customer-balance?consumerId=${w.cons}`)).j.data);
  const wr = await A('PATCH', `/booking/${w.id}/edit`, { company_rebate_rs: 80000 });
  t('409 withdrawal after the letter was sent: refused', wr.s === 409 && /already sent to the customer/.test(wr.j?.error || ''), wr.s + ' ' + JSON.stringify(wr.j));
  t('409 withdrawal: everything (booking, demands, receipts, audit history, totals) is unchanged and the approval stands', eq(dump(w), w0) && JSON.stringify((await A('GET', `/reports/customer-balance?consumerId=${w.cons}`)).j.data) === wr0 && w0.booking.company_rebate_status === 'approved');
  // a self-approval (403) and a double approval (409) also change nothing
  const x = await book({ company_rebate_rs: 90000 }); const x0 = dump(x);
  const selfTry = await A('POST', `/booking/${x.id}/rebate/approve`, {}); await C('POST', `/booking/${x.id}/rebate/reject`, { reason: 'not within policy' });
  t('self-approval is refused (403)', selfTry.s === 403, selfTry.s);
  const xd = dump(x);
  t('self-approval (403) changes nothing, then one valid rejection leaves demands and money untouched', Number(xd.booking.approved_rebate_amount) === 0 && xd.booking.company_rebate_status === 'rejected' && eq(xd.demands, x0.demands) && eq(xd.receipts, x0.receipts), JSON.stringify([xd.booking.company_rebate_status, xd.booking.approved_rebate_amount, eq(xd.demands, x0.demands), eq(xd.receipts, x0.receipts)]));
  // an add-on charge worked out "after discount" blocks approval until it is separately corrected
  const co2 = (await mustOk('company', A('POST', '/companies', { name: 'Rebate Co2 ' + U }))).id, p2 = (await mustOk('project', A('POST', '/projects', { companyId: co2, name: 'Rebate Project 2 ' + U, reraNumber: 'RB2-' + U, tcpLicence: 'x', totalUnits: 10, landAreaSqft: 20000 }))).id;
  const tw2 = (await mustOk('tower', A('POST', `/projects/${p2}/towers`, { towerName: 'RB2 ' + U }))).id;
  for (const [i, pc] of [10, 20, 30, 40].entries()) await mustOk('plan row', A('POST', `/projects/${p2}/plan-templates`, { plan_name: planName, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i + 1 }));
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await mustOk('mapping', A('POST', '/gst-configuration/gst-charge-mapping', { projectId: p2, slabId: slab, gstTaxId: tax, chargeType: ct }));
  const addon = await mustOk('addon master', A('POST', '/addon-charges/master', { projectId: p2, chargeName: 'Club ' + U, rateType: 'percent', percentValue: 2, percentBasis: 'after_discount', cgstPct: 9, sgstPct: 9, isMandatory: true }));
  const u2 = (await mustOk('unit', A('POST', '/units', { projectId: p2, towerId: tw2, unitNumber: `R2${U}`, floor: 2, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 }))).id;
  const c2 = (await mustOk('applicant', A('POST', '/consumers', { name: `Rebate AddOn ${U}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: p2 }))).id;
  const bk2 = await mustOk('booking', A('POST', '/booking', { consumer_id: c2, project_id: p2, unit_id: u2, selected_plan_name: planName, booking_date: today, booking_amount: 10000, payment_mode: 'cash', company_rebate_rs: 90000 }));
  await mustOk('confirm', A('PATCH', `/booking/${bk2.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
  const b2 = { id: bk2.id, cons: c2, unit: u2 };
  t('add-on: the booking has an add-on charge worked out after discount (made at confirmation)', Number(psql(`select count(*) from consumer_addon_charges cac join addon_charge_master acm on acm.id=cac.charge_master_id where cac.consumer_id='${c2}' and acm.percent_basis='after_discount'`)) === 1);
  const a0 = dump(b2), ar0 = JSON.stringify((await A('GET', `/reports/customer-balance?consumerId=${c2}`)).j.data);
  const ar = await C('POST', `/booking/${b2.id}/rebate/approve`, {});
  t('add-on: approval is refused (409) and the message says to correct the add-on charge first', ar.s === 409 && /add-on charge worked out "after discount"/.test(ar.j?.error || ''), ar.s + ' ' + JSON.stringify(ar.j));
  t('add-on: the existing add-on charge, demands, plan, receipts, audit history and totals are not touched, nothing recreated', eq(dump(b2), a0) && JSON.stringify((await A('GET', `/reports/customer-balance?consumerId=${c2}`)).j.data) === ar0, Object.keys(a0).filter((k) => !eq(a0[k], dump(b2)[k])).join(','));
}

cleanup();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
