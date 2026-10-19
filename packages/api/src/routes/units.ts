/**
 * Units Routes - Module A
 * Unit inventory, status management, floor plans, bulk import
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { applyUnitStatusFilter } from '../middleware/unitStatusAccess.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { cleanBody, badNumber } from './master.js';

const router = Router();

// POST /api/units - Create unit
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      projectId,
      towerId,
      floor,
      bhkType,
      carpetAreaSqft,
      superAreaSqft,
      balconyAreaSqft,
      basePriceInr,
      totalPriceInr,
      facing,
      floorPlanUrl,
      unitTypeId,
    } = req.body;
    const cleaned = cleanBody(req.body, ['unitNumber']);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const { unitNumber } = cleaned.values;

    if (!projectId || !towerId || !unitNumber || !bhkType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (floor === undefined || floor === null || floor === '') {
      return res.status(400).json({ error: 'Floor number is required for each unit' });
    }
    const numberError = badNumber(req.body, ['carpetAreaSqft', 'superAreaSqft', 'balconyAreaSqft', 'basePriceInr', 'totalPriceInr']);
    if (numberError) return res.status(400).json({ error: numberError });
    const tower = await db.query('SELECT 1 FROM towers WHERE id = $1 AND project_id = $2', [towerId, projectId]);
    if (!tower.rows.length) return res.status(400).json({ error: 'This tower does not belong to the selected project' });
    if (unitTypeId) {
      const ut = await db.query('SELECT 1 FROM unit_types WHERE id = $1 AND project_id = $2', [unitTypeId, projectId]);
      if (!ut.rows.length) return res.status(400).json({ error: 'This unit type does not belong to the selected project' });
    }

    const result = await db.query(
      `INSERT INTO units (
        project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft,
        super_area_sqft, balcony_area_sqft,
        base_price_inr, total_price_inr, facing, floor_plan_url,
        status, created_by_user_id, unit_type_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available', $13, $14)
       RETURNING id, unit_number, bhk_type, status, total_price_inr, created_at`,
      [projectId, towerId, floor, unitNumber, bhkType, carpetAreaSqft, superAreaSqft,
       balconyAreaSqft || null,
       basePriceInr, totalPriceInr, facing, floorPlanUrl, req.userId, unitTypeId || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A unit with this number already exists in this tower. Please use a different unit number.'
      });
    }
    next(error);
  }
});

// GET /api/units - List units with filters
router.get('/', applyUnitStatusFilter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, towerId, status, bhkType, consumerName, registrationNo, page = 1, pageSize = 200 } = req.query;

    const innerParams: any[] = [];
    let innerWhere = `WHERE 1=1`;

    if (projectId) {
      innerParams.push(projectId);
      innerWhere += ` AND u.project_id = $${innerParams.length}`;
    }
    if (towerId) {
      innerParams.push(towerId);
      innerWhere += ` AND u.tower_id = $${innerParams.length}`;
    }
    if (status) {
      innerParams.push(status);
      innerWhere += ` AND u.status::text = $${innerParams.length}`;
    }
    if (bhkType && bhkType !== 'any') {
      // Pattern matching: frontend sends "3BHK", database has "Type-A (3 BHK)"
      const bhkStr = String(bhkType);
      innerParams.push(bhkStr);
      innerParams.push(`%${bhkStr.replace(/(\d)(BHK)/i, '$1 $2')}%`);
      innerWhere += ` AND (u.bhk_type = $${innerParams.length - 1} OR u.bhk_type ILIKE $${innerParams.length})`;
    }
    if (consumerName) {
      innerParams.push(`%${consumerName}%`);
      const idx = innerParams.length;
      innerWhere += ` AND (c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`;
    }
    if (registrationNo) {
      innerParams.push(`%${registrationNo}%`);
      innerWhere += ` AND c.registration_no ILIKE $${innerParams.length}`;
    }

    if (req.unitStatusFilter !== null && req.unitStatusFilter !== undefined) {
      const placeholders = req.unitStatusFilter.map((_, i) => `$${innerParams.length + i + 1}`).join(', ');
      innerWhere += ` AND u.status::text IN (${placeholders})`;
      innerParams.push(...req.unitStatusFilter);
    }

    const innerQuery = `
      SELECT DISTINCT ON (u.id)
        u.id, u.project_id, p.name as project_name,
        u.tower_id, t.tower_name, t.tower_name AS tower,
        u.floor, u.unit_number, u.bhk_type,
        u.carpet_area_sqft, u.super_area_sqft, u.total_price_inr,
        u.base_price_inr, u.facing, u.status, u.created_at,
        u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
        u.registry_date,
        u.hold_status,
        u.status_changed_at,
        c.id AS consumer_id,
        NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '') AS consumer_name,
        c.registration_no,
        a.allotment_date,
        CASE WHEN c.id IS NOT NULL
          THEN COALESCE(bk.firm_name, bk.name, 'Direct')
          ELSE NULL
        END AS broker_name,
        (SELECT br_u.booking_date FROM booking_records br_u
         WHERE br_u.unit_id = u.id ORDER BY br_u.created_at DESC LIMIT 1) AS booking_date,
        (SELECT uh.client_name FROM unit_holds uh
         WHERE uh.unit_id = u.id AND uh.status = 'active' LIMIT 1) AS hold_client,
        (SELECT uh.expires_at FROM unit_holds uh
         WHERE uh.unit_id = u.id AND uh.status = 'active' LIMIT 1) AS hold_expires_at,
        (SELECT ut.name FROM unit_types ut
         WHERE ut.id = u.unit_type_id LIMIT 1) AS unit_group
      FROM units u
      JOIN towers t ON u.tower_id = t.id
      JOIN projects p ON u.project_id = p.id
      LEFT JOIN allocations a ON a.unit_id = u.id
      LEFT JOIN consumers c ON c.id = a.consumer_id
      LEFT JOIN LATERAL (
        SELECT br2.main_broker_id FROM booking_records br2
        WHERE br2.consumer_id = c.id ORDER BY br2.created_at DESC LIMIT 1
      ) br ON true
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      ${innerWhere}
      ORDER BY u.id
    `;

    const query = `SELECT * FROM (${innerQuery}) sub ORDER BY sub.tower_name, sub.floor, sub.unit_number LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;
    const result = await db.query(query, innerParams);
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
      `SELECT
        t.id as tower_id,
        t.tower_name,
        COUNT(*) as total_units,
        ROUND(SUM(u.carpet_area_sqft)::numeric, 4) as total_area,
        COUNT(CASE WHEN u.status = 'available' THEN 1 END) as available_count,
        ROUND(SUM(CASE WHEN u.status = 'available' THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as available_area,
        COUNT(CASE WHEN u.status IN ('application_received','draw_pending','booked') THEN 1 END) as booked_count,
        ROUND(SUM(CASE WHEN u.status IN ('application_received','draw_pending','booked') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as booked_area,
        COUNT(CASE WHEN u.status IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN 1 END) as allotted_count,
        ROUND(SUM(CASE WHEN u.status IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as allotted_area,
        COUNT(CASE WHEN u.status IN ('locked','held') THEN 1 END) as hold_count,
        ROUND(SUM(CASE WHEN u.status IN ('locked','held') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as hold_area,
        COUNT(CASE WHEN u.status = 'temp_surrender' THEN 1 END) as temp_surrender_count,
        ROUND(SUM(CASE WHEN u.status = 'temp_surrender' THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as temp_surrender_area,
        COALESCE(SUM(r_total.received), 0) as received_amount
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(r.amount_received_inr), 0) as received
         FROM allocations a
         JOIN receipts r ON r.consumer_id = a.consumer_id AND r.status != 'cancelled'
         WHERE a.unit_id = u.id
       ) r_total ON true
       WHERE u.project_id = $1
       GROUP BY t.id, t.tower_name
       ORDER BY t.tower_name ASC`,
      [projectId]
    );

    const towers = result.rows;
    const totals = towers.reduce((acc: any, t: any) => {
      acc.total_units       += parseInt(t.total_units)       || 0;
      acc.total_area        += parseFloat(t.total_area)      || 0;
      acc.available_count   += parseInt(t.available_count)   || 0;
      acc.available_area    += parseFloat(t.available_area)  || 0;
      acc.booked_count      += parseInt(t.booked_count)      || 0;
      acc.booked_area       += parseFloat(t.booked_area)     || 0;
      acc.allotted_count    += parseInt(t.allotted_count)    || 0;
      acc.allotted_area     += parseFloat(t.allotted_area)   || 0;
      acc.hold_count        += parseInt(t.hold_count)        || 0;
      acc.hold_area         += parseFloat(t.hold_area)       || 0;
      acc.temp_surrender_count += parseInt(t.temp_surrender_count) || 0;
      acc.temp_surrender_area  += parseFloat(t.temp_surrender_area) || 0;
      acc.received_amount   += parseFloat(t.received_amount) || 0;
      return acc;
    }, { total_units:0, total_area:0, available_count:0, available_area:0,
         booked_count:0, booked_area:0, allotted_count:0, allotted_area:0,
         hold_count:0, hold_area:0, temp_surrender_count:0, temp_surrender_area:0,
         received_amount:0 });

    totals.unmapped_count = totals.total_units - (
      totals.available_count + totals.booked_count + totals.allotted_count +
      totals.hold_count + totals.temp_surrender_count
    );

    res.json({ success: true, towers, totals });
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
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available_count,
        COUNT(CASE WHEN status::text IN ('application_received','draw_pending','booked') THEN 1 END) as booked_count,
        COUNT(CASE WHEN status::text IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN 1 END) as allotted_count,
        COUNT(CASE WHEN status::text IN ('locked','held') THEN 1 END) as hold_count,
        COUNT(CASE WHEN status::text = 'temp_surrender' THEN 1 END) as temp_surrender_count,
        COUNT(DISTINCT tower_id) as total_towers,
        SUM(total_price_inr) as total_project_value_inr,
        ROUND(100.0 * COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as fill_percentage
       FROM units
       WHERE project_id = $1`,
      [projectId]
    );

    const row = result.rows[0];
    row.unmapped_count = parseInt(row.total_units) - (
      parseInt(row.available_count) + parseInt(row.booked_count) +
      parseInt(row.allotted_count) + parseInt(row.hold_count) +
      parseInt(row.temp_surrender_count)
    );
    delete row.available_count;
    delete row.booked_count;
    delete row.allotted_count;
    delete row.hold_count;

    res.json({ success: true, data: row });
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

// GET /api/units/status-counts - Count per status (must be before /:id)
router.get('/status-counts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (projectId) {
      params.push(projectId);
      where += ` AND u.project_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT u.status::text as status, COUNT(*)::int as count,
              COALESCE(SUM(u.carpet_area_sqft), 0) as total_area
       FROM units u ${where}
       GROUP BY u.status ORDER BY u.status`,
      params
    );
    const rows = result.rows;
    const total: number = rows.reduce((s: number, r: any) => s + r.count, 0);
    const available: number = rows.find((r: any) => r.status === 'available')?.count || 0;
    const totalArea: number = rows.reduce((s: number, r: any) => s + parseFloat(r.total_area || 0), 0);
    res.json({
      success: true,
      data: { byStatus: rows, total_units: total, available, total_sold: total - available, total_area: Math.round(totalArea) },
    });
  } catch (error) { next(error); }
});

// GET /api/units/tower-detail - Tower drill-down: units for a specific tower + status group
router.get('/tower-detail', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, towerId, statusGroup } = req.query as Record<string, string>;
    if (!projectId || !towerId || !statusGroup) {
      return res.status(400).json({ error: 'projectId, towerId, statusGroup are required' });
    }

    const STATUS_MAP: Record<string, string[]> = {
      allotted:       ['allotted','agreement_signed','under_construction','oc_received','possession_handed_over'],
      booked:         ['application_received','draw_pending','booked'],
      hold:           ['locked','held'],
      available:      ['available'],
      temp_surrender: ['temp_surrender'],
      all:            [],
    };

    const statuses = STATUS_MAP[statusGroup] ?? [];
    const statusFilter = statuses.length > 0
      ? 'AND u.status::text = ANY($3)'
      : '';
    const queryParams: any[] = statuses.length > 0
      ? [projectId, towerId, statuses]
      : [projectId, towerId];

    const result = await db.query(
      `SELECT
        u.unit_number,
        u.bhk_type as unit_type,
        ROUND(u.carpet_area_sqft::numeric, 4) as area,
        ROUND(u.super_area_sqft::numeric, 4) as super_area_sqft,
        ROUND(u.balcony_area_sqft::numeric, 4) as balcony_area_sqft,
        u.floor,
        u.facing,
        u.base_price_inr,
        u.status,
        t.tower_name,
        p.name as project_name,
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')) as consumer_name,
        COALESCE(br.booking_date, a.allotment_date) as booking_date,
        a.allotment_date,
        COALESCE(b.firm_name, b.name, 'Direct') as broker_name,
        COALESCE(br.self_or_loan, 'self') as loan_type,
        COALESCE(NULLIF(br.selected_plan_name, ''), 'Payment Plan') as payment_plan
       FROM units u
       JOIN towers t ON t.id = u.tower_id
       JOIN projects p ON p.id = u.project_id
       LEFT JOIN allocations a ON a.unit_id = u.id
       LEFT JOIN consumers c ON c.id = a.consumer_id
       LEFT JOIN LATERAL (
         SELECT br2.booking_date, br2.selected_plan_name, br2.main_broker_id, br2.self_or_loan
         FROM booking_records br2
         WHERE br2.consumer_id = c.id
         ORDER BY br2.created_at DESC LIMIT 1
       ) br ON true
       LEFT JOIN brokers b ON b.id = br.main_broker_id
       WHERE u.project_id = $1
       AND u.tower_id = $2
       ${statusFilter}
       ORDER BY COALESCE(br.booking_date, a.allotment_date) ASC NULLS LAST, u.unit_number ASC`,
      queryParams
    );

    const units = result.rows;
    const projectName = units[0]?.project_name || '';
    const towerName   = units[0]?.tower_name   || '';
    const today = new Date().toLocaleDateString('en-GB');

    res.json({ success: true, project_name: projectName, tower_name: towerName,
               status_group: statusGroup, date: today, units });
  } catch (error) {
    next(error);
  }
});

// GET /api/units/status - Alias for /status-counts (must be before /:id)
router.get('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (projectId) {
      params.push(projectId);
      where += ` AND u.project_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT u.status::text as status, COUNT(*)::int as count,
              COALESCE(SUM(u.carpet_area_sqft), 0) as total_area
       FROM units u ${where}
       GROUP BY u.status ORDER BY u.status`,
      params
    );
    const rows = result.rows;
    const total: number = rows.reduce((s: number, r: any) => s + r.count, 0);
    const available: number = rows.find((r: any) => r.status === 'available')?.count || 0;
    const totalArea: number = rows.reduce((s: number, r: any) => s + parseFloat(r.total_area || 0), 0);
    res.json({
      success: true,
      data: { byStatus: rows, total_units: total, available, total_sold: total - available, total_area: Math.round(totalArea) },
    });
  } catch (error) { next(error); }
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
              u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
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
    const { floor, facing, floorPlanUrl, basePriceInr, totalPriceInr,
            balconyAreaSqft } = req.body;
    const numberError = badNumber(req.body, ['basePriceInr', 'totalPriceInr', 'balconyAreaSqft']);
    if (numberError) return res.status(400).json({ error: numberError });

    const result = await db.query(
      `UPDATE units
       SET floor = COALESCE($1, floor),
           facing = COALESCE($2, facing),
           floor_plan_url = COALESCE($3, floor_plan_url),
           base_price_inr = COALESCE($4, base_price_inr),
           total_price_inr = COALESCE($5, total_price_inr),
           balcony_area_sqft = COALESCE($6, balcony_area_sqft),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, unit_number, bhk_type, status, total_price_inr, updated_at`,
      [floor, facing, floorPlanUrl, basePriceInr, totalPriceInr,
       balconyAreaSqft ?? null, id]
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
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be a list of units' });

    let created = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const row of rows) {
      if (row.floor === undefined || row.floor === null || row.floor === '') {
        skipped++;
        errors.push({ unitNumber: row.unitNumber, reason: 'Floor number is required for each unit' });
        continue;
      }
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

        const inserted = await db.query(
          `INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type,
            carpet_area_sqft, super_area_sqft, base_price_inr, total_price_inr, facing,
            status, created_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available', $11)
           ON CONFLICT (tower_id, unit_number) DO NOTHING`,
          [projectId, towerId, row.floor, row.unitNumber, row.bhkType,
           row.carpetAreaSqft || row.carpetAreaSqm, row.superAreaSqft || row.superAreaSqm,
           row.basePriceInr, row.totalPriceInr, row.facing, req.userId]
        );
        if (inserted.rowCount) created++;
        else { skipped++; errors.push({ unitNumber: row.unitNumber, reason: 'A unit with this number already exists in this tower' }); }
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

router.use(pgErrorHandler);

export default router;
