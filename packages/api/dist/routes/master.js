"use strict";
/**
 * Master Data Routes
 * CRUD for: Countries, States, Cities, Banks, Salutations,
 *           Professions, Nationalities, Sources of Enquiry,
 *           Document Types, Document Dispatch
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldLabel = void 0;
exports.tooLong = tooLong;
exports.badNumber = badNumber;
exports.cleanBody = cleanBody;
const unit_type_price_js_1 = require("../utils/unit-type-price.js");
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pool_js_1 = require("../db/pool.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
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
// A login limited to some projects (assigned_project_ids) must not change a record that applies to every project:
// row level security treats a row with no project as visible and writable to all, so the route has to refuse it.
// Create needs a project in the body; change and delete look at the stored row; moving a row to "no project" is refused too.
const GLOBAL_DENIED = 'Your login is limited to some projects, so it cannot change a record that applies to every project. Ask an administrator.';
const globalGuard = (table) => async (req, res, next) => {
    try {
        if (!(0, pool_js_1.isScoped)())
            return next();
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        if (req.method === 'POST')
            return b.project_id ? next() : res.status(403).json({ error: GLOBAL_DENIED });
        if ('project_id' in b && !b.project_id && req.method !== 'DELETE')
            return res.status(403).json({ error: GLOBAL_DENIED });
        if (!/^[0-9a-f-]{36}$/i.test(req.params.id))
            return next();
        const row = (await index_js_1.db.query(`SELECT project_id FROM ${table} WHERE id = $1`, [req.params.id])).rows[0];
        if (row && row.project_id === null)
            return res.status(403).json({ error: GLOBAL_DENIED });
        next();
    }
    catch (err) {
        next(err);
    }
};
// ─── Input helpers ───────────────────────────────────────────────────────────
// "towerName" or "base_rate_sqft" -> "Tower name" / "Base rate sqft" for messages shown to the user
const fieldLabel = (f) => {
    const s = f.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};
exports.fieldLabel = fieldLabel;
// Returns a message when one of the listed fields is present but not a number of zero or more
// Longest text each column holds (from the schema), checked here so the message names the field
function tooLong(values, lens = {}) {
    for (const [f, n] of Object.entries(lens))
        if (typeof values[f] === 'string' && values[f].length > n)
            return `${(0, exports.fieldLabel)(f)} can be at most ${n} characters`;
    return null;
}
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
    'required_at', 'document_type', 'dispatch_mode', 'tracking_no', 'abbreviation', 'iso_code', 'isd_code', 'dispatch_type']);
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
        // Bidirectional embedding, override and isolate characters can make one name read as another; normal Arabic, Hebrew and Hindi text does not need them
        if (typeof v === 'string' && input_js_1.BIDI.test(v) && !(current && current[f] === v))
            return { error: `${(0, exports.fieldLabel)(f)} contains characters that are not allowed` };
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
            const numberError = badNumber(values, opts.nonNegative) || tooLong(values, opts.lens);
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
            const numberError = badNumber(values, opts.nonNegative) || tooLong(values, opts.lens);
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
// "Is it in use?" must look at every project, not only the ones the caller is limited to: the lists below are shared by all projects,
// so a limited login that cannot see another project's records would otherwise be told an item is free and could rename or delete it.
// Only counts are read this way, never rows, and the change itself still runs with the caller's scope.
const cnt = (sql, params = []) => pool_js_1.scopeStore.exit(() => index_js_1.db.query(sql, params));
const countOf = async (sql, id) => (await cnt(sql, [id])).rows[0].n;
// These lists are stored as plain text on other records. Returns how many records carry this item's name.
// The table and column names below are fixed in code, never taken from a request.
async function textUsage(table, id, usedIn) {
    const row = (await index_js_1.db.query(`SELECT name FROM ${table} WHERE id = $1`, [id])).rows[0];
    if (!row)
        return null;
    let n = 0;
    for (const [t, col] of usedIn)
        n += Number((await cnt(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = $1`, [row.name])).rows[0].n);
    return { name: row.name, n };
}
const PERSON_TABLES = (col) => [['consumers', col], ['co_applicants', col], ['applicant_details', col]];
const inUseByText = (table, label, usedIn) => async (id) => {
    const u = await textUsage(table, id, usedIn);
    return u && u.n ? `"${u.name}" is used on ${u.n} record(s). Remove it from them before deleting this ${label}.` : null;
};
// ─── COUNTRIES ────────────────────────────────────────────────────────────────
router.get('/countries', listRoute('countries', 'name'));
// Abbreviation, ISO code, ISD code and the mobile number length of the country (a number is checked against it)
const COUNTRY_FIELDS = ['name', 'code', 'abbreviation', 'iso_code', 'isd_code', 'mobile_digits'];
const countryCheck = (req, res, next) => {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const isCreate = req.method === 'POST';
    if (isCreate)
        for (const [k, label] of [['abbreviation', 'Abbreviation'], ['iso_code', 'ISO code'], ['isd_code', 'ISD code'], ['mobile_digits', 'Number of mobile digits']])
            if (b[k] === undefined || b[k] === null || String(b[k]).trim() === '')
                return res.status(400).json({ error: `${label} is required` });
    if ('mobile_digits' in b && (b.mobile_digits === null || b.mobile_digits === ''))
        return res.status(400).json({ error: 'Number of mobile digits is required' });
    if (b.iso_code != null && b.iso_code !== '' && !/^[A-Za-z]{2,3}$/.test(String(b.iso_code).trim()))
        return res.status(400).json({ error: 'ISO code must be 2 or 3 letters' });
    if (b.isd_code != null && b.isd_code !== '' && !/^\d{1,4}$/.test(String(b.isd_code).trim().replace(/^\+/, '')))
        return res.status(400).json({ error: 'ISD code must be 1 to 4 digits' });
    if (b.abbreviation != null && b.abbreviation !== '' && String(b.abbreviation).trim().length > 10)
        return res.status(400).json({ error: 'Abbreviation can be at most 10 characters' });
    if (b.mobile_digits != null && b.mobile_digits !== '' && !(Number.isInteger(Number(b.mobile_digits)) && Number(b.mobile_digits) >= 4 && Number(b.mobile_digits) <= 15))
        return res.status(400).json({ error: 'Number of mobile digits must be a whole number from 4 to 15' });
    if (typeof b.iso_code === 'string')
        b.iso_code = b.iso_code.trim().toUpperCase();
    if (typeof b.isd_code === 'string')
        b.isd_code = b.isd_code.trim().replace(/^\+/, '');
    next();
};
const COUNTRY_LENS = { name: 150, code: 10, abbreviation: 10, iso_code: 3, isd_code: 6 };
router.post('/countries', countryCheck, addRoute('countries', COUNTRY_FIELDS, { unique: [], lens: COUNTRY_LENS }));
router.put('/countries/:id', countryCheck, updateRoute('countries', COUNTRY_FIELDS, { unique: [], lens: COUNTRY_LENS }));
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
router.post('/states', addRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'], lens: { name: 150, code: 10 } }));
router.put('/states/:id', updateRoute('states', ['name', 'country_id', 'code'], { unique: ['country_id'], required: ['country_id'], lens: { name: 150, code: 10 } }));
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
router.post('/cities', addRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'], lens: { name: 150 } }));
router.put('/cities/:id', updateRoute('cities', ['name', 'state_id'], { unique: ['state_id'], required: ['state_id'], lens: { name: 150 } }));
router.delete('/cities/:id', deleteRoute('cities'));
// ─── BANKS ────────────────────────────────────────────────────────────────────
// ?type=customer or ?type=loan lists one use of the bank list; a loan bank can be limited to some projects (projectIds)
router.get('/banks', async (req, res, next) => {
    try {
        const type = String(req.query.type || '');
        if (type && !['customer', 'loan'].includes(type))
            return res.status(400).json({ error: 'type must be customer or loan' });
        const where = type === 'loan' ? 'WHERE b.is_loan_bank' : type === 'customer' ? 'WHERE b.is_customer_bank' : '';
        const r = await index_js_1.db.query(`SELECT b.*, COALESCE((SELECT json_agg(lp.project_id) FROM loan_bank_projects lp WHERE lp.bank_id = b.id), '[]'::json) AS project_ids FROM banks b ${where} ORDER BY b.name`);
        res.json({ success: true, data: r.rows });
    }
    catch (err) {
        next(err);
    }
});
const BANK_FIELDS = ['name', 'ifsc_prefix', 'branch', 'is_customer_bank', 'is_loan_bank'];
const BANK_LENS = { name: 200, ifsc_prefix: 10, branch: 200 };
// The IFSC prefix is the start of the IFSC code (the screen says the first four letters). Only letters and digits, 4 to 10 characters (the column holds 10),
// are checked: symbols and spaces are refused, and the exact 4-letter rule is left alone because existing data and tests use other values.
const IFSC_PREFIX = /^[A-Za-z0-9]{4,10}$/;
const bankFlags = (req, res, next) => {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    for (const k of ['is_customer_bank', 'is_loan_bank'])
        if (b[k] !== undefined && typeof b[k] !== 'boolean')
            return res.status(400).json({ error: `${(0, exports.fieldLabel)(k)} must be true or false` });
    if (req.method === 'POST') {
        if (b.is_customer_bank === undefined)
            b.is_customer_bank = true;
        if (b.is_loan_bank === undefined)
            b.is_loan_bank = false;
        if (b.is_customer_bank === false && b.is_loan_bank !== true)
            return res.status(400).json({ error: BANK_KIND_MSG });
    }
    next();
};
const BANK_KIND_MSG = 'A bank must be a customer bank, a loan bank or both';
router.post('/banks', bankFlags, async (req, res, next) => {
    const b = req.body;
    if (typeof b.ifsc_prefix === 'string' && b.ifsc_prefix.trim() && !IFSC_PREFIX.test(b.ifsc_prefix.trim()))
        return res.status(400).json({ error: 'IFSC prefix must be 4 to 10 letters or digits, for example HDFC' });
    if (typeof b.ifsc_prefix === 'string')
        b.ifsc_prefix = b.ifsc_prefix.trim().toUpperCase();
    return addRoute('banks', BANK_FIELDS, { unique: [], lens: BANK_LENS })(req, res, next);
});
// Edit: the flags are checked on the bank as it will be after the change (not only on the fields sent), and a bank that stops
// being a loan bank loses its project approvals in the same transaction, so no stale approval comes back if it is made a loan bank again.
router.put('/banks/:id', bankFlags, async (req, res, next) => {
    const c = await index_js_1.db.connect();
    try {
        const id = req.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id))
            return res.status(404).json({ error: 'Not found' });
        const b = req.body;
        const cleaned = cleanBody(b, BANK_FIELDS);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const v = cleaned.values;
        const keys = Object.keys(v);
        if (!keys.length)
            return res.status(400).json({ error: 'Nothing to update' });
        if ('name' in v && !v.name)
            return res.status(400).json({ error: 'Name is required' });
        for (const k of ['is_customer_bank', 'is_loan_bank'])
            if (k in v && v[k] === null)
                delete v[k];
        const tl = tooLong(v, BANK_LENS);
        if (tl)
            return res.status(400).json({ error: tl });
        await c.query('BEGIN');
        const cur = (await c.query('SELECT * FROM banks WHERE id = $1 FOR UPDATE', [id])).rows[0];
        if (!cur) {
            await c.query('ROLLBACK');
            return res.status(404).json({ error: 'Not found' });
        }
        if (typeof v.ifsc_prefix === 'string' && v.ifsc_prefix !== cur.ifsc_prefix) {
            if (!IFSC_PREFIX.test(v.ifsc_prefix)) {
                await c.query('ROLLBACK');
                return res.status(400).json({ error: 'IFSC prefix must be 4 to 10 letters or digits, for example HDFC' });
            }
            v.ifsc_prefix = v.ifsc_prefix.toUpperCase();
        }
        const finalCustomer = 'is_customer_bank' in v ? v.is_customer_bank : cur.is_customer_bank;
        const finalLoan = 'is_loan_bank' in v ? v.is_loan_bank : cur.is_loan_bank;
        if (!finalCustomer && !finalLoan) {
            await c.query('ROLLBACK');
            return res.status(400).json({ error: BANK_KIND_MSG });
        }
        // Approvals are shared by every project; a login limited to some projects sees only its own rows, so it cannot switch a bank off as a loan bank
        if (cur.is_loan_bank && !finalLoan && (0, pool_js_1.isScoped)()) {
            await c.query('ROLLBACK');
            return res.status(403).json({ error: 'Your login is limited to some projects, so it cannot stop a bank from being a loan bank. Ask an administrator.' });
        }
        if ('name' in v && v.name !== cur.name && (await c.query('SELECT 1 FROM banks WHERE lower(name) = lower($1) AND id <> $2', [v.name, id])).rows.length) {
            await c.query('ROLLBACK');
            return res.status(409).json({ error: 'A record with this name already exists' });
        }
        const upd = (await c.query(`UPDATE banks SET ${keys.filter((k) => k in v).map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.filter((k) => k in v).length + 1} RETURNING *`, [...keys.filter((k) => k in v).map((k) => v[k]), id])).rows[0];
        let dropped = [];
        // also a bank made a loan bank again starts with no approvals (none can be valid while it was not a loan bank)
        if (cur.is_loan_bank !== finalLoan)
            dropped = (await c.query('DELETE FROM loan_bank_projects WHERE bank_id = $1 RETURNING project_id', [id])).rows.map((r) => r.project_id);
        await c.query('COMMIT');
        await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'master.banks', id, cur, upd);
        if (dropped.length)
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'master.loan_bank_projects', id, { project_ids: dropped }, { project_ids: [] });
        res.json({ success: true, data: upd });
    }
    catch (err) {
        await c.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        c.release();
    }
});
// Projects a loan bank is approved for (an empty list means every project)
router.get('/banks/:id/projects', async (req, res, next) => {
    try {
        if (!/^[0-9a-f-]{36}$/i.test(req.params.id))
            return res.status(400).json({ error: 'Bank not found' });
        const r = await index_js_1.db.query(`SELECT lp.project_id, p.name FROM loan_bank_projects lp JOIN projects p ON p.id = lp.project_id WHERE lp.bank_id = $1 ORDER BY p.name`, [req.params.id]);
        res.json({ success: true, data: r.rows });
    }
    catch (err) {
        next(err);
    }
});
router.put('/banks/:id/projects', async (req, res, next) => {
    const c = await index_js_1.db.connect();
    try {
        // The list is one setting for the whole bank (an empty list means every project). A login limited to some projects sees only
        // its own approval rows, so it could not replace the list without leaving the other projects' approvals behind.
        if ((0, pool_js_1.isScoped)())
            return res.status(403).json({ error: 'Your login is limited to some projects, so it cannot change the projects a loan bank is approved for. Ask an administrator.' });
        const ids = req.body?.projectIds;
        if (!/^[0-9a-f-]{36}$/i.test(req.params.id))
            return res.status(400).json({ error: 'Bank not found' });
        if (!Array.isArray(ids) || ids.length > 500 || ids.some((x) => typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x)))
            return res.status(400).json({ error: 'projectIds must be a list of project ids' });
        const uniq = [...new Set(ids.map((x) => x.toLowerCase()))];
        await c.query('BEGIN');
        // The bank row is locked so a flag change cannot slip in between the check and the write
        const bank = (await c.query('SELECT is_loan_bank FROM banks WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
        if (!bank) {
            await c.query('ROLLBACK');
            return res.status(404).json({ error: 'Bank not found' });
        }
        if (!bank.is_loan_bank) {
            await c.query('ROLLBACK');
            return res.status(400).json({ error: 'Only a loan bank can be approved for projects' });
        }
        if (uniq.length && (await c.query('SELECT id FROM projects WHERE id = ANY($1::uuid[])', [uniq])).rows.length !== uniq.length) {
            await c.query('ROLLBACK');
            return res.status(400).json({ error: 'A project in the list does not exist' });
        }
        const before = (await c.query('SELECT project_id FROM loan_bank_projects WHERE bank_id = $1', [req.params.id])).rows.map((r) => r.project_id);
        await c.query('DELETE FROM loan_bank_projects WHERE bank_id = $1', [req.params.id]);
        for (const pid of uniq)
            await c.query('INSERT INTO loan_bank_projects (bank_id, project_id) VALUES ($1, $2)', [req.params.id, pid]);
        await c.query('COMMIT');
        await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'master.loan_bank_projects', req.params.id, { project_ids: before }, { project_ids: uniq });
        res.json({ success: true, data: uniq });
    }
    catch (err) {
        await c.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        c.release();
    }
});
router.delete('/banks/:id', deleteRoute('banks', {
    inUse: async (id) => {
        const n = await countOf('SELECT COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id = $1', id);
        return n ? `This bank is the clearing bank on ${n} receipt(s) and cannot be deleted.` : null;
    },
}));
// ─── AREA TYPES and CURRENCIES (plain lists the client's Set Up menu has) ─────────────────────────────────────────────
// Area types are held as text by projects (land area unit), unit areas (area measurement) and unit types (unit of measurement, plot area unit)
// and matched without regard to letter case. Currencies are not held by any other table today, so a currency can always be removed.
const AREA_USERS = [['projects', 'land_area_unit'], ['unit_areas', 'area_measurement'], ['unit_types', 'unit_of_measurement'], ['unit_types', 'plot_area_unit']];
const areaTypeUse = async (id) => {
    const row = (await index_js_1.db.query('SELECT name FROM area_types WHERE id = $1', [id])).rows[0];
    if (!row)
        return null;
    let n = 0;
    for (const [t, col] of AREA_USERS)
        n += Number((await cnt(`SELECT COUNT(*) AS n FROM ${t} WHERE lower(${col}) = lower($1)`, [row.name])).rows[0].n);
    return { name: row.name, n };
};
const areaTypeInUse = async (id) => { const u = await areaTypeUse(id); return u && u.n ? `"${u.name}" is used on ${u.n} record(s) (projects, unit types or unit areas). Change them before deleting this area type.` : null; };
router.get('/area-types', listRoute('area_types', 'name'));
router.post('/area-types', addRoute('area_types', ['name'], { unique: [], maxLen: 50 }));
router.put('/area-types/:id', updateRoute('area_types', ['name'], { unique: [], maxLen: 50, inUse: areaTypeInUse }));
router.delete('/area-types/:id', deleteRoute('area_types', { inUse: areaTypeInUse }));
router.get('/currencies', listRoute('currencies', 'name'));
router.post('/currencies', addRoute('currencies', ['name'], { unique: [], maxLen: 50 }));
router.put('/currencies/:id', updateRoute('currencies', ['name'], { unique: [], maxLen: 50 }));
router.delete('/currencies/:id', deleteRoute('currencies'));
// ─── SALUTATIONS ──────────────────────────────────────────────────────────────
router.get('/salutations', listRoute('salutations', 'name'));
router.post('/salutations', addRoute('salutations', ['name'], { unique: [], maxLen: 20 }));
router.put('/salutations/:id', updateRoute('salutations', ['name'], { unique: [], maxLen: 20, inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
router.delete('/salutations/:id', deleteRoute('salutations', { inUse: inUseByText('salutations', 'salutation', PERSON_TABLES('salutation')) }));
// ─── PROFESSIONS ──────────────────────────────────────────────────────────────
router.get('/professions', listRoute('professions', 'name'));
router.post('/professions', addRoute('professions', ['name'], { unique: [], maxLen: 100 }));
router.put('/professions/:id', updateRoute('professions', ['name'], { unique: [], maxLen: 100, inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));
router.delete('/professions/:id', deleteRoute('professions', { inUse: inUseByText('professions', 'profession', PERSON_TABLES('profession')) }));
// ─── NATIONALITIES ────────────────────────────────────────────────────────────
router.get('/nationalities', listRoute('nationalities', 'name'));
router.post('/nationalities', addRoute('nationalities', ['name'], { unique: [], maxLen: 100 }));
router.put('/nationalities/:id', updateRoute('nationalities', ['name'], { unique: [], maxLen: 100, inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));
router.delete('/nationalities/:id', deleteRoute('nationalities', { inUse: inUseByText('nationalities', 'nationality', PERSON_TABLES('nationality')) }));
// ─── SOURCES OF ENQUIRY ───────────────────────────────────────────────────────
router.get('/sources-of-enquiry', listRoute('sources_of_enquiry', 'name'));
router.post('/sources-of-enquiry', addRoute('sources_of_enquiry', ['name', 'description'], { unique: [], maxLen: 100, lens: { description: 1000 } }));
router.put('/sources-of-enquiry/:id', updateRoute('sources_of_enquiry', ['name', 'description'], { unique: [], maxLen: 100, lens: { description: 1000 }, inUse: inUseByText('sources_of_enquiry', 'source', [['consumers', 'source_of_enquiry']]) }));
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
const REQUIRED_AT = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Transfer', 'On Demand', 'Other'];
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
router.post('/document-types', globalGuard('document_types'), async (req, res, next) => {
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
        // The same name may exist for Individual and for Firm or Company, and in other projects
        const scope = { ...v, document_from: v.document_from ?? 'Individual', project_id: v.project_id ?? null };
        if (await isDuplicate('document_types', ['project_id', 'document_from'], scope))
            return res.status(409).json({ error: 'A document with this name already exists for this project and document from' });
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
router.put('/document-types/:id', globalGuard('document_types'), async (req, res, next) => {
    let client; // taken just before BEGIN so no pool connection is held while the checks above use the pool
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
        {
            const cur = (await index_js_1.db.query('SELECT name, project_id, document_from FROM document_types WHERE id = $1', [id])).rows[0];
            if (cur && (v.name || 'project_id' in v || 'document_from' in v) && await isDuplicate('document_types', ['project_id', 'document_from'], { ...cur, ...v }, id)) {
                return res.status(409).json({ error: 'A document with this name already exists for this project and document from' });
            }
        }
        client = await index_js_1.db.connect();
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
        // Booking documents and dispatch entries keep the document name as it was when they were recorded, and a dispatch entry is proof
        // of what was sent, so a rename never rewrites them. A name that history still uses cannot be renamed away; add a new document instead.
        if (typeof v.name === 'string' && v.name.toLowerCase() !== String(oldName).toLowerCase()) {
            const blocked = await documentNameInUse(client, id, oldName);
            if (blocked) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: blocked.replace('cannot be deleted', 'cannot be renamed') });
            }
        }
        const result = await client.query(`UPDATE document_types SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(k => v[k]), id]);
        await client.query('COMMIT');
        // Audited on the same connection: asking the pool for a second one while holding this one can deadlock a busy pool
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'master.document_types', id, oldRes.rows[0], result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        await client?.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        client?.release();
    }
});
// Used by delete and rename: history holds the name as text, so only the last document type that carries a name is protected by it
async function documentNameInUse(q, id, name) {
    const others = (await cnt('SELECT 1 FROM document_types WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1', [name, id])).rows.length;
    if (others)
        return null;
    const n = Number((await cnt(`SELECT (SELECT COUNT(*) FROM booking_documents WHERE lower(document_type) = lower($1))
          + (SELECT COUNT(*) FROM document_dispatch WHERE lower(document_type) = lower($1)) AS n`, [name])).rows[0].n);
    return n ? `This document type is used in ${n} booking document or dispatch record(s) and cannot be deleted.` : null;
}
router.delete('/document-types/:id', globalGuard('document_types'), deleteRoute('document_types', {
    inUse: async (id) => {
        const row = (await index_js_1.db.query('SELECT name FROM document_types WHERE id = $1', [id])).rows[0];
        return row ? documentNameInUse(index_js_1.db, id, row.name) : null;
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
        if (String(v.dispatched_at) > (0, business_date_js_1.businessTomorrow)())
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
// ─── DOCUMENT DISPATCH MASTER (kinds of document that are sent: name, single or multiple, per project) ────────────────────
const dmCheck = async (req, res, next) => {
    try {
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        if (req.method === 'POST' && (typeof b.name !== 'string' || !b.name.trim()))
            return res.status(400).json({ error: 'Document name is required' });
        if (typeof b.name === 'string' && b.name.trim().length > 150)
            return res.status(400).json({ error: 'Name can be at most 150 characters' });
        if (b.dispatch_type !== undefined && !['Single', 'Multiple'].includes(b.dispatch_type))
            return res.status(400).json({ error: 'Type must be Single or Multiple' });
        if (typeof b.description === 'string' && b.description.trim().length > 150)
            return res.status(400).json({ error: 'Description can be at most 150 characters' });
        if (b.project_id != null && b.project_id !== '') {
            if (typeof b.project_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.project_id) || !(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [b.project_id])).rows.length)
                return res.status(400).json({ error: 'Project not found' });
        }
        else if ('project_id' in b)
            b.project_id = null;
        next();
    }
    catch (err) {
        next(err);
    }
};
const DM_FIELDS = ['name', 'dispatch_type', 'description', 'project_id'];
router.get('/document-dispatch-master', async (req, res, next) => {
    try {
        const pid = req.query.projectId ? String(req.query.projectId) : null;
        if (pid && !/^[0-9a-f-]{36}$/i.test(pid))
            return res.status(400).json({ error: 'Project not found' });
        const r = await index_js_1.db.query(`SELECT m.*, p.name AS project_name FROM document_dispatch_master m LEFT JOIN projects p ON p.id = m.project_id ${pid ? 'WHERE m.project_id = $1' : ''} ORDER BY p.name NULLS FIRST, m.name`, pid ? [pid] : []);
        res.json({ success: true, data: r.rows });
    }
    catch (err) {
        next(err);
    }
});
const dmDup = async (b, excludeId) => (await index_js_1.db.query(`SELECT 1 FROM document_dispatch_master WHERE lower(name) = lower($1) AND project_id IS NOT DISTINCT FROM $2 ${excludeId ? 'AND id <> $3' : ''}`, excludeId ? [b.name, b.project_id ?? null, excludeId] : [b.name, b.project_id ?? null])).rows.length > 0;
router.post('/document-dispatch-master', globalGuard('document_dispatch_master'), dmCheck, async (req, res, next) => {
    try {
        const c = cleanBody(req.body, DM_FIELDS);
        if ('error' in c)
            return res.status(400).json({ error: c.error });
        const v = { dispatch_type: 'Single', project_id: null, ...c.values };
        if (await dmDup(v))
            return res.status(409).json({ error: 'A document with this name already exists for this project' });
        const r = await index_js_1.db.query(`INSERT INTO document_dispatch_master (name, dispatch_type, description, project_id) VALUES ($1,$2,$3,$4) RETURNING *`, [v.name, v.dispatch_type, v.description ?? null, v.project_id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.document_dispatch_master', r.rows[0].id, undefined, r.rows[0]);
        res.status(201).json({ success: true, data: r.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.put('/document-dispatch-master/:id', globalGuard('document_dispatch_master'), dmCheck, async (req, res, next) => {
    try {
        if (!/^[0-9a-f-]{36}$/i.test(req.params.id))
            return res.status(404).json({ error: 'Not found' });
        const cur = (await index_js_1.db.query('SELECT * FROM document_dispatch_master WHERE id = $1', [req.params.id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Not found' });
        const c = cleanBody(req.body, DM_FIELDS, cur);
        if ('error' in c)
            return res.status(400).json({ error: c.error });
        const v = { ...cur, ...c.values };
        if (!v.name)
            return res.status(400).json({ error: 'Document name is required' });
        if (await dmDup(v, req.params.id))
            return res.status(409).json({ error: 'A document with this name already exists for this project' });
        const r = await index_js_1.db.query(`UPDATE document_dispatch_master SET name=$1, dispatch_type=$2, description=$3, project_id=$4 WHERE id=$5 RETURNING *`, [v.name, v.dispatch_type, v.description ?? null, v.project_id, req.params.id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.document_dispatch_master', req.params.id, cur, r.rows[0]);
        res.json({ success: true, data: r.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/document-dispatch-master/:id', globalGuard('document_dispatch_master'), async (req, res, next) => {
    try {
        if (!/^[0-9a-f-]{36}$/i.test(req.params.id))
            return res.status(404).json({ error: 'Not found' });
        const r = await index_js_1.db.query('DELETE FROM document_dispatch_master WHERE id = $1 RETURNING *', [req.params.id]);
        if (!r.rowCount)
            return res.status(404).json({ error: 'Not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'master.document_dispatch_master', req.params.id, r.rows[0]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
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
        for (const [name, v, sql] of [['from', from, `COALESCE(dd.dispatched_at, dd.created_at) >= ${(0, business_date_js_1.sqlDayStart)('?')}`], ['to', to, `COALESCE(dd.dispatched_at, dd.created_at) < ${(0, business_date_js_1.sqlDayEnd)('?')}`]]) {
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
// A reminder rule belongs to a project and has a rank and a prefix (the client's "Reminder 1 = 10 days, prefix R1, rank 1"); a rule with no project is for all projects.
router.get('/reminder-master', async (req, res, next) => {
    try {
        const pid = req.query.projectId ? String(req.query.projectId) : null;
        if (pid && !/^[0-9a-f-]{36}$/i.test(pid))
            return res.status(400).json({ error: 'Project not found' });
        const result = await index_js_1.db.query(`SELECT r.id, r.reminder_name AS name, r.days AS days_before, COALESCE(r.prefix_name, 'all') AS channel, r.prefix_name, r.rank, r.project_id, p.name AS project_name, r.is_active, r.created_at
         FROM reminder_master r LEFT JOIN projects p ON p.id = r.project_id ${pid ? 'WHERE r.project_id = $1' : ''} ORDER BY p.name NULLS FIRST, r.rank NULLS LAST, r.days`, pid ? [pid] : []);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/reminder-master', globalGuard('reminder_master'), async (req, res, next) => {
    try {
        const rb = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(rb.name, 'Name', 200, true);
        if (!(0, input_js_1.has)(rb.days_before))
            throw (0, input_js_1.bad)('name and days_before are required');
        const days = (0, input_js_1.num)(rb.days_before, 'Days after due date', 3650, 0);
        const channel = (0, input_js_1.text)(rb.prefix_name ?? rb.channel, 'Prefix', 100, false);
        const rank = (0, input_js_1.has)(rb.rank) ? (0, input_js_1.num)(rb.rank, 'Rank', 100, 0) : null;
        if (rank !== null && !Number.isInteger(rank))
            throw (0, input_js_1.bad)('Rank must be a whole number');
        const projectId = (0, input_js_1.has)(rb.project_id) ? (0, input_js_1.uuid)(rb.project_id, 'Project') : null;
        if (projectId && !(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
            throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 });
        const result = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('reminder|' || lower($1) || '|' || $2 || '|' || COALESCE($3, '')))`, [name, days, projectId]);
            if ((await c.query('SELECT 1 FROM reminder_master WHERE lower(reminder_name) = lower($1) AND days = $2 AND project_id IS NOT DISTINCT FROM $3', [name, days, projectId])).rows.length) {
                throw Object.assign((0, input_js_1.bad)('A reminder with this name and days already exists for this project'), { http: 409 });
            }
            if (rank !== null && (await c.query('SELECT 1 FROM reminder_master WHERE rank = $1 AND project_id IS NOT DISTINCT FROM $2', [rank, projectId])).rows.length) {
                throw Object.assign((0, input_js_1.bad)('This project already has a reminder with this rank'), { http: 409 });
            }
            return c.query(`INSERT INTO reminder_master (reminder_name, days, prefix_name, rank, project_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, reminder_name AS name, days AS days_before, COALESCE(prefix_name,'all') AS channel, prefix_name, rank, project_id`, [name, days, channel, rank, projectId]);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.reminder_master', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        err?.http ? res.status(err.http).json({ error: err.message }) : next(err);
    }
});
router.patch('/reminder-master/:id', globalGuard('reminder_master'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Reminder id'), rb = (0, input_js_1.body)(req);
        const cur = (await index_js_1.db.query('SELECT * FROM reminder_master WHERE id = $1', [id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Reminder not found' });
        const name = (0, input_js_1.has)(rb.name) ? (0, input_js_1.text)(rb.name, 'Name', 200, true) : cur.reminder_name;
        const days = (0, input_js_1.has)(rb.days_before) ? (0, input_js_1.num)(rb.days_before, 'Days after due date', 3650, 0) : cur.days;
        const prefix = 'prefix_name' in rb ? (0, input_js_1.text)(rb.prefix_name, 'Prefix', 100, false) : cur.prefix_name;
        const rank = 'rank' in rb ? ((0, input_js_1.has)(rb.rank) ? (0, input_js_1.num)(rb.rank, 'Rank', 100, 0) : null) : cur.rank;
        if (rank !== null && !Number.isInteger(rank))
            throw (0, input_js_1.bad)('Rank must be a whole number');
        if ((await index_js_1.db.query('SELECT 1 FROM reminder_master WHERE lower(reminder_name) = lower($1) AND days = $2 AND project_id IS NOT DISTINCT FROM $3 AND id <> $4', [name, days, cur.project_id, id])).rows.length)
            throw Object.assign((0, input_js_1.bad)('A reminder with this name and days already exists for this project'), { http: 409 });
        if (rank !== null && (await index_js_1.db.query('SELECT 1 FROM reminder_master WHERE rank = $1 AND project_id IS NOT DISTINCT FROM $2 AND id <> $3', [rank, cur.project_id, id])).rows.length)
            throw Object.assign((0, input_js_1.bad)('This project already has a reminder with this rank'), { http: 409 });
        const r = (await index_js_1.db.query(`UPDATE reminder_master SET reminder_name = $1, days = $2, prefix_name = $3, rank = $4 WHERE id = $5 RETURNING id, reminder_name AS name, days AS days_before, prefix_name, rank, project_id`, [name, days, prefix, rank, id])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.reminder_master', id, cur, r);
        res.json({ success: true, data: r });
    }
    catch (err) {
        err?.http ? res.status(err.http).json({ error: err.message }) : next(err);
    }
});
router.delete('/reminder-master/:id', globalGuard('reminder_master'), deleteRoute('reminder_master'));
// ─── UNIT TYPES ───────────────────────────────────────────────────────────────
router.get('/unit-types', async (req, res, next) => {
    try {
        const project_id = (0, input_js_1.has)(req.query.project_id) ? (0, input_js_1.uuid)(req.query.project_id, 'project_id') : null;
        const where = project_id ? `WHERE ut.project_id = $1` : '';
        const params = project_id ? [project_id] : [];
        const result = await index_js_1.db.query(`SELECT ut.*, p.name as project_name FROM unit_types ut JOIN projects p ON p.id = ut.project_id ${where} ORDER BY ut.name`, params);
        res.json({ success: true, data: result.rows.map(utOut) });
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
    return { name, description, carpet: pick('carpet_area_sqft', 'carpet_area_sqft', 'Carpet area', 1000000, 4), balcony: pick('balcony_area_sqft', 'balcony_area_sqft', 'Balcony area', 1000000, 4), rate: pick('base_rate_sqft', 'base_rate_sqft', 'Base rate', 10000000, 2) };
};
// The rest of the client's unit type master: other areas, the area the rate is charged on, group, salable, costs, unit of measure, rate date
// A DATE column arrives as a JS Date; send it back as the plain local day so a screen never shows it one day early
const utOut = (r) => r && { ...r, rate_date: r.rate_date instanceof Date ? `${r.rate_date.getFullYear()}-${String(r.rate_date.getMonth() + 1).padStart(2, '0')}-${String(r.rate_date.getDate()).padStart(2, '0')}` : r.rate_date };
// A new rate, or a changed rate or basis, is written to the unit type's rate history
const rateNote = (c, row, userId) => row?.base_rate_sqft == null ? null : c.query(`INSERT INTO unit_type_rate_history (unit_type_id, project_id, base_rate, rate_basis, rate_date, changed_by) VALUES ($1,$2,$3,$4,$5,$6)`, [row.id, row.project_id, row.base_rate_sqft, row.rate_basis, row.rate_date, userId || null]);
const RATE_BASIS = ['Super Area', 'Carpet Area', 'Built Up Area', 'Plot Area'];
const PAYMENT_FILE_AREAS = ['Super Area', 'Carpet Area', 'Built Up Area', 'UDSL Area', 'Plot Area', 'Balcony Area'];
const UT_EXTRA_KEYS = ['super_area_sqft', 'built_up_area_sqft', 'udsl_area_sqft', 'plot_area', 'plot_area_unit', 'group_name', 'rate_type', 'area_type', 'rate_basis', 'show_on_payment_file', 'construction_cost', 'udsl_cost', 'unit_of_measurement', 'rate_date', 'unit_map_url'];
const unitTypeExtras = async (rb, cur, base) => {
    const pickN = (k, label, max, dec) => k in rb ? ((0, input_js_1.has)(rb[k]) ? (0, input_js_1.num)(rb[k], label, max, dec) : null) : cur && cur[k] != null ? Number(cur[k]) : null;
    const pickT = (k, label, max) => k in rb ? (0, input_js_1.text)(rb[k], label, max, false) : cur ? cur[k] ?? null : null;
    const x = {
        super_area_sqft: pickN('super_area_sqft', 'Super area', 1000000, 4), built_up_area_sqft: pickN('built_up_area_sqft', 'Built-up area', 1000000, 4),
        udsl_area_sqft: pickN('udsl_area_sqft', 'UDSL area', 1000000, 4), plot_area: pickN('plot_area', 'Plot area', 1000000000, 4),
        construction_cost: pickN('construction_cost', 'Construction cost', 10000000000, 2), udsl_cost: pickN('udsl_cost', 'UDSL cost', 10000000000, 2),
        group_name: pickT('group_name', 'Group', 100), unit_map_url: pickT('unit_map_url', 'Unit map', 500),
        rate_date: 'rate_date' in rb ? (0, input_js_1.day)(rb.rate_date, 'Rate date') : cur?.rate_date ? (cur.rate_date instanceof Date ? `${cur.rate_date.getFullYear()}-${String(cur.rate_date.getMonth() + 1).padStart(2, '0')}-${String(cur.rate_date.getDate()).padStart(2, '0')}` : String(cur.rate_date).slice(0, 10)) : null, // a DATE column arrives as a Date at local midnight
        rate_type: 'rate_type' in rb ? (0, input_js_1.oneOf)(rb.rate_type, 'Type', ['Per Area', 'In Fix']) : cur?.rate_type ?? 'Per Area',
        area_type: 'area_type' in rb ? (0, input_js_1.oneOf)(rb.area_type, 'Area type', ['Salable', 'Non Salable']) : cur?.area_type ?? 'Salable',
        rate_basis: 'rate_basis' in rb ? (0, input_js_1.oneOf)(rb.rate_basis, 'Effective rate on', RATE_BASIS) : cur?.rate_basis ?? 'Carpet Area',
        unit_of_measurement: pickT('unit_of_measurement', 'Unit of measurement', 50), plot_area_unit: pickT('plot_area_unit', 'Plot area unit', 50),
    };
    if (x.rate_type === null)
        x.rate_type = 'Per Area';
    if (x.area_type === null)
        x.area_type = 'Salable';
    if (x.rate_basis === null)
        x.rate_basis = 'Carpet Area';
    if ('show_on_payment_file' in rb) {
        const a = rb.show_on_payment_file;
        if (!Array.isArray(a) || a.length > 6 || a.some((v) => !PAYMENT_FILE_AREAS.includes(v)) || new Set(a).size !== a.length)
            throw (0, input_js_1.bad)(`Areas to show on the payment file must be some of: ${PAYMENT_FILE_AREAS.join(', ')}`);
        x.show_on_payment_file = a;
    }
    else
        x.show_on_payment_file = cur?.show_on_payment_file ?? [];
    for (const k of ['unit_of_measurement', 'plot_area_unit'])
        if (x[k] && !(await index_js_1.db.query('SELECT 1 FROM area_types WHERE lower(name) = lower($1)', [x[k]])).rows.length)
            throw (0, input_js_1.bad)(`${k === 'plot_area_unit' ? 'Plot area unit' : 'Unit of measurement'} must be one of the Area Types in Set Master`);
    const a = { super: x.super_area_sqft, carpet: base.carpet, built: x.built_up_area_sqft, plot: x.plot_area };
    if (a.super !== null && a.carpet !== null && a.super < a.carpet)
        throw (0, input_js_1.bad)('Super area cannot be less than the carpet area');
    if (a.built !== null && a.carpet !== null && a.built < a.carpet)
        throw (0, input_js_1.bad)('Built-up area cannot be less than the carpet area');
    const need = { 'Super Area': ['Super area', a.super], 'Carpet Area': ['Carpet area', a.carpet], 'Built Up Area': ['Built-up area', a.built], 'Plot Area': ['Plot area', a.plot] };
    if (x.rate_type === 'Per Area' && base.rate && !(need[x.rate_basis][1] && need[x.rate_basis][1] > 0))
        throw (0, input_js_1.bad)(`The rate is charged on the ${need[x.rate_basis][0].toLowerCase()}, so it must be filled in`);
    const shown = { 'Super Area': a.super, 'Carpet Area': a.carpet, 'Built Up Area': a.built, 'UDSL Area': x.udsl_area_sqft, 'Plot Area': a.plot, 'Balcony Area': base.balcony };
    for (const k of x.show_on_payment_file)
        if (!(shown[k] && shown[k] > 0))
            throw (0, input_js_1.bad)(`${k} is chosen for the payment file but it is not filled in`);
    return x;
};
const sendErr = (err, res, next) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
router.post('/unit-types', async (req, res, next) => {
    try {
        const rb = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(rb.project_id, 'Project');
        const f = unitTypeInput(rb);
        const ex = await unitTypeExtras(rb, null, f);
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
            throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 });
        const made = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('unittype|' || $1 || '|' || lower($2)))`, [projectId, f.name]);
            if ((await c.query('SELECT 1 FROM unit_types WHERE project_id = $1 AND lower(name) = lower($2)', [projectId, f.name])).rows.length)
                throw Object.assign((0, input_js_1.bad)('A record with this name already exists'), { http: 409 });
            const ins = (await c.query(`INSERT INTO unit_types (project_id, name, description, carpet_area_sqft, balcony_area_sqft, base_rate_sqft, ${UT_EXTRA_KEYS.join(', ')}) VALUES ($1,$2,$3,$4,$5,$6, ${UT_EXTRA_KEYS.map((_, i) => '$' + (i + 7)).join(', ')}) RETURNING *`, [projectId, f.name, f.description, f.carpet, f.balcony, f.rate, ...UT_EXTRA_KEYS.map(k => ex[k])])).rows[0];
            await rateNote(c, ins, req.userId);
            return ins;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.unit_types', made.id, undefined, made);
        res.status(201).json({ success: true, data: utOut(made) });
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
            if (!Object.keys(rb).some(k => ['name', 'description', 'project_id', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft', ...UT_EXTRA_KEYS].includes(k)))
                throw (0, input_js_1.bad)('Nothing to update');
            const f = unitTypeInput(rb, cur);
            const ex = await unitTypeExtras(rb, cur, f);
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
            const upd = (await c.query(`UPDATE unit_types SET project_id = $2, name = $3, description = $4, carpet_area_sqft = $5, balcony_area_sqft = $6, base_rate_sqft = $7, ${UT_EXTRA_KEYS.map((k, i) => `${k} = $${i + 8}`).join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, [uid, projectId, f.name, f.description, f.carpet, f.balcony, f.rate, ...UT_EXTRA_KEYS.map(k => ex[k])])).rows[0];
            if (Number(cur.base_rate_sqft ?? -1) !== Number(upd.base_rate_sqft ?? -1) || cur.rate_basis !== upd.rate_basis || String(cur.rate_date ?? '') !== String(upd.rate_date ?? ''))
                await rateNote(c, upd, req.userId);
            // Units, the booking form and the Rate Report show the type by its name, so a renamed type renames them too
            if (cur.name !== upd.name)
                await c.query('UPDATE units SET bhk_type = $1 WHERE unit_type_id = $2', [upd.name, uid]);
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.unit_types', uid, out.cur, out.upd);
        res.json({ success: true, data: utOut(out.upd) });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.get('/unit-types/:id/rate-history', async (req, res, next) => {
    try {
        const rows = (await index_js_1.db.query(`SELECT h.base_rate, h.rate_basis, h.rate_date::text AS rate_date, h.changed_at, u.name AS changed_by_name FROM unit_type_rate_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.unit_type_id = $1 ORDER BY h.changed_at DESC`, [(0, input_js_1.uuid)(req.params.id, 'Unit type id')])).rows;
        res.json({ success: true, data: rows });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
// POST /api/master/unit-types/:id/apply-to-units  { preview? } - puts the type's areas and price (rate x the area it is charged on) on its units that are not booked yet
router.post('/unit-types/:id/apply-to-units', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit type id'), preview = (0, input_js_1.body)(req).preview === true;
        const out = await (0, input_js_1.inTx)(async (c) => {
            const t = (await c.query('SELECT * FROM unit_types WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!t)
                throw Object.assign((0, input_js_1.bad)('Not found'), { http: 404 });
            const units = (await c.query(`SELECT u.id, u.status, EXISTS (SELECT 1 FROM booking_records b WHERE b.unit_id = u.id AND COALESCE(b.status, '') <> 'cancelled') AS booked FROM units u WHERE u.unit_type_id = $1 FOR UPDATE OF u`, [id])).rows;
            const free = units.filter((u) => !u.booked && ['available', 'locked', 'held'].includes(u.status));
            const price = (0, unit_type_price_js_1.typePrice)(t);
            let updated = 0;
            if (!preview && free.length) {
                updated = (await c.query(`UPDATE units SET bhk_type = $2, carpet_area_sqft = $3, super_area_sqft = $4, balcony_area_sqft = $5, base_price_inr = COALESCE($6::bigint, base_price_inr), total_price_inr = COALESCE($6::bigint, total_price_inr), updated_at = now() WHERE id = ANY($1::uuid[])`, [free.map((u) => u.id), t.name, t.carpet_area_sqft, t.super_area_sqft, t.balcony_area_sqft, price])).rowCount ?? 0;
            }
            return { matching: units.length, updatable: free.length, booked: units.length - free.length, updated, price };
        });
        if (!preview)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.unit_types', id, undefined, { applied_to_units: out.updated });
        res.json({ success: true, data: out });
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
// Floors: a tower id, a whole floor number (the same -5 to 300 the tower screen accepts) and an optional name of up to 50 characters,
// one row per tower and floor number. Nothing in Set Master or Set Projects calls these routes today (towers have their own floor routes).
const floorInput = async (rb, cur) => {
    const towerId = 'tower_id' in rb || !cur ? (0, input_js_1.uuid)(rb.tower_id, 'Tower') : cur.tower_id;
    let floorNumber = cur ? cur.floor_number : null;
    if ('floor_number' in rb || !cur) {
        const n = rb.floor_number;
        if (typeof n === 'boolean' || n === null || n === undefined || n === '')
            throw (0, input_js_1.bad)('Floor number is required');
        const v = typeof n === 'number' ? n : typeof n === 'string' && /^-?\d{1,3}$/.test(n) ? Number(n) : NaN;
        if (!Number.isInteger(v) || v < -5 || v > 300)
            throw (0, input_js_1.bad)('Floor number must be a whole number from -5 to 300');
        floorNumber = v;
    }
    const floorName = 'floor_name' in rb ? (0, input_js_1.text)(rb.floor_name, 'Floor name', 50, false) : cur ? cur.floor_name : null;
    if (!(await index_js_1.db.query('SELECT 1 FROM towers WHERE id = $1', [towerId])).rows.length)
        throw Object.assign((0, input_js_1.bad)('Tower not found'), { http: 404 });
    return { towerId, floorNumber, floorName };
};
router.post('/floors', async (req, res, next) => {
    try {
        const f = await floorInput((0, input_js_1.body)(req));
        if ((await index_js_1.db.query('SELECT 1 FROM floors WHERE tower_id = $1 AND floor_number = $2', [f.towerId, f.floorNumber])).rows.length)
            throw Object.assign((0, input_js_1.bad)('This tower already has this floor number'), { http: 409 });
        const r = (await index_js_1.db.query('INSERT INTO floors (tower_id, floor_number, floor_name) VALUES ($1,$2,$3) RETURNING *', [f.towerId, f.floorNumber, f.floorName])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.floors', r.id, undefined, r);
        res.status(201).json({ success: true, data: r });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.put('/floors/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Floor id'), rb = (0, input_js_1.body)(req);
        const cur = (await index_js_1.db.query('SELECT * FROM floors WHERE id = $1', [id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Not found' });
        if (!['tower_id', 'floor_number', 'floor_name'].some((k) => k in rb))
            throw (0, input_js_1.bad)('Nothing to update');
        const f = await floorInput(rb, cur);
        if ((await index_js_1.db.query('SELECT 1 FROM floors WHERE tower_id = $1 AND floor_number = $2 AND id <> $3', [f.towerId, f.floorNumber, id])).rows.length)
            throw Object.assign((0, input_js_1.bad)('This tower already has this floor number'), { http: 409 });
        const r = (await index_js_1.db.query('UPDATE floors SET tower_id = $2, floor_number = $3, floor_name = $4 WHERE id = $1 RETURNING *', [id, f.towerId, f.floorNumber, f.floorName])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.floors', id, cur, r);
        res.json({ success: true, data: r });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.delete('/floors/:id', deleteRoute('floors'));
// ─── TAX SLABS ────────────────────────────────────────────────────────────────
// Columns: name (100, unique), cgst, sgst and igst as numeric(5,2) percentages, effective_from a date, is_active a flag.
// A percentage is checked as 0 to 100 with up to 2 decimals (the column holds two). No other module reads this table today.
const TAX_PCT = [['cgst_percent', 'CGST percent'], ['sgst_percent', 'SGST percent'], ['igst_percent', 'IGST percent']];
const taxInput = (rb, cur) => {
    const name = 'name' in rb || !cur ? (0, input_js_1.text)(rb.name, 'Name', 100, true) : cur.name;
    const out = { name };
    for (const [k, label] of TAX_PCT)
        out[k] = k in rb ? ((0, input_js_1.has)(rb[k]) ? (0, input_js_1.num)(rb[k], label, 100, 2) : null) : cur ? (cur[k] == null ? null : Number(cur[k])) : null;
    out.effective_from = 'effective_from' in rb ? (0, input_js_1.day)(rb.effective_from, 'Effective from') : cur ? (cur.effective_from instanceof Date ? cur.effective_from.toISOString().slice(0, 10) : cur.effective_from ?? null) : null;
    if ('is_active' in rb && rb.is_active !== null && typeof rb.is_active !== 'boolean')
        throw (0, input_js_1.bad)('Is active must be true or false');
    out.is_active = 'is_active' in rb && rb.is_active !== null ? rb.is_active : cur ? cur.is_active : true;
    return out;
};
// two requests with the same name at the same moment: the database index (migration 145) refuses the second one
const sendTaxErr = (err, res, next) => err?.code === '23505' ? res.status(409).json({ error: 'A record with this name already exists' }) : sendErr(err, res, next);
const taxNameTaken = async (name, exceptId) => (await index_js_1.db.query(`SELECT 1 FROM tax_slabs WHERE lower(name) = lower($1) ${exceptId ? 'AND id <> $2' : ''}`, exceptId ? [name, exceptId] : [name])).rows.length > 0;
router.get('/tax-slabs', listRoute('tax_slabs', 'name'));
router.post('/tax-slabs', async (req, res, next) => {
    try {
        const t = taxInput((0, input_js_1.body)(req));
        if (await taxNameTaken(t.name))
            throw Object.assign((0, input_js_1.bad)('A record with this name already exists'), { http: 409 });
        const r = (await index_js_1.db.query('INSERT INTO tax_slabs (name, cgst_percent, sgst_percent, igst_percent, effective_from, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [t.name, t.cgst_percent, t.sgst_percent, t.igst_percent, t.effective_from, t.is_active])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.tax_slabs', r.id, undefined, r);
        res.status(201).json({ success: true, data: r });
    }
    catch (err) {
        sendTaxErr(err, res, next);
    }
});
router.put('/tax-slabs/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Tax slab id'), rb = (0, input_js_1.body)(req);
        const cur = (await index_js_1.db.query('SELECT * FROM tax_slabs WHERE id = $1', [id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Not found' });
        if (!['name', 'effective_from', 'is_active', ...TAX_PCT.map(([k]) => k)].some((k) => k in rb))
            throw (0, input_js_1.bad)('Nothing to update');
        const t = taxInput(rb, cur);
        if (await taxNameTaken(t.name, id))
            throw Object.assign((0, input_js_1.bad)('A record with this name already exists'), { http: 409 });
        const r = (await index_js_1.db.query('UPDATE tax_slabs SET name=$2, cgst_percent=$3, sgst_percent=$4, igst_percent=$5, effective_from=$6, is_active=$7 WHERE id=$1 RETURNING *', [id, t.name, t.cgst_percent, t.sgst_percent, t.igst_percent, t.effective_from, t.is_active])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.tax_slabs', id, cur, r);
        res.json({ success: true, data: r });
    }
    catch (err) {
        sendTaxErr(err, res, next);
    }
});
router.delete('/tax-slabs/:id', deleteRoute('tax_slabs'));
// ─── USAGE COUNTS ─────────────────────────────────────────────────────────────
// How many records use each list item, so the screen can show it and disable Delete.
// Applicant lists are stored as text, banks by id. Table and column names are fixed in code.
const usageByName = async (col, tables) => {
    const union = tables.map(t => `SELECT ${col} AS k FROM ${t}`).join(' UNION ALL ');
    const rows = (await cnt(`SELECT k, COUNT(*)::int AS n FROM (${union}) u WHERE k IS NOT NULL GROUP BY k`)).rows;
    return Object.fromEntries(rows.map(r => [r.k, r.n]));
};
router.get('/usage', async (req, res, next) => {
    try {
        const people = ['consumers', 'co_applicants', 'applicant_details'];
        // one query for all area types (same four columns as areaTypeUse, letter case ignored)
        const areaRows = (await cnt(`SELECT a.name, COUNT(*)::int AS n FROM area_types a JOIN (${AREA_USERS.map(([t, c]) => `SELECT ${c} AS k FROM ${t}`).join(' UNION ALL ')}) u ON lower(u.k) = lower(a.name) GROUP BY a.name`)).rows;
        const areaTypes = Object.fromEntries(areaRows.map((r) => [r.name, r.n]));
        const [salutations, professions, nationalities, sources, banks] = await Promise.all([
            usageByName('salutation', people),
            usageByName('profession', people),
            usageByName('nationality', people),
            usageByName('source_of_enquiry', ['consumers']),
            cnt(`SELECT clearing_bank_id AS k, COUNT(*)::int AS n FROM receipts WHERE clearing_bank_id IS NOT NULL GROUP BY 1`),
        ]);
        res.json({ success: true, data: { salutations, professions, nationalities, sources, areaTypes, currencies: {}, banks: Object.fromEntries(banks.rows.map(r => [r.k, r.n])) } });
    }
    catch (err) {
        next(err);
    }
});
// ─── Customer Classification per project ───
// A project with no list of its own uses the standard EWS / LIG / MIG; "defaults" copies them into the project so they can be changed.
const CLASS_DEFAULTS = ['EWS', 'LIG', 'MIG'];
const classProject = async (v) => { const id = (0, input_js_1.uuid)(v, 'Project'); if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length)
    throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 }); return id; };
router.get('/customer-classifications', async (req, res, next) => {
    try {
        const pid = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        const rows = (await index_js_1.db.query('SELECT id, project_id, name FROM customer_classifications WHERE project_id = $1 ORDER BY name', [pid])).rows;
        res.json({ success: true, data: rows, using_defaults: !rows.length, defaults: CLASS_DEFAULTS });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.post('/customer-classifications/defaults', async (req, res, next) => {
    try {
        const pid = await classProject((0, input_js_1.body)(req).project_id);
        const made = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [pid]);
            if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1', [pid])).rows.length)
                throw Object.assign((0, input_js_1.bad)('This project already has its own list'), { http: 409 });
            return (await c.query(`INSERT INTO customer_classifications (project_id, name, created_by) SELECT $1, n, $2 FROM unnest($3::text[]) n RETURNING id, project_id, name`, [pid, req.userId || null, CLASS_DEFAULTS])).rows;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.customer_classifications', pid, undefined, { names: CLASS_DEFAULTS });
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.post('/customer-classifications', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req), pid = await classProject(b.project_id), name = (0, input_js_1.text)(b.name, 'Name', 50, true);
        const made = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [pid]);
            if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1 AND lower(name) = lower($2)', [pid, name])).rows.length)
                throw Object.assign((0, input_js_1.bad)('A classification with this name already exists in this project'), { http: 409 });
            // the first own name starts the project's list: keep the standard ones the existing customers may already carry
            if (!(await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1', [pid])).rows.length)
                await c.query(`INSERT INTO customer_classifications (project_id, name, created_by) SELECT $1, n, $2 FROM unnest($3::text[]) n WHERE lower(n) <> lower($4)`, [pid, req.userId || null, CLASS_DEFAULTS, name]);
            return (await c.query('INSERT INTO customer_classifications (project_id, name, created_by) VALUES ($1,$2,$3) RETURNING id, project_id, name', [pid, name, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'master.customer_classifications', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.put('/customer-classifications/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Id'), name = (0, input_js_1.text)((0, input_js_1.body)(req).name, 'Name', 50, true);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query('SELECT * FROM customer_classifications WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!cur)
                throw Object.assign((0, input_js_1.bad)('Classification not found'), { http: 404 });
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('custclass|' || $1))`, [cur.project_id]);
            if ((await c.query('SELECT 1 FROM customer_classifications WHERE project_id = $1 AND lower(name) = lower($2) AND id <> $3', [cur.project_id, name, id])).rows.length)
                throw Object.assign((0, input_js_1.bad)('A classification with this name already exists in this project'), { http: 409 });
            const upd = (await c.query('UPDATE customer_classifications SET name = $2 WHERE id = $1 RETURNING id, project_id, name', [id, name])).rows[0];
            // customers of this project that carry the old name follow the rename
            const moved = await c.query('UPDATE consumers SET income_category = $3, updated_at = now() WHERE project_id = $1 AND income_category = $2', [cur.project_id, cur.name, name]);
            return { cur, upd, moved: moved.rowCount };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'master.customer_classifications', id, out.cur, out.upd);
        res.json({ success: true, data: out.upd, customers_updated: out.moved });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.delete('/customer-classifications/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Id');
        const cur = (await index_js_1.db.query('SELECT * FROM customer_classifications WHERE id = $1', [id])).rows[0];
        if (!cur)
            throw Object.assign((0, input_js_1.bad)('Classification not found'), { http: 404 });
        const used = (await index_js_1.db.query('SELECT COUNT(*)::int AS n FROM consumers WHERE project_id = $1 AND income_category = $2', [cur.project_id, cur.name])).rows[0].n;
        if (used)
            throw Object.assign((0, input_js_1.bad)(`${used} customer(s) of this project carry "${cur.name}", so it cannot be deleted`), { http: 409 });
        await index_js_1.db.query('DELETE FROM customer_classifications WHERE id = $1', [id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'master.customer_classifications', id, cur);
        res.json({ success: true });
    }
    catch (err) {
        sendErr(err, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=master.js.map