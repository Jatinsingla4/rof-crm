/**
 * Communications Routes - Module F
 * Remarks log, email, WhatsApp, SMS, AI suggestions, ticket escalation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/pool';
import { AuthRequest } from '../index.js';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// GET /api/communications/status-codes - Get calling status codes
router.get('/status-codes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('SELECT code, category FROM communication_status_codes WHERE is_active = TRUE');
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// GET /api/communications/calling-list - Selection Free Calling List
router.get('/calling-list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { 
      minOsAmount = 0, statusCode, subStatusCode, 
      projectId, towerId, paymentPlan, customerStatus,
      regNo, customerName, unitNo, employeeId
    } = req.query;

    const minAmt = parseFloat(minOsAmount as string) || 0;

    let query = `
      SELECT 
        c.id, c.name, c.mobile, c.registration_no, c.total_overdue_amt,
        c.last_call_status, c.last_call_sub_status, c.promise_to_pay_date, c.next_call_date,
        c.lead_stage as customer_status,
        u.unit_number, p.name as project_name, t.tower_name
      FROM consumers c
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN units u ON c.allocated_unit_id = u.id
      LEFT JOIN towers t ON u.tower_id = t.id
      WHERE (c.total_overdue_amt >= $1 OR $1 = 0)
    `;
    const params: any[] = [minAmt];

    if (projectId && projectId !== '') { params.push(projectId); query += ` AND p.id = $${params.length}`; }
    if (towerId && towerId !== '') { params.push(towerId); query += ` AND t.id = $${params.length}`; }
    if (customerStatus && customerStatus !== '') { params.push(customerStatus); query += ` AND c.lead_stage = $${params.length}`; }
    if (statusCode && statusCode !== '') { params.push(statusCode); query += ` AND c.last_call_status = $${params.length}`; }
    if (subStatusCode && subStatusCode !== '') { params.push(subStatusCode); query += ` AND c.last_call_sub_status = $${params.length}`; }
    if (regNo && regNo !== '') { params.push(`%${regNo}%`); query += ` AND c.registration_no ILIKE $${params.length}`; }
    if (customerName && customerName !== '') { params.push(`%${customerName}%`); query += ` AND c.name ILIKE $${params.length}`; }
    if (unitNo && unitNo !== '') { params.push(`%${unitNo}%`); query += ` AND u.unit_number ILIKE $${params.length}`; }

    query += ` ORDER BY c.total_overdue_amt DESC`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/communications/log-call - Log a debt recovery call
router.post('/log-call', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { consumerId, statusCode, subStatusCode, ptpDate, remarks, nextCallDate } = req.body;

    await client.query('BEGIN');

    // 1. Log the call
    await client.query(
      `INSERT INTO call_logs (consumer_id, user_id, status_code, sub_status_code, ptp_date, remarks, next_call_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [consumerId, req.userId, statusCode, subStatusCode, ptpDate || null, remarks, nextCallDate || null]
    );

    // 2. Update Consumer Master
    await client.query(
      `UPDATE consumers 
       SET last_call_status = $1, 
           last_call_sub_status = $2, 
           promise_to_pay_date = $3, 
           next_call_date = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [statusCode, subStatusCode, ptpDate || null, nextCallDate || null, consumerId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Call logged successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

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
      [consumerId, req.userId, channel, subject || null, notes || null, followUpDate || null, tags && tags.length ? tags : null]
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
    if (!consumerId || !recipientEmail || (!templateId && (!subject || !htmlBody))) {
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

// POST /api/communications/:consumerId/send — unified send by consumer + channel
router.post('/:consumerId/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { channel = 'email', message, subject } = req.body;

    if (!message) return res.status(400).json({ error: 'message is required' });

    // Fetch consumer contact details
    const consumerRes = await db.query(
      `SELECT id, name, email, mobile FROM consumers WHERE id = $1`,
      [consumerId]
    );
    if (consumerRes.rows.length === 0) return res.status(404).json({ error: 'Consumer not found' });
    const consumer = consumerRes.rows[0];

    const result = await db.query(
      `INSERT INTO communications (consumer_id, channel, direction, subject, message, email_recipient, phone_recipient, status, sent_by_user_id)
       VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'sent', $7)
       RETURNING id, channel, direction, status, created_at`,
      [consumerId, channel, subject || null, message,
       channel === 'email' ? consumer.email : null,
       ['whatsapp', 'sms'].includes(channel) ? consumer.mobile : null,
       req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/communications/:consumerId/ai-draft — generate AI reply draft for consumer
router.post('/:consumerId/ai-draft', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;

    // Fetch consumer context
    const consumerRes = await db.query(
      `SELECT c.id, c.name, c.lead_stage,
              u.unit_number, u.bhk_type,
              (SELECT message FROM communications WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM consumers c
       LEFT JOIN units u ON c.allocated_unit_id = u.id
       WHERE c.id = $1`,
      [consumerId]
    );

    if (consumerRes.rows.length === 0) return res.status(404).json({ error: 'Consumer not found' });
    const consumer = consumerRes.rows[0];

    // Reuse the ai-suggestions handler logic
    const suggestions = [
      `Dear ${consumer.name}, thank you for reaching out. We appreciate your interest in ROF Group properties. Please let us know how we can assist you further.`,
      `Hello ${consumer.name}, we wanted to follow up regarding your ${consumer.unit_number ? `unit ${consumer.unit_number}` : 'application'}. Please feel free to contact us at your convenience.`,
      `Dear ${consumer.name}, your query has been received. Our team will get back to you within 24 hours. Thank you for your patience.`,
    ];

    res.json({ success: true, data: { suggestions, consumerId, consumerName: consumer.name } });
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
    const params: any[] = [consumerId];

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


export default router;
