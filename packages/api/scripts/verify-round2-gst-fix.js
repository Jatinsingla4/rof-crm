// Independent verification for Round 2: Site 5 (receipt fallback SQL backward-derive
// for BASIC/Basic-Price GST on receipts with no linked demand) and Site 6
// (buildDetailRows() per-charge-type rate lookup: PLC/EDC/IDC/Other Charge via
// resolveRate(), Interest always 0 GST).
//
// Site 5-A/5-B/5-C SQL is verified by executing the exact query text now committed
// in src/routes/payments.ts and src/routes/consumers.ts directly against the DB
// (these are pure backward-derive SQL with no other app logic) and comparing to an
// independently re-derived expected value.
//
// Site 6 is verified end-to-end via the real HTTP endpoint
// GET /api/payments/receipt-detail/:consumerId (JS logic, calls resolveRate()
// which is DB-backed and async) -- the returned HTML detail-rows table is parsed
// with a regex. This same HTTP call also live-confirms Site 5-B's outer GST total.
//
// Run: cd packages/api && node scripts/verify-round2-gst-fix.js
require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000002'; // ROF ALANTE_TEST -- BASIC 0.5/0.5, PLC 0.5/0.5, OTHER CHARGE 9/9
const token = jwt.sign(
  { userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'testuser@rof.com', role: 'super_admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Independently re-derived, NOT imported from production code.
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
  return { base: basePaise / 100, cgst: cgstPaise / 100, sgst: sgstPaise / 100, totalTaxPaise: grossPaise - basePaise };
}

// Exact SQL fragment now committed at payments.ts (Site 5-A / Site 5-B share this
// shape; consumers.ts Site 5-C omits the NRI CASE, gated in JS instead).
const LATERAL_SQL = `
  LEFT JOIN LATERAL (
    SELECT gts.cgst_pct, gts.sgst_pct
    FROM gst_tax_charge_mapping gcm
    JOIN gst_slabs gs ON gs.id = gcm.slab_id
      AND gs.from_date <= CURRENT_DATE AND gs.to_date >= CURRENT_DATE
    JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
    WHERE gcm.project_id = $2 AND gcm.charge_type = 'BASIC'
    LIMIT 1
  ) grate ON true
  LEFT JOIN LATERAL (
    SELECT
      (ROUND(r.amount_received_inr * 100) -
        FLOOR(ROUND(r.amount_received_inr * 100) / (1 + (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)) / 100.0))
      )::bigint AS total_tax_paise
  ) ttax ON true
  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN COALESCE(grate.cgst_pct,0.5) = COALESCE(grate.sgst_pct,0.5)
          THEN FLOOR(ttax.total_tax_paise / 2.0)
        ELSE ROUND(ttax.total_tax_paise * COALESCE(grate.cgst_pct,0.5) / (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)))
      END::bigint AS cgst_paise
  ) gtax ON true
`;

async function runSite5Sql(receiptId, projectId, nriGateInSql) {
  const cgstExpr = nriGateInSql
    ? `COALESCE(d.cgst_amount, CASE WHEN LOWER(COALESCE(c.nationality,'')) IN ('nri','oci','pio') THEN 0 ELSE gtax.cgst_paise / 100.0 END)`
    : `COALESCE(d.cgst_amount, gtax.cgst_paise / 100.0)`;
  const sgstExpr = nriGateInSql
    ? `COALESCE(d.sgst_amount, CASE WHEN LOWER(COALESCE(c.nationality,'')) IN ('nri','oci','pio') THEN 0 ELSE (ttax.total_tax_paise - gtax.cgst_paise) / 100.0 END)`
    : `COALESCE(d.sgst_amount, (ttax.total_tax_paise - gtax.cgst_paise) / 100.0)`;
  const r = await pool.query(
    `SELECT r.id, r.amount_received_inr, c.nationality,
            ${cgstExpr} AS cgst_amount,
            ${sgstExpr} AS sgst_amount
     FROM receipts r
     JOIN consumers c ON c.id = r.consumer_id
     LEFT JOIN demands d ON d.id = r.demand_id
     ${LATERAL_SQL}
     WHERE r.id = $1`,
    [receiptId, projectId]
  );
  return r.rows[0];
}

async function createUnit(tag) {
  const id = crypto.randomUUID();
  const unitNumber = `IVERIFY-R2-${tag}`;
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
    [cid, `IndepVerifyR2${tag}`, mobile, `${mobile}@example.com`, nationality || null]
  );
  return { cid, mobile };
}

