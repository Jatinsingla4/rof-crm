// TDS challans and the receipt process: roles, hostile input, the challan balance (assigned never above the amount, never negative),
// parallel assigns, what a cancelled / bounced receipt gives back, files, project scope, journals and a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-tds.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local'), tokAF = await login('accounts_finance@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(tokAF);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
let r, r2;

// ---------- set-up: two projects, plan, GST, buyers with receipts ----------
const co = (await A('POST', '/companies', { name: 'TDS Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Tds ${tag} ${U}`, reraNumber: `TD${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tw(P1), T2 = await tw(P2);
let un = 0; const unit = async (P, T) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `D${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN1 = await plan(P1, 'TdsPlan ' + U, [20, 30, 50]), PLAN2 = await plan(P2, 'TdsPlanB ' + U, [100]);
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `TD ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const made = [], challans = []; let ap = 0;
const person = async (P) => { const x = await A('POST', '/consumers', { name: `Tds Buyer ${++ap} ${U}`, mobile: mob(), project_id: P }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };
const buyer = async (P = P1, T = T1) => {   // completed booking: an applicant, a unit, a plan and a booking receipt
  const c = await person(P), u = await unit(P, T);
  const x = await A('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: P === P1 ? PLAN1 : PLAN2, booking_date: today }); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await A('PATCH', `/booking/${x.j.data.id}`, { booking_amount: 10000, payment_mode: 'cash' }); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  return { c, u, id: x.j.data.id };
};
let rn = 0;
const receipt = async (S, amount = 5000, idx = 1) => { const x = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: amount, paymentMode: 'neft', referenceNumber: `TD${U}R${++rn}`, paymentDate: today, installmentIndex: idx }); if (x.s !== 200 && x.s !== 201) throw new Error('receipt ' + JSON.stringify(x)); return x.j.receipt?.id || x.j.data?.id; };
let cn = 0;
const newChallan = async (amount = 1000, extra = {}, who = A) => { const x = await who('POST', '/payments/tds/challans', { challanNumber: `CH${U}${++cn}`, challanDate: today, amount, bankName: 'SBI', ...extra }); if (x.s === 201) challans.push(x.j.data.id); return x; };
const assign = (ch, rc, amount, who = A) => who('POST', '/payments/tds/assign', { challanId: ch, receiptId: rc, amount });
const ch = (id, col) => psql(`select ${col} from tds_challans where id='${id}'`);
const bal = (id) => Number(psql(`select amount - assigned_amount from tds_challans where id='${id}'`));
const liveSum = (id) => Number(psql(`select coalesce(sum(amount_assigned),0) from tds_assignments where challan_id='${id}' and released_at is null`));
const consistent = (id) => Number(ch(id, 'assigned_amount')) === liveSum(id) && Number(ch(id, 'assigned_amount')) >= 0 && Number(ch(id, 'assigned_amount')) <= Number(ch(id, 'amount'));
const S1 = await buyer(), S2 = await buyer(), S3 = await buyer(), SP2 = await buyer(P2, T2);
const afId = psql(`select id from users where email='accounts_finance@test.local'`);

// ---------- roles ----------
{
  const rc = await receipt(S1, 5000); const c1 = (await newChallan(1000)).j.data.id;
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) {
    r = await newChallan(500, {}, who); t(`roles: ${n} cannot add a challan -> 403`, r.s === 403, r.s);
    r = await assign(c1, rc, 100, who); t(`roles: ${n} cannot assign a challan -> 403`, r.s === 403, r.s);
  }
  r = await assign(c1, rc, 100, AF); t('roles: accounts_finance can assign', r.s === 200, r.s + JSON.stringify(r.j)); const aid = r.j.data?.id;
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await who('POST', `/payments/tds/assignments/${aid}/release`, {}); t(`roles: ${n} cannot release -> 403`, r.s === 403, r.s); }
  t('roles: refused calls changed nothing', bal(c1) === 900 && consistent(c1));
  r = await newChallan(500, {}, AF); t('roles: accounts_finance can add a challan', r.s === 201, r.s + JSON.stringify(r.j));
  r = await A('POST', `/payments/tds/assignments/${aid}/release`, {}); t('roles: super_admin can release', r.s === 200, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM], ['accounts_finance', AF], ['super_admin', A]]) {
    for (const p of ['/payments/tds/challans', `/payments/tds/challans/${c1}`, '/payments/tds/receipts?search=Tds', '/payments/journals']) { r = await who('GET', p); t(`roles: ${n} can read ${p.split('?')[0].replace(c1, ':id')}`, r.s === 200, r.s); }
  }
  for (const m of [['GET', '/payments/tds/challans'], ['POST', '/payments/tds/challans'], ['POST', '/payments/tds/assign'], ['GET', '/payments/journals']]) { r = await fetch(B + m[1], { method: m[0] }); t(`roles: no login ${m[0]} ${m[1]} -> 401`, r.status === 401, r.status); }
}

