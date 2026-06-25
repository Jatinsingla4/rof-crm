/**
 * Documents Routes - Module E
 * Template engine, PDF generation, scanned contract vault, document management
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { applyRecalc, extractFieldValue, buildEditScript } from '../utils/document-recalc.js';
import { writebackField, WritebackContext } from '../utils/document-writeback.js';
import { applyWaterfall, WaterfallReceipt, WaterfallDemand } from '../utils/payment-waterfall.js';

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

function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Rupees Zero Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+convert(n%100) : '');
    if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+convert(n%1000) : '');
    if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+convert(n%100000) : '');
    return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+convert(n%10000000) : '');
  }
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  let result = 'Rupees ' + convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result + ' Only';
}

function ordinalFloor(n: number | null): string {
  if (!n) return 'Ground Floor';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]) + ' Floor';
}

function fmtDateIndia(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d as string);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtIndianNumber(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

// Get the professional demand letter HTML shell (bypasses template DB lookup)
function getDemandLetterShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Demand Letter</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #000; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 20px 28px; }
  .print-bar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; }
  @media print { .print-bar { display: none; } }
  .btn-print { background: #333; color: #fff; border: none; padding: 7px 18px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .btn-close  { background: #ddd; color: #333; border: none; padding: 7px 14px; border-radius: 3px; cursor: pointer; font-size: 10pt; }
  .co-header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
  .co-name { font-size: 14pt; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
  .co-cin  { font-size: 8.5pt; text-align: center; color: #333; margin-top: 1px; }
  .co-addr { font-size: 8.5pt; text-align: center; color: #333; margin-top: 3px; line-height: 1.5; }
  .co-ref-row { display: flex; justify-content: space-between; margin-top: 6px; font-size: 8.5pt; }
  .doc-title { text-align: center; border: 2px solid #000; font-size: 12pt; font-weight: 700; letter-spacing: 3px; padding: 5px 0; margin: 8px 0; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-bottom: 8px; }
  .info-col { padding: 7px 10px; }
  .info-col:first-child { border-right: 1px solid #000; }
  .col-title { font-weight: 700; font-size: 9.5pt; border-bottom: 1px solid #000; margin-bottom: 5px; padding-bottom: 3px; }
  .info-row { display: flex; margin-bottom: 2px; font-size: 9pt; }
  .info-lbl { color: #444; width: 115px; flex-shrink: 0; }
  .info-val { font-weight: 600; }
  .subject { font-weight: 700; font-size: 10pt; margin: 6px 0; }
  .subject u { text-decoration: underline; }
  .body-para { font-size: 10pt; line-height: 1.6; margin: 5px 0; text-align: justify; }
  .demand-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8.5pt; }
  .demand-table th { background: #000; color: #fff; padding: 5px 3px; border: 1px solid #555; text-align: center; font-size: 8pt; font-weight: 700; }
  .demand-table td { border: 1px solid #999; padding: 4px 3px; }
  .demand-table tbody tr:nth-child(4n+3) td, .demand-table tbody tr:nth-child(4n+4) td { background: #f5f5f5; }
  .demand-table tfoot td { font-weight: 700; background: #e8e8e8; border: 1px solid #666; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  .bold { font-weight: 700; }
  .amt-words { border: 1px solid #999; padding: 7px 12px; margin: 6px 0; font-size: 10pt; }
  .pay-para { font-size: 10pt; line-height: 1.6; margin: 6px 0; text-align: justify; }
  .sign-off { margin: 14px 0 6px; }
  .sign-off p { font-size: 10pt; line-height: 1.8; }
  .sign-space { height: 38px; }
  .sign-name { font-weight: 700; font-size: 10pt; }
  .sign-title { font-size: 9pt; color: #333; }
  .rtgs-box { border: 1px solid #000; padding: 8px 12px; margin: 8px 0; }
  .rtgs-title { font-weight: 700; font-size: 10pt; margin-bottom: 5px; text-decoration: underline; }
  .rtgs-grid { display: grid; grid-template-columns: 150px 1fr; gap: 2px 6px; font-size: 9pt; }
  .rtgs-lbl { color: #444; }
  .rtgs-val { font-weight: 600; }
  .notes-section { margin: 8px 0; }
  .notes-title { font-weight: 700; font-size: 10pt; margin-bottom: 3px; }
  .notes-section ol { padding-left: 16px; }
  .notes-section ol li { font-size: 9pt; line-height: 1.6; margin-bottom: 2px; }
  .doc-footer { border-top: 1px solid #999; margin-top: 10px; padding-top: 5px; text-align: center; font-size: 8pt; color: #666; }
</style>
</head>
<body>
<div class="page">
  <div class="print-bar">
    <button class="btn-close" onclick="window.close()">Close</button>
    <button class="btn-print" onclick="window.print()">&#128438; Print / Save PDF</button>
  </div>
  <div class="co-header">
    <div class="co-name">{{companyName}}</div>
    <div class="co-cin">CIN: {{companyCin}}</div>
    <div class="co-addr">
      Corporate Office: {{companyAddress}}<br/>
      Registered Office: {{companyRegAddr}}<br/>
      T: {{companyPhone}} &nbsp;|&nbsp; W: {{companyWebsite}} &nbsp;|&nbsp; E: {{companyEmail}}
    </div>
    <div class="co-ref-row">
      <div>GSTIN: {{companyGstin}} &nbsp;|&nbsp; Place of Supply: {{placeOfSupply}}</div>
      <div>Customer ID: {{customerId}} &nbsp;|&nbsp; Invoice Date: {{invoiceDate}}</div>
    </div>
  </div>
  <div class="doc-title">DEMAND LETTER</div>
  <div class="info-grid">
    <div class="info-col">
      <div class="col-title">Allottee Details</div>
      <div class="info-row"><span class="info-lbl">Name</span><span class="info-val">{{consumerName}}</span></div>
      <div class="info-row"><span class="info-lbl">S/o, D/o, W/o</span><span class="info-val">{{fatherName}}</span></div>
      <div class="info-row"><span class="info-lbl">Co-Applicant(s)</span><span class="info-val">{{coApplicants}}</span></div>
      <div class="info-row"><span class="info-lbl">Mobile</span><span class="info-val">{{mobile}}</span></div>
      <div class="info-row"><span class="info-lbl">Address</span><span class="info-val">{{address}}</span></div>
      <div class="info-row"><span class="info-lbl">Allotment Date</span><span class="info-val">{{allotmentDate}}</span></div>
      <div class="info-row"><span class="info-lbl">Booking Date</span><span class="info-val">{{bookingDate}}</span></div>
      <div class="info-row"><span class="info-lbl">Income Category</span><span class="info-val">{{incomeCategory}}</span></div>
      <div class="info-row"><span class="info-lbl">RERA Regd. No.</span><span class="info-val">{{reraNo}}</span></div>
    </div>
    <div class="info-col">
      <div class="col-title">Unit Details</div>
      <div class="info-row"><span class="info-lbl">Project</span><span class="info-val">{{projectName}}</span></div>
      <div class="info-row"><span class="info-lbl">Location</span><span class="info-val">{{projectLocation}}</span></div>
      <div class="info-row"><span class="info-lbl">Tower</span><span class="info-val">{{towerName}}</span></div>
      <div class="info-row"><span class="info-lbl">Floor</span><span class="info-val">{{floorNo}}</span></div>
      <div class="info-row"><span class="info-lbl">Unit No.</span><span class="info-val">{{unitNumber}}</span></div>
      <div class="info-row"><span class="info-lbl">Carpet Area (sq.ft.)</span><span class="info-val">{{carpetArea}}</span></div>
      <div class="info-row"><span class="info-lbl">Balcony Area (sq.ft.)</span><span class="info-val">{{balconyArea}}</span></div>
      <div class="info-row"><span class="info-lbl">Type</span><span class="info-val">{{unitCategory}}</span></div>
      <div class="info-row"><span class="info-lbl">Payment Plan</span><span class="info-val">{{planName}}</span></div>
      <div class="info-row"><span class="info-lbl">Total Agreement Value</span><span class="info-val">&#8377;{{totalAmount}}</span></div>
    </div>
  </div>
  <div class="subject">
    Subject: <u>Demand Notice for Payment of Installment(s) — {{projectName}}, Unit No. {{unitNumber}}</u>
  </div>
  <p class="body-para">
    Dear <strong>{{consumerName}}</strong>,<br/>
    With reference to the allotment of Unit No. <strong>{{unitNumber}}</strong> admeasuring Carpet Area <strong>{{carpetArea}} Sq. Ft.</strong> and Balcony Area <strong>{{balconyArea}} Sq. Ft.</strong> in <strong>{{projectName}}</strong>, and as per the payment schedule agreed at the time of allotment, we wish to bring to your kind attention that the following installment(s) are due / overdue for payment. You are requested to make the payment on or before <strong>{{dueDate}}</strong> to avoid penal interest under HRERA Rule 15 @ <strong>{{penalRate}}%</strong> per annum on the outstanding amount.
  </p>
  <table class="demand-table">
    <thead>
      <tr>
        <th style="width:28px">S.No.</th>
        <th>Installment Description</th>
        <th style="width:68px">Due Date</th>
        <th style="width:72px">Basic Amt (&#8377;)</th>
        <th style="width:42px">CGST %</th>
        <th style="width:62px">CGST (&#8377;)</th>
        <th style="width:42px">SGST %</th>
        <th style="width:62px">SGST (&#8377;)</th>
        <th style="width:72px">Total Due (&#8377;)</th>
        <th style="width:68px">Paid (&#8377;)</th>
        <th style="width:72px">Payable (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      {{demandRows}}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="tr bold">TOTAL</td>
        <td class="tr bold">—</td>
        <td class="tc bold">—</td>
        <td class="tr bold">{{totalCgst}}</td>
        <td class="tc bold">—</td>
        <td class="tr bold">{{totalSgst}}</td>
        <td class="tr bold">{{totalDue}}</td>
        <td class="tr bold">{{totalPaid}}</td>
        <td class="tr bold">{{totalPayable}}</td>
      </tr>
    </tfoot>
  </table>
  <div class="amt-words">
    <strong>Amount Payable in Words:</strong> {{amountInWords}}
  </div>
  <p class="pay-para">
    Kindly ensure payment is made via NEFT / RTGS / Cheque / Demand Draft in favour of the details given below. Please note that cheque is subject to realisation. In case of delayed payment, penal interest @ <strong>{{penalRate}}%</strong> per annum will be charged as per HRERA Rule 15. Failure to pay within the stipulated time may result in cancellation of allotment and forfeiture of deposited amount as per the Buyer-Builder Agreement.
  </p>
  <div class="sign-off">
    <p>Yours faithfully,<br/>For <strong>{{companyName}}</strong></p>
    <div class="sign-space"></div>
    <div class="sign-name">Authorised Signatory</div>
    <div class="sign-title">Accounts &amp; Finance Department</div>
  </div>
  <div class="rtgs-box">
    <div class="rtgs-title">Payment / RTGS Details</div>
    <div class="rtgs-grid">
      <span class="rtgs-lbl">Account Name</span><span class="rtgs-val">{{bankCompanyName}}</span>
      <span class="rtgs-lbl">Account Number</span><span class="rtgs-val">{{bankAccountNo}}</span>
      <span class="rtgs-lbl">IFSC Code</span><span class="rtgs-val">{{bankIfsc}}</span>
      <span class="rtgs-lbl">Bank Name</span><span class="rtgs-val">{{bankName}}</span>
      <span class="rtgs-lbl">Branch</span><span class="rtgs-val">{{bankBranch}}</span>
    </div>
  </div>
  <div class="notes-section">
    <div class="notes-title">Important Notes:</div>
    <ol>
      <li>{{demandNote1}}</li>
      <li>{{demandNote2}}</li>
      <li>{{demandNote3}}</li>
      <li>{{demandNote4}}</li>
    </ol>
  </div>
  <div class="doc-footer">
    This is a computer-generated document. No signature required. Generated on {{currentDate}}. | {{companyName}}
  </div>
</div>
</body>
</html>`;
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
    let { consumerId, allocationId, templateId, documentType, mergeData, deliveryMethod, dueDate, includeAllDemands } = req.body;

    if (!consumerId && !allocationId) {
      return res.status(400).json({ error: 'consumerId or allocationId is required' });
    }

    // 1. Resolve Template
    console.log(`[GENERATE] Resolving template: documentType=${documentType}, templateId=${templateId}, consumerId=${consumerId}`);
    let template;
    if (templateId) {
      const tRes = await db.query(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);
      template = tRes.rows[0];
      console.log(`[GENERATE] Template by ID: ${template ? 'found' : 'not found'}`);
    } else if (documentType) {
      // For buyer_builder_agreement and conveyance_deed, try project-specific first, then fall back to global
      if (['buyer_builder_agreement', 'conveyance_deed'].includes(documentType)) {
        let projectId = null;

        // Try to get project_id from consumer's allocation/unit
        if (consumerId) {
          const projRes = await db.query(
            `SELECT p.id FROM projects p
             JOIN allocations a ON p.id = a.project_id
             WHERE a.consumer_id = $1
             ORDER BY a.created_at DESC LIMIT 1`,
            [consumerId]
          );
          projectId = projRes.rows[0]?.id || null;
          console.log(`[GENERATE] Consumer projectId: ${projectId || 'null (fallback to global)'}`);
        }

        // Try project-specific template first, then fall back to global (project_id IS NULL)
        const tRes = await db.query(
          `SELECT * FROM document_templates
           WHERE document_type = $1
           AND (
             project_id = $2
             OR project_id IS NULL
           )
           ORDER BY
             CASE WHEN project_id = $2 THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT 1`,
          [documentType, projectId]
        );
        template = tRes.rows[0];
        console.log(`[GENERATE] Template found: ${template ? `id=${template.id}, projectId=${template.project_id}` : 'not found'}`);
      } else if (documentType === 'demand_letter') {
        // demand_letter is built entirely dynamically — no template DB lookup needed
        // Use the professional HTML shell with all required markers for injection
        console.log(`[GENERATE] demand_letter uses inline shell (no DB lookup)`);
        template = {
          id: null,
          document_type: 'demand_letter',
          body_html: getDemandLetterShell(),
          project_id: null,
          name: 'Demand Letter (Dynamic)'
        };
      } else if (['allotment_letter', 'payment_receipt'].includes(documentType)) {
        // For allotment_letter and payment_receipt, try project-specific first, then fall back to global
        let projectId = null;

        // Try to get project_id from consumer's allocation/unit
        if (consumerId) {
          const projRes = await db.query(
            `SELECT p.id FROM projects p
             JOIN allocations a ON p.id = a.project_id
             WHERE a.consumer_id = $1
             ORDER BY a.created_at DESC LIMIT 1`,
            [consumerId]
          );
          projectId = projRes.rows[0]?.id || null;
          console.log(`[GENERATE] Consumer projectId: ${projectId || 'null (fallback to global)'}`);
        }

        // Try project-specific template first, then fall back to global (project_id IS NULL)
        const tRes = await db.query(
          `SELECT * FROM document_templates
           WHERE document_type = $1
           AND (
             project_id = $2
             OR project_id IS NULL
           )
           ORDER BY
             CASE WHEN project_id = $2 THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT 1`,
          [documentType, projectId]
        );
        template = tRes.rows[0];
        console.log(`[GENERATE] Template found: ${template ? `id=${template.id}, projectId=${template.project_id}` : 'not found'}`);
      } else {
        const tRes = await db.query(
          `SELECT * FROM document_templates WHERE document_type = $1 ORDER BY created_at DESC LIMIT 1`,
          [documentType]
        );
        template = tRes.rows[0];
        console.log(`[GENERATE] Generic template found: ${template ? 'yes' : 'no'}`);
      }
    }

    if (!template) {
      console.error(`[GENERATE] ❌ Template not found for documentType=${documentType}`);
      return res.status(404).json({ error: 'Document template not found' });
    }
    console.log(`[GENERATE] ✓ Template resolved successfully`);

    // 2. Read template HTML directly from database
    let htmlContent = template.body_html || '';

    if (!htmlContent || htmlContent.length < 100) {
      console.error(
        `[TEMPLATE] Empty or invalid template. DocumentType: ${documentType}, ` +
        `TemplateId: ${templateId}, Length: ${htmlContent?.length}`
      );
      return res.status(500).json({
        error: 'Document template is empty or corrupted. Please contact administrator.'
      });
    }

    // Verify template no longer uses old FILE: references
    if (htmlContent.startsWith('FILE:')) {
      console.error(
        `[TEMPLATE] Template still uses deprecated FILE: reference. ` +
        `DocumentType: ${documentType}, Reference: ${htmlContent}`
      );
      return res.status(500).json({
        error: 'Document template not properly configured. FILE: references are no longer supported.'
      });
    }

    // 3. Auto-Merge Logic (if mergeData missing)
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
          const includeInterest = req.body.includeInterest !== false;
          const demandIdFilter = req.body.demandId as string | undefined;

          // Fetch global_settings as key→value map
          const settingsRes = await db.query(`SELECT key, value FROM global_settings`);
          const settings: Record<string, string> = {};
          settingsRes.rows.forEach((r: any) => { settings[r.key] = r.value; });
          const penalRate = parseFloat(settings['penal_interest_rate_percent'] || '11.10');

          // Fetch per-project company details (overrides global_settings if found)
          const projCompanyRes = await db.query(`
            SELECT c.name, c.cin, c.gstin, c.address1, c.reg_address,
                   c.phone, c.website, c.email, c.place_of_supply, c.logo_url,
                   c.bank_company_name, c.bank_account_no, c.bank_ifsc,
                   c.bank_name, c.bank_branch
            FROM companies c
            JOIN projects p ON p.company_id = c.id
            JOIN units u ON u.project_id = p.id
            LEFT JOIN allocations al ON al.unit_id = u.id AND al.consumer_id = $1
            LEFT JOIN payment_plans pp ON pp.consumer_id = $1
            LEFT JOIN booking_records br ON br.consumer_id = $1
            WHERE al.consumer_id = $1 OR pp.consumer_id = $1 OR br.consumer_id = $1
            LIMIT 1`, [consumerId]);
          const projCompany = projCompanyRes.rows[0] || null;

          // Fetch consumer + unit + tower + project + payment_plan
          // Unit resolved: allocation → payment_plan → booking_record (three-level fallback)
          const planRes = await db.query(`
            SELECT
              c.name AS consumer_name, c.father_name, c.mobile, c.email,
              c.registration_no, c.income_category, c.present_address,
              c.nationality,
              COALESCE(u_al.unit_number, u_pp.unit_number, u_br.unit_number) AS unit_number,
              COALESCE(u_al.bhk_type, u_pp.bhk_type, u_br.bhk_type) AS bhk_type,
              COALESCE(u_al.carpet_area_sqft, u_pp.carpet_area_sqft, u_br.carpet_area_sqft) AS carpet_area_sqft,
              COALESCE(u_al.balcony_area_sqft, u_pp.balcony_area_sqft, u_br.balcony_area_sqft) AS balcony_area_sqft,
              COALESCE(u_al.super_area_sqft, u_pp.super_area_sqft, u_br.super_area_sqft) AS super_area_sqft,
              COALESCE(u_al.base_price_inr, u_pp.base_price_inr, u_br.base_price_inr) AS base_price_inr,
              COALESCE(u_al.total_price_inr, u_pp.total_price_inr, u_br.total_price_inr) AS total_price_inr_unit,
              COALESCE(u_al.floor, u_pp.floor, u_br.floor) AS floor,
              COALESCE(u_al.facing, u_pp.facing, u_br.facing) AS facing,
              COALESCE(t_al.tower_name, t_pp.tower_name, t_br.tower_name) AS tower_name,
              COALESCE(p_al.name, p_pp.name, p_br.name) AS project_name,
              COALESCE(p_al.location, p_pp.location, p_br.location) AS project_location,
              COALESCE(p_al.rera_number, p_pp.rera_number, p_br.rera_number) AS rera_number,
              COALESCE(p_al.id, p_pp.id, p_br.id) AS project_id,
              pp.id AS payment_plan_id,
              COALESCE(pp.total_amount_inr, u_br.total_price_inr) AS total_amount_inr,
              COALESCE(
                NULLIF(br.selected_plan_name, ''),
                (SELECT DISTINCT plan_name FROM plan_schedule_templates
                 WHERE project_id = COALESCE(p_al.id, p_pp.id, p_br.id) ORDER BY plan_name ASC LIMIT 1),
                'CLP'
              ) AS plan_name,
              al.allotment_date,
              br.booking_date,
              COALESCE(br.booking_amount, 0) AS booking_amount,
              COALESCE(br.basic_rate_inr_sqft, 0) AS booking_basic_rate_inr_sqft,
              COALESCE(br.carpet_area_sqft, 0) AS booking_carpet_area_sqft,
              COALESCE(br.other_charge_amount, 0) AS other_charge_amount,
              COALESCE(br.other_charge_desc, '') AS other_charge_desc,
              COALESCE(br.payment_mode, '') AS booking_payment_mode,
              COALESCE(NULLIF(br.payment_ref, ''), '') AS booking_payment_ref,
              COALESCE(NULLIF(br.bank_name, ''), '') AS booking_bank_name,
              br.cheque_date AS booking_cheque_date,
              COALESCE((
                SELECT SUM(r.amount_received_inr)
                FROM receipts r
                WHERE r.consumer_id = c.id
                AND r.status = 'cleared'
              ), 0) AS total_received_inr
            FROM consumers c
            LEFT JOIN LATERAL (
              SELECT * FROM allocations WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) al ON true
            LEFT JOIN units u_al ON u_al.id = al.unit_id
            LEFT JOIN towers t_al ON t_al.id = u_al.tower_id
            LEFT JOIN projects p_al ON p_al.id = u_al.project_id
            LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
            LEFT JOIN units u_pp ON u_pp.id = pp.unit_id
            LEFT JOIN towers t_pp ON t_pp.id = u_pp.tower_id
            LEFT JOIN projects p_pp ON p_pp.id = pp.project_id
            LEFT JOIN LATERAL (
              SELECT * FROM booking_records WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) br ON true
            LEFT JOIN units u_br ON u_br.id = br.unit_id
            LEFT JOIN towers t_br ON t_br.id = u_br.tower_id
            LEFT JOIN projects p_br ON p_br.id = br.project_id
            WHERE c.id = $1
            ORDER BY pp.created_at DESC
            LIMIT 1
          `, [consumerId]);

          const plan = planRes.rows[0] || {};

          // Fetch co-applicants
          const coRes = await db.query(
            `SELECT name, relationship FROM co_applicants WHERE consumer_id = $1 ORDER BY created_at ASC LIMIT 3`,
            [consumerId]
          );
          const coApplicants = coRes.rows
            .map((r: any) => r.name + (r.relationship ? ` (${r.relationship})` : ''))
            .join(', ');

          // Only show formally raised installments (status='demanded') in the letter.
          const planId = plan.payment_plan_id;
          const projectId = plan.project_id;
          const planName = plan.plan_name || 'CLP';
          const totalAmountInr = parseFloat(plan.total_amount_inr || 0);
          const allotmentDate = plan.allotment_date ? new Date(plan.allotment_date) : null;
          const isNri = ['nri','oci','pio'].includes((plan.nationality || '').toLowerCase());
          // AHP GST: 1% total (0.5% CGST + 0.5% SGST) for residents, 0 for NRI
          const defaultCgstPct = isNri ? 0 : 0.5;
          const defaultSgstPct = isNri ? 0 : 0.5;

          const allInstallmentsQuery = `
            SELECT DISTINCT ON (d.installment_index)
              COALESCE(pst.installment_index, d.installment_index) AS installment_index,
              COALESCE(pst.installment_name, d.demand_type, 'Installment') AS installment_name,
              COALESCE(pst.percentage, 0) AS percentage,
              COALESCE(pst.due_date_offset_days, 0) AS due_date_offset_days,
              d.id AS demand_id,
              d.status AS demand_status,
              d.delivery_status,
              d.amount_due_inr,
              d.cgst_amount,
              d.sgst_amount,
              d.due_date,
              COALESCE(
                (SELECT SUM(r.amount_received_inr) FROM receipts r
                 WHERE r.demand_id = d.id AND r.status = 'cleared'), 0
              ) AS amount_paid,
              GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue
            FROM demands d
            LEFT JOIN plan_schedule_templates pst
              ON pst.project_id = $1
              AND pst.plan_name = $2
              AND pst.installment_index = d.installment_index
            WHERE d.consumer_id = $3
            ORDER BY d.installment_index ASC, d.created_at DESC
          `;

          const demandQuery = `
            SELECT
              pst.installment_index,
              pst.installment_name,
              pst.percentage,
              pst.due_date_offset_days,
              d.id AS demand_id,
              d.status AS demand_status,
              d.delivery_status,
              d.amount_due_inr,
              d.cgst_amount,
              d.sgst_amount,
              d.due_date,
              COALESCE(
                (SELECT SUM(r.amount_received_inr) FROM receipts r
                 WHERE r.demand_id = d.id AND r.status = 'cleared'),
                0
              ) AS amount_paid,
              GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue
            FROM demands d
            JOIN plan_schedule_templates pst
              ON pst.project_id = $2
              AND pst.plan_name = $3
              AND pst.installment_index = d.installment_index
            WHERE d.payment_plan_id = $1
              AND d.status IN ('demanded', 'pending', 'paid')
              AND d.due_date IS NOT NULL
              AND d.due_date <= $4::date
            ORDER BY pst.installment_index ASC
          `;
          const demandParams: any[] = [planId, projectId, planName, dueDate];

          // Fallback: only if no project could be resolved at all
          let demandsRes: any;
          if (includeAllDemands) {
            demandsRes = await db.query(allInstallmentsQuery, [projectId || null, planName || '', consumerId]);
          } else if (!projectId) {
            const fallbackQuery = `
              SELECT DISTINCT ON (d.installment_index) d.*,
                COALESCE(pst2.installment_name, d.demand_type, 'Installment') AS installment_name,
                d.amount_due_inr, d.cgst_amount, d.sgst_amount, d.due_date,
                COALESCE(
                  (SELECT SUM(amount_received_inr) FROM receipts
                   WHERE demand_id = d.id AND status = 'cleared'), 0
                ) AS amount_paid,
                GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue,
                COALESCE(pst2.percentage, 0) AS percentage
              FROM demands d
              LEFT JOIN payment_plans pp2 ON pp2.id = d.payment_plan_id
              LEFT JOIN plan_schedule_templates pst2
                ON pst2.project_id = pp2.project_id AND pst2.installment_index = d.installment_index
              WHERE d.consumer_id = $1
                AND d.status IN ('demanded', 'pending', 'paid')
                AND d.due_date IS NOT NULL
                AND d.due_date <= $2::date
              ORDER BY d.installment_index ASC`;
            demandsRes = await db.query(fallbackQuery, [consumerId, dueDate]);
          } else {
            demandsRes = await db.query(demandQuery, demandParams);
          }

          // Count all template installments for this plan (used to decide Other Charges visibility)
          const planSchedCountRes = projectId && planName
            ? await db.query(`SELECT COUNT(*) FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2`, [projectId, planName])
            : { rows: [{ count: '0' }] };
          const totalPlanInstallments = parseInt(planSchedCountRes.rows[0]?.count || '0');

          // Build waterfall allocation map: demand_id → total paid (linked + advance pool)
          const [wfRcptsRes, wfDemandsRes] = await Promise.all([
            db.query<WaterfallReceipt>(
              `SELECT id, amount_received_inr, demand_id, installment_index, status,
                      received_date, payment_method
               FROM receipts WHERE consumer_id = $1 AND status = 'cleared'`,
              [consumerId]
            ),
            db.query<WaterfallDemand>(
              `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount
               FROM demands WHERE consumer_id = $1`,
              [consumerId]
            ),
          ]);
          const allWfResults = applyWaterfall(wfRcptsRes.rows, wfDemandsRes.rows);
          const wfMap = new Map(allWfResults.map(w => [w.demand_id, w.paid]));

          let totalDue = 0, totalPaid = 0, totalCgst = 0, totalSgst = 0;
          let totalInterestCalc = 0;  // always-calculated interest for with-interest mode

          // BSP amount-based split ratio for Basic Price vs Balcony Charges rows
          const bookingBspRate   = parseFloat(plan.booking_basic_rate_inr_sqft || 0);
          const bookingCarpetSqft = parseFloat(plan.booking_carpet_area_sqft   || 0);
          const totalBsp = bookingBspRate > 0 && bookingCarpetSqft > 0
            ? Math.round(bookingBspRate * bookingCarpetSqft)
            : 0;
          // Recalculate total from rate × super_area to correct any legacy
          // bookings where total_amount_inr was double-counted
          const recalcTotal = bookingBspRate > 0 && bookingCarpetSqft > 0
            ? Math.round(bookingBspRate * bookingCarpetSqft)
            : totalAmountInr;
          const basicRatio = totalBsp > 0 && recalcTotal > 0
            ? totalBsp / recalcTotal
            : 1;
          // True unit areas for direct area-based row split
          const trueCarpet  = parseFloat(plan.carpet_area_sqft  || 0);
          const trueBalcony = parseFloat(plan.balcony_area_sqft || 0);
          const superArea = trueCarpet + trueBalcony;

          let rowsNoInterest = '';
          let rowsWithInterest = '';

          // DS: tagged span helper for demand letter table cells
          const DS = (key: string, label: string, val: number, extra = '') =>
            `<span data-field-key="${key}" data-field-label="${label}" data-value-type="currency" data-section="payment_table"${extra}>${fmtIndianNumber(val)}</span>`;

          demandsRes.rows.forEach((dm: any, idx: number) => {
            // If demand exists, use its amounts; otherwise calculate from template percentage
            const hasDemand = !!dm.demand_id;
            const pct = parseFloat(dm.percentage || 0) / 100;
            const calculatedAmt = Math.round(recalcTotal * pct);
            const installment = hasDemand
              ? parseFloat(dm.amount_due_inr || 0)
              : calculatedAmt;
            const cgst = hasDemand
              ? parseFloat(dm.cgst_amount || 0)
              : Math.round(installment * defaultCgstPct / 100);
            const sgst = hasDemand
              ? parseFloat(dm.sgst_amount || 0)
              : Math.round(installment * defaultSgstPct / 100);
            const totalGst = cgst + sgst;
            const amtDue = installment + cgst + sgst;
            // Use waterfall allocation (covers advance/booking receipts) with fallback to direct linkage.
            // dm.demand_id is set by the main query alias; dm.id is set by fallback (d.*).
            const dmId = dm.demand_id || dm.id || null;
            const amtPaid = dmId ? (wfMap.get(dmId) ?? parseFloat(dm.amount_paid || 0)) : parseFloat(dm.amount_paid || 0);

            // Due date: from demand if raised, else calculate from allotment date + offset.
            // Milestone-based installments have offset_days = 0; they show '—' until demanded.
            let dueDateVal: Date | null = null;
            if (dm.due_date) {
              // Parse DB date (YYYY-MM-DD comes as UTC midnight) → normalize to local midnight
              // so day-count arithmetic is timezone-correct
              const raw = new Date(dm.due_date);
              dueDateVal = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
            } else if (dm.due_date_offset_days > 0 && allotmentDate) {
              // Genuine offset-based installment (e.g. "Within 15 days of allotment")
              dueDateVal = new Date(allotmentDate);
              dueDateVal.setDate(dueDateVal.getDate() + parseInt(dm.due_date_offset_days));
            }
            // else: milestone-based with no stored date → dueDateVal stays null → renders '—'

            // Invoice date = today at local midnight for accurate day counting
            const invoiceDate = new Date();
            invoiceDate.setHours(0, 0, 0, 0);
            const daysOverdue = dueDateVal
              ? Math.max(0, Math.floor((invoiceDate.getTime() - dueDateVal.getTime()) / 86400000))
              : 0;
            // Interest principal = full installment amount (HRERA Rule 15), regardless of
            // payment status — even a paid-but-late installment accrues interest.
            const rowInterest = daysOverdue > 0
              ? parseFloat((installment * (penalRate / 100) * daysOverdue / 365).toFixed(2))
              : 0;

            totalDue += amtDue;
            totalPaid += amtPaid;
            totalCgst += cgst;
            totalSgst += sgst;
            totalInterestCalc += rowInterest;

            const cgstPct = (defaultCgstPct > 0 || cgst > 0)
              ? (installment > 0 ? ((cgst / installment) * 100).toFixed(2) : defaultCgstPct.toFixed(2))
              : '0.00';
            const sgstPct = (defaultSgstPct > 0 || sgst > 0)
              ? (installment > 0 ? ((sgst / installment) * 100).toFixed(2) : defaultSgstPct.toFixed(2))
              : '0.00';

            // Split into Basic Price (carpet area) and Balcony Charges rows.
            // Use installment (DB demand = BSP+IFMS) split by carpet/super ratio —
            // ensures rows always sum to the full demand amount.
            const carpetOnlyRatio = superArea > 0 ? trueCarpet / superArea : 1;
            const basicAmt = Math.round(installment * carpetOnlyRatio);
            const balconyAmt = installment - basicAmt;
            // Use carpet/superArea ratio for GST + interest split —
            // basicRatio = 1.0 (totalBsp === recalcTotal) so cannot use it here
            const carpetRatio = superArea > 0 ? trueCarpet / superArea : 1;
            const basicCgst = Math.round(cgst * carpetRatio);
            const balconyCgst = cgst - basicCgst;
            const basicSgst = Math.round(sgst * carpetRatio);
            const balconySgst = sgst - basicSgst;
            const basicDue = basicAmt + basicCgst + basicSgst;
            const balconyDue = balconyAmt + balconyCgst + balconySgst;
            // Waterfall: fill Row 1 up to full basicDue (base + GST), then remainder to Row 2
            const basicPaid = Math.min(amtPaid, basicDue);
            const balconyPaid = Math.max(0, amtPaid - basicPaid);
            const basicPayable = Math.max(0, basicDue - basicPaid);
            const balconyPayable = Math.max(0, balconyDue - balconyPaid);

            // Interest split for with-interest version
            const basicInterest = Math.round(rowInterest * carpetRatio);
            const balconyInterest = rowInterest - basicInterest;
            const basicDueWI = basicDue + basicInterest;
            const balconyDueWI = balconyDue + balconyInterest;
            const basicPayableWI = Math.max(0, basicDueWI - basicPaid);
            const balconyPayableWI = Math.max(0, balconyDueWI - balconyPaid);

            const label = dm.installment_name || dm.installment_label || dm.demand_type || 'Installment';
            const dueDt = dueDateVal ? fmtDateIndia(dueDateVal) : '—';

            // 11-column row (without interest)
            rowsNoInterest += `<tr>
              <td class="tc" rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${idx + 1}</td>
              <td>${label} — Basic Price</td>
              <td class="tc" data-field-key="dueDate_${idx}" data-field-label="Due Date (Row ${idx})" data-value-type="date" data-section="payment_table">${dueDt}</td>
              <td class="tr">${DS(`basicAmt_${idx}`, `Basic Amount (Row ${idx})`, basicAmt, ` data-cgst-pct="${cgstPct}" data-gst-type="basic"`)}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`basicCgst_${idx}`, `CGST Amount (Row ${idx})`, basicCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`basicSgst_${idx}`, `SGST Amount (Row ${idx})`, basicSgst)}</td>
              <td class="tr">${DS(`basicTotal_${idx}`, `Row Total (Row ${idx})`, basicDue)}</td>
              <td class="tr">${DS(`basicPaid_${idx}`, `Amount Paid (Row ${idx})`, basicPaid)}</td>
              <td class="tr bold">${DS(`basicPayable_${idx}`, `Net Payable (Row ${idx})`, basicPayable)}</td>
            </tr>
            ${trueBalcony > 0 ? `<tr>
              <td>${label} — Balcony Charges</td>
              <td class="tc">${dueDt}</td>
              <td class="tr">${DS(`balconyAmt_${idx}`, `Balcony Amount (Row ${idx})`, balconyAmt, ' data-gst-type="basic"')}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`balconyCgst_${idx}`, `Balcony CGST (Row ${idx})`, balconyCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`balconySgst_${idx}`, `Balcony SGST (Row ${idx})`, balconySgst)}</td>
              <td class="tr">${DS(`balconyTotal_${idx}`, `Balcony Total (Row ${idx})`, balconyDue)}</td>
              <td class="tr">${DS(`balconyPaid_${idx}`, `Balcony Paid (Row ${idx})`, balconyPaid)}</td>
              <td class="tr bold">${DS(`balconyPayable_${idx}`, `Balcony Payable (Row ${idx})`, balconyPayable)}</td>
            </tr>` : ''}`;

            // 12-column row (with interest — adds Interest col after SGST)
            rowsWithInterest += `<tr>
              <td class="tc" rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${idx + 1}</td>
              <td>${label} — Basic Price</td>
              <td class="tc" data-field-key="dueDate_${idx}" data-field-label="Due Date (Row ${idx})" data-value-type="date" data-section="interest_table">${dueDt}</td>
              <td class="tr">${DS(`basicAmt_${idx}`, `Basic Amount (Row ${idx})`, basicAmt, ` data-cgst-pct="${cgstPct}" data-gst-type="basic"`)}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`basicCgst_${idx}`, `CGST Amount (Row ${idx})`, basicCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`basicSgst_${idx}`, `SGST Amount (Row ${idx})`, basicSgst)}</td>
              <td class="tr" style="color:#c00"><span data-field-key="basicInterest_${idx}" data-field-label="Penal Interest (Row ${idx})" data-value-type="currency" data-section="interest_table">${fmtIndianNumber(basicInterest)}</span></td>
              <td class="tr">${DS(`basicTotal_${idx}`, `Row Total (Row ${idx})`, basicDueWI)}</td>
              <td class="tr">${DS(`basicPaid_${idx}`, `Amount Paid (Row ${idx})`, basicPaid)}</td>
              <td class="tr bold">${DS(`basicPayable_${idx}`, `Net Payable (Row ${idx})`, basicPayableWI)}</td>
            </tr>
            ${trueBalcony > 0 ? `<tr>
              <td>${label} — Balcony Charges</td>
              <td class="tc">${dueDt}</td>
              <td class="tr">${DS(`balconyAmt_${idx}`, `Balcony Amount (Row ${idx})`, balconyAmt, ' data-gst-type="basic"')}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`balconyCgst_${idx}`, `Balcony CGST (Row ${idx})`, balconyCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`balconySgst_${idx}`, `Balcony SGST (Row ${idx})`, balconySgst)}</td>
              <td class="tr" style="color:#c00"><span data-field-key="balconyInterest_${idx}" data-field-label="Balcony Interest (Row ${idx})" data-value-type="currency" data-section="interest_table">${fmtIndianNumber(balconyInterest)}</span></td>
              <td class="tr">${DS(`balconyTotal_${idx}`, `Balcony Total (Row ${idx})`, balconyDueWI)}</td>
              <td class="tr">${DS(`balconyPaid_${idx}`, `Balcony Paid (Row ${idx})`, balconyPaid)}</td>
              <td class="tr bold">${DS(`balconyPayable_${idx}`, `Balcony Payable (Row ${idx})`, balconyPayableWI)}</td>
            </tr>` : ''}`;
          });

          // Other Charges row (IFMS etc.) — appended after all installment rows
          const planOtherCharge = parseFloat(plan.other_charge_amount || 0);
          const planOtherDesc   = plan.other_charge_desc || 'Other Charges';
          const planOcCgst = planOtherCharge > 0 ? Math.round(planOtherCharge * defaultCgstPct / 100) : 0;
          const planOcSgst = planOtherCharge > 0 ? Math.round(planOtherCharge * defaultSgstPct / 100) : 0;
          const planOcDue  = planOtherCharge + planOcCgst + planOcSgst;
          // Calculate how much of Other Charge has been paid via installment payments.
          // OC is embedded in each demand proportionally: ocProportion = OC / totalAmountInr
          // totalPaid is GST-inclusive waterfall total across all rendered demands.
          // Must use totalAmountInr (BSP+OC) NOT recalcTotal (BSP only).
          const ocProportion = planOtherCharge > 0 && totalAmountInr > 0
            ? planOtherCharge / totalAmountInr
            : 0;
          const ocPaid = planOtherCharge > 0
            ? Math.round(totalPaid * ocProportion)
            : 0;
          const ocPayable = Math.max(0, Math.round(planOcDue - ocPaid));
          // Universal rule: show Other Charges row ONLY when ALL installments of
          // this payment plan are shown in this demand letter.
          const demandsShownCount = demandsRes.rows.length;
          const showOtherCharges = planOtherCharge > 0
            && totalPlanInstallments > 0
            && demandsShownCount >= totalPlanInstallments;
          if (showOtherCharges) {
            rowsNoInterest += `<tr style="background:#f9f9f9">
              <td class="tc">—</td>
              <td><strong>Other Charges</strong><br/><span style="padding-left:12px">— ${planOtherDesc}</span></td>
              <td class="tc">—</td>
              <td class="tr">${fmtIndianNumber(planOtherCharge)}</td>
              <td class="tc">${defaultCgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianNumber(planOcCgst)}</td>
              <td class="tc">${defaultSgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianNumber(planOcSgst)}</td>
              <td class="tr">${fmtIndianNumber(planOcDue)}</td>
              <td class="tr">${fmtIndianNumber(ocPaid)}</td>
              <td class="tr bold">${ocPayable === 0 ? '0' : '—'}</td>
            </tr>`;
            rowsWithInterest += `<tr style="background:#f9f9f9">
              <td class="tc">—</td>
              <td><strong>Other Charges</strong><br/><span style="padding-left:12px">— ${planOtherDesc}</span></td>
              <td class="tc">—</td>
              <td class="tr">${fmtIndianNumber(planOtherCharge)}</td>
              <td class="tc">${defaultCgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianNumber(planOcCgst)}</td>
              <td class="tc">${defaultSgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianNumber(planOcSgst)}</td>
              <td class="tr" style="color:#c00">0.00</td>
              <td class="tr">${fmtIndianNumber(planOcDue)}</td>
              <td class="tr">${fmtIndianNumber(ocPaid)}</td>
              <td class="tr bold">${ocPayable === 0 ? '0' : '—'}</td>
            </tr>`;
          }

          // Guard against slight overpayment (advance receipt covers base+GST, totalDue tracks base only)
          const totalPayable = Math.max(0, Math.round(totalDue - totalPaid));
          const totalPayableWithInterest = Math.max(0, Math.round(totalDue - totalPaid + totalInterestCalc));
          const ratePerSqft = parseFloat(plan.booking_basic_rate_inr_sqft || 0) > 0
            ? Math.round(parseFloat(plan.booking_basic_rate_inr_sqft))
            : (plan.carpet_area_sqft > 0
              ? Math.round((plan.base_price_inr || 0) / plan.carpet_area_sqft)
              : 0);
          const lastDemand = demandsRes.rows[demandsRes.rows.length - 1];
          // Compute last due date across all rows
          const lastDueDate = demandsRes.rows.reduce((acc: Date | null, dm: any) => {
            const d = dm.due_date ? new Date(dm.due_date)
              : (allotmentDate && dm.due_date_offset_days != null
                ? new Date(+allotmentDate + parseInt(dm.due_date_offset_days) * 86400000)
                : null);
            return d && (!acc || d > acc) ? d : acc;
          }, null);

          mergeData = {
            // Consumer
            consumerName: plan.consumer_name || d?.name || '—',
            fatherName: plan.father_name || d?.father_name || '—',
            coApplicants: coApplicants || '—',
            mobile: plan.mobile || d?.mobile || '—',
            email: plan.email || d?.email || '—',
            customerId: plan.registration_no || d?.registration_no || '—',
            address: plan.present_address || d?.present_address || '—',
            incomeCategory: plan.income_category || '—',
            // Unit
            unitNumber: plan.unit_number || d?.unit_number || '—',
            unitCategory: plan.bhk_type || d?.bhk_type || '—',
            towerName: plan.tower_name || '—',
            floorNo: ordinalFloor(plan.floor),
            carpetArea: plan.carpet_area_sqft ? fmtIndianNumber(parseFloat(plan.carpet_area_sqft)) : '—',
            balconyArea: plan.balcony_area_sqft ? fmtIndianNumber(parseFloat(plan.balcony_area_sqft)) : '0',
            superArea: plan.super_area_sqft ? fmtIndianNumber(parseFloat(plan.super_area_sqft)) : '—',
            facing: plan.facing || '—',
            ratePerSqft: fmtIndianNumber(ratePerSqft),
            // Project
            projectName: plan.project_name || d?.project_name || '—',
            projectSector: plan.project_location || d?.project_sector || '—',
            projectLocation: plan.project_location || '—',
            reraNo: plan.rera_number || d?.project_rera || '—',
            // Dates
            allotmentDate: fmtDateIndia(plan.allotment_date),
            bookingDate: fmtDateIndia(plan.booking_date),
            dueDate: lastDueDate ? fmtDateIndia(lastDueDate) : (dueDate ? fmtDateIndia(new Date(dueDate)) : '—'),
            invoiceDate: dueDate ? fmtDateIndia(new Date(dueDate)) : fmtDateIndia(new Date()),
            currentDate: fmtDateIndia(new Date()),
            day: String(new Date().getDate()),
            month: new Date().toLocaleString('en-IN', { month: 'long' }),
            year: String(new Date().getFullYear()),
            // Payment plan
            planName: plan.plan_name || '—',
            totalAmount: plan.total_amount_inr ? fmtIndianNumber(parseFloat(plan.total_amount_inr)) : '—',
            // Company identity
            companyName: settings['company_name'] || 'ROF INFRATECH & HOUSING PVT. LTD.',
            // Demand rows & totals
            demandRows: rowsNoInterest,
            demandRowsWithInterest: rowsWithInterest,
            totalDue: fmtIndianNumber(totalDue),
            totalPaid: fmtIndianNumber(totalPaid),
            totalInterest: fmtIndianNumber(0),
            totalInterestCalc: fmtIndianNumber(Math.round(totalInterestCalc)),
            totalPayable: fmtIndianNumber(totalPayable),
            totalPayableWithInterest: fmtIndianNumber(totalPayableWithInterest),
            totalCgst: fmtIndianNumber(totalCgst),
            totalSgst: fmtIndianNumber(totalSgst),
            totalGstAmount: fmtIndianNumber(totalCgst + totalSgst),
            amountInWords: numberToWordsIndian(totalPayable),
            amountInWordsWithInterest: numberToWordsIndian(totalPayableWithInterest),
            totalPayableWords: numberToWordsIndian(totalPayable),
            // Bank / RTGS
            bankCompanyName: settings['bank_company_name'] || '—',
            bankAccountNo: settings['bank_account_no'] || '—',
            bankIfsc: settings['bank_ifsc'] || '—',
            bankName: settings['bank_name'] || '—',
            bankBranch: settings['bank_branch'] || '—',
            // Company identity (GST compliance)
            companyCin: settings['company_cin'] || '—',
            companyAddress: settings['company_address'] || '—',
            companyRegAddr: settings['company_reg_addr'] || '—',
            companyGstin: settings['company_gstin'] || '—',
            placeOfSupply: settings['place_of_supply'] || '—',
            companyPhone: settings['company_phone'] || '—',
            companyWebsite: settings['company_website'] || '—',
            companyEmail: settings['company_email'] || '—',
            // Notes
            demandNote1: settings['demand_note_1'] || '',
            demandNote2: settings['demand_note_2'] || '',
            demandNote3: settings['demand_note_3'] || '',
            demandNote4: settings['demand_note_4'] || '',
            penalRate: penalRate.toFixed(2),
            bookingAmountRaw: String(parseFloat(plan.booking_amount || 0)),
            totalReceivedRaw: String(parseFloat(plan.total_received_inr || 0)),
            bookingPaymentMode: plan.booking_payment_mode || '',
            bookingPaymentRef: plan.booking_payment_ref || '',
            bookingBankName: plan.booking_bank_name || '',
            bookingChequeDate: plan.booking_cheque_date ? fmtDateIndia(plan.booking_cheque_date) : '',
          };

          // Override with per-project company if available
          if (projCompany) {
            if (projCompany.name)              mergeData.companyName        = projCompany.name;
            if (projCompany.cin)               mergeData.companyCin         = projCompany.cin;
            if (projCompany.gstin)             mergeData.companyGstin       = projCompany.gstin;
            if (projCompany.address1)          mergeData.companyAddress     = projCompany.address1;
            if (projCompany.reg_address)       mergeData.companyRegAddr     = projCompany.reg_address;
            if (projCompany.phone)             mergeData.companyPhone       = projCompany.phone;
            if (projCompany.website)           mergeData.companyWebsite     = projCompany.website;
            if (projCompany.email)             mergeData.companyEmail       = projCompany.email;
            if (projCompany.place_of_supply)   mergeData.placeOfSupply      = projCompany.place_of_supply;
            if (projCompany.logo_url)          (mergeData as any).companyLogoUrl = projCompany.logo_url;
            if (projCompany.bank_company_name) mergeData.bankCompanyName    = projCompany.bank_company_name;
            if (projCompany.bank_account_no)   mergeData.bankAccountNo      = projCompany.bank_account_no;
            if (projCompany.bank_ifsc)         mergeData.bankIfsc           = projCompany.bank_ifsc;
            if (projCompany.bank_name)         mergeData.bankName           = projCompany.bank_name;
            if (projCompany.bank_branch)       mergeData.bankBranch         = projCompany.bank_branch;
          }

          // Advance Payment Adjustment section removed — not shown in letter
        }

        // ── ALLOTMENT LETTER ─────────────────────────────────────────────────
        else if (template.document_type === 'allotment_letter') {

          // Fetch global settings
          const settingsRes2 = await db.query(`SELECT key, value FROM global_settings`);
          const s2: Record<string, string> = {};
          settingsRes2.rows.forEach((r: any) => { s2[r.key] = r.value; });

          // Resolve allocationId — use body param or look up latest for this consumer
          let resolvedAllocId = allocationId as string | null;
          if (!resolvedAllocId) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId) {
            return res.status(400).json({ error: 'No allocation found for this consumer' });
          }

          // Main data fetch — allocation as anchor
          const alRes = await db.query(`
            SELECT
              c.first_name, c.last_name,
              COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''),
                       c.name, '—') AS consumer_full_name,
              c.father_name,
              c.nationality,
              c.present_address, c.present_city, c.present_state, c.present_pin,
              c.phone_no AS landline_no,
              c.mobile, c.email,
              c.pan_no, c.aadhaar_no,
              c.registration_no,
              a.id AS allotment_id,
              a.consumer_id,
              a.unit_id,
              a.allotment_date,
              u.unit_number, u.bhk_type,
              u.floor,
              u.carpet_area_sqft,
              u.balcony_area_sqft,
              u.base_price_inr,
              u.total_price_inr,
              COALESCE(t.tower_name, 'N/A') AS tower_name,
              p.name AS project_name,
              p.location AS project_location,
              p.rera_number,
              p.possession_date,
              p.tcp_licence,
              p.id AS project_id,
              COALESCE(br.booking_amount, 0) AS earnest_amount,
              COALESCE(br.payment_mode, 'N/A') AS payment_mode,
              COALESCE(NULLIF(br.payment_ref,''), 'N/A') AS payment_ref,
              br.cheque_date,
              COALESCE(NULLIF(br.bank_name,''), 'N/A') AS booking_bank_name,
              COALESCE(NULLIF(br.bank_branch,''), 'N/A') AS booking_bank_branch,
              COALESCE(NULLIF(br.selected_plan_name,''), 'CLP') AS selected_plan_name
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN LATERAL (
              SELECT * FROM booking_records
              WHERE consumer_id = a.consumer_id AND project_id = a.project_id
              ORDER BY created_at DESC LIMIT 1
            ) br ON true
            WHERE a.id = $1
          `, [resolvedAllocId]);

          const al = alRes.rows[0];
          if (!al) return res.status(404).json({ error: 'Allocation data not found' });

          const projectId2 = al.project_id;
          const planName2  = al.selected_plan_name || 'CLP';

          // Fetch payment plan total — includes PLC and other charges (not base-only like units.total_price_inr)
          const ppRes = await db.query(
            `SELECT total_amount_inr FROM payment_plans
             WHERE consumer_id = $1 AND unit_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [al.consumer_id, al.unit_id]
          );
          const totalPriceInr = parseFloat(
            ppRes.rows[0]?.total_amount_inr || al.total_price_inr || 0
          );

          // Fetch payment plan installments with fallback to first available plan
          let schedRows = await db.query(`
            SELECT installment_index, installment_name,
                   COALESCE(percentage, 0) AS percentage, flat_amount_inr
            FROM plan_schedule_templates
            WHERE project_id = $1 AND plan_name = $2
            ORDER BY installment_index
          `, [projectId2, planName2]);

          // Fallback to first plan if no rows
          if (schedRows.rows.length === 0) {
            const firstPlan = await db.query(
              `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC LIMIT 1`,
              [projectId2]
            );
            const fallbackPlan = firstPlan.rows[0]?.plan_name || 'CLP';
            schedRows = await db.query(`
              SELECT installment_index, installment_name,
                     COALESCE(percentage, 0) AS percentage, flat_amount_inr
              FROM plan_schedule_templates
              WHERE project_id = $1 AND plan_name = $2
              ORDER BY installment_index
            `, [projectId2, fallbackPlan]);
          }

          // Build payment schedule HTML rows — all cells tagged for inline editing
          let paymentScheduleRows = '';
          schedRows.rows.forEach((row: any, idx: number) => {
            const pct = parseFloat(row.percentage || 0);
            const amt = row.flat_amount_inr
              ? parseFloat(row.flat_amount_inr)
              : Math.round((pct / 100) * totalPriceInr);
            paymentScheduleRows += `<tr>
              <td class="tc">${idx + 1}</td>
              <td><span data-field-key="scheduleInstallmentName_${idx}" data-field-label="Schedule Installment (Row ${idx})" data-value-type="text" data-section="payment_schedule">${row.installment_name || 'Installment'}</span></td>
              <td class="tc"><span data-field-key="schedulePercentage_${idx}" data-field-label="Schedule Percentage (Row ${idx})" data-value-type="percentage" data-section="payment_schedule">${pct.toFixed(2)}</span>%</td>
              <td class="tr">&#8377; <span data-field-key="scheduleAmount_${idx}" data-field-label="Schedule Amount (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(amt)}</span></td>
            </tr>`;
          });

          // Address string
          const addrParts = [al.present_address, al.present_city, al.present_state, al.present_pin]
            .filter(Boolean).join(', ');
          const consumerAddress = addrParts || 'N/A';

          // Rate per sqft
          const carpetSqft2 = parseFloat(al.carpet_area_sqft || 0);
          const ratePerSqft2 = carpetSqft2 > 0
            ? fmtIndianNumber(Math.round(totalPriceInr / carpetSqft2))
            : 'N/A';

          mergeData = {
            // Company
            companyName:    s2['company_name']    || 'ROF INFRATECH & HOUSING PVT. LTD.',
            companyAddress: s2['company_address']  || '—',
            companyPhone:   s2['company_phone']    || '—',
            companyEmail:   s2['company_email']    || '—',
            // Bank
            bankCompanyName: s2['bank_company_name'] || s2['company_name'] || '—',
            bankAccountNo:   s2['bank_account_no']   || '—',
            bankIfsc:        s2['bank_ifsc']          || '—',
            bankName:        s2['bank_name']          || '—',
            bankBranch:      s2['bank_branch']        || '—',
            // Dates
            letterDate:    fmtDateIndia(new Date()),
            // Consumer
            consumerFullName: al.consumer_full_name || '—',
            consumerAddress:  consumerAddress,
            consumerMobile:   al.mobile     || 'N/A',
            consumerEmail:    al.email      || 'N/A',
            registrationNo:   al.registration_no || '—',
            bookingDate:      fmtDateIndia(al.allotment_date),
            fatherName:       al.father_name || 'N/A',
            nationality:      al.nationality || 'N/A',
            pinCode:          al.present_pin || 'N/A',
            landlineNo:       al.landline_no || 'N/A',
            panNo:            al.pan_no      || 'N/A',
            aadhaarNo:        al.aadhaar_no  || 'N/A',
            // Project
            projectName:             al.project_name      || '—',
            projectLocation:         al.project_location  || 'N/A',
            hareraNo:                al.rera_number       || 'N/A',
            hareraDate:              'N/A',
            natureOfProject:         'N/A',
            proposedCompletionDate:  'N/A',
            proposedPossessionDate:  al.possession_date ? fmtDateIndia(al.possession_date) : 'N/A',
            licenseNo:               al.tcp_licence || 'N/A',
            licenseeName:            'N/A',
            collaboratorName:        'N/A',
            licenseMemoNo:           'N/A',
            licenseDate:             'N/A',
            licenseValidUpto:        'N/A',
            buildingPlanMemoNo:      'N/A',
            buildingPlanDate:        'N/A',
            buildingPlanValidUpto:   'N/A',
            envClearanceFileNo:      'N/A',
            envClearanceDate:        'N/A',
            // Unit
            unitNumber:       al.unit_number || '—',
            bhkType:          al.bhk_type    || 'N/A',
            carpetArea:       carpetSqft2 > 0 ? parseFloat(al.carpet_area_sqft).toFixed(3) : 'N/A',
            balconyArea:      al.balcony_area_sqft ? parseFloat(al.balcony_area_sqft).toFixed(3) : 'N/A',
            towerName:        al.tower_name  || 'N/A',
            floorNo:          ordinalFloor(al.floor),
            ratePerSqft:      ratePerSqft2,
            totalConsideration: fmtIndianNumber(totalPriceInr),
            // Booking / Earnest money
            earnestAmount:       fmtIndianNumber(parseFloat(al.earnest_amount || 0)),
            paymentRef:          al.payment_ref        || 'N/A',
            chequeDate:          al.cheque_date ? fmtDateIndia(al.cheque_date) : 'N/A',
            bookingBankName:     al.booking_bank_name  || 'N/A',
            bookingBankBranch:   al.booking_bank_branch|| 'N/A',
            // Payment plan
            selectedPlanName:    planName2,
            paymentScheduleRows: paymentScheduleRows,
          };

          // Override with per-project company for allotment letter
          const alCompanyRes = await db.query(`
            SELECT c.name, c.cin, c.gstin, c.address1, c.reg_address,
                   c.phone, c.website, c.email, c.place_of_supply, c.logo_url,
                   c.bank_company_name, c.bank_account_no, c.bank_ifsc,
                   c.bank_name, c.bank_branch
            FROM companies c
            JOIN projects p ON p.company_id = c.id
            JOIN allocations al2 ON al2.unit_id IN (
              SELECT id FROM units WHERE project_id = p.id
            )
            WHERE al2.id = $1 LIMIT 1`, [resolvedAllocId]);
          const alCompany = alCompanyRes.rows[0] || null;
          if (alCompany) {
            if (alCompany.name)              mergeData.companyName        = alCompany.name;
            if (alCompany.address1)          mergeData.companyAddress     = alCompany.address1;
            if (alCompany.phone)             mergeData.companyPhone       = alCompany.phone;
            if (alCompany.email)             mergeData.companyEmail       = alCompany.email;
            if (alCompany.bank_company_name) mergeData.bankCompanyName    = alCompany.bank_company_name;
            if (alCompany.bank_account_no)   mergeData.bankAccountNo      = alCompany.bank_account_no;
            if (alCompany.bank_ifsc)         mergeData.bankIfsc           = alCompany.bank_ifsc;
            if (alCompany.bank_name)         mergeData.bankName           = alCompany.bank_name;
            if (alCompany.bank_branch)       mergeData.bankBranch         = alCompany.bank_branch;
          }

          // Override htmlContent with the file-based template
          try {
            const fsM = await import('fs');
            const pathM = await import('path');
            const currentDir = __dirname;
            const templatePath2 = pathM.resolve(currentDir, '../db/allotment_letter_template.html');
            if (fsM.existsSync(templatePath2)) {
              htmlContent = fsM.readFileSync(templatePath2, 'utf8');
            }
          } catch (_e) { /* fallback to DB stub template */ }
        }

        // ── BUYER BUILDER AGREEMENT (ATS) ─────────────────────────────────────
        else if (template.document_type === 'buyer_builder_agreement') {
          const settingsRes3 = await db.query(`SELECT key, value FROM global_settings`);
          const s3: Record<string, string> = {};
          settingsRes3.rows.forEach((r: any) => { s3[r.key] = r.value; });

          // Resolve allocationId
          let resolvedAllocId3 = allocationId as string | null;
          if (!resolvedAllocId3) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId3 = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId3) {
            return res.status(400).json({ error: 'No allocation found for this consumer' });
          }


          // Main data fetch
          const atsRes = await db.query(`
            SELECT
              c.first_name, c.last_name, c.father_name, c.age, c.pan_no, c.aadhaar_number,
              c.present_address, c.mobile, c.email,
              a.id AS allotment_id, a.agreement_date,
              u.unit_number, u.bhk_type, u.floor, u.carpet_area_sqft, u.balcony_area_sqft, u.base_price_inr, u.total_price_inr,
              t.tower_name,
              p.name AS project_name, p.location, p.rera_number, p.tcp_licence as license_no, p.license_date,
              p.env_clearance_no, p.env_clearance_date, p.building_plan_memo_no, p.building_plan_date,
              p.land_owner_name, p.land_owner_llpin, p.land_owner_pan, p.land_owner_address,
              p.land_owner_gpa_vasika_no, p.land_owner_gpa_date, p.sale_deed_no, p.sale_deed_date,
              p.collaboration_agreement_date, p.khasra_details, p.village_name, p.sector_name, p.sub_registrar_office,
              p.authorised_signatory_name, p.authorised_signatory_aadhaar, p.board_resolution_date,
              p.id AS project_id, c.id AS consumer_id,
              br.booking_amount, br.selected_plan_name,
              co.name AS company_name, co.cin, co.address1 AS promoter_address, co.pan_no AS company_pan
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN booking_records br ON br.consumer_id = a.consumer_id AND br.project_id = a.project_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE a.id = $1
          `, [resolvedAllocId3]);

          const ats = atsRes.rows[0];
          if (!ats) return res.status(404).json({ error: 'Allocation data not found' });

          const projectId3 = ats.project_id;
          const planName3 = ats.selected_plan_name || 'CLP';

          // Fetch payment plan schedule
          let schedRes3 = await db.query(`
            SELECT installment_index, installment_name, COALESCE(percentage, 0) AS percentage, flat_amount_inr
            FROM plan_schedule_templates
            WHERE project_id = $1 AND plan_name = $2
            ORDER BY installment_index
          `, [projectId3, planName3]);

          if (schedRes3.rows.length === 0) {
            const firstPlan3 = await db.query(
              `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC LIMIT 1`,
              [projectId3]
            );
            const fallbackPlan3 = firstPlan3.rows[0]?.plan_name || 'CLP';
            schedRes3 = await db.query(`
              SELECT installment_index, installment_name, COALESCE(percentage, 0) AS percentage, flat_amount_inr
              FROM plan_schedule_templates
              WHERE project_id = $1 AND plan_name = $2
              ORDER BY installment_index
            `, [projectId3, fallbackPlan3]);
          }

          const totalPrice3 = parseFloat(ats.total_price_inr || 0);
          let paymentPlanRows = '';
          schedRes3.rows.forEach((row: any, idx: number) => {
            const pct = parseFloat(row.percentage || 0);
            const amt = row.flat_amount_inr
              ? parseFloat(row.flat_amount_inr)
              : Math.round((pct / 100) * totalPrice3);
            paymentPlanRows += `<tr>
              <td>${idx + 1}</td>
              <td>${row.installment_name || 'Installment'}</td>
              <td>${pct.toFixed(2)}%</td>
              <td>₹ ${fmtIndianNumber(amt)}</td>
            </tr>`;
          });

          const carpetSqft3 = parseFloat(ats.carpet_area_sqft || 0);
          const balconySqft3 = parseFloat(ats.balcony_area_sqft || 0);
          const basicPrice3 = parseFloat(ats.base_price_inr || 0);
          const basicRate3 = carpetSqft3 > 0 ? Math.round(basicPrice3 / carpetSqft3) : 0;
          const balconyRate3 = balconySqft3 > 0 ? Math.round((totalPrice3 - basicPrice3) / balconySqft3) : 0;
          const balconyPrice3 = totalPrice3 - basicPrice3;
          const bookingPct3 = (parseFloat(ats.booking_amount || 0) / totalPrice3 * 100).toFixed(2);

          mergeData = {
            allottee_name: `${ats.first_name || ''} ${ats.last_name || ''}`.trim() || '—',
            allottee_relation: 'S/o',
            allottee_relative_name: ats.father_name || '—',
            allottee_address: ats.present_address || '—',
            allottee_age: ats.age ? String(ats.age) : '—',
            allottee_aadhaar: ats.aadhaar_number || '—',
            allottee_pan: ats.pan_no || '—',
            promoter_name: ats.company_name || '—',
            promoter_cin: ats.cin || '—',
            promoter_pan: ats.company_pan || '—',
            promoter_address: ats.promoter_address || '—',
            project_name: (ats.project_name || '—').replace(/_TEST$/i, '').trim() || '—',
            harera_reg_no: ats.rera_number || '—',
            license_no: ats.license_no || '—',
            license_date: fmtDateIndia(ats.license_date),
            village_name: ats.village_name || '—',
            sector_name: ats.sector_name || '—',
            district_name: ats.location || '—',
            env_clearance_no: ats.env_clearance_no || '—',
            env_clearance_date: fmtDateIndia(ats.env_clearance_date),
            building_plan_memo_no: ats.building_plan_memo_no || '—',
            building_plan_date: fmtDateIndia(ats.building_plan_date),
            land_owner_name: ats.land_owner_name || '—',
            land_owner_llpin: ats.land_owner_llpin || '—',
            land_owner_pan: ats.land_owner_pan || '—',
            land_owner_address: ats.land_owner_address || '—',
            land_owner_gpa_vasika_no: ats.land_owner_gpa_vasika_no || '—',
            land_owner_gpa_date: fmtDateIndia(ats.land_owner_gpa_date),
            sale_deed_no: ats.sale_deed_no || '—',
            sale_deed_date: fmtDateIndia(ats.sale_deed_date),
            collab_agreement_date: fmtDateIndia(ats.collaboration_agreement_date),
            flat_no: ats.unit_number || '—',
            tower_name: ats.tower_name || '—',
            floor_no: ordinalFloor(ats.floor),
            unit_type: ats.bhk_type || '—',
            carpet_area: carpetSqft3 > 0 ? carpetSqft3.toFixed(3) : '___',
            carpet_area_raw: carpetSqft3 > 0 ? carpetSqft3.toFixed(3) : '0',
            balcony_area: balconySqft3 > 0 ? balconySqft3.toFixed(3) : '___',
            balcony_area_raw: balconySqft3 > 0 ? balconySqft3.toFixed(3) : '0',
            parking_no: '—',
            total_price: fmtIndianNumber(totalPrice3),
            total_price_words: numberToWordsIndian(totalPrice3),
            basic_price: fmtIndianNumber(basicPrice3),
            balcony_price: fmtIndianNumber(balconyPrice3),
            rate_per_sqft: fmtIndianNumber(basicRate3),
            balcony_rate: fmtIndianNumber(balconyRate3),
            booking_amount: fmtIndianNumber(parseFloat(ats.booking_amount || 0)),
            booking_amount_words: numberToWordsIndian(parseFloat(ats.booking_amount || 0)),
            booking_amount_pct: bookingPct3,
            application_no: ats.consumer_id?.slice(0, 8).toUpperCase() || '—',
            agreement_date: fmtDateIndia(ats.agreement_date || new Date()),
            agreement_day: new Date(ats.agreement_date || new Date()).getDate().toString(),
            agreement_month: new Date(ats.agreement_date || new Date()).toLocaleString('en-IN', { month: 'long' }),
            agreement_year: new Date(ats.agreement_date || new Date()).getFullYear().toString(),
            auth_signatory_name: ats.authorised_signatory_name || '—',
            board_resolution_date: fmtDateIndia(ats.board_resolution_date),
            payment_plan_rows: paymentPlanRows,
            sub_registrar_office: ats.sub_registrar_office || '—',
            khasra_details: ats.khasra_details || '—',
          };
        }

        // ── CONVEYANCE DEED ──────────────────────────────────────────────────
        else if (template.document_type === 'conveyance_deed') {
          const settingsRes4 = await db.query(`SELECT key, value FROM global_settings`);
          const s4: Record<string, string> = {};
          settingsRes4.rows.forEach((r: any) => { s4[r.key] = r.value; });

          // Resolve allocationId
          let resolvedAllocId4 = allocationId as string | null;
          if (!resolvedAllocId4) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId4 = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId4) {
            return res.status(400).json({ error: 'No allocation found for this consumer' });
          }

          // Main data fetch
          const cdRes = await db.query(`
            SELECT
              c.first_name, c.last_name, c.father_name, c.pan_no, c.aadhaar_number,
              c.present_address,
              a.id AS allotment_id, a.allotment_date, a.conveyance_deed_date,
              u.unit_number, u.floor, u.carpet_area_sqft, u.balcony_area_sqft, u.total_price_inr,
              t.tower_name,
              p.name AS project_name, p.location, p.rera_number, p.tcp_licence as license_no,
              p.env_clearance_no, p.building_plan_memo_no,
              p.land_owner_name, p.land_owner_llpin, p.land_owner_pan, p.land_owner_address,
              p.land_owner_gpa_vasika_no, p.land_owner_gpa_date, p.sale_deed_no, p.sale_deed_date,
              p.collaboration_agreement_date, p.khasra_details, p.village_name, p.sector_name,
              p.occupation_cert_memo_no, p.occupation_cert_date,
              p.deed_of_declaration_vasika_no, p.deed_of_declaration_date,
              p.sub_registrar_office, p.authorised_signatory_name, p.authorised_signatory_aadhaar,
              p.board_resolution_date, p.id AS project_id, c.id AS consumer_id,
              co.name AS company_name, co.cin, co.address1 AS promoter_address, co.pan_no AS company_pan
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE a.id = $1
          `, [resolvedAllocId4]);

          const cd = cdRes.rows[0];
          if (!cd) return res.status(404).json({ error: 'Allocation data not found' });

          const deedDate = cd.conveyance_deed_date ? new Date(cd.conveyance_deed_date) : new Date();
          const deedDay = String(deedDate.getDate());
          const deedMonthNum = deedDate.getMonth();
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const deedMonth = monthNames[deedMonthNum];
          const deedYear = String(deedDate.getFullYear());

          const consideration = parseFloat(cd.total_price_inr || 0);

          mergeData = {
            vendee_name: `${cd.first_name || ''} ${cd.last_name || ''}`.trim() || '—',
            vendee_relation: 'S/o',
            vendee_relative_name: cd.father_name || '—',
            vendee_address: cd.present_address || '—',
            vendee_aadhaar: cd.aadhaar_number || '—',
            vendee_pan: cd.pan_no || '—',
            property_no: cd.unit_number || '—',
            tower_name: cd.tower_name || '—',
            floor_no: ordinalFloor(cd.floor),
            carpet_area: (() => { const val = parseFloat(cd.carpet_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '___'; })(),
            carpet_area_raw: (() => { const val = parseFloat(cd.carpet_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '0'; })(),
            balcony_area: (() => { const val = parseFloat(cd.balcony_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '___'; })(),
            balcony_area_raw: (() => { const val = parseFloat(cd.balcony_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '0'; })(),
            parking_no: '—',
            allotment_letter_date: fmtDateIndia(cd.allotment_date),
            consideration: fmtIndianNumber(consideration),
            consideration_words: numberToWordsIndian(consideration),
            stamp_duty: '—',
            e_stamp_no: '—',
            project_name: (cd.project_name || '—').replace(/_TEST$/i, '').trim() || '—',
            license_no: cd.license_no || '—',
            harera_reg_no: cd.rera_number || '—',
            village_name: cd.village_name || '—',
            sector_name: cd.sector_name || '—',
            khasra_details: cd.khasra_details || '—',
            sale_deed_no: cd.sale_deed_no || '—',
            sale_deed_date: fmtDateIndia(cd.sale_deed_date),
            collab_agreement_date: fmtDateIndia(cd.collaboration_agreement_date),
            oc_memo_no: cd.occupation_cert_memo_no || '—',
            oc_date: fmtDateIndia(cd.occupation_cert_date),
            deed_of_declaration_vasika_no: cd.deed_of_declaration_vasika_no || '—',
            deed_of_declaration_date: fmtDateIndia(cd.deed_of_declaration_date),
            deed_day: deedDay,
            deed_month: deedMonth,
            deed_year: deedYear,
            auth_signatory_name: cd.authorised_signatory_name || '—',
            auth_signatory_aadhaar: cd.authorised_signatory_aadhaar || '—',
            board_resolution_date: fmtDateIndia(cd.board_resolution_date),
            promoter_name: cd.company_name || '—',
            promoter_cin: cd.cin || '—',
            promoter_address: cd.promoter_address || '—',
            promoter_pan: cd.company_pan || '—',
            land_owner_name: cd.land_owner_name || '—',
            land_owner_llpin: cd.land_owner_llpin || '—',
            land_owner_pan: cd.land_owner_pan || '—',
            land_owner_address: cd.land_owner_address || '—',
            land_owner_gpa_vasika_no: cd.land_owner_gpa_vasika_no || '—',
            land_owner_gpa_date: fmtDateIndia(cd.land_owner_gpa_date),
            sub_registrar_office: cd.sub_registrar_office || '—',
          };
        }
      }
    }

    // 3. Perform Merge — wrap editable fields with data-field-key spans
    // so the edit engine can locate and patch them by key.
    // Map key → data-value-type so each field renders the right input widget.
    const EDITABLE_TEXT_FIELDS = new Map<string, string>([
      // Core consumer / identity
      ['consumerName',       'text'],  ['consumerFullName',  'text'],
      ['fatherName',         'text'],  ['coApplicants',      'text'],
      ['mobile',             'text'],  ['email',             'text'],
      ['address',            'text'],  ['consumerAddress',   'text'],
      ['consumerMobile',     'text'],  ['consumerEmail',     'text'],
      ['customerId',         'text'],  ['registrationNo',    'text'],
      // Unit / project
      ['unitNumber',         'text'],  ['bhkType',           'text'],
      ['towerName',          'text'],  ['floorNo',           'text'],
      ['projectName',        'text'],  ['projectSector',     'text'],
      ['projectLocation',    'text'],  ['reraNo',            'text'],
      // Dates
      ['allotmentDate',      'date'],  ['bookingDate',       'date'],
      ['dueDate',            'date'],  ['invoiceDate',       'date'],
      ['proposedPossessionDate', 'date'],
      // Financials
      ['earnestAmount',      'currency'], ['totalConsideration', 'currency'],
      ['totalAmount',        'currency'], ['totalPayable',        'currency'],
      ['ratePerSqft',        'currency'],
      // Plan / rates
      ['planName',           'text'],  ['penalRate',         'text'],
      // Demand letter totals
      ['totalDue',           'currency'], ['totalPaid',      'currency'],
      ['amountInWords',      'text'],
      // Allotment letter — consumer KYC
      ['nationality',        'text'],  ['pinCode',           'text'],
      ['panNo',              'text'],  ['aadhaarNo',         'text'],
      ['landlineNo',         'text'],  ['carpetArea',        'text'],
      ['balconyArea',        'text'],
      // Allotment letter — booking payment
      ['paymentRef',         'text'],  ['chequeDate',        'date'],
      ['bookingBankName',    'text'],  ['bookingBankBranch', 'text'],
      // Allotment letter — project legal / regulatory
      ['hareraNo',           'text'],  ['hareraDate',        'date'],
      ['proposedCompletionDate', 'date'],
      ['licenseNo',          'text'],  ['licenseDate',       'date'],
      ['licenseValidUpto',   'date'],  ['buildingPlanMemoNo','text'],
      ['buildingPlanDate',   'date'],  ['envClearanceFileNo','text'],
      ['envClearanceDate',   'date'],
      // Allotment letter — document metadata / plan
      ['letterDate',         'date'],  ['selectedPlanName',  'text'],
      // Agreement for Sale (ATS) — allottee/buyer info
      ['allottee_name',      'text'],  ['allottee_address',  'text'],
      ['allottee_aadhaar',   'text'],  ['allottee_pan',      'text'],
      ['allottee_age',       'text'],  ['allottee_relative_name', 'text'],
      ['allottee_relation',  'text'],
      // Agreement for Sale — unit/property details
      ['flat_no',            'text'],  ['tower_name',        'text'],
      ['floor_no',           'text'],  ['unit_type',         'text'],
      ['carpet_area',        'currency'], ['balcony_area',   'currency'],
      ['parking_no',         'text'],
      // Agreement for Sale — financial/pricing
      ['total_price',        'currency'], ['booking_amount', 'currency'],
      // Agreement for Sale — project info
      ['project_name',       'text'],  ['promoter_name',     'text'],
      ['promoter_cin',       'text'],  ['promoter_pan',      'text'],
      ['promoter_address',   'text'],
      ['harera_reg_no',      'text'],  ['license_no',        'text'],
      ['village_name',       'text'],  ['sector_name',       'text'],
      ['land_owner_name',    'text'],  ['land_owner_llpin',  'text'],
      ['land_owner_pan',     'text'],
      // Agreement for Sale — dates
      ['agreement_date',     'date'],  ['agreement_day',     'text'],
      ['agreement_month',    'text'],  ['agreement_year',    'text'],
      // Conveyance Deed — vendee/buyer info
      ['vendee_name',        'text'],  ['vendee_address',    'text'],
      ['vendee_aadhaar',     'text'],  ['vendee_pan',        'text'],
      ['vendee_relative_name', 'text'], ['vendee_relation', 'text'],
      // Conveyance Deed — property details
      ['property_no',        'text'],  ['consideration',     'currency'],
      // Conveyance Deed — stamp and registration
      ['stamp_duty',         'currency'], ['e_stamp_no',     'text'],
      // Conveyance Deed — dates
      ['conveyance_deed_date', 'date'], ['deed_day',        'text'],
      ['deed_month',         'text'],  ['deed_year',         'text'],
    ]);
    if (mergeData) {
      const NO_WRAP_FIELDS = ['payment_plan_rows'];
      for (const [key, value] of Object.entries(mergeData)) {
        const strVal = String(value ?? '');
        if (NO_WRAP_FIELDS.includes(key)) {
          htmlContent = htmlContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => strVal);
        } else {
          const vtype = EDITABLE_TEXT_FIELDS.get(key);
          const wrapped = vtype !== undefined
            ? `<span class="doc-field" data-field-key="${key}" data-value-type="${vtype}">${strVal}</span>`
            : `<span class="doc-field" data-field-key="${key}">${strVal}</span>`;
          htmlContent = htmlContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => wrapped);
        }
      }
    }

    // 3b. Post-process demand letters: inject dual-table (without / with interest)
    if (template.document_type === 'demand_letter' && mergeData) {
      const md = mergeData as Record<string, string>;


      // Build the complete 12-column with-interest table
      const withInterestTableHtml = `<div id="table-with-interest" style="display:none">
  <table class="demand-table">
    <thead>
      <tr>
        <th style="width:28px">S.No.</th>
        <th>Installment Description</th>
        <th style="width:68px">Due Date</th>
        <th style="width:72px">Basic Amt (&#8377;)</th>
        <th style="width:42px">CGST %</th>
        <th style="width:62px">CGST (&#8377;)</th>
        <th style="width:42px">SGST %</th>
        <th style="width:62px">SGST (&#8377;)</th>
        <th style="width:72px;color:#c00;font-weight:bold">Interest (&#8377;)</th>
        <th style="width:72px">Total Due (&#8377;)</th>
        <th style="width:68px">Paid (&#8377;)</th>
        <th style="width:72px">Payable (&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      ${md.demandRowsWithInterest || ''}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="tr bold">TOTAL</td>
        <td class="tr bold">&#8212;</td>
        <td class="tc bold">&#8212;</td>
        <td class="tr bold"><span data-field-key="totalCgst" data-field-label="Total CGST" data-value-type="currency" data-section="summary">${md.totalCgst}</span></td>
        <td class="tc bold">&#8212;</td>
        <td class="tr bold"><span data-field-key="totalSgst" data-field-label="Total SGST" data-value-type="currency" data-section="summary">${md.totalSgst}</span></td>
        <td class="tr bold" style="color:#c00"><span data-field-key="totalInterestCalc" data-field-label="Total Penal Interest" data-value-type="currency" data-section="interest_table">${md.totalInterestCalc}</span></td>
        <td class="tr bold"><span data-field-key="totalDueWI" data-field-label="Total Amount Due" data-value-type="currency" data-section="summary">${md.totalDue}</span></td>
        <td class="tr bold"><span data-field-key="totalPaidWI" data-field-label="Total Amount Paid" data-value-type="currency" data-section="summary">${md.totalPaid}</span></td>
        <td class="tr bold"><span data-field-key="totalPayableWithInterest" data-field-label="Net Amount Payable (with Interest)" data-value-type="currency" data-section="summary">${md.totalPayableWithInterest}</span></td>
      </tr>
    </tfoot>
  </table>
</div>`;

      // Wrap the existing demand-table in no-interest div; prepend received section
      const tableStart = htmlContent.indexOf('<table class="demand-table">');
      if (tableStart !== -1) {
        const tableEnd = htmlContent.indexOf('</table>', tableStart) + '</table>'.length;
        const originalTable = htmlContent.substring(tableStart, tableEnd);
        htmlContent =
          htmlContent.substring(0, tableStart) +
          `<div id="table-no-interest">${originalTable}</div>\n\n${withInterestTableHtml}` +
          htmlContent.substring(tableEnd);
      } else {
      }

      // Wrap amt-words in dual divs for no-interest / with-interest amounts in words
      const amtWordsStart = htmlContent.indexOf('<div class="amt-words">');
      if (amtWordsStart !== -1) {
        const amtWordsEnd = htmlContent.indexOf('</div>', amtWordsStart) + '</div>'.length;
        const originalAmtWords = htmlContent.substring(amtWordsStart, amtWordsEnd);
        const withInterestAmtWords =
          `<div class="amt-words" style="border-color:#c00">` +
          `<strong>Amount Payable in Words (incl. Interest):</strong> <span data-field-key="amountInWordsWithInterest" data-field-label="Amount in Words (with Interest)" data-value-type="text" data-section="summary">${md.amountInWordsWithInterest || ''}</span></div>`;
        htmlContent =
          htmlContent.substring(0, amtWordsStart) +
          `<div id="para-no-interest">${originalAmtWords}</div>\n  ` +
          `<div id="para-with-interest" style="display:none">${withInterestAmtWords}</div>` +
          htmlContent.substring(amtWordsEnd);
      } else {
      }

      // Advance Payment Adjustment injection removed
    }

    // 4. Save and return (insert WITHOUT toolbar first)
    const result = await db.query(
      `INSERT INTO documents (consumer_id, allocation_id, template_id, document_type, html_content, delivery_method, delivery_status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id`,
      [consumerId, allocationId || null, template.id, template.document_type, htmlContent, deliveryMethod || 'none', req.userId]
    );
    const newDocId = result.rows[0].id;

    // 4.5 Build and inject edit toolbar WITH actual docId (for ATS and Conveyance Deed only)
    console.log(`[TOOLBAR DEBUG] template.document_type = "${template.document_type}"`);
    console.log(`[TOOLBAR DEBUG] Check result: includes buyer_builder_agreement? ${['buyer_builder_agreement', 'conveyance_deed'].includes(template.document_type)}`);

    if (['buyer_builder_agreement', 'conveyance_deed'].includes(template.document_type)) {
      const docTitle = template.document_type === 'buyer_builder_agreement' ? 'AGREEMENT FOR SALE' : 'CONVEYANCE DEED';
      const editToolbar = `
<style>
  body {
    background: #f0f0f0 !important;
    margin: 0 !important;
    padding: 0 0 80px 0 !important;
  }
  .doc-body {
    max-width: 820px;
    margin: 30px auto !important;
    padding: 40px 50px !important;
    background: #ffffff;
    box-shadow: 0 2px 16px rgba(0,0,0,0.18);
    border-radius: 2px;
  }
  #doc-bottom-toolbar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background: #2c2c2c;
    z-index: 9999;
    box-sizing: border-box;
    border-top: 2px solid #444;
  }
  #doc-bottom-toolbar .toolbar-inner {
    padding: 8px 20px 10px;
    display: flex;
    gap: 10px;
    align-items: center;
  }
  #doc-bottom-toolbar .doc-title {
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: bold;
    color: #ffffff;
    letter-spacing: 1px;
    margin-right: 10px;
  }
  #doc-bottom-toolbar button {
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
  }
  .btn-print { background: #17a2b8; color: white; }
  .btn-download { background: #17a2b8; color: white; }
  .btn-edit { background: transparent !important; color: white !important; border: 2px solid #e67e22 !important; }
  .btn-save { background: #27ae60; color: white; display: none; }
  .btn-cancel { background: #e74c3c; color: white; display: none; }
  #edit-status { font-family: Arial, sans-serif; font-size: 11px; color: #a9dfbf; margin-left: auto; }
  .doc-field {
    background: #fff9c4;
    border-bottom: 1.5px solid #f0c040;
    border-radius: 2px;
    padding: 0 3px;
    display: inline;
    transition: all 0.2s;
  }
  .doc-field[contenteditable="true"] {
    background: #ffe082 !important;
    border-bottom: 2px dashed #f39c12 !important;
    outline: none !important;
    cursor: text;
    box-shadow: 0 0 0 2px rgba(243,156,18,0.3);
  }
  @media print {
    #doc-bottom-toolbar { display: none !important; }
    body { background: white !important; padding: 0 !important; }
    .doc-body { box-shadow: none !important; margin: 0 !important; padding: 2cm !important; max-width: 100% !important; }
    .doc-field { background: transparent !important; border: none !important; }
  }
</style>

<div id="doc-bottom-toolbar">
  <div class="toolbar-inner">
    <span class="doc-title">${docTitle}</span>
    <button class="btn-print" onclick="window.print()">🖨️ PRINT</button>
    <button class="btn-download" onclick="downloadDoc()">⬇️ DOWNLOAD PDF</button>
    <button class="btn-edit" id="edit-btn" onclick="enableEditMode()">✏️ Edit Document</button>
    <button class="btn-save" id="save-btn" onclick="saveEdits()">💾 Save Changes</button>
    <button class="btn-cancel" id="cancel-btn" onclick="cancelEdit()">✕ Cancel</button>
    <span id="edit-status"></span>
  </div>
</div>

<script>
const DOC_ID = '${newDocId}';
const TOKEN = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('rof-jwt') || '';

function downloadDoc() {
  const msg = document.createElement('div');
  msg.id = 'pdf-instruction';
  msg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a3c5e;color:white;padding:25px 35px;border-radius:8px;z-index:99999;font-family:Arial,sans-serif;font-size:14px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);max-width:400px;line-height:1.6;';
  msg.innerHTML = '<div style="font-size:18px;margin-bottom:12px;">📄 Save as PDF</div><div>In the print dialog:</div><div style="margin:8px 0;color:#17a2b8;font-weight:bold;">1. Set Destination to "Save as PDF"</div><div style="color:#17a2b8;font-weight:bold;">2. Click Save</div><div style="margin-top:15px;font-size:12px;opacity:0.8;">Click OK to open print dialog</div><button onclick="document.getElementById(\'pdf-instruction\').remove();window.print();" style="margin-top:15px;background:#27ae60;color:white;border:none;padding:8px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">OK, Open Print Dialog</button><button onclick="document.getElementById(\'pdf-instruction\').remove();" style="margin-top:15px;margin-left:10px;background:#e74c3c;color:white;border:none;padding:8px 24px;border-radius:4px;cursor:pointer;font-size:14px;">Cancel</button>';
  document.body.appendChild(msg);
}

const EDITABLE_FIELDS = ['allottee_name','allottee_address','allottee_aadhaar','allottee_pan','allottee_age','allottee_relation','allottee_relative_name','vendee_name','vendee_address','vendee_aadhaar','vendee_pan','vendee_relation','vendee_relative_name','property_no','carpet_area','balcony_area','parking_no','auth_signatory_name','board_resolution_date','stamp_duty','e_stamp_no','allotment_letter_date','flat_no','tower_name','floor_no','unit_type','total_price','booking_amount','agreement_date','agreement_day','agreement_month','agreement_year','deed_day','deed_month','deed_year','project_name','promoter_name','harera_reg_no','license_no','village_name','sector_name'];
let editedFields={},originalValues={};

function enableEditMode(){
  document.getElementById('edit-btn').style.display='none';
  document.querySelector('.btn-print').style.display='none';
  document.querySelector('.btn-download').style.display='none';
  document.getElementById('save-btn').style.display='inline-block';
  document.getElementById('cancel-btn').style.display='inline-block';
  document.getElementById('edit-status').textContent='✏️ Click any highlighted field to edit';
  EDITABLE_FIELDS.forEach(key=>{
    document.querySelectorAll('[data-field-key="'+key+'"]').forEach(el=>{
      originalValues[key]=el.textContent;
      el.contentEditable='true';
      el.style.cssText+='background:#fff9c4!important;border-bottom:2px solid #f39c12!important;outline:none;padding:0 3px;min-width:20px;display:inline-block;';
      el.addEventListener('input',()=>{editedFields[key]=el.textContent;el.style.background='#d5f5e3!important';});
    });
  });
}

function cancelEdit(){
  Object.entries(originalValues).forEach(([k,v])=>{
    document.querySelectorAll('[data-field-key="'+k+'"]').forEach(el=>{
      el.textContent=v;
      el.contentEditable='false';
      el.style.background='';
      el.style.border='';
      el.style.padding='';
    });
  });
  editedFields={};originalValues={};
  document.getElementById('edit-btn').style.display='inline-block';
  document.querySelector('.btn-print').style.display='inline-block';
  document.querySelector('.btn-download').style.display='inline-block';
  document.getElementById('save-btn').style.display='none';
  document.getElementById('cancel-btn').style.display='none';
  document.getElementById('edit-status').textContent='';
}

async function saveEdits(){
  if(!Object.keys(editedFields).length){alert('No changes made.');return;}
  const reason=prompt('Reason for edit (required):');
  if(!reason||!reason.trim()){alert('Reason is required.');return;}
  const btn=document.getElementById('save-btn');
  btn.textContent='Saving...';btn.disabled=true;
  try{
    const edits=Object.entries(editedFields).map(([fieldKey,newValue])=>({fieldKey,newValue,originalValue:originalValues[fieldKey]||'',fieldLabel:fieldKey.replace(/_/g,' ')}));
    const r=await fetch('/api/documents/'+DOC_ID+'/edit',{method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+TOKEN},body:JSON.stringify({edits,editReason:reason})});
    if(!r.ok)throw new Error(await r.text());
    document.getElementById('edit-status').textContent='✅ Saved!';
    Object.keys(originalValues).forEach(k=>{document.querySelectorAll('[data-field-key="'+k+'"]').forEach(el=>{el.contentEditable='false';el.style.background='';el.style.border='';});});
    editedFields={};originalValues={};
    document.getElementById('edit-btn').style.display='inline-block';
    document.querySelector('.btn-print').style.display='inline-block';
    document.querySelector('.btn-download').style.display='inline-block';
    document.getElementById('save-btn').style.display='none';
    document.getElementById('cancel-btn').style.display='none';
    btn.textContent='💾 Save Changes';btn.disabled=false;
  }catch(e){alert('Error: '+e.message);btn.textContent='💾 Save Changes';btn.disabled=false;}
}
</script>`;

      // Update document with toolbar appended (before </body>)
      const finalHtml = htmlContent.replace('</body>', editToolbar + '\n</body>');
      await db.query(
        `UPDATE documents SET html_content = $1 WHERE id = $2`,
        [finalHtml, newDocId]
      );

      // Save original version snapshot with toolbar (appended before </body>)
      const versionHtml = htmlContent.replace('</body>', editToolbar + '\n</body>');
      await db.query(
        `INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
         VALUES ($1, 1, $2, $3, 'Original generation', '[]'::jsonb, TRUE)`,
        [newDocId, versionHtml, req.userId]
      );
    } else {
      // Save original version snapshot for non-edit-toolbar documents
      await db.query(
        `INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
         VALUES ($1, 1, $2, $3, 'Original generation', '[]'::jsonb, TRUE)`,
        [newDocId, htmlContent, req.userId]
      );
    }

    res.status(201).json({ success: true, data: { documentId: newDocId } });
  } catch (error) {
    const err = error as any;
    console.error('[DOCUMENT GENERATION ERROR]', err?.message || 'Unknown error');
    next(error);
  }
});

