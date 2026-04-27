/**
 * Communications Routes - Module F
 * Remarks log, email, WhatsApp, SMS, AI suggestions, ticket escalation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// POST /api/communications/remarks - Create remark (duplicate endpoint for clarity)
router.post('/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, channel, subject, notes, followUpDate, tags } = req.body;

    // Validate required fields
    if (!consumerId || !channel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, channel, subject, notes, follow_up_date, timestamp`,
      [consumerId, req.userId, channel, subject || null, notes || null, followUpDate || null, JSON.stringify(tags || [])]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/communications/remarks/:consumerId - Get remarks timeline
router.get('/remarks/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { channel, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT id, channel, subject, notes, timestamp, follow_up_date, tags
                 FROM remarks WHERE consumer_id = $1`;
    const params = [consumerId];

    if (channel) {
      query += ` AND channel = $${params.length + 1}`;
      params.push(channel);
    }

    query += ` ORDER BY timestamp DESC`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/emails - Send email via integration
router.post('/emails', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, recipientEmail, subject, htmlBody, templateId } = req.body;

    // Validate required fields
    if (!consumerId || !recipientEmail || (!subject || !htmlBody) && !templateId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log email in communications table
    const result = await db.query(
      `INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, status, sent_by_user_id)
       VALUES ($1, 'email', 'outbound', $2, $3, $4, 'sent', $5)
       RETURNING id, channel, subject, status, created_at`,
      [consumerId, subject || 'Template Email', htmlBody || '', recipientEmail, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Email queued for delivery',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/whatsapp - Send WhatsApp message
router.post('/whatsapp', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, recipientPhone, message, templateId, parameters } = req.body;

    // Validate required fields
    if (!consumerId || !recipientPhone || (!message && !templateId)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log WhatsApp message
    const result = await db.query(
      `INSERT INTO communications (consumer_id, channel, direction, message, phone_recipient, status, sent_by_user_id)
       VALUES ($1, 'whatsapp', 'outbound', $2, $3, 'sent', $4)
       RETURNING id, channel, message, status, created_at`,
      [consumerId, message || templateId, recipientPhone, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'WhatsApp message queued for delivery',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/sms - Send SMS
router.post('/sms', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, recipientPhone, message, templateId } = req.body;

    // Validate required fields
    if (!consumerId || !recipientPhone || (!message && !templateId)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log SMS
    const result = await db.query(
      `INSERT INTO communications (consumer_id, channel, direction, message, phone_recipient, status, sent_by_user_id)
       VALUES ($1, 'sms', 'outbound', $2, $3, 'sent', $4)
       RETURNING id, channel, message, status, created_at`,
      [consumerId, message || templateId, recipientPhone, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'SMS queued for delivery',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/communications/:consumerId - Get all communications for consumer
router.get('/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { channel, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT id, channel, direction, subject, message, email_recipient, phone_recipient, status, created_at
                 FROM communications WHERE consumer_id = $1`;
    const params = [consumerId];

    if (channel) {
      query += ` AND channel = $${params.length + 1}`;
      params.push(channel);
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/tickets - Create support ticket
router.post('/tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, subject, description, priority, assignedToUserId } = req.body;

    // Validate required fields
    if (!consumerId || !subject || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO support_tickets (consumer_id, subject, description, priority, assigned_to_user_id, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING id, subject, priority, status, created_at`,
      [consumerId, subject, description, priority || 'medium', assignedToUserId || null, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/communications/tickets - Get support tickets
router.get('/tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, priority, assignedToUserId, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT id, consumer_id, subject, priority, status, assigned_to_user_id, created_at, updated_at
                 FROM support_tickets WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = $${params.length + 1}`;
      params.push(priority);
    }

    if (assignedToUserId) {
      query += ` AND assigned_to_user_id = $${params.length + 1}`;
      params.push(assignedToUserId);
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/communications/tickets/:id - Update ticket status
router.patch('/tickets/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedToUserId, notes } = req.body;

    const result = await db.query(
      `UPDATE support_tickets
       SET status = COALESCE($1, status),
           priority = COALESCE($2, priority),
           assigned_to_user_id = COALESCE($3, assigned_to_user_id),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, subject, status, priority, updated_at`,
      [status, priority, assignedToUserId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/ai-suggestions - Get AI-suggested replies
router.post('/ai-suggestions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, lastMessage, context } = req.body;

    // In production, call OpenAI API or similar
    // For now, return template suggestions based on context
    const suggestions = [
      'Thank you for your inquiry. We will get back to you shortly.',
      'We have received your request and will process it within 24 hours.',
      'Your payment has been recorded. A receipt has been sent to your registered email.',
      'We are happy to assist. Could you please provide more details about your concern?',
    ];

    res.json({
      success: true,
      data: {
        suggestions,
        context: 'template-based',
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/broadcast - Send bulk WhatsApp/SMS campaign
router.post('/broadcast', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, consumerIds, channel, message, templateId, segmentFilter } = req.body;

    // Validate required fields
    if (!projectId || (!consumerIds || consumerIds.length === 0) && !segmentFilter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log broadcast campaign
    const result = await db.query(
      `INSERT INTO broadcast_campaigns (project_id, channel, message, total_recipients, status, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'queued', $5)
       RETURNING id, channel, total_recipients, status, created_at`,
      [projectId, channel, message || templateId, consumerIds ? consumerIds.length : 0, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Broadcast campaign queued for delivery',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/communications/campaigns - Get broadcast campaigns
router.get('/campaigns', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, channel } = req.query;

    let query = `SELECT id, project_id, channel, total_recipients, delivered_count, status, created_at
                 FROM broadcast_campaigns WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (channel) {
      query += ` AND channel = $${params.length + 1}`;
      params.push(channel);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