// ---------- a challan: hostile input ----------
{
  const n0 = Number(psql(`select count(*) from tds_challans where challan_number like 'X${U}%'`));
  const bad = async (n, bd, code = 400) => { const x = await A('POST', '/payments/tds/challans', { challanNumber: `X${U}${++cn}`, challanDate: today, amount: 100, ...bd }); t(`challan: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); if (x.s === 201) challans.push(x.j.data.id); return x; };
  r = await A('POST', '/payments/tds/challans'); t('challan: no body -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/tds/challans', undefined, '[1,2]'); t('challan: array body -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/tds/challans', undefined, '{bad'); t('challan: broken JSON -> 400', r.s === 400, r.s);
  for (const k of ['challanNumber', 'challanDate', 'amount']) await bad(`${k} missing`, { [k]: undefined });
  for (const v of ['', '   ', 'n'.repeat(51), '<b>x</b>', 'a;drop table x', "a'b", 'x\ny', '/lead', '-lead', 12, [1], {}, true, '‮evil']) await bad(`challanNumber ${JSON.stringify(v).slice(0, 20)}`, { challanNumber: v });
  for (const v of [0, -1, '-5', 'abc', '1e3', '0x10', 1e12, true, [5], {}, 0.001, '10.999', null, '', ' 5 ']) await bad(`amount ${JSON.stringify(v)}`, { amount: v });
  for (const v of ['2999-01-01', later(3), '2020-02-30', 'abc', 20250101, '01/02/2025', '1980-01-01', '', [today]]) await bad(`challanDate ${JSON.stringify(v)}`, { challanDate: v });
  await bad('bsrCode "abc"', { bsrCode: 'abc' }); await bad('bsrCode 8 digits', { bsrCode: '12345678' }); await bad('bankName 256 chars', { bankName: 'b'.repeat(256) }); await bad('bankName with <b>', { bankName: '<b>' });
  await bad('fileUrl sent as an address', { fileUrl: 'http://evil.example/x.pdf' });
  t('challan: nothing saved by all the refused calls', Number(psql(`select count(*) from tds_challans where challan_number like 'X${U}%'`)) === n0);
  r = await bad('amount 0.01 (smallest) is fine', { amount: 0.01 }, 201); t('challan: smallest amount kept exactly', Number(ch(r.j.data.id, 'amount')) === 0.01);
  r = await bad('amount 999999999.99 (largest) is fine', { amount: 999999999.99 }, 201);
  r = await bad('amount "1234.5" as text is fine', { amount: '1234.5' }, 201); t('challan: text amount stored as a number', Number(ch(r.j.data.id, 'amount')) === 1234.5);
  r = await bad('optional fields empty is fine', { bankName: '', bsrCode: undefined }, 201); t('challan: a new challan is available with nothing assigned', r.j.data.status === 'available' && Number(r.j.data.balance) === 100 && Number(r.j.data.assigned_amount) === 0);
  const no = `Dup${U}`; r = await newChallan(100, { challanNumber: no }); t('challan: a number is accepted once', r.s === 201, r.s);
  for (const v of [no, no.toUpperCase(), no.toLowerCase()]) { r = await newChallan(100, { challanNumber: v }); t(`challan: the same number again ${v === no ? '' : '(other case) '}-> 400`, r.s === 400, r.s + JSON.stringify(r.j)); }
  const rr = await Promise.all([1, 2, 3, 4, 5].map(() => newChallan(100, { challanNumber: `Race${U}` })));
  t('challan: 5 parallel with one number -> exactly one saved, no 5xx', rr.filter(x => x.s === 201).length === 1 && rr.every(x => x.s < 500), rr.map(x => x.s).join());
  r = await A('GET', '/payments/tds/challans/abc'); t('challan: id "abc" -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/tds/challans/${NIL}`); t('challan: unknown id -> 404', r.s === 404, r.s);
}

// ---------- the scanned file ----------
{
  const up = async (fields, file, name = 'scan.pdf', type = 'application/pdf', who = tokA) => {
    const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    if (file) fd.append('file', new Blob([file], { type }), name);
    const x = await fetch(B + '/payments/tds/challans', { method: 'POST', headers: { authorization: 'Bearer ' + who }, body: fd }); let j = null; try { j = await x.json(); } catch {} if (x.status === 201) challans.push(j.data.id); return { s: x.status, j };
  };
  const f = () => ({ challanNumber: `F${U}${++cn}`, challanDate: today, amount: '250.50', bankName: 'HDFC' });
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 65)]), png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), Buffer.alloc(100)]), jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  r = await up(f(), pdf); t('file: a PDF is accepted with the form fields', r.s === 201 && r.j.data.has_file === true && Number(r.j.data.amount) === 250.5, r.s + JSON.stringify(r.j));
  const id = r.j.data?.id;
  r2 = await fetch(B + `/payments/tds/challans/${id}/file`, { headers: { authorization: 'Bearer ' + tokA } }); const body = Buffer.from(await r2.arrayBuffer());
  t('file: it comes back byte for byte as a PDF, nosniff', r2.status === 200 && r2.headers.get('content-type') === 'application/pdf' && body.equals(pdf) && r2.headers.get('x-content-type-options') === 'nosniff', r2.status + r2.headers.get('content-type'));
  r2 = await fetch(B + `/payments/tds/challans/${id}/file`); t('file: no login -> 401', r2.status === 401, r2.status);
  r2 = await fetch(B + `/payments/tds/challans/${id}/file`, { headers: { authorization: 'Bearer ' + (await login('read_only_viewer@test.local')) } }); t('file: a viewer can open it', r2.status === 200, r2.status);
  r = await up(f(), png, 'a.png', 'image/png'); t('file: a PNG is accepted', r.s === 201, r.s); r = await up(f(), jpg, 'a.jpg', 'image/jpeg'); t('file: a JPEG is accepted', r.s === 201, r.s);
  r = await up(f(), Buffer.from('plain text'), 'a.pdf', 'application/pdf'); t('file: text named .pdf -> 400 (type is read from the bytes)', r.s === 400, r.s);
  r = await up(f(), Buffer.from('<html><script>alert(1)</script>'), 'a.png', 'image/png'); t('file: HTML named .png -> 400', r.s === 400, r.s);
  r = await up(f(), Buffer.from('MZ' + 'x'.repeat(100)), 'a.exe', 'application/pdf'); t('file: an executable -> 400', r.s === 400, r.s);
  r = await up(f(), Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5.5 * 1024 * 1024)])); t('file: more than 5 MB -> 400', r.s === 400, r.s + JSON.stringify(r.j));
  r = await up({ ...f(), amount: '-1' }, pdf); t('file: with a bad amount nothing is saved -> 400', r.s === 400, r.s);
  r = await up(f(), pdf, '<img src=x onerror=alert(1)>.pdf'); t('file: a hostile file name is cleaned', r.s === 201 && !/[<>]/.test(r.j.data.file_name), r.j?.data?.file_name);
  r = await up(f(), null); t('file: no file at all is fine', r.s === 201 && r.j.data.has_file === false, r.s);
  r2 = await fetch(B + `/payments/tds/challans/${r.j.data.id}/file`, { headers: { authorization: 'Bearer ' + tokA } }); t('file: a challan without a file -> 404', r2.status === 404, r2.status);
  r = await up(f(), pdf, 'a.pdf', 'application/pdf', await login('sales_executive@test.local')); t('file: a sales executive cannot upload -> 403', r.s === 403, r.s);
}

