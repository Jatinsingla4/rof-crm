"use strict";
/**
 * Tasks Routes
 * CRM task management — create, list, complete, delete
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const STATUS = ['pending', 'completed'];
const PRIORITY = ['normal', 'high', 'urgent'];
// A person a task can be given to: an active user
const activeUser = async (id) => {
    const r = await index_js_1.db.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE`, [id]);
    if (!r.rows.length)
        throw (0, input_js_1.bad)('The person this task is assigned to is not an active user', 404);
};
// A customer the signed-in user may see (project scope is applied by the database)
const visibleConsumer = async (id) => {
    const r = await index_js_1.db.query(`SELECT 1 FROM consumers WHERE id = $1`, [id]);
    if (!r.rows.length)
        throw (0, input_js_1.bad)('Customer not found', 404);
};
// GET /api/tasks
router.get('/', async (req, res, next) => {
    try {
        const q = req.query;
        const status = (0, input_js_1.oneOf)(q.status, 'status', STATUS), dueDate = (0, input_js_1.day)((0, input_js_1.qtext)(q.dueDate, 'dueDate', 10), 'dueDate');
        const assignedTo = (0, input_js_1.has)(q.assignedTo) ? (0, input_js_1.uuid)(q.assignedTo, 'assignedTo') : null;
        const consumerId = (0, input_js_1.has)(q.consumerId) ? (0, input_js_1.uuid)(q.consumerId, 'consumerId') : null;
        const { size, offset } = (0, input_js_1.paging)(q, 100, 500);
        const params = [];
        let where = '';
        if (status) {
            params.push(status);
            where += ` AND t.status = $${params.length}`;
        }
        if (dueDate) {
            params.push(dueDate);
            where += ` AND t.due_date = $${params.length}`;
        }
        if (assignedTo) {
            params.push(assignedTo);
            where += ` AND t.assigned_to = $${params.length}`;
        }
        if (consumerId) {
            params.push(consumerId);
            where += ` AND t.consumer_id = $${params.length}`;
        }
        params.push(size, offset);
        const result = await index_js_1.db.query(`SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
              t.consumer_id, t.assigned_to, t.completed_at, t.created_at,
              u.name as assigned_to_name,
              c.name as consumer_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         LEFT JOIN consumers c ON t.consumer_id = c.id
        WHERE 1=1${where}
        ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST, t.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/tasks
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const title = (0, input_js_1.text)(b.title, 'Task title', 255, true), description = (0, input_js_1.text)(b.description, 'Description', 5000, false);
        const assignedTo = (0, input_js_1.has)(b.assignedTo) ? (0, input_js_1.uuid)(b.assignedTo, 'assignedTo') : null;
        const consumerId = (0, input_js_1.has)(b.consumerId) ? (0, input_js_1.uuid)(b.consumerId, 'consumerId') : null;
        const dueDate = (0, input_js_1.day)(b.dueDate, 'Due date');
        const priority = (0, input_js_1.has)(b.priority) ? (0, input_js_1.oneOf)(b.priority, 'priority', PRIORITY) : 'normal';
        if (assignedTo)
            await activeUser(assignedTo);
        if (consumerId)
            await visibleConsumer(consumerId);
        const result = await index_js_1.db.query(`INSERT INTO tasks (title, description, assigned_to, consumer_id, due_date, priority, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, title, status, priority, due_date, created_at`, [title, description, assignedTo, consumerId, dueDate, priority, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/tasks/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Task id');
        const b = (0, input_js_1.body)(req);
        const status = (0, input_js_1.has)(b.status) ? (0, input_js_1.oneOf)(b.status, 'status', STATUS) : null;
        const title = (0, input_js_1.has)(b.title) ? (0, input_js_1.text)(b.title, 'Task title', 255, true) : null;
        const description = (0, input_js_1.has)(b.description) ? (0, input_js_1.text)(b.description, 'Description', 5000, false) : null;
        const dueDate = (0, input_js_1.day)(b.dueDate, 'Due date');
        const priority = (0, input_js_1.has)(b.priority) ? (0, input_js_1.oneOf)(b.priority, 'priority', PRIORITY) : null;
        if (!status && !title && !description && !dueDate && !priority)
            throw (0, input_js_1.bad)('Nothing to change');
        const result = await index_js_1.db.query(`UPDATE tasks
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           due_date = COALESCE($4, due_date),
           priority = COALESCE($5, priority),
           completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW()) WHEN $1 = 'pending' THEN NULL ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, title, status, priority, due_date, completed_at`, [status, title, description, dueDate, priority, id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Task id');
        const result = await index_js_1.db.query(`DELETE FROM tasks WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true, data: { id } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=tasks.js.map