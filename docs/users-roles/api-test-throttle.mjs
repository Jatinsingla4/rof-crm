// Authentication throttles on a shared atomic store (utils/throttle.ts, draft migration T2). Applies the draft to the DISPOSABLE test database, then checks
// that the sign-in lockout and the current-password lockout live in the table (so every instance sees them), that the API honours a lock written by
// "another instance", that a lock expires, that a success clears the count, and that concurrent failures lose no count.
// Without the table the throttle is process-local (see the tracker: production blocker). Never run it against production or Neon.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-throttle.mjs   (needs psql env)
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer, makeCall, apiRoot } from './_server-harness.mjs';   // Module 1 / B1 additions at the end of this file

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const DRAFT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'pending-migrations/T2_auth_throttle.sql');
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const post = async (p, b, tok) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = (email, password) => post('/auth/login', { email, password });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ap = spawnSync(PSQL, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', DRAFT], { encoding: 'utf8' }); const ap2 = spawnSync(PSQL, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', DRAFT], { encoding: 'utf8' });
t('T2 applies, and applies again (idempotent)', ap.status === 0 && ap2.status === 0, ap.stderr + ap2.stderr);
const SA = (await login('super_admin@test.local', 'Test#Pass1234')).j.token;
const U = Date.now().toString(36).slice(-6), PW = 'Th#Pass' + U.replace(/\D/g, '') + '1x';
const mk = async (n) => { const email = `th.${n}.${U}@test.local`; const r = await post('/users/employee-login', { username: `th${n}${U}`, email, password: PW, confirmPassword: PW, role: 'sales_executive' }, SA); if (r.s !== 201) throw new Error(JSON.stringify(r)); return { email, id: r.j.data.userId }; };
await wait(1500); // the API looks for the table once a minute while it is missing; a forced check would need a restart, so give it the time it needs in the worst case
const u1 = await mk('one');

// the API picks the table up by itself (it re-checks every minute while it is missing); poll up to 70 seconds
let shared = false;
for (let i = 0; i < 70 && !shared; i++) { await login(u1.email, PW + 'x'); shared = Number(sql(`SELECT count(*) FROM auth_throttle WHERE key LIKE 'login:%|${u1.email}'`)) > 0; if (!shared) await wait(1000); }
t('after the table exists the API counts failures in it (picked up without a restart)', shared, 'no auth_throttle row appeared');
const key = sql(`SELECT key FROM auth_throttle WHERE key LIKE 'login:%|${u1.email}' LIMIT 1`);
const count = () => Number(sql(`SELECT count FROM auth_throttle WHERE key = '${key}'`) || 0);
sql(`DELETE FROM auth_throttle WHERE key = '${key}'`);

// five failures lock; the right password is refused while locked; the state is in the table
for (let i = 0; i < 5; i++) await login(u1.email, PW + 'x');
t('five wrong passwords are counted in the shared table', count() === 5, 'count=' + count());
let r = await login(u1.email, PW); t('the sixth try, even with the right password, is refused: 429', r.s === 429, r.s);
t('the table holds the lock', sql(`SELECT locked_until > now() FROM auth_throttle WHERE key = '${key}'`) === 't');
// "another instance": a lock written straight into the table is honoured, and an expired one is released
sql(`UPDATE auth_throttle SET locked_until = now() - interval '1 second' WHERE key = '${key}'`);
r = await login(u1.email, PW); t('an expired lock lets the right password in (the API reads the table, not its own memory)', r.s === 200, r.s);
t('a success clears the count', sql(`SELECT count(*) FROM auth_throttle WHERE key = '${key}'`) === '0');
sql(`INSERT INTO auth_throttle (key, count, first_at, locked_until) VALUES ('${key}', 5, now(), now() + interval '10 minutes') ON CONFLICT (key) DO UPDATE SET locked_until = now() + interval '10 minutes'`);
r = await login(u1.email, PW); t('a lock written by another instance blocks this one at once', r.s === 429, r.s);
sql(`DELETE FROM auth_throttle WHERE key = '${key}'`);

