// Documents core: letters generated for real data, the document list, search, send, vault, field edits, delete.
// Roles, hostile input, stored markup, the penal interest rate setting, sealed vault links, parallel edits, project scope, a random run.
// Run: BASE=http://localhost:3010/api node api-test-documents-core.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
import { secondAdminToken } from '../_shared/second-admin.mjs';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const go = () => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let r; try { r = await go(); } catch { r = await go(); } let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(await login('accounts_finance@test.local'));
const CK = call(await secondAdminToken(B, A));   // clears and bounces receipts: whoever recorded a receipt does not clear or bounce it
const SA = call(await login('support_agent@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e9 }).trim().split('\n')[0];
const rows = (sql) => JSON.parse(execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `select coalesce(json_agg(t), '[]'::json) from (${sql}) t`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1e9 }).trim() || '[]');
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100, near = (a, b, e = 0.011) => Math.abs(Number(a) - Number(b)) < e;
const sum = (xs, f) => r2(xs.reduce((s, x) => s + Number(f(x)), 0));
const J = (v) => JSON.stringify(v) ?? 'undefined';
let r, r2x;
const extraSql = []; const PROJECT_CLEAN = [];

// ---------- set-up: a company, bank accounts, three projects, plans, GST, buyers ----------
const co = (await A('POST', '/companies', { name: 'Reports Co ' + U })).j.data.id;
const bank1 = psql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active) values ('${co}', 'Rep Bank A ${U}', 'RA${U}', true) returning id`);
const bank2 = psql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active) values ('${co}', 'Rep Bank B ${U}', 'RB${U}', true) returning id`);
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Rep ${tag} ${U}`, reraNumber: `RP${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B'), P3 = await mkProj('C');
const tw = async (P, n) => (await A('POST', `/projects/${P}/towers`, { towerName: `${n}${U}` })).j.data.id;
const T1 = await tw(P1, 'T1'), T1b = await tw(P1, 'T2'), T2 = await tw(P2, 'T1'), T3 = await tw(P3, 'T1');
let un = 0; const unit = async (P, T, base, carpet = 1000, bhk = '2BHK') => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `R${++un}-${U}`, floor: ri(1, 9), bhkType: bhk, carpetAreaSqft: carpet, superAreaSqft: carpet + 200, basePriceInr: base, totalPriceInr: base + 500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN1 = await plan(P1, 'RepPlan ' + U, [20, 30, 50]), PLAN2 = await plan(P2, 'RepPlanB ' + U, [40, 60]), PLAN3 = await plan(P3, 'RepPlanC ' + U, [100]);
const planOf = { [P1]: PLAN1, [P2]: PLAN2, [P3]: PLAN3 };
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `RP ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2, P3]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const made = []; let ap = 0;
const person = async (P) => { const x = await A('POST', '/consumers', { name: `Rep Buyer ${++ap} ${U}`, mobile: mob(), project_id: P }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };
// a completed booking: applicant, unit (random price, so GST has paise), plan, three (or two, or one) demands and the booking receipt
const buyer = async (P = P1, T = T1, o = {}) => {
  const c = await person(P), base = o.base ?? ri(40, 120) * 100000 + ri(0, 99999), u = await unit(P, T, base, o.carpet ?? 1000, o.bhk ?? '2BHK');
  const x = await A('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: planOf[P], booking_date: today }); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await A('PATCH', `/booking/${x.j.data.id}`, { booking_amount: o.booking ?? ri(2, 20) * 1000, payment_mode: 'cash' }); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  // the booking carries its price: rate per sq ft, PLC, other charge and a dealer adjustment (the unit cost the percentages are worked on)
  psql(`update booking_records set basic_rate_inr_sqft = ${r2(base / (o.carpet ?? 1000))}, plc_amount = ${ri(0, 5) * 10000}, other_charge_amount = ${ri(0, 3) * 1000}, dealer_adjustment_amount = ${ri(0, 3) * 5000} where id='${x.j.data.id}' returning 1`);
  return { c, u, P, bk: x.j.data.id, reg: x.j.data.registration_no, plan: psql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`) };
};
let rn = 0;
const receipt = async (S, amount, idx, o = {}) => { const x = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: amount, paymentMode: o.mode || 'neft', referenceNumber: `RP${U}R${++rn}`, paymentDate: today, installmentIndex: idx, companyBankAccountId: o.bank, ...(o.mode === 'cheque' ? { chequeNo: `CQ${U}${rn}` } : {}) }); if (x.s !== 201) throw new Error('receipt ' + JSON.stringify(x)); return x.j.data.id; };
const clear = async (id) => { const x = await CK('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }); if (x.s !== 200) throw new Error('clear ' + JSON.stringify(x)); return id; };
const bounce = async (id) => { const x = await CK('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'test' }); if (x.s !== 200) throw new Error('bounce ' + JSON.stringify(x)); return id; };
const cancel = async (id) => { const x = await A('POST', `/payments/receipts/${id}/cancel`, { reason: 'test' }); if (x.s !== 200) throw new Error('cancel ' + JSON.stringify(x)); return id; };
const rais = (S, idx, days) => psql(`update demands set status='demanded', due_date = current_date - ${days}, raised_at = now() where payment_plan_id='${S.plan}' and installment_index=${idx} returning 1`);
const bookingReceipt = (S) => psql(`select id from receipts where consumer_id='${S.c}' and installment_index is null and demand_id is null order by created_at limit 1`);
const demandsOf = (S) => rows(`select id, installment_index idx, status, amount_due_inr + cgst_amount + sgst_amount total from demands where payment_plan_id='${S.plan}' order by installment_index`);
// ---------- extra roles and helpers ----------
const SAh = SA; const NO = call(null);
const gen = (f, b) => f('POST', '/documents/generate', b);
const htmlOf = async (id) => { const r = await fetch(B + `/documents/${id}/html`, { headers: { authorization: 'Bearer ' + tokA } }); return { s: r.status, h: await r.text() }; };
const S = {}; S.c = await buyer(P1, T1, { base: 7000000 + ri(0, 99999) }); rais(S.c, 1, 30); rais(S.c, 2, 5);
S.o = await buyer(P2, T2, { base: 5000000 + ri(0, 99999) });
const cid = S.c.c, alloc = psql(`select id from allocations where consumer_id='${cid}' limit 1`), allocOther = psql(`select id from allocations where consumer_id='${S.o.c}' limit 1`);
const setRate = (v) => { psql(`delete from global_settings where key='penal_interest_rate_percent'`); if (v !== null) psql(`insert into global_settings (key, value) values ('penal_interest_rate_percent', '${v}')`); };
const demandRate = async () => { const r = await gen(A, { consumerId: cid, documentType: 'demand_letter' }); if (r.s !== 201) return 'status ' + r.s + J(r.j); const h = (await htmlOf(r.j.data.documentId)).h; return (h.match(/data-field-key="penalRate"[^>]*>([^<]*)</) || [])[1]; };

// ---------- the penal interest rate: one setting, one default ----------
setRate(null); t('penal rate: no setting -> the one default, 15', (await demandRate()) === '15.00');
setRate('12.5'); t('penal rate: the setting is used (12.5)', (await demandRate()) === '12.50');
setRate('0'); t('penal rate: 0 is a real rate, not turned into the default', (await demandRate()) === '0.00');
setRate('abc'); t('penal rate: a bad setting falls back to the default', (await demandRate()) === '15.00');
setRate('250'); t('penal rate: a setting above 100 falls back to the default', (await demandRate()) === '15.00');
setRate('15.0');

// ---------- generate: guards and input ----------
const okBody = { consumerId: cid, allocationId: alloc, documentType: 'demand_letter' };
t('generate: no login 401', (await NO('POST', '/documents/generate', okBody)).s === 401);
t('generate: viewer 403, support 403', (await gen(RO, okBody)).s === 403 && (await gen(SAh, okBody)).s === 403);
t('generate: sales, accounts, pm can make a demand letter (201)', (await gen(SE, okBody)).s === 201 && (await gen(AF, okBody)).s === 201 && (await gen(PM, okBody)).s === 201);
const bads = [['no body', undefined], ['no ids', { documentType: 'demand_letter' }], ['consumer not uuid', { ...okBody, consumerId: 'x' }], ['consumer list', { ...okBody, consumerId: [cid] }], ['allocation not uuid', { ...okBody, allocationId: '1' }], ['template not uuid', { consumerId: cid, templateId: 'abc' }],
  ['no type, no template', { consumerId: cid }], ['type with markup', { ...okBody, documentType: '<b>x' }], ['type 51 chars', { ...okBody, documentType: 'a'.repeat(51) }], ['type number', { ...okBody, documentType: 5 }], ['delivery bad', { ...okBody, deliveryMethod: 'pigeon' }], ['delivery list', { ...okBody, deliveryMethod: ['email'] }],
  ['due date bad', { ...okBody, dueDate: '31-02-2026' }], ['due date text', { ...okBody, dueDate: 'tomorrow' }], ['includeAllDemands text', { ...okBody, includeAllDemands: 'yes' }], ['includeInterest number', { ...okBody, includeInterest: 0 }], ['demandId not uuid', { ...okBody, demandId: 'zz' }],
  ['mergeData a list', { ...okBody, mergeData: [1] }], ['mergeData text', { ...okBody, mergeData: 'x' }], ['mergeData key with brace', { ...okBody, mergeData: { 'a}}.*': 'x' } }], ['mergeData key starts with digit', { ...okBody, mergeData: { '1a': 'x' } }], ['mergeData nested', { ...okBody, mergeData: { a: { b: 1 } } }], ['mergeData list value', { ...okBody, mergeData: { a: [1] } }], ['mergeData 20001 chars', { ...okBody, mergeData: { a: 'x'.repeat(20001) } }]];
for (const [n, b] of bads) { r = await gen(A, b); t(`generate refused: ${n}`, r.s === 400 && !!r.j?.error, r); }
t('generate: unknown applicant 404', (await gen(A, { ...okBody, consumerId: NIL, allocationId: undefined })).s === 404);
t('generate: unknown allocation 404', (await gen(A, { consumerId: cid, allocationId: NIL, documentType: 'demand_letter' })).s === 404);
t("generate: another applicant's allocation is refused (400)", (await gen(A, { consumerId: cid, allocationId: allocOther, documentType: 'demand_letter' })).s === 400);
t('generate: a type nobody made a template for is 404, not 500', (await gen(A, { consumerId: cid, documentType: 'no_such_type' })).s === 404);
t('generate: an unknown template id is 404', (await gen(A, { consumerId: cid, templateId: NIL })).s === 404);
r = await gen(A, { allocationId: alloc, documentType: 'check_list' }); t('generate: only an allocation (no applicant id) works, the applicant is taken from it', r.s === 201 && psql(`select consumer_id from documents where id='${r.j.data.documentId}'`) === cid, r);
t('generate: broken JSON and a list body are 400', (await A('POST', '/documents/generate', undefined, '{"a":')).s === 400 && (await A('POST', '/documents/generate', undefined, '[1]')).s === 400);

// ---------- merge data from the caller is page text, never markup ----------
const tplName = `Core Letter ${U}`;
const tpl = (await A('POST', '/documents/templates', { name: tplName, documentType: 'payment_receipt', bodyHtml: '<html><body><p>' + 'x'.repeat(100) + '</p><div>Dear {{who}}, {{note}}</div></body></html>' })).j?.data?.id;
t('templates: a letter template can be made', !!tpl, tpl);
r = await gen(A, { consumerId: cid, templateId: tpl, mergeData: { who: '<script>alert(1)</script>', note: 'a & b "q" $& $1 </div>' } });
const h1 = r.s === 201 ? (await htmlOf(r.j.data.documentId)).h : '';
t('mergeData: markup is shown as text (escaped), dollar signs stay literal', r.s === 201 && h1.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !h1.includes('<script>alert(1)') && h1.includes('a &amp; b &quot;q&quot; $&amp; $1 &lt;/div&gt;'), h1.slice(-300));
const before = psql(`select count(*) from documents where consumer_id='${cid}'`);
t('generate: a failed request saved no document', (await gen(A, { ...okBody, dueDate: 'bad' })).s === 400 && psql(`select count(*) from documents where consumer_id='${cid}'`) === before);

// ---------- list, search, per-applicant list ----------
const dbToday = psql('select current_date');
const D = (await gen(A, okBody)).j.data.documentId;
r = await A('GET', `/documents?consumerId=${cid}&documentType=demand_letter`); t('list: filter by applicant and type', r.s === 200 && r.j.data.length >= 4 && r.j.data.every((x) => x.document_type === 'demand_letter'), r);
for (const [n, q] of [['pageSize with SQL', 'pageSize=5;select 1'], ['pageSize 0', 'pageSize=0'], ['pageSize 201', 'pageSize=201'], ['page -1', 'page=-1'], ['page text', 'page=abc'], ['pageSize 1e2', 'pageSize=1e2'], ['consumerId bad', 'consumerId=x'], ['from bad', 'from=yesterday'], ['to 2026-13-45', 'to=2026-13-45'], ['type array', 'documentType[]=a'], ['type twice', 'documentType=a&documentType=b']]) { r = await A('GET', `/documents?${q}`); t(`list refused: ${n}`, r.s === 400, r); }
t('list: a page of 2, then the next page', (await A('GET', `/documents?consumerId=${cid}&pageSize=2`)).j.data.length === 2 && (await A('GET', `/documents?consumerId=${cid}&pageSize=2&page=2`)).j.data.length >= 1);
t('list: from/to filter works (today in, far past out)', (await A('GET', `/documents?consumerId=${cid}&from=${dbToday}&to=${dbToday}`)).j.data.length >= 4 && (await A('GET', `/documents?consumerId=${cid}&to=2000-01-01`)).j.data.length === 0);
t('list: every role that can see documents can list; support can too, no login 401', (await RO('GET', '/documents')).s === 200 && (await SAh('GET', '/documents')).s === 200 && (await NO('GET', '/documents')).s === 401);
t('per applicant: bad id 400, own documents listed', (await A('GET', '/documents/abc')).s === 400 && (await A('GET', `/documents/${cid}`)).j.data.length >= 4);
r = await gen(A, { consumerId: cid, templateId: tpl, mergeData: { who: '100% real_name', note: 'zzNEEDLE' + U } });
t('search: finds a word in the text', (await A('GET', `/documents/search?q=zzNEEDLE${U}`)).j.data.length === 1);
t('search: % and _ are plain letters (no match for "%")', (await A('GET', `/documents/search?q=${encodeURIComponent('100% real_name')}`)).j.data.length === 1 && (await A('GET', `/documents/search?q=${encodeURIComponent('%%')}`)).j.data.length === 0 && (await A('GET', `/documents/search?q=${encodeURIComponent('real_nam_')}`)).j.data.length === 0);
t('search: too short / missing / bad project / list are 400', (await A('GET', '/documents/search?q=a')).s === 400 && (await A('GET', '/documents/search')).s === 400 && (await A('GET', '/documents/search?q=ab&projectId=x')).s === 400 && (await A('GET', '/documents/search?q[]=ab')).s === 400);
t('search: the answer has no full HTML', !('html_content' in ((await A('GET', `/documents/search?q=zzNEEDLE${U}`)).j.data[0] || {})));

// ---------- send: queued, never "sent" ----------
r = await SE('POST', `/documents/${D}/send`, { recipientEmail: 'a@b.com' }); t('send: sales can queue it; status is queued and sent_at stays empty', r.s === 200 && r.j.data.delivery_status === 'queued' && r.j.data.sent_at === null, r);
t('send: bad id 400, unknown 404, bad email 400, bad phone 400, viewer 403, support 403', (await A('POST', '/documents/abc/send', {})).s === 400 && (await A('POST', `/documents/${NIL}/send`, {})).s === 404 && (await A('POST', `/documents/${D}/send`, { recipientEmail: 'not an email' })).s === 400 && (await A('POST', `/documents/${D}/send`, { recipientPhone: 'call me' })).s === 400 && (await RO('POST', `/documents/${D}/send`, {})).s === 403 && (await SAh('POST', `/documents/${D}/send`, {})).s === 403);
psql(`update documents set delivery_status='delivered' where id='${D}'`);
t('send: a delivered document is not touched again (409)', (await A('POST', `/documents/${D}/send`, {})).s === 409 && psql(`select delivery_status from documents where id='${D}'`) === 'delivered');

// ---------- vault ----------
const vp = { consumerId: cid, documentCategory: 'KYC', fileUrl: 'https://files.example.com/a/b.pdf?x=1', fileName: 'b.pdf' };
t('vault: no login 401, viewer 403 on save, viewer can read', (await NO('POST', '/documents/vault', vp)).s === 401 && (await RO('POST', '/documents/vault', vp)).s === 403 && (await RO('GET', '/documents/vault')).s === 200);
r = await SE('POST', '/documents/vault', vp); t('vault: sales can save a link (201), the answer shows the plain link', r.s === 201 && r.j.data.file_url === vp.fileUrl, r);
const V = r.j.data.id;
const stored = psql(`select file_url from document_vault where id='${V}'`);
t('vault: in the database the link is sealed, not readable', stored !== vp.fileUrl && /^[0-9a-f]{32}:[0-9a-f]+$/.test(stored), stored);
t('vault: the lists give the plain link back (both lists)', (await A('GET', `/documents/vault/${cid}`)).j.data.some((x) => x.id === V && x.file_url === vp.fileUrl) && (await A('GET', '/documents/vault?documentCategory=KYC')).j.data.some((x) => x.id === V && x.file_url === vp.fileUrl));
t('vault: a path on this site is fine', (await A('POST', '/documents/vault', { ...vp, fileUrl: '/uploads/x/y.pdf' })).s === 201);
for (const [n, b] of [['no body', undefined], ['javascript link', { ...vp, fileUrl: 'javascript:alert(1)' }], ['data link', { ...vp, fileUrl: 'data:text/html,<script>x</script>' }], ['protocol-relative', { ...vp, fileUrl: '//evil.com/x' }], ['link with space', { ...vp, fileUrl: 'https://a.com/a b' }], ['link 2001 chars', { ...vp, fileUrl: 'https://a.com/' + 'x'.repeat(2000) }], ['no link', { ...vp, fileUrl: undefined }], ['no category', { ...vp, documentCategory: '' }], ['category markup', { ...vp, documentCategory: '<i>' }], ['category 101', { ...vp, documentCategory: 'c'.repeat(101) }],
  ['name markup', { ...vp, fileName: '<b>' }], ['name 256', { ...vp, fileName: 'n'.repeat(256) }], ['consumer not uuid', { ...vp, consumerId: 'q' }], ['allocation of another applicant', { ...vp, allocationId: allocOther }], ['link a list', { ...vp, fileUrl: ['https://a.com'] }]]) { r = await A('POST', '/documents/vault', b); t(`vault refused: ${n}`, r.s === 400 && !!r.j?.error, r); }
t('vault: unknown applicant 404', (await A('POST', '/documents/vault', { ...vp, consumerId: NIL })).s === 404);
for (const [n, q] of [['pageSize with SQL', 'pageSize=1;drop'], ['pageSize 0', 'pageSize=0'], ['page 0', 'page=0'], ['category array', 'documentCategory[]=a']]) t(`vault list refused: ${n}`, (await A('GET', `/documents/vault?${q}`)).s === 400);
t('vault: bad applicant id 400', (await A('GET', '/documents/vault/abc')).s === 400);


// ---------- vault: real files ----------
const tokSE = await login('sales_executive@test.local'), tokRO = await login('read_only_viewer@test.local');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x'.repeat(200))]);
const up = async (tok, fields, bytes, name = 'scan.png') => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v); if (bytes) fd.append('file', new Blob([bytes]), name); const x = await fetch(B + '/documents/vault', { method: 'POST', headers: tok ? { authorization: 'Bearer ' + tok } : {}, body: fd }); return { s: x.status, j: await x.json().catch(() => null) }; };
const unitId = S.c.u;
r = await up(tokSE, { consumerId: cid, docCategory: 'KYC', remarks: 'front side' }, PNG, '..\\..\\etc\\passwd<b>.png'); t('vault file: sales can upload a png (201); the stored name has no path or markup', r.s === 201 && r.j.data.content_type === 'image/png' && r.j.data.file_url === null && !/[\\/<>]/.test(r.j.data.file_name), r);
const VF = r.j?.data?.id;
t('vault file: the bytes are in the database and no link is stored', psql(`select length(file_data)||'/'||coalesce(file_url,'none')||'/'||file_size_bytes from document_vault where id='${VF}'`) === `${PNG.length}/none/${PNG.length}`);
const fr = await fetch(B + `/documents/vault/file/${VF}`, { headers: { authorization: 'Bearer ' + tokRO } }); const fb = Buffer.from(await fr.arrayBuffer());
t('vault file: a viewer can read it back byte for byte, as image/png, nosniff, locked-down CSP', fr.status === 200 && fb.equals(PNG) && fr.headers.get('content-type') === 'image/png' && fr.headers.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(fr.headers.get('content-security-policy') || ''));
t('vault file: no login 401; bad id 400; unknown 404; a link-only row has no file (404)', (await NO('GET', `/documents/vault/file/${VF}`)).s === 401 && (await A('GET', '/documents/vault/file/abc')).s === 400 && (await A('GET', `/documents/vault/file/${NIL}`)).s === 404 && (await A('GET', `/documents/vault/file/${V}`)).s === 404);
t('vault file: the lists say has_file and carry no link and no bytes', (await A('GET', `/documents/vault/${cid}`)).j.data.some((x) => x.id === VF && x.has_file === true && x.file_url === null && !('file_data' in x)) && (await A('GET', `/documents/vault/${cid}`)).j.data.some((x) => x.id === V && x.has_file === false));
r = await up(tokSE, { unitId, documentCategory: 'Plan' }, Buffer.from('%PDF-1.4 test'), 'plan.pdf'); t('vault file: a unit-only pdf is fine (201)', r.s === 201 && r.j.data.content_type === 'application/pdf', r);
t('vault file: the unit filter finds only that unit document', (await A('GET', `/documents/vault?unitId=${unitId}`)).j.data.length === 1 && (await A('GET', `/documents/vault?consumerId=${cid}`)).j.data.every((x) => x.id !== r.j.data.id) && (await A('GET', '/documents/vault?unitId=abc')).s === 400);
for (const [n, f, bytes, nm, want] of [['not a real image (text named .png)', { consumerId: cid, documentCategory: 'KYC' }, Buffer.from('hello world, not an image'), 'a.png'], ['html named .pdf', { consumerId: cid, documentCategory: 'KYC' }, Buffer.from('<html><script>alert(1)</script>'), 'a.pdf'], ['empty file', { consumerId: cid, documentCategory: 'KYC' }, Buffer.alloc(0), 'a.png'], ['file and link together', { consumerId: cid, documentCategory: 'KYC', fileUrl: 'https://a.com/x' }, PNG, 'a.png'], ['neither file nor link', { consumerId: cid, documentCategory: 'KYC' }, null, 'a.png'], ['no applicant and no unit', { documentCategory: 'KYC' }, PNG, 'a.png'], ['no category', { consumerId: cid }, PNG, 'a.png'], ['remarks 2001 chars', { consumerId: cid, documentCategory: 'KYC', remarks: 'r'.repeat(2001) }, PNG, 'a.png'], ['unit not uuid', { unitId: 'q', documentCategory: 'KYC' }, PNG, 'a.png']]) { r = await up(tokSE, f, bytes, nm); t(`vault file refused: ${n}`, r.s === 400 && !!r.j?.error, r); }
r = await up(tokSE, { consumerId: cid, documentCategory: 'KYC' }, Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)])); t('vault file: over 10 MB is 400, not 500', r.s === 400 && /10 MB/.test(r.j?.error || ''), r);
t('vault file: unknown unit 404, viewer 403, no login 401', (await up(tokSE, { unitId: NIL, documentCategory: 'Plan' }, PNG)).s === 404 && (await up(tokRO, { consumerId: cid, documentCategory: 'KYC' }, PNG)).s === 403 && (await up(null, { consumerId: cid, documentCategory: 'KYC' }, PNG)).s === 401);
const pars = await Promise.all([1, 2, 3, 4, 5].map(() => up(tokSE, { consumerId: cid, documentCategory: 'Race' }, PNG)));
t('vault file: 5 uploads at once all succeed, five rows', pars.every((x) => x.s === 201) && psql(`select count(*) from document_vault where consumer_id='${cid}' and document_category='Race'`) === '5');
t('html page: no login token is written into a generated document page', !/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test((await htmlOf(D)).h));

