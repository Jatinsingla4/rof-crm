// Money modules on a fresh deal: broker commission (flat and percent, TDS and GST at payout), transfer to a new buyer, loan checks.
// Every expected figure comes from docs/regression/reference/deal-model.mjs thinking, computed here by hand from the inputs.
//   BASE=http://localhost:3011/api node docs/regression/modules-deal.mjs      (local test stack only)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3011/api';
const env = { ...process.env, PGHOST: 'localhost', PGPORT: '5433', PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: process.env.PGDATABASE || 'rof_x' };
const q = (s) => execFileSync('/Library/PostgreSQL/18/bin/psql', ['-qAt', '-c', s], { encoding: 'utf8', env }).trim();
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const api = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t: t.slice(0, 260) }; };
const ok = (r, w) => { if (r.s >= 300) throw new Error(`${w}: ${r.s} ${r.t}`); return r.j?.data ?? r.j; };
let pass = 0, fail = 0;
const check = (n, got, exp, tol = 0.011) => { const g = Number(got), e = Number(exp); const good = Math.abs(g - e) <= tol; good ? pass++ : fail++; console.log(`${good ? 'ok  ' : 'FAIL'} ${n}: ours ${got} expected ${exp}`); };
const truth = (n, c, i = '') => { c ? pass++ : fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : ' ' + i}`); };
const RUN = 'MD' + Date.now().toString(36).toUpperCase(); const today = new Date().toISOString().slice(0, 10);
const mob = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');

const co = ok(await api('POST', '/companies', { name: RUN + ' Co' }), 'co').id;
const P = ok(await api('POST', '/projects', { companyId: co, name: RUN + ' Proj', reraNumber: RUN, tcpLicence: 'x' }), 'proj').id;
const T = ok(await api('POST', `/projects/${P}/towers`, { towerName: 'T1' }), 'tower').id;
const slabs = ok(await api('GET', '/gst-configuration/gst-slabs'), 'slabs'); let slab = slabs.find((s) => String(s.from_date).slice(0, 10) <= today && String(s.to_date).slice(0, 10) >= today)?.id;
if (!slab) slab = ok(await api('POST', '/gst-configuration/gst-slabs', { fromDate: '2020-01-01', toDate: '2099-12-31' }), 'slab').id;
const tax = ok(await api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: RUN, type: 'INTRA', cgstPct: 1, sgstPct: 1 }), 'tax').id;
for (const ct of ['BASIC', 'OTHER CHARGE', 'PLC']) ok(await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct }), 'map');
const PLAN = RUN + ' plan';
for (const [i, n, t, p] of [[1, 'Booking', 'booking', 10], [2, 'Second', 'installment', 40], [3, 'Third', 'installment', 50]]) ok(await api('POST', `/projects/${P}/plan-templates`, { plan_name: PLAN, installment_name: n, installment_type: t, percentage: p, due_date_offset_days: (i - 1) * 30, installment_index: i }), 'plan');
const mkUnit = async (no, carpet) => ok(await api('POST', '/units', { projectId: P, towerId: T, unitNumber: no, floor: 2, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet + 80, balconyAreaSqft: 0, basePriceInr: Math.round(4000 * carpet), totalPriceInr: Math.round(4000 * carpet) }), 'unit ' + no).id;
const mkCons = async (tag) => ok(await api('POST', '/consumers', { name: 'MD ' + tag, salutation: 'Mr.', first_name: 'MD', last_name: tag + RUN, mobile: mob(), project_id: P, email: tag + RUN + '@example.com', present_address: 'House 1, Road 2, Delhi 110001', gender: 'male', communication_mode: 'courier' }), 'cons ' + tag).id;
const gross = (amount) => amount + 2 * Math.round(amount * 0.01);

// ---------------- broker commission ----------------
const brokerBody = { name: 'MD Broker ' + RUN, firm_name: 'MD Firm ' + RUN, mobile: mob(), email: 'b' + RUN + '@example.com', pan: 'ABCDE' + String(1000 + Math.floor(Math.random() * 8999)) + 'F', address: '5 Broker Lane, Delhi', city: 'Delhi', state: 'Delhi', pin_code: '110001' };
let br = await api('POST', '/brokers', brokerBody); if (br.s >= 300) console.log('note  broker create:', br.t);
const BR = br.j?.data?.id;
if (BR) {
  await api('PATCH', `/brokers/${BR}/approve`, {}); await api('POST', `/brokers/${BR}/projects`, { projectId: P });
  ok(await api('POST', `/broker-setup/${BR}`, { tdsRatePct: 5, gstRatePct: 18 }), 'broker tax');
  const carpet = 700, basic = Math.round(4000 * carpet);
  for (const [type, val, expected] of [['percent', 2.5, Math.round(basic * 2.5) / 100], ['flat', 31250, 31250]]) {
    const U = await mkUnit('B-' + type, carpet), C = await mkCons('b' + type);
    const bk = await api('POST', '/booking', { consumer_id: C, project_id: P, unit_id: U, selected_plan_name: PLAN, booking_date: today, basic_price: 4000, carpet_area_sqft: carpet, communication_mode: 'courier', booking_type: 'broker', broker_id: BR, broker_commission: val, broker_commission_type: type });
    if (bk.s >= 300) { fail++; console.log('FAIL broker booking', type, bk.t); continue; }
    const BK = bk.j.data.id; const row1 = Math.round(basic * 0.10);
    ok(await api('PATCH', '/booking/' + BK, { booking_amount: gross(row1), payment_mode: 'online', payment_ref: RUN + type, bank_name: 'B' }), 'confirm');
    const cm = q(`select id, commission_amount_inr, status from broker_commissions where booking_id='${BK}'`).split('|');
    check(`commission ${type} ${val}: amount`, cm[1], expected);
    const pay = await api('PATCH', '/brokers/commission/' + cm[0], { status: 'paid' });
    if (pay.s >= 300) { console.log('note  pay commission', pay.t); continue; }
    const d = pay.j.data; const tds = Math.round(expected * 5) / 100, gst = Math.round(expected * 18) / 100;
    check(`commission ${type}: TDS 5%`, d.tds_amount, tds); check(`commission ${type}: GST 18%`, d.gst_amount, gst); check(`commission ${type}: net = amount + GST - TDS`, d.net_amount_inr, expected + gst - tds);
    truth(`commission ${type}: cannot be paid twice`, (await api('PATCH', '/brokers/commission/' + cm[0], { status: 'paid' })).s === 409);
  }
} else console.log('note  broker could not be created, commission part skipped');

// ---------------- transfer ----------------
const carpetT = 640, basicT = Math.round(4000 * carpetT);
const UT = await mkUnit('TR-1', carpetT), seller = await mkCons('seller'), buyer = await mkCons('buyer');
const bkT = ok(await api('POST', '/booking', { consumer_id: seller, project_id: P, unit_id: UT, selected_plan_name: PLAN, booking_date: today, basic_price: 4000, carpet_area_sqft: carpetT, communication_mode: 'courier' }), 'book seller').id;
const r1 = Math.round(basicT * 0.10); ok(await api('PATCH', '/booking/' + bkT, { booking_amount: gross(r1), payment_mode: 'online', payment_ref: RUN + 'T', bank_name: 'B' }), 'confirm seller');
const r2 = Math.round(basicT * 0.40); ok(await api('POST', '/payments/receipts', { consumerId: seller, amountReceivedInr: Math.floor(gross(r2) / 2), paymentDate: today, paymentMode: 'online', referenceNumber: RUN + 'T2', bankName: 'B', installmentIndex: 2 }), 'seller part');
const rs = ok(await api('GET', '/payments/receipts?consumerId=' + seller), 'receipts'); for (const r of rs.receipts || rs) if (r.status === 'pending') await api('PATCH', `/payments/receipts/${r.id}/clear`, { clearing_date: today });
const paidModel = gross(r1) + Math.floor(gross(r2) / 2), totalModel = gross(r1) + gross(r2) + gross(basicT - r1 - r2);
const tf = await api('POST', '/transfers/fee-master', { projectId: P, transferFeeInr: 25000, adminChargesInr: 5000, cgstPct: 9, sgstPct: 9 }); console.log('note  fee master', tf.s);
const tr = await api('POST', '/transfers', { unitId: UT, oldConsumerId: seller, newConsumerId: buyer, transferFee: 25000, adminCharges: 5000, transferAmountInr: 25000 + 5000 + 5400, cgstAmount: 2700, sgstAmount: 2700, basicPrice: basicT, transferNo: RUN + '-TR', remarks: 'audit' });
truth('transfer accepted', tr.s === 201, tr.t);
if (tr.s === 201) {
  const t = q(`select seller_total_paid_inr, seller_total_due_inr, seller_balance_inr from ownership_transfers where id='${tr.j.data.id}'`).split('|');
  check('transfer: seller paid snapshot', t[0], paidModel); check('transfer: seller due snapshot (all demands with tax)', t[1], totalModel, 3); check('transfer: seller balance snapshot', t[2], totalModel - paidModel, 3);
  const dueBuyer = Number(q(`select coalesce(sum(amount_due_inr + coalesce(cgst_amount,0) + coalesce(sgst_amount,0)),0) from demands where consumer_id='${buyer}' and status<>'cancelled'`));
  const paidBuyer = Number(q(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${buyer}' and status not in ('cancelled','bounced') and not coalesce(is_advance,false)`));
  check('transfer: the buyer now owes what the seller owed', dueBuyer - paidBuyer, totalModel - paidModel, 3);
  check('transfer: seller has no demands left', q(`select count(*) from demands where consumer_id='${seller}' and status<>'cancelled'`), 0);
  truth('transfer: unit now belongs to the buyer', q(`select allocated_unit_id from consumers where id='${buyer}'`) === UT);
  truth('transfer: seller no longer owns a unit', q(`select coalesce(allocated_unit_id::text,'none') from consumers where id='${seller}'`) === 'none');
  truth('transfer: the same number cannot be used again', (await api('POST', '/transfers', { unitId: UT, oldConsumerId: buyer, newConsumerId: seller, transferNo: RUN + '-TR' })).s >= 400);
}
truth('transfer: seller and buyer cannot be the same person', (await api('POST', '/transfers', { unitId: UT, oldConsumerId: buyer, newConsumerId: buyer })).s === 400);

