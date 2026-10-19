// Documents group checks: Document Checklist, Dispatch Log, Customized Letters (templates, letters made, register).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-documents.mjs
// Needs psql (PSQL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) to put applicants and bookings into the database.
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim().split('\n')[0];
let pass = 0, fail = 0; const fails = [];
const t = (n, ok, x = '') => { ok ? pass++ : (fail++, fails.push(n + ' -> ' + x)); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email, password = 'Test#Pass1234') => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const call = tok => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const PM = call(await login('project_manager@test.local'));
const SE = call(await login('sales_executive@test.local'));
const SA = call(await login('support_agent@test.local'));
const RV = call(await login('read_only_viewer@test.local'));
const U = Date.now().toString(36).slice(-6);
const NIL = '00000000-0000-0000-0000-000000000000';
let r;

// ---------- Document Checklist (document types) ----------
const dn = 'Doc ' + U;
r = await A('POST', '/master/document-types', { required_at: 'On Booking' }); t('checklist: no name -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn }); t('checklist: no stage -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: '<b>x', required_at: 'On Booking' }); t('checklist: markup in name -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'Someday' }); t('checklist: unknown stage -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'On Booking', document_from: 'Robot' }); t('checklist: unknown "from" -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'On Booking', is_mandatory: 'yes' }); t('checklist: mandatory must be true/false -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'On Booking', description: 'x'.repeat(501) }); t('checklist: description over 500 -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'On Booking', project_id: NIL }); t('checklist: unknown project -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-types', { name: dn, required_at: 'On Booking', is_mandatory: true }); t('checklist: add', r.s === 201 && r.j.data.is_mandatory === true && r.j.data.document_from === 'Individual', JSON.stringify(r.j)); const dtid = r.j?.data?.id;
r = await A('POST', '/master/document-types', { name: dn.toUpperCase(), required_at: 'On Allotment' }); t('checklist: same name other case -> 409', r.s === 409, r.s);
r = await SE('POST', '/master/document-types', { name: 'Se ' + U, required_at: 'On Booking' }); t('checklist: sales_executive cannot add -> 403', r.s === 403, r.s);
r = await PM('POST', '/master/document-types', { name: 'Pm ' + U, required_at: 'On Booking' }); t('checklist: project_manager can add', r.s === 201, r.s); const pmdt = r.j?.data?.id;
r = await PM('DELETE', '/master/document-types/' + pmdt); t('checklist: project_manager cannot delete -> 403', r.s === 403, r.s);
r = await SA('GET', '/master/document-types'); t('checklist: every signed-in role may read', r.s === 200 && r.j.data.some((x) => x.id === dtid), r.s);
r = await A('PUT', '/master/document-types/' + dtid, { required_at: 'On Agreement' }); t('checklist: partial edit keeps the other fields', r.s === 200 && r.j.data.is_mandatory === true && r.j.data.name === dn && r.j.data.required_at === 'On Agreement', JSON.stringify(r.j));
r = await A('PUT', '/master/document-types/' + dtid, {}); t('checklist: edit with nothing -> 400', r.s === 400, r.s);
r = await A('PUT', '/master/document-types/' + NIL, { name: 'x' + U }); t('checklist: edit unknown -> 404', r.s === 404, r.s);
r = await A('PUT', '/master/document-types/' + pmdt, { name: dn }); t('checklist: rename to an existing name -> 409', r.s === 409, r.s);
const CO = (await A('POST', '/companies', { name: 'Doc Co ' + U })).j.data.id;
const mkProject = async (tag) => (await A('POST', '/projects', { companyId: CO, name: `Doc ${tag} ${U}`, reraNumber: `DC${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProject('A'), P2 = await mkProject('B');
r = await A('POST', '/master/document-types', { name: 'Proj doc ' + U, required_at: 'On Booking', project_id: P1 }); const projdt = r.j?.data?.id;
r = await A('GET', '/master/document-types?project_id=' + P2); t('checklist: a project list is its own documents plus the global ones', r.j.data.some((x) => x.id === dtid) && !r.j.data.some((x) => x.id === projdt), r.s);
r = await A('GET', '/master/document-types?project_id=' + P1); t('checklist: and shows the project\'s own', r.j.data.some((x) => x.id === projdt));

// ---------- Dispatch log ----------
const consumer = (name, project) => sql(`INSERT INTO consumers (name, mobile, project_id) VALUES ('${name.replace(/'/g, "''")}', lpad((random()*1e9)::int::text, 10, '9'), ${project ? `'${project}'` : 'NULL'}) RETURNING id`);
const c1 = consumer('Dispatch Person ' + U, P1);
const dv = (o = {}) => ({ document_type: dn, dispatch_mode: 'Courier', tracking_no: 'TRK' + U, consumer_id: c1, dispatched_at: new Date().toISOString().slice(0, 10), ...o });
r = await A('POST', '/master/document-dispatch', dv({ document_type: '' })); t('dispatch: no document -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ dispatch_mode: '' })); t('dispatch: no mode -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ dispatch_mode: 'Pigeon' })); t('dispatch: unknown mode -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ dispatched_at: 'yesterday' })); t('dispatch: bad date -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ dispatched_at: '2999-01-01' })); t('dispatch: future date -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ consumer_id: NIL })); t('dispatch: unknown consumer -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ consumer_id: 'abc' })); t('dispatch: bad consumer id -> 400, not 500', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ tracking_no: 'x'.repeat(101) })); t('dispatch: tracking number over 100 -> 400', r.s === 400, r.s);
r = await A('POST', '/master/document-dispatch', dv({ document_type: '<i>x' })); t('dispatch: markup -> 400', r.s === 400, r.s);
r = await SE('POST', '/master/document-dispatch', dv()); t('dispatch: sales_executive cannot log -> 403', r.s === 403, r.s);
r = await A('POST', '/master/document-dispatch', dv()); t('dispatch: log', r.s === 201, JSON.stringify(r.j)); const ddid = r.j?.data?.id;
r = await A('POST', '/master/document-dispatch', dv({ tracking_no: null, consumer_id: null, document_type: 'Other ' + U, dispatch_mode: 'Email' })); t('dispatch: tracking and consumer are optional', r.s === 201, r.s); const dd2 = r.j?.data?.id;
r = await A('PUT', '/master/document-dispatch/' + ddid, { tracking_no: 'FIX' + U, dispatch_mode: 'Speed Post' }); t('dispatch: edit tracking and mode', r.s === 200 && r.j.data.tracking_no === 'FIX' + U && r.j.data.dispatch_mode === 'Speed Post' && r.j.data.document_type === dn, JSON.stringify(r.j));
r = await A('PUT', '/master/document-dispatch/' + ddid, {}); t('dispatch: edit with nothing -> 400', r.s === 400, r.s);
r = await A('PUT', '/master/document-dispatch/' + ddid, { dispatch_mode: 'Pigeon' }); t('dispatch: edit to a bad mode -> 400', r.s === 400, r.s);
r = await A('PUT', '/master/document-dispatch/' + NIL, { tracking_no: 'x' }); t('dispatch: edit unknown -> 404', r.s === 404, r.s);
r = await A('PUT', '/master/document-dispatch/abc', { tracking_no: 'x' }); t('dispatch: edit bad id -> 404', r.s === 404, r.s);
r = await SE('PUT', '/master/document-dispatch/' + ddid, { tracking_no: 'x' }); t('dispatch: sales_executive cannot edit -> 403', r.s === 403, r.s);
r = await A('GET', '/master/document-dispatch?q=FIX' + U); t('dispatch: search by tracking number', r.s === 200 && r.j.data.length === 1 && r.j.data[0].consumer_name === 'Dispatch Person ' + U, JSON.stringify(r.j).slice(0, 120));
r = await A('GET', '/master/document-dispatch?q=' + encodeURIComponent('Dispatch Person ' + U)); t('dispatch: search by consumer name', r.s === 200 && r.j.data.some((x) => x.id === ddid));
r = await A('GET', '/master/document-dispatch?q=' + encodeURIComponent('%')); t('dispatch: % in the search is text, not a wildcard', r.s === 200 && r.j.data.length === 0, r.j.data?.length);
r = await A('GET', '/master/document-dispatch?consumer_id=' + c1); t('dispatch: filter by consumer', r.s === 200 && r.j.data.length === 1);
r = await A('GET', '/master/document-dispatch?from=2000-01-01&to=2000-01-02'); t('dispatch: old date range is empty', r.s === 200 && r.j.data.length === 0);
const today = new Date().toISOString().slice(0, 10);
r = await A('GET', `/master/document-dispatch?from=${today}&to=${today}&q=${U}`); t('dispatch: today\'s range includes today (To is inclusive)', r.s === 200 && r.j.data.length >= 1, r.s);
r = await A('GET', '/master/document-dispatch?from=yesterday'); t('dispatch: bad date filter -> 400', r.s === 400, r.s);
r = await A('GET', '/master/document-dispatch?consumer_id=x'); t('dispatch: bad consumer filter -> 400', r.s === 400, r.s);
r = await A('GET', '/master/document-dispatch?pageSize=1&q=' + U); t('dispatch: paging says when there is more', r.s === 200 && r.j.data.length === 1 && r.j.has_more === true, JSON.stringify(r.j).slice(0, 100));
r = await A('GET', '/master/document-dispatch?pageSize=1&page=2&q=' + U); t('dispatch: second page', r.s === 200 && r.j.data.length === 1 && r.j.has_more === false);
r = await A('PUT', '/master/document-types/' + dtid, { name: dn + ' renamed' }); r = await A('GET', '/master/document-dispatch?consumer_id=' + c1);
t('checklist: renaming a document renames its dispatch entries too', r.j.data[0].document_type === dn + ' renamed', r.j.data[0]?.document_type);
r = await A('DELETE', '/master/document-types/' + dtid); t('checklist: a document used in the dispatch log cannot be deleted -> 409', r.s === 409, r.s);
r = await SE('DELETE', '/master/document-dispatch/' + dd2); t('dispatch: sales_executive cannot delete -> 403', r.s === 403, r.s);
r = await A('DELETE', '/master/document-dispatch/' + dd2); t('dispatch: delete', r.s === 200, r.s);
r = await A('DELETE', '/master/document-dispatch/' + dd2); t('dispatch: delete again -> 404', r.s === 404, r.s);
r = await A('DELETE', '/master/document-dispatch/' + ddid); r = await A('DELETE', '/master/document-types/' + dtid); t('checklist: delete once nothing uses it', r.s === 200, r.s);
await A('DELETE', '/master/document-types/' + projdt);