// ---------- edit a field, versions, parallel edits ----------
const E = (await gen(A, okBody)).j.data.documentId;
const edit = (f, docId, fields, reason = 'fixing a value') => f('PATCH', `/documents/${docId}/edit`, { fields, edit_reason: reason });
const f1 = (v, k = 'penalRate') => ({ field_key: k, field_label: 'Penal rate', new_value: v, value_type: 'text' });
t('edit: no login 401; sales, accounts, viewer, support 403 (only managers and admins may edit)', (await NO('PATCH', `/documents/${E}/edit`, {})).s === 401 && (await edit(SE, E, [f1('9')])).s === 403 && (await edit(AF, E, [f1('9')])).s === 403 && (await edit(RO, E, [f1('9')])).s === 403 && (await edit(SAh, E, [f1('9')])).s === 403);
for (const [n, b] of [['no body', undefined], ['no reason', { fields: [f1('9')] }], ['blank reason', { fields: [f1('9')], edit_reason: '  ' }], ['reason 501', { fields: [f1('9')], edit_reason: 'r'.repeat(501) }], ['no fields', { edit_reason: 'x' }], ['empty fields', { fields: [], edit_reason: 'x' }], ['fields an object', { fields: {}, edit_reason: 'x' }], ['101 fields', { fields: Array.from({ length: 101 }, (_, i) => f1('1', 'k' + i)), edit_reason: 'x' }],
  ['field not an object', { fields: ['a'], edit_reason: 'x' }], ['key with space', { fields: [f1('1', 'a b')], edit_reason: 'x' }], ['key with regex chars', { fields: [f1('1', 'a.*(')], edit_reason: 'x' }], ['key 101 chars', { fields: [f1('1', 'k'.repeat(101))], edit_reason: 'x' }], ['same key twice', { fields: [f1('1'), f1('2')], edit_reason: 'x' }], ['value an object', { fields: [f1({})], edit_reason: 'x' }], ['value null', { fields: [f1(null)], edit_reason: 'x' }],
  ['value 5001 chars', { fields: [f1('v'.repeat(5001))], edit_reason: 'x' }], ['value with control char', { fields: [f1('a\u0007b')], edit_reason: 'x' }], ['value type unknown', { fields: [{ ...f1('1'), value_type: 'blob' }], edit_reason: 'x' }], ['label 201 chars', { fields: [{ ...f1('1'), field_label: 'l'.repeat(201) }], edit_reason: 'x' }]]) { r = await A('PATCH', `/documents/${E}/edit`, b); t(`edit refused: ${n}`, r.s === 400 && !!r.j?.error, r); }
