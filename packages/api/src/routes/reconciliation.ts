/**
 * Bank Reconciliation Routes - Module D
 * Import bank statements, auto-match to demands/receipts, manual reconciliation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// Interface for parsed CSV row
interface BankStatementRow {
  Date: string;
  Description: string;
  Amount: string;
  Reference?: string;
  Account?: string;
}

interface MatchResult {
  transactionId: string;
  matchStatus: string;
  matchConfidence: number;
  matchedReceiptId?: string;
  matchedDemandId?: string;
}

// Auto-matching algorithm
const autoMatchTransaction = async (
  transaction: {
    transaction_date: Date;
    amount_inr: number;
    transaction_ref: string | null;
  }
): Promise<MatchResult | null> => {
  let bestMatch: MatchResult | null = null;

  // Strategy 1: Exact reference match (confidence: 95)
  if (transaction.transaction_ref) {
    const refMatch = await db.query(
      `SELECT id FROM receipts WHERE transaction_ref = $1 LIMIT 1`,
      [transaction.transaction_ref]
    );

    if (refMatch.rows.length > 0) {
      return {
        transactionId: '',
        matchStatus: 'auto_matched',
        matchConfidence: 95,
        matchedReceiptId: refMatch.rows[0].id,
      };
    }
  }

  // Strategy 2: Amount + date proximity match (confidence: 75 if single, 50 if multiple)
  const amountMatch = await db.query(
    `SELECT d.id as demand_id
     FROM demands d
     WHERE d.amount_due_inr = $1
     AND d.due_date BETWEEN $2::DATE - INTERVAL '7 days' AND $3::DATE + INTERVAL '7 days'
     AND d.delivery_status != 'paid'
     LIMIT 10`,
    [transaction.amount_inr, transaction.transaction_date, transaction.transaction_date]
  );

  if (amountMatch.rows.length === 1) {
    // Single match found - higher confidence
    return {
      transactionId: '',
      matchStatus: 'auto_matched',
      matchConfidence: 75,
      matchedDemandId: amountMatch.rows[0].demand_id,
    };
  } else if (amountMatch.rows.length > 1) {
    // Multiple matches - lower confidence, don't auto-match
    return {
      transactionId: '',
      matchStatus: 'unmatched',
      matchConfidence: 50,
    };
  }

  return null;
};

// POST /api/reconciliation/import - Import bank statement CSV
router.post('/import', requirePermission('payments', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, fileName, csvContent } = req.body;

    // Validate required fields
    if (!projectId || !fileName || !csvContent) {
      return res.status(400).json({ error: 'Missing required fields: projectId, fileName, csvContent' });
    }

    // Parse CSV content
    let records: any[];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid CSV format', details: (parseError as Error).message });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Create import record
    const importResult = await db.query(
      `INSERT INTO bank_statement_imports (project_id, file_name, imported_by_user_id, import_date, total_transactions)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)
       RETURNING id`,
      [projectId, fileName, req.userId, records.length]
    );

    const importId = importResult.rows[0].id;
    let matchedCount = 0;
    let totalAmount = 0;
    const matchResults: MatchResult[] = [];

    // Insert transactions and attempt auto-matching
    for (const record of records) {
      const transactionDate = new Date(record.Date);
      const amount = parseFloat(record.Amount);
      const description = record.Description || '';
      const reference = record.Reference || null;
      const account = record.Account || null;

      if (isNaN(amount) || isNaN(transactionDate.getTime())) {
        continue; // Skip invalid rows
      }

      totalAmount += amount;

      // Attempt auto-match
      const matchAttempt = await autoMatchTransaction({
        transaction_date: transactionDate,
        amount_inr: amount,
        transaction_ref: reference,
      });

      let matchStatus = 'unmatched';
      let matchConfidence = 0;
      let matchedReceiptId = null;
      let matchedDemandId = null;

      if (matchAttempt && matchAttempt.matchConfidence >= 80) {
        matchStatus = 'auto_matched';
        matchConfidence = matchAttempt.matchConfidence;
        matchedReceiptId = matchAttempt.matchedReceiptId || null;
        matchedDemandId = matchAttempt.matchedDemandId || null;
        matchedCount++;
      }

      // Insert transaction
      const txnResult = await db.query(
        `INSERT INTO bank_transactions (
          import_id, transaction_date, description, amount_inr,
          transaction_ref, bank_account, matched_receipt_id, matched_demand_id,
          match_status, match_confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          importId,
          transactionDate,
          description,
          amount,
          reference,
          account,
          matchedReceiptId,
          matchedDemandId,
          matchStatus,
          matchConfidence > 0 ? matchConfidence : null,
        ]
      );

      matchResults.push({
        transactionId: txnResult.rows[0].id,
        matchStatus,
        matchConfidence,
        matchedReceiptId: matchedReceiptId || undefined,
        matchedDemandId: matchedDemandId || undefined,
      });
    }

    // Update import summary
    const unmatchedCount = records.length - matchedCount;
    await db.query(
      `UPDATE bank_statement_imports
       SET matched_count = $1, unmatched_count = $2, total_amount_inr = $3, status = 'completed'
       WHERE id = $4`,
      [matchedCount, unmatchedCount, totalAmount, importId]
    );

    res.status(201).json({
      success: true,
      data: {
        importId,
        fileName,
        totalTransactions: records.length,
        matchedCount,
        unmatchedCount,
        totalAmount,
        matches: matchResults,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reconciliation/imports - List all imports
router.get('/imports', requirePermission('payments', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT
      id, project_id, file_name, imported_by_user_id, import_date,
      total_transactions, matched_count, unmatched_count, total_amount_inr, status,
      created_at
     FROM bank_statement_imports WHERE 1=1`;

    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` ORDER BY import_date DESC`;

    const offset = ((page as number) - 1) * (pageSize as number);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    // Count query
    let countQuery = `SELECT COUNT(*) FROM bank_statement_imports WHERE 1=1`;
    const countParams: any[] = [];

    if (projectId) {
      countQuery += ` AND project_id = $${countParams.length + 1}`;
      countParams.push(projectId);
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
    next(error);
  }
});

// GET /api/reconciliation/imports/:importId/transactions - Get transactions in import
router.get('/imports/:importId/transactions', requirePermission('payments', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { importId } = req.params;
    const { matchStatus, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT
      id, import_id, transaction_date, description, amount_inr,
      transaction_ref, bank_account, matched_receipt_id, matched_demand_id,
      match_status, match_confidence, matched_by_user_id, matched_at, notes,
      created_at
     FROM bank_transactions WHERE import_id = $1`;

    const params: any[] = [importId];

    if (matchStatus) {
      query += ` AND match_status = $${params.length + 1}`;
      params.push(matchStatus);
    }

    query += ` ORDER BY transaction_date DESC`;

    const offset = ((page as number) - 1) * (pageSize as number);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(pageSize, offset);

    // Count query
    let countQuery = `SELECT COUNT(*) FROM bank_transactions WHERE import_id = $1`;
    const countParams: any[] = [importId];

    if (matchStatus) {
      countQuery += ` AND match_status = $${countParams.length + 1}`;
      countParams.push(matchStatus);
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
    next(error);
  }
});

// PATCH /api/reconciliation/transactions/:id/match - Manual match
router.patch('/transactions/:id/match', requirePermission('payments', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { receiptId, demandId, notes } = req.body;

    if (!receiptId && !demandId) {
      return res.status(400).json({ error: 'Must provide either receiptId or demandId' });
    }

    const result = await db.query(
      `UPDATE bank_transactions
       SET matched_receipt_id = COALESCE($1, matched_receipt_id),
           matched_demand_id = COALESCE($2, matched_demand_id),
           match_status = 'manually_matched',
           matched_by_user_id = $3,
           matched_at = NOW(),
           notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING id, match_status, matched_receipt_id, matched_demand_id, notes`,
      [receiptId || null, demandId || null, req.userId, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reconciliation/transactions/:id/ignore - Mark as ignored
router.patch('/transactions/:id/ignore', requirePermission('payments', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await db.query(
      `UPDATE bank_transactions
       SET match_status = 'ignored',
           matched_by_user_id = $1,
           matched_at = NOW(),
           notes = COALESCE($2, notes)
       WHERE id = $3
       RETURNING id, match_status, notes`,
      [req.userId, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
