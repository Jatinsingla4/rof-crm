// Reconcile legacy customer 2191 (Sunita Sundriyal, ROF ALANTE A-101) against our CRM's own computation.
// Plain Node 20 (fetch + psql through child_process). Idempotent: builds its RECON2191 data once, re-uses it on re-run.
//   BASE=http://localhost:3010/api node docs/applicant-file-reconciliation/reconcile-2191.mjs
//   TAG=dev1 ...   builds a second, separate copy named "RECON2191 dev1" (for experiments); default TAG is empty.
// Needs: local API + the Postgres the API uses (PGHOST/PGPORT/PGUSER/PGDATABASE default to the local test stack below).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const L = JSON.parse(readFileSync(join(HERE, 'legacy-2191-sunita-sundriyal.json'), 'utf8'));
const B = process.env.BASE || 'http://localhost:3010/api';
const TAG = process.env.TAG ? ' ' + process.env.TAG : '';
const N = 'RECON2191' + TAG;                       // every created row carries this prefix
const env = { ...process.env, PGHOST: process.env.PGHOST || 'localhost', PGPORT: process.env.PGPORT || '5433', PGUSER: process.env.PGUSER || 'postgres', PGDATABASE: process.env.PGDATABASE || 'rof_sec' };
const PSQL = process.env.PSQL || (existsSync('/Library/PostgreSQL/18/bin/psql') ? '/Library/PostgreSQL/18/bin/psql' : 'psql');
const psql = (sql) => execFileSync(PSQL, ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', env }).trim();
const q1 = (sql) => psql(sql).split('\n')[0];
const sq = (s) => String(s).replace(/'/g, "''");

const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const TOK = await login('super_admin@test.local');
const api = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOK }, body: b === undefined ? undefined : JSON.stringify(b) }); const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {} return { s: r.status, j, text }; };
const must = (r, what) => { if (r.s >= 300) throw new Error(`${what} failed: ${r.s} ${r.text.slice(0, 400)}`); return r.j?.data ?? r.j; };
const log = (...a) => console.log(...a);
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const r2 = (x) => Math.round(x * 100) / 100;

