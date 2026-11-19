// QA-032 / QA-001: which demands feed the Applicant File, and how a GST variance is classed. Run: npx tsx --test test/agreement-reconcile.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { billableDemands, gstReconciliation } from '../src/utils/agreement-reconcile.ts';

const d = (status, cgst) => ({ status, cgst_amount: cgst });
test('cancelled booking bills nothing, so no residual demand can leak into header GST (ZZREG-2026-000014)', () => {
  assert.deepEqual(billableDemands({ status: 'cancelled' }, [d('pending', 1390), d('cancelled', 27800)]), []);
});
test('live booking drops only cancelled demands', () => {
  assert.equal(billableDemands({ status: 'active' }, [d('pending', 1), d('cancelled', 2), d('paid', 3)]).length, 2);
});
test('GST variance is never called rounding beyond 1 rupee per row (QAAU-2026-0002: 900 vs 2500 over 2 rows)', () => {
  assert.equal(gstReconciliation(900, 2500, 2).status, 'exception');
  assert.equal(gstReconciliation(900, 2500, 2).variance, 1600);
  assert.equal(gstReconciliation(55600, 55601, 1).status, 'rounding');
  assert.equal(gstReconciliation(55600, 55030, 6).status, 'exception');
});

import { headGst } from '../src/utils/agreement-reconcile.ts';
test('QA-001: PLC taxed at its own mapped rate, not the booking rate (QAAU-2026-0002 shape: BSP 2.5% each side, PLC 0%)', () => {
  // schedule bills 1,250 + 1,250; the breakup must give the same 1,250 per side when BASIC 50,000 @2.5% and PLC 40,000 @0%
  assert.equal(headGst(50000, 40000, 2.5, 0), 1250);
  // the old single booking rate (0.5% each side on 90,000) gave 450: the 800 per side gap of the report
  assert.equal(headGst(50000, 40000, 0.5, 0.5), 450);
  // if ROF decides PLC is taxed with the apartment, only the mapping changes
  assert.equal(headGst(50000, 40000, 2.5, 2.5), 2250);
});
