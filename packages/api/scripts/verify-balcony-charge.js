// Independent verification tool for the Balcony Charge GST-inclusive
// paise-reconciliation formula (booking.ts's single write-point).
//
// This script does NOT import booking.ts or any of its calculation code.
// It re-derives the expected base/CGST/SGST split from scratch in plain
// JS, reads charge_master_config and gst_tax_charge_mapping directly via
// raw SQL (independent of gst-resolver.ts), creates real bookings through
// the running HTTP API, and compares EXPECTED vs ACTUAL paisa-for-paisa.
//
// Run whenever the balcony rate, cap, or a project's GST mapping changes
// and the write-point's output needs re-verifying end-to-end:
//   cd packages/api && node scripts/verify-balcony-charge.js [area ...]
// Requires: a running local API server (default http://localhost:3001)
// and a .env with DATABASE_URL / JWT_SECRET (loaded from cwd).
require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000002';
const token = jwt.sign(
  { userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'testuser@rof.com', role: 'super_admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Independently re-derived here, NOT imported from booking.ts.
function computeExpected(area, rate, cap, cgstPct, sgstPct) {
  const rawExact = area * rate;
  const rawInclusivePaise = Math.round((cap != null ? Math.min(rawExact, cap) : rawExact) * 100);
  const gstPct = cgstPct + sgstPct;
  let basePaise, cgstPaise, sgstPaise;
  if (gstPct > 0) {
    basePaise = Math.floor(rawInclusivePaise / (1 + gstPct));
    const totalTaxPaise = rawInclusivePaise - basePaise;
    if (cgstPct === sgstPct) {
      cgstPaise = Math.floor(totalTaxPaise / 2);
      sgstPaise = totalTaxPaise - cgstPaise;
    } else {
      cgstPaise = Math.round(totalTaxPaise * (cgstPct / gstPct));
      sgstPaise = totalTaxPaise - cgstPaise;
    }
  } else {
    basePaise = rawInclusivePaise;
    cgstPaise = 0;
    sgstPaise = 0;
  }
  return {
    rawInclusivePaise,
    base: basePaise / 100,
    cgst: cgstPaise / 100,
    sgst: sgstPaise / 100,
  };
}

async function findOrCreateUnitWithBalcony(area) {
  const existing = await pool.query(
    `SELECT id, unit_number FROM units WHERE balcony_area_sqft = $1 AND status = 'available' LIMIT 1`,
    [area]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Create a throwaway test unit with the exact target balcony area.
  const id = crypto.randomUUID();
  const unitNumber = `IVERIFY-${area}`.replace(/\./g, '_');
  await pool.query(
    `INSERT INTO units (id, project_id, tower_id, unit_number, bhk_type, floor, carpet_area_sqft, balcony_area_sqft, base_price_inr, status)
     VALUES ($1, $2, 'b0000000-0000-0000-0000-000000000004', $3, '2BHK', 1, 500, $4, 2500000, 'available')`,
    [id, PROJECT_ID, unitNumber, area]
  );
  return { id, unit_number: unitNumber };
}

async function runTest(area) {
  console.log(`\n=== Testing balcony area = ${area} sqft ===`);

  // Step 2: live config read
  const configRow = await pool.query(
    `SELECT rate_value, cap_value FROM charge_master_config WHERE charge_key = 'balcony_charge'`
  );
  const rate = parseFloat(configRow.rows[0].rate_value);
  const cap = configRow.rows[0].cap_value != null ? parseFloat(configRow.rows[0].cap_value) : null;
  console.log(`Live config: rate=${rate}, cap=${cap}`);

  // Step 3: raw independent GST query (not via gst-resolver.ts)
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
  if (gstRow.rows.length === 0) {
    console.log('NO GST MAPPING FOUND for project -- aborting this test case');
    return null;
  }
  const cgstPct = parseFloat(gstRow.rows[0].cgst_pct) / 100;
  const sgstPct = parseFloat(gstRow.rows[0].sgst_pct) / 100;
  console.log(`Live GST (raw query): cgstPct=${cgstPct}, sgstPct=${sgstPct}`);

  // Step 4: EXPECTED, computed fresh in this script
  const expected = computeExpected(area, rate, cap, cgstPct, sgstPct);
  console.log('EXPECTED:', JSON.stringify(expected));

  // Step 5: create real unit + consumer + booking through the actual API
  const unit = await findOrCreateUnitWithBalcony(area);
  const cid = crypto.randomUUID();
  const mobile = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  await pool.query(
    `INSERT INTO consumers (id, name, first_name, last_name, mobile, email, nationality)
     VALUES ($1, $2, $2, 'IndepVerify', $3, $4, NULL)`,
    [cid, `IndepVerify${area}`, mobile, `${mobile}@example.com`]
  );

  const bookingRes = await fetch('http://localhost:3001/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      consumer_id: cid, unit_id: unit.id, project_id: PROJECT_ID,
      selected_plan_name: 'CLP@92', basic_price: 5000, carpet_area_sqft: 500
    })
  });
  const bookingJson = await bookingRes.json();
  const bookingId = bookingJson.data?.id;
  if (!bookingId) {
    console.log('BOOKING CREATE FAILED', bookingRes.status, JSON.stringify(bookingJson));
    return { area, unit, cid, bookingId: null, expected, actual: null };
  }
  await pool.query(`UPDATE booking_records SET basic_rate_inr_sqft = 5000 WHERE id = $1`, [bookingId]);

  const patchRes = await fetch(`http://localhost:3001/api/booking/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      booking_amount: 500000, payment_mode: 'cheque',
      payment_ref: `IVERIFY-${mobile}`, bank_name: 'Test Bank'
    })
  });
  const patchJson = await patchRes.json();
  if (patchRes.status !== 200) {
    console.log('PATCH FAILED', patchRes.status, JSON.stringify(patchJson));
    return { area, unit, cid, bookingId, expected, actual: null };
  }

  // Step 6: read ACTUAL stored values directly
  const actualRow = await pool.query(
    `SELECT balcony_charge_amount, balcony_cgst_amount, balcony_sgst_amount, balcony_rate_applied_inr_sqft
     FROM booking_records WHERE id = $1`,
    [bookingId]
  );
  const actual = {
    base: parseFloat(actualRow.rows[0].balcony_charge_amount),
    cgst: parseFloat(actualRow.rows[0].balcony_cgst_amount),
    sgst: parseFloat(actualRow.rows[0].balcony_sgst_amount),
    rateApplied: parseFloat(actualRow.rows[0].balcony_rate_applied_inr_sqft),
  };
  console.log('ACTUAL:', JSON.stringify(actual));

  const basePass = actual.base === expected.base;
  const cgstPass = actual.cgst === expected.cgst;
  const sgstPass = actual.sgst === expected.sgst;
  const sumExpected = Math.round((expected.base + expected.cgst + expected.sgst) * 100);
  const sumActual = Math.round((actual.base + actual.cgst + actual.sgst) * 100);
  const sumPass = sumActual === expected.rawInclusivePaise && sumExpected === expected.rawInclusivePaise;

  console.log(`base:  expected=${expected.base} actual=${actual.base} -> ${basePass ? 'PASS' : 'FAIL'}`);
  console.log(`cgst:  expected=${expected.cgst} actual=${actual.cgst} -> ${cgstPass ? 'PASS' : 'FAIL'}`);
  console.log(`sgst:  expected=${expected.sgst} actual=${actual.sgst} -> ${sgstPass ? 'PASS' : 'FAIL'}`);
  console.log(`sum===rawInclusive: ${sumActual} === ${expected.rawInclusivePaise} -> ${sumPass ? 'PASS' : 'FAIL'}`);

  return {
    area, unit, cid, bookingId, expected, actual,
    basePass, cgstPass, sgstPass, sumPass,
    allPass: basePass && cgstPass && sgstPass && sumPass
  };
}

async function cleanup(results) {
  console.log('\n=== CLEANUP ===');
  for (const r of results) {
    if (!r) continue;
    if (r.cid) {
      await pool.query(`DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE consumer_id = $1)`, [r.cid]);
      await pool.query(`DELETE FROM documents WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM receipts WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM demands WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM payment_plans WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM allocations WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM booking_payment_taxes WHERE booking_record_id IN (SELECT id FROM booking_records WHERE consumer_id = $1)`, [r.cid]);
      await pool.query(`DELETE FROM booking_records WHERE consumer_id = $1`, [r.cid]);
      await pool.query(`DELETE FROM consumers WHERE id = $1`, [r.cid]);
    }
    if (r.unit) {
      await pool.query(`DELETE FROM unit_status_history WHERE unit_id = $1`, [r.unit.id]);
      // If this was a throwaway unit we created (IVERIFY- prefix), delete it entirely.
      if (r.unit.unit_number && r.unit.unit_number.startsWith('IVERIFY-')) {
        await pool.query(`DELETE FROM units WHERE id = $1`, [r.unit.id]);
      } else {
        await pool.query(`UPDATE units SET status = 'available' WHERE id = $1`, [r.unit.id]);
      }
    }
  }
  console.log('cleanup done');
}

(async () => {
  const args = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
  const areas = args.length > 0 ? args : [104.78, 65.09, 76.92];

  const results = [];
  for (const area of areas) {
    const r = await runTest(area);
    results.push(r);
  }

  console.log('\n\n========== SUMMARY TABLE ==========');
  console.log('area      | base (exp/act)          | cgst (exp/act)      | sgst (exp/act)      | sum-check | overall');
  for (const r of results) {
    if (!r || !r.actual) {
      console.log(`${r ? r.area : '?'}      | BOOKING FAILED -- see log above`);
      continue;
    }
    console.log(
      `${String(r.area).padEnd(9)} | ${String(r.expected.base).padEnd(10)}/${String(r.actual.base).padEnd(10)} | ` +
      `${String(r.expected.cgst).padEnd(8)}/${String(r.actual.cgst).padEnd(8)} | ` +
      `${String(r.expected.sgst).padEnd(8)}/${String(r.actual.sgst).padEnd(8)} | ` +
      `${r.sumPass ? 'PASS' : 'FAIL'}      | ${r.allPass ? 'PASS' : 'FAIL'}`
    );
  }

  await cleanup(results);
  await pool.end();
})();
