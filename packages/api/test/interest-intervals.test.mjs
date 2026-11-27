// QA-026 / QA-038: interest runs on the outstanding basic amount in chronological intervals. The Dup Mobile shape: an instalment of 5,14,000, a cleared receipt of 5,00,000,
// 14,000 left. The expected figures are worked out here from the rule (amount x rate / 100 / 365 x days), they are not copied from a report, and no rupee value is fixed in the code.
// Run: npx tsx --test test/interest-intervals.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterestRows } from '../src/utils/payment-waterfall.ts';

const RATE = 15, DUE = '2026-10-01';
const day = (n, from = DUE) => new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10) + n)).toISOString().slice(0, 10);
const simple = (amount, days, rate = RATE) => Math.round((amount * rate / 100 / 365) * days * 100) / 100;
const demand = (over = {}) => ({ id: 'd1', installment_index: 1, installment_name: 'Instalment 1', due_date: DUE, raised: true, amount_due_inr: 514000, ...over });
const receipt = (amount, date, over = {}) => ({ id: 'r' + date, amount_received_inr: amount, demand_id: 'd1', installment_index: 1, status: 'cleared', received_date: date, clearing_date: date, ...over });
const total = (rows) => Math.round(rows.reduce((s, r) => s + r.interest_amount, 0) * 100) / 100;
const run = (receipts, asOf, opts = {}, demands = [demand()]) => buildInterestRows(receipts, demands, RATE, { asOfDate: new Date(asOf), ...opts });

test('part payment on the due date: interest is only on the 14,000 left, from the due date', () => {
  for (const days of [17, 48]) assert.equal(total(run([receipt(500000, DUE)], day(days))), simple(14000, days));
});

test('the whole-instalment figure (principal x days, payments ignored) is NOT what the engine gives', () => {
  const whole = simple(514000, 17);
  assert.notEqual(total(run([receipt(500000, DUE)], day(17))), whole);
  assert.ok(whole > 30 * total(run([receipt(500000, DUE)], day(17))));
});

test('part payment 10 days late: 5,14,000 for the 10 days, then 14,000 from the payment date to the as-of date', () => {
  const t = total(run([receipt(500000, day(10))], day(30)));
  const expected = simple(514000, 10) + simple(14000, 20);
  assert.ok(Math.abs(t - expected) <= 0.02, `${t} vs ${expected}`);   // each interval is rounded to paise
});

test('two part payments: each interval runs on what was outstanding then', () => {
  const t = total(run([receipt(300000, day(5)), receipt(200000, day(20))], day(40)));
  const expected = simple(514000, 5) + simple(214000, 15) + simple(14000, 20);
  assert.ok(Math.abs(t - expected) <= 0.03, `${t} vs ${expected}`);
});

test('nothing paid: the whole amount from the due date; fully paid on time: no interest', () => {
  assert.equal(total(run([], day(20))), simple(514000, 20));
  assert.equal(total(run([receipt(514000, DUE)], day(60))), 0);
});

test('a payment before the due date does not start the clock', () => {
  assert.equal(total(run([receipt(500000, day(-10))], day(17))), simple(14000, 17));
});

test('grace days are taken off each late interval', () => {
  assert.equal(total(run([receipt(500000, DUE)], day(17), { gracePeriodDays: 5 })), simple(14000, 12));
});

test('only CLEARED money reduces interest: pending, authorized, bounced and cancelled receipts do nothing', () => {
  for (const status of ['pending', 'authorized', 'deposited', 'on_hold', 'bounced', 'cancelled']) {
    assert.equal(total(run([receipt(500000, DUE, { status })], day(17))), simple(514000, 17), status);
  }
});

test('a demand that was never raised bears no interest, whatever its due date', () => {
  assert.equal(total(run([], day(30), {}, [demand({ raised: false })])), 0);
});
