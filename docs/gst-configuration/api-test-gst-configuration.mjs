// GST Configuration checks: roles, financial years, HSN/SAC and assignment, slabs (no overlap), tax rates, project mapping and
// the rate lookup, GSTIN (check character), RERA, races, audit.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-gst-configuration.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), SA = call(await login('support_agent@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const G = (p) => '/gst-configuration' + p;
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
// this run's own years, far from real data and from any slab or financial year already there; everything is removed at the end
const taken = [...(await A('GET', '/gst-configuration/gst-slabs')).j.data, ...(await A('GET', '/gst-configuration/financial-years')).j.data].flatMap(x => [Number(x.from_date.slice(0, 4)), Number(x.to_date.slice(0, 4))]);
const free = Array.from({ length: 12 }, (_, i) => 1991 + i * 5).filter(y => !taken.some(ty => ty >= y - 2 && ty <= y + 36));
const Y = free.length ? free[Math.floor(Math.random() * free.length)] : 1991;
const d = (y, m, dd) => `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
const num4 = () => String(1000 + Math.floor(Math.random() * 8999));
const made = { fy: [], hsn: [], slab: [], tax: [], map: [], proj: [] };
let r;
const co = (await A('POST', '/companies', { name: 'GST Co ' + U })).j.data.id;
r = await A('POST', '/companies', { name: 'GST Typo ' + U, pan: 'ABCDE1234F' }); t('company: a field name the API does not know (pan instead of pan_no) is refused, not silently dropped', r.s === 400 && /Unknown field/.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
const mkProj = async (tag) => { const id = (await A('POST', '/projects', { companyId: co, name: `GST ${tag} ${U}`, reraNumber: `GS${tag}-${U}`, tcpLicence: 'x' })).j.data.id; made.proj.push(id); return id; };
const P1 = await mkProj('A'), P2 = await mkProj('B');

// ---------- roles ----------
const probes = [['POST', '/financial-years', { name: 'Nope', fromDate: d(Y, 4, 1), toDate: d(Y + 1, 3, 31) }], ['POST', '/hsn-sac-codes', { code: '995499', type: 'Service' }], ['POST', '/gst-slabs', { fromDate: d(Y, 1, 1), toDate: d(Y, 2, 1) }],
  ['POST', '/gst-tax-setup', { slabId: NIL, gstCode: 'x', type: 'INTRA' }], ['POST', '/gst-charge-mapping', { projectId: P1, slabId: NIL, gstTaxId: NIL, chargeType: 'BASIC' }], ['POST', '/project-gstin', { projectId: P1, gstin: 'x' }], ['POST', '/project-rera', { projectId: P1, reraNumber: 'x' }],
  ['POST', '/hsn-sac-assign', { hsnSacId: NIL, projectId: P1, chargeType: 'BASIC' }], ['DELETE', '/gst-slabs/' + NIL], ['PATCH', '/project-gstin/' + NIL, { gstin: 'x' }]];
for (const [n, c] of [['sales_executive', SE], ['project_manager', PM], ['read_only_viewer', RO], ['support_agent', SA]]) {
  const codes = []; for (const [m, p, b] of probes) codes.push((await c(m, G(p), b)).s);
  t(`roles: ${n} cannot change any GST setting (all ${probes.length} refused)`, codes.every(x => x === 403), codes.join());
}
for (const p of ['/financial-years', '/hsn-sac-codes', '/gst-slabs', '/gst-tax-setup', '/gst-charge-mapping', '/project-gstin', '/project-rera', '/hsn-sac-assign', '/projects']) { r = await RO(G(p).length ? 'GET' : 'GET', G(p)); t(`roles: read_only_viewer can read ${p}`, r.s === 200, r.s); }
r = await PM('POST', G('/hsn-sac-codes'), { code: '99' + num4(), type: 'Service' }); t('roles: project_manager cannot change GST configuration (it alters the tax of every project) -> 403', r.s === 403, r.s);
r = await PM('POST', G('/gst-slabs'), { fromDate: '2093-01-01', toDate: '2093-12-31' }); t('roles: project_manager cannot make a GST slab -> 403', r.s === 403, r.s);
r = await AF('POST', G('/hsn-sac-codes'), { code: '99' + num4(), type: 'Service' }); t('roles: accounts and finance can create an HSN/SAC code', r.s === 201, r.s); made.hsn.push(r.j?.data?.id);
r = await AF('DELETE', G('/hsn-sac-codes/' + r.j?.data?.id)); t('roles: accounts and finance can delete an HSN/SAC code', r.s === 200 || r.s === 204, r.s);

// ---------- financial years ----------
const FY = (b) => A('POST', G('/financial-years'), { name: 'FY ' + U, fromDate: d(Y, 4, 1), toDate: d(Y + 1, 3, 31), ...b });
for (const [n, b, re] of [['no name', { name: '' }, /Name/], ['name spaces', { name: '   ' }, /Name/], ['name over 50', { name: 'x'.repeat(51) }, /50/], ['markup name', { name: '<b>' }, /character/], ['numeric name', { name: 5 }, /text/],
  ['no from date', { fromDate: undefined }, /required/], ['no to date', { toDate: undefined }, /required/], ['impossible date', { fromDate: '2026-02-30' }, /real date/], ['text date', { toDate: 'soon' }, /real date/], ['date as number', { fromDate: 20260401 }, /real date/],
  ['year 1989', { fromDate: '1989-04-01' }, /real date/], ['year 2101', { toDate: '2101-03-31' }, /real date/], ['from after to', { fromDate: d(Y + 1, 4, 1) }, /not be after/], ['isActive text', { isActive: 'yes' }, /true or false/]]) {
  r = await FY(b); t(`FY: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