// ---------------- loans ----------------
const loanC = buyer; const priceT = basicT;
truth('loan: more than 120% of the unit price is refused', (await api('POST', '/loans', { consumerId: loanC, bankName: 'HDFC', loanAmount: Math.round(priceT * 1.3) })).s === 400);
truth('loan: a normal loan is saved', (await api('POST', '/loans', { consumerId: loanC, bankName: 'HDFC', branchName: 'CP', loanAmount: Math.round(priceT * 0.6), sanctionLetterDate: today })).s === 201);
truth('loan: the same loan twice is refused', (await api('POST', '/loans', { consumerId: loanC, bankName: 'HDFC', branchName: 'CP', loanAmount: Math.round(priceT * 0.6), sanctionLetterDate: today })).s === 409);
truth('loan: sanction date in the future is refused', (await api('POST', '/loans', { consumerId: loanC, bankName: 'SBI', loanAmount: 1000, sanctionLetterDate: '2999-01-01' })).s === 400);
truth('loan: TPA before sanction is refused', (await api('POST', '/loans', { consumerId: loanC, bankName: 'ICICI', loanAmount: 1000, sanctionLetterDate: today, tpaSignedDate: '2020-01-01' })).s === 400);

// ---------------- add-on charges ----------------
{
  const carpet = 520, basic = Math.round(4000 * carpet);
  const U = await mkUnit('AD-1', carpet), C = await mkCons('addon');
  const BK = ok(await api('POST', '/booking', { consumer_id: C, project_id: P, unit_id: U, selected_plan_name: PLAN, booking_date: today, basic_price: 4000, carpet_area_sqft: carpet, communication_mode: 'courier' }), 'book addon').id;
  ok(await api('PATCH', '/booking/' + BK, { booking_amount: gross(Math.round(basic * 0.10)), payment_mode: 'online', payment_ref: RUN + 'AD', bank_name: 'B' }), 'confirm addon');
  const mFlat = ok(await api('POST', '/addon-charges/master', { projectId: P, chargeName: 'Club ' + RUN, rateType: 'flat', defaultAmount: 77777, cgstPct: 9, sgstPct: 9 }), 'master flat').id;
  const mArea = ok(await api('POST', '/addon-charges/master', { projectId: P, chargeName: 'Area ' + RUN, rateType: 'per_sqft', ratePerSqftInr: 33.5, calculateRateType: 'Carpet Area', cgstPct: 5, sgstPct: 5 }), 'master area').id;
  const a1 = await api('POST', '/addon-charges/consumer', { consumerId: C, projectId: P, chargeMasterId: mFlat });
  const a2 = await api('POST', '/addon-charges/consumer', { consumerId: C, projectId: P, chargeMasterId: mArea });
  truth('add-on: both charges set on the customer', a1.s === 201 && a2.s === 201, a1.t + a2.t);
  const rowsA = q(`select charge_name, amount, cgst_amount, sgst_amount, total_amount from consumer_addon_charges where consumer_id='${C}' and status='active' order by amount desc`).split('\n').map((x) => x.split('|'));
  const eFlat = [77777, Math.round(77777 * 0.09 * 100) / 100, Math.round(77777 * 0.09 * 100) / 100], arAmt = Math.round(33.5 * carpet * 100) / 100;
  const eArea = [arAmt, Math.round(arAmt * 0.05 * 100) / 100, Math.round(arAmt * 0.05 * 100) / 100];
  const find = (n) => rowsA.find((r) => r[0].startsWith(n)) || [];
  check('add-on flat: amount', find('Club')[1], eFlat[0]); check('add-on flat: CGST 9%', find('Club')[2], eFlat[1], 0.02); check('add-on flat: total', find('Club')[4], eFlat[0] + 2 * eFlat[1], 0.03);
  check('add-on per sqft: amount = 33.5 x carpet 520', find('Area')[1], eArea[0]); check('add-on per sqft: CGST 5%', find('Area')[2], eArea[1], 0.02); check('add-on per sqft: total', find('Area')[4], eArea[0] + 2 * eArea[1], 0.03);
  const dm = q(`select coalesce(sum(addon_charge_amount + coalesce(addon_cgst_amount,0) + coalesce(addon_sgst_amount,0)),0) from demands where consumer_id='${C}' and status<>'cancelled'`);
  check('add-on: a charge in no plan row is on the customer but on no demand (designed)', dm, 0, 0.1);
  const idFlat = q(`select id from consumer_addon_charges where consumer_id='${C}' and charge_name like 'Club%' and status='active'`);
  const cn = await api('PATCH', `/addon-charges/consumer/${idFlat}/cancel`, {});
  truth('add-on: an unpaid charge can be cancelled', cn.s === 200, cn.t);
  const dm2 = q(`select coalesce(sum(addon_charge_amount + coalesce(addon_cgst_amount,0) + coalesce(addon_sgst_amount,0)),0) from demands where consumer_id='${C}' and status<>'cancelled'`);
  check('add-on: still on no demand after one charge is cancelled', dm2, 0, 0.1);
  truth('add-on: zero amount is refused', (await api('POST', '/addon-charges/consumer', { consumerId: C, projectId: P, amount: 0 })).s === 400);
}

