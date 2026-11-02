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
import { inTx as inTxOnce, bad, uuid as inUuid, has as inHas, num as inNum, text as inText, body as inBody, day as inDay, oneOf as inOneOf } from '../utils/input.js';

const router = Router();

// ─── Access control ──────────────────────────────────────────────────────────
// Reading masters is open to every signed-in user (booking, brokers and payments use these lists as dropdowns).
// Every change under /master, including a path added later, needs the master_data permission. Nothing is allow-listed
// by path, so a new write route cannot be left open by forgetting to list it.
const actionByMethod: Record<string, string> = { POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (hasPermission(req.userRole, 'master_data', actionByMethod[req.method] || 'edit')) return next();
  return res.status(403).json({ error: 'You do not have permission to change master data' });
});

// ─── Input helpers ───────────────────────────────────────────────────────────
// "towerName" or "base_rate_sqft" -> "Tower name" / "Base rate sqft" for messages shown to the user
export const fieldLabel = (f: string) => {
  const s = f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
// Returns a message when one of the listed fields is present but not a number of zero or more
export function badNumber(values: Record<string, any>, fields: string[] = []): string | null {
  for (const f of fields) {
    const v = values[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean' || !Number.isFinite(Number(v)) || Number(v) < 0) return `${fieldLabel(f)} must be a number, zero or more`;
  }
  return null;
}
// Strings are trimmed and blank strings become null. Objects and arrays are rejected.
const TEXT_FIELDS = new Set(['name', 'code', 'ifsc_prefix', 'branch', 'description', 'category', 'document_from',
  'required_at', 'document_type', 'dispatch_mode', 'tracking_no', 'abbreviation', 'iso_code', 'isd_code', 'dispatch_type']);
// current: the stored row on update; an unchanged old value is not re-checked for markup
export function cleanBody(body: any, fields: string[], current?: Record<string, any>): { values: Record<string, any> } | { error: string } {
  const values: Record<string, any> = {};
  for (const f of fields) {
    let v = body?.[f];
    if (v === undefined) continue;
    if (typeof v === 'string') { v = v.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); if (v === '') v = null; }
    else if (v !== null && typeof v === 'object') return { error: `Invalid value for ${fieldLabel(f)}` };
    if (v !== null && TEXT_FIELDS.has(f) && typeof v !== 'string') return { error: `Invalid value for ${fieldLabel(f)}` };
    // Other pages put these names into dropdowns and letters as HTML, so markup characters are not accepted
    if (typeof v === 'string' && /[<>]/.test(v) && !(current && current[f] === v)) return { error: `${fieldLabel(f)} cannot contain < or >` };
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

function addRoute(table: string, fields: string[], opts: { unique?: string[]; required?: string[]; maxLen?: number; nonNegative?: string[] } = {}) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cleaned = cleanBody(req.body, fields);
      if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
      const { values } = cleaned;
      if (fields.includes('name') && !values.name) return res.status(400).json({ error: 'Name is required' });
      for (const r of opts.required || []) if (!values[r]) return res.status(400).json({ error: `${fieldLabel(r)} is required` });
      if (opts.maxLen && typeof values.name === 'string' && values.name.length > opts.maxLen) return res.status(400).json({ error: `Name can be at most ${opts.maxLen} characters` });
      const numberError = badNumber(values, opts.nonNegative);
      if (numberError) return res.status(400).json({ error: numberError });
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
function updateRoute(table: string, fields: string[], opts: { unique?: string[]; required?: string[]; maxLen?: number; nonNegative?: string[]; inUse?: (id: string) => Promise<string | null> } = {}) {
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
      for (const r of opts.required || []) if (r in values && !values[r]) return res.status(400).json({ error: `${fieldLabel(r)} is required` });
      if (opts.maxLen && typeof values.name === 'string' && values.name.length > opts.maxLen) return res.status(400).json({ error: `Name can be at most ${opts.maxLen} characters` });
      const numberError = badNumber(values, opts.nonNegative);
      if (numberError) return res.status(400).json({ error: numberError });
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
// Abbreviation, ISO code, ISD code and the mobile number length of the country (a number is checked against it)
const COUNTRY_FIELDS = ['name', 'code', 'abbreviation', 'iso_code', 'isd_code', 'mobile_digits'];
const countryCheck = (req: AuthRequest, res: Response, next: NextFunction) => {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const isCreate = req.method === 'POST';
  if (isCreate) for (const [k, label] of [['abbreviation', 'Abbreviation'], ['iso_code', 'ISO code'], ['isd_code', 'ISD code'], ['mobile_digits', 'Number of mobile digits']]) if (b[k] === undefined || b[k] === null || String(b[k]).trim() === '') return res.status(400).json({ error: `${label} is required` });
  if ('mobile_digits' in b && (b.mobile_digits === null || b.mobile_digits === '')) return res.status(400).json({ error: 'Number of mobile digits is required' });
  if (b.iso_code != null && b.iso_code !== '' && !/^[A-Za-z]{2,3}$/.test(String(b.iso_code).trim())) return res.status(400).json({ error: 'ISO code must be 2 or 3 letters' });
  if (b.isd_code != null && b.isd_code !== '' && !/^\d{1,4}$/.test(String(b.isd_code).trim().replace(/^\+/, ''))) return res.status(400).json({ error: 'ISD code must be 1 to 4 digits' });
  if (b.abbreviation != null && b.abbreviation !== '' && String(b.abbreviation).trim().length > 10) return res.status(400).json({ error: 'Abbreviation can be at most 10 characters' });
  if (b.mobile_digits != null && b.mobile_digits !== '' && !(Number.isInteger(Number(b.mobile_digits)) && Number(b.mobile_digits) >= 4 && Number(b.mobile_digits) <= 15)) return res.status(400).json({ error: 'Number of mobile digits must be a whole number from 4 to 15' });
  if (typeof b.iso_code === 'string') b.iso_code = b.iso_code.trim().toUpperCase();
  if (typeof b.isd_code === 'string') b.isd_code = b.isd_code.trim().replace(/^\+/, '');
  next();
};
router.post('/countries',            countryCheck, addRoute('countries', COUNTRY_FIELDS, { unique: [] }));
router.put('/countries/:id',         countryCheck, updateRoute('countries', COUNTRY_FIELDS, { unique: [] }));
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
// ?type=customer or ?type=loan lists one use of the bank list; a loan bank can be limited to some projects (projectIds)
router.get('/banks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = String(req.query.type || '');
    if (type && !['customer', 'loan'].includes(type)) return res.status(400).json({ error: 'type must be customer or loan' });
    const where = type === 'loan' ? 'WHERE b.is_loan_bank' : type === 'customer' ? 'WHERE b.is_customer_bank' : '';
    const r = await db.query(`SELECT b.*, COALESCE((SELECT json_agg(lp.project_id) FROM loan_bank_projects lp WHERE lp.bank_id = b.id), '[]'::json) AS project_ids FROM banks b ${where} ORDER BY b.name`);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
const BANK_FIELDS = ['name', 'ifsc_prefix', 'branch', 'is_customer_bank', 'is_loan_bank'];
const bankFlags = (req: AuthRequest, res: Response, next: NextFunction) => {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  for (const k of ['is_customer_bank', 'is_loan_bank']) if (b[k] !== undefined && typeof b[k] !== 'boolean') return res.status(400).json({ error: `${fieldLabel(k)} must be true or false` });
  if (req.method === 'POST') { if (b.is_customer_bank === undefined) b.is_customer_bank = true; if (b.is_loan_bank === undefined) b.is_loan_bank = false; }
  if (req.method === 'POST' && b.is_customer_bank === false && b.is_loan_bank !== true) return res.status(400).json({ error: 'A bank must be a customer bank, a loan bank or both' });
  next();
};
router.post('/banks',                bankFlags, addRoute('banks', BANK_FIELDS, { unique: [] }));
router.put('/banks/:id',             bankFlags, updateRoute('banks', BANK_FIELDS, { unique: [] }));
// Projects a loan bank is approved for (an empty list means every project)
router.get('/banks/:id/projects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Bank not found' });
    const r = await db.query(`SELECT lp.project_id, p.name FROM loan_bank_projects lp JOIN projects p ON p.id = lp.project_id WHERE lp.bank_id = $1 ORDER BY p.name`, [req.params.id]);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
router.put('/banks/:id/projects', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const c = await db.connect();
  try {
    const ids = req.body?.projectIds;
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Bank not found' });
    if (!Array.isArray(ids) || ids.length > 500 || ids.some((x: any) => typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x))) return res.status(400).json({ error: 'projectIds must be a list of project ids' });
    const bank = (await c.query('SELECT is_loan_bank FROM banks WHERE id = $1', [req.params.id])).rows[0];
    if (!bank) return res.status(404).json({ error: 'Bank not found' });
    if (!bank.is_loan_bank) return res.status(400).json({ error: 'Only a loan bank can be approved for projects' });
    const uniq = [...new Set(ids.map((x: string) => x.toLowerCase()))];
    if (uniq.length && (await c.query('SELECT id FROM projects WHERE id = ANY($1::uuid[])', [uniq])).rows.length !== uniq.length) return res.status(400).json({ error: 'A project in the list does not exist' });
    await c.query('BEGIN');
    const before = (await c.query('SELECT project_id FROM loan_bank_projects WHERE bank_id = $1', [req.params.id])).rows.map((r: any) => r.project_id);
    await c.query('DELETE FROM loan_bank_projects WHERE bank_id = $1', [req.params.id]);
    for (const pid of uniq) await c.query('INSERT INTO loan_bank_projects (bank_id, project_id) VALUES ($1, $2)', [req.params.id, pid]);
    await c.query('COMMIT');
    await auditChange(c, req, res, 'update', 'master.loan_bank_projects', req.params.id, { project_ids: before }, { project_ids: uniq });
    res.json({ success: true, data: uniq });
  } catch (err) { await c.query('ROLLBACK').catch(() => {}); next(err); } finally { c.release(); }
});
router.delete('/banks/:id',          deleteRoute('banks', {
  inUse: async id => {
    const n = await countOf('SELECT COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id = $1', id);
    return n ? `This bank is the clearing bank on ${n} receipt(s) and cannot be deleted.` : null;
  },
}));

// ─── AREA TYPES and CURRENCIES (plain lists the client's Set Up menu has) ─────────────────────────────────────────────
router.get('/area-types',            listRoute('area_types', 'name'));
router.post('/area-types',           addRoute('area_types', ['name'], { unique: [], maxLen: 50 }));
router.put('/area-types/:id',        updateRoute('area_types', ['name'], { unique: [], maxLen: 50 }));
router.delete('/area-types/:id',     deleteRoute('area_types'));
router.get('/currencies',            listRoute('currencies', 'name'));
router.post('/currencies',           addRoute('currencies', ['name'], { unique: [], maxLen: 50 }));
router.put('/currencies/:id',        updateRoute('currencies', ['name'], { unique: [], maxLen: 50 }));
router.delete('/currencies/:id',     deleteRoute('currencies'));

// ─── SALUTATIONS ──────────────────────────────────────────────────────────────
router.get('/salutations',           listRoute('salutations', 'name'));
router.post('/salutations',          addRoute('salutations', ['name'], { unique: [], maxLen: 20 }));
router.put('/salutations/:id', updateRoute('salutations', ['name'], { unique: [], maxLen: 20, inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
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
const REQUIRED_AT = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Transfer', 'On Demand', 'Other'];

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
    // The same name may exist for Individual and for Firm or Company, and in other projects
    const scope = { ...v, document_from: v.document_from ?? 'Individual', project_id: v.project_id ?? null };
    if (await isDuplicate('document_types', ['project_id', 'document_from'], scope)) return res.status(409).json({ error: 'A document with this name already exists for this project and document from' });
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
    {
      const cur = (await db.query('SELECT name, project_id, document_from FROM document_types WHERE id = $1', [id])).rows[0];
      if (cur && (v.name || 'project_id' in v || 'document_from' in v) && await isDuplicate('document_types', ['project_id', 'document_from'], { ...cur, ...v }, id)) {
        return res.status(409).json({ error: 'A document with this name already exists for this project and document from' });
      }
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
    // booking documents and dispatches hold the name as text: follow a rename only when no other document type still uses the old name
    const oldNameStillUsed = oldName && newName && oldName !== newName ? (await client.query('SELECT 1 FROM document_types WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1', [oldName, id])).rows.length > 0 : false;
    if (oldName && newName && oldName !== newName && !oldNameStillUsed) {
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
const DISPATCH_MODES = ['Courier', 'Speed Post', 'Registered Post', 'Hand Delivery', 'Email', 'Other'];

// Shared checks for create and update. Returns an error message or null.
async function dispatchError(v: Record<string, any>): Promise<string | null> {
  if ('document_type' in v && !v.document_type) return 'Document type required';
  if (typeof v.document_type === 'string' && v.document_type.length > 150) return 'Document type is longer than 150 characters';
  if ('dispatch_mode' in v && !v.dispatch_mode) return 'Dispatch mode required';
  if (v.dispatch_mode != null && !DISPATCH_MODES.includes(v.dispatch_mode)) return 'Invalid dispatch mode';
  if (typeof v.tracking_no === 'string' && v.tracking_no.length > 100) return 'Tracking number is longer than 100 characters';
  if (v.dispatched_at != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.dispatched_at)) || Number.isNaN(Date.parse(String(v.dispatched_at)))) return 'Date dispatched must be a date like 2026-01-31';
    if (String(v.dispatched_at) > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) return 'Date dispatched cannot be in the future';
  }
  if (v.consumer_id != null) {
    if (!/^[0-9a-f-]{36}$/i.test(String(v.consumer_id))) return 'Consumer not found';
    if (!(await db.query('SELECT 1 FROM consumers WHERE id = $1', [v.consumer_id])).rows.length) return 'Consumer not found';
  }
  return null;
}
const DISPATCH_FIELDS = ['document_type', 'dispatch_mode', 'tracking_no', 'consumer_id', 'dispatched_at'];

// ─── DOCUMENT DISPATCH MASTER (kinds of document that are sent: name, single or multiple, per project) ────────────────────
const dmCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (req.method === 'POST' && (typeof b.name !== 'string' || !b.name.trim())) return res.status(400).json({ error: 'Document name is required' });
    if (typeof b.name === 'string' && b.name.trim().length > 150) return res.status(400).json({ error: 'Name can be at most 150 characters' });
    if (b.dispatch_type !== undefined && !['Single', 'Multiple'].includes(b.dispatch_type)) return res.status(400).json({ error: 'Type must be Single or Multiple' });
    if (typeof b.description === 'string' && b.description.trim().length > 150) return res.status(400).json({ error: 'Description can be at most 150 characters' });
    if (b.project_id != null && b.project_id !== '') {
      if (typeof b.project_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.project_id) || !(await db.query('SELECT 1 FROM projects WHERE id = $1', [b.project_id])).rows.length) return res.status(400).json({ error: 'Project not found' });
    } else if ('project_id' in b) b.project_id = null;
    next();
  } catch (err) { next(err); }
};
const DM_FIELDS = ['name', 'dispatch_type', 'description', 'project_id'];
router.get('/document-dispatch-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = req.query.projectId ? String(req.query.projectId) : null;
    if (pid && !/^[0-9a-f-]{36}$/i.test(pid)) return res.status(400).json({ error: 'Project not found' });
    const r = await db.query(`SELECT m.*, p.name AS project_name FROM document_dispatch_master m LEFT JOIN projects p ON p.id = m.project_id ${pid ? 'WHERE m.project_id = $1' : ''} ORDER BY p.name NULLS FIRST, m.name`, pid ? [pid] : []);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});
