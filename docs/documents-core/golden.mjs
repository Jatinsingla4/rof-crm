// Snapshot of what /documents/generate produces for real data, to prove a refactor changes nothing.
// OUT=/tmp/golden-before node golden.mjs   (then again with OUT=/tmp/golden-after and diff -r).  Needs psql env and a test API (BASE).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const B = process.env.BASE || 'http://localhost:3010/api', OUT = process.env.OUT || '/tmp/golden';
const psql = (q) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
mkdirSync(OUT, { recursive: true });
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const gen = async (b) => { const r = await fetch(B + '/documents/generate', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
// A template for each letter type that prints every merge field the code can fill
const src = readFileSync(new URL('../../packages/api/src/routes/documents.ts', import.meta.url), 'utf8') + (process.env.EXTRA_SRC ? readFileSync(process.env.EXTRA_SRC, 'utf8') : '');
const keys = [...new Set([...src.matchAll(/^\s{10,14}([a-zA-Z][a-zA-Z0-9]*):\s/gm)].map((m) => m[1]))];
const body = '<html><body>' + 'x'.repeat(80) + keys.map((k) => `<p>${k}: {{${k}}}</p>`).join('') + '</body></html>';
// the templates it adds are removed by running: delete from document_templates where name like 'golden %'
for (const t of ['allotment_letter', 'buyer_builder_agreement', 'conveyance_deed']) psql(`insert into document_templates (name, document_type, body_html) select 'golden ${t}', '${t}', $q$${body}$q$ where not exists (select 1 from document_templates where name='golden ${t}')`);
const rows = psql(`select c.id, a.id from consumers c join allocations a on a.consumer_id=c.id where exists(select 1 from demands d where d.consumer_id=c.id) order by c.id limit 8`).split('\n').map((l) => l.split('|'));
const norm = (h) => h.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'JWT').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'UUID').replace(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}\b|\b\d{1,2} [A-Z][a-z]+,? \d{4}\b|\b[A-Z][a-z]+ \d{1,2}, \d{4}\b/g, 'DATE');
let n = 0; const summary = [];
for (const [cid, aid] of rows) for (const [type, extra] of [['demand_letter', {}], ['demand_letter', { includeAllDemands: true, includeInterest: false }], ['check_list', {}], ['allotment_letter', {}], ['buyer_builder_agreement', {}], ['conveyance_deed', {}]]) {
  const r = await gen({ consumerId: cid, allocationId: aid, documentType: type, ...extra });
  let html = JSON.stringify(r.j);
  if (r.j?.data?.documentId) html = await (await fetch(`${B}/documents/${r.j.data.documentId}/html`, { headers: { authorization: 'Bearer ' + tok } })).text();
  writeFileSync(`${OUT}/${String(++n).padStart(3, '0')}-${type}-${Object.keys(extra).join('_')}-${r.s}.html`, norm(String(html)));
  summary.push(`${type} ${r.s} ${String(html).length}`);
}
console.log(summary.join('\n'));
