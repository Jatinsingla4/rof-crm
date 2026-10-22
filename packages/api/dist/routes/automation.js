"use strict";
/**
 * Automation Rules Routes
 * Create, toggle, run, and delete custom workflow automation rules
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const TRIGGERS = ['lead_created', 'lead_stage_changed', 'payment_received', 'payment_overdue', 'unit_allotted', 'document_uploaded', 'task_due'];
const ACTIONS = ['send_whatsapp', 'send_email', 'send_sms', 'create_task', 'update_stage', 'generate_document', 'notify_manager'];
const SENDS = ['send_whatsapp', 'send_email', 'send_sms'];
const oneWord = (v, label, allowed) => {
    const t = (0, input_js_1.qtext)(v, label, 50);
    if (!t || !allowed.includes(t))
        throw (0, input_js_1.bad)(`${label} must be one of: ${allowed.join(', ')}`);
    return t;
};
const delay = (v) => ((0, input_js_1.has)(v) ? (0, input_js_1.num)(v, 'Delay (minutes)', 525600, 0) : 0);
// GET /api/automation
router.get('/', async (req, res, next) => {
    try {
        const isActive = (0, input_js_1.qtext)(req.query.isActive, 'isActive', 5);
        if (isActive !== null && isActive !== 'true' && isActive !== 'false')
            throw (0, input_js_1.bad)('isActive must be true or false');
        const { size, offset } = (0, input_js_1.paging)(req.query, 100, 500);
        const params = [];
        let where = '';
        if (isActive !== null) {
            params.push(isActive === 'true');
            where = ` AND is_active = $1`;
        }
        params.push(size, offset);
        const result = await index_js_1.db.query(`SELECT id, name, trigger_event, action_type, message_template,
              delay_minutes, is_active, execution_count, last_executed_at, created_at
         FROM automation_rules WHERE 1=1${where}
        ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/automation
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(b.name, 'Name', 255, true);
        const triggerEvent = oneWord(b.triggerEvent, 'triggerEvent', TRIGGERS), actionType = oneWord(b.actionType, 'actionType', ACTIONS);
        const messageTemplate = (0, input_js_1.text)(b.messageTemplate, 'Message template', 2000, SENDS.includes(actionType));
        const delayMinutes = delay(b.delayMinutes);
        const result = await index_js_1.db.query(`INSERT INTO automation_rules (name, trigger_event, action_type, message_template, delay_minutes, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, name, trigger_event, action_type, is_active, created_at`, [name, triggerEvent, actionType, messageTemplate, delayMinutes, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/automation/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Rule id');
        const b = (0, input_js_1.body)(req);
        const isActive = (0, input_js_1.flag)(b.isActive, 'isActive');
        const name = (0, input_js_1.has)(b.name) ? (0, input_js_1.text)(b.name, 'Name', 255, true) : null;
        const triggerEvent = (0, input_js_1.has)(b.triggerEvent) ? oneWord(b.triggerEvent, 'triggerEvent', TRIGGERS) : null;
        const actionType = (0, input_js_1.has)(b.actionType) ? oneWord(b.actionType, 'actionType', ACTIONS) : null;
        const messageTemplate = (0, input_js_1.has)(b.messageTemplate) ? (0, input_js_1.text)(b.messageTemplate, 'Message template', 2000, false) : null;
        const delayMinutes = (0, input_js_1.has)(b.delayMinutes) ? delay(b.delayMinutes) : null;
        if (isActive === undefined && !name && !triggerEvent && !actionType && !messageTemplate && delayMinutes === null)
            throw (0, input_js_1.bad)('Nothing to change');
        const result = await index_js_1.db.query(`UPDATE automation_rules
       SET is_active = COALESCE($1, is_active),
           name = COALESCE($2, name),
           trigger_event = COALESCE($3, trigger_event),
           action_type = COALESCE($4, action_type),
           message_template = COALESCE($5, message_template),
           delay_minutes = COALESCE($6, delay_minutes),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, trigger_event, action_type, is_active, execution_count`, [isActive ?? null, name, triggerEvent, actionType, messageTemplate, delayMinutes, id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Rule not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/automation/:id/run — manually trigger a rule
router.post('/:id/run', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Rule id');
        // ponytail: there is no automation engine yet, a run only counts; the answer says so instead of "queued for execution"
        const result = await index_js_1.db.query(`UPDATE automation_rules SET execution_count = execution_count + 1, last_executed_at = NOW()
        WHERE id = $1 AND is_active = TRUE RETURNING id, name`, [id]);
        if (!result.rows.length) {
            const exists = await index_js_1.db.query(`SELECT 1 FROM automation_rules WHERE id = $1`, [id]);
            if (!exists.rows.length)
                return res.status(404).json({ error: 'Rule not found' });
            return res.status(409).json({ error: 'This rule is switched off. Switch it on to run it.' });
        }
        res.json({
            success: true,
            data: { id, message: `Rule "${result.rows[0].name}" was marked as run. Rules are not executed automatically yet, so nothing was sent.` },
        });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// DELETE /api/automation/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Rule id');
        const result = await index_js_1.db.query(`DELETE FROM automation_rules WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Rule not found' });
        res.json({ success: true, data: { id } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=automation.js.map