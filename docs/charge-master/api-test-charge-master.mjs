// Charge Master (Other Charge: balcony rate) checks: roles, bad numbers, cap, races, audit, preview.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-charge-master.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const PM = call(await login('project_manager@test.local'));
const SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local'));
const RO = call(await login('read_only_viewer@test.local'));
const NO = call('');
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const rate = () => Number(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`));
const cap = () => psql(`select cap_value from charge_master_config where charge_key='balcony_charge'`);
const K = '/charge-master/config/balcony_charge';
let r;
const orig = rate();
const co = (await A('POST', '/companies', { name: 'CM Co ' + Date.now().toString(36) })).j.data.id;
const proj = (await A('POST', '/projects', { companyId: co, name: 'CM Proj ' + Date.now().toString(36), reraNumber: 'CM' + Date.now(), tcpLicence: 'x' })).j.data.id;

// roles
r = await NO('GET', '/charge-master/config'); t('no login -> 401', r.s === 401, r.s);
for (const [n, c] of [['sales_executive', SE], ['read_only_viewer', RO]]) {
  r = await c('GET', '/charge-master/config'); t(`${n} can read`, r.s === 200 && r.j.data.length >= 1, r.s);
  r = await c('PATCH', K, { rate_value: 1 }); t(`${n} cannot change rate -> 403`, r.s === 403, r.s);
}
t('rate untouched after refused writes', rate() === orig, rate());
r = await PM('PATCH', K, { rate_value: 1400 }); t('project_manager can change rate', r.s === 200 && rate() === 1400, r.s);
r = await AF('PATCH', K, { rate_value: 1450 }); t('accounts_finance result matches permission matrix (200 or 403, never 500)', r.s === 200 || r.s === 403, r.s);

// bad values: every one refused, rate stays
const before = rate();
const badv = [['text', 'abc'], ['empty string', ''], ['spaces', ' 5 '], ['exponent', '1e2'], ['hex', '0x10'], ['negative', -1], ['negative text', '-5'], ['three decimals', '12.345'],
  ['over max', 1000001], ['huge', 1e30], ['Infinity text', 'Infinity'], ['NaN text', 'NaN'], ['null', null], ['boolean', true], ['array', [5]], ['object', { a: 1 }], ['comma', '1,300'], ['sql', "1; drop table users"]];
for (const [n, v] of badv) { r = await A('PATCH', K, { rate_value: v }); t(`bad rate ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await A('PATCH', K, {}); t('missing rate -> 400', r.s === 400, r.s);
r = await A('PATCH', K, undefined, '[1,2]'); t('array body -> 400', r.s === 400, r.s);
r = await A('PATCH', K, undefined, '{broken'); t('broken JSON -> 4xx, not 500', r.s >= 400 && r.s < 500, r.s);
r = await A('PATCH', K, undefined, '"text"'); t('plain string body -> 400', r.s === 400, r.s);
t('rate unchanged after all bad values', rate() === before, rate());

// good edges
for (const [v, want] of [[0, 0], ['0', 0], [1000000, 1000000], ['1250.50', 1250.5], [1300, 1300]]) {
  r = await A('PATCH', K, { rate_value: v }); t(`good rate ${v}`, r.s === 200 && rate() === want, r.s + ' ' + JSON.stringify(r.j));
}

// cap
r = await A('PATCH', K, { rate_value: 1300, cap_value: 5 }); t('cap not configurable -> 400', r.s === 400, r.s);
t('cap unchanged', Number(cap()) === 100000, cap());
r = await A('PATCH', '/charge-master/config/nope', { rate_value: 1 }); t('unknown key -> 404', r.s === 404, r.s);
r = await A('PATCH', '/charge-master/config/' + encodeURIComponent("x' or '1'='1"), { rate_value: 1 }); t('injection in key -> 404', r.s === 404, r.s);

// races: 12 saves at once -> one wins, no error, 12 audit rows, value is one of the sent ones
const sent = Array.from({ length: 12 }, (_, i) => 2000 + i);
const a0 = Number(psql(`select count(*) from audit_logs where resource_type='charge_master_config'`));
const rs = await Promise.all(sent.map(v => A('PATCH', K, { rate_value: v })));
t('12 parallel saves all 200', rs.every(x => x.s === 200), rs.map(x => x.s).join());
t('final rate is one of the saved values', sent.includes(rate()), rate());
t('every save audited', Number(psql(`select count(*) from audit_logs where resource_type='charge_master_config'`)) - a0 === 12);
const last = psql(`select new_values->>'rate_value' from audit_logs where resource_type='charge_master_config' order by timestamp desc limit 1`);
t('latest audit row matches stored rate', Number(last) === rate(), last);
r = await A('PATCH', K, { rate_value: 1300 });

// preview: a project with no GST mapping gets a clear 422, then one with a mapping is priced (18% GST = 9 + 9)
r = await A('GET', `/charge-master/balcony-preview?projectId=${proj}&balconyAreaSqft=50`); t('preview with no GST mapping -> 422 with a message', r.s === 422 && /GST/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j));
const slab = psql(`insert into gst_slabs(from_date,to_date) values ('1990-01-01','2099-12-31') on conflict (from_date,to_date) do update set is_active=true returning id`).split('\n')[0];
const tax = psql(`insert into gst_tax_setup(slab_id,gst_code,type,cgst_pct,sgst_pct) values ('${slab}','CM${Date.now().toString(36)}','INTRA',9,9) returning id`).split('\n')[0];
psql(`insert into gst_tax_charge_mapping(project_id,slab_id,gst_tax_id,charge_type) values ('${proj}','${slab}','${tax}','BASIC')`);
const pv = (q) => A('GET', '/charge-master/balcony-preview?' + q);
r = await pv(`projectId=${proj}&balconyAreaSqft=50&bookingDate=2026-01-01`); t('preview normal', r.s === 200 && r.j.data.balconyChargeAmount === 65000 && r.j.data.balconyCgstAmount === 5850 && r.j.data.balconySgstAmount === 5850, JSON.stringify(r.j));
r = await pv(`projectId=${proj}&balconyAreaSqft=1000`); t('preview capped at 100000', r.s === 200 && r.j.data.balconyChargeAmount === 100000 && r.j.data.balconyCgstAmount === 9000, JSON.stringify(r.j));
r = await pv(`projectId=${proj}&balconyAreaSqft=0`); t('preview zero area -> 0', r.s === 200 && r.j.data.balconyChargeAmount === 0, JSON.stringify(r.j));
r = await SE('GET', `/charge-master/balcony-preview?projectId=${proj}&balconyAreaSqft=10`); t('sales_executive can preview', r.s === 200, r.s);
for (const [n, q] of [['no project', 'balconyAreaSqft=5'], ['no area', `projectId=${proj}`], ['project not an id', 'projectId=abc&balconyAreaSqft=5'], ['negative area', `projectId=${proj}&balconyAreaSqft=-5`],
  ['text area', `projectId=${proj}&balconyAreaSqft=abc`], ['exponent area', `projectId=${proj}&balconyAreaSqft=1e9`], ['area too large', `projectId=${proj}&balconyAreaSqft=100001`],
  ['bad date', `projectId=${proj}&balconyAreaSqft=5&bookingDate=2026-13-45`], ['date text', `projectId=${proj}&balconyAreaSqft=5&bookingDate=tomorrow`],
  ['repeated project param', `projectId=${proj}&projectId=${proj}&balconyAreaSqft=5`], ['repeated area param', `projectId=${proj}&balconyAreaSqft=5&balconyAreaSqft=6`], ['sql project', `projectId=${encodeURIComponent("' or 1=1 --")}&balconyAreaSqft=5`]]) {
  r = await pv(q); t(`preview ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j));
}
r = await pv(`projectId=00000000-0000-0000-0000-000000000000&balconyAreaSqft=5`); t('preview unknown project -> 404', r.s === 404, r.s);

// config row always present for booking
t('balcony row exists', psql(`select count(*) from charge_master_config where charge_key='balcony_charge'`) === '1');
await A('PATCH', K, { rate_value: orig });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
