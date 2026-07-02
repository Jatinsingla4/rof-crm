"use strict";
/**
 * Projects Routes
 * Project CRUD, tower management, unit locations, rate reports
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// GET /api/projects
router.get('/', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location,
              p.land_area_sqft, p.total_units, p.group_name, p.possession_date, p.created_at,
              p.company_id, comp.name AS company_name,
              COUNT(DISTINCT t.id) as tower_count,
              COUNT(DISTINCT u.id) as unit_count,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'available') as available_units,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'allotted') as allotted_units
       FROM projects p
       LEFT JOIN companies comp ON comp.id = p.company_id
       LEFT JOIN towers t ON p.id = t.project_id
       LEFT JOIN units u ON p.id = u.project_id
       GROUP BY p.id, comp.name
       ORDER BY p.created_at DESC`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/projects
router.post('/', async (req, res, next) => {
    try {
        const { name, reraNumber, tcpLicence, location, landAreaSqft, totalUnits, possessionDate, incomeCategory, companyId } = req.body;
        if (!name || !reraNumber || !tcpLicence) {
            return res.status(400).json({ error: 'name, reraNumber, and tcpLicence are required' });
        }
        const result = await index_js_1.db.query(`INSERT INTO projects (name, rera_number, tcp_licence, location, land_area_sqft, total_units,
                             group_name, possession_date, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, rera_number, tcp_licence, location, group_name, possession_date, created_at`, [name, reraNumber, tcpLicence, location || null, landAreaSqft || null, totalUnits || null,
            incomeCategory || 'Affordable', possessionDate || null, companyId || null]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/projects/reports/rates — rate report (MUST be before /:id)
router.get('/reports/rates', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        p.name AS project_name,
        u.bhk_type,
        t.tower_name AS tower,
        COUNT(u.id) AS unit_count,
        MIN(u.base_price_inr) AS min_price,
        MAX(u.base_price_inr) AS max_price,
        ROUND(AVG(u.base_price_inr)) AS avg_price,
        MIN(u.carpet_area_sqft) AS min_carpet,
        MAX(u.carpet_area_sqft) AS max_carpet
      FROM projects p
      JOIN units u ON u.project_id = p.id
      LEFT JOIN towers t ON u.tower_id = t.id
      WHERE u.base_price_inr > 0
      GROUP BY p.id, p.name, u.bhk_type, t.id, t.tower_name
      ORDER BY p.name, u.bhk_type, t.tower_name
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/floors?towerId=
router.get('/:id/floors', async (req, res, next) => {
    try {
        const { towerId } = req.query;
        const params = [req.params.id];
        let extra = '';
        if (towerId) {
            extra = ' AND tower_id = $2';
            params.push(towerId);
        }
        const result = await index_js_1.db.query(`SELECT DISTINCT floor FROM units WHERE project_id = $1${extra} ORDER BY floor ASC`, params);
        res.json({ success: true, data: result.rows.map((r) => r.floor) });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/plan-templates
router.get('/:id/plan-templates', async (req, res, next) => {
    try {
        const { planName } = req.query;
        const params = [req.params.id];
        let extra = '';
        if (planName) {
            extra = ' AND plan_name = $2';
            params.push(planName);
        }
        const result = await index_js_1.db.query(`SELECT * FROM plan_schedule_templates WHERE project_id = $1${extra} ORDER BY installment_index`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/plan-templates
router.post('/:id/plan-templates', async (req, res, next) => {
    try {
        const { plan_name, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes } = req.body;
        if (!installment_name)
            return res.status(400).json({ error: 'installment_name is required' });
        // Enforce 100% cap — only applies when a percentage is being set
        if (percentage !== null && percentage !== undefined && parseFloat(percentage) > 0) {
            const resolvedPlanName = plan_name || 'Standard AHP Plan';
            const totalResult = await index_js_1.db.query(`SELECT COALESCE(SUM(percentage), 0) as current_total
         FROM plan_schedule_templates
         WHERE project_id = $1 AND plan_name = $2`, [req.params.id, resolvedPlanName]);
            const currentTotal = parseFloat(totalResult.rows[0].current_total);
            const newTotal = currentTotal + parseFloat(percentage);
            if (newTotal > 100) {
                return res.status(400).json({
                    success: false,
                    error: `Adding ${percentage}% would bring plan total to ${newTotal.toFixed(3)}%. Maximum allowed is 100%. Current total: ${currentTotal.toFixed(3)}%.`
                });
            }
        }
        const result = await index_js_1.db.query(`INSERT INTO plan_schedule_templates
         (project_id, plan_name, installment_name, installment_type, percentage,
          flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.params.id, plan_name || 'Standard AHP Plan', installment_name,
            installment_type || 'installment', percentage || null,
            flat_amount_inr || null, due_date_offset_days || 0,
            installment_index || 1, notes || null, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/projects/:id/plan-templates/:itemId
router.patch('/:id/plan-templates/:itemId', async (req, res, next) => {
    try {
        const { installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes } = req.body;
        const result = await index_js_1.db.query(`UPDATE plan_schedule_templates SET
         installment_name     = COALESCE($1, installment_name),
         installment_type     = COALESCE($2, installment_type),
         percentage           = COALESCE($3, percentage),
         flat_amount_inr      = COALESCE($4, flat_amount_inr),
         due_date_offset_days = COALESCE($5, due_date_offset_days),
         installment_index    = COALESCE($6, installment_index),
         notes                = COALESCE($7, notes),
         updated_at           = NOW()
       WHERE id = $8 AND project_id = $9 RETURNING *`, [installment_name || null, installment_type || null, percentage ?? null,
            flat_amount_inr || null, due_date_offset_days ?? null,
            installment_index || null, notes || null,
            req.params.itemId, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/plan-templates/:itemId
router.delete('/:id/plan-templates/:itemId', async (req, res, next) => {
    try {
        await index_js_1.db.query(`DELETE FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/plan-templates/:templateId/addon-charges
router.get('/:id/plan-templates/:templateId/addon-charges', async (req, res, next) => {
    try {
        const { templateId } = req.params;
        const result = await index_js_1.db.query(`SELECT
         pacp.id,
         pacp.plan_schedule_template_id,
         pacp.charge_master_id,
         pacp.pct,
         acm.charge_name,
         acm.cgst_pct,
         acm.sgst_pct,
         acm.default_amount
       FROM plan_addon_charge_pct pacp
       JOIN addon_charge_master acm ON acm.id = pacp.charge_master_id
       WHERE pacp.plan_schedule_template_id = $1
       ORDER BY acm.charge_name ASC`, [templateId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/plan-templates/:templateId/addon-charges
// Body: { charge_master_id, pct }
// Upserts. Validates: sum of pct for this charge_master_id across all
// installments in the same plan must not exceed 100.
router.post('/:id/plan-templates/:templateId/addon-charges', async (req, res, next) => {
    try {
        const { id, templateId } = req.params;
        const { charge_master_id, pct } = req.body;
        const userId = req.userId || null;
        const pctNum = parseFloat(pct);
        if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
            return res.status(400).json({ success: false, error: 'pct must be between 0 and 100' });
        }
        const tmplRes = await index_js_1.db.query(`SELECT plan_name, project_id FROM plan_schedule_templates WHERE id = $1`, [templateId]);
        if (!tmplRes.rows.length) {
            return res.status(404).json({ success: false, error: 'Template not found' });
        }
        const { plan_name } = tmplRes.rows[0];
        // Sum pct for this charge type across all other installments in the same plan
        const sumRes = await index_js_1.db.query(`SELECT COALESCE(SUM(pacp.pct), 0) AS current_total
       FROM plan_addon_charge_pct pacp
       JOIN plan_schedule_templates pst ON pst.id = pacp.plan_schedule_template_id
       WHERE pst.plan_name = $1
         AND pst.project_id = $2
         AND pacp.charge_master_id = $3
         AND pacp.plan_schedule_template_id != $4`, [plan_name, id, charge_master_id, templateId]);
        const currentTotal = parseFloat(sumRes.rows[0].current_total);
        if (currentTotal + pctNum > 100) {
            return res.status(400).json({
                success: false,
                error: `Total percentage for this charge type would exceed 100% (current: ${currentTotal}%, adding: ${pctNum}%)`
            });
        }
        const result = await index_js_1.db.query(`INSERT INTO plan_addon_charge_pct
         (plan_schedule_template_id, charge_master_id, pct, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (plan_schedule_template_id, charge_master_id)
       DO UPDATE SET pct = EXCLUDED.pct, updated_at = NOW()
       RETURNING *`, [templateId, charge_master_id, pctNum, userId]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/plan-templates/:templateId/addon-charges/:chargeId
router.delete('/:id/plan-templates/:templateId/addon-charges/:chargeId', async (req, res, next) => {
    try {
        const { chargeId } = req.params;
        await index_js_1.db.query(`DELETE FROM plan_addon_charge_pct WHERE id = $1`, [chargeId]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/plan-addon-pcts?planName=CLP@92
// Returns all addon pcts for all installments in a plan (used by Stage 2 demand creation)
router.get('/:id/plan-addon-pcts', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { planName } = req.query;
        const result = await index_js_1.db.query(`SELECT
         pacp.plan_schedule_template_id,
         pacp.charge_master_id,
         pacp.pct,
         pst.installment_index,
         acm.charge_name,
         acm.cgst_pct,
         acm.sgst_pct
       FROM plan_addon_charge_pct pacp
       JOIN plan_schedule_templates pst ON pst.id = pacp.plan_schedule_template_id
       JOIN addon_charge_master acm ON acm.id = pacp.charge_master_id
       WHERE pst.project_id = $1
         AND pst.plan_name = $2
       ORDER BY pst.installment_index, acm.charge_name`, [id, planName]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT * FROM projects WHERE id = $1`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Project not found' });
        const towers = await index_js_1.db.query(`SELECT t.id, t.tower_name, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`, [id]);
        res.json({ success: true, data: { ...result.rows[0], towers: towers.rows } });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/projects/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, location, totalUnits, licenseDate, envClearanceNo, envClearanceDate, buildingPlanMemoNo, buildingPlanDate, collaborationAgreementDate, landOwnerName, landOwnerLlpin, landOwnerPan, landOwnerAddress, landOwnerGpaVasikaNo, landOwnerGpaDate, saleDeedNo, saleDeedDate, occupationCertMemoNo, occupationCertDate, deedOfDeclarationVasikaNo, deedOfDeclarationDate, khasraDetails, villageName, sectorName, subRegistrarOffice, authorisedSignatoryName, authorisedSignatoryAadhaar, boardResolutionDate, companyId, } = req.body;
        const result = await index_js_1.db.query(`UPDATE projects SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         total_units = COALESCE($3, total_units),
         license_date = COALESCE($4::date, license_date),
         env_clearance_no = COALESCE($5, env_clearance_no),
         env_clearance_date = COALESCE($6::date, env_clearance_date),
         building_plan_memo_no = COALESCE($7, building_plan_memo_no),
         building_plan_date = COALESCE($8::date, building_plan_date),
         collaboration_agreement_date = COALESCE($9::date, collaboration_agreement_date),
         land_owner_name = COALESCE($10, land_owner_name),
         land_owner_llpin = COALESCE($11, land_owner_llpin),
         land_owner_pan = COALESCE($12, land_owner_pan),
         land_owner_address = COALESCE($13, land_owner_address),
         land_owner_gpa_vasika_no = COALESCE($14, land_owner_gpa_vasika_no),
         land_owner_gpa_date = COALESCE($15::date, land_owner_gpa_date),
         sale_deed_no = COALESCE($16, sale_deed_no),
         sale_deed_date = COALESCE($17::date, sale_deed_date),
         occupation_cert_memo_no = COALESCE($18, occupation_cert_memo_no),
         occupation_cert_date = COALESCE($19::date, occupation_cert_date),
         deed_of_declaration_vasika_no = COALESCE($20, deed_of_declaration_vasika_no),
         deed_of_declaration_date = COALESCE($21::date, deed_of_declaration_date),
         khasra_details = COALESCE($22, khasra_details),
         village_name = COALESCE($23, village_name),
         sector_name = COALESCE($24, sector_name),
         sub_registrar_office = COALESCE($25, sub_registrar_office),
         authorised_signatory_name = COALESCE($26, authorised_signatory_name),
         authorised_signatory_aadhaar = COALESCE($27, authorised_signatory_aadhaar),
         board_resolution_date = COALESCE($28::date, board_resolution_date),
         company_id = COALESCE($29::uuid, company_id),
         updated_at = NOW()
       WHERE id = $30
       RETURNING *`, [
            name || null,
            location || null,
            totalUnits ? parseInt(totalUnits) : null,
            licenseDate || null,
            envClearanceNo || null,
            envClearanceDate || null,
            buildingPlanMemoNo || null,
            buildingPlanDate || null,
            collaborationAgreementDate || null,
            landOwnerName || null,
            landOwnerLlpin || null,
            landOwnerPan || null,
            landOwnerAddress || null,
            landOwnerGpaVasikaNo || null,
            landOwnerGpaDate || null,
            saleDeedNo || null,
            saleDeedDate || null,
            occupationCertMemoNo || null,
            occupationCertDate || null,
            deedOfDeclarationVasikaNo || null,
            deedOfDeclarationDate || null,
            khasraDetails || null,
            villageName || null,
            sectorName || null,
            subRegistrarOffice || null,
            authorisedSignatoryName || null,
            authorisedSignatoryAadhaar || null,
            boardResolutionDate || null,
            companyId || null,
            id
        ]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/projects/:id/towers
router.get('/:id/towers', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`, [req.params.id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/towers
router.post('/:id/towers', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { towerName } = req.body;
        if (!towerName)
            return res.status(400).json({ error: 'towerName is required' });
        const result = await index_js_1.db.query(`INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
       ON CONFLICT (project_id, tower_name) DO UPDATE SET tower_name = EXCLUDED.tower_name
       RETURNING id, tower_name, project_id`, [id, towerName]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/projects/:id/towers/:towerId
router.get('/:id/towers/:towerId', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 AND t.id = $2
       GROUP BY t.id
       LIMIT 1`, [req.params.id, req.params.towerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tower not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/towers/:towerId
router.delete('/:id/towers/:towerId', async (req, res, next) => {
    try {
        const unitCheck = await index_js_1.db.query(`SELECT COUNT(*) as count FROM units WHERE tower_id = $1`, [req.params.towerId]);
        const unitCount = parseInt(unitCheck.rows[0].count);
        if (unitCount > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete tower. It has ${unitCount} unit(s) linked to it. Please remove all units first.`
            });
        }
        await index_js_1.db.query(`DELETE FROM towers WHERE id = $1 AND project_id = $2`, [req.params.towerId, req.params.id]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/payment-plans
router.get('/:id/payment-plans', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT
         pp.id,
         pp.total_amount_inr AS total_amount,
         pp.created_at,
         u.unit_number,
         c.name AS consumer_name,
         c.mobile,
         COALESCE(paid.total_paid, 0) AS total_paid,
         pp.total_amount_inr - COALESCE(paid.total_paid, 0) AS outstanding,
         CASE
           WHEN pp.total_amount_inr = 0 THEN 'active'
           WHEN COALESCE(paid.total_paid, 0) >= pp.total_amount_inr THEN 'completed'
           ELSE 'active'
         END AS status
       FROM payment_plans pp
       LEFT JOIN units u ON u.id = pp.unit_id
       LEFT JOIN consumers c ON c.id = pp.consumer_id
       LEFT JOIN (
         SELECT payment_plan_id, SUM(amount_received_inr) AS total_paid
         FROM receipts
         GROUP BY payment_plan_id
       ) paid ON paid.payment_plan_id = pp.id
       WHERE pp.project_id = $1
       ORDER BY pp.created_at DESC`, [req.params.id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/unit-locations
router.get('/:id/unit-locations', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT * FROM unit_locations WHERE project_id = $1 ORDER BY name`, [req.params.id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/unit-locations
router.post('/:id/unit-locations', async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const result = await index_js_1.db.query(`INSERT INTO unit_locations (project_id, name, description) VALUES ($1, $2, $3) RETURNING *`, [req.params.id, name, description || null]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/unit-locations/:locId
router.delete('/:id/unit-locations/:locId', async (req, res, next) => {
    try {
        await index_js_1.db.query(`DELETE FROM unit_locations WHERE id = $1 AND project_id = $2`, [req.params.locId, req.params.id]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=projects.js.map