// NOTE: To generate a demand letter with ALL installments (no status filter),
// call POST /api/documents/generate with { consumerId, documentType:'demand_letter', includeAllDemands:true, dueDate:today }

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

// GET /api/documents/edits-report - Audit trail of all document field edits
router.get('/edits-report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      fromDate,
      toDate,
      documentType,
      editedBy,
      consumerId,
      page = '1',
      pageSize = '50',
    } = req.query as Record<string, string>;

    const pg   = Math.max(1, parseInt(page)     || 1);
    const ps   = Math.min(200, parseInt(pageSize) || 50);
    const offset = (pg - 1) * ps;

    const params: unknown[] = [
      fromDate    || null,
      toDate      || null,
      documentType || null,
      consumerId  || null,
      editedBy    || null,
    ];

    const whereClause = `
      WHERE 1=1
        AND ($1::date IS NULL OR dfo.edited_at >= $1::date)
        AND ($2::date IS NULL OR dfo.edited_at <  ($2::date + INTERVAL '1 day'))
        AND ($3::text IS NULL OR d.document_type = $3)
        AND ($4::uuid IS NULL OR d.consumer_id   = $4::uuid)
        AND ($5::text IS NULL OR u.name ILIKE '%' || $5 || '%')
    `;

    const baseQuery = `
      FROM document_field_overrides dfo
      JOIN documents d ON d.id = dfo.document_id
      LEFT JOIN consumers c ON c.id = d.consumer_id
      LEFT JOIN users u ON u.id = dfo.edited_by_user_id
      LEFT JOIN LATERAL (
        SELECT dv.version_number, dv.fields_changed
        FROM document_versions dv
        WHERE dv.document_id = dfo.document_id
          AND dv.is_original = FALSE
          AND dv.created_at >= dfo.edited_at - INTERVAL '5 seconds'
          AND dv.created_at <= dfo.edited_at + INTERVAL '5 seconds'
        ORDER BY dv.created_at DESC
        LIMIT 1
      ) dv ON TRUE
      ${whereClause}
    `;

    const [countRes, dataRes] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total ${baseQuery}`, params),
      db.query(
        `SELECT
          dfo.id                AS override_id,
          dfo.document_id,
          dfo.field_key,
          dfo.field_label,
          dfo.section,
          dfo.original_value,
          dfo.current_value,
          dfo.value_type,
          dfo.edit_reason,
          dfo.edited_at,
          dfo.is_active,
          d.document_type,
          d.version_number      AS current_version,
          d.reference_id,
          d.consumer_id,
          COALESCE(c.first_name || ' ' || c.last_name, 'N/A') AS consumer_name,
          c.registration_no,
          u.name                AS edited_by_name,
          u.email               AS edited_by_email,
          dv.version_number     AS edit_version,
          dv.fields_changed
        ${baseQuery}
        ORDER BY dfo.edited_at DESC
        LIMIT $6 OFFSET $7`,
        [...params, ps, offset]
      ),
    ]);

    const total      = parseInt(countRes.rows[0].total) || 0;
    const totalPages = Math.ceil(total / ps);

    res.json({
      success: true,
      edits:      dataRes.rows,
      total,
      page:       pg,
      pageSize:   ps,
      totalPages,
    });
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


// GET /api/documents/:id/overrides — List all active field overrides for a document
router.get('/:id/overrides', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT dfo.id, dfo.field_key, dfo.field_label, dfo.section,
              dfo.original_value, dfo.current_value, dfo.value_type,
              dfo.edit_reason, dfo.edited_at, dfo.is_active,
              u.name AS edited_by_name
       FROM document_field_overrides dfo
       LEFT JOIN users u ON u.id = dfo.edited_by_user_id
       WHERE dfo.document_id = $1 AND dfo.is_active = TRUE
       ORDER BY dfo.edited_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, overrides: result.rows });
  } catch (err) { next(err); }
});

// GET /api/documents/:id/versions — Version history for a document
router.get('/:id/versions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT dv.id, dv.version_number, dv.edit_reason, dv.fields_changed,
              dv.is_original, dv.created_at, u.name AS created_by_name
       FROM document_versions dv
       LEFT JOIN users u ON u.id = dv.created_by_user_id
       WHERE dv.document_id = $1
       ORDER BY dv.version_number DESC`,
      [req.params.id]
    );
    res.json({ success: true, versions: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/documents/:id/edit — Apply field overrides and save new version
router.patch('/:id/edit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const docId = req.params.id;
    const { fields, edit_reason } = req.body;
    const userId = req.userId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    // Step 1: Validate
    if (!edit_reason?.trim()) {
      return res.status(400).json({ error: 'edit_reason is required' });
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'fields array is required and must be non-empty' });
    }

    // Step 2: Get current document
    const docResult = await db.query(
      `SELECT id, document_type, html_content, original_html_content, version_number, is_edited,
              consumer_id, reference_id, allocation_id
       FROM documents WHERE id = $1 AND deleted_at IS NULL`,
      [docId]
    );
    if (!docResult.rows[0]) return res.status(404).json({ error: 'Document not found' });
    const doc = docResult.rows[0];
    const currentHtml: string = doc.html_content || '';
    const currentVersion: number = doc.version_number || 1;

    // Step 3: Snapshot original HTML on first edit
    if (!doc.is_edited && !doc.original_html_content) {
      await db.query(
        `UPDATE documents SET original_html_content = html_content WHERE id = $1`,
        [docId]
      );
    }

    // Step 4: Upsert field overrides
    const fieldsChanged: any[] = [];
    for (const field of fields) {
      const { field_key, field_label, section, new_value, value_type } = field;

      // Preserve original_value from first override or extract from current HTML
      const existingRes = await db.query(
        `SELECT original_value FROM document_field_overrides WHERE document_id = $1 AND field_key = $2`,
        [docId, field_key]
      );
      const originalValue = existingRes.rows[0]?.original_value
        ?? extractFieldValue(currentHtml, field_key)
        ?? '';

      await db.query(
        `INSERT INTO document_field_overrides
           (document_id, field_key, field_label, section, original_value, current_value, value_type, edit_reason, edited_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (document_id, field_key) DO UPDATE SET
           current_value      = EXCLUDED.current_value,
           field_label        = COALESCE(EXCLUDED.field_label, document_field_overrides.field_label),
           edit_reason        = EXCLUDED.edit_reason,
           edited_by_user_id  = EXCLUDED.edited_by_user_id,
           edited_at          = NOW(),
           is_active          = TRUE`,
        [docId, field_key, field_label || field_key, section || 'general',
         originalValue, new_value, value_type || 'text', edit_reason, userId]
      );

      fieldsChanged.push({ field_key, field_label: field_label || field_key, old_value: originalValue, new_value });
    }

    // Step 4b: Write-back to source tables (best-effort, non-fatal)
    const wbCtx: WritebackContext = {
      documentId:   docId,
      documentType: doc.document_type,
      consumerId:   doc.consumer_id   || undefined,
      referenceId:  doc.reference_id  || undefined,
      allocationId: doc.allocation_id || undefined,
      currentHtml:  currentHtml,
    };
    const writtenFields: string[] = [];
    let writebackCount = 0;
    const wbClient = await db.connect();
    try {
      for (const field of fields) {
        try {
          const result = await writebackField(field.field_key, field.new_value, wbCtx, wbClient);
          if (result.written) {
            writtenFields.push(field.field_key);
            writebackCount++;
          }
        } catch (wbErr) {
          console.error(`[writeback] field=${field.field_key} err=`, wbErr);
        }
      }
    } finally {
      wbClient.release();
    }

    // Step 5: Re-render with all active overrides
    const allOverridesRes = await db.query(
      `SELECT field_key, current_value FROM document_field_overrides WHERE document_id = $1 AND is_active = TRUE`,
      [docId]
    );
    const overridesMap: Record<string, string> = {};
    for (const row of allOverridesRes.rows) overridesMap[row.field_key] = row.current_value;

    const newHtml = applyRecalc(doc.document_type, currentHtml, overridesMap);
    const newVersion = currentVersion + 1;

    // Step 6: Save new version snapshot
    await db.query(
      `INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE)`,
      [docId, newVersion, newHtml, userId, edit_reason, JSON.stringify(fieldsChanged)]
    );

    // Step 7: Update documents table
    await db.query(
      `UPDATE documents SET
         html_content    = $1,
         version_number  = $2,
         last_edited_by  = $3,
         last_edited_at  = NOW(),
         edit_count      = edit_count + 1,
         is_edited       = TRUE
       WHERE id = $4`,
      [newHtml, newVersion, userId, docId]
    );

    // Step 8: Audit log (non-fatal)
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, previous_values, new_values)
         VALUES ($1,'DOCUMENT_EDIT','document',$2,$3,$4)`,
        [userId, docId,
         JSON.stringify({ version: currentVersion }),
         JSON.stringify({ version: newVersion, fields_changed: fieldsChanged, edit_reason })]
      );
    } catch { /* non-fatal */ }

    return res.json({
      success: true,
      document_id: docId,
      version_number: newVersion,
      html_content: newHtml,
      fields_updated: fields.length,
      writeback_count: writebackCount,
      written_fields: writtenFields,
      message: 'Document updated successfully',
    });
  } catch (err) { next(err); }
});


// GET /api/documents/:id/html - Return rendered html_content for a document (used by frontend print)
router.get('/:id/html', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT d.html_content, d.document_type, d.id AS doc_id,
              c.email AS consumer_email,
              COALESCE(c.name, TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))) AS consumer_name
       FROM documents d
       LEFT JOIN consumers c ON c.id = d.consumer_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });

    const row = result.rows[0];
    let htmlContent: string = row.html_content || '';

    if (row.document_type === 'demand_letter') {
      const consumerEmail = (row.consumer_email || '').replace(/'/g, "\\'");
      const consumerName  = (row.consumer_name  || '').replace(/'/g, "\\'");

      // Extract unit number and project name already rendered into the HTML
      const unitMatch    = htmlContent.match(/info-lbl">Unit No\.<\/span><span[^>]*>([^<]+)<\/span>/);
      const projectMatch = htmlContent.match(/info-lbl">Project<\/span><span[^>]*>([^<]+)<\/span>/);
      const unitNumber   = (unitMatch?.[1]  || '').replace(/'/g, "\\'");
      const projectName  = (projectMatch?.[1] || '').replace(/'/g, "\\'");

      const injection = `
