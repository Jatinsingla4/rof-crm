// Adds allocation activity to the LOCAL demo database: one unit allotted by hand, one applicant shifted to another unit, allotment letters generated.
// Run after demo-seed-bookings.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-allocations.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 140)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const projects = await call('GET', '/projects'); const proj = (projects.data || projects).find(p => /Grapes Greens/.test(p.name));
const units = ((await call('GET', `/units?projectId=${proj.id}&pageSize=200`)).data || []).filter(u => u.status === 'available');
if (units.length < 3) throw new Error('needs 3 available units in Grapes Greens');
const mk = async (name, mobile) => (await call('POST', '/consumers', { name, mobile, project_id: proj.id, email: `${name.split(' ')[0].toLowerCase()}@demo.local` })).data.id;
const a = await mk('Allot Aman', '9744400011'); await call('POST', '/allocations', { consumerId: a, unitId: units[0].id, projectId: proj.id, remarks: 'Allotted by hand' });
const b = await mk('Allot Bhavna', '9744400022'); await call('POST', '/allocations', { consumerId: b, unitId: units[1].id, projectId: proj.id });
await call('POST', '/allocations/shift', { consumerId: b, newUnitId: units[2].id, reason: 'Wants a higher floor' });
await call('POST', '/allocations/generate-letters', { projectId: proj.id });
console.log(`done, ${bad} failed calls`);