async function getRate(chargeType) {
  const gstRow = await pool.query(
    `SELECT gts.cgst_pct, gts.sgst_pct
     FROM gst_tax_charge_mapping gcm
     JOIN gst_slabs gs ON gs.id = gcm.slab_id
       AND gs.from_date <= CURRENT_DATE AND gs.to_date >= CURRENT_DATE
     JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
     WHERE gcm.project_id = $1 AND gcm.charge_type = $2
     LIMIT 1`,
    [PROJECT_ID, chargeType]
  );
  return { cgstPct: parseFloat(gstRow.rows[0].cgst_pct), sgstPct: parseFloat(gstRow.rows[0].sgst_pct) };
}

const cleanupTargets = [];

async function bookConsumer(tag, nationality) {
  const unit = await createUnit(tag);
  const { cid, mobile } = await createConsumer(tag, nationality);
  cleanupTargets.push({ cid, unit });
  const bookingRes = await fetch('http://localhost:3001/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      consumer_id: cid, unit_id: unit.id, project_id: PROJECT_ID,
      selected_plan_name: 'CLP@92', basic_price: 5000, carpet_area_sqft: 500,
      booking_amount: 100000, payment_mode: 'cheque',
    })
  });
  const bookingJson = await bookingRes.json();
  const bookingId = bookingJson.data?.id;
  if (!bookingId) throw new Error(`BOOKING CREATE FAILED for ${tag}: ${bookingRes.status} ${JSON.stringify(bookingJson)}`);
  cleanupTargets[cleanupTargets.length - 1].bookingId = bookingId;

  // payment_plans is only auto-created on payment confirmation (PATCH), not at POST time.
  const patchRes = await fetch(`http://localhost:3001/api/booking/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      booking_amount: 100000, payment_mode: 'cheque',
      payment_ref: `IVERIFY-R2-${mobile}`, bank_name: 'Test Bank',
    })
  });
  if (patchRes.status !== 200) throw new Error(`PATCH FAILED for ${tag}: ${patchRes.status} ${JSON.stringify(await patchRes.json())}`);

  const planRow = await pool.query(`SELECT id FROM payment_plans WHERE consumer_id = $1 LIMIT 1`, [cid]);
  const paymentPlanId = planRow.rows[0]?.id;
  if (!paymentPlanId) throw new Error(`NO PAYMENT PLAN for ${tag}`);
  return { cid, mobile, unit, bookingId, paymentPlanId };
}

async function insertReceipt(fields) {
  const id = crypto.randomUUID();
  const cols = ['id', ...Object.keys(fields)];
  const vals = [id, ...Object.values(fields)];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `INSERT INTO receipts (${cols.join(', ')}) VALUES (${placeholders})`,
    vals
  );
  return id;
}

// ---- TEST 1: Site 5, odd-total-tax-paise amount, non-NRI ----
async function test1_oddPaiseSplit() {
  console.log('\n=== TEST 1: Site 5 odd-paise paisa-exact split (non-NRI) ===');
  const c = await bookConsumer('T1', null);
  const TEST_AMOUNT = 1247; // amount_received_inr is bigint (whole rupees) -- chosen so total_tax_paise is odd
  const receiptId = await insertReceipt({
    consumer_id: c.cid, payment_plan_id: c.paymentPlanId,
    amount_received_inr: TEST_AMOUNT, received_date: new Date().toISOString().slice(0, 10),
    status: 'cleared', receipt_number: `IVERIFY-R2-T1-${c.mobile}`, payment_method: 'cheque',
  });
  const rate = await getRate('BASIC');
  const expected = computeExpected(TEST_AMOUNT, rate.cgstPct, rate.sgstPct);
  console.log('EXPECTED:', JSON.stringify(expected), 'rate:', JSON.stringify(rate));

  const siteA = await runSite5Sql(receiptId, PROJECT_ID, true);
  const siteC = await runSite5Sql(receiptId, PROJECT_ID, false);
  const passA = parseFloat(siteA.cgst_amount) === expected.cgst && parseFloat(siteA.sgst_amount) === expected.sgst;
  const passC = parseFloat(siteC.cgst_amount) === expected.cgst && parseFloat(siteC.sgst_amount) === expected.sgst;
  const sumCheck = Math.round((parseFloat(siteA.cgst_amount) + parseFloat(siteA.sgst_amount) + expected.base) * 100) === Math.round(TEST_AMOUNT * 100);
  console.log(`Site 5-A/5-B SQL (NRI-gated): cgst=${siteA.cgst_amount} sgst=${siteA.sgst_amount} -> ${passA ? 'PASS' : 'FAIL'}`);
  console.log(`Site 5-C SQL (JS-gated, no CASE): cgst=${siteC.cgst_amount} sgst=${siteC.sgst_amount} -> ${passC ? 'PASS' : 'FAIL'}`);
  console.log(`total_tax_paise=${expected.totalTaxPaise} (odd=${expected.totalTaxPaise % 2 !== 0}), sum(base+cgst+sgst)===gross: ${sumCheck ? 'PASS' : 'FAIL'}`);
  return { pass: passA && passC && sumCheck && expected.totalTaxPaise % 2 !== 0 };
}

// ---- TEST 2: Site 5, genuine NRI consumer ----
async function test2_nriExempt() {
  console.log('\n=== TEST 2: Site 5 NRI exemption (cgst=sgst=0) ===');
  const c = await bookConsumer('T2', 'nri');
  const receiptId = await insertReceipt({
    consumer_id: c.cid, payment_plan_id: c.paymentPlanId,
    amount_received_inr: 500000, received_date: new Date().toISOString().slice(0, 10),
    status: 'cleared', receipt_number: `IVERIFY-R2-T2-${c.mobile}`, payment_method: 'cheque',
  });
  const siteA = await runSite5Sql(receiptId, PROJECT_ID, true); // NRI gate only exists in Site5-A/5-B SQL
  const passA = parseFloat(siteA.cgst_amount) === 0 && parseFloat(siteA.sgst_amount) === 0;
  console.log(`Site 5-A/5-B SQL (nationality=${siteA.nationality}): cgst=${siteA.cgst_amount} sgst=${siteA.sgst_amount} -> ${passA ? 'PASS' : 'FAIL'}`);

  // Site 5-C JS-post-processing gate (mirrors consumers.ts:1286-1290)
  const siteCRaw = await runSite5Sql(receiptId, PROJECT_ID, false);
  let siteCCgst = parseFloat(siteCRaw.cgst_amount), siteCSgst = parseFloat(siteCRaw.sgst_amount);
  if (['nri', 'oci', 'pio'].includes((siteCRaw.nationality || '').toLowerCase())) { siteCCgst = 0; siteCSgst = 0; }
  const passC = siteCCgst === 0 && siteCSgst === 0;
  console.log(`Site 5-C (SQL + JS post-process gate): cgst=${siteCCgst} sgst=${siteCSgst} -> ${passC ? 'PASS' : 'FAIL'}`);
  return { pass: passA && passC };
}

// ---- Detail-row HTML parser for /receipt-detail/:consumerId ----
function parseDetailRows(html) {
  const rowRe = /<tr>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/g;
  const rows = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    rows.push({ installmentName: m[1].trim(), head: m[2].trim(), amount: m[3].trim(), cgst: m[4].trim(), sgst: m[5].trim(), net: m[6].trim() });
  }
  return rows;
}

// ---- TEST 3: Site 6, PLC + Other Charge + Interest, non-NRI ----
async function test3_site6Rates() {
  console.log('\n=== TEST 3: Site 6 buildDetailRows real rates (non-NRI) ===');
  const c = await bookConsumer('T3', null);
  await insertReceipt({
    consumer_id: c.cid, payment_plan_id: c.paymentPlanId,
    amount_received_inr: 300000, plc_amount: 10000, other_charge_amount: 20000, interest_amount: 5000,
    other_charge_desc: 'Other Charge', received_date: new Date().toISOString().slice(0, 10),
    status: 'cleared', receipt_number: `IVERIFY-R2-T3-${c.mobile}`, payment_method: 'cheque',
  });
  const html = await (await fetch(`http://localhost:3001/api/payments/receipt-detail/${c.cid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })).text();
  const rows = parseDetailRows(html);
  const plcRow = rows.find(r => r.head === 'PLC');
  const otherRow = rows.find(r => r.head === 'Other Charge');
  const interestRow = rows.find(r => r.head === 'Interest');
  const plcRate = await getRate('PLC');
  const otherRate = await getRate('OTHER CHARGE');
  const expPlcCgst = (10000 * plcRate.cgstPct / 100).toFixed(2);
  const expPlcSgst = (10000 * plcRate.sgstPct / 100).toFixed(2);
  const expOtherCgst = (20000 * otherRate.cgstPct / 100).toFixed(2);
  const expOtherSgst = (20000 * otherRate.sgstPct / 100).toFixed(2);
  console.log('PLC row:', JSON.stringify(plcRow), 'expected cgst/sgst:', expPlcCgst, expPlcSgst, `(rate ${plcRate.cgstPct}/${plcRate.sgstPct})`);
  console.log('Other Charge row:', JSON.stringify(otherRow), 'expected cgst/sgst:', expOtherCgst, expOtherSgst, `(rate ${otherRate.cgstPct}/${otherRate.sgstPct})`);
  console.log('Interest row:', JSON.stringify(interestRow), 'expected cgst/sgst: 0.00 0.00');
  const passPlc = plcRow && plcRow.cgst === expPlcCgst && plcRow.sgst === expPlcSgst;
  const passOther = otherRow && otherRow.cgst === expOtherCgst && otherRow.sgst === expOtherSgst;
  const passInterest = interestRow && interestRow.cgst === '0.00' && interestRow.sgst === '0.00';
  const notHardcoded9pct = plcRow && plcRow.cgst !== (10000 * 0.09).toFixed(2);
  console.log(`PLC uses real rate (not 9% hardcode): ${notHardcoded9pct ? 'PASS' : 'FAIL'}`);
  return { pass: passPlc && passOther && passInterest && notHardcoded9pct, consumerId: c.cid };
}

