"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
function fmtDateIndia(d) {
    if (!d)
        return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime()))
        return String(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
}
function fmtIndianNumber(n) {
    if (!n)
        return '0';
    return Math.round(n).toLocaleString('en-IN');
}
function fmtIndianMoneyDecimal(n) {
    return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const router = (0, express_1.Router)();
/**
 * GET /api/transfers/fee-master?projectId=uuid
 * Returns transfer fee config for a given project.
 */
router.get('/fee-master', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        const result = await index_js_1.db.query(`SELECT * FROM transfer_fee_master WHERE project_id = $1`, [projectId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No fee config for this project' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/transfers/fee-master
 * Upsert transfer fee config for a project.
 */
router.post('/fee-master', async (req, res, next) => {
    try {
        const { projectId, transferFeeInr, adminChargesInr, cgstPct, sgstPct, igstPct, ugstPct, servicetaxPct, isFoc, effectiveFrom } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        const result = await index_js_1.db.query(`INSERT INTO transfer_fee_master
         (project_id, transfer_fee_inr, admin_charges_inr,
          cgst_pct, sgst_pct, igst_pct, ugst_pct,
          service_tax_pct, is_foc, effective_from, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (project_id) DO UPDATE SET
         transfer_fee_inr  = EXCLUDED.transfer_fee_inr,
         admin_charges_inr = EXCLUDED.admin_charges_inr,
         cgst_pct          = EXCLUDED.cgst_pct,
         sgst_pct          = EXCLUDED.sgst_pct,
         igst_pct          = EXCLUDED.igst_pct,
         ugst_pct          = EXCLUDED.ugst_pct,
         service_tax_pct   = EXCLUDED.service_tax_pct,
         is_foc            = EXCLUDED.is_foc,
         effective_from    = EXCLUDED.effective_from,
         updated_at        = now()
       RETURNING *`, [
            projectId,
            transferFeeInr ?? 0,
            adminChargesInr ?? 0,
            cgstPct ?? 0,
            sgstPct ?? 0,
            igstPct ?? 0,
            ugstPct ?? 0,
            servicetaxPct ?? 12.36,
            isFoc ?? false,
            effectiveFrom || null
        ]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/transfers - Initiate Ownership Transfer
 */
router.post('/', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const { unitId, oldConsumerId, newConsumerId, transferFee, adminCharges, remarks, transferNo, applicationDate, transferType, transferAmountInr, staxAmount, cgstAmount, sgstAmount, igstAmount, ugstAmount, basicPrice, gstin, brokerCompany, mainBroker, salesPersonName, transferReceiptNo } = req.body;
        if (!unitId || !oldConsumerId || !newConsumerId) {
            return res.status(400).json({ error: 'unitId, oldConsumerId, and newConsumerId are required' });
        }
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        // 1. Verify old consumer owns the unit
        const unitRes = await client.query(`SELECT allocated_unit_id FROM consumers WHERE id = $1`, [oldConsumerId]);
        if (unitRes.rows.length === 0 || unitRes.rows[0].allocated_unit_id !== unitId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Old consumer does not own this unit' });
        }
        // 2a. Snapshot seller balances before moving any financial records
        const snapRes = await client.query(`SELECT
         COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = $1), 0) AS total_paid,
         COALESCE((SELECT SUM(d.amount_due_inr)      FROM demands d  WHERE d.consumer_id = $1), 0) AS total_due`, [oldConsumerId]);
        const sellerTotalPaid = parseFloat(snapRes.rows[0].total_paid || 0);
        const sellerTotalDue = parseFloat(snapRes.rows[0].total_due || 0);
        const sellerBalance = sellerTotalDue - sellerTotalPaid;
        // 2b. Move demands (before payment_plans so subquery scope still works)
        await client.query(`UPDATE demands
       SET consumer_id = $1, updated_at = NOW()
       WHERE payment_plan_id IN (
         SELECT id FROM payment_plans WHERE consumer_id = $2 AND unit_id = $3
       )`, [newConsumerId, oldConsumerId, unitId]);
        // 2c. Move receipts (before payment_plans for same reason)
        await client.query(`UPDATE receipts
       SET consumer_id = $1, updated_at = NOW()
       WHERE payment_plan_id IN (
         SELECT id FROM payment_plans WHERE consumer_id = $2 AND unit_id = $3
       )`, [newConsumerId, oldConsumerId, unitId]);
        // 2d. Move payment_plans
        await client.query(`UPDATE payment_plans SET consumer_id = $1 WHERE consumer_id = $2 AND unit_id = $3`, [newConsumerId, oldConsumerId, unitId]);
        // 2e. Move booking_records
        await client.query(`UPDATE booking_records SET consumer_id = $1 WHERE consumer_id = $2 AND unit_id = $3`, [newConsumerId, oldConsumerId, unitId]);
        // 2f. Move penal_interests
        await client.query(`UPDATE penal_interests SET consumer_id = $1 WHERE consumer_id = $2`, [newConsumerId, oldConsumerId]);
        // 2g. Move interest_waivers
        await client.query(`UPDATE interest_waivers SET consumer_id = $1 WHERE consumer_id = $2`, [newConsumerId, oldConsumerId]);
        // 2h. Move consumer_addon_charges
        await client.query(`UPDATE consumer_addon_charges SET consumer_id = $1 WHERE consumer_id = $2`, [newConsumerId, oldConsumerId]);
        // 2. Clear old consumer's allocation
        await client.query(`UPDATE consumers SET allocated_unit_id = NULL, lead_stage = 'transferred' WHERE id = $1`, [oldConsumerId]);
        // 3. Assign unit to new consumer
        await client.query(`UPDATE consumers SET allocated_unit_id = $1, lead_stage = 'allotted' WHERE id = $2`, [unitId, newConsumerId]);
        // 4. Update the allocation record status
        await client.query(`UPDATE allocations SET status = 'transferred' WHERE unit_id = $1 AND consumer_id = $2`, [unitId, oldConsumerId]);
        // 5. Create new allocation record for new consumer
        await client.query(`INSERT INTO allocations (consumer_id, unit_id, project_id, status, created_by_user_id)
       SELECT $1, $2, project_id, 'allotted', $3 FROM units WHERE id = $2`, [newConsumerId, unitId, req.userId]);
        // 6. Log the transfer event (includes snapshotted seller balances)
        const transferRes = await client.query(`INSERT INTO ownership_transfers (
         unit_id, old_consumer_id, new_consumer_id,
         transfer_fee_inr, admin_charges_inr, transfer_remarks, created_by_user_id,
         transfer_no, application_date, transfer_type, transfer_amount_inr,
         stax_amount, cgst_amount, sgst_amount, igst_amount, ugst_amount,
         basic_price, gstin, broker_company, main_broker, sales_person_name, transfer_receipt_no,
         seller_total_paid_inr, seller_total_due_inr, seller_balance_inr
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
         $23,$24,$25
       ) RETURNING id`, [
            unitId, oldConsumerId, newConsumerId,
            transferFee || 0, adminCharges || 0, remarks || null, req.userId,
            transferNo || null, applicationDate || null, transferType || null, transferAmountInr || 0,
            staxAmount || 0, cgstAmount || 0, sgstAmount || 0, igstAmount || 0, ugstAmount || 0,
            basicPrice || 0, gstin || null, brokerCompany || null, mainBroker || null,
            salesPersonName || null, transferReceiptNo || null,
            sellerTotalPaid, sellerTotalDue, sellerBalance
        ]);
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: transferRes.rows[0] });
    }
    catch (error) {
        await client.query('ROLLBACK');
        next(error);
    }
    finally {
        client.release();
    }
});
/**
 * GET /api/transfers/list?projectId=&search=&page=&pageSize=
 * Paginated transfer list with seller/buyer names, unit, project details.
 */
router.get('/list', async (req, res, next) => {
    try {
        const { projectId, search, page, pageSize } = req.query;
        const pg = Math.max(1, parseInt(page || '1', 10));
        const ps = Math.max(1, Math.min(200, parseInt(pageSize || '20', 10)));
        const offset = (pg - 1) * ps;
        const conditions = [];
        const params = [];
        let idx = 1;
        if (projectId) {
            conditions.push(`u.project_id = $${idx++}`);
            params.push(projectId);
        }
        if (search) {
            const s = `%${search}%`;
            conditions.push(`(oc.name ILIKE $${idx} OR nc.name ILIKE $${idx} OR u.unit_number ILIKE $${idx} OR t.transfer_no ILIKE $${idx})`);
            params.push(s);
            idx++;
        }
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const countRes = await index_js_1.db.query(`SELECT COUNT(*)::int as total
       FROM ownership_transfers t
       JOIN consumers oc ON t.old_consumer_id = oc.id
       JOIN consumers nc ON t.new_consumer_id = nc.id
       JOIN units u ON t.unit_id = u.id
       JOIN projects p ON p.id = u.project_id
       ${where}`, params);
        const dataRes = await index_js_1.db.query(`SELECT
         t.id, t.transfer_no, t.application_date, t.transfer_date,
         t.transfer_type, t.transfer_amount_inr, t.transfer_fee_inr, t.admin_charges_inr,
         t.stax_amount, t.cgst_amount, t.sgst_amount, t.igst_amount, t.ugst_amount,
         t.basic_price, t.gstin, t.broker_company, t.main_broker,
         t.sales_person_name, t.transfer_receipt_no, t.transfer_remarks,
         oc.id as seller_id, oc.name as seller_name, oc.registration_no as seller_reg_no,
         nc.id as buyer_id, nc.name as buyer_name,
         u.id as unit_id, u.unit_number, u.bhk_type,
         p.id as project_id, p.name as project_name
       FROM ownership_transfers t
       JOIN consumers oc ON t.old_consumer_id = oc.id
       JOIN consumers nc ON t.new_consumer_id = nc.id
       JOIN units u ON t.unit_id = u.id
       JOIN projects p ON p.id = u.project_id
       ${where}
       ORDER BY t.transfer_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`, [...params, ps, offset]);
        res.json({ success: true, data: dataRes.rows, total: countRes.rows[0].total });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/transfers/history/:unitId - Get ownership history for a unit
 */
router.get('/history/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const result = await index_js_1.db.query(`SELECT t.*,
              oc.name as old_consumer_name, nc.name as new_consumer_name,
              u.unit_number
       FROM ownership_transfers t
       JOIN consumers oc ON t.old_consumer_id = oc.id
       JOIN consumers nc ON t.new_consumer_id = nc.id
       JOIN units u ON t.unit_id = u.id
       WHERE t.unit_id = $1
       ORDER BY t.transfer_date DESC`, [unitId]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/transfers/unit-owner/:unitId
 * Returns current active owner of a unit plus unit/project details.
 */
router.get('/unit-owner/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        if (!unitId) {
            return res.status(400).json({ error: 'unitId is required' });
        }
        const result = await index_js_1.db.query(`SELECT
         c.id, c.name, c.first_name, c.last_name,
         c.salutation, c.registration_no, c.mobile,
         c.pan_no, c.aadhaar_no, c.present_address,
         c.present_city, c.present_state, c.present_pin,
         c.applicant_type, c.project_id,
         u.unit_number, u.bhk_type, u.floor,
         u.super_area_sqft, u.base_price_inr,
         a.id as allocation_id, a.allotment_date,
         a.status as allocation_status,
         p.name as project_name,
         COALESCE(
           (SELECT COUNT(*)::int FROM ownership_transfers ot
            WHERE ot.unit_id = $1), 0
         ) as transfer_count
       FROM consumers c
       JOIN allocations a ON a.consumer_id = c.id
       JOIN units u ON u.id = a.unit_id
       JOIN projects p ON p.id = c.project_id
       WHERE a.unit_id = $1
         AND a.status != 'transferred'
       ORDER BY a.created_at DESC
       LIMIT 1`, [unitId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No active owner for this unit' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/transfers/report?projectId=&registrationNo=&firstName=&unitAddress=
 * Returns all units that have been transferred, showing current owner and transfer details.
 */
router.get('/report', async (req, res, next) => {
    try {
        const { projectId, registrationNo, firstName, unitAddress } = req.query;
        const params = [projectId || null];
        const conditions = [];
        let idx = 2;
        if (registrationNo) {
            conditions.push(`c.registration_no ILIKE $${idx++}`);
            params.push(`%${registrationNo}%`);
        }
        if (firstName) {
            conditions.push(`c.name ILIKE $${idx++}`);
            params.push(`%${firstName}%`);
        }
        if (unitAddress) {
            conditions.push(`u.unit_number ILIKE $${idx++}`);
            params.push(`%${unitAddress}%`);
        }
        const extraWhere = conditions.length ? 'AND ' + conditions.join(' AND ') : '';
        const result = await index_js_1.db.query(`SELECT
         c.id as consumer_id,
         COALESCE(
           c.registration_no,
           (SELECT oc.registration_no || 'T' ||
              (SELECT COUNT(*)::text
               FROM ownership_transfers ot2
               WHERE ot2.unit_id = u.id
               AND ot2.created_at <= ot_latest.created_at)
            FROM ownership_transfers ot_latest
            JOIN consumers oc ON oc.id = ot_latest.old_consumer_id
            WHERE ot_latest.unit_id = u.id
            ORDER BY ot_latest.created_at DESC
            LIMIT 1)
         ) as registration_no,
         c.name,
         c.booking_date,
         u.unit_number,
         u.floor,
         u.bhk_type,
         u.super_area_sqft,
         u.base_price_inr,
         a.allotment_date,
         p.name as project_name,
         p.id as project_id,
         br.firm_name as broker_company,
         (SELECT pst2.plan_name
          FROM plan_schedule_templates pst2
          WHERE pst2.project_id = p.id
          ORDER BY pst2.installment_index ASC
          LIMIT 1) as payment_plan,
         (SELECT COUNT(*)::int
          FROM ownership_transfers ot_count
          WHERE ot_count.unit_id = u.id
         ) as no_of_transfers,
         (SELECT MAX(ot3.transfer_date)
          FROM ownership_transfers ot3
          WHERE ot3.unit_id = u.id
         ) as last_transfer_date,
         (SELECT MAX(ot4.created_at)
          FROM ownership_transfers ot4
          WHERE ot4.unit_id = u.id
         ) as last_transfer_at
       FROM consumers c
       JOIN allocations a
         ON a.consumer_id = c.id
         AND a.status = 'allotted'
       JOIN units u ON u.id = a.unit_id
       JOIN projects p ON p.id = u.project_id
       LEFT JOIN brokers br ON br.id = (
         SELECT main_broker_id FROM booking_records
         WHERE consumer_id = c.id
         ORDER BY created_at DESC LIMIT 1
       )
       WHERE EXISTS (
         SELECT 1 FROM ownership_transfers ot
         WHERE ot.unit_id = u.id
       )
       AND ($1::uuid IS NULL OR p.id = $1::uuid)
       ${extraWhere}
       ORDER BY last_transfer_at DESC NULLS LAST`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
const TRANSFER_DETAIL_QUERY = `
  SELECT
    ot.id,
    ot.transfer_no,
    ot.transfer_date,
    ot.application_date,
    ot.transfer_type,
    ot.transfer_amount_inr,
    ot.transfer_fee_inr,
    ot.admin_charges_inr,
    ot.stax_amount,
    ot.cgst_amount,
    ot.sgst_amount,
    ot.igst_amount,
    ot.ugst_amount,
    ot.basic_price,
    ot.gstin,
    ot.broker_company,
    ot.main_broker,
    ot.sales_person_name,
    ot.transfer_receipt_no,
    ot.transfer_remarks,
    oc.id as seller_id,
    oc.name as seller_name,
    oc.registration_no as seller_reg_no,
    oc.pan_no as seller_pan,
    oc.present_address as seller_address,
    oc.present_city as seller_city,
    oc.present_state as seller_state,
    oc.present_pin as seller_pin,
    oc.mobile as seller_mobile,
    oc.email as seller_email,
    nc.id as buyer_id,
    nc.name as buyer_name,
    nc.registration_no as buyer_reg_no,
    nc.pan_no as buyer_pan,
    nc.present_address as buyer_address,
    nc.present_city as buyer_city,
    nc.present_state as buyer_state,
    nc.present_pin as buyer_pin,
    nc.mobile as buyer_mobile,
    nc.email as buyer_email,
    u.id as unit_id,
    u.unit_number,
    u.floor,
    u.bhk_type,
    u.super_area_sqft,
    u.base_price_inr,
    p.id as project_id,
    p.name as project_name,
    p.location as project_location,
    p.rera_number,
    p.authorised_signatory_name,
    p.village_name,
    p.sector_name,
    comp.name as company_name,
    comp.address1 as company_address,
    comp.cin as company_cin,
    comp.gstin as company_gstin,
    comp.phone as company_phone,
    (SELECT pst.plan_name
     FROM plan_schedule_templates pst
     WHERE pst.project_id = p.id
     ORDER BY pst.installment_index ASC
     LIMIT 1) as payment_plan,
    COALESCE(ot.seller_total_paid_inr, 0) AS seller_total_received,
    COALESCE(ot.seller_total_due_inr,  0) AS seller_total_due,
    COALESCE(ot.seller_balance_inr,    0) AS seller_balance,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM ownership_transfers ot2
       WHERE ot2.unit_id = u.id
       AND ot2.created_at <= ot.created_at), 0
    ) as transfer_sequence
  FROM ownership_transfers ot
  JOIN consumers oc ON oc.id = ot.old_consumer_id
  JOIN consumers nc ON nc.id = ot.new_consumer_id
  JOIN units u ON u.id = ot.unit_id
  JOIN projects p ON p.id = u.project_id
  LEFT JOIN companies comp ON comp.id = p.company_id
  WHERE ot.id = $1`;
/**
 * PATCH /api/transfers/:id
 * Updates transfer_date and/or application_date on one transfer record.
 * Must be defined before GET /:id/letter and GET /:id.
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'Transfer id is required' });
        }
        const { transfer_date, application_date } = req.body;
        const result = await index_js_1.db.query(`UPDATE ownership_transfers
       SET transfer_date    = COALESCE($2::date, transfer_date),
           application_date = $3::date
       WHERE id = $1
       RETURNING id, transfer_date, application_date`, [id, transfer_date || null, application_date || null]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transfer not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/transfers/:id/letter
 * Returns a printable HTML transfer letter for one transfer record.
 * Must be defined before /:id to avoid Express matching "letter" as the id.
 */
router.get('/:id/letter', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(TRANSFER_DETAIL_QUERY, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Transfer not found' });
        }
        const t = result.rows[0];
        const staxPct = t.stax_amount && Number(t.transfer_fee_inr) > 0
            ? ((Number(t.stax_amount) / Number(t.transfer_fee_inr)) * 100).toFixed(2)
            : '12.36';
        const sellerAddr = [t.seller_address, t.seller_city, t.seller_state, t.seller_pin]
            .filter(Boolean).join(', ');
        const buyerAddr = [t.buyer_address, t.buyer_city, t.buyer_state, t.buyer_pin]
            .filter(Boolean).join(', ');
        const sellerDue = Number(t.seller_total_due || 0);
        const sellerReceived = Number(t.seller_total_received || 0);
        const sellerBalance = sellerDue - sellerReceived;
        const transferFee = Number(t.transfer_fee_inr || 0);
        const staxAmt = Number(t.stax_amount || 0);
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Transfer/Sale Entry Register</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e0e0e0;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    padding: 30px 20px;
    min-height: 100vh;
  }
  .page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 15mm 18mm;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    position: relative;
  }
  h2 {
    text-align: center;
    font-size: 15pt;
    text-decoration: underline;
    margin-bottom: 18px;
    letter-spacing: 0.5px;
  }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .info-table td { padding: 3px 6px; vertical-align: top; font-size: 10.5pt; }
  .info-table .lbl { font-weight: bold; white-space: nowrap; width: 130px; color: #222; }
  .party-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #999; }
  .party-table td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; font-size: 10.5pt; }
  .party-table .lbl { font-weight: bold; width: 170px; background: #f5f5f5; color: #222; }
  .dues-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .dues-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; border: 1px solid #1d3a6e; font-size: 10.5pt; }
  .dues-table td { padding: 5px 8px; border: 1px solid #ccc; font-size: 10.5pt; }
  .dues-table tr:nth-child(even) td { background: #fafafa; }
  .footer { display: flex; justify-content: space-between; margin-top: 50px; font-size: 10.5pt; font-weight: bold; }
  .print-bar { text-align: center; margin-top: 24px; padding-bottom: 10px; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; width: 100%; padding: 10mm 12mm; min-height: unset; }
    .print-bar { display: none; }
  }
</style>
</head>
<body>

<div class="page">

<h2>TRANSFER/SALE ENTRY REGISTER</h2>

<table class="info-table">
  <tr>
    <td class="lbl">Project Name:</td>
    <td><b>${t.project_name || ''}</b></td>
    <td class="lbl">Location:</td>
    <td>${t.project_location || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Unit No.:</td>
    <td>${t.unit_number || ''}</td>
    <td class="lbl">Floor:</td>
    <td>${t.floor || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Tower No.:</td>
    <td></td>
    <td class="lbl">Super Area:</td>
    <td>${t.super_area_sqft ? t.super_area_sqft + ' Sq. Yrd.' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Sale Amount:</td>
    <td>${t.transfer_amount_inr ? fmtIndianMoneyDecimal(Number(t.transfer_amount_inr)) : ''}</td>
    <td class="lbl">Rate Per Sq.Ft.:</td>
    <td>${t.base_price_inr ? fmtIndianMoneyDecimal(Number(t.base_price_inr)) + '/-' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Booking Date:</td>
    <td>${fmtDateIndia(t.application_date)}</td>
    <td class="lbl">Payment Plan:</td>
    <td><b>${t.payment_plan || ''}</b></td>
  </tr>
  <tr>
    <td class="lbl">Date of TRF AG.:</td>
    <td>${fmtDateIndia(t.transfer_date)}</td>
    <td colspan="2"><b>First End: ${t.seller_name || ''} To ${t.buyer_name || ''}</b></td>
  </tr>
</table>

<table class="party-table">
  <tr>
    <td class="lbl">Name of Transferor</td>
    <td>${t.seller_name || ''}</td>
    <td class="lbl">PAN:</td>
    <td>${t.seller_pan || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Address of Transferor</td>
    <td colspan="3">${sellerAddr}</td>
  </tr>
  <tr>
    <td class="lbl">Contact No.</td>
    <td></td>
    <td class="lbl">Mobile</td>
    <td>${t.seller_mobile || ''}</td>
  </tr>
  <tr>
    <td class="lbl">E-Mail Id:</td>
    <td colspan="3">${t.seller_email || ''}</td>
  </tr>
</table>

<table class="party-table">
  <tr>
    <td class="lbl">Name of Transferee</td>
    <td>${t.buyer_name || ''}</td>
    <td class="lbl">PAN:</td>
    <td>${t.buyer_pan || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Address of Transferee</td>
    <td colspan="3">${buyerAddr}</td>
  </tr>
  <tr>
    <td class="lbl">Contact No.</td>
    <td></td>
    <td class="lbl">Mobile</td>
    <td>${t.buyer_mobile || ''}</td>
  </tr>
  <tr>
    <td class="lbl">E-Mail Id:</td>
    <td colspan="3">${t.buyer_email || ''}</td>
  </tr>
</table>

<table class="dues-table">
  <thead>
    <tr>
      <th>Name Of Dues (In Rs.)</th>
      <th>Total Due</th>
      <th>Received</th>
      <th>Balance</th>
      <th>No Dues - CERTIFIED BY (NAME)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Total Amount/Received</td>
      <td>${fmtIndianMoneyDecimal(sellerDue)}</td>
      <td>${fmtIndianMoneyDecimal(sellerReceived)}</td>
      <td>${fmtIndianMoneyDecimal(sellerBalance)}</td>
      <td></td>
    </tr>
    <tr>
      <td>Interest to be paid</td>
      <td>0</td><td>0</td><td>0</td><td></td>
    </tr>
    <tr>
      <td>Transfer Charge</td>
      <td>${fmtIndianMoneyDecimal(transferFee)}</td>
      <td>0</td>
      <td>${fmtIndianMoneyDecimal(transferFee)}</td>
      <td></td>
    </tr>
    <tr>
      <td>Service Tax Till Date</td>
      <td>0</td><td>0</td><td>0</td><td></td>
    </tr>
    <tr>
      <td>Service Tax on Transfer Charge @${staxPct}%</td>
      <td>${fmtIndianMoneyDecimal(staxAmt)}</td>
      <td>0</td>
      <td>${fmtIndianMoneyDecimal(staxAmt)}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <div>Prepared by CRM</div>
  <div>Authorized Signatory</div>
</div>

</div>

<div class="print-bar">
  <button onclick="window.print()"
    style="padding:8px 20px;background:#1d3a6e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:13px;margin-right:8px">Print</button>
  <button onclick="window.close()"
    style="padding:8px 20px;background:#666;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:13px">Close</button>
</div>

</body>
</html>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/transfers/:id
 * Returns full detail for one transfer record.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(TRANSFER_DETAIL_QUERY, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Transfer not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=transfers.js.map