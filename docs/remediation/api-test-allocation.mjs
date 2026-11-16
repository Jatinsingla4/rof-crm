// Receipt allocation (flag receipt_allocation_v1): which receipt settles which demand, with GST taken from the demand's own lines. Pure: no server needed.
import { allocateReceipts, splitLines } from '../../packages/api/dist/utils/receipt-allocation.js';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const D = (id, i, base, cg = 0, sg = 0) => ({ id, installment_index: i, status: 'demanded', amount_due_inr: base, cgst_amount: cg, sgst_amount: sg });
const sum = (rows, k, v) => Math.round(rows.filter((r) => r[k] === v).reduce((s, r) => s + r.amount, 0) * 100) / 100;

let a = allocateReceipts([{ id: 'r1', amount: 10000, demand_id: null, installment_index: null }], [D('d1', 1, 5800, 100, 100), D('d2', 2, 6000)]);
t('unlinked money fills the oldest demand first: 6,000 to d1, 4,000 to d2', sum(a, 'demand_id', 'd1') === 6000 && sum(a, 'demand_id', 'd2') === 4000, JSON.stringify(a));
a = allocateReceipts([{ id: 'r1', amount: 5000, demand_id: null, installment_index: 1 }], [D('d1', 1, 2400, 63, 63), D('d2', 2, 9000)]);
t('money filed under instalment 1 settles instalment 1 (2,526) and never more than its total', sum(a, 'demand_id', 'd1') === 2526 && sum(a, 'demand_id', 'd2') === 0, JSON.stringify(a));
a = allocateReceipts([{ id: 'r1', amount: 20000, demand_id: 'd2', installment_index: null }], [D('d1', 1, 50000), D('d2', 2, 50500)]);
t('money linked to a demand counts against that demand, not the oldest', sum(a, 'demand_id', 'd2') === 20000 && sum(a, 'demand_id', 'd1') === 0);
a = allocateReceipts([{ id: 'r1', amount: 30000, demand_id: null, installment_index: null }, { id: 'r2', amount: 30000, demand_id: null, installment_index: null }], [D('d1', 1, 40000), D('d2', 2, 40000)]);
t('two receipts: nothing is allocated twice (d1 40,000, d2 20,000) and each receipt is within its amount', sum(a, 'demand_id', 'd1') === 40000 && sum(a, 'demand_id', 'd2') === 20000 && sum(a, 'receipt_id', 'r1') <= 30000 && sum(a, 'receipt_id', 'r2') <= 30000, JSON.stringify(a));
a = allocateReceipts([{ id: 'r1', amount: 100, demand_id: null, installment_index: null }], [{ ...D('d1', 1, 500), status: 'cancelled' }].filter((d) => d.status !== 'cancelled'));
t('no live demand: nothing is allocated', a.length === 0);
const s1 = splitLines(20000, D('d', 1, 50000, 250, 250));
t('part payment 20,000 of 50,500: CGST 99.01, SGST 99.01, principal 19,801.98, and the three add up to 20,000', s1.cgst === 99.01 && s1.sgst === 99.01 && s1.principal === 19801.98 && Math.round((s1.cgst + s1.sgst + s1.principal) * 100) === 2000000, JSON.stringify(s1));
const s2 = splitLines(50500, D('d', 1, 50000, 250, 250));
t('a full payment gives back exactly the demand lines (50,000 + 250 + 250)', s2.principal === 50000 && s2.cgst === 250 && s2.sgst === 250, JSON.stringify(s2));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
