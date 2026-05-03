/**
 * Booking Routes
 * Handles booking form submission, list, view, and edit booking records
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// Generate registration number with project-based prefix and sequential numbering
async function generateRegistrationNo(projectId: string, client: any): Promise<string> {
  const year = new Date().getFullYear();

  // Get project name for prefix
  const projResult = await client.query(
    'SELECT name FROM projects WHERE id = $1',
    [projectId]
  );

  if (projResult.rowCount === 0) {
    throw new Error('Project not found');
  }

  // Generate 4-letter code from project name
  // ROF ALANTE_TEST → ALAN
  // ROF GALLLERIA_TEST → GALL
  const projectName = projResult.rows[0].name
    .replace(/^ROF\s+/i, '')  // Remove "ROF " prefix
    .replace(/_TEST$/i, '')   // Remove "_TEST" suffix
    .replace(/[^A-Z]/gi, '')  // Keep only letters
    .toUpperCase()
    .substring(0, 4)           // Take first 4 letters
    .padEnd(4, 'X');           // Pad if shorter

  // Increment counter atomically
  let counterResult = await client.query(
    `UPDATE booking_counters
     SET last_number = last_number + 1,
         updated_at = NOW()
     WHERE project_id = $1
     RETURNING last_number`,
    [projectId]
  );

  if (counterResult.rowCount === 0) {
    // Insert if not exists (race condition safety)
    await client.query(
      `INSERT INTO booking_counters (project_id, last_number)
       VALUES ($1, 1)
       ON CONFLICT (project_id)
       DO UPDATE SET
         last_number = booking_counters.last_number + 1,
         updated_at = NOW()`,
      [projectId]
    );
    // Fetch the updated value
    counterResult = await client.query(
      'SELECT last_number FROM booking_counters WHERE project_id = $1',
      [projectId]
    );
  }

  const num = counterResult.rows[0].last_number;
  return `${projectName}-${year}-${String(num).padStart(4, '0')}`;
}

// POST /api/booking
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      consumer_id, project_id, unit_id, booking_date, booking_amount,
      payment_mode, payment_ref, bank_name, cheque_date,
      discount_value, discount_reason, discount_authorized_by,
      broker_id, broker_commission, broker_commission_type,
      sales_employee_id, nominee_name, nominee_relation,
      loan_amount, finance_bank, remarks, form_no,
    } = req.body;

    if (!consumer_id) return res.status(400).json({ error: 'consumer_id is required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Prevent Double Booking: Check if unit is available
      if (unit_id) {
        const unitCheck = await client.query(
          `SELECT status FROM units WHERE id = $1 FOR UPDATE`,
          [unit_id]
        );

        if (unitCheck.rows.length === 0) {
          throw new Error('Selected unit does not exist');
        }

        if (unitCheck.rows[0].status !== 'available') {
          throw new Error('Double Booking Prevented: Unit is no longer available');
        }
      }

      // Generate registration and form numbers
      const registrationNo = await generateRegistrationNo(project_id, client);
      const formNo = form_no || registrationNo;

      const result = await client.query(
        `INSERT INTO booking_records (
           consumer_id, project_id, unit_id, booking_date, booking_amount,
           payment_mode, payment_ref, bank_name, cheque_date,
           discount_value, discount_reason, discount_authorized_by,
           broker_id, broker_commission, broker_commission_type,
           sales_employee_id, nominee_name, nominee_relation,
           loan_amount, finance_bank, remarks, registration_no, form_no, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [
          consumer_id, project_id||null, unit_id||null,
          booking_date||new Date().toISOString().split('T')[0],
          parseFloat(booking_amount||0),
          payment_mode||null, payment_ref||null, bank_name||null, cheque_date||null,
          parseFloat(discount_value||0), discount_reason||null, discount_authorized_by||null,
          broker_id||null, parseFloat(broker_commission||0), broker_commission_type||'flat',
          sales_employee_id||null, nominee_name||null, nominee_relation||null,
          loan_amount?parseFloat(loan_amount):null, finance_bank||null, remarks||null,
          registrationNo, formNo,
          req.userId,
        ]
      );

      // If unit was selected, update unit status to 'booked'
      if (unit_id) {
        await client.query(`UPDATE units SET status = 'booked', updated_at = NOW() WHERE id = $1`, [unit_id]);
      }

      // Update consumer with registration number and form number
      await client.query(
        `UPDATE consumers SET registration_no = $1, form_no = $2 WHERE id = $3`,
        [registrationNo, formNo, consumer_id]
      );

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          registration_no: registrationNo,
          form_no: formNo
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// GET /api/booking
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, consumer_id, status, page = 1, pageSize = 20 } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (project_id) { where += ` AND br.project_id = $${params.length+1}`; params.push(project_id); }
    if (consumer_id){ where += ` AND br.consumer_id = $${params.length+1}`; params.push(consumer_id); }
    if (status)     { where += ` AND br.status = $${params.length+1}`; params.push(status); }

    const offset = ((page as number) - 1) * (pageSize as number);
    params.push(pageSize, offset);

    const result = await db.query(`
      SELECT br.*, c.name as consumer_name, c.mobile, p.name as project_name, u.unit_number
      FROM booking_records br
      JOIN consumers c ON c.id = br.consumer_id
      LEFT JOIN projects p ON p.id = br.project_id
      LEFT JOIN units u ON u.id = br.unit_id
      ${where}
      ORDER BY br.created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/booking/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT br.*, c.name as consumer_name, c.mobile, p.name as project_name, u.unit_number
      FROM booking_records br
      JOIN consumers c ON c.id = br.consumer_id
      LEFT JOIN projects p ON p.id = br.project_id
      LEFT JOIN units u ON u.id = br.unit_id
      WHERE br.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