// ---- TEST 4: Site 6, same scenario, genuine NRI consumer ----
async function test4_site6Nri() {
  console.log('\n=== TEST 4: Site 6 buildDetailRows NRI exemption (all non-interest 0/0) ===');
  const c = await bookConsumer('T4', 'oci');
  await insertReceipt({
    consumer_id: c.cid, payment_plan_id: c.paymentPlanId,
    amount_received_inr: 300000, plc_amount: 10000, other_charge_amount: 20000, interest_amount: 5000,
    other_charge_desc: 'Other Charge', received_date: new Date().toISOString().slice(0, 10),
    status: 'cleared', receipt_number: `IVERIFY-R2-T4-${c.mobile}`, payment_method: 'cheque',
  });
  const html = await (await fetch(`http://localhost:3001/api/payments/receipt-detail/${c.cid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })).text();
  const rows = parseDetailRows(html);
  const basicRow = rows.find(r => r.head === 'Basic Price');
  const plcRow = rows.find(r => r.head === 'PLC');
  const otherRow = rows.find(r => r.head === 'Other Charge');
  const interestRow = rows.find(r => r.head === 'Interest');
  console.log('Basic Price row:', JSON.stringify(basicRow));
  console.log('PLC row:', JSON.stringify(plcRow));
  console.log('Other Charge row:', JSON.stringify(otherRow));
  console.log('Interest row:', JSON.stringify(interestRow));
  const allZero = [basicRow, plcRow, otherRow, interestRow].every(r => r && r.cgst === '0.00' && r.sgst === '0.00');
  console.log(`ALL rows 0/0 for NRI (oci) consumer: ${allZero ? 'PASS' : 'FAIL'}`);
  return { pass: allZero };
}

// ---- TEST 5/6: regression -- real demand-linked receipt untouched ----
async function test5_demandLinkedRegression() {
  console.log('\n=== TEST 5/6: regression -- demand-linked receipt unaffected ===');
  const real = await pool.query(
    `SELECT r.id, r.consumer_id, d.cgst_amount AS d_cgst, d.sgst_amount AS d_sgst, p.id AS project_id
     FROM receipts r
     JOIN demands d ON d.id = r.demand_id
     JOIN payment_plans pp ON pp.id = r.payment_plan_id
     JOIN projects p ON p.id = pp.project_id
     WHERE r.status != 'cancelled' LIMIT 1`
  );
  if (real.rows.length === 0) { console.log('NO real demand-linked receipt found -- SKIP'); return { pass: true, skipped: true }; }
  const row = real.rows[0];
  const siteResult = await runSite5Sql(row.id, row.project_id, true);
  const pass = parseFloat(siteResult.cgst_amount) === parseFloat(row.d_cgst) && parseFloat(siteResult.sgst_amount) === parseFloat(row.d_sgst);
  console.log(`Real receipt ${row.id}: demand cgst/sgst=${row.d_cgst}/${row.d_sgst}, new-SQL output=${siteResult.cgst_amount}/${siteResult.sgst_amount} -> ${pass ? 'PASS (unchanged)' : 'FAIL (regression!)'}`);
  return { pass };
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

  // VERIFY-7: confirm zero pollution
  const leftover = await pool.query(
    `SELECT count(*)::int AS n FROM consumers WHERE name LIKE 'IndepVerifyR2%'
     UNION ALL
     SELECT count(*)::int FROM units WHERE unit_number LIKE 'IVERIFY-R2-%'
     UNION ALL
     SELECT count(*)::int FROM receipts WHERE receipt_number LIKE 'IVERIFY-R2-%'`
  );
  const totalLeftover = leftover.rows.reduce((a, r) => a + r.n, 0);
  console.log(`VERIFY-7 pollution check: ${totalLeftover === 0 ? 'PASS (zero pollution)' : `FAIL (${totalLeftover} rows left over)`}`);
  return totalLeftover === 0;
}

(async () => {
  const results = [];
  try {
    results.push(['TEST1 odd-paise split', await test1_oddPaiseSplit()]);
    results.push(['TEST2 NRI exempt (Site 5)', await test2_nriExempt()]);
    results.push(['TEST3 Site 6 real rates', await test3_site6Rates()]);
    results.push(['TEST4 Site 6 NRI exempt', await test4_site6Nri()]);
    results.push(['TEST5/6 demand-linked regression', await test5_demandLinkedRegression()]);
  } catch (err) {
    console.error('\nFATAL ERROR during tests:', err);
  }

  console.log('\n\n========== SUMMARY ==========');
  results.forEach(([label, r]) => console.log(`${label.padEnd(35)} -> ${r && r.pass ? 'PASS' : 'FAIL'}`));
  const allPass = results.length > 0 && results.every(([, r]) => r && r.pass);
  console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'SOME FAILED -- see log above'}`);

  const cleanPass = await cleanup();
  await pool.end();
  process.exit(allPass && cleanPass ? 0 : 1);
})();
