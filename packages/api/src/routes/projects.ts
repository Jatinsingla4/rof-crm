/**
 * Projects Routes
 * Project CRUD, tower management, unit locations, rate reports
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location,
              p.land_area_sqft, p.total_units, p.group_name, p.possession_date, p.created_at,
              COUNT(DISTINCT t.id) as tower_count,
              COUNT(DISTINCT u.id) as unit_count,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'available') as available_units,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'allotted') as allotted_units
       FROM projects p
       LEFT JOIN towers t ON p.id = t.project_id
       LEFT JOIN units u ON p.id = u.project_id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, reraNumber, tcpLicence, location, landAreaSqft, totalUnits,
            possessionDate, incomeCategory } = req.body;

    if (!name || !reraNumber || !tcpLicence) {
      return res.status(400).json({ error: 'name, reraNumber, and tcpLicence are required' });
    }

    const result = await db.query(
      `INSERT INTO projects (name, rera_number, tcp_licence, location, land_area_sqft, total_units,
                             group_name, possession_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, rera_number, tcp_licence, location, group_name, possession_date, created_at`,
      [name, reraNumber, tcpLicence, location || null, landAreaSqft || null, totalUnits || null,
       incomeCategory || 'Affordable', possessionDate || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/reports/rates — rate report (MUST be before /:id)
router.get('/reports/rates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
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
  } catch (err) { next(err); }
});

// GET /api/projects/:id/plan-templates
router.get('/:id/plan-templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planName } = req.query;
    const params: any[] = [req.params.id];
    let extra = '';
    if (planName) { extra = ' AND plan_name = $2'; params.push(planName); }
    const result = await db.query(
      `SELECT * FROM plan_schedule_templates WHERE project_id = $1${extra} ORDER BY installment_index`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/plan-templates
router.post('/:id/plan-templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { plan_name, installment_name, installment_type, percentage, flat_amount_inr,
            due_date_offset_days, installment_index, notes } = req.body;
    if (!installment_name) return res.status(400).json({ error: 'installment_name is required' });

    // Enforce 100% cap — only applies when a percentage is being set
    if (percentage !== null && percentage !== undefined && parseFloat(percentage) > 0) {
      const resolvedPlanName = plan_name || 'Standard AHP Plan';
      const totalResult = await db.query(
        `SELECT COALESCE(SUM(percentage), 0) as current_total
         FROM plan_schedule_templates
         WHERE project_id = $1 AND plan_name = $2`,
        [req.params.id, resolvedPlanName]
      );
      const currentTotal = parseFloat(totalResult.rows[0].current_total);
      const newTotal = currentTotal + parseFloat(percentage);
      if (newTotal > 100) {
        return res.status(400).json({
          success: false,
          error: `Adding ${percentage}% would bring plan total to ${newTotal.toFixed(3)}%. Maximum allowed is 100%. Current total: ${currentTotal.toFixed(3)}%.`
        });
      }
    }

    const result = await db.query(
      `INSERT INTO plan_schedule_templates
         (project_id, plan_name, installment_name, installment_type, percentage,
          flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.id, plan_name || 'Standard AHP Plan', installment_name,
       installment_type || 'installment', percentage || null,
       flat_amount_inr || null, due_date_offset_days || 0,
       installment_index || 1, notes || null, req.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/projects/:id/plan-templates/:itemId
router.patch('/:id/plan-templates/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { installment_name, installment_type, percentage, flat_amount_inr,
            due_date_offset_days, installment_index, notes } = req.body;
    const result = await db.query(
      `UPDATE plan_schedule_templates SET
         installment_name     = COALESCE($1, installment_name),
         installment_type     = COALESCE($2, installment_type),
         percentage           = COALESCE($3, percentage),
         flat_amount_inr      = COALESCE($4, flat_amount_inr),
         due_date_offset_days = COALESCE($5, due_date_offset_days),
         installment_index    = COALESCE($6, installment_index),
         notes                = COALESCE($7, notes),
         updated_at           = NOW()
       WHERE id = $8 AND project_id = $9 RETURNING *`,
      [installment_name || null, installment_type || null, percentage ?? null,
       flat_amount_inr || null, due_date_offset_days ?? null,
       installment_index || null, notes || null,
       req.params.itemId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/plan-templates/:itemId
router.delete('/:id/plan-templates/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.query(
      `DELETE FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`,
      [req.params.itemId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location,
              p.land_area_sqft, p.total_units, p.group_name, p.possession_date, p.created_at
       FROM projects p WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const towers = await db.query(
      `SELECT t.id, t.tower_name, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`,
      [id]
    );

    res.json({ success: true, data: { ...result.rows[0], towers: towers.rows } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, location, totalUnits } = req.body;

    const result = await db.query(
      `UPDATE projects SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         total_units = COALESCE($3, total_units),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, location, total_units, updated_at`,
      [name || null, location || null, totalUnits || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/towers
router.get('/:id/towers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/towers
router.post('/:id/towers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { towerName } = req.body;

    if (!towerName) return res.status(400).json({ error: 'towerName is required' });

    const result = await db.query(
      `INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
       ON CONFLICT (project_id, tower_name) DO UPDATE SET tower_name = EXCLUDED.tower_name
       RETURNING id, tower_name, project_id`,
      [id, towerName]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/towers/:towerId
router.get('/:id/towers/:towerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 AND t.id = $2
       GROUP BY t.id
       LIMIT 1`,
      [req.params.id, req.params.towerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tower not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/towers/:towerId
router.delete('/:id/towers/:towerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitCheck = await db.query(
      `SELECT COUNT(*) as count FROM units WHERE tower_id = $1`,
      [req.params.towerId]
    );
    const unitCount = parseInt(unitCheck.rows[0].count);
    if (unitCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete tower. It has ${unitCount} unit(s) linked to it. Please remove all units first.`
      });
    }
    await db.query(`DELETE FROM towers WHERE id = $1 AND project_id = $2`, [req.params.towerId, req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/payment-plans
router.get('/:id/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
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
       ORDER BY pp.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/unit-locations
router.get('/:id/unit-locations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM unit_locations WHERE project_id = $1 ORDER BY name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/unit-locations
router.post('/:id/unit-locations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await db.query(
      `INSERT INTO unit_locations (project_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name, description || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/unit-locations/:locId
router.delete('/:id/unit-locations/:locId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.query(`DELETE FROM unit_locations WHERE id = $1 AND project_id = $2`, [req.params.locId, req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
