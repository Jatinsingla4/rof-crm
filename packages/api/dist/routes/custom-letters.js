"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Customized Letters: letter templates per project, a letter made for one applicant, and the register of
 * every letter produced. Templates are managed with the master_data right (like Set Master); making a letter
 * needs the documents "create" right (checked by the mount in index.ts).
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const security_js_1 = require("../utils/security.js");
const router = (0, express_1.Router)();
const HEADER_TYPES = ['Computer Generated', 'Own Header'];
const LETTER_FOR = ['All', 'Loan', 'Self'];
const LETTER_TYPES = ['Other', 'PTM', 'TPA'];
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const day = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '');
// Indian financial year of a date: 2026-27 for 1 April 2026 to 31 March 2027
const financialYear = (d) => { const s = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${s}-${String(s + 1).slice(2)}`; };
// The variables a template may use. This one list feeds the screen's variable panel and the merge, so they cannot drift apart.
const VARIABLES = [
    { cat: 'First Applicant Details', vars: [
            ['Consumer Name', 'consumerName', (d) => d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim()],
            ['Salutation', 'salutation', (d) => d.salutation], ['First Name', 'firstName', (d) => d.first_name],
            ['Last Name', 'lastName', (d) => d.last_name], ['Father Name', 'fatherName', (d) => d.father_name],
            ['Date of Birth', 'dob', (d) => day(d.dob)], ['Gender', 'gender', (d) => d.gender],
            ['Marital Status', 'maritalStatus', (d) => d.marital_status], ['Nationality', 'nationality', (d) => d.nationality],
            ['Mobile', 'mobile', (d) => d.mobile], ['Alt Mobile', 'altMobile', (d) => d.alt_mobile], ['Email', 'email', (d) => d.email],
            ['Present Address', 'presentAddress', (d) => d.present_address], ['Present City', 'presentCity', (d) => d.present_city],
            ['Present State', 'presentState', (d) => d.present_state], ['Present Pin', 'presentPin', (d) => d.present_pin],
            ['Permanent Address', 'permAddress', (d) => d.perm_address], ['PAN No', 'panNo', (d) => d.pan_no],
            ['Registration No', 'registrationNo', (d) => d.registration_no], ['Form No', 'formNo', (d) => d.form_no],
            ['Nominee Name', 'nomineeName', (d) => d.nominee_name], ['Nominee Relation', 'nomineeRelation', (d) => d.nominee_relation],
            ['Income Category', 'incomeCategory', (d) => d.income_category],
        ] },
    { cat: 'Company & Project Details', vars: [
            ['Company Name', 'companyName', (d) => d.company_name], ['Company Address', 'companyAddress', (d) => d.company_address],
            ['Company Phone', 'companyPhone', (d) => d.company_phone], ['Company GSTIN', 'companyGstin', (d) => d.company_gstin],
            ['Company CIN', 'companyCin', (d) => d.company_cin], ['Company Email', 'companyEmail', (d) => d.company_email],
            ['Company Website', 'companyWebsite', (d) => d.company_website], ['Reg. Office Address', 'companyRegAddress', (d) => d.company_reg_address],
            ['Project Name', 'projectName', (d) => d.project_name], ['Project Location', 'projectLocation', (d) => d.project_location],
            ['RERA No', 'reraNo', (d) => d.rera_number], ['TCP Licence', 'tcpLicence', (d) => d.tcp_licence],
        ] },
    { cat: 'Unit Details', vars: [
            ['Unit Number', 'unitNumber', (d) => d.unit_number], ['Unit Type', 'unitType', (d) => d.bhk_type],
            ['Carpet Area', 'carpetArea', (d) => d.carpet_area_sqft], ['Balcony Area', 'balconyArea', (d) => d.balcony_area_sqft],
            ['Floor Number', 'floorNumber', (d) => d.floor_number], ['Tower Name', 'towerName', (d) => d.tower_name], ['Facing', 'facing', (d) => d.facing],
        ] },
    { cat: 'Installment & Plan Details', vars: [
            ['Payment Plan', 'paymentPlanName', (d) => d.selected_plan_name], ['Rate Per Sqft', 'ratePerSqft', (d) => d.rate_per_sqft],
            ['Booking Amount', 'bookingAmount', (d) => (d.booking_amount ? inr(d.booking_amount) : '')],
            ['Total Paid', 'totalPaid', (d) => inr(d.total_paid)], ['Booking Date', 'bookingDate', (d) => day(d.booking_date)],
            ['Loan Amount', 'loanAmount', (d) => (d.loan_amount ? inr(d.loan_amount) : '')], ['Finance Bank', 'financeBank', (d) => d.finance_bank],
        ] },
    { cat: 'Bank Details', vars: [
            ['Bank Account No', 'bankAccountNo', (d) => d.bank_account_no], ['Bank IFSC', 'bankIfsc', (d) => d.bank_ifsc],
            ['Bank Name', 'bankName', (d) => d.bank_name], ['Bank Branch', 'bankBranch', (d) => d.bank_branch],
            ['Bank Company Name', 'bankCompanyName', (d) => d.bank_company_name],
        ] },
    { cat: 'Letter Details', vars: [
            ['Letter Reference No', 'refNo', (_d, c) => c.refNo], ['Current Date', 'currentDate', (_d, c) => c.now.toLocaleDateString('en-IN')],
            ['Day', 'day', (_d, c) => String(c.now.getDate()).padStart(2, '0')],
            ['Month', 'month', (_d, c) => c.now.toLocaleString('en-IN', { month: 'long' })], ['Year', 'year', (_d, c) => String(c.now.getFullYear())],
        ] },
];
const can = (req) => ({
    canManage: (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', 'create'),
    canEdit: (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', 'edit'),
    canDelete: (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', 'delete'),
    canGenerate: (0, rbac_js_1.hasPermission)(req.userRole, 'documents', 'create'),
});
// Templates are managed with the master_data right
const needMaster = (action) => (req, res, next) => (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', action) ? next() : res.status(403).json({ error: 'You do not have permission to manage letter templates' });
const hasContent = (html) => /<(img|table|hr)\b/i.test(html) || html.replace(/<[^>]*>|&nbsp;|\s/g, '') !== '';
// Checks the fields that are present; returns an error text or null
async function letterError(b, creating) {
    if (creating || b.project_id !== undefined) {
        if (!(0, security_js_1.isUuid)(b.project_id))
            return 'Project is required';
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [b.project_id])).rowCount)
            return 'Project not found';
    }
    if (creating || b.name !== undefined) {
        const n = text(b.name);
        if (!n)
            return 'Letter name is required';
        if (n.length > 150)
            return 'Letter name is longer than 150 characters';
    }
    if (creating || b.subject !== undefined) {
        const s = text(b.subject);
        if (!s)
            return 'Subject is required';
        if (s.length > 255)
            return 'Subject is longer than 255 characters';
    }
    if (creating || b.body_html !== undefined) {
        if (typeof b.body_html !== 'string' || !hasContent(b.body_html))
            return 'Letter content is required';
        if (b.body_html.length > 200000)
            return 'Letter content is too long';
    }
    if (b.header_type !== undefined && !HEADER_TYPES.includes(b.header_type))
        return 'Invalid header type';
    if (b.letter_for !== undefined && !LETTER_FOR.includes(b.letter_for))
        return 'Invalid "Letter for"';
    if (b.letter_type !== undefined && !LETTER_TYPES.includes(b.letter_type))
        return 'Invalid letter type';
    if (b.header_width !== undefined && !(Number.isInteger(Number(b.header_width)) && Number(b.header_width) >= 0 && Number(b.header_width) <= 500))
        return 'Header width must be a whole number from 0 to 500';
    for (const k of ['is_ref_no', 'is_duplicate'])
        if (b[k] !== undefined && typeof b[k] !== 'boolean')
            return `${k === 'is_ref_no' ? 'Reference number' : 'Duplicate'} must be yes or no`;
    if (b.prefix_ref !== undefined && !/^[A-Za-z0-9/_-]{0,30}$/.test(text(b.prefix_ref)))
        return 'Prefix may have letters, digits, / - _ (30 characters at most)';
    return null;
}
async function nameTaken(projectId, name, exceptId) {
    return (await index_js_1.db.query(`SELECT 1 FROM document_templates WHERE document_type = 'custom_letter' AND project_id = $1 AND lower(name) = lower($2) AND ($3::uuid IS NULL OR id <> $3)`, [projectId, name, exceptId ?? null])).rowCount > 0;
}
// GET /api/custom-letters/variables — what a template may use
router.get('/variables', (_req, res) => {
    res.json({ success: true, data: VARIABLES.map((g) => ({ cat: g.cat, vars: g.vars.map(([label, key]) => ({ label, key })) })) });
});
// GET /api/custom-letters/log — the register of letters produced
router.get('/log', async (req, res, next) => {
    try {
        const { consumer_id, template_id, q, from, to } = req.query;
        const pageSize = (0, security_js_1.intParam)(req.query.pageSize, 50, 1, 200);
        const page = (0, security_js_1.intParam)(req.query.page, 1, 1, 100000);
        const where = [];
        const params = [];
        const add = (sql, v) => { params.push(v); where.push(sql.split('?').join(`$${params.length}`)); };
        if (consumer_id) {
            if (!(0, security_js_1.isUuid)(consumer_id))
                return res.status(400).json({ error: 'Invalid consumer_id' });
            add('l.consumer_id = ?', consumer_id);
        }
        if (template_id) {
            if (!(0, security_js_1.isUuid)(template_id))
                return res.status(400).json({ error: 'Invalid template_id' });
            add('l.template_id = ?', template_id);
        }
        if (q)
            add('(l.ref_no ILIKE ? OR c.name ILIKE ? OR l.template_name ILIKE ?)', `%${String(q).replace(/[\\%_]/g, (m) => '\\' + m)}%`);
        for (const [name, v, sql] of [['from', from, `l.generated_at >= ?::date`], ['to', to, `l.generated_at < (?::date + 1)`]]) {
            if (!v)
                continue;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v))))
                return res.status(400).json({ error: `${name} must be a date like 2026-01-31` });
            add(sql, v);
        }
        const sqlWhere = where.join(' AND ');
        params.push(pageSize, (page - 1) * pageSize);
        const r = await index_js_1.db.query(`SELECT l.id, l.ref_no, l.template_id, l.template_name, l.subject, l.is_duplicate, l.generated_at, l.consumer_id,
              c.name AS consumer_name, p.name AS project_name, u.name AS generated_by_name
       FROM custom_letter_log l
       JOIN consumers c ON c.id = l.consumer_id
       LEFT JOIN projects p ON p.id = l.project_id
       LEFT JOIN users u ON u.id = l.generated_by
       ${sqlWhere ? 'WHERE ' + sqlWhere : ''}
       ORDER BY l.generated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: r.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/custom-letters — templates
router.get('/', async (req, res, next) => {
    try {
        const { project_id, q } = req.query;
        const params = [];
        let where = `WHERE dt.document_type = 'custom_letter'`;
        if (project_id) {
            if (!(0, security_js_1.isUuid)(project_id))
                return res.status(400).json({ error: 'Invalid project_id' });
            params.push(project_id);
            where += ` AND dt.project_id = $${params.length}`;
        }
        if (q) {
            params.push(`%${String(q).replace(/[\\%_]/g, (m) => '\\' + m)}%`);
            where += ` AND (dt.name ILIKE $${params.length} OR dt.letter_meta->>'subject' ILIKE $${params.length})`;
        }
        const result = await index_js_1.db.query(`
      SELECT dt.id, dt.name, dt.project_id, dt.version_number, dt.created_at, dt.updated_at, dt.letter_meta,
             p.name AS project_name, u.name AS created_by_name,
             (SELECT COUNT(*)::int FROM custom_letter_log l WHERE l.template_id = dt.id) AS letters_made
      FROM document_templates dt
      LEFT JOIN projects p ON p.id = dt.project_id
      LEFT JOIN users u ON u.id = dt.created_by_user_id
      ${where}
      ORDER BY p.name NULLS LAST, dt.name`, params);
        res.json({ success: true, data: result.rows, can: can(req) });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/custom-letters/:id
router.get('/:id', async (req, res, next) => {
    try {
        if (!(0, security_js_1.isUuid)(req.params.id))
            return res.status(404).json({ error: 'Letter not found' });
        const result = await index_js_1.db.query(`
      SELECT dt.*, p.name AS project_name FROM document_templates dt
      LEFT JOIN projects p ON p.id = dt.project_id
      WHERE dt.id = $1 AND dt.document_type = 'custom_letter'`, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Letter not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
const metaOf = (b, old = {}) => ({
    subject: b.subject !== undefined ? text(b.subject) : old.subject,
    header_type: b.header_type ?? old.header_type ?? 'Own Header',
    header_width: String(b.header_width ?? old.header_width ?? '70'),
    letter_for: b.letter_for ?? old.letter_for ?? 'All',
    letter_type: b.letter_type ?? old.letter_type ?? 'Other',
    is_ref_no: b.is_ref_no ?? old.is_ref_no ?? false,
    is_duplicate: b.is_duplicate ?? old.is_duplicate ?? false,
    prefix_ref: b.prefix_ref !== undefined ? text(b.prefix_ref) : old.prefix_ref ?? '',
});
// POST /api/custom-letters
router.post('/', needMaster('create'), async (req, res, next) => {
    try {
        const b = req.body || {};
        const bad = await letterError(b, true);
        if (bad)
            return res.status(400).json({ error: bad });
        if (await nameTaken(b.project_id, text(b.name)))
            return res.status(409).json({ error: 'A letter with this name already exists in this project' });
        const result = await index_js_1.db.query(`INSERT INTO document_templates (project_id, document_type, name, body_html, merge_fields, letter_meta, created_by_user_id, version_number, created_at, updated_at)
       VALUES ($1, 'custom_letter', $2, $3, '{}', $4, $5, 1, NOW(), NOW())
       RETURNING id, name, project_id, created_at, letter_meta`, [b.project_id, text(b.name), b.body_html, JSON.stringify(metaOf(b)), req.userId || null]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'custom_letter', result.rows[0].id, undefined, { name: result.rows[0].name, project_id: b.project_id });
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/custom-letters/:id — only the fields sent change
router.put('/:id', needMaster('edit'), async (req, res, next) => {
    try {
        if (!(0, security_js_1.isUuid)(req.params.id))
            return res.status(404).json({ error: 'Letter not found' });
        const b = req.body || {};
        const old = (await index_js_1.db.query(`SELECT * FROM document_templates WHERE id = $1 AND document_type = 'custom_letter'`, [req.params.id])).rows[0];
        if (!old)
            return res.status(404).json({ error: 'Letter not found' });
        const bad = await letterError(b, false);
        if (bad)
            return res.status(400).json({ error: bad });
        const projectId = b.project_id ?? old.project_id;
        const name = b.name !== undefined ? text(b.name) : old.name;
        if (await nameTaken(projectId, name, old.id))
            return res.status(409).json({ error: 'A letter with this name already exists in this project' });
        const result = await index_js_1.db.query(`UPDATE document_templates SET project_id = $1, name = $2, body_html = COALESCE($3, body_html), letter_meta = $4,
              version_number = version_number + 1, updated_at = NOW()
       WHERE id = $5 RETURNING *`, [projectId, name, b.body_html ?? null, JSON.stringify(metaOf(b, old.letter_meta || {})), old.id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'custom_letter', old.id, { name: old.name, version: old.version_number }, { name, version: result.rows[0].version_number });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/custom-letters/:id — the register keeps its rows (the template name is stored with each)
router.delete('/:id', needMaster('delete'), async (req, res, next) => {
    try {
        if (!(0, security_js_1.isUuid)(req.params.id))
            return res.status(404).json({ error: 'Letter not found' });
        const r = await index_js_1.db.query(`DELETE FROM document_templates WHERE id = $1 AND document_type = 'custom_letter' RETURNING id, name`, [req.params.id]);
        if (!r.rows[0])
            return res.status(404).json({ error: 'Letter not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'custom_letter', r.rows[0].id, { name: r.rows[0].name }, undefined);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/custom-letters/:id/generate — make the letter for one applicant and enter it in the register
router.post('/:id/generate', async (req, res, next) => {
    try {
        const { consumer_id } = req.body || {};
        if (!(0, security_js_1.isUuid)(req.params.id))
            return res.status(404).json({ error: 'Template not found' });
        if (!(0, security_js_1.isUuid)(consumer_id))
            return res.status(400).json({ error: 'consumer_id required' });
        const template = (await index_js_1.db.query(`SELECT * FROM document_templates WHERE id = $1 AND document_type = 'custom_letter'`, [req.params.id])).rows[0];
        if (!template)
            return res.status(404).json({ error: 'Template not found' });
        const meta = template.letter_meta || {};
        // The applicant's latest live booking supplies the unit, plan and loan details
        const d = (await index_js_1.db.query(`
      SELECT c.id, c.first_name, c.last_name, c.name AS full_name, c.salutation, c.father_name,
             c.mobile, c.alt_mobile, c.email, c.present_address, c.present_city,
             c.present_state, c.present_pin, c.perm_address, c.pan_no, c.registration_no, c.form_no,
             c.dob, c.gender, c.marital_status, c.nationality, c.nominee_name, c.nominee_relation, c.income_category,
             COALESCE(br.finance_bank, c.finance_bank) AS finance_bank, COALESCE(br.loan_amount, c.loan_amount) AS loan_amount,
             br.id AS booking_id, br.self_or_loan, br.selected_plan_name, br.booking_date, br.booking_amount,
             br.basic_rate_inr_sqft AS rate_per_sqft,
             COALESCE(br.project_id, c.project_id) AS consumer_project_id,
             u.unit_number, u.bhk_type, u.carpet_area_sqft, u.balcony_area_sqft, u.floor AS floor_number, u.facing,
             t.tower_name,
             p.name AS project_name, p.location AS project_location, p.rera_number, p.tcp_licence,
             co.name AS company_name, co.address1 AS company_address, co.phone AS company_phone,
             co.gstin AS company_gstin, co.cin AS company_cin, co.email AS company_email,
             co.website AS company_website, co.reg_address AS company_reg_address,
             co.bank_account_no, co.bank_ifsc, co.bank_name, co.bank_branch, co.bank_company_name,
             (SELECT COALESCE(SUM(r.amount_received_inr), 0) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled') AS total_paid
      FROM consumers c
      LEFT JOIN LATERAL (SELECT * FROM booking_records b WHERE b.consumer_id = c.id AND b.status <> 'cancelled'
                         ORDER BY b.booking_date DESC NULLS LAST, b.created_at DESC LIMIT 1) br ON true
      LEFT JOIN units u ON u.id = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN projects p ON p.id = COALESCE(br.project_id, c.project_id)
      LEFT JOIN companies co ON co.id = p.company_id
      WHERE c.id = $1`, [consumer_id])).rows[0];
        if (!d)
            return res.status(404).json({ error: 'Applicant not found' });
        // The right letter for the right applicant: same project, and Loan / Self letters only for those bookings
        if (d.consumer_project_id && d.consumer_project_id !== template.project_id) {
            return res.status(400).json({ error: 'This letter belongs to another project than the applicant\'s' });
        }
        if (meta.letter_for === 'Loan' || meta.letter_for === 'Self') {
            if (!d.booking_id)
                return res.status(400).json({ error: 'The applicant has no booking, so a Loan or Self letter cannot be made' });
            const loan = String(d.self_or_loan || 'self').toLowerCase() === 'loan';
            if (meta.letter_for === 'Loan' && !loan)
                return res.status(400).json({ error: 'This letter is for loan bookings; this booking is self-funded' });
            if (meta.letter_for === 'Self' && loan)
                return res.status(400).json({ error: 'This letter is for self-funded bookings; this booking has a loan' });
        }
        const now = new Date();
        const fy = financialYear(now);
        const client = await index_js_1.db.connect();
        let refNo = '', refPrefix = null, refSeq = null, duplicate = false, logId;
        try {
            await client.query('BEGIN');
            if (meta.is_ref_no) {
                const prior = meta.is_duplicate
                    ? (await client.query(`SELECT ref_no FROM custom_letter_log WHERE template_id = $1 AND consumer_id = $2 AND ref_no IS NOT NULL AND NOT is_duplicate ORDER BY generated_at LIMIT 1`, [template.id, consumer_id])).rows[0]
                    : null;
                if (prior) {
                    refNo = prior.ref_no;
                    duplicate = true;
                }
                else {
                    refPrefix = meta.prefix_ref || 'REF';
                    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${refPrefix}|${fy}`]);
                    refSeq = (await client.query(`SELECT COALESCE(MAX(ref_seq), 0) + 1 AS n FROM custom_letter_log WHERE ref_prefix = $1 AND financial_year = $2`, [refPrefix, fy])).rows[0].n;
                    refNo = `${refPrefix}/${fy}/${String(refSeq).padStart(4, '0')}`;
                }
            }
            logId = (await client.query(`INSERT INTO custom_letter_log (template_id, template_name, consumer_id, project_id, subject, ref_no, ref_prefix, ref_seq, financial_year, is_duplicate, generated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [template.id, template.name, consumer_id, template.project_id, meta.subject || null, refNo || null, refPrefix, refSeq, refSeq ? fy : null, duplicate, req.userId || null])).rows[0].id;
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
        // Merge: every value is escaped, so applicant data can never add markup or script to the letter
        const ctx = { now, refNo };
        const values = {};
        for (const g of VARIABLES)
            for (const [, key, get] of g.vars)
                values[key] = String(get(d, ctx) ?? '');
        const unresolved = new Set();
        let html = String(template.body_html || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
            if (Object.prototype.hasOwnProperty.call(values, k))
                return escHtml(values[k]);
            unresolved.add(k);
            return m;
        });
        if (meta.is_ref_no && !/\{\{\s*refNo\s*\}\}/.test(template.body_html || '')) {
            html = `<p style="text-align:right">Ref. No.: ${escHtml(refNo)}</p>` + html;
        }
        if (duplicate)
            html = `<p style="text-align:center;font-weight:bold;letter-spacing:2px">DUPLICATE COPY</p>` + html;
        // Header: the company's name block, or blank space at the top for printing on the company's own letterhead
        if (meta.header_type === 'Computer Generated') {
            const line = [d.company_phone, d.company_email, d.company_website].filter(Boolean).map(escHtml).join(' | ');
            html = `<div style="text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:14px"><div style="font-size:18px;font-weight:bold">${escHtml(d.company_name)}</div>`
                + `<div>${escHtml(d.company_reg_address || d.company_address)}</div>${line ? `<div>${line}</div>` : ''}</div>` + html;
        }
        else if (Number(meta.header_width) > 0) {
            html = `<div style="height:${Math.min(Number(meta.header_width), 500)}px"></div>` + html;
        }
        res.json({
            success: true,
            data: { html, subject: meta.subject || '', consumer_name: values.consumerName || d.full_name || '', project_name: d.project_name || '',
                template_name: template.name, ref_no: refNo, duplicate, log_id: logId, unresolved: [...unresolved] },
        });
    }
    catch (err) {
        next(err);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=custom-letters.js.map