const dmDup = async (b: any, excludeId?: string) => (await db.query(`SELECT 1 FROM document_dispatch_master WHERE lower(name) = lower($1) AND project_id IS NOT DISTINCT FROM $2 ${excludeId ? 'AND id <> $3' : ''}`, excludeId ? [b.name, b.project_id ?? null, excludeId] : [b.name, b.project_id ?? null])).rows.length > 0;
router.post('/document-dispatch-master', dmCheck, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const c = cleanBody(req.body, DM_FIELDS); if ('error' in c) return res.status(400).json({ error: c.error });
    const v: any = { dispatch_type: 'Single', project_id: null, ...c.values };
    if (await dmDup(v)) return res.status(409).json({ error: 'A document with this name already exists for this project' });
    const r = await db.query(`INSERT INTO document_dispatch_master (name, dispatch_type, description, project_id) VALUES ($1,$2,$3,$4) RETURNING *`, [v.name, v.dispatch_type, v.description ?? null, v.project_id]);
    await auditChange(db, req, res, 'create', 'master.document_dispatch_master', r.rows[0].id, undefined, r.rows[0]);
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});
router.put('/document-dispatch-master/:id', dmCheck, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const cur = (await db.query('SELECT * FROM document_dispatch_master WHERE id = $1', [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const c = cleanBody(req.body, DM_FIELDS, cur); if ('error' in c) return res.status(400).json({ error: c.error });
    const v: any = { ...cur, ...c.values }; if (!v.name) return res.status(400).json({ error: 'Document name is required' });
    if (await dmDup(v, req.params.id)) return res.status(409).json({ error: 'A document with this name already exists for this project' });
    const r = await db.query(`UPDATE document_dispatch_master SET name=$1, dispatch_type=$2, description=$3, project_id=$4 WHERE id=$5 RETURNING *`, [v.name, v.dispatch_type, v.description ?? null, v.project_id, req.params.id]);
    await auditChange(db, req, res, 'update', 'master.document_dispatch_master', req.params.id, cur, r.rows[0]);
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
});
router.delete('/document-dispatch-master/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const r = await db.query('DELETE FROM document_dispatch_master WHERE id = $1 RETURNING *', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    await auditChange(db, req, res, 'delete', 'master.document_dispatch_master', req.params.id, r.rows[0]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Search (document, tracking number, consumer), consumer, date range; newest first; 50 per page
router.get('/document-dispatch', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q, consumer_id, from, to } = req.query;
    const size = Math.min(Math.max(Math.floor(Number(req.query.pageSize)) || 50, 1), 200);
    const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);
    const where: string[] = []; const params: any[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)); };
    if (consumer_id) { if (!/^[0-9a-f-]{36}$/i.test(String(consumer_id))) return res.status(400).json({ error: 'Invalid consumer_id' }); add('dd.consumer_id = ?', consumer_id); }
    if (q) add('(dd.document_type ILIKE ? OR dd.tracking_no ILIKE ? OR c.name ILIKE ?)', `%${String(q).replace(/[\\%_]/g, (m) => '\\' + m)}%`);
    for (const [name, v, sql] of [['from', from, 'COALESCE(dd.dispatched_at, dd.created_at) >= ?::date'], ['to', to, 'COALESCE(dd.dispatched_at, dd.created_at) < (?::date + 1)']] as const) {
      if (!v) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v)))) return res.status(400).json({ error: `${name} must be a date like 2026-01-31` });
      add(sql, v);
    }
    params.push(size + 1, (page - 1) * size);
    const result = await db.query(`
      SELECT dd.*, c.name as consumer_name
      FROM document_dispatch dd
      LEFT JOIN consumers c ON c.id = dd.consumer_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(dd.dispatched_at, dd.created_at) DESC, dd.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.json({ success: true, data: result.rows.slice(0, size), has_more: result.rows.length > size });
  } catch (err) { next(err); }
});
router.post('/document-dispatch', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cleaned = cleanBody(req.body, DISPATCH_FIELDS);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const v = cleaned.values;
    if (!v.document_type) return res.status(400).json({ error: 'Document type required' });
    if (!v.dispatch_mode) return res.status(400).json({ error: 'Dispatch mode required' });
    const invalid = await dispatchError(v);
    if (invalid) return res.status(400).json({ error: invalid });
    const result = await db.query(
      `INSERT INTO document_dispatch (document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [v.document_type, v.dispatch_mode, v.tracking_no ?? null, v.consumer_id ?? null, v.dispatched_at ?? null, req.userId]
    );
    await auditChange(db, req, res, 'create', 'master.document_dispatch', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});
