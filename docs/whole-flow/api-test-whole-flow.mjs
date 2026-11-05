// Whole-flow chaos test. Nothing here is copied from the module tests: a fresh project is built, then many applicants are walked
// through the whole life (booking -> demands -> receipts -> transfer / surrender / restore / allocation cancel / shift) in a RANDOM order,
// with a random mix of: every field filled (valid), only the needed fields, some fields left out, and some fields set to junk
// (wrong type, huge, negative, SQL, script, unicode, other people's ids). Bursts fire several actions at the same applicant at once.
// After every few steps the database is checked for contradictions (two owners of a unit, a unit "available" while sold, a cancelled
// applicant that still has live demands, duplicate receipt numbers ...). The server must never answer 5xx.
// Repeat a run:  SEED=123 BASE=http://localhost:3010/api node api-test-whole-flow.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
const SEED = Number(process.env.SEED || Date.now() % 1e9), STEPS = Number(process.env.STEPS || 260), PEOPLE = Number(process.env.PEOPLE || 16);
let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)], chance = (p) => rnd() < p;
console.log('SEED=' + SEED);
let pass = 0, fail = 0; const bad5 = [];
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const NIL = '00000000-0000-0000-0000-000000000000', U = Date.now().toString(36).slice(-4) + ri(0, 99);
const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
let last = ''; const tally = {};
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} { const k = `${m} ${p.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id')} ${r.status}${r.status >= 300 ? ' ' + String(j?.error || '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').slice(0, 70) : ''}`; tally[k] = (tally[k] || 0) + 1; }
  if (r.status >= 500) bad5.push(`${m} ${p} ${r.status} ${JSON.stringify(j).slice(0, 160)} <= ${JSON.stringify(b ?? '').slice(0, 300)} (step: ${last})`); return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const one = (sql) => psql(sql).split('\n')[0];

// ---------- value makers ----------
const WORDS = ['Asha', 'Ravi', "O'Neil", 'Zoë', 'Müller', '李雷', 'Kumar-Singh', 'A', 'Dr. Who', 'नमस्ते', 'Ünal', 'Bob  Marley', 'N/A', 'test@x', 'a&b', '<b>x</b>'];
const JUNK = () => pick(['', ' ', null, 'abc', -1, 0, 0.001, 1e21, 99999999999999, '1e3', '١٢٣', [], {}, [1, 2], true, false, "'; drop table units;--", '<script>alert(1)</script>', 'x'.repeat(3000), '0000-00-00', '2026-02-30', '2999-01-01', '1900-01-01', NIL, '../../etc/passwd', '{{7*7}}', '%00', '\u0000', 'NaN', 'Infinity', '9'.repeat(40)]);
const money = () => pick([ri(1, 500), ri(1000, 90000), ri(100000, 3000000), Math.round(rnd() * 1e7) / 100, ri(1, 99) / 100, String(ri(500, 9000)), 1e9]);
const dayv = () => later(ri(-400, 400)), pastv = () => later(-ri(0, 300));
const mobv = () => '9' + String(ri(0, 999999999)).padStart(9, '0');
const GEN = {
  s: () => pick(WORDS) + ' ' + ri(0, 999), m: money, d: dayv, p: pastv, mob: mobv, pct: () => pick([0, 1, 2.5, 5, 12, 18, 33.33, 100]), b: () => pick([true, false, 'true', 'false']),
  mode: () => pick(['cash', 'cheque', 'neft', 'rtgs', 'upi', 'bank_transfer', 'demand_draft', 'online', 'neft_rtgs', 'draft', 'card', 'wire']), email: () => `u${ri(1, 9999)}@mail.test`, pan: () => 'ABCDE' + ri(1000, 9999) + 'F', aad: () => String(ri(2, 9)) + String(ri(0, 99999999999)).padStart(11, '0'),
  pin: () => String(ri(100000, 999999)), n: () => ri(0, 5), id: () => NIL,
  ttype: () => pick(['Individual', 'Multiple', 'Company']), stype: () => pick(['voluntary', 'refund_case', 'non_refund', 'partial_refund', 'builder_cancellation']), sty: () => pick(['surrender', 'cancellation']),
  gst: () => { const b = '27' + 'ABCDE' + ri(1000, 9999) + 'F' + ri(1, 9) + 'Z', C = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let sum = 0; [...b].forEach((ch, i) => { const v = C.indexOf(ch) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); }); return b + C[(36 - (sum % 36)) % 36]; },
};
// spec: { field: type }.  p.omit = chance a field is left out; p.junk = chance that ONE random field of the payload is set to junk
// (junk on every field would make nearly every request fail and the flow would never move on)
const fuzz = (spec, base = {}, p = { omit: 0.3, junk: 0.3 }) => { const o = { ...base }; for (const [k, ty] of Object.entries(spec)) { if (k in base || rnd() < p.omit) continue; o[k] = GEN[ty](); } const ks = Object.keys(o); if (ks.length && rnd() < p.junk) o[pick(ks)] = JUNK(); return o; };
const full = (spec, base = {}) => fuzz(spec, base, { omit: 0, junk: 0 }), sparse = (spec, base = {}) => fuzz(spec, base, { omit: 0.85, junk: 0 });
const style = (spec, base = {}) => { const r = rnd(); return r < 0.35 ? full(spec, base) : r < 0.55 ? sparse(spec, base) : r < 0.9 ? fuzz(spec, base) : fuzz(spec, base, { omit: 0.1, junk: 1 }); };
const corruptBase = (b) => { if (!chance(0.07)) return b; const k = pick(Object.keys(b)); const o = { ...b }; if (chance(0.5)) delete o[k]; else o[k] = JUNK(); return o; };