// concurrent failures lose no count (one atomic statement per failure)
const par = await Promise.all(Array.from({ length: 4 }, () => login(u1.email, PW + 'y')));
t('four concurrent wrong passwords are all counted (4)', count() === 4 && par.every((x) => x.s === 401), 'count=' + count() + ' ' + par.map((x) => x.s).join());
sql(`DELETE FROM auth_throttle WHERE key = '${key}'`);

// the current-password check of change-password uses the same store
const u2 = await mk('two'); const tok2 = (await login(u2.email, PW)).j.token;
for (let i = 0; i < 5; i++) await post(`/users/${u2.id}/change-password`, { currentPassword: 'wrong' + i, newPassword: 'New#Pass1234x', confirmPassword: 'New#Pass1234x' }, tok2);
t('wrong current passwords are counted in the table too', Number(sql(`SELECT count FROM auth_throttle WHERE key = 'curpw:${u2.id}'`) || 0) === 5);
r = await post(`/users/${u2.id}/change-password`, { currentPassword: PW, newPassword: 'New#Pass1234x', confirmPassword: 'New#Pass1234x' }, tok2); t('while locked even the right current password is refused: 429', r.s === 429, r.s);
sql(`DELETE FROM auth_throttle WHERE key = 'curpw:${u2.id}'`);

const dbg = await (await fetch(B + '/health/debug', { headers: { authorization: 'Bearer ' + SA } })).json().catch(() => ({}));
t('the admin diagnostics say which backend is in use', dbg.throttle === 'shared', JSON.stringify(dbg).slice(0, 120));

