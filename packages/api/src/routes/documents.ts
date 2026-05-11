/**
 * Documents Routes - Module E
 * Template engine, PDF generation, scanned contract vault, document management
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// AES-256 Encryption Configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  if (!text) return text;
  if (!text.includes(':')) return text; // Fallback for unencrypted legacy data
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() as string, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return text;
  }
}


// POST /api/documents/templates - Create document template
router.post('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, documentType, title, name, htmlContent, bodyHtml, body, mergeFields } = req.body;
    const templateName = name || title;
    const templateBody = bodyHtml || htmlContent || body || '';

    if (!templateName || !documentType) {
      return res.status(400).json({ error: 'name and documentType are required' });
    }

    // project_id is NOT NULL — use provided value or fall back to first available project
    let resolvedProjectId = projectId || null;
    if (!resolvedProjectId) {
      const pRes = await db.query(`SELECT id FROM projects LIMIT 1`);
      if (pRes.rows.length === 0) return res.status(400).json({ error: 'No projects available' });
      resolvedProjectId = pRes.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_type, name, created_at`,
      [resolvedProjectId, documentType, templateName, templateBody, mergeFields || [], req.userId]
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

    let query = `SELECT id, project_id, document_type, name, created_at, updated_at
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
      `SELECT id, project_id, document_type, name, body_html, merge_fields, created_at, updated_at
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
    const { title, name, htmlContent, bodyHtml, mergeFields } = req.body;

    const result = await db.query(
      `UPDATE document_templates
       SET name = COALESCE($1, name),
           body_html = COALESCE($2, body_html),
           merge_fields = COALESCE($3, merge_fields),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, document_type, name, updated_at`,
      [name || title, bodyHtml || htmlContent, mergeFields ? JSON.stringify(mergeFields) : null, id]
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
// POST /api/documents/generate - Generate document from template
router.post('/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let { consumerId, allocationId, templateId, documentType, mergeData, deliveryMethod } = req.body;

    if (!consumerId && !allocationId) {
      return res.status(400).json({ error: 'consumerId or allocationId is required' });
    }

    // 1. Resolve Template
    let template;
    if (templateId) {
      const tRes = await db.query(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);
      template = tRes.rows[0];
    } else if (documentType) {
      const tRes = await db.query(
        `SELECT * FROM document_templates WHERE document_type = $1 ORDER BY created_at DESC LIMIT 1`,
        [documentType]
      );
      template = tRes.rows[0];
    }

    if (!template) {
      return res.status(404).json({ error: 'Document template not found' });
    }

    // 2. Auto-Merge Logic (if mergeData missing)
    let htmlContent = template.body_html || '';
    if (!mergeData) {
      const dataRes = await db.query(
        `SELECT c.*, u.unit_number, u.bhk_type as unit_category, u.carpet_area_sqft as carpet_area, p.name as project_name, p.location as project_sector, p.rera_number as project_rera
         FROM consumers c
         LEFT JOIN units u ON c.allocated_unit_id = u.id
         LEFT JOIN projects p ON u.project_id = p.id
         WHERE c.id = $1`,
        [consumerId]
      );

      const d = dataRes.rows[0];
      if (d) {
        mergeData = {
          consumerName: d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || '—',
          fatherName: d.father_name || '—',
          address: d.present_address || d.address || '—',
          mobile: d.mobile || '—',
          email: d.email || '—',
          customerId: d.registration_no || d.id?.slice(0, 8).toUpperCase() || '—',
          reraNo: d.project_rera || '75 OF 2019 Dated 09.12.19',
          projectName: d.project_name || '—',
          projectSector: d.project_sector || '—',
          unitNumber: d.unit_number || '—',
          unitCategory: d.unit_category || '—',
          carpetArea: d.carpet_area || '0',
          currentDate: new Date().toLocaleDateString('en-IN'),
          day: new Date().getDate(),
          month: new Date().toLocaleString('en-IN', { month: 'long' }),
          year: new Date().getFullYear(),
        };

        // Special logic for Demand Letter Rows
        if (template.document_type === 'demand_letter') {
          const includeInterest = req.body.includeInterest === true;
          const demandsRes = await db.query(
            `SELECT d.*, 
              (SELECT COALESCE(SUM(amount_received_inr),0) FROM receipts WHERE payment_plan_id = d.payment_plan_id AND installment_index = d.installment_index) as amount_paid,
              EXTRACT(DAY FROM NOW() - d.due_date)::INT as days_overdue
             FROM demands d 
             WHERE consumer_id = $1 AND status != 'pending'
             ORDER BY installment_index ASC`,
            [consumerId]
          );
          
          let totalDue = 0;
          let totalPaid = 0;
          let totalInterest = 0;
          
          const rows = demandsRes.rows.map((dm, idx) => {
            const installment = parseFloat(dm.amount_due_inr);
            const cgst = parseFloat(dm.cgst_amount || 0);
            const sgst = parseFloat(dm.sgst_amount || 0);
            const totalGst = cgst + sgst;
            const amtDue = installment + totalGst;
            const amtPaid = parseFloat(dm.amount_paid || 0);
            
            let interest = 0;
            if (includeInterest && dm.days_overdue > 0 && (amtDue - amtPaid) > 0) {
              interest = Math.round(((amtDue - amtPaid) * 0.15 * dm.days_overdue) / 365);
            }
            
            const amtPayable = Math.max(0, amtDue - amtPaid + interest);
            
            totalDue += amtDue;
            totalPaid += amtPaid;
            totalInterest += interest;
            
            return `
              <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 6px;">${dm.demand_type || 'Installment'}</td>
                <td style="border: 1px solid #000; padding: 6px;">${new Date(dm.due_date).toLocaleDateString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${installment.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${cgst.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${sgst.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${totalGst.toLocaleString('en-IN')}</td>
                ${includeInterest ? `<td style="border: 1px solid #000; padding: 6px; text-align: right; color: #d63031;">${interest.toLocaleString('en-IN')}</td>` : ''}
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amtDue.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${amtPaid.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right; font-weight: 700;">${amtPayable.toLocaleString('en-IN')}</td>
              </tr>
            `;
          }).join('');

          const totalPayable = totalDue - totalPaid + totalInterest;
          mergeData.demandRows = rows;
          mergeData.totalDue = totalDue.toLocaleString('en-IN');
          mergeData.totalPaid = totalPaid.toLocaleString('en-IN');
          mergeData.totalPayable = totalPayable.toLocaleString('en-IN');
          mergeData.totalPayableWords = 'Rupees ' + totalPayable.toLocaleString('en-IN') + ' Only';
          
          // Dynamically adjust header based on interest toggle
          if (includeInterest) {
            htmlContent = htmlContent.replace('Amount Due</th>', 'Interest</th><th style="border: 1px solid #000; padding: 6px;">Amount Due</th>');
            htmlContent = htmlContent.replace('colspan="7"', 'colspan="8"');
          }
        }
      }
    }

    // 3. Perform Merge
    if (mergeData) {
      for (const [key, value] of Object.entries(mergeData)) {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    // 4. Save and return
    const result = await db.query(
      `INSERT INTO documents (consumer_id, allocation_id, template_id, document_type, html_content, delivery_method, delivery_status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id`,
      [consumerId, allocationId || null, template.id, template.document_type, htmlContent, deliveryMethod || 'none', req.userId]
    );

    res.status(201).json({ success: true, data: { documentId: result.rows[0].id } });
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

// GET /api/documents/search - Full-text search documents (MUST be before /:consumerId)
router.get('/search', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { query: searchQuery, q, projectId } = req.query;
    const term = (searchQuery || q) as string;

    if (!term) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const result = await db.query(
      `SELECT id, consumer_id, document_type, html_content, created_at
       FROM documents
       WHERE html_content ILIKE $1
       ${projectId ? `AND allocation_id IN (SELECT id FROM allocations WHERE project_id = $2)` : ''}
       ORDER BY created_at DESC
       LIMIT 50`,
      projectId ? [`%${term}%`, projectId] : [`%${term}%`]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents - List all documents (with filters)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, documentType, from, to, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT d.id, d.document_type, d.delivery_method, d.delivery_status, d.created_at, d.sent_at,
                        c.name as consumer_name
                 FROM documents d
                 LEFT JOIN consumers c ON d.consumer_id = c.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      params.push(consumerId as string);
      query += ` AND d.consumer_id = $${params.length}`;
    }
    if (documentType) {
      params.push(documentType as string);
      query += ` AND d.document_type = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND d.created_at >= $${params.length}::date`;
    }
    if (to) {
      params.push(to);
      query += ` AND d.created_at <= $${params.length}::date + interval '1 day'`;
    }

    query += ` ORDER BY d.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

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

    // Encrypt the file URL before storing (AES-256)
    const encryptedFileUrl = encrypt(fileUrl);

    const result = await db.query(
      `INSERT INTO document_vault (consumer_id, allocation_id, document_category, file_url, file_name, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_category, file_url, created_at`,
      [consumerId, allocationId || null, documentCategory, encryptedFileUrl, fileName || null, req.userId]
    );

    const data = result.rows[0];
    data.file_url = decrypt(data.file_url);

    res.status(201).json({
      success: true,
      data: data,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/vault - List all vault documents
router.get('/vault', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentCategory, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT dv.id, dv.document_category as doc_category, dv.file_url, dv.file_name, dv.created_at,
                        c.name as consumer_name
                 FROM document_vault dv
                 LEFT JOIN consumers c ON dv.consumer_id = c.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (documentCategory) {
      params.push(documentCategory as string);
      query += ` AND dv.document_category = $${params.length}`;
    }

    query += ` ORDER BY dv.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    // Decrypt URLs for client
    const decryptedRows = result.rows.map(row => ({
      ...row,
      file_url: decrypt(row.file_url)
    }));

    res.json({
      success: true,
      data: decryptedRows,
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
    const params: any[] = [consumerId];

    if (documentCategory) {
      query += ` AND document_category = $${params.length + 1}`;
      params.push(documentCategory as string);
    }

    query += ` ORDER BY document_category, created_at DESC`;

    const result = await db.query(query, params);

    // Decrypt URLs for client
    const decryptedRows = result.rows.map(row => ({
      ...row,
      file_url: decrypt(row.file_url)
    }));

    res.json({
      success: true,
      data: decryptedRows,
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
    const params: any[] = [consumerId];

    if (documentType) {
      query += ` AND document_type = $${params.length + 1}`;
      params.push(documentType as string);
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
