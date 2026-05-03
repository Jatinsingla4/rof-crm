/**
 * Construction Milestones Routes - Module A
 * Track construction progress and notify allottees
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { logAudit } from '../middleware/auditLogger';

const router = Router();

// GET /api/milestones - List milestones for a project
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const result = await db.query(
      `SELECT
        id, project_id, milestone_name, milestone_type,
        description, planned_date, actual_date,
        completion_percentage, status,
        notify_allottees, notification_sent_at,
        created_at, updated_at
       FROM construction_milestones
       WHERE project_id = $1
       ORDER BY
         CASE
           WHEN milestone_type = 'foundation' THEN 1
           WHEN milestone_type = 'structure' THEN 2
           WHEN milestone_type = 'finishing' THEN 3
           WHEN milestone_type = 'mep' THEN 4
           WHEN milestone_type = 'legal' THEN 5
           WHEN milestone_type = 'handover' THEN 6
           ELSE 7
         END,
         CASE
           WHEN status = 'completed' THEN 1
           WHEN status = 'in_progress' THEN 2
           ELSE 3
         END`,
      [projectId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/milestones/:id/complete - Mark milestone as completed
router.patch('/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { actualDate, completionPercentage, description, photosUrls, notifyAllottees } = req.body;

    // Get milestone details
    const milestoneResult = await db.query(
      `SELECT id, project_id, milestone_name FROM construction_milestones WHERE id = $1`,
      [id]
    );

    if (milestoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const { project_id: projectId, milestone_name: milestoneName } = milestoneResult.rows[0];

    // Update milestone
    const updateResult = await db.query(
      `UPDATE construction_milestones
       SET status = 'completed',
           actual_date = $1,
           completion_percentage = $2,
           description = COALESCE($3, description),
           photos_urls = COALESCE($4, photos_urls),
           notification_sent_at = CASE WHEN $5 = true THEN NOW() ELSE notification_sent_at END,
           updated_by_user_id = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, milestone_name, project_id, completion_percentage`,
      [actualDate, completionPercentage || 0, description || null, photosUrls || null, notifyAllottees, req.userId, id]
    );

    const updatedMilestone = updateResult.rows[0];

    // If notifyAllottees, queue notifications
    if (notifyAllottees) {
      // Get project details for notification
      const projectResult = await db.query(
        `SELECT name FROM projects WHERE id = $1`,
        [projectId]
      );

      const projectName = projectResult.rows[0]?.name || 'Project';

      // Get all allottees for this project
      const allotteesResult = await db.query(
        `SELECT DISTINCT c.id, c.name, c.email, c.mobile
         FROM consumers c
         JOIN allocations a ON c.id = a.consumer_id
         WHERE a.project_id = $1
         AND a.status IN ('allotted', 'agreement_signed')`,
        [projectId]
      );

      const notificationMessage = `Construction Update: ${milestoneName} completed for ${projectName}. Progress: ${completionPercentage || 0}%`;

      // Queue notifications for each allottee via unified communications table
      for (const allottee of allotteesResult.rows) {
        // Queue email notification
        if (allottee.email) {
          await db.query(
            `INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, status, sent_by_user_id)
             VALUES ($1, 'email', 'outbound', $2, $3, $4, 'sent', $5)`,
            [
              allottee.id,
              `Construction Update: ${milestoneName}`,
              notificationMessage,
              allottee.email,
              req.userId,
            ]
          );
        }

        // Queue WhatsApp notification (if mobile exists)
        if (allottee.mobile) {
          await db.query(
            `INSERT INTO communications (consumer_id, channel, direction, message, phone_recipient, status, sent_by_user_id)
             VALUES ($1, 'whatsapp', 'outbound', $2, $3, 'sent', $4)`,
            [allottee.id, notificationMessage, allottee.mobile, req.userId]
          );
        }
      }
    }

    // Log audit event
    logAudit(db, req.userId, 'update', 'construction_milestones', id,
      { status: 'pending' },
      { status: 'completed', completion_percentage: completionPercentage });

    res.json({
      success: true,
      data: updatedMilestone,
      message: `Milestone marked complete. ${notifyAllottees ? 'Notifications queued.' : ''}`,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/milestones/project/:projectId/progress - Get project progress
router.get('/project/:projectId/progress', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(
      `SELECT
        COUNT(*) as total_milestones,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_milestones,
        ROUND(AVG(CASE WHEN status = 'completed' THEN completion_percentage ELSE 0 END), 1) as avg_completion_percentage
       FROM construction_milestones
       WHERE project_id = $1`,
      [projectId]
    );

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        totalMilestones: parseInt(row.total_milestones) || 0,
        completedMilestones: parseInt(row.completed_milestones) || 0,
        progressPercentage: row.avg_completion_percentage || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