<style>
  body { padding-bottom: 60px; }
  @media print {
    .no-print { display: none !important; }
    body { padding-bottom: 0 !important; }
    #table-no-interest[style*="display: none"],
    #table-with-interest[style*="display: none"],
    #para-no-interest[style*="display: none"],
    #para-with-interest[style*="display: none"] {
      display: none !important;
    }
  }
</style>
<script>
var CONSUMER_EMAIL = '${consumerEmail}';
var CONSUMER_NAME  = '${consumerName}';
var UNIT_NUMBER    = '${unitNumber}';
var PROJECT_NAME   = '${projectName}';

function sendEmail() {
  if (!CONSUMER_EMAIL || !CONSUMER_EMAIL.includes('@')) {
    alert('No valid email address found for this consumer.\\n\\nPlease update the consumer profile with a valid email address first.');
    return;
  }
  var subject =
    'Demand Letter - ' + PROJECT_NAME +
    ' - Unit ' + UNIT_NUMBER +
    ' - ' + CONSUMER_NAME;
  var body =
    'Dear ' + CONSUMER_NAME + ',\\n\\n' +
    'Please find below the demand letter for your unit ' + UNIT_NUMBER + ' in ' + PROJECT_NAME + '.\\n\\n' +
    'As per our records, the following installment(s) are due / overdue for payment. You are requested to make the payment on or before the due date to avoid penal interest under HRERA Rule 15 @ 11.10% per annum.\\n\\n' +
    'Please note: The demand letter is not attached in this email. To download the demand letter, please click the DOWNLOAD PDF button in the demand letter window.\\n\\n' +
    'For any queries, please contact:\\n' +
    'Email: info@rof.co.in\\n' +
    'Tollfree: 180030702828\\n' +
    'Office: Building No. 80, 2nd Floor, Sector-44, Gurugram - 122003\\n\\n' +
    'Thanks & regards,\\n' +
    'NANI RESORTS AND FLORICULTURE PVT. LTD.\\n' +
    'Accounts & Finance Department';
  var gmailUrl =
    'https://mail.google.com/mail/?view=cm&fs=1' +
    '&to=' + encodeURIComponent(CONSUMER_EMAIL) +
    '&su=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  window.open(gmailUrl, '_blank');
  var btn = document.getElementById('btn-email');
  if (btn) {
    var orig = btn.textContent;
    btn.textContent = '\\u2713 Opening Gmail...';
    btn.style.background = '#28a745';
    setTimeout(function() { btn.textContent = orig; btn.style.background = '#555'; }, 2000);
  }
}

