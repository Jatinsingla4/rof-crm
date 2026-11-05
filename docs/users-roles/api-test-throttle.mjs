// Authentication throttles on a shared atomic store (utils/throttle.ts, draft migration T2). Applies the draft to the DISPOSABLE test database, then checks
// that the sign-in lockout and the current-password lockout live in the table (so every instance sees them), that the API honours a lock written by
// "another instance", that a lock expires, that a success clears the count, and that concurrent failures lose no count.
// Without the table the throttle is process-local (see the tracker: production blocker). Never run it against production or Neon.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-throttle.mjs   (needs psql env)
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
