// Fills GST Configuration in the LOCAL demo database (run after demo-seed.mjs). Never against live.
//   PGHOST=/tmp/rofpg PGPORT=5433 PGUSER=postgres PGDATABASE=rof_demo BASE=http://localhost:3020/api node docs/demo-seed-gst.mjs
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B) || process.env.PGDATABASE !== 'rof_demo') throw new Error('demo seed runs on the local demo database only');
const psql = (sql) => execFileSync('psql', ['-qAt', '-c', sql], { encoding: 'utf8' }).trim();
// clear what an earlier rough set-up left, so slabs do not overlap
psql(`delete from gst_tax_charge_mapping; delete from gst_tax_setup; delete from gst_slabs; delete from hsn_sac_code_assign; delete from financial_years`);
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const call = async (m, p, b) => { const r = await fetch(B + '/gst-configuration' + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b && JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) console.log('FAIL', m, p, r.status, JSON.stringify(j)); return j?.data ?? j; };
const proj = (await call('GET', '/projects')).find((p) => p.name === 'Grapes Greens').id;
for (const [n, f, t, a] of [['2024-25', '2024-04-01', '2025-03-31', false], ['2025-26', '2025-04-01', '2026-03-31', false], ['2026-27', '2026-04-01', '2027-03-31', true]]) await call('POST', '/financial-years', { name: n, fromDate: f, toDate: t, isActive: a });
const hsn = {};
for (const c of ['995411', '995419', '999723']) hsn[c] = (await call('POST', '/hsn-sac-codes', { code: c, type: 'Service' })).id;
hsn['9954'] = (await call('POST', '/hsn-sac-codes', { code: '9954', type: 'Goods' })).id;
for (const [ct, c] of [['BASIC', '995411'], ['PLC', '995419'], ['OTHER CHARGE', '999723'], ['EXTRA ADD ON', '999723']]) await call('POST', '/hsn-sac-assign', { hsnSacId: hsn[c], projectId: proj, chargeType: ct });
const taxes = {};
for (const [key, f, t] of [['old', '2017-07-01', '2024-03-31'], ['new', '2024-04-01', '2099-12-31']]) {
  const slab = (await call('POST', '/gst-slabs', { fromDate: f, toDate: t })).id; taxes[key] = { slab };
  for (const [code, rate] of [['0%', 0], ['1%', 1], ['5%', 5], ['12%', 12], ['18%', 18]]) taxes[key][code] = (await call('POST', '/gst-tax-setup', { slabId: slab, gstCode: code, type: 'INTRA', cgstPct: rate / 2, sgstPct: rate / 2 })).id;
  await call('POST', '/gst-tax-setup', { slabId: slab, gstCode: '18% (interstate)', type: 'INTER', igstPct: 18 });
}
for (const [key, base, plc, other] of [['old', '1%', '1%', '18%'], ['new', '5%', '5%', '18%']]) for (const [ct, rate] of [['BASIC', base], ['PLC', plc], ['OTHER CHARGE', other], ['EXTRA ADD ON', '18%']]) await call('POST', '/gst-charge-mapping', { projectId: proj, slabId: taxes[key].slab, gstTaxId: taxes[key][rate], chargeType: ct });
const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gstin = (x) => { let s = 0; for (let i = 0; i < 14; i++) { const p = CH.indexOf(x[i]) * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + (p % 36); } return x + CH[(36 - (s % 36)) % 36]; };
await call('POST', '/project-gstin', { projectId: proj, gstin: gstin('06AAACG1234F1Z') });
await call('POST', '/project-rera', { projectId: proj, reraNumber: 'RC/REP/HARERA/GGM/2024/101' });
for (const t of await call('GET', `/towers?projectId=${proj}`)) await call('POST', '/project-rera', { projectId: proj, towerId: t.id, reraNumber: `RC/REP/HARERA/GGM/2024/101-${t.tower_name.slice(-1)}` });
console.log('GST demo data added');
