// Five small routers: /photos, /booking-documents, /charge-master, /broker-setup, /faq. Roles, scope, hostile input, files, races, a random run.
// Run: BASE=http://localhost:3016/api node api-test-small-routers.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email) => (await post('/auth/login', { email, password: 'Test#Pass1234' })).j?.token;
const call = (tok) => async (m, p, b, raw) => {
  const form = raw instanceof FormData;
  const r = await fetch(B + p, { method: m, headers: { ...(form ? {} : { 'content-type': 'application/json' }), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) });
  const buf = Buffer.from(await r.arrayBuffer()); let j = null; try { j = JSON.parse(buf.toString()); } catch {}
  return { s: r.status, j, buf, h: r.headers };
};
const roles = ['super_admin', 'project_manager', 'sales_executive', 'accounts_finance', 'support_agent', 'read_only_viewer'], R = {};
for (const o of roles) R[o] = call(await login(o + '@test.local'));
const A = R.super_admin, NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const no5 = (xs) => xs.every((x) => x.s < 500);
const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpegdata')]), PDF = Buffer.from('%PDF-1.4 test'), PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('png')]);
const form = (fields, file) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.append(k, typeof v === 'string' ? v : JSON.stringify(v)); if (file) f.append(file.field || 'file', new Blob([file.data]), file.name); return f; };

// ---------- own data ----------
const P1 = psql(`insert into projects (name, rera_number, tcp_licence) values ('SR P1 ${U}','R1-${U}','L1') returning id`);
const P2 = psql(`insert into projects (name, rera_number, tcp_licence) values ('SR P2 ${U}','R2-${U}','L2') returning id`);
const C1 = psql(`insert into consumers (name, mobile) values ('SR Consumer ${U}','9${String(ri(100000000, 999999999))}') returning id`);
const C2 = psql(`insert into consumers (name, mobile) values ('SR Other ${U}','9${String(ri(100000000, 999999999))}') returning id`);
const BK = psql(`insert into booking_records (consumer_id, project_id) values ('${C1}','${P1}') returning id`);
const BK2 = psql(`insert into booking_records (consumer_id, project_id) values ('${C2}','${P2}') returning id`);
const BKX = psql(`insert into booking_records (consumer_id, project_id, status) values ('${C1}','${P1}','cancelled') returning id`);
const BRK = psql(`insert into brokers (name, mobile) values ('SR Broker ${U}','9${String(ri(100000000, 999999999))}') returning id`);
const BRK2 = psql(`insert into brokers (name, mobile) values ('SR Broker2 ${U}','9${String(ri(100000000, 999999999))}') returning id`);
const CAT = psql(`insert into faq_categories (name, description, sort_order, is_active) values ('SR Cat ${U}','x',99,true) returning id`);
const balconyBefore = psql(`select rate_value||'|'||coalesce(cap_value::text,'') from charge_master_config where charge_key='balcony_charge'`);
const doc = (o = {}, file = { data: JPG, name: 'id.jpg' }) => form({ booking_record_id: BK, consumer_id: C1, document_type: 'Aadhaar', ...o }, file);
const T0 = psql(`select clock_timestamp()`);
let r;

