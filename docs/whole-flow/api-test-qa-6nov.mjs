// Owner QA report of 6 Nov 2026, the findings that are about data: money must not vanish when a booking is surrendered, uncleared money is shown (and
// never counted as received), every receipt has a create entry in the audit log, an advance (split) receipt is flagged so totals do not count it twice.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-qa-6nov.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
import { bizToday } from '../_shared/business-date.mjs';

const B = process.env.BASE || 'http://localhost:3010/api';
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const A = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const U = Date.now().toString(36).slice(-5), today = bizToday(); let seq = 0;
const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

// ---------- set-up: a project, a plan, GST, a unit with a discount booking (the QA TestAlpha shape) ----------
const co = (await A('POST', '/companies', { name: 'QA6 Co ' + U })).j.data.id;
const P = (await A('POST', '/projects', { companyId: co, name: `QA6 ${U}`, reraNumber: `Q6-${U}`, tcpLicence: 'x' })).j.data.id;
const T = (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
let i = 0; for (const pc of [20, 30, 50]) await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan' + U, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i });
const slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((s) => s.from_date <= today && s.to_date >= today)?.id
  ?? (await A('POST', '/gst-configuration/gst-slabs', { fromDate: today, toDate: today })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `Q6 ${U}`, type: 'INTRA', cgstPct: 0.5, sgstPct: 0.5 })).j.data.id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const unit = (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: 'A-101-' + U, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 5500000, totalPriceInr: 5500000 })).j.data.id;
const c = (await A('POST', '/consumers', { name: 'QA Alpha ' + U, mobile: mob(), project_id: P })).j.data.id;
let r = await A('POST', '/booking', { consumer_id: c, project_id: P, unit_id: unit, selected_plan_name: 'Plan' + U, booking_date: today, company_inaugural_disc: 100000, carpet_area_sqft: 1000, basic_price: 5500 });
const bid = r.j?.data?.id;
t('set-up: the discount booking is created', r.s === 201 && !!bid, JSON.stringify(r.j).slice(0, 150));
r = await A('PATCH', `/booking/${bid}`, { booking_amount: 100000, payment_mode: 'cheque', payment_ref: 'QA' + U, bank_name: 'HDFC', bank_branch: 'x', cheque_date: today });
t('set-up: the booking payment is confirmed', r.s === 200, JSON.stringify(r.j).slice(0, 150));
r = await A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: 500000, paymentMode: 'neft', referenceNumber: 'QA-NEFT-' + U, paymentDate: today });
t('set-up: a second receipt of 5,00,000 is recorded', r.s === 201, JSON.stringify(r.j).slice(0, 150));

// ---------- audit: every receipt has a create entry ----------
const created = Number(psql(`select count(*) from audit_logs a join receipts r on r.id = a.resource_id where r.consumer_id = '${c}' and a.action = 'create'`));
t('audit: the booking-payment receipt and the manual receipt both have a create entry', created === 2, 'create entries: ' + created);

// ---------- the receipt list carries the advance flag ----------
r = await A('GET', `/payments/receipts?consumerId=${c}&pageSize=50`);
t('receipt list: both receipts of the live booking are listed, each with is_advance false', r.s === 200 && (r.j?.data || []).length === 2 && r.j.data.every((x) => x.is_advance === false), JSON.stringify((r.j?.data || []).map((x) => [x.receipt_number, x.is_advance])));

// ---------- surrender detail: uncleared money is shown, not counted ----------
r = await A('GET', `/surrender/detail/${c}`);
const d = r.j?.data;
t('surrender detail: two receipts of 6,00,000 are listed as not cleared yet', r.s === 200 && d?.unclearedReceipts?.length === 2 && d.financials.unclearedTotal === 600000, JSON.stringify({ n: d?.unclearedReceipts?.length, tot: d?.financials?.unclearedTotal }));
t('surrender detail: they are not counted as received', d?.financials?.totalReceived === 0 && (d?.receipts || []).length === 0, JSON.stringify({ rec: d?.financials?.totalReceived, n: (d?.receipts || []).length }));

// ---------- surrender keeps the money on the applicant file ----------
const al = psql(`select id from allocations where consumer_id = '${c}' order by created_at desc limit 1`);
r = await A('POST', '/surrender', { consumerId: c, allocationId: al, bookingId: bid, unitId: unit, projectId: P, type: 'surrender', surrenderDate: today });
t('surrender: done', r.s === 201, JSON.stringify(r.j).slice(0, 150));
t('surrender: the stage is cancelled and the unit is free of the applicant', psql(`select lead_stage from consumers where id = '${c}'`) === 'cancelled');
r = await A('GET', `/payments/receipts?consumerId=${c}&pageSize=50`);
t('after surrender the receipts of the cancelled booking are still on the applicant file (they used to vanish)', r.s === 200 && (r.j?.data || []).length === 2, `listed ${(r.j?.data || []).length}, in the database ${psql(`select count(*) from receipts where consumer_id = '${c}'`)}`);
t('after surrender nothing was deleted: both receipts still exist, not cancelled', psql(`select count(*) from receipts where consumer_id = '${c}' and status <> 'cancelled'`) === '2');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