// Correct a typing mistake (tracking number, mode, date) without deleting the entry
router.put('/document-dispatch/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'Dispatch entry not found' });
    const cleaned = cleanBody(req.body, DISPATCH_FIELDS);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const v = cleaned.values;
    const keys = Object.keys(v);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
    const invalid = await dispatchError(v);
    if (invalid) return res.status(400).json({ error: invalid });
    const old = (await db.query('SELECT * FROM document_dispatch WHERE id = $1', [id])).rows[0];
    if (!old) return res.status(404).json({ error: 'Dispatch entry not found' });
    const result = await db.query(
      `UPDATE document_dispatch SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => v[k]), id]
    );
    await auditChange(db, req, res, 'update', 'master.document_dispatch', id, old, result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});
router.delete('/document-dispatch/:id', deleteRoute('document_dispatch'));

// ─── REMINDER MASTER ──────────────────────────────────────────────────────────
// Table uses: reminder_name, days (not name/days_before/channel)
// Return aliases so frontend receives: id, name, days_before, channel
// A reminder rule belongs to a project and has a rank and a prefix (the client's "Reminder 1 = 10 days, prefix R1, rank 1"); a rule with no project is for all projects.
router.get('/reminder-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = req.query.projectId ? String(req.query.projectId) : null;
    if (pid && !/^[0-9a-f-]{36}$/i.test(pid)) return res.status(400).json({ error: 'Project not found' });
    const result = await db.query(
      `SELECT r.id, r.reminder_name AS name, r.days AS days_before, COALESCE(r.prefix_name, 'all') AS channel, r.prefix_name, r.rank, r.project_id, p.name AS project_name, r.is_active, r.created_at
         FROM reminder_master r LEFT JOIN projects p ON p.id = r.project_id ${pid ? 'WHERE r.project_id = $1' : ''} ORDER BY p.name NULLS FIRST, r.rank NULLS LAST, r.days`, pid ? [pid] : []);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});
router.post('/reminder-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rb = inBody(req);
    const name = inText(rb.name, 'Name', 200, true)!;
    if (!inHas(rb.days_before)) throw bad('name and days_before are required');
    const days = inNum(rb.days_before, 'Days after due date', 3650, 0);
    const channel = inText(rb.prefix_name ?? rb.channel, 'Prefix', 100, false);
    const rank = inHas(rb.rank) ? inNum(rb.rank, 'Rank', 100, 0) : null;
    if (rank !== null && !Number.isInteger(rank)) throw bad('Rank must be a whole number');
    const projectId = inHas(rb.project_id) ? inUuid(rb.project_id, 'Project') : null;
    if (projectId && !(await db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length) throw Object.assign(bad('Project not found'), { http: 404 });
    const result = await inTxOnce(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('reminder|' || lower($1) || '|' || $2 || '|' || COALESCE($3, '')))`, [name, days, projectId]);
      if ((await c.query('SELECT 1 FROM reminder_master WHERE lower(reminder_name) = lower($1) AND days = $2 AND project_id IS NOT DISTINCT FROM $3', [name, days, projectId])).rows.length) {
        throw Object.assign(bad('A reminder with this name and days already exists for this project'), { http: 409 });
      }
      if (rank !== null && (await c.query('SELECT 1 FROM reminder_master WHERE rank = $1 AND project_id IS NOT DISTINCT FROM $2', [rank, projectId])).rows.length) {
        throw Object.assign(bad('This project already has a reminder with this rank'), { http: 409 });
      }
      return c.query(
        `INSERT INTO reminder_master (reminder_name, days, prefix_name, rank, project_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, reminder_name AS name, days AS days_before, COALESCE(prefix_name,'all') AS channel, prefix_name, rank, project_id`,
        [name, days, channel, rank, projectId]);
    });
    await auditChange(db, req, res, 'create', 'master.reminder_master', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) { err?.http ? res.status(err.http).json({ error: err.message }) : next(err); }
});
router.patch('/reminder-master/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = inUuid(req.params.id, 'Reminder id'), rb = inBody(req);
    const cur = (await db.query('SELECT * FROM reminder_master WHERE id = $1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Reminder not found' });
    const name = inHas(rb.name) ? inText(rb.name, 'Name', 200, true)! : cur.reminder_name;
    const days = inHas(rb.days_before) ? inNum(rb.days_before, 'Days after due date', 3650, 0) : cur.days;
    const prefix = 'prefix_name' in rb ? inText(rb.prefix_name, 'Prefix', 100, false) : cur.prefix_name;
    const rank = 'rank' in rb ? (inHas(rb.rank) ? inNum(rb.rank, 'Rank', 100, 0) : null) : cur.rank;
    if (rank !== null && !Number.isInteger(rank)) throw bad('Rank must be a whole number');
    if ((await db.query('SELECT 1 FROM reminder_master WHERE lower(reminder_name) = lower($1) AND days = $2 AND project_id IS NOT DISTINCT FROM $3 AND id <> $4', [name, days, cur.project_id, id])).rows.length) throw Object.assign(bad('A reminder with this name and days already exists for this project'), { http: 409 });
    if (rank !== null && (await db.query('SELECT 1 FROM reminder_master WHERE rank = $1 AND project_id IS NOT DISTINCT FROM $2 AND id <> $3', [rank, cur.project_id, id])).rows.length) throw Object.assign(bad('This project already has a reminder with this rank'), { http: 409 });
    const r = (await db.query(`UPDATE reminder_master SET reminder_name = $1, days = $2, prefix_name = $3, rank = $4 WHERE id = $5 RETURNING id, reminder_name AS name, days AS days_before, prefix_name, rank, project_id`, [name, days, prefix, rank, id])).rows[0];
    await auditChange(db, req, res, 'update', 'master.reminder_master', id, cur, r);
    res.json({ success: true, data: r });
  } catch (err: any) { err?.http ? res.status(err.http).json({ error: err.message }) : next(err); }
});
router.delete('/reminder-master/:id', deleteRoute('reminder_master'));

