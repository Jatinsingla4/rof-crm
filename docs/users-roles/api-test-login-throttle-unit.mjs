// Module 1 / B1, T5-C: the sign-in throttle (reserve / confirmFailure / release / clear, and the unchanged fail / blockedFor used by the current-password
// check) tested directly, PROCESS-LOCAL backend, expiry by moving Date.now().   Loads <api root>/dist/utils/throttle.js (a built dist; B1_API_ROOT can point elsewhere).
// Backend selection: DB_PORT is pointed at a closed local port BEFORE the module is loaded, so the "table auth_throttle exists?" probe fails and the
// throttle is process-local whatever any database holds. This test never connects to a database. The shared-table variants are in api-test-throttle.mjs.
import { createRequire } from 'node:module';
import path from 'node:path';
import { apiRoot, closedPort } from './_server-harness.mjs';

process.env.DB_HOST = '127.0.0.1'; process.env.DB_PORT = String(await closedPort());
process.env.DB_USER = 'nobody'; process.env.DB_PASSWORD = 'nobody'; process.env.DB_NAME = 'rof_b1_unit_none';
delete process.env.DATABASE_URL; if (process.env.NODE_ENV === 'production') process.env.NODE_ENV = 'development';
const require = createRequire(import.meta.url);
const { makeThrottle, refreshThrottleBackend } = require(path.join(apiRoot(), 'dist/utils/throttle.js'));
const { db } = require(path.join(apiRoot(), 'dist/db/pool.js'));

let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + JSON.stringify(x))); };
const backend = await refreshThrottleBackend(true);
t('backend mode: process-local (the database is unreachable on purpose)', backend === 'process-local', backend);

// time travel: process-local state follows Date.now()
const realNow = Date.now.bind(Date); let offset = 0; Date.now = () => realNow() + offset;
const age = (ms) => { offset += ms; };
const RUN = realNow().toString(36), k = (n) => `${RUN}:${n}`;
const MIN = 60_000, DAY = 24 * 60 * MIN;
const mkLogin = () => makeThrottle('b1u', 5, DAY, 15 * MIN);    // the sign-in settings
const mkPw = () => makeThrottle('b1pw', 5, 15 * MIN, 15 * MIN); // the current-password settings (routes/users.ts)

{ const th = mkLogin(), key = k('seq');
  const got = []; for (let i = 0; i < 5; i++) got.push(await th.reserve(key));
  t('five reservations in a row are granted', got.every((x) => x === 0), got);
  t('a sixth is refused while five are unresolved', (await th.reserve(key)) > 0);
  t('no lock yet: nothing has failed', (await th.blockedFor(key)) === 0);
  await th.confirmFailure(key);
  t('the failure with five counted starts the lock', (await th.blockedFor(key)) > 0);
  const w = await th.reserve(key); t('a locked key refuses with a wait time', w > 60_000, w);
  await th.clear(key); t('clear removes the lock', (await th.reserve(key)) === 0); }
{ const th = mkLogin(), key = k('par');
  const res = await Promise.all(Array.from({ length: 40 }, () => th.reserve(key)));
  t('40 parallel reservations: exactly 5 are granted', res.filter((x) => x === 0).length === 5, res.filter((x) => x === 0).length); }
{ const th = mkLogin(), key = k('rel');
  for (let i = 0; i < 3; i++) await th.reserve(key);
  await th.release(key);
  const more = []; for (let i = 0; i < 4; i++) more.push(await th.reserve(key));
  t('3 reserved, 1 released: three more are granted and the fourth is refused', JSON.stringify(more.map((x) => x > 0)) === JSON.stringify([false, false, false, true]), more);
  await th.clear(key); t('after a success the full budget is back', (await th.reserve(key)) === 0);
  const lockKey = k('rel2'); for (let i = 0; i < 5; i++) await th.reserve(lockKey); await th.confirmFailure(lockKey); await th.release(lockKey);
  t('release never undoes a running lock', (await th.blockedFor(lockKey)) > 0);
  const zero = k('rel3'); await th.release(zero); t('release on a key that was never reserved changes nothing (full budget still there)', (await th.reserve(zero)) === 0); }
{ const th = mkLogin(), key = k('exp');
  for (let i = 0; i < 5; i++) await th.reserve(key); await th.confirmFailure(key);
  t('locked before the time passes', (await th.reserve(key)) > 0);
  age(15 * MIN - 5000); t('still locked just before 15 minutes', (await th.reserve(key)) > 0);
  age(10_000);
  t('the lock has expired after 15 minutes: the key may try again', (await th.reserve(key)) === 0);
  const again = []; for (let i = 0; i < 4; i++) again.push(await th.reserve(key));
  t('...with a fresh window of five (this one counted plus four more, then refused)', again.every((x) => x === 0) && (await th.reserve(key)) > 0, again);
  const wkey = k('win'); for (let i = 0; i < 3; i++) await th.reserve(wkey);
  age(DAY + 1000);
  const fresh = []; for (let i = 0; i < 5; i++) fresh.push(await th.reserve(wkey));
  t('unlocked counts older than the window are forgotten (five granted again)', fresh.every((x) => x === 0), fresh); }
{ const th = mkLogin(); const locks = ['a', 'b', 'c'].map((n) => k('lock' + n));
  for (const key of locks) { for (let i = 0; i < 5; i++) await th.reserve(key); await th.confirmFailure(key); }
  const FLOOD = 6500;
  for (let start = 0; start < FLOOD; start += 50) await Promise.all(Array.from({ length: Math.min(50, FLOOD - start) }, async (_, i) => { const key = k('flood' + (start + i)); await th.reserve(key); await th.confirmFailure(key); }));
  const still = await Promise.all(locks.map((key) => th.blockedFor(key)));
  t(`after ${FLOOD} different keys, all 3 active locks still hold`, still.every((x) => x > 0), still);
  const refused = await Promise.all(locks.map((key) => th.reserve(key)));
  t('...and they still refuse new attempts', refused.every((x) => x > 0), refused); }
{ const th = mkPw(), key = k('pw');
  for (let i = 0; i < 4; i++) await th.fail(key);
  t('current-password: four wrong answers do not block', (await th.blockedFor(key)) === 0);
  await th.fail(key);
  t('current-password: the fifth blocks for the window', (await th.blockedFor(key)) > 0);
  await th.clear(key); t('current-password: a correct answer clears it', (await th.blockedFor(key)) === 0);
  const lockKey = k('pwlock'); for (let i = 0; i < 5; i++) await th.fail(lockKey);
  const FLOOD = 6500;
  for (let start = 0; start < FLOOD; start += 50) await Promise.all(Array.from({ length: Math.min(50, FLOOD - start) }, (_, i) => th.fail(k('pwflood' + (start + i)))));
  t(`current-password: a lock survives a flood of ${FLOOD} other keys`, (await th.blockedFor(lockKey)) > 0);
  age(15 * MIN + 1000); t('current-password: and expires after its 15 minutes', (await th.blockedFor(lockKey)) === 0); }

console.log(`\nRESULT: ${pass} passed, ${fail} failed (backend ${backend})`);
await db.end().catch(() => {});
process.exit(fail ? 1 : 0);
