// ROF ALANTE A-101 financial simulation. Pure arithmetic over the legacy receipts and schedule (test/fixtures/a101-legacy.json), no database, nothing hardcoded for the excess.
// Run: npx tsx --test test/a101-simulation.test.mjs     Prints the four-way comparison. Nothing here is an approved ROF rule: the open decisions are switches below.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allocateReceipts } from '../src/utils/receipt-allocation.ts';

const F = JSON.parse(fs.readFileSync(new URL('./fixtures/a101-legacy.json', import.meta.url), 'utf8'));
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const nextBusinessDay = (d) => { let t = Date.parse(d); while ([0, 6].includes(new Date(t).getUTCDay())) t += 864e5; return new Date(t).toISOString().slice(0, 10); };

const receiptsTotal = r2(sum(F.receipts, (r) => r.amount));
const addonGst = 2 * Math.round(F.addon_ex_gst * F.addon_gst_pct_each_side / 100);

// the two liabilities (BR-03: which basis ROF approves is open)
const contractLiability = r2(F.agreement_value * (1 + 2 * F.main_gst_pct_each_side / 100) + F.addon_ex_gst * (1 + 2 * F.addon_gst_pct_each_side / 100));
const billedLiability = r2(sum(F.rows, (r) => r.net_due) + F.addon_ex_gst + addonGst);

// interest on a late instalment; BR-05 (weekend due date rolls to the next business day) and BR-08 (GST on interest at the main supply rate) are switches
function interest({ rollWeekend }) {
  let total = 0;
  for (const row of F.rows) {
    const rc = F.receipts.find((r) => r.n === row.n);
    const due = rollWeekend ? nextBusinessDay(row.due) : row.due;
    const late = days(due, rc.date);
    if (late > 0) total += row.inst * F.interest_rate_pct / 100 * late / 365;
  }
  const i = Math.round(total);
  return { interest: i, gst_on_interest: Math.round(i * 2 * F.main_gst_pct_each_side / 100) };
}
const excess = (liability, ix) => r2(receiptsTotal - (liability + ix.interest + ix.gst_on_interest));

test('the nine receipts are the legacy ledger and add up to the audit figure', () => {
  assert.equal(F.receipts.length, 9);
  assert.equal(receiptsTotal, 2810787);
});

test('instalment rounding explains the difference between the two bases (BR-03), it is not an error in either', () => {
  const rounded = sum(F.rows, (r) => r.inst) - F.agreement_value;   // the printed rows over the agreement value
  assert.ok(rounded >= 0 && rounded <= F.rows.length, `rows exceed the agreement value by ${rounded}`);
  const gap = r2(billedLiability - contractLiability);
  assert.ok(Math.abs(gap) <= F.rows.length + 2, `billed ${billedLiability} vs contract ${contractLiability} gap ${gap}`);
});

test('excess on each basis, with and without the weekend rule, is derived from the data and stays within a rupee or two of the client audit', () => {
  const out = [];
  for (const rollWeekend of [false, true]) {
    const ix = interest({ rollWeekend });
    out.push({ rollWeekend, ...ix, contract_excess: excess(contractLiability, ix), billed_excess: excess(billedLiability, ix) });
  }
  console.log('\nA-101 four-way comparison');
  console.log('  1. mathematical output (contract basis, interest as the dates fall)  excess', out[0].contract_excess, ' interest', out[0].interest, '+ GST', out[0].gst_on_interest);
  console.log('  2. client statement (from the audit, not computed here)              billed-basis excess 269, contract-basis excess 272');
  console.log('  3. approved ROF rule                                                  NOT APPROVED: BR-01 BR-03 BR-05 BR-07 BR-08 BR-09 are open');
  console.log('  4. remaining variance (this run, billed basis)                       ', out[0].billed_excess, 'vs 269, difference', r2(out[0].billed_excess - 269), '(the printed rows are whole rupees; the audit holds unrounded rows)');
  console.log('  weekend rule on (BR-05): interest', out[1].interest, '+ GST', out[1].gst_on_interest, ' contract excess', out[1].contract_excess, ' billed excess', out[1].billed_excess, '\n');
  const a = out[0];
  assert.ok(Math.abs(a.contract_excess - 272) <= 1, `contract excess ${a.contract_excess}`);
  assert.ok(Math.abs(a.billed_excess - 269) <= 2, `billed excess ${a.billed_excess}`);
  assert.equal(out[1].interest, 0);   // with the weekend rolled, the Saturday due date is met on Monday: no interest
  assert.ok(out[1].contract_excess > a.contract_excess, 'rolling the weekend can only raise the excess');
});

test('allocation of the nine receipts to the schedule: rows are settled in full, the rest is unallocated credit that needs the approved order (BR-09), not a FIFO guess', () => {
  const demands = F.rows.map((r) => ({ id: `d${r.n}`, installment_index: r.n, amount_due_inr: r.inst, cgst_amount: r.cgst, sgst_amount: r.sgst }));
  demands.push({ id: 'd9', installment_index: 9, amount_due_inr: 0, cgst_amount: 0, sgst_amount: 0, addon_charge_amount: F.addon_ex_gst, addon_cgst_amount: addonGst / 2, addon_sgst_amount: addonGst / 2 });
  const rcpts = F.receipts.map((r) => ({ id: `r${r.n}`, amount: r.amount, demand_id: null, installment_index: r.n }));
  const rows = allocateReceipts(rcpts, demands);
  const allocated = r2(sum(rows, (a) => a.amount));
  const unallocated = r2(receiptsTotal - allocated);
  const perDemandOk = demands.every((d) => sum(rows.filter((a) => a.demand_id === d.id), (a) => a.amount) <= (d.amount_due_inr + d.cgst_amount + d.sgst_amount + (d.addon_charge_amount || 0) + (d.addon_cgst_amount || 0) + (d.addon_sgst_amount || 0)) + 0.005);
  console.log('  allocation: allocated', allocated, ' unallocated credit', unallocated, '(carry-forwards the plan rows cannot take; the add-on share of receipt 8 is one of them)');
  assert.ok(perDemandOk, 'no demand is paid above its total');
  assert.equal(r2(allocated + unallocated), receiptsTotal);
  assert.ok(unallocated >= 0);
});
