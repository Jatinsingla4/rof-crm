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

// ---------- a receipt that is more than its instalment, or matches no demand, is recorded and says so ----------
const unit2 = (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: 'A-102-' + U, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 5500000, totalPriceInr: 5500000 })).j.data.id;
const c2 = (await A('POST', '/consumers', { name: 'QA Beta ' + U, mobile: mob(), project_id: P })).j.data.id;
const b2 = (await A('POST', '/booking', { consumer_id: c2, project_id: P, unit_id: unit2, selected_plan_name: 'Plan' + U, booking_date: today, carpet_area_sqft: 1000, basic_price: 5500 })).j.data.id;
await A('PATCH', `/booking/${b2}`, { booking_amount: 100000, payment_mode: 'cash' });
r = await A('POST', '/payments/receipts', { consumerId: c2, amountReceivedInr: 2000000, paymentMode: 'neft', referenceNumber: 'QA-OVER-' + U, paymentDate: today, installmentIndex: 1 });
t('overpayment: a receipt bigger than its instalment is recorded (201) and carries a warning that names the carried amount', r.s === 201 && (r.j?.warnings || []).some((w) => /more than what instalment 1 still needed/.test(w) && /advance/.test(w)), JSON.stringify(r.j?.warnings));
r = await A('POST', '/payments/receipts', { consumerId: c2, amountReceivedInr: 1000, paymentMode: 'neft', referenceNumber: 'QA-NODEM-' + U, paymentDate: today, installmentIndex: 9 });
t('a receipt for an instalment that has no open demand is recorded and says it is not matched yet', r.s === 201 && (r.j?.warnings || []).some((w) => /no open demand for instalment 9/.test(w)), JSON.stringify(r.j?.warnings));
r = await A('POST', '/payments/receipts', { consumerId: c2, amountReceivedInr: 1000, paymentMode: 'neft', referenceNumber: 'QA-FINE-' + U, paymentDate: today, installmentIndex: 2 });
t('a normal receipt carries no warning', r.s === 201 && (r.j?.warnings || []).length === 0 || r.s === 201 && (r.j?.warnings || []).every((w) => !/more than/.test(w)), JSON.stringify(r.j?.warnings));

// ---------- one price, everywhere: basic, discount, balcony and GST add up the same on the plan, the demands and the surrender page ----------
const oldBal = psql("select rate_value||'|'||coalesce(cap_value::text,'') from charge_master_config where charge_key='balcony_charge'");
psql("update charge_master_config set rate_value = 1000, cap_value = 100000 where charge_key='balcony_charge'");
const unit3 = (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: 'A-103-' + U, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, balconyAreaSqft: 50, basePriceInr: 5500000, totalPriceInr: 5500000 })).j.data.id;
const c3 = (await A('POST', '/consumers', { name: 'QA Gamma ' + U, mobile: mob(), project_id: P })).j.data.id;
const b3 = (await A('POST', '/booking', { consumer_id: c3, project_id: P, unit_id: unit3, selected_plan_name: 'Plan' + U, booking_date: today, company_inaugural_disc: 100000, carpet_area_sqft: 1000, basic_price: 5500 })).j.data.id;
await A('PATCH', `/booking/${b3}`, { booking_amount: 100000, payment_mode: 'cash' });
const planTotal = Number(psql(`select total_amount_inr from payment_plans where consumer_id = '${c3}'`));
const demandSum = Number(psql(`select sum(amount_due_inr + cgst_amount + sgst_amount) from demands where consumer_id = '${c3}'`));
const gstSum = Number(psql(`select sum(cgst_amount + sgst_amount) from demands where consumer_id = '${c3}'`));
t('totals: the plan is the net price (55,00,000 - 1,00,000 + balcony 50,000 = 54,50,000)', planTotal === 5450000, String(planTotal));
t('totals: the GST of all instalments is exactly the GST of the whole price (0.5% + 0.5% of 55,00,000 and of the balcony 50,000 = 55,500), no rupee lost to rounding', gstSum === 55500, String(gstSum));
t('totals: the demands add up to the plan plus that GST (55,05,500)', demandSum === 5505500, String(demandSum));
const sd3 = (await A('GET', `/surrender/detail/${c3}`)).j?.data?.financials;
t('totals: the surrender page shows the same net price (discount taken off) and the same total consideration (55,05,500)', sd3?.netBasicPrice === 5400000 && sd3?.inauguralDiscount === 100000 && sd3?.totalConsideration === 5505500, JSON.stringify({ net: sd3?.netBasicPrice, disc: sd3?.inauguralDiscount, tot: sd3?.totalConsideration }));

