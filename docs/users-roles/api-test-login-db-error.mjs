// Module 1 / B1, T2-A: when the database breaks DURING a sign-in, the reserved attempt is given back (release), HTTP level, PROCESS-LOCAL throttle.
// It starts its own API process (see _server-harness.mjs) with test-b1-fault.cjs: the throttle is forced process-local and the sign-in lookup of ONE
// e-mail address (b1.fault@test.local) fails with a database error. No schema or data is changed; every other request is normal.
// This proves the process-local release only. The shared-table release is tested in api-test-throttle.mjs (T2-B); one does not prove the other.
//   needs the DB_* environment of a local test database and a built dist (B1_API_ROOT can point at another build)
import { startServer, makeCall, burst } from './_server-harness.mjs';

let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)))); };
const FAULT = 'b1.fault@test.local';
const srv = await startServer({ preloads: ['test-b1-fault.cjs'], env: { B1_FORCE_LOCAL_THROTTLE: '1', B1_FAULT_EMAIL: FAULT } });
try {
  const call = makeCall(srv.api);
  const login = (email, password) => call()('POST', '/auth/login', { email, password });
  t('the extra API process loaded the fault preload (forced process-local throttle, fault e-mail set)', /\[test-b1-fault\] loaded: forceLocalThrottle=true faultEmail=set/.test(srv.log()), srv.log().slice(0, 300));
  const sa = await login('super_admin@test.local', 'Test#Pass1234');
  t('a normal sign-in still works in this process (the fault only touches one e-mail)', sa.s === 200 && !!sa.j?.token, sa);
  const dbg = await call(sa.j.token)('GET', '/health/debug');
  t('the sign-in throttle of this process is process-local (backend mode: process-local)', dbg.j?.throttle === 'process-local', dbg.j);

  const seq1 = []; for (let i = 0; i < 8; i++) seq1.push(await login(FAULT, 'Whatever#1x'));
  t('8 sign-ins in a row with the broken lookup: all 8 answer 500 and none 429 (each reserved attempt was released)', seq1.every((x) => x.s === 500 && x.j?.error === 'Internal server error'), seq1.map((x) => x.s));
  const par = await burst(8, () => login(FAULT, 'Whatever#1x'));
  const pc = par.res.map((x) => x.s);
  t('8 parallel sign-ins: every answer is 500 or 429 (429 can only be the transient reservation cap)', pc.every((c) => c === 500 || c === 429), pc);
  t('8 parallel sign-ins: at least 5 reached the broken lookup (500)', pc.filter((c) => c === 500).length >= 5, pc);
  const seq2 = []; for (let i = 0; i < 8; i++) seq2.push(await login(FAULT, 'Whatever#1x'));
  t('after the parallel burst the counter is back at zero: 8 more in a row answer 500, none 429', seq2.every((x) => x.s === 500), seq2.map((x) => x.s));
  const ok = await login('super_admin@test.local', 'Test#Pass1234');
  t('a normal sign-in still works afterwards', ok.s === 200, ok.s);
  const errs = (srv.log().match(/Login error:/g) || []).length;
  const expectedMin = 8 + pc.filter((c) => c === 500).length + 8;
  t(`the server log shows every 500 went through the login error path (>= ${expectedMin} "Login error" lines)`, errs >= expectedMin, errs);
  const h = await fetch(srv.api + '/health'); t('the extra process is still healthy', h.status === 200, h.status);
} finally { await srv.stop(); }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
