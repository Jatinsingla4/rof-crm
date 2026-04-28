/**
 * Communications Routes - Module F
 * Remarks log, email, WhatsApp, SMS, AI suggestions, ticket escalation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';
import Anthropic from '@anthropic-ai/sdk';

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
      // @ts-ignore
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
      // @ts-ignore
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
    const { consumerId, consumerQuery, context, channel = 'email' } = req.body;

    if (!consumerId || !consumerQuery) {
      return res.status(400).json({ error: 'consumerId and consumerQuery required' });
    }

    // Fallback suggestions if API key is missing or API fails
    const fallbackSuggestions = [
      'Thank you for your inquiry. We will get back to you shortly with the information you requested.',
      'We have received your request and will process it within 24 hours. We appreciate your patience.',
      'We are happy to assist you. Could you please provide additional details about your concern?',
    ];

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

    // Fetch consumer context from database
    const consumerResult = await db.query(
      `SELECT c.id, c.name, c.lead_stage, c.income_category,
              p.name as project_name, u.unit_number, u.bhk_type
       FROM consumers c
       LEFT JOIN allocations a ON c.id = a.consumer_id AND a.status = 'allotted'
       LEFT JOIN units u ON a.unit_id = u.id
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE c.id = $1`,
      [consumerId]
    );

    const consumer = consumerResult.rows[0];

    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
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
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Customer query: "${consumerQuery}"${
              context ? `\n\nAdditional context: ${context}` : ''
            }\n\nGenerate 3 response suggestions.`,
          },
        ],
        system: systemPrompt,
      });

      // Parse the response
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '[]';
      const suggestions = JSON.parse(responseText);

      // Validate we got an array of strings
      if (
        !Array.isArray(suggestions) ||
        !suggestions.every((s) => typeof s === 'string')
      ) {
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
    } catch (apiError) {
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
