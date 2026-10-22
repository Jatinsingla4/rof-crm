// Adds demo data for Parking and Import to the LOCAL demo database: a price list per type, 24 slots (some allotted to customers who hold a unit),
// and one small units import (three units in a new tower, with a history row).
// Needs the Grapes Greens project with allotted customers (demo-seed*.mjs).
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-parking.mjs     (never against live; EMAIL / PASSWORD pick another login)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log('  ! ' + m + ' ' + p + ' -> ' + r.status + ' ' + JSON.stringify(j).slice(0, 140)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'super_admin@demo.local', password: process.env.PASSWORD || 'Demo#Pass1234' }) })).json()).token;
const tag = Date.now().toString(36).slice(-3).toUpperCase();
const proj = (await call('GET', '/projects')).data.find((p) => /Grapes Greens/.test(p.name))?.id;
if (!proj) throw new Error('needs the Grapes Greens project');

for (const [type, price, d] of [['covered', 250000, 'Covered, with a guard'], ['open', 100000, 'Open ground parking'], ['stilt', 175000, 'Stilt floor'], ['ev', 300000, 'With an EV charger']]) await call('PUT', '/parking/types', { projectId: proj, parkingType: type, priceInr: price, description: d });
await call('POST', '/parking/bulk', { projectId: proj, prefix: `C${tag}`, count: 10, parkingType: 'covered', floor: -1 });
await call('POST', '/parking/bulk', { projectId: proj, prefix: `O${tag}`, count: 8, parkingType: 'open', floor: 0 });
await call('POST', '/parking/bulk', { projectId: proj, prefix: `E${tag}`, count: 6, parkingType: 'ev', floor: -1 });
const list = (await call('GET', `/consumers?projectId=${proj}&leadStage=allotted&pageSize=50`))?.data;
const holders = (list?.consumers || list || []).filter((c) => c.allocated_unit_id).slice(0, 4);
for (let i = 0; i < holders.length; i++) await call('POST', '/parking', { projectId: proj, slotNumber: `C${tag}${String(i + 1).padStart(3, '0')}`, consumerId: holders[i].id, unitId: holders[i].allocated_unit_id });
if (!holders.length) console.log('  (no allotted customer with a unit, slots are all available)');

const csv = ['unitNumber,tower,floor,bhkType,totalPriceInr,carpetAreaSqft,superAreaSqft,basePriceInr,facing',
  `ID${tag}-101,Import Demo ${tag},1,2BHK,3600000,650,900,3200000,East`, `ID${tag}-102,Import Demo ${tag},1,3BHK,4800000,820,1100,4300000,North`, `ID${tag}-201,Import Demo ${tag},2,2BHK,3650000,650,900,3250000,West`].join('\n');
await call('POST', '/import', { importType: 'units', projectId: proj, fileName: `demo-units-${tag}.csv`, csvText: csv });
console.log(bad ? `demo parking data added with ${bad} problem(s)` : `demo parking data added: 4 prices, 24 slots (${holders.length} allotted), one import of 3 units`);
