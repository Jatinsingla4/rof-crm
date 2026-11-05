"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// POST /documents/generate: picks the template, builds the figures (merge-demand.ts, merge-letters.ts), fills the fields, saves the document.
const express_1 = require("express");
const index_js_1 = require("../../index.js");
const input_js_1 = require("../../utils/input.js");
const merge_demand_js_1 = require("./merge-demand.js");
const merge_letters_js_1 = require("./merge-letters.js");
const shells_js_1 = require("./shells.js");
const business_date_js_1 = require("../../utils/business-date.js");
const printDownload_js_1 = require("../../middleware/printDownload.js");
const router = (0, express_1.Router)();
// What the caller may send. Ids must be real, the type a plain word, figures that the caller supplies are page text (escaped) and may not carry markup.
const DELIVERY = ['email', 'whatsapp', 'sms', 'print', 'none'];
const checkedInput = (req) => {
    const b = (0, input_js_1.body)(req);
    const consumerId = (0, input_js_1.has)(b.consumerId) ? (0, input_js_1.uuid)(b.consumerId, 'Applicant') : undefined;
    const allocationId = (0, input_js_1.has)(b.allocationId) ? (0, input_js_1.uuid)(b.allocationId, 'Allocation') : undefined;
    if (!consumerId && !allocationId)
        throw (0, input_js_1.bad)('consumerId or allocationId is required');
    const templateId = (0, input_js_1.has)(b.templateId) ? (0, input_js_1.uuid)(b.templateId, 'Template') : undefined;
    const documentType = (0, input_js_1.has)(b.documentType) ? (typeof b.documentType === 'string' && /^[a-z_]{2,50}$/.test(b.documentType) ? b.documentType : (() => { throw (0, input_js_1.bad)('Document type is not valid'); })()) : undefined;
    if (!templateId && !documentType)
        throw (0, input_js_1.bad)('documentType or templateId is required');
    const deliveryMethod = (0, input_js_1.has)(b.deliveryMethod) ? (0, input_js_1.oneOf)(b.deliveryMethod, 'Delivery method', DELIVERY) : undefined;
    const dueDate = (0, input_js_1.day)(b.dueDate, 'Due date') || undefined;
    if ((0, input_js_1.has)(b.includeAllDemands) && typeof b.includeAllDemands !== 'boolean')
        throw (0, input_js_1.bad)('includeAllDemands must be true or false');
    if ((0, input_js_1.has)(b.includeInterest) && typeof b.includeInterest !== 'boolean')
        throw (0, input_js_1.bad)('includeInterest must be true or false');
    const demandId = (0, input_js_1.has)(b.demandId) ? (0, input_js_1.uuid)(b.demandId, 'Demand') : undefined;
    let mergeData;
    if ((0, input_js_1.has)(b.mergeData)) {
        if (typeof b.mergeData !== 'object' || Array.isArray(b.mergeData))
            throw (0, input_js_1.bad)('mergeData must be an object');
        const keys = Object.keys(b.mergeData);
        if (keys.length > 300)
            throw (0, input_js_1.bad)('mergeData has too many fields');
        mergeData = {};
        for (const k of keys) {
            if (!/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(k))
                throw (0, input_js_1.bad)(`mergeData field name "${k.slice(0, 30)}" is not valid`);
            const v = b.mergeData[k];
            if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')
                throw (0, input_js_1.bad)(`mergeData.${k} must be text, a number or true/false`);
            const t = v === null ? '' : String(v);
            if (t.length > 20000)
                throw (0, input_js_1.bad)(`mergeData.${k} is too long`);
            mergeData[k] = (0, input_js_1.escHtml)(t);
        }
    }
    return { consumerId, allocationId, templateId, documentType, deliveryMethod, dueDate, includeAllDemands: b.includeAllDemands === true, includeInterest: b.includeInterest, demandId, mergeData };
};
router.post('/generate', printDownload_js_1.requirePrint, async (req, res, next) => {
    try {
        const input = checkedInput(req);
        let { consumerId, allocationId, templateId, documentType, mergeData, deliveryMethod, dueDate, includeAllDemands } = input;
        if (allocationId) {
            const al = (await index_js_1.db.query('SELECT consumer_id FROM allocations WHERE id = $1', [allocationId])).rows[0];
            if (!al)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            if (consumerId && al.consumer_id !== consumerId)
                throw (0, input_js_1.bad)('That allocation does not belong to this applicant');
            consumerId = al.consumer_id;
        }
        else if (!(await index_js_1.db.query('SELECT 1 FROM consumers WHERE id = $1', [consumerId])).rows[0])
            throw (0, input_js_1.bad)('Applicant not found', 404);
        req.body = { ...(0, input_js_1.body)(req), demandId: input.demandId, includeInterest: input.includeInterest };
        // 1. Resolve Template
        console.log(`[GENERATE] Resolving template: documentType=${documentType}, templateId=${templateId}, consumerId=${consumerId}`);
        let template;
        if (templateId) {
            const tRes = await index_js_1.db.query(`SELECT * FROM document_templates WHERE id = $1`, [templateId]);
            template = tRes.rows[0];
            console.log(`[GENERATE] Template by ID: ${template ? 'found' : 'not found'}`);
        }
        else if (documentType) {
            // For buyer_builder_agreement and conveyance_deed, try project-specific first, then fall back to global
            if (['buyer_builder_agreement', 'conveyance_deed'].includes(documentType)) {
                let projectId = null;
                // Try to get project_id from consumer's allocation/unit
                if (consumerId) {
                    const projRes = await index_js_1.db.query(`SELECT p.id FROM projects p
             JOIN allocations a ON p.id = a.project_id
             WHERE a.consumer_id = $1
             ORDER BY a.created_at DESC LIMIT 1`, [consumerId]);
                    projectId = projRes.rows[0]?.id || null;
                    console.log(`[GENERATE] Consumer projectId: ${projectId || 'null (fallback to global)'}`);
                }
                // Try project-specific template first, then fall back to global (project_id IS NULL)
                const tRes = await index_js_1.db.query(`SELECT * FROM document_templates
           WHERE document_type = $1
           AND (
             project_id = $2
             OR project_id IS NULL
           )
           ORDER BY
             CASE WHEN project_id = $2 THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT 1`, [documentType, projectId]);
                template = tRes.rows[0];
                console.log(`[GENERATE] Template found: ${template ? `id=${template.id}, projectId=${template.project_id}` : 'not found'}`);
            }
            else if (documentType === 'demand_letter') {
                // demand_letter is built entirely dynamically — no template DB lookup needed
                // Use the professional HTML shell with all required markers for injection
                console.log(`[GENERATE] demand_letter uses inline shell (no DB lookup)`);
                template = {
                    id: null,
                    document_type: 'demand_letter',
                    body_html: (0, shells_js_1.getDemandLetterShell)(),
                    project_id: null,
                    name: 'Demand Letter (Dynamic)'
                };
            }
            else if (documentType === 'check_list') {
                // check_list is built entirely dynamically — no template DB lookup needed
                console.log(`[GENERATE] check_list uses inline shell (no DB lookup)`);
                template = {
                    id: null,
                    document_type: 'check_list',
                    body_html: (0, shells_js_1.getCheckListShell)(),
                    project_id: null,
                    name: 'Check List (Dynamic)'
                };
            }
            else if (['allotment_letter', 'payment_receipt'].includes(documentType)) {
                // For allotment_letter and payment_receipt, try project-specific first, then fall back to global
                let projectId = null;
                // Try to get project_id from consumer's allocation/unit
                if (consumerId) {
                    const projRes = await index_js_1.db.query(`SELECT p.id FROM projects p
             JOIN allocations a ON p.id = a.project_id
             WHERE a.consumer_id = $1
             ORDER BY a.created_at DESC LIMIT 1`, [consumerId]);
                    projectId = projRes.rows[0]?.id || null;
                    console.log(`[GENERATE] Consumer projectId: ${projectId || 'null (fallback to global)'}`);
                }
                // Try project-specific template first, then fall back to global (project_id IS NULL)
                const tRes = await index_js_1.db.query(`SELECT * FROM document_templates
           WHERE document_type = $1
           AND (
             project_id = $2
             OR project_id IS NULL
           )
           ORDER BY
             CASE WHEN project_id = $2 THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT 1`, [documentType, projectId]);
                template = tRes.rows[0];
                console.log(`[GENERATE] Template found: ${template ? `id=${template.id}, projectId=${template.project_id}` : 'not found'}`);
            }
            else {
                const tRes = await index_js_1.db.query(`SELECT * FROM document_templates WHERE document_type = $1 ORDER BY created_at DESC LIMIT 1`, [documentType]);
                template = tRes.rows[0];
                console.log(`[GENERATE] Generic template found: ${template ? 'yes' : 'no'}`);
            }
        }
        if (!template) {
            console.error(`[GENERATE] ❌ Template not found for documentType=${documentType}`);
            return res.status(404).json({ error: `No ${String(documentType).replace(/_/g, ' ')} template is set up yet. Add one under Documents → Templates.` });
        }
        console.log(`[GENERATE] ✓ Template resolved successfully`);
        // 2. Read template HTML directly from database
        let htmlContent = template.body_html || '';
        if (!htmlContent || htmlContent.length < 100) {
            console.error(`[TEMPLATE] Empty or invalid template. DocumentType: ${documentType}, ` +
                `TemplateId: ${templateId}, Length: ${htmlContent?.length}`);
            return res.status(500).json({
                error: 'Document template is empty or corrupted. Please contact administrator.'
            });
        }
        // Verify template no longer uses old FILE: references
        if (htmlContent.startsWith('FILE:')) {
            console.error(`[TEMPLATE] Template still uses deprecated FILE: reference. ` +
                `DocumentType: ${documentType}, Reference: ${htmlContent}`);
            return res.status(500).json({
                error: 'Document template not properly configured. FILE: references are no longer supported.'
            });
        }
        // 3. Auto-Merge Logic (if mergeData missing)
        if (!mergeData) {
            const dataRes = await index_js_1.db.query(`SELECT c.*, u.unit_number, u.bhk_type as unit_category, u.carpet_area_sqft as carpet_area, p.name as project_name, p.location as project_sector, p.rera_number as project_rera
         FROM consumers c
         LEFT JOIN units u ON c.allocated_unit_id = u.id
         LEFT JOIN projects p ON u.project_id = p.id
         WHERE c.id = $1`, [consumerId]);
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
                    currentDate: (0, business_date_js_1.businessDayStart)().toLocaleDateString('en-IN'),
                    day: (0, business_date_js_1.businessDayStart)().getDate(),
                    month: (0, business_date_js_1.businessDayStart)().toLocaleString('en-IN', { month: 'long' }),
                    year: (0, business_date_js_1.businessYear)(),
                };
                // Special logic for Demand Letter Rows
                // The per-type figures are built in merge-demand.ts and merge-letters.ts
                const gctx = { req, consumerId, allocationId, template, d, includeAllDemands, dueDate, mergeData, htmlContent };
                if (template.document_type === 'demand_letter')
                    await (0, merge_demand_js_1.demandLetterData)(gctx);
                else if (template.document_type === 'check_list')
                    await (0, merge_letters_js_1.checkListData)(gctx);
                else if (template.document_type === 'allotment_letter')
                    await (0, merge_letters_js_1.allotmentLetterData)(gctx);
                else if (template.document_type === 'buyer_builder_agreement')
                    await (0, merge_letters_js_1.buyerBuilderAgreementData)(gctx);
                else if (template.document_type === 'conveyance_deed')
                    await (0, merge_letters_js_1.conveyanceDeedData)(gctx);
                mergeData = gctx.mergeData;
                htmlContent = gctx.htmlContent;
            }
        }
        // 3. Perform Merge — wrap editable fields with data-field-key spans
        // so the edit engine can locate and patch them by key.
        // Map key → data-value-type so each field renders the right input widget.
        const EDITABLE_TEXT_FIELDS = new Map([
            // Core consumer / identity
            ['consumerName', 'text'], ['consumerFullName', 'text'],
            ['fatherName', 'text'], ['coApplicants', 'text'],
            ['mobile', 'text'], ['email', 'text'],
            ['address', 'text'], ['consumerAddress', 'text'],
            ['consumerMobile', 'text'], ['consumerEmail', 'text'],
            ['customerId', 'text'], ['registrationNo', 'text'],
            // Unit / project
            ['unitNumber', 'text'], ['bhkType', 'text'],
            ['towerName', 'text'], ['floorNo', 'text'],
            ['projectName', 'text'], ['projectSector', 'text'],
            ['projectLocation', 'text'], ['reraNo', 'text'],
            // Dates
            ['allotmentDate', 'date'], ['bookingDate', 'date'],
            ['dueDate', 'date'], ['invoiceDate', 'date'],
            ['proposedPossessionDate', 'date'],
            // Financials
            ['earnestAmount', 'currency'], ['totalConsideration', 'currency'],
            ['totalAmount', 'currency'], ['totalPayable', 'currency'],
            ['ratePerSqft', 'currency'],
            // Plan / rates
            ['planName', 'text'], ['penalRate', 'text'],
            // Demand letter totals
            ['totalDue', 'currency'], ['totalPaid', 'currency'],
            ['amountInWords', 'text'],
            // Allotment letter — consumer KYC
            ['nationality', 'text'], ['pinCode', 'text'],
            ['panNo', 'text'], ['aadhaarNo', 'text'],
            ['landlineNo', 'text'], ['carpetArea', 'text'],
            ['balconyArea', 'text'],
            // Allotment letter — booking payment
            ['paymentRef', 'text'], ['chequeDate', 'date'],
            ['bookingBankName', 'text'], ['bookingBankBranch', 'text'],
            // Allotment letter — project legal / regulatory
            ['hareraNo', 'text'], ['hareraDate', 'date'],
            ['proposedCompletionDate', 'date'],
            ['licenseNo', 'text'], ['licenseDate', 'date'],
            ['licenseValidUpto', 'date'], ['buildingPlanMemoNo', 'text'],
            ['buildingPlanDate', 'date'], ['envClearanceFileNo', 'text'],
            ['envClearanceDate', 'date'],
            // Allotment letter — document metadata / plan
            ['letterDate', 'date'], ['selectedPlanName', 'text'],
            // Agreement for Sale (ATS) — allottee/buyer info
            ['allottee_name', 'text'], ['allottee_address', 'text'],
            ['allottee_aadhaar', 'text'], ['allottee_pan', 'text'],
            ['allottee_age', 'text'], ['allottee_relative_name', 'text'],
            ['allottee_relation', 'text'],
            // Agreement for Sale — unit/property details
            ['flat_no', 'text'], ['tower_name', 'text'],
            ['floor_no', 'text'], ['unit_type', 'text'],
            ['carpet_area', 'currency'], ['balcony_area', 'currency'],
            ['parking_no', 'text'],
            // Agreement for Sale — financial/pricing
            ['total_price', 'currency'], ['booking_amount', 'currency'],
            // Agreement for Sale — project info
            ['project_name', 'text'], ['promoter_name', 'text'],
            ['promoter_cin', 'text'], ['promoter_pan', 'text'],
            ['promoter_address', 'text'],
            ['harera_reg_no', 'text'], ['license_no', 'text'],
            ['village_name', 'text'], ['sector_name', 'text'],
            ['land_owner_name', 'text'], ['land_owner_llpin', 'text'],
            ['land_owner_pan', 'text'],
            // Agreement for Sale — dates
            ['agreement_date', 'date'], ['agreement_day', 'text'],
            ['agreement_month', 'text'], ['agreement_year', 'text'],
            // Conveyance Deed — vendee/buyer info
            ['vendee_name', 'text'], ['vendee_address', 'text'],
            ['vendee_aadhaar', 'text'], ['vendee_pan', 'text'],
            ['vendee_relative_name', 'text'], ['vendee_relation', 'text'],
            // Conveyance Deed — property details
            ['property_no', 'text'], ['consideration', 'currency'],
            // Conveyance Deed — stamp and registration
            ['stamp_duty', 'currency'], ['e_stamp_no', 'text'],
            // Conveyance Deed — dates
            ['conveyance_deed_date', 'date'], ['deed_day', 'text'],
            ['deed_month', 'text'], ['deed_year', 'text'],
        ]);
        if (mergeData) {
            const NO_WRAP_FIELDS = ['payment_plan_rows', 'financeRows'];
            for (const [key, value] of Object.entries(mergeData)) {
                const strVal = String(value ?? '');
                if (NO_WRAP_FIELDS.includes(key)) {
                    htmlContent = htmlContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => strVal);
                }
                else {
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
            const md = mergeData;
            // Build the complete 12-column with-interest table
            const withInterestTableHtml = `<div id="table-with-interest" style="display:none">
  <table class="demand-table">
    <thead>
      <tr>
        <th style="width:28px">S.No.</th>
        <th>Particulars</th>
        <th>Charge Type</th>
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
        <td colspan="4" class="tr bold">TOTAL</td>
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
            }
            else {
            }
            // Wrap amt-words in dual divs for no-interest / with-interest amounts in words
            const amtWordsStart = htmlContent.indexOf('<div class="amt-words">');
            if (amtWordsStart !== -1) {
                const amtWordsEnd = htmlContent.indexOf('</div>', amtWordsStart) + '</div>'.length;
                const originalAmtWords = htmlContent.substring(amtWordsStart, amtWordsEnd);
                const withInterestAmtWords = `<div class="amt-words" style="border-color:#c00">` +
                    `<strong>Amount Payable in Words (incl. Interest):</strong> <span data-field-key="amountInWordsWithInterest" data-field-label="Amount in Words (with Interest)" data-value-type="text" data-section="summary">${md.amountInWordsWithInterest || ''}</span></div>`;
                htmlContent =
                    htmlContent.substring(0, amtWordsStart) +
                        `<div id="para-no-interest">${originalAmtWords}</div>\n  ` +
                        `<div id="para-with-interest" style="display:none">${withInterestAmtWords}</div>` +
                        htmlContent.substring(amtWordsEnd);
            }
            else {
            }
            // Advance Payment Adjustment injection removed
        }
        // 4. Save and return (insert WITHOUT toolbar first)
        const result = await index_js_1.db.query(`INSERT INTO documents (consumer_id, allocation_id, template_id, document_type, html_content, delivery_method, delivery_status, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id`, [consumerId, allocationId || null, template.id, template.document_type, htmlContent, deliveryMethod || 'none', req.userId]);
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
const TOKEN = localStorage.getItem('rof-jwt') || '';

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
            await index_js_1.db.query(`UPDATE documents SET html_content = $1 WHERE id = $2`, [finalHtml, newDocId]);
            // Save original version snapshot with toolbar (appended before </body>)
            const versionHtml = htmlContent.replace('</body>', editToolbar + '\n</body>');
            await index_js_1.db.query(`INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
         VALUES ($1, 1, $2, $3, 'Original generation', '[]'::jsonb, TRUE)`, [newDocId, versionHtml, req.userId]);
        }
        else {
            // Save original version snapshot for non-edit-toolbar documents
            await index_js_1.db.query(`INSERT INTO document_versions (document_id, version_number, html_content, created_by_user_id, edit_reason, fields_changed, is_original)
         VALUES ($1, 1, $2, $3, 'Original generation', '[]'::jsonb, TRUE)`, [newDocId, htmlContent, req.userId]);
        }
        res.status(201).json({ success: true, data: { documentId: newDocId } });
    }
    catch (error) {
        const err = error;
        console.error('[DOCUMENT GENERATION ERROR]', err?.message || 'Unknown error');
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=generate.js.map