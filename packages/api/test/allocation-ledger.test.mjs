// The allocation ledger (QA-008, 014, 033, 037, 039) on fake data, no database. Run: npx tsx --test test/allocation-ledger.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllocationLedger } from '../src/utils/allocation-ledger.ts';
import { paidByDemand } from '../src/utils/money-basis.ts';

const dem = (id, index, total, o = {}) => ({ id, installment_index: index, status: o.status || (o.raised ? 'demanded' : 'pending'), raised: !!o.raised, amount_due_inr: total, cgst_amount: 0, sgst_amount: 0, addon_charge_amount: 0, addon_cgst_amount: 0, addon_sgst_amount: 0 });
const rec = (id, gross, o = {}) => ({ id, receipt_number: id, status: 'cleared', approval_status: 'approved', is_advance: false, demand_id: null, installment_index: null, gross, returned: 0, ...o });
const kinds = (l, k) => l.entries.filter((e) => e.kind === k);

// the Zf Tester shape: 25,95,836 on a raised instalment, 1,37,441 against an instalment of 1,36,664 that is not raised yet, a third instalment of 777 still to come
const zfDemands = [dem('a', 1, 2595836, { raised: true }), dem('b', 2, 136664), dem('c', 3, 777)];
const zfReceipts = [rec('r1', 2595836, { demand_id: 'a' }), rec('r2', 137441, { demand_id: 'b' })];

test('Zf Tester: 1,36,664 settles the instalment not raised yet, 777 settles nothing and is shown as excess over that instalment', () => {
  const l = buildAllocationLedger({ receipts: zfReceipts, demands: zfDemands, credits: [] });
  assert.equal(l.totals.eligible, 2733277);
  assert.equal(l.totals.applied, 2732500);
  assert.equal(l.totals.applied_on_unraised_instalments, 136664);
  assert.equal(l.totals.unapplied, 777);
  assert.equal(l.totals.credit_available, 777);
  const u = kinds(l, 'unapplied');
  assert.equal(u.length, 1); assert.equal(u[0].amount, 777); assert.equal(u[0].reason, 'excess_over_instalment'); assert.equal(u[0].receipt_id, 'r2');
  assert.equal(l.per_demand.find((x) => x.demand_id === 'b').balance, 0);
  assert.equal(l.per_demand.find((x) => x.demand_id === 'c').balance, 777);   // the contract still has 777 to come; the 777 of excess is credit until a checker allocates it
  assert.equal(l.ok, true, JSON.stringify(l.checks));
});

test('partial payments: several receipts on one instalment add up and the balance is what is left', () => {
  const l = buildAllocationLedger({ receipts: [rec('p1', 30000, { demand_id: 'd' }), rec('p2', 20000, { demand_id: 'd' })], demands: [dem('d', 1, 100000, { raised: true })], credits: [] });
  assert.equal(l.totals.applied, 50000); assert.equal(l.per_demand[0].balance, 50000); assert.equal(l.totals.unapplied, 0); assert.equal(l.ok, true);
});

test('an approved return comes off the receipt before it pays: shown as its own entry, the instalment is short by that much', () => {
  const l = buildAllocationLedger({ receipts: [rec('x', 100000, { demand_id: 'd', returned: 30000 })], demands: [dem('d', 1, 100000, { raised: true })], credits: [] });
  assert.equal(kinds(l, 'returned')[0].amount, 30000);
  assert.equal(l.totals.eligible, 70000); assert.equal(l.totals.applied, 70000); assert.equal(l.per_demand[0].balance, 30000);
});

test('receipts that are not money are listed and never applied: pending, bounced, cancelled and a legacy advance copy', () => {
  const l = buildAllocationLedger({ receipts: [rec('a1', 1000, { demand_id: 'd', status: 'pending' }), rec('a2', 2000, { demand_id: 'd', status: 'bounced' }), rec('a3', 3000, { demand_id: 'd', status: 'cancelled' }), rec('a4', 4000, { demand_id: 'd', is_advance: true })], demands: [dem('d', 1, 100000, { raised: true })], credits: [] });
  assert.equal(kinds(l, 'not_money').length, 4); assert.equal(l.totals.applied, 0); assert.equal(l.per_demand[0].paid, 0);
  assert.deepEqual(kinds(l, 'not_money').map((e) => e.status).sort(), ['advance copy (legacy)', 'bounced', 'cancelled', 'pending']);
});

