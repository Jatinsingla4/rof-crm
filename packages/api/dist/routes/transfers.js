"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
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
        // 2. Clear old consumer's allocation
        await client.query(`UPDATE consumers SET allocated_unit_id = NULL, lead_stage = 'transferred' WHERE id = $1`, [oldConsumerId]);
        // 3. Assign unit to new consumer
        await client.query(`UPDATE consumers SET allocated_unit_id = $1, lead_stage = 'allotted' WHERE id = $2`, [unitId, newConsumerId]);
        // 4. Update the allocation record status
        await client.query(`UPDATE allocations SET status = 'transferred' WHERE unit_id = $1 AND consumer_id = $2`, [unitId, oldConsumerId]);
        // 5. Create new allocation record for new consumer
        await client.query(`INSERT INTO allocations (consumer_id, unit_id, project_id, status, created_by_user_id)
       SELECT $1, $2, project_id, 'allotted', $3 FROM units WHERE id = $2`, [newConsumerId, unitId, req.userId]);
        // 6. Log the transfer event
        const transferRes = await client.query(`INSERT INTO ownership_transfers (
         unit_id, old_consumer_id, new_consumer_id,
         transfer_fee_inr, admin_charges_inr, transfer_remarks, created_by_user_id,
         transfer_no, application_date, transfer_type, transfer_amount_inr,
         stax_amount, cgst_amount, sgst_amount, igst_amount, ugst_amount,
         basic_price, gstin, broker_company, main_broker, sales_person_name, transfer_receipt_no
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
       ) RETURNING id`, [
            unitId, oldConsumerId, newConsumerId,
            transferFee || 0, adminCharges || 0, remarks || null, req.userId,
            transferNo || null, applicationDate || null, transferType || null, transferAmountInr || 0,
            staxAmount || 0, cgstAmount || 0, sgstAmount || 0, igstAmount || 0, ugstAmount || 0,
            basicPrice || 0, gstin || null, brokerCompany || null, mainBroker || null,
            salesPersonName || null, transferReceiptNo || null
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
exports.default = router;
//# sourceMappingURL=transfers.js.map