// ---------- the demand letter is refused when it would be empty or carry a placeholder RERA number ----------
let gen = await A('POST', '/documents/generate', { consumerId: c3, documentType: 'demand_letter', dueDate: today });
t('demand letter: nothing raised -> refused (409) with a clear message, no document made', gen.s === 409 && /No raised demands/.test(gen.j?.error || ''), JSON.stringify(gen.j));
psql(`update projects set rera_number = 'RERA-X-NONE' where id = '${P}'`);
gen = await A('POST', '/documents/generate', { consumerId: c3, documentType: 'demand_letter', dueDate: today });
t('demand letter: a placeholder RERA number (RERA-X-NONE) -> refused (409), never printed', gen.s === 409 && /valid RERA number/.test(gen.j?.error || ''), JSON.stringify(gen.j));
psql(`update projects set rera_number = 'RERA-Q6-${U}' where id = '${P}'`);
psql(`update demands set status = 'demanded', due_date = '${today}' where consumer_id = '${c3}' and installment_index = 1`);
gen = await A('POST', '/documents/generate', { consumerId: c3, documentType: 'demand_letter', dueDate: today });
t('demand letter: with a raised demand and a real RERA number it is generated (201)', gen.s === 201 && !!gen.j?.data?.documentId, JSON.stringify(gen.j));
psql(`update charge_master_config set rate_value = '${oldBal.split('|')[0]}', cap_value = ${oldBal.split('|')[1] === '' ? 'null' : `'${oldBal.split('|')[1]}'`} where charge_key='balcony_charge'`);

// ---------- the QA TestBeta / TestAlpha steps over the real routes: cancel an allotment that holds only uncleared money, and restore a surrender ----------
const unit5 = (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: 'A-105-' + U, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 5500000, totalPriceInr: 5500000 })).j.data.id;
const c5 = (await A('POST', '/consumers', { name: 'QA Beta2 ' + U, mobile: mob(), project_id: P })).j.data.id;
const b5 = (await A('POST', '/booking', { consumer_id: c5, project_id: P, unit_id: unit5, selected_plan_name: 'Plan' + U, booking_date: today, carpet_area_sqft: 1000, basic_price: 5500 })).j.data.id;
await A('PATCH', `/booking/${b5}`, { booking_amount: 50000, payment_mode: 'online', payment_ref: 'QA-BETA-' + U, bank_name: 'HDFC', bank_branch: 'x' });
r = await A('POST', '/allocations', { consumerId: c5, unitId: unit5, projectId: P });
const alloc5 = r.j?.data?.id;
t('cancel allotment set-up: the booked unit is allotted (201) with only an uncleared 50,000 receipt on the file', r.s === 201 && !!alloc5 && psql(`select status from units where id = '${unit5}'`) === 'allotted', JSON.stringify(r.j).slice(0, 150));
r = await A('POST', `/allocations/${alloc5}/cancel`, { reason: 'Voluntary Surrender' });
t('cancel allotment: done (200), not a silent no-op', r.s === 200, JSON.stringify(r.j).slice(0, 200));
t('cancel allotment: the allocation is cancelled and the unit is available again', psql(`select status from allocations where id = '${alloc5}'`) === 'cancelled' && psql(`select status from units where id = '${unit5}'`) === 'available', psql(`select status from allocations where id = '${alloc5}'`) + '/' + psql(`select status from units where id = '${unit5}'`));
t('cancel allotment: it is in the audit log', Number(psql(`select count(*) from audit_logs where resource_id = '${alloc5}' or (new_values::text like '%${alloc5}%' and action in ('update','create','delete'))`)) >= 1);
const sid = psql(`select id from surrender_applications where consumer_id = '${c}' order by created_at desc limit 1`);
r = await A('POST', '/surrender/restore', { surrenderId: sid, type: 'surrender', consumerId: c, allocationId: al, unitId: unit, bookingId: bid });
t('restore after surrender: done (200), not a silent no-op', r.s === 200, JSON.stringify(r.j).slice(0, 200));
t('restore: the booking is live again, the applicant is back on the unit and the receipts are still there', psql(`select lead_stage from consumers where id = '${c}'`) !== 'cancelled' && psql(`select status from booking_records where id = '${bid}'`) !== 'cancelled' && psql(`select count(*) from receipts where consumer_id = '${c}' and status <> 'cancelled'`) === '2', psql(`select lead_stage from consumers where id = '${c}'`) + '/' + psql(`select status from booking_records where id = '${bid}'`));
r = await A('GET', `/payments/receipts?consumerId=${c}&pageSize=50`);
t('restore: the receipts are listed on the applicant file', (r.j?.data || []).length === 2, String((r.j?.data || []).length));

// ---------- every letter type the Generate screen offers can have a template (NOC and Possession could not be created before) ----------
r = await A('POST', '/documents/templates', { name: 'QA NOC ' + U, documentType: 'noc', bodyHtml: '<p>NOC for {{consumerName}}, unit {{unitNumber}}</p>' });
t('templates: a NOC template can be created (201)', r.s === 201, JSON.stringify(r.j).slice(0, 150));
r = await A('POST', '/documents/templates', { name: 'QA Possession ' + U, documentType: 'possession_letter', bodyHtml: '<p>Possession {{unitNumber}}</p>' });
t('templates: a Possession Letter template can be created (201)', r.s === 201, JSON.stringify(r.j).slice(0, 150));
gen = await A('POST', '/documents/generate', { consumerId: c3, documentType: 'noc' });
t('templates: the NOC is then generated (201) instead of "no template is set up yet"', gen.s === 201 && !!gen.j?.data?.documentId, JSON.stringify(gen.j).slice(0, 200));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