// ---------- Customized Letters: templates ----------
const letter = (o = {}) => ({ project_id: P1, name: 'Welcome ' + U, subject: 'Welcome to {{projectName}}', body_html: '<p>Dear {{consumerName}}, welcome to {{projectName}}.</p>', ...o });
const bad = async (n, o, re) => { const x = await A('POST', '/custom-letters', letter(o)); t('letter create: ' + n, x.s === 400 && (!re || re.test(x.j.error)), x.s + ' ' + JSON.stringify(x.j)); };
await bad('no project', { project_id: undefined }, /Project/);
await bad('unknown project', { project_id: NIL }, /Project/);
await bad('no name', { name: ' ' }, /name/i);
await bad('name over 150', { name: 'x'.repeat(151) }, /150/);
await bad('no subject', { subject: '' }, /Subject/);
await bad('empty body', { body_html: '<p>&nbsp;</p>' }, /content/i);
await bad('body not text', { body_html: 5 }, /content/i);
await bad('unknown header type', { header_type: 'Fancy' });
await bad('unknown letter for', { letter_for: 'Everyone' });
await bad('unknown letter type', { letter_type: 'XYZ' });
await bad('header width not a number', { header_width: 'wide' }, /width/i);
await bad('header width too large', { header_width: 900 });
await bad('ref flag not boolean', { is_ref_no: 'yes' });
await bad('prefix with spaces', { prefix_ref: 'A B' }, /Prefix/);
r = await SE('POST', '/custom-letters', letter()); t('letter create: sales_executive cannot manage templates -> 403', r.s === 403, r.s);
r = await SA('POST', '/custom-letters', letter()); t('letter create: support_agent -> 403', r.s === 403, r.s);
r = await A('POST', '/custom-letters', letter()); t('letter create: ok', r.s === 201, JSON.stringify(r.j)); const lid = r.j?.data?.id;
r = await A('POST', '/custom-letters', letter({ name: ('Welcome ' + U).toUpperCase() })); t('letter create: same name in the project other case -> 409', r.s === 409, r.s);
r = await A('POST', '/custom-letters', letter({ project_id: P2 })); t('letter create: same name in another project is fine', r.s === 201, r.s); const lid2 = r.j?.data?.id;
r = await PM('GET', '/custom-letters'); t('letters: project_manager sees them, may manage and edit but not delete', r.s === 200 && r.j.can.canManage && r.j.can.canEdit && !r.j.can.canDelete && r.j.can.canGenerate, JSON.stringify(r.j?.can));
r = await SE('GET', '/custom-letters'); t('letters: sales_executive may read and make, not manage', r.s === 200 && !r.j.can.canManage && r.j.can.canGenerate, JSON.stringify(r.j?.can));
r = await SA('GET', '/custom-letters'); t('letters: support_agent may read only', r.s === 200 && !r.j.can.canGenerate && !r.j.can.canManage, JSON.stringify(r.j?.can));
r = await A('GET', '/custom-letters?project_id=' + P2); t('letters: filter by project', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === lid2, r.j.data?.length);
r = await A('GET', '/custom-letters?q=' + encodeURIComponent('%')); t('letters: % in the search is text', r.s === 200 && r.j.data.length === 0, r.j.data?.length);
r = await A('GET', '/custom-letters?project_id=x'); t('letters: bad project filter -> 400', r.s === 400, r.s);
r = await A('GET', '/custom-letters/' + lid); t('letter: read one', r.s === 200 && r.j.data.letter_meta.subject.startsWith('Welcome') && r.j.data.version_number === 1, r.s);
r = await A('GET', '/custom-letters/abc'); t('letter: bad id -> 404', r.s === 404, r.s);
r = await A('GET', '/custom-letters/' + NIL); t('letter: unknown -> 404', r.s === 404, r.s);
r = await PM('PUT', '/custom-letters/' + lid, { subject: 'New subject' }); t('letter edit: only the sent field changes, meta kept, version up', r.s === 200 && r.j.data.version_number === 2 && r.j.data.letter_meta.subject === 'New subject' && r.j.data.letter_meta.letter_type === 'Other' && r.j.data.body_html.includes('welcome'), JSON.stringify(r.j).slice(0, 200));
r = await A('PUT', '/custom-letters/' + lid, { name: 'x'.repeat(200) }); t('letter edit: bad value -> 400', r.s === 400, r.s);
r = await A('PUT', '/custom-letters/' + lid, { name: ('Welcome ' + U).toUpperCase() }); t('letter edit: its own name again is fine', r.s === 200, r.s);
r = await A('PUT', '/custom-letters/' + lid, { project_id: P2 }); t('letter edit: moving into a project that has the same name -> 409', r.s === 409, r.s);
r = await SE('PUT', '/custom-letters/' + lid, { subject: 'x' }); t('letter edit: sales_executive -> 403', r.s === 403, r.s);
r = await A('PUT', '/custom-letters/' + NIL, { subject: 'x' }); t('letter edit: unknown -> 404', r.s === 404, r.s);
r = await PM('DELETE', '/custom-letters/' + lid2); t('letter delete: project_manager -> 403', r.s === 403, r.s);
r = await A('DELETE', '/custom-letters/' + lid2); t('letter delete: super_admin', r.s === 200, r.s);
r = await A('DELETE', '/custom-letters/' + lid2); t('letter delete: again -> 404', r.s === 404, r.s);

