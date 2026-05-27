"use strict";
/**
 * Tasks Routes
 * CRM task management — create, list, complete, delete
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// GET /api/tasks
router.get('/', async (req, res, next) => {
    try {
        const { status, dueDate, assignedTo, consumerId, page = 1, pageSize = 100 } = req.query;
        let query = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             t.consumer_id, t.completed_at, t.created_at,
             u.name as assigned_to_name,
             c.name as consumer_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN consumers c ON t.consumer_id = c.id
      WHERE 1=1`;
        const params = [];
        if (status) {
            query += ` AND t.status = $${params.length + 1}`;
            params.push(status);
        }
        if (dueDate) {
            query += ` AND t.due_date = $${params.length + 1}`;
            params.push(dueDate);
        }
        if (assignedTo) {
            query += ` AND t.assigned_to = $${params.length + 1}`;
            params.push(assignedTo);
        }
        if (consumerId) {
            query += ` AND t.consumer_id = $${params.length + 1}`;
            params.push(consumerId);
        }
        query += ` ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST, t.created_at DESC`;
        query += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
        const result = await index_js_1.db.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/tasks
router.post('/', async (req, res, next) => {
    try {
        const { title, description, assignedTo, consumerId, dueDate, priority = 'normal' } = req.body;
        if (!title)
            return res.status(400).json({ error: 'Task title is required' });
        const result = await index_js_1.db.query(`INSERT INTO tasks (title, description, assigned_to, consumer_id, due_date, priority, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, title, status, priority, due_date, created_at`, [title, description || null, assignedTo || null, consumerId || null, dueDate || null, priority, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/tasks/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, title, description, dueDate, priority } = req.body;
        const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
        const result = await index_js_1.db.query(`UPDATE tasks
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           due_date = COALESCE($4, due_date),
           priority = COALESCE($5, priority),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() WHEN $1 = 'pending' THEN NULL ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, status, priority, due_date, completed_at`, [status || null, title || null, description || null, dueDate || null, priority || null, id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true, data: { id } });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map