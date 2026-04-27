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
      tower,
      floor,
      unitNumber,
      bhkType,
      carpetAreaSqm,
      superAreaSqm,
      basePriceInr,
      totalPriceInr,
      facing,
      floorPlanUrl,
    } = req.body;

    // Validate required fields
    if (!projectId || !tower || !unitNumber || !bhkType || !totalPriceInr) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO units (
        project_id, tower, floor, unit_number, bhk_type, carpet_area_sqm,
        super_area_sqm, base_price_inr, total_price_inr, facing, floor_plan_url,
        status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'available', $12)
       RETURNING id, unit_number, bhk_type, status, total_price_inr, created_at`,
      [
        projectId,
        tower,
        floor,
        unitNumber,
        bhkType,
        carpetAreaSqm,
        superAreaSqm,
        basePriceInr,
        totalPriceInr,
        facing,
        floorPlanUrl,
        req.userId,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/units - List units with filters
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      projectId,
      tower,
      status,
      bhkType,
      page = 1,
      pageSize = 20,
      sortBy = 'unit_number',
      sortOrder = 'asc',
    } = req.query;

    let query = `SELECT id, project_id, tower, floor, unit_number, bhk_type,
                        carpet_area_sqm, super_area_sqm, total_price_inr, facing,
                        status, allocated_to_consumer_id, created_at
                 FROM units WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (tower) {
      query += ` AND tower = $${params.length + 1}`;
      params.push(tower);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (bhkType) {
      query += ` AND bhk_type = $${params.length + 1}`;
      params.push(bhkType);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(
        `SELECT COUNT(*) FROM units WHERE project_id = $1${tower ? ` AND tower = $2` : ''}`,
        tower ? [projectId, tower] : [projectId]
      ),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: page as number,
        pageSize: pageSize as number,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/:id - Get unit detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, project_id, tower, floor, unit_number, bhk_type, carpet_area_sqm,
              super_area_sqm, base_price_inr, total_price_inr, facing, floor_plan_url,
              status, allocated_to_consumer_id, status_changed_at, created_at
       FROM units WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const unit = result.rows[0];

    // Fetch status history
    const historyResult = await db.query(
      `SELECT previous_status, new_status, changed_by_user_id, reason, created_at
       FROM unit_status_history WHERE unit_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...unit,
        statusHistory: historyResult.rows,
      },
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

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/tower/:projectId - Tower-wise breakdown
router.get('/tower/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT tower,
              COUNT(*) as total_units,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
              COUNT(CASE WHEN status = 'allotted' THEN 1 END) as allotted,
              COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
              COUNT(CASE WHEN status = 'possession_handed_over' THEN 1 END) as possession_handed_over,
              ROUND(100.0 * COUNT(CASE WHEN status = 'allotted' THEN 1 END) / COUNT(*), 2) as fill_percentage
       FROM units
       WHERE project_id = $1
       GROUP BY tower
       ORDER BY tower ASC`,
      [projectId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
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
        await db.query(
          `INSERT INTO units (
            project_id, tower, floor, unit_number, bhk_type, carpet_area_sqm,
            super_area_sqm, base_price_inr, total_price_inr, facing, status, created_by_user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available', $11)`,
          [
            projectId,
            row.tower,
            row.floor,
            row.unitNumber,
            row.bhkType,
            row.carpetAreaSqm,
            row.superAreaSqm,
            row.basePriceInr,
            row.totalPriceInr,
            row.facing,
            req.userId,
          ]
        );
        created++;
      } catch (error: any) {
        skipped++;
        errors.push({
          unitNumber: row.unitNumber,
          reason: error.message.split('\n')[0],
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        created,
        skipped,
        errors,
      },
    });
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
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'possession_handed_over' THEN 1 END) as possession_handed_over,
        COUNT(DISTINCT tower) as total_towers,
        SUM(total_price_inr) as total_project_value_inr,
        ROUND(100.0 * COUNT(CASE WHEN status = 'allotted' THEN 1 END) / COUNT(*), 2) as fill_percentage
       FROM units
       WHERE project_id = $1`,
      [projectId]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