// ---------- assign: bad input and refusals ----------
{
  const rc = await receipt(S1, 5000), c = (await newChallan(1000)).j.data.id;
  r = await A('POST', '/payments/tds/assign'); t('assign: no body -> 400', r.s === 400, r.s);
  for (const k of ['challanId', 'receiptId', 'amount']) { r = await A('POST', '/payments/tds/assign', { challanId: c, receiptId: rc, amount: 10, [k]: undefined }); t(`assign: ${k} missing -> 400`, r.s === 400, r.s); }
  for (const k of ['challanId', 'receiptId']) for (const v of ['abc', 5, [], {}, true]) { r = await A('POST', '/payments/tds/assign', { challanId: c, receiptId: rc, amount: 10, [k]: v }); t(`assign: ${k} ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  for (const v of [0, -1, 'abc', '1e3', 1e12, true, [5], 0.001, '', null, '10.999']) { r = await assign(c, rc, v); t(`assign: amount ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await assign(NIL, rc, 10); t('assign: challan that does not exist -> 404', r.s === 404, r.s);
  r = await assign(c, NIL, 10); t('assign: receipt that does not exist -> 404', r.s === 404, r.s);
  r = await assign(c, rc, 1000.01); t('assign: more than the challan has -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  r = await assign(c, rc, 5000.5); t('assign: more than the receipt -> 409 (or the challan)', r.s === 409, r.s);
  t('assign: nothing moved by the refused calls', bal(c) === 1000 && consistent(c) && psql(`select count(*) from tds_assignments where challan_id='${c}'`) === '0');
  r = await assign(c, rc, 100.5); t('assign: paise are kept', r.s === 200 && Number(r.j.data.amount_assigned) === 100.5 && Number(ch(c, 'assigned_amount')) === 100.5, r.s + JSON.stringify(r.j));
  t('assign: the assignment belongs to the receipt\'s applicant and records who did it', r.j.data.consumer_id === S1.c && r.j.data.assigned_by);
  r = await assign(c, rc, 10); t('assign: the same challan on the same receipt again -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  t('assign: the challan is "partially_assigned"', ch(c, 'status') === 'partially_assigned');
  r = await assign(c, await receipt(S2, 5000), 899.5); t('assign: exactly what is left is accepted on another receipt', r.s === 200, r.s + JSON.stringify(r.j));
  t('assign: the challan is now "fully_assigned" with 0 left', ch(c, 'status') === 'fully_assigned' && bal(c) === 0 && consistent(c));
  r = await assign(c, await receipt(S2, 5000), 0.01); t('assign: a paisa more than a full challan -> 409', r.s === 409, r.s);
  // receipt side: TDS on a receipt cannot exceed the receipt
  const small = await receipt(S3, 300), big = (await newChallan(1000)).j.data.id, big2 = (await newChallan(1000)).j.data.id;
  r = await assign(big, small, 300.01); t('assign: TDS above the receipt amount -> 409', r.s === 409, r.s);
  r = await assign(big, small, 200); r2 = await assign(big2, small, 100.01); t('assign: two challans together above the receipt -> 409', r.s === 200 && r2.s === 409, r.s + ' ' + r2.s);
  r = await assign(big2, small, 100); t('assign: two challans together exactly the receipt -> ok', r.s === 200, r.s);
  t('assign: both challans consistent', consistent(big) && consistent(big2));
  // dead receipts
  const rcx = await receipt(S3, 800), rcb = await receipt(S3, 800), cd = (await newChallan(5000)).j.data.id;
  await A('POST', `/payments/receipts/${rcx}/cancel`, { reason: 'test' }); await A('PATCH', `/payments/receipts/${rcb}/bounce`, { reason: 'test', penaltyAmount: 0 });
  r = await assign(cd, rcx, 10); t('assign: a cancelled receipt -> 409', r.s === 409, r.s + JSON.stringify(r.j)); r = await assign(cd, rcb, 10); t('assign: a bounced receipt -> 409', r.s === 409, r.s);
  t('assign: dead receipts took nothing', bal(cd) === 5000);
  // other project, with a user who sees only project 1
  const cs = (await newChallan(1000)).j.data.id, rp2 = await receipt(SP2, 500), rp1 = await receipt(S1, 500);
  await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [P1] });
  try {
    r = await assign(cs, rp2, 10, AF); t('scope: a receipt of another project -> 404 for a user of project 1', r.s === 404, r.s + JSON.stringify(r.j));
    r = await assign(cs, rp1, 10, AF); t('scope: a receipt of their own project works', r.s === 200, r.s + JSON.stringify(r.j));
    r = await AF('GET', '/payments/tds/receipts?search=' + encodeURIComponent('Tds Buyer')); t('scope: receipt search shows only their project', r.s === 200 && r.j.data.length > 0 && !r.j.data.some(x => x.id === rp2), r.s);
  } finally { await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] }); }
  t('scope: the refused assign took nothing, challan consistent', consistent(cs) && bal(cs) === 990);
}