function downloadPdf() {
  var msg = document.createElement('div');
  msg.id = 'pdf-tip';
  msg.className = 'no-print';
  msg.style.cssText =
    'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
    'background:#1a3c5e;color:#fff;padding:12px 24px;border-radius:4px;' +
    'font-family:Arial;font-size:12px;z-index:99999;text-align:center;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  msg.innerHTML = '&#128196; In the print dialog, select<br><strong>"Save as PDF"</strong> as the destination';
  document.body.appendChild(msg);
  setTimeout(function() {
    window.print();
    setTimeout(function() { var t = document.getElementById('pdf-tip'); if (t) t.remove(); }, 3000);
  }, 800);
}

function toggleInterest(mode) {
  var btnI   = document.getElementById('btn-interest');
  var btnNI  = document.getElementById('btn-no-interest');
  var tableNI = document.getElementById('table-no-interest');
  var tableWI = document.getElementById('table-with-interest');
  var paraNI  = document.getElementById('para-no-interest');
  var paraWI  = document.getElementById('para-with-interest');
  var active   = 'background:#17a2b8;color:#fff;border:2px solid #17a2b8;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial';
  var inactive = 'background:#fff;color:#17a2b8;border:2px solid #17a2b8;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial';
  if (mode === 'interest') {
    if (btnI)  btnI.style.cssText  = active;
    if (btnNI) btnNI.style.cssText = inactive;
    if (tableNI) tableNI.style.display = 'none';
    if (tableWI) tableWI.style.display = 'block';
    if (paraNI)  paraNI.style.display  = 'none';
    if (paraWI)  paraWI.style.display  = 'block';
  } else {
    if (btnNI) btnNI.style.cssText = active;
    if (btnI)  btnI.style.cssText  = inactive;
    if (tableNI) tableNI.style.display = 'block';
    if (tableWI) tableWI.style.display = 'none';
    if (paraNI)  paraNI.style.display  = 'block';
    if (paraWI)  paraWI.style.display  = 'none';
  }
}
</script>
<div class="no-print" style="position:fixed;bottom:0;left:0;width:100%;background:#2c2c2c;z-index:9999;box-sizing:border-box;">
  <div style="font-size:10px;color:#aaa;text-align:right;padding:4px 20px 0 0;font-family:Arial">Note: To attach the demand letter, use DOWNLOAD PDF and attach manually</div>
  <div style="padding:8px 20px 10px;display:flex;gap:10px;align-items:center;">
  <button id="btn-email"       onclick="sendEmail()"                style="background:#555;color:#fff;border:none;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">E-MAIL</button>
  <button id="btn-print"       onclick="window.print()"             style="background:#555;color:#fff;border:none;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">PRINT</button>
  <button id="btn-close"       onclick="window.close()"             style="background:#555;color:#fff;border:none;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">CLOSE</button>
  <button id="btn-download"    onclick="downloadPdf()"              style="background:#555;color:#fff;border:none;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">DOWNLOAD PDF</button>
  <button id="btn-interest"    onclick="toggleInterest('interest')" style="background:#fff;color:#17a2b8;border:2px solid #17a2b8;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">Interest</button>
  <button id="btn-no-interest" onclick="toggleInterest('no-interest')" style="background:#17a2b8;color:#fff;border:2px solid #17a2b8;padding:8px 18px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;font-family:Arial">Without Interest</button>
  </div>
