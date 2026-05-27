"use strict";
/**
 * Master Data Routes
 * CRUD for: Countries, States, Cities, Banks, Salutations,
 *           Professions, Nationalities, Sources of Enquiry,
 *           Document Types, Document Dispatch
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// ─── Generic list/add/delete helper ──────────────────────────────────────────
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
function addRoute(table, fields) {
    return async (req, res, next) => {
        try {
            const values = fields.map(f => req.body[f]);
            const cols = fields.join(', ');
            const params = fields.map((_, i) => `$${i + 1}`).join(', ');
            const result = await index_js_1.db.query(`INSERT INTO ${table} (${cols}) VALUES (${params}) RETURNING *`, values);
            res.status(201).json({ success: true, data: result.rows[0] });
        }
        catch (err) {
            next(err);
        }
    };
}
function deleteRoute(table) {
    return async (req, res, next) => {
        try {
            await index_js_1.db.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    };
}
function updateRoute(table, fields) {
    return async (req, res, next) => {
        try {
            const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
            const values = fields.map(f => req.body[f]);
            values.push(req.params.id);
            const result = await index_js_1.db.query(`UPDATE ${table} SET ${sets} WHERE id = $${values.length} RETURNING *`, values);
            if (!result.rows[0])
                return res.status(404).json({ error: 'Not found' });
            res.json({ success: true, data: result.rows[0] });
        }
        catch (err) {
            next(err);
        }
    };
}
// ─── COUNTRIES ────────────────────────────────────────────────────────────────
router.get('/countries', listRoute('countries', 'name'));
router.post('/countries', addRoute('countries', ['name', 'code']));
router.put('/countries/:id', updateRoute('countries', ['name', 'code']));
router.delete('/countries/:id', deleteRoute('countries'));
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
router.post('/states', addRoute('states', ['name', 'country_id', 'code']));
router.put('/states/:id', updateRoute('states', ['name', 'country_id', 'code']));
router.delete('/states/:id', deleteRoute('states'));
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
router.post('/cities', addRoute('cities', ['name', 'state_id']));
router.put('/cities/:id', updateRoute('cities', ['name', 'state_id']));
router.delete('/cities/:id', deleteRoute('cities'));
// ─── BANKS ────────────────────────────────────────────────────────────────────
router.get('/banks', listRoute('banks', 'name'));
router.post('/banks', addRoute('banks', ['name', 'ifsc_prefix', 'branch']));
router.put('/banks/:id', updateRoute('banks', ['name', 'ifsc_prefix', 'branch']));
router.delete('/banks/:id', deleteRoute('banks'));
// ─── SALUTATIONS ──────────────────────────────────────────────────────────────
router.get('/salutations', listRoute('salutations', 'name'));
router.post('/salutations', addRoute('salutations', ['name']));
router.delete('/salutations/:id', deleteRoute('salutations'));
// ─── PROFESSIONS ──────────────────────────────────────────────────────────────
router.get('/professions', listRoute('professions', 'name'));
router.post('/professions', addRoute('professions', ['name']));
router.delete('/professions/:id', deleteRoute('professions'));
// ─── NATIONALITIES ────────────────────────────────────────────────────────────
router.get('/nationalities', listRoute('nationalities', 'name'));
router.post('/nationalities', addRoute('nationalities', ['name']));
router.delete('/nationalities/:id', deleteRoute('nationalities'));
// ─── SOURCES OF ENQUIRY ───────────────────────────────────────────────────────
router.get('/sources-of-enquiry', listRoute('sources_of_enquiry', 'name'));
router.post('/sources-of-enquiry', addRoute('sources_of_enquiry', ['name', 'description']));
router.put('/sources-of-enquiry/:id', updateRoute('sources_of_enquiry', ['name', 'description']));
router.delete('/sources-of-enquiry/:id', deleteRoute('sources_of_enquiry'));
// ─── DOCUMENT TYPES ───────────────────────────────────────────────────────────
router.get('/document-types', listRoute('document_types', 'name'));
router.post('/document-types', async (req, res, next) => {
    try {
        const { name, category, description } = req.body;
        const result = await index_js_1.db.query(`INSERT INTO document_types (name, category, description) VALUES ($1, $2, $3) RETURNING *`, [name, category || null, description || null]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.put('/document-types/:id', updateRoute('document_types', ['name', 'category', 'description']));
router.delete('/document-types/:id', deleteRoute('document_types'));
// ─── DOCUMENT DISPATCH ────────────────────────────────────────────────────────
router.get('/document-dispatch', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT dd.*, c.name as consumer_name
      FROM document_dispatch dd
      LEFT JOIN consumers c ON c.id = dd.consumer_id
      ORDER BY dd.created_at DESC
      LIMIT 100
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/document-dispatch', async (req, res, next) => {
    try {
        const { document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at } = req.body;
        const result = await index_js_1.db.query(`INSERT INTO document_dispatch (document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [document_type, dispatch_mode, tracking_no || null, consumer_id || null, dispatched_at || null, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
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
        const { name, days_before, channel } = req.body;
        if (!name || !days_before)
            return res.status(400).json({ error: 'name and days_before are required' });
        const result = await index_js_1.db.query(`INSERT INTO reminder_master (reminder_name, days, prefix_name)
       VALUES ($1, $2, $3) RETURNING id, reminder_name AS name, days AS days_before, COALESCE(prefix_name,'all') AS channel`, [name, parseInt(days_before), channel || null]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/reminder-master/:id', deleteRoute('reminder_master'));
// ─── UNIT TYPES ───────────────────────────────────────────────────────────────
router.get('/unit-types', async (req, res, next) => {
    try {
        const { project_id } = req.query;
        const where = project_id ? `WHERE ut.project_id = $1` : '';
        const params = project_id ? [project_id] : [];
        const result = await index_js_1.db.query(`SELECT ut.*, p.name as project_name FROM unit_types ut JOIN projects p ON p.id = ut.project_id ${where} ORDER BY ut.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/unit-types', addRoute('unit_types', ['project_id', 'name', 'description', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft']));
router.put('/unit-types/:id', updateRoute('unit_types', ['project_id', 'name', 'description', 'carpet_area_sqft', 'balcony_area_sqft', 'base_rate_sqft']));
router.delete('/unit-types/:id', deleteRoute('unit_types'));
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
exports.default = router;
//# sourceMappingURL=master.js.map