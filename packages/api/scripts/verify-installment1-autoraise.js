// Read-only-safe VERIFY script for the installment-1 auto-raise feature.
// Creates isolated test data (consumer/booking), exercises the API, then cleans up.
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const API = 'http://localhost:3001/api';
const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001';
const UNIT_ID = 'c0000000-0000-0000-0000-000000000017';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

async function main() {
  const token = jwt.sign({ userId: USER_ID, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const fail = (msg) => { throw new Error('VERIFY FAILED: ' + msg); };
  const fmtLocalDate = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const assertEq = (actual, expected, label) => {
    const a = actual === undefined ? null : actual;
    const e = expected === undefined ? null : expected;
    if (String(a) !== String(e)) fail(`${label}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    console.log(`  OK ${label} = ${JSON.stringify(a)}`);
  };

  let consumerId, planId, receiptIds = [];

  try {
    // Reset unit to available in case a prior aborted run left it booked
    await c.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
    await c.query(`DELETE FROM booking_records WHERE unit_id=$1`, [UNIT_ID]);

    const consRes = await c.query(
      `INSERT INTO consumers (name, mobile, first_name, last_name, project_id)
       VALUES ('AutoRaise TestConsumer','9999999999','AutoRaise','TestConsumer',$1) RETURNING id`,
      [PROJECT_ID]
    );
    consumerId = consRes.rows[0].id;
    console.log('Created test consumer', consumerId);

    // Create booking via real API (no booking_amount/payment_mode -> pending_payment, no Step-G receipt)
    const bookingRes = await fetch(`${API}/booking`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumer_id: consumerId, project_id: PROJECT_ID, unit_id: UNIT_ID,
        booking_date: '2026-06-01', selected_plan_name: 'CLP@92',
        basic_price: 5000, carpet_area_sqft: 500,
      }),
    });
    const bookingJson = await bookingRes.json();
    if (!bookingRes.ok) fail('booking creation: ' + JSON.stringify(bookingJson));
    const bookingId = bookingJson.data?.id || bookingJson.id;
    console.log('Booking created:', bookingId);

    // Confirm payment (triggers allocation + payment_plan + demand generation, Step G)
    const confirmRes = await fetch(`${API}/booking/${bookingId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ booking_amount: 1, payment_mode: 'cash' }),
    });
    const confirmJson = await confirmRes.json();
    if (!confirmRes.ok) fail('booking payment confirmation: ' + JSON.stringify(confirmJson));
    console.log('Booking payment confirmed');

    const planRow = await c.query(`SELECT id FROM payment_plans WHERE consumer_id=$1 ORDER BY created_at DESC LIMIT 1`, [consumerId]);
    if (planRow.rows.length === 0) fail('no payment_plan created for test consumer');
    planId = planRow.rows[0].id;
    console.log('payment_plan_id =', planId);

    const idx1Before = await c.query(`SELECT * FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    console.log('idx1 demand before any staff receipt:', JSON.stringify(idx1Before.rows[0]));
    assertEq(idx1Before.rows[0].status, 'pending', 'idx1.status after Step-G auto-receipt (must stay pending, Step-G is ignored)');
    assertEq(idx1Before.rows[0].due_date, null, 'idx1.due_date after Step-G auto-receipt (must stay NULL)');
    const stepGReceipt = await c.query(`SELECT id, installment_index, status FROM receipts WHERE consumer_id=$1 AND installment_index IS NULL`, [consumerId]);
    console.log('Step-G auto-receipt (should exist, installment_index=NULL, ignored):', JSON.stringify(stepGReceipt.rows));

    // ── STEP 1: first receipt (installment_index=1), 2 weeks in the past ──
    console.log('\n=== STEP 1: first receipt (idx1) ===');
    const r1 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 10000, paymentDate: '2026-06-27', paymentMode: 'bank_transfer',
      }),
    });
    const r1Json = await r1.json();
    console.log('r1 status', r1.status, 'body', JSON.stringify(r1Json));
    if (!r1.ok) fail('receipt1 creation: ' + JSON.stringify(r1Json));
    const receipt1Id = r1Json.data.id;
    receiptIds.push(receipt1Id);
    console.log('receipt1 id', receipt1Id);

    const idx1AfterR1 = await c.query(`SELECT status, due_date, delivery_status, raised_at FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    const d1 = idx1AfterR1.rows[0];
    assertEq(d1.status, 'demanded', 'idx1.status after receipt1');
    assertEq(fmtLocalDate(d1.due_date), '2026-06-27', 'idx1.due_date after receipt1');
    assertEq(d1.delivery_status, 'queued', 'idx1.delivery_status after receipt1');
    if (!d1.raised_at) fail('idx1.raised_at should be set');
    console.log('  OK idx1.raised_at is set');

    const auditRow = await c.query(
      `SELECT * FROM audit_logs WHERE action='DEMAND_RAISE' AND resource_id=(SELECT id FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1) ORDER BY timestamp DESC LIMIT 1`,
      [planId]
    );
    if (auditRow.rows.length === 0) fail('audit_logs DEMAND_RAISE entry missing');
    console.log('  OK audit_logs DEMAND_RAISE entry present');

    // ── STEP 2: second receipt (idx2) must not affect idx1 ──
    console.log('\n=== STEP 2: second receipt (idx2) does not affect idx1 ===');
    const r2 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 2,
        amountReceivedInr: 50000, paymentDate: '2026-07-01', paymentMode: 'bank_transfer',
      }),
    });
    const r2Json = await r2.json();
    if (!r2.ok) fail('receipt2 creation: ' + JSON.stringify(r2Json));
    receiptIds.push(r2Json.data.id);

    const idx1AfterR2 = await c.query(`SELECT status, due_date, delivery_status FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1AfterR2.rows[0].status, 'demanded', 'idx1.status after receipt2 (unaffected)');
    assertEq(fmtLocalDate(idx1AfterR2.rows[0].due_date), '2026-06-27', 'idx1.due_date after receipt2 (unaffected)');

    // ── STEP 3: bounce first receipt -> idx1 reverses ──
    console.log('\n=== STEP 3: bounce receipt1 -> idx1 reverses ===');
    const bounceRes = await fetch(`${API}/payments/receipts/${receipt1Id}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'test bounce' }),
    });
    const bounceJson = await bounceRes.json();
    if (!bounceRes.ok) fail('bounce: ' + JSON.stringify(bounceJson));

    const idx1AfterBounce = await c.query(`SELECT status, due_date, delivery_status, raised_at FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    const dB = idx1AfterBounce.rows[0];
    assertEq(dB.status, 'pending', 'idx1.status after bounce');
    assertEq(dB.due_date, null, 'idx1.due_date after bounce');
    assertEq(dB.delivery_status, 'pending', 'idx1.delivery_status after bounce');
    assertEq(dB.raised_at, null, 'idx1.raised_at after bounce');

    // ── STEP 4: replacement receipt (idx1) with a DIFFERENT date -> re-triggers ──
    console.log('\n=== STEP 4: replacement receipt (idx1) re-triggers with NEW date ===');
    const r3 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 10000, paymentDate: '2026-07-05', paymentMode: 'bank_transfer',
      }),
    });
    const r3Json = await r3.json();
    if (!r3.ok) fail('receipt3 (replacement) creation: ' + JSON.stringify(r3Json));
    const receipt3Id = r3Json.data.id;
    receiptIds.push(receipt3Id);

    const idx1AfterReplace = await c.query(`SELECT status, due_date, delivery_status FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1AfterReplace.rows[0].status, 'demanded', 'idx1.status after replacement receipt');
    assertEq(fmtLocalDate(idx1AfterReplace.rows[0].due_date), '2026-07-05', 'idx1.due_date after replacement (NEW date, not bounced one)');

    // ── STEP 5: cancel path -> reverse, then replace again ──
    console.log('\n=== STEP 5: cancel receipt3 -> idx1 reverses, then replacement re-triggers ===');
    const cancelRes = await fetch(`${API}/payments/receipts/${receipt3Id}/cancel`, {
      method: 'POST', headers, body: JSON.stringify({ reason: 'test cancel' }),
    });
    const cancelJson = await cancelRes.json();
    if (!cancelRes.ok) fail('cancel: ' + JSON.stringify(cancelJson));

    const idx1AfterCancel = await c.query(`SELECT status, due_date, delivery_status, raised_at FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    const dC = idx1AfterCancel.rows[0];
    assertEq(dC.status, 'pending', 'idx1.status after cancel');
    assertEq(dC.due_date, null, 'idx1.due_date after cancel');
    assertEq(dC.raised_at, null, 'idx1.raised_at after cancel');

    const r4 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 10000, paymentDate: '2026-07-08', paymentMode: 'bank_transfer',
      }),
    });
    const r4Json = await r4.json();
    if (!r4.ok) fail('receipt4 (post-cancel replacement) creation: ' + JSON.stringify(r4Json));
    const receipt4Id = r4Json.data.id;
    receiptIds.push(receipt4Id);

    const idx1AfterReplace2 = await c.query(`SELECT status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1AfterReplace2.rows[0].status, 'demanded', 'idx1.status after post-cancel replacement');
    assertEq(fmtLocalDate(idx1AfterReplace2.rows[0].due_date), '2026-07-08', 'idx1.due_date after post-cancel replacement');

    // ── STEP 6: hold must NOT trigger reversal ──
    console.log('\n=== STEP 6: hold does not affect idx1 ===');
    // hold requires a cheque receipt with status pending; create a fresh cheque receipt on idx3 for this test (does not touch idx1)
    const rHold = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 3,
        amountReceivedInr: 20000, paymentDate: '2026-07-09', paymentMode: 'cheque',
        chequeNo: 'HOLDTEST001', chequeDate: '2026-07-09', bankName: 'Test Bank',
      }),
    });
    const rHoldJson = await rHold.json();
    if (!rHold.ok) fail('hold-test receipt creation: ' + JSON.stringify(rHoldJson));
    const holdReceiptId = rHoldJson.data.id;
    receiptIds.push(holdReceiptId);

    const idx1BeforeHold = await c.query(`SELECT status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);

    const holdRes = await fetch(`${API}/payments/receipts/${holdReceiptId}/hold`, {
      method: 'PATCH', headers, body: JSON.stringify({ hold_remark: 'test hold' }),
    });
    const holdJson = await holdRes.json();
    if (!holdRes.ok) fail('hold: ' + JSON.stringify(holdJson));

    const idx1AfterHold = await c.query(`SELECT status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1AfterHold.rows[0].status, idx1BeforeHold.rows[0].status, 'idx1.status unaffected by hold');
    assertEq(fmtLocalDate(idx1AfterHold.rows[0].due_date), fmtLocalDate(idx1BeforeHold.rows[0].due_date), 'idx1.due_date unaffected by hold');

    // release-hold back to pending for cleanliness (not required, but tidy)
    await fetch(`${API}/payments/receipts/${holdReceiptId}/release-hold`, { method: 'PATCH', headers, body: JSON.stringify({}) });

    // ── STEP 7: multi-cycle bounce/replace ──
    console.log('\n=== STEP 7: multi-cycle bounce -> replace -> bounce -> replace ===');
    const bounce2 = await fetch(`${API}/payments/receipts/${receipt4Id}/bounce`, { method: 'PATCH', headers, body: JSON.stringify({ reason: 'cycle2 bounce' }) });
    if (!bounce2.ok) fail('cycle2 bounce: ' + JSON.stringify(await bounce2.json()));
    const idx1Cycle2Bounced = await c.query(`SELECT status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1Cycle2Bounced.rows[0].status, 'pending', 'idx1.status after 2nd bounce cycle');
    assertEq(idx1Cycle2Bounced.rows[0].due_date, null, 'idx1.due_date after 2nd bounce cycle');

    const r5 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 10000, paymentDate: '2026-07-10', paymentMode: 'bank_transfer',
      }),
    });
    const r5Json = await r5.json();
    if (!r5.ok) fail('cycle2 replacement receipt: ' + JSON.stringify(r5Json));
    receiptIds.push(r5Json.data.id);
    const idx1Cycle2Replaced = await c.query(`SELECT status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1Cycle2Replaced.rows[0].status, 'demanded', 'idx1.status after cycle2 replacement');
    assertEq(fmtLocalDate(idx1Cycle2Replaced.rows[0].due_date), '2026-07-10', 'idx1.due_date after cycle2 replacement');

    // ── STEP 8: edge case — a single receipt that fully covers idx1 in one shot
    // (pre-existing auto-match logic flips it straight to 'paid' before our
    // hook runs) must still get due_date set, without being downgraded back
    // to 'demanded' ──
    console.log('\n=== STEP 8: full-coverage receipt (jumps straight to paid) still gets due_date ===');
    const bounce3 = await fetch(`${API}/payments/receipts/${r5Json.data.id}/bounce`, { method: 'PATCH', headers, body: JSON.stringify({ reason: 'reset for full-coverage test' }) });
    if (!bounce3.ok) fail('reset bounce: ' + JSON.stringify(await bounce3.json()));
    const idx1BeforeFull = await c.query(`SELECT amount_due_inr, cgst_amount, sgst_amount, status, due_date FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1BeforeFull.rows[0].status, 'pending', 'idx1.status before full-coverage receipt');
    assertEq(idx1BeforeFull.rows[0].due_date, null, 'idx1.due_date before full-coverage receipt');
    const fullAmount = Math.ceil(parseFloat(idx1BeforeFull.rows[0].amount_due_inr) + parseFloat(idx1BeforeFull.rows[0].cgst_amount || 0) + parseFloat(idx1BeforeFull.rows[0].sgst_amount || 0));
    console.log('  full coverage amount needed:', fullAmount);
    const r6 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: fullAmount, paymentDate: '2026-07-11', paymentMode: 'bank_transfer',
      }),
    });
    const r6Json = await r6.json();
    if (!r6.ok) fail('full-coverage receipt: ' + JSON.stringify(r6Json));
    receiptIds.push(r6Json.data.id);
    const idx1AfterFull = await c.query(`SELECT status, due_date, delivery_status FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`, [planId]);
    assertEq(idx1AfterFull.rows[0].status, 'paid', 'idx1.status after full-coverage receipt (pre-existing match logic marks paid)');
    assertEq(idx1AfterFull.rows[0].delivery_status, 'paid', 'idx1.delivery_status after full-coverage receipt');
    assertEq(fmtLocalDate(idx1AfterFull.rows[0].due_date), '2026-07-11', 'idx1.due_date after full-coverage receipt (must still be set to receipt date)');

    console.log('\n=== ALL VERIFY CHECKS PASSED ===');
    console.log(JSON.stringify({ consumerId, planId, receiptIds }));
  } finally {
    console.log('\n--- cleanup ---');
    if (consumerId) {
      await c.query(`DELETE FROM cheque_bounce_logs WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM financial_audit_logs WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM audit_logs WHERE resource_id IN (SELECT id FROM demands WHERE consumer_id=$1)`, [consumerId]);
      await c.query(`DELETE FROM receipts WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM demands WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM payment_plans WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM booking_payment_taxes WHERE booking_record_id IN (SELECT id FROM booking_records WHERE consumer_id=$1)`, [consumerId]);
      await c.query(`DELETE FROM booking_records WHERE consumer_id=$1`, [consumerId]);
      await c.query(`DELETE FROM allocations WHERE consumer_id=$1`, [consumerId]);
      await c.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
      await c.query(`DELETE FROM consumers WHERE id=$1`, [consumerId]);
      console.log('Cleaned up test consumer', consumerId, 'and all related rows');
    }
    await c.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
