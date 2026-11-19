// QA-030 schedule gap and QA-033 one money rule (the waterfall already skipped the advance copy; the Demand Status credit sum did not). Run: npx tsx --test test/money-rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleGap } from '../src/utils/financial-measures.ts';
import { paidByDemand } from '../src/utils/money-basis.ts';

const plan = (unit_cost, bases) => ({ unit_cost, demands: bases.map((base, i) => ({ id: String(i), status: 'raised', base })) });
test('QA-030: a schedule short of the price is an exception, rounding is not', () => {
  assert.deepEqual(scheduleGap(plan(2000000, [1000000, 640000])), { gap: 360000, exception: true });
  assert.equal(scheduleGap(plan(2000000, [1000000, 999999, 1])).exception, false);
  assert.equal(scheduleGap(plan(2000000, [])).exception, false);   // nothing raised yet: nothing to compare
});
test('QA-033: the synthetic advance copy of an overpayment is not money, so paid plus credit equals the cleared receipts', () => {
  const ds = [{ id: 'd1', installment_index: 1, amount_due_inr: 1000, cgst_amount: 0, sgst_amount: 0, addon_charge_amount: 0, addon_cgst_amount: 0, addon_sgst_amount: 0, status: 'raised' }];
  const rs = [
    { id: 'r1', status: 'cleared', is_advance: false, amount_received_inr: 1500, demand_id: 'd1', installment_index: 1 },
    { id: 'r2', status: 'cleared', is_advance: true, amount_received_inr: 777, demand_id: null, installment_index: null },
  ];
  const paid = [...paidByDemand(rs, new Map(), ds).values()].reduce((a, b) => a + b, 0);
  assert.equal(paid, 1000);
  const eligible = rs.filter((r) => !r.is_advance).reduce((a, r) => a + r.amount_received_inr, 0);
  assert.equal(eligible - paid, 500);   // credit beyond the plan, never inflated by the 777 copy
});
