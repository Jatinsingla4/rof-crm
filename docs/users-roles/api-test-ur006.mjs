// Users & Roles, UR-006 / UR-016: exact-address IP security. One canonical spelling, CIDR/hostname/zone refused, a blocked address
// looks like a failed sign-in (same status and body as a wrong password) while the audit log keeps the real reason,
// the address you are working from cannot be removed while IP security is on.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-ur006.mjs   (needs psql env for the audit rows)
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = (email, password) => call()('POST', '/auth/login', { email, password });
const A = call((await login('super_admin@test.local', 'Test#Pass1234')).j.token);
const U = Date.now().toString(36).slice(-6);
const PW = 'Ur006#Pass' + U.replace(/\D/g, '') + '1';

// ---------- canonical spelling on storage ----------
const email = `ur6.${U}@test.local`;
let r = await A('POST', '/users/employee-login', { username: 'ur6u' + U, email, password: PW, confirmPassword: PW, role: 'sales_executive' });
t('login created', r.s === 201, JSON.stringify(r.j));
const uid = r.j?.data?.userId;
const add = (ip) => A('POST', `/users/employee-login/${uid}/ips`, { ip_address: ip });
r = await add('2001:0DB8:0:0:0:0:0:1');
t('IPv6 stored lowercase and compressed (2001:db8::1)', r.s === 201 && r.j.data.ip_address === '2001:db8::1', JSON.stringify(r.j));
const firstId = r.j?.data?.id;
r = await add('2001:db8::1');
t('same address spelled again: one row, same id', r.s === 201 && r.j.data.id === firstId && sql(`SELECT count(*) FROM user_ip_restrictions WHERE user_id='${uid}'`) === '1', JSON.stringify(r.j));
r = await add('::ffff:10.1.2.3');
t('IPv4-mapped IPv6 stored as plain IPv4', r.s === 201 && r.j.data.ip_address === '10.1.2.3', JSON.stringify(r.j));
for (const bad of ['10.0.0.0/24', 'fe80::1%eth0', 'example.com', '10.0.0', '', '2001:db8::/32', '999.1.1.1'])
  t(`rejected: "${bad}"`, (await add(bad)).s === 400);

// ---------- a blocked address is indistinguishable from a wrong password ----------
r = await A('PATCH', `/users/employee-login/${uid}`, { ipSecurityEnabled: true });
t('IP security switched on for the other login', r.s === 200, JSON.stringify(r.j));
const blocked = await login(email, PW);
const wrong = await login(email, PW + 'zz');
t('blocked address with the right password: same status and body as a wrong password', blocked.s === 401 && blocked.s === wrong.s && JSON.stringify(blocked.j) === JSON.stringify(wrong.j), `${blocked.s} ${JSON.stringify(blocked.j)} vs ${wrong.s} ${JSON.stringify(wrong.j)}`);
t('no token is handed out to a blocked address', !blocked.j?.token);
const row = sql(`SELECT new_values::text FROM audit_logs WHERE action='auth_blocked' AND resource_id='${uid}' ORDER BY timestamp DESC LIMIT 1`);
t('audit log keeps the real reason and channel (login)', /ip_not_allowed/.test(row) && /"login"/.test(row), row);

// allow the address this test runs from (loopback, any spelling the server may see), then the same login works
for (const ip of ['127.0.0.1', '::1', '0:0:0:0:0:0:0:1', '::ffff:127.0.0.1']) await add(ip);
const ok = await login(email, PW);
t('allowed address (stored in other spellings): sign-in works', ok.s === 200 && !!ok.j?.token, JSON.stringify(ok.j));
const T = call(ok.j?.token);
t('a signed-in request from an allowed address works', (await T('GET', '/users/me')).s === 200);

// signed-in request from a blocked address -> 401 Authentication required, reason in the audit log
const rows = (await A('GET', `/users/employee-login/${uid}/ips`)).j.data;
for (const x of rows.filter((x) => /^(127\.|::1)/.test(x.ip_address))) await A('DELETE', `/users/employee-login/${uid}/ips/${x.id}`);
sql(`DELETE FROM audit_logs WHERE action='auth_blocked' AND resource_id='${uid}'`);
const cut = await T('GET', '/users/me');
t('signed-in request from a blocked address: 401 "Authentication required"', cut.s === 401 && cut.j?.error === 'Authentication required', JSON.stringify(cut));
await new Promise((res) => setTimeout(res, 300));
const row2 = sql(`SELECT new_values::text FROM audit_logs WHERE action='auth_blocked' AND resource_id='${uid}' ORDER BY timestamp DESC LIMIT 1`);
t('audit log keeps the reason and channel (request)', /ip_not_allowed/.test(row2) && /"request"/.test(row2), row2);

// ---------- cannot remove the address you are working from ----------
const me = (await A('GET', '/users/me')).j.data.id;
r = await A('POST', `/users/employee-login/${me}/ips`, { ip_address: '127.0.0.1' });
const mine = r.j?.data;
await A('POST', `/users/employee-login/${me}/ips`, { ip_address: '::1' });
await A('POST', `/users/employee-login/${me}/ips`, { ip_address: '203.0.113.9' });
const myRows = (await A('GET', `/users/employee-login/${me}/ips`)).j.data;
r = await A('PATCH', `/users/employee-login/${me}`, { ipSecurityEnabled: true });
t('own IP security can be switched on when the current address is on the list', r.s === 200, JSON.stringify(r.j));
let refused = 0;
for (const x of myRows.filter((x) => ['127.0.0.1', '::1'].includes(x.ip_address))) { const d = await A('DELETE', `/users/employee-login/${me}/ips/${x.id}`); if (d.s === 409) refused++; }
t('removing the address you are signed in from is refused (409) while IP security is on', refused === 1, `refused=${refused}`);
const other = myRows.find((x) => x.ip_address === '203.0.113.9');
t('removing a different address is still allowed', (await A('DELETE', `/users/employee-login/${me}/ips/${other.id}`)).s === 200);
r = await A('PATCH', `/users/employee-login/${me}`, { ipSecurityEnabled: false });
t('IP security off again for the test admin', r.s === 200);
for (const x of (await A('GET', `/users/employee-login/${me}/ips`)).j.data) await A('DELETE', `/users/employee-login/${me}/ips/${x.id}`);
t('with IP security off, the current address can be removed', sql(`SELECT count(*) FROM user_ip_restrictions WHERE user_id='${me}'`) === '0');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
