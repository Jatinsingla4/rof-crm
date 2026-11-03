// Role by role permission matrix: every API area x every role x read and write.
//   BASE=http://localhost:3010/api node docs/regression/role-matrix.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
const ROLES = ['super_admin', 'accounts_finance', 'project_manager', 'sales_executive', 'support_agent', 'read_only_viewer'];
const AREAS = ['consumers','units','allocations','payments','documents','users','reports','milestones','reconciliation','smtp-configs','faq','tasks','automation','email-templates','brokers','parking','import','projects','broker-setup','inventory-hold','dashboard','master','booking','booking-documents','employees','addon-charges','charge-master','plc-charges','gst-configuration','surrender','transfers','registry','loans','roles','companies','custom-letters','communications','test-data'];
const tok = {};
for (const r of ROLES) { const j = await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: r + '@test.local', password: 'Test#Pass1234' }) })).json(); tok[r] = j.token; }
const hit = async (role, m, p) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok[role] }, body: m === 'GET' ? undefined : '{}' }); return r.status; };
const rows = [];
for (const a of AREAS) {
  const line = { area: a };
  for (const r of ROLES) { const g = await hit(r, 'GET', `/${a}`); const w = await hit(r, 'POST', `/${a}/__audit__`); line[r] = `${g}/${w}`; }
  rows.push(line);
}
console.log('area'.padEnd(20) + ROLES.map((r) => r.slice(0, 11).padEnd(12)).join(''));
for (const l of rows) console.log(l.area.padEnd(20) + ROLES.map((r) => l[r].padEnd(12)).join(''));
const bad = [];
for (const l of rows) {
  if (/^(2|4(?!0[13]|04))/.test(l.read_only_viewer.split('/')[1]) && l.read_only_viewer.split('/')[1] !== '404') bad.push(`viewer can reach a write on ${l.area}: ${l.read_only_viewer}`);
  if (l.area === 'test-data' && l.sales_executive !== '403/403') bad.push('test-data open to sales_executive');
  const noAuth = await fetch(B + `/${l.area}`); if (noAuth.status !== 401 && l.area !== 'faq' && l.area !== 'photos') bad.push(`no token on ${l.area}: ${noAuth.status}`);
}
console.log('\nSUSPECT:\n' + (bad.join('\n') || 'none'));
