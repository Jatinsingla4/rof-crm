"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// ── Helpers ──────────────────────────────────────────────────────────────────
async function getPaymentPlanInfo(client, consumerId, projectId) {
    const res = await client.query(`SELECT pp.id AS payment_plan_id,
            br.selected_plan_name AS plan_name
     FROM booking_records br
     JOIN payment_plans pp
       ON pp.consumer_id = br.consumer_id
      AND pp.unit_id = br.unit_id
     WHERE br.consumer_id = $1
       AND br.project_id  = $2
       AND br.status != 'cancelled'
     ORDER BY br.created_at DESC
     LIMIT 1`, [consumerId, projectId]);
    if (!res.rows.length)
        return null;
    return {
        paymentPlanId: res.rows[0].payment_plan_id,
        planName: res.rows[0].plan_name,
    };
}
async function recomputeAddonDemands(client, consumerId, projectId, paymentPlanId, planName) {
    await client.query(`UPDATE demands
     SET addon_charge_amount = 0,
         updated_at = NOW()
     WHERE payment_plan_id = $1
       AND status NOT IN ('cancelled')`, [paymentPlanId]);
    const chargesRes = await client.query(`SELECT id, charge_master_id,
            amount + COALESCE(increase_amount, 0) AS effective_amount
     FROM consumer_addon_charges
     WHERE consumer_id = $1
       AND project_id  = $2
       AND status = 'active'`, [consumerId, projectId]);
    if (!chargesRes.rows.length)
        return;
    for (const charge of chargesRes.rows) {
        const pctRes = await client.query(`SELECT pst.installment_index,
              SUM(pacp.pct) AS total_pct
       FROM plan_addon_charge_pct pacp
       JOIN plan_schedule_templates pst
         ON pst.id = pacp.plan_schedule_template_id
       WHERE pst.plan_name        = $1
         AND pacp.charge_master_id = $2
       GROUP BY pst.installment_index`, [planName, charge.charge_master_id]);
        for (const row of pctRes.rows) {
            const addonAmt = Math.round(parseFloat(charge.effective_amount) * parseFloat(row.total_pct) / 100 * 100) / 100;
            if (addonAmt === 0)
                continue;
            await client.query(`UPDATE demands
         SET addon_charge_amount = addon_charge_amount + $1,
             updated_at = NOW()
         WHERE payment_plan_id  = $2
           AND installment_index = $3
           AND status NOT IN ('cancelled')`, [addonAmt, paymentPlanId, row.installment_index]);
        }
    }
}
// ── A: GET /api/addon-charges/master?projectId=uuid ──────────────────────────
router.get('/master', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        if (!projectId)
            return res.status(400).json({ error: 'projectId is required' });
        const result = await index_js_1.db.query(`SELECT * FROM addon_charge_master
       WHERE project_id = $1 AND is_active = true
       ORDER BY charge_name ASC`, [projectId]);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// ── B: POST /api/addon-charges/master ────────────────────────────────────────
router.post('/master', async (req, res, next) => {
    try {
        const { projectId, chargeName, defaultAmount, cgstPct, sgstPct } = req.body;
        if (!projectId || !chargeName) {
            return res.status(400).json({ error: 'projectId and chargeName are required' });
        }
        const result = await index_js_1.db.query(`INSERT INTO addon_charge_master
         (project_id, charge_name, default_amount, cgst_pct, sgst_pct, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            projectId,
            chargeName,
            parseFloat(defaultAmount || 0),
            parseFloat(cgstPct ?? 9),
            parseFloat(sgstPct ?? 9),
            req.userId || null,
        ]);
        return res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// ── C: PATCH /api/addon-charges/master/:id ───────────────────────────────────
router.patch('/master/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { chargeName, defaultAmount, cgstPct, sgstPct, isActive } = req.body;
        const result = await index_js_1.db.query(`UPDATE addon_charge_master SET
         charge_name    = COALESCE($2, charge_name),
         default_amount = COALESCE($3, default_amount),
         cgst_pct       = COALESCE($4, cgst_pct),
         sgst_pct       = COALESCE($5, sgst_pct),
         is_active      = COALESCE($6, is_active),
         updated_at     = now()
       WHERE id = $1
       RETURNING *`, [
            id,
            chargeName || null,
            defaultAmount != null ? parseFloat(defaultAmount) : null,
            cgstPct != null ? parseFloat(cgstPct) : null,
            sgstPct != null ? parseFloat(sgstPct) : null,
            isActive != null ? isActive : null,
        ]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Charge master not found' });
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// ── D: DELETE /api/addon-charges/master/:id (soft delete) ────────────────────
router.delete('/master/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`UPDATE addon_charge_master
       SET is_active = false, updated_at = now()
       WHERE id = $1
       RETURNING id`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Charge master not found' });
        return res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// ── E: GET /api/addon-charges/consumer?consumerId=uuid ───────────────────────
router.get('/consumer', async (req, res, next) => {
    try {
        const { consumerId } = req.query;
        if (!consumerId)
            return res.status(400).json({ error: 'consumerId is required' });
        const result = await index_js_1.db.query(`SELECT cac.*, acm.charge_name AS master_charge_name
       FROM consumer_addon_charges cac
       LEFT JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
       WHERE cac.consumer_id = $1 AND cac.status = 'active'
       ORDER BY cac.effective_date ASC, cac.created_at ASC`, [consumerId]);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// ── F: POST /api/addon-charges/consumer ──────────────────────────────────────
router.post('/consumer', async (req, res, next) => {
    const { consumerId, projectId, chargeMasterId, chargeName, amount, cgstPct, sgstPct, remark, effectiveDate, } = req.body;
    if (!consumerId || !projectId || !chargeName) {
        return res.status(400).json({ error: 'consumerId, projectId and chargeName are required' });
    }
    const amt = parseFloat(amount || 0);
    const cPct = parseFloat(cgstPct ?? 9);
    const sPct = parseFloat(sgstPct ?? 9);
    const amountWithIncrease = amt;
    const cgstAmount = Math.round(amountWithIncrease * cPct / 100 * 100) / 100;
    const sgstAmount = Math.round(amountWithIncrease * sPct / 100 * 100) / 100;
    const totalAmount = amountWithIncrease + cgstAmount + sgstAmount;
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO consumer_addon_charges
         (consumer_id, project_id, charge_master_id,
          charge_name, effective_date, amount,
          increase_amount, cgst_pct, sgst_pct,
          cgst_amount, sgst_amount, total_amount,
          remark, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`, [
            consumerId,
            projectId,
            chargeMasterId || null,
            chargeName,
            effectiveDate || new Date().toISOString().slice(0, 10),
            amt,
            0,
            cPct,
            sPct,
            cgstAmount,
            sgstAmount,
            totalAmount,
            remark || null,
            req.userId || null,
        ]);
        const planInfo = await getPaymentPlanInfo(client, consumerId, projectId);
        if (planInfo) {
            await recomputeAddonDemands(client, consumerId, projectId, planInfo.paymentPlanId, planInfo.planName);
        }
        await client.query('COMMIT');
        return res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
// ── G: PATCH /api/addon-charges/consumer/:id ─────────────────────────────────
router.patch('/consumer/:id', async (req, res, next) => {
    const { id } = req.params;
    const { amount, increaseAmount, remark } = req.body;
    const existing = await index_js_1.db.query(`SELECT consumer_id, project_id, cgst_pct, sgst_pct
     FROM consumer_addon_charges WHERE id = $1`, [id]);
    if (existing.rows.length === 0)
        return res.status(404).json({ error: 'Charge not found' });
    const { consumer_id: consumerId, project_id: projectId } = existing.rows[0];
    const cgstPct = parseFloat(existing.rows[0].cgst_pct);
    const sgstPct = parseFloat(existing.rows[0].sgst_pct);
    const amt = parseFloat(amount || 0);
    const inc = parseFloat(increaseAmount || 0);
    const amountWithIncrease = amt + inc;
    const cgstAmount = Math.round(amountWithIncrease * cgstPct / 100 * 100) / 100;
    const sgstAmount = Math.round(amountWithIncrease * sgstPct / 100 * 100) / 100;
    const totalAmount = amountWithIncrease + cgstAmount + sgstAmount;
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`UPDATE consumer_addon_charges SET
         amount          = $2,
         increase_amount = $3,
         cgst_amount     = $4,
         sgst_amount     = $5,
         total_amount    = $6,
         remark          = COALESCE($7, remark),
         updated_at      = now()
       WHERE id = $1
       RETURNING *`, [id, amt, inc, cgstAmount, sgstAmount, totalAmount, remark || null]);
        const planInfo = await getPaymentPlanInfo(client, consumerId, projectId);
        if (planInfo) {
            await recomputeAddonDemands(client, consumerId, projectId, planInfo.paymentPlanId, planInfo.planName);
        }
        await client.query('COMMIT');
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
// ── H: PATCH /api/addon-charges/consumer/:id/cancel ──────────────────────────
router.patch('/consumer/:id/cancel', async (req, res, next) => {
    const { id } = req.params;
    const existing = await index_js_1.db.query(`SELECT consumer_id, project_id FROM consumer_addon_charges WHERE id = $1`, [id]);
    if (existing.rows.length === 0)
        return res.status(404).json({ error: 'Charge not found' });
    const { consumer_id: consumerId, project_id: projectId } = existing.rows[0];
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`UPDATE consumer_addon_charges SET
         status       = 'cancelled',
         cancelled_at = now(),
         updated_at   = now()
       WHERE id = $1
       RETURNING id, status`, [id]);
        const planInfo = await getPaymentPlanInfo(client, consumerId, projectId);
        if (planInfo) {
            await recomputeAddonDemands(client, consumerId, projectId, planInfo.paymentPlanId, planInfo.planName);
        }
        await client.query('COMMIT');
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
// ── I: PATCH /api/addon-charges/consumer/:id/waive ───────────────────────────
router.patch('/consumer/:id/waive', async (req, res, next) => {
    const { id } = req.params;
    const { waiveRemark } = req.body;
    const existing = await index_js_1.db.query(`SELECT consumer_id, project_id FROM consumer_addon_charges WHERE id = $1`, [id]);
    if (existing.rows.length === 0)
        return res.status(404).json({ error: 'Charge not found' });
    const { consumer_id: consumerId, project_id: projectId } = existing.rows[0];
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(`UPDATE consumer_addon_charges SET
         status       = 'waived',
         waive_remark = $2,
         updated_at   = now()
       WHERE id = $1
       RETURNING id, status`, [id, waiveRemark || null]);
        const planInfo = await getPaymentPlanInfo(client, consumerId, projectId);
        if (planInfo) {
            await recomputeAddonDemands(client, consumerId, projectId, planInfo.paymentPlanId, planInfo.planName);
        }
        await client.query('COMMIT');
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
// ── J: GET /api/addon-charges/consumers?projectId=uuid&... ───────────────────
router.get('/consumers', async (req, res, next) => {
    try {
        const { projectId, towerId, unitType, paymentPlan, registrationNo, name, unitNo } = req.query;
        if (!projectId)
            return res.status(400).json({ error: 'projectId is required' });
        const conditions = ['p.id = $1', 'br.status != \'cancelled\''];
        const params = [projectId];
        let idx = 2;
        if (towerId) {
            conditions.push(`t.id = $${idx++}`);
            params.push(towerId);
        }
        if (unitType) {
            conditions.push(`u.bhk_type ILIKE $${idx++}`);
            params.push(`%${unitType}%`);
        }
        if (paymentPlan) {
            conditions.push(`br.selected_plan_name ILIKE $${idx++}`);
            params.push(`%${paymentPlan}%`);
        }
        if (registrationNo) {
            conditions.push(`c.registration_no ILIKE $${idx++}`);
            params.push(`%${registrationNo}%`);
        }
        if (name) {
            conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
            params.push(`%${name}%`);
            idx++;
        }
        if (unitNo) {
            conditions.push(`u.unit_number ILIKE $${idx++}`);
            params.push(`%${unitNo}%`);
        }
        const where = 'WHERE ' + conditions.join(' AND ');
        const result = await index_js_1.db.query(`SELECT
         c.id AS consumer_id,
         c.first_name,
         c.last_name,
         TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS full_name,
         c.registration_no,
         br.id AS booking_id,
         br.booking_date,
         br.selected_plan_name AS payment_plan,
         u.id AS unit_id,
         u.unit_number,
         u.bhk_type AS unit_type,
         u.super_area_sqft,
         t.tower_name,
         p.name AS project_name,
         COALESCE(
           (SELECT SUM(cac.total_amount)
            FROM consumer_addon_charges cac
            WHERE cac.consumer_id = c.id
            AND cac.status = 'active'), 0
         ) AS addon_total
       FROM consumers c
       JOIN booking_records br ON br.consumer_id = c.id
       JOIN units u ON u.id = br.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
       JOIN projects p ON p.id = br.project_id
       ${where}
       ORDER BY c.registration_no ASC`, params);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=addon-charges.js.map