r = await A('POST', G('/financial-years'), undefined, '[1]'); t('FY: array body -> 400', r.s === 400, r.s);
r = await A('POST', G('/financial-years'), undefined, '{oops'); t('FY: broken JSON -> 4xx', r.s >= 400 && r.s < 500, r.s);
r = await FY({ name: ' FY ' + U + ' ', isActive: true }); t('FY: create (name trimmed)', r.s === 201 && r.j.data.name === 'FY ' + U && r.j.data.is_active === true, JSON.stringify(r.j)); const fy1 = r.j.data.id; made.fy.push(fy1);
r = await FY({ name: 'fy ' + U.toUpperCase(), fromDate: d(Y + 5, 4, 1), toDate: d(Y + 6, 3, 31) }); t('FY: same name in another letter case -> 400', r.s === 400 && /already exists/.test(r.j.error), JSON.stringify(r.j));
for (const [n, a, b] of [['same dates', d(Y, 4, 1), d(Y + 1, 3, 31)], ['overlapping start', d(Y - 1, 4, 1), d(Y, 4, 1)], ['overlapping end', d(Y + 1, 3, 31), d(Y + 2, 3, 31)], ['inside', d(Y, 6, 1), d(Y, 7, 1)], ['around', d(Y - 1, 1, 1), d(Y + 3, 1, 1)]]) {
  r = await FY({ name: 'Clash ' + n + U, fromDate: a, toDate: b }); t(`FY: ${n} overlaps -> 400`, r.s === 400 && /overlap/.test(r.j.error), JSON.stringify(r.j));
}
r = await FY({ name: 'Next ' + U, fromDate: d(Y + 1, 4, 1), toDate: d(Y + 2, 3, 31), isActive: true }); t('FY: the next day starts a new year', r.s === 201, JSON.stringify(r.j)); const fy2 = r.j.data.id; made.fy.push(fy2);
t('FY: only the newest active one stays active', psql(`select count(*) from financial_years where id in ('${fy1}','${fy2}') and is_active`) === '1' && psql(`select is_active from financial_years where id='${fy2}'`) === 't');
const pf = (id, b) => A('PATCH', G('/financial-years/' + id), b);
r = await pf(fy1, { isActive: true }); t('FY: activating one switches the other off', r.s === 200 && psql(`select count(*) from financial_years where id in ('${fy1}','${fy2}') and is_active`) === '1' && psql(`select is_active from financial_years where id='${fy1}'`) === 't', JSON.stringify(r.j));
r = await pf(fy1, { name: 'Renamed ' + U }); t('FY: rename keeps the dates exactly (no day shift)', r.s === 200 && psql(`select to_char(from_date,'YYYY-MM-DD')||to_char(to_date,'YYYY-MM-DD') from financial_years where id='${fy1}'`) === d(Y, 4, 1) + d(Y + 1, 3, 31), JSON.stringify(r.j));
r = await pf(fy1, { toDate: d(Y + 1, 4, 1) }); t('FY: stretching into the next year -> 400', r.s === 400 && /overlap/.test(r.j.error), JSON.stringify(r.j));
r = await pf(fy1, { fromDate: d(Y + 2, 1, 1) }); t('FY: from after its own to -> 400', r.s === 400, JSON.stringify(r.j));
r = await pf(fy1, { fromDate: d(Y, 4, 1), toDate: d(Y + 1, 3, 31) }); t('FY: saving its own dates is not a clash with itself', r.s === 200, JSON.stringify(r.j));
r = await pf(fy1, { name: 'Next ' + U }); t('FY: rename to another year\'s name -> 400', r.s === 400, r.s);
r = await pf(fy1, { isActive: 1 }); t('FY: isActive number -> 400', r.s === 400, r.s); r = await pf('x', { name: 'q' }); t('FY: bad id -> 400', r.s === 400, r.s); r = await pf(NIL, { name: 'q' }); t('FY: unknown -> 404', r.s === 404, r.s);
const raceFy = await Promise.all(Array.from({ length: 6 }, (_, i) => FY({ name: 'Race ' + i + U, fromDate: d(Y + 10, 4, 1), toDate: d(Y + 11, 3, 31) }))); raceFy.forEach(x => x.j?.data && made.fy.push(x.j.data.id));
t('FY: 6 parallel creates of the same period -> exactly 1', raceFy.filter(x => x.s === 201).length === 1 && raceFy.every(x => x.s === 201 || x.s === 400), raceFy.map(x => x.s).join());
r = await A('DELETE', G('/financial-years/' + fy2)); t('FY: delete', r.s === 200, r.s); r = await A('DELETE', G('/financial-years/' + fy2)); t('FY: delete twice -> 404', r.s === 404, r.s); r = await A('DELETE', G('/financial-years/x')); t('FY: delete bad id -> 400', r.s === 400, r.s);

