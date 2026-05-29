import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// GET /api/custom-letters
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id } = req.query;
    const params: any[] = [];
    let where = `WHERE dt.document_type = 'custom_letter'`;
    if (project_id) { params.push(project_id); where += ` AND dt.project_id = $${params.length}`; }

    const result = await db.query(`
      SELECT dt.id, dt.name, dt.project_id, dt.version_number, dt.created_at, dt.updated_at,
             dt.letter_meta,
             p.name AS project_name,
             u.name AS created_by_name
      FROM document_templates dt
      LEFT JOIN projects p ON p.id = dt.project_id
      LEFT JOIN users u ON u.id = dt.created_by_user_id
      ${where}
      ORDER BY dt.created_at DESC
    `, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/custom-letters/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT dt.*, p.name AS project_name
      FROM document_templates dt
      LEFT JOIN projects p ON p.id = dt.project_id
      WHERE dt.id = $1 AND dt.document_type = 'custom_letter'
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Letter not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/custom-letters
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, name, subject, header_type, header_width, letter_for, letter_type,
            is_ref_no, is_duplicate, prefix_ref, body_html } = req.body;
    if (!project_id) return res.status(400).json({ error: 'Project is required' });
    if (!name || !subject) return res.status(400).json({ error: 'Name and Subject are required' });
    if (!body_html) return res.status(400).json({ error: 'Letter content is required' });

    const meta = { subject, header_type: header_type || 'Own Header', header_width: header_width || '70',
                   letter_for: letter_for || 'All', letter_type: letter_type || 'Other',
                   is_ref_no: is_ref_no || false, is_duplicate: is_duplicate || false,
                   prefix_ref: prefix_ref || '' };

    const result = await db.query(`
      INSERT INTO document_templates
        (project_id, document_type, name, body_html, merge_fields, letter_meta, created_by_user_id, version_number, created_at, updated_at)
      VALUES ($1, 'custom_letter', $2, $3, '{}', $4, $5, 1, NOW(), NOW())
      RETURNING id, name, project_id, created_at, letter_meta`,
      [project_id, name, body_html, JSON.stringify(meta), req.userId || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// PUT /api/custom-letters/:id
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, name, subject, header_type, header_width, letter_for, letter_type,
            is_ref_no, is_duplicate, prefix_ref, body_html } = req.body;
    const meta = { subject, header_type, header_width, letter_for, letter_type,
                   is_ref_no, is_duplicate, prefix_ref };

    const result = await db.query(`
      UPDATE document_templates SET
        project_id    = COALESCE($1, project_id),
        name          = COALESCE($2, name),
        body_html     = COALESCE($3, body_html),
        letter_meta   = $4,
        version_number = version_number + 1,
        updated_at    = NOW()
      WHERE id = $5 AND document_type = 'custom_letter'
      RETURNING *`,
      [project_id || null, name || null, body_html || null, JSON.stringify(meta), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Letter not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/custom-letters/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.query(`DELETE FROM document_templates WHERE id = $1 AND document_type = 'custom_letter'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/custom-letters/:id/generate
router.post('/:id/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumer_id } = req.body;
    if (!consumer_id) return res.status(400).json({ error: 'consumer_id required' });

    const tmplRes = await db.query(
      `SELECT * FROM document_templates WHERE id = $1 AND document_type = 'custom_letter'`,
      [req.params.id]
    );
    if (!tmplRes.rows[0]) return res.status(404).json({ error: 'Template not found' });
    const template = tmplRes.rows[0];

    const cRes = await db.query(`
      SELECT c.id, c.first_name, c.last_name, c.name AS full_name, c.salutation, c.father_name,
             c.mobile, c.alt_mobile, c.email, c.present_address, c.present_city,
             c.present_state, c.present_pin, c.perm_address, c.pan_no, c.aadhaar_no,
             c.registration_no, c.form_no, c.dob, c.gender, c.marital_status, c.nationality,
             c.nominee_name, c.nominee_relation, c.income_category, c.finance_bank, c.loan_amount,
             br.booking_date, br.booking_amount, br.basic_rate_inr_sqft AS rate_per_sqft,
             u.unit_number, u.bhk_type, u.carpet_area_sqft, u.balcony_area_sqft,
             u.floor AS floor_number, u.facing,
             t.tower_name,
             p.name AS project_name, p.location AS project_location, p.rera_number, p.tcp_licence,
             co.name AS company_name, co.address1 AS company_address, co.phone AS company_phone,
             co.gstin AS company_gstin, co.cin AS company_cin, co.email AS company_email,
             co.website AS company_website, co.reg_address AS company_reg_address,
             co.bank_account_no, co.bank_ifsc, co.bank_name, co.bank_branch, co.bank_company_name,
             (SELECT COALESCE(SUM(r.amount_received_inr),0) FROM receipts r
              WHERE r.consumer_id = c.id AND r.status != 'cancelled') AS total_paid
      FROM consumers c
      LEFT JOIN booking_records br ON br.consumer_id = c.id
      LEFT JOIN units u ON u.id = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN companies co ON co.id = p.company_id
      LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
      WHERE c.id = $1
      LIMIT 1`, [consumer_id]);

    if (!cRes.rows[0]) return res.status(404).json({ error: 'Consumer not found' });
    const d = cRes.rows[0];
    const now = new Date();
    const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
    const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('en-IN') : '';

    const mergeMap: Record<string, string> = {
      consumerName:       d.full_name || `${d.first_name||''} ${d.last_name||''}`.trim() || '—',
      salutation:         d.salutation || '',
      firstName:          d.first_name || '',
      lastName:           d.last_name || '',
      fatherName:         d.father_name || '',
      dob:                fmtDate(d.dob),
      gender:             d.gender || '',
      maritalStatus:      d.marital_status || '',
      nationality:        d.nationality || '',
      mobile:             d.mobile || '',
      altMobile:          d.alt_mobile || '',
      email:              d.email || '',
      presentAddress:     d.present_address || '',
      presentCity:        d.present_city || '',
      presentState:       d.present_state || '',
      presentPin:         d.present_pin || '',
      permAddress:        d.perm_address || '',
      registrationNo:     d.registration_no || '',
      customerId:         d.registration_no || '',
      formNo:             d.form_no || '',
      panNo:              d.pan_no || '',
      nomineeName:        d.nominee_name || '',
      nomineeRelation:    d.nominee_relation || '',
      incomeCategory:     d.income_category || '',
      financeBank:        d.finance_bank || '',
      loanAmount:         d.loan_amount ? fmt(d.loan_amount) : '—',
      totalPaid:          fmt(d.total_paid),
      bookingDate:        fmtDate(d.booking_date),
      bookingAmount:      d.booking_amount ? fmt(d.booking_amount) : '',
      unitNumber:         d.unit_number || '',
      unitType:           d.bhk_type || '',
      carpetArea:         d.carpet_area_sqft || '',
      balconyArea:        d.balcony_area_sqft || '',
      floorNumber:        String(d.floor_number || ''),
      towerName:          d.tower_name || '',
      facing:             d.facing || '',
      projectName:        d.project_name || '',
      projectLocation:    d.project_location || '',
      reraNo:             d.rera_number || '',
      tcpLicence:         d.tcp_licence || '',
      ratePerSqft:        d.rate_per_sqft || '',
      paymentPlanName:    '',
      companyName:        d.company_name || '',
      companyAddress:     d.company_address || '',
      companyPhone:       d.company_phone || '',
      companyGstin:       d.company_gstin || '',
      companyCin:         d.company_cin || '',
      companyEmail:       d.company_email || '',
      companyWebsite:     d.company_website || '',
      companyRegAddress:  d.company_reg_address || '',
      bankAccountNo:      d.bank_account_no || '',
      bankIfsc:           d.bank_ifsc || '',
      bankName:           d.bank_name || '',
      bankBranch:         d.bank_branch || '',
      bankCompanyName:    d.bank_company_name || '',
      currentDate:        now.toLocaleDateString('en-IN'),
      day:                String(now.getDate()).padStart(2, '0'),
      month:              now.toLocaleString('en-IN', { month: 'long' }),
      year:               String(now.getFullYear()),
    };

    let html = template.body_html || '';
    Object.entries(mergeMap).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });

    const meta = template.letter_meta || {};
    res.json({
      success: true,
      data: { html, subject: meta.subject || '', consumer_name: mergeMap.consumerName,
               project_name: mergeMap.projectName, template_name: template.name }
    });
  } catch (err) { next(err); }
});

export default router;