</div>`;

      const editScriptDL = buildEditScript(
        row.doc_id,
        (req.headers.authorization?.split(' ')[1] || req.query.token as string || ''),
        'demand_letter'
      );
      htmlContent = htmlContent.replace('</body>', injection + '\n' + editScriptDL + '\n</body>');
    }

    if (row.document_type === 'allotment_letter') {
      const consumerName2 = (row.consumer_name || '').replace(/'/g, "\\'");
      const alInjection = `
<style>
  body { padding-top: 60px; }
  @media print { .no-print { display: none !important; } body { padding-top: 0 !important; } }
</style>
<script>
function downloadPdfAL() {
  var docId = '${req.params.id}';
  var tip = document.createElement('div');
  tip.className = 'no-print';
  tip.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#1a3c5e;color:#fff;padding:12px 24px;border-radius:4px;font-family:Arial;font-size:12px;z-index:99999;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
  tip.innerHTML = '&#128196; In the print dialog, select<br><strong>"Save as PDF"</strong> as the destination';
  document.body.appendChild(tip);
  setTimeout(function() {
    window.print();
    setTimeout(function() { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 3000);
  }, 800);
}
</script>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:1000;background:#1a3c5e;color:#fff;padding:9px 20px;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
  <span style="flex:1;font-weight:bold;font-size:13px;font-family:Arial">ROF CRM &mdash; Allotment Letter &mdash; ${consumerName2}</span>
  <button onclick="window.print()" style="background:#28a745;color:#fff;border:none;padding:7px 16px;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;font-family:Arial">Print</button>
  <button onclick="downloadPdfAL()" style="background:#007bff;color:#fff;border:none;padding:7px 16px;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;font-family:Arial">Download PDF</button>
  <button onclick="window.close()" style="background:#6c757d;color:#fff;border:none;padding:7px 16px;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;font-family:Arial">&#x2715; Close</button>
</div>`;
      const editScriptAL = buildEditScript(
        row.doc_id,
        (req.headers.authorization?.split(' ')[1] || req.query.token as string || ''),
        'allotment_letter'
      );
      htmlContent = htmlContent.replace('</body>', alInjection + '\n' + editScriptAL + '\n</body>');
    }

    res.set('Content-Type', 'text/html; charset=utf-8').send(htmlContent);
  } catch (err) { next(err); }
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
