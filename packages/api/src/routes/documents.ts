/**
 * Documents Routes - Module E
 * Template engine, PDF generation, scanned contract vault, document management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// POST /api/documents/templates - Create document template
router.post('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, documentType, title, htmlContent, mergeFields } = req.body;

    // Validate required fields
    if (!projectId || !documentType || !title || !htmlContent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO document_templates (project_id, document_type, title, html_content, merge_fields, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_type, title, created_at`,
      [projectId, documentType, title, htmlContent, JSON.stringify(mergeFields || []), req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/templates - List templates
router.get('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, documentType } = req.query;

    let query = `SELECT id, project_id, document_type, title, created_at, updated_at
                 FROM document_templates WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (documentType) {
      query += ` AND document_type = $${params.length + 1}`;
      params.push(documentType);
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

// GET /api/documents/templates/:id - Get template detail
router.get('/templates/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, project_id, document_type, title, html_content, merge_fields, created_at, updated_at
       FROM document_templates WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/documents/templates/:id - Update template
router.patch('/templates/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, htmlContent, mergeFields } = req.body;

    const result = await db.query(
      `UPDATE document_templates
       SET title = COALESCE($1, title),
           html_content = COALESCE($2, html_content),
           merge_fields = COALESCE($3, merge_fields),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, document_type, title, updated_at`,
      [title, htmlContent, mergeFields ? JSON.stringify(mergeFields) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/generate - Generate document from template with merge fields
router.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, allocationId, templateId, mergeData, deliveryMethod } = req.body;

    // Validate required fields
    if (!consumerId || !templateId || !mergeData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get template
    const templateResult = await db.query(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Simple merge: replace {{fieldName}} with values
    let htmlContent = template.html_content;
    for (const [key, value] of Object.entries(mergeData)) {
      htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Generate document record
    const result = await db.query(
      `INSERT INTO documents (consumer_id, allocation_id, template_id, document_type, html_content, delivery_method, delivery_status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, document_type, delivery_method, delivery_status, created_at`,
      [
        consumerId,
        allocationId || null,
        templateId,
        template.document_type,
        htmlContent,
        deliveryMethod || 'email',
        req.userId,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/send - Send generated document via email/WhatsApp
router.post('/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { recipientEmail, recipientPhone } = req.body;

    // Get document
    const docResult = await db.query(
      `SELECT id, consumer_id, document_type, delivery_method FROM documents WHERE id = $1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Update delivery status (in production, queue async job to send via email/WhatsApp)
    const result = await db.query(
      `UPDATE documents
       SET delivery_status = 'sent', sent_at = NOW(), sent_by_user_id = $1
       WHERE id = $2
       RETURNING id, document_type, delivery_status, sent_at`,
      [req.userId, id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: `Document queued for delivery via ${docResult.rows[0].delivery_method}`,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:consumerId - Get documents for consumer
router.get('/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { documentType } = req.query;

    let query = `SELECT id, document_type, delivery_method, delivery_status, created_at, sent_at
                 FROM documents WHERE consumer_id = $1`;
    const params = [consumerId];

    if (documentType) {
      query += ` AND document_type = $${params.length + 1}`;
      params.push(documentType);
    }
      // @ts-ignore

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

// POST /api/documents/vault - Upload scanned contract/document to vault
router.post('/vault', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, allocationId, documentCategory, fileUrl, fileName } = req.body;

    // Validate required fields
    if (!consumerId || !documentCategory || !fileUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO document_vault (consumer_id, allocation_id, document_category, file_url, file_name, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_category, file_url, created_at`,
      [consumerId, allocationId || null, documentCategory, fileUrl, fileName || null, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/vault/:consumerId - List documents in vault
router.get('/vault/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { documentCategory } = req.query;

    let query = `SELECT id, document_category, file_url, file_name, created_at
                 FROM document_vault WHERE consumer_id = $1`;
    const params = [consumerId];

    if (documentCategory) {
      query += ` AND document_category = $${params.length + 1}`;
      params.push(documentCategory);
      // @ts-ignore
    }

    query += ` ORDER BY document_category, created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/search - Full-text search documents
router.get('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query: searchQuery, projectId } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Simple search in documents (in production, use PostgreSQL full-text search)
    const result = await db.query(
      `SELECT id, consumer_id, document_type, html_content, created_at
       FROM documents
       WHERE html_content ILIKE $1
       ${projectId ? `AND allocation_id IN (SELECT id FROM allocations WHERE project_id = $2)` : ''}
       ORDER BY created_at DESC
       LIMIT 50`,
      projectId ? [`%${searchQuery}%`, projectId] : [`%${searchQuery}%`]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/documents/:id - Delete document (marks as deleted, not hard delete)
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE documents SET deleted_at = NOW(), deleted_by_user_id = $1 WHERE id = $2
       RETURNING id, document_type`,
      [req.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
