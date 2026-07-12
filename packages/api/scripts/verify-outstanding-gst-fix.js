// VERIFY for the Customer Wise Dues Outstanding CGST/SGST/TOTAL O/S fix
// (reports.ts customer-dues route + reports.js osCells rendering).
// Live-checks: Mayank Kumar (real data), Sunil Naraine (real data, different GST rate),
// and one freshly created zero-receipt-then-overpaid consumer to exercise the floor-at-0 branch.
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const API = 'http://localhost:3001/api';
const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001';
const UNIT_ID = 'c0000000-0000-0000-0000-000000000017';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const results = [];
function record(step, pass, detail) {
  results.push({ step, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${step}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const token = jwt.sign({ userId: USER_ID, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  let consumerId;

  try {
    // ── CHECK 1: Mayank Kumar (real data, zero receipts scenario N/A but partial payment) ──
    const mayank = await fetch(`${API}/reports/customer-dues?registrationNo=ALAN-2026-0021T1`, { headers });
    const mayankJson = await mayank.json();
    const mRow = mayankJson.data[0];
    const dCgst = parseFloat(mRow.dues_cgst), rCgst = parseFloat(mRow.received_cgst);
    const dSgst = parseFloat(mRow.dues_sgst), rSgst = parseFloat(mRow.received_sgst);
    const expOsCgst = Math.max(0, dCgst - rCgst);
    const expOsSgst = Math.max(0, dSgst - rSgst);
    const expOsTotal = (parseFloat(mRow.dues_amount) + dCgst + dSgst) - (parseFloat(mRow.received_total) + rCgst + rSgst);
    record('Mayank: outstanding_cgst matches dues_cgst - received_cgst', Math.abs(mRow.outstanding_cgst - expOsCgst) < 0.01,
      `outstanding_cgst=${mRow.outstanding_cgst} expected=${expOsCgst.toFixed(2)}`);
    record('Mayank: outstanding_sgst matches dues_sgst - received_sgst', Math.abs(mRow.outstanding_sgst - expOsSgst) < 0.01,
      `outstanding_sgst=${mRow.outstanding_sgst} expected=${expOsSgst.toFixed(2)}`);
    record('Mayank: outstanding_cgst+sgst is non-zero (real gap)', (mRow.outstanding_cgst + mRow.outstanding_sgst) > 0,
      `combined=${(mRow.outstanding_cgst + mRow.outstanding_sgst).toFixed(2)}`);
    record('Mayank: outstanding_total is GST-inclusive (> base outstanding_amount)',
      mRow.outstanding_total > parseFloat(mRow.outstanding_amount),
      `outstanding_total=${mRow.outstanding_total} outstanding_amount=${mRow.outstanding_amount}`);
    record('Mayank: outstanding_total matches formula', Math.abs(mRow.outstanding_total - expOsTotal) < 0.01,
      `outstanding_total=${mRow.outstanding_total} expected=${expOsTotal.toFixed(2)}`);
    record('Mayank: dues_cgst/dues_sgst unchanged (still correct)', dCgst === 29630 && dSgst === 29630,
      `dues_cgst=${dCgst} dues_sgst=${dSgst}`);
    record('Mayank: received_cgst/received_sgst unchanged (still correct)', Math.abs(rCgst - 3782.43) < 0.01 && Math.abs(rSgst - 3782.43) < 0.01,
      `received_cgst=${rCgst} received_sgst=${rSgst}`);

    // ── CHECK 2: Sunil Naraine (real data, different GST rate) ──
    const sunil = await fetch(`${API}/reports/customer-dues?registrationNo=TULA-2026-0002`, { headers });
    const sunilJson = await sunil.json();
    const sRow = sunilJson.data[0];
    const sdCgst = parseFloat(sRow.dues_cgst), srCgst = parseFloat(sRow.received_cgst);
    const sdSgst = parseFloat(sRow.dues_sgst), srSgst = parseFloat(sRow.received_sgst);
    const sExpOsCgst = Math.max(0, sdCgst - srCgst);
    const sExpOsSgst = Math.max(0, sdSgst - srSgst);
    record('Sunil: outstanding_cgst matches formula', Math.abs(sRow.outstanding_cgst - sExpOsCgst) < 0.01,
      `outstanding_cgst=${sRow.outstanding_cgst} expected=${sExpOsCgst.toFixed(2)} (dues_cgst=${sdCgst} received_cgst=${srCgst})`);
    record('Sunil: outstanding_sgst matches formula', Math.abs(sRow.outstanding_sgst - sExpOsSgst) < 0.01,
      `outstanding_sgst=${sRow.outstanding_sgst} expected=${sExpOsSgst.toFixed(2)} (dues_sgst=${sdSgst} received_sgst=${srSgst})`);

    // ── CHECK 3: fresh consumer, receipts > demand -> floor-at-0 branch ──
    await db.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
    await db.query(`DELETE FROM booking_records WHERE unit_id=$1`, [UNIT_ID]);
    const consRes = await db.query(
      `INSERT INTO consumers (name, mobile, first_name, last_name, project_id)
       VALUES ('OutstandingGstFix Consumer','7000000001','OutstandingGstFix','Consumer',$1) RETURNING id`,
      [PROJECT_ID]
    );
    consumerId = consRes.rows[0].id;

    const bookingRes = await fetch(`${API}/booking`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumer_id: consumerId, project_id: PROJECT_ID, unit_id: UNIT_ID,
        booking_date: '2026-07-01', selected_plan_name: 'CLP@92',
        basic_price: 3800, carpet_area_sqft: 380,
      }),
    });
    const bookingJson = await bookingRes.json();
    if (!bookingRes.ok) throw new Error('booking creation failed: ' + JSON.stringify(bookingJson));
    const bookingId = bookingJson.data?.id || bookingJson.id;

    // Zero-receipt check BEFORE confirming any payment
    const confirmRes = await fetch(`${API}/booking/${bookingId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ booking_amount: 1, payment_mode: 'cash' }),
    });
    const confirmJson = await confirmRes.json();
    if (!confirmRes.ok) throw new Error('booking confirm failed: ' + JSON.stringify(confirmJson));

    const zeroRcpt = await fetch(`${API}/reports/customer-dues?registrationNo=${confirmJson.data?.registration_no || ''}`, { headers });
    // registration_no may not be returned by confirm; fetch by consumer instead via direct filter isn't supported, so query all + find by mobile-derived name
    const allRows = await fetch(`${API}/reports/customer-dues?projectId=${PROJECT_ID}&pageSize=500`, { headers });
    const allJson = await allRows.json();
    const zRow = allJson.data.find(r => r.consumer_id === consumerId);
    record('Zero-receipt consumer: found in report', !!zRow, zRow ? 'found' : 'NOT FOUND');
    if (zRow) {
      record('Zero-receipt: outstanding_cgst = dues_cgst (received=0)', Math.abs(zRow.outstanding_cgst - parseFloat(zRow.dues_cgst)) < 0.01,
        `outstanding_cgst=${zRow.outstanding_cgst} dues_cgst=${zRow.dues_cgst}`);
      record('Zero-receipt: outstanding_cgst never negative', zRow.outstanding_cgst >= 0, `outstanding_cgst=${zRow.outstanding_cgst}`);
    }

    const planRow = await db.query(`SELECT id FROM payment_plans WHERE consumer_id=$1 ORDER BY created_at DESC LIMIT 1`, [consumerId]);
    const planId = planRow.rows[0].id;
    const demandRow = await db.query(
      `SELECT id, cgst_amount, sgst_amount, amount_due_inr FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' LIMIT 1`,
      [planId]
    );
    const demandId = demandRow.rows[0].id;
    // received_cgst is computed plan-wide (no dueDate scoping), while dues_cgst IS scoped by
    // ?dueDate. Since this consumer's demand due_dates are NULL, applying a dueDate filter
    // excludes them from dues_cgst (0) while a cleared receipt still counts toward received_cgst
    // (>0) -- this is the real path that would go negative without the Math.max(0, ...) floor.
    const fullReceipt = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1, demandId,
        amountReceivedInr: 59472, paymentDate: '2026-07-05', paymentMode: 'upi',
      }),
    });
    const fullJson = await fullReceipt.json();
    if (!fullReceipt.ok) throw new Error('receipt failed: ' + JSON.stringify(fullJson));
    await db.query(`UPDATE receipts SET status='cleared' WHERE id=$1`, [fullJson.data.id]);

    const floorRows = await fetch(`${API}/reports/customer-dues?projectId=${PROJECT_ID}&pageSize=500&dueDate=2026-01-01`, { headers });
    const floorJson = await floorRows.json();
    const oRow = floorJson.data.find(r => r.consumer_id === consumerId);
    record('Floor-case consumer: found in report', !!oRow, oRow ? 'found' : 'NOT FOUND');
    if (oRow) {
      record('Floor-case: dues_cgst excluded by dueDate filter (=0)', parseFloat(oRow.dues_cgst) === 0, `dues_cgst=${oRow.dues_cgst}`);
      record('Floor-case: received_cgst still counted plan-wide (>0)', parseFloat(oRow.received_cgst) > 0, `received_cgst=${oRow.received_cgst}`);
      record('Floor-case: outstanding_cgst floors at 0 (never negative)', oRow.outstanding_cgst === 0,
        `outstanding_cgst=${oRow.outstanding_cgst} dues_cgst=${oRow.dues_cgst} received_cgst=${oRow.received_cgst}`);
      record('Floor-case: outstanding_sgst floors at 0 (never negative)', oRow.outstanding_sgst === 0,
        `outstanding_sgst=${oRow.outstanding_sgst} dues_sgst=${oRow.dues_sgst} received_sgst=${oRow.received_sgst}`);
    }

    // ── CHECK 4: summary block clear/total sums unaffected by this fix (regression) ──
    const sumOk = Math.abs(floorJson.summary.clear.amount - floorJson.data.reduce((a, r) => a + parseFloat(r.received_clear || 0), 0)) < 0.01;
    record('Summary clear.amount still sums received_clear correctly (regression)', sumOk, JSON.stringify(floorJson.summary.clear));

    console.log('\n=== VERIFY-OUTSTANDING-GST-FIX COMPLETE ===');
  } catch (err) {
    record('UNCAUGHT ERROR', false, err.message);
  } finally {
    if (consumerId) {
      await db.query(`DELETE FROM cheque_bounce_logs WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM financial_audit_logs WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM audit_logs WHERE resource_id IN (SELECT id FROM demands WHERE consumer_id=$1)`, [consumerId]);
      await db.query(`DELETE FROM receipts WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM demands WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM payment_plans WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM booking_payment_taxes WHERE booking_record_id IN (SELECT id FROM booking_records WHERE consumer_id=$1)`, [consumerId]);
      await db.query(`DELETE FROM booking_records WHERE consumer_id=$1`, [consumerId]);
      await db.query(`DELETE FROM allocations WHERE consumer_id=$1`, [consumerId]);
      await db.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
      await db.query(`DELETE FROM consumers WHERE id=$1`, [consumerId]);

      const strayCheck = await db.query(`SELECT id FROM consumers WHERE id=$1`, [consumerId]);
      record('CLEANUP: zero pollution', strayCheck.rows.length === 0, `stray consumer rows=${strayCheck.rows.length}`);
    }
    await db.end();

    console.log('\n\n=== FINAL RESULTS ===');
    for (const r of results) console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.step}`);
    const failed = results.filter(r => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) {
      console.log('\nFAILURES:');
      failed.forEach(r => console.log(`- ${r.step}: ${r.detail}`));
      process.exitCode = 1;
    }
  }
}

main();
