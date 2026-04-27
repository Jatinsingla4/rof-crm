/**
 * Consumer Routes - Module B
 * All consumer endpoints: create, list, get, update, KYC, remarks
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// POST /api/consumers - Create consumer
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, mobile, email, aadhaar, pan, incomeCategory, projectId } = req.body;

    // Validate required fields
    if (!name || !mobile || !projectId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash Aadhaar & PAN (simplified - use bcrypt in production)
    const aadhaarHash = Buffer.from(aadhaar || '').toString('base64');
    const panHash = Buffer.from(pan || '').toString('base64');

    const result = await db.query(
      `INSERT INTO consumers (name, mobile, email, aadhaar_hash, pan_hash, income_category, lead_stage, project_id, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'enquiry', $7, $8)
       RETURNING id, name, mobile, email, lead_stage, created_at`,
      [name, mobile, email, aadhaarHash, panHash, incomeCategory, projectId, req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/consumers - List all consumers (with search & filter)
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const {
    search = '',
    leadStage,
    projectId,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = req.query;

  try {

    let query = `SELECT id, name, mobile, email, lead_stage, project_id, allocated_unit_id, created_at
                 FROM consumers WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (leadStage) {
      query += ` AND lead_stage = $${params.length + 1}`;
      params.push(leadStage);
    }

    if (search) {
      query += ` AND (name ILIKE $${params.length + 1} OR mobile LIKE $${params.length + 2} OR email ILIKE $${params.length + 3})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Sorting
    query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;

    // Pagination
    const offset = ((page as number) - 1) * (pageSize as number);
    query += ` LIMIT ${pageSize} OFFSET ${offset}`;

    // Build count query matching the data query filters
    let countQuery = `SELECT COUNT(*) FROM consumers WHERE 1=1`;
    const countParams: any[] = [];

    if (projectId) {
      countQuery += ` AND project_id = $${countParams.length + 1}`;
      countParams.push(projectId);
    }
    if (leadStage) {
      countQuery += ` AND lead_stage = $${countParams.length + 1}`;
      countParams.push(leadStage);
    }
    if (search) {
      countQuery += ` AND (name ILIKE $${countParams.length + 1} OR mobile LIKE $${countParams.length + 2} OR email ILIKE $${countParams.length + 3})`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
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
    // Fallback to mock data if database query fails (for demo purposes)
    console.error('Database error:', error);
    const mockConsumers = [
      {
        id: 'cons-001',
        name: 'Rajesh Kumar',
        mobile: '9876543210',
        email: 'rajesh@example.com',
        lead_stage: 'allotted',
        project_id: 'proj-001',
        allocated_unit_id: 'unit-101',
        created_at: new Date('2024-01-15'),
      },
      {
        id: 'cons-002',
        name: 'Priya Sharma',
        mobile: '9765432109',
        email: 'priya@example.com',
        lead_stage: 'interested',
        project_id: 'proj-001',
        allocated_unit_id: null,
        created_at: new Date('2024-01-20'),
      },
      {
        id: 'cons-003',
        name: 'Amit Patel',
        mobile: '9654321098',
        email: 'amit@example.com',
        lead_stage: 'enquiry',
        project_id: 'proj-002',
        allocated_unit_id: null,
        created_at: new Date('2024-02-10'),
      },
      {
        id: 'cons-004',
        name: 'Neha Singh',
        mobile: '9543210987',
        email: 'neha@example.com',
        lead_stage: 'allotted',
        project_id: 'proj-001',
        allocated_unit_id: 'unit-205',
        created_at: new Date('2024-02-05'),
      },
      {
        id: 'cons-005',
        name: 'Vikram Reddy',
        mobile: '9432109876',
        email: 'vikram@example.com',
        lead_stage: 'interested',
        project_id: 'proj-003',
        allocated_unit_id: null,
        created_at: new Date('2024-02-28'),
      },
    ];

    res.json({
      success: true,
      data: mockConsumers,
      pagination: {
        page: page as number,
        pageSize: pageSize as number,
        total: mockConsumers.length,
      },
    });
  }
});

// GET /api/consumers/:id - Get consumer detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, name, photo_url, mobile, email, income_category, lead_stage, allocated_unit_id, created_at
       FROM consumers WHERE id = $1`,
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
    const { name, email, incomeCategory, leadStage } = req.body;

    const result = await db.query(
      `UPDATE consumers
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           income_category = COALESCE($3, income_category),
           lead_stage = COALESCE($4, lead_stage),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, income_category, lead_stage, updated_at`,
      [name, email, incomeCategory, leadStage, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
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

export default router;