// ---------- the money: release, cancel, bounce ----------
{
  const rc = await receipt(S1, 5000), rc2 = await receipt(S2, 5000), c = (await newChallan(1000)).j.data.id;
  r = await assign(c, rc, 400); const a1 = r.j.data.id; r = await assign(c, rc2, 600); const a2 = r.j.data.id;
  t('money: 400 + 600 on a 1000 challan -> fully assigned, balance 0', ch(c, 'status') === 'fully_assigned' && bal(c) === 0);
  r = await A('POST', `/payments/tds/assignments/${a1}/release`, { reason: 'wrong receipt' }); t('release: 200', r.s === 200, r.s);
  t('release: the 400 is back, status partially assigned, row kept as history', bal(c) === 400 && ch(c, 'status') === 'partially_assigned' && psql(`select release_reason from tds_assignments where id='${a1}'`) === 'wrong receipt' && consistent(c));
  r = await A('POST', `/payments/tds/assignments/${a1}/release`, {}); t('release: twice -> 409, balance unchanged', r.s === 409 && bal(c) === 400, r.s);
  r = await A('POST', `/payments/tds/assignments/${NIL}/release`, {}); t('release: unknown id -> 404', r.s === 404, r.s); r = await A('POST', '/payments/tds/assignments/abc/release', {}); t('release: id "abc" -> 400', r.s === 400, r.s);
  r = await A('POST', `/payments/tds/assignments/${a2}/release`, { reason: 'x'.repeat(201) }); t('release: a reason over 200 characters -> 400', r.s === 400, r.s);
  r = await assign(c, rc, 400); t('release: after a release the same challan can go to the same receipt again', r.s === 200 && bal(c) === 0, r.s + JSON.stringify(r.j));
  // cancel and bounce give the amount back
  r = await A('POST', `/payments/receipts/${rc2}/cancel`, { reason: 'wrong' }); t('cancel: the receipt is cancelled', r.s === 200, r.s + JSON.stringify(r.j));
  t('cancel: its 600 went back to the challan, history row says why', bal(c) === 600 && consistent(c) && psql(`select release_reason from tds_assignments where id='${a2}'`) === 'Receipt cancelled', bal(c));
  const rb = await receipt(S3, 3000), cb = (await newChallan(1000)).j.data.id; await assign(cb, rb, 700);
  r = await A('PATCH', `/payments/receipts/${rb}/bounce`, { reason: 'insufficient', penaltyAmount: 0 }); t('bounce: the receipt is bounced', r.s === 200, r.s + JSON.stringify(r.j));
  t('bounce: its 700 went back to the challan', bal(cb) === 1000 && ch(cb, 'status') === 'available' && consistent(cb), bal(cb));
  r = await assign(c, rc2, 10); t('cancel: and the cancelled receipt cannot be assigned again', r.s === 409, r.s);
  // detail and report
  r = await A('GET', `/payments/tds/challans/${c}`); t('detail: lists live and released assignments with receipt number and applicant', r.s === 200 && r.j.data.assignments.length === 3 && r.j.data.assignments.every(x => x.receipt_number && x.consumer_name) && r.j.data.assignments.filter(x => x.released_at).length === 2, r.s + JSON.stringify(r.j).slice(0, 150));
  t('detail: balance matches the database', Number(r.j.data.balance) === bal(c) && Number(r.j.data.assigned_amount) === Number(ch(c, 'assigned_amount')));
  // a receipt that cancels while assigns run in parallel
  const rp = await receipt(S2, 5000), cp = (await newChallan(1000)).j.data.id;
  const res = await Promise.all([...[1, 2, 3].map(() => assign(cp, rp, 100)), A('POST', `/payments/receipts/${rp}/cancel`, { reason: 'race' })]);
  t('race: assigns against a cancel -> no 5xx', res.every(x => x.s < 500), res.map(x => x.s).join());
  t('race: afterwards the challan holds nothing of the cancelled receipt', consistent(cp) && psql(`select count(*) from tds_assignments where receipt_id='${rp}' and released_at is null`) === '0' && bal(cp) === 1000, `${bal(cp)} ${psql(`select count(*) from tds_assignments where receipt_id='${rp}' and released_at is null`)}`);
}