// ============================== SET-UP (find-or-create) ==============================
async function setup() {
  const notes = [];
  // company, project (settings: balcony charge capped at 50,000), tower, unit
  let co = q1(`select id from companies where name='${sq(N + ' Co')}'`) || must(await api('POST', '/companies', { name: N + ' Co' }), 'company').id;
  let P = q1(`select id from projects where name='${sq(N + ' ROF ALANTE')}'`) || must(await api('POST', '/projects', { companyId: co, name: N + ' ROF ALANTE', reraNumber: 'RECON2191' + TAG.replace(/\W/g, '') + '-' + Date.now().toString(36), tcpLicence: 'x' }), 'project').id;
  must(await api('PUT', `/projects/${P}/settings`, { balcony_max_charge_inr: 50000 }), 'project settings');
  let T = q1(`select id from towers where project_id='${P}' and tower_name='Tower A'`) || must(await api('POST', `/projects/${P}/towers`, { towerName: 'Tower A' }), 'tower').id;
  const u = L.unit;
  let U = q1(`select id from units where project_id='${P}' and unit_number='${u.unit}'`) || must(await api('POST', '/units', {
    projectId: P, towerId: T, unitNumber: u.unit, floor: 1, bhkType: u.type, carpetAreaSqft: u.carpetAreaSqft, superAreaSqft: r2(u.carpetAreaSqft + u.balconyAreaSqft), balconyAreaSqft: u.balconyAreaSqft,
    basePriceInr: L.summary.netBasicPrice, totalPriceInr: L.summary.netBasicPrice,
  }), 'unit').id;

  // GST. Slabs are global and may not overlap. History (2019 ..) needs a slab of its own; "today" is covered by whatever slab exists (or one is made).
  const slabs = must(await api('GET', '/gst-configuration/gst-slabs'), 'slabs');
  const covering = (d) => slabs.find((s) => s.from_date <= d && s.to_date >= d)?.id;
  let histSlab = covering(L.dates.booking);
  if (!histSlab) {
    const firstLater = slabs.map((s) => s.from_date).filter((d) => d > L.dates.booking).sort()[0];
    histSlab = must(await api('POST', '/gst-configuration/gst-slabs', { fromDate: '2019-01-01', toDate: firstLater ? addDays(firstLater, -1) : addDays(today, -1) }), 'history slab').id;
    notes.push('created a GST slab covering the legacy dates (slabs are global)');
  }
  let curSlab = covering(today);
  if (!curSlab) { curSlab = must(await api('POST', '/gst-configuration/gst-slabs', { fromDate: addDays(today, -3), toDate: addDays(today, 60) }), 'current slab').id; notes.push('created a GST slab covering today'); }
  for (const slab of new Set([histSlab, curSlab])) {
    let tax = q1(`select id from gst_tax_setup where slab_id='${slab}' and gst_code='${sq(N + ' 0.5+0.5')}'`) || must(await api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: N + ' 0.5+0.5', type: 'INTRA', cgstPct: 0.5, sgstPct: 0.5 }), 'tax').id;
    for (const ct of ['BASIC', 'OTHER CHARGE', 'PLC']) {
      if (!q1(`select 1 from gst_tax_charge_mapping where project_id='${P}' and slab_id='${slab}' and charge_type='${ct}'`)) must(await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct }), 'mapping ' + ct);
    }
  }
  // interest rate 15%
  if (!q1(`select 1 from project_interest_rates where project_id='${P}'`)) must(await api('POST', '/payments/interest-master', { project_id: P, rate_percent: L.interest.roiPercent, effective_from: '2019-01-01' }), 'interest rate');

  // payment plan: 8 rows, due dates via offset days from the booking date
  const PLAN = N + ' Plan 5-20-12.5x6';
  if (!q1(`select 1 from plan_schedule_templates where project_id='${P}' and plan_name='${sq(PLAN)}'`)) {
    for (const r of L.schedule.rows) {
      must(await api('POST', `/projects/${P}/plan-templates`, { plan_name: PLAN, installment_name: r.name, installment_type: r.n === 1 ? 'booking' : 'installment', percentage: r.pct, due_date_offset_days: daysBetween(L.dates.booking, r.due), installment_index: r.n }), 'plan row ' + r.n);
    }
  }
  // Legacy bills add-ons separately, payable on possession, with no due date and no interest. Our add-ons ride on a plan row, so a 0% "possession" row
  // (the only row type allowed 0%) carries them, due on the day legacy actually received them (2024-10-05) so it does not invent a late-payment interest.
  if (!q1(`select 1 from plan_schedule_templates where project_id='${P}' and plan_name='${sq(PLAN)}' and installment_index=9`)) {
    must(await api('POST', `/projects/${P}/plan-templates`, { plan_name: PLAN, installment_name: 'Add-on charges (possession)', installment_type: 'possession', percentage: 0, due_date_offset_days: daysBetween(L.dates.booking, L.receipts[8].date), installment_index: 9 }), 'plan row 9');
  }
  // add-on masters (18% = 9+9). Mandatory so booking puts them on the customer; billed 100% on the extra 0% possession row (9).
  const lastTpl = q1(`select id from plan_schedule_templates where project_id='${P}' and plan_name='${sq(PLAN)}' and installment_index=9`);
  const masters = [
    { name: 'External Electrification Charge @18%', b: { rateType: 'flat', defaultAmount: 90000 } },
    { name: 'Electric Meter Charge @18%', b: { rateType: 'flat', defaultAmount: 10000 } },
    { name: 'BOCW @18%', b: { rateType: 'per_sqft', ratePerSqftInr: 20, calculateRateType: 'Carpet Area' } },
    { name: 'Admin Charges @18%', b: { rateType: 'flat', defaultAmount: 15000 } },
  ];
  for (const m of masters) {
    let id = q1(`select id from addon_charge_master where project_id='${P}' and charge_name='${sq(m.name)}'`);
    if (!id) id = must(await api('POST', '/addon-charges/master', { projectId: P, chargeName: m.name, cgstPct: 9, sgstPct: 9, isMandatory: true, ...m.b }), 'addon master ' + m.name).id;
    if (!q1(`select 1 from plan_addon_charge_pct where plan_schedule_template_id='${lastTpl}' and charge_master_id='${id}'`)) must(await api('POST', `/projects/${P}/plan-templates/${lastTpl}/addon-charges`, { charge_master_id: id, pct: 100 }), 'plan addon pct ' + m.name);
  }

  // applicant
  const a = L.applicant, [first, ...rest] = a.name.replace(/^Mrs\.\s*/, '').split(' ');
  let C = q1(`select id from consumers where project_id='${P}' and mobile='${a.mobile}'`);
  if (!C) C = must(await api('POST', '/consumers', { name: a.name.replace(/^Mrs\.\s*/, ''), salutation: 'Mrs.', first_name: first, last_name: rest.join(' '), mobile: a.mobile, project_id: P, email: a.email, pan_no: a.pan, aadhaar_no: a.aadhaar, dob: a.dob, present_address: a.presentAddress, gender: 'female', communication_mode: 'courier' }), 'consumer').id;

  // booking: start pending, then confirm the payment step with receipt 1 (cheque, 131,640.00 gross). The booking form sends rate = base / carpet and carpet+balcony as "carpet".
  let BK = q1(`select id from booking_records where consumer_id='${C}' and status<>'cancelled' order by created_at desc limit 1`);
  const r1 = L.receipts[0];
  if (!BK) {
    BK = must(await api('POST', '/booking', { consumer_id: C, project_id: P, unit_id: U, selected_plan_name: PLAN, booking_date: L.dates.booking, basic_price: u.ratePerSqft, carpet_area_sqft: r2(u.carpetAreaSqft + u.balconyAreaSqft), communication_mode: 'courier' }), 'booking').id;
  }
  if (q1(`select status from booking_records where id='${BK}'`) !== 'complete') {
    must(await api('PATCH', `/booking/${BK}`, { booking_amount: r1.net, payment_mode: 'cheque', payment_ref: N.replace(/\W/g, '') + '-CHQ-1', bank_name: 'RECON Bank', cheque_date: r1.date }), 'confirm booking');
  }
  const PP = q1(`select id from payment_plans where consumer_id='${C}' order by created_at desc limit 1`);
  // receipt 1 is the booking receipt: clear it; receipts 2..8 against instalments 2..8; receipt 9 = add-on + interest (no instalment)
  const have = () => Number(q1(`select count(*) from receipts where consumer_id='${C}' and status<>'cancelled'`));
  const reg = N.replace(/\W/g, '');
  if (have() === 1) {
    for (const r of L.receipts.slice(1)) {
      const body = { consumerId: C, amountReceivedInr: Math.round(r.net) /* receipt API takes whole rupees only */, paymentDate: r.date, paymentMode: r.mode === 'Cheque' ? 'cheque' : 'online', referenceNumber: `${reg}-REF-${r.n}`, bankName: 'RECON Bank' };
      body.installmentIndex = r.n;
      if (r.n === 9) Object.assign(body, { interestAmount: r.interest, otherChargeAmount: Math.round(r.net) - r.interest, otherChargeDesc: 'Add-on charges (legacy: extra + GST)' });
      if (r.mode === 'Cheque') body.chequeNo = `${reg}-C${r.n}`;
      must(await api('POST', '/payments/receipts', body), 'receipt ' + r.n);
    }
  }
  // every real receipt cleared (the applicant file only counts cleared ones). The system-made "-ADV" overpayment receipts are left as the system made them (pending).
  for (const id of psql(`select id from receipts where consumer_id='${C}' and status not in ('cleared','cancelled') and not coalesce(is_advance,false) order by received_date, created_at`).split('\n').filter(Boolean)) {
    const d = q1(`select received_date from receipts where id='${id}'`);
    must(await api('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: d }), 'clear receipt');
  }
  return { co, P, T, U, C, BK, PP, PLAN, notes };
}

// ============================== COMPARE ==============================
const decode = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const tableRows = (html) => [...html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => decode(c[1])));
const nz = (t) => (t == null || t === '' || t === '—' || t === '--' ? null : Number(String(t).replace(/Rs\.|,|\s/g, '')));
const find = (rows, label) => rows.find((r) => r[0] && r[0].startsWith(label));

