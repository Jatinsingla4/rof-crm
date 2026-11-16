// Module 1 / B1 F1: the throttle in packages/api/src/utils/throttle.ts, tested directly (no HTTP).
//   Needs the DB_* / PG* environment of a LOCAL TEST database. The backend is whatever that database offers:
//     without table auth_throttle -> process-local;   with T2 applied -> shared.   The script prints which one it ran on.
//   Run from packages/api:   ../../node_modules/.bin/tsx ../../docs/users-roles/unit-test-throttle-b1.mts   (or ./node_modules/.bin/tsx ...)
// Not picked up by the CI glob (api-test-*.mjs): CI starts one HTTP server and runs .mjs files only.
import { makeThrottle, refreshThrottleBackend } from '../../packages/api/src/utils/throttle.ts';
import { db } from '../../packages/api/src/db/pool.ts';

let pass = 0, fail = 0;
const t = (n: string, ok: boolean, x: unknown = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + JSON.stringify(x))); };
const backend = await refreshThrottleBackend(true);
console.log('INFO backend:', backend);

// Time travel: process-local state follows Date.now(); shared state lives in the table, so its rows are aged with SQL
const realNow = Date.now.bind(Date); let offset = 0; Date.now = () => realNow() + offset;
const age = async (ms: number) => {
  offset += ms;
  if (backend === 'shared') await db.query(`UPDATE auth_throttle SET first_at = first_at - $1::interval, locked_until = locked_until - $1::interval`, [`${ms} milliseconds`]);
};
const RUN = realNow().toString(36);
const k = (n: string) => `${RUN}:${n}`;
const MIN = 60_000, DAY = 24 * 60 * MIN;
const mkLogin = () => makeThrottle('b1u', 5, DAY, 15 * MIN);    // the sign-in settings
const mkPw = () => makeThrottle('b1pw', 5, 15 * MIN, 15 * MIN); // the current-password settings (routes/users.ts)

// ---- reserve / confirm: sequential ----
{
  const th = mkLogin(), key = k('seq');
  const got: number[] = []; for (let i = 0; i < 5; i++) got.push(await th.reserve(key));
  t('five reservations in a row are granted', got.every((x) => x === 0), got);
  t('a sixth is refused while five are unresolved', (await th.reserve(key)) > 0);
  t('no lock yet: nothing has failed', (await th.blockedFor(key)) === 0);
  await th.confirmFailure(key);
  t('the fifth failure starts the lock', (await th.blockedFor(key)) > 0);
  const w = await th.reserve(key); t('a locked key refuses with a wait time', w > 60_000, w);
  await th.clear(key); t('clear removes the lock', (await th.reserve(key)) === 0);
}
// ---- parallel ----
{
  const th = mkLogin(), key = k('par');
  const res = await Promise.all(Array.from({ length: 40 }, () => th.reserve(key)));
  t('40 parallel reservations: exactly 5 are granted', res.filter((x) => x === 0).length === 5, res.filter((x) => x === 0).length);
}
// ---- release gives a slot back; a success (clear) resets ----
{
  const th = mkLogin(), key = k('rel');
  for (let i = 0; i < 3; i++) await th.reserve(key);
  await th.release(key);
  const more: number[] = []; for (let i = 0; i < 4; i++) more.push(await th.reserve(key));
  t('3 reserved, 1 released: three more are granted and the fourth is refused', JSON.stringify(more.map((x) => x > 0)) === JSON.stringify([false, false, false, true]), more);
  await th.clear(key); t('after a success the full budget is back', (await th.reserve(key)) === 0);
  const lockKey = k('rel2'); for (let i = 0; i < 5; i++) await th.reserve(lockKey); await th.confirmFailure(lockKey); await th.release(lockKey);
  t('release never undoes a running lock', (await th.blockedFor(lockKey)) > 0);
}
// ---- per-key expiry ----
{
  const th = mkLogin(), key = k('exp');
  for (let i = 0; i < 5; i++) await th.reserve(key); await th.confirmFailure(key);
  t('locked before the time passes', (await th.reserve(key)) > 0);
  await age(15 * MIN + 1000);
  t('the lock has expired after 15 minutes: the key may try again', (await th.reserve(key)) === 0);
  const again: number[] = []; for (let i = 0; i < 4; i++) again.push(await th.reserve(key));
  t('...with a fresh window of five (this one counted plus four more)', again.every((x) => x === 0) && (await th.reserve(key)) > 0, again);
  const wkey = k('win'); for (let i = 0; i < 3; i++) await th.reserve(wkey);
  await age(DAY + 1000);
  const fresh: number[] = []; for (let i = 0; i < 5; i++) fresh.push(await th.reserve(wkey));
  t('unlocked counts older than the window are forgotten (five granted again)', fresh.every((x) => x === 0), fresh);
}
// ---- flooding with unknown keys does not erase active locks ----
{
  const th = mkLogin(); const locks = ['a', 'b', 'c'].map((n) => k('lock' + n));
  for (const key of locks) { for (let i = 0; i < 5; i++) await th.reserve(key); await th.confirmFailure(key); }
  const FLOOD = 6500;
  for (let start = 0; start < FLOOD; start += 50) {
    await Promise.all(Array.from({ length: Math.min(50, FLOOD - start) }, async (_, i) => { const key = k('flood' + (start + i)); await th.reserve(key); await th.confirmFailure(key); }));
  }
  const still = await Promise.all(locks.map((key) => th.blockedFor(key)));
  t(`after ${FLOOD} different keys, all 3 active locks still hold`, still.every((x) => x > 0), still);
  const refused = await Promise.all(locks.map((key) => th.reserve(key)));
  t('...and they still refuse new attempts', refused.every((x) => x > 0), refused);
}
// ---- the current-password throttle (fail / blockedFor / clear, used by routes/users.ts) is unchanged ----
{
  const th = mkPw(), key = k('pw');
  for (let i = 0; i < 4; i++) await th.fail(key);
  t('current-password: four wrong answers do not block', (await th.blockedFor(key)) === 0);
  await th.fail(key);
  t('current-password: the fifth blocks for the window', (await th.blockedFor(key)) > 0);
  await th.clear(key); t('current-password: a correct answer clears it', (await th.blockedFor(key)) === 0);
  const lockKey = k('pwlock'); for (let i = 0; i < 5; i++) await th.fail(lockKey);
  const FLOOD = 6500;
  for (let start = 0; start < FLOOD; start += 50) await Promise.all(Array.from({ length: Math.min(50, FLOOD - start) }, (_, i) => th.fail(k('pwflood' + (start + i)))));
  t(`current-password: a lock survives a flood of ${FLOOD} other keys`, (await th.blockedFor(lockKey)) > 0);
}
if (backend === 'shared') await db.query(`DELETE FROM auth_throttle WHERE key LIKE $1`, [`%${RUN}%`]);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (backend ${backend})`);
await db.end?.();
process.exit(fail ? 1 : 0);