const SPEC = {
  consumerEdit: { first_name: 's', last_name: 's', middle_name: 's', salutation: 's', dob: 'p', gender: 's', profession: 's', nationality: 's', annual_income: 'm', education: 's', company: 's', alt_mobile: 'mob', email: 'email', email_2: 'email', pan_no: 'pan', aadhaar_no: 'aad', father_name: 's', anniversary_date: 'p', marital_status: 's', no_of_children: 'n', designation: 's', phone_no: 'mob', mobile: 'mob', source_of_enquiry: 's', referred_by: 's', income_category: 's', lead_stage: 's', has_poa: 'b', poa_details: 's' },
  booking: { booking_date: 'd', booking_amount: 'm', payment_mode: 'mode', payment_ref: 's', bank_name: 's', cheque_date: 'd', company_inaugural_disc: 'm', company_rebate_rs: 'm', company_rebate_sqft: 'm', company_rebate_pct: 'pct', broker_commission: 'm', broker_commission_type: 's', booking_type: 's', broker_rebate_rs: 'm', broker_rebate_pct: 'pct', mailing_address_type: 's', communication_mode: 's', comm_address_line1: 's', comm_pin: 'pin', comm_city: 's', comm_state: 's', comm_country: 's', nominee_name: 's', nominee_relation: 's', loan_amount: 'm', finance_bank: 's', remarks: 's', form_no: 's', has_plc: 'b', plc_amount: 'm', has_other_charge: 'b', other_charge_amount: 'm', other_charge_desc: 's', bank_branch: 's', received_for: 's', account_holder: 's', on_account_of: 's', invoice_date_by: 's', interest_type: 's', extra_add_on_type: 's', tds_type: 's', self_or_loan: 's', interest_amount: 'm', dealer_adjustment_amount: 'm', s_tax_pct: 'pct', gst_interest_pct: 'pct', tds_amount: 'm', basic_price: 'm', carpet_area_sqft: 'm' },
  confirm: { booking_amount: 'm', payment_mode: 'mode', payment_ref: 's', bank_name: 's', bank_branch: 's', cheque_date: 'd', received_for: 's', account_holder: 's', on_account_of: 's', invoice_date_by: 's', interest_type: 's', extra_add_on_type: 's', tds_type: 's', self_or_loan: 's', interest_amount: 'm', dealer_adjustment_amount: 'm', s_tax_pct: 'pct', gst_interest_pct: 'pct', tds_amount: 'm' },
  receipt: { amountReceivedInr: 'm', paymentMode: 'mode', paymentMethod: 'mode', referenceNumber: 's', transactionRef: 's', paymentDate: 'p', receivedDate: 'p', chequeNo: 's', cheque_no: 's', chequeDate: 'd', cheque_date: 'd', bankName: 's', branch: 's', remarks: 's', installmentIndex: 'n', isAdjustment: 'b', isOtherPayment: 'b', baseAmount: 'm' },
  transfer: { transferNo: 's', transferDate: 'p', applicationDate: 'p', transferFee: 'm', adminCharges: 'm', transferAmountInr: 'm', transferType: 'ttype', basicPrice: 'm', cgstAmount: 'm', sgstAmount: 'm', igstAmount: 'm', ugstAmount: 'm', staxAmount: 'm', gstin: 'gst', brokerCompany: 's', mainBroker: 's', salesPersonName: 's', transferReceiptNo: 's', remarks: 's' },
  surrender: { type: 'sty', surrenderDate: 'p', surrenderType: 'stype', refundMode: 'mode', forfeitureAmount: 'm', refundAmount: 'm', penaltyBaseAmount: 'm', penaltyGstAmount: 'm', penaltyTotalAmount: 'm', extraAddonCharges: 'm', premiumAmount: 'm', totalAmount: 'm', gstIncluded: 'b', serviceTaxIncluded: 'b', vatIncluded: 'b', interestIncluded: 'b', bankNoc: 'b', brokerNoc: 'b', reason: 's', remark: 's' },
  clear: { clearing_date: 'p', deposit_date: 'p', clearing_bank_id: 'id' },
  alloc: { allotmentDate: 'p', remarks: 's' },
};

