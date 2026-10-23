"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Field edits and their recalculation, overrides, versions, the document HTML page.
const express_1 = require("express");
const index_js_1 = require("../../index.js");
const input_js_1 = require("../../utils/input.js");
const document_recalc_js_1 = require("../../utils/document-recalc.js");
const document_writeback_js_1 = require("../../utils/document-writeback.js");
const router = (0, express_1.Router)();
// GET /api/documents/:id/overrides — List all active field overrides for a document
router.get('/:id/overrides', async (req, res, next) => {
    try {
        const docId = (0, input_js_1.uuid)(req.params.id, 'Document');
        if (!(await index_js_1.db.query(`SELECT 1 FROM documents WHERE id = $1 AND deleted_at IS NULL`, [docId])).rows[0])
            throw (0, input_js_1.bad)('Document not found', 404);
        const result = await index_js_1.db.query(`SELECT dfo.id, dfo.field_key, dfo.field_label, dfo.section,
              dfo.original_value, dfo.current_value, dfo.value_type,
              dfo.edit_reason, dfo.edited_at, dfo.is_active,
              u.name AS edited_by_name
       FROM document_field_overrides dfo
       LEFT JOIN users u ON u.id = dfo.edited_by_user_id
       WHERE dfo.document_id = $1 AND dfo.is_active = TRUE
       ORDER BY dfo.edited_at DESC`, [docId]);
        res.json({ success: true, overrides: result.rows });
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
});
// GET /api/documents/:id/versions — Version history for a document
router.get('/:id/versions', async (req, res, next) => {
    try {
        const docId = (0, input_js_1.uuid)(req.params.id, 'Document');
        if (!(await index_js_1.db.query(`SELECT 1 FROM documents WHERE id = $1 AND deleted_at IS NULL`, [docId])).rows[0])
            throw (0, input_js_1.bad)('Document not found', 404);
        const result = await index_js_1.db.query(`SELECT dv.id, dv.version_number, dv.edit_reason, dv.fields_changed,
              dv.is_original, dv.created_at, u.name AS created_by_name
       FROM document_versions dv
       LEFT JOIN users u ON u.id = dv.created_by_user_id
       WHERE dv.document_id = $1
       ORDER BY dv.version_number DESC`, [docId]);
        res.json({ success: true, versions: result.rows });
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
});
// PATCH /api/documents/:id/edit — Apply field overrides and save new version (one transaction, the document row locked, so versions never repeat)
const VALUE_TYPES = ['text', 'currency', 'number', 'date', 'percent', 'percentage', 'area', 'integer', 'textarea'];
router.patch('/:id/edit', async (req, res, next) => {
    try {
        const docId = (0, input_js_1.uuid)(req.params.id, 'Document');
        const b = (0, input_js_1.body)(req);
        const edit_reason = (0, input_js_1.text)(b.edit_reason, 'edit_reason', 500, true);
        if (!Array.isArray(b.fields) || b.fields.length === 0)
            throw (0, input_js_1.bad)('fields array is required and must be non-empty');
        if (b.fields.length > 100)
            throw (0, input_js_1.bad)('At most 100 fields can be changed at once');
        const seenKeys = new Set();
        const fields = b.fields.map((f) => {
            if (!f || typeof f !== 'object' || Array.isArray(f))
                throw (0, input_js_1.bad)('Each field must be an object');
            const field_key = typeof f.field_key === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(f.field_key) ? f.field_key : (() => { throw (0, input_js_1.bad)('field_key is not valid'); })();
            if (seenKeys.has(field_key))
                throw (0, input_js_1.bad)(`field_key ${field_key} is repeated`);
            seenKeys.add(field_key);
            if (typeof f.new_value !== 'string' && typeof f.new_value !== 'number')
                throw (0, input_js_1.bad)(`new_value for ${field_key} must be text or a number`);
            const new_value = String(f.new_value);
            if (new_value.length > 5000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(new_value))
                throw (0, input_js_1.bad)(`new_value for ${field_key} is too long or has control characters`);
            const value_type = (0, input_js_1.has)(f.value_type) ? (0, input_js_1.oneOf)(f.value_type, 'value_type', VALUE_TYPES) : 'text';
            return { field_key, new_value, value_type, field_label: (0, input_js_1.text)(f.field_label, 'field_label', 200, false), section: (0, input_js_1.text)(f.section, 'section', 100, false) };
        });
        const userId = req.userId;
        const out = await (0, input_js_1.inTx)(async (c) => {
            const docResult = await c.query(`SELECT id, document_type, html_content, original_html_content, version_number, is_edited, consumer_id, reference_id, allocation_id
         FROM documents WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [docId]);
            if (!docResult.rows[0])
                throw (0, input_js_1.bad)('Document not found', 404);
            const doc = docResult.rows[0];
            const currentHtml = doc.html_content || '';
            const currentVersion = doc.version_number || 1;
            if (!doc.is_edited && !doc.original_html_content)
                await c.query(`UPDATE documents SET original_html_content = html_content WHERE id = $1`, [docId]);
            const fieldsChanged = [];
            for (const field of fields) {
                const existingRes = await c.query(`SELECT original_value FROM document_field_overrides WHERE document_id = $1 AND field_key = $2`, [docId, field.field_key]);
                const originalValue = existingRes.rows[0]?.original_value ?? (0, document_recalc_js_1.extractFieldValue)(currentHtml, field.field_key) ?? '';
                await c.query(`INSERT INTO document_field_overrides
             (document_id, field_key, field_label, section, original_value, current_value, value_type, edit_reason, edited_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (document_id, field_key) DO UPDATE SET
             current_value = EXCLUDED.current_value, field_label = COALESCE(EXCLUDED.field_label, document_field_overrides.field_label),
             edit_reason = EXCLUDED.edit_reason, edited_by_user_id = EXCLUDED.edited_by_user_id, edited_at = NOW(), is_active = TRUE`, [docId, field.field_key, field.field_label || field.field_key, field.section || 'general', originalValue, field.new_value, field.value_type || 'text', edit_reason, userId]);
                fieldsChanged.push({ field_key: field.field_key, field_label: field.field_label || field.field_key, old_value: originalValue, new_value: field.new_value });
            }
            // Write-back to the source tables: a field that cannot be written is skipped (its own savepoint), the others go through
            const wbCtx = {
                documentId: docId, documentType: doc.document_type, consumerId: doc.consumer_id || undefined,
                referenceId: doc.reference_id || undefined, allocationId: doc.allocation_id || undefined, currentHtml,
            };
            const writtenFields = [];
            for (const field of fields) {
                await c.query('SAVEPOINT wb');
                try {
                    const result = await (0, document_writeback_js_1.writebackField)(field.field_key, field.new_value, wbCtx, c);
                    if (result.written)
                        writtenFields.push(field.field_key);
                    await c.query('RELEASE SAVEPOINT wb');
                }
                catch (wbErr) {
                    await c.query('ROLLBACK TO SAVEPOINT wb');
                    console.error(`[writeback] field=${field.field_key} err=`, wbErr);
                }
            }
            // Re-render with all active overrides; a value is page text, so it is escaped before it goes into the HTML
            const all = await c.query(`SELECT field_key, current_value FROM document_field_overrides WHERE document_id = $1 AND is_active = TRUE`, [docId]);
            const overridesMap = {};
            for (const row of all.rows)
                overridesMap[row.field_key] = (0, input_js_1.escHtml)(String(row.current_value ?? ''));
            const newHtml = (0, document_recalc_js_1.applyRecalc)(doc.document_type, currentHtml, overridesMap);
            const newVersion = currentVersion + 1;
            await c.query(`INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
         VALUES ($1,$2,$3,$4,$5,$6,FALSE)`, [docId, newVersion, newHtml, userId, edit_reason, JSON.stringify(fieldsChanged)]);
            await c.query(`UPDATE documents SET html_content = $1, version_number = $2, last_edited_by = $3, last_edited_at = NOW(), edit_count = COALESCE(edit_count, 0) + 1, is_edited = TRUE WHERE id = $4`, [newHtml, newVersion, userId, docId]);
            await c.query(`INSERT INTO audit_logs (user_id, action, resource_type, resource_id, previous_values, new_values) VALUES ($1,'DOCUMENT_EDIT','document',$2,$3,$4)`, [userId, docId, JSON.stringify({ version: currentVersion }), JSON.stringify({ version: newVersion, fields_changed: fieldsChanged, edit_reason })]);
            return { newVersion, newHtml, writtenFields };
        });
        res.locals.auditLogged = true;
        res.json({
            success: true, document_id: docId, version_number: out.newVersion, html_content: out.newHtml, fields_updated: fields.length,
            writeback_count: out.writtenFields.length, written_fields: out.writtenFields, message: 'Document updated successfully',
        });
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
});
// GET /api/documents/:id/html - Return rendered html_content for a document (used by frontend print)
router.get('/:id/html', async (req, res, next) => {
    try {
        const docId = (0, input_js_1.uuid)(req.params.id, 'Document');
        const result = await index_js_1.db.query(`SELECT d.html_content, d.document_type, d.id AS doc_id,
              c.email AS consumer_email,
              COALESCE(c.name, TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))) AS consumer_name
       FROM documents d
       LEFT JOIN consumers c ON c.id = d.consumer_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`, [docId]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Document not found' });
        const row = result.rows[0];
        let htmlContent = row.html_content || '';
        if (row.document_type === 'demand_letter') {
            const consumerEmail = (row.consumer_email || '').replace(/'/g, "\\'");
            const consumerName = (row.consumer_name || '').replace(/'/g, "\\'");
            // Extract unit number and project name already rendered into the HTML
            const unitMatch = htmlContent.match(/info-lbl">Unit No\.<\/span><span[^>]*>([^<]+)<\/span>/);
            const projectMatch = htmlContent.match(/info-lbl">Project<\/span><span[^>]*>([^<]+)<\/span>/);
            const unitNumber = (unitMatch?.[1] || '').replace(/'/g, "\\'");
            const projectName = (projectMatch?.[1] || '').replace(/'/g, "\\'");
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
            const editScriptDL = (0, document_recalc_js_1.buildEditScript)(row.doc_id, '', 'demand_letter');
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
            const editScriptAL = (0, document_recalc_js_1.buildEditScript)(row.doc_id, '', 'allotment_letter');
            htmlContent = htmlContent.replace('</body>', alInjection + '\n' + editScriptAL + '\n</body>');
        }
        res.set('Content-Type', 'text/html; charset=utf-8').send(htmlContent);
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=edit.js.map