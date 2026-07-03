"use strict";
/**
 * Reports Routes - Module G (Analytics & Reporting)
 * Dashboards, campaign ROI, custom reports, analytics
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const payment_waterfall_js_1 = require("../utils/payment-waterfall.js");
const router = (0, express_1.Router)();
// GET /api/reports/sales-dashboard - Sales metrics dashboard
router.get('/sales-dashboard', async (req, res, next) => {
    try {
        const { projectId, dateFrom, dateTo } = req.query;
        let whereClause = `WHERE 1=1`;
        const params = [];
        if (projectId) {
            whereClause += ` AND c.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        if (dateFrom && dateTo) {
            whereClause += ` AND c.created_at::date >= $${params.length + 1} AND c.created_at::date <= $${params.length + 2}`;
            params.push(dateFrom, dateTo);
        }
        // Get sales metrics
        const result = await pool_1.db.query(`SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN c.lead_stage = 'enquiry' THEN 1 END) as enquiry_stage,
        COUNT(CASE WHEN c.lead_stage = 'interested' THEN 1 END) as interested_stage,
        COUNT(CASE WHEN c.lead_stage = 'application_filed' THEN 1 END) as application_filed,
        COUNT(CASE WHEN c.lead_stage = 'draw_entered' THEN 1 END) as draw_entered,
        COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN c.lead_stage = 'cancelled' THEN 1 END) as cancelled,
        ROUND(100.0 * COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate
       FROM consumers c
       ${whereClause}`, params);
        // Convert string counts to numbers
        const metrics = result.rows[0];
        if (metrics) {
            Object.keys(metrics).forEach((key) => {
                metrics[key] = parseFloat(metrics[key]) || 0;
            });
        }
        res.json({
            success: true,
            data: {
                metrics: metrics || {},
                period: { from: dateFrom, to: dateTo },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/financial-dashboard - Financial metrics dashboard
router.get('/financial-dashboard', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        let whereClause = `WHERE 1=1`;
        const params = [];
        if (projectId) {
            whereClause += ` AND pp.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        // Get financial metrics
        const result = await pool_1.db.query(`SELECT
        COALESCE(SUM(pp.total_amount_inr), 0) as total_receivables,
        COALESCE((SELECT SUM(r2.amount_received_inr) FROM receipts r2
                  WHERE r2.status = 'cleared'
                  AND r2.consumer_id NOT IN (
                    SELECT brc.consumer_id FROM booking_records brc WHERE brc.status = 'cancelled'
                  )), 0) as total_collected,
        COALESCE(SUM(pp.total_amount_inr), 0) - COALESCE((SELECT SUM(r3.amount_received_inr) FROM receipts r3
                  WHERE r3.status = 'cleared'
                  AND r3.consumer_id NOT IN (
                    SELECT brc.consumer_id FROM booking_records brc WHERE brc.status = 'cancelled'
                  )), 0) as outstanding,
        COUNT(DISTINCT d.id) as total_demands,
        COUNT(CASE WHEN d.due_date < NOW() THEN 1 END) as overdue_count
       FROM payment_plans pp
       LEFT JOIN demands d ON pp.id = d.payment_plan_id
       ${whereClause}`, params);
        const row = result.rows[0];
        if (row) {
            Object.keys(row).forEach((key) => {
                row[key] = parseFloat(row[key]) || 0;
            });
        }
        const collectionPercentage = row && row.total_receivables > 0 ? Math.round((row.total_collected / row.total_receivables) * 100) : 0;
        res.json({
            success: true,
            data: {
                metrics: {
                    ...row,
                    collectionPercentage,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/project-dashboard - Project delivery status dashboard
router.get('/project-dashboard', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const pid = projectId || null;
        // Get project unit inventory stats
        const inventoryResult = await pool_1.db.query(`SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN status::text = 'possession_handed_over' THEN 1 END) as possession_handed_over,
        ROUND(100.0 * COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as fill_percentage
       FROM units WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]);
        // Get payment collection stats for project
        const paymentResult = await pool_1.db.query(`SELECT
        COALESCE(SUM(pp.total_amount_inr), 0) as total_receivables,
        COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r
                  JOIN payment_plans pp2 ON r.payment_plan_id = pp2.id
                  WHERE ($1::uuid IS NULL OR pp2.project_id = $1::uuid)
                  AND r.status = 'cleared'
                  AND r.consumer_id NOT IN (
                    SELECT brc.consumer_id FROM booking_records brc WHERE brc.status = 'cancelled'
                  )), 0) as total_collected
       FROM payment_plans pp WHERE ($1::uuid IS NULL OR pp.project_id = $1::uuid)`, [pid]);
        // Get construction milestone progress
        const milestonesResult = await pool_1.db.query(`SELECT
        COUNT(*) as total_milestones,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_milestones,
        ROUND(AVG(CASE WHEN status = 'completed' THEN completion_percentage ELSE 0 END), 1) as avg_completion
       FROM construction_milestones
       WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]);
        const payment = paymentResult.rows[0];
        const collectionPercentage = payment.total_receivables > 0 ? Math.round((payment.total_collected / payment.total_receivables) * 100) : 0;
        const milestones = milestonesResult.rows[0];
        res.json({
            success: true,
            data: {
                inventory: inventoryResult.rows[0],
                payment: {
                    ...payment,
                    collectionPercentage,
                },
                milestones: {
                    total: parseInt(milestones.total_milestones) || 0,
                    completed: parseInt(milestones.completed_milestones) || 0,
                    progressPercentage: milestones.avg_completion || 0,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/campaign-roi - Campaign ROI tracking
router.get('/campaign-roi', async (req, res, next) => {
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
        const params = [];
        if (projectId) {
            query += ` AND project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        if (campaignType) {
            query += ` AND campaign_type = $${params.length + 1}`;
            params.push(campaignType);
        }
        query += ` ORDER BY roi_percentage DESC`;
        const result = await pool_1.db.query(query, params);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/lead-source-analysis - Analyze leads by source
router.get('/lead-source-analysis', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        let query = `SELECT
                  COALESCE(cam.channel, 'direct') as lead_source,
                  COUNT(*) as total_leads,
                  COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) as converted_count,
                  ROUND(100.0 * COUNT(CASE WHEN c.lead_stage = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as conversion_rate,
                  AVG(CASE WHEN c.lead_stage = 'allotted' THEN u.total_price_inr ELSE NULL END) as avg_deal_value
                 FROM consumers c
                 LEFT JOIN campaigns cam ON c.campaign_id = cam.id
                 LEFT JOIN units u ON c.allocated_unit_id = u.id
                 WHERE 1=1`;
        const params = [];
        if (projectId) {
            query += ` AND c.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        query += ` GROUP BY COALESCE(cam.channel, 'direct') ORDER BY total_leads DESC`;
        const result = await pool_1.db.query(query, params);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/payment-ageing - Overdue payment ageing report
router.get('/payment-ageing', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        let baseWhere = `d.due_date < NOW()`;
        const params = [];
        if (projectId) {
            baseWhere += ` AND pp.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        const query = `SELECT bucket as ageing_bucket, count_demands, total_due_inr FROM (
                    SELECT
                      CASE
                        WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 30 THEN '1-30 days'
                        WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 90 THEN '31-90 days'
                        WHEN EXTRACT(DAY FROM (NOW() - d.due_date)) <= 180 THEN '91-180 days'
                        ELSE '180+ days'
                      END as bucket,
                      COUNT(*) as count_demands,
                      SUM(d.amount_due_inr) as total_due_inr
                     FROM demands d
                     JOIN payment_plans pp ON d.payment_plan_id = pp.id
                     WHERE ${baseWhere}
                     GROUP BY bucket
                   ) sub
                   ORDER BY CASE bucket
                     WHEN '1-30 days' THEN 1
                     WHEN '31-90 days' THEN 2
                     WHEN '91-180 days' THEN 3
                     ELSE 4
                   END`;
        const result = await pool_1.db.query(query, params);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/monthly-collection - Monthly payment collection trend
router.get('/monthly-collection', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        let query = `SELECT
                  DATE_TRUNC('month', r.received_date)::DATE as month,
                  COUNT(*) as receipt_count,
                  SUM(r.amount_received_inr) as amount_collected_inr
                 FROM receipts r
                 JOIN payment_plans pp ON r.payment_plan_id = pp.id
                 WHERE 1=1`;
        const params = [];
        if (projectId) {
            query += ` AND pp.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        query += ` GROUP BY DATE_TRUNC('month', r.received_date) ORDER BY month DESC`;
        const result = await pool_1.db.query(query, params);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/reports/custom-report - Generate custom report
router.post('/custom-report', async (req, res, next) => {
    try {
        const { projectId, reportType, filters, columns } = req.body;
        // Validate required fields
        if (!projectId || !reportType || !columns || columns.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Store report definition
        const result = await pool_1.db.query(`INSERT INTO custom_reports (project_id, report_type, filter_criteria, columns_selected, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, report_type, created_at`, [projectId, reportType, JSON.stringify(filters || {}), JSON.stringify(columns), req.userId]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Custom report created successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/custom-reports - Get custom reports
router.get('/custom-reports', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const result = await pool_1.db.query(`SELECT id, project_id, report_type, columns_selected, created_at
       FROM custom_reports
       WHERE project_id = $1
       ORDER BY created_at DESC`, [projectId]);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/allotment-dashboard - Allotment metrics dashboard
router.get('/allotment-dashboard', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        // Get summary metrics (all projects or filtered)
        let summaryQuery = `SELECT
      COUNT(DISTINCT c.id) FILTER (WHERE c.lead_stage != 'enquiry') as total_applications,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'allotted') as total_allotted,
      COUNT(DISTINCT w.id) as total_waitlisted,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'cancelled') as total_cancelled,
      COUNT(DISTINCT c.id) FILTER (WHERE c.lead_stage = 'cancelled') as total_unsuccessful
     FROM consumers c
     LEFT JOIN allocations a ON c.id = a.consumer_id
     LEFT JOIN waitlists w ON c.id = w.consumer_id`;
        const summaryParams = [];
        if (projectId) {
            summaryQuery += ` WHERE c.project_id = $${summaryParams.length + 1}`;
            summaryParams.push(projectId);
        }
        const summaryResult = await pool_1.db.query(summaryQuery, summaryParams);
        const summary = summaryResult.rows[0];
        // Get by-project metrics
        let byProjectQuery = `SELECT
      p.id as project_id,
      p.name as project_name,
      p.rera_number,
      p.total_units,
      COUNT(DISTINCT c.id) FILTER (WHERE c.lead_stage NOT IN ('enquiry')) as applications,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'allotted') as allotted,
      COUNT(DISTINCT w.id) as waitlist_depth,
      COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'cancelled') as cancellations,
      ROUND(
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'cancelled') * 100.0 /
        NULLIF(COUNT(DISTINCT a.id), 0), 2
      ) as cancellation_rate,
      ROUND(
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'allotted') * 100.0 /
        NULLIF(p.total_units, 0), 2
      ) as fill_percentage
     FROM projects p
     LEFT JOIN consumers c ON c.project_id = p.id
     LEFT JOIN allocations a ON a.project_id = p.id
     LEFT JOIN waitlists w ON w.project_id = p.id`;
        const byProjectParams = [];
        if (projectId) {
            byProjectQuery += ` WHERE p.id = $${byProjectParams.length + 1}`;
            byProjectParams.push(projectId);
        }
        byProjectQuery += ` GROUP BY p.id, p.name, p.rera_number, p.total_units
     ORDER BY p.name`;
        const byProjectResult = await pool_1.db.query(byProjectQuery, byProjectParams);
        // Get by-unit-type metrics
        let byUnitTypeQuery = `SELECT
      u.project_id,
      u.bhk_type,
      COUNT(*) as total_units,
      COUNT(CASE WHEN u.status = 'allotted' THEN 1 END) as allotted,
      COUNT(CASE WHEN u.status = 'available' THEN 1 END) as available,
      ROUND(
        COUNT(CASE WHEN u.status = 'allotted' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2
      ) as fill_percentage
     FROM units u`;
        const byUnitTypeParams = [];
        if (projectId) {
            byUnitTypeQuery += ` WHERE u.project_id = $${byUnitTypeParams.length + 1}`;
            byUnitTypeParams.push(projectId);
        }
        byUnitTypeQuery += ` GROUP BY u.project_id, u.bhk_type
     ORDER BY u.project_id, u.bhk_type`;
        const byUnitTypeResult = await pool_1.db.query(byUnitTypeQuery, byUnitTypeParams);
        // Get waitlist summary
        let waitlistQuery = `SELECT
      p.id as project_id,
      p.name as project_name,
      COUNT(DISTINCT w.id) as waitlist_count,
      MIN(w.created_at) as oldest_waitlist_date
     FROM projects p
     LEFT JOIN waitlists w ON w.project_id = p.id`;
        const waitlistParams = [];
        if (projectId) {
            waitlistQuery += ` WHERE p.id = $${waitlistParams.length + 1}`;
            waitlistParams.push(projectId);
        }
        waitlistQuery += ` GROUP BY p.id, p.name
     ORDER BY p.name`;
        const waitlistResult = await pool_1.db.query(waitlistQuery, waitlistParams);
        res.json({
            success: true,
            data: {
                summary: {
                    totalApplications: parseInt(summary.total_applications) || 0,
                    totalAllotted: parseInt(summary.total_allotted) || 0,
                    totalWaitlisted: parseInt(summary.total_waitlisted) || 0,
                    totalCancelled: parseInt(summary.total_cancelled) || 0,
                    totalUnsuccessful: parseInt(summary.total_unsuccessful) || 0,
                },
                byProject: byProjectResult.rows.map((row) => ({
                    projectId: row.project_id,
                    projectName: row.project_name,
                    reraNumber: row.rera_number,
                    totalUnits: row.total_units,
                    applications: parseInt(row.applications) || 0,
                    allotted: parseInt(row.allotted) || 0,
                    waitlistDepth: parseInt(row.waitlist_depth) || 0,
                    cancellations: parseInt(row.cancellations) || 0,
                    cancellationRate: parseFloat(row.cancellation_rate) || 0,
                    fillPercentage: parseFloat(row.fill_percentage) || 0,
                })),
                byUnitType: byUnitTypeResult.rows.map((row) => ({
                    projectId: row.project_id,
                    bhkType: row.bhk_type,
                    totalUnits: parseInt(row.total_units),
                    allotted: parseInt(row.allotted),
                    available: parseInt(row.available),
                    fillPercentage: parseFloat(row.fill_percentage),
                })),
                waitlistSummary: waitlistResult.rows.map((row) => ({
                    projectId: row.project_id,
                    projectName: row.project_name,
                    waitlistCount: parseInt(row.waitlist_count) || 0,
                    oldestWaitlistDate: row.oldest_waitlist_date,
                })),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/inventory-full - Detailed inventory status with summary
router.get('/inventory-full', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const pid = projectId || null;
        const summary = await pool_1.db.query(`SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status::text = 'booked' THEN 1 END) as booked,
        COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN registry_status = true THEN 1 END) as registry,
        COUNT(CASE WHEN mortgage_status = true THEN 1 END) as mortgage,
        COUNT(CASE WHEN status::text = 'held' OR hold_status = true THEN 1 END) as hold,
        SUM(super_area_sqft) as total_area
       FROM units WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]);
        const units = await pool_1.db.query(`SELECT u.*, t.tower_name, c.name as consumer_name, b.name as broker_name, a.consumer_id
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       LEFT JOIN allocations a ON u.id = a.unit_id AND a.status = 'allotted'
       LEFT JOIN consumers c ON a.consumer_id = c.id
       LEFT JOIN (
         SELECT DISTINCT ON (consumer_id)
           consumer_id, broker_id
         FROM booking_records
         ORDER BY consumer_id, created_at DESC
       ) br ON br.consumer_id = c.id
       LEFT JOIN brokers b ON br.broker_id = b.id
       WHERE ($1::uuid IS NULL OR u.project_id = $1::uuid)
       ORDER BY t.tower_name, u.floor, u.unit_number`, [pid]);
        res.json({ success: true, data: { summary: summary.rows[0], units: units.rows } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/unit-wise-plc - PLC breakdown per unit (projectId optional — empty = all projects)
router.get('/unit-wise-plc', async (req, res, next) => {
    try {
        const { projectId, bhk } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const bhkP = p(bhk || null);
        const result = await pool_1.db.query(`SELECT
         p.name   AS project_name,
         t.tower_name,
         u.unit_number,
         u.bhk_type,
         u.floor,
         u.carpet_area_sqft,
         u.super_area_sqft,
         u.base_price_inr,
         u.status,
         ROUND(u.base_price_inr * 0.05) AS plc_amount,
         COALESCE(c.first_name || ' ' || COALESCE(c.last_name, ''), 'Available') AS consumer_name
       FROM units u
       JOIN towers t   ON t.id  = u.tower_id
       JOIN projects p ON p.id  = u.project_id
       LEFT JOIN allocations a ON a.unit_id = u.id AND a.status = 'allotted'
       LEFT JOIN consumers c   ON c.id = a.consumer_id
       WHERE t.deleted_at IS NULL
         AND (${pidP}::uuid IS NULL OR u.project_id = ${pidP}::uuid)
         AND (${bhkP}::text IS NULL OR u.bhk_type   = ${bhkP}::text)
       ORDER BY p.name, t.tower_name, u.unit_number`, qp);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/unit-sold-area - Sold vs available area breakdown (projectId optional — empty = all)
router.get('/unit-sold-area', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const result = await pool_1.db.query(`SELECT
         CASE
           WHEN u.carpet_area_sqft < 400  THEN 'Below 400 sqft'
           WHEN u.carpet_area_sqft < 600  THEN '400–600 sqft'
           WHEN u.carpet_area_sqft < 800  THEN '600–800 sqft'
           WHEN u.carpet_area_sqft < 1000 THEN '800–1000 sqft'
           WHEN u.carpet_area_sqft < 1200 THEN '1000–1200 sqft'
           ELSE 'Above 1200 sqft'
         END AS area_range,
         COUNT(*) FILTER (WHERE u.status = 'available')  AS available_count,
         COUNT(*) FILTER (WHERE u.status <> 'available') AS sold_count,
         COUNT(*) AS total_count,
         ROUND(COUNT(*) FILTER (WHERE u.status <> 'available') * 100.0 / NULLIF(COUNT(*), 0), 1) AS sold_pct
       FROM units u
       JOIN towers t   ON t.id  = u.tower_id
       JOIN projects p ON p.id  = u.project_id
       WHERE t.deleted_at IS NULL
         AND (${pidP}::uuid IS NULL OR u.project_id = ${pidP}::uuid)
       GROUP BY area_range
       HAVING COUNT(*) > 0
       ORDER BY MIN(u.carpet_area_sqft)`, qp);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/unit-cost - Cost breakdown per unit
router.get('/unit-cost', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const pid = projectId || null;
        const result = await pool_1.db.query(`SELECT
         u.unit_number,
         t.tower_name,
         u.bhk_type,
         u.carpet_area_sqft,
         u.base_price_inr,
         u.total_price_inr,
         u.status,
         p.name AS project_name
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       JOIN projects p ON p.id = u.project_id
       WHERE ($1::uuid IS NULL OR u.project_id = $1::uuid)
         AND t.deleted_at IS NULL
       ORDER BY p.name, t.tower_name, u.unit_number`, [pid]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/applicant-payment-file - Applicant financial ledger
router.get('/applicant-payment-file', async (req, res, next) => {
    try {
        const { projectId, towerId, bhkType, planName, brokerId, floor, customerClassification, employeeId, selfOrLoan, registrationNo, name: nameFilter, unitNo, formNo, bookingFromDate, bookingToDate, dueAsOnDate, page = '1', pageSize = '100', } = req.query;
        const pageNum = Math.max(1, parseInt(String(page), 10));
        const pageSizeNum = Math.min(500, Math.max(1, parseInt(String(pageSize), 10)));
        // whereParams ($1..$N) — shared between data query WHERE and count query WHERE
        // dueAsOnDate is appended AFTER to avoid polluting the count query numbering
        const whereParams = [];
        const wp = (val) => { whereParams.push(val); return `$${whereParams.length}`; };
        let where = `WHERE br.status IN ('complete','pending_payment','active')`;
        if (projectId)
            where += ` AND p.id = ${wp(projectId)}::uuid`;
        if (towerId)
            where += ` AND t.id = ${wp(towerId)}::uuid`;
        if (bhkType)
            where += ` AND u.bhk_type = ${wp(bhkType)}`;
        if (planName)
            where += ` AND br.selected_plan_name ILIKE ${wp('%' + planName + '%')}`;
        if (brokerId)
            where += ` AND br.main_broker_id = ${wp(brokerId)}::uuid`;
        if (floor)
            where += ` AND u.floor::text = ${wp(String(floor))}`;
        if (customerClassification)
            where += ` AND c.customer_classification = ${wp(customerClassification)}`;
        if (employeeId)
            where += ` AND br.sales_employee_id = ${wp(employeeId)}::uuid`;
        if (selfOrLoan)
            where += ` AND br.self_or_loan = ${wp(selfOrLoan)}`;
        if (registrationNo)
            where += ` AND c.registration_no ILIKE ${wp('%' + registrationNo + '%')}`;
        if (nameFilter)
            where += ` AND (c.first_name || ' ' || COALESCE(c.last_name,'')) ILIKE ${wp('%' + nameFilter + '%')}`;
        if (unitNo)
            where += ` AND u.unit_number ILIKE ${wp('%' + unitNo + '%')}`;
        if (formNo)
            where += ` AND c.form_no ILIKE ${wp('%' + formNo + '%')}`;
        if (bookingFromDate)
            where += ` AND br.booking_date >= ${wp(bookingFromDate)}`;
        if (bookingToDate)
            where += ` AND br.booking_date <= ${wp(bookingToDate)}`;
        // countParams = whereParams only (no dueAsOnDate, no LIMIT/OFFSET)
        const countParams = [...whereParams];
        // Data query appends dueAsOnDate then LIMIT/OFFSET after the WHERE params
        const dataParams = [...whereParams];
        const dp = (val) => { dataParams.push(val); return `$${dataParams.length}`; };
        const dueRef = dp(dueAsOnDate ? String(dueAsOnDate) : null);
        const dueDateGuard = `AND (${dueRef}::date IS NULL OR d.due_date <= ${dueRef}::date)`;
        const limitRef = dp(pageSizeNum);
        const offsetRef = dp((pageNum - 1) * pageSizeNum);
        const baseJoins = `
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = COALESCE(br.unit_id, c.allocated_unit_id)
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN allocations al ON al.consumer_id = c.id
      LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      LEFT JOIN users usr ON usr.id = br.sales_employee_id`;
        // Inner SELECT with DISTINCT ON (c.id) picks latest booking per consumer
        const innerSelect = `
      SELECT DISTINCT ON (c.id)
        c.id                                                                    AS consumer_id,
        u.id                                                                    AS unit_id,
        c.registration_no,
        TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))     AS consumer_name,
        c.mobile,
        c.email,
        c.form_no,
        c.customer_classification,
        c.father_name,
        br.booking_date,
        br.selected_plan_name                                                   AS plan_name,
        br.self_or_loan,
        u.unit_number,
        u.floor,
        u.bhk_type,
        u.carpet_area_sqft,
        u.super_area_sqft,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) AS base_price_inr,
        u.total_price_inr,
        t.tower_name,
        p.name                                                                  AS project_name,
        p.id                                                                    AS project_id,
        al.allotment_date,
        COALESCE(bk.firm_name, bk.name, 'Direct')                              AS broker_name,
        usr.name                                                                AS employee_name,
        COALESCE(c.finance_bank, br.bank_name, '')                             AS bank_name,
        COALESCE(c.loan_amount, 0)                                             AS loan_amount,
        COALESCE(br.basic_rate_inr_sqft, 0)                                     AS rate_per_sqft,
        COALESCE(br.dealer_adjustment_amount, 0)                               AS dealer_discount,
        COALESCE(br.company_inaugural_disc, 0)                                 AS inaugural_discount,
        COALESCE(br.dealer_adjustment_amount, 0)
          + COALESCE(br.company_inaugural_disc, 0)                             AS total_discount,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0))
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)                             AS net_basic_price,
        COALESCE(br.plc_amount, 0)                                             AS plc_amount,
        COALESCE(br.other_charge_amount, 0)                                    AS other_charge_amount,
        COALESCE(br.other_charge_desc, '')                                     AS other_charge_desc,
        (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0))
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0))                               AS total_unit_cost,
        COALESCE(bpt.cgst_pct, 0)                                              AS cost_cgst_pct,
        COALESCE(bpt.sgst_pct, 0)                                              AS cost_sgst_pct,
        COALESCE(bpt.cgst_amount, 0)                                           AS cost_cgst_amount,
        COALESCE(bpt.sgst_amount, 0)                                           AS cost_sgst_amount,
        COALESCE(bpt.s_tax_pct, 0)                                             AS s_tax_pct,
        (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0))
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0)
          + COALESCE(bpt.cgst_amount, 0)
          + COALESCE(bpt.sgst_amount, 0))                                      AS total_cost_with_gst,
        -- DUES (correlated — prevents row-multiplication from JOIN)
        COALESCE((SELECT SUM(d.amount_due_inr)
          FROM demands d WHERE d.consumer_id = c.id ${dueDateGuard}), 0)       AS dues_amount,
        COALESCE((SELECT SUM(COALESCE(d.cgst_amount, 0))
          FROM demands d WHERE d.consumer_id = c.id ${dueDateGuard}), 0)       AS dues_cgst,
        COALESCE((SELECT SUM(COALESCE(d.sgst_amount, 0))
          FROM demands d WHERE d.consumer_id = c.id ${dueDateGuard}), 0)       AS dues_sgst,
        COALESCE((SELECT SUM(d.amount_due_inr)
          FROM demands d WHERE d.consumer_id = c.id ${dueDateGuard}), 0)       AS dues_total,
        -- RECEIVED (correlated)
        COALESCE((SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = c.id AND r.status != 'cancelled'), 0)          AS received_amount,
        COALESCE((SELECT SUM(COALESCE(r.interest_amount, 0))
          FROM receipts r
          WHERE r.consumer_id = c.id AND r.status != 'cancelled'), 0)          AS interest_received,
        -- OUTSTANDING
        GREATEST(0,
          COALESCE((SELECT SUM(d.amount_due_inr)
            FROM demands d WHERE d.consumer_id = c.id ${dueDateGuard}), 0)
          - COALESCE((SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = c.id AND r.status != 'cancelled'), 0)
        )                                                                       AS outstanding_amount,
        0                                                                       AS credit_amount,
        COALESCE((
          SELECT SUM(
            COALESCE(pi.amount_inr, 0)
          )
          FROM penal_interests pi
          WHERE pi.consumer_id = c.id
        ), 0)                                                                   AS interest_charged,
        COALESCE((
          SELECT SUM(COALESCE(pi.interest_waived_inr, 0))
          FROM penal_interests pi
          WHERE pi.consumer_id = c.id
        ), 0)                                                                   AS interest_waived,
        GREATEST(0,
          COALESCE((
            SELECT SUM(GREATEST(0,
              COALESCE(pi.amount_inr, 0)
              - COALESCE(pi.interest_waived_inr, 0)
            ))
            FROM penal_interests pi
            WHERE pi.consumer_id = c.id
          ), 0)
          - COALESCE((
            SELECT SUM(COALESCE(r.interest_amount, 0))
            FROM receipts r
            WHERE r.consumer_id = c.id
            AND r.status != 'cancelled'
          ), 0)
        )                                                                       AS interest_outstanding
      ${baseJoins}
      ${where}
      ORDER BY c.id, br.booking_date DESC`; // DESC: latest booking wins for DISTINCT ON
        // Wrap inner query to apply external sort + pagination
        const dataQuery = `
      SELECT * FROM (${innerSelect}) sub
      ORDER BY booking_date ASC, registration_no ASC
      LIMIT ${limitRef} OFFSET ${offsetRef}
    `;
        const countQuery = `SELECT COUNT(DISTINCT c.id) AS total ${baseJoins} ${where}`;
        const [dataResult, countResult] = await Promise.all([
            pool_1.db.query(dataQuery, dataParams),
            pool_1.db.query(countQuery, countParams),
        ]);
        const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
        const totalPages = Math.ceil(total / pageSizeNum);
        const numFields = [
            'loan_amount', 'rate_per_sqft', 'dealer_discount', 'inaugural_discount', 'total_discount',
            'net_basic_price', 'base_price_inr', 'total_price_inr', 'carpet_area_sqft', 'super_area_sqft',
            'plc_amount', 'other_charge_amount', 'total_unit_cost',
            'cost_cgst_pct', 'cost_sgst_pct', 'cost_cgst_amount', 'cost_sgst_amount', 's_tax_pct',
            'total_cost_with_gst',
            'dues_amount', 'dues_cgst', 'dues_sgst', 'dues_total',
            'received_amount', 'interest_received',
            'outstanding_amount', 'credit_amount', 'interest_charged', 'interest_waived', 'interest_outstanding',
        ];
        const rows = dataResult.rows.map(row => {
            const out = { ...row };
            numFields.forEach(f => { out[f] = parseFloat(out[f] ?? '0') || 0; });
            return out;
        });
        // Fix interest: replace penal_interests-only values with buildInterestRows() which
        // computes correctly from actual receipt dates regardless of whether scheduler has run.
        // penal_interests overrides per-installment when scheduler has previously stored values.
        await Promise.all(rows.map(async (row) => {
            const consumerId = row.consumer_id;
            const unitId = row.unit_id;
            const [rcptsRes, demandsRes, piRes, settingsRes] = await Promise.all([
                pool_1.db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
             FROM receipts
             WHERE consumer_id = $1 AND status = 'cleared'
               AND payment_plan_id = (
                 SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )
             ORDER BY received_date ASC, created_at ASC`, [consumerId, unitId]),
                pool_1.db.query(`SELECT id, installment_index, installment_index AS installment_name,
               due_date, amount_due_inr, cgst_amount, sgst_amount
             FROM demands
             WHERE consumer_id = $1
               AND payment_plan_id = (
                 SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )`, [consumerId, unitId]),
                pool_1.db.query(`SELECT installment_index,
               COALESCE(interest_waived_inr, 0) AS interest_waived_inr,
               GREATEST(0, COALESCE(amount_inr,0) - COALESCE(interest_waived_inr,0)) AS net_interest_inr
             FROM penal_interests
             WHERE consumer_id = $1`, [consumerId]),
                pool_1.db.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent' LIMIT 1`),
            ]);
            const penalRate = parseFloat(settingsRes.rows[0]?.value || '15');
            const piMap = new Map();
            for (const pi of piRes.rows) {
                if (parseFloat(pi.net_interest_inr) > 0) {
                    piMap.set(Number(pi.installment_index), parseFloat(pi.net_interest_inr));
                }
            }
            const irRows = (0, payment_waterfall_js_1.buildInterestRows)(rcptsRes.rows, demandsRes.rows.map((d) => ({ ...d, installment_name: d.demand_type || String(d.installment_index) })), penalRate, { asOfDate: new Date() });
            let totalInterest = 0;
            for (const ir of irRows) {
                const piOverride = piMap.get(ir.installment_index);
                totalInterest += piOverride !== undefined ? piOverride : ir.interest_amount;
            }
            const totalWaived = piRes.rows.reduce((sum, pi) => sum + parseFloat(pi.interest_waived_inr || 0), 0);
            row.interest_charged = Math.round(totalInterest * 100) / 100;
            row.interest_waived = Math.round(totalWaived * 100) / 100;
            row.interest_outstanding = Math.max(0, Math.round((totalInterest - totalWaived - (row.interest_received || 0)) * 100) / 100);
        }));
        // Page-level summary (accurate when all rows fit in one page; use as indicator otherwise)
        const totalDues = rows.reduce((s, r) => s + r.dues_amount, 0);
        const totalReceived = rows.reduce((s, r) => s + r.received_amount, 0);
        const totalOutstanding = rows.reduce((s, r) => s + r.outstanding_amount, 0);
        res.json({
            success: true,
            data: rows,
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages,
            summary: {
                totalConsumers: total,
                totalDues,
                totalReceived,
                totalOutstanding,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/collection-pivot - Horizontal monthly dues vs outstanding
router.get('/collection-pivot', async (req, res, next) => {
    try {
        const { projectId, towerId, dateFrom, dateTo } = req.query;
        let query = `
      SELECT
        c.registration_no, c.name, u.unit_number,
        d.due_date, d.amount_due_inr, d.status,
        COALESCE((SELECT SUM(amount_received_inr) FROM receipts WHERE demand_id = d.id), 0) as paid
      FROM demands d
      JOIN consumers c ON d.consumer_id = c.id
      JOIN units u ON c.allocated_unit_id = u.id
      WHERE ($1::uuid IS NULL OR c.project_id = $1::uuid)
      AND c.status IN ('booked', 'allotted')
    `;
        const params = [projectId || null];
        if (towerId) {
            params.push(towerId);
            query += ` AND u.tower_id = $${params.length}`;
        }
        if (dateFrom) {
            params.push(dateFrom);
            query += ` AND d.due_date >= $${params.length}`;
        }
        if (dateTo) {
            params.push(dateTo);
            query += ` AND d.due_date <= $${params.length}`;
        }
        query += ` ORDER BY c.registration_no, d.due_date`;
        const result = await pool_1.db.query(query, params);
        // Group by Consumer and Pivot by Month
        const consumers = {};
        const monthsSet = new Set();
        result.rows.forEach(row => {
            const key = row.registration_no || 'NA';
            if (!consumers[key]) {
                consumers[key] = {
                    registration_no: row.registration_no,
                    name: row.name,
                    unit_number: row.unit_number,
                    months: {}
                };
            }
            const d = new Date(row.due_date);
            const mLabel = `${d.toLocaleString('default', { month: 'short' })}-${d.getFullYear()}`.toUpperCase();
            monthsSet.add(mLabel);
            if (!consumers[key].months[mLabel]) {
                consumers[key].months[mLabel] = { due: 0, os: 0 };
            }
            const due = parseFloat(row.amount_due_inr);
            const os = Math.max(0, due - parseFloat(row.paid));
            consumers[key].months[mLabel].due += due;
            consumers[key].months[mLabel].os += os;
        });
        const sortedMonths = Array.from(monthsSet).sort((a, b) => {
            const parse = (s) => new Date(parseInt(s.split('-')[1]), ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(s.split('-')[0]));
            // @ts-ignore
            return parse(a) - parse(b);
        });
        res.json({ success: true, data: { consumers: Object.values(consumers), months: sortedMonths } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/project-details
router.get('/project-details', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const params = [];
        const whereClause = projectId ? `WHERE p.id = $1` : '';
        if (projectId)
            params.push(projectId);
        const result = await pool_1.db.query(`SELECT
         p.id,
         p.name                                                       AS project_name,
         p.location,
         p.rera_number,
         p.group_name,
         p.land_area_sqft,
         COUNT(DISTINCT t.id)                                         AS total_towers,
         COUNT(u.id)                                                  AS total_units,
         COUNT(CASE WHEN u.status != 'available' THEN 1 END)          AS sold_units,
         COUNT(CASE WHEN u.status = 'available'  THEN 1 END)          AS unsold_units,
         COALESCE(SUM(u.carpet_area_sqft), 0)                         AS salable_area,
         COALESCE(SUM(CASE WHEN u.status != 'available' THEN u.carpet_area_sqft END), 0) AS sold_area,
         COALESCE(SUM(CASE WHEN u.status = 'available'  THEN u.carpet_area_sqft END), 0) AS balance_area,
         COALESCE(AVG(u.base_price_inr),   0)                         AS average_bsp,
         COALESCE(AVG(u.total_price_inr),  0)                         AS average_cost,
         COALESCE(
           (SELECT SUM(br.booking_amount)
            FROM booking_records br
            WHERE br.project_id = p.id
              AND br.status IN ('complete', 'pending_payment', 'active')),
           0
         )                                                             AS total_collection
       FROM projects p
       LEFT JOIN towers t ON t.project_id = p.id
       LEFT JOIN units  u ON u.project_id = p.id
       ${whereClause}
       GROUP BY p.id, p.name, p.location, p.rera_number, p.group_name, p.land_area_sqft
       ORDER BY p.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/project-collection — Project Wise Collection
router.get('/project-collection', async (req, res, next) => {
    try {
        const { projectId, fromDate, toDate } = req.query;
        const queryParams = [];
        const addParam = (v) => { queryParams.push(v); return `$${queryParams.length}`; };
        const fromP = fromDate ? addParam(fromDate) : null;
        const toP = toDate ? addParam(toDate) : null;
        const pidP = projectId ? addParam(projectId) : null;
        const rDateWhere = [
            fromP ? `r.received_date >= ${fromP}::date` : null,
            toP ? `r.received_date <= ${toP}::date` : null,
        ].filter(Boolean).join(' AND ');
        const rdw = rDateWhere ? ` AND ${rDateWhere}` : '';
        const bDateWhere = [
            fromP ? `cbl.bounce_date >= ${fromP}::date` : null,
            toP ? `cbl.bounce_date <= ${toP}::date` : null,
        ].filter(Boolean).join(' AND ');
        const bdw = bDateWhere ? ` AND ${bDateWhere}` : '';
        const pidWhere = pidP ? ` AND p.id = ${pidP}::uuid` : '';
        const query = `
      SELECT
        p.id   AS project_id,
        p.name AS project_name,
        COALESCE(SUM(CASE WHEN r.payment_method = 'cheque'
          AND r.status != 'cancelled'${rdw} THEN r.amount_received_inr END), 0)  AS cheque_amount,
        0::numeric                                                               AS draft_amount,
        COALESCE(SUM(CASE WHEN r.payment_method IN ('neft','rtgs','upi','bank_transfer')
          AND r.status != 'cancelled'${rdw} THEN r.amount_received_inr END), 0)  AS online_amount,
        0::numeric                                                               AS cash_amount,
        COALESCE(SUM(CASE WHEN r.status != 'cancelled'${rdw}
          THEN r.amount_received_inr END), 0)                                    AS total_amount,
        COUNT(CASE WHEN r.status != 'cancelled'${rdw} THEN 1 END)               AS normal_count,
        COUNT(CASE WHEN r.status  = 'cancelled'${rdw} THEN 1 END)               AS cancel_count,
        COUNT(CASE WHEN cbl.id IS NOT NULL${bdw} THEN 1 END)                    AS bounce_count,
        COALESCE(SUM(CASE WHEN r.status != 'cancelled'${rdw}
          THEN r.amount_received_inr END), 0)                                    AS total_collection
      FROM projects p
      LEFT JOIN payment_plans pp      ON pp.project_id   = p.id
      LEFT JOIN receipts r            ON r.payment_plan_id = pp.id
      LEFT JOIN cheque_bounce_logs cbl ON cbl.receipt_id  = r.id
      WHERE 1=1${pidWhere}
      GROUP BY p.id, p.name
      ORDER BY p.name
    `;
        const result = await pool_1.db.query(query, queryParams);
        const settingsRes = await pool_1.db.query(`SELECT value FROM global_settings WHERE key = 'company_name' LIMIT 1`);
        const companyName = settingsRes.rows[0]?.value || 'Company';
        const zero = { cheque_amount: 0, draft_amount: 0, online_amount: 0, cash_amount: 0, total_amount: 0, normal_count: 0, cancel_count: 0, bounce_count: 0, total_collection: 0 };
        const totals = result.rows.reduce((acc, r) => ({
            cheque_amount: acc.cheque_amount + parseFloat(r.cheque_amount || 0),
            draft_amount: acc.draft_amount + parseFloat(r.draft_amount || 0),
            online_amount: acc.online_amount + parseFloat(r.online_amount || 0),
            cash_amount: acc.cash_amount + parseFloat(r.cash_amount || 0),
            total_amount: acc.total_amount + parseFloat(r.total_amount || 0),
            normal_count: acc.normal_count + parseInt(String(r.normal_count || 0)),
            cancel_count: acc.cancel_count + parseInt(String(r.cancel_count || 0)),
            bounce_count: acc.bounce_count + parseInt(String(r.bounce_count || 0)),
            total_collection: acc.total_collection + parseFloat(r.total_collection || 0),
        }), zero);
        res.json({ success: true, data: result.rows, totals, companyName });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/due-report
router.get('/due-report', async (req, res, next) => {
    try {
        const { projectId, towerId, fromDate, toDate, status, installmentIndex, page = '1', pageSize = '100', } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = projectId ? p(projectId) : p(null);
        const tidP = towerId ? p(towerId) : p(null);
        const stP = status ? p(status) : p(null);
        const fdP = fromDate ? p(fromDate) : p(null);
        const tdP = toDate ? p(toDate) : p(null);
        const iiP = installmentIndex ? p(Number(installmentIndex)) : p(null);
        const where = `
      AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
      AND (${stP}::text  IS NULL OR d.status = ${stP}::text)
      AND (${fdP}::date IS NULL OR d.due_date >= ${fdP}::date)
      AND (${tdP}::date IS NULL OR d.due_date <= ${tdP}::date)
      AND (${iiP}::int  IS NULL OR d.installment_index = ${iiP}::int)
    `;
        const baseFrom = `
      FROM demands d
      JOIN payment_plans pp   ON pp.id = d.payment_plan_id
      JOIN consumers c        ON c.id  = pp.consumer_id
      JOIN units u            ON u.id  = pp.unit_id
      JOIN projects p         ON p.id  = pp.project_id
      LEFT JOIN towers t      ON t.id  = u.tower_id
      WHERE 1=1 ${where}
    `;
        const pgNum = Math.max(1, parseInt(page));
        const pgSize = Math.max(1, Math.min(500, parseInt(pageSize)));
        const offset = (pgNum - 1) * pgSize;
        const limitP = p(pgSize);
        const offP = p(offset);
        const dataQuery = `
      SELECT
        c.registration_no,
        c.id AS consumer_id,
        pp.unit_id,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
        c.mobile,
        u.unit_number,
        t.tower_name,
        u.floor,
        u.bhk_type,
        p.name       AS project_name,
        COALESCE(d.demand_type, 'Installment') || ' ' || d.installment_index AS installment_name,
        d.installment_index,
        d.due_date,
        d.amount_due_inr,
        COALESCE(d.cgst_amount,0) AS cgst_amount,
        COALESCE(d.sgst_amount,0) AS sgst_amount,
        d.amount_due_inr AS total_due,
        d.status AS demand_status,
        COALESCE((
          SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = c.id
            AND r.installment_index = d.installment_index
            AND r.status != 'cancelled'
        ),0) AS paid_amount,
        d.amount_due_inr - COALESCE((
          SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = c.id
            AND r.installment_index = d.installment_index
            AND r.status != 'cancelled'
        ),0) AS balance_amount,
        CASE WHEN d.due_date < CURRENT_DATE THEN CURRENT_DATE - d.due_date ELSE 0 END AS days_overdue
      ${baseFrom}
      ORDER BY d.due_date ASC, p.name, t.tower_name, u.unit_number
      LIMIT ${limitP} OFFSET ${offP}
    `;
        const countQuery = `SELECT COUNT(*) AS total ${baseFrom}`;
        const sumQuery = `
      SELECT
        COUNT(*)                                                           AS total_demands,
        SUM(d.amount_due_inr)                                             AS total_due,
        SUM(d.amount_due_inr)                                             AS total_due_with_gst
      ${baseFrom}
    `;
        // Use same params for count/sum (no limit/offset params needed — slice qp)
        const sharedParams = qp.slice(0, qp.length - 2); // remove limit + offset params
        const [dataRes, countRes, sumRes] = await Promise.all([
            pool_1.db.query(dataQuery, qp),
            pool_1.db.query(countQuery, sharedParams),
            pool_1.db.query(sumQuery, sharedParams),
        ]);
        const rows = dataRes.rows;
        // Waterfall post-processing: fix paid_amount/balance_amount for advance receipts.
        // The SQL subquery matches by installment_index which loses NULL-indexed advance receipts.
        const consumerUnits = new Map();
        for (const row of rows) {
            const key = `${row.consumer_id}:${row.unit_id}`;
            if (!consumerUnits.has(key)) {
                consumerUnits.set(key, { consumerId: row.consumer_id, unitId: row.unit_id });
            }
        }
        const wfPaidMap = new Map();
        await Promise.all([...consumerUnits.entries()].map(async ([key, { consumerId, unitId }]) => {
            const [rcptsRes, demandsRes] = await Promise.all([
                pool_1.db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
             FROM receipts
             WHERE consumer_id = $1 AND status = 'cleared'
               AND payment_plan_id = (
                 SELECT id FROM payment_plans
                 WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )
             ORDER BY received_date ASC, created_at ASC`, [consumerId, unitId]),
                pool_1.db.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                    addon_charge_amount, addon_cgst_amount, addon_sgst_amount
             FROM demands
             WHERE consumer_id = $1
               AND payment_plan_id = (
                 SELECT id FROM payment_plans
                 WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )`, [consumerId, unitId]),
            ]);
            const wfResult = (0, payment_waterfall_js_1.applyWaterfall)(rcptsRes.rows, demandsRes.rows);
            const idxMap = new Map();
            for (const w of wfResult) {
                idxMap.set(w.installment_index, w.paid);
            }
            wfPaidMap.set(key, idxMap);
        }));
        for (const row of rows) {
            const key = `${row.consumer_id}:${row.unit_id}`;
            const idxMap = wfPaidMap.get(key);
            if (idxMap) {
                const wfPaid = idxMap.get(Number(row.installment_index)) || 0;
                const totalDue = parseFloat(row.amount_due_inr) + parseFloat(row.cgst_amount || 0) + parseFloat(row.sgst_amount || 0);
                row.paid_amount = wfPaid;
                row.balance_amount = Math.max(0, totalDue - wfPaid);
            }
        }
        const s = sumRes.rows[0] || {};
        res.json({
            success: true,
            data: rows,
            total: parseInt(countRes.rows[0]?.total || '0'),
            summary: {
                totalDemands: parseInt(s.total_demands || '0'),
                totalDue: parseFloat(s.total_due || '0'),
                totalDueWithGst: parseFloat(s.total_due_with_gst || '0'),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/customer-balance
router.get('/customer-balance', async (req, res, next) => {
    try {
        const { projectId, towerId, registrationNo, name, balanceType = 'all', page = '1', pageSize = '100', } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const regP = p(registrationNo || null);
        const namP = p(name || null);
        const btP = p(balanceType || 'all');
        const where = `
      AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
      AND (${regP}::text IS NULL OR c.registration_no ILIKE '%' || ${regP} || '%')
      AND (${namP}::text IS NULL OR (c.first_name || ' ' || COALESCE(c.last_name,'')) ILIKE '%' || ${namP} || '%')
      AND (
        ${btP} = 'all'
        OR (${btP} = 'outstanding' AND (
          COALESCE((SELECT SUM(amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) -
          COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
        ) > 0)
        OR (${btP} = 'overpaid' AND (
          COALESCE((SELECT SUM(amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) -
          COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
        ) < 0)
      )
    `;
        const baseFrom = `
      FROM consumers c
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          id, consumer_id, unit_id, booking_date, selected_plan_name,
          plc_amount, other_charge_amount, main_broker_id, basic_rate_inr_sqft
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u  ON u.id  = COALESCE(br.unit_id, c.allocated_unit_id)
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t      ON t.id  = u.tower_id
      LEFT JOIN allocations a ON a.consumer_id = c.id
      LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
      LEFT JOIN brokers bk    ON bk.id = br.main_broker_id
      WHERE 1=1 ${where}
    `;
        const pgNum = Math.max(1, parseInt(page));
        const pgSize = Math.max(1, Math.min(500, parseInt(pageSize)));
        const offset = (pgNum - 1) * pgSize;
        const limitP = p(pgSize);
        const offP = p(offset);
        const dataQuery = `
      SELECT
        c.id AS consumer_id,
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
        c.mobile,
        p.name    AS project_name,
        p.id      AS project_id,
        t.tower_name,
        u.unit_number,
        u.bhk_type,
        u.floor,
        br.booking_date,
        a.allotment_date,
        br.selected_plan_name AS plan_name,
        COALESCE(bk.firm_name, 'Direct') AS broker_name,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0) AS unit_cost,
        COALESCE(bpt.cgst_amount,0) + COALESCE(bpt.sgst_amount,0) AS total_gst,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0) AS total_cost,
        COALESCE((SELECT SUM(amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) AS total_demanded,
        COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS total_received,
        (SELECT MAX(received_date) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled') AS last_payment_date,
        (SELECT amount_received_inr FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled' ORDER BY received_date DESC LIMIT 1) AS last_payment_amount,
        COALESCE((SELECT SUM(amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) -
          COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS balance,
        (SELECT COUNT(*) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled') AS receipt_count,
        CASE WHEN (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)) > 0
          THEN ROUND(
            COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
            * 100.0 / (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)), 2)
          ELSE 0 END AS received_pct
      ${baseFrom}
      ORDER BY p.name ASC, t.tower_name ASC, u.unit_number ASC
      LIMIT ${limitP} OFFSET ${offP}
    `;
        // shared params = all except last 2 (limit + offset)
        const sharedParams = qp.slice(0, qp.length - 2);
        const countQuery = `SELECT COUNT(*) AS total ${baseFrom}`;
        const sumQuery = `
      SELECT
        COUNT(*)  AS total_consumers,
        SUM(COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)) AS total_unit_cost,
        SUM(COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)) AS total_received,
        SUM(
          COALESCE((SELECT SUM(amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) -
          COALESCE((SELECT SUM(amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
        ) AS total_balance
      ${baseFrom}
    `;
        const [dataRes, countRes, sumRes] = await Promise.all([
            pool_1.db.query(dataQuery, qp),
            pool_1.db.query(countQuery, sharedParams),
            pool_1.db.query(sumQuery, sharedParams),
        ]);
        const s = sumRes.rows[0] || {};
        res.json({
            success: true,
            data: dataRes.rows,
            total: parseInt(countRes.rows[0]?.total || '0'),
            summary: {
                totalConsumers: parseInt(s.total_consumers || '0'),
                totalUnitCost: parseFloat(s.total_unit_cost || '0'),
                totalReceived: parseFloat(s.total_received || '0'),
                totalBalance: parseFloat(s.total_balance || '0'),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/customer-dues - Customer Wise Dues
router.get('/customer-dues', async (req, res, next) => {
    try {
        const { projectId, towerId, bhkType, paymentPlanId, duesCriteria, inPercent, brokerId, registrationNo, firstName, unitAddress, dueDate, customerClassification, page = '1', pageSize = '100', } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const bhkP = p(bhkType || null);
        const dcP = p(duesCriteria || null); // null = all
        const ddP = p(dueDate || null);
        const regP = p(registrationNo || null);
        const fnP = p(firstName || null);
        const ccP = p(customerClassification || null);
        const ipP = p(inPercent ? parseFloat(inPercent) : null);
        // UNDUE subquery — plan_schedule_templates uses project_id column
        const undueSub = `
      COALESCE((
        SELECT SUM(pst.flat_amount_inr)
        FROM plan_schedule_templates pst
        WHERE pst.project_id = p.id
        AND pst.installment_index NOT IN (
          SELECT COALESCE(d2.installment_index, -1)
          FROM demands d2
          WHERE d2.consumer_id = c.id
        )
      ),0)
    `;
        const pgNum = Math.max(1, parseInt(page));
        const pgSize = Math.max(1, Math.min(500, parseInt(pageSize)));
        const offset = (pgNum - 1) * pgSize;
        const limitP = p(pgSize);
        const offP = p(offset);
        const baseFrom = `
      FROM consumers c
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id, booking_date, selected_plan_name,
          plc_amount, other_charge_amount, main_broker_id, self_or_loan, basic_rate_inr_sqft
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u    ON u.id  = br.unit_id
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t      ON t.id  = u.tower_id
      LEFT JOIN allocations a ON a.consumer_id = c.id
      LEFT JOIN brokers bk    ON bk.id = br.main_broker_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
        AND (${bhkP}::text IS NULL OR u.bhk_type = ${bhkP}::text)
        AND (${dcP}::varchar IS NULL OR TRUE)
        AND (${ddP}::date IS NULL OR TRUE)
        AND (${regP}::text IS NULL OR c.registration_no ILIKE '%' || ${regP}::text || '%')
        AND (${fnP}::text  IS NULL OR c.first_name ILIKE '%' || ${fnP}::text || '%')
        AND (${ccP}::text  IS NULL OR c.customer_classification = ${ccP}::text)
        AND (${ipP}::numeric IS NULL OR
          CASE WHEN (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0)) > 0
            THEN COALESCE((SELECT SUM(r2.amount_received_inr) FROM receipts r2 WHERE r2.consumer_id = c.id AND r2.status != 'cancelled'),0)
              * 100.0 / (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0))
            ELSE 0 END <= ${ipP}::numeric)
    `;
        const dataQuery = `
      SELECT
        c.id AS consumer_id,
        u.id AS unit_id,
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
        c.mobile,
        c.email,
        br.booking_date,
        a.allotment_date,
        u.unit_number,
        u.bhk_type,
        u.floor,
        u.carpet_area_sqft AS area,
        t.tower_name,
        p.name AS project_name,
        br.selected_plan_name AS plan_name,
        br.self_or_loan AS loan_type,
        COALESCE(bk.firm_name,'Direct') AS broker_name,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) AS net_bsp,
        COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0) AS unit_cost,

        -- DUES
        (SELECT MAX(d.due_date) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          AND (${dcP}::text IS NULL OR d.status = ${dcP}::text)
        ) AS dues_date,
        COALESCE((SELECT SUM(d.amount_due_inr) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          AND (${dcP}::text IS NULL OR d.status = ${dcP}::text)
        ),0) AS dues_amount,
        COALESCE((SELECT SUM(COALESCE(d.cgst_amount,0)) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          AND (${dcP}::text IS NULL OR d.status = ${dcP}::text)
        ),0) AS dues_cgst,
        COALESCE((SELECT SUM(COALESCE(d.sgst_amount,0)) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          AND (${dcP}::text IS NULL OR d.status = ${dcP}::text)
        ),0) AS dues_sgst,
        COALESCE((SELECT SUM(d.amount_due_inr)
          FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          AND (${dcP}::text IS NULL OR d.status = ${dcP}::text)
        ),0) AS dues_total,

        -- RECEIVED
        0 AS received_pending,
        COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_clear,
        0 AS received_cgst,
        0 AS received_sgst,
        COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_total,

        -- CREDIT
        0 AS credit_amount,

        -- OUTSTANDING
        GREATEST(0,
          COALESCE((SELECT SUM(d.amount_due_inr) FROM demands d WHERE d.consumer_id = c.id
            AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)),0) -
          COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
        ) AS outstanding_amount,
        CASE WHEN (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)) > 0 THEN
          ROUND(GREATEST(0,
            COALESCE((SELECT SUM(d.amount_due_inr) FROM demands d WHERE d.consumer_id = c.id),0) -
            COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
          ) * 100.0 / (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)), 2)
          ELSE 0 END AS outstanding_pct,

        -- UNDUE
        ${undueSub} AS undue_amount,

        -- RECEIVED %
        CASE WHEN (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)) > 0 THEN
          ROUND(
            COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0)
            * 100.0 / (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)), 2)
          ELSE 0 END AS received_pct
      ${baseFrom}
      ORDER BY t.tower_name ASC NULLS LAST, u.unit_number ASC
      LIMIT ${limitP} OFFSET ${offP}
    `;
        const sharedParams = qp.slice(0, qp.length - 2);
        const countQuery = `SELECT COUNT(*) AS total ${baseFrom}`;
        const [dataRes, countRes] = await Promise.all([
            pool_1.db.query(dataQuery, qp),
            pool_1.db.query(countQuery, sharedParams),
        ]);
        // Build summary matrix from JS aggregation
        const rows = dataRes.rows;
        // Waterfall post-processing: fix received_cgst/received_sgst for advance receipts.
        // SQL COALESCE(d.cgst_amount, r.amount*0.005) was replaced with 0 placeholder above;
        // here we compute the true GST received per consumer via applyWaterfall.
        const cuMap = new Map();
        for (const row of rows) {
            const key = `${row.consumer_id}:${row.unit_id}`;
            if (!cuMap.has(key))
                cuMap.set(key, { consumerId: row.consumer_id, unitId: row.unit_id });
        }
        const wfGstMap = new Map();
        await Promise.all([...cuMap.entries()].map(async ([key, { consumerId, unitId }]) => {
            const [rcptsRes, demandsRes] = await Promise.all([
                pool_1.db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
             FROM receipts
             WHERE consumer_id = $1 AND status = 'cleared'
               AND payment_plan_id = (
                 SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )
             ORDER BY received_date ASC, created_at ASC`, [consumerId, unitId]),
                pool_1.db.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                    addon_charge_amount, addon_cgst_amount, addon_sgst_amount
             FROM demands
             WHERE consumer_id = $1
               AND payment_plan_id = (
                 SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2
                 ORDER BY created_at DESC LIMIT 1
               )`, [consumerId, unitId]),
            ]);
            const demandGst = new Map();
            for (const d of demandsRes.rows) {
                const cgst = parseFloat(d.cgst_amount || 0);
                const sgst = parseFloat(d.sgst_amount || 0);
                const total = parseFloat(d.amount_due_inr || 0) + cgst + sgst;
                demandGst.set(String(d.id), { cgst, sgst, total });
            }
            const wfResult = (0, payment_waterfall_js_1.applyWaterfall)(rcptsRes.rows, demandsRes.rows);
            let totalCgst = 0;
            let totalSgst = 0;
            for (const w of wfResult) {
                if (w.paid > 0 && w.demand_id) {
                    const gst = demandGst.get(String(w.demand_id));
                    if (gst) {
                        const ratio = gst.total > 0 ? Math.min(1, w.paid / gst.total) : 0;
                        totalCgst += gst.cgst * ratio;
                        totalSgst += gst.sgst * ratio;
                    }
                }
            }
            wfGstMap.set(key, { cgst: Math.round(totalCgst * 100) / 100, sgst: Math.round(totalSgst * 100) / 100 });
        }));
        for (const row of rows) {
            const gst = wfGstMap.get(`${row.consumer_id}:${row.unit_id}`);
            if (gst) {
                row.received_cgst = gst.cgst;
                row.received_sgst = gst.sgst;
            }
        }
        const sumClrAmt = rows.reduce((a, r) => a + parseFloat(r.received_clear || 0), 0);
        const sumClrCgst = rows.reduce((a, r) => a + parseFloat(r.received_cgst || 0), 0);
        const sumClrSgst = rows.reduce((a, r) => a + parseFloat(r.received_sgst || 0), 0);
        const sumClrTot = rows.reduce((a, r) => a + parseFloat(r.received_total || 0), 0);
        res.json({
            success: true,
            data: rows,
            total: parseInt(countRes.rows[0]?.total || '0'),
            summary: {
                pending: { amount: 0, cgst: 0, sgst: 0, interest: 0, total: 0 },
                clear: { amount: sumClrAmt, cgst: sumClrCgst, sgst: sumClrSgst, interest: 0, total: sumClrTot },
                total: { amount: sumClrAmt, cgst: sumClrCgst, sgst: sumClrSgst, interest: 0, total: sumClrTot },
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/stage-wise-dues
router.get('/stage-wise-dues', async (req, res, next) => {
    try {
        const { projectId, towerId, dueDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const ddP = p(dueDate || null);
        const query = `
      SELECT
        d.installment_index,
        d.demand_type                                             AS installment_name,
        COUNT(DISTINCT d.consumer_id)           AS consumer_count,
        SUM(d.amount_due_inr)                   AS total_demanded,
        SUM(COALESCE(d.cgst_amount,0))          AS total_cgst,
        SUM(COALESCE(d.sgst_amount,0))          AS total_sgst,
        SUM(d.amount_due_inr) AS total_due,
        COALESCE(SUM((
          SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = d.consumer_id
            AND r.installment_index = d.installment_index
            AND r.status != 'cancelled'
        )),0) AS total_received,
        SUM(d.amount_due_inr) - COALESCE(SUM((
          SELECT SUM(r.amount_received_inr)
          FROM receipts r
          WHERE r.consumer_id = d.consumer_id
            AND r.installment_index = d.installment_index
            AND r.status != 'cancelled'
        )),0) AS total_outstanding,
        COUNT(DISTINCT CASE WHEN
          COALESCE((
            SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = d.consumer_id
              AND r.installment_index = d.installment_index
              AND r.status != 'cancelled'
          ),0) >= d.amount_due_inr THEN d.consumer_id END) AS paid_count,
        COUNT(DISTINCT CASE WHEN
          COALESCE((
            SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = d.consumer_id
              AND r.installment_index = d.installment_index
              AND r.status != 'cancelled'
          ),0) < d.amount_due_inr THEN d.consumer_id END) AS unpaid_count
      FROM demands d
      JOIN consumers c ON c.id = d.consumer_id
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u    ON u.id  = br.unit_id
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t ON t.id  = u.tower_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
        AND (${ddP}::date  IS NULL OR d.due_date <= ${ddP}::date)
      GROUP BY d.installment_index, d.demand_type
      ORDER BY d.installment_index
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((acc, r) => ({
            consumer_count: Math.max(acc.consumer_count, parseInt(r.consumer_count || 0)),
            total_demanded: acc.total_demanded + parseFloat(r.total_demanded || 0),
            total_cgst: acc.total_cgst + parseFloat(r.total_cgst || 0),
            total_sgst: acc.total_sgst + parseFloat(r.total_sgst || 0),
            total_due: acc.total_due + parseFloat(r.total_due || 0),
            total_received: acc.total_received + parseFloat(r.total_received || 0),
            total_outstanding: acc.total_outstanding + parseFloat(r.total_outstanding || 0),
            paid_count: acc.paid_count + parseInt(String(r.paid_count || 0)),
            unpaid_count: acc.unpaid_count + parseInt(String(r.unpaid_count || 0)),
        }), { consumer_count: 0, total_demanded: 0, total_cgst: 0, total_sgst: 0, total_due: 0, total_received: 0, total_outstanding: 0, paid_count: 0, unpaid_count: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/percentage-wise-dues
router.get('/percentage-wise-dues', async (req, res, next) => {
    try {
        const { projectId, towerId, dueDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const ddP = p(dueDate || null);
        const query = `
      WITH consumer_pct AS (
        SELECT
          c.id AS consumer_id,
          c.registration_no,
          TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
          u.unit_number,
          t.tower_name,
          u.bhk_type,
          p.name AS project_name,
          COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0) AS total_cost,
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.status != 'cancelled'
          ),0) AS total_received,
          COALESCE((
            SELECT SUM(d.amount_due_inr) FROM demands d
            WHERE d.consumer_id = c.id
              AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
          ),0) -
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.status != 'cancelled'
          ),0) AS outstanding,
          CASE WHEN (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)) > 0 THEN
            ROUND(
              COALESCE((
                SELECT SUM(r.amount_received_inr) FROM receipts r
                WHERE r.consumer_id = c.id AND r.status != 'cancelled'
              ),0) * 100.0 / (COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0))
            , 2)
          ELSE 0 END AS received_pct
        FROM consumers c
        JOIN (
          SELECT DISTINCT ON (consumer_id)
            consumer_id, unit_id, plc_amount, other_charge_amount, basic_rate_inr_sqft
          FROM booking_records
          WHERE unit_id IS NOT NULL
          ORDER BY consumer_id, created_at DESC
        ) br ON br.consumer_id = c.id
        JOIN units u    ON u.id  = br.unit_id
        JOIN projects p ON p.id  = u.project_id
        LEFT JOIN towers t ON t.id  = u.tower_id
        WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
          AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
      ),
      bucketed AS (
        SELECT *,
          CASE
            WHEN received_pct = 0              THEN '0%'
            WHEN received_pct <= 10            THEN '0-10%'
            WHEN received_pct <= 20            THEN '10-20%'
            WHEN received_pct <= 30            THEN '20-30%'
            WHEN received_pct <= 40            THEN '30-40%'
            WHEN received_pct <= 50            THEN '40-50%'
            WHEN received_pct <= 60            THEN '50-60%'
            WHEN received_pct <= 70            THEN '60-70%'
            WHEN received_pct <= 80            THEN '70-80%'
            WHEN received_pct <= 90            THEN '80-90%'
            WHEN received_pct <  100           THEN '90-100%'
            ELSE '100%+'
          END AS pct_bucket,
          CASE
            WHEN received_pct = 0   THEN 0
            WHEN received_pct <= 10 THEN 1
            WHEN received_pct <= 20 THEN 2
            WHEN received_pct <= 30 THEN 3
            WHEN received_pct <= 40 THEN 4
            WHEN received_pct <= 50 THEN 5
            WHEN received_pct <= 60 THEN 6
            WHEN received_pct <= 70 THEN 7
            WHEN received_pct <= 80 THEN 8
            WHEN received_pct <= 90 THEN 9
            WHEN received_pct <  100 THEN 10
            ELSE 11
          END AS bucket_order
        FROM consumer_pct
      )
      SELECT
        pct_bucket,
        bucket_order,
        COUNT(*)                  AS consumer_count,
        SUM(total_cost)           AS total_cost,
        SUM(total_received)       AS total_received,
        SUM(outstanding)          AS total_outstanding,
        MIN(received_pct)         AS min_pct,
        MAX(received_pct)         AS max_pct,
        ROUND(AVG(received_pct),2) AS avg_pct,
        JSON_AGG(JSON_BUILD_OBJECT(
          'consumer_id',    consumer_id,
          'consumer_name',  consumer_name,
          'registration_no',registration_no,
          'unit_number',    unit_number,
          'tower_name',     tower_name,
          'bhk_type',       bhk_type,
          'total_cost',     total_cost,
          'total_received', total_received,
          'outstanding',    outstanding,
          'received_pct',   received_pct
        ) ORDER BY received_pct DESC) AS consumers
      FROM bucketed
      GROUP BY pct_bucket, bucket_order
      ORDER BY bucket_order
    `;
        const result = await pool_1.db.query(query, qp);
        const buckets = result.rows;
        const totals = buckets.reduce((acc, r) => ({
            total_consumers: acc.total_consumers + parseInt(String(r.consumer_count || 0)),
            total_cost: acc.total_cost + parseFloat(r.total_cost || 0),
            total_received: acc.total_received + parseFloat(r.total_received || 0),
            total_outstanding: acc.total_outstanding + parseFloat(r.total_outstanding || 0),
        }), { total_consumers: 0, total_cost: 0, total_received: 0, total_outstanding: 0 });
        // Build consumers_by_bucket map
        const consumers_by_bucket = {};
        buckets.forEach((b) => {
            consumers_by_bucket[b.pct_bucket] = b.consumers || [];
        });
        res.json({ success: true, buckets, consumers_by_bucket, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 1: Project Wise Dues ───────────────────────────────────────────
router.get('/project-wise-dues', async (req, res, next) => {
    try {
        const { projectId, dueDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const ddP = p(dueDate || null);
        const query = `
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        COUNT(DISTINCT c.id) AS consumer_count,
        COUNT(DISTINCT u.id) AS unit_count,
        COALESCE(SUM(COALESCE(br.basic_rate_inr_sqft,0) * (COALESCE(u.carpet_area_sqft,0) + COALESCE(u.balcony_area_sqft,0)) + COALESCE(br.plc_amount,0) + COALESCE(br.other_charge_amount,0)),0) AS total_cost,
        COALESCE(SUM((
          SELECT SUM(d.amount_due_inr) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
        )),0) AS total_demanded,
        COALESCE(SUM((
          SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'
        )),0) AS total_received,
        COALESCE(SUM((
          SELECT SUM(d.amount_due_inr) FROM demands d WHERE d.consumer_id = c.id
          AND (${ddP}::date IS NULL OR d.due_date <= ${ddP}::date)
        )),0) -
        COALESCE(SUM((
          SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'
        )),0) AS outstanding
      FROM projects p
      LEFT JOIN units u ON u.project_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (unit_id)
          unit_id, consumer_id, plc_amount, other_charge_amount, basic_rate_inr_sqft
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY unit_id, created_at DESC
      ) br ON br.unit_id = u.id
      LEFT JOIN consumers c ON c.id = br.consumer_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      GROUP BY p.id, p.name
      ORDER BY p.name
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            consumer_count: a.consumer_count + parseInt(String(r.consumer_count || 0)),
            unit_count: a.unit_count + parseInt(String(r.unit_count || 0)),
            total_cost: a.total_cost + parseFloat(r.total_cost || 0),
            total_demanded: a.total_demanded + parseFloat(r.total_demanded || 0),
            total_received: a.total_received + parseFloat(r.total_received || 0),
            outstanding: a.outstanding + parseFloat(r.outstanding || 0),
        }), { consumer_count: 0, unit_count: 0, total_cost: 0, total_demanded: 0, total_received: 0, outstanding: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 2: Ageing Project Wise ─────────────────────────────────────────
router.get('/ageing-project', async (req, res, next) => {
    try {
        const { projectId, asOnDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const aodP = p(asOnDate || null);
        const query = `
      WITH overdue AS (
        SELECT
          p.id AS project_id, p.name AS project_name,
          c.id AS consumer_id,
          d.amount_due_inr, d.due_date,
          GREATEST(0, COALESCE(${aodP}::date, CURRENT_DATE) - d.due_date) AS days_overdue,
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
          ),0) AS paid
        FROM demands d
        JOIN consumers c ON c.id = d.consumer_id
        JOIN (
          SELECT DISTINCT ON (consumer_id)
            consumer_id, unit_id
          FROM booking_records
          WHERE unit_id IS NOT NULL
          ORDER BY consumer_id, created_at DESC
        ) br ON br.consumer_id = c.id
        JOIN units u    ON u.id  = br.unit_id
        JOIN projects p ON p.id  = u.project_id
        WHERE d.due_date < COALESCE(${aodP}::date, CURRENT_DATE)
          AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      )
      SELECT
        project_id, project_name,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 1  AND 30  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_0_30,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 1  AND 30  THEN consumer_id END) AS count_0_30,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_31_60,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 31 AND 60  THEN consumer_id END) AS count_31_60,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_61_90,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 61 AND 90  THEN consumer_id END) AS count_61_90,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 91 AND 180 THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_91_180,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 91 AND 180 THEN consumer_id END) AS count_91_180,
        COALESCE(SUM(CASE WHEN days_overdue > 180             THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_180_plus,
        COUNT(DISTINCT CASE WHEN days_overdue > 180             THEN consumer_id END) AS count_180_plus,
        COALESCE(SUM(GREATEST(0,amount_due_inr-paid)),0) AS total_overdue
      FROM overdue
      GROUP BY project_id, project_name
      ORDER BY project_name
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            bucket_0_30: a.bucket_0_30 + parseFloat(r.bucket_0_30 || 0),
            bucket_31_60: a.bucket_31_60 + parseFloat(r.bucket_31_60 || 0),
            bucket_61_90: a.bucket_61_90 + parseFloat(r.bucket_61_90 || 0),
            bucket_91_180: a.bucket_91_180 + parseFloat(r.bucket_91_180 || 0),
            bucket_180_plus: a.bucket_180_plus + parseFloat(r.bucket_180_plus || 0),
            total_overdue: a.total_overdue + parseFloat(r.total_overdue || 0),
        }), { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_180: 0, bucket_180_plus: 0, total_overdue: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 3: Ageing Installment Wise ─────────────────────────────────────
router.get('/ageing-installment', async (req, res, next) => {
    try {
        const { projectId, asOnDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const aodP = p(asOnDate || null);
        const query = `
      WITH overdue AS (
        SELECT
          d.installment_index, d.demand_type,
          c.id AS consumer_id,
          d.amount_due_inr, d.due_date,
          GREATEST(0, COALESCE(${aodP}::date, CURRENT_DATE) - d.due_date) AS days_overdue,
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
          ),0) AS paid
        FROM demands d
        JOIN consumers c ON c.id = d.consumer_id
        JOIN (
          SELECT DISTINCT ON (consumer_id)
            consumer_id, unit_id
          FROM booking_records
          WHERE unit_id IS NOT NULL
          ORDER BY consumer_id, created_at DESC
        ) br ON br.consumer_id = c.id
        JOIN units u    ON u.id  = br.unit_id
        JOIN projects p ON p.id  = u.project_id
        WHERE d.due_date < COALESCE(${aodP}::date, CURRENT_DATE)
          AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      )
      SELECT
        installment_index, demand_type,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 1  AND 30  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_0_30,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 1  AND 30  THEN consumer_id END) AS count_0_30,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_31_60,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 31 AND 60  THEN consumer_id END) AS count_31_60,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_61_90,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 61 AND 90  THEN consumer_id END) AS count_61_90,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 91 AND 180 THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_91_180,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 91 AND 180 THEN consumer_id END) AS count_91_180,
        COALESCE(SUM(CASE WHEN days_overdue > 180             THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_180_plus,
        COUNT(DISTINCT CASE WHEN days_overdue > 180             THEN consumer_id END) AS count_180_plus,
        COALESCE(SUM(GREATEST(0,amount_due_inr-paid)),0) AS total_overdue
      FROM overdue
      GROUP BY installment_index, demand_type
      ORDER BY installment_index
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            bucket_0_30: a.bucket_0_30 + parseFloat(r.bucket_0_30 || 0),
            bucket_31_60: a.bucket_31_60 + parseFloat(r.bucket_31_60 || 0),
            bucket_61_90: a.bucket_61_90 + parseFloat(r.bucket_61_90 || 0),
            bucket_91_180: a.bucket_91_180 + parseFloat(r.bucket_91_180 || 0),
            bucket_180_plus: a.bucket_180_plus + parseFloat(r.bucket_180_plus || 0),
            total_overdue: a.total_overdue + parseFloat(r.total_overdue || 0),
        }), { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_180: 0, bucket_180_plus: 0, total_overdue: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint: Ageing Tower Wise ─────────────────────────────────────────────
router.get('/ageing-tower', async (req, res, next) => {
    try {
        const { projectId, asOnDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const aodP = p(asOnDate || null);
        const query = `
      WITH overdue AS (
        SELECT
          p.id AS project_id, p.name AS project_name,
          COALESCE(t.tower_name, 'No Tower') AS tower_name,
          c.id AS consumer_id,
          d.amount_due_inr, d.due_date,
          GREATEST(0, COALESCE(${aodP}::date, CURRENT_DATE) - d.due_date) AS days_overdue,
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
          ),0) AS paid
        FROM demands d
        JOIN consumers c ON c.id = d.consumer_id
        JOIN (
          SELECT DISTINCT ON (consumer_id)
            consumer_id, unit_id
          FROM booking_records
          WHERE unit_id IS NOT NULL
          ORDER BY consumer_id, created_at DESC
        ) br ON br.consumer_id = c.id
        JOIN units u    ON u.id  = br.unit_id
        LEFT JOIN towers t ON t.id  = u.tower_id
        JOIN projects p ON p.id  = u.project_id
        WHERE d.due_date < COALESCE(${aodP}::date, CURRENT_DATE)
          AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      )
      SELECT
        project_name, tower_name,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 1  AND 30  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_0_30,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 1  AND 30  THEN consumer_id END) AS count_0_30,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_31_60,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 31 AND 60  THEN consumer_id END) AS count_31_60,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_61_90,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 61 AND 90  THEN consumer_id END) AS count_61_90,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 91 AND 180 THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_91_180,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 91 AND 180 THEN consumer_id END) AS count_91_180,
        COALESCE(SUM(CASE WHEN days_overdue > 180             THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_180_plus,
        COUNT(DISTINCT CASE WHEN days_overdue > 180             THEN consumer_id END) AS count_180_plus,
        COALESCE(SUM(GREATEST(0,amount_due_inr-paid)),0) AS total_overdue
      FROM overdue
      GROUP BY project_name, tower_name
      ORDER BY project_name, tower_name
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            bucket_0_30: a.bucket_0_30 + parseFloat(r.bucket_0_30 || 0),
            bucket_31_60: a.bucket_31_60 + parseFloat(r.bucket_31_60 || 0),
            bucket_61_90: a.bucket_61_90 + parseFloat(r.bucket_61_90 || 0),
            bucket_91_180: a.bucket_91_180 + parseFloat(r.bucket_91_180 || 0),
            bucket_180_plus: a.bucket_180_plus + parseFloat(r.bucket_180_plus || 0),
            total_overdue: a.total_overdue + parseFloat(r.total_overdue || 0),
        }), { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_180: 0, bucket_180_plus: 0, total_overdue: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint: Ageing Plan Wise ──────────────────────────────────────────────
router.get('/ageing-plan', async (req, res, next) => {
    try {
        const { projectId, asOnDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const aodP = p(asOnDate || null);
        const query = `
      WITH overdue AS (
        SELECT
          p.id AS project_id, p.name AS project_name,
          COALESCE(br.selected_plan_name, 'No Plan') AS plan_name,
          c.id AS consumer_id,
          d.amount_due_inr, d.due_date,
          GREATEST(0, COALESCE(${aodP}::date, CURRENT_DATE) - d.due_date) AS days_overdue,
          COALESCE((
            SELECT SUM(r.amount_received_inr) FROM receipts r
            WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
          ),0) AS paid
        FROM demands d
        JOIN consumers c ON c.id = d.consumer_id
        JOIN (
          SELECT DISTINCT ON (consumer_id)
            consumer_id, unit_id, selected_plan_name
          FROM booking_records
          WHERE unit_id IS NOT NULL
          ORDER BY consumer_id, created_at DESC
        ) br ON br.consumer_id = c.id
        JOIN units u    ON u.id  = br.unit_id
        JOIN projects p ON p.id  = u.project_id
        WHERE d.due_date < COALESCE(${aodP}::date, CURRENT_DATE)
          AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      )
      SELECT
        project_name, plan_name,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 1  AND 30  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_0_30,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 1  AND 30  THEN consumer_id END) AS count_0_30,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_31_60,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 31 AND 60  THEN consumer_id END) AS count_31_60,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90  THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_61_90,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 61 AND 90  THEN consumer_id END) AS count_61_90,
        COALESCE(SUM(CASE WHEN days_overdue BETWEEN 91 AND 180 THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_91_180,
        COUNT(DISTINCT CASE WHEN days_overdue BETWEEN 91 AND 180 THEN consumer_id END) AS count_91_180,
        COALESCE(SUM(CASE WHEN days_overdue > 180             THEN GREATEST(0,amount_due_inr-paid) END),0) AS bucket_180_plus,
        COUNT(DISTINCT CASE WHEN days_overdue > 180             THEN consumer_id END) AS count_180_plus,
        COALESCE(SUM(GREATEST(0,amount_due_inr-paid)),0) AS total_overdue
      FROM overdue
      GROUP BY project_name, plan_name
      ORDER BY project_name, plan_name
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            bucket_0_30: a.bucket_0_30 + parseFloat(r.bucket_0_30 || 0),
            bucket_31_60: a.bucket_31_60 + parseFloat(r.bucket_31_60 || 0),
            bucket_61_90: a.bucket_61_90 + parseFloat(r.bucket_61_90 || 0),
            bucket_91_180: a.bucket_91_180 + parseFloat(r.bucket_91_180 || 0),
            bucket_180_plus: a.bucket_180_plus + parseFloat(r.bucket_180_plus || 0),
            total_overdue: a.total_overdue + parseFloat(r.total_overdue || 0),
        }), { bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_180: 0, bucket_180_plus: 0, total_overdue: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 4: Month Wise Dues ──────────────────────────────────────────────
router.get('/month-wise-dues', async (req, res, next) => {
    try {
        const { projectId, year } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const yearP = p(year ? parseInt(year) : null);
        const query = `
      SELECT
        TO_CHAR(d.due_date,'Mon YYYY') AS month_label,
        DATE_TRUNC('month', d.due_date) AS month_date,
        COUNT(DISTINCT d.consumer_id) AS consumer_count,
        COUNT(d.id) AS demand_count,
        SUM(d.amount_due_inr) AS total_due,
        COALESCE(SUM(COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0)),0) AS total_gst,
        SUM(d.amount_due_inr) AS total_due_with_gst,
        COALESCE(SUM((
          SELECT SUM(r.amount_received_inr) FROM receipts r
          WHERE r.consumer_id = d.consumer_id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
        )),0) AS total_received,
        SUM(d.amount_due_inr) - COALESCE(SUM((
          SELECT SUM(r.amount_received_inr) FROM receipts r
          WHERE r.consumer_id = d.consumer_id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
        )),0) AS total_outstanding
      FROM demands d
      JOIN consumers c ON c.id = d.consumer_id
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u   ON u.id  = br.unit_id
      JOIN projects p ON p.id = u.project_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND d.due_date IS NOT NULL
        AND d.status = 'demanded'
        AND (${yearP}::int IS NULL OR EXTRACT(YEAR FROM d.due_date) = ${yearP}::int)
      GROUP BY 1, 2
      ORDER BY 2
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            consumer_count: Math.max(a.consumer_count, parseInt(String(r.consumer_count || 0))),
            demand_count: a.demand_count + parseInt(String(r.demand_count || 0)),
            total_due: a.total_due + parseFloat(r.total_due || 0),
            total_gst: a.total_gst + parseFloat(r.total_gst || 0),
            total_due_with_gst: a.total_due_with_gst + parseFloat(r.total_due_with_gst || 0),
            total_received: a.total_received + parseFloat(r.total_received || 0),
            total_outstanding: a.total_outstanding + parseFloat(r.total_outstanding || 0),
        }), { consumer_count: 0, demand_count: 0, total_due: 0, total_gst: 0, total_due_with_gst: 0, total_received: 0, total_outstanding: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 5: Customer Dues Detail ────────────────────────────────────────
router.get('/customer-dues-detail', async (req, res, next) => {
    try {
        const { projectId, consumerId, towerId, installmentIndex, status } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const cidP = p(consumerId || null);
        const tidP = p(towerId || null);
        const iiP = p(installmentIndex ? parseInt(installmentIndex) : null);
        const stP = p(status || null);
        const query = `
      SELECT
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
        c.id AS consumer_id,
        c.mobile,
        u.unit_number,
        t.tower_name,
        p.name AS project_name,
        d.installment_index,
        d.demand_type AS installment_name,
        d.due_date,
        d.amount_due_inr,
        COALESCE(d.cgst_amount,0) AS cgst,
        COALESCE(d.sgst_amount,0) AS sgst,
        d.amount_due_inr AS total_due,
        d.status AS demand_status,
        COALESCE((
          SELECT SUM(r.amount_received_inr) FROM receipts r
          WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
        ),0) AS paid,
        d.amount_due_inr - COALESCE((
          SELECT SUM(r.amount_received_inr) FROM receipts r
          WHERE r.consumer_id = c.id AND r.installment_index = d.installment_index AND r.status != 'cancelled'
        ),0) AS balance,
        CASE WHEN d.due_date < CURRENT_DATE THEN CURRENT_DATE - d.due_date ELSE 0 END AS days_overdue
      FROM demands d
      JOIN consumers c ON c.id = d.consumer_id
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u    ON u.id  = br.unit_id
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t ON t.id  = u.tower_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${cidP}::uuid IS NULL OR c.id = ${cidP}::uuid)
        AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
        AND (${iiP}::int   IS NULL OR d.installment_index = ${iiP}::int)
        AND (${stP}::text  IS NULL OR d.status = ${stP})
      ORDER BY t.tower_name NULLS LAST, u.unit_number, d.installment_index
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows, total: result.rows.length });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint 6: Other Charges ────────────────────────────────────────────────
router.get('/other-charges', async (req, res, next) => {
    try {
        const { projectId, towerId, chargeType = 'all' } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const ctP = p(chargeType || 'all');
        const query = `
      SELECT
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name,'')) AS consumer_name,
        c.id AS consumer_id,
        u.unit_number, t.tower_name, u.bhk_type,
        p.name AS project_name,
        COALESCE(br.plc_amount,0)           AS booking_plc,
        COALESCE(br.other_charge_amount,0)  AS booking_other,
        COALESCE(br.other_charge_desc,'')   AS other_charge_desc,
        COALESCE((SELECT SUM(plc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_plc,
        COALESCE((SELECT SUM(edc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_edc,
        COALESCE((SELECT SUM(idc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_idc,
        COALESCE((SELECT SUM(other_charge_amount)  FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS received_other,
        COALESCE((SELECT SUM(COALESCE(plc_amount,0)+COALESCE(edc_amount,0)+COALESCE(idc_amount,0)+COALESCE(other_charge_amount,0))
          FROM receipts r WHERE r.consumer_id = c.id AND r.status != 'cancelled'),0) AS total_addon_received
      FROM consumers c
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id, plc_amount, other_charge_amount, other_charge_desc
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u    ON u.id  = br.unit_id
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t ON t.id  = u.tower_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
        AND (
          ${ctP}::text = 'all'
          OR (${ctP}::text = 'plc'   AND COALESCE(br.plc_amount,0)          > 0)
          OR (${ctP}::text = 'other' AND COALESCE(br.other_charge_amount,0) > 0)
        )
      ORDER BY t.tower_name NULLS LAST, u.unit_number
    `;
        const result = await pool_1.db.query(query, qp);
        const rows = result.rows;
        const totals = rows.reduce((a, r) => ({
            booking_plc: a.booking_plc + parseFloat(r.booking_plc || 0),
            booking_other: a.booking_other + parseFloat(r.booking_other || 0),
            received_plc: a.received_plc + parseFloat(r.received_plc || 0),
            received_edc: a.received_edc + parseFloat(r.received_edc || 0),
            received_idc: a.received_idc + parseFloat(r.received_idc || 0),
            received_other: a.received_other + parseFloat(r.received_other || 0),
            total_addon_received: a.total_addon_received + parseFloat(r.total_addon_received || 0),
        }), { booking_plc: 0, booking_other: 0, received_plc: 0, received_edc: 0, received_idc: 0, received_other: 0, total_addon_received: 0 });
        res.json({ success: true, data: rows, totals });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/opening-details — One row per consumer with booking amount
router.get('/opening-details', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const query = `
      SELECT
        c.id                                                   AS consumer_id,
        c.first_name || ' ' || COALESCE(c.last_name, '')      AS consumer_name,
        c.mobile,
        c.registration_no,
        p.name                                                 AS project_name,
        t.tower_name,
        u.unit_number,
        br.booking_date,
        br.booking_amount
      FROM consumers c
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id, booking_date, booking_amount
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      ) br ON br.consumer_id = c.id
      JOIN units u    ON u.id  = br.unit_id
      JOIN projects p ON p.id  = u.project_id
      LEFT JOIN towers t ON t.id  = u.tower_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      ORDER BY br.booking_date DESC, consumer_name ASC
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/booking-authentication — One row per booking with authenticator info
router.get('/booking-authentication', async (req, res, next) => {
    try {
        const { projectId, fromDate, toDate } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const fromP = p(fromDate || null);
        const toP = p(toDate || null);
        const query = `
      SELECT
        br.id,
        br.booking_date,
        br.booking_amount,
        br.payment_mode,
        br.bank_name,
        br.payment_ref,
        br.status,
        br.remarks,
        br.created_at,
        c.id AS consumer_id,
        c.first_name || ' ' || COALESCE(c.last_name, '') AS consumer_name,
        c.mobile,
        c.registration_no,
        p.name    AS project_name,
        t.tower_name,
        u.unit_number,
        u.bhk_type,
        au.name   AS authenticated_by
      FROM booking_records br
      JOIN consumers c  ON c.id  = br.consumer_id
      JOIN units u      ON u.id  = br.unit_id
      JOIN projects p   ON p.id  = u.project_id
      LEFT JOIN towers t    ON t.id  = u.tower_id
      LEFT JOIN users au    ON au.id = br.created_by
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${fromP}::date IS NULL OR br.booking_date >= ${fromP}::date)
        AND (${toP}::date   IS NULL OR br.booking_date <= ${toP}::date)
      ORDER BY br.booking_date DESC, consumer_name ASC
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows, total: result.rows.length });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/tds-status — TDS challan status per consumer
router.get('/tds-status', async (req, res, next) => {
    try {
        const { projectId, financialYear, quarter, status } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const fyP = p(financialYear || null);
        const qP = p(quarter || null);
        const stP = p(status || null);
        const query = `
      SELECT
        c.first_name || ' ' || COALESCE(c.last_name, '') AS consumer_name,
        c.registration_no,
        c.mobile,
        c.id AS consumer_id,
        p.name          AS project_name,
        t.tower_name,
        u.unit_number,
        u.bhk_type,
        br.booking_amount,
        ROUND(br.booking_amount * 0.01, 2)  AS tds_applicable,
        tc.challan_number,
        tc.challan_date,
        tc.amount       AS tds_paid,
        tc.financial_year,
        tc.quarter,
        tc.status,
        tc.bsr_code,
        tc.bank_name    AS challan_bank
      FROM tds_assignments ta
      JOIN tds_challans tc   ON tc.id  = ta.challan_id
      JOIN consumers c       ON c.id   = ta.consumer_id
      LEFT JOIN LATERAL (
        SELECT unit_id, booking_amount
        FROM booking_records
        WHERE consumer_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) br ON true
      LEFT JOIN units u      ON u.id   = br.unit_id
      LEFT JOIN towers t     ON t.id   = u.tower_id
      LEFT JOIN projects p   ON p.id   = u.project_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
        AND (${fyP}::text   IS NULL OR tc.financial_year = ${fyP}::text)
        AND (${qP}::text    IS NULL OR tc.quarter        = ${qP}::text)
        AND (${stP}::text   IS NULL OR tc.status         = ${stP}::text)
      ORDER BY tc.challan_date DESC, consumer_name ASC
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows, total: result.rows.length });
    }
    catch (err) {
        next(err);
    }
});
// ─── Customer Forecasting ────────────────────────────────────────────────────
router.get('/customer-forecasting', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const pid = projectId || null;
        const brSubquery = `(
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id
        FROM booking_records
        WHERE unit_id IS NOT NULL
        ORDER BY consumer_id, created_at DESC
      )`;
        const monthlyQuery = `
      SELECT
        TO_CHAR(d.due_date, 'Mon YYYY') AS month_label,
        DATE_TRUNC('month', d.due_date) AS month_date,
        COUNT(DISTINCT d.consumer_id)::int AS consumer_count,
        COUNT(d.id)::int AS installment_count,
        COALESCE(SUM(d.amount_due_inr), 0) AS projected_amount,
        COALESCE(SUM(CASE WHEN d.status = 'demanded' THEN d.amount_due_inr ELSE 0 END), 0) AS demanded_amount,
        COALESCE(SUM(CASE WHEN d.status = 'pending'  THEN d.amount_due_inr ELSE 0 END), 0) AS pending_amount
      FROM demands d
      JOIN consumers c ON c.id = d.consumer_id
      JOIN ${brSubquery} br ON br.consumer_id = c.id
      JOIN units u   ON u.id  = br.unit_id
      JOIN projects p ON p.id = u.project_id
      WHERE d.due_date >= CURRENT_DATE
        AND ($1::uuid IS NULL OR p.id = $1::uuid)
      GROUP BY TO_CHAR(d.due_date, 'Mon YYYY'), DATE_TRUNC('month', d.due_date)
      ORDER BY DATE_TRUNC('month', d.due_date)
    `;
        const detailQuery = `
      SELECT
        TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')) AS consumer_name,
        c.registration_no,
        c.mobile,
        p.name AS project_name,
        COALESCE(t.tower_name, '—') AS tower_name,
        u.unit_number,
        d.demand_type AS installment_name,
        d.installment_index,
        d.due_date,
        d.amount_due_inr AS amount,
        COALESCE(d.cgst_amount, 0) AS cgst_amount,
        COALESCE(d.sgst_amount, 0) AS sgst_amount,
        d.amount_due_inr AS total_with_gst,
        d.status
      FROM demands d
      JOIN consumers c ON c.id = d.consumer_id
      JOIN ${brSubquery} br ON br.consumer_id = c.id
      JOIN units u   ON u.id  = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      JOIN projects p ON p.id = u.project_id
      WHERE d.due_date >= CURRENT_DATE
        AND ($1::uuid IS NULL OR p.id = $1::uuid)
      ORDER BY d.due_date ASC, c.registration_no ASC, d.installment_index ASC
    `;
        const [monthlyResult, detailResult] = await Promise.all([
            pool_1.db.query(monthlyQuery, [pid]),
            pool_1.db.query(detailQuery, [pid]),
        ]);
        const monthly = monthlyResult.rows;
        const detail = detailResult.rows;
        const totals = monthly.reduce((acc, r) => ({
            projected: acc.projected + parseFloat(r.projected_amount || 0),
            demanded: acc.demanded + parseFloat(r.demanded_amount || 0),
            pending: acc.pending + parseFloat(r.pending_amount || 0),
            months: acc.months + 1,
        }), { projected: 0, demanded: 0, pending: 0, months: 0 });
        res.json({ success: true, monthly, detail, totals });
    }
    catch (err) {
        next(err);
    }
});
// ─── Endpoint: Conveyance Deed Date ───────────────────────────────────────────
router.get('/conveyance-deed-date', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const query = `
      SELECT
        TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')) AS consumer_name,
        c.registration_no,
        c.mobile,
        p.name                  AS project_name,
        COALESCE(t.tower_name, '—') AS tower_name,
        u.unit_number,
        rd.appointment_date,
        rd.registry_date,
        rd.conveyance_deed_no   AS deed_no,
        rd.stamp_duty_amount,
        rd.status,
        rd.remarks,
        u.registry_date         AS unit_registry_date,
        u.registry_status
      FROM registry_details rd
      LEFT JOIN consumers c ON c.id = rd.consumer_id
      LEFT JOIN units u     ON u.id = rd.unit_id
      LEFT JOIN towers t    ON t.id = u.tower_id
      LEFT JOIN projects p  ON p.id = u.project_id
      WHERE (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
      ORDER BY rd.appointment_date DESC NULLS LAST, consumer_name ASC NULLS LAST
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows, total: result.rows.length });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map