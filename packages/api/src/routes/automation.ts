/**
 * Automation Rules Routes
 * Create, toggle, run, and delete custom workflow automation rules
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// GET /api/automation
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { isActive, page = 1, pageSize = 100 } = req.query;

    let query = `
      SELECT id, name, trigger_event, action_type, message_template,
             delay_minutes, is_active, execution_count, last_executed_at, created_at
      FROM automation_rules WHERE 1=1`;
    const params: any[] = [];

    if (isActive !== undefined) {
      query += ` AND is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    query += ` ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/automation
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, triggerEvent, actionType, messageTemplate, delayMinutes = 0 } = req.body;

    if (!name || !triggerEvent || !actionType) {
      return res.status(400).json({ error: 'name, triggerEvent, and actionType are required' });
    }

    const result = await db.query(
      `INSERT INTO automation_rules (name, trigger_event, action_type, message_template, delay_minutes, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, name, trigger_event, action_type, is_active, created_at`,
      [name, triggerEvent, actionType, messageTemplate || null, delayMinutes, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/automation/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive, name, triggerEvent, actionType, messageTemplate, delayMinutes } = req.body;

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
      [isActive ?? null, name || null, triggerEvent || null, actionType || null,
       messageTemplate || null, delayMinutes ?? null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/automation/:id/run — manually trigger a rule
router.post('/:id/run', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const ruleRes = await db.query(
      `SELECT id, name, trigger_event, action_type, message_template, is_active FROM automation_rules WHERE id = $1`,
      [id]
    );

    if (ruleRes.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });

    // Increment execution count and update timestamp
    await db.query(
      `UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = NOW() WHERE id = $1`,
      [id]
    );

    // Real trigger dispatch would queue the job via Bull — stubbed here
    res.json({
      success: true,
      data: { id, message: `Rule "${ruleRes.rows[0].name}" queued for execution` },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/automation/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM automation_rules WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
});

export default router;
