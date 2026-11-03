"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Letter templates: list, read, create, change. The generator itself is in generate.ts.
const express_1 = require("express");
const index_js_1 = require("../../index.js");
const rbac_js_1 = require("../../middleware/rbac.js");
const auditLogger_js_1 = require("../../middleware/auditLogger.js");
const input_js_1 = require("../../utils/input.js");
const router = (0, express_1.Router)();
// Legal letter templates (allotment letter, receipt, agreement, conveyance deed). The generator picks the newest template of a type, so only project
// managers and admins may create or change one, the type must be a real letter type, and email wording lives in /api/email-templates instead.
const LETTER_TYPES = ['allotment_letter', 'payment_receipt', 'buyer_builder_agreement', 'conveyance_deed', 'demand_letter', 'check_list'];
const letterBody = (v, required) => {
    if (!(0, input_js_1.has)(v)) {
        if (required)
            throw (0, input_js_1.bad)('The template body is required');
        return null;
    }
    if (typeof v !== 'string' || !v.trim())
        throw (0, input_js_1.bad)('The template body must be text');
    if (v.length > 500000)
        throw (0, input_js_1.bad)('The template body is too large (500,000 characters at most)');
    if (v.includes('\u0000'))
        throw (0, input_js_1.bad)('The template body contains a character that cannot be saved');
    return v;
};
const fieldList = (v) => {
    if (!(0, input_js_1.has)(v))
        return null;
    if (!Array.isArray(v) || v.length > 100 || v.some((x) => typeof x !== 'string' || !x.trim() || x.length > 100 || x.includes('\u0000')))
        throw (0, input_js_1.bad)('mergeFields must be a list of up to 100 names');
    return v;
};
// POST /api/documents/templates - Create document template (a template with no project is for all projects)
router.post('/templates', (0, rbac_js_1.requirePermission)('master_data', 'create'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const templateName = (0, input_js_1.text)(b.name ?? b.title, 'name', 255, true), documentType = (0, input_js_1.oneOf)(b.documentType, 'documentType', LETTER_TYPES);
        if (!documentType)
            throw (0, input_js_1.bad)('name and documentType are required');
        const templateBody = letterBody(b.bodyHtml ?? b.htmlContent ?? b.body, false) ?? '', mergeFields = fieldList(b.mergeFields) ?? [];
        const projectId = (0, input_js_1.has)(b.projectId) ? (0, input_js_1.uuid)(b.projectId, 'projectId') : null;
        if (projectId && !(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw (0, input_js_1.bad)('Project not found', 404);
        const result = await index_js_1.db.query(`INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_type, name, created_at`, [projectId, documentType, templateName, templateBody, mergeFields, req.userId]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'document_template', result.rows[0].id, undefined, { name: templateName, document_type: documentType, project_id: projectId });
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/documents/templates - List templates
router.get('/templates', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const documentType = (0, input_js_1.qtext)(req.query.documentType, 'documentType', 50);
        const params = [];
        let where = '';
        if (projectId)
            where += ` AND project_id = $${params.push(projectId)}`;
        if (documentType)
            where += ` AND document_type = $${params.push(documentType)}`;
        const result = await index_js_1.db.query(`SELECT id, project_id, document_type, name, created_at, updated_at FROM document_templates WHERE TRUE${where} ORDER BY created_at DESC, id`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/documents/templates/:id - Get template detail
router.get('/templates/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT id, project_id, document_type, name, body_html, merge_fields, created_at, updated_at FROM document_templates WHERE id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Template id')]);
        if (!result.rows.length)
            throw (0, input_js_1.bad)('Template not found', 404);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/documents/templates/:id - Update template (name, body, merge fields)
router.patch('/templates/:id', (0, rbac_js_1.requirePermission)('master_data', 'edit'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Template id'), b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.has)(b.name ?? b.title) ? (0, input_js_1.text)(b.name ?? b.title, 'name', 255, true) : null, html = letterBody(b.bodyHtml ?? b.htmlContent, false), fields = fieldList(b.mergeFields);
        if (name === null && html === null && fields === null)
            throw (0, input_js_1.bad)('Nothing to change');
        const result = await index_js_1.db.query(`UPDATE document_templates SET name = COALESCE($1, name), body_html = COALESCE($2, body_html), merge_fields = COALESCE($3, merge_fields), updated_at = NOW()
        WHERE id = $4 RETURNING id, document_type, name, updated_at`, [name, html, fields, id]);
        if (!result.rows.length)
            throw (0, input_js_1.bad)('Template not found', 404);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'document_template', id, undefined, { name: result.rows[0].name });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/documents/generate - Generate document from template with merge fields
// POST /api/documents/generate - Generate document from template
exports.default = router;
//# sourceMappingURL=templates.js.map