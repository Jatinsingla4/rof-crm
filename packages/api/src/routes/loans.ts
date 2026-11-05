import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, text, day, body, pos, inTx, lock, paging } from '../utils/input.js';
import { businessTomorrow } from '../utils/business-date.js';

const router = Router();
const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next);

/**
 * POST /api/loans - Record Loan Sanction (mounted with rbac('consumers'): needs consumers:create)
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.consumerId)) throw bad('consumerId is required');
    const consumerId = uuid(b.consumerId, 'consumerId'), bankName = text(b.bankName, 'bankName', 255, true), branchName = text(b.branchName, 'branchName', 255, false);
    const loanAmount = has(b.loanAmount) ? pos(typeof b.loanAmount === 'string' ? b.loanAmount.trim() : b.loanAmount, 'loanAmount', 0) : null;
    const sanction = day(b.sanctionLetterDate, 'sanctionLetterDate'), tpa = day(b.tpaSignedDate, 'tpaSignedDate'), remarks = text(b.remarks, 'remarks', 500, false);
    if (sanction && tpa && tpa < sanction) throw bad('The TPA cannot be signed before the sanction letter date');
    // a letter or agreement that is dated tomorrow or later has not happened yet (one day of room for the time zone)
    const soon = businessTomorrow();
    if (sanction && sanction > soon) throw bad('The sanction letter date cannot be in the future');
    if (tpa && tpa > soon) throw bad('The TPA signed date cannot be in the future');

    const row = await inTx(async (c) => {
      if (!(await c.query(`SELECT 1 FROM consumers WHERE id = $1`, [consumerId])).rows.length) throw bad('Applicant not found', 404);
      await lock(c, 'loan:' + consumerId);
      // a loan many times the price of the applicant's unit is a typing mistake (GST and add-ons ride on top, so 20% room)
      const price = (await c.query(`SELECT GREATEST(COALESCE(u.total_price_inr, 0), COALESCE(u.base_price_inr, 0)) AS p FROM allocations a JOIN units u ON u.id = a.unit_id WHERE a.consumer_id = $1 AND a.status NOT IN ('cancelled', 'transferred') ORDER BY a.created_at DESC LIMIT 1`, [consumerId])).rows[0];
      if (loanAmount && price && Number(price.p) > 0 && loanAmount > Number(price.p) * 1.2) throw bad(`The loan is far more than the price of the unit (about Rs ${Number(price.p).toLocaleString('en-IN')}). Please check it.`);
      if ((await c.query(
        `SELECT 1 FROM loan_details WHERE consumer_id = $1 AND bank_name = $2 AND loan_amount IS NOT DISTINCT FROM $3 AND sanction_letter_date IS NOT DISTINCT FROM $4::date`, [consumerId, bankName, loanAmount, sanction]
      )).rows.length) throw bad('This loan is already recorded', 409);
      return (await c.query(
        `INSERT INTO loan_details (consumer_id, bank_name, branch_name, loan_amount, sanction_letter_date, tpa_signed_date, remarks, loan_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'sanctioned') RETURNING id`,
        [consumerId, bankName, branchName, loanAmount, sanction, tpa, remarks]
      )).rows[0];
    });
    await auditChange(db, req, res, 'create', 'loan_detail', row.id, undefined, { consumer_id: consumerId, bank_name: bankName, loan_amount: loanAmount });
    res.status(201).json({ success: true, data: row });
  } catch (error) { fail(error, res, next); }
});

/**
 * GET /api/loans - every recorded loan with the applicant's name (the Loans screen list)
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { size, offset } = paging(req.query, 200, 1000);
    const result = await db.query(
      `SELECT l.*, c.name AS consumer_name FROM loan_details l JOIN consumers c ON c.id = l.consumer_id ORDER BY l.created_at DESC LIMIT ${size} OFFSET ${offset}`);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

/**
 * GET /api/loans/:consumerId - Get loan details for a consumer
 */
router.get('/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`SELECT * FROM loan_details WHERE consumer_id = $1 ORDER BY created_at DESC`, [uuid(req.params.consumerId, 'Consumer id')]);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

router.use(pgErrorHandler);
export default router;