// ---------------- GST invoice ----------------
{
  const C = buyer; const inv = (b) => api('POST', '/payments/gst-invoices', { consumerId: C, ...b });
  for (const [base, rate, supply] of [[100000, 18, 'intrastate'], [33333.33, 5.5, 'intrastate'], [250000, 12, 'interstate'], [1, 28, 'intrastate'], [999999.99, 18, 'intrastate']]) {
    const r = await inv({ baseAmount: base, gstRate: rate, supplyType: supply, invoiceDate: today });
    if (r.s >= 300) { fail++; console.log('FAIL invoice', base, rate, r.t); continue; }
    const d = r.j.data, half = Math.round(base * rate / 2) / 100, g = (x) => Math.round(x * 100) / 100;
    const eC = supply === 'interstate' ? 0 : g(base * rate / 2 / 100), eI = supply === 'interstate' ? g(base * rate / 100) : 0;
    check(`invoice ${base} @ ${rate}% ${supply}: CGST`, d.cgst_amount ?? d.cgst, eC, 0.011); check(`  SGST`, d.sgst_amount ?? d.sgst, eC, 0.011); check(`  IGST`, d.igst_amount ?? d.igst, eI, 0.011);
    check(`  total`, d.total_amount ?? d.total_inr ?? d.total, g(base + 2 * eC + eI), 0.02);
  }
  truth('invoice: IGST together with CGST is refused', (await inv({ baseAmount: 1000, cgstRate: 9, igstRate: 18 })).s === 400);
  truth('invoice: date in the future is refused', (await inv({ baseAmount: 1000, gstRate: 18, invoiceDate: '2999-01-01' })).s === 400);
  truth('invoice: zero and negative base are refused', (await inv({ baseAmount: 0, gstRate: 18 })).s === 400 && (await inv({ baseAmount: -5, gstRate: 18 })).s === 400);
  truth('invoice: a GST rate above 28 is refused', (await inv({ baseAmount: 1000, gstRate: 29 })).s === 400);
}

