// Module 1 / B1: sign-in lockout correctness (F1) and the small login body limit (F3). Runs against a LOCAL TEST API only (never production or Neon).
//   BASE=http://localhost:3010/api node api-test-login-b1.mjs        (no psql needed; uses the seeded test logins and makes its own)
// Works with and without the shared table auth_throttle: the backend in use is printed as INFO. The window and lock EXPIRY and the 6,000-key flood
// are in unit-test-throttle-b1.mts (they need a clock or thousands of keys); the production-mode limiter is in prod-mode-test-login-limiter.mjs.
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b, headers = {}) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...headers }, body: b === undefined ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const anon = call();
const login = (email, password) => anon('POST', '/auth/login', { email, password });
const SAtok = (await login('super_admin@test.local', 'Test#Pass1234')).j.token;
const A = call(SAtok);
const U = Date.now().toString(36).slice(-6);
const PW = 'B1#Pass' + U.replace(/\D/g, '') + '1x';
const mk = async (n, extra = {}) => {
  const email = `b1.${n}.${U}@test.local`;
  const r = await A('POST', '/users/employee-login', { username: `b1${n}${U}`, email, password: PW, confirmPassword: PW, role: 'sales_executive', ...extra });
  if (r.s !== 201) throw new Error('could not create ' + n + ': ' + r.s + ' ' + JSON.stringify(r.j));
  return { email, id: r.j.data.userId };
};
const seq = async (email, pw, n) => { const out = []; for (let i = 0; i < n; i++) out.push(await login(email, pw)); return out; };
const WRONG = 'Wrong#Pass9x';

const dbg = await (await fetch(B + '/health/debug', { headers: { authorization: 'Bearer ' + SAtok } })).json().catch(() => ({}));
console.log('INFO throttle backend: ' + (dbg.throttle || 'unknown'));

// ---------- F1: real, unknown and inactive accounts behave the same ----------
const real = await mk('real'); const inactive = await mk('inact');
let r = await A('PATCH', `/users/employee-login/${inactive.id}`, { isActive: false }); t('setup: one login deactivated', r.s === 200, JSON.stringify(r));
const unknown = { email: `b1.nobody.${U}@test.local` };
const runs = {};
for (const [name, acct] of [['real', real], ['unknown', unknown], ['inactive', inactive]]) {
  const first5 = await seq(acct.email, WRONG, 5), sixth = await login(acct.email, WRONG), sixthRight = await login(acct.email, PW);
  runs[name] = { codes: [...first5.map((x) => x.s), sixth.s, sixthRight.s], bodies: [first5[0].j, sixth.j] };
}
const expected = [401, 401, 401, 401, 401, 429, 429];
for (const n of Object.keys(runs)) t(`${n}: five wrong tries are 401, then 429 (even with the right password for the real login)`, JSON.stringify(runs[n].codes) === JSON.stringify(expected), runs[n].codes);
t('the 401 and the 429 bodies are identical for real, unknown and inactive', JSON.stringify(runs.real.bodies) === JSON.stringify(runs.unknown.bodies) && JSON.stringify(runs.real.bodies) === JSON.stringify(runs.inactive.bodies), JSON.stringify(runs));

// ---------- F1: threshold, success clears ----------
const c1 = await mk('clear');
let codes = (await seq(c1.email, WRONG, 4)).map((x) => x.s);
t('four wrong tries are not enough to lock', codes.every((c) => c === 401), codes);
r = await login(c1.email, PW); t('the right password still signs in after four wrong tries', r.s === 200 && !!r.j?.token, r.s);
codes = (await seq(c1.email, WRONG, 4)).map((x) => x.s);
r = await login(c1.email, PW); t('a success cleared the count: four more wrong tries and the right one still works', codes.every((c) => c === 401) && r.s === 200, codes + ' / ' + r.s);
await seq(c1.email, WRONG, 5);
r = await login(c1.email, PW); t('five wrong tries lock; the right password is refused while locked (429)', r.s === 429, r.s);

// ---------- F1: a parallel burst cannot get past the threshold ----------
for (const [name, acct] of [['real', await mk('burst')], ['unknown', { email: `b1.burstnone.${U}@test.local` }]]) {
  const burst = await Promise.all(Array.from({ length: 30 }, () => login(acct.email, WRONG)));
  const n401 = burst.filter((x) => x.s === 401).length, n429 = burst.filter((x) => x.s === 429).length;
  t(`${name}: 30 parallel wrong tries: exactly 5 are checked (401), the other 25 are refused (429)`, n401 === 5 && n429 === 25, `401=${n401} 429=${n429} other=${burst.length - n401 - n429}`);
  r = await login(acct.email, PW); t(`${name}: afterwards the account is locked (429)`, r.s === 429, r.s);
}

