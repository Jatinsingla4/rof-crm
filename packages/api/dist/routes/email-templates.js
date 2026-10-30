"use strict";
/**
 * Email Templates
 * Wording for the emails the CRM writes, with merge fields. Kept apart from the legal letters (document_templates), which the letter generator reads.
 * No email sender is connected yet, so a template is only text; nothing here sends mail.
 * Permission: communications (everyone reads, sales and support create, project manager and admin edit, only the admin deletes).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MERGE_FIELDS = exports.TYPES = void 0;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const applicant_js_1 = require("../utils/applicant.js");
const router = (0, express_1.Router)();
exports.TYPES = ['general', 'allotment_letter', 'demand_letter', 'payment_receipt', 'welcome', 'reminder'];
exports.MERGE_FIELDS = ['consumer_name', 'unit_number', 'amount', 'due_date', 'project_name', 'allotment_date'];
const COLS = `id, name, template_type, subject, body, is_active, is_system, created_at, updated_at`;
// Subject and body are free text (a body is several lines), but a {{field}} that is not one of ours would go out as it is, so it is refused with the list
const wording = (v, label, max, required) => {
    if (!(0, input_js_1.has)(v)) {
        if (required)
            throw (0, input_js_1.bad)(`${label} is required`);
        return null;
    }
    if (typeof v !== 'string')
        throw (0, input_js_1.bad)(`${label} must be text`);
    const t = v.replace(/\r\n/g, '\n').trim();
    if (required && !t)
        throw (0, input_js_1.bad)(`${label} is required`);
    if (t.length > max)
        throw (0, input_js_1.bad)(`${label} can be at most ${max} characters`);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/.test(t))
        throw (0, input_js_1.bad)(`${label} contains characters that are not allowed`);
    const unknown = [...new Set([...t.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]).filter((f) => !exports.MERGE_FIELDS.includes(f)))];
    if (unknown.length)
        throw (0, input_js_1.bad)(`${label} uses merge field(s) that do not exist: ${unknown.map((f) => `{{${f}}}`).join(', ')}. Use only ${exports.MERGE_FIELDS.map((f) => `{{${f}}}`).join(' ')}`);
    if (/\{\{|\}\}/.test(t.replace(/\{\{\s*[a-z_]+\s*\}\}/g, '')))
        throw (0, input_js_1.bad)(`${label} has a { { or } } that is not a merge field`);
    return t;
};
// GET /api/email-templates?type=&q=&active=&page=&pageSize=
router.get('/', async (req, res, next) => {
    try {
        const type = (0, input_js_1.oneOf)(req.query.type, 'type', exports.TYPES), q = (0, input_js_1.qtext)(req.query.q, 'q', 100), active = (0, input_js_1.oneOf)(req.query.active, 'active', ['true', 'false']);
        const { size, offset } = (0, input_js_1.paging)(req.query, 50, 200);
        const params = [];
        let where = '';
        if (type)
            where += ` AND template_type = $${params.push(type)}`;
        if (active)
            where += ` AND is_active = $${params.push(active === 'true')}`;
        if (q)
            where += ` AND (name ILIKE $${params.push((0, applicant_js_1.likeOf)(q))} OR subject ILIKE $${params.length})`;
        const [rows, count] = await Promise.all([
            index_js_1.db.query(`SELECT ${COLS} FROM email_templates WHERE TRUE${where} ORDER BY is_system DESC, name, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, size, offset]),
            index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM email_templates WHERE TRUE${where}`, params),
        ]);
        res.json({ success: true, data: rows.rows, pagination: { page: offset / size + 1, pageSize: size, total: count.rows[0].n }, mergeFields: exports.MERGE_FIELDS });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/email-templates/:id
router.get('/:id', async (req, res, next) => {
    try {
        const r = await index_js_1.db.query(`SELECT ${COLS} FROM email_templates WHERE id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Template id')]);
        if (!r.rows.length)
            throw (0, input_js_1.bad)('Template not found', 404);
        res.json({ success: true, data: r.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
const taken = 'A template with this name already exists';
// A blank type (only spaces) reads as "nothing" in oneOf; on a save it must be a real type, or the column would get a null
const typeOf = (v) => (0, input_js_1.oneOf)(v, 'templateType', exports.TYPES) ?? (() => { throw (0, input_js_1.bad)(`templateType must be one of: ${exports.TYPES.join(', ')}`); })();
// POST /api/email-templates
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(b.name, 'Name', 150, true), type = (0, input_js_1.has)(b.templateType) ? typeOf(b.templateType) : 'general';
        const subject = wording(b.subject, 'Subject', 200, false) ?? '', content = wording(b.body, 'Body', 20000, true), active = (0, input_js_1.flag)(b.isActive, 'isActive') ?? true;
        if ((await index_js_1.db.query(`SELECT 1 FROM email_templates WHERE lower(name) = lower($1)`, [name])).rows.length)
            throw (0, input_js_1.bad)(taken, 409);
        const r = await index_js_1.db.query(`INSERT INTO email_templates (name, template_type, subject, body, is_active, created_by_user_id, updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${COLS}`, [name, type, subject, content, active, req.userId]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'email_template', r.rows[0].id, undefined, { name, template_type: type });
        res.status(201).json({ success: true, data: r.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error?.code === '23505' ? (0, input_js_1.bad)(taken, 409) : error, res, next);
    }
});
// PATCH /api/email-templates/:id - any of name, templateType, subject, body, isActive
router.patch('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Template id'), b = (0, input_js_1.body)(req);
        const sets = [], values = [];
        const set = (col, v) => sets.push(`${col} = $${values.push(v)}`);
        if ((0, input_js_1.has)(b.name))
            set('name', (0, input_js_1.text)(b.name, 'Name', 150, true));
        if ((0, input_js_1.has)(b.templateType))
            set('template_type', typeOf(b.templateType));
        if (b.subject !== undefined)
            set('subject', wording(b.subject, 'Subject', 200, false) ?? '');
        if ((0, input_js_1.has)(b.body))
            set('body', wording(b.body, 'Body', 20000, true));
        else if (b.body !== undefined)
            throw (0, input_js_1.bad)('Body is required');
        if (b.isActive !== undefined)
            set('is_active', (0, input_js_1.flag)(b.isActive, 'isActive'));
        if (!sets.length)
            throw (0, input_js_1.bad)('Nothing to change');
        const before = (await index_js_1.db.query(`SELECT name, template_type, is_active FROM email_templates WHERE id = $1`, [id])).rows[0];
        if (!before)
            throw (0, input_js_1.bad)('Template not found', 404);
        if ((0, input_js_1.has)(b.name) && (await index_js_1.db.query(`SELECT 1 FROM email_templates WHERE lower(name) = lower($1) AND id <> $2`, [b.name.trim(), id])).rows.length)
            throw (0, input_js_1.bad)(taken, 409);
        const r = await index_js_1.db.query(`UPDATE email_templates SET ${sets.join(', ')}, updated_by_user_id = $${values.length + 1}, updated_at = NOW() WHERE id = $${values.length + 2} RETURNING ${COLS}`, [...values, req.userId, id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'email_template', id, before, { name: r.rows[0].name, template_type: r.rows[0].template_type, is_active: r.rows[0].is_active });
        res.json({ success: true, data: r.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error?.code === '23505' ? (0, input_js_1.bad)(taken, 409) : error, res, next);
    }
});
// DELETE /api/email-templates/:id - the four starting templates can be edited or switched off, not deleted
router.delete('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Template id');
        const t = (await index_js_1.db.query(`SELECT name, is_system FROM email_templates WHERE id = $1`, [id])).rows[0];
        if (!t)
            throw (0, input_js_1.bad)('Template not found', 404);
        if (t.is_system)
            throw (0, input_js_1.bad)('A starting template cannot be deleted. Edit it, or switch it off.', 409);
        await index_js_1.db.query(`DELETE FROM email_templates WHERE id = $1 AND is_system = false`, [id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'email_template', id, { name: t.name }, undefined);
        res.json({ success: true });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=email-templates.js.map