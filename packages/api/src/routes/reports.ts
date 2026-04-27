/**
 * Reports Routes - Module G (Analytics & Reporting)
 * Dashboards, campaign ROI, custom reports, analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// GET /api/reports/sales-dashboard - Sales metrics dashboard
router.get('/sales-dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, dateFrom, dateTo } = req.query;

    let whereClause = `WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      whereClause += ` AND c.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (dateFrom && dateTo) {
      whereClause += ` AND c.created_at >= $${params.length + 1} AND c.created_at <= $${params.length + 2}`;
      params.push(dateFrom, dateTo);
    }

    // Get sales metrics
    const result = await db.query(
      `SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN c.lead_stage = 'enquiry' THEN 1 END) as enquiry_stage,
        COUNT(CASE WHEN c.lead_stage = 'interested' THEN 1 END) as interested_stage,
        COUNT(CASE WHEN c.lead_stage = 'application_filed' THEN 1 END) as application_filed,
        COUNT(CASE WHEN c.lead_stage = 'draw_entered' THEN 1 END) as draw_entered,
        COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN c.lead_stage = 'cancelled' THEN 1 END) as cancelled,
        ROUND(100.0 * COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) / COUNT(*), 2) as conversion_rate
       FROM consumers c
       ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        metrics: result.rows[0],
        period: { from: dateFrom, to: dateTo },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/financial-dashboard - Financial metrics dashboard
router.get('/financial-dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let whereClause = `WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      whereClause += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    // Get financial metrics
    const result = await db.query(
      `SELECT
        COALESCE(SUM(pp.total_amount_inr), 0) as total_receivables,
        COALESCE((SELECT SUM(amount_received_inr) FROM receipts), 0) as total_collected,
        COALESCE(SUM(pp.total_amount_inr), 0) - COALESCE((SELECT SUM(amount_received_inr) FROM receipts), 0) as outstanding,
        COUNT(DISTINCT d.id) as total_demands,
        COUNT(CASE WHEN d.due_date < NOW() THEN 1 END) as overdue_count
       FROM payment_plans pp
       LEFT JOIN demands d ON pp.id = d.payment_plan_id
       ${whereClause}`,
      params
    );

    const row = result.rows[0];
    const collectionPercentage =
      row.total_receivables > 0 ? Math.round((row.total_collected / row.total_receivables) * 100) : 0;

    res.json({
      success: true,
      data: {
        metrics: {
          ...row,
          collectionPercentage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/project-dashboard - Project delivery status dashboard
router.get('/project-dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    // Get project unit inventory stats
    const inventoryResult = await db.query(
      `SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'possession_handed_over' THEN 1 END) as possession_handed_over,
        ROUND(100.0 * COUNT(CASE WHEN status = 'allotted' THEN 1 END) / COUNT(*), 2) as fill_percentage
       FROM units WHERE project_id = $1`,
      [projectId]
    );

    // Get payment collection stats for project
    const paymentResult = await db.query(
      `SELECT
        COALESCE(SUM(pp.total_amount_inr), 0) as total_receivables,
        COALESCE((SELECT SUM(amount_received_inr) FROM receipts r JOIN demands d ON r.payment_plan_id = d.payment_plan_id WHERE d.payment_plan_id = pp.id), 0) as total_collected
       FROM payment_plans pp WHERE pp.project_id = $1`,
      [projectId]
    );

    const payment = paymentResult.rows[0];
    const collectionPercentage =
      payment.total_receivables > 0 ? Math.round((payment.total_collected / payment.total_receivables) * 100) : 0;

    res.json({
      success: true,
      data: {
        inventory: inventoryResult.rows[0],
        payment: {
          ...payment,
          collectionPercentage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/campaign-roi - Campaign ROI tracking
router.get('/campaign-roi', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, campaignType } = req.query;

    let query = `SELECT
                  campaign_id,
                  campaign_type,
                  total_cost_inr,
                  total_leads_generated,
                  leads_converted_to_allotted,
                  conversion_rate,
                  revenue_generated_inr,
                  ROUND(revenue_generated_inr / NULLIF(total_cost_inr, 0), 2) as roi_multiplier,
                  ROUND(100.0 * (revenue_generated_inr - total_cost_inr) / NULLIF(total_cost_inr, 0), 2) as roi_percentage
                 FROM campaign_metrics WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (campaignType) {
      query += ` AND campaign_type = $${params.length + 1}`;
      params.push(campaignType);
    }

    query += ` ORDER BY roi_percentage DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/lead-source-analysis - Analyze leads by source
router.get('/lead-source-analysis', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `SELECT
                  lead_source,
                  COUNT(*) as total_leads,
                  COUNT(CASE WHEN lead_stage = 'allotted' THEN 1 END) as converted_count,
                  ROUND(100.0 * COUNT(CASE WHEN lead_stage = 'allotted' THEN 1 END) / COUNT(*), 2) as conversion_rate,
                  AVG(CASE WHEN lead_stage = 'allotted' THEN total_price_inr ELSE NULL END) as avg_deal_value
                 FROM consumers c
                 LEFT JOIN units u ON c.allocated_unit_id = u.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND c.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` GROUP BY lead_source ORDER BY total_leads DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/payment-ageing - Overdue payment ageing report
router.get('/payment-ageing', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `SELECT
                  CASE
                    WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 30 THEN '1-30 days'
                    WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 90 THEN '31-90 days'
                    WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 180 THEN '91-180 days'
                    ELSE '180+ days'
                  END as ageing_bucket,
                  COUNT(*) as count_demands,
                  SUM(d.amount_due_inr) as total_due_inr
                 FROM demands d
                 JOIN payment_plans pp ON d.payment_plan_id = pp.id
                 WHERE d.due_date < NOW()`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` GROUP BY ageing_bucket ORDER BY
                 CASE ageing_bucket
                   WHEN '1-30 days' THEN 1
                   WHEN '31-90 days' THEN 2
                   WHEN '91-180 days' THEN 3
                   ELSE 4
                 END`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/monthly-collection - Monthly payment collection trend
router.get('/monthly-collection', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `SELECT
                  DATE_TRUNC('month', r.received_date)::DATE as month,
                  COUNT(*) as receipt_count,
                  SUM(r.amount_received_inr) as amount_collected_inr
                 FROM receipts r
                 JOIN payment_plans pp ON r.payment_plan_id = pp.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` GROUP BY DATE_TRUNC('month', r.received_date) ORDER BY month DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reports/custom-report - Generate custom report
router.post('/custom-report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, reportType, filters, columns } = req.body;

    // Validate required fields
    if (!projectId || !reportType || !columns || columns.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store report definition
    const result = await db.query(
      `INSERT INTO custom_reports (project_id, report_type, filter_criteria, columns_selected, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, report_type, created_at`,
      [projectId, reportType, JSON.stringify(filters || {}), JSON.stringify(columns), req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Custom report created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/custom-reports - Get custom reports
router.get('/custom-reports', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    const result = await db.query(
      `SELECT id, project_id, report_type, columns_selected, created_at
       FROM custom_reports
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
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