// ---------- set-up: a project of our own ----------
const must = async (l, p) => { const x = await p; if (x.s >= 300) { console.log('FAIL setup ' + l + ' ' + x.s + JSON.stringify(x.j).slice(0, 300)); process.exit(1); } return x.j.data ?? x.j; };
const co = (await must('co', A('POST', '/companies', { name: 'WF Co ' + U }))).id;
const mkProj = async (n) => (await must('proj', A('POST', '/projects', { companyId: co, name: `WF ${n} ${U}`, reraNumber: `WF${n}-${U}`, tcpLicence: 'x' }))).id;
const PR = [await mkProj('A'), await mkProj('B')], TW = [];
for (const P of PR) TW.push((await must('tw', A('POST', `/projects/${P}/towers`, { towerName: 'W' + U }))).id);
const plans = [];
for (const [i, rows] of [[0, [20, 30, 50]], [1, [100]], [2, [10, 15, 25, 50]]]) { let k = 0; for (const pc of rows) await must('plan', A('POST', `/projects/${PR[0]}/plan-templates`, { plan_name: `WP${i} ${U}`, installment_name: `R${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * ri(10, 45), installment_index: k })); plans.push(`WP${i} ${U}`); }
{ let k = 0; for (const pc of [50, 50]) await must('planB', A('POST', `/projects/${PR[1]}/plan-templates`, { plan_name: `WB0 ${U}`, installment_name: `R${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k })); }
const planOf = (pi) => pi === 0 ? pick(plans) : `WB0 ${U}`;
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(x => x.from_date <= today && x.to_date >= today)?.id;
const madeSlab = !slab; if (!slab) slab = (await must('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
const taxId = (await must('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `WF ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
for (const P of PR) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
let un = 0;
const newUnit = async (pi = 0) => (await must('unit', A('POST', '/units', { projectId: PR[pi], towerId: TW[pi], unitNumber: `W${++un}${pick(['a', 'B', ''])}-${U}`, floor: ri(0, 30), bhkType: pick(['1BHK', '2BHK', '3BHK']), carpetAreaSqft: ri(300, 1800), superAreaSqft: ri(1900, 2500), basePriceInr: ri(30, 200) * 100000, totalPriceInr: ri(210, 300) * 100000 }))).id;
const IN = `'${PR[0]}','${PR[1]}'`;
let mobSeq = 0; const uniqMob = () => '9' + String((Date.now() % 1e7) * 100 + (++mobSeq) + 500000000).slice(-9).padStart(9, '0');
const people = [];   // every applicant made
const newPerson = async (pi = 0) => {
  const b = style({ name: 's', income_category: 's', lead_stage: 's' }, { mobile: uniqMob(), project_id: PR[pi] });
  let x = await A('POST', '/consumers', corruptBase(b)); if (x.s >= 300) x = await A('POST', '/consumers', { name: 'WF ' + ri(0, 9999), mobile: uniqMob(), project_id: PR[pi] });
  const id = x.j?.data?.id; if (id) people.push({ id, pi }); return id;
};

// ---------- invariants ----------
const INV = [
  ['a unit has two live allocations', `select count(*) from (select a.unit_id from allocations a join units u on u.id=a.unit_id where u.project_id in (${IN}) and a.status not in ('cancelled','transferred') group by 1 having count(*)>1) x`],
  ['two applicants point at the same unit', `select count(*) from (select allocated_unit_id from consumers where project_id in (${IN}) and allocated_unit_id is not null group by 1 having count(*)>1) x`],
  ['applicant points at a unit they do not hold', `select count(*) from consumers c where c.project_id in (${IN}) and c.allocated_unit_id is not null and not exists (select 1 from allocations a where a.consumer_id=c.id and a.unit_id=c.allocated_unit_id and a.status not in ('cancelled','transferred'))`],
  ['a live allocation on a unit shown available', `select count(*) from allocations a join units u on u.id=a.unit_id where u.project_id in (${IN}) and a.status not in ('cancelled','transferred') and u.status='available'`],
  ['a unit shown booked/allotted with nobody holding it', `select count(*) from units u where u.project_id in (${IN}) and u.status in ('booked','allotted') and not exists (select 1 from allocations a where a.unit_id=u.id and a.status not in ('cancelled','transferred'))`],
  ['a cancelled applicant still holds a unit', `select count(*) from consumers c where c.project_id in (${IN}) and c.lead_stage='cancelled' and (c.allocated_unit_id is not null or exists (select 1 from allocations a where a.consumer_id=c.id and a.status not in ('cancelled','transferred')))`],
  ['a cancelled applicant still has live demands', `select count(*) from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) and c.lead_stage='cancelled' and d.status in ('pending','demanded','raised')`],
  ['a cancelled demand of a live applicant still looks raised (a surrender keeps raised_by as history, un-raise clears it)', `select count(*) from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) and d.status='cancelled' and d.raised_by is not null and c.lead_stage<>'cancelled' and not exists (select 1 from cancellations x where x.consumer_id=d.consumer_id) and not exists (select 1 from surrender_applications x where x.consumer_id=d.consumer_id)`],
  ['duplicate receipt numbers', `select count(*) from (select receipt_number from receipts r join consumers c on c.id=r.consumer_id where c.project_id in (${IN}) and receipt_number is not null group by 1 having count(*)>1) x`],
  ['a receipt with no money or an unknown status', `select count(*) from receipts r join consumers c on c.id=r.consumer_id where c.project_id in (${IN}) and (r.amount_received_inr<=0 or r.status not in ('pending','authorized','deposited','cleared','on_hold','bounced','cancelled'))`],
  ['two completed bookings for one unit', `select count(*) from (select unit_id from booking_records where project_id in (${IN}) and status='complete' group by 1 having count(*)>1) x`],
  ['a paid demand with no cleared money for that applicant', `select count(*) from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) and d.status='paid' and not exists (select 1 from receipts r where r.consumer_id=d.consumer_id and r.status='cleared')`],
  ['a surrender that gives back more than was cleared', `select count(*) from surrender_applications s where s.project_id in (${IN}) and s.forfeiture_amount_inr + s.refund_amount_inr > coalesce((select sum(amount_received_inr) from receipts r where r.consumer_id=s.consumer_id and r.status='cleared'),0)+1 and s.status<>'restored'`],
  ['negative money on a demand', `select count(*) from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) and (d.amount_due_inr<0 or d.cgst_amount<0 or d.sgst_amount<0)`],
  ['the same unit number twice in one project', `select count(*) from (select project_id, unit_number from units where project_id in (${IN}) group by 1,2 having count(*)>1) x`],
];
const checkInv = (tag) => { for (const [n, q] of INV) { let v; try { v = Number(one(q)); } catch (e) { v = 'query error ' + String(e.message).slice(0, 120); } if (v !== 0) t(`invariant after ${tag}: ${n}`, false, 'count=' + v); } };

// ---------- actions (each picks a random target and a random style of payload) ----------
const idsOf = (sql) => psql(sql).split('\n').filter(Boolean);
const mine = () => pick(people)?.id;
const holder = () => idsOf(`select c.id from consumers c where c.project_id in (${IN}) and c.allocated_unit_id is not null order by random() limit 1`)[0] || mine();
const myUnit = () => one(`select id from units where project_id in (${IN}) order by random() limit 1`) || NIL;
const myAlloc = (c, any = false) => one(`select id from allocations where consumer_id='${c}' ${any ? '' : "and status not in ('cancelled','transferred')"} order by random() limit 1`) || (chance(0.3) ? NIL : 'x');
const myReceipt = (c) => one(`select id from receipts where consumer_id='${c}' order by random() limit 1`) || NIL;
const anyAlloc = () => one(`select a.id from allocations a join units u on u.id=a.unit_id where u.project_id in (${IN}) order by random() limit 1`) || NIL;
const maybeWrong = (id, p = 0.12) => chance(p) ? pick([NIL, myUnit(), mine(), 'abc', null, JUNK()]) : id;

const ACTIONS = {
  async book() {
    const pi = chance(0.85) ? 0 : 1, c = chance(0.9) ? await newPerson(pi) : mine(), u = await newUnit(pi); if (!c) return;
    if (chance(0.5)) await A('PATCH', `/consumers/${c}`, style(SPEC.consumerEdit));
    const base = { consumer_id: c, unit_id: u, project_id: chance(0.8) ? PR[pi] : undefined, selected_plan_name: planOf(pi) };
    let x = await A('POST', '/booking', style(SPEC.booking, corruptBase(base)));
    if (x.s !== 201) x = await A('POST', '/booking', { ...base, booking_date: today });
    if (x.s !== 201) return;
    const id = x.j.data.id;
    if (chance(0.15)) return;                                           // left half done on purpose
    if (chance(0.2)) await A('PATCH', `/booking/${id}/edit`, style(SPEC.booking));
    const y = await A('PATCH', `/booking/${id}`, style(SPEC.confirm, chance(0.85) ? { booking_amount: ri(5, 300) * 1000, payment_mode: pick(['cash', 'neft', 'upi']) } : {}));
    if (y.s >= 300 && chance(0.7)) await A('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash' });
    if (chance(0.1)) await A('POST', `/booking/${id}/cancel`, { reason: pick(['changed mind', '', JUNK()]) });
  },
  async editPerson() { await A('PATCH', `/consumers/${maybeWrong(mine())}`, style(SPEC.consumerEdit)); },
  async generate() { const c = maybeWrong(mine()); await A('POST', '/payments/demands/generate', chance(0.7) ? { consumerId: c } : style({ consumerId: 'id', planName: 's' }, { consumerId: c })); },
  async raise() {
    const c = mine(); const ds = idsOf(`select id from demands where consumer_id='${c}' order by random() limit ${ri(1, 4)}`);
    if (chance(0.2)) ds.push(pick([NIL, 'abc', JUNK()]));
    await A('PATCH', '/payments/demands/activate', chance(0.1) ? JUNK() : { demandIds: chance(0.05) ? JUNK() : ds, installmentDate: chance(0.15) ? JUNK() : chance(0.25) ? undefined : later(ri(-3, 40)) });
  },
  async unraise() { const ds = idsOf(`select d.id from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) order by random() limit ${ri(1, 3)}`); await A('PATCH', chance(0.6) ? '/payments/demands/bulk-cancel' : `/payments/demands/${ds[0] || NIL}/cancel`, { demandIds: ds, reason: chance(0.5) ? 'redo' : JUNK() }); },
  async send() { const d = one(`select d.id from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}) order by random() limit 1`) || NIL; await A('PATCH', `/payments/demands/${d}/send`, style({ sentVia: 's', channel: 's' })); },
  async receipt() {
    const real = mine(), c = maybeWrong(real, 0.08), pl = one(`select id from payment_plans where consumer_id='${real}' order by random() limit 1`);
    const base = { consumerId: c, amountReceivedInr: chance(0.85) ? ri(1, 40) * 1000 : JUNK() };
    if (chance(0.7) && pl) base.paymentPlanId = pl;
    await A('POST', '/payments/receipts', style(SPEC.receipt, { ...base, paymentMode: pick(['cash', 'cheque', 'neft', 'rtgs', 'upi', 'bank_transfer', 'demand_draft']), referenceNumber: `WF${U}${ri(0, 99999)}`, chequeNo: `${ri(100000, 999999)}` }));
  },
  async receiptOp() {
    const c = mine(), id = myReceipt(c), op = pick(['approve', 'mark-printed', 'deposit', 'clear', 'clear', 'clear', 'hold', 'release-hold', 'bounce', 'cancel', 'edit', 'html']);
    if (op === 'bounce') return A('PATCH', `/payments/receipts/${id}/bounce`, style({ reason: 's', penaltyAmount: 'm' }));
    if (op === 'cancel') return A('POST', `/payments/receipts/${id}/cancel`, style({ reason: 's' }));
    if (op === 'html') return A('GET', `/payments/receipts/${id}/html`);
    if (op === 'edit') return A('PATCH', `/payments/receipts/${id}`, style({ bankName: 's', branch: 's', chequeNo: 's', remarks: 's', amountReceivedInr: 'm', paymentMode: 'mode' }));
    return A('PATCH', `/payments/receipts/${id}/${op}`, style({ ...SPEC.clear, remark: 's', hold_remark: 's' }, chance(0.4) ? { clearing_date: today, deposit_date: today } : {}));
  },
  async transfer() {
    const sl = holder(), buyer = chance(0.65) ? await newPerson(chance(0.9) ? 0 : 1) : pick([mine(), holder()]);
    const u = chance(0.85) ? (one(`select allocated_unit_id from consumers where id='${sl}'`) || myUnit()) : myUnit();
    const x = await A('POST', '/transfers', style(SPEC.transfer, corruptBase({ unitId: u, oldConsumerId: sl, newConsumerId: buyer })));
    if (x.s === 201 && chance(0.5)) { const id = x.j.data.id; await A('PATCH', `/transfers/${id}`, style({ application_date: 'p', transfer_date: 'p' })); await A('GET', `/transfers/${id}/letter`); }
  },
  async surrender() {
    const c = holder(), al = myAlloc(c, chance(0.15)), cancel = chance(0.4);
    await A('POST', '/surrender', style(SPEC.surrender, corruptBase({ consumerId: c, allocationId: al, type: cancel ? 'cancellation' : 'surrender', ...(chance(0.3) ? { unitId: myUnit() } : {}) })));
  },
  async restore() {
    const cancel = chance(0.4), tbl = cancel ? 'cancellations' : 'surrender_applications';
    const sid = one(`select s.id from ${tbl} s join consumers c on c.id=s.consumer_id where c.project_id in (${IN}) order by random() limit 1`) || NIL;
    await A('POST', '/surrender/restore', chance(0.1) ? { surrenderId: sid, type: JUNK() } : { surrenderId: sid, type: cancel ? 'cancellation' : 'surrender' });
  },
  async allocCancel() { await A('POST', `/allocations/${chance(0.15) ? NIL : anyAlloc()}/cancel`, style({ reason: 's' })); },
  async allot() {
    const c = chance(0.7) ? await newPerson() : mine(), pi = chance(0.9) ? 0 : 1;
    const u = chance(0.7) ? await newUnit(pi) : myUnit();
    await A('POST', '/allocations', style(SPEC.alloc, corruptBase({ consumerId: c, unitId: u, projectId: PR[pi] })));
  },
  async shift() { const c = holder(); await A('POST', '/allocations/shift', style({ reason: 's', shiftDate: 'p' }, { consumerId: maybeWrong(c), newUnitId: chance(0.6) ? await newUnit() : myUnit() })); },
  async holdUnit() { await A('PATCH', `/units/${myUnit()}`, style({ status: 's', basePriceInr: 'm', floor: 'n' })); },
  async reads() {
    const c = mine();
    const gets = [`/payments/demands?page=${pick([1, 2, 0, -1, 'x'])}&pageSize=${pick([10, 0, 5000, 'x'])}&status=${pick(['paid', 'raised', 'x', '', 'pending'])}&consumerId=${pick([c, 'abc', NIL])}`, `/payments/receipts?status=${pick(['cleared', 'bounced', 'x'])}&consumerId=${c}`, `/payments/demand-status?consumerId=${c}`, `/payments/receipts/pending-cheques`, `/surrender/list?status=${pick(['approved', 'x', ''])}`, `/surrender/detail/${c}`, `/surrender/consumers?search=${encodeURIComponent(pick(WORDS))}`, `/allocations?status=${pick(['allotted', 'cancelled', 'x'])}&consumerId=${c}`, `/allocations/waitlist`, `/allocations/shifts`, `/transfers/list?search=${encodeURIComponent(pick(WORDS))}&page=${pick([1, 0, 'x'])}`, `/transfers/report`, `/transfers/history/${myUnit()}`, `/transfers/unit-owner/${myUnit()}`, `/consumers/${c}`, `/consumers?search=${encodeURIComponent(pick(WORDS))}`, `/booking?search=${encodeURIComponent(pick(WORDS))}`, `/payments/receipt-form/${c}`, `/payments/receipt-detail/${c}`, `/payments/dashboard`, `/payments/overdue`, `/units?projectId=${pick(PR)}`];
    for (const g of gets) if (chance(0.25)) await A('GET', g);
  },
};
const NAMES = Object.keys(ACTIONS);
const WEIGHT = { book: 4, editPerson: 2, generate: 3, raise: 3, unraise: 1, send: 1, receipt: 5, receiptOp: 7, transfer: 7, surrender: 6, restore: 2, allocCancel: 1, allot: 2, shift: 2, holdUnit: 1, reads: 2 };
const bag = NAMES.flatMap(n => Array(WEIGHT[n]).fill(n));
const run = async (name) => { last = name; try { await ACTIONS[name](); } catch (e) { t(`step ${name} did not crash the test`, false, String(e.stack || e).slice(0, 400)); } };

// ---------- the run ----------
for (let i = 0; i < PEOPLE; i++) await run('book');
checkInv('set-up');
let steps = 0;
while (steps < STEPS) {
  if (chance(0.12)) { const burst = Array.from({ length: ri(2, 5) }, () => pick(bag)); last = 'burst ' + burst.join('+'); await Promise.all(burst.map(n => run(n))); steps += burst.length; }
  else { await run(pick(bag)); steps++; }
  if (steps % 10 === 0) checkInv('step ' + steps);
}
checkInv('the end');
t('no request ended in a 5xx error (' + bad5.length + ')', bad5.length === 0, '\n   ' + [...new Set(bad5)].slice(0, 12).join('\n   '));
const stats = psql(`select (select count(*) from booking_records where project_id in (${IN}) and status='complete')||'|'||(select count(*) from demands d join consumers c on c.id=d.consumer_id where c.project_id in (${IN}))||'|'||(select count(*) from receipts r join consumers c on c.id=r.consumer_id where c.project_id in (${IN}))||'|'||(select count(*) from ownership_transfers tr join units u on u.id=tr.unit_id where u.project_id in (${IN}))||'|'||(select count(*) from surrender_applications where project_id in (${IN}))||'|'||(select count(*) from cancellations x join consumers c on c.id=x.consumer_id where c.project_id in (${IN}))`);
if (process.env.TALLY) console.log(Object.entries(tally).sort().map(([k, v]) => String(v).padStart(4) + '  ' + k).join('\n'));
console.log('reached (complete bookings | demands | receipts | transfers | surrenders | cancellations): ' + stats);
const [cb, , rc, tr, su] = stats.split('|').map(Number);
t('the random run really reached bookings, receipts and at least one transfer or surrender', cb > 3 && rc > 3 && tr + su > 0, stats);
if (madeSlab) { try { psql(`delete from gst_tax_charge_mapping where slab_id='${slab}'`); psql(`delete from gst_tax_setup where slab_id='${slab}'`); psql(`delete from gst_slabs where id='${slab}'`); } catch {} }
console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
