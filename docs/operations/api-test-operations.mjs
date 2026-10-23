// /api/operations was removed (it duplicated, in a weaker form, two tested modules). Checks that it is gone and that the real routes are guarded.
// Run: BASE=http://localhost:3010/api node api-test-operations.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + JSON.stringify(x).slice(0, 200))); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), NO = call(null);
for (const p of ['/operations/unit-shift', '/operations/application-transfer', '/operations']) for (const m of ['POST', 'GET']) t(`${m} ${p} is gone (404 for an admin)`, (await A(m, p, m === 'POST' ? {} : undefined)).s === 404);
t('the real unit shift (/allocations/shift) needs a login and checks its input', (await NO('POST', '/allocations/shift', {})).s === 401 && (await A('POST', '/allocations/shift', {})).s === 400);
t('the real ownership transfer (/transfers) needs a login and checks its input', (await NO('POST', '/transfers', {})).s === 401 && (await A('POST', '/transfers', {})).s === 400);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
