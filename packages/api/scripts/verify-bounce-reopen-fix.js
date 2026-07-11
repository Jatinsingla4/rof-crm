// VERIFY for the bounce demand-reopen fix (payments.ts:1742-1748).
// General fix, not installment-1-specific: tests a non-idx1 installment with
// two valid linked receipts to confirm the reopen is correctly gated on
// "no other valid receipt remains," and that delivery_status is reset
// alongside status, and that due_date/raised_at are never touched.
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const API = 'http://localhost:3001/api';
const PROJECT_ID = 'a0000000-0000-0000-0000-000000000002';
const UNIT_ID = 'c0000000-0000-0000-0000-000000000025'; // C-906 — fresh unit, unused by prior scripts
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

  let consumerId, planId;
  const receiptIds = [];

  try {
    await db.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
    await db.query(`DELETE FROM booking_records WHERE unit_id=$1`, [UNIT_ID]);

    const consRes = await db.query(
      `INSERT INTO consumers (name, mobile, first_name, last_name, project_id)
       VALUES ('BounceReopenFix Consumer','7777777777','BounceReopenFix','Consumer',$1) RETURNING id`,
      [PROJECT_ID]
    );
    consumerId = consRes.rows[0].id;

    const bookingRes = await fetch(`${API}/booking`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumer_id: consumerId, project_id: PROJECT_ID, unit_id: UNIT_ID,
        booking_date: '2026-04-10', selected_plan_name: 'CLP@92',
        basic_price: 3800, carpet_area_sqft: 380,
      }),
    });
    const bookingJson = await bookingRes.json();
    if (!bookingRes.ok) throw new Error('booking creation failed: ' + JSON.stringify(bookingJson));
    const bookingId = bookingJson.data?.id || bookingJson.id;

    const confirmRes = await fetch(`${API}/booking/${bookingId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ booking_amount: 1, payment_mode: 'cash' }),
    });
    const confirmJson = await confirmRes.json();
    if (!confirmRes.ok) throw new Error('booking confirm failed: ' + JSON.stringify(confirmJson));

    const planRow = await db.query(`SELECT id FROM payment_plans WHERE consumer_id=$1 ORDER BY created_at DESC LIMIT 1`, [consumerId]);
    planId = planRow.rows[0].id;

    // Use installment_index=2 deliberately — a NON-idx1 demand, to prove this is a general fix.
    const demandRow = await db.query(
      `SELECT id, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=2 AND demand_type='installment' LIMIT 1`,
      [planId]
    );
    const demandId = demandRow.rows[0].id;

    // Manually activate idx2 demand (simulating staff-raised demand, independent of the auto-raise feature)
    await db.query(
      `UPDATE demands SET status='demanded', due_date=$1, raised_at=NOW(), generated_at=NOW(), delivery_status='queued' WHERE id=$2`,
      ['2026-05-01', demandId]
    );
    const initialDemand = await db.query(`SELECT status, due_date, raised_at, delivery_status FROM demands WHERE id=$1`, [demandId]);
    record('SETUP: idx2 demand manually activated (demanded/queued)', initialDemand.rows[0].status === 'demanded', JSON.stringify(initialDemand.rows[0]));

    // Two valid receipts linked to the SAME demand (idx2)
    const r1 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 2, demandId,
        amountReceivedInr: 20000, paymentDate: '2026-04-28', paymentMode: 'upi',
      }),
    });
    const r1Json = await r1.json();
    if (!r1.ok) throw new Error('receipt1 creation failed: ' + JSON.stringify(r1Json));
    receiptIds.push(r1Json.data.id);

    const r2 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 2, demandId,
        amountReceivedInr: 15000, paymentDate: '2026-04-29', paymentMode: 'upi',
      }),
    });
    const r2Json = await r2.json();
    if (!r2.ok) throw new Error('receipt2 creation failed: ' + JSON.stringify(r2Json));
    receiptIds.push(r2Json.data.id);

    const linked = await db.query(`SELECT id, demand_id, status FROM receipts WHERE id = ANY($1)`, [receiptIds]);
    const bothLinked = linked.rows.every(r => r.demand_id === demandId);
    record('SETUP: both receipts linked to the same idx2 demand', bothLinked, JSON.stringify(linked.rows));

    const beforeAnyBounce = await db.query(`SELECT status, due_date, raised_at, delivery_status FROM demands WHERE id=$1`, [demandId]);

    // ── STEP 1: bounce ONE of two valid receipts -> demand must stay demanded/queued ──
    const bounce1 = await fetch(`${API}/payments/receipts/${receiptIds[0]}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'verify-fix step1' }),
    });
    if (!bounce1.ok) throw new Error('bounce1 failed: ' + JSON.stringify(await bounce1.json()));

    const afterBounce1 = await db.query(`SELECT status, due_date, raised_at, delivery_status FROM demands WHERE id=$1`, [demandId]);
    const step1Pass = afterBounce1.rows[0].status === 'demanded' &&
      afterBounce1.rows[0].delivery_status === beforeAnyBounce.rows[0].delivery_status;
    record('STEP 1: bounce ONE of two valid receipts -> demand stays demanded, delivery_status unchanged (no reopen)', step1Pass,
      JSON.stringify({ before: beforeAnyBounce.rows[0], after: afterBounce1.rows[0] }));

    // ── STEP 2: bounce the SECOND (last remaining valid) receipt -> demand reopens ──
    const bounce2 = await fetch(`${API}/payments/receipts/${receiptIds[1]}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'verify-fix step2' }),
    });
    if (!bounce2.ok) throw new Error('bounce2 failed: ' + JSON.stringify(await bounce2.json()));

    const afterBounce2 = await db.query(`SELECT status, due_date, raised_at, delivery_status FROM demands WHERE id=$1`, [demandId]);
    const step2Pass = afterBounce2.rows[0].status === 'pending' && afterBounce2.rows[0].delivery_status === 'queued';
    record('STEP 2: bounce the LAST valid receipt -> demand reopens (status=pending, delivery_status=queued)', step2Pass,
      JSON.stringify(afterBounce2.rows[0]));

    // ── STEP 5 (this script): due_date/raised_at NEVER touched by the general fix ──
    const dueDateUnchanged = String(afterBounce2.rows[0].due_date) === String(beforeAnyBounce.rows[0].due_date);
    const raisedAtUnchanged = String(afterBounce2.rows[0].raised_at) === String(beforeAnyBounce.rows[0].raised_at);
    record('STEP 5: due_date and raised_at NEVER touched by the general reopen fix', dueDateUnchanged && raisedAtUnchanged,
      JSON.stringify({ before: beforeAnyBounce.rows[0], after: afterBounce2.rows[0] }));

    // ── STEP 4: regression — ordinary single-receipt-per-demand bounce still reopens correctly ──
    const demand3Row = await db.query(
      `SELECT id FROM demands WHERE payment_plan_id=$1 AND installment_index=3 AND demand_type='installment' LIMIT 1`,
      [planId]
    );
    const demand3Id = demand3Row.rows[0].id;
    await db.query(
      `UPDATE demands SET status='demanded', due_date=$1, raised_at=NOW(), generated_at=NOW(), delivery_status='queued' WHERE id=$2`,
      ['2026-06-01', demand3Id]
    );
    const r3 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 3, demandId: demand3Id,
        amountReceivedInr: 30000, paymentDate: '2026-05-30', paymentMode: 'upi',
      }),
    });
    const r3Json = await r3.json();
    if (!r3.ok) throw new Error('single regression receipt creation failed: ' + JSON.stringify(r3Json));
    receiptIds.push(r3Json.data.id);

    const bounce3 = await fetch(`${API}/payments/receipts/${r3Json.data.id}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'verify-fix regression single-receipt' }),
    });
    if (!bounce3.ok) throw new Error('regression bounce failed: ' + JSON.stringify(await bounce3.json()));

    const afterRegressionBounce = await db.query(`SELECT status, delivery_status FROM demands WHERE id=$1`, [demand3Id]);
    const step4Pass = afterRegressionBounce.rows[0].status === 'pending' && afterRegressionBounce.rows[0].delivery_status === 'queued';
    record('STEP 4: regression — single-receipt-per-demand bounce still reopens normally', step4Pass,
      JSON.stringify(afterRegressionBounce.rows[0]));

    console.log('\n=== VERIFY-BOUNCE-REOPEN-FIX COMPLETE ===');
    console.log(JSON.stringify({ consumerId, planId, receiptIds }));
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
