// Module 1 / B1: PRODUCTION-MODE sign-in limiter (F2) and expiry, HTTP level.   T4, T5-A (limiter window reset) and T5-B (process-local lock expiry).
// It starts its own API process in production mode (NODE_ENV=production decides the limiter: 10 failed tries / 15 min / address; APP_ENV=staging only lets
// production mode start, it changes no limit) with two test-only preloads: test-b1-fault.cjs (throttle forced process-local, so the Date.now clock shift
// below is what expires locks) and test-clock-shift.cjs (SIGUSR2 moves Date.now() forward 16 minutes). Addresses are simulated with X-Forwarded-For
// (production trusts one proxy hop: the right-most entry becomes req.ip).
// "Overlap observed" = what the CLIENT measured; it is not proof of what the server did at the same moment.
import { startServer, makeCall, burst, LOCKOUT_TEXT, LIMITER_TEXT } from './_server-harness.mjs';

let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)))); };
const srv = await startServer({ production: true, preloads: ['test-b1-fault.cjs', 'test-clock-shift.cjs'], env: { B1_FORCE_LOCAL_THROTTLE: '1' } });
const made = [];
let A = null;
try {
  const call = makeCall(srv.api);
  const loginFrom = (ip, email, password) => call(null, { 'x-forwarded-for': ip })('POST', '/auth/login', { email, password });
  const U = Date.now().toString(36).slice(-6), PW = 'B1p#Pass' + U.replace(/\D/g, '') + '9z', WRONG = 'Wrong#Pass9x';
  const ADMIN_IP = '198.51.100.250';
  t('the extra API process loaded the fault preload (forced process-local throttle); the clock preload is confirmed by its own message later', /\[test-b1-fault\] loaded: forceLocalThrottle=true/.test(srv.log()), srv.log().slice(0, 300));

  const sa = await loginFrom(ADMIN_IP, 'super_admin@test.local', 'Test#Pass1234');
  t('T4-0: production mode: the seeded super admin signs in', sa.s === 200 && !!sa.j?.token, sa);
  A = call(sa.j.token, { 'x-forwarded-for': ADMIN_IP });
  const tm = await A('GET', '/health/templates');
  t('T4-0: the process really runs with NODE_ENV=production (reported by the server)', tm.j?.environment?.nodeEnv === 'production', tm.j?.environment);
  const dbg0 = await A('GET', '/health/debug');
  t('T4-0: backend mode of the sign-in throttle: process-local', dbg0.j?.throttle === 'process-local', dbg0.j);
  const mk = async (n) => {
    const email = `b1p.${n}.${U}@test.local`;
    const r = await A('POST', '/users/employee-login', { username: `b1p${n}${U}`, email, password: PW, confirmPassword: PW, role: 'sales_executive' });
    if (r.s !== 201) throw new Error('could not create ' + n + ': ' + r.s + ' ' + JSON.stringify(r.j));
    made.push(r.j.data.userId); return { email, id: r.j.data.userId };
  };

  // ---------- T4a: 15 simultaneous SUCCESSFUL sign-ins from one address (15 different accounts) ----------
  const accts = []; for (let i = 0; i < 15; i++) accts.push(await mk('a' + i));
  // What the limiter counted is read from ITS OWN header (RateLimit-Remaining = limit minus the hits the server held for this address when it
  // received the request). A client-side "overlap" says nothing about the server: it is one thread and bcryptjs works in 100 ms slices, so a request
  // can reach the limiter after earlier successes already finished. The burst is repeated (fresh address, up to 3 times) until the server's own
  // header shows two requests counted at once (remaining <= 8); if it never does the test FAILS rather than passing on serialized requests.
  const minRem = (b) => Math.min(...b.res.map((x) => (x.rem === null ? 99 : Number(x.rem))));
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ip = `198.51.100.${10 + attempt}`;
    const b = await burst(15, (() => { let i = 0; return () => loginFrom(ip, accts[i++ % 15].email, PW); })());
    last = { ip, b, attempt }; if (minRem(b) <= 8) break;
  }
  {
    const { ip, b, attempt } = last; const codes = b.res.map((x) => x.s);
    const n200 = codes.filter((c) => c === 200).length, n429 = codes.filter((c) => c === 429).length;
    console.log(`INFO T4a (attempt ${attempt}): 200=${n200} 429=${n429}; RateLimit-Remaining seen by the 15 requests: ${b.res.map((x) => x.rem).join(',')}; client-side overlap ${b.overlapMs} ms (informational only). The exact split is timing dependent and NOT asserted.`);
    t('T4a: the limiter itself reports that at least two simultaneous sign-ins were counted at once (smallest RateLimit-Remaining <= 8): successes stay counted until they finish (server-side evidence)', minRem(b) <= 8, `smallest remaining ${minRem(b)} after ${attempt} attempts`);
    t('T4a: every 429 carries RateLimit-Remaining 0', b.res.filter((x) => x.s === 429).every((x) => x.rem === '0'), b.res.filter((x) => x.s === 429).map((x) => x.rem));
    t('T4a: every answer is 200 or 429', n200 + n429 === 15, codes);
    t('T4a: at least 10 sign in (the first ten requests always pass the limiter and the credentials are right)', n200 >= 10, codes);
    t('T4a: at most 5 are refused', n429 <= 5, codes);
    t('T4a: every 429 is the LIMITER message, not the account-lockout message (each account was tried once, so no lock is possible)', b.res.filter((x) => x.s === 429).every((x) => LIMITER_TEXT.test(x.j?.error || '') && !LOCKOUT_TEXT.test(x.j?.error || '')), b.res.filter((x) => x.s === 429).map((x) => x.j));
    const retry = []; for (let i = 0; i < 15; i++) if (codes[i] === 429) retry.push(await loginFrom(ip, accts[i].email, PW));
    t('T4a: transient, not a lockout: every refused account signs in when it tries again from the same address (200)', retry.every((x) => x.s === 200 && x.j?.token), retry.map((x) => x.s));
  }

  // ---------- T4b: failed requests of status 400 count ----------
  { const ip = '198.51.100.21'; const r = []; for (let i = 0; i < 10; i++) r.push((await call(null, { 'x-forwarded-for': ip })('POST', '/auth/login', { email: `nopass${i}.${U}@test.local` })).s);
    const eleventh = await loginFrom(ip, `nopass10.${U}@test.local`, WRONG);
    t('T4b: ten requests without a password are 400 and count as failed tries', r.every((c) => c === 400), r);
    t('T4b: the eleventh request from that address is limited (429, limiter text)', eleventh.s === 429 && LIMITER_TEXT.test(eleventh.j?.error || ''), eleventh); }

  // ---------- T4c: an oversized body (413) is answered before the limiter and costs no budget ----------
  { const ip = '198.51.100.22'; const big = JSON.stringify({ email: 'x@test.local', password: 'p'.repeat(5000) }); const r = [];
    for (let i = 0; i < 12; i++) r.push((await call(null, { 'x-forwarded-for': ip })('POST', '/auth/login', big)).s);
    const next = await loginFrom(ip, `after413.${U}@test.local`, WRONG);
    t('T4c: twelve 5 KB login bodies are all 413 (the limiter never answered 429)', r.every((c) => c === 413), r);
    t('T4c: the next normal wrong sign-in from that address is a plain 401 (413 answers used no budget)', next.s === 401, next); }

  // ---------- T4d: lockout answers (429) also use the failed budget; the limiter then speaks ----------
  const lockAcct = await mk('lock'); const LIP = '198.51.100.23';
  { const w = []; for (let i = 0; i < 5; i++) w.push((await loginFrom(LIP, lockAcct.email, WRONG)).s);
    const lk = []; for (let i = 0; i < 5; i++) lk.push(await loginFrom(LIP, lockAcct.email, PW));
    const eleventh = await loginFrom(LIP, lockAcct.email, PW);
    t('T4d: five wrong passwords are 401', w.every((c) => c === 401), w);
    t('T4d: then the right password is refused with the LOCKOUT text (5 x 429)', lk.every((x) => x.s === 429 && LOCKOUT_TEXT.test(x.j?.error || '')), lk.map((x) => [x.s, x.j?.error]));
    t('T4d: the eleventh failed-status answer from that address is the LIMITER text (lockout answers used budget too)', eleventh.s === 429 && LIMITER_TEXT.test(eleventh.j?.error || ''), eleventh); }

  // ---------- T4e: successes do not use the budget; the eleventh failure does ----------
  const EIP = '198.51.100.24';
  { const ok = []; for (let i = 0; i < 25; i++) ok.push((await loginFrom(EIP, 'super_admin@test.local', 'Test#Pass1234')).s);
    const f = []; for (let i = 0; i < 11; i++) f.push(await loginFrom(EIP, `e.nobody${i}.${U}@test.local`, WRONG));
    t('T4e: 25 successful sign-ins in a row from one address all succeed', ok.every((c) => c === 200), ok);
    t('T4e: after them ten failed tries are 401 and the eleventh is limited (429)', JSON.stringify(f.map((x) => x.s)) === JSON.stringify([...Array(10).fill(401), 429]), f.map((x) => x.s));
    const other = await loginFrom('198.51.100.25', 'super_admin@test.local', 'Test#Pass1234'); t('T4e: another address is not affected', other.s === 200, other.s); }

  // ---------- T5: expiry, after the clock moves 16 minutes ----------
  const before = srv.log().split('[test-clock-shift] clock moved').length - 1;
  srv.signal('SIGUSR2');
  for (let i = 0; i < 30 && srv.log().split('[test-clock-shift] clock moved').length - 1 === before; i++) await new Promise((r) => setTimeout(r, 100));
  t('T5: the test process confirms its clock moved forward 16 minutes', srv.log().split('[test-clock-shift] clock moved').length - 1 === before + 1, srv.log().slice(-300));
  // T5-A limiter window (in-memory limiter, independent of the throttle backend)
  { const r = await loginFrom(EIP, `after.window.${U}@test.local`, WRONG);
    t('T5-A: after the 15 minute window the limited address may try again (401, not 429)', r.s === 401, r);
    const f = []; for (let i = 0; i < 10; i++) f.push((await loginFrom('198.51.100.26', `w.fresh${i}.${U}@test.local`, WRONG)).s);
    t('T5-A: a fresh address again has its full budget of ten failed tries (10 x 401)', f.every((c) => c === 401), f);
    const again = await loginFrom(LIP, lockAcct.email, WRONG);
    t('T5-A: the address that hit the limiter in T4d answers normally again (a wrong password is 401: window over and lock over)', again.s === 401, again); }
  // T5-B process-local lock expiry
  { const r = await loginFrom('198.51.100.27', lockAcct.email, PW);
    t('T5-B: the account locked in T4d signs in again after 15 minutes with the right password (200), from a fresh address', r.s === 200 && !!r.j?.token, r);
    const dbg = await A('GET', '/health/debug');
    t('T5-B: the backend is still process-local after the clock move and the sign-ins (no flip to the shared table, so the clock shift is what expired the lock)', dbg.j?.throttle === 'process-local', dbg.j); }
} finally {
  if (A) for (const id of made) await A('PATCH', `/users/employee-login/${id}`, { isActive: false }).catch(() => {});
  await srv.stop();
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