test('money that names no instalment, or an instalment that is not open, is unapplied with that reason', () => {
  const l = buildAllocationLedger({ receipts: [rec('n1', 1000), rec('n2', 2000, { demand_id: 'gone' }), rec('n3', 3000, { installment_index: 9 })], demands: [dem('d', 1, 100000, { raised: true }), dem('gone', 2, 5000, { status: 'cancelled' })], credits: [] });
  const by = Object.fromEntries(kinds(l, 'unapplied').map((e) => [e.receipt_id, e.reason]));
  assert.deepEqual(by, { n1: 'names_no_instalment', n2: 'instalment_not_open', n3: 'instalment_not_open' });
  assert.equal(l.totals.unapplied, 6000);
});

test('approved credit allocation pays an instalment from the unapplied money; the credit left falls; over-allocating breaks the check', () => {
  const ok = buildAllocationLedger({ receipts: zfReceipts, demands: zfDemands, credits: [{ id: 'k', demand_id: 'c', amount: 500, status: 'approved' }, { id: 'k2', demand_id: 'c', amount: 9999, status: 'pending' }] });
  assert.equal(ok.totals.credit_allocated, 500); assert.equal(ok.totals.credit_available, 277);
  assert.equal(ok.per_demand.find((x) => x.demand_id === 'c').paid, 500); assert.equal(ok.ok, true, JSON.stringify(ok.checks));
  const bad = buildAllocationLedger({ receipts: zfReceipts, demands: zfDemands, credits: [{ id: 'k', demand_id: 'c', amount: 777, status: 'approved' }, { id: 'k3', demand_id: 'b', amount: 1, status: 'approved' }] });
  assert.equal(bad.ok, false);
  assert.ok(bad.checks.some((c) => !c.ok && ['credit_allocated_within_unapplied', 'no_demand_over_paid'].includes(c.key)));
});

test('principal and GST of an applied amount follow the demand\'s own lines', () => {
  const d = { ...dem('g', 1, 100000, { raised: true }), cgst_amount: 2500, sgst_amount: 2500 };   // 1,05,000 with GST
  const l = buildAllocationLedger({ receipts: [rec('g1', 52500, { demand_id: 'g' })], demands: [d], credits: [] });
  const a = kinds(l, 'applied')[0];
  assert.equal(a.amount, 52500); assert.equal(a.cgst, 1250); assert.equal(a.sgst, 1250); assert.equal(a.principal, 50000);
});

test('the cross-check against the status engine (a different code path) agrees on the Zf shape and flags a difference', () => {
  const eng = paidByDemand(zfReceipts.map((r) => ({ ...r, amount_received_inr: r.gross })), new Map(), zfDemands);
  assert.equal(buildAllocationLedger({ receipts: zfReceipts, demands: zfDemands, credits: [], paidByDemandCheck: eng }).ok, true);
  const wrong = new Map(eng); wrong.set('a', 1);
  const l = buildAllocationLedger({ receipts: zfReceipts, demands: zfDemands, credits: [], paidByDemandCheck: wrong });
  assert.equal(l.ok, false); assert.equal(l.checks.find((c) => c.key === 'agrees_with_the_status_engine').detail[0].demand_id, 'a');
});

test('cleared money nobody approved is counted, and shown apart (the 12 historical receipts)', () => {
  const l = buildAllocationLedger({ receipts: [rec('u1', 5000, { demand_id: 'd', approval_status: 'pending' }), rec('u2', 7000, { demand_id: 'd' })], demands: [dem('d', 1, 100000, { raised: true })], credits: [] });
  assert.equal(l.totals.eligible, 12000); assert.equal(l.totals.eligible_but_unapproved, 5000);
});
