// Statutory masters (QA-003, 029, 046, 049): the date-range coverage test the readiness check uses, the RERA placeholder test, and the one GST-exempt rule.
// Run: npx tsx --test test/statutory-readiness.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageGaps, reraLooksReal, addDays } from '../src/utils/statutory-readiness.ts';
import { isGstExempt } from '../src/utils/gst-exempt.ts';

const R = (f, t) => ({ from: f, to: t });

test('coverageGaps: a range covered end to end has no gap, across touching and overlapping ranges', () => {
  assert.deepEqual(coverageGaps([R('2019-04-01', '2020-03-31'), R('2020-04-01', '2021-03-31')], '2019-04-01', '2021-03-31'), []);
  assert.deepEqual(coverageGaps([R('2019-04-01', '2020-06-30'), R('2020-04-01', '2021-03-31')], '2019-06-01', '2021-01-01'), []);
  assert.deepEqual(coverageGaps([R('2019-01-01', '2030-12-31')], '2019-04-01', '2026-11-27'), []);
});

test('coverageGaps: the missing stretches are reported exactly, inclusive days', () => {
  assert.deepEqual(coverageGaps([], '2019-04-01', '2019-04-30'), [R('2019-04-01', '2019-04-30')]);
  assert.deepEqual(coverageGaps([R('2019-04-10', '2019-04-20')], '2019-04-01', '2019-04-30'), [R('2019-04-01', '2019-04-09'), R('2019-04-21', '2019-04-30')]);
  assert.deepEqual(coverageGaps([R('2019-04-01', '2019-12-31'), R('2020-04-01', '2020-12-31')], '2019-04-01', '2020-12-31'), [R('2020-01-01', '2020-03-31')]);
  assert.deepEqual(coverageGaps([R('2020-01-01', '2020-12-31')], '2019-04-01', '2020-06-30'), [R('2019-04-01', '2019-12-31')]);
});

test('coverageGaps: ranges outside the asked range and out of order change nothing', () => {
  assert.deepEqual(coverageGaps([R('2025-01-01', '2025-12-31'), R('2000-01-01', '2000-12-31')], '2019-04-01', '2019-04-30'), [R('2019-04-01', '2019-04-30')]);
  assert.deepEqual(coverageGaps([R('2020-04-01', '2021-03-31'), R('2019-04-01', '2020-03-31')], '2019-04-01', '2021-03-31'), []);
  assert.equal(addDays('2020-02-28', 1), '2020-02-29');
  assert.equal(addDays('2020-03-01', -1), '2020-02-29');
});

test('reraLooksReal: blanks and placeholders are not a RERA number', () => {
  for (const v of [null, undefined, '', '  ', 'N/A', 'NA', 'TBD', 'pending', 'XXXXX', '0000000', 'test-1234']) assert.equal(reraLooksReal(v), false, String(v));
  for (const v of ['HRERA-PKL-GGM-123-2019', '75 OF 2019', 'RC/REP/HARERA/GGM/123/2019']) assert.equal(reraLooksReal(v), true, v);
});

test('isGstExempt: NRI, OCI and PIO in any case and with spaces; nobody else', () => {
  for (const v of ['nri', 'NRI', 'Nri', ' oci ', 'OCI', 'pio', 'PIO']) assert.equal(isGstExempt(v), true, v);
  for (const v of ['indian', 'resident', '', null, undefined, 'foreign national']) assert.equal(isGstExempt(v), false, String(v));
});
