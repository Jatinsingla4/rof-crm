// Adds unit locations, PLC rates and unit locations to the LOCAL demo database (run after demo-seed.mjs). Never against live.
//   BASE=http://localhost:3020/api node docs/demo-seed-plc.mjs
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b && JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) console.log('FAIL', m, p, r.status, JSON.stringify(j)); return j?.data ?? j; };
const proj = (await call('GET', '/projects')).find((p) => p.name === 'Grapes Greens').id;
const loc = {};
for (const n of ['Park facing', 'Corner unit', 'Main road facing']) loc[n] = (await call('POST', `/projects/${proj}/unit-locations`, { name: n })).id;
await call('POST', '/plc-charges', { projectId: proj, unitLocationId: loc['Park facing'], rateType: 'per_sqft', rateValue: 150 });
await call('POST', '/plc-charges', { projectId: proj, unitLocationId: loc['Corner unit'], rateType: 'flat', rateValue: 75000 });
await call('POST', '/plc-charges', { projectId: proj, unitLocationId: loc['Main road facing'], rateType: 'per_sqft', rateValue: 100 });
await call('PATCH', `/plc-charges/${(await call('GET', `/plc-charges?projectId=${proj}`)).find((r) => r.location_name === 'Main road facing').id}`, { isActive: false });
const units = await call('GET', `/plc-charges/units?projectId=${proj}`);
const pick = (pred) => units.filter(pred).map((u) => u.id);
await call('POST', '/plc-charges/assign', { projectId: proj, unitLocationId: loc['Park facing'], unitIds: pick((u) => u.unit_number.endsWith('01') && u.tower_name === 'Tower A') });
await call('POST', '/plc-charges/assign', { projectId: proj, unitLocationId: loc['Corner unit'], unitIds: pick((u) => u.unit_number.endsWith('03')) });
await call('POST', '/plc-charges/assign', { projectId: proj, unitLocationId: loc['Main road facing'], unitIds: pick((u) => u.unit_number.endsWith('02') && u.tower_name === 'Tower B') });
console.log('PLC demo data added');
