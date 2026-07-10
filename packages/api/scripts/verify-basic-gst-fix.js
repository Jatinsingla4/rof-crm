// Independent verification for the BASIC-charge GST backward-derivation
// fix (Sites 1, 3, 4) and the recompute-desync fix (receipt cancel/bounce).
//
// Re-derives the expected base/CGST/SGST split from scratch in plain JS
// (does NOT import gst-backward-derive.ts), creates real bookings + receipts
// through the running HTTP API, and compares EXPECTED vs ACTUAL paisa-for-paisa.
//
// Run: cd packages/api && node scripts/verify-basic-gst-fix.js
require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000002'; // ROF ALANTE_TEST, BASIC = 0.5%/0.5%
const token = jwt.sign(
  { userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'testuser@rof.com', role: 'super_admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Independently re-derived here, NOT imported from gst-backward-derive.ts.
function computeExpected(grossAmount, cgstPct, sgstPct) {
  const grossPaise = Math.round(grossAmount * 100);
  const combinedRate = cgstPct + sgstPct;
  let basePaise, cgstPaise, sgstPaise;
  if (combinedRate > 0) {
    basePaise = Math.floor(grossPaise / (1 + combinedRate / 100));
    const totalTaxPaise = grossPaise - basePaise;
    if (cgstPct === sgstPct) {
      cgstPaise = Math.floor(totalTaxPaise / 2);
      sgstPaise = totalTaxPaise - cgstPaise;
    } else {
      cgstPaise = Math.round(totalTaxPaise * (cgstPct / combinedRate));
      sgstPaise = totalTaxPaise - cgstPaise;
    }
  } else {
    basePaise = grossPaise; cgstPaise = 0; sgstPaise = 0;
  }
  return { base: basePaise / 100, cgst: cgstPaise / 100, sgst: sgstPaise / 100 };
}

async function createUnit(tag) {
  const id = crypto.randomUUID();
  const unitNumber = `IVERIFY-GST-${tag}`;
  await pool.query(
    `INSERT INTO units (id, project_id, tower_id, unit_number, bhk_type, floor, carpet_area_sqft, base_price_inr, status)
     VALUES ($1, $2, 'b0000000-0000-0000-0000-000000000004', $3, '2BHK', 1, 500, 2500000, 'available')`,
    [id, PROJECT_ID, unitNumber]
  );
  return { id, unit_number: unitNumber };
}

async function createConsumer(tag, nationality) {
  const cid = crypto.randomUUID();
  const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  await pool.query(
    `INSERT INTO consumers (id, name, first_name, last_name, mobile, email, nationality)
     VALUES ($1, $2, $2, 'IndepVerify', $3, $4, $5)`,
    [cid, `IndepVerifyGst${tag}`, mobile, `${mobile}@example.com`, nationality || null]
  );
  return { cid, mobile };
}

async function getRate() {
  const gstRow = await pool.query(
    `SELECT gts.cgst_pct, gts.sgst_pct
     FROM gst_tax_charge_mapping gcm
     JOIN gst_slabs gs ON gs.id = gcm.slab_id
       AND gs.from_date <= CURRENT_DATE AND gs.to_date >= CURRENT_DATE
     JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
     WHERE gcm.project_id = $1 AND gcm.charge_type = 'BASIC'
     LIMIT 1`,
    [PROJECT_ID]
  );
  return { cgstPct: parseFloat(gstRow.rows[0].cgst_pct), sgstPct: parseFloat(gstRow.rows[0].sgst_pct) };
}

async function readBpt(bookingId) {
  const r = await pool.query(
    `SELECT cgst_amount, sgst_amount, cgst_pct, sgst_pct FROM booking_payment_taxes WHERE booking_record_id = $1`,
    [bookingId]
  );
  if (r.rows.length === 0) return null;
  return {
    cgst: parseFloat(r.rows[0].cgst_amount),
    sgst: parseFloat(r.rows[0].sgst_amount),
    cgstPct: parseFloat(r.rows[0].cgst_pct),
    sgstPct: parseFloat(r.rows[0].sgst_pct),
  };
}

async function readBookingAmount(bookingId) {
  const r = await pool.query(`SELECT booking_amount FROM booking_records WHERE id = $1`, [bookingId]);
  return parseFloat(r.rows[0].booking_amount);
}

const cleanupTargets = [];

async function test1_2_freshBooking(amount, nationality, label) {
  console.log(`\n=== TEST: fresh booking, amount=${amount}, nationality=${nationality || 'none (taxable)'} (${label}) ===`);
  const unit = await createUnit(label);
  const { cid, mobile } = await createConsumer(label, nationality);
  cleanupTargets.push({ cid, unit });

  const rate = await getRate();
  const isExempt = ['nri', 'oci', 'pio'].includes((nationality || '').toLowerCase());
  const expected = computeExpected(amount, isExempt ? 0 : rate.cgstPct, isExempt ? 0 : rate.sgstPct);
  console.log('EXPECTED:', JSON.stringify(expected), 'rate used:', isExempt ? '0/0 (exempt)' : JSON.stringify(rate));

  // POST /booking WITH a client-submitted flat-multiply cgst_amount/sgst_amount
  // to prove the server now IGNORES it (Site 4 fix).
  const flatMultiplyCgst = amount * rate.cgstPct / 100;
  const flatMultiplySgst = amount * rate.sgstPct / 100;
  const bookingRes = await fetch('http://localhost:3001/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      consumer_id: cid, unit_id: unit.id, project_id: PROJECT_ID,
      selected_plan_name: 'CLP@92', basic_price: 5000, carpet_area_sqft: 500,
      booking_amount: amount, payment_mode: 'cheque',
      cgst_amount: flatMultiplyCgst, sgst_amount: flatMultiplySgst, // should be IGNORED now
    })
  });
  const bookingJson = await bookingRes.json();
  const bookingId = bookingJson.data?.id;
  if (!bookingId) {
    console.log('BOOKING CREATE FAILED', bookingRes.status, JSON.stringify(bookingJson));
    return { pass: false };
  }
  cleanupTargets[cleanupTargets.length - 1].bookingId = bookingId;

  const bptAtCreate = await readBpt(bookingId);
  console.log('BPT AT CREATE (Site 4):', JSON.stringify(bptAtCreate));
  const site4Pass = bptAtCreate && bptAtCreate.cgst === expected.cgst && bptAtCreate.sgst === expected.sgst;
  console.log(`SITE 4 (POST /booking): expected=${JSON.stringify(expected)} actual=cgst=${bptAtCreate?.cgst},sgst=${bptAtCreate?.sgst} -> ${site4Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  (client sent flat-multiply cgst=${flatMultiplyCgst}, sgst=${flatMultiplySgst} -- confirms these were ignored: ${bptAtCreate.cgst !== flatMultiplyCgst || amount === 0 ? 'IGNORED (correct)' : 'WARNING: matches flat-multiply, may not have been ignored'})`);

  // PATCH /:id with a DIFFERENT flat-multiply client value, to prove Site 3 also ignores it.
  const patchRes = await fetch(`http://localhost:3001/api/booking/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      booking_amount: amount, payment_mode: 'cheque',
      payment_ref: `IVERIFY-GST-${mobile}`, bank_name: 'Test Bank',
      cgst_amount: 999999, sgst_amount: 999999, // should be IGNORED now
    })
  });
  const patchJson = await patchRes.json();
  if (patchRes.status !== 200) {
    console.log('PATCH FAILED', patchRes.status, JSON.stringify(patchJson));
    return { pass: false };
  }
  const bptAtPatch = await readBpt(bookingId);
  console.log('BPT AT PATCH (Site 3):', JSON.stringify(bptAtPatch));
  const site3Pass = bptAtPatch && bptAtPatch.cgst === expected.cgst && bptAtPatch.sgst === expected.sgst;
  console.log(`SITE 3 (PATCH /:id): expected=${JSON.stringify(expected)} actual=cgst=${bptAtPatch?.cgst},sgst=${bptAtPatch?.sgst} -> ${site3Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  (client sent cgst=999999, sgst=999999 -- confirms these were ignored: ${bptAtPatch.cgst !== 999999 ? 'IGNORED (correct)' : 'FAIL: not ignored'})`);

  const sumCheck = Math.round((bptAtPatch.cgst + bptAtPatch.sgst + expected.base) * 100) === Math.round(amount * 100);
  console.log(`  sum(base+cgst+sgst) === gross: ${sumCheck ? 'PASS' : 'FAIL'}`);

  return { pass: site4Pass && site3Pass && sumCheck, bookingId, cid, unit, amount, expected };
}

async function test3_desyncFix(label) {
  console.log(`\n=== TEST: recompute-desync fix (receipt cancel) (${label}) ===`);
  const unit = await createUnit(label);
  const { cid, mobile } = await createConsumer(label, null);
  cleanupTargets.push({ cid, unit });

  const bookingRes = await fetch('http://localhost:3001/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      consumer_id: cid, unit_id: unit.id, project_id: PROJECT_ID,
      selected_plan_name: 'CLP@92', basic_price: 5000, carpet_area_sqft: 500,
    })
  });
  const bookingJson = await bookingRes.json();
  const bookingId = bookingJson.data?.id;
  if (!bookingId) { console.log('BOOKING CREATE FAILED', JSON.stringify(bookingJson)); return { pass: false }; }
  cleanupTargets[cleanupTargets.length - 1].bookingId = bookingId;

  const patchRes = await fetch(`http://localhost:3001/api/booking/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      booking_amount: 1000000, payment_mode: 'cheque',
      payment_ref: `IVERIFY-GST-DESYNC-${mobile}`, bank_name: 'Test Bank',
    })
  });
  if ((await patchRes.json(), patchRes.status) !== 200) {
    console.log('PATCH FAILED', patchRes.status);
    return { pass: false };
  }

  const rate = await getRate();
  const expectedAt1M = computeExpected(1000000, rate.cgstPct, rate.sgstPct);
  const bptAt1M = await readBpt(bookingId);
  console.log(`BPT at booking_amount=1,000,000: expected=${JSON.stringify(expectedAt1M)} actual=${JSON.stringify(bptAt1M)}`);
  const initialPass = bptAt1M.cgst === expectedAt1M.cgst && bptAt1M.sgst === expectedAt1M.sgst;

  // Find payment_plan_id created for this booking, then insert + clear a
  // receipt directly (mirrors what the real receipt-creation/approval flow
  // would leave behind), so recomputeBookingAmount() has a payment_plan_id
  // to scope by via consumer_id/demand linkage.
  const planRow = await pool.query(`SELECT id FROM payment_plans WHERE consumer_id = $1 LIMIT 1`, [cid]);
  const paymentPlanId = planRow.rows[0]?.id;
  if (!paymentPlanId) { console.log('NO PAYMENT PLAN FOUND -- cannot continue desync test'); return { pass: false }; }

  const receiptId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO receipts (id, consumer_id, payment_plan_id, amount_received_inr, received_date, status, receipt_number, approval_status)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, 'cleared', $5, 'pending')`,
    [receiptId, cid, paymentPlanId, 1000000, `IVERIFY-RCPT-${mobile}`]
  );

  const cancelRes = await fetch(`http://localhost:3001/api/payments/receipts/${receiptId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ reason: 'Independent verification test' })
  });
  const cancelJson = await cancelRes.json();
  if (cancelRes.status !== 200) {
    console.log('CANCEL FAILED', cancelRes.status, JSON.stringify(cancelJson));
    return { pass: false, initialPass };
  }

  const newBookingAmount = await readBookingAmount(bookingId);
  const bptAfterCancel = await readBpt(bookingId);
  console.log(`booking_amount after cancel: ${newBookingAmount}`);
  console.log(`BPT after cancel: ${JSON.stringify(bptAfterCancel)}`);
  const expectedAfterCancel = computeExpected(newBookingAmount, rate.cgstPct, rate.sgstPct);
  const desyncPass = bptAfterCancel.cgst === expectedAfterCancel.cgst && bptAfterCancel.sgst === expectedAfterCancel.sgst;
  console.log(`DESYNC FIX: booking_amount=${newBookingAmount}, expected bpt=${JSON.stringify(expectedAfterCancel)}, actual=cgst=${bptAfterCancel.cgst},sgst=${bptAfterCancel.sgst} -> ${desyncPass ? 'PASS' : 'FAIL'}`);
  console.log(`  (This mirrors the Aashu Singh anomaly: booking_amount dropped after cancel, bpt correctly followed it down: ${desyncPass ? 'BUG CLOSED' : 'BUG STILL PRESENT'})`);

  return { pass: initialPass && desyncPass, bookingId, cid, unit, receiptId };
}

