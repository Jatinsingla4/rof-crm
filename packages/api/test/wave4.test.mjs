// Wave 4 (QA-018, 022, 024, 027, 028): the audit mask, the role-based mask, and the cash limit rules, on fake data (no database).
// Run: npx tsx --test test/wave4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { maskSecrets } from '../src/middleware/auditLogger.ts';
import { maskPeople, maskTail, isMaskedValue, dropMaskedIds } from '../src/utils/people-mask.ts';
import { cashLimitCheck } from '../src/utils/cash-limit.ts';
import { personNameSql } from '../src/utils/person-name.ts';

test('audit mask: PAN, Aadhaar, passport and bank numbers keep their last four characters, at any depth, and masking twice changes nothing', () => {
  const m = maskSecrets({ name: 'A', pan_no: 'ABCDE1234F', nested: { aadhaar_no: '123412341234', list: [{ passport_no: 'P1234567' }] }, bank_account_no: '0011223344' });
  assert.equal(m.pan_no, 'XXXX234F'); assert.equal(m.nested.aadhaar_no, 'XXXX1234'); assert.equal(m.nested.list[0].passport_no, 'XXXX4567'); assert.equal(m.bank_account_no, 'XXXX3344');
  assert.equal(m.name, 'A');
  assert.deepEqual(maskSecrets(m), m);
  assert.equal(maskSecrets(undefined), undefined);
});

test('role mask: nothing is masked while no list is set; a role not on the list sees the last four, a role on it sees all', () => {
  const row = { name: 'A', pan_no: 'ABCDE1234F', aadhaar_no: '123412341234', passport_no: null, mobile: '9876543210' };
  assert.deepEqual(maskPeople(row, 'sales_executive', null), row);                              // setting empty: as before
  const full = new Set(['super_admin', 'accounts_finance']);
  assert.deepEqual(maskPeople(row, 'super_admin', full), row);
  const m = maskPeople(row, 'sales_executive', full);
  assert.equal(m.pan_no, 'XXXX234F'); assert.equal(m.aadhaar_no, 'XXXX1234'); assert.equal(m.passport_no, null); assert.equal(m.mobile, '9876543210');   // mobile is not part of this mechanism
  assert.equal(maskPeople(row, undefined, full).pan_no, 'XXXX234F');
});

test('a masked number sent back by an edit form is dropped, a real one is kept', () => {
  const b = { pan_no: 'XXXX234F', aadhaar_no: '123412341234', name: 'A' };
  dropMaskedIds(b);
  assert.equal('pan_no' in b, false); assert.equal(b.aadhaar_no, '123412341234'); assert.equal(b.name, 'A');
  assert.equal(isMaskedValue(maskTail('ABCDE1234F')), true);
});

// a fake pool: the first query returns the three setting rows, the second the cash already taken that day
const fakeDb = (settings, sameDayCash = 0) => ({ query: async (sql) => (/global_settings/.test(sql) ? { rows: Object.entries(settings).map(([key, value]) => ({ key, value })) } : { rows: [{ n: sameDayCash }] }) });
const run = (settings, amount, sameDay = 0) => cashLimitCheck(fakeDb(settings, sameDay), { consumerId: 'c1', amount, date: '2026-11-27' });

test('cash limit: off when no limit or 0 is set', async () => {
  assert.equal(await run({}, 5000000), null);
  assert.equal(await run({ cash_receipt_limit_inr: '0' }, 5000000), null);
});

test('cash limit: per receipt, warn by default and block when asked; at the limit is allowed', async () => {
  assert.equal(await run({ cash_receipt_limit_inr: '100000' }, 100000), null);
  const w = await run({ cash_receipt_limit_inr: '100000' }, 100001);
  assert.ok(w.warn && !w.block && /above the configured cash limit/.test(w.warn));
  const b = await run({ cash_receipt_limit_inr: '100000', cash_receipt_limit_mode: 'block' }, 150000);
  assert.ok(b.block && !b.warn);
});

test('cash limit: per applicant per day counts the cash already taken that day', async () => {
  const s = { cash_receipt_limit_inr: '100000', cash_receipt_limit_scope: 'customer_day', cash_receipt_limit_mode: 'block' };
  assert.equal(await run(s, 40000, 60000), null);                    // 1,00,000 in all: at the limit
  const r = await run(s, 40001, 60000);
  assert.ok(r.block && /per applicant per day/.test(r.block));
  assert.equal(await run({ ...s, cash_receipt_limit_scope: 'receipt' }, 40001, 60000), null);   // the same money counted per receipt is under the limit
});

test('display name: one fragment, the stored name when the parts are empty', () => {
  assert.equal(personNameSql('c'), "COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name)");
  assert.match(personNameSql('x'), /x\.first_name/);
});
