/**
 * Import Routes
 * Units from a CSV file: preview (read and check, nothing is saved), confirm (all rows are checked first; one bad row stops the whole file),
 * and the import history.
 * Applicants are made on the Booking screen and E-Draw results come in on Allotment > E-Draw Import, so only "units" is imported here.
 */

import { Router, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, text, body, paging, oneOf, inTx, lock } from '../utils/input.js';
import { floorNo, unitFields } from './units.js';

const router = Router();
const MAX_ROWS = 5000, MAX_CSV = 2_000_000;
const REQUIRED = ['unitNumber', 'tower', 'floor', 'bhkType', 'totalPriceInr'];

type Clean = { line: number; unit: string; tower: string; floor: number; bhk: string; facing: string | null; f: ReturnType<typeof unitFields> };

const onlyUnits = (v: any) => {
  const t = has(v) ? oneOf(v, 'importType', ['units'] as const) : 'units';
  return t;
};

// The CSV text to rows, or a clear 400
const readCsv = (v: any) => {
  if (typeof v !== 'string' || !v.trim()) throw bad('csvText is required (the text of the CSV file)');
  if (v.length > MAX_CSV) throw bad('The file is too large (2 MB at most)');
  let rows: any[];
  try { rows = parse(v, { columns: true, skip_empty_lines: true, trim: true, bom: true }); }
  catch (e: any) { throw bad('The file is not a valid CSV: ' + String(e.message).split('\n')[0]); }
  if (!rows.length) throw bad('The file has no rows');
  if (rows.length > MAX_ROWS) throw bad(`The file has ${rows.length} rows; ${MAX_ROWS} at most in one import`);
  const headers = Object.keys(rows[0]);
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length) throw bad(`Missing required columns: ${missing.join(', ')}`);
  return { rows, headers };
};

// Every row checked with the same rules as the Unit screen; the second copy of a unit inside the file is a problem too
const checkRows = (rows: any[]) => {
  const ok: Clean[] = [], errors: { row: number; unit: string; reason: string }[] = [], seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;   // line 1 is the header
    try {
      const unit = text(r.unitNumber, 'Unit number', 50, true)!, tower = text(r.tower, 'Tower', 100, true)!, bhk = text(r.bhkType, 'BHK type', 50, true)!;
      if (!has(r.floor)) throw bad('Floor number is required for each unit');
      const floor = floorNo(r.floor), facing = text(r.facing, 'Facing', 30, false);
      const f = unitFields(r);
      if (f.total === null) throw bad('Total price is required');
      if (!(f.total > 0)) throw bad('Total price must be more than 0');
      const key = `${tower.toLowerCase()}|${unit.toLowerCase()}`;
      if (seen.has(key)) throw bad('This unit is in the file more than once');
      seen.add(key);
      ok.push({ line, unit, tower, floor, bhk, facing, f });
    } catch (e: any) { errors.push({ row: line, unit: String(r.unitNumber ?? '').slice(0, 50), reason: e.http ? e.message : 'This row cannot be read' }); }
  });
  return { ok, errors };
};

const say = (errors: { row: number; unit: string; reason: string }[]) =>
  errors.slice(0, 5).map((e) => `Row ${e.row} (${e.unit || 'no unit number'}): ${e.reason}`).join(' | ') + (errors.length > 5 ? ` | and ${errors.length - 5} more` : '');

