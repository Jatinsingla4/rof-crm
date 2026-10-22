/**
 * Tasks Routes
 * CRM task management — create, list, complete, delete
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, text, day, body, paging, qtext, oneOf } from '../utils/input.js';

const router = Router();
const STATUS = ['pending', 'completed'] as const;
const PRIORITY = ['normal', 'high', 'urgent'] as const;

// A person a task can be given to: an active user
const activeUser = async (id: string) => {
  const r = await db.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE`, [id]);
  if (!r.rows.length) throw bad('The person this task is assigned to is not an active user', 404);
};
// A customer the signed-in user may see (project scope is applied by the database)
const visibleConsumer = async (id: string) => {
  const r = await db.query(`SELECT 1 FROM consumers WHERE id = $1`, [id]);
  if (!r.rows.length) throw bad('Customer not found', 404);
};

// GET /api/tasks
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const status = oneOf(q.status, 'status', STATUS), dueDate = day(qtext(q.dueDate, 'dueDate', 10), 'dueDate');
    const assignedTo = has(q.assignedTo) ? uuid(q.assignedTo, 'assignedTo') : null;
    const consumerId = has(q.consumerId) ? uuid(q.consumerId, 'consumerId') : null;
    const { size, offset } = paging(q, 100, 500);

    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
    if (dueDate) { params.push(dueDate); where += ` AND t.due_date = $${params.length}`; }
    if (assignedTo) { params.push(assignedTo); where += ` AND t.assigned_to = $${params.length}`; }
    if (consumerId) { params.push(consumerId); where += ` AND t.consumer_id = $${params.length}`; }
    params.push(size, offset);

    const result = await db.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.consumer_id, t.assigned_to, t.completed_at, t.created_at,
              u.name as assigned_to_name,
              c.name as consumer_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         LEFT JOIN consumers c ON t.consumer_id = c.id
        WHERE 1=1${where}
        ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST, t.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// POST /api/tasks
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const title = text(b.title, 'Task title', 255, true), description = text(b.description, 'Description', 5000, false);
    const assignedTo = has(b.assignedTo) ? uuid(b.assignedTo, 'assignedTo') : null;
    const consumerId = has(b.consumerId) ? uuid(b.consumerId, 'consumerId') : null;
    const dueDate = day(b.dueDate, 'Due date');
    const priority = has(b.priority) ? oneOf(b.priority, 'priority', PRIORITY) : 'normal';
    if (assignedTo) await activeUser(assignedTo);
    if (consumerId) await visibleConsumer(consumerId);

    const result = await db.query(
      `INSERT INTO tasks (title, description, assigned_to, consumer_id, due_date, priority, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, title, status, priority, due_date, created_at`,
      [title, description, assignedTo, consumerId, dueDate, priority, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Task id');
    const b = body(req);
    const status = has(b.status) ? oneOf(b.status, 'status', STATUS) : null;
    const title = has(b.title) ? text(b.title, 'Task title', 255, true) : null;
    const description = has(b.description) ? text(b.description, 'Description', 5000, false) : null;
    const dueDate = day(b.dueDate, 'Due date');
    const priority = has(b.priority) ? oneOf(b.priority, 'priority', PRIORITY) : null;
    if (!status && !title && !description && !dueDate && !priority) throw bad('Nothing to change');

    const result = await db.query(
      `UPDATE tasks
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           due_date = COALESCE($4, due_date),
           priority = COALESCE($5, priority),
           completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW()) WHEN $1 = 'pending' THEN NULL ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, status, priority, due_date, completed_at`,
      [status, title, description, dueDate, priority, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { failWith(error, res, next); }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Task id');
    const result = await db.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, data: { id } });
  } catch (error) { failWith(error, res, next); }
});

export default router;
