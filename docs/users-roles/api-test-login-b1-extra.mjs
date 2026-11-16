// Module 1 / B1, test completion: T1 (a right password clears the e-mail counter only after the address rule passed) and
// T3 (5, 6, 8 and 12 simultaneous sign-ins of one account from one address).   LOCAL TEST API only (never production or Neon).
//   BASE=http://localhost:3010/api node api-test-login-b1-extra.mjs      (no psql needed)
// Backend: this script does not choose one. It talks to the shared API of the run, which is process-local or shared (table auth_throttle)
// depending on that server; the backend is printed as INFO and every assertion holds on either. Keys hold a per-run e-mail, so runs never meet.
// "Overlap observed" below is what the CLIENT measured (all requests started before the first answer arrived); it is not proof of server-side concurrency.
import { assertLocalBase, makeCall, burst, LOCKOUT_TEXT } from './_server-harness.mjs';

const B = process.env.BASE || 'http://localhost:3010/api';
assertLocalBase(B);
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)))); };
const call = makeCall(B);
const anon = call();
const login = (email, password) => anon('POST', '/auth/login', { email, password });
const SAtok = (await login('super_admin@test.local', 'Test#Pass1234')).j?.token;
if (!SAtok) { console.log('FAIL the seeded super admin could not sign in'); process.exit(1); }
const A = call(SAtok);
const U = Date.now().toString(36).slice(-6);
const PW = 'B1x#Pass' + U.replace(/\D/g, '') + '7a';
const WRONG = 'Wrong#Pass9x';
const made = [];
const mk = async (n) => {
  const email = `b1x.${n}.${U}@test.local`;
  const r = await A('POST', '/users/employee-login', { username: `b1x${n}${U}`, email, password: PW, confirmPassword: PW, role: 'sales_executive' });
  if (r.s !== 201) throw new Error('could not create ' + n + ': ' + r.s + ' ' + JSON.stringify(r.j));
  made.push(r.j.data.userId); return { email, id: r.j.data.userId };
};
const wrongN = async (email, n) => { const out = []; for (let i = 0; i < n; i++) out.push((await login(email, WRONG)).s); return out; };
const dbg = await (await fetch(B + '/health/debug', { headers: { authorization: 'Bearer ' + SAtok } })).json().catch(() => ({}));
console.log('INFO sign-in throttle backend of this server: ' + (dbg.throttle || 'unknown'));

// ================= T1 =================
{
  const u = await mk('t1');
  let r = await A('POST', `/users/employee-login/${u.id}/ips`, { ip_address: '203.0.113.9' }); t('T1 setup: allowed address added (not this client)', r.s === 201, r.j);
  r = await A('PATCH', `/users/employee-login/${u.id}`, { ipSecurityEnabled: true }); t('T1 setup: IP security on', r.s === 200, r.j);
  const w = await wrongN(u.email, 3);
  t('T1: three wrong passwords are 401', w.every((c) => c === 401), w);
  const blocked = await login(u.email, PW);
  const wrongBody = (await login(`b1x.nobody.${U}@test.local`, WRONG)).j;
  t('T1: the right password from a blocked address is 401, same body as a wrong password, no token', blocked.s === 401 && !blocked.j?.token && JSON.stringify(blocked.j) === JSON.stringify(wrongBody), blocked);
  // four failures are counted now (three wrong + the blocked right one). Let this client's addresses in.
  for (const ip of ['127.0.0.1', '::1']) { r = await A('POST', `/users/employee-login/${u.id}/ips`, { ip_address: ip }); t(`T1 setup: ${ip} added to the allowed list`, r.s === 201, r.j); }
  r = await login(u.email, PW);
  t('T1: the right password from an allowed address signs in (200 + token): it was the fifth reservation, allowed by the cap', r.s === 200 && !!r.j?.token, r);
  r = await login(u.email, PW);
  t('T1: and the count was cleared by that success: the very next right password is 200, not 429', r.s === 200, r);
  const w2 = await wrongN(u.email, 4); r = await login(u.email, PW);
  t('T1: four wrong then the right one: 200 (the count started again from zero)', w2.every((c) => c === 401) && r.s === 200, { w2, r: r.s });
  const w3 = await wrongN(u.email, 4); r = await login(u.email, PW);
  t('T1: and once more: four wrong then the right one: 200 (each success clears)', w3.every((c) => c === 401) && r.s === 200, { w3, r: r.s });
}

