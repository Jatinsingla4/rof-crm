// Many people pressing Save / Confirm at the same instant must never freeze the server or give a 500.
// TA-01: a request that holds one database connection must not ask the pool for a second one (24 at once used to hang the whole API).
// TA-02: confirming several bookings of one applicant together used to end in a PostgreSQL deadlock (HTTP 500).
const B = process.env.BASE || 'http://localhost:3002/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async () => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const tok = await login();
const A = async (m, p, b) => { try { const r = await fetch(B + p, { method: m, signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; } catch (e) { return { s: 0, j: null }; } };
const must = async (l, p) => { const r = await p; if (r.s >= 300) throw new Error(`setup ${l}: ${r.s} ${JSON.stringify(r.j)}`); return r.j.data ?? r.j; };
const U = Date.now().toString(36).slice(-5), day = (d = 0) => new Date(Date.now() + 5.5 * 3600e3 + d * 864e5).toISOString().slice(0, 10);
const co = (await must('company', A('POST', '/companies', { name: `Conc Co ${U}` }))).id;
const proj = (await must('project', A('POST', '/projects', { companyId: co, name: `Conc ${U}`, reraNumber: `CC${U}`, tcpLicence: 'x', totalUnits: 200, landAreaSqft: 50000 }))).id;
const tw = (await must('tower', A('POST', `/projects/${proj}/towers`, { towerName: `T${U}` }))).id;
const plan = `Plan ${U}`;
for (const [i, p] of [50, 50].entries()) await must('plan', A('POST', `/projects/${proj}/plan-templates`, { plan_name: plan, installment_name: `Row ${i + 1}`, installment_type: i ? 'installment' : 'booking', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 }));
// GST the booking needs: a slab that covers today, a 5% tax, mapped to the charge types
const td = day();
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j?.data?.find((x) => x.from_date <= td && x.to_date >= td)?.id;
if (!slab) slab = (await must('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: day(-3), toDate: day(400) }))).id;
const tax = (await must('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `C${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await must('mapping', A('POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: tax, chargeType: ct }));
let n = 0;
const unit = async () => (await must('unit', A('POST', '/units', { projectId: proj, towerId: tw, unitNumber: `U${U}${++n}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 }))).id;
const person = async () => (await must('applicant', A('POST', '/consumers', { name: `Conc P ${U}${++n}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: proj }))).id;
const book = (c, u) => A('POST', '/booking', { consumer_id: c, project_id: proj, unit_id: u, selected_plan_name: plan, booking_date: day(), booking_amount: 10000, payment_mode: 'cash' });
const confirm = (id) => A('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash' });
const codes = (rs) => rs.map((r) => r.s).sort().join(',');

// 24 different applicants book 24 different units at once (the pool holds 10 connections)
const pairs = []; for (let i = 0; i < 24; i++) pairs.push([await person(), await unit()]);
const made = await Promise.all(pairs.map(([c, u]) => book(c, u)));
t(`24 bookings at once all succeed, no 500, no hang (${codes(made)})`, made.every((r) => r.s === 201), codes(made));
const ids = made.filter((r) => r.s === 201).map((r) => r.j.data.id);
// and all 24 are confirmed at once
const conf = await Promise.all(ids.map(confirm));
t(`24 confirmations at once all succeed (${codes(conf)})`, ids.length === 24 && conf.every((r) => r.s === 200), codes(conf));
// the server still answers afterwards
t('the server still answers after the burst', (await A('GET', '/auth/me')).s === 200 || (await A('GET', '/booking')).s === 200);

// One applicant, 8 unconfirmed bookings, all confirmed at once: no 500, exactly one is confirmed
// (One applicant may have only one unfinished booking, so 8 at once give one 201; the same booking confirmed 8 times at once gives one 200.)
const c = await person(); const units8 = []; for (let i = 0; i < 8; i++) units8.push(await unit());
const made8 = await Promise.all(units8.map((u) => book(c, u)));
t(`one applicant booking 8 units at once: no 500, exactly one 201 (${codes(made8)})`, !made8.some((r) => r.s >= 500 || r.s === 0) && made8.filter((r) => r.s === 201).length === 1, codes(made8));
const mine = made8.find((r) => r.s === 201)?.j.data.id;
const rs = await Promise.all(Array.from({ length: 8 }, () => confirm(mine)));
t(`the same booking confirmed 8 times at once: no 500, exactly one 200 (${codes(rs)})`, !!mine && !rs.some((r) => r.s >= 500 || r.s === 0) && rs.filter((r) => r.s === 200).length === 1, codes(rs));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
