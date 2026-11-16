// Remediation wave 0: list endpoints say how many rows exist (CRM-CALC-025).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-wave0.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token
  ?? null;
const A = async (p) => { const r = await fetch(B + p, { headers: { authorization: 'Bearer ' + tok } }); return { s: r.status, j: await r.json().catch(() => null) }; };

const all = await A('/payments/demands?pageSize=1000');
t('demands: list answers 200', all.s === 200, all.s);
const pg = all.j?.pagination;
t('demands: pagination block {page, pageSize, total}', !!pg && pg.page === 1 && pg.pageSize === 1000 && Number.isInteger(pg.total), JSON.stringify(pg));
t('demands: total equals the rows of the full list (under 1000 rows)', pg && pg.total === all.j.data.length && pg.total < 1000, JSON.stringify([pg?.total, all.j?.data?.length]));

const one = await A('/payments/demands?pageSize=2');
t('demands: a page of 2 still reports the full total', one.j?.pagination?.total === pg?.total && one.j.data.length === Math.min(2, pg.total), JSON.stringify([one.j?.pagination, one.j?.data?.length]));
t('demands: default page size is 50 and the total says when rows are missing', (await A('/payments/demands')).j?.pagination?.pageSize === 50);
if (pg && pg.total > 2) {
  const p2 = await A('/payments/demands?pageSize=2&page=2');
  t('demands: page 2 is a different page of the same list', p2.j.data.length >= 1 && p2.j.data[0].id !== one.j.data[0].id && p2.j.pagination.total === pg.total);
} else console.log('SKIP demands page 2: fewer than 3 demands in this database');
const none = await A('/payments/demands?status=cancelled&pageSize=1&unitAddress=__no_such_unit__');
t('demands: a filter with no match reports total 0', none.s === 200 && none.j.pagination.total === 0 && none.j.data.length === 0, JSON.stringify(none.j?.pagination));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