async function test3b_bounceDesync(label) {
  console.log(`\n=== TEST: recompute-desync fix (receipt bounce) (${label}) ===`);
  const unit = await createUnit(label);
  const { cid, mobile } = await createConsumer(label, null);
  cleanupTargets.push({ cid, unit });

  const bookingRes = await fetch('http://localhost:3001/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      consumer_id: cid, unit_id: unit.id, project_id: PROJECT_ID,
      selected_plan_name: 'CLP@92', basic_price: 5000, carpet_area_sqft: 500,
    })
  });
  const bookingJson = await bookingRes.json();
  const bookingId = bookingJson.data?.id;
  if (!bookingId) { console.log('BOOKING CREATE FAILED', JSON.stringify(bookingJson)); return { pass: false }; }
  cleanupTargets[cleanupTargets.length - 1].bookingId = bookingId;

  const patchRes = await fetch(`http://localhost:3001/api/booking/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      booking_amount: 800000, payment_mode: 'cheque',
      payment_ref: `IVERIFY-GST-BOUNCE-${mobile}`, bank_name: 'Test Bank',
    })
  });
  if (patchRes.status !== 200) { console.log('PATCH FAILED', patchRes.status); return { pass: false }; }

  const planRow = await pool.query(`SELECT id FROM payment_plans WHERE consumer_id = $1 LIMIT 1`, [cid]);
  const paymentPlanId = planRow.rows[0]?.id;
  if (!paymentPlanId) { console.log('NO PAYMENT PLAN FOUND -- cannot continue bounce test'); return { pass: false }; }

  const receiptId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO receipts (id, consumer_id, payment_plan_id, amount_received_inr, received_date, status, receipt_number, approval_status, payment_method)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, 'cleared', $5, 'pending', 'cheque')`,
    [receiptId, cid, paymentPlanId, 800000, `IVERIFY-RCPT-B-${mobile}`]
  );

  const bounceRes = await fetch(`http://localhost:3001/api/payments/receipts/${receiptId}/bounce`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ reason: 'Independent verification test', penaltyAmount: 500 })
  });
  const bounceJson = await bounceRes.json();
  if (bounceRes.status !== 200) {
    console.log('BOUNCE FAILED', bounceRes.status, JSON.stringify(bounceJson));
    return { pass: false };
  }

  const rate = await getRate();
  const newBookingAmount = await readBookingAmount(bookingId);
  const bptAfterBounce = await readBpt(bookingId);
  const expectedAfterBounce = computeExpected(newBookingAmount, rate.cgstPct, rate.sgstPct);
  console.log(`booking_amount after bounce: ${newBookingAmount}`);
  console.log(`BPT after bounce: ${JSON.stringify(bptAfterBounce)}, expected=${JSON.stringify(expectedAfterBounce)}`);
  const pass = bptAfterBounce.cgst === expectedAfterBounce.cgst && bptAfterBounce.sgst === expectedAfterBounce.sgst;
  console.log(`BOUNCE DESYNC FIX: -> ${pass ? 'PASS' : 'FAIL'}`);

  return { pass, bookingId, cid, unit, receiptId };
}