// ---------- parallel assigns ----------
{
  const c = (await newChallan(1000)).j.data.id, rcs = []; for (let i = 0; i < 5; i++) rcs.push(await receipt(S1, 1000, 1));
  const out = await Promise.all(rcs.map(rc => assign(c, rc, 300)));
  t('race: 5 parallel assigns of 300 on a 1000 challan -> exactly 3 win, none 5xx', out.filter(x => x.s === 200).length === 3 && out.every(x => x.s === 200 || x.s === 409), out.map(x => x.s).join());
  t('race: 900 assigned, 100 left, never negative', bal(c) === 100 && consistent(c), bal(c));
  const rc = rcs[0], c2 = (await newChallan(1000)).j.data.id; const same = await Promise.all([1, 2, 3, 4, 5].map(() => assign(c2, rc, 100)));
  t('race: the same challan on one receipt 5 times -> one wins', same.filter(x => x.s === 200).length === 1 && same.every(x => x.s < 500) && consistent(c2), same.map(x => x.s).join());
  const c3 = (await newChallan(500)).j.data.id, rr = await receipt(S2, 5000); const two = await Promise.all([assign(c3, rr, 500), assign(c3, rr, 500)]);
  t('race: the same call twice at once -> one wins', two.filter(x => x.s === 200).length === 1 && consistent(c3), two.map(x => x.s).join());
}