// ---------------- TDS challan ----------------
{
  const rl = ok(await api('GET', '/payments/receipts?consumerId=' + buyer), 'buyer receipts'); const list = (rl.receipts || rl).filter((x) => !['cancelled', 'bounced'].includes(x.status) && !x.is_advance);
  const [R1, R2] = list; const amt = (r) => Number(r.amount_received_inr);
  const ch = await api('POST', '/payments/tds/challans', { challanNumber: 'CH-' + RUN, challanDate: today, amount: 10000.5, bankName: 'SBI', bsrCode: '1234567' });
  truth('tds: challan saved', ch.s === 201, ch.t); const CH = ch.j?.data?.id;
  if (CH && R1 && R2) {
    const as = (rid, amount) => api('POST', '/payments/tds/assign', { challanId: CH, receiptId: rid, amount });
    truth('tds: part of the challan goes to receipt 1', (await as(R1.id, 6000.25)).s === 200);
    truth('tds: the same challan on the same receipt again is refused', (await as(R1.id, 1)).s === 409);
    truth('tds: more than what is left on the challan is refused', (await as(R2.id, 4000.26)).s === 409);
    truth('tds: the rest of the challan goes to receipt 2', (await as(R2.id, 4000.25)).s === 200);
    truth('tds: the challan is now fully used (0.01 more refused)', (await as(R2.id, 0.01)).s === 409);
    const cr = q(`select assigned_amount, status from tds_challans where id='${CH}'`).split('|'); check('tds: challan assigned amount', cr[0], 10000.5); console.log('note  challan status after full use:', cr[1]);
    truth('tds: TDS above the receipt amount is refused', (await api('POST', '/payments/tds/assign', { challanId: CH, receiptId: R1.id, amount: amt(R1) + 1 })).s >= 400);
    const asg = q(`select id from tds_assignments where challan_id='${CH}' and receipt_id='${R1.id}' and released_at is null`);
    const rel = await api('POST', `/payments/tds/assignments/${asg}/release`, {}); truth('tds: an assignment can be taken back', rel.s === 200, rel.t);
    check('tds: after the release 6,000.25 is free again', Number(q(`select amount from tds_challans where id='${CH}'`)) - Number(q(`select assigned_amount from tds_challans where id='${CH}'`)), 6000.25);
  }
  truth('tds: challan date in the future is refused', (await api('POST', '/payments/tds/challans', { challanNumber: 'F-' + RUN, challanDate: '2999-01-01', amount: 5 })).s === 400);
  truth('tds: zero amount and a 6 digit BSR are refused', (await api('POST', '/payments/tds/challans', { challanNumber: 'Z-' + RUN, challanDate: today, amount: 0 })).s === 400 && (await api('POST', '/payments/tds/challans', { challanNumber: 'B-' + RUN, challanDate: today, amount: 5, bsrCode: '123456' })).s === 400);
}
console.log(`\nRESULT: ${pass} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
