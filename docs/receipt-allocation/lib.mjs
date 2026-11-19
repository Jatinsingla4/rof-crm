// Helpers for the receipt-allocation tests (made for the local tear-apart review); needs psql on the PATH with the PG* variables set.
import { execFileSync } from 'node:child_process';
export const B = process.env.BASE || 'http://localhost:3002/api';
export const psql = (sql) => execFileSync('psql', ['-qAt', '-F', ' | ', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();   // the connection comes from PGHOST / PGUSER / PGPASSWORD / PGDATABASE, as in CI
export const psqlTry = (sql) => { try { return { ok: true, out: psql(sql) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message).split('\n').find((l) => /ERROR/.test(l)) || String(e.message).slice(0, 200) }; } };
export const login = async (email, pw = 'Test#Pass1234') => { const r = await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pw }) }); const j = await r.json().catch(() => ({})); return j.token; };
export const caller = (tok) => async (m, p, b, extra = {}) => { let r; try { r = await fetch(B + p, { signal: AbortSignal.timeout(30000), method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...extra }, body: b === undefined ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)) }); } catch (e) { return { s: 0, j: null, txt: 'TIMEOUT or network error: ' + (e.cause?.code || e.name) }; } let j = null, txt = ''; try { txt = await r.text(); j = JSON.parse(txt); } catch {} return { s: r.status, j, txt }; };
// exact money: work in integer paise with BigInt, never floating point
export const paise = (v) => { const s = String(v).trim(); const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s); if (!m) throw new Error('not a money value: ' + s); const frac = (m[3] || '').padEnd(2, '0'); if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) throw new Error('more than 2 decimals: ' + s); return BigInt(m[2] + frac.slice(0, 2)) * (m[1] ? -1n : 1n); };
export const rupees = (p) => { const neg = p < 0n; const a = neg ? -p : p; return (neg ? '-' : '') + (a / 100n).toString() + '.' + (a % 100n).toString().padStart(2, '0'); };
export const U = Date.now().toString(36).slice(-5);
export const findings = [];
export const note = (id, sev, title, detail) => { findings.push({ id, sev, title, detail }); console.log(`FINDING ${id} [${sev}] ${title}\n   ${detail}`); };
let pass = 0, fail = 0;
export const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + String(x).slice(0, 400))); };
export const tally = () => `${pass} passed, ${fail} failed`;
let envOnce;   // one set of logins per run: every block of a test file shares it
export const env = () => (envOnce ??= makeEnv());
async function makeEnv() {
  const hash = psql(`select password_hash from users where email='super_admin@test.local'`);
  const mk = (role, tag) => { const e = `tear_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${e}','Tear ${tag} ${U}','${role}','${hash}',true,'tear_${tag}_${U}')`); return e; };
  const checkerMail = mk('super_admin', 'chk');
  const o = { A: caller(await login('super_admin@test.local')), C: caller(await login(checkerMail)), SE: caller(await login('sales_executive@test.local')), PM: caller(await login('project_manager@test.local')), AF: caller(await login('accounts_finance@test.local')), SA: caller(await login('support_agent@test.local')), RO: caller(await login('read_only_viewer@test.local')), NONE: caller(''), checkerMail };
  o.ids = { admin: psql(`select id from users where email='super_admin@test.local'`), checker: psql(`select id from users where email='${checkerMail}'`) };
  return o;
}
const must = async (label, p) => { const x = await p; if (x.s >= 300) throw new Error(`setup ${label}: ${x.s} ${x.txt.slice(0, 300)}`); return x.j.data ?? x.j; };
export const today = () => psql(`select (now() at time zone 'Asia/Kolkata')::date`);
// a project with a plan (percentages given), a tower, GST (cgst+sgst each half of gst), units on demand
export async function project(E, { tag, plan = [10, 20, 30, 40], gst = 5, gstSlab } = {}) {
  const co = (await must('company', E.A('POST', '/companies', { name: `Tear Co ${tag} ${U}` }))).id;
  const proj = (await must('project', E.A('POST', '/projects', { companyId: co, name: `Tear ${tag} ${U}`, reraNumber: `TR${tag}${U}`, tcpLicence: 'x', totalUnits: 200, landAreaSqft: 50000 }))).id;
  const tw = (await must('tower', E.A('POST', `/projects/${proj}/towers`, { towerName: `T${tag}${U}` }))).id;
  // QA-003: an invoice needs the project's GSTIN and a financial year that holds its date; a test GSTIN and a year around today are set here (CI database only)
  psql(`insert into project_gstin (project_id, gstin) values ('${proj}', '06ABCDE1234F1Z5') on conflict do nothing`);
  psql(`insert into financial_years (name, from_date, to_date, is_active) select 'FY test ' || '${U}', current_date - 400, current_date + 400, true where not exists (select 1 from financial_years where from_date <= current_date and to_date >= current_date and is_active)`);
  const planName = `Plan ${tag} ${U}`;
  for (const [i, p] of plan.entries()) await must('plan row', E.A('POST', `/projects/${proj}/plan-templates`, { plan_name: planName, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 }));
  const td = today();
  let slab = gstSlab ?? (await E.A('GET', '/gst-configuration/gst-slabs')).j.data.find((s) => s.from_date <= td && s.to_date >= td)?.id;
  if (!slab) slab = (await must('slab', E.A('POST', '/gst-configuration/gst-slabs', { fromDate: psql(`select ('${td}'::date - 3)`), toDate: psql(`select ('${td}'::date + 400)`) }))).id;
  const tax = (await must('tax', E.A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `T${tag}${U}`, type: 'INTRA', cgstPct: gst / 2, sgstPct: gst / 2 }))).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await must('mapping', E.A('POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: tax, chargeType: ct }));
  return { co, proj, tw, planName, slab, tax, gst, n: 0 };
}
export async function unit(E, P, { price = 3000000, carpet = 500, balcony } = {}) {
  return (await must('unit', E.A('POST', '/units', { projectId: P.proj, towerId: P.tw, unitNumber: `U${U}${++P.n}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet + 100, basePriceInr: price, ...(balcony ? { balconyAreaSqft: balcony } : {}) }))).id;
}
export async function applicant(E, P, tag = 'B') { return (await must('applicant', E.A('POST', '/consumers', { name: `Tear ${tag} ${U}${++P.n}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: P.proj }))).id; }
export async function booking(E, P, { price = 3000000, carpet = 500, extra = {}, complete = true, unitId, consumerId } = {}) {
  const u = unitId ?? await unit(E, P, { price, carpet }), c = consumerId ?? await applicant(E, P);
  const r = await E.A('POST', '/booking', { consumer_id: c, project_id: P.proj, unit_id: u, selected_plan_name: P.planName, booking_date: today(), booking_amount: 10000, payment_mode: 'cash', ...extra });
  if (r.s !== 201) return { r, u, c };
  const id = r.j.data.id;
  if (complete) { const k = await E.A('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash' }); if (k.s !== 200) return { r: k, u, c, id }; }
  return { r, id, u, c };
}
// a receipt taken all the way to cleared (maker admin, checker second admin)
export async function receipt(E, b, amount, { clear = true, ref, date, method = 'neft' } = {}) {
  const r = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: amount, paymentMode: method, referenceNumber: ref ?? `TR${U}${Math.random().toString(36).slice(2, 8)}`, paymentDate: date ?? today() });
  if (r.s !== 201 || !clear) return r;
  const id = r.j.data.id;
  const a = await E.C('PATCH', `/payments/receipts/${id}/approve`, {}); if (a.s !== 200) return { ...r, step: 'approve', s2: a.s, j2: a.j };
  const d = await E.C('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today() }); if (d.s !== 200) return { ...r, step: 'deposit', s2: d.s, j2: d.j };
  const c = await E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today() }); return { ...r, step: 'clear', s2: c.s, j2: c.j };
}
