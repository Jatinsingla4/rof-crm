"use strict";
/**
 * Master Data Routes
 * CRUD for: Countries, States, Cities, Banks, Salutations,
 *           Professions, Nationalities, Sources of Enquiry,
 *           Document Types, Document Dispatch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldLabel = void 0;
exports.badNumber = badNumber;
exports.cleanBody = cleanBody;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
// ─── Access control ──────────────────────────────────────────────────────────
// Reading masters is open to every signed-in user (booking, brokers and payments use these lists as dropdowns).
// Every change under /master, including a path added later, needs the master_data permission. Nothing is allow-listed
// by path, so a new write route cannot be left open by forgetting to list it.
const actionByMethod = { POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD')
        return next();
    if ((0, rbac_js_1.hasPermission)(req.userRole, 'master_data', actionByMethod[req.method] || 'edit'))
        return next();
    return res.status(403).json({ error: 'You do not have permission to change master data' });
});
// ─── Input helpers ───────────────────────────────────────────────────────────
// "towerName" or "base_rate_sqft" -> "Tower name" / "Base rate sqft" for messages shown to the user
const fieldLabel = (f) => {
    const s = f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};
exports.fieldLabel = fieldLabel;
// Returns a message when one of the listed fields is present but not a number of zero or more
function badNumber(values, fields = []) {
    for (const f of fields) {
        const v = values[f];
        if (v === undefined || v === null)
            continue;
        if (typeof v === 'boolean' || !Number.isFinite(Number(v)) || Number(v) < 0)
            return `${(0, exports.fieldLabel)(f)} must be a number, zero or more`;
    }
    return null;
}
// Strings are trimmed and blank strings become null. Objects and arrays are rejected.
const TEXT_FIELDS = new Set(['name', 'code', 'ifsc_prefix', 'branch', 'description', 'category', 'document_from',
    'required_at', 'document_type', 'dispatch_mode', 'tracking_no']);
// current: the stored row on update; an unchanged old value is not re-checked for markup
function cleanBody(body, fields, current) {
    const values = {};
    for (const f of fields) {
        let v = body?.[f];
        if (v === undefined)
            continue;
        if (typeof v === 'string') {
            v = v.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            if (v === '')
                v = null;
        }
        else if (v !== null && typeof v === 'object')
            return { error: `Invalid value for ${(0, exports.fieldLabel)(f)}` };
        if (v !== null && TEXT_FIELDS.has(f) && typeof v !== 'string')
            return { error: `Invalid value for ${(0, exports.fieldLabel)(f)}` };
        // Other pages put these names into dropdowns and letters as HTML, so markup characters are not accepted
        if (typeof v === 'string' && /[<>]/.test(v) && !(current && current[f] === v))
            return { error: `${(0, exports.fieldLabel)(f)} cannot contain < or >` };
        values[f] = v;
    }
    return { values };
}
// Case-insensitive duplicate check on name, optionally inside a parent (state inside country, city inside state)
async function isDuplicate(table, scope, values, excludeId) {
    if (typeof values.name !== 'string')
        return false;
    const params = [values.name];
    let sql = `SELECT 1 FROM ${table} WHERE lower(name) = lower($1)`;
    for (const col of scope) {
        params.push(values[col] ?? null);
        sql += ` AND ${col} IS NOT DISTINCT FROM $${params.length}`;
    }
    if (excludeId) {
        params.push(excludeId);
        sql += ` AND id <> $${params.length}`;
    }
    return (await index_js_1.db.query(sql, params)).rows.length > 0;
}
// ─── Generic list/add/delete helper ──────────────────────────────────────────
// opts.unique: parent columns for the duplicate name check (omit to skip the check); opts.required: extra mandatory fields
function listRoute(table, orderBy = 'name') {
    return async (req, res, next) => {
        try {
            const result = await index_js_1.db.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
            res.json({ success: true, data: result.rows });
        }
        catch (err) {
            next(err);
        }
    };
}
function addRoute(table, fields, opts = {}) {
    return async (req, res, next) => {
        try {
            const cleaned = cleanBody(req.body, fields);
            if ('error' in cleaned)
                return res.status(400).json({ error: cleaned.error });
            const { values } = cleaned;
            if (fields.includes('name') && !values.name)
                return res.status(400).json({ error: 'Name is required' });
            for (const r of opts.required || [])
                if (!values[r])
                    return res.status(400).json({ error: `${(0, exports.fieldLabel)(r)} is required` });
            if (opts.maxLen && typeof values.name === 'string' && values.name.length > opts.maxLen)
                return res.status(400).json({ error: `Name can be at most ${opts.maxLen} characters` });
            const numberError = badNumber(values, opts.nonNegative);
            if (numberError)
                return res.status(400).json({ error: numberError });
            if (opts.unique && await isDuplicate(table, opts.unique, values)) {
                return res.status(409).json({ error: 'A record with this name already exists' });
            }
            const result = await index_js_1.db.query(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, fields.map(f => values[f] ?? null));
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', `master.${table}`, result.rows[0].id, undefined, result.rows[0]);
            res.status(201).json({ success: true, data: result.rows[0] });
        }
        catch (err) {
            next(err);
        }
    };
}
// opts.inUse: returns a message when the record is still referenced, which blocks the delete
function deleteRoute(table, opts = {}) {
    return async (req, res, next) => {
        try {
            const blocked = opts.inUse ? await opts.inUse(req.params.id) : null;
            if (blocked)
                return res.status(409).json({ error: blocked });
            const result = await index_js_1.db.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [req.params.id]);
            if (!result.rowCount)
                return res.status(404).json({ error: 'Not found' });
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', `master.${table}`, req.params.id, result.rows[0]);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    };
}
// Only the fields present in the request are changed
function updateRoute(table, fields, opts = {}) {
    return async (req, res, next) => {
        try {
            const current = (await index_js_1.db.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id])).rows[0];
            if (!current)
                return res.status(404).json({ error: 'Not found' });
            const cleaned = cleanBody(req.body, fields, current);
            if ('error' in cleaned)
                return res.status(400).json({ error: cleaned.error });
            const { values } = cleaned;
            const keys = Object.keys(values);
            if (!keys.length)
                return res.status(400).json({ error: 'Nothing to update' });
            if ('name' in values && !values.name)
                return res.status(400).json({ error: 'Name is required' });
            for (const r of opts.required || [])
                if (r in values && !values[r])
                    return res.status(400).json({ error: `${(0, exports.fieldLabel)(r)} is required` });
            if (opts.maxLen && typeof values.name === 'string' && values.name.length > opts.maxLen)
                return res.status(400).json({ error: `Name can be at most ${opts.maxLen} characters` });
            const numberError = badNumber(values, opts.nonNegative);
            if (numberError)
                return res.status(400).json({ error: numberError });
            // Renaming a list item that other records hold as text would split their data, so it is refused while in use
            if (opts.inUse && typeof values.name === 'string' && values.name !== current.name) {
                const blocked = await opts.inUse(req.params.id);
                if (blocked)
                    return res.status(409).json({ error: blocked.replace('before deleting this', 'before renaming this') });
            }
            if (opts.unique) {
                if (await isDuplicate(table, opts.unique, { ...current, ...values }, req.params.id)) {
                    return res.status(409).json({ error: 'A record with this name already exists' });
                }
            }
            const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const result = await index_js_1.db.query(`UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => values[k]), req.params.id]);
            if (!result.rows[0])
                return res.status(404).json({ error: 'Not found' });
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', `master.${table}`, req.params.id, current, result.rows[0]);
            res.json({ success: true, data: result.rows[0] });
        }
        catch (err) {
            next(err);
        }
    };
}
const countOf = async (sql, id) => (await index_js_1.db.query(sql, [id])).rows[0].n;
// These lists are stored as plain text on other records. Returns how many records carry this item's name.
// The table and column names below are fixed in code, never taken from a request.
async function textUsage(table, id, usedIn) {
    const row = (await index_js_1.db.query(`SELECT name FROM ${table} WHERE id = $1`, [id])).rows[0];
    if (!row)
        return null;
    let n = 0;
    for (const [t, col] of usedIn)
        n += Number((await index_js_1.db.query(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = $1`, [row.name])).rows[0].n);
    return { name: row.name, n };
}
const PERSON_TABLES = (col) => [['consumers', col], ['co_applicants', col], ['applicant_details', col]];
const inUseByText = (table, label, usedIn) => async (id) => {
    const u = await textUsage(table, id, usedIn);
    return u && u.n ? `"${u.name}" is used on ${u.n} record(s). Remove it from them before deleting this ${label}.` : null;
};
// ─── COUNTRIES ────────────────────────────────────────────────────────────────
router.get('/countries', listRoute('countries', 'name'));
router.post('/countries', addRoute('countries', ['name', 'code'], { unique: [] }));
router.put('/countries/:id', updateRoute('countries', ['name', 'code'], { unique: [] }));
router.delete('/countries/:id', deleteRoute('countries', {
    inUse: async (id) => {
        const n = await countOf('SELECT COUNT(*)::int AS n FROM states WHERE country_id = $1', id);
        return n ? `This country has ${n} state(s). Delete them first.` : null;
    },
}));
// ─── STATES ───────────────────────────────────────────────────────────────────
router.get('/states', async (req, res, next) => {
    try {
        const { country_id } = req.query;
        const where = country_id ? `WHERE s.country_id = $1` : '';
        const params = country_id ? [country_id] : [];
        const result = await index_js_1.db.query(`SELECT s.*, c.name as country_name
       FROM states s JOIN countries c ON c.id = s.country_id
       ${where} ORDER BY s.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/states', addRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'] }));
router.put('/states/:id', updateRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'] }));
router.delete('/states/:id', deleteRoute('states', {
    inUse: async (id) => {
        const n = await countOf('SELECT COUNT(*)::int AS n FROM cities WHERE state_id = $1', id);
        return n ? `This state has ${n} city(ies). Delete them first.` : null;
    },
}));
// ─── CITIES ───────────────────────────────────────────────────────────────────
router.get('/cities', async (req, res, next) => {
    try {
        const { state_id } = req.query;
        const where = state_id ? `WHERE ci.state_id = $1` : '';
        const params = state_id ? [state_id] : [];
        const result = await index_js_1.db.query(`SELECT ci.*, s.name as state_name, c.name as country_name
       FROM cities ci
       JOIN states s ON s.id = ci.state_id
       JOIN countries c ON c.id = s.country_id
       ${where} ORDER BY ci.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/cities', addRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'] }));
router.put('/cities/:id', updateRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'] }));
router.delete('/cities/:id', deleteRoute('cities'));
// ─── BANKS ────────────────────────────────────────────────────────────────────
router.get('/banks', listRoute('banks', 'name'));
router.post('/banks', addRoute('banks', ['name', 'ifsc_prefix', 'branch'], { unique: [] }));
router.put('/banks/:id', updateRoute('banks', ['name', 'ifsc_prefix', 'branch'], { unique: [] }));
router.delete('/banks/:id', deleteRoute('banks', {
    inUse: async (id) => {
        const n = await countOf('SELECT COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id = $1', id);
        return n ? `This bank is the clearing bank on ${n} receipt(s) and cannot be deleted.` : null;
    },
}));
// ─── SALUTATIONS ──────────────────────────────────────────────────────────────
router.get('/salutations', listRoute('salutations', 'name'));
router.post('/salutations', addRoute('salutations', ['name'], { unique: [], maxLen: 20 }));
router.put('/salutations/:id', updateRoute('salutations', ['name'], { unique: [], maxLen: 20, inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
router.delete('/salutations/:id', deleteRoute('salutations', { inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
// ─── PROFESSIONS ──────────────────────────────────────────────────────────────
router.get('/professions', listRoute('professions', 'name'));
router.post('/professions', addRoute('professions', ['name'], { unique: [] }));
router.put('/professions/:id', updateRoute('professions', ['name'], { unique: [], inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));
router.delete('/professions/:id', deleteRoute('professions', { inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));
// ─── NATIONALITIES ────────────────────────────────────────────────────────────
router.get('/nationalities', listRoute('nationalities', 'name'));
router.post('/nationalities', addRoute('nationalities', ['name'], { unique: [] }));
router.put('/nationalities/:id', updateRoute('nationalities', ['name'], { unique: [], inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));
router.delete('/nationalities/:id', deleteRoute('nationalities', { inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));
// ─── SOURCES OF ENQUIRY ───────────────────────────────────────────────────────
router.get('/sources-of-enquiry', listRoute('sources_of_enquiry', 'name'));
router.post('/sources-of-enquiry', addRoute('sources_of_enquiry', ['name', 'description'], { unique: [] }));
router.put('/sources-of-enquiry/:id', updateRoute('sources_of_enquiry', ['name', 'description'], { unique: [], inUse: inUseByText('sources_of_enquiry', 'source', [['consumers', 'source_of_enquiry']]) }));
router.delete('/sources-of-enquiry/:id', deleteRoute('sources_of_enquiry', { inUse: inUseByText('sources_of_enquiry', 'source', [['consumers', 'source_of_enquiry']]) }));
// ─── DOCUMENT TYPES ───────────────────────────────────────────────────────────
router.get('/document-types', async (req, res, next) => {
    try {
        const { project_id } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (project_id) {
            params.push(project_id);
            where += ` AND (dt.project_id = $${params.length} OR dt.project_id IS NULL)`;
        }
        const result = await index_js_1.db.query(`
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
    }
    catch (err) {
        next(err);
    }
});
const DOCUMENT_FROM = ['Individual', 'Firm or Company'];
const REQUIRED_AT = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Demand', 'Other'];
// Shared checks for create and update. Returns an error message or null.
async function documentTypeError(v) {
    if (v.document_from != null && !DOCUMENT_FROM.includes(v.document_from))
        return 'Invalid Document From';
    if (v.required_at != null && !REQUIRED_AT.includes(v.required_at))
        return 'Invalid Document Type';
    if (v.is_mandatory != null && typeof v.is_mandatory !== 'boolean')
        return 'Invalid Mandatory value';
    if (typeof v.description === 'string' && v.description.length > 500)
        return 'Description is longer than 500 characters';
    if (v.project_id) {
        const found = await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [v.project_id]);
        if (!found.rows.length)
            return 'Project not found';
    }
    return null;
}
const DOCUMENT_TYPE_FIELDS = ['name', 'category', 'description', 'project_id', 'document_from', 'is_mandatory', 'required_at'];
router.post('/document-types', async (req, res, next) => {
    try {
        const cleaned = cleanBody(req.body, DOCUMENT_TYPE_FIELDS);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const v = cleaned.values;
        if (!v.name)
            return res.status(400).json({ error: 'Document name required' });
        if (!v.required_at)
            return res.status(400).json({ error: 'Document Type required' });
        const invalid = await documentTypeError(v);
        if (invalid)
            return res.status(400).json({ error: invalid });
        if (await isDuplicate('document_types', [], v))
            return res.status(409).json({ error: 'A document with this name already exists' });
        const result = await index_js_1.db.query(`INSERT INTO document_types
         (name, category, description, project_id, document_from, is_mandatory, required_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`, [v.name, v.category ?? null, v.description ?? null, v.project_id ?? null,
            v.document_from ?? 'Individual', v.is_mandatory ?? false, v.required_at]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.document_types', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// Only the fields present in the request are changed (the edit form does not send category)
router.put('/document-types/:id', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const { id } = req.params;
        const cleaned = cleanBody(req.body, DOCUMENT_TYPE_FIELDS);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const v = cleaned.values;
        if ('name' in v && !v.name)
            return res.status(400).json({ error: 'Document name required' });
        if ('required_at' in v && !v.required_at)
            return res.status(400).json({ error: 'Document Type required' });
        // These columns have defaults on create, so an explicit null on update means "leave as is"
        for (const k of ['document_from', 'is_mandatory'])
            if (k in v && v[k] === null)
                delete v[k];
        const invalid = await documentTypeError(v);
        if (invalid)
            return res.status(400).json({ error: invalid });
        if (v.name && await isDuplicate('document_types', [], v, id)) {
            return res.status(409).json({ error: 'A document with this name already exists' });
        }
        await client.query('BEGIN');
        const oldRes = await client.query(`SELECT * FROM document_types WHERE id = $1 FOR UPDATE`, [id]);
        if (!oldRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document type not found' });
        }
        const oldName = oldRes.rows[0].name;
        const keys = Object.keys(v);
        if (!keys.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Nothing to update' });
        }
        const result = await client.query(`UPDATE document_types SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => v[k]), id]);
        const newName = result.rows[0].name;
        if (oldName && newName && oldName !== newName) {
            await client.query(`UPDATE booking_documents  SET document_type = $1 WHERE document_type = $2`, [newName, oldName]);
            await client.query(`UPDATE document_dispatch  SET document_type = $1 WHERE document_type = $2`, [newName, oldName]);
        }
        await client.query('COMMIT');
        // Audited on the same connection: asking the pool for a second one while holding this one can deadlock a busy pool
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'master.document_types', id, oldRes.rows[0], result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        client.release();
    }
});
router.delete('/document-types/:id', deleteRoute('document_types', {
    inUse: async (id) => {
        const row = (await index_js_1.db.query('SELECT name FROM document_types WHERE id = $1', [id])).rows[0];
        if (!row)
            return null;
        const n = (await index_js_1.db.query(`SELECT (SELECT COUNT(*) FROM booking_documents WHERE document_type = $1)
            + (SELECT COUNT(*) FROM document_dispatch WHERE document_type = $1) AS n`, [row.name])).rows[0].n;
        return Number(n) ? `This document type is used in ${n} booking document or dispatch record(s) and cannot be deleted.` : null;
    },
}));
// ─── DOCUMENT DISPATCH ────────────────────────────────────────────────────────
const DISPATCH_MODES = ['Courier', 'Speed Post', 'Registered Post', 'Hand Delivery', 'Email', 'Other'];
// Shared checks for create and update. Returns an error message or null.
async function dispatchError(v) {
    if ('document_type' in v && !v.document_type)
        return 'Document type required';
    if (typeof v.document_type === 'string' && v.document_type.length > 150)
        return 'Document type is longer than 150 characters';
    if ('dispatch_mode' in v && !v.dispatch_mode)
        return 'Dispatch mode required';
    if (v.dispatch_mode != null && !DISPATCH_MODES.includes(v.dispatch_mode))
        return 'Invalid dispatch mode';
    if (typeof v.tracking_no === 'string' && v.tracking_no.length > 100)
        return 'Tracking number is longer than 100 characters';
    if (v.dispatched_at != null) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.dispatched_at)) || Number.isNaN(Date.parse(String(v.dispatched_at))))
            return 'Date dispatched must be a date like 2026-01-31';
        if (String(v.dispatched_at) > new Date(Date.now() + 86400000).toISOString().slice(0, 10))
            return 'Date dispatched cannot be in the future';
    }
    if (v.consumer_id != null) {
        if (!/^[0-9a-f-]{36}$/i.test(String(v.consumer_id)))
            return 'Consumer not found';
        if (!(await index_js_1.db.query('SELECT 1 FROM consumers WHERE id = $1', [v.consumer_id])).rows.length)
            return 'Consumer not found';
    }
    return null;
}
const DISPATCH_FIELDS = ['document_type', 'dispatch_mode', 'tracking_no', 'consumer_id', 'dispatched_at'];
// Search (document, tracking number, consumer), consumer, date range; newest first; 50 per page
router.get('/document-dispatch', async (req, res, next) => {
    try {
        const { q, consumer_id, from, to } = req.query;
        const size = Math.min(Math.max(Math.floor(Number(req.query.pageSize)) || 50, 1), 200);
        const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);
        const where = [];
        const params = [];
        const add = (sql, v) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)); };
        if (consumer_id) {
            if (!/^[0-9a-f-]{36}$/i.test(String(consumer_id)))
                return res.status(400).json({ error: 'Invalid consumer_id' });
            add('dd.consumer_id = ?', consumer_id);
        }
        if (q)
            add('(dd.document_type ILIKE ? OR dd.tracking_no ILIKE ? OR c.name ILIKE ?)', `%${String(q).replace(/[\\%_]/g, (m) => '\\' + m)}%`);
        for (const [name, v, sql] of [['from', from, 'COALESCE(dd.dispatched_at, dd.created_at) >= ?::date'], ['to', to, 'COALESCE(dd.dispatched_at, dd.created_at) < (?::date + 1)']]) {
            if (!v)
                continue;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v))))
                return res.status(400).json({ error: `${name} must be a date like 2026-01-31` });
            add(sql, v);
        }
        params.push(size + 1, (page - 1) * size);
        const result = await index_js_1.db.query(`
      SELECT dd.*, c.name as consumer_name
      FROM document_dispatch dd
      LEFT JOIN consumers c ON c.id = dd.consumer_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY COALESCE(dd.dispatched_at, dd.created_at) DESC, dd.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
        res.json({ success: true, data: result.rows.slice(0, size), has_more: result.rows.length > size });
    }
    catch (err) {
        next(err);
    }
});
router.post('/document-dispatch', async (req, res, next) => {
    try {
        const cleaned = cleanBody(req.body, DISPATCH_FIELDS);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const v = cleaned.values;
        if (!v.document_type)
            return res.status(400).json({ error: 'Document type required' });
        if (!v.dispatch_mode)
            return res.status(400).json({ error: 'Dispatch mode required' });
        const invalid = await dispatchError(v);
        if (invalid)
            return res.status(400).json({ error: invalid });
        const result = await index_js_1.db.query(`INSERT INTO document_dispatch (document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [v.document_type, v.dispatch_mode, v.tracking_no ?? null, v.consumer_id ?? null, v.dispatched_at ?? null, req.userId]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.document_dispatch', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// Correct a typing mistake (tracking number, mode, date) without deleting the entry
router.put('/document-dispatch/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!/^[0-9a-f-]{36}$/i.test(id))
            return res.status(404).json({ error: 'Dispatch entry not found' });
        const cleaned = cleanBody(req.body, DISPATCH_FIELDS);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const v = cleaned.values;
        const keys = Object.keys(v);
        if (!keys.length)
            return res.status(400).json({ error: 'Nothing to update' });
        const invalid = await dispatchError(v);
        if (invalid)
            return res.status(400).json({ error: invalid });
        const old = (await index_js_1.db.query('SELECT * FROM document_dispatch WHERE id = $1', [id])).rows[0];
        if (!old)
            return res.status(404).json({ error: 'Dispatch entry not found' });
        const result = await index_js_1.db.query(`UPDATE document_dispatch SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map((k) => v[k]), id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.document_dispatch', id, old, result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/document-dispatch/:id', deleteRoute('document_dispatch'));
// ─── REMINDER MASTER ──────────────────────────────────────────────────────────
// Table uses: reminder_name, days (not name/days_before/channel)
// Return aliases so frontend receives: id, name, days_before, channel
router.get('/reminder-master', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT id, reminder_name AS name, days AS days_before,
              COALESCE(prefix_name, 'all') AS channel, is_active, created_at
       FROM reminder_master ORDER BY days`);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/reminder-master', async (req, res, next) => {
    try {
        const rb = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(rb.name, 'Name', 200, true);
        if (!(0, input_js_1.has)(rb.days_before))
            throw (0, input_js_1.bad)('name and days_before are required');
        const days = (0, input_js_1.num)(rb.days_before, 'Days before', 3650, 0);
        const channel = (0, input_js_1.text)(rb.channel, 'Channel', 100, false);
        const result = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('reminder|' || lower($1) || '|' || $2))`, [name, days]);
            if ((await c.query('SELECT 1 FROM reminder_master WHERE lower(reminder_name) = lower($1) AND days = $2', [name, days])).rows.length) {
                throw Object.assign((0, input_js_1.bad)('A reminder with this name and days already exists'), { http: 409 });
            }
            return c.query(`INSERT INTO reminder_master (reminder_name, days, prefix_name)
         VALUES ($1, $2, $3) RETURNING id, reminder_name AS name, days AS days_before, COALESCE(prefix_name,'all') AS channel`, [name, days, channel]);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.reminder_master', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        err?.http ? res.status(err.http).json({ error: err.message }) : next(err);
    }
});
router.delete('/reminder-master/:id', deleteRoute('reminder_master'));
// ─── UNIT TYPES ───────────────────────────────────────────────────────────────
router.get('/unit-types', async (req, res, next) => {
    try {
        const project_id = (0, input_js_1.has)(req.query.project_id) ? (0, input_js_1.uuid)(req.query.project_id, 'project_id') : null;
        const where = project_id ? `WHERE ut.project_id = $1` : '';
        const params = project_id ? [project_id] : [];
        const result = await index_js_1.db.query(`SELECT ut.*, p.name as project_name FROM unit_types ut JOIN projects p ON p.id = ut.project_id ${where} ORDER BY ut.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
// Unit types: areas to 2 decimals, the base rate in whole rupees per sq ft; one name per project (any letter case)
const unitTypeInput = (rb, cur) => {
    const name = 'name' in rb || !cur ? (0, input_js_1.text)(rb.name, 'Name', 100, true) : cur.name;
    const description = 'description' in rb ? (0, input_js_1.text)(rb.description, 'Description', 1000, false) : cur ? cur.description : null;
    const pick = (k, col, label, max, dec) => k in rb ? ((0, input_js_1.has)(rb[k]) ? (0, input_js_1.num)(rb[k], label, max, dec) : null) : cur ? (cur[col] == null ? null : Number(cur[col])) : null;
    return { name, description, carpet: pick('carpet_area_sqft', 'carpet_area_sqft', 'Carpet area', 1000000, 2), balcony: pick('balcony_area_sqft', 'balcony_area_sqft', 'Balcony area', 1000000, 2), rate: pick('base_rate_sqft', 'base_rate_sqft', 'Base rate', 1000000, 0) };
};
const sendErr = (err, res, next) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
router.post('/unit-types', async (req, res, next) => {
    try {
        const rb = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(rb.project_id, 'Project');
        const f = unitTypeInput(rb);
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
            throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 });
        const made = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('unittype|' || $1 || '|' || lower($2)))`, [projectId, f.name]);
            if ((await c.query('SELECT 1 FROM unit_types WHERE project_id = $1 AND lower(name) = lower($2)', [projectId, f.name])).rows.length)
                throw Object.assign((0, input_js_1.bad)('A record with this name already exists'), { http: 409 });
            return (await c.query(`INSERT INTO unit_types (project_id, name, description, carpet_area_sqft, balcony_area_sqft, base_rate_sqft) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [projectId, f.name, f.description, f.carpet, f.balcony, f.rate])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.unit_types', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.put('/unit-types/:id', async (req, res, next) => {
    try {
        const uid = (0, input_js_1.uuid)(req.params.id, 'Unit type id');
        const rb = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query('SELECT * FROM unit_types WHERE id = $1 FOR UPDATE', [uid])).rows[0];
            if (!cur)
                throw Object.assign((0, input_js_1.bad)('Not found'), { http: 404 });
            const projectId = (0, input_js_1.has)(rb.project_id) ? (0, input_js_1.uuid)(rb.project_id, 'Project') : cur.project_id;
            if (!Object.keys(rb).some(k => ['name', 'description', 'project_id', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft'].includes(k)))
                throw (0, input_js_1.bad)('Nothing to update');
            const f = unitTypeInput(rb, cur);
            if (projectId !== cur.project_id) {
                // Units of the old project already use this type; moving it would leave them pointing at another project's type
                const n = Number((await c.query('SELECT count(*) AS n FROM units WHERE unit_type_id = $1', [uid])).rows[0].n);
                if (n)
                    throw Object.assign((0, input_js_1.bad)(`${n} unit(s) use this unit type, so it cannot be moved to another project.`), { http: 409 });
                if (!(await c.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
                    throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 });
            }
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('unittype|' || $1 || '|' || lower($2)))`, [projectId, f.name]);
            if ((await c.query('SELECT 1 FROM unit_types WHERE project_id = $1 AND lower(name) = lower($2) AND id <> $3', [projectId, f.name, uid])).rows.length)
                throw Object.assign((0, input_js_1.bad)('A record with this name already exists'), { http: 409 });
            const upd = (await c.query(`UPDATE unit_types SET project_id = $2, name = $3, description = $4, carpet_area_sqft = $5, balcony_area_sqft = $6, base_rate_sqft = $7, updated_at = now() WHERE id = $1 RETURNING *`, [uid, projectId, f.name, f.description, f.carpet, f.balcony, f.rate])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.unit_types', uid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.delete('/unit-types/:id', async (req, res, next) => {
    try {
        const uid = (0, input_js_1.uuid)(req.params.id, 'Unit type id');
        const n = Number((await index_js_1.db.query('SELECT count(*) AS n FROM units WHERE unit_type_id = $1', [uid])).rows[0].n);
        if (n)
            return res.status(409).json({ error: `${n} unit(s) use this unit type. Change those units first.` });
        const result = await index_js_1.db.query('DELETE FROM unit_types WHERE id = $1 RETURNING *', [uid]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'master.unit_types', uid, result.rows[0]);
        res.json({ success: true });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
// ─── FLOORS ───────────────────────────────────────────────────────────────────
router.get('/floors', async (req, res, next) => {
    try {
        const { tower_id } = req.query;
        const where = tower_id ? `WHERE f.tower_id = $1` : '';
        const params = tower_id ? [tower_id] : [];
        const result = await index_js_1.db.query(`SELECT f.*, t.tower_name FROM floors f JOIN towers t ON t.id = f.tower_id ${where} ORDER BY f.floor_number`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/floors', addRoute('floors', ['tower_id', 'floor_number', 'floor_name']));
router.put('/floors/:id', updateRoute('floors', ['tower_id', 'floor_number', 'floor_name']));
router.delete('/floors/:id', deleteRoute('floors'));
// ─── TAX SLABS ────────────────────────────────────────────────────────────────
router.get('/tax-slabs', listRoute('tax_slabs', 'name'));
router.post('/tax-slabs', addRoute('tax_slabs', ['name', 'cgst_percent', 'sgst_percent', 'igst_percent', 'effective_from', 'is_active']));
router.put('/tax-slabs/:id', updateRoute('tax_slabs', ['name', 'cgst_percent', 'sgst_percent', 'igst_percent', 'effective_from', 'is_active']));
router.delete('/tax-slabs/:id', deleteRoute('tax_slabs'));
// ─── USAGE COUNTS ─────────────────────────────────────────────────────────────
// How many records use each list item, so the screen can show it and disable Delete.
// Applicant lists are stored as text, banks by id. Table and column names are fixed in code.
const usageByName = async (col, tables) => {
    const union = tables.map(t => `SELECT ${col} AS k FROM ${t}`).join(' UNION ALL ');
    const rows = (await index_js_1.db.query(`SELECT k, COUNT(*)::int AS n FROM (${union}) u WHERE k IS NOT NULL GROUP BY k`)).rows;
    return Object.fromEntries(rows.map(r => [r.k, r.n]));
};
router.get('/usage', async (req, res, next) => {
    try {
        const people = ['consumers', 'co_applicants', 'applicant_details'];
        const [salutations, professions, nationalities, sources, banks] = await Promise.all([
            usageByName('salutation', people),
            usageByName('profession', people),
            usageByName('nationality', people),
            usageByName('source_of_enquiry', ['consumers']),
            index_js_1.db.query(`SELECT clearing_bank_id AS k, COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id IS NOT NULL GROUP BY 1`),
        ]);
        res.json({ success: true, data: { salutations, professions, nationalities, sources, banks: Object.fromEntries(banks.rows.map(r => [r.k, r.n])) } });
    }
    catch (err) {
        next(err);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=master.js.map