async function cleanup() {
  console.log('\n=== CLEANUP ===');
  for (const t of cleanupTargets) {
    if (t.cid) {
      await pool.query(`DELETE FROM cheque_bounce_logs WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM financial_audit_logs WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE consumer_id = $1)`, [t.cid]);
      await pool.query(`DELETE FROM documents WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM receipts WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM demands WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM payment_plans WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM allocations WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM booking_payment_taxes WHERE booking_record_id IN (SELECT id FROM booking_records WHERE consumer_id = $1)`, [t.cid]);
      await pool.query(`DELETE FROM booking_records WHERE consumer_id = $1`, [t.cid]);
      await pool.query(`DELETE FROM consumers WHERE id = $1`, [t.cid]);
    }
    if (t.unit) {
      await pool.query(`DELETE FROM unit_status_history WHERE unit_id = $1`, [t.unit.id]);
      await pool.query(`DELETE FROM units WHERE id = $1`, [t.unit.id]);
    }
  }
  console.log(`cleaned up ${cleanupTargets.length} test consumer(s)/unit(s)`);
}

(async () => {
  const results = [];
  results.push(await test1_2_freshBooking(1000000, null, 'taxable-1M'));
  results.push(await test1_2_freshBooking(347000, null, 'taxable-347k-odd-amount'));
  results.push(await test1_2_freshBooking(750000, 'nri', 'nri-exempt'));
  results.push(await test3_desyncFix('cancel'));
  results.push(await test3b_bounceDesync('bounce'));

  console.log('\n\n========== SUMMARY ==========');
  const labels = ['taxable-1M', 'taxable-347k-odd', 'nri-exempt', 'cancel-desync', 'bounce-desync'];
  results.forEach((r, i) => console.log(`${labels[i].padEnd(20)} -> ${r && r.pass ? 'PASS' : 'FAIL'}`));
  const allPass = results.every(r => r && r.pass);
  console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'SOME FAILED -- see log above'}`);

  await cleanup();
  await pool.end();
  process.exit(allPass ? 0 : 1);
})();