// ─── UNIT TYPES ───────────────────────────────────────────────────────────────
router.get('/unit-types',           async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project_id = inHas(req.query.project_id) ? inUuid(req.query.project_id, 'project_id') : null;
    const where = project_id ? `WHERE ut.project_id = $1` : '';
    const params = project_id ? [project_id] : [];
    const result = await db.query(
      `SELECT ut.*, p.name as project_name FROM unit_types ut JOIN projects p ON p.id = ut.project_id ${where} ORDER BY ut.name`,
      params
    );
    res.json({ success: true, data: result.rows.map(utOut) });
  } catch (err) { sendErr(err, res, next); }
});
// Unit types: areas to 2 decimals, the base rate in whole rupees per sq ft; one name per project (any letter case)
const unitTypeInput = (rb: any, cur?: any) => {
  const name = 'name' in rb || !cur ? inText(rb.name, 'Name', 100, true)! : cur.name;
  const description = 'description' in rb ? inText(rb.description, 'Description', 1000, false) : cur ? cur.description : null;
  const pick = (k: string, col: string, label: string, max: number, dec: number) => k in rb ? (inHas(rb[k]) ? inNum(rb[k], label, max, dec) : null) : cur ? (cur[col] == null ? null : Number(cur[col])) : null;
  return { name, description, carpet: pick('carpet_area_sqft', 'carpet_area_sqft', 'Carpet area', 1_000_000, 4), balcony: pick('balcony_area_sqft', 'balcony_area_sqft', 'Balcony area', 1_000_000, 4), rate: pick('base_rate_sqft', 'base_rate_sqft', 'Base rate', 10_000_000, 2) };
};
// The rest of the client's unit type master: other areas, the area the rate is charged on, group, salable, costs, unit of measure, rate date
// A DATE column arrives as a JS Date; send it back as the plain local day so a screen never shows it one day early
const utOut = (r: any) => r && { ...r, rate_date: r.rate_date instanceof Date ? `${r.rate_date.getFullYear()}-${String(r.rate_date.getMonth() + 1).padStart(2, '0')}-${String(r.rate_date.getDate()).padStart(2, '0')}` : r.rate_date };
// A new rate, or a changed rate or basis, is written to the unit type's rate history
const rateNote = (c: any, row: any, userId?: string) => row?.base_rate_sqft == null ? null : c.query(
  `INSERT INTO unit_type_rate_history (unit_type_id, project_id, base_rate, rate_basis, rate_date, changed_by) VALUES ($1,$2,$3,$4,$5,$6)`,
  [row.id, row.project_id, row.base_rate_sqft, row.rate_basis, row.rate_date, userId || null]);
