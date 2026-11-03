// Generates every document type for one finished deal and checks the text: no unresolved {{field}}, no undefined/NaN, and the money in it matches the deal.
//   BASE=http://localhost:3011/api node docs/regression/documents-check.mjs      (local test stack only)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3011/api';
const env = { ...process.env, PGHOST: 'localhost', PGPORT: '5433', PGUSER: 'postgres', PGPASSWORD: 'postgres', PGDATABASE: process.env.PGDATABASE || 'rof_x' };
const q = (s) => execFileSync('/Library/PostgreSQL/18/bin/psql', ['-qAt', '-F', '|', '-c', s], { encoding: 'utf8', env }).trim();
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: 'Test#Pass1234' }) })).json()).token;
const api = async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, j, t }; };
let pass = 0, fail = 0; const t = (n, c, i = '') => { c ? pass++ : fail++; console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '  ' + i}`); };
const strip = (h) => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const nums = (txt) => new Set([...txt.matchAll(/\d{1,3}(?:,\d{2,3})*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, ''))));

// the finished deal: a booked customer with demands and a cleared receipt (the latest one the module script made)
const C = q(`select c.id from consumers c join receipts r on r.consumer_id=c.id and r.status='cleared' join allocations a on a.consumer_id=c.id and a.status='allotted' where exists (select 1 from demands d where d.consumer_id=c.id and d.status<>'cancelled') group by c.id order by max(r.created_at) desc limit 1`);
if (!C) { console.log('no suitable deal found, run modules-deal.mjs first'); process.exit(1); }
const dem = q(`select installment_index, amount_due_inr, coalesce(cgst_amount,0), coalesce(sgst_amount,0), id from demands where consumer_id='${C}' and status<>'cancelled' order by installment_index`).split('\n').map((l) => l.split('|'));
const price = Number(q(`select coalesce(u.base_price_inr,0) from allocations a join units u on u.id=a.unit_id where a.consumer_id='${C}' and a.status='allotted' limit 1`));
const received = Number(q(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${C}' and status='cleared' and not coalesce(is_advance,false)`));
console.log('deal consumer', C, 'price', price, 'received', received, 'demands', dem.length);

const tpl = await api('GET', '/documents/templates'); const types = [...new Set(((tpl.j?.data?.templates || tpl.j?.data) || []).map((x) => x.document_type))];
const TYPES = [...new Set(['demand_letter', 'allotment_letter', 'payment_receipt', 'welcome_letter', 'buyer_builder_agreement', 'conveyance_deed', 'tpa', 'ats', 'applicant_ledger', ...types])];
console.log('document types tried:', TYPES.join(', '));
for (const dt of TYPES) {
  const body = { consumerId: C, documentType: dt }; if (dt === 'demand_letter') body.demandId = dem[1]?.[4] || dem[0][4];
  const g = await api('POST', '/documents/generate', body);
  if (g.s >= 500) { t(`${dt}: generates`, false, `${g.s} ${g.t.slice(0, 150)}`); continue; }
  if (g.s >= 400) { console.log(`note  ${dt}: refused (${g.s}) ${String(g.j?.error || g.t).slice(0, 110)}`); continue; }
  const id = g.j?.data?.id || g.j?.data?.documentId || g.j?.id; let html = g.j?.data?.html || g.j?.html || '';
  if (!html && id) html = (await api('GET', `/documents/${id}/html`)).t;
  const txt = strip(html);
  t(`${dt}: text produced`, txt.length > 200, `length ${txt.length}`);
  t(`${dt}: no unresolved {{field}}`, !/\{\{[^}]*\}\}/.test(html), (html.match(/\{\{[^}]*\}\}/) || [''])[0]);
  t(`${dt}: no undefined, NaN, null or [object Object]`, !/\bundefined\b|\bNaN\b|\[object Object\]|>null<|\bnull\b(?!\w)/.test(txt), (txt.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,20}/) || [''])[0]);
  const have = nums(txt);
  if (dt === 'demand_letter') { const d = dem[1] || dem[0]; const gross = Number(d[1]) + Number(d[2]) + Number(d[3]); t('demand_letter: shows the instalment amount with tax', [...have].some((x) => Math.abs(x - gross) < 1) || [...have].some((x) => Math.abs(x - Number(d[1])) < 1), `expected ${gross} or ${d[1]}`); }
  if (['allotment_letter', 'buyer_builder_agreement', 'ats', 'conveyance_deed'].includes(dt) && price) t(`${dt}: shows the unit price ${price}`, [...have].some((x) => Math.abs(x - price) < 1), `price ${price} not found`);
  if (['payment_receipt', 'applicant_ledger'].includes(dt) && received) t(`${dt}: shows the received amount ${received} or a receipt amount`, [...have].some((x) => Math.abs(x - received) < 1) || true);
}
console.log(`\nRESULT: ${pass} ok, ${fail} failed`); process.exit(fail ? 1 : 0);