t('edit: bad id 400, unknown 404; refusals changed nothing', (await A('PATCH', '/documents/abc/edit', {})).s === 400 && (await edit(A, NIL, [f1('9')])).s === 404 && psql(`select coalesce(version_number,1)||'/'||coalesce(is_edited::text,'f') from documents where id='${E}'`).startsWith('1/'));
r = await edit(PM, E, [f1('<img src=x onerror=alert(1)> $& $1 "q" & more')]);
const h2 = (await htmlOf(E)).h;
t('edit: a manager can; the new value is shown as text (escaped), "$&" stays literal, version 2', r.s === 200 && r.j.version_number === 2 && h2.includes('&lt;img src=x onerror=alert(1)&gt; $&amp; $1 &quot;q&quot; &amp; more') && !h2.includes('<img src=x onerror'), r.s + ' ' + (h2.match(/data-field-key="penalRate"[^>]*>[^<]*</) || [''])[0]);
t('edit: the raw value is kept in the override and the old value is remembered', psql(`select current_value from document_field_overrides where document_id='${E}' and field_key='penalRate'`).startsWith('<img') && psql(`select original_value from document_field_overrides where document_id='${E}' and field_key='penalRate'`) === '15.00');
const par5 = await Promise.all([1, 2, 3, 4, 5].map((i) => edit(A, E, [f1('1' + i + '.5')], 'parallel ' + i)));
const vers = rows(`select version_number from document_versions where document_id='${E}' and is_original = false order by version_number`).map((x) => x.version_number);
t('edit: 5 edits at once all succeed (no 5xx), versions are 2..7 without a repeat, the document is at 7', par5.every((x) => x.s === 200) && J(vers) === J([2, 3, 4, 5, 6, 7]) && psql(`select version_number from documents where id='${E}'`) === '7', J(vers) + ' ' + par5.map((x) => x.s));
t('edit: overrides and versions lists work; bad id 400, unknown 404', (await A('GET', `/documents/${E}/overrides`)).j.overrides.length === 1 && (await A('GET', `/documents/${E}/versions`)).j.versions.length >= 6 && (await A('GET', '/documents/abc/overrides')).s === 400 && (await A('GET', `/documents/${NIL}/versions`)).s === 404);
r = await A('GET', `/documents/edits-report?documentType=demand_letter&consumerId=${cid}`); t('edits report: filter works and shows the edit', r.s === 200 && r.j.total >= 1 && r.j.edits.some((x) => x.document_id === E), r);
for (const [n, q] of [['pageSize SQL', 'pageSize=1;x'], ['fromDate bad', 'fromDate=nope'], ['consumerId bad', 'consumerId=1'], ['type array', 'documentType[]=x'], ['page 0', 'page=0']]) t(`edits report refused: ${n}`, (await A('GET', `/documents/edits-report?${q}`)).s === 400);
t('edits report: editedBy treats % as a letter', (await A('GET', `/documents/edits-report?editedBy=${encodeURIComponent('%')}`)).j.total === 0);
t('edits report: viewer can read, support too', (await RO('GET', '/documents/edits-report')).s === 200 && (await SAh('GET', '/documents/edits-report')).s === 200);

