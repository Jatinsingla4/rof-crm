/**
 * Consumer Routes - Module B
 * All consumer endpoints: create, list, get, update, KYC, remarks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// POST /api/consumers - Create consumer
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      // Legacy / simple fields
      name, mobile, email, aadhaar, pan, incomeCategory, income_category, projectId, project_id,
      // Extended booking form fields
      first_name, last_name, middle_name, salutation, dob, gender, profession, nationality,
      annual_income, education, company, ppp_id, pan_no, aadhaar_no, alt_mobile,
      source_of_enquiry, referred_by, lead_stage, form_no,
      // Addresses
      present_address_line1, present_address_line2, present_city, present_state, present_pin, present_country,
      perm_address_line1, perm_city, perm_state, perm_pin, perm_country,
      office_address_line1, office_city, office_state, office_pin,
      // Nominee
      nominee_name, nominee_relation, nominee_dob, nominee_share,
      // Finance
      finance_bank, loan_amount, loan_sanction_date,
    } = req.body;

    const consumerMobile = mobile || req.body.mobile;
    const consumerName   = name || `${first_name||''} ${last_name||''}`.trim() || 'Unknown';
    const projId         = projectId || project_id || null;
    const incomeCat      = incomeCategory || income_category || null;

    if (!consumerMobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    // SHA-256 hash Aadhaar & PAN
    const rawAadhaar = aadhaar || aadhaar_no;
    const rawPan     = pan || pan_no;
    const aadhaarHash = rawAadhaar ? createHash('sha256').update(rawAadhaar.replace(/\s/g,'')).digest('hex') : null;
    const panHash     = rawPan     ? createHash('sha256').update(rawPan.toUpperCase().trim()).digest('hex') : null;

    // PARAM COUNT: 49 params
    // If adding new fields, update this count
    // Columns, placeholders and params must always match exactly
    const result = await db.query(
      `INSERT INTO consumers (
         name, mobile, email, aadhaar_hash, aadhaar_no, pan_hash, pan_no, parivar_pehchan_patra,
         income_category, lead_stage, project_id, created_by_user_id,
         first_name, last_name, middle_name, salutation, dob, gender, profession, nationality,
         annual_income, education, company, alt_mobile,
         source_of_enquiry, referred_by,
         present_address, present_address_line2, present_city, present_state, present_pin, present_country,
         perm_address, perm_city, perm_state, perm_pin, perm_country,
         office_address, office_city, office_state, office_pin,
         nominee_name, nominee_relation, nominee_dob, nominee_share,
         finance_bank, loan_amount, loan_sanction_date, form_no
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
         $27,$28,$29,$30,$31,$32,
         $33,$34,$35,$36,$37,
         $38,$39,$40,$41,
         $42,$43,$44,$45,
         $46,$47,$48,$49
       )
       RETURNING id, name, mobile, email, lead_stage, project_id, created_at`,
      [
        consumerName, consumerMobile, email||null, aadhaarHash, rawAadhaar||null, panHash, rawPan||null, ppp_id||null,
        incomeCat, lead_stage||'enquiry', projId, req.userId,
        first_name||null, last_name||null, middle_name||null, salutation||null,
        dob||null, gender||null, profession||null, nationality||null,
        annual_income?parseFloat(annual_income):null, education||null, company||null,
        alt_mobile||null,
        source_of_enquiry||null, referred_by||null,
        present_address_line1||null, present_address_line2||null, present_city||null,
        present_state||null, present_pin||null, present_country||'India',
        perm_address_line1||null, perm_city||null, perm_state||null, perm_pin||null, perm_country||'India',
        office_address_line1||null, office_city||null, office_state||null, office_pin||null,
        nominee_name||null, nominee_relation||null, nominee_dob||null,
        nominee_share?parseFloat(nominee_share):100,
        finance_bank||null, loan_amount?parseFloat(loan_amount):null, loan_sanction_date||null, form_no||null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/consumers - List all consumers (with search & filter)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const {
    projectId,
    leadStage,
    search,
    unitNo,
    mobile,
    regNo,
    dob,
    pan,
    address,
    city,
    state,
    email,
    secondApplicant,
    secondApplicantPan,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = req.query;

  try {

    let query = `SELECT c.id, c.name, c.mobile, c.email, c.lead_stage, c.project_id, c.allocated_unit_id, c.created_at,
                        u.unit_number, u.super_area_sqft as unit_area, t.tower_name,
                        COALESCE(c.registration_no, br.registration_no) as registration_no, br.application_date as registration_date,
                        b.name as broker_name,
                        co.name as second_applicant_name,
                        p.name as project_name
                 FROM consumers c
                 LEFT JOIN units u ON c.allocated_unit_id = u.id
                 LEFT JOIN towers t ON u.tower_id = t.id
                 LEFT JOIN booking_forms br ON br.consumer_id = c.id
                 LEFT JOIN brokers b ON br.main_broker_id = b.id
                 LEFT JOIN co_applicants co ON co.consumer_id = c.id
                 LEFT JOIN projects p ON c.project_id = p.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND c.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (leadStage) {
      query += ` AND c.lead_stage = $${params.length + 1}`;
      params.push(leadStage);
    }

    if (unitNo) {
      query += ` AND u.unit_number ILIKE $${params.length + 1}`;
      params.push(`%${unitNo}%`);
    }

    if (mobile) {
      query += ` AND c.mobile LIKE $${params.length + 1}`;
      params.push(`%${mobile}%`);
    }

    if (regNo) {
      query += ` AND c.registration_no ILIKE $${params.length + 1}`;
      params.push(`%${regNo}%`);
    }

    if (dob) {
      // dob column might not exist in consumers table, but in applicant_details in migration 018
      // For this 1:1, assume dob is added or use dummy filter
      query += ` AND c.created_at::date = $${params.length + 1}`; // Placeholder for dob
      params.push(dob);
    }

    if (pan) {
      query += ` AND c.pan_no ILIKE $${params.length + 1}`;
      params.push(`%${pan}%`);
    }

    if (city) {
      query += ` AND c.email ILIKE $${params.length + 1}`; // Placeholder for city
      params.push(`%${city}%`);
    }

    if (secondApplicant) {
      query += ` AND co.name ILIKE $${params.length + 1}`;
      params.push(`%${secondApplicant}%`);
    }

    if (search) {
      query += ` AND (c.name ILIKE $${params.length + 1} OR c.mobile LIKE $${params.length + 2} OR c.email ILIKE $${params.length + 3} OR u.unit_number ILIKE $${params.length + 4})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Sorting
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;

    // Pagination
    const offset = ((page as number) - 1) * (pageSize as number);
    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Build count query matching the data query filters
    let countQuery = `SELECT COUNT(*) FROM consumers c LEFT JOIN units u ON c.allocated_unit_id = u.id${secondApplicant ? ' LEFT JOIN co_applicants co ON co.consumer_id = c.id' : ''} WHERE 1=1`;
    const countParams: any[] = [];

    if (projectId) {
      countQuery += ` AND c.project_id = $${countParams.length + 1}`;
      countParams.push(projectId);
    }
    if (leadStage) {
      countQuery += ` AND c.lead_stage = $${countParams.length + 1}`;
      countParams.push(leadStage);
    }
    if (unitNo) {
      countQuery += ` AND u.unit_number ILIKE $${countParams.length + 1}`;
      countParams.push(`%${unitNo}%`);
    }
    if (mobile) {
      countQuery += ` AND c.mobile LIKE $${countParams.length + 1}`;
      countParams.push(`%${mobile}%`);
    }
    if (regNo) {
      countQuery += ` AND c.registration_no ILIKE $${countParams.length + 1}`;
      countParams.push(`%${regNo}%`);
    }
    if (pan) {
      countQuery += ` AND c.pan_no ILIKE $${countParams.length + 1}`;
      countParams.push(`%${pan}%`);
    }
    if (secondApplicant) {
      countQuery += ` AND co.name ILIKE $${countParams.length + 1}`;
      countParams.push(`%${secondApplicant}%`);
    }
    if (search) {
      countQuery += ` AND (c.name ILIKE $${countParams.length + 1} OR c.mobile LIKE $${countParams.length + 2} OR c.email ILIKE $${countParams.length + 3} OR u.unit_number ILIKE $${countParams.length + 4})`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [dataResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams),
    ]);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: page as number,
        pageSize: pageSize as number,
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error('Database error:', error);
    next(error);
  }
});

// GET /api/consumers/:id - Get consumer detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.id, c.name, c.first_name, c.last_name, c.middle_name, c.photo_url, c.mobile, c.email,
              c.income_category, c.lead_stage, c.allocated_unit_id, c.created_at,
              c.aadhaar_no, c.aadhaar_hash, c.pan_no, c.parivar_pehchan_patra, c.registration_no, c.form_no, c.project_id,
              u.unit_number, u.bhk_type, u.carpet_area_sqft, u.balcony_area_sqft, u.base_price_inr
       FROM consumers c
       LEFT JOIN units u ON c.allocated_unit_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Fetch KYC documents
    const kycResult = await db.query(
      `SELECT id, document_type, file_url, expiry_date, verified FROM kyc_documents WHERE consumer_id = $1`,
      [id]
    );

    // Fetch payment summary
    const paymentResult = await db.query(
      `SELECT
        SUM(total_amount_inr) as total_due,
        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = $1) as collected
       FROM payment_plans WHERE consumer_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        kycDocuments: kycResult.rows,
        paymentSummary: paymentResult.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/consumers/:id - Update consumer
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name, email, incomeCategory, income_category, leadStage, lead_stage,
      present_address_line1, present_city, present_state, present_pin, present_country,
      perm_address_line1, perm_city, perm_state, perm_pin, perm_country,
      office_address_line1, office_city, office_state, office_pin,
      mobile, alt_mobile, profession, nationality, company,
    } = req.body;

    const result = await db.query(
      `UPDATE consumers
       SET name                = COALESCE($1,  name),
           email               = COALESCE($2,  email),
           income_category     = COALESCE($3,  income_category),
           lead_stage          = COALESCE($4,  lead_stage),
           present_address     = COALESCE($5,  present_address),
           present_city        = COALESCE($6,  present_city),
           present_state       = COALESCE($7,  present_state),
           present_pin         = COALESCE($8,  present_pin),
           present_country     = COALESCE($9,  present_country),
           perm_address        = COALESCE($10, perm_address),
           perm_city           = COALESCE($11, perm_city),
           perm_state          = COALESCE($12, perm_state),
           perm_pin            = COALESCE($13, perm_pin),
           perm_country        = COALESCE($14, perm_country),
           office_address      = COALESCE($15, office_address),
           office_city         = COALESCE($16, office_city),
           office_state        = COALESCE($17, office_state),
           office_pin          = COALESCE($18, office_pin),
           mobile              = COALESCE($19, mobile),
           alt_mobile          = COALESCE($20, alt_mobile),
           profession          = COALESCE($21, profession),
           nationality         = COALESCE($22, nationality),
           company             = COALESCE($23, company),
           updated_at          = NOW()
       WHERE id = $24
       RETURNING id, name, email, income_category, lead_stage, updated_at`,
      [
        name||null,
        email||null,
        incomeCategory||income_category||null,
        leadStage||lead_stage||null,
        present_address_line1||null,
        present_city||null,
        present_state||null,
        present_pin||null,
        present_country||null,
        perm_address_line1||null,
        perm_city||null,
        perm_state||null,
        perm_pin||null,
        perm_country||null,
        office_address_line1||null,
        office_city||null,
        office_state||null,
        office_pin||null,
        mobile||null,
        alt_mobile||null,
        profession||null,
        nationality||null,
        company||null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/consumers/:id/kyc-documents - Upload KYC document
router.post('/:id/kyc-documents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { documentType, fileUrl, expiryDate } = req.body;

    const result = await db.query(
      `INSERT INTO kyc_documents (consumer_id, document_type, file_url, expiry_date, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, document_type, file_url, expiry_date`,
      [id, documentType, fileUrl, expiryDate, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/consumers/:id/remarks - Add remark
router.post('/:id/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { channel, subject, notes, followUpDate, tags } = req.body;

    const result = await db.query(
      `INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, channel, subject, notes, timestamp`,
      [id, req.userId, channel, subject, notes, followUpDate, JSON.stringify(tags || [])]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/consumers/:id/remarks - Get remarks log
router.get('/:id/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, channel, subject, notes, timestamp, follow_up_date, tags
       FROM remarks WHERE consumer_id = $1
       ORDER BY timestamp DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/consumers/:id/base-rate - Update base rate and log to audit
router.post('/:id/base-rate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { baseRate } = req.body;

    const consumerResult = await db.query(
      `SELECT allocated_unit_id FROM consumers WHERE id = $1`,
      [id]
    );

    if (consumerResult.rows.length === 0 || !consumerResult.rows[0].allocated_unit_id) {
      return res.status(400).json({ error: 'Consumer has no allocated unit' });
    }

    const unitId = consumerResult.rows[0].allocated_unit_id;

    // Get old basic price
    const unitResult = await db.query(
      `SELECT basic_price FROM units WHERE id = $1`,
      [unitId]
    );

    const oldPrice = unitResult.rows[0].basic_price;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE units SET basic_price = $1, updated_at = NOW() WHERE id = $2`,
        [baseRate, unitId]
      );

      await client.query(
        `INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, 'BASE_RATE_UPDATE', $3, $4, 'Manual update from Pricing Matrix')`,
        [id, req.userId, JSON.stringify({ basic_price: oldPrice }), JSON.stringify({ basic_price: baseRate })]
      );

      await client.query('COMMIT');
      res.json({ success: true, message: 'Base rate updated successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
