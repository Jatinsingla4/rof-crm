// End-to-end parity check against the client's real "Applicant Payment File" (see captured/05-applicant-payment-file.md).
// Their file: 510 sq ft unit, rate 11,500 per sq ft on SUPER area = net basic 58,65,000, GST 5% (2.5 + 2.5), plan 9 / 10 / 81,
// installments due 23 Jan 2023 and 22 Feb 2023, three cleared receipts 6,75,750 (23 Jan), 3,54,853 (17 Feb), 4,94,317.50 (20 Apr),
// interest 3,111 at 15% simple. Expected there: total with tax 61,58,250, received 15,24,921, interest 3,111 (+156 GST), balance 46,36,441.
// Ours prices a unit as rate x CARPET area, so the same unit (carpet 255) is booked at 23,000 per carpet sq ft to give the same 58,65,000.
// Local demo API only.   BASE=http://localhost:3020/api node docs/client-crm/e2e-payment-file-parity.mjs
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) { console.log('refusing: local API only'); process.exit(2); }
const out = []; const chk = (n, got, want, tol = 1) => out.push([Math.abs(Number(got) - Number(want)) <= tol ? 'OK ' : 'DIFF', n, `ours ${got} | theirs ${want}`]);
const note = (n, x = '') => out.push(['..', n, typeof x === 'string' ? x : JSON.stringify(x).slice(0, 220)]);
let tok = '';
const call = async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
const must = (r, what) => { if (r.s >= 300) { note('STOP at ' + what, `${r.s} ${(r.j?.error || r.t).toString().slice(0, 200)}`); finish(); } return r; };
const finish = () => { console.log(out.map((x) => x.join(' | ')).join('\n')); const d = out.filter((x) => x[0] === 'DIFF').length, k = out.filter((x) => x[0] === 'OK ').length; console.log(`RESULT: ${k} passed, ${d} failed`); process.exit(d ? 1 : 0); };
tok = (await call('POST', '/auth/login', { email: 'super_admin@test.local', password: 'Test#Pass1234' })).j.token;
const U = Date.now().toString(36).slice(-4);
const projects = (await call('GET', '/projects')).j; const P = (projects.data || projects).find((p) => /^ROF GALLERIA@78/.test(p.name)).id;

// GST for the project: one slab from 2017, 5% (2.5 + 2.5) on basic, PLC, other charges
const G = (m, p, b) => call(m, '/gst-configuration' + p, b);
const idOf = (r) => r.j?.data?.id ?? r.j?.id;
await G('POST', '/financial-years', { name: `FY-${U}`, fromDate: '2022-04-01', toDate: '2099-03-31', isActive: true });
const hsn = idOf(await G('POST', '/hsn-sac-codes', { code: '9954' + U.slice(0, 2), type: 'Service' }));
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE', 'EXTRA ADD ON']) await G('POST', '/hsn-sac-assign', { hsnSacId: hsn, projectId: P, chargeType: ct });
let slab = idOf(await G('POST', '/gst-slabs', { fromDate: '2017-07-01', toDate: '2099-12-31' }));
if (!slab) { const l = (await G('GET', '/gst-slabs')).j; slab = (l.data || l).find((x) => String(x.from_date).startsWith('2017-07-01') || String(x.fromDate).startsWith('2017-07-01'))?.id; }
let tax = idOf(await G('POST', '/gst-tax-setup', { slabId: slab, gstCode: '5%', type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }));
if (!tax) { const l = (await G('GET', '/gst-tax-setup?slabId=' + slab)).j; tax = (l.data || l).find((x) => x.gst_code === '5%' || x.gstCode === '5%')?.id; }
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE', 'EXTRA ADD ON']) await G('POST', '/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct });
note('GST set for the project', `slab ${!!slab} tax ${!!tax}`);

// customer, unit G-18, booking on 23 Jan 2023
const units = (await call('GET', `/units?projectId=${P}&pageSize=200`)).j; const list = units.data?.units || units.data || units;
const unit = list.find((u) => u.status === 'available' && Number(u.super_area_sqft) === 510); // any free 510 sq ft unit
const cust = must(await call('POST', '/consumers', { name: 'Parity Customer', mobile: '98' + String(Date.now()).slice(-8), project_id: P, email: `parity${U}@example.com` }), 'customer').j;
const cid = cust.id || cust.data?.id;
const bk = must(await call('POST', '/booking', { consumer_id: cid, project_id: P, unit_id: unit.id, selected_plan_name: 'Payment Plan 9:10:81', booking_date: '2023-01-23', basic_price: 23000 }), 'booking').j;
const bid = bk.id || bk.data?.id; note('booking made', { bid, total: bk.total_amount ?? bk.data?.total_amount });
const ps = await call('PATCH', `/booking/${bid}`, { booking_amount: 675750, payment_mode: 'cheque', payment_ref: 'PAR' + U, bank_name: 'ICICI BANK', cheque_date: '2023-01-23' });
note('booking payment step', `${ps.s} ${ps.j?.error || ''}`);

const dem = (await call('GET', `/payments/demands?consumerId=${cid}`)).j.data || [];
note('demands after booking', dem.map((d) => `#${d.installment_index} ${d.status} ${d.amount_due_inr}`).join('; '));

