/**
 * Units Routes - Module A
 * Unit inventory, status management, floor plans, bulk import
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// POST /api/units - Create unit
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      projectId,
      towerId,
      floor,
      unitNumber,
      bhkType,
      carpetAreaSqft,
      superAreaSqft,
      basePriceInr,
      totalPriceInr,
      facing,
      floorPlanUrl,
    } = req.body;

    if (!projectId || !towerId || !unitNumber || !bhkType || !totalPriceInr) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO units (
        project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft,
        super_area_sqft, base_price_inr, total_price_inr, facing, floor_plan_url,
        status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available', $12)
       RETURNING id, unit_number, bhk_type, status, total_price_inr, created_at`,
      [projectId, towerId, floor, unitNumber, bhkType, carpetAreaSqft, superAreaSqft,
       basePriceInr, totalPriceInr, facing, floorPlanUrl, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/units - List units with filters
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, towerId, status, bhkType, page = 1, pageSize = 200 } = req.query;

    let query = `SELECT u.id, u.project_id, p.name as project_name,
                        u.tower_id, t.tower_name,
                        u.floor, u.unit_number, u.bhk_type,
                        u.carpet_area_sqft, u.super_area_sqft, u.total_price_inr,
                        u.base_price_inr, u.facing, u.status, u.created_at
                 FROM units u
                 JOIN towers t ON u.tower_id = t.id
                 JOIN projects p ON u.project_id = p.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND u.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (towerId) {
      query += ` AND u.tower_id = $${params.length + 1}`;
      params.push(towerId);
    }
    if (status) {
      query += ` AND u.status::text = $${params.length + 1}`;
      params.push(status);
    }
    if (bhkType) {
      query += ` AND u.bhk_type = $${params.length + 1}`;
      params.push(bhkType);
    }

    query += ` ORDER BY t.tower_name, u.floor, u.unit_number`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/tower/:projectId - Tower-wise breakdown
router.get('/tower/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT t.tower_name,
              COUNT(*) as total_units,
              COUNT(CASE WHEN u.status::text = 'available' THEN 1 END) as available,
              COUNT(CASE WHEN u.status::text = 'allotted' THEN 1 END) as allotted,
              COUNT(CASE WHEN u.status::text = 'possession_handed_over' THEN 1 END) as possession_handed_over,
              ROUND(100.0 * COUNT(CASE WHEN u.status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as fill_percentage
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       WHERE u.project_id = $1
       GROUP BY t.id, t.tower_name
       ORDER BY t.tower_name ASC`,
      [projectId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/inventory-summary/:projectId - Project inventory summary
router.get('/inventory-summary/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN status::text = 'possession_handed_over' THEN 1 END) as possession_handed_over,
        COUNT(DISTINCT tower_id) as total_towers,
        SUM(total_price_inr) as total_project_value_inr,
        ROUND(100.0 * COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as fill_percentage
       FROM units
       WHERE project_id = $1`,
      [projectId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/projects - List all distinct projects (must be before /:id)
router.get('/projects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, name, rera_number, tcp_licence, location, land_area_sqft, total_units, created_at
       FROM projects
       ORDER BY name ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/:id - Get unit detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.project_id, p.name as project_name,
              u.tower_id, t.tower_name,
              u.floor, u.unit_number, u.bhk_type,
              u.carpet_area_sqft, u.super_area_sqft, u.base_price_inr,
              u.total_price_inr, u.facing, u.floor_plan_url,
              u.status, u.status_changed_at, u.created_at
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       JOIN projects p ON u.project_id = p.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const historyResult = await db.query(
      `SELECT previous_status, new_status, changed_by_user_id, reason, changed_at
       FROM unit_status_history WHERE unit_id = $1
       ORDER BY changed_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: { ...result.rows[0], statusHistory: historyResult.rows },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/units/:id - Update unit details
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { floor, facing, floorPlanUrl, basePriceInr, totalPriceInr } = req.body;

    const result = await db.query(
      `UPDATE units
       SET floor = COALESCE($1, floor),
           facing = COALESCE($2, facing),
           floor_plan_url = COALESCE($3, floor_plan_url),
           base_price_inr = COALESCE($4, base_price_inr),
           total_price_inr = COALESCE($5, total_price_inr),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, unit_number, bhk_type, status, total_price_inr, updated_at`,
      [floor, facing, floorPlanUrl, basePriceInr, totalPriceInr, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/units/bulk-import - Bulk import units from CSV
router.post('/bulk-import', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, rows } = req.body;

    let created = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const row of rows) {
      try {
        // Resolve tower by name — create if doesn't exist
        let towerId = row.towerId;
        if (!towerId && row.tower) {
          const towerRes = await db.query(
            `INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
             ON CONFLICT (project_id, tower_name) DO UPDATE SET tower_name = EXCLUDED.tower_name
             RETURNING id`,
            [projectId, row.tower]
          );
          towerId = towerRes.rows[0].id;
        }

        await db.query(
          `INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type,
            carpet_area_sqft, super_area_sqft, base_price_inr, total_price_inr, facing,
            status, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available', $11)
           ON CONFLICT (tower_id, unit_number) DO NOTHING`,
          [projectId, towerId, row.floor, row.unitNumber, row.bhkType,
           row.carpetAreaSqft || row.carpetAreaSqm, row.superAreaSqft || row.superAreaSqm,
           row.basePriceInr, row.totalPriceInr, row.facing, req.userId]
        );
        created++;
      } catch (error: any) {
        skipped++;
        errors.push({ unitNumber: row.unitNumber, reason: error.message.split('\n')[0] });
      }
    }

    res.json({ success: true, data: { totalRows: rows.length, created, skipped, errors } });
  } catch (error) {
    next(error);
  }
});

export default router;