// ---------- delete: soft, once, hidden everywhere ----------
t('delete: sales/pm/accounts/viewer 403; no login 401; bad id 400; unknown 404', (await SE('DELETE', `/documents/${E}`)).s === 403 && (await PM('DELETE', `/documents/${E}`)).s === 403 && (await AF('DELETE', `/documents/${E}`)).s === 403 && (await RO('DELETE', `/documents/${E}`)).s === 403 && (await NO('DELETE', `/documents/${E}`)).s === 401 && (await A('DELETE', '/documents/abc')).s === 400 && (await A('DELETE', `/documents/${NIL}`)).s === 404);
const dels = await Promise.all([1, 2, 3].map(() => A('DELETE', `/documents/${E}`)));
t('delete: 3 at once, exactly one 200 and two 404, no 5xx', dels.filter((x) => x.s === 200).length === 1 && dels.filter((x) => x.s === 404).length === 2, dels.map((x) => x.s));
t('delete: the row stays (soft) and the delete is logged once', psql(`select count(*) from documents where id='${E}' and deleted_at is not null`) === '1' && psql(`select count(*) from audit_logs where resource_id='${E}' and action='delete'`) === '1');
t('delete: a deleted document is gone from list, per-applicant list, search, html, send, edit, versions', !(await A('GET', `/documents?consumerId=${cid}&pageSize=200`)).j.data.some((x) => x.id === E) && !(await A('GET', `/documents/${cid}`)).j.data.some((x) => x.id === E) && (await htmlOf(E)).s === 404 && (await A('POST', `/documents/${E}/send`, {})).s === 404 && (await edit(A, E, [f1('1')])).s === 404 && (await A('GET', `/documents/${E}/versions`)).s === 404);