// raise installments 1 and 2 on their real dates
const d1 = dem.find((d) => d.installment_index === 1), d2 = dem.find((d) => d.installment_index === 2);
import { execFileSync } from 'node:child_process';
const psql = (sql) => execFileSync('/Library/PostgreSQL/18/bin/psql', ['-h', 'localhost', '-p', '5433', '-U', 'postgres', '-d', 'rof_demo', '-qAt', '-c', sql], { encoding: 'utf8' }).trim();
// our API refuses a demand whose due date is in the past (finding), so the 2023 dates are set in the local database
for (const [d, date] of [[d1, '2023-01-23'], [d2, '2023-02-22']]) {
  const r = await call('PATCH', '/payments/demands/activate', { demandIds: [d.id], installmentDate: date });
  if (r.s >= 300) { note('API refused the back-dated demand', `${r.s} ${r.j?.error}`); psql(`UPDATE demands SET status='demanded', due_date='${date}', raised_at='${date}'::timestamptz WHERE id='${d.id}'`); }
}
let rc = (await call('GET', `/payments/receipts?consumerId=${cid}`)).j; let rl = rc.data || rc.receipts || [];
note('receipts after booking step', rl.map((x) => `${x.amount_received_inr} ${x.status} ${String(x.received_date).slice(0, 10)}`).join('; ') || 'none');
const mkr = async (amt, date, n) => must(await call('POST', '/payments/receipts', { consumerId: cid, paymentDate: date, amountReceivedInr: amt, paymentMode: 'cheque', chequeNo: 'PAR' + U + n, bankName: 'ICICI BANK' }), 'receipt ' + n).j;
if (!rl.some((x) => Number(x.amount_received_inr) === 675750)) await mkr(675750, '2023-01-23', 1);
await mkr(354853, '2023-02-17', 2); note('receipt with paise refused: ours takes whole rupees only (theirs 4,94,317.50), so 494,318 is used'); await mkr(494318, '2023-04-20', 3);
rc = (await call('GET', `/payments/receipts?consumerId=${cid}`)).j; rl = rc.data || rc.receipts || [];
const dates = { 675750: ['2023-01-23', '2023-01-24'], 354853: ['2023-02-17', '2023-02-17'], 494318: ['2023-04-20', '2023-04-20'] };
for (const x of rl) { const d = dates[Number(x.amount_received_inr)]; if (!d) continue; await call('PATCH', `/payments/receipts/${x.id}/deposit`, { deposit_date: d[0] }); const c = await call('PATCH', `/payments/receipts/${x.id}/clear`, { clearing_date: d[1] }); if (c.s >= 300) note('clear failed ' + x.amount_received_inr, `${c.s} ${c.j?.error || ''}`); }
rl = ((await call('GET', `/payments/receipts?consumerId=${cid}`)).j.data) || [];
note('receipts now', rl.map((x) => `${x.amount_received_inr} ${x.status} ${String(x.received_date).slice(0, 10)}`).join('; '));
const af = await call('GET', `/consumers/${cid}/applicant-file`);
note('applicant-file', `${af.s} ${af.t.length} chars`);
const txt = af.t.replace(/<[^>]+>/g, ' ').replace(/&#8377;|&nbsp;/g, ' ').replace(/\s+/g, ' ');
const grab = (re) => { const m = txt.match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
const rs = (re) => { const all = [...txt.matchAll(new RegExp(re.source, 'g'))]; const m = all[all.length - 1]; return m ? Number(m[1].replace(/,/g, '')) : NaN; }; // the last match: some labels also appear in a summary box
chk('Net basic price (rate x area)', rs(/Net Basic Price \([^)]*\) Rs\. ([\d,]+)/), 5865000);
chk('CGST on basic', rs(/CGST \(Rs\.\) Rs\. ([\d,]+)/), 146625);
chk('Total with tax', rs(/Total Consideration With Tax Rs\. ([\d,]+)/), 6158250);
chk('Receipts counted (received)', rs(/Less Receipt[\s\S]{0,80}?Rs\. ([\d,]{5,})/), 1524921, 1);
chk('Demand 1 (9 % of basic)', Number(dem.find((d) => d.installment_index === 1).amount_due_inr), 527850);
chk('Demand 2 (10 % of basic)', Number(dem.find((d) => d.installment_index === 2).amount_due_inr), 586500);
chk('Demand 3 (81 % of basic)', Number(dem.find((d) => d.installment_index === 3).amount_due_inr), 4750650);
chk('Total interest in the interest table', rs(/TOTAL INTEREST ([\d,.]+)/), 3111, 5);
chk('"Interest (Rs.)" box at the top of the file equals the table', rs(/Interest \(Rs\.\) Rs\. ([\d,.]+)/), rs(/TOTAL INTEREST ([\d,.]+)/), 1);
note('interest table', txt.slice(txt.indexOf('INTEREST S.NO'), txt.indexOf('INTEREST S.NO') + 900));
chk('Balance = total with tax + interest - receipts', rs(/Balance \(Rs\.\) \(To be Paid\) Rs\. ([\d,]+)/), 4636441, 2);

finish();
