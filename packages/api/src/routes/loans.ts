import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

/**
 * POST /api/loans - Record Loan Sanction
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, bankName, branchName, loanAmount, sanctionLetterDate, tpaSignedDate, remarks } = req.body;

    const result = await db.query(
      `INSERT INTO loan_details (consumer_id, bank_name, branch_name, loan_amount, sanction_letter_date, tpa_signed_date, remarks, loan_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sanctioned')
       RETURNING id`,
      [consumerId, bankName, branchName, loanAmount, sanctionLetterDate, tpaSignedDate, remarks]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/loans/:consumerId - Get loan details for a consumer
 */
router.get('/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const result = await db.query(
      `SELECT * FROM loan_details WHERE consumer_id = $1`,
      [consumerId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