// ================= T3 =================
// N simultaneous right-password sign-ins of one account from one address. Reservation cap = 5 counted attempts per address+account.
// Deterministic: statuses are 200 or 429 only; at least 5 get 200; a 429 here is the cap, never a lock: the account signs in at once afterwards.
// Timing dependent: HOW MANY get 429. The client's own timing cannot show what the server did at the same moment (one thread, bcryptjs in 100 ms
// slices), so the proof that requests really overlapped AT THE SERVER is a cap 429 itself: the server only answers it while five other reservations
// of the same account are outstanding. For N > 5 the burst is repeated (fresh account, up to 3 times) until the server shows one; if it never
// does, the test FAILS ("no server-side overlap produced") instead of passing on serialized requests. The exact split is INFO only.
const CAP_BODY = '{"error":"Too many failed attempts. Try again in 15 minutes."}';
for (const N of [5, 6, 8, 12]) {
  let final = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const u = await mk(`t3n${N}a${attempt}`);
    const b = await burst(N, () => login(u.email, PW));
    final = { u, b, attempt };
    if (N === 5 || b.res.some((x) => x.s === 429)) break;
  }
  const { u, b, attempt } = final; const codes = b.res.map((x) => x.s);
  const n200 = codes.filter((c) => c === 200).length, n429 = codes.filter((c) => c === 429).length;
  console.log(`INFO T3 N=${N} (attempt ${attempt}): 200=${n200} 429=${n429} (client-side overlap ${b.overlapMs} ms, informational only)`);
  t(`T3 N=${N}: every answer is 200 or 429 (no 401, no 500)`, n200 + n429 === N, codes);
  t(`T3 N=${N}: at least 5 sign in (the first five reservations are always granted)`, n200 >= Math.min(N, 5), codes);
  if (N === 5) t('T3 N=5: all five sign in', n200 === 5, codes);
  t(`T3 N=${N}: every 200 carries a token`, b.res.filter((x) => x.s === 200).every((x) => !!x.j?.token));
  t(`T3 N=${N}: every 429 has the reservation-cap/lockout text`, b.res.filter((x) => x.s === 429).every((x) => LOCKOUT_TEXT.test(x.j?.error || '') && JSON.stringify(x.j) === CAP_BODY), b.res.filter((x) => x.s === 429).map((x) => x.j));
  if (N > 5) t(`T3 N=${N}: SERVER-side overlap shown: at least one request was refused by the reservation cap (429), which the server only does while five other reservations are outstanding (3 attempts allowed)`, n429 >= 1, `no cap 429 in ${attempt} attempts: ${codes}`);
  const after = [await login(u.email, PW), await login(u.email, PW), await login(u.email, PW), await login(u.email, PW)];
  t(`T3 N=${N}: NOT a lockout: the same account signs in right after the burst, four times in a row (200 x4)`, after.every((x) => x.s === 200 && x.j?.token), after.map((x) => x.s));
}
// contrast: a REAL lockout stays
{
  const u = await mk('t3lock');
  const w = await wrongN(u.email, 5);
  const r1 = await login(u.email, PW);
  await new Promise((r) => setTimeout(r, 1000));
  const r2 = await login(u.email, PW);
  t('T3 contrast: five wrong passwords lock the account; the right password stays 429, also one second later', w.every((c) => c === 401) && r1.s === 429 && r2.s === 429, { w, r1: r1.s, r2: r2.s });
}

for (const id of made) await A('PATCH', `/users/employee-login/${id}`, { isActive: false });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