function compare(html, S) {
  const rows = tableRows(html);
  const out = []; // {sec, item, legacy, ours, note}
  const add = (sec, item, legacy, ours, note = '') => out.push({ sec, item, legacy, ours, note });
  const sm = L.summary, val = (label) => nz(find(rows, label)?.[1]);
  const less = find(rows, 'Less Receipt');
  const taxSub = rows.filter((r) => r[0]?.startsWith('CGST @')).map((r) => nz(r[1]));
  // ---- summary
  add('Summary', 'Net basic price', sm.netBasicPrice, val('Net Basic Price'));
  add('Summary', 'Other charges (legacy "Other Charges" = Balcony Charge; ours: Other + Balcony lines)', sm.otherCharges, (val('Add: Other Charges') ?? 0) + (val('Add: Balcony Charge') ?? 0), 'shown on two lines (Other Charges 0.00, Balcony 50,000)');
  add('Summary', 'Agreement value', sm.agreementValue, val('Agreement Value'));
  add('Summary', 'Add-on charges (ex-GST)', sm.addOnCharges, null /* filled below from the add-on table */);
  add('Summary', 'Total consideration', sm.totalConsideration, val('Total Consideration'));
  add('Summary', 'CGST', sm.cgst, val('CGST (Rs.)'));
  add('Summary', 'SGST', sm.sgst, val('SGST (Rs.)'));
  add('Summary', 'GST total', sm.gstTotal, (val('CGST (Rs.)') ?? 0) + (val('SGST (Rs.)') ?? 0));
  add('Summary', 'Total consideration with tax', sm.totalConsiderationWithTax, val('Total Consideration With Tax'));
  add('Summary', 'Interest', sm.interest, val('Interest (Rs.)'));
  add('Summary', 'Total receivables', sm.totalReceivables, val('Total Receivables'));
  add('Summary', 'Less receipt (paid)', sm.lessReceipt, nz(less?.[1]), 'legacy receipt table itself totals ' + L.receiptTotals.net);
  add('Summary', 'Paid %', sm.paidPercent, Number((less?.[0].match(/\(([\d.]+) %/) || [])[1]));
  add('Summary', 'Balance (negative = excess)', sm.balance, val('Balance (Rs.)'));
  // ---- schedule
  const sched = rows.filter((r) => r.length === 14 && /^\d+$/.test(r[0]));
  for (const lr of L.schedule.rows) {
    const o = sched.find((r) => Number(r[0]) === lr.n); const k = `Row ${lr.n}`;
    if (!o) { add('Schedule', `${k} present`, 1, null); continue; }
    add('Schedule', `${k} due date`, lr.due.split('-').reverse().join('/'), o[2] === '—' ? null : o[2]);
    add('Schedule', `${k} net BSP`, lr.netBsp, nz(o[4]));
    add('Schedule', `${k} other charges (ours: balcony col + other col)`, lr.otherCharges, r2(nz(o[5]) + nz(o[6])));
    add('Schedule', `${k} inst amount`, lr.instAmt, nz(o[8]));
    add('Schedule', `${k} CGST`, lr.cgst, nz(o[9]));
    add('Schedule', `${k} SGST`, lr.sgst, nz(o[10]));
    add('Schedule', `${k} net due`, lr.netDue, nz(o[11]));
  }
  const tot = rows.find((r) => r[0] === '* Total:');
  if (tot) { const t = L.schedule.totals; add('Schedule', 'Total net BSP', t.netBsp, nz(tot[2]), 'legacy sums 3 above the price'); add('Schedule', 'Total inst amount', t.instAmt, nz(tot[6])); add('Schedule', 'Total CGST', t.cgst, nz(tot[7])); add('Schedule', 'Total SGST', t.sgst, nz(tot[8])); add('Schedule', 'Total net due (rows 1-8 only)', t.netDue, r2(nz(tot[9]) - (nz(sched.find((r) => r[0] === '9')?.[11]) || 0))); add('Schedule', 'Total outstanding (all rows)', t.outstanding, nz(tot[11])); }
  // ---- add-ons
  const ao = rows.filter((r) => r.length === 11 && /^\d+$/.test(r[0]) && /@18%/.test(r[1]));
  const names = ['External Electrification', 'Electric Meter', 'BOCW', 'Admin'];
  L.addOnCharges.forEach((la, i) => {
    const o = ao.find((r) => r[1].startsWith(names[i])); const k = names[i];
    add('Add-on', `${k} net`, la.amount, nz(o?.[5])); add('Add-on', `${k} CGST`, la.cgst, nz(o?.[6])); add('Add-on', `${k} SGST`, la.sgst, nz(o?.[7])); add('Add-on', `${k} net due`, la.netDue, nz(o?.[10]));
  });
  const aoTot = rows.find((r) => r.length === 9 && r[0] === 'Total:' && /^[\d,.]+$/.test(r[1]) && nz(r[1]) > 100000);
  if (aoTot) { const t = L.addOnTotals; add('Add-on', 'Total net', t.net, nz(aoTot[1])); add('Add-on', 'Total CGST', t.cgst, nz(aoTot[4])); add('Add-on', 'Total SGST', t.sgst, nz(aoTot[5])); add('Add-on', 'Total net due', t.netDue, nz(aoTot[8])); const a = out.find((o) => o.item === 'Add-on charges (ex-GST)'); if (a) a.ours = nz(aoTot[1]); }
  // ---- receipts (net of GST "amount", cgst, sgst, gross "net")
  const rc = rows.filter((r) => r.length === 21 && /^\d+$/.test(r[0]) && !/-ADV/.test(r[1]));
  L.receipts.forEach((lr) => {
    const o = rc[lr.n - 1]; const k = `Receipt ${lr.n} (${lr.date})`;
    add('Receipt', `${k} gross`, lr.net, nz(o?.[16]), lr.n === 1 ? '' : 'receipt API takes whole rupees');
    add('Receipt', `${k} base amount`, lr.amount, nz(o?.[11]));
    add('Receipt', `${k} CGST`, lr.cgst, nz(o?.[12])); add('Receipt', `${k} SGST`, lr.sgst, nz(o?.[13]));
    add('Receipt', `${k} interest`, lr.interest, nz(o?.[14])); add('Receipt', `${k} extra`, lr.extra, nz(o?.[15]));
  });
  const rt = L.receiptTotals, rf = rows.find((r) => r[0] === 'Received Amt.:');
  if (rf) { add('Receipt', 'Totals CGST', rt.cgst, nz(rf[2])); add('Receipt', 'Totals SGST', rt.sgst, nz(rf[3])); add('Receipt', 'Totals interest', rt.interest, nz(rf[4])); add('Receipt', 'Totals extra', rt.extra, nz(rf[5])); }
  // ---- interest
  const ti = rows.find((r) => r[0] === 'TOTAL INTEREST' && r.length === 2);
  add('Interest', 'Total interest (applicant file interest table)', L.interest.total, nz(ti?.[1]));
  const late = rows.map((r) => ({ r, i: r.indexOf('15.00%') })).filter((x) => x.i > 0 && nz(x.r[x.i + 1]) > 100);
  add('Interest', 'Late instalment (row 7): days late', 2, late.length ? nz(late[0].r[late[0].i - 3]) : null);
  add('Interest', 'Late instalment (row 7): interest', 270.5, late.length ? nz(late[0].r[late[0].i + 1]) : null, 'legacy: 329121 x 15% x 2/365 = 270.5');
  const isum = rows.find((r) => r.length === 6 && /^[\d,.]+$/.test(r[0] || '') && r[0] === r[5]);
  add('Interest', 'Interest paid GST (Interest Summary PAID GST)', L.interest.paidGst, nz(isum?.[3]), 'legacy charges 1% GST on interest (271 x 1% = 2.71 -> 3)');
  // ---- other APIs
  return { out, rows, taxSub };
}

const fmt = (v) => (v == null || Number.isNaN(v) ? '(none)' : typeof v === 'number' ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(v));
function render(out) {
  let md = '', ok = 0, near = 0, bad = 0;
  let sec = '';
  for (const o of out) {
    if (o.sec !== sec) { sec = o.sec; md += `\n### ${sec}\n\n| Item | Legacy | Ours | Diff (ours - legacy) | Result |\n|---|---:|---:|---:|---|\n`; }
    const numeric = typeof o.legacy === 'number' && typeof o.ours === 'number';
    const d = numeric ? r2(o.ours - o.legacy) : null;
    const res = numeric ? (Math.abs(d) <= 0.005 ? 'MATCH' : Math.abs(d) <= 1 ? 'MATCH (<= Rs 1 rounding)' : 'DIFFERS') : (o.legacy === o.ours ? 'MATCH' : 'DIFFERS');
    if (res === 'MATCH') ok++; else if (res.startsWith('MATCH')) near++; else bad++;
    md += `| ${o.item}${o.note ? ' (' + o.note + ')' : ''} | ${fmt(o.legacy)} | ${fmt(o.ours)} | ${d == null ? '' : fmt(d)} | ${res} |\n`;
  }
  return { md, ok, near, bad };
}

async function main() {
  const S = await setup();
  const html = (await api('GET', `/consumers/${S.C}/applicant-file`)).text;
  writeFileSync(join(HERE, 'applicant-file-2191.html'), html);
  const { out, rows, taxSub } = compare(html, S);
  const { md, ok, near, bad } = render(out);
  // other APIs: demands, receipt-form, receipt rows straight from the DB
  const dem = psql(`select installment_index||'|'||coalesce(due_date::text,'')||'|'||amount_due_inr||'|'||cgst_amount||'|'||sgst_amount||'|'||addon_charge_amount||'|'||addon_cgst_amount||'|'||addon_sgst_amount||'|'||status from demands where payment_plan_id='${S.PP}' order by 1`);
  const rf = (await api('GET', `/payments/receipt-form/${S.C}`)).text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
  const rfm = decode(rf).match(/Unit Cost: ([\d,.]+) S\. Tax: ([\d,.]+) GST: ([\d,.]+) Total Cost: ([\d,.]+) Paid: ([\d,.-]+) Balance: ([\d,.-]+) Interest: ([\d,.]+)/);
  const adv = psql(`select count(*)||' receipts, '||coalesce(sum(amount_received_inr),0)||' rupees, status '||string_agg(distinct status,',') from receipts where consumer_id='${S.C}' and is_advance`);
  const extra = `\n### Raw: demands (installment|due|amount|cgst|sgst|addon|addon cgst|addon sgst|status)\n\n\`\`\`\n${dem}\n\`\`\`\n\n### Receipt form (GET /payments/receipt-form/:id) header\n\n\`\`\`\n${rfm ? rfm.slice(1).join(' | ') : 'not parsed'}\n(Unit Cost | S.Tax | GST | Total Cost | Paid | Balance | Interest)\n\`\`\`\n\nSystem-made overpayment ("-ADV") receipts: ${adv}\n`;
  const head = `# Generated by reconcile-2191.mjs on ${new Date().toISOString()}\n\nCustomer id ${S.C}, booking ${S.BK}, project "${N} ROF ALANTE".\n\nMATCH ${ok}, MATCH within Rs 1 ${near}, DIFFERS ${bad}, total ${out.length}\n`;
  writeFileSync(join(HERE, 'results.md'), head + md + extra);
  log(head + md + extra);
}
export { setup, api, psql, q1, L, B, r2, daysBetween, N };
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
