"use strict";
/**
 * Communications Routes - Module F
 * Remarks log, email, WhatsApp, SMS, AI suggestions, ticket escalation, calling, broadcast campaigns
 *
 * Nothing here talks to an email / WhatsApp / SMS provider yet: a "send" is written to `communications`
 * with status 'queued' (not 'sent') and the answer says so.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const input_js_1 = require("../utils/input.js");
const applicant_js_1 = require("../utils/applicant.js");
const router = (0, express_1.Router)();
const OUT = ['email', 'whatsapp', 'sms'];
const ALL_CHANNELS = ['email', 'whatsapp', 'sms', 'instagram', 'facebook'];
const REMARK_CHANNELS = ['call', 'email', 'whatsapp', 'sms', 'meeting', 'site_visit', 'other'];
const TICKET_STATUS = ['open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const SEGMENTS = ['all', 'enquiry', 'interested', 'application_filed', 'allotted'];
// What the calling screen calls a customer, and the lead_stage values behind it
const CUSTOMER_STATUS = {
    Lead: ['enquiry', 'interested'], Applicant: ['application_filed', 'draw_entered'], Allottee: ['allotted'],
    'Registry Done': ['onboarded'], Cancelled: ['cancelled'],
};
const STAGES = ['enquiry', 'interested', 'application_filed', 'draw_entered', 'allotted', 'onboarded', 'cancelled', 'transferred'];
const NOT_SENT = 'Recorded as queued. No email, WhatsApp or SMS sender is connected yet, so nothing has left the system.';
const today = () => new Date().toISOString().slice(0, 10);
const MAX_LIST = 2000;
const outChannel = (v, label = 'channel') => { const c = (0, input_js_1.oneOf)(v, label, OUT); if (!c)
    throw (0, input_js_1.bad)(`${label} is required`); return c; };
const email = (v) => {
    const t = (0, input_js_1.text)(v, 'Email', 255, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t))
        throw (0, input_js_1.bad)('Email is not valid');
    return t;
};
const phone = (v) => {
    const t = (0, input_js_1.text)(v, 'Phone', 20, true);
    if (!/^\+?\d{10,15}$/.test(t.replace(/[\s-]/g, '')))
        throw (0, input_js_1.bad)('Phone must be 10 to 15 digits');
    return t.replace(/[\s-]/g, '');
};
// A customer the signed-in user may see (the database hides other projects)
const consumerOf = async (id) => {
    const r = await pool_1.db.query(`SELECT id, name, email, mobile, project_id FROM consumers WHERE id = $1`, [id]);
    if (!r.rows.length)
        throw (0, input_js_1.bad)('Customer not found', 404);
    return r.rows[0];
};
const activeUser = async (id) => {
    if (!(await pool_1.db.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE`, [id])).rows.length)
        throw (0, input_js_1.bad)('That user is not active', 404);
};
const projectOf = async (id) => {
    const r = await pool_1.db.query(`SELECT id FROM projects WHERE id = $1`, [id]);
    if (!r.rows.length)
        throw (0, input_js_1.bad)('Project not found', 404);
};
// One place that writes an outgoing message; the same text to the same customer on the same channel within 15 s is a double click
const record = (userId, o) => (0, input_js_1.inTx)(async (c) => {
    await (0, input_js_1.lock)(c, `comm:${o.consumerId}:${o.channel}`);
    const dup = await c.query(`SELECT 1 FROM communications WHERE consumer_id = $1 AND channel = $2 AND message = $3 AND direction = 'outbound' AND created_at > NOW() - INTERVAL '15 seconds'`, [o.consumerId, o.channel, o.message]);
    if (dup.rows.length)
        throw (0, input_js_1.bad)('This exact message was just recorded for this customer. Wait a moment before sending it again.', 409);
    const r = await c.query(`INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, phone_recipient, status, sent_by_user_id)
       VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'queued', $7)
       RETURNING id, channel, direction, subject, status, created_at`, [o.consumerId, o.channel, o.subject ?? null, o.message, o.emailTo ?? null, o.phoneTo ?? null, userId]);
    return r.rows[0];
});
// GET /api/communications/status-codes - Get calling status codes
router.get('/status-codes', async (req, res, next) => {
    try {
        const result = await pool_1.db.query('SELECT code, category FROM communication_status_codes WHERE is_active = TRUE ORDER BY code');
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/calling-list - Selection Free Calling List
router.get('/calling-list', async (req, res, next) => {
    try {
        const q = req.query;
        const minAmt = (0, input_js_1.has)(q.minOsAmount) ? (0, input_js_1.num)(q.minOsAmount, 'minOsAmount', 10000000000, 2) : 0;
        const projectId = (0, input_js_1.has)(q.projectId) ? (0, input_js_1.uuid)(q.projectId, 'projectId') : null;
        const towerId = (0, input_js_1.has)(q.towerId) ? (0, input_js_1.uuid)(q.towerId, 'towerId') : null;
        const statusCode = (0, input_js_1.qtext)(q.statusCode, 'statusCode', 50), subStatusCode = (0, input_js_1.qtext)(q.subStatusCode, 'subStatusCode', 100);
        const customerStatus = (0, input_js_1.qtext)(q.customerStatus, 'customerStatus', 30);
        const employeeId = (0, input_js_1.has)(q.employeeId) ? (0, input_js_1.uuid)(q.employeeId, 'employeeId') : null;
        const regNo = (0, input_js_1.qtext)(q.regNo, 'regNo'), customerName = (0, input_js_1.qtext)(q.customerName, 'customerName'), unitNo = (0, input_js_1.qtext)(q.unitNo, 'unitNo');
        const stages = customerStatus ? CUSTOMER_STATUS[customerStatus] || [customerStatus] : null;
        if (stages && !stages.every((x) => STAGES.includes(x)))
            throw (0, input_js_1.bad)(`customerStatus must be one of: ${[...Object.keys(CUSTOMER_STATUS), ...STAGES].join(', ')}`);
        const params = [minAmt];
        let where = '';
        const add = (sql, v) => { params.push(v); where += ` AND ${sql.replace('?', `$${params.length}`)}`; };
        if (projectId)
            add('p.id = ?', projectId);
        if (towerId)
            add('t.id = ?', towerId);
        if (stages)
            add('c.lead_stage = ANY(?)', stages);
        if (employeeId)
            add('EXISTS (SELECT 1 FROM call_logs cl WHERE cl.consumer_id = c.id AND cl.user_id = ?)', employeeId); // customers this employee has called
        if (statusCode)
            add('c.last_call_status = ?', statusCode);
        if (subStatusCode)
            add('c.last_call_sub_status = ?', subStatusCode);
        if (regNo)
            add(`c.registration_no ILIKE ? ESCAPE '\\'`, (0, applicant_js_1.likeOf)(regNo));
        if (customerName)
            add(`c.name ILIKE ? ESCAPE '\\'`, (0, applicant_js_1.likeOf)(customerName));
        if (unitNo)
            add(`u.unit_number ILIKE ? ESCAPE '\\'`, (0, applicant_js_1.likeOf)(unitNo));
        const result = await pool_1.db.query(`SELECT c.id, c.name, c.mobile, c.registration_no, c.total_overdue_amt,
              c.last_call_status, c.last_call_sub_status, c.promise_to_pay_date, c.next_call_date,
              c.lead_stage as customer_status,
              u.unit_number, p.name as project_name, t.tower_name
         FROM consumers c
         LEFT JOIN projects p ON c.project_id = p.id
         LEFT JOIN units u ON c.allocated_unit_id = u.id
         LEFT JOIN towers t ON u.tower_id = t.id
        WHERE (c.total_overdue_amt >= $1 OR $1 = 0)${where}
        ORDER BY c.total_overdue_amt DESC NULLS LAST, c.id
        LIMIT ${MAX_LIST}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/log-call - Log a debt recovery call
router.post('/log-call', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId');
        const statusCode = (0, input_js_1.text)(b.statusCode, 'Status', 50, true);
        const subStatusCode = (0, input_js_1.text)(b.subStatusCode, 'Sub status', 100, false);
        const ptpDate = (0, input_js_1.day)(b.ptpDate, 'Promise to pay date'), nextCallDate = (0, input_js_1.day)(b.nextCallDate, 'Next call date');
        const remarks = (0, input_js_1.text)(b.remarks, 'Remarks', 2000, false);
        if (ptpDate && ptpDate < today())
            throw (0, input_js_1.bad)('A promise to pay date cannot be in the past');
        if (nextCallDate && nextCallDate < today())
            throw (0, input_js_1.bad)('The next call date cannot be in the past');
        await (0, input_js_1.inTx)(async (c) => {
            const code = await c.query(`SELECT 1 FROM communication_status_codes WHERE code = $1 AND is_active = TRUE`, [statusCode]);
            if (!code.rows.length)
                throw (0, input_js_1.bad)('This status is not in the list of calling status codes');
            // FOR UPDATE: two calls logged at once for one customer end with the last one, never a mix
            const who = await c.query(`SELECT id FROM consumers WHERE id = $1 FOR UPDATE`, [consumerId]);
            if (!who.rows.length)
                throw (0, input_js_1.bad)('Customer not found', 404);
            await c.query(`INSERT INTO call_logs (consumer_id, user_id, status_code, sub_status_code, ptp_date, remarks, next_call_date, call_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, clock_timestamp())`, // after the lock, so the log order is the order the customer record changed in
            [consumerId, req.userId, statusCode, subStatusCode, ptpDate, remarks, nextCallDate]);
            // the history panel and the customer timeline read remarks, so a logged call is also a remark
            await c.query(`INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date) VALUES ($1, $2, 'call', $3, $4, $5)`, [consumerId, req.userId, subStatusCode ? `${statusCode} - ${subStatusCode}` : statusCode, remarks || subStatusCode, nextCallDate]);
            await c.query(`UPDATE consumers
            SET last_call_status = $1, last_call_sub_status = $2, promise_to_pay_date = $3, next_call_date = $4, updated_at = NOW()
          WHERE id = $5`, [statusCode, subStatusCode, ptpDate, nextCallDate, consumerId]);
        });
        res.json({ success: true, message: 'Call logged successfully' });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/remarks - Create remark
router.post('/remarks', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId');
        const channel = (0, input_js_1.oneOf)(b.channel, 'channel', REMARK_CHANNELS);
        if (!channel)
            throw (0, input_js_1.bad)('channel is required');
        const subject = (0, input_js_1.text)(b.subject, 'Subject', 255, false), notes = (0, input_js_1.text)(b.notes, 'Notes', 5000, false);
        if (!subject && !notes)
            throw (0, input_js_1.bad)('Write a subject or some notes');
        const followUpDate = (0, input_js_1.day)(b.followUpDate, 'Follow-up date');
        if (b.tags !== undefined && b.tags !== null && (!Array.isArray(b.tags) || b.tags.length > 10))
            throw (0, input_js_1.bad)('tags must be a list of at most 10 words');
        const tags = (b.tags || []).map((t) => (0, input_js_1.text)(t, 'Tag', 30, true));
        await consumerOf(consumerId);
        const result = await pool_1.db.query(`INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, channel, subject, notes, follow_up_date, timestamp`, [consumerId, req.userId, channel, subject, notes, followUpDate, tags.length ? tags : null]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/remarks/:consumerId - Get remarks timeline
router.get('/remarks/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'consumerId');
        const channel = (0, input_js_1.oneOf)(req.query.channel, 'channel', REMARK_CHANNELS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 20, 200);
        const params = [consumerId];
        let where = '';
        if (channel) {
            params.push(channel);
            where = ` AND channel = $2`;
        }
        params.push(size, offset);
        const result = await pool_1.db.query(`SELECT id, channel, subject, notes, timestamp, follow_up_date, tags
         FROM remarks WHERE consumer_id = $1${where}
        ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/emails - Send email via integration
router.post('/emails', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), to = email(b.recipientEmail);
        const subject = (0, input_js_1.text)(b.subject, 'Subject', 255, true), message = (0, input_js_1.text)(b.htmlBody, 'Message', 20000, true);
        await consumerOf(consumerId);
        const row = await record(req.userId, { consumerId, channel: 'email', subject, message, emailTo: to });
        res.status(201).json({ success: true, data: row, message: NOT_SENT });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/whatsapp | /sms
for (const [path, channel, max] of [['whatsapp', 'whatsapp', 4096], ['sms', 'sms', 1600]]) {
    router.post(`/${path}`, async (req, res, next) => {
        try {
            const b = (0, input_js_1.body)(req);
            const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), to = phone(b.recipientPhone), message = (0, input_js_1.text)(b.message, 'Message', max, true);
            await consumerOf(consumerId);
            const row = await record(req.userId, { consumerId, channel, message, phoneTo: to });
            res.status(201).json({ success: true, data: row, message: NOT_SENT });
        }
        catch (error) {
            (0, input_js_1.failWith)(error, res, next);
        }
    });
}
// POST /api/communications/tickets - Create support ticket
router.post('/tickets', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId');
        const subject = (0, input_js_1.text)(b.subject, 'Subject', 255, true), description = (0, input_js_1.text)(b.description, 'Description', 5000, true);
        const priority = (0, input_js_1.has)(b.priority) ? (0, input_js_1.oneOf)(b.priority, 'priority', TICKET_PRIORITY) : 'medium';
        const assignedTo = (0, input_js_1.has)(b.assignedToUserId) ? (0, input_js_1.uuid)(b.assignedToUserId, 'assignedToUserId') : null;
        await consumerOf(consumerId);
        if (assignedTo)
            await activeUser(assignedTo);
        const result = await pool_1.db.query(`INSERT INTO support_tickets (consumer_id, subject, description, priority, assigned_to_user_id, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING id, subject, priority, status, created_at`, [consumerId, subject, description, priority, assignedTo, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/tickets - Get support tickets
router.get('/tickets', async (req, res, next) => {
    try {
        const status = (0, input_js_1.oneOf)(req.query.status, 'status', TICKET_STATUS), priority = (0, input_js_1.oneOf)(req.query.priority, 'priority', TICKET_PRIORITY);
        const assignedTo = (0, input_js_1.has)(req.query.assignedToUserId) ? (0, input_js_1.uuid)(req.query.assignedToUserId, 'assignedToUserId') : null;
        const { size, offset } = (0, input_js_1.paging)(req.query, 20, 500);
        const params = [];
        let where = '';
        if (status) {
            params.push(status);
            where += ` AND t.status = $${params.length}`;
        }
        if (priority) {
            params.push(priority);
            where += ` AND t.priority = $${params.length}`;
        }
        if (assignedTo) {
            params.push(assignedTo);
            where += ` AND t.assigned_to_user_id = $${params.length}`;
        }
        params.push(size, offset);
        const result = await pool_1.db.query(`SELECT t.id, t.consumer_id, c.name AS consumer_name, t.subject, t.priority, t.status, t.assigned_to_user_id, t.created_at, t.updated_at
         FROM support_tickets t LEFT JOIN consumers c ON c.id = t.consumer_id
        WHERE 1=1${where}
        ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/communications/tickets/:id - Update ticket status
router.patch('/tickets/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Ticket id');
        const b = (0, input_js_1.body)(req);
        const status = (0, input_js_1.has)(b.status) ? (0, input_js_1.oneOf)(b.status, 'status', TICKET_STATUS) : null;
        const priority = (0, input_js_1.has)(b.priority) ? (0, input_js_1.oneOf)(b.priority, 'priority', TICKET_PRIORITY) : null;
        const assignedTo = (0, input_js_1.has)(b.assignedToUserId) ? (0, input_js_1.uuid)(b.assignedToUserId, 'assignedToUserId') : null;
        if (!status && !priority && !assignedTo)
            throw (0, input_js_1.bad)('Nothing to change');
        if (assignedTo)
            await activeUser(assignedTo);
        const result = await pool_1.db.query(`UPDATE support_tickets
       SET status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           assigned_to_user_id = COALESCE($3, assigned_to_user_id),
           resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN COALESCE(resolved_at, NOW()) WHEN $1 IN ('open','in_progress') THEN NULL ELSE resolved_at END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, subject, status, priority, updated_at`, [status, priority, assignedTo, id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Ticket not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/messages - the messages of one channel (or all), newest first, for the overview and the inbox screens
router.get('/messages', async (req, res, next) => {
    try {
        const channel = (0, input_js_1.oneOf)(req.query.channel, 'channel', ALL_CHANNELS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 100, 500);
        const params = [];
        let where = '';
        if (channel) {
            params.push(channel);
            where = ` WHERE m.channel = $1`;
        }
        params.push(size, offset);
        const result = await pool_1.db.query(`SELECT m.id, m.consumer_id, c.name AS consumer_name, m.channel, m.direction, m.subject, m.message,
              m.email_recipient, m.phone_recipient, m.status, m.created_at
         FROM communications m JOIN consumers c ON c.id = m.consumer_id${where}
        ORDER BY m.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/ai-suggestions - Get AI-suggested replies
router.post('/ai-suggestions', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId');
        const consumerQuery = (0, input_js_1.text)(b.consumerQuery, 'consumerQuery', 2000, true), context = (0, input_js_1.text)(b.context, 'context', 2000, false);
        const channel = (0, input_js_1.has)(b.channel) ? outChannel(b.channel) : 'email';
        // Fallback suggestions if API key is missing or API fails
        const fallbackSuggestions = [
            'Thank you for your inquiry. We will get back to you shortly with the information you requested.',
            'We have received your request and will process it within 24 hours. We appreciate your patience.',
            'We are happy to assist you. Could you please provide additional details about your concern?',
        ];
        const consumerResult = await pool_1.db.query(`SELECT c.id, c.name, c.lead_stage, c.income_category,
              p.name as project_name, u.unit_number, u.bhk_type
       FROM consumers c
       LEFT JOIN allocations a ON c.id = a.consumer_id AND a.status = 'allotted'
       LEFT JOIN units u ON a.unit_id = u.id
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE c.id = $1`, [consumerId]);
        const consumer = consumerResult.rows[0];
        if (!consumer)
            return res.status(404).json({ error: 'Customer not found' });
        // If no API key configured, return fallback suggestions
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('placeholder')) {
            return res.json({
                success: true,
                data: {
                    suggestions: fallbackSuggestions,
                    model: 'claude-sonnet-4-20250514',
                    note: 'API key not configured — returning fallback suggestions',
                },
            });
        }
        // Build context-aware system prompt
        const systemPrompt = `You are a professional customer service assistant for ROF Group, an affordable housing developer in Gurugram, Haryana, India. You help staff draft responses to customer queries.

Customer details:
- Name: ${consumer.name}
- Lead Stage: ${consumer.lead_stage || 'Unknown'}
- Project: ${consumer.project_name || 'Not allotted'}
- Unit: ${consumer.unit_number || 'Not allotted'}
- Income Category: ${consumer.income_category || 'Unknown'}

Generate 3 professional response suggestions for the ${channel} channel.
Each suggestion should be:
- Professional and empathetic in tone
- Accurate about ROF's affordable housing processes and AHP compliance
- Appropriately concise for ${channel === 'sms' ? 'SMS (max 160 chars)' : channel === 'whatsapp' ? 'WhatsApp (conversational)' : 'email (professional)'}
- Ready to send with minimal editing by staff

Return ONLY a JSON array of 3 strings. No other text, no markdown, no explanation. Just the JSON array.`;
        try {
            const anthropic = new sdk_1.default({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            const message = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: `Customer query: "${consumerQuery}"${context ? `\n\nAdditional context: ${context}` : ''}\n\nGenerate 3 response suggestions.`,
                    },
                ],
                system: systemPrompt,
            });
            // Parse the response
            const responseText = message.content[0].type === 'text' ? message.content[0].text : '[]';
            const suggestions = JSON.parse(responseText);
            // Validate we got an array of strings
            if (!Array.isArray(suggestions) ||
                !suggestions.every((s) => typeof s === 'string')) {
                throw new Error('Invalid response format');
            }
            res.json({
                success: true,
                data: {
                    suggestions: suggestions.slice(0, 3),
                    consumerId,
                    channel,
                    model: 'claude-sonnet-4-20250514',
                },
            });
        }
        catch (apiError) {
            console.error('Claude API error:', apiError);
            // Return fallback suggestions on API error
            res.json({
                success: true,
                data: {
                    suggestions: fallbackSuggestions,
                    model: 'claude-sonnet-4-20250514',
                    note: 'API error — returning fallback suggestions',
                },
            });
        }
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// The people a campaign would reach: customers of the project, in the segment, who have a contact for the channel
const recipients = async (projectId, channel, segment, ids) => {
    const contact = channel === 'email' ? `COALESCE(email,'') <> ''` : `COALESCE(mobile,'') <> ''`;
    const params = [projectId];
    let where = '';
    if (ids) {
        params.push(ids);
        where += ` AND id = ANY($${params.length})`;
    }
    else if (segment !== 'all') {
        params.push(segment);
        where += ` AND lead_stage = $${params.length}`;
    }
    const r = await pool_1.db.query(`SELECT COUNT(*)::int AS n FROM consumers WHERE project_id = $1 AND ${contact}${where}`, params);
    return r.rows[0].n;
};
// POST /api/communications/broadcast - Send bulk WhatsApp/SMS campaign
router.post('/broadcast', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const channel = outChannel(b.channel), message = (0, input_js_1.text)(b.message, 'Message', 4096, true);
        const segment = (0, input_js_1.has)(b.segmentFilter) ? (0, input_js_1.oneOf)(b.segmentFilter, 'segmentFilter', SEGMENTS) : 'all';
        let ids;
        if (b.consumerIds !== undefined && b.consumerIds !== null) {
            if (!Array.isArray(b.consumerIds) || b.consumerIds.length < 1 || b.consumerIds.length > 5000)
                throw (0, input_js_1.bad)('consumerIds must be a list of 1 to 5000 customers');
            ids = [...new Set(b.consumerIds.map((x) => (0, input_js_1.uuid)(x, 'consumerIds')))];
        }
        else if (!(0, input_js_1.has)(b.segmentFilter))
            throw (0, input_js_1.bad)('Send consumerIds or a segmentFilter');
        await projectOf(projectId);
        const total = await recipients(projectId, channel, segment, ids);
        if (!total)
            throw (0, input_js_1.bad)(`No customer of this project has a ${channel === 'email' ? 'email address' : 'mobile number'} to send to`, 409);
        const result = await pool_1.db.query(`INSERT INTO broadcast_campaigns (project_id, channel, message, segment, total_recipients, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6)
       RETURNING id, channel, total_recipients, status, created_at`, [projectId, channel, message, ids ? null : segment, total, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0], message: NOT_SENT });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/campaigns - Get broadcast campaigns
router.get('/campaigns', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const channel = (0, input_js_1.oneOf)(req.query.channel, 'channel', OUT);
        const { size, offset } = (0, input_js_1.paging)(req.query, 50, 500);
        const params = [];
        let where = '';
        if (projectId) {
            params.push(projectId);
            where += ` AND bc.project_id = $${params.length}`;
        }
        if (channel) {
            params.push(channel);
            where += ` AND bc.channel = $${params.length}`;
        }
        params.push(size, offset);
        const result = await pool_1.db.query(`SELECT bc.id, bc.name, bc.project_id, p.name AS project_name, bc.channel, bc.message, bc.segment, bc.total_recipients, bc.delivered_count, bc.status, bc.created_at
         FROM broadcast_campaigns bc LEFT JOIN projects p ON p.id = bc.project_id
        WHERE 1=1${where}
        ORDER BY bc.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/campaigns - Create broadcast campaign (a draft)
router.post('/campaigns', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(b.name, 'Name', 255, true), message = (0, input_js_1.text)(b.message, 'Message', 4096, true);
        const channel = outChannel(b.channel);
        const segment = (0, input_js_1.has)(b.segment) ? (0, input_js_1.oneOf)(b.segment, 'segment', SEGMENTS) : 'all';
        if (!(0, input_js_1.has)(b.projectId))
            throw (0, input_js_1.bad)('Choose the project this campaign is for');
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        await projectOf(projectId);
        const result = await pool_1.db.query(`INSERT INTO broadcast_campaigns (name, channel, message, segment, project_id, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING id, name, channel, message, segment, project_id, status, created_at`, [name, channel, message, segment, projectId, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/campaigns/:id/launch - a draft is queued with the people it reaches today
router.post('/campaigns/:id/launch', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Campaign id');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const r = await c.query(`SELECT id, project_id, channel, segment, status FROM broadcast_campaigns WHERE id = $1 FOR UPDATE`, [id]);
            if (!r.rows.length)
                throw (0, input_js_1.bad)('Campaign not found', 404);
            const k = r.rows[0];
            if (k.status !== 'draft')
                throw (0, input_js_1.bad)(`This campaign is already ${k.status}; only a draft can be launched`, 409);
            const total = await recipients(k.project_id, k.channel, k.segment || 'all');
            if (!total)
                throw (0, input_js_1.bad)(`No customer in this project and segment has a ${k.channel === 'email' ? 'email address' : 'mobile number'} to send to`, 409);
            const u = await c.query(`UPDATE broadcast_campaigns SET status = 'queued', total_recipients = $2, updated_at = NOW() WHERE id = $1 RETURNING id, status, total_recipients`, [id, total]);
            return u.rows[0];
        });
        res.json({ success: true, data: out, message: NOT_SENT });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// DELETE /api/communications/campaigns/:id - Delete a campaign that has not gone out
router.delete('/campaigns/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Campaign id');
        const r = await pool_1.db.query(`DELETE FROM broadcast_campaigns WHERE id = $1 AND status IN ('draft','failed') RETURNING id`, [id]);
        if (!r.rows.length) {
            const k = await pool_1.db.query(`SELECT status FROM broadcast_campaigns WHERE id = $1`, [id]);
            if (!k.rows.length)
                return res.status(404).json({ error: 'Campaign not found' });
            return res.status(409).json({ error: `A ${k.rows[0].status} campaign is kept as a record and cannot be deleted` });
        }
        res.json({ success: true, data: { id } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/:consumerId/send — unified send by consumer + channel
router.post('/:consumerId/send', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'consumerId');
        const b = (0, input_js_1.body)(req);
        const channel = (0, input_js_1.has)(b.channel) ? outChannel(b.channel) : 'email';
        const message = (0, input_js_1.text)(b.message, 'Message', channel === 'sms' ? 1600 : channel === 'whatsapp' ? 4096 : 20000, true);
        const subject = channel === 'email' ? (0, input_js_1.text)(b.subject, 'Subject', 255, false) : null;
        const consumer = await consumerOf(consumerId);
        if (channel === 'email' && !consumer.email)
            throw (0, input_js_1.bad)('This customer has no email address saved', 409);
        if (channel !== 'email' && !consumer.mobile)
            throw (0, input_js_1.bad)('This customer has no mobile number saved', 409);
        const row = await record(req.userId, {
            consumerId, channel, subject, message,
            emailTo: channel === 'email' ? consumer.email : null, phoneTo: channel === 'email' ? null : consumer.mobile,
        });
        res.status(201).json({ success: true, data: row, message: NOT_SENT });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/communications/:consumerId/ai-draft — generate AI reply draft for consumer
router.post('/:consumerId/ai-draft', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'consumerId');
        const consumerRes = await pool_1.db.query(`SELECT c.id, c.name, c.lead_stage,
              u.unit_number, u.bhk_type
       FROM consumers c
       LEFT JOIN units u ON c.allocated_unit_id = u.id
       WHERE c.id = $1`, [consumerId]);
        if (consumerRes.rows.length === 0)
            return res.status(404).json({ error: 'Customer not found' });
        const consumer = consumerRes.rows[0];
        const suggestions = [
            `Dear ${consumer.name}, thank you for reaching out. We appreciate your interest in ROF Group properties. Please let us know how we can assist you further.`,
            `Hello ${consumer.name}, we wanted to follow up regarding your ${consumer.unit_number ? `unit ${consumer.unit_number}` : 'application'}. Please feel free to contact us at your convenience.`,
            `Dear ${consumer.name}, your query has been received. Our team will get back to you within 24 hours. Thank you for your patience.`,
        ];
        res.json({ success: true, data: { suggestions, consumerId, consumerName: consumer.name } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/communications/:consumerId - Get all communications for consumer
router.get('/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'consumerId');
        const channel = (0, input_js_1.oneOf)(req.query.channel, 'channel', ALL_CHANNELS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 20, 200);
        const params = [consumerId];
        let where = '';
        if (channel) {
            params.push(channel);
            where = ` AND channel = $2`;
        }
        params.push(size, offset);
        const result = await pool_1.db.query(`SELECT id, channel, direction, subject, message, email_recipient, phone_recipient, status, created_at
         FROM communications WHERE consumer_id = $1${where}
        ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=communications.js.map