// ---------- F1: a right password from a blocked address does not clear the count ----------
const ipu = await mk('ip');
r = await A('POST', `/users/employee-login/${ipu.id}/ips`, { ip_address: '203.0.113.9' }); t('setup: allowed address added', r.s === 201, JSON.stringify(r.j));
r = await A('PATCH', `/users/employee-login/${ipu.id}`, { ipSecurityEnabled: true }); t('setup: IP security on', r.s === 200, JSON.stringify(r.j));
const w3 = await seq(ipu.email, WRONG, 3);
const blocked = await login(ipu.email, PW);
t('right password from a blocked address: same status and body as a wrong password', blocked.s === 401 && JSON.stringify(blocked.j) === JSON.stringify(w3[0].j) && !blocked.j?.token, JSON.stringify(blocked));
const fifth = await login(ipu.email, WRONG);
r = await login(ipu.email, PW);
t('the blocked right password counted as the fourth failure: one more wrong try locks (429)', fifth.s === 401 && r.s === 429, `${fifth.s} / ${r.s}`);

// ---------- F1: up to five parallel legitimate sign-ins of one login all work ----------
const par = await mk('par');
const five = await Promise.all(Array.from({ length: 5 }, () => login(par.email, PW)));
t('five parallel right-password sign-ins all succeed (200)', five.every((x) => x.s === 200 && x.j?.token), five.map((x) => x.s));
r = await login(par.email, PW); t('and the count is clear afterwards', r.s === 200, r.s);

// ---------- F2 (development mode): failures from one address are not stopped by the 10-per-15-minutes production limit ----------
const manyFails = [];
for (let i = 0; i < 12; i++) manyFails.push((await login(`b1.dev${i}.${U}@test.local`, WRONG)).s);
t('development mode: 12 failed tries from one address with different e-mails are all 401 (limit is 1000 here)', manyFails.every((c) => c === 401), manyFails);
let okCount = 0; for (let i = 0; i < 25; i++) if ((await login('super_admin@test.local', 'Test#Pass1234')).s === 200) okCount++;
t('25 successful sign-ins in a row from one address all succeed', okCount === 25, okCount);

// ---------- F3: small body limit on the login route only ----------
const raw = (path, ct, body, tok) => fetch(B + path, { method: 'POST', headers: { 'content-type': ct, ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body })
  .then(async (x) => ({ s: x.status, j: await x.json().catch(() => null) }), (e) => ({ s: 0, j: { networkError: String(e?.cause?.code || e?.message || e) } }));
let t0 = Date.now();
r = await raw('/auth/login', 'application/json', JSON.stringify({ email: 'x@test.local', password: 'p'.repeat(1_000_000) }));
t('login with a 1 MB JSON body: 413 "Request too large"', r.s === 413 && r.j?.error === 'Request too large', JSON.stringify(r));
t('...answered quickly (under 5 s)', Date.now() - t0 < 5000, Date.now() - t0);
r = await raw('/auth/login', 'application/json', JSON.stringify({ email: 'x@test.local', password: 'p'.repeat(5000) })); t('a 5 KB login body is refused (413)', r.s === 413, r.s);
r = await raw('/auth/login', 'application/json', JSON.stringify({ email: 'x@test.local', password: 'p'.repeat(3000) })); t('a 3 KB login body is still read (401, wrong password)', r.s === 401, r.s);
r = await raw('/auth/login', 'application/x-www-form-urlencoded', 'email=x%40test.local&password=' + 'p'.repeat(1_000_000)); t('a 1 MB form-encoded login body: 413', r.s === 413, r.s);
r = await raw('/auth/login', 'application/x-www-form-urlencoded', `email=${encodeURIComponent('super_admin@test.local')}&password=${encodeURIComponent('Test#Pass1234')}`);
t('a normal form-encoded login works (200)', r.s === 200 && !!r.j?.token, r.s);
r = await login('super_admin@test.local', 'Test#Pass1234'); t('a normal JSON login works (200)', r.s === 200 && !!r.j?.token, r.s);
const pre = await fetch(B + '/auth/login', { method: 'OPTIONS' }); t('the preflight request for login still answers 200', pre.status === 200, pre.status);
const big = 'x'.repeat(200_000);
r = await A('POST', '/auth/link-token', { path: '/api/consumers', pad: big }); t('link-token keeps the large global limit: a 200 KB body is accepted (200)', r.s === 200 && typeof r.j?.token === 'string', r.s);
r = await A('POST', '/auth/link-token', { path: '/api/consumers' }); t('link-token normal call works (200)', r.s === 200 && typeof r.j?.token === 'string', r.s);
r = await A('POST', '/users/employee-login', { username: 'b1big' + U, pad: big }); t('another API route keeps the 10 MB limit: a 200 KB body reaches validation (400, not 413)', r.s === 400, r.s);
r = await raw('/users/employee-login', 'application/json', JSON.stringify({ pad: 'x'.repeat(11 * 1024 * 1024) }), SAtok); t('...and a body over 10 MB is still refused (413)', r.s === 413, r.s);

// clean up the logins made here
for (const u of [real, inactive, c1, ipu, par]) await A('PATCH', `/users/employee-login/${u.id}`, { isActive: false });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