const RATE_BASIS = ['Super Area', 'Carpet Area', 'Built Up Area', 'Plot Area'] as const;
const PAYMENT_FILE_AREAS = ['Super Area', 'Carpet Area', 'Built Up Area', 'UDSL Area', 'Plot Area', 'Balcony Area'] as const;
const UT_EXTRA_KEYS = ['super_area_sqft', 'built_up_area_sqft', 'udsl_area_sqft', 'plot_area', 'plot_area_unit', 'group_name', 'rate_type', 'area_type', 'rate_basis', 'show_on_payment_file', 'construction_cost', 'udsl_cost', 'unit_of_measurement', 'rate_date', 'unit_map_url'];
const unitTypeExtras = async (rb: any, cur: any, base: { carpet: number | null; balcony: number | null; rate?: number | null }) => {
  const pickN = (k: string, label: string, max: number, dec: number) => k in rb ? (inHas(rb[k]) ? inNum(rb[k], label, max, dec) : null) : cur && cur[k] != null ? Number(cur[k]) : null;
  const pickT = (k: string, label: string, max: number) => k in rb ? inText(rb[k], label, max, false) : cur ? cur[k] ?? null : null;
  const x: Record<string, any> = {
    super_area_sqft: pickN('super_area_sqft', 'Super area', 1_000_000, 4), built_up_area_sqft: pickN('built_up_area_sqft', 'Built-up area', 1_000_000, 4),
    udsl_area_sqft: pickN('udsl_area_sqft', 'UDSL area', 1_000_000, 4), plot_area: pickN('plot_area', 'Plot area', 1_000_000_000, 4),
    construction_cost: pickN('construction_cost', 'Construction cost', 10_000_000_000, 2), udsl_cost: pickN('udsl_cost', 'UDSL cost', 10_000_000_000, 2),
    group_name: pickT('group_name', 'Group', 100), unit_map_url: pickT('unit_map_url', 'Unit map', 500),
    rate_date: 'rate_date' in rb ? inDay(rb.rate_date, 'Rate date') : cur?.rate_date ? (cur.rate_date instanceof Date ? `${cur.rate_date.getFullYear()}-${String(cur.rate_date.getMonth() + 1).padStart(2, '0')}-${String(cur.rate_date.getDate()).padStart(2, '0')}` : String(cur.rate_date).slice(0, 10)) : null, // a DATE column arrives as a Date at local midnight
    rate_type: 'rate_type' in rb ? inOneOf(rb.rate_type, 'Type', ['Per Area', 'In Fix'] as const) : cur?.rate_type ?? 'Per Area',
    area_type: 'area_type' in rb ? inOneOf(rb.area_type, 'Area type', ['Salable', 'Non Salable'] as const) : cur?.area_type ?? 'Salable',
    rate_basis: 'rate_basis' in rb ? inOneOf(rb.rate_basis, 'Effective rate on', RATE_BASIS) : cur?.rate_basis ?? 'Carpet Area',
    unit_of_measurement: pickT('unit_of_measurement', 'Unit of measurement', 50), plot_area_unit: pickT('plot_area_unit', 'Plot area unit', 50),
  };
  if (x.rate_type === null) x.rate_type = 'Per Area'; if (x.area_type === null) x.area_type = 'Salable'; if (x.rate_basis === null) x.rate_basis = 'Carpet Area';
  if ('show_on_payment_file' in rb) {
    const a = rb.show_on_payment_file;
    if (!Array.isArray(a) || a.length > 6 || a.some((v: any) => !(PAYMENT_FILE_AREAS as readonly string[]).includes(v)) || new Set(a).size !== a.length) throw bad(`Areas to show on the payment file must be some of: ${PAYMENT_FILE_AREAS.join(', ')}`);
    x.show_on_payment_file = a;
  } else x.show_on_payment_file = cur?.show_on_payment_file ?? [];
  for (const k of ['unit_of_measurement', 'plot_area_unit']) if (x[k] && !(await db.query('SELECT 1 FROM area_types WHERE lower(name) = lower($1)', [x[k]])).rows.length) throw bad(`${k === 'plot_area_unit' ? 'Plot area unit' : 'Unit of measurement'} must be one of the Area Types in Set Master`);
  const a = { super: x.super_area_sqft, carpet: base.carpet, built: x.built_up_area_sqft, plot: x.plot_area };
  if (a.super !== null && a.carpet !== null && a.super < a.carpet) throw bad('Super area cannot be less than the carpet area');
  if (a.built !== null && a.carpet !== null && a.built < a.carpet) throw bad('Built-up area cannot be less than the carpet area');
  const need: Record<string, [string, number | null]> = { 'Super Area': ['Super area', a.super], 'Carpet Area': ['Carpet area', a.carpet], 'Built Up Area': ['Built-up area', a.built], 'Plot Area': ['Plot area', a.plot] };
  if (x.rate_type === 'Per Area' && base.rate && !(need[x.rate_basis][1] && need[x.rate_basis][1]! > 0)) throw bad(`The rate is charged on the ${need[x.rate_basis][0].toLowerCase()}, so it must be filled in`);
  const shown: Record<string, number | null> = { 'Super Area': a.super, 'Carpet Area': a.carpet, 'Built Up Area': a.built, 'UDSL Area': x.udsl_area_sqft, 'Plot Area': a.plot, 'Balcony Area': base.balcony };
  for (const k of x.show_on_payment_file) if (!(shown[k] && shown[k]! > 0)) throw bad(`${k} is chosen for the payment file but it is not filled in`);
  return x;
};
const sendErr = (err: any, res: Response, next: NextFunction) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
router.post('/unit-types', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rb = inBody(req); const projectId = inUuid(rb.project_id, 'Project'); const f = unitTypeInput(rb); const ex = await unitTypeExtras(rb, null, f);
    if (!(await db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length) throw Object.assign(bad('Project not found'), { http: 404 });
    const made = await inTxOnce(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('unittype|' || $1 || '|' || lower($2)))`, [projectId, f.name]);
      if ((await c.query('SELECT 1 FROM unit_types WHERE project_id = $1 AND lower(name) = lower($2)', [projectId, f.name])).rows.length) throw Object.assign(bad('A record with this name already exists'), { http: 409 });
      const ins = (await c.query(`INSERT INTO unit_types (project_id, name, description, carpet_area_sqft, balcony_area_sqft, base_rate_sqft, ${UT_EXTRA_KEYS.join(', ')}) VALUES ($1,$2,$3,$4,$5,$6, ${UT_EXTRA_KEYS.map((_, i) => '$' + (i + 7)).join(', ')}) RETURNING *`,
        [projectId, f.name, f.description, f.carpet, f.balcony, f.rate, ...UT_EXTRA_KEYS.map(k => ex[k])])).rows[0];
      await rateNote(c, ins, req.userId);
      return ins;
    });
    await auditChange(db, req, res, 'create', 'master.unit_types', made.id, undefined, made);
    res.status(201).json({ success: true, data: utOut(made) });
  } catch (err) { sendErr(err, res, next); }
});
router.put('/unit-types/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = inUuid(req.params.id, 'Unit type id'); const rb = inBody(req);
    const out = await inTxOnce(async (c) => {
      const cur = (await c.query('SELECT * FROM unit_types WHERE id = $1 FOR UPDATE', [uid])).rows[0];
      if (!cur) throw Object.assign(bad('Not found'), { http: 404 });
      const projectId = inHas(rb.project_id) ? inUuid(rb.project_id, 'Project') : cur.project_id;
      if (!Object.keys(rb).some(k => ['name', 'description', 'project_id', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft', ...UT_EXTRA_KEYS].includes(k))) throw bad('Nothing to update');
      const f = unitTypeInput(rb, cur); const ex = await unitTypeExtras(rb, cur, f);
      if (projectId !== cur.project_id) {
        // Units of the old project already use this type; moving it would leave them pointing at another project's type
        const n = Number((await c.query('SELECT count(*) AS n FROM units WHERE unit_type_id = $1', [uid])).rows[0].n);
        if (n) throw Object.assign(bad(`${n} unit(s) use this unit type, so it cannot be moved to another project.`), { http: 409 });
        if (!(await c.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length) throw Object.assign(bad('Project not found'), { http: 404 });
      }
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('unittype|' || $1 || '|' || lower($2)))`, [projectId, f.name]);
      if ((await c.query('SELECT 1 FROM unit_types WHERE project_id = $1 AND lower(name) = lower($2) AND id <> $3', [projectId, f.name, uid])).rows.length) throw Object.assign(bad('A record with this name already exists'), { http: 409 });
      const upd = (await c.query(`UPDATE unit_types SET project_id = $2, name = $3, description = $4, carpet_area_sqft = $5, balcony_area_sqft = $6, base_rate_sqft = $7, ${UT_EXTRA_KEYS.map((k, i) => `${k} = $${i + 8}`).join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
        [uid, projectId, f.name, f.description, f.carpet, f.balcony, f.rate, ...UT_EXTRA_KEYS.map(k => ex[k])])).rows[0];
      if (Number(cur.base_rate_sqft ?? -1) !== Number(upd.base_rate_sqft ?? -1) || cur.rate_basis !== upd.rate_basis || String(cur.rate_date ?? '') !== String(upd.rate_date ?? '')) await rateNote(c, upd, req.userId);
      // Units, the booking form and the Rate Report show the type by its name, so a renamed type renames them too
      if (cur.name !== upd.name) await c.query('UPDATE units SET bhk_type = $1 WHERE unit_type_id = $2', [upd.name, uid]);
      return { cur, upd };
    });
    await auditChange(db, req, res, 'update', 'master.unit_types', uid, out.cur, out.upd);
    res.json({ success: true, data: utOut(out.upd) });
  } catch (err) { sendErr(err, res, next); }
});
router.get('/unit-types/:id/rate-history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = (await db.query(`SELECT h.base_rate, h.rate_basis, h.rate_date::text AS rate_date, h.changed_at, u.name AS changed_by_name FROM unit_type_rate_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.unit_type_id = $1 ORDER BY h.changed_at DESC`, [inUuid(req.params.id, 'Unit type id')])).rows;
    res.json({ success: true, data: rows });
  } catch (err) { sendErr(err, res, next); }
});
// POST /api/master/unit-types/:id/apply-to-units  { preview? } - puts the type's areas and price (rate x the area it is charged on) on its units that are not booked yet
router.post('/unit-types/:id/apply-to-units', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = inUuid(req.params.id, 'Unit type id'), preview = inBody(req).preview === true;
    const out = await inTxOnce(async (c) => {
      const t = (await c.query('SELECT * FROM unit_types WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!t) throw Object.assign(bad('Not found'), { http: 404 });
      const units = (await c.query(`SELECT u.id, u.status, EXISTS (SELECT 1 FROM booking_records b WHERE b.unit_id = u.id AND COALESCE(b.status, '') <> 'cancelled') AS booked FROM units u WHERE u.unit_type_id = $1 FOR UPDATE OF u`, [id])).rows;
      const free = units.filter((u: any) => !u.booked && ['available', 'locked', 'held'].includes(u.status));
      const areaOf: Record<string, any> = { 'Super Area': t.super_area_sqft, 'Carpet Area': t.carpet_area_sqft, 'Built Up Area': t.built_up_area_sqft, 'Plot Area': t.plot_area };
      const area = areaOf[t.rate_basis], price = t.base_rate_sqft != null && area ? Math.round(Number(t.base_rate_sqft) * Number(area)) : null;
      let updated = 0;
      if (!preview && free.length) {
        updated = (await c.query(
          `UPDATE units SET bhk_type = $2, carpet_area_sqft = $3, super_area_sqft = $4, balcony_area_sqft = $5, base_price_inr = COALESCE($6::bigint, base_price_inr), total_price_inr = COALESCE($6::bigint, total_price_inr), updated_at = now() WHERE id = ANY($1::uuid[])`,
          [free.map((u: any) => u.id), t.name, t.carpet_area_sqft, t.super_area_sqft, t.balcony_area_sqft, price])).rowCount ?? 0;
      }
      return { matching: units.length, updatable: free.length, booked: units.length - free.length, updated, price };
    });
    if (!preview) await auditChange(db, req, res, 'update', 'master.unit_types', id, undefined, { applied_to_units: out.updated });
    res.json({ success: true, data: out });
  } catch (err) { sendErr(err, res, next); }
});
router.delete('/unit-types/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const uid = inUuid(req.params.id, 'Unit type id');
    const n = Number((await db.query('SELECT count(*) AS n FROM units WHERE unit_type_id = $1', [uid])).rows[0].n);
    if (n) return res.status(409).json({ error: `${n} unit(s) use this unit type. Change those units first.` });
    const result = await db.query('DELETE FROM unit_types WHERE id = $1 RETURNING *', [uid]);
    if (!result.rowCount) return res.status(404).json({ error: 'Not found' });
    await auditChange(db, req, res, 'delete', 'master.unit_types', uid, result.rows[0]);
    res.json({ success: true });
  } catch (err) { sendErr(err, res, next); }
});

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

// ─── Customer Classification per project ───
// A project with no list of its own uses the standard EWS / LIG / MIG; "defaults" copies them into the project so they can be changed.
const CLASS_DEFAULTS = ['EWS', 'LIG', 'MIG'];
const classProject = async (v: any) => { const id = inUuid(v, 'Project'); if (!(await db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length) throw Object.assign(bad('Project not found'), { http: 404 }); return id; };
router.get('/customer-classifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = inUuid(req.query.projectId, 'projectId');
    const rows = (await db.query('SELECT id, project_id, name FROM customer_classifications WHERE project_id = $1 ORDER BY name', [pid])).rows;
    res.json({ success: true, data: rows, using_defaults: !rows.length, defaults: CLASS_DEFAULTS });
  } catch (err) { sendErr(err, res, next); }
});
router.post('/customer-classifications/defaults', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = await classProject(inBody(req).project_id);
    const made = await inTxOnce(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [pid]);
      if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1', [pid])).rows.length) throw Object.assign(bad('This project already has its own list'), { http: 409 });
      return (await c.query(`INSERT INTO customer_classifications (project_id, name, created_by) SELECT $1, n, $2 FROM unnest($3::text[]) n RETURNING id, project_id, name`, [pid, req.userId || null, CLASS_DEFAULTS])).rows;
    });
    await auditChange(db, req, res, 'create', 'master.customer_classifications', pid, undefined, { names: CLASS_DEFAULTS });
    res.status(201).json({ success: true, data: made });
  } catch (err) { sendErr(err, res, next); }
});
router.post('/customer-classifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = inBody(req), pid = await classProject(b.project_id), name = inText(b.name, 'Name', 50, true)!;
    const made = await inTxOnce(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [pid]);
      if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1 AND lower(name) = lower($2)', [pid, name])).rows.length) throw Object.assign(bad('A classification with this name already exists in this project'), { http: 409 });
      // the first own name starts the project's list: keep the standard ones the existing customers may already carry
      if (!(await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1', [pid])).rows.length) await c.query(`INSERT INTO customer_classifications (project_id, name, created_by) SELECT $1, n, $2 FROM unnest($3::text[]) n WHERE lower(n) <> lower($4)`, [pid, req.userId || null, CLASS_DEFAULTS, name]);
      return (await c.query('INSERT INTO customer_classifications (project_id, name, created_by) VALUES ($1,$2,$3) RETURNING id, project_id, name', [pid, name, req.userId || null])).rows[0];
    });
    await auditChange(db, req, res, 'create', 'master.customer_classifications', made.id, undefined, made);
    res.status(201).json({ success: true, data: made });
  } catch (err) { sendErr(err, res, next); }
});
router.put('/customer-classifications/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = inUuid(req.params.id, 'Id'), name = inText(inBody(req).name, 'Name', 50, true)!;
    const out = await inTxOnce(async (c) => {
      const cur = (await c.query('SELECT * FROM customer_classifications WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!cur) throw Object.assign(bad('Classification not found'), { http: 404 });
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [cur.project_id]);
      if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1 AND lower(name) = lower($2) AND id <> $3', [cur.project_id, name, id])).rows.length) throw Object.assign(bad('A classification with this name already exists in this project'), { http: 409 });
      const upd = (await c.query('UPDATE customer_classifications SET name = $2 WHERE id = $1 RETURNING id, project_id, name', [id, name])).rows[0];
      // customers of this project that carry the old name follow the rename
      const moved = await c.query('UPDATE consumers SET income_category = $3, updated_at = now() WHERE project_id = $1 AND income_category = $2', [cur.project_id, cur.name, name]);
      return { cur, upd, moved: moved.rowCount };
    });
    await auditChange(db, req, res, 'update', 'master.customer_classifications', id, out.cur, out.upd);
    res.json({ success: true, data: out.upd, customers_updated: out.moved });
  } catch (err) { sendErr(err, res, next); }
});
router.delete('/customer-classifications/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = inUuid(req.params.id, 'Id');
    const cur = (await db.query('SELECT * FROM customer_classifications WHERE id = $1', [id])).rows[0];
    if (!cur) throw Object.assign(bad('Classification not found'), { http: 404 });
    const used = (await db.query('SELECT COUNT(*)::int AS n FROM consumers WHERE project_id = $1 AND income_category = $2', [cur.project_id, cur.name])).rows[0].n;
    if (used) throw Object.assign(bad(`${used} customer(s) of this project carry "${cur.name}", so it cannot be deleted`), { http: 409 });
    await db.query('DELETE FROM customer_classifications WHERE id = $1', [id]);
    await auditChange(db, req, res, 'delete', 'master.customer_classifications', id, cur);
    res.json({ success: true });
  } catch (err) { sendErr(err, res, next); }
});

router.use(pgErrorHandler);

export default router;
