// Letter templates: list, read, create, change. The generator itself is in generate.ts.
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../index.js';
import { AuthRequest } from '../../index.js';
import { requirePermission } from '../../middleware/rbac.js';
import { auditChange } from '../../middleware/auditLogger.js';
import { bad, failWith, uuid, has, text, body, qtext, oneOf } from '../../utils/input.js';

const router = Router();

// Legal letter templates (allotment letter, receipt, agreement, conveyance deed). The generator picks the newest template of a type, so only project
// managers and admins may create or change one, the type must be a real letter type, and email wording lives in /api/email-templates instead.
const LETTER_TYPES = ['allotment_letter', 'payment_receipt', 'buyer_builder_agreement', 'conveyance_deed', 'demand_letter', 'check_list'] as const;
const letterBody = (v: any, required: boolean): string | null => {
  if (!has(v)) { if (required) throw bad('The template body is required'); return null; }
  if (typeof v !== 'string' || !v.trim()) throw bad('The template body must be text');
  if (v.length > 500_000) throw bad('The template body is too large (500,000 characters at most)');
  if (v.includes('\u0000')) throw bad('The template body contains a character that cannot be saved');
  return v;
};
const fieldList = (v: any): string[] | null => {
  if (!has(v)) return null;
  if (!Array.isArray(v) || v.length > 100 || v.some((x) => typeof x !== 'string' || !x.trim() || x.length > 100 || x.includes('\u0000'))) throw bad('mergeFields must be a list of up to 100 names');
  return v;
};

// POST /api/documents/templates - Create document template (a template with no project is for all projects)
router.post('/templates', requirePermission('master_data', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const templateName = text(b.name ?? b.title, 'name', 255, true)!, documentType = oneOf(b.documentType, 'documentType', LETTER_TYPES);
    if (!documentType) throw bad('name and documentType are required');
    const templateBody = letterBody(b.bodyHtml ?? b.htmlContent ?? b.body, false) ?? '', mergeFields = fieldList(b.mergeFields) ?? [];
    const projectId = has(b.projectId) ? uuid(b.projectId, 'projectId') : null;
    if (projectId && !(await db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length) throw bad('Project not found', 404);
    const result = await db.query(
      `INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_type, name, created_at`,
      [projectId, documentType, templateName, templateBody, mergeFields, req.userId]
    );
    await auditChange(db, req, res, 'create', 'document_template', result.rows[0].id, undefined, { name: templateName, document_type: documentType, project_id: projectId });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/templates - List templates
router.get('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = has(req.query.projectId) ? uuid(req.query.projectId, 'projectId') : null;
    const documentType = qtext(req.query.documentType, 'documentType', 50);
    const params: any[] = []; let where = '';
    if (projectId) where += ` AND project_id = $${params.push(projectId)}`;
    if (documentType) where += ` AND document_type = $${params.push(documentType)}`;
    const result = await db.query(`SELECT id, project_id, document_type, name, created_at, updated_at FROM document_templates WHERE TRUE${where} ORDER BY created_at DESC, id`, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/documents/templates/:id - Get template detail
router.get('/templates/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, project_id, document_type, name, body_html, merge_fields, created_at, updated_at FROM document_templates WHERE id = $1`, [uuid(req.params.id, 'Template id')]);
    if (!result.rows.length) throw bad('Template not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// PATCH /api/documents/templates/:id - Update template (name, body, merge fields)
router.patch('/templates/:id', requirePermission('master_data', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Template id'), b = body(req);
    const name = has(b.name ?? b.title) ? text(b.name ?? b.title, 'name', 255, true) : null, html = letterBody(b.bodyHtml ?? b.htmlContent, false), fields = fieldList(b.mergeFields);
    if (name === null && html === null && fields === null) throw bad('Nothing to change');
    const result = await db.query(
      `UPDATE document_templates SET name = COALESCE($1, name), body_html = COALESCE($2, body_html), merge_fields = COALESCE($3, merge_fields), updated_at = NOW()
        WHERE id = $4 RETURNING id, document_type, name, updated_at`, [name, html, fields, id]);
    if (!result.rows.length) throw bad('Template not found', 404);
    await auditChange(db, req, res, 'update', 'document_template', id, undefined, { name: result.rows[0].name });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/documents/generate - Generate document from template with merge fields
// POST /api/documents/generate - Generate document from template

export default router;