// ===== Module 1 / B1 additions: the SHARED-table variants. The table exists here (applied above), so the order of the run does not matter. =====
// T2-B: release of a reserved attempt, SQL level and HTTP level.   T5-D: window and lock expiry on the shared table (rows aged with SQL, the clock is the database's now()).
// Writes only rows this block owns: keys 'b1sql:<run>:*' and the sign-in keys of the fault e-mail. No schema change (the table came from the T2 draft above).
{
  const require = createRequire(import.meta.url);
  const RUNB = Date.now().toString(36);
  t('B1: the psql helper and this process name the same database (DB_NAME = PGDATABASE), so the SQL checks look at what the throttle wrote', !!process.env.DB_NAME && process.env.DB_NAME === process.env.PGDATABASE, `${process.env.DB_NAME} / ${process.env.PGDATABASE}`);
  const { makeThrottle, refreshThrottleBackend } = require(path.join(apiRoot(), 'dist/utils/throttle.js'));
  const { db: bdb } = require(path.join(apiRoot(), 'dist/db/pool.js'));
  t('B1 T5-D: backend mode for the next checks: shared', (await refreshThrottleBackend(true)) === 'shared');
  const th = makeThrottle('b1sql', 5, 24 * 3600 * 1000, 15 * 60 * 1000);
  const key = (n) => `${RUNB}:${n}`, row = (n) => `key = 'b1sql:${key(n)}'`;
  const cnt = (n) => Number(sql(`SELECT coalesce(max(count), 0) FROM auth_throttle WHERE ${row(n)}`));
  const locked = (n) => sql(`SELECT coalesce(bool_or(locked_until > now()), false) FROM auth_throttle WHERE ${row(n)}`) === 't';
  { const got = []; for (let i = 0; i < 5; i++) got.push(await th.reserve(key('seq')));
    t('B1 T2-B: five reservations are granted and counted in the table (5)', got.every((x) => x === 0) && cnt('seq') === 5, got);
    t('B1 T2-B: a sixth is refused and does not raise the count', (await th.reserve(key('seq'))) > 0 && cnt('seq') === 5);
    await th.confirmFailure(key('seq')); t('B1 T2-B: the failure with five counted starts the lock in the table', locked('seq'));
    await th.release(key('seq')); t('B1 T2-B: release never undoes a running lock (still locked, count still 5)', locked('seq') && cnt('seq') === 5);
    t('B1 T5-D: a running lock refuses a new attempt', (await th.reserve(key('seq'))) > 0);
    sql(`UPDATE auth_throttle SET locked_until = now() - interval '1 second' WHERE ${row('seq')}`);
    t('B1 T5-D: after the lock time has passed (row aged in SQL) the key may try again', (await th.reserve(key('seq'))) === 0 && cnt('seq') === 1 && !locked('seq')); }
  { const res = await Promise.all(Array.from({ length: 40 }, () => th.reserve(key('par'))));
    t('B1 T2-B: 40 parallel reservations in the shared table: exactly 5 granted and the count is 5 (one atomic statement)', res.filter((x) => x === 0).length === 5 && cnt('par') === 5, [res.filter((x) => x === 0).length, cnt('par')]); }
  { for (let i = 0; i < 3; i++) await th.reserve(key('rel')); await th.release(key('rel'));
    t('B1 T2-B: three reserved, one released: the table says 2', cnt('rel') === 2, cnt('rel'));
    for (let i = 0; i < 4; i++) await th.release(key('rel'));
    t('B1 T2-B: more releases than reservations never go below 0', cnt('rel') === 0, cnt('rel')); }
  { for (let i = 0; i < 3; i++) await th.reserve(key('win'));
    sql(`UPDATE auth_throttle SET first_at = first_at - interval '25 hours' WHERE ${row('win')}`);
    const fresh = []; for (let i = 0; i < 5; i++) fresh.push(await th.reserve(key('win')));
    t('B1 T5-D: unlocked counts older than the 24 hour window are forgotten: five granted again, count 5', fresh.every((x) => x === 0) && cnt('win') === 5, [fresh, cnt('win')]); }
  sql(`DELETE FROM auth_throttle WHERE key LIKE 'b1sql:${RUNB}:%'`);

  // T2-B at HTTP level: the sign-in lookup of ONE e-mail fails (test-only fault), the throttle is the shared table (no force-local)
  const FAULT = 'b1.fault@test.local';
  sql(`DELETE FROM auth_throttle WHERE key LIKE 'login:%|${FAULT}'`);
  const srv = await startServer({ preloads: ['test-b1-fault.cjs'], env: { B1_FAULT_EMAIL: FAULT } });
  try {
    const c = makeCall(srv.api), lg = (e, p) => c()('POST', '/auth/login', { email: e, password: p });
    const sa2 = await lg('super_admin@test.local', 'Test#Pass1234');
    t('B1 T2-B (HTTP): a normal sign-in works in the extra process', sa2.s === 200, sa2.s);
    const d2 = await c(sa2.j?.token)('GET', '/health/debug');
    t('B1 T2-B (HTTP): backend mode of the extra process: shared', d2.j?.throttle === 'shared', d2.j);
    const fcount = () => Number(sql(`SELECT coalesce(max(count), 0) FROM auth_throttle WHERE key LIKE 'login:%|${FAULT}'`));
    const s1 = []; for (let i = 0; i < 8; i++) s1.push((await lg(FAULT, 'Whatever#1x')).s);
    t('B1 T2-B (HTTP): 8 sign-ins in a row with the broken lookup: all 500, none 429', s1.every((x) => x === 500), s1);
    t('B1 T2-B (HTTP): and the shared table holds count 0 for that key (every reservation was released in SQL)', fcount() === 0, fcount());
    const par = await Promise.all(Array.from({ length: 8 }, () => lg(FAULT, 'Whatever#1x'))); const pc = par.map((x) => x.s);
    t('B1 T2-B (HTTP): 8 parallel: every answer is 500 or 429 (429 only the transient cap)', pc.every((x) => x === 500 || x === 429) && pc.filter((x) => x === 500).length >= 5, pc);
    t('B1 T2-B (HTTP): after the burst the table again holds count 0', fcount() === 0, fcount());
    const s2 = []; for (let i = 0; i < 8; i++) s2.push((await lg(FAULT, 'Whatever#1x')).s);
    t('B1 T2-B (HTTP): 8 more in a row: all 500, none 429', s2.every((x) => x === 500), s2);
  } finally { await srv.stop(); sql(`DELETE FROM auth_throttle WHERE key LIKE 'login:%|${FAULT}'`); }
  await bdb.end().catch(() => {});
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
