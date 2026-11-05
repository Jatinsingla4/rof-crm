/**
 * Construction Milestones Routes
 * Track construction progress of a project; completing a milestone can queue a message to every allottee.
 * No sender (email / WhatsApp) is connected yet, so the messages are recorded as "queued", never "sent".
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, num, text, day, flag, body, inTx } from '../utils/input.js';
import { SQL_TODAY } from '../utils/business-date.js';

const router = Router();

const projectOf = async (id: string) => {
  const p = (await db.query(`SELECT id, name FROM projects WHERE id = $1`, [id])).rows[0];
  if (!p) throw bad('Project not found', 404);
  return p;
};

// Photo links: at most 20, each a web link or a path of this site
const photos = (v: any): string[] | null => {
  if (!has(v)) return null;
  if (!Array.isArray(v) || v.length > 20) throw bad('photosUrls must be a list of at most 20 links');
  return v.map((u) => {
    if (typeof u !== 'string' || u.length > 500 || !/^(https?:\/\/|\/)[^\s<>"']+$/.test(u)) throw bad('Each photo link must be a web link or a path on this site');
    return u;
  });
};

// GET /api/milestones?projectId= - the milestones of a project, in building order
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!has(req.query.projectId)) throw bad('projectId required');
    const projectId = uuid(req.query.projectId, 'projectId');
    await projectOf(projectId);
    const result = await db.query(
      `SELECT id, project_id, milestone_name, milestone_type, description, planned_date::text AS planned_date, actual_date::text AS actual_date, completion_percentage, status,
              notify_allottees, notification_sent_at, photos_urls, created_at, updated_at
         FROM construction_milestones WHERE project_id = $1
        ORDER BY CASE milestone_type WHEN 'foundation' THEN 1 WHEN 'structure' THEN 2 WHEN 'finishing' THEN 3 WHEN 'mep' THEN 4 WHEN 'legal' THEN 5 WHEN 'handover' THEN 6 ELSE 7 END,
                 CASE status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, planned_date NULLS LAST, milestone_name, id`, [projectId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { failWith(error, res, next); }
});

// PATCH /api/milestones/:id/complete - mark a milestone completed (100%); once only
router.patch('/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Milestone id');
    if (Array.isArray(req.body)) throw bad('Send a JSON object');
    const b = body(req);
    const percent = has(b.completionPercentage) ? num(b.completionPercentage, 'completionPercentage', 100, 0) : undefined;
    if (percent !== undefined && percent !== 100) throw bad('A completed milestone is 100%. Leave completionPercentage out or send 100.');
    const description = text(b.description, 'description', 2000, false), links = photos(b.photosUrls), notifyAsked = flag(b.notifyAllottees, 'notifyAllottees');
    const actual = day(b.actualDate, 'actualDate');

    const out = await inTx(async (c) => {
      const m = (await c.query(
        `SELECT m.id, m.project_id, m.milestone_name, m.status, m.notify_allottees, p.name AS project_name, ${SQL_TODAY}::text AS today
           FROM construction_milestones m JOIN projects p ON p.id = m.project_id WHERE m.id = $1 FOR UPDATE OF m`, [id])).rows[0];
      if (!m) throw bad('Milestone not found', 404);
      if (m.status === 'completed') throw bad('This milestone is already completed', 409);
      if (actual && actual > m.today) throw bad('actualDate cannot be in the future');
      const notify = notifyAsked ?? !!m.notify_allottees;

      const upd = (await c.query(
        `UPDATE construction_milestones
            SET status = 'completed', actual_date = COALESCE($1::date, $2::date), completion_percentage = 100,
                description = COALESCE($3, description), photos_urls = COALESCE($4::text[], photos_urls),
                notification_sent_at = CASE WHEN $5::boolean THEN NOW() ELSE notification_sent_at END, updated_by_user_id = $6, updated_at = NOW()
          WHERE id = $7 RETURNING id, milestone_name, project_id, completion_percentage, status, actual_date::text AS actual_date`,
        [actual, m.today, description, links, notify, req.userId, id])).rows[0];

      let queued = 0;
      if (notify) {
        const subject = `Construction Update: ${m.milestone_name}`, message = `Construction Update: ${m.milestone_name} completed for ${m.project_name}. Progress: 100%`;
        // every customer who still holds a unit in this project (not cancelled, not transferred), once per channel
        const who = `SELECT DISTINCT c.id, c.email, c.mobile FROM consumers c JOIN allocations a ON a.consumer_id = c.id
                      WHERE a.project_id = $1 AND a.status NOT IN ('cancelled','transferred')`;
        const e = await c.query(
          `INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, status, sent_by_user_id)
           SELECT w.id, 'email', 'outbound', $2, $3, w.email, 'queued', $4 FROM (${who}) w WHERE btrim(COALESCE(w.email, '')) <> ''`, [m.project_id, subject, message, req.userId]);
        const w = await c.query(
          `INSERT INTO communications (consumer_id, channel, direction, message, phone_recipient, status, sent_by_user_id)
           SELECT w.id, 'whatsapp', 'outbound', $2, w.mobile, 'queued', $3 FROM (${who}) w WHERE btrim(COALESCE(w.mobile, '')) <> ''`, [m.project_id, message, req.userId]);
        queued = (e.rowCount || 0) + (w.rowCount || 0);
      }
      return { milestone: upd, queued, notify };
    });

    await auditChange(db, req, res, 'update', 'construction_milestones', id, { status: 'pending' }, { status: 'completed', completion_percentage: 100, messages_queued: out.queued });
    res.json({
      success: true, data: { ...out.milestone, messagesQueued: out.queued },
      message: out.notify ? `Milestone marked complete. ${out.queued} message(s) recorded as queued; nothing is sent until an email or WhatsApp sender is connected.` : 'Milestone marked complete.',
    });
  } catch (error) { failWith(error, res, next); }
});

// GET /api/milestones/project/:projectId/progress - milestones done and the average completion
router.get('/project/:projectId/progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = uuid(req.params.projectId, 'Project id');
    await projectOf(projectId);
    const row = (await db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS done,
              COALESCE(ROUND(AVG(CASE WHEN status = 'completed' THEN 100 ELSE COALESCE(completion_percentage, 0) END), 1), 0)::float AS pct
         FROM construction_milestones WHERE project_id = $1`, [projectId])).rows[0];
    res.json({ success: true, data: { totalMilestones: row.total, completedMilestones: row.done, progressPercentage: row.pct } });
  } catch (error) { failWith(error, res, next); }
});

export default router;
