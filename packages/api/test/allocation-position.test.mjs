// QA-008 / 014 / 033 / 037 / 039: one money position. The Zf Tester case: contract 27,33,277, cleared receipts 27,33,277, applied to raised instalments 25,95,836,
// booking amount 1,36,664 already paid on an instalment that is not raised yet, and a surplus of 777. Run: npx tsx --test test/allocation-position.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { customerTotals, isRaised } from '../src/utils/report-ledger.ts';
import { financialMeasures } from '../src/utils/financial-measures.ts';

const d = (id, total, paid, raised) => ({ id, index: 1, type: 'installment', status: raised ? 'demanded' : 'pending', raised, due_date: null, base: total, cgst: 0, sgst: 0, addon: 0, total, paid, balance: total - paid });
const zf = (over = {}) => ({
  unit_cost: 2733277, received: 2733277, received_pending: 0, received_cgst: 0, received_sgst: 0, today: '2026-11-26',
  // contract = 25,95,836 raised + 1,36,664 booking amount on the first, unraised instalment + 777 still to come; the cleared money equals the contract
  demands: [d('a', 2595836, 2595836, true), d('b', 136664, 136664, false), d('c', 777, 0, false)], ...over,
});

test('Zf Tester: credit 1,37,441 = 1,36,664 advance on an unraised instalment + 777 surplus, no figure counted twice', () => {
  const t = customerTotals(zf());
  assert.equal(t.credit, 137441);
  assert.equal(t.advanceOnUnraised, 136664);
  assert.equal(t.surplusCredit, 777);
  assert.equal(t.advanceOnUnraised + t.surplusCredit, t.credit);
});

test('the parts add up to the cleared money in every case: applied to raised + advance on unraised + surplus = received', () => {
  for (const received of [0, 100000, 2595836, 2733277, 2900000]) {
    const p = zf({ received });
    const t = customerTotals(p);
    const raisedPaid = p.demands.filter((x) => x.raised).reduce((s, x) => s + x.paid, 0);
    assert.equal(t.advanceOnUnraised + t.surplusCredit, t.credit, `credit parts at ${received}`);
    if (received >= raisedPaid) assert.equal(Math.round((raisedPaid + t.credit) * 100) / 100, received, `money adds up at ${received}`);
  }
});

test('no surplus when the advance is all the credit there is', () => {
  const t = customerTotals(zf({ received: 2595836 + 136664 }));
  assert.equal(t.surplusCredit, 0);
  assert.equal(t.advanceOnUnraised, 136664);
});

test('financial measures expose both parts and they add up to unallocated_credit', () => {
  const m = financialMeasures([zf()]);
  assert.equal(m.unallocated_credit, 137441);
  assert.equal(m.unallocated_credit_advance_on_unraised, 136664);
  assert.equal(m.unallocated_credit_surplus, 777);
  assert.equal(m.contract_balance, 0);   // balance against the contract is a different figure from the raised-demand balance and from the credit
});

test('one rule for "raised": payment status never decides it', () => {
  assert.equal(isRaised('demanded', false, null, '2026-11-26'), true);
  assert.equal(isRaised('pending', false, '2026-01-01', '2026-11-26'), false);          // not paid, not raised_at: pending stays pending here (status rules make it demanded when due)
  assert.equal(isRaised('paid', false, '2027-03-01', '2026-11-26'), false);             // fully covered by an advance, due date in the future: NOT raised
  assert.equal(isRaised('partial', false, '2027-03-01', '2026-11-26'), false);          // part covered, same
  assert.equal(isRaised('paid', true, '2027-03-01', '2026-11-26'), true);               // raised_at set: raised
  assert.equal(isRaised('paid', false, '2026-11-01', '2026-11-26'), true);              // due date reached: raised
  assert.equal(isRaised('partial', false, '2026-11-01', '2026-11-26'), true);           // was false before: a part-paid instalment past its due date is raised
  assert.equal(isRaised('paid', false, null, '2026-11-26'), false);
});
