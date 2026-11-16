// Guard for the cleared payment basis (Q13, D8). Reads the source only (no server needed). It fails when
//  - a file that reads or writes the receipts table, or mentions amount_received_inr, is not on the list below, or its count changed: somebody has to read the
//    new query against docs/booking/MONEY_RULES.md (cleared, no ADV copies, returns taken off) and then update the list with the new count;
//  - raised_at / due_date are cleared anywhere but the staff Unraise (D8);
//  - the old paths that made demands paid from uncleared money or passed an excess on as ADV rows come back.
// Limits: a text scan cannot prove a query is right, and it cannot see SQL that is built from pieces; review stays necessary.
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/api/src');
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
// file -> [clusters that touch the receipts table, mentions of amount_received_inr]
const ALLOWED = {
 "routes/addon-charges.ts": [
  2,
  1
 ],
 "routes/allocations.ts": [
  2,
  2
 ],
 "routes/booking.ts": [
  8,
  9
 ],
 "routes/brokers.ts": [
  1,
  0
 ],
 "routes/consumers.ts": [
  5,
  8
 ],
 "routes/custom-letters.ts": [
  1,
  1
 ],
 "routes/dashboard.ts": [
  5,
  8
 ],
 "routes/demands.ts": [
  4,
  8
 ],
 "routes/documents/merge-demand.ts": [
  5,
  6
 ],
 "routes/documents/merge-letters.ts": [
  1,
  2
 ],
 "routes/financial-ops.ts": [
  2,
  2
 ],
 "routes/gst-configuration.ts": [
  1,
  0
 ],
 "routes/master.ts": [
  2,
  0
 ],
 "routes/payments.ts": [
  18,
  28
 ],
 "routes/projects.ts": [
  1,
  1
 ],
 "routes/receipt-process.ts": [
  4,
  4
 ],
 "routes/receipt-returns.ts": [
  3,
  4
 ],
 "routes/receipts.ts": [
  20,
  11
 ],
 "routes/reconciliation.ts": [
  3,
  1
 ],
 "routes/registry.ts": [
  1,
  1
 ],
 "routes/reports-cash.ts": [
  3,
  15
 ],
 "routes/reports.ts": [
  8,
  2
 ],
 "routes/surrender.ts": [
  3,
  6
 ],
 "routes/transfers.ts": [
  3,
  1
 ],
 "routes/units.ts": [
  1,
  1
 ],
 "scripts/seed-demo-data.ts": [
  1,
  1
 ],
 "utils/document-writeback.ts": [
  9,
  3
 ],
 "utils/money-basis.ts": [
  1,
  7
 ],
 "utils/invoice-exposure.ts": [
  1,
  2
 ],
 "routes/reports-ageing.ts": [
  1,
  0
 ],
 "scripts/historical-backfill.ts": [
  1,
  0
 ],
 "utils/payment-waterfall.ts": [
  4,
  11
 ],
 "utils/rebate.ts": [
  1,
  1
 ],
 "utils/receipt-allocation.ts": [
  2,
  1
 ],
 "utils/receipt-allocation-shadow.ts": [
  1,
  1
 ],
 "utils/receipt-number.ts": [
  1,
  0
 ],
 "utils/report-ledger.ts": [
  1,
  5
 ],
 "utils/timely-discount.ts": [
  1,
  2
 ]
};
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'db' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []);
const files = walk(SRC);
const read = (f) => fs.readFileSync(f, 'utf8');
const rel = (f) => path.relative(SRC, f);
const touch = /(FROM|JOIN|INTO|UPDATE|DELETE FROM)\s+receipts\b/g;
const found = {};
for (const f of files) { const s = read(f); const c = (s.match(touch) || []).length, a = s.split('amount_received_inr').length - 1; if (c || a) found[rel(f)] = [c, a]; }
for (const [f, v] of Object.entries(found)) {
  t(`${f} is on the list of money readers and its receipt queries are unchanged (${v.join('/')})`, !!ALLOWED[f] && ALLOWED[f][0] === v[0] && ALLOWED[f][1] === v[1], ALLOWED[f] ? `list says ${ALLOWED[f].join('/')}, source has ${v.join('/')}: read the changed query against MONEY_RULES.md, then update this list` : 'a new file reads or writes receipts: review it against MONEY_RULES.md, then add it to this list');
}
for (const f of Object.keys(ALLOWED)) t(`${f} on the list still exists and still touches receipts`, !!found[f], 'remove it from the list');
const clears = files.filter((f) => /raised_at\s*=\s*NULL|due_date\s*=\s*NULL/.test(read(f))).map(rel);
t('raised_at and due_date are cleared only by the staff Unraise (demands.ts)', clears.length === 1 && clears[0] === 'routes/demands.ts', clears.join(', '));
for (const word of ['reverseInstallment1IfNoValidReceipt', 'cascadeOverpaymentExcess', 'reallocatePlan']) t(`${word} is gone`, !files.some((f) => read(f).includes(word)), files.filter((f) => read(f).includes(word)).map(rel).join(', '));
t('no code sets a demand to paid by hand (only the status recompute does)', files.filter((f) => /UPDATE demands\s+SET status = 'paid'/.test(read(f))).length === 0, files.filter((f) => /UPDATE demands\s+SET status = 'paid'/.test(read(f))).map(rel).join(', '));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