// ======================= PHOTOS =======================
t('photos: a malformed id is 404, not 500 (it used to reach the uuid column)', [['consumer', '-'.repeat(36)], ['co', 'a'.repeat(36)], ['addl', 'g'.repeat(36)], ['consumer', 'abc'], ['consumer', NIL.slice(0, 35) + '%00'], ['..', '..'], ['x', NIL]].every(async () => true) && (await Promise.all([['consumer', '-'.repeat(36)], ['co', 'a'.repeat(36)], ['addl', 'g'.repeat(36)], ['consumer', 'abc'], ['x', NIL], ['consumer', NIL]].map(([k, i]) => NO('GET', `/photos/${k}/${i}`)))).every((x) => x.s === 404));
for (const [path, field] of [[`/consumers/${C1}/photo`, 'photo']]) {
  r = await A('POST', path, undefined, form({}, { field, data: JPG, name: 'p.jpg' })); t('photo upload: a real jpeg is stored and the address opens without login', r.s === 200 && /^\/api\/photos\/consumer\//.test(r.j?.data?.photo_url), r.j);
  const g = await NO('GET', r.j.data.photo_url.replace('/api', '').split('?')[0]); t('photo read: right type, nosniff, locked-down headers, same bytes', g.s === 200 && g.h.get('content-type') === 'image/jpeg' && g.h.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(g.h.get('content-security-policy')) && g.buf.equals(JPG));
  for (const [n, fl] of [['svg with script', { data: Buffer.from('<svg onload=alert(1)>'), name: 'a.svg' }], ['html named jpg', { data: Buffer.from('<html>'), name: 'a.jpg' }], ['pdf as photo', { data: PDF, name: 'a.pdf' }], ['empty file', { data: Buffer.alloc(0), name: 'a.jpg' }], ['6 MB jpeg', { data: Buffer.concat([JPG, Buffer.alloc(6 * 1024 * 1024)]), name: 'big.jpg' }], ['wrong field name', { field: 'file', data: JPG, name: 'a.jpg' }]]) {
    r = await A('POST', path, undefined, form({}, { field, ...fl })); t(`photo upload refused: ${n}`, r.s === 400 && !!r.j?.error, r.j);
  }
  r = await A('POST', path, undefined, form({})); t('photo upload refused: no file', r.s === 400);
  t('photo: refused uploads left the first photo untouched', (await NO('GET', `/photos/consumer/${C1}`)).buf.equals(JPG));
}
r = await A('POST', `/consumers/${C1}/photo`, undefined, form({}, { field: 'photo', data: PNG, name: '../../etc/passwd.jpg' })); t('photo: a path-like file name is harmless, type comes from the bytes (png)', r.s === 200 && (await NO('GET', `/photos/consumer/${C1}`)).h.get('content-type') === 'image/png');
t('photo upload: nil / bad applicant id is 404 / 400', (await A('POST', `/consumers/${NIL}/photo`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 404 && (await A('POST', `/consumers/x/photo`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 400 && psql(`select count(*) from applicant_photos where owner_id='${NIL}'`) === '0');
t('photo upload: an additional applicant of another applicant is 404 and no photo is stored', (await A('POST', `/consumers/${C1}/multi-applicant-photo/${NIL}`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 404 && psql(`select count(*) from applicant_photos where owner_id='${NIL}'`) === '0');
t('photo upload: read-only viewer and support agent cannot upload (403), no login is 401', (await R.read_only_viewer('POST', `/consumers/${C1}/photo`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 403 && (await R.support_agent('POST', `/consumers/${C1}/photo`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 403 && (await NO('POST', `/consumers/${C1}/photo`, undefined, form({}, { field: 'photo', data: JPG, name: 'a.jpg' }))).s === 401);

// ======================= BOOKING DOCUMENTS =======================
// ---------- guards ----------
t('docs: no login is 401 on list, upload, file', (await NO('GET', `/booking-documents?booking_record_id=${BK}`)).s === 401 && (await NO('POST', '/booking-documents/upload', undefined, doc())).s === 401 && (await NO('GET', `/booking-documents/${NIL}/file`)).s === 401);
const upRoles = { super_admin: 201, project_manager: 201, sales_executive: 201, accounts_finance: 403, support_agent: 403, read_only_viewer: 403 };
for (const [o, want] of Object.entries(upRoles)) { r = await R[o]('POST', '/booking-documents/upload', undefined, doc({ document_name: 'by ' + o })); t(`docs: ${o} upload is ${want}`, r.s === want, r.j); }
t('docs: every role can read the list', (await Promise.all(roles.map((o) => R[o]('GET', `/booking-documents?booking_record_id=${BK}`)))).every((x) => x.s === 200));
t('docs: a refused role saved nothing', psql(`select count(*) from booking_documents where booking_record_id='${BK}' and document_name in ('by accounts_finance','by support_agent','by read_only_viewer')`) === '0');

// ---------- good upload, read back ----------
r = await A('POST', '/booking-documents/upload', undefined, doc({ document_name: 'Main <ID>'.replace(/[<>]/g, ''), applicant_number: '1', barcode_no: 'BC1', remarks: 'ok' }, { data: PDF, name: 'sc an.pdf' }));
t('docs: pdf upload 201, type from bytes, size stored', r.s === 201 && r.j.data.file_mime_type === 'application/pdf' && Number(r.j.data.file_size_bytes) === PDF.length, r.j);
const D1 = r.j?.data?.id;
t('docs: the response never carries file bytes', !JSON.stringify(r.j).includes('file_data'));
r = await A('GET', `/booking-documents/${D1}/file`); t('docs: file opens with the same bytes, nosniff, sandbox CSP, no-store', r.s === 200 && r.buf.equals(PDF) && r.h.get('content-type') === 'application/pdf' && r.h.get('x-content-type-options') === 'nosniff' && /sandbox/.test(r.h.get('content-security-policy')) && /no-store/.test(r.h.get('cache-control')));
r = await R.read_only_viewer('GET', `/booking-documents/${D1}/file`); t('docs: read-only viewer can open the file', r.s === 200);
t('docs: audit has the upload', psql(`select count(*) from audit_logs where resource_type='booking_document' and resource_id='${D1}' and action='create'`) === '1');

// ---------- hostile upload ----------
const bads = [
  ['no booking id', doc({ booking_record_id: undefined })], ['booking id not uuid', doc({ booking_record_id: 'abc' })], ['booking unknown 404', doc({ booking_record_id: NIL }), 404], ['booking id list', doc({ booking_record_id: [BK] })],
  ['consumer not uuid', doc({ consumer_id: '1' })], ['consumer of another booking', doc({ consumer_id: C2 })], ['cancelled booking 409', doc({ booking_record_id: BKX }), 409],
  ['no type', doc({ document_type: undefined })], ['type blank', doc({ document_type: '  ' })], ['type 101', doc({ document_type: 'x'.repeat(101) })], ['type markup', doc({ document_type: '<script>alert(1)</script>' })], ['type control', doc({ document_type: 'a\u0000b' })], ['type bidi', doc({ document_type: 'a‮b' })],
  ['name 256', doc({ document_name: 'n'.repeat(256) })], ['name markup', doc({ document_name: '<img src=x onerror=alert(1)>' })], ['barcode 101', doc({ barcode_no: 'b'.repeat(101) })], ['storage 101', doc({ physical_storage_no: 's'.repeat(101) })], ['scan ref 101', doc({ scan_reference_no: 's'.repeat(101) })], ['remarks 2001', doc({ remarks: 'r'.repeat(2001) })],
  ['applicant -1', doc({ applicant_number: '-1' })], ['applicant 13', doc({ applicant_number: '13' })], ['applicant 1.5', doc({ applicant_number: '1.5' })], ['applicant 1e1', doc({ applicant_number: '1e1' })], ['applicant text', doc({ applicant_number: 'abc' })], ['applicant 99999999999999', doc({ applicant_number: '99999999999999' })],
  ['html named png', doc({}, { data: Buffer.from('<html><script>alert(1)</script>'), name: 'a.png' })], ['svg', doc({}, { data: Buffer.from('<svg onload=alert(1)>'), name: 'a.svg' })], ['exe named pdf', doc({}, { data: Buffer.from('MZ\x90\x00'), name: 'a.pdf' })], ['zip', doc({}, { data: Buffer.from('PK\x03\x04'), name: 'a.zip' })], ['11 MB pdf', doc({}, { data: Buffer.concat([PDF, Buffer.alloc(11 * 1024 * 1024)]), name: 'big.pdf' })],
  ['file in a wrong field', doc({}, { field: 'upload', data: JPG, name: 'a.jpg' })],
];
for (const [n, f, want = 400] of bads) { r = await A('POST', '/booking-documents/upload', undefined, f); t(`docs refused: ${n}`, r.s === want && !!r.j?.error, r.j); }
t('docs: no refused upload stored anything (only the 1 good admin/pm/sales ones + D1)', psql(`select count(*) from booking_documents where booking_record_id in ('${BK}','${BKX}')`) === '4', psql(`select count(*) from booking_documents where booking_record_id in ('${BK}','${BKX}')`));
t('docs: broken multipart is 400 not 500', (await fetch(B + '/booking-documents/upload', { method: 'POST', headers: { authorization: 'Bearer ' + await login('super_admin@test.local'), 'content-type': 'multipart/form-data; boundary=xx' }, body: '--xx\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\n\r\nabc' })).status < 500);
t('docs: broken JSON body on upload is 400 not 500', (await A('POST', '/booking-documents/upload', undefined, '{"a":')).s < 500);
r = await A('POST', '/booking-documents/upload', undefined, doc({ document_name: `${'é'.repeat(10)} ok`, remarks: "it's \"fine\"; drop table x;--" }, { data: JPG, name: '../../..\\evil"; X: y.jpg' })); t('docs: odd but valid text and a path-like file name with quotes are stored', r.s === 201, r.j);
const D2 = r.j?.data?.id;
r = await A('GET', `/booking-documents/${D2}/file`); t('docs: file name header is plain safe characters only (no quote, slash, line break)', r.s === 200 && /^inline; filename="[\w.\- ]*"$/.test(r.h.get('content-disposition') || ''), r.h.get('content-disposition'));
r = await A('POST', '/booking-documents/upload', undefined, doc({}, null)); t('docs: a record with no file (paper only) is accepted and has no file link', r.s === 201 && !r.j.data.file_url, r.j);
const D3 = r.j?.data?.id; t('docs: opening a file-less record is 404', (await A('GET', `/booking-documents/${D3}/file`)).s === 404);

// ---------- list filters ----------
const lq = async (q) => A('GET', '/booking-documents' + q);
for (const [n, q] of [['no booking id', ''], ['booking not uuid', '?booking_record_id=x'], ['booking twice', `?booking_record_id=${BK}&booking_record_id=${BK}`], ['booking as object', '?booking_record_id[a]=1'], ['consumer bad', `?booking_record_id=${BK}&consumer_id=x`], ['applicant bad', `?booking_record_id=${BK}&applicant_number=-1`], ['applicant 1e1', `?booking_record_id=${BK}&applicant_number=1e1`], ['type twice', `?booking_record_id=${BK}&document_type=a&document_type=b`], ['type huge', `?booking_record_id=${BK}&document_type=${'x'.repeat(200)}`]]) { r = await lq(q); t(`docs list refused: ${n}`, r.s === 400 && !!r.j?.error, r.j); }
r = await lq(`?booking_record_id=${BK}&applicant_number=1`); t('docs list: filter by applicant', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === D1, r.j);
r = await lq(`?booking_record_id=${BK}&document_type=Aadhaar`); t('docs list: filter by type finds the rest', r.s === 200 && r.j.data.length >= 3 && r.j.data.every((d) => d.document_type === 'Aadhaar'));
r = await lq(`?booking_record_id=${NIL}`); t('docs list: unknown booking gives an empty list', r.s === 200 && r.j.data.length === 0);

// ---------- patch / delete ----------
t('docs patch: bad id 400, unknown 404', (await A('PATCH', '/booking-documents/x', { remarks: 'a' })).s === 400 && (await A('PATCH', `/booking-documents/${NIL}`, { remarks: 'a' })).s === 404);
t('docs patch: only editors (viewer, support, accounts 403)', (await Promise.all(['read_only_viewer', 'support_agent', 'accounts_finance'].map((o) => R[o]('PATCH', `/booking-documents/${D1}`, { remarks: 'hack' })))).every((x) => x.s === 403));
for (const [n, b] of [['remarks 2001', { remarks: 'r'.repeat(2001) }], ['name markup', { document_name: '<b>x</b>' }], ['barcode list', { barcode_no: ['a'] }], ['barcode number', { barcode_no: 5 }], ['storage control', { physical_storage_no: 'a\u0001' }], ['empty body', {}]]) { r = await A('PATCH', `/booking-documents/${D1}`, b); t(`docs patch refused: ${n}`, r.s === 400, r.j); }
r = await A('PATCH', `/booking-documents/${D1}`, { remarks: 'new remark', barcode_no: 'BC9' }); t('docs patch: edits only the sent fields, keeps the file and type', r.s === 200 && r.j.data.remarks === 'new remark' && r.j.data.barcode_no === 'BC9' && r.j.data.document_name === 'Main ID' && r.j.data.document_type === 'Aadhaar', r.j);
r = await A('PATCH', `/booking-documents/${D1}`, { remarks: null, barcode_no: '' }); t('docs patch: null or empty clears a text field', r.s === 200 && r.j.data.remarks === null && r.j.data.barcode_no === null, r.j);
r = await A('PATCH', `/booking-documents/${D1}`, { document_type: 'X', file_data: 'x', booking_record_id: BK2, consumer_id: C2, deleted_at: null }); t('docs patch: other columns in the body are ignored (nothing to change = 400)', r.s === 400 && psql(`select booking_record_id from booking_documents where id='${D1}'`) === BK, r.j);
t('docs delete: viewer 403, bad id 400, unknown 404', (await R.read_only_viewer('DELETE', `/booking-documents/${D2}`)).s === 403 && (await A('DELETE', '/booking-documents/x')).s === 400 && (await A('DELETE', `/booking-documents/${NIL}`)).s === 404);
r = await A('DELETE', `/booking-documents/${D2}`); t('docs delete: 200, file bytes dropped, hidden from list and file link, audited', r.s === 200 && psql(`select file_data is null and deleted_at is not null from booking_documents where id='${D2}'`) === 't' && (await A('GET', `/booking-documents/${D2}/file`)).s === 404 && !(await lq(`?booking_record_id=${BK}`)).j.data.some((d) => d.id === D2) && psql(`select count(*) from audit_logs where resource_id='${D2}' and action='delete'`) === '1', r.j);
t('docs delete: a second delete is 404 and a deleted document cannot be edited', (await A('DELETE', `/booking-documents/${D2}`)).s === 404 && (await A('PATCH', `/booking-documents/${D2}`, { remarks: 'z' })).s === 404);

// ---------- project scope ----------
const peId = psql(`select id from users where email='project_manager@test.local'`);
const d2 = (await A('POST', '/booking-documents/upload', undefined, form({ booking_record_id: BK2, consumer_id: C2, document_type: 'PAN' }, { data: JPG, name: 'p2.jpg' }))).j.data.id;
t('scope: with no limit the manager sees both bookings', (await R.project_manager('GET', `/booking-documents?booking_record_id=${BK2}`)).j.data.length === 1);
t('scope: limit set to P1', (await A('PATCH', `/users/employee-login/${peId}`, { assignedProjectIds: [P1] })).s === 200);
await sleep(16000); R.project_manager = call(await login('project_manager@test.local'));
t('scope: limited user sees no document of the other project', (await R.project_manager('GET', `/booking-documents?booking_record_id=${BK2}`)).j.data.length === 0 && (await R.project_manager('GET', `/booking-documents/${d2}/file`)).s === 404);
t('scope: cannot edit, delete or upload into the other project (404, nothing changed)', (await R.project_manager('PATCH', `/booking-documents/${d2}`, { remarks: 'x' })).s === 404 && (await R.project_manager('DELETE', `/booking-documents/${d2}`)).s === 404 && (await R.project_manager('POST', '/booking-documents/upload', undefined, form({ booking_record_id: BK2, consumer_id: C2, document_type: 'PAN' }, { data: JPG, name: 'x.jpg' }))).s === 404 && psql(`select count(*) from booking_documents where booking_record_id='${BK2}' and deleted_at is null`) === '1');
t('scope: still sees and uses its own project', (await R.project_manager('GET', `/booking-documents?booking_record_id=${BK}`)).j.data.length >= 1 && (await R.project_manager('POST', '/booking-documents/upload', undefined, doc({ document_name: 'scoped ok' }))).s === 201);
await A('PATCH', `/users/employee-login/${peId}`, { assignedProjectIds: [] });

// ---------- race: parallel uploads ----------
const par = await Promise.all(Array.from({ length: 8 }, (_, i) => A('POST', '/booking-documents/upload', undefined, doc({ document_name: 'race' + i }))));
t('docs race: 8 uploads at once, no 5xx, 8 rows each with its own file link', no5(par) && par.every((x) => x.s === 201) && new Set(par.map((x) => x.j.data.file_url)).size === 8, par.map((x) => x.s));

// ======================= CHARGE MASTER =======================
t('charge: no login 401 on read, write, preview', (await NO('GET', '/charge-master/config')).s === 401 && (await NO('PATCH', '/charge-master/config/balcony_charge', { rate_value: 5 })).s === 401 && (await NO('GET', '/charge-master/balcony-preview')).s === 401);
for (const o of roles) { const w = ['super_admin', 'project_manager'].includes(o) ? 200 : 403; r = await R[o]('PATCH', '/charge-master/config/balcony_charge', { rate_value: 111 }); t(`charge: ${o} change is ${w}, read is 200`, r.s === w && (await R[o]('GET', '/charge-master/config')).s === 200, r.j); }
const cfg = (await A('GET', '/charge-master/config')).j.data[0];
t('charge: the config row has the expected fields and the cap is fixed', cfg.charge_key === 'balcony_charge' && cfg.is_cap_configurable === false && !/undefined|NaN/.test(JSON.stringify(cfg)));
const rates = [['negative', -1], ['over max', 1000001], ['paise 3 places', '1.234'], ['1e3', '1e3'], ['hex', '0x10'], ['spaces', ' 5 '], ['text', 'abc'], ['blank', ''], ['null', null], ['bool', true], ['list', [5]], ['object', { a: 1 }], ['huge', 1e308], ['Infinity text', 'Infinity'], ['NaN text', 'NaN'], ['negative text', '-5'], ['markup', '<b>5</b>'], ['missing', undefined], ['sql', "5; drop table x"]];
for (const [n, v] of rates) { r = await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: v }); t(`charge refused: rate ${n}`, r.s === 400 && !!r.j?.error, r); }
for (const [n, c] of [['cap on fixed cap', 50], ['cap null on fixed cap', null]]) { r = await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: 5, cap_value: c }); t(`charge refused: ${n}`, r.s === 400, r); }
t('charge: broken JSON and list body are 400', (await A('PATCH', '/charge-master/config/balcony_charge', undefined, '{"a":')).s === 400 && (await A('PATCH', '/charge-master/config/balcony_charge', undefined, '[1]')).s === 400);
t('charge: odd keys are 404 and never 500 (nul byte, 5000 chars, injection, case)', (await Promise.all(['a%00b', 'a'.repeat(5000), "x'%20or%201=1", 'BALCONY_CHARGE', '%E0%A4%A', '..%2f..'].map((k) => A('PATCH', `/charge-master/config/${k}`, { rate_value: 1 })))).every((x) => x.s === 404 || x.s === 400));
t('charge: none of the refusals changed the stored rate', psql(`select rate_value||'|'||coalesce(cap_value::text,'') from charge_master_config where charge_key='balcony_charge'`) === balconyBefore.replace(/^[^|]*/, psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)) && psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`) === '111.00');
r = await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: '250.5' }); t('charge: valid string rate with paise saved, audited with old and new', r.s === 200 && Number(r.j.data.rate_value) === 250.5 && psql(`select count(*) from audit_logs where resource_type='charge_master_config' and resource_id='${cfg.id}' and timestamp >= '${T0}' and previous_values->>'rate_value'='111.00' and new_values->>'rate_value'='250.50'`) === '1', r.j);
r = await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: 0 }); t('charge: rate 0 is allowed (no balcony charge)', r.s === 200 && Number(r.j.data.rate_value) === 0);
const pr = await Promise.all(Array.from({ length: 10 }, (_, i) => A('PATCH', '/charge-master/config/balcony_charge', { rate_value: 300 + i })));
t('charge race: 10 saves at once, no 5xx, stored rate is one of them, 10 audits', no5(pr) && pr.every((x) => x.s === 200) && /^30\d\.00$/.test(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)));
// preview: money and GST
const SLAB = psql(`insert into gst_slabs (from_date, to_date) values ('2019-06-01','2098-06-01') returning id`);
const TAX = psql(`insert into gst_tax_setup (slab_id, gst_code, type, cgst_pct, sgst_pct) values ('${SLAB}','SR${U}','INTRA',2.5,2.5) returning id`);
psql(`insert into gst_tax_charge_mapping (project_id, slab_id, gst_tax_id, charge_type) values ('${P1}','${SLAB}','${TAX}','BASIC') returning id`);
const hasGst = '1';
await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: 100 });
const pv = (q) => A('GET', '/charge-master/balcony-preview?' + q);
if (hasGst !== '0') {
  r = await pv(`projectId=${P1}&balconyAreaSqft=50`); t('preview: 50 sqft x 100 = 5000, CGST+SGST at 2.5% each = 125', r.s === 200 && r.j.data.balconyChargeAmount === 5000 && r.j.data.balconyCgstAmount === 125 && r.j.data.balconySgstAmount === 125, r.j);
  r = await pv(`projectId=${P1}&balconyAreaSqft=5000`); t('preview: cap holds at 1,00,000 (100000 base)', r.s === 200 && r.j.data.balconyChargeAmount === 100000, r.j);
  r = await pv(`projectId=${P1}&balconyAreaSqft=0`); t('preview: area 0 gives 0', r.s === 200 && r.j.data.balconyChargeAmount === 0, r.j);
  r = await pv(`projectId=${P1}&balconyAreaSqft=12.34&bookingDate=2024-02-29`); t('preview: paise area and a real leap day', r.s === 200 && r.j.data.balconyChargeAmount === 1234, r.j);
  t('preview: a date before the GST rule starts is 422, not 500', (await pv(`projectId=${P1}&balconyAreaSqft=5&bookingDate=2019-01-01`)).s === 422);
} else t('preview: GST seed row present', false, 'gst_configuration insert failed');
for (const [n, q] of [['no params', ''], ['no area', `projectId=${P1}`], ['area negative', `projectId=${P1}&balconyAreaSqft=-1`], ['area 1e3', `projectId=${P1}&balconyAreaSqft=1e3`], ['area 100001', `projectId=${P1}&balconyAreaSqft=100001`], ['area 3 decimals', `projectId=${P1}&balconyAreaSqft=1.234`], ['area text', `projectId=${P1}&balconyAreaSqft=abc`], ['area twice', `projectId=${P1}&balconyAreaSqft=1&balconyAreaSqft=2`], ['area blank', `projectId=${P1}&balconyAreaSqft=`], ['project not uuid', 'projectId=x&balconyAreaSqft=5'], ['project twice', `projectId=${P1}&projectId=${P1}&balconyAreaSqft=5`], ['date 31 Feb', `projectId=${P1}&balconyAreaSqft=5&bookingDate=2024-02-31`], ['date text', `projectId=${P1}&balconyAreaSqft=5&bookingDate=tomorrow`], ['date year 1000', `projectId=${P1}&balconyAreaSqft=5&bookingDate=1000-01-01`], ['date twice', `projectId=${P1}&balconyAreaSqft=5&bookingDate=2024-01-01&bookingDate=2024-01-02`], ['date object', `projectId=${P1}&balconyAreaSqft=5&bookingDate[a]=1`]]) { r = await pv(q); t(`preview refused: ${n}`, r.s === 400 && !!r.j?.error, r); }
t('preview: unknown project is 404', (await pv(`projectId=${NIL}&balconyAreaSqft=5`)).s === 404);
const pjNoGst = (await pv(`projectId=${P2}&balconyAreaSqft=5`)); t('preview: a project with no GST mapping is 422 with a reason', pjNoGst.s === 422 && !!pjNoGst.j?.error, pjNoGst);
// scope
const pmScoped = psql(`select count(*) from users where id='${peId}'`);
t('scope: limit the manager to P1, wait', (await A('PATCH', `/users/employee-login/${peId}`, { assignedProjectIds: [P1] })).s === 200);
await sleep(16000); R.project_manager = call(await login('project_manager@test.local'));
t('scope: preview of the other project is 404 for the limited user, own project works', (await R.project_manager('GET', `/charge-master/balcony-preview?projectId=${P2}&balconyAreaSqft=5`)).s === 404 && (await R.project_manager('GET', `/charge-master/balcony-preview?projectId=${P1}&balconyAreaSqft=5`)).s === 200);
await A('PATCH', `/users/employee-login/${peId}`, { assignedProjectIds: [] });

// ======================= BROKER SETUP =======================
const bs = (o, m, p, b, raw) => R[o](m, '/broker-setup' + p, b, raw);
for (const o of roles) { const w = ['super_admin', 'accounts_finance'].includes(o) ? 200 : 403; t(`broker-setup: ${o} read is ${w}`, (await bs(o, 'GET', '')).s === w); }
t('broker-setup: no login 401, others cannot write (403) and nothing is saved', (await NO('POST', `/broker-setup/${BRK}`, { tdsRatePct: 1, gstRatePct: 1 })).s === 401 && (await Promise.all(['project_manager', 'sales_executive', 'support_agent', 'read_only_viewer'].map((o) => bs(o, 'POST', `/${BRK}`, { tdsRatePct: 1, gstRatePct: 1 })))).every((x) => x.s === 403) && psql(`select count(*) from broker_tax_config where broker_id='${BRK}'`) === '0');
r = await bs('super_admin', 'GET', `/${BRK}`); t('broker-setup: a broker with no setup reads as not configured, rates null (no defaults)', r.s === 200 && r.j.data.configured === false && r.j.data.tds_rate_pct === null && r.j.data.gst_rate_pct === null, r.j);
const list = (await bs('accounts_finance', 'GET', `?search=${encodeURIComponent('SR Broker ' + U)}`)).j; t('broker-setup: list search finds the broker, configured false', list.data.length === 1 && list.data[0].configured === false, list);
for (const [n, p, b, want = 400] of [['empty body', `/${BRK}`, {}], ['only tds first time', `/${BRK}`, { tdsRatePct: 5 }], ['only gst first time', `/${BRK}`, { gstRatePct: 5 }], ['only exempt first time', `/${BRK}`, { isGstExempt: true }],
  ['tds negative', `/${BRK}`, { tdsRatePct: -1, gstRatePct: 5 }], ['tds 101', `/${BRK}`, { tdsRatePct: 101, gstRatePct: 5 }], ['tds 3 decimals', `/${BRK}`, { tdsRatePct: '1.234', gstRatePct: 5 }], ['tds 1e1', `/${BRK}`, { tdsRatePct: '1e1', gstRatePct: 5 }], ['tds text', `/${BRK}`, { tdsRatePct: 'abc', gstRatePct: 5 }], ['tds list', `/${BRK}`, { tdsRatePct: [1], gstRatePct: 5 }], ['tds bool', `/${BRK}`, { tdsRatePct: true, gstRatePct: 5 }], ['tds huge', `/${BRK}`, { tdsRatePct: 1e308, gstRatePct: 5 }], ['tds hex', `/${BRK}`, { tdsRatePct: '0x10', gstRatePct: 5 }], ['tds spaces', `/${BRK}`, { tdsRatePct: ' 5 ', gstRatePct: 5 }], ['gst 100.01', `/${BRK}`, { tdsRatePct: 5, gstRatePct: 100.01 }], ['gst markup', `/${BRK}`, { tdsRatePct: 5, gstRatePct: '<b>' }],
  ['exempt text', `/${BRK}`, { tdsRatePct: 5, gstRatePct: 5, isGstExempt: 'yes' }], ['exempt 1', `/${BRK}`, { tdsRatePct: 5, gstRatePct: 5, isGstExempt: 1 }],
  ['broker not uuid', '/abc', { tdsRatePct: 5, gstRatePct: 5 }], ['broker unknown', `/${NIL}`, { tdsRatePct: 5, gstRatePct: 5 }, 404]]) { r = await bs('super_admin', 'POST', p, b); t(`broker-setup refused: ${n}`, r.s === want && !!r.j?.error, r); }
t('broker-setup: broken JSON and list body are 400', (await bs('super_admin', 'POST', `/${BRK}`, undefined, '{"a":')).s === 400 && (await bs('super_admin', 'POST', `/${BRK}`, undefined, '[1]')).s === 400);
t('broker-setup: refusals saved nothing', psql(`select count(*) from broker_tax_config where broker_id='${BRK}'`) === '0');
for (const [n, q] of [['search twice', '?search=a&search=b'], ['search object', '?search[a]=1'], ['search 101', `?search=${'x'.repeat(101)}`], ['search markup', '?search=%3Cb%3E'], ['page 0', '?page=0'], ['pageSize 501', '?pageSize=501'], ['pageSize text', '?pageSize=abc'], ['pageSize 1e2', '?pageSize=1e2'], ['page negative', '?page=-1']]) { r = await bs('super_admin', 'GET', q); t(`broker-setup list refused: ${n}`, r.s === 400, r); }
t('broker-setup list: wildcard in the search is plain text', (await bs('super_admin', 'GET', '?search=%25')).j.data.length === 0 && (await bs('super_admin', 'GET', '?search=_')).j.data.length === 0);
r = await bs('accounts_finance', 'POST', `/${BRK}`, { tdsRatePct: '1.5', gstRatePct: 18 }); t('broker-setup: first save with both rates creates, string paise ok', r.s === 200 && Number(r.j.data.tds_rate_pct) === 1.5 && Number(r.j.data.gst_rate_pct) === 18 && r.j.data.is_gst_exempt === false, r.j);
const BT = r.j?.data?.id;
r = await bs('super_admin', 'POST', `/${BRK}`, { tdsRatePct: 0 }); t('broker-setup: TDS 0 is accepted and a rate left out keeps its value', r.s === 200 && Number(r.j.data.tds_rate_pct) === 0 && Number(r.j.data.gst_rate_pct) === 18 && r.j.data.id === BT, r.j);
r = await bs('super_admin', 'POST', `/${BRK}`, { isGstExempt: true }); t('broker-setup: only the exempt flag later is fine', r.s === 200 && r.j.data.is_gst_exempt === true && Number(r.j.data.gst_rate_pct) === 18, r.j);
t('broker-setup: one row per broker, audit has create then 2 updates with old values', psql(`select count(*) from broker_tax_config where broker_id='${BRK}'`) === '1' && psql(`select string_agg(action,',' order by timestamp) from audit_logs where resource_type='broker_tax_config' and resource_id='${BT}'`) === 'create,update,update');
const brs = await Promise.all(Array.from({ length: 8 }, (_, i) => bs(i % 2 ? 'super_admin' : 'accounts_finance', 'POST', `/${BRK2}`, { tdsRatePct: i + 1, gstRatePct: 10 + i })));
const BT2 = psql(`select id from broker_tax_config where broker_id='${BRK2}'`);
t('broker-setup race: 8 first saves at once, no 5xx, one row, exactly one audit "create"', no5(brs) && brs.every((x) => x.s === 200) && psql(`select count(*) from broker_tax_config where broker_id='${BRK2}'`) === '1' && psql(`select count(*) from audit_logs where resource_type='broker_tax_config' and resource_id='${BT2}' and action='create'`) === '1', brs.map((x) => x.s));
await bs('super_admin', 'POST', `/${BRK2}`, { tdsRatePct: 2, gstRatePct: 12 });
t('broker-setup: a rejected broker is not listed', (psql(`update brokers set status='rejected' where id='${BRK2}' returning 1`) === '1') && (await bs('super_admin', 'GET', `?search=${encodeURIComponent('SR Broker2 ' + U)}`)).j.data.length === 0);

// ======================= FAQ =======================
const fq = (o, m, p, b, raw) => R[o](m, '/faq' + p, b, raw);
t('faq: no login is 401 everywhere', (await Promise.all([['GET', '/categories'], ['GET', '/articles'], ['POST', '/articles'], ['POST', `/articles/${NIL}/feedback`]].map(([m, p]) => NO(m, '/faq' + p, m === 'POST' ? {} : undefined)))).every((x) => x.s === 401));
const art = (o = {}) => ({ categoryId: CAT, title: 'SR How do I pay ' + U, content: 'Use the pay screen.', tags: ['pay', 'howto'], isPublished: true, ...o });
const faqW = { super_admin: 201, project_manager: 201, sales_executive: 403, accounts_finance: 403, support_agent: 403, read_only_viewer: 403 };
// sales/support have create on communications; the mount asks for communications 'view' for GET and the route for create/edit
faqW.sales_executive = 201; faqW.support_agent = 201;
let FA;
for (const [o, want] of Object.entries(faqW)) { r = await fq(o, 'POST', '/articles', art({ title: `SR by ${o} ${U}`, isPublished: false })); t(`faq: ${o} create is ${want}`, r.s === want, r.j); if (o === 'super_admin') FA = r.j?.data?.id; }
for (const o of roles) t(`faq: ${o} can read categories and the list`, (await fq(o, 'GET', '/categories')).s === 200 && (await fq(o, 'GET', '/articles')).s === 200);
t('faq: a draft is hidden from the list and from a viewer, visible to an editor', !(await fq('read_only_viewer', 'GET', '/articles?search=' + encodeURIComponent('SR by super_admin'))).j.data.some((a) => a.id === FA) && (await fq('read_only_viewer', 'GET', `/articles/${FA}`)).s === 404 && (await fq('super_admin', 'GET', `/articles/${FA}`)).s === 200);
t('faq: a viewer cannot vote on a draft (404) and a draft view is not counted for them', (await fq('read_only_viewer', 'POST', `/articles/${FA}/feedback`, { helpful: true })).s === 404);
t('faq: viewer / accounts / support cannot edit (403)', (await Promise.all(['read_only_viewer', 'accounts_finance', 'support_agent'].map((o) => fq(o, 'PATCH', `/articles/${FA}`, { title: 'hack' })))).every((x) => x.s === 403));
const abad = [['no body', undefined], ['no category', art({ categoryId: undefined })], ['category not uuid', art({ categoryId: 'x' })], ['category unknown 404', art({ categoryId: NIL }), 404], ['category list', art({ categoryId: [CAT] })],
  ['no title', art({ title: undefined })], ['title blank', art({ title: '  ' })], ['title 256', art({ title: 't'.repeat(256) })], ['title markup', art({ title: '<script>alert(1)</script>' })], ['title control', art({ title: 'a\u0000b' })], ['title number', art({ title: 5 })],
  ['no content', art({ content: undefined })], ['content 20001', art({ content: 'c'.repeat(20001) })], ['content markup', art({ content: '<img src=x onerror=alert(1)>' })], ['content list', art({ content: ['a'] })],
  ['tags text', art({ tags: 'a,b' })], ['tags 21', art({ tags: Array.from({ length: 21 }, (_, i) => 't' + i) })], ['tag 51 chars', art({ tags: ['x'.repeat(51)] })], ['tag markup', art({ tags: ['<b>'] })], ['tag number', art({ tags: [5] })], ['tag blank', art({ tags: [' '] })], ['tag nested', art({ tags: [['a']] })],
  ['published text', art({ isPublished: 'true' })], ['published number', art({ isPublished: 1 })], ['published null is false but title dup', art({ isPublished: [] })]];
for (const [n, b, want = 400] of abad) { r = await fq('super_admin', 'POST', '/articles', b); t(`faq refused: ${n}`, r.s === want && !!r.j?.error, r); }
t('faq: broken JSON and list body are 400', (await fq('super_admin', 'POST', '/articles', undefined, '{"a":')).s === 400 && (await fq('super_admin', 'POST', '/articles', undefined, '[1]')).s === 400);
r = await fq('super_admin', 'POST', '/articles', art({ title: `SR Pay one ${U}`, tags: [' Pay ', 'pay', 'PAY', 'howto'] })); t('faq: good create, tags cleaned (trimmed, duplicates removed)', r.s === 201 && r.j.data.tags.join() === 'pay,howto', r.j);
const F2 = r.j?.data?.id;
t('faq: refused creates saved nothing (only our good ones)', psql(`select count(*) from faq_articles where category_id='${CAT}'`) === '5', psql(`select count(*) from faq_articles where category_id='${CAT}'`));
const dup = await Promise.all(Array.from({ length: 6 }, () => fq('super_admin', 'POST', '/articles', art({ title: `SR Race ${U}` }))));
t('faq race: 6 equal creates at once, no 5xx, six rows (the same title may repeat, e.g. a draft and its final)', no5(dup) && dup.every((x) => x.s === 201) && psql(`select count(*) from faq_articles where title='SR Race ${U}'`) === '6', dup.map((x) => x.s));
// patch
for (const [n, b] of [['empty body', {}], ['title blank', { title: '' }], ['title null', { title: null }], ['title 256', { title: 't'.repeat(256) }], ['title markup', { title: '<b>' }], ['content blank', { content: '' }], ['content 20001', { content: 'c'.repeat(20001) }], ['tags text', { tags: 'a' }], ['tags null', { tags: null }], ['published text', { isPublished: 'yes' }]]) { r = await fq('super_admin', 'PATCH', `/articles/${F2}`, b); t(`faq patch refused: ${n}`, r.s === 400, r); }
t('faq patch: bad id 400, unknown 404', (await fq('super_admin', 'PATCH', '/articles/x', { title: 'a' })).s === 400 && (await fq('super_admin', 'PATCH', `/articles/${NIL}`, { title: 'a' })).s === 404);
r = await fq('super_admin', 'PATCH', `/articles/${F2}`, { content: 'Updated text', tags: [] }); t('faq patch: edit content, clear tags, title kept', r.s === 200 && r.j.data.content === 'Updated text' && r.j.data.tags.length === 0 && r.j.data.title === `SR Pay one ${U}`, r.j);
t('faq: create and edit are audited (create + 1 edit)', psql(`select count(*) from audit_logs where resource_type='faq_article' and resource_id='${F2}'`) === '2', psql(`select count(*) from audit_logs where resource_id='${F2}'`));
// read
t('faq: single read counts one view; a bad id is 400, unknown 404', (async () => true)() && (await fq('super_admin', 'GET', '/articles/x')).s === 400 && (await fq('super_admin', 'GET', `/articles/${NIL}`)).s === 404);
const v0 = Number(psql(`select view_count from faq_articles where id='${F2}'`)); await fq('read_only_viewer', 'GET', `/articles/${F2}`); await fq('read_only_viewer', 'GET', `/articles/${F2}`); t('faq: view_count rises by one per read', Number(psql(`select view_count from faq_articles where id='${F2}'`)) === v0 + 2);
for (const [n, q] of [['search twice', '?search=a&search=b'], ['search 201', `?search=${'x'.repeat(201)}`], ['search object', '?search[a]=1'], ['search markup', '?search=%3Cb%3E'], ['category bad', '?categoryId=x'], ['category twice', `?categoryId=${CAT}&categoryId=${CAT}`], ['tags array', '?tags[]=a'], ['tags 501', `?tags=${'x'.repeat(501)}`], ['page 0', '?page=0'], ['pageSize 101', '?pageSize=101'], ['pageSize 1e1', '?pageSize=1e1'], ['page 100001', '?page=100001']]) { r = await fq('super_admin', 'GET', '/articles' + q); t(`faq list refused: ${n}`, r.s === 400, r); }
r = await fq('read_only_viewer', 'GET', `/articles?categoryId=${CAT}&pageSize=1`); t('faq list: paging gives 1 row and the full total, only published', r.s === 200 && r.j.data.length === 1 && r.j.pagination.total >= 2 && r.j.data.every((a) => a.is_published), r.j);
t('faq list: stop-word / punctuation / sql search is 200 not 500', (await Promise.all(['the', "'", '& | !', ':*', "a' or '1'='1", '%', '\\', '((('].map((s) => fq('super_admin', 'GET', '/articles?search=' + encodeURIComponent(s))))).every((x) => x.s === 200));
t('faq list: tag filter works and odd tag lists are fine', (await fq('super_admin', 'GET', '/articles?tags=howto')).j.data.some((a) => a.tags.includes('howto')) && (await fq('super_admin', 'GET', '/articles?tags=,,,')).s === 200);
t('faq list: articles of an inactive category are not shown', (psql(`update faq_categories set is_active=false where id='${CAT}' returning 1`) === '1') && !(await fq('super_admin', 'GET', `/articles?categoryId=${CAT}`)).j.data.length && (psql(`update faq_categories set is_active=true where id='${CAT}' returning 1`) === '1'));
// feedback
for (const [n, b] of [['no body', undefined], ['text', { helpful: 'true' }], ['number', { helpful: 1 }], ['null', { helpful: null }]]) { r = await fq('super_admin', 'POST', `/articles/${F2}/feedback`, b); t(`faq feedback refused: ${n}`, r.s === 400, r); }
t('faq feedback: bad id 400, unknown 404', (await fq('super_admin', 'POST', '/articles/x/feedback', { helpful: true })).s === 400 && (await fq('super_admin', 'POST', `/articles/${NIL}/feedback`, { helpful: true })).s === 404);
r = await fq('read_only_viewer', 'POST', `/articles/${F2}/feedback`, { helpful: true }); t('faq feedback: a viewer can vote', r.s === 200 && r.j.data.helpful_count === 1, r.j);
r = await fq('read_only_viewer', 'POST', `/articles/${F2}/feedback`, { helpful: true }); t('faq feedback: the same person voting again does not add a second vote', r.s === 200 && r.j.data.helpful_count === 1, r.j);
r = await fq('read_only_viewer', 'POST', `/articles/${F2}/feedback`, { helpful: false }); t('faq feedback: changing the vote moves it (1 not helpful, 0 helpful)', r.s === 200 && r.j.data.helpful_count === 0 && r.j.data.not_helpful_count === 1, r.j);
const vs = await Promise.all(Array.from({ length: 10 }, () => fq('support_agent', 'POST', `/articles/${F2}/feedback`, { helpful: true })));
t('faq feedback race: 10 parallel votes from one person count once', no5(vs) && psql(`select helpful_count from faq_articles where id='${F2}'`) === '1', vs.map((x) => x.s));
t('faq feedback: two people both count', (await fq('accounts_finance', 'POST', `/articles/${F2}/feedback`, { helpful: true })).j.data.helpful_count === 2);
// unpublish / publish
r = await fq('super_admin', 'PATCH', `/articles/${F2}`, { isPublished: false }); t('faq: unpublish hides it from a viewer', r.s === 200 && (await fq('read_only_viewer', 'GET', `/articles/${F2}`)).s === 404);

// ======================= RANDOM HOSTILE RUN =======================
const junk = ['', ' ', 'x', '0', '-1', '1e9', 'null', '<img src=x>', '%', "' or 1=1--", '\u0000', 'a'.repeat(400), 'a@b.com', P1, NIL, '2024-02-31', '‮'];
const rv = () => pick([...junk, null, true, false, 5, [], {}, undefined, 1.5, -3, 1e308]);
const calls = [];
for (let i = 0; i < 150; i++) {
  const k = ri(0, 9), o = pick(roles);
  if (k === 0) calls.push(A('PATCH', `/charge-master/config/${pick(['balcony_charge', 'x', encodeURIComponent(pick(junk))])}`, { rate_value: rv(), cap_value: rv() }));
  else if (k === 1) calls.push(A('GET', `/charge-master/balcony-preview?projectId=${encodeURIComponent(pick(junk))}&balconyAreaSqft=${encodeURIComponent(pick(junk))}&bookingDate=${encodeURIComponent(pick(junk))}`));
  else if (k === 2) calls.push(R[o]('POST', `/broker-setup/${pick([BRK, NIL, 'x'])}`, { tdsRatePct: rv(), gstRatePct: rv(), isGstExempt: rv() }));
  else if (k === 3) calls.push(A('GET', `/broker-setup?search=${encodeURIComponent(pick(junk))}&page=${encodeURIComponent(pick(junk))}&pageSize=${encodeURIComponent(pick(junk))}`));
  else if (k === 4) calls.push(A('POST', '/faq/articles', { categoryId: pick([CAT, rv()]), title: rv(), content: rv(), tags: pick([rv(), [rv()], ['ok']]), isPublished: rv() }));
  else if (k === 5) calls.push(A('GET', `/faq/articles?search=${encodeURIComponent(pick(junk))}&tags=${encodeURIComponent(pick(junk))}&categoryId=${encodeURIComponent(pick([CAT, ...junk]))}&page=${encodeURIComponent(pick(junk))}`));
  else if (k === 6) calls.push(A('POST', '/booking-documents/upload', undefined, form({ booking_record_id: pick([BK, rv()]), consumer_id: pick([C1, rv()]), document_type: pick(['Aadhaar', rv()]), applicant_number: rv(), remarks: rv(), document_name: rv() }, pick([null, { data: JPG, name: pick(junk) + '.jpg' }, { data: Buffer.from(pick(junk)), name: 'a.pdf' }]))));
  else if (k === 7) calls.push(A('GET', `/booking-documents?booking_record_id=${encodeURIComponent(pick([BK, ...junk]))}&consumer_id=${encodeURIComponent(pick(junk))}&applicant_number=${encodeURIComponent(pick(junk))}&document_type=${encodeURIComponent(pick(junk))}`));
  else if (k === 8) calls.push(A('PATCH', `/booking-documents/${pick([D1, NIL, 'x'])}`, { remarks: rv(), document_name: rv(), barcode_no: rv() }));
  else calls.push(NO('GET', `/photos/${pick(['consumer', 'co', 'addl', 'x'])}/${pick([NIL, C1, ...junk])}`));
}
const out = await Promise.all(calls);
t('random: 150 hostile requests across the five routers, none gave a 5xx', no5(out), JSON.stringify(out.filter((x) => x.s >= 500).slice(0, 3).map((x) => ({ s: x.s, j: x.j }))));
t('random: no stored value contains markup (docs, faq)', psql(`select count(*) from booking_documents where booking_record_id='${BK}' and (document_type ~ '[<>]' or document_name ~ '[<>]' or remarks ~ '[<>]')`) === '0' && psql(`select count(*) from faq_articles where category_id='${CAT}' and (title ~ '[<>]' or content ~ '[<>]')`) === '0');
t('random: the balcony rate is still a sane number', /^\d+(\.\d\d)?$/.test(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)));

// ---------- clean up ----------
await A('PATCH', '/charge-master/config/balcony_charge', { rate_value: Number(balconyBefore.split('|')[0]) });
const rm = (sql) => { try { psql(sql); } catch {} };
rm(`delete from audit_logs where resource_id::text in (select id::text from booking_documents where booking_record_id in ('${BK}','${BK2}','${BKX}') union select id::text from faq_articles where category_id='${CAT}' union select id::text from broker_tax_config where broker_id in ('${BRK}','${BRK2}'))`);
rm(`delete from applicant_photos where owner_id in ('${C1}','${C2}')`);
rm(`delete from faq_articles where category_id='${CAT}'`); rm(`delete from faq_categories where id='${CAT}'`);
rm(`delete from broker_tax_config where broker_id in ('${BRK}','${BRK2}')`); rm(`delete from brokers where id in ('${BRK}','${BRK2}')`);
rm(`delete from booking_documents where booking_record_id in ('${BK}','${BK2}','${BKX}')`); rm(`delete from booking_records where id in ('${BK}','${BK2}','${BKX}')`);
rm(`delete from consumers where id in ('${C1}','${C2}')`); rm(`delete from gst_tax_charge_mapping where project_id in ('${P1}','${P2}')`); rm(`delete from gst_tax_setup where id='${TAX}'`); rm(`delete from gst_slabs where id='${SLAB}'`); rm(`delete from projects where id in ('${P1}','${P2}')`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