// POST /api/import/preview — read the CSV and tell what would happen (no DB writes)
router.post('/preview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    onlyUnits(b.importType);
    const projectId = has(b.projectId) ? uuid(b.projectId, 'projectId') : null;
    const { rows, headers } = readCsv(b.csvText);
    const { ok, errors } = checkRows(rows);
    let existing: number | null = null;
    if (projectId) {
      if (!(await db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length) throw bad('Project not found', 404);
      existing = (await db.query(
        `SELECT COUNT(*)::int AS n FROM units u JOIN towers t ON t.id = u.tower_id
          WHERE u.project_id = $1 AND (lower(t.tower_name), lower(u.unit_number)) IN (SELECT lower(tw), lower(un) FROM unnest($2::text[], $3::text[]) AS x(tw, un))`,
        [projectId, ok.map((r) => r.tower), ok.map((r) => r.unit)])).rows[0].n;
    }
    res.json({
      success: true,
      data: { importType: 'units', totalRows: rows.length, validRows: ok.length, errorRows: errors.length, alreadyInProject: existing, columns: headers, preview: rows.slice(0, 10), errors: errors.slice(0, 50) },
    });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/import — confirm: one bad row stops the whole file, nothing is saved; units that are already there are skipped
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    onlyUnits(b.importType);
    const projectId = uuid(b.projectId, 'projectId');
    const fileName = text(b.fileName, 'File name', 255, false) || 'import.csv';
    const { rows } = readCsv(b.csvText);
    const { ok, errors } = checkRows(rows);
    if (errors.length) {
      await db.query(
        `INSERT INTO import_history (file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by) VALUES ($1,'units',$2,0,0,$3,'failed',$4,$5)`,
        [fileName, rows.length, errors.length, JSON.stringify(errors.slice(0, 200)), req.userId]);
      return res.status(422).json({ error: `The file has ${errors.length} row(s) with problems, nothing was imported. ${say(errors)}`, errors: errors.slice(0, 50) });
    }

    const out = await inTx(async (c) => {
      if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length) throw bad('Project not found', 404);
      await lock(c, `import-units:${projectId}`);   // a double click or two files at once: one after the other, duplicates are skipped
      const towers = new Map<string, string>();
      let created = 0;
      const skipped: { row: number; unit: string; reason: string }[] = [];
      for (const r of ok) {
        const tk = r.tower.toLowerCase();
        if (!towers.has(tk)) {
          const t = (await c.query(`SELECT id, deleted_at FROM towers WHERE project_id = $1 AND lower(tower_name) = $2`, [projectId, tk])).rows[0];
          if (t?.deleted_at) throw bad(`Tower "${r.tower}" was deleted from this project. Bring it back or use another tower name.`, 409);
          towers.set(tk, t ? t.id : (await c.query(`INSERT INTO towers (project_id, tower_name) VALUES ($1, $2) RETURNING id`, [projectId, r.tower])).rows[0].id);
        }
        const towerId = towers.get(tk)!;
        const done = await c.query(
          `INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, balcony_area_sqft, base_price_inr, total_price_inr, facing, status, created_by_user_id)
           SELECT $1::uuid,$2::uuid,$3::int,$4::text,$5::text,$6::numeric,$7::numeric,$8::numeric,$9::numeric,$10::numeric,$11::text,'available',$12::uuid
            WHERE NOT EXISTS (SELECT 1 FROM units WHERE tower_id = $2::uuid AND lower(unit_number) = lower($4::text))`,
          [projectId, towerId, r.floor, r.unit, r.bhk, r.f.carpet, r.f.sup, r.f.balcony, r.f.base, r.f.total, r.facing, req.userId]);
        if (done.rowCount) created++; else skipped.push({ row: r.line, unit: r.unit, reason: 'A unit with this number already exists in this tower' });
      }
      await c.query(
        `INSERT INTO import_history (file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by) VALUES ($1,'units',$2,$3,$4,0,'completed',$5,$6)`,
        [fileName, rows.length, created, skipped.length, JSON.stringify(skipped.slice(0, 200)), req.userId]);
      return { totalRows: rows.length, created, skipped: skipped.length, skippedRows: skipped.slice(0, 50) };
    });
    res.json({ success: true, data: out });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/import/history
router.get('/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const importType = oneOf(req.query.importType, 'importType', ['units'] as const);
    const { size, offset } = paging(req.query, 50, 200);
    const params: any[] = [];
    let where = '';
    if (importType) { params.push(importType); where = ` AND ih.import_type = $1`; }
    params.push(size, offset);
    const result = await db.query(
      `SELECT ih.id, ih.file_name, ih.import_type, ih.total_rows, ih.created_rows, ih.skipped_rows, ih.error_rows, ih.status, ih.errors, ih.created_at,
              u.name as imported_by_name
         FROM import_history ih LEFT JOIN users u ON ih.imported_by = u.id
        WHERE 1=1${where} ORDER BY ih.created_at DESC, ih.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

export default router;
