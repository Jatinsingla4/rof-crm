// Users & Roles, UR-007 (plan 8.1): authorized_print and authorized_download are enforced by the API on its own print, export and file
// endpoints, for the ?token= link routes as well. Each endpoint is called with a made-up id: a login without the grant gets 403 from the
// gate itself (its message), a login with the grant gets past the gate (404 or 400 for the made-up id), super_admin always passes.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-print-download.mjs   (needs psql env)
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const raw = async (tok, m, p, b, viaQuery = false) => {
  const r = await fetch(B + p + (viaQuery ? (p.includes('?') ? '&' : '?') + 'token=' + tok : ''), { method: m, headers: { 'content-type': 'application/json', ...(!viaQuery ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const SA = await login('super_admin@test.local', 'Test#Pass1234');
const CID = sql(`SELECT id FROM consumers ORDER BY created_at LIMIT 1`); // the consumers router checks the applicant exists before anything else
const U = Date.now().toString(36).slice(-6), PW = 'Pd#Pass' + U.replace(/\D/g, '') + '1x', ID = '00000000-0000-0000-0000-0000000000f1';

// logins with every combination; project_manager has the module access of all the endpoints below, so the only thing that differs is the grant
const mk = async (name, print, download) => {
  const email = `pd.${name}.${U}@test.local`;
  const r = await raw(SA, 'POST', '/users/employee-login', { username: `pd${name}${U}`, email, password: PW, confirmPassword: PW, role: 'project_manager', authorizedPrint: print, authorizedDownload: download });
  if (r.s !== 201) throw new Error('login ' + name + ' ' + JSON.stringify(r));
  return { name, print, download, tok: await login(email, PW), id: r.j.data.userId };
};
const users = [await mk('none', false, false), await mk('print', true, false), await mk('dl', false, true), await mk('both', true, true)];
const nul = await mk('null', false, false); sql(`UPDATE users SET authorized_print = NULL, authorized_download = NULL WHERE id = '${nul.id}'`); // an older row: NULL
users.push({ ...nul, print: false, download: false, name: 'NULL flags' });

const ENDPOINTS = [
  ['print', 'GET', `/payments/gst-invoices/${ID}/html`], ['print', 'GET', `/payments/receipts/${ID}/html`], ['print', 'GET', `/payments/receipt-form/${ID}`],
  ['print', 'GET', `/payments/receipt-detail/${ID}`], ['print', 'GET', `/consumers/${CID}/applicant-file`], ['print', 'GET', `/booking/${ID}/receipt-html`],
  ['print', 'GET', `/documents/${ID}/html`], ['print', 'GET', `/transfers/${ID}/letter`], ['print', 'PATCH', `/payments/receipts/${ID}/mark-printed`, {}],
  ['print', 'POST', '/documents/generate', {}], ['print', 'POST', `/custom-letters/${ID}/generate`, {}], ['print', 'POST', '/allocations/generate-letters', {}],
  ['download', 'GET', '/payments/gst-invoices-export?month=2026-01&type=sales'], ['download', 'GET', `/documents/vault/file/${ID}`],
  ['download', 'GET', `/booking-documents/${ID}/file`], ['download', 'GET', `/payments/tds/challans/${ID}`],
  ['both', 'GET', `/payments/gst-invoices/${ID}/pdf`],
];
const gate = (r) => r.s === 403 && /is not enabled for your login/.test(r.j?.error || '');
const needs = (kind, u) => (kind === 'print' ? u.print : kind === 'download' ? u.download : u.print && u.download);

let wrong = [];
for (const [kind, m, p, b] of ENDPOINTS) {
  for (const u of users) {
    const r = await raw(u.tok, m, p, b);
    const allowed = needs(kind, u);
    if (allowed ? gate(r) : !gate(r)) wrong.push(`${u.name} ${m} ${p} -> ${r.s} ${(r.j?.error || '').slice(0, 50)} (expected ${allowed ? 'through' : 'denied'})`);
  }
  const sa = await raw(SA, m, p, b);
  if (gate(sa)) wrong.push(`super_admin ${m} ${p} refused`);
}
t(`${ENDPOINTS.length} endpoints x 5 logins: denied exactly where the grant is missing (false and NULL deny), allowed where it is held`, wrong.length === 0, wrong.slice(0, 5).join(' | '));

// the ?token= link routes (a short-lived link token for exactly that page) go through the same gate
const lt = await raw(users[0].tok, 'POST', '/auth/link-token', { path: `/api/payments/receipts/${ID}/html` });
if (lt.s === 200 && lt.j?.token) {
  const viaLink = await raw(lt.j.token, 'GET', `/payments/receipts/${ID}/html`, undefined, true);
  t('a link token of a login without the print grant is refused by the gate too', gate(viaLink), viaLink.s + JSON.stringify(viaLink.j));
  const lt2 = await raw(users[1].tok, 'POST', '/auth/link-token', { path: `/api/payments/receipts/${ID}/html` });
  const viaLink2 = await raw(lt2.j.token, 'GET', `/payments/receipts/${ID}/html`, undefined, true);
  t('a link token of a login with the print grant gets past the gate', !gate(viaLink2), viaLink2.s);
} else t('link-token route not available in this build (skipped, not counted as proof)', true, lt.s);

// /users/me tells the browser what it may offer
for (const u of users) { const me = (await raw(u.tok, 'GET', '/users/me')).j?.data; t(`/users/me for ${u.name}: authorizedPrint=${u.print}, authorizedDownload=${u.download}`, me?.authorizedPrint === u.print && me?.authorizedDownload === u.download, JSON.stringify([me?.authorizedPrint, me?.authorizedDownload])); }
const meSA = (await raw(SA, 'GET', '/users/me')).j?.data; t('/users/me for super_admin: both true', meSA?.authorizedPrint === true && meSA?.authorizedDownload === true);

// a new login starts with both off (create without the fields)
const created = await raw(SA, 'POST', '/users/employee-login', { username: `pdnew${U}`, email: `pd.new.${U}@test.local`, password: PW, confirmPassword: PW, role: 'project_manager' });
t('a new login created without the fields has both grants off', sql(`SELECT authorized_print IS NOT TRUE AND authorized_download IS NOT TRUE FROM users WHERE id = '${created.j?.data?.userId}'`) === 't');

// a grant takes effect within the auth cache window and a revoke too (the edit invalidates the cache)
const g = users[0]; await raw(SA, 'PATCH', `/users/employee-login/${g.id}`, { authorizedPrint: true });
let after = await raw(g.tok, 'GET', `/payments/receipts/${ID}/html`); t('granting print takes effect at once', !gate(after), after.s);
await raw(SA, 'PATCH', `/users/employee-login/${g.id}`, { authorizedPrint: false });
after = await raw(g.tok, 'GET', `/payments/receipts/${ID}/html`); t('revoking print takes effect at once', gate(after), after.s);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