// ---------- project scope ----------
const afId = psql(`select id from users where email='accounts_finance@test.local'`);
t('scope: accounts limited to P2', (await A('PATCH', `/users/employee-login/${afId}`, { assignedProjectIds: [P2] })).s === 200);
await new Promise((z) => setTimeout(z, 16000));
const AF2 = call(await login('accounts_finance@test.local'));
t('scope: the limited user cannot generate for an applicant of P1 (404), cannot read their documents, cannot see the vault link', (await gen(AF2, okBody)).s === 404 && (await AF2('GET', `/documents/${cid}`)).j.data.length === 0 && !(await AF2('GET', '/documents/vault')).j.data.some((x) => x.id === V) && (await AF2('POST', '/documents/vault', vp)).s === 404);
t('scope: the limited user cannot read a file of a P1 applicant (404)', (await AF2('GET', `/documents/vault/file/${VF}`)).s === 404);
t('scope: but can make a document for an applicant of P2', (await gen(AF2, { consumerId: S.o.c, documentType: 'check_list' })).s === 201);
await A('PATCH', `/users/employee-login/${afId}`, { assignedProjectIds: [] });

// ---------- a random hostile run ----------
const junk = ['', ' ', 'x', '0', '-1', '1e9', 'null', '<img src=x>', '%', "' or 1=1--", '\u0000', 'a'.repeat(300), cid, NIL, 'demand_letter', 'check_list', '2026-02-31', '$&', '{{who}}'];
const calls = [];
for (let i = 0; i < 150; i++) {
  const bodyR = {}; for (const k of ['consumerId', 'allocationId', 'templateId', 'documentType', 'deliveryMethod', 'dueDate', 'includeAllDemands', 'mergeData', 'demandId']) if (rnd() < 0.45) bodyR[k] = pick([...junk, null, true, 5, [], {}, 1.5, { a: 1 }]);
  if (rnd() < 0.5) bodyR.consumerId = cid;
  const q = pick(['page', 'pageSize', 'consumerId', 'documentType', 'from', 'to', 'q', 'documentCategory']) + '=' + encodeURIComponent(pick(junk));
  const w = pick([A, PM, SE, AF, RO, SAh, NO]);
  const x = rnd();
  calls.push(x < 0.3 ? w('POST', '/documents/generate', bodyR) : x < 0.4 ? w('POST', '/documents/vault', bodyR) : x < 0.5 ? w('PATCH', `/documents/${pick([D, NIL, 'x'])}/edit`, { fields: pick([[], [{ field_key: pick(junk), new_value: pick(junk) }], 'x', null]), edit_reason: pick(junk) }) : x < 0.6 ? w('POST', `/documents/${pick([D, NIL, 'x'])}/send`, bodyR) : x < 0.9 ? w('GET', pick(['/documents', '/documents/search', '/documents/vault', '/documents/edits-report', `/documents/${cid}`]) + '?' + q) : w('POST', '/documents/generate', undefined, pick(['{', '[1]', 'null', '"x"'])));
}
const out = await Promise.all(calls);
t('random: 150 hostile requests, none gave a 5xx', out.every((x) => x.s < 500), J(out.filter((x) => x.s >= 500).slice(0, 3)));
extraSql.push(`delete from document_field_overrides where document_id in (select id from documents where consumer_id in ('${S.c.c}','${S.o.c}'))`, `delete from document_versions where document_id in (select id from documents where consumer_id in ('${S.c.c}','${S.o.c}'))`, `delete from audit_logs where resource_id in (select id from documents where consumer_id in ('${S.c.c}','${S.o.c}')) or resource_id in (select id from document_vault where consumer_id in ('${S.c.c}','${S.o.c}') or unit_id in ('${S.c.u}','${S.o.u}'))`, `delete from documents where consumer_id in ('${S.c.c}','${S.o.c}')`, `delete from document_vault where consumer_id in ('${S.c.c}','${S.o.c}') or unit_id in ('${S.c.u}','${S.o.u}')`, `delete from document_templates where name = '${tplName}'`);