// ---------- Customized Letters: making a letter ----------
const vars = (await A('GET', '/custom-letters/variables')).j.data;
const keys = vars.flatMap((g) => g.vars.map((v) => v.key));
t('variables: the catalogue lists them by group', vars.length >= 6 && keys.includes('refNo') && keys.includes('consumerName'), keys.length);
const evil = "<script>alert(1)</script> $& O'Neil";
const cx = consumer(evil, P1);
const allTok = await A('POST', '/custom-letters', letter({ name: 'All vars ' + U, body_html: '<p>' + keys.map((k) => `{{${k}}}`).join(' ') + ' {{notAVariable}} {{ consumerName }}</p>' }));
r = await A('POST', `/custom-letters/${allTok.j.data.id}/generate`, { consumer_id: cx });
t('letter made: every catalogue variable is filled in (none left as {{...}} except the unknown one)', r.s === 200 && r.j.data.unresolved.join() === 'notAVariable' && (r.j.data.html.match(/\{\{/g) || []).length === 1, r.s + ' ' + JSON.stringify(r.j).slice(0, 200));
t('letter made: applicant data is escaped (no script, $& kept as text)', !r.j.data.html.includes('<script>') && r.j.data.html.includes('&lt;script&gt;') && r.j.data.html.includes('$&amp;') && r.j.data.html.includes('O&#39;Neil'), r.j.data.html.slice(0, 160));
t('letter made: spaces inside the braces are accepted', !r.j.data.html.includes('{{ consumerName }}'));
r = await A('POST', `/custom-letters/${lid}/generate`, {}); t('letter made: no applicant -> 400', r.s === 400, r.s);
r = await A('POST', `/custom-letters/${lid}/generate`, { consumer_id: NIL }); t('letter made: unknown applicant -> 404', r.s === 404, r.s);
r = await A('POST', `/custom-letters/${NIL}/generate`, { consumer_id: c1 }); t('letter made: unknown letter -> 404', r.s === 404, r.s);
r = await SA('POST', `/custom-letters/${lid}/generate`, { consumer_id: c1 }); t('letter made: support_agent -> 403', r.s === 403, r.s);
r = await RV('POST', `/custom-letters/${lid}/generate`, { consumer_id: c1 }); t('letter made: read_only_viewer -> 403', r.s === 403, r.s);
r = await SE('POST', `/custom-letters/${lid}/generate`, { consumer_id: c1 }); t('letter made: sales_executive may make letters', r.s === 200 && r.j.data.html.includes('Dispatch Person'), r.s + JSON.stringify(r.j).slice(0, 100));
const other = (await A('POST', '/custom-letters', letter({ project_id: P2, name: 'Other proj ' + U }))).j.data.id;
r = await A('POST', `/custom-letters/${other}/generate`, { consumer_id: c1 }); t('letter made: a letter of another project than the applicant\'s -> 400', r.s === 400, r.s);

// Loan / Self
const loanLetter = (await A('POST', '/custom-letters', letter({ name: 'Loan ' + U, letter_for: 'Loan' }))).j.data.id;
const selfLetter = (await A('POST', '/custom-letters', letter({ name: 'Self ' + U, letter_for: 'Self' }))).j.data.id;
r = await A('POST', `/custom-letters/${loanLetter}/generate`, { consumer_id: c1 }); t('Loan letter: applicant without a booking -> 400', r.s === 400 && /booking/.test(r.j.error), JSON.stringify(r.j));
sql(`INSERT INTO booking_records (consumer_id, project_id, status, self_or_loan, booking_date, selected_plan_name) VALUES ('${c1}', '${P1}', 'active', 'self', CURRENT_DATE, 'Plan X') RETURNING id`);
r = await A('POST', `/custom-letters/${loanLetter}/generate`, { consumer_id: c1 }); t('Loan letter: self-funded booking -> 400', r.s === 400 && /loan/.test(r.j.error), JSON.stringify(r.j));
r = await A('POST', `/custom-letters/${selfLetter}/generate`, { consumer_id: c1 }); t('Self letter: self-funded booking -> 200', r.s === 200, JSON.stringify(r.j));
const c2 = consumer('Loan Person ' + U, P1);
sql(`INSERT INTO booking_records (consumer_id, project_id, status, self_or_loan, booking_date) VALUES ('${c2}', '${P1}', 'active', 'loan', CURRENT_DATE) RETURNING id`);
r = await A('POST', `/custom-letters/${loanLetter}/generate`, { consumer_id: c2 }); t('Loan letter: loan booking -> 200', r.s === 200, JSON.stringify(r.j));
r = await A('POST', `/custom-letters/${selfLetter}/generate`, { consumer_id: c2 }); t('Self letter: loan booking -> 400', r.s === 400, r.s);
sql(`UPDATE booking_records SET status = 'cancelled' WHERE consumer_id = '${c2}'`);
r = await A('POST', `/custom-letters/${loanLetter}/generate`, { consumer_id: c2 }); t('a cancelled booking is not used', r.s === 400, r.s);

// Reference numbers
const PFX = 'ROF/W' + U;
const refLetter = (await A('POST', '/custom-letters', letter({ name: 'Ref ' + U, is_ref_no: true, prefix_ref: PFX, body_html: '<p>Hello {{consumerName}}</p>' }))).j.data.id;
const c3 = consumer('Ref Person ' + U, P1);
r = await A('POST', `/custom-letters/${refLetter}/generate`, { consumer_id: c3 });
const fy = (() => { const d = new Date(); const s = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${s}-${String(s + 1).slice(2)}`; })();
t('reference: first letter gets PREFIX/FY/0001', r.s === 200 && r.j.data.ref_no === `${PFX}/${fy}/0001` && r.j.data.html.includes(`Ref. No.: ${PFX}/${fy}/0001`), JSON.stringify(r.j).slice(0, 160));
r = await A('POST', `/custom-letters/${refLetter}/generate`, { consumer_id: c3 }); t('reference: the next one is 0002 (no duplicate flag: a new number)', r.s === 200 && r.j.data.ref_no === `${PFX}/${fy}/0002` && !r.j.data.duplicate, r.j?.data?.ref_no);
const racers = await Promise.all(Array.from({ length: 8 }, () => A('POST', `/custom-letters/${refLetter}/generate`, { consumer_id: c3 })));
const refs = racers.map((x) => x.j?.data?.ref_no);
t('reference: 8 letters at once get 8 different numbers', racers.every((x) => x.s === 200) && new Set(refs).size === 8, refs.join(','));
t('reference: and the numbers run on without a gap', [...refs].sort().join() === Array.from({ length: 8 }, (_, i) => `${PFX}/${fy}/${String(i + 3).padStart(4, '0')}`).join(), [...refs].sort().join());
const dupLetter = (await A('POST', '/custom-letters', letter({ name: 'Dup ' + U, is_ref_no: true, is_duplicate: true, prefix_ref: 'ROF/D' + U, body_html: 'Ref {{refNo}} for {{consumerName}}' }))).j.data.id;
const first = (await A('POST', `/custom-letters/${dupLetter}/generate`, { consumer_id: c3 })).j.data;
const again = (await A('POST', `/custom-letters/${dupLetter}/generate`, { consumer_id: c3 })).j.data;
t('duplicate copy: a second letter for the same applicant keeps the number and is marked DUPLICATE', first.ref_no === again.ref_no && again.duplicate === true && again.html.includes('DUPLICATE COPY') && !first.duplicate, JSON.stringify([first.ref_no, again.ref_no]));
t('reference: {{refNo}} in the letter is used, no extra Ref. No. line added', !first.html.includes('Ref. No.:') && first.html.includes(first.ref_no));
const nref = (await A('POST', '/custom-letters', letter({ name: 'NoRef ' + U }))).j.data.id;
r = await A('POST', `/custom-letters/${nref}/generate`, { consumer_id: c3 }); t('reference: a letter without a reference number has none', r.s === 200 && r.j.data.ref_no === '' && !r.j.data.html.includes('Ref. No.'), JSON.stringify(r.j.data.ref_no));

const shared = (await A('POST', '/custom-letters', letter({ name: 'Shared ' + U, is_ref_no: true, prefix_ref: PFX }))).j.data.id;
r = await A('POST', `/custom-letters/${shared}/generate`, { consumer_id: c3 }); t('reference: two templates with one prefix share one number series (no number twice)', r.s === 200 && r.j.data.ref_no === `${PFX}/${fy}/0011`, r.j?.data?.ref_no);

// Header
const hc = (await A('POST', '/custom-letters', letter({ name: 'HdrC ' + U, header_type: 'Computer Generated' }))).j.data.id;
const ho = (await A('POST', '/custom-letters', letter({ name: 'HdrO ' + U, header_type: 'Own Header', header_width: 90 }))).j.data.id;
r = await A('POST', `/custom-letters/${hc}/generate`, { consumer_id: c3 }); t('header: computer made header carries the company name block', r.s === 200 && r.j.data.html.includes('border-bottom') && r.j.data.html.includes('Doc Co'), r.s);
r = await A('POST', `/custom-letters/${ho}/generate`, { consumer_id: c3 }); t('header: own letterhead leaves blank space of the set height', r.s === 200 && r.j.data.html.startsWith('<div style="height:90px"></div>'), r.j?.data?.html?.slice(0, 60));

// Register
r = await A('GET', '/custom-letters/log?q=' + encodeURIComponent(PFX + '/' + fy + '/0001')); t('register: search by reference number', r.s === 200 && r.j.data.length === 1 && r.j.data[0].consumer_name === 'Ref Person ' + U && r.j.data[0].generated_by_name, JSON.stringify(r.j).slice(0, 160));
r = await A('GET', '/custom-letters/log?consumer_id=' + c3); t('register: filter by applicant', r.s === 200 && r.j.data.length >= 12, r.j.data?.length);
r = await A('GET', '/custom-letters/log?consumer_id=' + c3 + '&pageSize=5&page=2'); t('register: paging', r.s === 200 && r.j.data.length === 5, r.j.data?.length);
r = await A('GET', '/custom-letters/log?template_id=' + dupLetter); t('register: duplicate copies are listed and marked', r.s === 200 && r.j.data.length === 2 && r.j.data.filter((x) => x.is_duplicate).length === 1, JSON.stringify(r.j.data?.map((x) => x.is_duplicate)));
r = await A('GET', '/custom-letters/log?from=2000-01-01&to=2000-01-02'); t('register: old date range is empty', r.s === 200 && r.j.data.length === 0);
r = await A('GET', '/custom-letters/log?from=today'); t('register: bad date -> 400', r.s === 400, r.s);
r = await A('GET', '/custom-letters/log?consumer_id=x'); t('register: bad applicant id -> 400', r.s === 400, r.s);
r = await SA('GET', '/custom-letters/log'); t('register: support_agent may read', r.s === 200, r.s);
r = await A('DELETE', '/custom-letters/' + dupLetter); r = await A('GET', '/custom-letters/log?q=' + encodeURIComponent('Dup ' + U));
t('register: deleting a template keeps its register rows with the template name', r.s === 200 && r.j.data.length === 2 && r.j.data[0].template_name === 'Dup ' + U, JSON.stringify(r.j).slice(0, 120));
const noLog = sql(`SELECT count(*) FROM custom_letter_log WHERE ref_seq IS NOT NULL GROUP BY ref_prefix, financial_year, ref_seq HAVING count(*) > 1`);
t('register: no reference number is used twice (database check)', noLog === '', noLog);

// ---------- A login limited to one project ----------
const PW = 'Docs#Pass' + U.replace(/\D/g, '') + '1';
const lim = await A('POST', '/users/employee-login', { username: 'doc_' + U, email: `doc.${U}@example.com`, password: PW, confirmPassword: PW, role: 'sales_executive', assignedProjectIds: [P1] });
const LIM = call(await login(`doc.${U}@example.com`, PW));
const cP2 = consumer('Other Project Person ' + U, P2);
const lP2 = (await A('POST', '/custom-letters', letter({ project_id: P2, name: 'P2 letter ' + U }))).j.data.id;
await A('POST', `/custom-letters/${lP2}/generate`, { consumer_id: cP2 });
r = await LIM('GET', '/custom-letters'); t('project scope: the limited login sees only its project\'s letters', r.s === 200 && r.j.data.some((x) => x.id === lid) && !r.j.data.some((x) => x.id === lP2), r.s);
r = await LIM('POST', `/custom-letters/${lP2}/generate`, { consumer_id: cP2 }); t('project scope: cannot make a letter for another project\'s applicant -> 404', r.s === 404, r.s);
r = await LIM('GET', '/custom-letters/log?pageSize=200'); t('project scope: the register shows only its project\'s letters', r.s === 200 && !r.j.data.some((x) => x.consumer_name === 'Other Project Person ' + U) && r.j.data.some((x) => x.consumer_name === 'Ref Person ' + U), r.s);
r = await LIM('GET', '/master/document-dispatch?q=' + U); t('project scope: the dispatch log too', r.s === 200, r.s);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
process.exit(fail ? 1 : 0);
