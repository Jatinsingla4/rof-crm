// INDEPENDENT re-verification of the installment-1 auto-raise/reversal feature.
// Written from scratch against the confirmed spec only (checkAndAutoRaiseInstallment1 /
// reverseInstallment1IfNoValidReceipt in payment-waterfall.ts, wired into payments.ts's
// receipt create/bounce/cancel). Does not reuse or read verify-installment1-autoraise.js.
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const API = 'http://localhost:3001/api';
const PROJECT_ID = 'a0000000-0000-0000-0000-000000000002'; // ROF ALANTE_TEST — different project than prior script
const UNIT_ID = 'c0000000-0000-0000-0000-000000000022'; // B-1508 — different unit than prior script
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const results = [];
function record(step, pass, detail) {
  results.push({ step, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${step}${detail ? ' — ' + detail : ''}`);
}
function localDate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function main() {
  const token = jwt.sign({ userId: USER_ID, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  let consumerId, planId;
  const receiptIds = [];

  const idx1Row = async () => {
    const r = await db.query(
      `SELECT * FROM demands WHERE payment_plan_id=$1 AND installment_index=1 AND demand_type='installment' ORDER BY created_at ASC LIMIT 1`,
      [planId]
    );
    return r.rows[0];
  };

  try {
    // ── STEP 1: fresh booking on a different project/unit ──
    await db.query(`UPDATE units SET status='available' WHERE id=$1`, [UNIT_ID]);
    await db.query(`DELETE FROM booking_records WHERE unit_id=$1`, [UNIT_ID]);

    const consRes = await db.query(
      `INSERT INTO consumers (name, mobile, first_name, last_name, project_id)
       VALUES ('IndepReverify Consumer','8888888888','IndepReverify','Consumer',$1) RETURNING id`,
      [PROJECT_ID]
    );
    consumerId = consRes.rows[0].id;

    const bookingRes = await fetch(`${API}/booking`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumer_id: consumerId, project_id: PROJECT_ID, unit_id: UNIT_ID,
        booking_date: '2026-05-15', selected_plan_name: 'CLP@92',
        basic_price: 4200, carpet_area_sqft: 420,
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
    if (planRow.rows.length === 0) throw new Error('no payment_plan created');
    planId = planRow.rows[0].id;
    record('STEP 1: fresh booking on different project/unit', true, `consumer=${consumerId} plan=${planId} project=${PROJECT_ID} unit=${UNIT_ID}`);

    const preDemand = await idx1Row();
    if (preDemand.status !== 'pending' || preDemand.due_date !== null) {
      record('STEP 1b: idx1 starts pending/null before any staff receipt', false, JSON.stringify(preDemand));
    } else {
      record('STEP 1b: idx1 starts pending/null before any staff receipt', true);
    }

    // ── STEP 2: core behavior ──
    const r1 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 15000, paymentDate: '2026-05-20', paymentMode: 'upi',
      }),
    });
    const r1Json = await r1.json();
    if (!r1.ok) throw new Error('receipt1 creation failed: ' + JSON.stringify(r1Json));
    const receipt1Id = r1Json.data.id;
    receiptIds.push(receipt1Id);

    const d1 = await idx1Row();
    const step2aPass = d1.status === 'demanded' && localDate(d1.due_date) === '2026-05-20' &&
      d1.delivery_status === 'queued' && d1.raised_at != null;
    record('STEP 2a: idx1 demanded, due_date=2026-05-20, delivery_status=queued, raised_at set', step2aPass,
      JSON.stringify({ status: d1.status, due_date: d1.due_date, delivery_status: d1.delivery_status, raised_at: d1.raised_at }));

    const auditRow = await db.query(
      `SELECT * FROM audit_logs WHERE action='DEMAND_RAISE' AND resource_id=$1 ORDER BY timestamp DESC LIMIT 1`,
      [d1.id]
    );
    record('STEP 2b: DEMAND_RAISE audit_logs row exists, resource_id points to correct demand',
      auditRow.rows.length > 0, auditRow.rows.length > 0 ? `audit_log id=${auditRow.rows[0].id}` : 'no row found');

    // ── STEP 3: tiny partial-payment edge case (fresh scenario, not idx1's first receipt) ──
    // Bounce receipt1 first so we have a clean pending idx1 to re-trigger with a trivial amount.
    const bounceForStep3 = await fetch(`${API}/payments/receipts/${receipt1Id}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'reset for tiny-amount test' }),
    });
    if (!bounceForStep3.ok) throw new Error('reset bounce failed: ' + JSON.stringify(await bounceForStep3.json()));
    const dResetForStep3 = await idx1Row();
    if (dResetForStep3.status !== 'pending' || dResetForStep3.due_date !== null) {
      throw new Error('idx1 did not reset cleanly before STEP 3: ' + JSON.stringify(dResetForStep3));
    }

    const r3 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 1, paymentDate: '2026-05-22', paymentMode: 'upi',
      }),
    });
    const r3Json = await r3.json();
    if (!r3.ok) throw new Error('tiny-amount receipt creation failed: ' + JSON.stringify(r3Json));
    const tinyReceiptId = r3Json.data.id;
    receiptIds.push(tinyReceiptId);

    const d3 = await idx1Row();
    const step3Pass = d3.status === 'demanded' && localDate(d3.due_date) === '2026-05-22';
    record('STEP 3: due_date set correctly even for a ₹1 (trivial) partial payment', step3Pass,
      JSON.stringify({ status: d3.status, due_date: d3.due_date, amount: 1 }));

    // ── STEP 4: second valid idx1 receipt must NOT re-trigger/alter idx1 again ──
    const beforeSecond = await idx1Row();
    const r4 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 25, paymentDate: '2026-06-15', paymentMode: 'upi',
      }),
    });
    const r4Json = await r4.json();
    if (!r4.ok) throw new Error('second idx1 receipt creation failed: ' + JSON.stringify(r4Json));
    const secondReceiptId = r4Json.data.id;
    receiptIds.push(secondReceiptId);

    const afterSecond = await idx1Row();
    const step4Pass = afterSecond.status === beforeSecond.status &&
      localDate(afterSecond.due_date) === localDate(beforeSecond.due_date) &&
      String(afterSecond.raised_at) === String(beforeSecond.raised_at);
    record('STEP 4: second valid idx1 receipt does not re-trigger or alter idx1 (already raised by first)', step4Pass,
      JSON.stringify({ before: { status: beforeSecond.status, due_date: beforeSecond.due_date, raised_at: beforeSecond.raised_at },
        after: { status: afterSecond.status, due_date: afterSecond.due_date, raised_at: afterSecond.raised_at } }));

    // ── STEP 5: bounce the tiny (STEP 3) receipt -> reversal; verify bounce_penalty row untouched ──
    // Both tinyReceiptId and secondReceiptId are still valid idx1 receipts, so bouncing only one
    // (tinyReceiptId) must NOT reverse idx1 (secondReceiptId still valid). Bounce both to force reversal.
    const bounceTiny = await fetch(`${API}/payments/receipts/${tinyReceiptId}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'step5 bounce 1 of 2' }),
    });
    if (!bounceTiny.ok) throw new Error('bounce tiny receipt failed: ' + JSON.stringify(await bounceTiny.json()));

    const dAfterFirstBounce = await idx1Row();
    record('STEP 5a: bouncing ONE of two valid idx1 receipts does not reverse idx1 (other still valid)',
      dAfterFirstBounce.status === 'demanded' && dAfterFirstBounce.due_date != null,
      JSON.stringify({ status: dAfterFirstBounce.status, due_date: dAfterFirstBounce.due_date }));

    const bounceSecond = await fetch(`${API}/payments/receipts/${secondReceiptId}/bounce`, {
      method: 'PATCH', headers, body: JSON.stringify({ reason: 'step5 bounce 2 of 2' }),
    });
    if (!bounceSecond.ok) throw new Error('bounce second receipt failed: ' + JSON.stringify(await bounceSecond.json()));

    const dAfterBothBounced = await idx1Row();
    const step5bPass = dAfterBothBounced.status === 'pending' && dAfterBothBounced.due_date === null &&
      dAfterBothBounced.raised_at === null && dAfterBothBounced.delivery_status === 'pending';
    record('STEP 5b: after BOTH valid idx1 receipts bounced, idx1 fully reverses', step5bPass,
      JSON.stringify(dAfterBothBounced));

    // Independently verify bounce_penalty demand row(s) exist and were NOT touched by reversal.
    const penaltyRows = await db.query(
      `SELECT id, installment_index, demand_type, status, due_date, created_at FROM demands
       WHERE payment_plan_id=$1 AND demand_type='bounce_penalty' ORDER BY created_at ASC`,
      [planId]
    );
    if (penaltyRows.rows.length === 0) {
      record('STEP 5c: bounce_penalty demand row(s) present and unaffected by reversal', false, 'no bounce_penalty rows found — cannot verify scoping');
    } else {
      const allPenaltyIntact = penaltyRows.rows.every(p => p.status === 'pending' && p.due_date != null);
      record('STEP 5c: bounce_penalty demand row(s) present, status=pending with their own due_date, untouched by idx1 reversal',
        allPenaltyIntact, JSON.stringify(penaltyRows.rows));
    }

    // ── STEP 6: replacement receipt in a DIFFERENT calendar month ──
    const r6 = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 1,
        amountReceivedInr: 5000, paymentDate: '2027-01-09', paymentMode: 'neft',
      }),
    });
    const r6Json = await r6.json();
    if (!r6.ok) throw new Error('replacement (different month) receipt failed: ' + JSON.stringify(r6Json));
    const replacementReceiptId = r6Json.data.id;
    receiptIds.push(replacementReceiptId);

    const d6 = await idx1Row();
    const step6Pass = d6.status === 'demanded' && localDate(d6.due_date) === '2027-01-09';
    record('STEP 6: clean re-trigger with a receipt dated a genuinely different calendar month/year', step6Pass,
      JSON.stringify({ status: d6.status, due_date: d6.due_date }));

    // ── STEP 7: hold on a NON-idx1 installment must not touch idx1 ──
    const beforeHold = await idx1Row();
    const rHold = await fetch(`${API}/payments/receipts`, {
      method: 'POST', headers,
      body: JSON.stringify({
        consumerId, paymentPlanId: planId, installmentIndex: 2,
        amountReceivedInr: 8000, paymentDate: '2027-01-10', paymentMode: 'cheque',
        chequeNo: 'INDEPHOLD001', chequeDate: '2027-01-10', bankName: 'Indep Test Bank',
      }),
    });
    const rHoldJson = await rHold.json();
    if (!rHold.ok) throw new Error('idx2 hold-test receipt creation failed: ' + JSON.stringify(rHoldJson));
    const holdReceiptId = rHoldJson.data.id;
    receiptIds.push(holdReceiptId);

    const holdRes = await fetch(`${API}/payments/receipts/${holdReceiptId}/hold`, {
      method: 'PATCH', headers, body: JSON.stringify({ hold_remark: 'independent reverify hold test' }),
    });
    const holdJson = await holdRes.json();
    if (!holdRes.ok) throw new Error('hold failed: ' + JSON.stringify(holdJson));

    const afterHold = await idx1Row();
    const step7Pass = afterHold.status === beforeHold.status &&
      String(afterHold.due_date) === String(beforeHold.due_date) &&
      String(afterHold.raised_at) === String(beforeHold.raised_at);
    record('STEP 7: hold on idx2 (non-idx1) receipt has zero interaction with idx1 state', step7Pass,
      JSON.stringify({ before: beforeHold, after: afterHold }));

    await fetch(`${API}/payments/receipts/${holdReceiptId}/release-hold`, { method: 'PATCH', headers, body: JSON.stringify({}) });

    // ── STEP 8: 6 real historical bookings still untouched — fresh independent query ──
    const names = ['Vipin Kumar Singh', 'Sunil Naraine', 'Aman Verma', 'Aashu Singh', 'Mayank Kumar', 'Sangeeta Bansal'];
    let allHistoricalOk = true;
    const historicalDetail = [];
    for (const n of names) {
      const cons = await db.query(`SELECT id FROM consumers WHERE name ILIKE $1 LIMIT 1`, ['%' + n.split(' ').pop() + '%']);
      if (cons.rows.length === 0) { allHistoricalOk = false; historicalDetail.push(`${n}: NOT FOUND`); continue; }
      const cid = cons.rows[0].id;
      const idx1 = await db.query(
        `SELECT status, due_date, raised_at FROM demands WHERE consumer_id=$1 AND installment_index=1 AND demand_type='installment' LIMIT 1`,
        [cid]
      );
      if (idx1.rows.length === 0) { allHistoricalOk = false; historicalDetail.push(`${n}: no idx1 demand found`); continue; }
      historicalDetail.push(`${n}: idx1.status=${idx1.rows[0].status} due_date=${idx1.rows[0].due_date} raised_at=${idx1.rows[0].raised_at}`);
    }
    record('STEP 8: 6 real historical bookings still present and readable (fresh, independent query)', allHistoricalOk, historicalDetail.join(' | '));

    console.log('\n=== INDEPENDENT REVERIFY COMPLETE ===');
    console.log(JSON.stringify({ consumerId, planId, receiptIds }));
  } catch (err) {
    record('UNCAUGHT ERROR', false, err.message);
  } finally {
    // ── STEP 9: cleanup ──
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
      const strayReceipts = await db.query(`SELECT count(*) FROM receipts WHERE consumer_id=$1`, [consumerId]);
      record('STEP 9: cleanup complete, zero pollution', strayCheck.rows.length === 0 && Number(strayReceipts.rows[0].count) === 0,
        `stray consumer rows=${strayCheck.rows.length} stray receipt rows=${strayReceipts.rows[0].count}`);
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