// ---------- the report: filters, totals ----------
{
  const tag = `Rep${U}`, c1 = (await newChallan(1000, { challanNumber: `${tag}-1`, bankName: 'Axis Bank' })).j.data.id, c2 = (await newChallan(2000, { challanNumber: `${tag}-2`, bankName: 'ICICI' })).j.data.id; await newChallan(500, { challanNumber: `${tag}-3`, bankName: 'ICICI' });
  await assign(c1, await receipt(S1, 5000), 1000); await assign(c2, await receipt(S2, 5000), 750);
  r = await A('GET', `/payments/tds/challans?search=${tag}`); t('report: search by challan number finds the 3', r.s === 200 && r.j.data.length === 3 && r.j.total === 3, r.s + ' ' + r.j.total);
  t('report: totals are amount 3500, assigned 1750, balance 1750 and equal the assignments', Number(r.j.totals.amount) === 3500 && Number(r.j.totals.assigned) === 1750 && r.j.totals.balance === 1750 && Number(psql(`select coalesce(sum(a.amount_assigned),0) from tds_assignments a join tds_challans c on c.id=a.challan_id where c.challan_number like '${tag}%' and a.released_at is null`)) === 1750, JSON.stringify(r.j.totals));
  t('report: each row has balance = amount - assigned', r.j.data.every(x => Math.abs(Number(x.balance) - (Number(x.amount) - Number(x.assigned_amount))) < 0.001));
  for (const [s, n] of [['available', 1], ['partially_assigned', 1], ['fully_assigned', 1]]) { r = await A('GET', `/payments/tds/challans?search=${tag}&status=${s}`); t(`report: status ${s} -> ${n}`, r.s === 200 && r.j.data.length === n && r.j.data.every(x => x.status === s), r.s + ' ' + r.j.data?.length); }
  r = await A('GET', `/payments/tds/challans?search=${tag}&status=all`); t('report: status all -> 3', r.j.data.length === 3);
  r = await A('GET', '/payments/tds/challans?search=ICICI'); t('report: search by bank', r.s === 200 && r.j.data.some(x => x.challan_number === `${tag}-2`), r.s);
  r = await A('GET', '/payments/tds/challans?search=' + encodeURIComponent('%')); t('report: a "%" is a letter, not a wildcard', r.s === 200 && r.j.data.length === 0, r.s + ' ' + r.j.data?.length);
  for (const q of ['status=weird', 'status[]=a', 'page=0', 'page=abc', 'pageSize=0', 'pageSize=501', 'pageSize=-1', 'pageSize=1;drop', 'search=' + 'x'.repeat(101), 'search[]=a']) { r = await A('GET', '/payments/tds/challans?' + q); t(`report: ?${q.slice(0, 22)} -> 400`, r.s === 400, r.s); }
  r = await A('GET', `/payments/tds/challans?search=${tag}&pageSize=2&page=2`); t('report: paging', r.s === 200 && r.j.data.length === 1 && r.j.total === 3, r.s);
  r = await A('GET', '/payments/tds/receipts?search=x'); t('receipt search: under 2 letters -> empty list', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', '/payments/tds/receipts?search=' + encodeURIComponent("' OR 1=1 --")); t('receipt search: SQL text is just text', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', '/payments/tds/receipts?search=' + encodeURIComponent('Tds Buyer 1 ' + U)); t('receipt search: by applicant name', r.s === 200 && r.j.data.length >= 1 && r.j.data[0].receipt_number, r.s + JSON.stringify(r.j).slice(0, 100));
}

// ---------- journals (receipt process) ----------
{
  const je = (b, who = A) => who('POST', '/payments/journals', b);
  r = await A('POST', '/payments/journals'); t('journal: no body -> 400', r.s === 400, r.s);
  for (const [n, b] of [['consumerId "abc"', { consumerId: 'abc', ledgerHead: 'Discount', debitAmount: 10 }], ['ledgerHead missing', { consumerId: S1.c, debitAmount: 10 }], ['ledgerHead with <b>', { consumerId: S1.c, ledgerHead: '<b>', debitAmount: 10 }], ['no amount', { consumerId: S1.c, ledgerHead: 'Discount' }], ['amount -5', { consumerId: S1.c, ledgerHead: 'Discount', debitAmount: -5 }], ['amount "abc"', { consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 'abc' }], ['amount 1e12', { consumerId: S1.c, ledgerHead: 'Discount', creditAmount: 1e12 }], ['debit and credit both', { consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 5, creditAmount: 5 }], ['date 2020-02-30', { consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 5, entryDate: '2020-02-30' }], ['remarks 501 chars', { consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 5, remarks: 'r'.repeat(501) }]]) { r = await je(b); t(`journal: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 90)); }
  r = await je({ consumerId: NIL, ledgerHead: 'Discount', debitAmount: 5 }); t('journal: unknown applicant -> 404', r.s === 404, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await je({ consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 5 }, who); t(`journal: ${n} cannot add -> 403`, r.s === 403, r.s); }
  r = await je({ consumerId: S1.c, ledgerHead: 'Discount', debitAmount: 12.5, remarks: 'ok' }); t('journal: a good entry is saved as pending with paise', r.s === 201 && r.j.data.status === 'pending' && Number(r.j.data.debit_amount) === 12.5, r.s + JSON.stringify(r.j).slice(0, 120)); const jid = r.j.data?.id;
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('PATCH', `/payments/journals/${jid}/approve`, {}); t(`journal: ${n} cannot approve -> 403`, r.s === 403, r.s); }
  r = await A('PATCH', `/payments/journals/${jid}/reject`, {}); t('journal: reject without a reason -> 400', r.s === 400, r.s);
  r = await A('PATCH', '/payments/journals/abc/approve', {}); t('journal: approve id "abc" -> 400', r.s === 400, r.s);
  r = await A('PATCH', `/payments/journals/${jid}/approve`, {}); t('journal: super_admin approves', r.s === 200 && r.j.data.status === 'approved', r.s);
  r = await A('PATCH', `/payments/journals/${jid}/approve`, {}); t('journal: approving again -> 404', r.s === 404, r.s);
  r = await A('GET', `/payments/journals/${jid}`); t('journal: opens with the applicant name', r.s === 200 && r.j.data.consumer_name, r.s); r = await A('GET', '/payments/journals/abc'); t('journal: id "abc" -> 400', r.s === 400, r.s);
  for (const q of ['pageSize=1;drop table x', 'pageSize=0', 'pageSize=501', 'page=-1', 'consumerId=abc']) { r = await A('GET', '/payments/journals?' + q); t(`journal list: ?${q} -> 400 (it used to go into the SQL as text)`, r.s === 400, r.s); }
  r = await A('GET', `/payments/journals?consumerId=${S1.c}`); t('journal list: by applicant', r.s === 200 && r.j.data.some(x => x.id === jid), r.s);
}

// ---------- a transfer takes the TDS with the receipts ----------
{
  const S = await buyer(), nb = await person(P1), rc = await receipt(S, 4000), c = (await newChallan(1000)).j.data.id; await assign(c, rc, 250);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: nb, transferNo: `TD${U}x` }); t('transfer: unit transferred', r.s === 201, r.s + JSON.stringify(r.j).slice(0, 100));
  t('transfer: the assignment now belongs to the buyer, balance unchanged', psql(`select consumer_id from tds_assignments where receipt_id='${rc}' and released_at is null`) === nb && bal(c) === 750 && consistent(c));
}

// ---------- random run ----------
{
  const cs = [], rs_ = []; for (let i = 0; i < 4; i++) cs.push((await newChallan(ri(1, 20) * 100 + pick([0, 0.5, 0.25]))).j.data.id);
  for (let i = 0; i < 6; i++) rs_.push({ id: await receipt(pick([S1, S2, S3]), ri(1, 20) * 100), live: true });
  let bad5 = 0, steps = 0;
  for (let i = 0; i < 60; i++) {
    const op = ri(1, 10), rc = pick(rs_), c = pick(cs);
    if (op <= 6) { r = await assign(c, rc.id, pick([ri(1, 900), ri(1, 90000) / 100, 0, -3, 'x'])); }
    else if (op <= 8) { const a = psql(`select id from tds_assignments where challan_id='${c}' and released_at is null limit 1`); r = a ? await A('POST', `/payments/tds/assignments/${a}/release`, {}) : { s: 0 }; }
    else if (op === 9 && rc.live && rs_.filter(x => x.live).length > 3) { r = await A('POST', `/payments/receipts/${rc.id}/cancel`, { reason: 'random' }); rc.live = false; }
    else r = await A('GET', '/payments/tds/challans?search=' + pick(['CH', 'SBI', 'zz']));
    steps++; if (r.s >= 500) bad5++;
  }
  t(`random: ${steps} steps (seed ${SEED}), no 5xx`, bad5 === 0, bad5);
  t('random: every challan consistent (assigned = live assignments, 0 <= assigned <= amount)', cs.every(consistent), cs.filter(x => !consistent(x)).join());
  const mine = made.map(x => `'${x}'`).join(',');
  t('random: no live assignment sits on a cancelled receipt', psql(`select count(*) from tds_assignments a join receipts r on r.id=a.receipt_id where a.released_at is null and r.status in ('cancelled','bounced') and r.consumer_id in (${mine})`) === '0');
  t('random: no receipt carries more TDS than its amount', psql(`select count(*) from (select r.id from receipts r join tds_assignments a on a.receipt_id=r.id and a.released_at is null where r.consumer_id in (${mine}) group by r.id, r.amount_received_inr having sum(a.amount_assigned) > r.amount_received_inr) q`) === '0');
}

// ---------- audit ----------
t('audit: challans, assignments and releases are logged', Number(psql(`select count(*) from audit_logs where resource_type in ('tds_challan','tds_assignment') and timestamp > now() - interval '1 hour'`)) > 10);

// ---------- clean up ----------
await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] });
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(','), cids = challans.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from audit_logs where resource_type in ('tds_challan','tds_assignment') and resource_id in (select id from tds_challans where id in (${cids}) union select id from tds_assignments where challan_id in (${cids}))`,
    `delete from tds_assignments where challan_id in (${cids}) or consumer_id in (${ids})`, `delete from tds_challans where id in (${cids})`,
    `delete from journal_entries where consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('ownership_transfer') and resource_id in (select id from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids}))`, `delete from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
