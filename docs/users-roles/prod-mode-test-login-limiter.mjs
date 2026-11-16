// Module 1 / B1 F2: the sign-in rate limiter counts FAILED attempts only, in PRODUCTION mode (limit 10 per 15 minutes per address).
// LOCAL TEST API ONLY, started in production mode against a disposable database with a test-only secret:
//   NODE_ENV=production APP_ENV=staging PORT=<p> ... tsx --require docs/users-roles/test-clock-shift.cjs src/index.ts
//   BASE=http://127.0.0.1:<p>/api API_PID=<pid of that node process> node prod-mode-test-login-limiter.mjs
// Production mode trusts one proxy hop, so an X-Forwarded-For header with one address stands for a different client address (no real network address is used).
// API_PID is only needed for the "window and lock expire" part (the clock-shift preload). This script is not picked up by the CI glob (api-test-*.mjs) on purpose:
// the CI server runs in development mode.
const B = process.env.BASE || 'http://127.0.0.1:3198/api';
const PID = process.env.API_PID ? Number(process.env.API_PID) : null;
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok, ip) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = (ip, email, password) => call(null, ip)('POST', '/auth/login', { email, password });
const U = Date.now().toString(36).slice(-6);
const OK = ['super_admin@test.local', 'Test#Pass1234'];
const sa = await login('198.51.100.200', ...OK);
t('production mode: the seeded super admin signs in', sa.s === 200, sa.s);
const tmpl = await (await fetch(B + '/health/templates', { headers: { authorization: 'Bearer ' + sa.j.token } })).json().catch(() => ({}));
t('the server really runs with NODE_ENV=production', tmpl.environment?.nodeEnv === 'production', JSON.stringify(tmpl.environment));

// ---- successes do not use the budget; the 11th failure does hit it ----
const A = '198.51.100.1';
const succ = []; for (let i = 0; i < 25; i++) succ.push((await login(A, ...OK)).s);
t('25 successful sign-ins from one address all succeed (they do not consume the failed budget)', succ.every((c) => c === 200), succ);
const fails = []; for (let i = 0; i < 11; i++) fails.push(await login(A, `nobody${i}.${U}@test.local`, 'Wrong#Pass9x'));
t('after those 25, ten failed tries are 401 and the 11th is rate limited (429)', JSON.stringify(fails.map((x) => x.s)) === JSON.stringify([...Array(10).fill(401), 429]), fails.map((x) => x.s));
t('the 11th answer is the limiter message, not the lockout message', /Too many login attempts/.test(fails[10].j?.error || ''), JSON.stringify(fails[10].j));
const after = await login(A, ...OK);
t('while the address is limited even a right password is refused (429)', after.s === 429, after.s);

// ---- the limit is per address ----
const other = await login('198.51.100.2', ...OK); t('another address is not affected (200)', other.s === 200, other.s);
// ---- failures mixed with successes: only failures count ----
const C = '198.51.100.3'; const mix = [];
for (let i = 0; i < 9; i++) { mix.push((await login(C, `mixnone${i}.${U}@test.local`, 'Wrong#Pass9x')).s); mix.push((await login(C, ...OK)).s); }
t('nine failures interleaved with nine successes: nothing is limited', mix.filter((c) => c === 429).length === 0, mix);
const c10 = await login(C, `mixnone9.${U}@test.local`, 'Wrong#Pass9x'), c11 = await login(C, `mixnone10.${U}@test.local`, 'Wrong#Pass9x');
t('the tenth failure still answers 401 and the eleventh is limited (429)', c10.s === 401 && c11.s === 429, `${c10.s}/${c11.s}`);

// ---- lockout on one account in production mode ----
const D = '198.51.100.4'; const wrong = []; for (let i = 0; i < 5; i++) wrong.push((await login(D, 'sales_executive@test.local', 'Wrong#Pass9x')).s);
const locked = await login(D, 'sales_executive@test.local', 'Test#Pass1234');
t('production mode: five wrong tries on one account lock it (right password then 429)', wrong.every((c) => c === 401) && locked.s === 429, wrong + ' / ' + locked.s);

// ---- expiry (needs the clock-shift preload and the process id) ----
if (!PID) { console.log('SKIP expiry checks: API_PID not given'); }
else {
  process.kill(PID, 'SIGUSR2'); await new Promise((r) => setTimeout(r, 500));
  const a2 = await login(A, `afternone.${U}@test.local`, 'Wrong#Pass9x');
  t('after the 15 minute window passes the limited address can try again (401, not 429)', a2.s === 401, a2.s);
  const d2 = await login(D, 'sales_executive@test.local', 'Test#Pass1234');
  t('after the 15 minute lock passes the locked account signs in with the right password (200)', d2.s === 200, d2.s);
  const fresh = []; for (let i = 0; i < 10; i++) fresh.push((await login('198.51.100.5', `winfresh${i}.${U}@test.local`, 'Wrong#Pass9x')).s);
  t('and a fresh address again has the full budget of ten failed tries', fresh.every((c) => c === 401), fresh);
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
