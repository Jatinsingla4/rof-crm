/**
 * Import Routes
 * CSV file import: preview (parse + validate) and confirm (persist)
 * Also serves import history log
 */

import { Router, Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// POST /api/import/preview — parse CSV and return preview rows (no DB writes)
router.post('/preview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { csvText, importType = 'units' } = req.body;

    if (!csvText) return res.status(400).json({ error: 'csvText is required in body' });

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    // Basic column validation per import type
    const requiredColumns: Record<string, string[]> = {
      units: ['unitNumber', 'tower', 'bhkType', 'totalPriceInr'],
      consumers: ['name', 'mobile', 'email'],
      edraw: ['applicationId', 'applicantName', 'mobile', 'result'],
    };

    const required = requiredColumns[importType as string] || [];
    const headers = rows.length > 0 ? Object.keys(rows[0] as object) : [];
    const missingCols = required.filter(c => !headers.includes(c));

    if (missingCols.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingCols.join(', ')}`,
        columns: headers,
      });
    }

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        columns: headers,
        preview: rows.slice(0, 10),
        importType,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: 'CSV parse error: ' + error.message });
  }
});

// POST /api/import — confirm import (persist rows)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { csvText, importType = 'units', projectId, fileName = 'import.csv' } = req.body;

    if (!csvText) return res.status(400).json({ error: 'csvText is required' });

    const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as any[];

    let created = 0, skipped = 0;
    const errors: any[] = [];

    if (importType === 'units' && projectId) {
      for (const row of rows) {
        try {
          // Resolve tower
          const towerRes = await db.query(
            `INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
             ON CONFLICT (project_id, tower_name) DO UPDATE SET tower_name = EXCLUDED.tower_name
             RETURNING id`,
            [projectId, row.tower || 'A']
          );
          const towerId = towerRes.rows[0].id;

          await db.query(
            `INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type,
               carpet_area_sqft, super_area_sqft, base_price_inr, total_price_inr, facing,
               status, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available', $11)
             ON CONFLICT (tower_id, unit_number) DO NOTHING`,
            [projectId, towerId, row.floor || 1, row.unitNumber, row.bhkType,
             row.carpetAreaSqft || null, row.superAreaSqft || null,
             row.basePriceInr || null, row.totalPriceInr, row.facing || null, req.userId]
          );
          created++;
        } catch (err: any) {
          skipped++;
          errors.push({ row: row.unitNumber, reason: err.message.split('\n')[0] });
        }
      }
    } else if (importType === 'edraw' && projectId) {
      for (const row of rows) {
        try {
          // 1. Update consumer lead stage
          const stage = row.result === 'allotted' ? 'allotted' : 'draw_refund_pending';
          const updateRes = await db.query(
            `UPDATE consumers SET lead_stage = $1, updated_at = NOW() 
             WHERE (id = $2 OR mobile = $3) AND project_id = $4
             RETURNING id`,
            [stage, row.consumerId || null, row.mobile, projectId]
          );

          if (updateRes.rowCount > 0 && row.result !== 'allotted') {
            // 2. Create refund entry if not allotted
            await db.query(
              `INSERT INTO draw_refunds (consumer_id, project_id, draw_result, refund_status, refund_due_by)
               VALUES ($1, $2, $3, 'pending', NOW() + INTERVAL '30 days')
               ON CONFLICT DO NOTHING`,
              [updateRes.rows[0].id, projectId, row.result]
            );
          }
          created++;
        } catch (err: any) {
          skipped++;
          errors.push({ row: row.mobile || 'unknown', reason: err.message.split('\n')[0] });
        }
      }
    } else {
      // Unsupported type — log as-is
      skipped = rows.length;
    }

    // Log import history
    await db.query(
      `INSERT INTO import_history (file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [fileName, importType, rows.length, created, skipped, errors.length,
       errors.length === rows.length ? 'failed' : errors.length > 0 ? 'partial' : 'completed',
       JSON.stringify(errors), req.userId]
    );

    res.json({ success: true, data: { totalRows: rows.length, created, skipped, errors } });
  } catch (error) {
    next(error);
  }
});

// GET /api/import/history
router.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { importType, page = 1, pageSize = 50 } = req.query;

    let query = `
      SELECT ih.id, ih.file_name, ih.import_type, ih.total_rows, ih.created_rows,
             ih.skipped_rows, ih.error_rows, ih.status, ih.created_at,
             u.name as imported_by_name
      FROM import_history ih
      LEFT JOIN users u ON ih.imported_by = u.id
      WHERE 1=1`;
    const params: any[] = [];

    if (importType) { query += ` AND ih.import_type = $${params.length + 1}`; params.push(importType); }
    query += ` ORDER BY ih.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
