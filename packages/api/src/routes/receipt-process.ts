import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// --- JOURNAL ENTRIES ---

// GET /api/payments/journals - List all journal entries
router.get('/journals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, page = 1, pageSize = 50 } = req.query;
    let query = `SELECT je.*, c.name as consumer_name 
                 FROM journal_entries je
                 LEFT JOIN consumers c ON je.consumer_id = c.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      params.push(consumerId);
      query += ` AND je.consumer_id = $${params.length}`;
    }

    query += ` ORDER BY je.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/payments/journals - Create journal entry
router.post('/journals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, entryDate, debitAmount, creditAmount, ledgerHead, remarks } = req.body;
    
    if (!consumerId || !ledgerHead) {
      return res.status(400).json({ error: 'consumerId and ledgerHead required' });
    }

    const entryNo = `JE/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`;
    
    const result = await db.query(
      `INSERT INTO journal_entries (entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [entryNo, entryDate || new Date(), consumerId, debitAmount || 0, creditAmount || 0, ledgerHead, remarks]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// --- TDS MANAGEMENT ---

// GET /api/payments/tds/challans - List TDS challans
router.get('/tds/challans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`SELECT * FROM tds_challans ORDER BY challan_date DESC`);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/payments/tds/challans - Upload TDS challan
router.post('/tds/challans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { challanNumber, challanDate, amount, bankName, fileUrl } = req.body;
    const result = await db.query(
      `INSERT INTO tds_challans (challan_number, challan_date, amount, bank_name, file_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [challanNumber, challanDate, amount, bankName, fileUrl]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// POST /api/payments/tds/assign - Assign TDS to Receipt
router.post('/tds/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { challanId, receiptId, amount } = req.body;
    await client.query('BEGIN');
    
    // Get consumer from receipt
    const rRes = await client.query('SELECT consumer_id FROM receipts WHERE id = $1', [receiptId]);
    if (rRes.rows.length === 0) throw new Error('Receipt not found');
    const consumerId = rRes.rows[0].consumer_id;

    const result = await client.query(
      `INSERT INTO tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [challanId, consumerId, receiptId, amount]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
