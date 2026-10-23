/**
 * Email Templates
 * Wording for the emails the CRM writes, with merge fields. Kept apart from the legal letters (document_templates), which the letter generator reads.
 * No email sender is connected yet, so a template is only text; nothing here sends mail.
 * Permission: communications (everyone reads, sales and support create, project manager and admin edit, only the admin deletes).
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, text, flag, body, paging, qtext, oneOf } from '../utils/input.js';
import { likeOf } from '../utils/applicant.js';

const router = Router();

export const TYPES = ['general', 'allotment_letter', 'demand_letter', 'payment_receipt', 'welcome', 'reminder'] as const;
export const MERGE_FIELDS = ['consumer_name', 'unit_number', 'amount', 'due_date', 'project_name', 'allotment_date'] as const;
const COLS = `id, name, template_type, subject, body, is_active, is_system, created_at, updated_at`;

// Subject and body are free text (a body is several lines), but a {{field}} that is not one of ours would go out as it is, so it is refused with the list
const wording = (v: any, label: string, max: number, required: boolean): string | null => {
  if (!has(v)) { if (required) throw bad(`${label} is required`); return null; }
  if (typeof v !== 'string') throw bad(`${label} must be text`);
  const t = v.replace(/\r\n/g, '\n').trim();
  if (required && !t) throw bad(`${label} is required`);
  if (t.length > max) throw bad(`${label} can be at most ${max} characters`);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/.test(t)) throw bad(`${label} contains characters that are not allowed`);
  const unknown = [...new Set([...t.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]).filter((f) => !(MERGE_FIELDS as readonly string[]).includes(f)))];
  if (unknown.length) throw bad(`${label} uses merge field(s) that do not exist: ${unknown.map((f) => `{{${f}}}`).join(', ')}. Use only ${MERGE_FIELDS.map((f) => `{{${f}}}`).join(' ')}`);
  if (/\{\{|\}\}/.test(t.replace(/\{\{\s*[a-z_]+\s*\}\}/g, ''))) throw bad(`${label} has a { { or } } that is not a merge field`);
  return t;
};

// GET /api/email-templates?type=&q=&active=&page=&pageSize=
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const type = oneOf(req.query.type, 'type', TYPES), q = qtext(req.query.q, 'q', 100), active = oneOf(req.query.active, 'active', ['true', 'false'] as const);
    const { size, offset } = paging(req.query, 50, 200);
    const params: any[] = []; let where = '';
    if (type) where += ` AND template_type = $${params.push(type)}`;
    if (active) where += ` AND is_active = $${params.push(active === 'true')}`;
    if (q) where += ` AND (name ILIKE $${params.push(likeOf(q))} OR subject ILIKE $${params.length})`;
    const [rows, count] = await Promise.all([
      db.query(`SELECT ${COLS} FROM email_templates WHERE TRUE${where} ORDER BY is_system DESC, name, id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, size, offset]),
      db.query(`SELECT COUNT(*)::int AS n FROM email_templates WHERE TRUE${where}`, params),
    ]);
    res.json({ success: true, data: rows.rows, pagination: { page: offset / size + 1, pageSize: size, total: count.rows[0].n }, mergeFields: MERGE_FIELDS });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/email-templates/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = await db.query(`SELECT ${COLS} FROM email_templates WHERE id = $1`, [uuid(req.params.id, 'Template id')]);
    if (!r.rows.length) throw bad('Template not found', 404);
    res.json({ success: true, data: r.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

const taken = 'A template with this name already exists';

// POST /api/email-templates
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const name = text(b.name, 'Name', 150, true)!, type = has(b.templateType) ? oneOf(b.templateType, 'templateType', TYPES)! : 'general';
    const subject = wording(b.subject, 'Subject', 200, false) ?? '', content = wording(b.body, 'Body', 20000, true)!, active = flag(b.isActive, 'isActive') ?? true;
    if ((await db.query(`SELECT 1 FROM email_templates WHERE lower(name) = lower($1)`, [name])).rows.length) throw bad(taken, 409);
    const r = await db.query(
      `INSERT INTO email_templates (name, template_type, subject, body, is_active, created_by_user_id, updated_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING ${COLS}`,
      [name, type, subject, content, active, req.userId]);
    await auditChange(db, req, res, 'create', 'email_template', r.rows[0].id, undefined, { name, template_type: type });
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (error: any) { failWith(error?.code === '23505' ? bad(taken, 409) : error, res, next); }
});

// PATCH /api/email-templates/:id - any of name, templateType, subject, body, isActive
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Template id'), b = body(req);
    const sets: string[] = [], values: any[] = [];
    const set = (col: string, v: any) => sets.push(`${col} = $${values.push(v)}`);
    if (has(b.name)) set('name', text(b.name, 'Name', 150, true));
    if (has(b.templateType)) set('template_type', oneOf(b.templateType, 'templateType', TYPES));
    if (b.subject !== undefined) set('subject', wording(b.subject, 'Subject', 200, false) ?? '');
    if (has(b.body)) set('body', wording(b.body, 'Body', 20000, true));
    else if (b.body !== undefined) throw bad('Body is required');
    if (b.isActive !== undefined) set('is_active', flag(b.isActive, 'isActive'));
    if (!sets.length) throw bad('Nothing to change');
    const before = (await db.query(`SELECT name, template_type, is_active FROM email_templates WHERE id = $1`, [id])).rows[0];
    if (!before) throw bad('Template not found', 404);
    if (has(b.name) && (await db.query(`SELECT 1 FROM email_templates WHERE lower(name) = lower($1) AND id <> $2`, [b.name.trim(), id])).rows.length) throw bad(taken, 409);
    const r = await db.query(`UPDATE email_templates SET ${sets.join(', ')}, updated_by_user_id = $${values.length + 1}, updated_at = NOW() WHERE id = $${values.length + 2} RETURNING ${COLS}`, [...values, req.userId, id]);
    await auditChange(db, req, res, 'update', 'email_template', id, before, { name: r.rows[0].name, template_type: r.rows[0].template_type, is_active: r.rows[0].is_active });
    res.json({ success: true, data: r.rows[0] });
  } catch (error: any) { failWith(error?.code === '23505' ? bad(taken, 409) : error, res, next); }
});

// DELETE /api/email-templates/:id - the four starting templates can be edited or switched off, not deleted
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Template id');
    const t = (await db.query(`SELECT name, is_system FROM email_templates WHERE id = $1`, [id])).rows[0];
    if (!t) throw bad('Template not found', 404);
    if (t.is_system) throw bad('A starting template cannot be deleted. Edit it, or switch it off.', 409);
    await db.query(`DELETE FROM email_templates WHERE id = $1 AND is_system = false`, [id]);
    await auditChange(db, req, res, 'delete', 'email_template', id, { name: t.name }, undefined);
    res.json({ success: true });
  } catch (error) { failWith(error, res, next); }
});

export default router;
