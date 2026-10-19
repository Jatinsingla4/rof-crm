/**
 * Master Data Routes
 * CRUD for: Countries, States, Cities, Banks, Salutations,
 *           Professions, Nationalities, Sources of Enquiry,
 *           Document Types, Document Dispatch
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { hasPermission } from '../middleware/rbac.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { auditChange } from '../middleware/auditLogger.js';

const router = Router();

// ─── Access control ──────────────────────────────────────────────────────────
// Reading masters is open to every signed-in user (booking, brokers and payments use these lists as dropdowns).
// Changing the Set Master lists needs the master_data permission. Reminder, unit type, floor and tax slab
// routes share this file but belong to Set Projects, so they keep their current access.
const SET_MASTER_PATH = /^\/(countries|states|cities|banks|salutations|professions|nationalities|sources-of-enquiry|document-types|document-dispatch)(\/|$)/i;
const actionByMethod: Record<string, string> = { POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || !SET_MASTER_PATH.test(req.path)) return next();
  if (hasPermission(req.userRole, 'master_data', actionByMethod[req.method] || 'edit')) return next();
  return res.status(403).json({ error: 'You do not have permission to change master data' });
});

// ─── Input helpers ───────────────────────────────────────────────────────────
// Strings are trimmed and blank strings become null. Objects and arrays are rejected.
const TEXT_FIELDS = new Set(['name', 'code', 'ifsc_prefix', 'branch', 'description', 'category', 'document_from',
  'required_at', 'document_type', 'dispatch_mode', 'tracking_no']);
// current: the stored row on update; an unchanged old value is not re-checked for markup
function cleanBody(body: any, fields: string[], current?: Record<string, any>): { values: Record<string, any> } | { error: string } {
  const values: Record<string, any> = {};
  for (const f of fields) {
    let v = body?.[f];
    if (v === undefined) continue;
    if (typeof v === 'string') { v = v.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); if (v === '') v = null; }
    else if (v !== null && typeof v === 'object') return { error: `Invalid value for ${f}` };
    if (v !== null && TEXT_FIELDS.has(f) && typeof v !== 'string') return { error: `Invalid value for ${f}` };
    // Other pages put these names into dropdowns and letters as HTML, so markup characters are not accepted
    if (typeof v === 'string' && /[<>]/.test(v) && !(current && current[f] === v)) return { error: `${f} cannot contain < or >` };
    values[f] = v;
  }
  return { values };
}

// Case-insensitive duplicate check on name, optionally inside a parent (state inside country, city inside state)
async function isDuplicate(table: string, scope: string[], values: Record<string, any>, excludeId?: string) {
  if (typeof values.name !== 'string') return false;
  const params: any[] = [values.name];
  let sql = `SELECT 1 FROM ${table} WHERE lower(name) = lower($1)`;
  for (const col of scope) { params.push(values[col] ?? null); sql += ` AND ${col} IS NOT DISTINCT FROM $${params.length}`; }
  if (excludeId) { params.push(excludeId); sql += ` AND id <> $${params.length}`; }
  return (await db.query(sql, params)).rows.length > 0;
}

// ─── Generic list/add/delete helper ──────────────────────────────────────────
// opts.unique: parent columns for the duplicate name check (omit to skip the check); opts.required: extra mandatory fields
function listRoute(table: string, orderBy = 'name') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
      res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
  };
}

function addRoute(table: string, fields: string[], opts: { unique?: string[]; required?: string[] } = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cleaned = cleanBody(req.body, fields);
      if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
      const { values } = cleaned;
      if (fields.includes('name') && !values.name) return res.status(400).json({ error: 'Name is required' });
      for (const r of opts.required || []) if (!values[r]) return res.status(400).json({ error: `${r} is required` });
      if (opts.unique && await isDuplicate(table, opts.unique, values)) {
        return res.status(409).json({ error: 'A record with this name already exists' });
      }
      const result = await db.query(
        `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        fields.map(f => values[f] ?? null)
      );
      await auditChange(db, req, res, 'create', `master.${table}`, result.rows[0].id, undefined, result.rows[0]);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) { next(err); }
  };
}

// opts.inUse: returns a message when the record is still referenced, which blocks the delete
function deleteRoute(table: string, opts: { inUse?: (id: string) => Promise<string | null> } = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const blocked = opts.inUse ? await opts.inUse(req.params.id) : null;
      if (blocked) return res.status(409).json({ error: blocked });
      const result = await db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
      await auditChange(db, req, res, 'delete', `master.${table}`, req.params.id, result.rows[0]);
      res.json({ success: true });
    } catch (err) { next(err); }
  };
}

// Only the fields present in the request are changed
function updateRoute(table: string, fields: string[], opts: { unique?: string[]; required?: string[]; inUse?: (id: string) => Promise<string | null> } = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const current = (await db.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id])).rows[0];
      if (!current) return res.status(404).json({ error: 'Not found' });
      const cleaned = cleanBody(req.body, fields, current);
      if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
      const { values } = cleaned;
      const keys = Object.keys(values);
      if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
      if ('name' in values && !values.name) return res.status(400).json({ error: 'Name is required' });
      for (const r of opts.required || []) if (r in values && !values[r]) return res.status(400).json({ error: `${r} is required` });
      // Renaming a list item that other records hold as text would split their data, so it is refused while in use
      if (opts.inUse && typeof values.name === 'string' && values.name !== current.name) {
        const blocked = await opts.inUse(req.params.id);
        if (blocked) return res.status(409).json({ error: blocked.replace('before deleting this', 'before renaming this') });
      }
      if (opts.unique) {
        if (await isDuplicate(table, opts.unique, { ...current, ...values }, req.params.id)) {
          return res.status(409).json({ error: 'A record with this name already exists' });
        }
      }
      const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const result = await db.query(
        `UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`,
        [...keys.map(k => values[k]), req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
      await auditChange(db, req, res, 'update', `master.${table}`, req.params.id, current, result.rows[0]);
      res.json({ success: true, data: result.rows[0] });
    } catch (err) { next(err); }
  };
}

const countOf = async (sql: string, id: string) => (await db.query(sql, [id])).rows[0].n as number;

// These lists are stored as plain text on other records. Returns how many records carry this item's name.
// The table and column names below are fixed in code, never taken from a request.
async function textUsage(table: string, id: string, usedIn: [string, string][]): Promise<{ name: string; n: number } | null> {
  const row = (await db.query(`SELECT name FROM ${table} WHERE id = $1`, [id])).rows[0];
  if (!row) return null;
  let n = 0;
  for (const [t, col] of usedIn) n += Number((await db.query(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = $1`, [row.name])).rows[0].n);
  return { name: row.name, n };
}
const PERSON_TABLES = (col: string): [string, string][] => [['consumers', col], ['co_applicants', col], ['applicant_details', col]];
const inUseByText = (table: string, label: string, usedIn: [string, string][]) => async (id: string) => {
  const u = await textUsage(table, id, usedIn);
  return u && u.n ? `"${u.name}" is used on ${u.n} record(s). Remove it from them before deleting this ${label}.` : null;
};

// ─── COUNTRIES ────────────────────────────────────────────────────────────────
router.get('/countries',             listRoute('countries', 'name'));
router.post('/countries',            addRoute('countries', ['name', 'code'], { unique: [] }));
router.put('/countries/:id',         updateRoute('countries', ['name', 'code'], { unique: [] }));
router.delete('/countries/:id',      deleteRoute('countries', {
  inUse: async id => {
    const n = await countOf('SELECT COUNT(*)::int AS n FROM states WHERE country_id = $1', id);
    return n ? `This country has ${n} state(s). Delete them first.` : null;
  },
}));

// ─── STATES ───────────────────────────────────────────────────────────────────
router.get('/states', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { country_id } = req.query;
    const where = country_id ? `WHERE s.country_id = $1` : '';
    const params = country_id ? [country_id] : [];
    const result = await db.query(
      `SELECT s.*, c.name as country_name
       FROM states s JOIN countries c ON c.id = s.country_id
       ${where} ORDER BY s.name`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/states',               addRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'] }));
router.put('/states/:id',            updateRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'] }));
router.delete('/states/:id',         deleteRoute('states', {
  inUse: async id => {
    const n = await countOf('SELECT COUNT(*)::int AS n FROM cities WHERE state_id = $1', id);
    return n ? `This state has ${n} city(ies). Delete them first.` : null;
  },
}));

// ─── CITIES ───────────────────────────────────────────────────────────────────
router.get('/cities', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { state_id } = req.query;
    const where = state_id ? `WHERE ci.state_id = $1` : '';
    const params = state_id ? [state_id] : [];
    const result = await db.query(
      `SELECT ci.*, s.name as state_name, c.name as country_name
       FROM cities ci
       JOIN states s ON s.id = ci.state_id
       JOIN countries c ON c.id = s.country_id
       ${where} ORDER BY ci.name`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/cities',               addRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'] }));
router.put('/cities/:id',            updateRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'] }));
router.delete('/cities/:id',         deleteRoute('cities'));

// ─── BANKS ────────────────────────────────────────────────────────────────────
router.get('/banks',                 listRoute('banks', 'name'));
router.post('/banks',                addRoute('banks', ['name', 'ifsc_prefix', 'branch'], { unique: [] }));
router.put('/banks/:id',             updateRoute('banks', ['name', 'ifsc_prefix', 'branch'], { unique: [] }));
router.delete('/banks/:id',          deleteRoute('banks', {
  inUse: async id => {
    const n = await countOf('SELECT COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id = $1', id);
    return n ? `This bank is the clearing bank on ${n} receipt(s) and cannot be deleted.` : null;
  },
}));

// ─── SALUTATIONS ──────────────────────────────────────────────────────────────
router.get('/salutations',           listRoute('salutations', 'name'));
router.post('/salutations',          addRoute('salutations', ['name'], { unique: [] }));
router.put('/salutations/:id', updateRoute('salutations', ['name'], { unique: [], inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
router.delete('/salutations/:id',    deleteRoute('salutations', { inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));

// ─── PROFESSIONS ──────────────────────────────────────────────────────────────
router.get('/professions',           listRoute('professions', 'name'));
router.post('/professions',          addRoute('professions', ['name'], { unique: [] }));
router.put('/professions/:id', updateRoute('professions', ['name'], { unique: [], inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));
router.delete('/professions/:id',    deleteRoute('professions', { inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));

// ─── NATIONALITIES ────────────────────────────────────────────────────────────
router.get('/nationalities',         listRoute('nationalities', 'name'));
router.post('/nationalities',        addRoute('nationalities', ['name'], { unique: [] }));
router.put('/nationalities/:id', updateRoute('nationalities', ['name'], { unique: [], inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));
router.delete('/nationalities/:id',  deleteRoute('nationalities', { inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));

// ─── SOURCES OF ENQUIRY ───────────────────────────────────────────────────────
router.get('/sources-of-enquiry',           listRoute('sources_of_enquiry', 'name'));
router.post('/sources-of-enquiry',          addRoute('sources_of_enquiry', ['name', 'description'], { unique: [] }));
router.put('/sources-of-enquiry/:id',       updateRoute('sources_of_enquiry', ['name', 'description'], { unique: [], inUse: inUseByText('sources_of_enquiry', 'source', [['consumers', 'source_of_enquiry']]) }));
router.delete('/sources-of-enquiry/:id',    deleteRoute('sources_of_enquiry', { inUse: inUseByText('sources_of_enquiry', 'source', [['consumers', 'source_of_enquiry']]) }));

// ─── DOCUMENT TYPES ───────────────────────────────────────────────────────────
router.get('/document-types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (project_id) {
      params.push(project_id);
      where += ` AND (dt.project_id = $${params.length} OR dt.project_id IS NULL)`;
    }
    const result = await db.query(`
      SELECT dt.id, dt.name, dt.category, dt.description,
             dt.project_id, dt.document_from, dt.is_mandatory,
             dt.required_at, dt.created_at, dt.updated_at,
             p.name AS project_name
      FROM document_types dt
      LEFT JOIN projects p ON p.id = dt.project_id
      ${where}
      ORDER BY p.name NULLS LAST, dt.required_at, dt.name
    `, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

const DOCUMENT_FROM = ['Individual', 'Firm or Company'];
const REQUIRED_AT = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Demand', 'Other'];

// Shared checks for create and update. Returns an error message or null.
async function documentTypeError(v: Record<string, any>): Promise<string | null> {
  if (v.document_from != null && !DOCUMENT_FROM.includes(v.document_from)) return 'Invalid Document From';
  if (v.required_at != null && !REQUIRED_AT.includes(v.required_at)) return 'Invalid Document Type';
  if (v.is_mandatory != null && typeof v.is_mandatory !== 'boolean') return 'Invalid Mandatory value';
  if (typeof v.description === 'string' && v.description.length > 500) return 'Description is longer than 500 characters';
  if (v.project_id) {
    const found = await db.query('SELECT 1 FROM projects WHERE id = $1', [v.project_id]);
    if (!found.rows.length) return 'Project not found';
  }
  return null;
}
const DOCUMENT_TYPE_FIELDS = ['name', 'category', 'description', 'project_id', 'document_from', 'is_mandatory', 'required_at'];

router.post('/document-types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cleaned = cleanBody(req.body, DOCUMENT_TYPE_FIELDS);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const v = cleaned.values;
    if (!v.name) return res.status(400).json({ error: 'Document name required' });
    if (!v.required_at) return res.status(400).json({ error: 'Document Type required' });
    const invalid = await documentTypeError(v);
    if (invalid) return res.status(400).json({ error: invalid });
    if (await isDuplicate('document_types', [], v)) return res.status(409).json({ error: 'A document with this name already exists' });
    const result = await db.query(
      `INSERT INTO document_types
         (name, category, description, project_id, document_from, is_mandatory, required_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
      [v.name, v.category ?? null, v.description ?? null, v.project_id ?? null,
       v.document_from ?? 'Individual', v.is_mandatory ?? false, v.required_at]
    );
    await auditChange(db, req, res, 'create', 'master.document_types', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// Only the fields present in the request are changed (the edit form does not send category)
router.put('/document-types/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const cleaned = cleanBody(req.body, DOCUMENT_TYPE_FIELDS);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const v = cleaned.values;
    if ('name' in v && !v.name) return res.status(400).json({ error: 'Document name required' });
    if ('required_at' in v && !v.required_at) return res.status(400).json({ error: 'Document Type required' });
    // These columns have defaults on create, so an explicit null on update means "leave as is"
    for (const k of ['document_from', 'is_mandatory']) if (k in v && v[k] === null) delete v[k];
    const invalid = await documentTypeError(v);
    if (invalid) return res.status(400).json({ error: invalid });
    if (v.name && await isDuplicate('document_types', [], v, id)) {
      return res.status(409).json({ error: 'A document with this name already exists' });
    }

    await client.query('BEGIN');
    const oldRes = await client.query(`SELECT * FROM document_types WHERE id = $1 FOR UPDATE`, [id]);
    if (!oldRes.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Document type not found' }); }
    const oldName = oldRes.rows[0].name;

    const keys = Object.keys(v);
    if (!keys.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Nothing to update' }); }
    const result = await client.query(
      `UPDATE document_types SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map(k => v[k]), id]
    );

    const newName = result.rows[0].name;
    if (oldName && newName && oldName !== newName) {
      await client.query(`UPDATE booking_documents  SET document_type = $1 WHERE document_type = $2`, [newName, oldName]);
      await client.query(`UPDATE document_dispatch  SET document_type = $1 WHERE document_type = $2`, [newName, oldName]);
    }
    await client.query('COMMIT');
    // Audited on the same connection: asking the pool for a second one while holding this one can deadlock a busy pool
    await auditChange(client, req, res, 'update', 'master.document_types', id, oldRes.rows[0], result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/document-types/:id',    deleteRoute('document_types', {
  inUse: async id => {
    const row = (await db.query('SELECT name FROM document_types WHERE id = $1', [id])).rows[0];
    if (!row) return null;
    const n = (await db.query(
      `SELECT (SELECT COUNT(*) FROM booking_documents WHERE document_type = $1)
            + (SELECT COUNT(*) FROM document_dispatch WHERE document_type = $1) AS n`, [row.name])).rows[0].n;
    return Number(n) ? `This document type is used in ${n} booking document or dispatch record(s) and cannot be deleted.` : null;
  },
}));

// ─── DOCUMENT DISPATCH ────────────────────────────────────────────────────────
router.get('/document-dispatch', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT dd.*, c.name as consumer_name
      FROM document_dispatch dd
      LEFT JOIN consumers c ON c.id = dd.consumer_id
      ORDER BY dd.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/document-dispatch', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cleaned = cleanBody(req.body, ['document_type', 'dispatch_mode', 'tracking_no', 'consumer_id', 'dispatched_at']);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const v = cleaned.values;
    if (!v.document_type) return res.status(400).json({ error: 'Document type required' });
    if (!v.dispatch_mode) return res.status(400).json({ error: 'Dispatch mode required' });
    if (v.consumer_id) {
      const found = await db.query('SELECT 1 FROM consumers WHERE id = $1', [v.consumer_id]);
      if (!found.rows.length) return res.status(400).json({ error: 'Consumer not found' });
    }
    const result = await db.query(
      `INSERT INTO document_dispatch (document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [v.document_type, v.dispatch_mode, v.tracking_no ?? null, v.consumer_id ?? null, v.dispatched_at ?? null, req.userId]
    );
    await auditChange(db, req, res, 'create', 'master.document_dispatch', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});
router.delete('/document-dispatch/:id', deleteRoute('document_dispatch'));

// ─── REMINDER MASTER ──────────────────────────────────────────────────────────
// Table uses: reminder_name, days (not name/days_before/channel)
// Return aliases so frontend receives: id, name, days_before, channel
router.get('/reminder-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, reminder_name AS name, days AS days_before,
              COALESCE(prefix_name, 'all') AS channel, is_active, created_at
       FROM reminder_master ORDER BY days`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/reminder-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, days_before, channel } = req.body;
    if (!name || !days_before) return res.status(400).json({ error: 'name and days_before are required' });
    const result = await db.query(
      `INSERT INTO reminder_master (reminder_name, days, prefix_name)
       VALUES ($1, $2, $3) RETURNING id, reminder_name AS name, days AS days_before, COALESCE(prefix_name,'all') AS channel`,
      [name, parseInt(days_before), channel || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});
router.delete('/reminder-master/:id', deleteRoute('reminder_master'));

// ─── UNIT TYPES ───────────────────────────────────────────────────────────────
router.get('/unit-types',           async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id } = req.query;
    const where = project_id ? `WHERE ut.project_id = $1` : '';
    const params = project_id ? [project_id] : [];
    const result = await db.query(
      `SELECT ut.*, p.name as project_name FROM unit_types ut JOIN projects p ON p.id = ut.project_id ${where} ORDER BY ut.name`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/unit-types',          addRoute('unit_types', ['project_id', 'name', 'description', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft']));
router.put('/unit-types/:id',       updateRoute('unit_types', ['project_id', 'name', 'description', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft']));
router.delete('/unit-types/:id',    deleteRoute('unit_types'));

// ─── FLOORS ───────────────────────────────────────────────────────────────────
router.get('/floors',               async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tower_id } = req.query;
    const where = tower_id ? `WHERE f.tower_id = $1` : '';
    const params = tower_id ? [tower_id] : [];
    const result = await db.query(
      `SELECT f.*, t.tower_name FROM floors f JOIN towers t ON t.id = f.tower_id ${where} ORDER BY f.floor_number`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/floors',               addRoute('floors', ['tower_id', 'floor_number', 'floor_name']));
router.put('/floors/:id',            updateRoute('floors', ['tower_id', 'floor_number', 'floor_name']));
router.delete('/floors/:id',         deleteRoute('floors'));

// ─── TAX SLABS ────────────────────────────────────────────────────────────────
router.get('/tax-slabs',             listRoute('tax_slabs', 'name'));
router.post('/tax-slabs',            addRoute('tax_slabs', ['name', 'cgst_percent', 'sgst_percent', 'igst_percent', 'effective_from', 'is_active']));
router.put('/tax-slabs/:id',         updateRoute('tax_slabs', ['name', 'cgst_percent', 'sgst_percent', 'igst_percent', 'effective_from', 'is_active']));
router.delete('/tax-slabs/:id',      deleteRoute('tax_slabs'));

// ─── USAGE COUNTS ─────────────────────────────────────────────────────────────
// How many records use each list item, so the screen can show it and disable Delete.
// Applicant lists are stored as text, banks by id. Table and column names are fixed in code.
const usageByName = async (col: string, tables: string[]) => {
  const union = tables.map(t => `SELECT ${col} AS k FROM ${t}`).join(' UNION ALL ');
  const rows = (await db.query(`SELECT k, COUNT(*)::int AS n FROM (${union}) u WHERE k IS NOT NULL GROUP BY k`)).rows;
  return Object.fromEntries(rows.map(r => [r.k, r.n]));
};
router.get('/usage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const people = ['consumers', 'co_applicants', 'applicant_details'];
    const [salutations, professions, nationalities, sources, banks] = await Promise.all([
      usageByName('salutation', people),
      usageByName('profession', people),
      usageByName('nationality', people),
      usageByName('source_of_enquiry', ['consumers']),
      db.query(`SELECT clearing_bank_id AS k, COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id IS NOT NULL GROUP BY 1`),
    ]);
    res.json({ success: true, data: { salutations, professions, nationalities, sources, banks: Object.fromEntries(banks.rows.map(r => [r.k, r.n])) } });
  } catch (err) { next(err); }
});

router.use(pgErrorHandler);

export default router;