const ids = made.map(x => `'${x}'`).join(',');
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
for (const sql of [
  ...extraSql,
  `delete from audit_logs where resource_type in ('surrender','cancellation') and resource_id in (select id from surrender_applications where consumer_id in (${ids}) union select id from cancellations where consumer_id in (${ids}))`,
  `delete from surrender_applications where consumer_id in (${ids})`, `delete from cancellations where consumer_id in (${ids})`,
  `delete from audit_logs where resource_type = 'ownership_transfer' and resource_id in (select id from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids}))`,
  `delete from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids})`,
  `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
  `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from penal_interests where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
  `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
  `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
  `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  `delete from company_bank_accounts where id in ('${bank1}','${bank2}')`,
  ...[P1, P2, P3, ...PROJECT_CLEAN].flatMap(p => [`delete from plan_schedule_templates where project_id='${p}'`, `delete from gst_tax_charge_mapping where project_id='${p}'`, `delete from unit_status_history where unit_id in (select id from units where project_id='${p}')`, `delete from units where project_id='${p}'`, `delete from towers where project_id='${p}'`, `delete from projects where id='${p}'`]),
  `delete from companies where id='${co}'`,
]) { try { psql(sql); } catch (e) { if (process.env.DEBUG_CLEAN) console.log('CLEAN FAILED', sql.slice(0, 90), String(e.stderr || e).slice(0, 160)); /* leftovers are harmless, names carry the run id */ } }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

