/**
 * Payment Routes - Module D
 * Payment plans, demand letters, receipts, HRERA Rule 15 penal interest
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { buildEditScript, applyOverridesToHtml } from '../utils/document-recalc.js';
import { applyWaterfall, WaterfallReceipt, WaterfallDemand, buildInterestRows } from '../utils/payment-waterfall.js';
import { requireProcess } from '../middleware/processPermission.js';

const router = Router();

/**
 * Calculate Penal Interest (Late Payment Penalty)
 * HRERA Rule 15: 11.10% per annum
 */
const getPenalInterestRate = async (projectId?: string): Promise<number> => {
  try {
    if (projectId) {
      const projRate = await db.query(
        `SELECT rate_percent FROM project_interest_rates WHERE project_id = $1 AND effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1`,
        [projectId]
      );
      if (projRate.rows.length > 0) return parseFloat(projRate.rows[0].rate_percent);
    }
    const res = await db.query("SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent'");
    return res.rows.length > 0 ? parseFloat(res.rows[0].value) : 11.10;
  } catch {
    return 11.10;
  }
};

const calculatePenalInterest = (principalInr: number, daysOverdue: number, rate: number = 11.10): number => {
  return Math.round((principalInr * rate * daysOverdue / 365) / 100);
};

// POST /api/payments/payment-plans - Create payment plan (AHP-compliant)
router.post('/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { allocationId, consumerId, unitId, projectId, totalAmountInr, allotmentDate } = req.body;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, total_amount_inr`,
        [allocationId, consumerId, unitId, projectId, totalAmountInr, req.userId]
      );

      const planId = result.rows[0].id;

      // Dynamic Schedule Generator
      const d = new Date(allotmentDate || new Date());
      const m = (days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd.toISOString().split('T')[0]; };
      
      const schedule = [
        { sn:1, name:'At the time of Application', pct:5, due: m(0) },
        { sn:2, name:'Within 15 days of Allotment', pct:20, due: m(15) },
        { sn:3, name:'Within 6 months from Allotment', pct:12.5, due: m(180) },
        { sn:4, name:'Within 12 months from Allotment', pct:12.5, due: m(360) },
        { sn:5, name:'Within 18 months from Allotment', pct:12.5, due: m(540) },
        { sn:6, name:'Within 24 months from Allotment', pct:12.5, due: m(720) },
        { sn:7, name:'Within 30 months from Allotment', pct:12.5, due: m(900) },
        { sn:8, name:'Within 36 months from Allotment', pct:12.5, due: m(1080) },
      ];

      const gstSettingsRes = await client.query(
        `SELECT key, value FROM global_settings WHERE key IN ('basic_cgst_percent', 'basic_sgst_percent')`
      );
      const gstSettings = Object.fromEntries(gstSettingsRes.rows.map((r: any) => [r.key, parseFloat(r.value)]));
      const legacyCgstPct = (gstSettings['basic_cgst_percent'] ?? 0.5) / 100;
      const legacySgstPct = (gstSettings['basic_sgst_percent'] ?? 0.5) / 100;

      for (const s of schedule) {
        const amt = Math.round(totalAmountInr * (s.pct / 100));
        const cgst = Math.round(amt * legacyCgstPct);
        const sgst = Math.round(amt * legacySgstPct);
        await client.query(
          `INSERT INTO demands (payment_plan_id, consumer_id, installment_index, amount_due_inr, cgst_amount, sgst_amount, due_date, status, demand_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
          [planId, consumerId, s.sn, amt, cgst, sgst, s.due, s.name]
        );
      }

      await client.query(
        `INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
         VALUES ($1, $2, 'SCHEDULE_GENERATION', $3, 'AHP Payment Schedule Generated')`,
        [consumerId, req.userId, JSON.stringify({ allotment_date: allotmentDate, schedule })]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          planId,
          schedule
        },
      });
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

// GET /api/payments/overdue - List overdue payments with HRERA interest
router.get('/overdue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
        d.id, d.payment_plan_id, d.consumer_id, d.amount_due_inr, d.due_date,
        EXTRACT(DAY FROM NOW() - d.due_date)::INT as days_overdue,
        c.name as consumer_name, c.mobile
       FROM demands d
       JOIN consumers c ON d.consumer_id = c.id
       WHERE d.due_date < NOW()
       ORDER BY days_overdue DESC`
    );

    // Calculate penal interest for each
    const penalRate = await getPenalInterestRate();
    const data = result.rows.map((row) => ({
      ...row,
      penalInterestInr: row.days_overdue > 0 ? calculatePenalInterest(row.amount_due_inr, row.days_overdue, penalRate) : 0,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/receipts - Record payment receipt
router.post('/receipts', requireProcess('receipt', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      consumerId, amountReceivedInr, paymentDate, paymentMode,
      referenceNumber, bankName, branch, remarks,
      baseAmount, plcAmount, edcAmount, idcAmount,
      otherChargeAmount, otherChargeDesc, interestAmount,
      isOtherPayment,
      // legacy fields
      paymentPlanId: legacyPlanId, installmentIndex: legacyIdx,
      paymentMethod, transactionRef, receivedDate,
    } = req.body;

    const amount = amountReceivedInr || baseAmount;
    if (!consumerId || !amount) {
      return res.status(400).json({ error: 'consumerId and amount are required' });
    }

    // Look up the consumer's payment plan
    const planResult = await db.query(
      `SELECT id FROM payment_plans WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [consumerId]
    );
    let resolvedPlanId: string | null = legacyPlanId || (planResult.rows[0]?.id) || null;

    // Fallback: find any payment plan for this consumer's project
    if (!resolvedPlanId) {
      const projResult = await db.query(
        `SELECT pp.id FROM payment_plans pp
         JOIN units u ON u.id = pp.unit_id
         JOIN booking_records br ON br.consumer_id = $1
         WHERE u.project_id = (
           SELECT u2.project_id FROM units u2
           JOIN booking_records br2 ON br2.unit_id = u2.id AND br2.consumer_id = $1
           LIMIT 1
         )
         LIMIT 1`,
        [consumerId]
      );
      resolvedPlanId = projResult.rows[0]?.id || null;
    }

    // Get next installment_index for this plan (null if no plan; receipts.payment_plan_id is now nullable)
    let resolvedIdx: number | null = (legacyIdx != null ? Number(legacyIdx) : null);
    // Auto-increment only when a plan exists, no index given, AND it's not an explicit "Other" payment
    if (resolvedPlanId && resolvedIdx == null && !isOtherPayment) {
      const idxResult = await db.query(
        `SELECT COALESCE(MAX(installment_index), 0) + 1 as next_idx FROM receipts WHERE payment_plan_id = $1 AND installment_index IS NOT NULL`,
        [resolvedPlanId]
      );
      resolvedIdx = idxResult.rows[0].next_idx;
    }

    const receiptDate = paymentDate || receivedDate || new Date().toISOString().split('T')[0];
    const method = paymentMode || paymentMethod || 'cash';
    const ref = referenceNumber || transactionRef || null;

    // Generate receipt number REC-YYYY-XXXXX
    const receiptNumber = `REC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const bankNameVal  = bankName  || null;
    const branchVal    = branch    || null;
    const chequeNoVal  = req.body.chequeNo   || req.body.cheque_no   || null;
    const chequeDateVal = req.body.chequeDate || req.body.cheque_date || null;

    // Cheque duplicate check — only for cheque payments
    if (chequeNoVal && chequeNoVal.trim()) {
      const dupCheck = await db.query(
        `SELECT id, cheque_no, status
         FROM receipts
         WHERE cheque_no = $1
           AND status NOT IN ('bounced', 'cancelled')
         LIMIT 1`,
        [chequeNoVal.trim()]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Cheque No. "${chequeNoVal.trim()}" is already in use (status: ${dupCheck.rows[0].status}). Only bounced or cancelled cheques can be reused.`,
        });
      }
    }

    const result = await db.query(
      `INSERT INTO receipts
         (payment_plan_id, installment_index, consumer_id, amount_received_inr,
          payment_method, transaction_ref, received_date, received_by_user_id, receipt_number,
          plc_amount, edc_amount, idc_amount, other_charge_amount, other_charge_desc, interest_amount,
          bank_name, branch, cheque_no, cheque_date, status, approval_status, print_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', 'pending', 'not_printed')
       RETURNING id, receipt_number, amount_received_inr, plc_amount, edc_amount, idc_amount, other_charge_amount, interest_amount, status`,
      [resolvedPlanId, resolvedIdx, consumerId, amount, method, ref, receiptDate, req.userId, receiptNumber,
       parseFloat(plcAmount||0), parseFloat(edcAmount||0), parseFloat(idcAmount||0),
       parseFloat(otherChargeAmount||0), otherChargeDesc||null, parseFloat(interestAmount||0),
       bankNameVal, branchVal, chequeNoVal, chequeDateVal]
    );

    const receiptId = result.rows[0].id;

    // Auto-match receipt to demand, then apply partial/full/excess payment logic
    try {
      if (resolvedPlanId && resolvedIdx != null) {
        const matchedDemand = await db.query(
          `SELECT d.id, d.amount_due_inr, d.cgst_amount, d.sgst_amount,
                  d.installment_index, d.consumer_id
           FROM demands d
           WHERE d.payment_plan_id = $1
             AND d.installment_index = $2
             AND d.status != 'paid'
           ORDER BY d.created_at ASC
           LIMIT 1`,
          [resolvedPlanId, resolvedIdx]
        );
        if (matchedDemand.rows[0]) {
          const demand = matchedDemand.rows[0];
          await db.query(`UPDATE receipts SET demand_id = $1 WHERE id = $2`, [demand.id, receiptId]);

          // Sum all non-cancelled receipts linked to this demand
          const paidResult = await db.query(
            `SELECT COALESCE(SUM(amount_received_inr), 0) as total_paid
             FROM receipts
             WHERE demand_id = $1 AND status != 'cancelled'`,
            [demand.id]
          );
          const totalPaid = parseFloat(paidResult.rows[0].total_paid);
          const amountDue = parseFloat(demand.amount_due_inr)
                          + parseFloat(demand.cgst_amount || 0)
                          + parseFloat(demand.sgst_amount || 0);

          if (totalPaid >= amountDue) {
            // Fully paid (or excess)
            await db.query(
              `UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`,
              [demand.id]
            );

            const excess = totalPaid - amountDue;
            if (excess > 0) {
              // Find next unpaid demand in the same plan
              const nextDemand = await db.query(
                `SELECT id FROM demands
                 WHERE payment_plan_id = $1
                   AND consumer_id = $2
                   AND installment_index > $3
                   AND status != 'paid'
                 ORDER BY installment_index ASC
                 LIMIT 1`,
                [resolvedPlanId, demand.consumer_id, demand.installment_index]
              );
              if (nextDemand.rows[0]) {
                const nextId = nextDemand.rows[0].id;
                const advanceNum = `REC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}-ADV`;
                await db.query(
                  `INSERT INTO receipts
                     (consumer_id, payment_plan_id, demand_id, amount_received_inr,
                      payment_method, received_date, received_by_user_id, receipt_number,
                      plc_amount, status, approval_status, print_status,
                      is_advance, advance_from_demand_id)
                   VALUES ($1,$2,$3,$4,'advance',CURRENT_DATE,$5,$6,0,'pending','pending','not_printed',true,$7)`,
                  [demand.consumer_id, resolvedPlanId, nextId, excess,
                   req.userId, advanceNum, demand.id]
                );
                await db.query(
                  `UPDATE payment_plans SET advance_amount = COALESCE(advance_amount, 0) + $1, updated_at = NOW() WHERE id = $2`,
                  [excess, resolvedPlanId]
                );
              }
            }
          } else {
            // Partial payment
            await db.query(
              `UPDATE demands SET delivery_status = 'partial', updated_at = NOW() WHERE id = $1`,
              [demand.id]
            );
          }
        }
      }
    } catch (matchErr: any) {
      console.warn('Demand auto-match failed:', matchErr.message);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/dashboard - Payment dashboard KPIs
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `
      SELECT
        COALESCE(SUM(total_amount_inr), 0) as total_receivables,
        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts) as total_collected,
        (SELECT COUNT(*) FROM demands WHERE due_date < NOW()) as overdue_count
      FROM payment_plans
    `;

    if (projectId) {
      query += ` WHERE project_id = $1`;
    }

    const result = await db.query(query, projectId ? [projectId] : []);
    const {
      total_receivables: totalReceivables,
      total_collected: totalCollected,
      overdue_count: overdueCount,
    } = result.rows[0];

    const collectionPercentage =
      totalReceivables > 0 ? Math.round((totalCollected / totalReceivables) * 100) : 0;
    const outstanding = totalReceivables - totalCollected;

    res.json({
      success: true,
      data: {
        kpis: {
          totalReceivables,
          totalCollected,
          collectionPercentage,
          outstanding,
          overdueCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/demands/generate - Create pending demand records from a consumer's payment plan
// planName is optional; if omitted, uses the first available plan for the project
router.post('/demands/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, planName } = req.body;
    if (!consumerId && !projectId) {
      return res.status(400).json({ error: 'consumerId or projectId required' });
    }

    // Find payment plans for the consumer(s) — include nationality for GST calculation
    let planQuery = `
      SELECT pp.id as payment_plan_id, pp.consumer_id, pp.unit_id, pp.project_id,
             pp.total_amount_inr, c.name as consumer_name,
             COALESCE(c.nationality, 'indian') as nationality,
             br.booking_date
      FROM payment_plans pp
      JOIN consumers c ON c.id = pp.consumer_id
      LEFT JOIN booking_records br ON br.consumer_id = c.id AND br.unit_id IS NOT NULL
      WHERE 1=1
    `;
    const planParams: any[] = [];
    if (consumerId) {
      planQuery += ` AND pp.consumer_id = $${planParams.length + 1}`;
      planParams.push(consumerId);
    }
    if (projectId) {
      planQuery += ` AND pp.project_id = $${planParams.length + 1}`;
      planParams.push(projectId);
    }

    const plans = await db.query(planQuery, planParams);
    if (plans.rows.length === 0) {
      return res.status(404).json({ error: 'No payment plans found for the given criteria' });
    }

    const gstRes = await db.query(
      `SELECT key, value FROM global_settings WHERE key IN ('basic_cgst_percent', 'basic_sgst_percent')`
    );
    const gstMap = Object.fromEntries(gstRes.rows.map((r: any) => [r.key, parseFloat(r.value)]));
    const basicCgstPct = (gstMap['basic_cgst_percent'] ?? 0.5) / 100;
    const basicSgstPct = (gstMap['basic_sgst_percent'] ?? 0.5) / 100;

    let totalCreated = 0;
    const created: any[] = [];

    for (const plan of plans.rows) {
      // Resolve the plan name: use provided → consumer's booking_records.selected_plan_name → alphabetically first
      let resolvedPlanName = planName;
      if (!resolvedPlanName) {
        const brRow = await db.query(
          `SELECT selected_plan_name FROM booking_records
           WHERE consumer_id = $1 AND unit_id IS NOT NULL AND selected_plan_name IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [plan.consumer_id]
        );
        resolvedPlanName = brRow.rows[0]?.selected_plan_name;
      }
      if (!resolvedPlanName) {
        const firstPlan = await db.query(
          `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name LIMIT 1`,
          [plan.project_id]
        );
        resolvedPlanName = firstPlan.rows[0]?.plan_name;
      }
      if (!resolvedPlanName) continue;

      // Get installment templates for this plan
      const templates = await db.query(
        `SELECT installment_index, installment_name, percentage, installment_type, COALESCE(due_date_offset_days, 30) as due_date_offset_days
         FROM plan_schedule_templates
         WHERE project_id = $1 AND plan_name = $2
         ORDER BY installment_index`,
        [plan.project_id, resolvedPlanName]
      );

      for (const tmpl of templates.rows) {
        // Skip if a demand already exists for this consumer + installment index
        const existing = await db.query(
          `SELECT id FROM demands WHERE consumer_id = $1 AND installment_index = $2 AND payment_plan_id = $3`,
          [plan.consumer_id, tmpl.installment_index, plan.payment_plan_id]
        );
        if (existing.rows.length > 0) continue;

        const pct = parseFloat(tmpl.percentage) / 100;
        const amountDue = Math.round(plan.total_amount_inr * pct);

        // GST: AHP rate is 1% total. Residents pay 0.5% CGST + 0.5% SGST.
        // NRIs pay IGST instead (intrastate split doesn't apply); store as 0 CGST/SGST.
        // Rates are read from global_settings (basic_cgst_percent / basic_sgst_percent).
        const isNri = plan.nationality === 'nri' || plan.nationality === 'NRI';
        const cgstAmount = isNri ? 0 : Math.round(amountDue * basicCgstPct);
        const sgstAmount = isNri ? 0 : Math.round(amountDue * basicSgstPct);

        const bookingDate = plan.booking_date || new Date().toISOString().split('T')[0];
        const offsetDays = tmpl.due_date_offset_days || 0;
        const dueDate = offsetDays > 0
          ? new Date(new Date(bookingDate).getTime() + offsetDays * 24 * 60 * 60 * 1000)
              .toISOString().split('T')[0]
          : null;

        const ins = await db.query(
          `INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr,
                                cgst_amount, sgst_amount,
                                status, demand_type, delivery_status, generated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, 'pending', NOW())
           RETURNING id, installment_index, amount_due_inr, cgst_amount, sgst_amount, status`,
          [plan.payment_plan_id, tmpl.installment_index, plan.consumer_id, dueDate, amountDue,
           cgstAmount, sgstAmount, tmpl.installment_type || tmpl.installment_name]
        );
        created.push({ ...ins.rows[0], consumer_name: plan.consumer_name });
        totalCreated++;
      }
    }

    res.json({ success: true, data: { totalCreated, demands: created } });
  } catch (err) { next(err); }
});

// GET /api/payments/demands/by-stage - Stage×Tower grouped view for legacy Stage Wise grid
router.get('/demands/by-stage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const result = await db.query(`
      SELECT
        d.installment_index,
        COALESCE(
          (SELECT pst.installment_name
           FROM plan_schedule_templates pst
           WHERE pst.project_id = $1
             AND pst.installment_index = d.installment_index
           ORDER BY pst.plan_name
           LIMIT 1),
          'Stage ' || d.installment_index
        ) AS installment_name,
        t.id   AS tower_id,
        t.tower_name,
        COUNT(DISTINCT d.consumer_id)                                              AS total_consumers,
        COUNT(DISTINCT d.consumer_id) FILTER (WHERE d.status = 'pending')          AS pending_count,
        COUNT(DISTINCT d.consumer_id) FILTER (WHERE d.status = 'demanded')         AS raised_count,
        MIN(d.due_date)     FILTER (WHERE d.status = 'demanded')                   AS installment_date,
        MIN(d.generated_at) FILTER (WHERE d.status = 'demanded')                   AS raised_at,
        ARRAY_AGG(d.id) FILTER (WHERE d.status = 'pending')                        AS pending_demand_ids,
        ARRAY_AGG(d.id) FILTER (WHERE d.status = 'demanded')                       AS raised_demand_ids
      FROM demands d
      JOIN consumers c  ON c.id  = d.consumer_id
      JOIN allocations a ON a.consumer_id = c.id
      JOIN units u      ON u.id  = a.unit_id
      JOIN towers t     ON t.id  = u.tower_id
      WHERE a.project_id = $1
      GROUP BY d.installment_index, t.id, t.tower_name
      HAVING COUNT(DISTINCT d.consumer_id) > 0
      ORDER BY d.installment_index ASC, t.tower_name ASC
    `, [projectId]);

    // Group flat rows into nested stages → towers structure
    const stageMap: Record<number, { installment_index: number; installment_name: string; towers: any[] }> = {};
    for (const row of result.rows) {
      const idx = row.installment_index;
      if (!stageMap[idx]) {
        stageMap[idx] = { installment_index: idx, installment_name: row.installment_name, towers: [] };
      }
      stageMap[idx].towers.push({
        tower_id:           row.tower_id,
        tower_name:         row.tower_name,
        total_consumers:    parseInt(row.total_consumers),
        pending_count:      parseInt(row.pending_count),
        raised_count:       parseInt(row.raised_count),
        installment_date:   row.installment_date   ? new Date(row.installment_date).toISOString().split('T')[0] : null,
        raised_at:          row.raised_at           || null,
        pending_demand_ids: row.pending_demand_ids  || [],
        raised_demand_ids:  row.raised_demand_ids   || [],
      });
    }

    const stages = Object.values(stageMap).sort((a, b) => a.installment_index - b.installment_index);
    res.json({ success: true, stages });
  } catch (err) { next(err); }
});

// GET /api/payments/demands - List all demands (with legacy fetch grid support)
router.get('/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, installmentType, installmentIndex, tower, towerId, floor, registrationNo, name, unitAddress, from, to, dateFrom, dateTo, raisedFrom, raisedTo, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT d.id, d.installment_index, d.consumer_id, d.amount_due_inr, d.cgst_amount, d.sgst_amount,
                        d.due_date, d.status, d.demand_type, d.delivery_status, d.sent_at, d.generated_at,
                        c.name as consumer_name, c.mobile,
                        br.registration_no,
                        u.unit_number as unit_address, u.bhk_type as unit_type, u.floor,
                        tw.tower_name,
                        p.name as project_name,
                        COALESCE(pst.installment_name, 'Instalment ' || d.installment_index::text) AS installment_name,
                        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = c.id AND status != 'cancelled') as total_paid
                 FROM demands d
                 JOIN consumers c ON d.consumer_id = c.id
                 JOIN payment_plans pp ON pp.id = d.payment_plan_id
                 JOIN units u ON u.id = pp.unit_id
                 JOIN projects p ON u.project_id = p.id
                 LEFT JOIN towers tw ON u.tower_id = tw.id
                 LEFT JOIN booking_records br ON br.consumer_id = c.id AND br.unit_id IS NOT NULL
                 LEFT JOIN plan_schedule_templates pst
                   ON pst.project_id = u.project_id
                   AND pst.installment_index = d.installment_index
                   AND pst.plan_name = br.selected_plan_name
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND d.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(projectId as string)) {
        query += ` AND p.id = $${params.length + 1}`;
      } else {
        query += ` AND p.name ILIKE $${params.length + 1}`;
      }
      params.push(projectId);
    }
    if (installmentType) {
      query += ` AND d.demand_type ILIKE $${params.length + 1}`;
      params.push(`%${installmentType}%`);
    }
    if (installmentIndex !== undefined && installmentIndex !== '') {
      query += ` AND d.installment_index = $${params.length + 1}`;
      params.push(parseInt(installmentIndex as string, 10));
    }
    const tId = tower || towerId;
    if (tId) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(tId as string)) {
        query += ` AND u.tower_id = $${params.length + 1}`;
      } else {
        query += ` AND tw.name ILIKE $${params.length + 1}`;
      }
      params.push(tId);
    }
    if (floor) {
      query += ` AND u.floor = $${params.length + 1}`;
      params.push(parseInt(floor as string, 10));
    }
    if (registrationNo) {
      query += ` AND br.registration_no ILIKE $${params.length + 1}`;
      params.push(`%${registrationNo}%`);
    }
    if (name) {
      query += ` AND c.name ILIKE $${params.length + 1}`;
      params.push(`%${name}%`);
    }
    if (unitAddress) {
      query += ` AND u.unit_number ILIKE $${params.length + 1}`;
      params.push(unitAddress);
    }
    if (status && status !== 'all') {
      query += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }
    const dFrom = from || dateFrom;
    if (dFrom) {
      query += ` AND d.due_date >= $${params.length + 1}`;
      params.push(dFrom);
    }
    const dTo = to || dateTo;
    if (dTo) {
      query += ` AND d.due_date <= $${params.length + 1}`;
      params.push(dTo);
    }

    if (raisedFrom) {
      query += ` AND d.generated_at >= $${params.length + 1}`;
      params.push(raisedFrom);
    }
    if (raisedTo) {
      query += ` AND d.generated_at <= $${params.length + 1}`;
      params.push(raisedTo);
    }

    query += ` ORDER BY d.installment_index ASC, d.due_date ASC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    
    // Add Balance calculation in memory for speed
    const data = result.rows.map(r => ({
      ...r,
      balance: parseFloat(r.amount_due_inr) - parseFloat(r.total_paid)
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/demands/activate - Transition scheduled installment to active demand
// Option A: skip invalid (sequential check fails), raise all valid — no full rollback on partial failure
router.patch('/demands/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { demandIds, installmentDate } = req.body;

    if (!demandIds || !Array.isArray(demandIds) || !installmentDate) {
      return res.status(400).json({ error: 'demandIds (array) and installmentDate required' });
    }

    await client.query('BEGIN');

    const raisedIds: string[] = [];
    const skippedIds: { id: string; reason: string }[] = [];
    const dueDate = new Date(installmentDate);

    for (const id of demandIds) {
      // 1. Load demand
      const currentDemand = await client.query(
        'SELECT installment_index, consumer_id, status FROM demands WHERE id = $1', [id]
      );
      if (currentDemand.rows.length === 0) {
        skippedIds.push({ id, reason: 'Demand not found' });
        continue;
      }

      const { installment_index, consumer_id, status } = currentDemand.rows[0];

      if (status === 'demanded') {
        skippedIds.push({ id, reason: 'Already raised' });
        continue;
      }

      // 2. Sequential validation — skip (not throw) if prior stages pending
      if (installment_index > 0) {
        const prevPending = await client.query(
          'SELECT id FROM demands WHERE consumer_id = $1 AND installment_index < $2 AND status = $3',
          [consumer_id, installment_index, 'pending']
        );
        if (prevPending.rows.length > 0) {
          skippedIds.push({ id, reason: `Installment ${installment_index}: prior stage(s) not yet raised` });
          continue;
        }
      }

      // 3. Activate
      const updateResult = await client.query(
        `UPDATE demands
         SET status = 'demanded',
             due_date = $1,
             generated_at = NOW(),
             raised_at = NOW(),
             delivery_status = 'queued'
         WHERE id = $2
         RETURNING id`,
        [dueDate.toISOString().split('T')[0], id]
      );

      // 4. Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
         VALUES ($1, 'DEMAND_RAISE', 'demand', $2, $3)`,
        [req.userId, id, JSON.stringify({ installment_date: installmentDate, due_date: dueDate, consumer_id, installment_index })]
      );

      raisedIds.push(updateResult.rows[0].id);

      // 4b. Retroactively link orphan receipts that targeted this installment_index
      // (recorded before the demand existed: installment_index set, demand_id=NULL)
      const retroResult = await client.query(
        `UPDATE receipts
         SET demand_id = $1, updated_at = NOW()
         WHERE consumer_id = $2
           AND installment_index = $3
           AND demand_id IS NULL
           AND status != 'cancelled'
         RETURNING receipt_number, amount_received_inr`,
        [id, consumer_id, installment_index]
      );

      if (retroResult.rows.length > 0) {
        const totalLinked = retroResult.rows.reduce(
          (s: number, r: any) => s + parseFloat(r.amount_received_inr), 0
        );
        try {
          await client.query(
            `INSERT INTO financial_audit_logs
               (consumer_id, action_type, old_value, new_value, remarks)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              consumer_id,
              'receipts_retroactively_linked',
              JSON.stringify({ demand_id: null }),
              JSON.stringify({ demand_id: id }),
              `${retroResult.rows.length} receipt(s) totalling ₹${totalLinked} retroactively linked to demand ${id} (installment_index=${installment_index})`,
            ]
          );
        } catch (auditErr: any) {
          console.error('Retro-link audit log failed (non-fatal):', auditErr.message);
        }
      }

      // Waterfall check: if advance receipts already fully cover this demand, auto-mark paid
      const [wfRcpts, wfDemands] = await Promise.all([
        client.query<WaterfallReceipt>(
          `SELECT id, amount_received_inr, demand_id, installment_index, status
           FROM receipts WHERE consumer_id = $1 AND status != 'cancelled'`,
          [consumer_id]
        ),
        client.query<WaterfallDemand>(
          `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount
           FROM demands WHERE consumer_id = $1`,
          [consumer_id]
        ),
      ]);

      const wfResult = applyWaterfall(wfRcpts.rows, wfDemands.rows)
        .find(w => w.demand_id === id);

      if (wfResult?.fully_covered) {
        await client.query(
          `UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        await client.query(
          `INSERT INTO financial_audit_logs
             (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
           SELECT $1, pp.id, $2, 'demand_auto_paid',
             '{"status":"demanded","delivery_status":"queued"}',
             '{"status":"paid","delivery_status":"paid"}',
             'Auto-marked paid: fully covered by advance/booking receipts via waterfall allocation'
           FROM payment_plans pp WHERE pp.consumer_id = $1 LIMIT 1`,
          [consumer_id, req.userId || null]
        );
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      raised: raisedIds.length,
      skipped: skippedIds.length,
      skippedIds,
      activatedCount: raisedIds.length, // backward compat
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/payments/demands/bulk - Bulk raise demands for a project
router.post('/demands/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, dueDate, amountDueInr, sentVia } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const plans = await db.query(
      `SELECT id, consumer_id FROM payment_plans WHERE project_id = $1`,
      [projectId]
    );

    let created = 0;
    for (const plan of plans.rows) {
      await db.query(
        `INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, sent_via, delivery_status)
         VALUES ($1, 0, $2, $3, $4, $5, 'queued')`,
        [plan.id, plan.consumer_id, dueDate || new Date().toISOString().slice(0, 10), amountDueInr || 0, sentVia || 'email']
      );
      created++;
    }

    res.status(201).json({ success: true, data: { created, projectId } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/demands/bulk-cancel - Reset multiple demands to pending
router.patch('/demands/bulk-cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { demandIds } = req.body;
    if (!demandIds || !Array.isArray(demandIds) || demandIds.length === 0) {
      return res.status(400).json({ error: 'demandIds (non-empty array) is required' });
    }

    await client.query('BEGIN');
    let cancelled = 0;
    const failedIds: string[] = [];

    for (const id of demandIds) {
      try {
        const r = await client.query(
          `UPDATE demands
           SET status = 'pending', delivery_status = 'pending',
               raised_at = NULL, updated_at = NOW()
           WHERE id = $1 AND status = 'demanded'
           RETURNING id`,
          [id]
        );
        if (r.rows.length > 0) cancelled++;
        else failedIds.push(id);
      } catch {
        failedIds.push(id);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, cancelled, failed: failedIds.length, failedIds });
  } catch (err: any) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/payments/demands/:id/send - Mark demand as sent
router.patch('/demands/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sentVia } = req.body;

    const result = await db.query(
      `UPDATE demands SET delivery_status = 'sent', sent_at = NOW(), sent_via = COALESCE($1, sent_via)
       WHERE id = $2
       RETURNING id, delivery_status, sent_at`,
      [sentVia, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/demands/:id/cancel - Reset demand back to pending (cancel raise)
router.patch('/demands/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const current = await db.query(`SELECT id, status FROM demands WHERE id = $1`, [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found' });
    }
    if (current.rows[0].status !== 'demanded') {
      return res.status(400).json({ error: `Cannot cancel a demand with status '${current.rows[0].status}'. Only 'demanded' demands can be cancelled.` });
    }

    const result = await db.query(
      `UPDATE demands
       SET status = 'pending', delivery_status = 'pending',
           raised_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, delivery_status`,
      [id]
    );

    res.json({ success: true, data: { ...result.rows[0], cancel_reason: reason || null }, message: 'Demand cancelled and reset to pending' });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/receipts - List all receipts (with optional filters)
router.get('/receipts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      consumerId, projectId, towerId, status, fromDate, toDate,
      registrationNo, firstName, unitAddress, receiptNo,
      brokerId, printStatus, approvalStatus,
      page = 1, pageSize = 50,
    } = req.query;

    let query = `SELECT r.id, r.receipt_number, r.payment_plan_id, r.installment_index,
                        r.consumer_id, r.amount_received_inr, r.payment_method,
                        r.transaction_ref, r.received_date, r.created_at,
                        r.status, r.approval_status, r.bank_name,
                        r.print_status, r.printed_at,
                        r.plc_amount, r.edc_amount, r.idc_amount,
                        r.other_charge_amount, r.other_charge_desc, r.interest_amount,
                        c.name as consumer_name, c.mobile,
                        c.registration_no, c.first_name, c.last_name,
                        pp.project_id,
                        p.name as project_name,
                        u.unit_number,
                        t.id::text as tower_id, t.tower_name,
                        u_creator.name AS generated_by_name,
                        u_printer.name AS printed_by_name,
                        COALESCE(b.firm_name, b.name, 'Direct') AS broker_name,
                        b.id AS broker_id
                 FROM receipts r
                 JOIN consumers c ON r.consumer_id = c.id
                 JOIN payment_plans pp ON r.payment_plan_id = pp.id
                 LEFT JOIN projects p ON p.id = pp.project_id
                 LEFT JOIN units u ON u.id = pp.unit_id
                 LEFT JOIN towers t ON t.id = u.tower_id
                 LEFT JOIN users u_creator ON u_creator.id = r.received_by_user_id
                 LEFT JOIN users u_printer ON u_printer.id = r.printed_by
                 LEFT JOIN LATERAL (
                   SELECT br2.main_broker_id
                   FROM booking_records br2
                   WHERE br2.consumer_id = r.consumer_id
                   ORDER BY br2.created_at DESC LIMIT 1
                 ) latest_booking ON true
                 LEFT JOIN brokers b ON b.id = latest_booking.main_broker_id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND r.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (towerId) {
      query += ` AND t.id = $${params.length + 1}`;
      params.push(towerId);
    }
    if (fromDate) {
      query += ` AND r.received_date >= $${params.length + 1}`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND r.received_date <= $${params.length + 1}`;
      params.push(toDate);
    }
    if (registrationNo) {
      query += ` AND c.registration_no ILIKE $${params.length + 1}`;
      params.push(`%${registrationNo}%`);
    }
    if (firstName) {
      query += ` AND c.first_name ILIKE $${params.length + 1}`;
      params.push(`%${firstName}%`);
    }
    if (unitAddress) {
      query += ` AND u.unit_number ILIKE $${params.length + 1}`;
      params.push(`%${unitAddress}%`);
    }
    if (receiptNo) {
      query += ` AND r.receipt_number ILIKE $${params.length + 1}`;
      params.push(`%${receiptNo}%`);
    }
    if (brokerId) {
      query += ` AND b.id = $${params.length + 1}`;
      params.push(brokerId);
    }
    if (printStatus) {
      query += ` AND r.print_status = $${params.length + 1}`;
      params.push(printStatus);
    }
    if (approvalStatus) {
      query += ` AND r.approval_status = $${params.length + 1}`;
      params.push(approvalStatus);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/receipts/pending-cheques - List cheques pending action
router.get('/receipts/pending-cheques', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, unit_address, tower_id, from_date, to_date, cheque_no, registration_no, first_name } = req.query;

    const params: any[] = [];
    let whereExtra = '';

    if (project_id) {
      params.push(project_id);
      whereExtra += ` AND p.id = $${params.length}`;
    }
    if (unit_address) {
      params.push(`%${unit_address}%`);
      whereExtra += ` AND u.unit_number ILIKE $${params.length}`;
    }
    if (tower_id) {
      params.push(tower_id);
      whereExtra += ` AND t.id = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      whereExtra += ` AND r.created_at::date >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      whereExtra += ` AND r.created_at::date <= $${params.length}`;
    }
    if (cheque_no) {
      params.push(`%${cheque_no}%`);
      whereExtra += ` AND r.cheque_no ILIKE $${params.length}`;
    }
    if (registration_no) {
      params.push(`%${registration_no}%`);
      whereExtra += ` AND c.registration_no ILIKE $${params.length}`;
    }
    if (first_name) {
      params.push(`%${first_name}%`);
      whereExtra += ` AND c.name ILIKE $${params.length}`;
    }

    const result = await db.query(`
      SELECT
        r.id,
        r.receipt_number,
        r.cheque_no,
        r.amount_received_inr AS amount,
        r.payment_method,
        r.status,
        r.cheque_date,
        r.deposit_date,
        r.clearing_date,
        r.hold_remark,
        r.clearing_bank_id,
        r.bank_name,
        r.branch,
        r.created_at AS receipt_date,
        c.name AS consumer_name,
        c.registration_no AS registration_number,
        u.unit_number AS unit_address,
        t.tower_name,
        ba.bank_name AS clearing_bank_name,
        comp.name AS company_name
      FROM receipts r
      JOIN consumers c ON c.id = r.consumer_id
      LEFT JOIN allocations al ON al.consumer_id = c.id
      LEFT JOIN units u ON u.id = al.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN bank_accounts ba ON ba.id = r.clearing_bank_id
      LEFT JOIN projects p ON p.id = al.project_id
      LEFT JOIN companies comp ON comp.id = p.company_id
      WHERE r.payment_method::text = 'cheque'
        AND r.status IN ('pending', 'deposited', 'on_hold')
        ${whereExtra}
      ORDER BY r.created_at DESC
    `, params);

    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/receipts/:id - Fetch single receipt with all fields
router.get('/receipts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT r.*, c.name AS consumer_name, c.mobile
       FROM receipts r
       JOIN consumers c ON r.consumer_id = c.id
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// PATCH /api/payments/receipts/:id - Edit receipt instrument / amount fields
router.patch('/receipts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionRef, bankName, branch,
            chequeNo, chequeDate, receivedDate,
            amountReceivedInr, plcAmount,
            edcAmount, idcAmount, interestAmount, otherChargeAmount, otherChargeDesc } = req.body;

    const existing = await db.query(
      `SELECT id, receipt_number, consumer_id, approval_status, status, transaction_ref
       FROM receipts WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });

    const receipt = existing.rows[0];
    if (receipt.approval_status === 'approved') {
      return res.status(403).json({ error: 'Cannot edit an approved receipt' });
    }
    if (receipt.status === 'cancelled') {
      return res.status(403).json({ error: 'Cannot edit a cancelled receipt' });
    }

    if (transactionRef && transactionRef !== receipt.transaction_ref) {
      const dup = await db.query(
        `SELECT id FROM receipts WHERE transaction_ref = $1 AND id != $2`,
        [transactionRef, id]
      );
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'Transaction reference already exists on another receipt' });
      }
    }

    const isPending = receipt.approval_status === 'pending';

    const result = await db.query(
      `UPDATE receipts SET
         payment_method  = COALESCE($1, payment_method),
         transaction_ref = COALESCE($2, transaction_ref),
         bank_name       = COALESCE($3, bank_name),
         branch          = COALESCE($4, branch),
         cheque_no       = COALESCE($5, cheque_no),
         cheque_date     = COALESCE($6::date, cheque_date),
         received_date   = COALESCE($7::date, received_date),
         amount_received_inr = CASE WHEN $8::boolean
           THEN COALESCE($9::bigint, amount_received_inr)
           ELSE amount_received_inr END,
         plc_amount = CASE WHEN $8::boolean
           THEN COALESCE($10::numeric, plc_amount)
           ELSE plc_amount END,
         edc_amount = CASE WHEN $8::boolean
           THEN COALESCE($11::numeric, edc_amount)
           ELSE edc_amount END,
         idc_amount = CASE WHEN $8::boolean
           THEN COALESCE($12::numeric, idc_amount)
           ELSE idc_amount END,
         interest_amount = CASE WHEN $8::boolean
           THEN COALESCE($13::numeric, interest_amount)
           ELSE interest_amount END,
         other_charge_amount = CASE WHEN $8::boolean
           THEN COALESCE($14::numeric, other_charge_amount)
           ELSE other_charge_amount END,
         other_charge_desc = CASE WHEN $8::boolean
           THEN COALESCE($15, other_charge_desc)
           ELSE other_charge_desc END,
         updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        paymentMethod   || null,
        transactionRef  || null,
        bankName        || null,
        branch          || null,
        chequeNo        || null,
        chequeDate      || null,
        receivedDate    || null,
        isPending,
        amountReceivedInr != null ? amountReceivedInr : null,
        plcAmount         != null ? plcAmount         : null,
        edcAmount         != null ? edcAmount         : null,
        idcAmount         != null ? idcAmount         : null,
        interestAmount    != null ? interestAmount    : null,
        otherChargeAmount != null ? otherChargeAmount : null,
        otherChargeDesc   != null ? otherChargeDesc   : null,
        id,
      ]
    );

    res.json({ success: true, receipt: result.rows[0] });
  } catch (error) { next(error); }
});

// PATCH /api/payments/receipts/:id/approve - Approve a pending receipt (Authentication)
router.patch('/receipts/:id/approve', requireProcess('receipt', 'checker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE receipts 
       SET status = 'authorized', 
           authorized_by = $1, 
           authorized_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING id, receipt_number, amount_received_inr, status`,
      [req.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending receipt not found or already authorized' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Receipt authorized successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/gst-invoices - List GST invoices
router.get('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, page = 1, pageSize = 100 } = req.query;

    let query = `SELECT gi.*, c.name as consumer_name, p.name as project_name
                 FROM gst_invoices gi
                 JOIN consumers c ON gi.consumer_id = c.id
                 JOIN projects p ON gi.project_id = p.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND gi.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND gi.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (status) {
      query += ` AND gi.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY gi.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/gst-invoices - Create GST invoice
router.post('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { 
      projectId, consumerId, unitId, baseAmountInr, 
      cgstRate, sgstRate, igstRate, 
      installmentName, invoiceDate, hsnCode 
    } = req.body;

    if (!consumerId || !baseAmountInr || !projectId) {
      return res.status(400).json({ error: 'projectId, consumerId and baseAmountInr required' });
    }

    const invoiceNo = `INV/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    
    const cgstAmount = Math.round(baseAmountInr * (cgstRate || 9) / 100);
    const sgstAmount = Math.round(baseAmountInr * (sgstRate || 9) / 100);
    const igstAmount = igstRate ? Math.round(baseAmountInr * igstRate / 100) : 0;
    const totalAmount = baseAmountInr + cgstAmount + sgstAmount + igstAmount;

    const result = await db.query(
      `INSERT INTO gst_invoices (
        invoice_no, invoice_date, project_id, consumer_id, unit_id, 
        installment_name, base_amount_inr, taxable_amount_inr,
        cgst_rate, sgst_rate, igst_rate,
        cgst_amount_inr, sgst_amount_inr, igst_amount_inr,
        total_amount_inr, hsn_sac_code, status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'generated', $16)
       RETURNING *`,
      [
        invoiceNo, invoiceDate || new Date(), projectId, consumerId, unitId || null,
        installmentName || 'Direct Payment', baseAmountInr, 
        cgstRate || 9.0, sgstRate || 9.0, igstRate || 0.0,
        cgstAmount, sgstAmount, igstAmount,
        totalAmount, hsnCode || '9972', req.userId
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/gst-invoices/cancel - Cancel GST invoice and create credit note
router.post('/gst-invoices/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { invoiceNumber, reason } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ error: 'invoiceNumber required' });
    }

    // Look up the invoice to get its details
    const invoiceRes = await db.query(
      `SELECT id, consumer_id, total_amount, gst_rate FROM gst_invoices WHERE invoice_number = $1`,
      [invoiceNumber]
    );
    if (!invoiceRes.rows[0]) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = invoiceRes.rows[0];

    const year = new Date().getFullYear();
    const countRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM credit_debit_notes WHERE note_number LIKE $1`,
      [`CDN/${year}/%`]
    );
    const seq = String(Number(countRes.rows[0].cnt) + 1).padStart(4, '0');
    const noteNumber = `CDN/${year}/${seq}`;

    const gstRate = invoice.gst_rate || 5;
    const adjAmt = Number(invoice.total_amount) || 0;
    const gstAmt = (adjAmt * gstRate) / 100;

    const noteRes = await db.query(
      `INSERT INTO credit_debit_notes
         (consumer_id, invoice_id, note_number, note_type, original_invoice_no, adjustment_amount, gst_rate, gst_amount, total_amount, reason, status, created_by_user_id)
       VALUES ($1,$2,$3,'credit',$4,$5,$6,$7,$8,$9,'issued',$10)
       RETURNING *`,
      [invoice.consumer_id, invoice.id, noteNumber, invoiceNumber, adjAmt, gstRate, gstAmt, adjAmt + gstAmt, reason || 'Invoice cancelled', req.userId]
    );

    // Mark the invoice as cancelled
    await db.query(`UPDATE gst_invoices SET status = 'cancelled' WHERE id = $1`, [invoice.id]);

    res.json({
      success: true,
      data: { invoiceNumber, status: 'cancelled', reason, creditNoteNumber: noteNumber, creditNote: noteRes.rows[0] },
      message: 'Invoice cancelled and credit note issued',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/gst-invoices/:id/pdf - Get GST invoice PDF (stub)
router.get('/gst-invoices/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  res.status(200).json({ success: true, message: 'PDF generation coming soon', id: req.params.id });
});

// GET /api/payments/:paymentPlanId/demands - Get demands for payment plan
router.get('/:paymentPlanId/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId } = req.params;

    const result = await db.query(
      `SELECT id, installment_index, amount_due_inr, due_date, delivery_status
       FROM demands WHERE payment_plan_id = $1
       ORDER BY installment_index ASC`,
      [paymentPlanId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/calculate-interest - Calculate HRERA interest on overdue
router.post('/calculate-interest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId, installmentIndex, principalInr, daysOverdue } = req.body;

    const penalRate = await getPenalInterestRate();
    const interest = calculatePenalInterest(principalInr, daysOverdue, penalRate);

    res.json({
      success: true,
      data: {
        principalInr,
        daysOverdue,
        ratePercent: penalRate,
        interestInr: interest,
        totalWithInterest: principalInr + interest,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/draw-refunds - List all draw refunds
router.get('/draw-refunds', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, projectId, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT
                  id, consumer_id, project_id, draw_result,
                  booking_amount_paid_inr, refund_amount_inr,
                  refund_due_by, refund_status,
                  refund_initiated_at, refund_completed_at,
                  refund_reference, created_at
                 FROM draw_refunds WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query += ` AND refund_status = $${params.length + 1}`;
      params.push(status);
    }

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` ORDER BY refund_due_by ASC
              LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/draw-refunds/overdue - Get overdue draw refunds
router.get('/draw-refunds/overdue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
        id, consumer_id, project_id, draw_result,
        booking_amount_paid_inr, refund_amount_inr,
        refund_due_by, refund_status,
        refund_initiated_at, created_at,
        EXTRACT(DAY FROM (NOW() - refund_due_by))::INT as days_overdue
       FROM draw_refunds
       WHERE refund_due_by < CURRENT_DATE
       AND refund_status NOT IN ('completed')
       ORDER BY refund_due_by ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/draw-refunds/:id/initiate - Initiate draw refund
router.patch('/draw-refunds/:id/initiate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { refundReference, notes } = req.body;

    const result = await db.query(
      `UPDATE draw_refunds
       SET refund_status = 'initiated',
           refund_initiated_at = NOW(),
           refund_reference = $1,
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, consumer_id, refund_status, refund_initiated_at`,
      [refundReference, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draw refund not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/draw-refunds/:id/complete - Complete draw refund
router.patch('/draw-refunds/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { refundReference } = req.body;

    const result = await db.query(
      `UPDATE draw_refunds
       SET refund_status = 'completed',
           refund_completed_at = NOW(),
           refund_reference = COALESCE($1, refund_reference),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, consumer_id, refund_status, refund_completed_at`,
      [refundReference || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draw refund not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/payments/receipts/:id/bounce - Mark receipt as bounced
 */
router.patch('/receipts/:id/bounce', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { reason, penaltyAmount = 500 } = req.body;

    await client.query('BEGIN');

    // 1. Get receipt details
    const receiptRes = await client.query(
      `SELECT consumer_id, demand_id, amount_received_inr, payment_plan_id, installment_index
       FROM receipts WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (receiptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receipt not found' });
    }

    let { consumer_id, demand_id, amount_received_inr, payment_plan_id, installment_index } = receiptRes.rows[0];

    // 1b. If receipt has no payment_plan_id, fall back to linked demand's plan
    if (!payment_plan_id && demand_id) {
      const demandPlan = await client.query(
        `SELECT payment_plan_id, installment_index FROM demands WHERE id = $1`,
        [demand_id]
      );
      if (demandPlan.rows.length > 0) {
        payment_plan_id = payment_plan_id || demandPlan.rows[0].payment_plan_id;
        installment_index = installment_index ?? demandPlan.rows[0].installment_index;
      }
    }
    // Use 999 as sentinel installment_index for penalty demands with no installment context
    installment_index = installment_index ?? 999;

    // 2. Update receipt status
    await client.query(
      `UPDATE receipts SET status = 'bounced', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // 3. Re-open the demand if linked
    if (demand_id) {
      await client.query(
        `UPDATE demands SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [demand_id]
      );
    }

    // 4. Log the bounce
    await client.query(
      `INSERT INTO cheque_bounce_logs (receipt_id, consumer_id, bounce_date, penalty_amount_inr, reason)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
      [id, consumer_id, penaltyAmount, reason || 'Cheque Bounced']
    );

    // 5. Create a "Penalty" demand (requires valid payment_plan_id — NOT NULL constraint)
    if (!payment_plan_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot raise penalty demand: receipt has no linked payment plan.' });
    }
    await client.query(
      `INSERT INTO demands (
         consumer_id, payment_plan_id, installment_index,
         amount_due_inr, status, demand_type, due_date
       ) VALUES ($1, $2, $3, $4, 'pending', 'bounce_penalty', CURRENT_DATE + INTERVAL '7 days')`,
      [consumer_id, payment_plan_id, installment_index, penaltyAmount]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Receipt marked as bounced. Penalty raised.' });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/payments/receipts/:id/cancel - Cancel a receipt and reverse demand payment state
router.post('/receipts/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const reason = req.body?.reason || 'Cancelled by user';

    await client.query('BEGIN');

    const receiptResult = await client.query(
      `SELECT id, receipt_number, status, approval_status,
              demand_id, payment_plan_id, amount_received_inr, consumer_id
       FROM receipts WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (receiptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];

    if (receipt.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Receipt is already cancelled' });
    }

    if (receipt.approval_status === 'approved') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cannot cancel an approved receipt. Please use the formal reversal workflow.' });
    }

    // Step 1: Cancel the receipt
    await client.query(
      `UPDATE receipts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Step 2: Revert demand status AND delivery_status if linked and paid
    if (receipt.demand_id) {
      await client.query(
        `UPDATE demands
         SET status = 'demanded', delivery_status = 'queued', updated_at = NOW()
         WHERE id = $1 AND delivery_status = 'paid'`,
        [receipt.demand_id]
      );
    }

    // Step 2b: Waterfall recheck — revert any demands no longer covered after cancellation
    const [wfRcpts, wfDemands] = await Promise.all([
      client.query(
        `SELECT id, amount_received_inr, demand_id, installment_index, status
         FROM receipts
         WHERE consumer_id = $1 AND status != 'cancelled'`,
        [receipt.consumer_id]
      ),
      client.query(
        `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount, status, delivery_status
         FROM demands
         WHERE consumer_id = $1`,
        [receipt.consumer_id]
      ),
    ]);

    const wfResults = applyWaterfall(wfRcpts.rows as WaterfallReceipt[], wfDemands.rows as WaterfallDemand[]);

    for (const wf of wfResults) {
      if (!wf.fully_covered) {
        const dbDemand = wfDemands.rows.find((d: any) => d.id === wf.demand_id);
        if (dbDemand && (dbDemand.status === 'paid' || dbDemand.delivery_status === 'paid')) {
          await client.query(
            `UPDATE demands SET status = 'demanded', delivery_status = 'queued', updated_at = NOW()
             WHERE id = $1`,
            [wf.demand_id]
          );
          try {
            await client.query(
              `INSERT INTO financial_audit_logs
                 (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                receipt.consumer_id,
                receipt.payment_plan_id,
                req.userId || null,
                'demand_revert_on_cancel',
                JSON.stringify({ status: dbDemand.status, delivery_status: dbDemand.delivery_status }),
                JSON.stringify({ status: 'demanded', delivery_status: 'queued' }),
                `Demand reverted: covering advance receipt cancelled. Receipt: ${receipt.receipt_number}`,
              ]
            );
          } catch (auditErr: any) {
            console.error('Audit log failed (non-fatal):', auditErr.message);
          }
        }
      }
    }

    // Step 3: Write audit log (non-fatal)
    try {
      await client.query(
        `INSERT INTO financial_audit_logs
           (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          receipt.consumer_id,
          receipt.payment_plan_id,
          req.userId || null,
          'RECEIPT_CANCEL',
          JSON.stringify({ status: receipt.status, amount: receipt.amount_received_inr }),
          JSON.stringify({ status: 'cancelled' }),
          reason,
        ]
      );
    } catch (auditErr: any) {
      console.error('Audit log failed (non-fatal):', auditErr.message);
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Receipt cancelled successfully',
      receiptNumber: receipt.receipt_number,
      demandReverted: !!receipt.demand_id,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// PATCH /api/payments/receipts/:id/mark-printed - Record who printed this receipt
router.patch('/receipts/:id/mark-printed', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await db.query(`SELECT id FROM receipts WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    await db.query(
      `UPDATE receipts SET print_status = 'printed', printed_by = $1, printed_at = NOW() WHERE id = $2`,
      [req.userId, id]
    );

    res.json({ success: true, printedBy: req.userName, printedAt: new Date() });
  } catch (error) {
    next(error);
  }
});

// ── RECEIPT HTML HELPERS ─────────────────────────────────────────────────────

function pmtOrdinal(n: number): string {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 13) return `${abs}th`;
  if (lastOne === 1) return `${abs}st`;
  if (lastOne === 2) return `${abs}nd`;
  if (lastOne === 3) return `${abs}rd`;
  return `${abs}th`;
}

function pmtNumberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (n: number): string =>
    n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  const threeDigits = (n: number): string =>
    n >= 100
      ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
      : twoDigits(n);
  if (!amount || amount === 0) return 'Zero Rupees Only';
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  const crore  = Math.floor(rupees / 10000000);
  const lakh   = Math.floor((rupees % 10000000) / 100000);
  const thou   = Math.floor((rupees % 100000) / 1000);
  const rem    = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh)  parts.push(threeDigits(lakh)  + ' Lakh');
  if (thou)  parts.push(threeDigits(thou)  + ' Thousand');
  if (rem)   parts.push(threeDigits(rem));
  let result = parts.join(' ') + ' Rupees';
  if (paise) result += ' and ' + twoDigits(paise) + ' Paise';
  return result + ' Only';
}

function pmtEsc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pmtFmtDate(d: any): string {
  if (d == null) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pmtFmtAmt(v: any): string {
  const n = parseFloat(v ?? 0) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pmtPaymentNarrative(b: any): string {
  const mode    = (b.payment_mode || '').toLowerCase();
  const ref     = (b.payment_ref  || '').trim();
  const bank    = (b.bank_name    || '').trim();
  const branch  = (b.bank_branch  || '').trim();
  const dateStr = pmtFmtDate(b.cheque_date);
  const hasDate = dateStr !== '—';

  if (mode === 'cash') return 'in Cash.';

  if (mode === 'cheque') {
    const parts: string[] = ['vide Cheque'];
    if (ref)     parts.push(`No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`drawn on ${branch ? `${bank}, ${branch}` : bank}`);
    return parts.join(' ') + '.';
  }
  if (mode === 'demand_draft' || mode === 'draft') {
    const parts: string[] = ['vide Demand Draft'];
    if (ref)     parts.push(`No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`drawn on ${branch ? `${bank}, ${branch}` : bank}`);
    return parts.join(' ') + '.';
  }
  if (mode === 'neft' || mode === 'rtgs' || mode === 'online') {
    const parts: string[] = ['vide Online Transfer'];
    if (ref)     parts.push(`Ref. No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`through ${bank}`);
    return parts.join(' ') + '.';
  }
  if (mode === 'upi') {
    const parts: string[] = ['vide UPI'];
    if (ref) parts.push(`Ref. No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    return parts.join(' ') + '.';
  }
  if (mode === 'card') {
    const parts: string[] = ['vide Card Transaction'];
    if (ref)     parts.push(`Ref. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`through ${bank}`);
    return parts.join(' ') + '.';
  }
  const modePretty = mode.replace(/\b\w/g, (c: string) => c.toUpperCase());
  const parts: string[] = [`vide ${modePretty}`];
  if (ref) parts.push(`Ref. ${ref}`);
  return parts.join(' ') + '.';
}

function buildPaymentReceiptCopy(r: any, settings: Record<string, string>, copyType: string, allInstallments: any[]): string {
  const companyName   = settings['company_name']    || '';
  const companyCin    = settings['company_cin']      || '';
  const companyAddr   = settings['company_address']  || '';
  const companyReg    = settings['company_reg_addr'] || '';
  const companyPhone  = settings['company_phone']    || '';
  const companyWeb    = settings['company_website']  || '';
  const companyEmail  = settings['company_email']    || '';
  const companyGstin  = settings['company_gstin']    || '';
  const placeOfSupply = settings['place_of_supply']  || '';
  const hsnSacCode    = settings['hsn_sac_code']     || '';
  const note1 = settings['receipt_note_1'] || '';
  const note2 = settings['receipt_note_2'] || '';
  const note3 = settings['receipt_note_3'] || '';
  const note4 = settings['receipt_note_4'] || '';

  const primaryName = [r.salutation, r.first_name, r.last_name].filter(Boolean).join(' ').trim();
  const coNames: string[] = [];
  if (Array.isArray(r.co_applicants)) {
    for (const co of r.co_applicants) {
      const n = [co.salutation, co.first_name, co.last_name].filter(Boolean).join(' ').trim();
      if (n) coNames.push(`& ${n}`);
    }
  }
  const consumerName = [primaryName, ...coNames].join(' ').trim() || '—';
  const addrParts    = [r.present_address, r.present_city, r.present_state].filter(Boolean);
  const address      = addrParts.join(', ') + (r.present_pin ? ` - ${r.present_pin}` : '');

  const isNri       = ['nri','oci','pio'].includes((r.nationality || '').toLowerCase());
  const totalAmount = parseFloat(r.amount_received_inr || 0);
  const amountWords = pmtNumberToWords(totalAmount);
  const floorOrdinal = r.floor != null ? pmtOrdinal(parseInt(r.floor)) : '—';
  const receiptNo    = r.receipt_number || '—';

  const narrative = pmtPaymentNarrative({
    payment_mode: r.payment_method,
    payment_ref:  r.transaction_ref,
    bank_name:    r.bank_name,
    bank_branch:  r.branch,
    cheque_date:  r.cheque_date,
  });

  // ── BALCONY SETUP ──────────────────────────────────────────────────────
  const balconyAreaSqft    = parseFloat(r.balcony_area_sqft     || 0);
  const balconyRateInrSqft = parseFloat(r.balcony_rate_inr_sqft || 0);
  const balconyCapInr      = parseFloat(r.balcony_rate_cap_inr  || 0);
  const hasBalcony         = balconyAreaSqft > 0 && balconyRateInrSqft > 0;
  let   totalBalconyCharge = 0;
  if (hasBalcony) {
    totalBalconyCharge = balconyAreaSqft * balconyRateInrSqft;
    if (balconyCapInr > 0 && totalBalconyCharge > balconyCapInr) totalBalconyCharge = balconyCapInr;
  }

  // ── TABLE CELL HELPERS ─────────────────────────────────────────────────
  const TH  = (s: string, w?: string) =>
    `<th style="${w?`width:${w};`:''}background:#f0f0f0;border:1px solid #999;padding:4px 6px;font-size:10px;text-align:center">${s}</th>`;
  const TDx = (s: string, extra = '') =>
    `<td style="border:1px solid #999;padding:4px 6px;font-size:10px;${extra}">${s}</td>`;
  const TDR = (s: string, extra = '') => TDx(s, `text-align:right;${extra}`);
  const TDC = (s: string, extra = '') => TDx(s, `text-align:center;${extra}`);
  // Span wrapper: wraps a cell value with data-field-key for inline edit support
  const SF = (key: string, label: string, val: string, vtype: string, extra = '') =>
    `<span data-field-key="${key}" data-field-label="${label}" data-value-type="${vtype}" data-section="table"${extra}>${val}</span>`;

  // ── ADDON GST RATES & AMOUNTS (needed before installment rows for back-calc) ───
  const addonCgstPct = parseFloat(settings['addon_cgst_percent'] || '9');
  const addonSgstPct = parseFloat(settings['addon_sgst_percent'] || '9');
  const basicCgstPct = parseFloat(settings['basic_cgst_percent'] || '0.5');
  const basicSgstPct = parseFloat(settings['basic_sgst_percent'] || '0.5');

  const calcAddonGst = (amount: number, cgstPct: number, sgstPct: number) => {
    if (isNri || amount <= 0) return { net: amount, cgst: 0, sgst: 0, total: amount };
    const cgst = Math.round(amount * cgstPct / 100 * 100) / 100;
    const sgst = Math.round(amount * sgstPct / 100 * 100) / 100;
    return { net: amount, cgst, sgst, total: amount + cgst + sgst };
  };

  const plcAmt   = parseFloat(r.plc_amount          || 0);
  const edcAmt   = parseFloat(r.edc_amount          || 0);
  const idcAmt   = parseFloat(r.idc_amount          || 0);
  const intAmt   = parseFloat(r.interest_amount     || 0) || parseFloat(r.penal_interest_amount || 0);
  const otherAmt = parseFloat(r.other_charge_amount || 0);
  const otherDesc = r.other_charge_desc || 'Other Charges';

  // Pre-compute addon gross total so we can back-calculate basic amount
  const addonGrossTotal =
    calcAddonGst(plcAmt,   addonCgstPct, addonSgstPct).total +
    calcAddonGst(edcAmt,   addonCgstPct, addonSgstPct).total +
    calcAddonGst(idcAmt,   addonCgstPct, addonSgstPct).total +
    calcAddonGst(intAmt,   basicCgstPct, basicSgstPct).total +
    calcAddonGst(otherAmt, addonCgstPct, addonSgstPct).total;

  // ── FIND CURRENT INSTALLMENT ONLY ──────────────────────────────────────
  const currentInstIdx = r.installment_index != null ? parseInt(r.installment_index) : -1;
  const currentInst = allInstallments.find(i => parseInt(i.installment_index) === currentInstIdx)
                   || (allInstallments.length === 1 ? allInstallments[0] : null);

  // ── BUILD INSTALLMENT ROWS (this receipt only) ─────────────────────────
  // Use back-calculated basic gross (totalAmount - addonGross) so the
  // table total always equals the amount box — correct for partial payments.
  let tableBodyRows = '';
  let sumNet = 0, sumCgst = 0, sumSgst = 0, sumGross = 0;
  let sNo = 0;

  if (currentInst) {
    const basicGross = Math.max(0, totalAmount - addonGrossTotal);

    // Derive GST fractions from the demand's actual amounts
    const demandNet   = parseFloat(currentInst.amount_due_inr || 0);
    const demandCgst  = isNri ? 0 : parseFloat(currentInst.cgst_amount || 0);
    const demandSgst  = isNri ? 0 : parseFloat(currentInst.sgst_amount || 0);
    const demandGross = demandNet + demandCgst + demandSgst;
    const cgstFrac    = demandGross > 0 ? demandCgst / demandGross : 0;
    const sgstFrac    = demandGross > 0 ? demandSgst / demandGross : 0;

    const pct = parseFloat(currentInst.percentage || 0);

    if (hasBalcony && pct > 0) {
      const balconyInstGross = Math.round(totalBalconyCharge * pct / 100);
      const basicInstGross   = Math.max(0, basicGross - balconyInstGross);

      if (basicInstGross > 0) {
        sNo++;
        const instCgst = Math.round(basicInstGross * cgstFrac);
        const instSgst = Math.round(basicInstGross * sgstFrac);
        const instNet  = basicInstGross - instCgst - instSgst;
        sumNet += instNet; sumCgst += instCgst; sumSgst += instSgst; sumGross += basicInstGross;
        tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')',pmtEsc(currentInst.installment_name),'text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','Basic','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(instNet),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(instCgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(instSgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(basicInstGross),'currency',' data-gst-type="basic"'))}
        </tr>`;
      }
      if (balconyInstGross > 0) {
        sNo++;
        const balcCgst  = isNri ? 0 : Math.round(balconyInstGross * basicCgstPct / 100);
        const balcSgst  = isNri ? 0 : Math.round(balconyInstGross * basicSgstPct / 100);
        const balcTotal = balconyInstGross + balcCgst + balcSgst;
        sumNet += balconyInstGross; sumCgst += balcCgst; sumSgst += balcSgst; sumGross += balcTotal;
        tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')',pmtEsc(currentInst.installment_name),'text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','Balcony Charge','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(balconyInstGross),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(balcCgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(balcSgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(balcTotal),'currency',' data-gst-type="basic"'))}
        </tr>`;
      }
    } else if (basicGross > 0) {
      sNo++;
      const instCgst = Math.round(basicGross * cgstFrac);
      const instSgst = Math.round(basicGross * sgstFrac);
      const instNet  = basicGross - instCgst - instSgst;
      sumNet += instNet; sumCgst += instCgst; sumSgst += instSgst; sumGross += basicGross;
      tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')',pmtEsc(currentInst.installment_name),'text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','Basic','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(instNet),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(instCgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(instSgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(basicGross),'currency',' data-gst-type="basic"'))}
        </tr>`;
    }
  } else if (r.installment_index != null && allInstallments.length === 0) {
    // Fallback — no demands raised yet; back-calculate from receipt total
    const basicGross = Math.max(0, totalAmount - addonGrossTotal);
    if (basicGross > 0) {
      sNo++;
      const cgst = isNri ? 0 : Math.round(basicGross * basicCgstPct / 100);
      const sgst = isNri ? 0 : Math.round(basicGross * basicSgstPct / 100);
      const net  = basicGross - cgst - sgst;
      const fallbackName = `Installment #${r.installment_index}`;
      sumNet += net; sumCgst += cgst; sumSgst += sgst; sumGross += basicGross;
      tableBodyRows = `
        <tr>
          ${TDC('1')}
          ${TDx(SF('installmentName_1','Installment (Row 1)',pmtEsc(fallbackName),'text'))}
          ${TDx(SF('chargeType_1','Charge Type (Row 1)','Basic','text'))}
          ${TDC(SF('hsnSac_1','HSN/SAC (Row 1)',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_1','Amount (Row 1)',pmtFmtAmt(net),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_1','CGST (Row 1)',pmtFmtAmt(cgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_1','SGST (Row 1)',pmtFmtAmt(sgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_1','Row Total (Row 1)',pmtFmtAmt(basicGross),'currency',' data-gst-type="basic"'))}
        </tr>`;
    }
  }

  // ── ADDON CHARGE ROWS ─────────────────────────────────────────────────
  const addonRowStyle = 'background:#fafafa;';
  let addonRows = '';

  if (plcAmt > 0) {
    sNo++;
    const g = calcAddonGst(plcAmt, addonCgstPct, addonSgstPct);
    sumNet += g.net; sumCgst += g.cgst; sumSgst += g.sgst; sumGross += g.total;
    addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')','<em>Addon</em>','text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','PLC Charges','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(g.net),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(g.cgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(g.sgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(g.total),'currency',' data-gst-type="addon"'))}
        </tr>`;
  }

  if (edcAmt > 0) {
    sNo++;
    const g = calcAddonGst(edcAmt, addonCgstPct, addonSgstPct);
    sumNet += g.net; sumCgst += g.cgst; sumSgst += g.sgst; sumGross += g.total;
    addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')','<em>Addon</em>','text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','EDC','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(g.net),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(g.cgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(g.sgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(g.total),'currency',' data-gst-type="addon"'))}
        </tr>`;
  }

  if (idcAmt > 0) {
    sNo++;
    const g = calcAddonGst(idcAmt, addonCgstPct, addonSgstPct);
    sumNet += g.net; sumCgst += g.cgst; sumSgst += g.sgst; sumGross += g.total;
    addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')','<em>Addon</em>','text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','IDC','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(g.net),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(g.cgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(g.sgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(g.total),'currency',' data-gst-type="addon"'))}
        </tr>`;
  }

  if (intAmt > 0) {
    sNo++;
    const g = calcAddonGst(intAmt, basicCgstPct, basicSgstPct);
    sumNet += g.net; sumCgst += g.cgst; sumSgst += g.sgst; sumGross += g.total;
    addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')','','text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')','Interest','text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(g.net),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(g.cgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(g.sgst),'currency',' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(g.total),'currency',' data-gst-type="basic"'))}
        </tr>`;
  }

  if (otherAmt > 0) {
    sNo++;
    const g = calcAddonGst(otherAmt, addonCgstPct, addonSgstPct);
    sumNet += g.net; sumCgst += g.cgst; sumSgst += g.sgst; sumGross += g.total;
    addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_'+sNo,'Installment (Row '+sNo+')','<em>Addon</em>','text'))}
          ${TDx(SF('chargeType_'+sNo,'Charge Type (Row '+sNo+')',pmtEsc(otherDesc),'text'))}
          ${TDC(SF('hsnSac_'+sNo,'HSN/SAC (Row '+sNo+')',pmtEsc(hsnSacCode),'text'))}
          ${TDR(SF('amountNet_'+sNo,'Amount (Row '+sNo+')',pmtFmtAmt(g.net),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_'+sNo,'CGST (Row '+sNo+')',pmtFmtAmt(g.cgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_'+sNo,'SGST (Row '+sNo+')',pmtFmtAmt(g.sgst),'currency',' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_'+sNo,'Row Total (Row '+sNo+')',pmtFmtAmt(g.total),'currency',' data-gst-type="addon"'))}
        </tr>`;
  }

  // ── SUMMARY ROWS ───────────────────────────────────────────────────────
  const summaryRows = `
        <tr style="font-weight:700;background:#f0f0f0">
          ${TDC('')}${TDx('')}${TDx('')}
          ${TDC('Total','font-weight:700')}
          ${TDR(SF('grandTotalNet','Grand Total (Net)',pmtFmtAmt(sumNet),'currency'),'font-weight:700')}
          ${TDR(SF('grandTotalCgst','Grand Total CGST',pmtFmtAmt(sumCgst),'currency'),'font-weight:700')}
          ${TDR(SF('grandTotalSgst','Grand Total SGST',pmtFmtAmt(sumSgst),'currency'),'font-weight:700')}
          ${TDR(SF('grandTotal','Grand Total',pmtFmtAmt(sumGross),'currency'),'font-weight:700')}
        </tr>`;

  return `
<div class="receipt-copy">

  <!-- HEADER -->
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-weight:700;font-size:15px">${pmtEsc(companyName)}</div>
    <div style="font-size:10px;margin-top:2px">CIN: ${pmtEsc(companyCin)}</div>
    <div style="font-size:10px;margin-top:2px">${pmtEsc(companyAddr)}</div>
    <div style="font-size:10px;margin-top:2px">Regd. Office: ${pmtEsc(companyReg)}</div>
    <div style="font-size:10px;margin-top:4px">${pmtEsc(companyPhone)} &nbsp;|&nbsp; ${pmtEsc(companyWeb)} &nbsp;|&nbsp; ${pmtEsc(companyEmail)}</div>
  </div>
  <hr style="border:none;border-top:1px solid #000;margin:8px 0">
  <div style="text-align:center;font-weight:700;font-size:16px;margin:10px 0 12px">RECEIPT</div>

  <!-- TWO-COLUMN INFO BLOCK -->
  <table style="width:100%;border:none;border-collapse:collapse;margin-bottom:14px">
    <tr>
      <td style="width:60%;vertical-align:top;border:none;padding:0">
        <div style="font-weight:700">Receipt No.: <span data-field-key="receiptNumber" data-field-label="Receipt Number" data-value-type="text" data-section="header">${pmtEsc(receiptNo)}</span></div>
        <div style="font-weight:700;font-size:13px;margin-top:2px">${pmtEsc(copyType)}</div>
        <div style="margin-top:6px">Customer ID: <span data-field-key="customerId" data-field-label="Customer ID" data-value-type="text" data-section="header">${pmtEsc((r.form_no || r.registration_no || '').toString())}</span></div>
        <div style="font-weight:700;margin-top:2px"><span data-field-key="consumerName" data-field-label="Consumer Name" data-value-type="text" data-section="header">${pmtEsc(consumerName)}</span></div>
        <div style="margin-top:2px;white-space:pre-wrap"><span data-field-key="consumerAddress" data-field-label="Consumer Address" data-value-type="text" data-section="header">${pmtEsc(address)}</span></div>
        <div style="margin-top:2px">(M): <span data-field-key="consumerMobile" data-field-label="Mobile" data-value-type="text" data-section="header">${pmtEsc(r.mobile || '—')}</span></div>
        <div>Email: <span data-field-key="consumerEmail" data-field-label="Email" data-value-type="text" data-section="header">${pmtEsc(r.email || '—')}</span></div>
      </td>
      <td style="width:40%;vertical-align:top;border:none;padding:0;text-align:right">
        <div>Place Of Supply: <span data-field-key="placeOfSupply" data-field-label="Place of Supply" data-value-type="text" data-section="header">${pmtEsc(placeOfSupply)}</span></div>
        <div style="margin-top:2px">GSTIN: <span data-field-key="companyGstin" data-field-label="GSTIN" data-value-type="text" data-section="header">${pmtEsc(companyGstin)}</span></div>
        <div style="margin-top:2px">CIN No.: <span data-field-key="companyCin" data-field-label="CIN No." data-value-type="text" data-section="header">${pmtEsc(companyCin)}</span></div>
        <div style="margin-top:2px">Receipt Date: <span data-field-key="receiptDate" data-field-label="Receipt Date" data-value-type="date" data-section="header">${pmtFmtDate(r.received_date)}</span></div>
      </td>
    </tr>
  </table>

  <!-- PAYMENT NARRATIVE -->
  <p style="margin:0 0 14px;line-height:1.7">
    Received with thanks from <strong><span data-field-key="narrativeConsumerName" data-field-label="Consumer Name (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(consumerName)}</span></strong>
    a sum of <strong>Rs. <span data-field-key="narrativeAmount" data-field-label="Amount (Narrative)" data-value-type="currency" data-section="narrative">${pmtFmtAmt(totalAmount)}</span> /-</strong>
    (<strong><span data-field-key="amountInWords" data-field-label="Amount in Words" data-value-type="text" data-section="narrative">${pmtEsc(amountWords)}</span></strong>)
    <span data-field-key="narrativePaymentMethod" data-field-label="Payment Method (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(narrative)}</span> against the Unit No.
    <strong><span data-field-key="narrativeUnitNo" data-field-label="Unit Number (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.unit_number || '—')}</span></strong> on
    <strong><span data-field-key="narrativeFloor" data-field-label="Floor (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(floorOrdinal)}</span> Floor</strong> in
    <strong><span data-field-key="narrativeProjectName" data-field-label="Project Name (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.project_name || '—')}</span></strong>,
    <span data-field-key="narrativeLocation" data-field-label="Project Location (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.project_location || '—')}</span>.
    as per following details:
  </p>

  <!-- INSTALLMENT TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px">
    <thead>
      <tr>
        ${TH('S.No.','4%')}
        ${TH('Installment')}
        ${TH('Charge')}
        ${TH('HSN/SAC','8%')}
        ${TH('Amount','11%')}
        ${TH('CGST','8%')}
        ${TH('SGST','8%')}
        ${TH('Total Amount','11%')}
      </tr>
    </thead>
    <tbody>
      ${tableBodyRows}
      ${addonRows}
      ${summaryRows}
    </tbody>
  </table>

  <!-- AMOUNT BOX -->
  <div style="display:inline-block;border:2px solid #000;padding:6px 14px;font-weight:bold;font-size:13px;margin:10px 0">&#8377; <span data-field-key="amountBox" data-field-label="Amount Box" data-value-type="currency" data-section="footer">${pmtFmtAmt(totalAmount)}</span>/-</div>

  <!-- SIGNATURE BLOCK -->
  <div style="text-align:right;margin-top:20px">
    <div>For ${pmtEsc(companyName)}</div>
    <div style="height:48px"></div>
    <div>Authorized Signatory</div>
  </div>

  <!-- NOTES -->
  <div style="margin-top:16px;font-size:10px;border-top:1px solid #ccc;padding-top:8px">
    <div style="font-weight:700;margin-bottom:4px">Notes :</div>
    <div>1. ${pmtEsc(note1)}</div>
    <div style="margin-top:3px">2. ${pmtEsc(note2)}</div>
    <div style="margin-top:3px">3. ${pmtEsc(note3)}</div>
    <div style="margin-top:3px">4. ${pmtEsc(note4)}</div>
  </div>

</div>`;
}

function buildPaymentReceiptHtml(r: any, settings: Record<string, string>, coApplicants: any[], allInstallments: any[]): string {
  r.co_applicants = coApplicants;

  const customerCopy = buildPaymentReceiptCopy(r, settings, 'CUSTOMER COPY', allInstallments);
  const officeCopy   = buildPaymentReceiptCopy(r, settings, 'OFFICE COPY',   allInstallments);

  const receiptNo = pmtEsc(r.receipt_number || '—');
  const emailSubject = encodeURIComponent(`Payment Receipt - ${r.receipt_number || ''}`);
  const emailBody    = encodeURIComponent(
    `Dear Customer,\n\nPlease find your payment receipt details below.\nReceipt No: ${r.receipt_number || ''}\n\nRegards,\n${settings['company_name'] || 'ROF Group'}`
  );
  const emailHref = `mailto:${encodeURIComponent(r.email || '')}?subject=${emailSubject}&body=${emailBody}`;

  const btnNav = 'background:#ffffff;color:#1a3c5e;border:2px solid #1a3c5e;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px';
  const btnClose = 'background:#ffffff;color:#dc3545;border:2px solid #dc3545;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px';
  const hoverNav = `onmouseover="this.style.background='#1a3c5e';this.style.color='#ffffff'" onmouseout="this.style.background='#ffffff';this.style.color='#1a3c5e'"`;
  const hoverClose = `onmouseover="this.style.background='#dc3545';this.style.color='#ffffff'" onmouseout="this.style.background='#ffffff';this.style.color='#dc3545'"`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt - ${receiptNo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; margin: 20px; }
  .receipt-copy { max-width: 750px; margin: auto; border: 1px solid #000; padding: 24px; margin-bottom: 40px; }
  .hide-customer .customer-copy { display: none; }
  .hide-office   .office-copy   { display: none; }
  @media print {
    .no-print { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }
    .office-copy { page-break-before: always; }
    .customer-copy, .office-copy { margin-top: 0 !important; padding-top: 0 !important; }
    body { margin: 0 !important; padding: 0 !important; }
    @page { margin: 15mm; size: A4; }
  }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:1000;background:#1a3c5e;padding:10px 20px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
  <button onclick="document.body.className='';window.print()" style="${btnNav}" ${hoverNav}>&#128424; Print Both Copies</button>
  <button onclick="document.body.className='hide-office';window.print();setTimeout(()=>document.body.className='',500)" style="${btnNav}" ${hoverNav}>&#11015; Download Customer Copy</button>
  <button onclick="document.body.className='hide-customer';window.print();setTimeout(()=>document.body.className='',500)" style="${btnNav}" ${hoverNav}>&#11015; Download Office Copy</button>
  <button onclick="window.location.href='${emailHref}'" style="${btnNav}" ${hoverNav}>&#9993; E-Mail</button>
  <button onclick="window.opener ? window.close() : window.history.length > 1 ? window.history.back() : (window.location.href='/')" style="${btnClose}" ${hoverClose}>&#10005; Close</button>
</div>
<div class="no-print" style="height:52px"></div>

<div class="customer-copy">${customerCopy}</div>
<div class="office-copy">${officeCopy}</div>

</body>
</html>`;
}

// GET /api/payments/receipts/:id/html — Print-ready receipt with full plan breakdown
router.get('/receipts/:id/html', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const [settingsResult, receiptResult] = await Promise.all([
      db.query('SELECT key, value FROM global_settings'),
      db.query(`
        SELECT
          r.id, r.receipt_number, r.installment_index,
          r.consumer_id, r.payment_plan_id,
          r.amount_received_inr,
          r.plc_amount, r.edc_amount, r.idc_amount,
          r.other_charge_amount, r.other_charge_desc, r.interest_amount,
          r.payment_method, r.transaction_ref, r.received_date,
          r.bank_name, r.cheque_no, r.cheque_date, r.branch,
          c.salutation, c.first_name, c.last_name, c.mobile, c.email,
          c.nationality,
          c.present_address, c.present_city, c.present_state, c.present_pin,
          c.form_no, c.registration_no,
          p.id AS project_id,
          p.name AS project_name,
          p.location AS project_location,
          u.unit_number, u.floor, u.bhk_type,
          u.carpet_area_sqft, u.super_area_sqft, u.base_price_inr, u.total_price_inr,
          u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
          pp.total_amount_inr AS plan_total_inr,
          COALESCE(d.cgst_amount, ROUND(r.amount_received_inr * 0.005)) AS cgst_amount,
          COALESCE(d.sgst_amount, ROUND(r.amount_received_inr * 0.005)) AS sgst_amount
        FROM receipts r
        JOIN consumers c ON c.id = r.consumer_id
        LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id
        LEFT JOIN projects p ON p.id = pp.project_id
        LEFT JOIN units u ON u.id = pp.unit_id
        LEFT JOIN demands d ON d.id = r.demand_id
        WHERE r.id = $1
      `, [id]),
    ]);

    if (!receiptResult.rows[0]) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];
    const settings: Record<string, string> = {};
    for (const row of settingsResult.rows) settings[row.key] = row.value;

    // Fetch full plan installments with status + plan template names
    let allInstallments: any[] = [];
    if (receipt.payment_plan_id) {
      try {
        const instResult = await db.query(`
          SELECT
            d.id AS demand_id,
            d.installment_index,
            d.demand_type,
            d.status AS demand_status,
            d.delivery_status,
            d.amount_due_inr,
            COALESCE(d.cgst_amount, 0) AS cgst_amount,
            COALESCE(d.sgst_amount, 0) AS sgst_amount,
            COALESCE(
              pst.installment_name,
              CASE
                WHEN d.demand_type = 'allotment'   THEN 'At the time of Allotment'
                WHEN d.demand_type = 'installment' THEN 'Installment #' || d.installment_index::text
                ELSE COALESCE(d.demand_type, 'Installment #' || d.installment_index::text)
              END
            ) AS installment_name,
            COALESCE(pst.percentage, 0) AS percentage,
            r2.id AS paid_receipt_id,
            r2.receipt_number AS paid_receipt_no,
            r2.received_date  AS paid_date,
            r2.amount_received_inr AS paid_amount
          FROM demands d
          LEFT JOIN LATERAL (
            SELECT pst2.installment_name, pst2.percentage
            FROM plan_schedule_templates pst2
            WHERE pst2.project_id = $2
              AND pst2.installment_index = d.installment_index
            ORDER BY pst2.plan_name
            LIMIT 1
          ) pst ON true
          LEFT JOIN LATERAL (
            SELECT r2.id, r2.receipt_number, r2.received_date, r2.amount_received_inr
            FROM receipts r2
            WHERE r2.payment_plan_id = d.payment_plan_id
              AND r2.installment_index = d.installment_index
              AND r2.status != 'cancelled'
            ORDER BY r2.created_at DESC
            LIMIT 1
          ) r2 ON true
          WHERE d.payment_plan_id = $1
          ORDER BY d.installment_index
        `, [receipt.payment_plan_id, receipt.project_id || null]);
        allInstallments = instResult.rows;
      } catch { allInstallments = []; }
    }

    let coApplicants: any[] = [];
    try {
      const coResult = await db.query(
        `SELECT salutation, first_name, last_name, applicant_number
         FROM co_applicants WHERE consumer_id = $1 ORDER BY applicant_number ASC`,
        [receipt.consumer_id]
      );
      coApplicants = coResult.rows;
    } catch { coApplicants = []; }

    // Fetch penal interest for this receipt's consumer + installment
    if (!receipt.interest_amount || parseFloat(receipt.interest_amount) === 0) {
      try {
        const penalResult = await db.query(
          `SELECT amount_inr, interest_waived_inr, rate_percent
           FROM penal_interests
           WHERE consumer_id = $1
             AND payment_plan_id = $2
             AND installment_index = $3
           ORDER BY calculated_at DESC LIMIT 1`,
          [receipt.consumer_id, receipt.payment_plan_id, receipt.installment_index]
        );
        if (penalResult.rows.length > 0) {
          const pi = penalResult.rows[0];
          const net = parseFloat(pi.amount_inr || 0) - parseFloat(pi.interest_waived_inr || 0);
          if (net > 0) receipt.penal_interest_amount = net;
        }
      } catch { /* non-fatal */ }
    }

    const html = buildPaymentReceiptHtml(receipt, settings, coApplicants, allInstallments);

    // Persist to documents table on first view so it can be edited later
    let receiptDocId: string | null = null;
    try {
      const existing = await db.query(
        `SELECT id FROM documents WHERE document_type = 'payment_receipt' AND reference_id = $1 LIMIT 1`,
        [id]
      );
      if (existing.rows.length === 0) {
        const docInsert = await db.query(
          `INSERT INTO documents (document_type, consumer_id, html_content, reference_id, document_subtype, version_number, edit_count, is_edited, created_by_user_id)
           VALUES ('payment_receipt', $1, $2, $3, 'receipt', 1, 0, FALSE, $4) RETURNING id`,
          [receipt.consumer_id, html, id, req.userId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']
        );
        receiptDocId = docInsert.rows[0].id;
        await db.query(
          `INSERT INTO document_versions (document_id, version_number, html_content, is_original, edit_reason)
           VALUES ($1, 1, $2, TRUE, 'Original generation')`,
          [receiptDocId, html]
        );
      } else {
        receiptDocId = existing.rows[0].id;
      }
    } catch { /* non-fatal — don't block the response */ }

    // Apply any active field overrides so edits persist across re-renders
    let finalHtml = html;
    if (receiptDocId) {
      try {
        const overridesRes = await db.query(
          `SELECT field_key, current_value FROM document_field_overrides
           WHERE document_id = $1 AND is_active = TRUE`,
          [receiptDocId]
        );
        if (overridesRes.rows.length > 0) {
          const overridesMap: Record<string, string> = {};
          overridesRes.rows.forEach((o: { field_key: string; current_value: string }) => {
            overridesMap[o.field_key] = o.current_value;
          });
          finalHtml = applyOverridesToHtml(html, overridesMap);
          // Keep stored html_content in sync
          await db.query(
            `UPDATE documents SET html_content = $1, updated_at = NOW() WHERE id = $2`,
            [finalHtml, receiptDocId]
          );
        }
      } catch { /* non-fatal */ }
    }

    const token = (req.headers.authorization?.split(' ')[1] || req.query.token as string || '');
    const htmlWithEdit = receiptDocId
      ? finalHtml.replace('</body>', buildEditScript(receiptDocId, token, 'payment_receipt') + '\n</body>')
      : finalHtml;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlWithEdit);
  } catch (err) {
    next(err);
  }
});

// ── RECEIPT ENTRY FORM (standalone HTML page) ─────────────────────────────────

function buildReceiptFormHtml(consumer: any, installments: any[], banks: any[], users: any[], token: string): string {
  const fmtN = (v: any) => {
    const n = parseFloat(String(v || 0));
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const today = new Date().toISOString().split('T')[0];
  const inp = `width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;box-sizing:border-box;height:30px;`;

  const instOpts = installments.map((x: any) => {
    const isPaid = x.demand_status === 'paid' || x.demand_delivery_status === 'paid';
    return `<option value="${x.installment_index}"${isPaid ? ' disabled style="color:#999;background:#f5f5f5;"' : ''}>${x.installment_name}${isPaid ? ' (Already Paid)' : ''}</option>`;
  }).join('') + `<option value="-1">Other</option>`;

  const bankOpts = `<option value="">&lt;-Select-&gt;</option>` + banks.map((b: any) =>
    `<option value="${b.name}">${b.name}</option>`
  ).join('');

  const userOpts = `<option value="">&lt;-Select-&gt;</option>` + users.map((u: any) =>
    `<option value="${u.id}">${u.name || u.email || u.id}</option>`
  ).join('');

  const bal = parseFloat(consumer.balance || 0);
  const balColor = bal > 0 ? '#c0392b' : '#27ae60';

  const toggleCSS = `
    .tgl{display:inline-flex;border:1px solid #ccc;border-radius:3px;overflow:hidden;}
    .tgl button{padding:5px 11px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:#f0f0f0;color:#555;}
    .tgl button.on{background:#1db5a0;color:#fff;}
    .tgl button.on2{background:#c0392b;color:#fff;}
  `;

  const tabs = ['Cheque','Draft','Online','Cash','Adjust','Dealer Adjustment','TDS Challan','Card'];

  const amountRow = (prefix: string) => `
    <div style="display:grid;grid-template-columns:repeat(7,1fr) auto;gap:8px;margin-bottom:10px;align-items:end;">
      <div><label class="lbl">${prefix} Amount*</label><input type="number" id="rf-amount" placeholder="0.00" oninput="calcTotals()" style="${inp}"></div>
      <div><label class="lbl">Interest</label><input type="number" id="rf-interest" placeholder="0.00" oninput="calcTotals()" style="${inp}"></div>
      <div><label class="lbl">GST Interest (1.000%)</label><input type="number" id="rf-gst-interest" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">Paid</label><input type="number" id="rf-paid" placeholder="0.00" readonly style="${inp}background:#f8f9fa;font-weight:700;"></div>
      <div><label class="lbl">S.Tax (0.000%)</label><input type="number" id="rf-stax" value="0" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">CGST (0.500%)</label><input type="number" id="rf-cgst" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">SGST (0.500%)</label><input type="number" id="rf-sgst" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <button onclick="addExtraAddOn()" style="background:#1db5a0;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;height:30px;">+ Extra Add On</button>
    </div>`;

  const chequeInstrRow = `
    <div style="display:grid;grid-template-columns:130px 150px 1fr 1fr 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Cheque No.</label><input type="text" id="rf-cheque-no" style="${inp}"></div>
      <div><label class="lbl">Cheque Date</label><input type="date" id="rf-cheque-date" value="${today}" style="${inp}"></div>
      <div><label class="lbl">Bank Name</label><select id="rf-bank" style="${inp}">${bankOpts}</select></div>
      <div><label class="lbl">Branch Name</label><input type="text" id="rf-branch" style="${inp}"></div>
      <div><label class="lbl">Employee</label><select id="rf-employee" style="${inp}">${userOpts}</select></div>
    </div>`;

  const onlineInstrRow = `
    <div style="display:grid;grid-template-columns:1fr 150px 1fr 1fr 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Transaction Ref.</label><input type="text" id="rf-txn-ref" style="${inp}"></div>
      <div><label class="lbl">Transaction Date</label><input type="date" id="rf-txn-date" value="${today}" style="${inp}"></div>
      <div><label class="lbl">Bank Name</label><select id="rf-bank-online" style="${inp}">${bankOpts}</select></div>
      <div><label class="lbl">Branch Name</label><input type="text" id="rf-branch-online" style="${inp}"></div>
      <div><label class="lbl">Employee</label><select id="rf-employee-online" style="${inp}">${userOpts}</select></div>
    </div>`;

  const cashOnlyRow = `
    <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Employee</label><select id="rf-employee-cash" style="${inp}">${userOpts}</select></div>
    </div>`;

  const tabContents: Record<string, string> = {
    'Cheque': amountRow('Cheque') + chequeInstrRow,
    'Draft': amountRow('Draft') + chequeInstrRow.replace(/rf-cheque-no/g,'rf-draft-no').replace(/rf-cheque-date/g,'rf-draft-date').replace(/rf-bank/g,'rf-bank-draft').replace(/rf-branch/g,'rf-branch-draft').replace(/rf-employee/g,'rf-employee-draft').replace('Cheque No.','Draft No.').replace('Cheque Date','Draft Date'),
    'Online': amountRow('Online') + onlineInstrRow,
    'Cash': amountRow('Cash') + cashOnlyRow,
    'Adjust': amountRow('Adjust') + `<div><label class="lbl">Remarks</label><input type="text" id="rf-adjust-remarks" style="${inp}"></div>`,
    'Dealer Adjustment': amountRow('Dealer Adj.') + `<div><label class="lbl">Remarks</label><input type="text" id="rf-dealer-remarks" style="${inp}"></div>`,
    'TDS Challan': amountRow('TDS') + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end;"><div><label class="lbl">Challan No.</label><input type="text" id="rf-challan-no" style="${inp}"></div><div><label class="lbl">BSR Code</label><input type="text" id="rf-bsr-code" style="${inp}"></div><div><label class="lbl">Deposit Date</label><input type="date" id="rf-deposit-date" style="${inp}"></div></div>`,
    'Card': amountRow('Card') + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end;"><div><label class="lbl">Terminal ID</label><input type="text" id="rf-terminal-id" style="${inp}"></div><div><label class="lbl">Approval Code</label><input type="text" id="rf-approval-code" style="${inp}"></div><div><label class="lbl">Employee</label><select id="rf-employee-card" style="${inp}">${userOpts}</select></div></div>`,
  };

  const tabBtns = tabs.map((t, i) =>
    `<button id="tab-btn-${t.replace(/\s/g,'')}" onclick="switchTab('${t}')" style="padding:7px 13px;border:1px solid #dee2e6;border-bottom:none;background:${i===0?'#1db5a0':'#f8f9fa'};color:${i===0?'#fff':'#333'};cursor:pointer;font-size:12px;font-weight:600;border-radius:4px 4px 0 0;">${t}</button>`
  ).join(' ');

  const tabPanels = tabs.map((t, i) =>
    `<div id="tab-panel-${t.replace(/\s/g,'')}" class="tab-panel" style="display:${i===0?'block':'none'};padding:14px;">${tabContents[t] || amountRow(t)}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Receipt — ${consumer.consumer_name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;background:#f4f6f8;padding:12px;}
  .lbl{display:block;font-size:11px;font-weight:600;color:#555;margin-bottom:3px;}
  ${toggleCSS}
  .sec{border:1px solid #b8d4e4;background:#fff;margin-bottom:0;}
  .sec:last-of-type{border-radius:0 0 4px 4px;}
  .sec-hdr{border-radius:4px 4px 0 0;background:#e8f4f8;border-bottom:1px solid #b8d4e4;padding:8px 14px;}
</style>
</head>
<body>

<!-- Section 1: Consumer Header -->
<div class="sec-hdr" style="border:1px solid #b8d4e4;border-radius:4px 4px 0 0;">
  <div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
    <span style="color:#c0392b;font-weight:bold;font-size:15px;">${(consumer.salutation ? consumer.salutation + ' ' : '') + consumer.consumer_name} [${consumer.registration_no || '—'}]</span>
    <span style="color:#c0392b;font-weight:bold;">Tower: ${consumer.tower_name || '—'}</span>
    <span style="color:#c0392b;font-weight:bold;">Unit No.: ${consumer.unit_number || '—'}</span>
    <span style="color:#c0392b;font-weight:bold;">TDS Applicable: No</span>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;font-size:13px;color:#333;">
    <span>Unit Cost: <strong>${fmtN(consumer.base_price_inr)}</strong></span>
    <span>S. Tax: <strong>0</strong></span>
    <span>GST: <strong>${fmtN(consumer.total_gst)}</strong></span>
    <span>Total Cost: <strong>${fmtN(consumer.total_cost)}</strong></span>
    <span style="color:#1a56db;">Paid: <strong>${fmtN(consumer.total_paid)}</strong></span>
    <span style="color:${balColor};">Balance: <strong>${fmtN(bal)}</strong></span>
    <span>Interest: <strong>${fmtN(consumer.interest_paid)}</strong></span>
  </div>
</div>

<!-- Section 2: Payment Detail -->
<div class="sec" style="padding:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="color:#1a56db;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:.5px;">PAYMENT DETAIL</span>
    <div class="tgl">
      <button id="btn-self" class="on" onclick="setSelfLoan('self')">Self</button>
      <button id="btn-loan" onclick="setSelfLoan('loan')">Bank Loan</button>
    </div>
  </div>

  <!-- Row 1 -->
  <div style="display:grid;grid-template-columns:160px 1fr 1fr 1fr auto;gap:12px;margin-bottom:14px;align-items:end;">
    <div>
      <label class="lbl">Receipt Date*</label>
      <input type="date" id="rf-date" value="${today}" style="${inp}">
    </div>
    <div>
      <label class="lbl">Received For</label>
      <input type="text" id="rf-received-for" value="${consumer.company_name || ''}" style="${inp}">
    </div>
    <div>
      <label class="lbl">Account Holder</label>
      <input type="text" id="rf-account-holder" style="${inp}">
    </div>
    <div>
      <label class="lbl">Remark</label>
      <input type="text" id="rf-remark" style="${inp}">
    </div>
    <div>
      <label class="lbl">Invoice Date By</label>
      <div class="tgl">
        <button id="btn-receipt-date" class="on" onclick="setInvoiceDateBy('receipt')">Receipt Date</button>
        <button id="btn-posting-date" onclick="setInvoiceDateBy('posting')">Posting Date</button>
      </div>
    </div>
  </div>

  <!-- Row 2 -->
  <div style="display:grid;grid-template-columns:260px 1fr 1fr 1fr;gap:12px;align-items:end;">
    <div>
      <label class="lbl">On Account Of</label>
      <div style="display:flex;gap:6px;">
        <select id="rf-account-of" style="${inp}flex:1;" onchange="onAccountOfChange()">
          ${instOpts}
        </select>
        <input type="text" id="rf-account-of-other" placeholder="Specify…" style="${inp}flex:1;display:none;">
      </div>
    </div>
    <div>
      <label class="lbl">Interest</label>
      <div class="tgl">
        <button id="btn-int-inclusive" onclick="setInterest('inclusive')">Inclusive</button>
        <button id="btn-int-exclusive" class="on" onclick="setInterest('exclusive')">Exclusive</button>
      </div>
    </div>
    <div>
      <label class="lbl">Extra Add On</label>
      <div class="tgl">
        <button id="btn-xao-inclusive" onclick="setExtraAddOn('inclusive')">Inclusive</button>
        <button id="btn-xao-exclusive" class="on" onclick="setExtraAddOn('exclusive')">Exclusive</button>
      </div>
    </div>
    <div>
      <label class="lbl">TDS</label>
      <div class="tgl">
        <button id="btn-tds-calc" onclick="setTds('calculate')">Calculate Exclusive</button>
        <button id="btn-tds-none" class="on" onclick="setTds('not_calculate')">Not Calculate</button>
      </div>
    </div>
  </div>
</div>

<!-- Section 3: Payment Tabs -->
<div class="sec">
  <div style="display:flex;gap:2px;padding:10px 14px 0;flex-wrap:wrap;border-bottom:2px solid #dee2e6;">
    ${tabBtns}
  </div>
  ${tabPanels}
</div>

<!-- Section 4: Save / Close -->
<div class="sec" style="padding:10px 14px;display:flex;gap:10px;background:#f8f9fa;">
  <button onclick="saveReceipt()" id="rf-save-btn" style="background:#1db5a0;color:#fff;border:none;padding:9px 26px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;letter-spacing:.5px;">SAVE</button>
  <button onclick="window.close()" style="background:#6c757d;color:#fff;border:none;padding:9px 20px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button>
</div>

<script>
const CONSUMER_ID = '${consumer.consumer_id}';
const PAYMENT_PLAN_ID = '${consumer.payment_plan_id || ''}';
const TOKEN = '${token}';
const API_BASE = window.location.origin + '/api';
let currentTab = 'Cheque';
let selfOrLoan = '${consumer.self_or_loan || 'self'}';
let invoiceDateBy = 'receipt';
let interestMode = 'exclusive';
let extraAddOnMode = 'exclusive';
let tdsMode = 'not_calculate';

function setSelfLoan(mode) {
  selfOrLoan = mode;
  document.getElementById('btn-self').className = mode === 'self' ? 'on' : '';
  document.getElementById('btn-loan').className = mode === 'loan' ? 'on' : '';
}

function setInvoiceDateBy(mode) {
  invoiceDateBy = mode;
  document.getElementById('btn-receipt-date').className = mode === 'receipt' ? 'on' : '';
  document.getElementById('btn-posting-date').className = mode === 'posting' ? 'on' : '';
}

function setInterest(mode) {
  interestMode = mode;
  document.getElementById('btn-int-inclusive').className = mode === 'inclusive' ? 'on' : '';
  document.getElementById('btn-int-exclusive').className = mode === 'exclusive' ? 'on' : '';
}

function setExtraAddOn(mode) {
  extraAddOnMode = mode;
  document.getElementById('btn-xao-inclusive').className = mode === 'inclusive' ? 'on' : '';
  document.getElementById('btn-xao-exclusive').className = mode === 'exclusive' ? 'on' : '';
}

function setTds(mode) {
  tdsMode = mode;
  document.getElementById('btn-tds-calc').className = mode === 'calculate' ? 'on' : '';
  document.getElementById('btn-tds-none').className = mode === 'not_calculate' ? 'on' : '';
}

function onAccountOfChange() {
  const sel = document.getElementById('rf-account-of');
  const other = document.getElementById('rf-account-of-other');
  if (other) other.style.display = sel.value === '-1' ? 'inline-block' : 'none';
}

function calcTotals() {
  const amount = parseFloat(document.getElementById('rf-amount')?.value || 0);
  const interest = parseFloat(document.getElementById('rf-interest')?.value || 0);
  const gstInterest = parseFloat((interest * 0.01).toFixed(2));
  const cgst = parseFloat((amount * 0.005).toFixed(2));
  const sgst = parseFloat((amount * 0.005).toFixed(2));
  const paid = amount + interest + gstInterest;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val.toFixed(2); };
  set('rf-gst-interest', gstInterest);
  set('rf-cgst', cgst);
  set('rf-sgst', sgst);
  set('rf-paid', paid);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
    btn.style.background = '#f8f9fa'; btn.style.color = '#333';
  });
  const panel = document.getElementById('tab-panel-' + tabName.replace(/\\s/g,''));
  if (panel) panel.style.display = 'block';
  const btn = document.getElementById('tab-btn-' + tabName.replace(/\\s/g,''));
  if (btn) { btn.style.background = '#1db5a0'; btn.style.color = '#fff'; }
  currentTab = tabName;
}

function addExtraAddOn() {
  alert('Extra Add On feature not yet implemented.');
}

function getFieldVal(id) {
  const el = document.getElementById(id);
  return el ? (el.value || '') : '';
}

async function saveReceipt() {
  const amount = parseFloat(getFieldVal('rf-amount') || 0);
  if (!amount || amount <= 0) { showMsg('Please enter an amount', true); return; }

  const receiptDate = getFieldVal('rf-date');
  if (!receiptDate) { showMsg('Please select receipt date', true); return; }

  const accountOfSel = document.getElementById('rf-account-of');
  const isOther = !accountOfSel || accountOfSel.value === '-1';
  const installmentIndex = !isOther && accountOfSel.value
    ? parseInt(accountOfSel.value)
    : null;

  const interest = parseFloat(getFieldVal('rf-interest') || 0);
  const gstInterest = parseFloat(getFieldVal('rf-gst-interest') || 0);
  const totalAmount = amount + interest + gstInterest;

  const modeMap = {
    'Cheque':'cheque','Draft':'cheque','Online':'neft_rtgs',
    'Cash':'cash','Card':'card','Adjust':'cash',
    'Dealer Adjustment':'cash','TDS Challan':'cash'
  };

  const bankName = getFieldVal('rf-bank') || getFieldVal('rf-bank-online') || getFieldVal('rf-bank-draft') || '';
  const branch = getFieldVal('rf-branch') || getFieldVal('rf-branch-online') || getFieldVal('rf-branch-draft') || '';
  const chequeNo = getFieldVal('rf-cheque-no') || getFieldVal('rf-draft-no') || getFieldVal('rf-txn-ref') || '';
  const chequeDate = getFieldVal('rf-cheque-date') || getFieldVal('rf-draft-date') || getFieldVal('rf-txn-date') || '';

  const payload = {
    consumerId: CONSUMER_ID,
    amountReceivedInr: totalAmount,
    baseAmount: amount,
    interestAmount: interest || undefined,
    paymentDate: receiptDate,
    paymentMode: modeMap[currentTab] || 'cash',
    bankName: bankName || undefined,
    branch: branch || undefined,
    chequeNo: chequeNo || undefined,
    chequeDate: chequeDate || undefined,
    remarks: getFieldVal('rf-remark') || undefined,
    installmentIndex: installmentIndex !== null ? installmentIndex : undefined,
    isOtherPayment: isOther || undefined,
    otherChargeDesc: isOther
      ? ((document.getElementById('rf-account-of-other')?.value || '').trim() || undefined)
      : undefined,
  };

  const saveBtn = document.getElementById('rf-save-btn');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  try {
    const res = await fetch(API_BASE + '/payments/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    showMsg('Receipt ' + (data.data?.receipt_number || '') + ' created successfully!');
    setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        try { window.opener.ReportsPage && window.opener.ReportsPage.fetchPaymentFile(); } catch(e) {}
      }
      window.close();
    }, 2200);
  } catch (err) {
    showMsg('Error: ' + err.message, true);
    saveBtn.textContent = 'SAVE';
    saveBtn.disabled = false;
  }
}

function showMsg(msg, isError) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);' + (isError ? 'background:#c0392b;color:#fff;' : 'background:#1db5a0;color:#fff;');
  d.textContent = (isError ? '✖ ' : '✔ ') + msg;
  document.body.appendChild(d);
  if (!isError) setTimeout(() => d.remove(), 3000);
}
</script>
</body>
</html>`;
}

// GET /api/payments/receipt-form/:consumerId — Serve standalone receipt entry form
router.get('/receipt-form/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const token = (req.headers.authorization?.split(' ')[1] || req.query.token as string || '');

    // 1. Consumer + financial summary
    const consumerResult = await db.query(`
      SELECT
        c.id AS consumer_id,
        c.registration_no,
        c.salutation,
        c.first_name || ' ' || COALESCE(c.last_name,'') AS consumer_name,
        c.finance_bank,
        c.loan_amount,
        u.unit_number,
        u.floor,
        u.base_price_inr,
        u.total_price_inr,
        t.tower_name,
        p.name AS project_name,
        p.id AS project_id,
        br.id AS booking_record_id,
        pp.id AS payment_plan_id,
        COALESCE(br.self_or_loan, 'self') AS self_or_loan,
        COALESCE(br.plc_amount, 0) AS plc_amount,
        COALESCE(br.other_charge_amount, 0) AS other_charge_amount,
        COALESCE(bpt.cgst_amount, 0) AS cgst_amount,
        COALESCE(bpt.sgst_amount, 0) AS sgst_amount,
        COALESCE(bpt.cgst_amount, 0) + COALESCE(bpt.sgst_amount, 0) AS total_gst,
        u.base_price_inr
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0)
          + COALESCE(bpt.cgst_amount, 0)
          + COALESCE(bpt.sgst_amount, 0) AS total_cost,
        COALESCE((
          SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = c.id AND r.status != 'cancelled'
        ), 0) AS total_paid,
        u.base_price_inr
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0)
          + COALESCE(bpt.cgst_amount, 0)
          + COALESCE(bpt.sgst_amount, 0)
          - COALESCE((
            SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = c.id AND r.status != 'cancelled'
          ), 0) AS balance,
        COALESCE((
          SELECT SUM(r.interest_amount)
          FROM receipts r
          WHERE r.consumer_id = c.id AND r.status != 'cancelled'
        ), 0) AS interest_paid,
        (SELECT value FROM global_settings WHERE key = 'company_name' LIMIT 1) AS company_name
      FROM consumers c
      LEFT JOIN booking_records br ON br.consumer_id = c.id
      LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
      LEFT JOIN units u ON u.id = COALESCE(br.unit_id, pp.unit_id)
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
      WHERE c.id = $1
        AND u.id IS NOT NULL
      ORDER BY COALESCE(br.created_at, pp.created_at) DESC
      LIMIT 1
    `, [consumerId]);

    if (!consumerResult.rows[0]) {
      return res.status(404).send('<h2>Consumer not found or no booking record exists.</h2>');
    }
    const consumer = consumerResult.rows[0];

    // 2. Installments from plan_schedule_templates with demand status for dropdown guard
    const instResult = await db.query(`
      SELECT DISTINCT ON (pst.installment_index)
        pst.installment_index,
        pst.installment_name,
        pst.percentage,
        COALESCE(pst.flat_amount_inr, 0) AS flat_amount,
        COALESCE(d.status, 'pending') AS demand_status,
        COALESCE(d.delivery_status, 'pending') AS demand_delivery_status
      FROM plan_schedule_templates pst
      LEFT JOIN demands d
        ON d.consumer_id = $2
       AND d.installment_index = pst.installment_index
      WHERE pst.project_id = $1
      ORDER BY pst.installment_index
    `, [consumer.project_id, consumerId]);

    // 3. Banks
    const banksResult = await db.query(`SELECT id, name FROM banks ORDER BY name`);

    // 4. Users
    const usersResult = await db.query(`SELECT id, name, email FROM users ORDER BY name LIMIT 50`);

    const html = buildReceiptFormHtml(consumer, instResult.rows, banksResult.rows, usersResult.rows, token);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ── RECEIPT DETAIL PAGE (standalone HTML page) ─────────────────────────────────

function buildReceiptDetailHtml(rows: any[]): string {
  const fmtD = (d: any): string => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtN = (n: any): string => parseFloat(String(n || 0)).toFixed(2);
  const capitalizeMode = (mode: string): string => {
    if (!mode) return '—';
    const map: Record<string, string> = {
      cheque: 'Cheque', neft_rtgs: 'Online', bank_transfer: 'Online',
      upi: 'Online', cash: 'Cash', draft: 'Draft', card: 'Card', online: 'Online', neft: 'Online', rtgs: 'Online'
    };
    return map[mode.toLowerCase()] || mode;
  };

  const tdStyle  = `border:1px solid #dee2e6;padding:6px 8px;font-size:12px;`;
  const dthStyle = `border:1px solid #2d4d7a;padding:5px 6px;text-align:center;font-size:11px;font-weight:bold;white-space:nowrap;`;
  const dtdStyle = `border:1px solid #dee2e6;padding:4px 6px;font-size:11px;`;

  const buildDetailRows = (r: any): any[] => {
    const drows: any[] = [];
    let sno = 1;
    const basicAmt  = parseFloat(String(r.amount_received_inr || 0));
    const basicCgst = basicAmt * 0.005;
    const basicSgst = basicAmt * 0.005;
    drows.push({ sno: sno++, installmentName: r.installment_name || '—', head: 'Basic Price', amount: basicAmt, cgst: basicCgst, sgst: basicSgst, netAmount: basicAmt });

    if (parseFloat(String(r.plc_amount || 0)) > 0) {
      const a = parseFloat(String(r.plc_amount)), c = a * 0.09, s = a * 0.09;
      drows.push({ sno: sno++, installmentName: '', head: 'PLC', amount: a, cgst: c, sgst: s, netAmount: a + c + s });
    }
    if (parseFloat(String(r.edc_amount || 0)) > 0) {
      const a = parseFloat(String(r.edc_amount)), c = a * 0.09, s = a * 0.09;
      drows.push({ sno: sno++, installmentName: '', head: 'EDC', amount: a, cgst: c, sgst: s, netAmount: a + c + s });
    }
    if (parseFloat(String(r.idc_amount || 0)) > 0) {
      const a = parseFloat(String(r.idc_amount)), c = a * 0.09, s = a * 0.09;
      drows.push({ sno: sno++, installmentName: '', head: 'IDC', amount: a, cgst: c, sgst: s, netAmount: a + c + s });
    }
    if (parseFloat(String(r.other_charge_amount || 0)) > 0) {
      const a = parseFloat(String(r.other_charge_amount)), c = a * 0.09, s = a * 0.09;
      drows.push({ sno: sno++, installmentName: '', head: r.other_charge_desc || 'Other Charge', amount: a, cgst: c, sgst: s, netAmount: a + c + s });
    }
    if (parseFloat(String(r.interest_amount || 0)) > 0) {
      const a = parseFloat(String(r.interest_amount)), c = a * 0.005, s = a * 0.005;
      drows.push({ sno: sno++, installmentName: '', head: 'Interest', amount: a, cgst: c, sgst: s, netAmount: a + c + s });
    }
    return drows;
  };

  if (!rows || rows.length === 0) {
    return `<!DOCTYPE html><html><head><title>Receipt Detail</title></head><body style="font-family:Arial;padding:20px;">
<div style="background:#1e3a5f;color:white;padding:10px 16px;border-radius:4px;font-weight:bold;font-size:14px;">RECEIPT DETAIL</div>
<p style="margin-top:40px;color:#666;text-align:center;padding:40px;">No receipts found for this consumer.</p>
<div style="margin-top:16px;"><button onclick="window.close()" style="background:#6c757d;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button></div>
</body></html>`;
  }

  const consumer = rows[0];
  let totalAmount = 0, totalGst = 0, totalInterest = 0, totalExtraCharge = 0, totalNet = 0;
  rows.forEach((r: any) => {
    const amt   = parseFloat(String(r.amount_received_inr || 0));
    const intr  = parseFloat(String(r.interest_amount || 0));
    const extra = parseFloat(String(r.plc_amount || 0)) + parseFloat(String(r.edc_amount || 0))
                + parseFloat(String(r.idc_amount || 0)) + parseFloat(String(r.other_charge_amount || 0));
    // amt is inclusive of GST — GST is informational only, not added to net
    totalAmount += amt; totalGst += amt * 0.01; totalInterest += intr; totalExtraCharge += extra;
    totalNet += amt + intr + extra;
  });

  const receiptRowsHtml = rows.map((r: any, idx: number) => {
    const amt   = parseFloat(String(r.amount_received_inr || 0));
    const gst   = amt * 0.01; // back-calculated for display column only — inclusive in amt
    const intr  = parseFloat(String(r.interest_amount || 0));
    const extra = parseFloat(String(r.plc_amount || 0)) + parseFloat(String(r.edc_amount || 0))
                + parseFloat(String(r.idc_amount || 0)) + parseFloat(String(r.other_charge_amount || 0));
    const net   = amt + intr + extra;
    const drows = buildDetailRows(r);
    const dtotal = drows.reduce((acc: any, dr: any) => ({
      amount: acc.amount + dr.amount, cgst: acc.cgst + dr.cgst,
      sgst: acc.sgst + dr.sgst, net: acc.net + dr.netAmount
    }), { amount: 0, cgst: 0, sgst: 0, net: 0 });
    const bg = idx % 2 === 0 ? '#ffffff' : '#fef9f0';

    const detailRowsHtml = drows.map((dr: any) => `
        <tr>
          <td style="${dtdStyle}">${dr.installmentName}</td>
          <td style="${dtdStyle}">${dr.head}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.amount)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.cgst)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.sgst)}</td>
          <td style="${dtdStyle}text-align:right;font-weight:600;">${fmtN(dr.netAmount)}</td>
        </tr>`).join('') + `
        <tr style="background:#d0e8f0;font-weight:bold;">
          <td colspan="2" style="${dtdStyle}text-align:right;">Total</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.amount)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.cgst)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.sgst)}</td>
          <td style="${dtdStyle}text-align:right;font-weight:bold;">${fmtN(dtotal.net)}</td>
        </tr>`;

    return `
    <tr style="background:${bg};vertical-align:top;">
      <td style="${tdStyle}text-align:center;">${idx + 1}</td>
      <td style="${tdStyle}">${r.receipt_number || '—'}</td>
      <td style="${tdStyle}white-space:nowrap;">${fmtD(r.received_date)}</td>
      <td style="${tdStyle}">${capitalizeMode(r.payment_method)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(amt)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(gst)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(intr)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(extra)}</td>
      <td style="${tdStyle}text-align:right;font-weight:600;">${fmtN(net)}</td>
      <td style="${tdStyle}">${r.entry_by || '—'}</td>
      <td style="${tdStyle}white-space:nowrap;">${fmtD(r.created_at)}</td>
      <td style="${tdStyle}padding:0;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:420px;">
          <thead>
            <tr style="background:#1e3a5f;color:white;">
              <th style="${dthStyle}">Installment Name</th>
              <th style="${dthStyle}">Head</th>
              <th style="${dthStyle}text-align:right;">Amount</th>
              <th style="${dthStyle}text-align:right;">CGST</th>
              <th style="${dthStyle}text-align:right;">SGST</th>
              <th style="${dthStyle}text-align:right;">Net Amount</th>
            </tr>
          </thead>
          <tbody>${detailRowsHtml}</tbody>
        </table>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Receipt Detail — ${consumer.consumer_name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;font-size:12px;background:#f5f5f5;padding:16px;}
    @media print{.no-print{display:none!important;}body{padding:0;background:#fff;}}
  </style>
</head>
<body>
  <div style="background:#1e3a5f;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0;flex-wrap:wrap;gap:8px;">
    <span style="font-weight:bold;font-size:14px;letter-spacing:.5px;">RECEIPT DETAIL</span>
    <span><strong>Project:</strong> ${consumer.project_name}</span>
    <span><strong>Name:</strong> ${consumer.consumer_name}</span>
    <span><strong>Registration No.:</strong> ${consumer.registration_no}</span>
  </div>
  <div style="overflow-x:auto;border:1px solid #dee2e6;border-top:none;background:white;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:1200px;">
      <thead>
        <tr style="background:#2d5282;color:white;">
          <th style="${tdStyle}text-align:center;background:#2d5282;color:white;font-weight:bold;">S.No</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Receipt No.</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Receipt Date</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Payment Mode</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">GST</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Interest</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Extra Charge Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Net Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Entry By</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Entry Date</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Detail</th>
        </tr>
      </thead>
      <tbody>${receiptRowsHtml}</tbody>
      <tfoot>
        <tr style="background:#e8f4f8;font-weight:bold;">
          <td colspan="3" style="${tdStyle}text-align:right;font-weight:bold;">Total</td>
          <td style="${tdStyle}"></td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalAmount)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalGst)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalInterest)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalExtraCharge)}</td>
          <td style="${tdStyle}text-align:right;font-weight:bold;">${fmtN(totalNet)}</td>
          <td colspan="3" style="${tdStyle}"></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="no-print" style="margin-top:16px;display:flex;gap:10px;">
    <button onclick="window.print()" style="background:#1db5a0;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">PRINT</button>
    <button onclick="window.close()" style="background:#6c757d;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button>
  </div>
</body>
</html>`;
}

// GET /api/payments/receipt-detail/:consumerId — Standalone receipt detail page
router.get('/receipt-detail/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;

    const result = await db.query(`
      SELECT
        r.id,
        r.receipt_number,
        r.received_date,
        r.payment_method,
        r.amount_received_inr,
        COALESCE(r.plc_amount, 0)          AS plc_amount,
        COALESCE(r.edc_amount, 0)          AS edc_amount,
        COALESCE(r.idc_amount, 0)          AS idc_amount,
        COALESCE(r.interest_amount, 0)     AS interest_amount,
        COALESCE(r.other_charge_amount, 0) AS other_charge_amount,
        r.other_charge_desc,
        r.installment_index,
        r.status,
        r.created_at,
        COALESCE(u.name, 'System')                            AS entry_by,
        CASE
          WHEN pst.installment_name IS NOT NULL
            THEN pst.installment_name
          WHEN r.installment_index IS NULL
            AND r.other_charge_desc IS NOT NULL
            AND r.other_charge_desc != ''
            THEN r.other_charge_desc
          WHEN r.installment_index IS NULL
            THEN 'Booking Amount'
          ELSE 'General Payment'
        END                                                    AS installment_name,
        c.first_name || ' ' || COALESCE(c.last_name, '')      AS consumer_name,
        c.registration_no,
        p.name  AS project_name,
        un.unit_number,
        t.tower_name
      FROM receipts r
      JOIN consumers c    ON c.id  = r.consumer_id
      JOIN payment_plans pp ON pp.id = r.payment_plan_id
      JOIN units un        ON un.id = pp.unit_id
      JOIN projects p      ON p.id  = pp.project_id
      LEFT JOIN towers t   ON t.id  = un.tower_id
      LEFT JOIN users u    ON u.id  = r.received_by_user_id
      LEFT JOIN LATERAL (
        SELECT installment_name
        FROM   plan_schedule_templates
        WHERE  project_id       = p.id
          AND  installment_index = r.installment_index
        LIMIT 1
      ) pst ON true
      WHERE r.consumer_id = $1
        AND r.status != 'cancelled'
      ORDER BY r.received_date ASC, r.created_at ASC
    `, [consumerId]);

    const html = buildReceiptDetailHtml(result.rows);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ─── DEMAND STATUS PAGE ───────────────────────────────────────────────────────
// GET /api/payments/demand-status
router.get('/demand-status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      project_id, tower, floor, reg_no, name, city,
      due_date_from, due_date_to, delivery_status, demand_status,
      page = 1, limit = 50,
    } = req.query;

    const params: any[] = [];
    let where = 'WHERE 1=1';

    if (project_id) { params.push(project_id); where += ` AND p.id = $${params.length}`; }
    if (tower)      { params.push(`%${tower}%`); where += ` AND t.tower_name ILIKE $${params.length}`; }
    if (floor)      { params.push(floor); where += ` AND u.floor = $${params.length}`; }
    if (reg_no)     { params.push(`%${reg_no}%`); where += ` AND c.registration_no ILIKE $${params.length}`; }
    if (name)       { params.push(`%${name}%`); where += ` AND (c.name ILIKE $${params.length} OR c.first_name ILIKE $${params.length} OR c.last_name ILIKE $${params.length})`; }
    if (city)       { params.push(`%${city}%`); where += ` AND c.present_city ILIKE $${params.length}`; }
    // due_date filters apply to MAX(d.due_date) range — use HAVING to avoid excluding consumers
    // whose SOME demands fall outside range. We filter consumers who HAVE at least one demand in range.
    if (due_date_from) { params.push(due_date_from); where += ` AND EXISTS (SELECT 1 FROM demands dd WHERE dd.consumer_id = c.id AND dd.due_date >= $${params.length}::date)`; }
    if (due_date_to)   { params.push(due_date_to); where += ` AND EXISTS (SELECT 1 FROM demands dd WHERE dd.consumer_id = c.id AND dd.due_date <= $${params.length}::date)`; }
    if (delivery_status) { params.push(delivery_status); where += ` AND d.delivery_status = $${params.length}`; }
    if (demand_status && demand_status !== 'all') { params.push(demand_status); where += ` AND d.status = $${params.length}`; }

    const offset = (Number(page) - 1) * Number(limit);

    const dataResult = await db.query(`
      SELECT
        c.id AS consumer_id,
        c.registration_no,
        c.name,
        c.mobile,
        c.present_city,
        br.booking_date,
        br.booking_amount,
        u.unit_number,
        t.tower_name,
        u.floor AS floor_number,
        u.bhk_type,
        p.name AS project_name,
        COUNT(d.id)::int AS total_demands,
        COUNT(CASE WHEN d.status = 'paid' THEN 1 END)::int AS paid_demands,
        COUNT(CASE WHEN d.status = 'demanded' THEN 1 END)::int AS active_demands,
        COUNT(CASE WHEN d.status = 'pending' THEN 1 END)::int AS pending_demands,
        COALESCE(SUM(d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0)), 0)::bigint AS total_due,
        COALESCE(SUM(CASE WHEN d.status = 'paid'
          THEN d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0)
          ELSE 0 END), 0)::bigint AS total_paid,
        COALESCE(SUM(CASE WHEN d.status != 'paid'
          THEN d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0)
          ELSE 0 END), 0)::bigint AS outstanding,
        MAX(d.delivery_status) AS delivery_status
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN demands d ON d.consumer_id = c.id
      ${where}
      GROUP BY c.id, c.registration_no, c.name, c.mobile, c.present_city,
               br.booking_date, br.booking_amount, u.unit_number, t.tower_name,
               u.floor, u.bhk_type, p.name
      ORDER BY c.name ASC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `, params);

    const countResult = await db.query(`
      SELECT COUNT(DISTINCT c.id) AS total
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN demands d ON d.consumer_id = c.id
      ${where}
    `, params);

    res.json({
      success: true,
      data: dataResult.rows,
      total: parseInt(countResult.rows[0]?.total || '0'),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) { next(err); }
});

// ── CHEQUE CLEARING ENDPOINTS ────────────────────────────────────────────────

// GET /api/payments/clearing-banks/:projectId - List active bank accounts for a project
router.get('/clearing-banks/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      `SELECT id, bank_name, account_number, ifsc_code
       FROM bank_accounts
       WHERE project_id = $1 AND is_active = true
       ORDER BY bank_name`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/receipts/:id/deposit - Mark cheque as deposited
router.patch('/receipts/:id/deposit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { deposit_date } = req.body;

    if (!deposit_date) {
      return res.status(400).json({ error: 'deposit_date is required' });
    }

    const receiptRes = await db.query(
      `SELECT id, payment_method, status FROM receipts WHERE id = $1`,
      [id]
    );
    if (receiptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const receipt = receiptRes.rows[0];
    if (receipt.payment_method !== 'cheque') {
      return res.status(400).json({ error: 'Only cheque receipts can be deposited' });
    }
    if (receipt.status !== 'pending') {
      return res.status(400).json({ error: `Cannot deposit: receipt is '${receipt.status}', must be 'pending'` });
    }

    const result = await db.query(
      `UPDATE receipts
       SET status = 'deposited', deposit_date = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, receipt_number, status, deposit_date, amount_received_inr`,
      [deposit_date, id]
    );

    res.json({ success: true, message: 'Cheque marked as deposited', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/receipts/:id/clear - Mark cheque as cleared
router.patch('/receipts/:id/clear', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { clearing_date, clearing_bank_id } = req.body;

    if (!clearing_date) {
      return res.status(400).json({ error: 'clearing_date is required' });
    }

    const receiptRes = await db.query(
      `SELECT id, payment_method, status FROM receipts WHERE id = $1`,
      [id]
    );
    if (receiptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const receipt = receiptRes.rows[0];
    if (receipt.payment_method !== 'cheque') {
      return res.status(400).json({ error: 'Only cheque receipts can be cleared' });
    }
    if (!['pending', 'deposited', 'on_hold'].includes(receipt.status)) {
      return res.status(400).json({ error: `Cannot clear: receipt is '${receipt.status}', must be 'pending', 'deposited', or 'on_hold'` });
    }

    const result = await db.query(
      `UPDATE receipts
       SET status = 'cleared',
           clearing_date = $1,
           clearing_bank_id = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, receipt_number, status, clearing_date, clearing_bank_id, amount_received_inr`,
      [clearing_date, clearing_bank_id || null, id]
    );

    res.json({ success: true, message: 'Cheque marked as cleared', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/receipts/:id/release-hold - Release a cheque from hold back to pending
router.patch('/receipts/:id/release-hold', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const receiptRes = await db.query(
      `SELECT id, payment_method, status FROM receipts WHERE id = $1`,
      [id]
    );
    if (receiptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const receipt = receiptRes.rows[0];
    if (receipt.payment_method !== 'cheque') {
      return res.status(400).json({ error: 'Only cheque receipts can be released from hold' });
    }
    if (receipt.status !== 'on_hold') {
      return res.status(400).json({ error: 'Cannot release: receipt is not on hold' });
    }

    const result = await db.query(
      `UPDATE receipts
       SET status = 'pending', hold_remark = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, receipt_number, status, hold_remark, amount_received_inr`,
      [id]
    );

    res.json({ success: true, message: 'Cheque released from hold', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/receipts/:id/hold - Put cheque on hold
router.patch('/receipts/:id/hold', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { hold_remark } = req.body;

    if (!hold_remark || !hold_remark.trim()) {
      return res.status(400).json({ error: 'hold_remark is required' });
    }

    const receiptRes = await db.query(
      `SELECT id, payment_method, status FROM receipts WHERE id = $1`,
      [id]
    );
    if (receiptRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    const receipt = receiptRes.rows[0];
    if (receipt.payment_method !== 'cheque') {
      return res.status(400).json({ error: 'Only cheque receipts can be put on hold' });
    }
    if (['cleared', 'bounced', 'cancelled'].includes(receipt.status)) {
      return res.status(400).json({ error: `Cannot hold: receipt is '${receipt.status}'` });
    }

    const result = await db.query(
      `UPDATE receipts
       SET status = 'on_hold', hold_remark = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, receipt_number, status, hold_remark, amount_received_inr`,
      [hold_remark.trim(), id]
    );

    res.json({ success: true, message: 'Cheque put on hold', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/interest-scheduler - Batch interest calculation for a project
router.post('/interest-scheduler', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, tower_id, persist } = req.body;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Step A: penal rate (project-level override → global fallback)
    const penalRate = await getPenalInterestRate(project_id);

    // Step B: all consumers for project (optionally filtered by tower)
    const consumersRes = await db.query(
      `SELECT DISTINCT
         c.id        AS consumer_id,
         c.name      AS consumer_name,
         c.registration_no,
         pp.id       AS payment_plan_id
       FROM consumers c
       JOIN allocations a  ON a.consumer_id = c.id
       JOIN units u        ON u.id = a.unit_id
       JOIN towers t       ON t.id = u.tower_id
       LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
       WHERE t.project_id = $1
         AND ($2::uuid IS NULL OR t.id = $2)
         AND c.id IS NOT NULL`,
      [project_id, tower_id || null]
    );

    const details: any[] = [];
    let totalInterest = 0;
    let consumersWithInterest = 0;

    // Fetch installment name + rate map once for the whole project
    const templatesRes = await db.query(
      `SELECT installment_index, installment_name, interest_rate_percent
       FROM plan_schedule_templates
       WHERE project_id = $1
       ORDER BY installment_index ASC`,
      [project_id]
    );
    const templateNameMap: Record<number, string> = {};
    const templateRateMap: Record<number, number | null> = {};
    templatesRes.rows.forEach((t: any) => {
      templateNameMap[t.installment_index] = t.installment_name;
      templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
    });

    // Step C: per-consumer calculation
    for (const consumer of consumersRes.rows) {
      const cid = consumer.consumer_id;

      const receiptsRes = await db.query(
        `SELECT id, amount_received_inr, demand_id, installment_index,
                status, received_date, created_at
         FROM receipts
         WHERE consumer_id = $1
           AND status NOT IN ('cancelled','bounced')
         ORDER BY received_date ASC, created_at ASC`,
        [cid]
      );

      const demandsRaw = await db.query(
        `SELECT id, installment_index, amount_due_inr, due_date
         FROM demands
         WHERE consumer_id = $1
         ORDER BY installment_index ASC`,
        [cid]
      );
      const demandsRes = { rows: demandsRaw.rows.map((d: any) => ({
        ...d,
        installment_name:      templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
        interest_rate_percent: templateRateMap[d.installment_index] ?? null,
      })) };

      const allRows = buildInterestRows(receiptsRes.rows, demandsRes.rows, penalRate);
      const interestRows = allRows.filter(r => r.interest_amount > 0);

      if (interestRows.length > 0) {
        const consumerTotal = interestRows.reduce((s, r) => s + r.interest_amount, 0);
        totalInterest += consumerTotal;
        consumersWithInterest++;

        // Step D: persist if requested
        if (persist) {
          await db.query(
            `DELETE FROM penal_interests WHERE consumer_id = $1`,
            [cid]
          );
          for (const row of interestRows) {
            await db.query(
              `INSERT INTO penal_interests
                 (payment_plan_id, installment_index, consumer_id,
                  principal_inr, days_overdue, rate_percent,
                  amount_inr, calculated_at, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),'calculated')`,
              [
                consumer.payment_plan_id || null,
                row.installment_index,
                cid,
                Math.round(row.delay_amount),
                row.delay_days,
                row.roi,
                Math.round(row.interest_amount),
              ]
            );
          }
        }

        details.push({
          consumer_id:          cid,
          consumer_name:        consumer.consumer_name,
          registration_number:  consumer.registration_no,
          total_interest:       Math.round(consumerTotal * 100) / 100,
          rows:                 interestRows,
        });
      }
    }

    res.json({
      success: true,
      summary: {
        consumers_processed:      consumersRes.rows.length,
        consumers_with_interest:  consumersWithInterest,
        total_interest_inr:       Math.round(totalInterest * 100) / 100,
        persisted:                !!persist,
      },
      details,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/payments/interest-scheduler - Remove stored interest for a project
router.delete('/interest-scheduler', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, tower_id } = req.body;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const result = await db.query(
      `DELETE FROM penal_interests
       WHERE consumer_id IN (
         SELECT DISTINCT c.id
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id
         JOIN units u       ON u.id = a.unit_id
         JOIN towers t      ON t.id = u.tower_id
         WHERE t.project_id = $1
           AND ($2::uuid IS NULL OR t.id = $2)
       )`,
      [project_id, tower_id || null]
    );

    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    next(error);
  }
});

// ── Project-wise Interest Master endpoints ─────────────────────────────────

// GET /api/payments/interest-master/:projectId — rate history for a project
router.get('/interest-master/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      `SELECT pir.id, pir.rate_percent, pir.effective_from, pir.created_at,
              u.name AS created_by_name
       FROM project_interest_rates pir
       LEFT JOIN users u ON u.id = pir.created_by
       WHERE pir.project_id = $1
       ORDER BY pir.effective_from DESC, pir.created_at DESC`,
      [projectId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/interest-master — create new project interest rate
router.post('/interest-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, rate_percent, effective_from } = req.body;
    if (!project_id || rate_percent == null) {
      return res.status(400).json({ error: 'project_id and rate_percent are required' });
    }
    const userId = (req as any).user?.id || null;
    const result = await db.query(
      `INSERT INTO project_interest_rates (project_id, rate_percent, effective_from, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rate_percent, effective_from, created_at`,
      [project_id, rate_percent, effective_from || new Date().toISOString().slice(0, 10), userId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/payments/interest-master/:id — update an existing rate record
router.put('/interest-master/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { rate_percent, effective_from } = req.body;
    if (rate_percent == null) {
      return res.status(400).json({ error: 'rate_percent is required' });
    }
    const result = await db.query(
      `UPDATE project_interest_rates
       SET rate_percent = $1, effective_from = COALESCE($2, effective_from)
       WHERE id = $3
       RETURNING id, rate_percent, effective_from`,
      [rate_percent, effective_from || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rate record not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ── Installment-wise Interest endpoints ────────────────────────────────────

// GET /api/payments/plan-names/:projectId — distinct plan names for a project
router.get('/plan-names/:projectId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const result = await db.query(
      `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC`,
      [projectId]
    );
    res.json({ success: true, data: result.rows.map((r: any) => r.plan_name) });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/installment-interest/:projectId/:planName — installments with current rates
router.get('/installment-interest/:projectId/:planName', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, planName } = req.params;
    const result = await db.query(
      `SELECT installment_index, installment_name, percentage, interest_rate_percent
       FROM plan_schedule_templates
       WHERE project_id = $1 AND plan_name = $2
       ORDER BY installment_index ASC`,
      [projectId, planName]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/payments/installment-interest/:projectId/:planName — batch update per-installment rates
router.put('/installment-interest/:projectId/:planName', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, planName } = req.params;
    const { rates } = req.body; // Array<{ installment_index: number; interest_rate_percent: number | null }>
    if (!Array.isArray(rates)) {
      return res.status(400).json({ error: 'rates array is required' });
    }
    for (const r of rates) {
      await db.query(
        `UPDATE plan_schedule_templates
         SET interest_rate_percent = $1
         WHERE project_id = $2 AND plan_name = $3 AND installment_index = $4`,
        [r.interest_rate_percent ?? null, projectId, planName, r.installment_index]
      );
    }
    res.json({ success: true, updated: rates.length });
  } catch (error) {
    next(error);
  }
});

// ── Customer Wise Interest endpoints ──────────────────────────────────────────

// GET /api/payments/customer-wise-consumers — list consumers for a project with interest dates
router.get('/customer-wise-consumers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, tower_id, registration_no, first_name, unit_address } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await db.query(
      `WITH base AS (
         SELECT DISTINCT ON (c.id)
           c.id AS consumer_id,
           c.name,
           c.registration_no,
           u.unit_number AS unit_address,
           t.tower_name,
           t.project_id,
           pp.id AS payment_plan_id,
           COALESCE(
             (SELECT DISTINCT pst.plan_name
              FROM plan_schedule_templates pst
              WHERE pst.project_id = t.project_id
              LIMIT 1),
             'Payment Plan'
           ) AS payment_plan,
           c.interest_start_date,
           c.grace_period_days,
           COALESCE(
             (SELECT SUM(pi2.amount_inr)
              FROM penal_interests pi2
              WHERE pi2.consumer_id = c.id),
             0
           ) AS total_penal_interest_inr
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id
         JOIN units u ON u.id = a.unit_id
         JOIN towers t ON t.id = u.tower_id
         LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
         WHERE t.project_id = $1
           AND ($2::uuid IS NULL OR t.id = $2::uuid)
           AND ($3::text IS NULL OR c.registration_no ILIKE '%' || $3 || '%')
           AND ($4::text IS NULL OR c.name ILIKE '%' || $4 || '%')
           AND ($5::text IS NULL OR u.unit_number ILIKE '%' || $5 || '%')
         ORDER BY c.id, pp.created_at DESC NULLS LAST
       )
       SELECT * FROM base ORDER BY name ASC`,
      [
        project_id,
        tower_id || null,
        registration_no || null,
        first_name || null,
        unit_address || null,
      ]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// PATCH /api/payments/consumer-interest-date/:consumerId — set interest_start_date and remove stale penal_interests
router.patch('/consumer-interest-date/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { consumerId } = req.params;
    const { interest_start_date } = req.body;
    if (!interest_start_date) return res.status(400).json({ error: 'interest_start_date is required' });

    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE consumers SET interest_start_date = $1 WHERE id = $2 RETURNING id, interest_start_date`,
      [interest_start_date, consumerId]
    );
    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consumer not found' });
    }

    await client.query(
      `DELETE FROM penal_interests WHERE consumer_id = $1 AND calculated_at::date < $2::date`,
      [consumerId, interest_start_date]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/payments/consumer-interest/:consumerId — delete ALL penal_interests for a consumer
router.delete('/consumer-interest/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const result = await db.query(
      `DELETE FROM penal_interests WHERE consumer_id = $1`,
      [consumerId]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) { next(error); }
});

// GET /api/payments/interest-waiver-list — project-level consumer list for waive-off screen
router.get('/interest-waiver-list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, type, registration_no, first_name, unit_address } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await db.query(
      `WITH base AS (
         SELECT DISTINCT ON (c.id)
           c.id AS consumer_id,
           c.name,
           c.registration_no,
           u.unit_number AS unit_address,
           CASE
             WHEN c.loan_amount > 0 AND c.loan_sanction_date IS NOT NULL THEN 'Loan Sanctioned'
             WHEN c.loan_amount > 0 AND c.loan_sanction_date IS NULL     THEN 'Pending'
             ELSE 'Self'
           END AS type,
           c.loan_amount,
           c.loan_sanction_date
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id
         JOIN units u       ON u.id = a.unit_id
         JOIN towers t      ON t.id = u.tower_id
         WHERE t.project_id = $1
         ORDER BY c.id, a.created_at DESC
       )
       SELECT
         b.*,
         COALESCE(SUM(pi.amount_inr), 0)            AS total_interest_inr,
         COALESCE(SUM(pi.interest_waived_inr), 0)   AS total_waived_inr,
         COALESCE(SUM(pi.amount_inr) - SUM(pi.interest_waived_inr), 0) AS balance_interest_inr,
         0 AS paid_interest_inr
       FROM base b
       LEFT JOIN penal_interests pi ON pi.consumer_id = b.consumer_id
       WHERE ($2::text IS NULL OR b.type = $2)
         AND ($3::text IS NULL OR b.registration_no ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR b.name ILIKE '%' || $4 || '%')
         AND ($5::text IS NULL OR b.unit_address ILIKE '%' || $5 || '%')
       GROUP BY b.consumer_id, b.name, b.registration_no, b.unit_address, b.type, b.loan_amount, b.loan_sanction_date
       ORDER BY b.name ASC`,
      [
        project_id,
        type && type !== 'All' ? type : null,
        registration_no || null,
        first_name || null,
        unit_address || null,
      ]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/payments/consumer-interest-detail/:consumerId — recalc, persist, return rows
router.post('/consumer-interest-detail/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { consumerId } = req.params;

    // Fetch consumer with project context
    const consumerRes = await client.query(
      `SELECT c.id, c.interest_start_date, c.grace_period_days,
              pp.id AS payment_plan_id,
              t.project_id
       FROM consumers c
       LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
       LEFT JOIN allocations a   ON a.consumer_id = c.id
       LEFT JOIN units u         ON u.id = a.unit_id
       LEFT JOIN towers t        ON t.id = u.tower_id
       WHERE c.id = $1
       ORDER BY pp.created_at DESC
       LIMIT 1`,
      [consumerId]
    );
    if (!consumerRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Consumer not found' });
    }
    const consumer = consumerRes.rows[0];
    const projectId = consumer.project_id;

    // Penal rate
    const penalRate = await getPenalInterestRate(projectId);

    // Template name/rate map for this project
    const templatesRes = await client.query(
      `SELECT installment_index, installment_name, interest_rate_percent
       FROM plan_schedule_templates
       WHERE project_id = $1
       ORDER BY installment_index ASC`,
      [projectId]
    );
    const templateNameMap: Record<number, string> = {};
    const templateRateMap: Record<number, number | null> = {};
    templatesRes.rows.forEach((t: any) => {
      templateNameMap[t.installment_index] = t.installment_name;
      templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
    });

    // Receipts
    const receiptsRes = await client.query(
      `SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
       FROM receipts
       WHERE consumer_id = $1 AND status NOT IN ('cancelled','bounced')
       ORDER BY received_date ASC, created_at ASC`,
      [consumerId]
    );

    // Demands
    const demandsRaw = await client.query(
      `SELECT id, installment_index, amount_due_inr, due_date
       FROM demands
       WHERE consumer_id = $1
       ORDER BY installment_index ASC`,
      [consumerId]
    );
    const demands = demandsRaw.rows.map((d: any) => ({
      ...d,
      installment_name:      templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
      interest_rate_percent: templateRateMap[d.installment_index] ?? null,
    }));

    // Calculate
    const allRows = buildInterestRows(receiptsRes.rows, demands, penalRate, {
      interestStartDate: consumer.interest_start_date ? new Date(String(consumer.interest_start_date)) : null,
      gracePeriodDays:   parseInt(String(consumer.grace_period_days || 0)),
    });
    const interestRows = allRows.filter((r: any) => r.interest_amount > 0);

    // Snapshot existing waived amounts before DELETE so they survive the re-insert
    const existingWaivedRes = await client.query(
      `SELECT installment_index, COALESCE(interest_waived_inr, 0) AS waived
       FROM penal_interests
       WHERE consumer_id = $1 AND status = 'calculated' AND interest_waived_inr > 0`,
      [consumerId]
    );
    const waivedMap: Record<number, number> = {};
    existingWaivedRes.rows.forEach((r: any) => {
      waivedMap[r.installment_index] = parseInt(r.waived);
    });

    // Delete stale calculated rows and re-insert
    await client.query(
      `DELETE FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated'`,
      [consumerId]
    );

    const penalIdMap: Record<number, string> = {};
    for (const row of interestRows) {
      const ins = await client.query(
        `INSERT INTO penal_interests
           (payment_plan_id, installment_index, consumer_id, principal_inr, days_overdue, rate_percent, amount_inr, calculated_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),'calculated')
         RETURNING id`,
        [
          consumer.payment_plan_id || null,
          row.installment_index,
          consumerId,
          Math.round(row.delay_amount),
          row.delay_days,
          row.roi,
          Math.round(row.interest_amount),
        ]
      );
      penalIdMap[row.installment_index] = ins.rows[0].id;
      // Restore waived amount if it existed before the DELETE
      if (waivedMap[row.installment_index]) {
        await client.query(
          `UPDATE penal_interests SET interest_waived_inr = $1 WHERE id = $2`,
          [waivedMap[row.installment_index], ins.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated waived totals (after restore, these are correct)
    const waivedRes = await client.query(
      `SELECT COALESCE(SUM(interest_waived_inr), 0) AS total_waived_inr
       FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated'`,
      [consumerId]
    );
    const totalInterest = allRows.reduce((s: number, r: any) => s + r.interest_amount, 0);
    const totalWaived   = parseFloat(waivedRes.rows[0].total_waived_inr);

    res.json({
      success: true,
      rows: allRows,
      penal_interest_ids: penalIdMap,
      payment_plan_id: consumer.payment_plan_id,
      summary: {
        total_interest:   Math.round(totalInterest * 100) / 100,
        total_waived:     totalWaived,
        balance_interest: Math.round((totalInterest - totalWaived) * 100) / 100,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/payments/manual-interest — insert a manual penal_interest record
router.post('/manual-interest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumer_id, payment_plan_id, installment_index, amount_inr } = req.body;
    if (!consumer_id || amount_inr == null) {
      return res.status(400).json({ error: 'consumer_id and amount_inr are required' });
    }

    const result = await db.query(
      `INSERT INTO penal_interests
         (consumer_id, payment_plan_id, installment_index, principal_inr, days_overdue, rate_percent, amount_inr, calculated_at, status)
       VALUES ($1, $2, $3, 0, 0, 0, $4, NOW(), 'manual')
       RETURNING *`,
      [consumer_id, payment_plan_id || null, installment_index ?? null, amount_inr]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

// GET /api/payments/consumer-waiver-report — reads from interest_waivers (permanent, never wiped)
router.get('/consumer-waiver-report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const result = await db.query(
      `SELECT
         c.id AS consumer_id,
         c.name AS consumer_name,
         c.registration_no,
         u.unit_number AS unit_address,
         t.tower_name,
         COALESCE(iw_agg.waiver_count, 0)       AS waiver_count,
         COALESCE(iw_agg.total_waived_inr, 0)   AS total_waived_inr,
         iw_agg.last_waiver_date,
         COALESCE(pi_agg.total_interest_inr, 0) AS total_interest_inr,
         GREATEST(
           COALESCE(pi_agg.total_interest_inr, 0) - COALESCE(iw_agg.total_waived_inr, 0),
           0
         ) AS balance_interest_inr
       FROM consumers c
       JOIN allocations a ON a.consumer_id = c.id
       JOIN units u       ON u.id = a.unit_id
       JOIN towers t      ON t.id = u.tower_id
       LEFT JOIN (
         SELECT consumer_id,
           COUNT(*)                  AS waiver_count,
           SUM(waiver_amount_inr)    AS total_waived_inr,
           MAX(created_at)           AS last_waiver_date
         FROM interest_waivers
         WHERE status = 'approved'
         GROUP BY consumer_id
       ) iw_agg ON iw_agg.consumer_id = c.id
       LEFT JOIN (
         SELECT consumer_id,
           SUM(amount_inr) AS total_interest_inr
         FROM penal_interests
         WHERE status = 'calculated'
         GROUP BY consumer_id
       ) pi_agg ON pi_agg.consumer_id = c.id
       WHERE t.project_id = $1
         AND COALESCE(iw_agg.total_waived_inr, 0) > 0
       ORDER BY c.name ASC`,
      [project_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// PATCH /api/payments/consumer-grace-period/:consumerId — set grace_period_days
router.patch('/consumer-grace-period/:consumerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.params;
    const { grace_period_days } = req.body;

    if (grace_period_days === undefined || grace_period_days === null) {
      return res.status(400).json({ error: 'grace_period_days is required' });
    }
    const days = parseInt(String(grace_period_days));
    if (isNaN(days) || days < 0) {
      return res.status(400).json({ error: 'grace_period_days must be a non-negative integer' });
    }

    const result = await db.query(
      `UPDATE consumers SET grace_period_days = $1 WHERE id = $2 RETURNING id, grace_period_days`,
      [days, consumerId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Consumer not found' });

    // Clear stale calculated interest so next recalc uses the new grace period
    await db.query(
      `DELETE FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated'`,
      [consumerId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;