// ---------- HSN / SAC ----------
const H = (b) => A('POST', G('/hsn-sac-codes'), { code: '99' + num4(), type: 'Service', ...b });
for (const [n, b, re] of [['service not starting 99', { code: '875412' }, /99/], ['service 5 digits', { code: '99541' }, /6 digits/], ['goods 5 digits', { code: '12345', type: 'Goods' }, /4, 6 or 8/], ['goods 3 digits', { code: '123', type: 'Goods' }, /4, 6 or 8/],
  ['letters', { code: '99AB12' }, /99/], ['markup', { code: '<99411>' }, /character/], ['over 20 chars', { code: '9'.repeat(21) }, /20/], ['no code', { code: '' }, /required/], ['numeric code', { code: 995411 }, /text/], ['unknown type', { type: 'Thing' }, /Goods/], ['no type', { type: undefined }, /Goods/]]) {
  r = await H(b); t(`HSN: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
const hsA = '99' + num4(), hsG = num4() + '12';
r = await H({ code: ' ' + hsA + ' ' }); t('HSN: service code created (trimmed)', r.s === 201 && r.j.data.code === hsA, JSON.stringify(r.j)); const h1 = r.j.data.id; made.hsn.push(h1);
r = await H({ code: hsG, type: 'Goods' }); t('HSN: goods code (6 digits) created', r.s === 201, JSON.stringify(r.j)); const h2 = r.j.data.id; made.hsn.push(h2);
r = await H({ code: hsA }); t('HSN: same code again -> 400', r.s === 400 && /already exists/.test(r.j.error), JSON.stringify(r.j));
const raceH = await Promise.all(Array.from({ length: 6 }, () => H({ code: '99' + '7777' }))); raceH.forEach(x => x.j?.data && made.hsn.push(x.j.data.id));
t('HSN: 6 parallel creates of one code -> exactly 1', raceH.filter(x => x.s === 201).length === 1 && raceH.every(x => x.s === 201 || x.s === 400), raceH.map(x => x.s).join());
const ph = (id, b) => A('PATCH', G('/hsn-sac-codes/' + id), b);
r = await ph(h1, { type: 'Goods' }); t('HSN: changing the type re-checks the code (99xxxx as goods needs 4/6/8 digits: ok at 6)', r.s === 200 && r.j.data.type === 'Goods', JSON.stringify(r.j)); await ph(h1, { type: 'Service' });
r = await ph(h2, { type: 'Service' }); t('HSN: goods code to service when it does not start 99 -> 400', r.s === 400, JSON.stringify(r.j));
r = await ph(h1, { code: hsG }); t('HSN: rename to another code that exists -> 400', r.s === 400, JSON.stringify(r.j));
r = await ph(h1, { code: '12' }); t('HSN: bad new code -> 400', r.s === 400, r.s); r = await ph(h1, {}); t('HSN: empty edit changes nothing', r.s === 200 && r.j.data.code === hsA, JSON.stringify(r.j));
r = await ph('x', { code: '9954' }); t('HSN: bad id -> 400', r.s === 400, r.s); r = await ph(NIL, { type: 'Goods' }); t('HSN: unknown -> 404', r.s === 404, r.s);
// assignment
const asg = (b) => A('POST', G('/hsn-sac-assign'), { hsnSacId: h1, projectId: P1, chargeType: 'BASIC', ...b });
for (const [n, b, re] of [['bad code id', { hsnSacId: 'x' }, /hsnSacId/], ['bad project id', { projectId: 'x' }, /projectId/], ['unknown charge type', { chargeType: 'FREE' }, /chargeType/], ['no charge type', { chargeType: undefined }, /chargeType/], ['lowercase charge type', { chargeType: 'basic' }, /chargeType/], ['unknown code', { hsnSacId: NIL }, /does not exist/]]) {
  r = await asg(b); t(`assign: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
r = await asg({ projectId: NIL }); t('assign: unknown project -> 404', r.s === 404, r.s);
r = await asg({}); t('assign: BASIC to code 1', r.s === 201, JSON.stringify(r.j)); const as1 = r.j.data.id; made.assign = as1;
r = await asg({ hsnSacId: h2 }); t('assign: same project and charge again replaces the code (same row)', r.s === 201 && r.j.data.id === as1 && r.j.data.hsn_sac_id === h2, JSON.stringify(r.j));
r = await A('GET', G('/hsn-sac-assign?projectId=' + P1)); t('assign: list for the project shows one row with the new code', r.j.data.length === 1 && r.j.data[0].hsn_code === hsG, JSON.stringify(r.j));
r = await A('GET', G(`/hsn-sac-assign?projectId=${P1}&projectId=${P2}`)); t('assign: repeated project param -> 400', r.s === 400, r.s); r = await A('GET', G('/hsn-sac-assign?projectId=abc')); t('assign: bad project param -> 400', r.s === 400, r.s);
r = await A('DELETE', G('/hsn-sac-codes/' + h2)); t('HSN: removing a code that is assigned -> 409 with the count', r.s === 409 && /1 charge/.test(r.j.error), JSON.stringify(r.j));
r = await A('DELETE', G('/hsn-sac-assign/' + as1)); t('assign: remove', r.s === 200, r.s); r = await A('DELETE', G('/hsn-sac-assign/' + as1)); t('assign: remove twice -> 404', r.s === 404, r.s);
r = await A('DELETE', G('/hsn-sac-codes/' + h2)); t('HSN: remove once unassigned', r.s === 200, r.s); r = await A('DELETE', G('/hsn-sac-codes/' + h2)); t('HSN: remove twice -> 404', r.s === 404, r.s);
r = await asg({ hsnSacId: h2 }); t('assign: a removed code cannot be assigned -> 400', r.s === 400, r.s);
r = await H({ code: hsG, type: 'Goods' }); t('HSN: a removed code can be added again (comes back)', r.s === 201 && r.j.data.id === h2 && r.j.data.is_active === true, JSON.stringify(r.j));

// ---------- slabs ----------
const S = (a, b) => A('POST', G('/gst-slabs'), { fromDate: a, toDate: b });
for (const [n, a, b] of [['no dates', undefined, undefined], ['reversed', d(Y, 5, 1), d(Y, 4, 1)], ['impossible', '2026-02-30', d(Y, 5, 1)], ['text', 'a', 'b'], ['too early', '1980-01-01', d(Y, 1, 1)]]) { r = await S(a, b); t(`slab: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await S(d(Y, 4, 1), d(Y, 12, 31)); t('slab: create', r.s === 201, JSON.stringify(r.j)); const sl1 = r.j.data.id; made.slab.push(sl1);
for (const [n, a, b] of [['same range', d(Y, 4, 1), d(Y, 12, 31)], ['one day inside', d(Y, 6, 1), d(Y, 6, 1)], ['touching the last day', d(Y, 12, 31), d(Y + 1, 3, 31)], ['touching the first day', d(Y - 1, 4, 1), d(Y, 4, 1)], ['around it', d(Y - 1, 1, 1), d(Y + 1, 1, 1)]]) {
  r = await S(a, b); t(`slab: ${n} overlaps -> 400`, r.s === 400 && /overlap/.test(r.j.error), JSON.stringify(r.j));
}
r = await S(d(Y + 1, 1, 1), d(Y + 1, 12, 31)); t('slab: the next day starts a new slab', r.s === 201, JSON.stringify(r.j)); made.slab.push(r.j?.data?.id); const sl2 = r.j.data.id;
r = await S(d(Y - 1, 1, 1), d(Y - 1, 12, 31)); t('slab: the day before ends before it', r.s === 201, JSON.stringify(r.j)); made.slab.push(r.j?.data?.id);
const raceS = await Promise.all(Array.from({ length: 6 }, (_, i) => S(d(Y + 20, 1 + i, 1), d(Y + 20, 12, 31)))); raceS.forEach(x => x.j?.data && made.slab.push(x.j.data.id));
t('slab: 6 parallel overlapping creates -> exactly 1', raceS.filter(x => x.s === 201).length === 1 && raceS.every(x => x.s === 201 || x.s === 400), raceS.map(x => x.s).join());

// ---------- tax rates ----------
const T = (b) => A('POST', G('/gst-tax-setup'), { slabId: sl1, gstCode: 'T18 ' + U, type: 'INTRA', cgstPct: 9, sgstPct: 9, ...b });
for (const [n, b, re] of [['no slab', { slabId: undefined }, /slabId/], ['bad slab id', { slabId: 'x' }, /slabId/], ['unknown slab', { slabId: NIL }, /does not exist/], ['no code', { gstCode: '' }, /GST code/], ['code over 50', { gstCode: 'x'.repeat(51) }, /50/], ['markup code', { gstCode: '<i>' }, /character/],
  ['unknown type', { type: 'EXPORT' }, /type/], ['lowercase type', { type: 'intra' }, /type/], ['INTRA unequal', { cgstPct: 9, sgstPct: 6 }, /equal/], ['INTRA with IGST', { igstPct: 5 }, /IGST/], ['INTRA with only CGST', { sgstPct: undefined }, /equal/],
  ['INTER with CGST', { type: 'INTER', cgstPct: 9, sgstPct: 0 }, /IGST only/], ['UT with SGST', { type: 'UT', cgstPct: 0, sgstPct: 9 }, /UTGST only/], ['negative', { cgstPct: -1, sgstPct: -1 }, /CGST/], ['over 100', { cgstPct: 101, sgstPct: 101 }, /CGST/],
  ['text percent', { cgstPct: 'x' }, /CGST/], ['4 decimals', { cgstPct: '9.0001', sgstPct: '9.0001' }, /3 decimals/], ['exponent', { cgstPct: '1e1', sgstPct: '1e1' }, /CGST/], ['boolean', { cgstPct: true }, /CGST/], ['array', { cgstPct: [9] }, /CGST/]]) {
  r = await T(b); t(`tax: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
r = await T({ gstCode: ' T18 ' + U + ' ' }); t('tax: INTRA 9 + 9 created', r.s === 201 && Number(r.j.data.cgst_pct) === 9 && r.j.data.gst_code === 'T18 ' + U, JSON.stringify(r.j)); const tx1 = r.j.data.id; made.tax.push(tx1);
r = await T({ gstCode: 't18 ' + U }); t('tax: same code (other case) and type in the slab -> 400', r.s === 400 && /already exists/.test(r.j.error), JSON.stringify(r.j));
r = await T({ type: 'INTER', cgstPct: 0, sgstPct: 0, igstPct: 18 }); t('tax: the same code as an INTER rate is fine', r.s === 201 && Number(r.j.data.igst_pct) === 18, JSON.stringify(r.j)); const txInter = r.j.data.id; made.tax.push(txInter);
r = await T({ gstCode: 'UT ' + U, type: 'UT', cgstPct: 0, sgstPct: 0, utgstPct: 6 }); t('tax: UT rate', r.s === 201, JSON.stringify(r.j)); made.tax.push(r.j?.data?.id);
r = await T({ gstCode: 'Half ' + U, cgstPct: '0.125', sgstPct: 0.125 }); t('tax: 3 decimals are kept', r.s === 201 && Number(r.j.data.cgst_pct) === 0.125, JSON.stringify(r.j)); made.tax.push(r.j?.data?.id);
r = await T({ gstCode: 'Zero ' + U, cgstPct: 0, sgstPct: 0 }); t('tax: 0% rate', r.s === 201, JSON.stringify(r.j)); made.tax.push(r.j?.data?.id);
const raceT = await Promise.all(Array.from({ length: 6 }, () => T({ gstCode: 'Race ' + U }))); raceT.forEach(x => x.j?.data && made.tax.push(x.j.data.id));
t('tax: 6 parallel creates of one code -> exactly 1', raceT.filter(x => x.s === 201).length === 1 && raceT.every(x => x.s === 201 || x.s === 400), raceT.map(x => x.s).join());
const pt = (id, b) => A('PATCH', G('/gst-tax-setup/' + id), b);
r = await pt(tx1, { cgstPct: 6 }); t('tax edit: changing only CGST leaves INTRA unequal -> 400', r.s === 400 && /equal/.test(r.j.error), JSON.stringify(r.j));
r = await pt(tx1, { cgstPct: 6, sgstPct: 6 }); t('tax edit: both halves', r.s === 200 && Number(r.j.data.sgst_pct) === 6, JSON.stringify(r.j)); await pt(tx1, { cgstPct: 9, sgstPct: 9 });
r = await pt(tx1, { type: 'INTER' }); t('tax edit: INTRA to INTER with CGST left -> 400', r.s === 400, JSON.stringify(r.j));
r = await pt(tx1, { gstCode: 'T18 X ' + U }); t('tax edit: rename keeps rates', r.s === 200 && Number(r.j.data.cgst_pct) === 9, JSON.stringify(r.j));
r = await pt(txInter, { gstCode: 'T18 X ' + U, type: 'INTRA', cgstPct: 0, sgstPct: 0, igstPct: 0 }); t('tax edit: becoming a duplicate of another rate -> 400', r.s === 400, JSON.stringify(r.j)); r = await pt('x', {}); t('tax edit: bad id -> 400', r.s === 400, r.s); r = await pt(NIL, { gstCode: 'q' }); t('tax edit: unknown -> 404', r.s === 404, r.s);

// ---------- mapping + lookup ----------
const MP = (b) => A('POST', G('/gst-charge-mapping'), { projectId: P1, slabId: sl1, gstTaxId: tx1, chargeType: 'BASIC', ...b });
for (const [n, b, re] of [['bad project id', { projectId: 'x' }, /projectId/], ['bad slab id', { slabId: 'x' }, /slabId/], ['bad tax id', { gstTaxId: 'x' }, /gstTaxId/], ['unknown charge type', { chargeType: 'GIFT' }, /chargeType/], ['unknown tax', { gstTaxId: NIL }, /does not exist/],
  ['unknown slab', { slabId: NIL }, /slab does not exist/], ['INTER rate', { gstTaxId: txInter }, /INTRA/], ['rate from another slab', { slabId: sl2 }, /different slab/]]) {
  r = await MP(b); t(`mapping: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
r = await MP({ projectId: NIL }); t('mapping: unknown project -> 404', r.s === 404, r.s);
r = await MP({}); t('mapping: BASIC 18% for the project', r.s === 201, JSON.stringify(r.j)); const mp1 = r.j.data.id; made.map.push(mp1);
const R = (q) => A('GET', G('/resolve?' + q));
r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y, 6, 15)}`); t('lookup: BASIC inside the slab = 9 + 9, no fallback', r.s === 200 && r.j.data.cgstPct === 9 && r.j.data.sgstPct === 9 && r.j.data.fallback === false, JSON.stringify(r.j));
r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y, 4, 1)}`); t('lookup: first day of the slab counts', r.s === 200, r.s); r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y, 12, 31)}`); t('lookup: last day of the slab counts', r.s === 200, r.s);
r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y + 1, 1, 1)}`); t('lookup: the day after the slab -> 404 with a message', r.s === 404 && /No GST mapping/.test(r.j.error), JSON.stringify(r.j));
r = await R(`projectId=${P1}&chargeType=PLC&date=${d(Y, 6, 15)}`); t('lookup: PLC with no mapping falls back to BASIC', r.s === 200 && r.j.data.fallback === true && r.j.data.cgstPct === 9, JSON.stringify(r.j));
r = await R(`projectId=${P2}&chargeType=BASIC&date=${d(Y, 6, 15)}`); t('lookup: another project is not mapped -> 404', r.s === 404, r.s);
r = await pt(tx1, { cgstPct: 6, sgstPct: 6 }); r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y, 6, 15)}`); t('lookup: follows a rate edit (6 + 6)', r.j.data.cgstPct === 6 && r.j.data.sgstPct === 6, JSON.stringify(r.j)); await pt(tx1, { cgstPct: 9, sgstPct: 9 });
r = await pt(tx1, { type: 'INTER', cgstPct: 0, sgstPct: 0, igstPct: 18 }); t('tax edit: a mapped rate cannot stop being INTRA -> 409', r.s === 409, JSON.stringify(r.j));
const tx2 = (await T({ gstCode: 'Five ' + U, cgstPct: 2.5, sgstPct: 2.5 })).j.data.id; made.tax.push(tx2);
r = await MP({ chargeType: 'PLC', gstTaxId: tx2 }); t('mapping: PLC at 5%', r.s === 201, JSON.stringify(r.j)); made.map.push(r.j?.data?.id);
r = await R(`projectId=${P1}&chargeType=PLC&date=${d(Y, 6, 15)}`); t('lookup: PLC uses its own mapping now', r.j.data.cgstPct === 2.5 && r.j.data.fallback === false, JSON.stringify(r.j));
r = await MP({ gstTaxId: tx2 }); t('mapping: saving BASIC again replaces the rate (same row)', r.s === 201 && r.j.data.id === mp1 && r.j.data.gst_tax_id === tx2, JSON.stringify(r.j));
r = await A('GET', G(`/gst-charge-mapping?projectId=${P1}&slabId=${sl1}`)); t('mapping: list for project + slab shows 2 rows with rates', r.j.data.length === 2 && r.j.data.every(x => x.gst_code), JSON.stringify(r.j.data?.length));
r = await A('GET', G(`/gst-charge-mapping?slabId=x`)); t('mapping: bad slab filter -> 400', r.s === 400, r.s);
const raceM = await Promise.all(Array.from({ length: 6 }, (_, i) => MP({ chargeType: 'IFMS', gstTaxId: i % 2 ? tx1 : tx2 }))); made.map.push(raceM[0].j?.data?.id);
t('mapping: 6 parallel saves of one charge -> all fine, one row', raceM.every(x => x.s === 201) && psql(`select count(*) from gst_tax_charge_mapping where project_id='${P1}' and slab_id='${sl1}' and charge_type='IFMS'`) === '1', raceM.map(x => x.s).join());
for (const [n, q] of [['no project', 'chargeType=BASIC'], ['bad project', 'projectId=x&chargeType=BASIC'], ['no charge type', `projectId=${P1}`], ['bad charge type', `projectId=${P1}&chargeType=x`], ['bad date', `projectId=${P1}&chargeType=BASIC&date=2026-13-01`], ['text date', `projectId=${P1}&chargeType=BASIC&date=today`], ['repeated project', `projectId=${P1}&projectId=${P2}&chargeType=BASIC`], ['repeated type', `projectId=${P1}&chargeType=BASIC&chargeType=PLC`]]) { r = await R(q); t(`lookup: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await R(`projectId=${NIL}&chargeType=BASIC`); t('lookup: unknown project -> 404', r.s === 404, r.s);
// what must not be removed while in use
r = await A('DELETE', G('/gst-slabs/' + sl1)); t('slab: delete with tax rates -> 409', r.s === 409 && /tax rates/.test(r.j.error), JSON.stringify(r.j));
r = await A('DELETE', G('/gst-tax-setup/' + tx2)); t('tax: delete a rate that is mapped -> 409', r.s === 409 && /mapping/.test(r.j.error), JSON.stringify(r.j));
for (const id of made.tax.filter(x => x && x !== tx1 && x !== tx2)) await A('DELETE', G('/gst-tax-setup/' + id));
r = await A('DELETE', G('/gst-slabs/' + sl1)); t('slab: delete with mappings (and rates) -> 409', r.s === 409, JSON.stringify(r.j));
r = await A('DELETE', G('/gst-charge-mapping/' + mp1)); t('mapping: delete', r.s === 200, r.s); r = await A('DELETE', G('/gst-charge-mapping/' + mp1)); t('mapping: delete twice -> 404', r.s === 404, r.s); r = await A('DELETE', G('/gst-charge-mapping/x')); t('mapping: delete bad id -> 400', r.s === 400, r.s);
r = await R(`projectId=${P1}&chargeType=BASIC&date=${d(Y, 6, 15)}`); t('lookup: after removing BASIC the project has no rate -> 404', r.s === 404, r.s);
for (const m of await (await A('GET', G(`/gst-charge-mapping?projectId=${P1}`))).j.data) await A('DELETE', G('/gst-charge-mapping/' + m.id));
r = await A('DELETE', G('/gst-tax-setup/' + tx2)); t('tax: delete once unmapped', r.s === 200, r.s); r = await A('DELETE', G('/gst-tax-setup/' + tx2)); t('tax: delete twice -> 404', r.s === 404, r.s); await A('DELETE', G('/gst-tax-setup/' + tx1));
r = await A('DELETE', G('/gst-slabs/' + sl1)); t('slab: delete once empty', r.s === 200, r.s); r = await A('DELETE', G('/gst-slabs/' + sl1)); t('slab: delete twice -> 404', r.s === 404, r.s); r = await A('DELETE', G('/gst-slabs/x')); t('slab: delete bad id -> 400', r.s === 400, r.s);

// ---------- GSTIN ----------
const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const mkGstin = (first14) => { let s = 0; for (let i = 0; i < 14; i++) { const p = CH.indexOf(first14[i]) * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + (p % 36); } return first14 + CH[(36 - (s % 36)) % 36]; };
const good = mkGstin('06AAACG1234F1Z'), good2 = mkGstin('07AAACG1234F1Z');
const wrongCheck = good.slice(0, 14) + (good[14] === 'A' ? 'B' : 'A');
const GN = (b) => A('POST', G('/project-gstin'), { projectId: P1, gstin: good, ...b });
for (const [n, v] of [['wrong check character', wrongCheck], ['14 characters', good.slice(0, 14)], ['16 characters', good + 'A'], ['state code 00', mkGstin('00AAACG1234F1Z')], ['state code 40', mkGstin('40AAACG1234F1Z')], ['no Z', mkGstin('06AAACG1234F1A')], ['lowercase PAN is read as upper-case but digits in PAN part are not', mkGstin('06AAAC11234F1Z')],
  ['symbols', '06AAACG1234F1Z!'], ['spaces inside', '06AAACG 234F1Z5'], ['empty', ''], ['number', 123456789012345], ['array', [good]], ['object', { a: 1 }], ['null', null]]) { r = await GN({ gstin: v }); t(`GSTIN: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await GN({ projectId: 'x' }); t('GSTIN: bad project id -> 400', r.s === 400, r.s); r = await GN({ projectId: NIL }); t('GSTIN: unknown project -> 404', r.s === 404, r.s);
r = await GN({ gstin: ' ' + good.toLowerCase() + ' ' }); t('GSTIN: lower-case and spaces are tidied', r.s === 201 && r.j.data.gstin === good, JSON.stringify(r.j)); const gn1 = r.j.data.id;
r = await GN({ gstin: good2 }); t('GSTIN: a second save for the project updates the same row', r.s === 201 && r.j.data.id === gn1 && r.j.data.gstin === good2 && psql(`select count(*) from project_gstin where project_id='${P1}'`) === '1', JSON.stringify(r.j));
r = await A('POST', G('/project-gstin'), { projectId: P2, gstin: good2 }); t('GSTIN: the same GSTIN for another project is fine (one company, many projects)', r.s === 201, JSON.stringify(r.j));
const rg = await Promise.all(Array.from({ length: 6 }, (_, i) => A('POST', G('/project-gstin'), { projectId: P1, gstin: i % 2 ? good : good2 }))); t('GSTIN: 6 parallel saves -> all fine, one row', rg.every(x => x.s === 201) && psql(`select count(*) from project_gstin where project_id='${P1}'`) === '1', rg.map(x => x.s).join());
const pg = (id, b) => A('PATCH', G('/project-gstin/' + id), b);
r = await pg(gn1, { gstin: good }); t('GSTIN edit: ok', r.s === 200 && r.j.data.gstin === good, JSON.stringify(r.j)); r = await pg(gn1, { gstin: wrongCheck }); t('GSTIN edit: wrong check character -> 400', r.s === 400, r.s); r = await pg(gn1, { gstin: 5 }); t('GSTIN edit: number -> 400 (not a crash)', r.s === 400, r.s);
r = await pg(gn1, {}); t('GSTIN edit: nothing sent -> 400', r.s === 400, r.s); r = await pg('x', { gstin: good }); t('GSTIN edit: bad id -> 400', r.s === 400, r.s); r = await pg(NIL, { gstin: good }); t('GSTIN edit: unknown -> 404', r.s === 404, r.s);
t('GSTIN: stored value is still good after refused edits', psql(`select gstin from project_gstin where id='${gn1}'`) === good);

// ---------- RERA ----------
const tw1 = (await A('POST', `/projects/${P1}/towers`, { towerName: 'RT1 ' + U })).j.data.id, tw2 = (await A('POST', `/projects/${P2}/towers`, { towerName: 'RT2 ' + U })).j.data.id;
const RR = (b) => A('POST', G('/project-rera'), { projectId: P1, reraNumber: 'RC/REP/HARERA/' + U, ...b });
for (const [n, b, re] of [['no number', { reraNumber: '' }, /required/], ['markup', { reraNumber: '<script>' }, /character/], ['symbols', { reraNumber: 'RC#1' }, /letters/], ['over 100', { reraNumber: 'R'.repeat(101) }, /100/], ['number type', { reraNumber: 5 }, /text/], ['bad project', { projectId: 'x' }, /projectId/], ['bad tower id', { towerId: 'x' }, /towerId/], ['tower of another project', { towerId: tw2 }, /does not belong/], ['unknown tower', { towerId: NIL }, /does not belong/]]) {
  r = await RR(b); t(`RERA: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
}
r = await RR({ projectId: NIL }); t('RERA: unknown project -> 404', r.s === 404, r.s);
r = await RR({}); t('RERA: project-level number', r.s === 201 && r.j.data.tower_id === null, JSON.stringify(r.j)); const rr1 = r.j.data.id;
r = await RR({ reraNumber: 'RC/NEW/' + U }); t('RERA: a second project-level save updates the same row (no duplicate)', r.s === 201 && r.j.data.id === rr1 && psql(`select count(*) from project_rera_numbers where project_id='${P1}' and tower_id is null`) === '1', JSON.stringify(r.j));
r = await RR({ towerId: tw1, reraNumber: 'TOWER-1 ' + U }); t('RERA: tower-level number', r.s === 201 && r.j.data.tower_id === tw1, JSON.stringify(r.j)); const rr2 = r.j.data.id;
const rrr = await Promise.all(Array.from({ length: 6 }, (_, i) => A('POST', G('/project-rera'), { projectId: P2, reraNumber: 'P2-' + i }))); t('RERA: 6 parallel project-level saves -> one row', rrr.every(x => x.s === 201) && psql(`select count(*) from project_rera_numbers where project_id='${P2}' and tower_id is null`) === '1', rrr.map(x => x.s).join());
const prr = (id, b) => A('PATCH', G('/project-rera/' + id), b);
r = await prr(rr2, { reraNumber: 'TOWER-1B ' + U }); t('RERA edit: ok', r.s === 200 && r.j.data.rera_number === 'TOWER-1B ' + U, JSON.stringify(r.j)); r = await prr(rr2, { reraNumber: '' }); t('RERA edit: empty -> 400', r.s === 400, r.s); r = await prr(rr2, { reraNumber: '<x>' }); t('RERA edit: markup -> 400', r.s === 400, r.s);
r = await prr('x', { reraNumber: 'a1' }); t('RERA edit: bad id -> 400', r.s === 400, r.s); r = await prr(NIL, { reraNumber: 'a1' }); t('RERA edit: unknown -> 404', r.s === 404, r.s);
r = await A('GET', G('/project-rera?projectId=' + P1)); t('RERA: list shows project and tower rows', r.j.data.length === 2 && r.j.data.some(x => x.tower_name === 'RT1 ' + U), JSON.stringify(r.j.data?.length));
r = await A('GET', G('/towers?projectId=' + P1)); t('towers list', r.s === 200 && r.j.data.length === 1, r.s); r = await A('GET', G('/towers')); t('towers: no project -> 400', r.s === 400, r.s); r = await A('GET', G('/towers?projectId=x')); t('towers: bad project -> 400', r.s === 400, r.s);

// ---------- a rate that already priced bookings or receipts is locked ----------
const P3 = await mkProj('C'), P4 = await mkProj('D');
const lockSlab = (await S(d(Y + 30, 1, 1), d(Y + 30, 12, 31))).j.data.id; made.slab.push(lockSlab);
const otherSlab = (await S(d(Y + 32, 1, 1), d(Y + 32, 12, 31))).j.data.id; made.slab.push(otherSlab);
const lt = (await A('POST', G('/gst-tax-setup'), { slabId: lockSlab, gstCode: 'L ' + U, type: 'INTRA', cgstPct: 9, sgstPct: 9 })).j.data.id, lt2 = (await A('POST', G('/gst-tax-setup'), { slabId: lockSlab, gstCode: 'L2 ' + U, type: 'INTRA', cgstPct: 6, sgstPct: 6 })).j.data.id; made.tax.push(lt, lt2);
const lm = (await A('POST', G('/gst-charge-mapping'), { projectId: P3, slabId: lockSlab, gstTaxId: lt, chargeType: 'BASIC' })).j.data.id;
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: before any booking the percentage can be corrected', r.s === 200, JSON.stringify(r.j)); await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 9, sgstPct: 9 });
const seed = (P, tag, date) => {
  const cons = psql(`INSERT INTO consumers (name, mobile) VALUES ('Lock ${tag} ${U}', '9${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}') RETURNING id`);
  const tower = psql(`SELECT id FROM towers WHERE project_id='${P}' LIMIT 1`) || psql(`INSERT INTO towers (project_id, tower_name) VALUES ('${P}','L${U}') RETURNING id`);
  const unit = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor) VALUES ('${P}','${tower}','${tag}-${U}','available','2BHK',1) RETURNING id`);
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id) VALUES ('${cons}','${unit}','${P}') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${cons}','${unit}','${P}',1000000) RETURNING id`);
  const bk = psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status, booking_date) VALUES ('${cons}','${unit}','${P}','x','draft','${date}') RETURNING id`);
  return { cons, pp, bk };
};
const bkOut = seed(P3, 'out', d(Y + 31, 6, 1));
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: a booking dated outside the slab does not lock it', r.s === 200, JSON.stringify(r.j)); await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 9, sgstPct: 9 });
const bkCan = seed(P3, 'can', d(Y + 30, 6, 1)); psql(`UPDATE booking_records SET status='cancelled' WHERE id='${bkCan.bk}'`);
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: a cancelled booking does not lock it', r.s === 200, JSON.stringify(r.j)); await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 9, sgstPct: 9 });
const bkIn = seed(P3, 'in', d(Y + 30, 6, 1));
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: a live booking inside the slab -> 409 with the counts', r.s === 409 && /1 booking/.test(r.j.error) && /new slab/.test(r.j.error), JSON.stringify(r.j));
t('locked: the rate is unchanged after the refusal', psql(`select cgst_pct from gst_tax_setup where id='${lt}'`) === '9.000');
r = await A('PATCH', G('/gst-tax-setup/' + lt), { gstCode: 'L renamed ' + U }); t('locked: a rename (no percentage change) is still allowed', r.s === 200, JSON.stringify(r.j));
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 9, sgstPct: 9 }); t('locked: saving the same percentages is not a change', r.s === 200, JSON.stringify(r.j));
r = await A('POST', G('/gst-charge-mapping'), { projectId: P3, slabId: lockSlab, gstTaxId: lt2, chargeType: 'BASIC' }); t('locked: switching the project to another rate in that slab -> 409', r.s === 409, JSON.stringify(r.j));
r = await A('POST', G('/gst-charge-mapping'), { projectId: P3, slabId: lockSlab, gstTaxId: lt, chargeType: 'BASIC' }); t('locked: saving the same mapping again is fine', r.s === 201, JSON.stringify(r.j));
r = await A('DELETE', G('/gst-charge-mapping/' + lm)); t('locked: removing the mapping -> 409', r.s === 409, JSON.stringify(r.j));
r = await AF('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5, confirmChangeUsedRate: true }); t('locked: accounts and finance cannot override', r.s === 409, r.s);
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 2.5, sgstPct: 2.5, confirmChangeUsedRate: 'true' }); t('locked: super admin override must be the boolean true', r.s === 409, r.s);
r = await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 4.5, sgstPct: 4.5, confirmChangeUsedRate: true }); t('locked: super admin can correct on purpose', r.s === 200 && Number(r.j.data.cgst_pct) === 4.5, JSON.stringify(r.j));
t('locked: the override is in the audit log with old and new values', psql(`select (previous_values->>'cgst_pct')||'>'||(new_values->>'cgst_pct') from audit_logs where resource_type='gst_tax_setup' and resource_id='${lt}' order by timestamp desc limit 1`) === '9.000>4.500');
await A('PATCH', G('/gst-tax-setup/' + lt), { cgstPct: 9, sgstPct: 9, confirmChangeUsedRate: true });
// a project that has only receipts in the slab
const lm4 = (await A('POST', G('/gst-charge-mapping'), { projectId: P4, slabId: otherSlab, gstTaxId: (await A('POST', G('/gst-tax-setup'), { slabId: otherSlab, gstCode: 'R ' + U, type: 'INTRA', cgstPct: 9, sgstPct: 9 })).j.data.id, chargeType: 'BASIC' })).j.data;
made.tax.push(lm4.gst_tax_id);
const rc = seed(P4, 'rcp', d(Y + 31, 1, 1));
r = await A('PATCH', G('/gst-tax-setup/' + lm4.gst_tax_id), { cgstPct: 6, sgstPct: 6 }); t('locked: a booking outside the slab and no receipt -> still editable', r.s === 200, JSON.stringify(r.j));
psql(`INSERT INTO receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, status, received_date) VALUES ('${rc.cons}','${rc.pp}',1,1000,'cash','cleared','${d(Y + 32, 5, 5)}') RETURNING id`);
r = await A('PATCH', G('/gst-tax-setup/' + lm4.gst_tax_id), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: a receipt dated inside the slab locks it', r.s === 409 && /1 receipt/.test(r.j.error), JSON.stringify(r.j));
psql(`UPDATE receipts SET status='cancelled' WHERE payment_plan_id='${rc.pp}'`);
r = await A('PATCH', G('/gst-tax-setup/' + lm4.gst_tax_id), { cgstPct: 2.5, sgstPct: 2.5 }); t('locked: once the receipt is cancelled it is free again', r.s === 200, JSON.stringify(r.j));
r = await A('PATCH', G('/gst-tax-setup/' + lt2), { cgstPct: 7, sgstPct: 7 }); t('locked: a rate that no project uses is free to edit', r.s === 200, JSON.stringify(r.j));

// ---------- audit, then tidy up ----------
const au = (ty) => Number(psql(`select count(*) from audit_logs where resource_type='${ty}'`));
for (const ty of ['financial_year', 'hsn_sac_code', 'hsn_sac_assignment', 'gst_slab', 'gst_tax_setup', 'gst_charge_mapping', 'project_gstin', 'project_rera']) t(`audit: ${ty} changes are logged`, au(ty) >= 3, au(ty));
t('audit: a rate edit keeps old and new values', psql(`select (previous_values->>'cgst_pct')||'>'||(new_values->>'cgst_pct') from audit_logs where resource_type='gst_tax_setup' and action='update' order by timestamp desc offset 2 limit 1`).includes('>'));
for (const id of made.fy) psql(`delete from financial_years where id='${id}'`);
for (const id of made.hsn.filter(Boolean)) psql(`delete from hsn_sac_code_assign where hsn_sac_id='${id}'`), psql(`delete from hsn_sac_codes where id='${id}'`);
psql(`delete from hsn_sac_codes where code in ('${hsA}','${hsG}','997777')`);
// ---------- one charge cannot carry more than 100% tax in all ----------
{ const sx = await S(d(Y + 40, 1, 1), d(Y + 40, 12, 31)); if (sx.j?.data?.id) made.slab.push(sx.j.data.id); const slabId = sx.j?.data?.id;
  const r1 = await T({ slabId, gstCode: 'Hi ' + U, cgstPct: 75, sgstPct: 75 });
  t('tax total: INTRA 75% + 75% (150% in all) -> 400', r1.s === 400 && /100%/.test(r1.j?.error || ''), r1.s + ' ' + JSON.stringify(r1.j));
  const r2 = await T({ slabId, gstCode: 'Ok ' + U, cgstPct: 50, sgstPct: 50 }); if (r2.j?.data?.id) made.tax.push(r2.j.data.id);
  t('tax total: INTRA 50% + 50% (100% in all) is still allowed', r2.s === 201, r2.s + ' ' + JSON.stringify(r2.j));
  const r3 = await T({ slabId, gstCode: 'Int ' + U, type: 'INTER', cgstPct: 0, sgstPct: 0, igstPct: 100 }); if (r3.j?.data?.id) made.tax.push(r3.j.data.id);
  t('tax total: INTER 100% is allowed', r3.s === 201, r3.s + ' ' + JSON.stringify(r3.j)); }
for (const id of made.tax.filter(Boolean)) psql(`delete from gst_tax_charge_mapping where gst_tax_id='${id}'`), psql(`delete from gst_tax_setup where id='${id}'`);
for (const id of made.slab.filter(Boolean)) psql(`delete from gst_slabs where id='${id}'`);
t('tidy: no slab of this run is left', psql(`select count(*) from gst_slabs where from_date >= '${d(Y - 1, 1, 1)}' and from_date <= '${d(Y + 21, 1, 1)}'`) === '0');
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
