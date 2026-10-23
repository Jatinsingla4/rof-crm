"use strict";
/**
 * Construction Milestones Routes
 * Track construction progress of a project; completing a milestone can queue a message to every allottee.
 * No sender (email / WhatsApp) is connected yet, so the messages are recorded as "queued", never "sent".
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const projectOf = async (id) => {
    const p = (await index_js_1.db.query(`SELECT id, name FROM projects WHERE id = $1`, [id])).rows[0];
    if (!p)
        throw (0, input_js_1.bad)('Project not found', 404);
    return p;
};
// Photo links: at most 20, each a web link or a path of this site
const photos = (v) => {
    if (!(0, input_js_1.has)(v))
        return null;
    if (!Array.isArray(v) || v.length > 20)
        throw (0, input_js_1.bad)('photosUrls must be a list of at most 20 links');
    return v.map((u) => {
        if (typeof u !== 'string' || u.length > 500 || !/^(https?:\/\/|\/)[^\s<>"']+$/.test(u))
            throw (0, input_js_1.bad)('Each photo link must be a web link or a path on this site');
        return u;
    });
};
// GET /api/milestones?projectId= - the milestones of a project, in building order
router.get('/', async (req, res, next) => {
    try {
        if (!(0, input_js_1.has)(req.query.projectId))
            throw (0, input_js_1.bad)('projectId required');
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        await projectOf(projectId);
        const result = await index_js_1.db.query(`SELECT id, project_id, milestone_name, milestone_type, description, planned_date::text AS planned_date, actual_date::text AS actual_date, completion_percentage, status,
              notify_allottees, notification_sent_at, photos_urls, created_at, updated_at
         FROM construction_milestones WHERE project_id = $1
        ORDER BY CASE milestone_type WHEN 'foundation' THEN 1 WHEN 'structure' THEN 2 WHEN 'finishing' THEN 3 WHEN 'mep' THEN 4 WHEN 'legal' THEN 5 WHEN 'handover' THEN 6 ELSE 7 END,
                 CASE status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, planned_date NULLS LAST, milestone_name, id`, [projectId]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/milestones/:id/complete - mark a milestone completed (100%); once only
router.patch('/:id/complete', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Milestone id');
        if (Array.isArray(req.body))
            throw (0, input_js_1.bad)('Send a JSON object');
        const b = (0, input_js_1.body)(req);
        const percent = (0, input_js_1.has)(b.completionPercentage) ? (0, input_js_1.num)(b.completionPercentage, 'completionPercentage', 100, 0) : undefined;
        if (percent !== undefined && percent !== 100)
            throw (0, input_js_1.bad)('A completed milestone is 100%. Leave completionPercentage out or send 100.');
        const description = (0, input_js_1.text)(b.description, 'description', 2000, false), links = photos(b.photosUrls), notifyAsked = (0, input_js_1.flag)(b.notifyAllottees, 'notifyAllottees');
        const actual = (0, input_js_1.day)(b.actualDate, 'actualDate');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const m = (await c.query(`SELECT m.id, m.project_id, m.milestone_name, m.status, m.notify_allottees, p.name AS project_name, (NOW() AT TIME ZONE 'Asia/Kolkata')::date::text AS today
           FROM construction_milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = $1 FOR UPDATE OF m`, [id])).rows[0];
            if (!m)
                throw (0, input_js_1.bad)('Milestone not found', 404);
            if (m.status === 'completed')
                throw (0, input_js_1.bad)('This milestone is already completed', 409);
            if (actual && actual > m.today)
                throw (0, input_js_1.bad)('actualDate cannot be in the future');
            const notify = notifyAsked ?? !!m.notify_allottees;
            const upd = (await c.query(`UPDATE construction_milestones
            SET status = 'completed', actual_date = COALESCE($1::date, $2::date), completion_percentage = 100,
                description = COALESCE($3, description), photos_urls = COALESCE($4::text[], photos_urls),
                notification_sent_at = CASE WHEN $5::boolean THEN NOW() ELSE notification_sent_at END, updated_by_user_id = $6, updated_at = NOW()
          WHERE id = $7 RETURNING id, milestone_name, project_id, completion_percentage, status, actual_date::text AS actual_date`, [actual, m.today, description, links, notify, req.userId, id])).rows[0];
            let queued = 0;
            if (notify) {
                const subject = `Construction Update: ${m.milestone_name}`, message = `Construction Update: ${m.milestone_name} completed for ${m.project_name}. Progress: 100%`;
                // every customer who still holds a unit in this project (not cancelled, not transferred), once per channel
                const who = `SELECT DISTINCT c.id, c.email, c.mobile FROM consumers c JOIN allocations a ON a.consumer_id = c.id
                      WHERE a.project_id = $1 AND a.status NOT IN ('cancelled','transferred')`;
                const e = await c.query(`INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, status, sent_by_user_id)
           SELECT w.id, 'email', 'outbound', $2, $3, w.email, 'queued', $4 FROM (${who}) w WHERE btrim(COALESCE(w.email, '')) <> ''`, [m.project_id, subject, message, req.userId]);
                const w = await c.query(`INSERT INTO communications (consumer_id, channel, direction, message, phone_recipient, status, sent_by_user_id)
           SELECT w.id, 'whatsapp', 'outbound', $2, w.mobile, 'queued', $3 FROM (${who}) w WHERE btrim(COALESCE(w.mobile, '')) <> ''`, [m.project_id, message, req.userId]);
                queued = (e.rowCount || 0) + (w.rowCount || 0);
            }
            return { milestone: upd, queued, notify };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'construction_milestones', id, { status: 'pending' }, { status: 'completed', completion_percentage: 100, messages_queued: out.queued });
        res.json({
            success: true, data: { ...out.milestone, messagesQueued: out.queued },
            message: out.notify ? `Milestone marked complete. ${out.queued} message(s) recorded as queued; nothing is sent until an email or WhatsApp sender is connected.` : 'Milestone marked complete.',
        });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/milestones/project/:projectId/progress - milestones done and the average completion
router.get('/project/:projectId/progress', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.params.projectId, 'Project id');
        await projectOf(projectId);
        const row = (await index_js_1.db.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS done,
              COALESCE(ROUND(AVG(CASE WHEN status = 'completed' THEN 100 ELSE COALESCE(completion_percentage, 0) END), 1), 0)::float AS pct
         FROM construction_milestones WHERE project_id = $1`, [projectId])).rows[0];
        res.json({ success: true, data: { totalMilestones: row.total, completedMilestones: row.done, progressPercentage: row.pct } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=milestones.js.map