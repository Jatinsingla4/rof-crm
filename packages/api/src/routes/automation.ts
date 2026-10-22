/**
 * Automation Rules Routes
 * Create, toggle, run, and delete custom workflow automation rules
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, num, text, flag, body, paging, qtext } from '../utils/input.js';

const router = Router();
const TRIGGERS = ['lead_created', 'lead_stage_changed', 'payment_received', 'payment_overdue', 'unit_allotted', 'document_uploaded', 'task_due'] as const;
const ACTIONS = ['send_whatsapp', 'send_email', 'send_sms', 'create_task', 'update_stage', 'generate_document', 'notify_manager'] as const;
const SENDS = ['send_whatsapp', 'send_email', 'send_sms'];

const oneWord = (v: any, label: string, allowed: readonly string[]): string => {
  const t = qtext(v, label, 50);
  if (!t || !allowed.includes(t)) throw bad(`${label} must be one of: ${allowed.join(', ')}`);
  return t;
};
const delay = (v: any) => (has(v) ? num(v, 'Delay (minutes)', 525600, 0) : 0);

// GET /api/automation
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isActive = qtext(req.query.isActive, 'isActive', 5);
    if (isActive !== null && isActive !== 'true' && isActive !== 'false') throw bad('isActive must be true or false');
    const { size, offset } = paging(req.query, 100, 500);

    const params: any[] = [];
    let where = '';
    if (isActive !== null) { params.push(isActive === 'true'); where = ` AND is_active = $1`; }
    params.push(size, offset);

    const result = await db.query(
      `SELECT id, name, trigger_event, action_type, message_template,
              delay_minutes, is_active, execution_count, last_executed_at, created_at
         FROM automation_rules WHERE 1=1${where}
        ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/automation
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const name = text(b.name, 'Name', 255, true);
    const triggerEvent = oneWord(b.triggerEvent, 'triggerEvent', TRIGGERS), actionType = oneWord(b.actionType, 'actionType', ACTIONS);
    const messageTemplate = text(b.messageTemplate, 'Message template', 2000, SENDS.includes(actionType));
    const delayMinutes = delay(b.delayMinutes);

    const result = await db.query(
      `INSERT INTO automation_rules (name, trigger_event, action_type, message_template, delay_minutes, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, name, trigger_event, action_type, is_active, created_at`,
      [name, triggerEvent, actionType, messageTemplate, delayMinutes, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// PATCH /api/automation/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Rule id');
    const b = body(req);
    const isActive = flag(b.isActive, 'isActive');
    const name = has(b.name) ? text(b.name, 'Name', 255, true) : null;
    const triggerEvent = has(b.triggerEvent) ? oneWord(b.triggerEvent, 'triggerEvent', TRIGGERS) : null;
    const actionType = has(b.actionType) ? oneWord(b.actionType, 'actionType', ACTIONS) : null;
    const messageTemplate = has(b.messageTemplate) ? text(b.messageTemplate, 'Message template', 2000, false) : null;
    const delayMinutes = has(b.delayMinutes) ? delay(b.delayMinutes) : null;
    if (isActive === undefined && !name && !triggerEvent && !actionType && !messageTemplate && delayMinutes === null) throw bad('Nothing to change');

    const result = await db.query(
      `UPDATE automation_rules
       SET is_active = COALESCE($1, is_active),
           name = COALESCE($2, name),
           trigger_event = COALESCE($3, trigger_event),
           action_type = COALESCE($4, action_type),
           message_template = COALESCE($5, message_template),
           delay_minutes = COALESCE($6, delay_minutes),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, trigger_event, action_type, is_active, execution_count`,
      [isActive ?? null, name, triggerEvent, actionType, messageTemplate, delayMinutes, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/automation/:id/run — manually trigger a rule
router.post('/:id/run', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Rule id');

    // ponytail: there is no automation engine yet, a run only counts; the answer says so instead of "queued for execution"
    const result = await db.query(
      `UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = NOW()
        WHERE id = $1 AND is_active = TRUE RETURNING id, name`,
      [id]
    );
    if (!result.rows.length) {
      const exists = await db.query(`SELECT 1 FROM automation_rules WHERE id = $1`, [id]);
      if (!exists.rows.length) return res.status(404).json({ error: 'Rule not found' });
      return res.status(409).json({ error: 'This rule is switched off. Switch it on to run it.' });
    }

    res.json({
      success: true,
      data: { id, message: `Rule "${result.rows[0].name}" was marked as run. Rules are not executed automatically yet, so nothing was sent.` },
    });
  } catch (error) { failWith(error, res, next); }
});

// DELETE /api/automation/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Rule id');
    const result = await db.query(`DELETE FROM automation_rules WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, data: { id } });
  } catch (error) { failWith(error, res, next); }
});

export default router;
