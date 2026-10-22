"use strict";
/**
 * Reports Routes - Module G (Analytics & Reporting)
 * Dashboards, campaign ROI, custom reports, analytics
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const report_input_js_1 = require("../utils/report-input.js");
const input_js_1 = require("../utils/input.js");
const reports_dues_js_1 = __importDefault(require("./reports-dues.js"));
const reports_ageing_js_1 = __importDefault(require("./reports-ageing.js"));
const reports_cash_js_1 = __importDefault(require("./reports-cash.js"));
const reports_applicant_js_1 = __importDefault(require("./reports-applicant.js"));
const report_ledger_js_1 = require("../utils/report-ledger.js");
const router = (0, express_1.Router)();
// Every filter is checked once here (400 for a bad id, date, number or a list / object where one value is expected)
router.use((req, res, next) => {
    if (req.get('x-count-queries') !== '1')
        return next();
    const store = { n: 0 }, json = res.json.bind(res);
    res.json = (b) => { res.setHeader('X-Db-Queries', String(store.n)); return json(b); };
    pool_1.queryCount.run(store, next);
});
router.use(report_input_js_1.checkQuery);
// Money reports (dues, ageing, collection, bank) live in their own files and share one ledger (utils/report-ledger.ts)
router.use(reports_dues_js_1.default, reports_ageing_js_1.default, reports_cash_js_1.default, reports_applicant_js_1.default);
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
// POST /api/reports/custom-report - Save a report definition (name, type, optional project, filters, columns)
router.post('/custom-report', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(b.name, 'name', 255, false);
        const reportType = (0, input_js_1.text)(b.reportType, 'reportType', 100, true);
        const projectId = (0, input_js_1.has)(b.projectId) ? (0, input_js_1.uuid)(b.projectId, 'projectId') : null;
        if (projectId && !(await pool_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw (0, input_js_1.bad)('Project not found', 404);
        if ((0, input_js_1.has)(b.filters) && (typeof b.filters !== 'object' || Array.isArray(b.filters) || JSON.stringify(b.filters).length > 5000))
            throw (0, input_js_1.bad)('filters must be an object');
        if ((0, input_js_1.has)(b.columns) && (!Array.isArray(b.columns) || b.columns.length > 60 || b.columns.some((c) => typeof c !== 'string' || !c.trim() || c.length > 100)))
            throw (0, input_js_1.bad)('columns must be a list of up to 60 names');
        const result = await pool_1.db.query(`INSERT INTO custom_reports (name, project_id, report_type, filter_criteria, columns_selected, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, report_type, created_at`, [name, projectId, reportType, JSON.stringify(b.filters || {}), b.columns || [], req.userId]);
        res.status(201).json({ success: true, data: result.rows[0], message: 'Custom report created successfully' });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/reports/custom-reports - The report definitions saved by this user (all of them for a super admin), optionally of one project
router.get('/custom-reports', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const result = await pool_1.db.query(`SELECT id, name, project_id, report_type, report_type AS type, columns_selected, created_at
         FROM custom_reports
        WHERE ($1::uuid IS NULL OR project_id = $1::uuid) AND ($2::boolean OR created_by_user_id = $3::uuid)
        ORDER BY created_at DESC LIMIT 200`, [projectId || null, req.userRole === 'super_admin', req.userId]);
        res.json({ success: true, data: result.rows });
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
        COUNT(*)::int as total_units,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END)::int as available,
        COUNT(CASE WHEN status::text IN ('application_received','draw_pending','booked') THEN 1 END)::int as booked,
        COUNT(CASE WHEN status::text IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN 1 END)::int as allotted,
        COUNT(CASE WHEN registry_status = true THEN 1 END)::int as registry,
        COUNT(CASE WHEN mortgage_status = true THEN 1 END)::int as mortgage,
        COUNT(CASE WHEN status::text IN ('locked','held') THEN 1 END)::int as hold,
        COUNT(CASE WHEN status::text = 'temp_surrender' THEN 1 END)::int as temp_surrender,
        COALESCE(SUM(super_area_sqft), 0)::float as total_area
       FROM units WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]);
        const s = summary.rows[0];
        s.unmapped_count = s.total_units - (s.available + s.booked + s.allotted + s.hold + s.temp_surrender);
        const units = await pool_1.db.query(`SELECT u.id, u.unit_number, u.tower_id, u.floor, u.bhk_type, u.carpet_area_sqft, u.super_area_sqft, u.status, u.registry_status, u.mortgage_status, u.hold_status,
              t.tower_name, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name, b.name AS broker_name, o.consumer_id
         FROM units u
         JOIN towers t ON u.tower_id = t.id
         LEFT JOIN LATERAL (SELECT a.consumer_id FROM allocations a WHERE a.unit_id = u.id AND a.status = 'allotted' ORDER BY a.allocated_date DESC NULLS LAST LIMIT 1) o ON TRUE
         LEFT JOIN consumers c ON c.id = o.consumer_id
         LEFT JOIN LATERAL (SELECT bk.main_broker_id AS broker_id FROM booking_records bk WHERE bk.unit_id = u.id AND bk.consumer_id = o.consumer_id AND bk.status <> 'cancelled' ORDER BY bk.created_at DESC LIMIT 1) br ON TRUE
         LEFT JOIN brokers b ON br.broker_id = b.id
        WHERE ($1::uuid IS NULL OR u.project_id = $1::uuid)
        ORDER BY t.tower_name, u.floor, u.unit_number`, [pid]);
        res.json({ success: true, data: { summary: s, units: units.rows } });
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
         COALESCE(br.plc_amount, 0) AS plc_amount,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name, 'Available') AS consumer_name
       FROM units u
       JOIN towers t   ON t.id  = u.tower_id
       JOIN projects p ON p.id  = u.project_id
       LEFT JOIN LATERAL (SELECT b.plc_amount, b.consumer_id FROM booking_records b WHERE b.unit_id = u.id AND b.status IN ('complete','pending_payment','active') ORDER BY b.created_at DESC LIMIT 1) br ON TRUE
       LEFT JOIN consumers c   ON c.id = br.consumer_id
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
// GET /api/reports/inventory-details - Inventory Details report (Project/Tower/Unit Type/Matrix)
// SOLD = status != 'available'. UNSOLD = status = 'available'.
// Sold breakdown buckets reuse the canonical STATUS_MAP from units.ts (not modified here):
//   booked: application_received, draw_pending, booked
//   allotted: allotted, agreement_signed, under_construction, oc_received, possession_handed_over
//   hold: locked, held
//   temp_surrender: temp_surrender
// Non-Salable is a literal 0 (no schema flag exists); Salable = Total. Both intentional.
// Average Rate = AVG(booking_records.basic_rate_inr_sqft) over the sold subset, using the
// most recent non-cancelled booking_records row per unit (existing codebase dedup convention).
router.get('/inventory-details', async (req, res, next) => {
    try {
        const { projectId, companyId, groupBy, view } = req.query;
        const gb = (0, report_input_js_1.pick)(groupBy, 'groupBy', ['project', 'tower', 'bhk_type', 'matrix', 'project_bhk_type'], 'project');
        const vw = (0, report_input_js_1.pick)(view, 'view', ['summary', 'details'], 'summary');
        const pid = projectId || null;
        const cid = companyId || null;
        const BOOKED = `u.status IN ('application_received','draw_pending','booked')`;
        const ALLOTTED = `u.status IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over')`;
        const HOLD = `u.status IN ('locked','held')`;
        const TEMP_SURRENDER = `u.status = 'temp_surrender'`;
        const brJoin = `
      LEFT JOIN LATERAL (
        SELECT b.basic_rate_inr_sqft
        FROM booking_records b
        WHERE b.unit_id = u.id AND b.status != 'cancelled'
        ORDER BY b.created_at DESC
        LIMIT 1
      ) br ON true`;
        const aggCols = `
        COUNT(u.id) AS total_units,
        COALESCE(SUM(u.carpet_area_sqft), 0) AS total_area,
        COUNT(u.id) FILTER (WHERE u.status != 'available') AS sold_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status != 'available'), 0) AS sold_area,
        COUNT(u.id) FILTER (WHERE u.status = 'available') AS unsold_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status = 'available'), 0) AS unsold_area,
        COUNT(u.id) FILTER (WHERE ${BOOKED}) AS booked_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${BOOKED}), 0) AS booked_area,
        COUNT(u.id) FILTER (WHERE ${ALLOTTED}) AS allotted_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${ALLOTTED}), 0) AS allotted_area,
        COUNT(u.id) FILTER (WHERE ${HOLD}) AS hold_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${HOLD}), 0) AS hold_area,
        COUNT(u.id) FILTER (WHERE ${TEMP_SURRENDER}) AS temp_surrender_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${TEMP_SURRENDER}), 0) AS temp_surrender_area,
        ROUND(AVG(br.basic_rate_inr_sqft) FILTER (WHERE u.status != 'available')::numeric, 2) AS avg_rate`;
        let sql = '';
        if (gb === 'project') {
            sql = `
        SELECT p.id AS group_id, p.name AS group_name,
          ${aggCols}
        FROM projects p
        LEFT JOIN units u ON u.project_id = p.id
        ${brJoin}
        WHERE ($1::uuid IS NULL OR p.id = $1::uuid)
        GROUP BY p.id, p.name
        ORDER BY p.name`;
        }
        else if (gb === 'tower') {
            sql = `
        SELECT t.id AS group_id, t.tower_name AS group_name, p.name AS project_name,
          ${aggCols}
        FROM towers t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN units u ON u.tower_id = t.id
        ${brJoin}
        WHERE t.deleted_at IS NULL
          AND ($1::uuid IS NULL OR t.project_id = $1::uuid)
        GROUP BY t.id, t.tower_name, p.name
        ORDER BY p.name, t.tower_name`;
        }
        else if (gb === 'bhk_type') {
            sql = `
        SELECT u.bhk_type AS group_id, u.bhk_type AS group_name,
          ${aggCols}
        FROM units u
        JOIN towers t ON t.id = u.tower_id
        ${brJoin}
        WHERE t.deleted_at IS NULL
          AND ($1::uuid IS NULL OR u.project_id = $1::uuid)
        GROUP BY u.bhk_type
        ORDER BY u.bhk_type`;
        }
        else if (gb === 'project_bhk_type') {
            // Unit Type Wise Unit Status (no legacy screenshot — inferred report, confirmed via audit).
            // Row grain is the compound key (project_id, bhk_type), never bhk_type alone: bhk_type strings
            // are project-specific (e.g. "Type-A (3 BHK)" only exists in one project) and merging them
            // across projects would silently combine unrelated unit types under a shared label. companyId
            // is an optional additional scope, consistent with Stock Report/Summary Report's convention.
            sql = `
        SELECT pr.id AS project_id, pr.name AS project_name, u.bhk_type AS group_id, u.bhk_type AS group_name,
          ${aggCols}
        FROM units u
        JOIN towers t ON t.id = u.tower_id
        JOIN projects pr ON pr.id = u.project_id
        ${brJoin}
        WHERE t.deleted_at IS NULL
          AND ($1::uuid IS NULL OR u.project_id = $1::uuid)
          AND ($2::uuid IS NULL OR pr.company_id = $2::uuid)
        GROUP BY pr.id, pr.name, u.bhk_type
        ORDER BY pr.name, u.bhk_type`;
        }
        else {
            // matrix: tower x unit type, fixed Total/Sold/Unsold shape (LEFT JOIN so empty towers don't vanish)
            sql = `
        SELECT t.id AS tower_id, t.tower_name, u.bhk_type,
          ${aggCols}
        FROM towers t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN units u ON u.tower_id = t.id
        ${brJoin}
        WHERE t.deleted_at IS NULL
          AND ($1::uuid IS NULL OR t.project_id = $1::uuid)
        GROUP BY t.id, t.tower_name, u.bhk_type
        ORDER BY t.tower_name, u.bhk_type`;
        }
        const result = await pool_1.db.query(sql, sql.includes('$2') ? [pid, cid] : [pid]);
        res.json({ success: true, data: result.rows, groupBy: gb, view: vw });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/reports/tower-floor-sales - Tower Floor Sales (a.k.a. Cumulative Sales Report)
// Rows = floor number within a project. Reuses /inventory-details' exact status-bucket
// definitions (read-only reference, not modified) — see comment above that handler.
//   TOTAL STOCK      = COUNT(u.id) unfiltered
//   STOCK HOLD       = u.status IN ('locked','held')
//   OPEN ON DATE     = u.status = 'available' — LIVE STATUS AT QUERY TIME, NOT a true
//                       historical snapshot. unit_status_history exists but only covers
//                       19/34 real units (56%), confirmed unreliable for the rest during
//                       audit — so asOnDate is informational/label-only here, not a real filter.
//   TEMP SURRENDER   = u.status = 'temp_surrender'
//   BALANCE          = TOTAL STOCK - STOCK HOLD - OPEN ON DATE - TEMP SURRENDER
//                       = units with status IN ('application_received','draw_pending','booked',
//                         'allotted','agreement_signed','under_construction','oc_received',
//                         'possession_handed_over') i.e. BOOKED + ALLOTTED (the genuinely sold/
//                         committed stock). This reconciles exactly because `status` is a single
//                         enum column — confirmed against live data (34 units: 31 available,
//                         2 booked, 1 allotted; 31+2+1=34, no gaps/overlaps).
// Sale value / received amount are computed over the BALANCE population (the real sales),
// reusing the exact total_unit_cost expression (verbatim from lines 922-927/982-986) and the
// receipts.status = 'cleared' convention proven earlier this session.
router.get('/tower-floor-sales', async (req, res, next) => {
    try {
        const { projectId, asOnDate } = req.query;
        const pid = projectId || null;
        const HOLD = `u.status IN ('locked','held')`;
        const OPEN = `u.status = 'available'`;
        const TEMP_SURRENDER = `u.status = 'temp_surrender'`;
        const SOLD = `u.status NOT IN ('available','locked','held','temp_surrender')`;
        const brJoin = `
      LEFT JOIN LATERAL (
        SELECT b.consumer_id, b.basic_rate_inr_sqft, b.balcony_charge_amount, b.dealer_adjustment_amount,
               b.company_inaugural_disc, b.plc_amount, b.other_charge_amount
        FROM booking_records b
        WHERE b.unit_id = u.id AND b.status IN ('complete','pending_payment','active')
        ORDER BY b.created_at DESC
        LIMIT 1
      ) br ON true`;
        const unitCostBase = `
      ${(0, report_ledger_js_1.baseCostSql)('br', 'u')}`;
        const totalUnitCostExpr = `(${unitCostBase}
        - COALESCE(br.dealer_adjustment_amount, 0)
        - COALESCE(br.company_inaugural_disc, 0)
        + COALESCE(br.plc_amount, 0)
        + COALESCE(br.other_charge_amount, 0))`;
        const receivedJoin = `
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(r.amount_received_inr), 0) AS received
        FROM receipts r
        JOIN payment_plans pp ON pp.id = r.payment_plan_id
        WHERE pp.unit_id = u.id AND pp.consumer_id = br.consumer_id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE
      ) rcv ON true`;
        const query = `
      SELECT
        u.floor,
        COUNT(u.id) AS total_stock_units,
        COALESCE(SUM(u.carpet_area_sqft), 0) AS total_stock_area,
        COUNT(u.id) FILTER (WHERE ${HOLD}) AS stock_hold_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${HOLD}), 0) AS stock_hold_area,
        COUNT(u.id) FILTER (WHERE ${OPEN}) AS open_on_date_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${OPEN}), 0) AS open_on_date_area,
        COUNT(u.id) FILTER (WHERE ${TEMP_SURRENDER}) AS temp_surrender_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${TEMP_SURRENDER}), 0) AS temp_surrender_area,
        COUNT(u.id) FILTER (WHERE ${SOLD}) AS balance_units,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE ${SOLD}), 0) AS balance_area,
        COALESCE(SUM(${totalUnitCostExpr}) FILTER (WHERE ${SOLD}), 0) AS total_sale_value_inr,
        COALESCE(SUM(rcv.received) FILTER (WHERE ${SOLD}), 0) AS received_amount_inr
      FROM units u
      ${brJoin}
      ${receivedJoin}
      WHERE ($1::uuid IS NULL OR u.project_id = $1::uuid)
      GROUP BY u.floor
      ORDER BY u.floor
    `;
        const result = await pool_1.db.query(query, [pid]);
        const data = result.rows.map((r) => {
            const totalStockArea = parseFloat(r.total_stock_area || 0);
            const stockHoldArea = parseFloat(r.stock_hold_area || 0);
            const balanceArea = parseFloat(r.balance_area || 0);
            const totalSaleValueInr = parseFloat(r.total_sale_value_inr || 0);
            const receivedAmountInr = parseFloat(r.received_amount_inr || 0);
            return {
                floor: r.floor,
                total_stock_units: parseInt(r.total_stock_units, 10),
                total_stock_area: totalStockArea,
                stock_hold_units: parseInt(r.stock_hold_units, 10),
                stock_hold_area: stockHoldArea,
                open_on_date_units: parseInt(r.open_on_date_units, 10),
                open_on_date_area: parseFloat(r.open_on_date_area || 0),
                temp_surrender_units: parseInt(r.temp_surrender_units, 10),
                temp_surrender_area: parseFloat(r.temp_surrender_area || 0),
                balance_units: parseInt(r.balance_units, 10),
                balance_area: balanceArea,
                pct_sold_vs_total_stock: totalStockArea > 0 ? (balanceArea / totalStockArea) * 100 : 0,
                pct_sold_vs_stock_hold: stockHoldArea > 0 ? (balanceArea / stockHoldArea) * 100 : 0,
                total_sale_value_lakhs: totalSaleValueInr / 100000,
                received_amount_lakhs: receivedAmountInr / 100000,
            };
        });
        const totals = data.reduce((acc, r) => ({
            total_stock_units: acc.total_stock_units + r.total_stock_units,
            total_stock_area: acc.total_stock_area + r.total_stock_area,
            stock_hold_units: acc.stock_hold_units + r.stock_hold_units,
            stock_hold_area: acc.stock_hold_area + r.stock_hold_area,
            open_on_date_units: acc.open_on_date_units + r.open_on_date_units,
            open_on_date_area: acc.open_on_date_area + r.open_on_date_area,
            temp_surrender_units: acc.temp_surrender_units + r.temp_surrender_units,
            temp_surrender_area: acc.temp_surrender_area + r.temp_surrender_area,
            balance_units: acc.balance_units + r.balance_units,
            balance_area: acc.balance_area + r.balance_area,
            total_sale_value_lakhs: acc.total_sale_value_lakhs + r.total_sale_value_lakhs,
            received_amount_lakhs: acc.received_amount_lakhs + r.received_amount_lakhs,
        }), {
            total_stock_units: 0, total_stock_area: 0, stock_hold_units: 0, stock_hold_area: 0,
            open_on_date_units: 0, open_on_date_area: 0, temp_surrender_units: 0, temp_surrender_area: 0,
            balance_units: 0, balance_area: 0, total_sale_value_lakhs: 0, received_amount_lakhs: 0,
        });
        totals.pct_sold_vs_total_stock = totals.total_stock_area > 0 ? (totals.balance_area / totals.total_stock_area) * 100 : 0;
        totals.pct_sold_vs_stock_hold = totals.stock_hold_area > 0 ? (totals.balance_area / totals.stock_hold_area) * 100 : 0;
        res.json({
            success: true,
            asOnDate: asOnDate || null,
            asOnDateNote: 'OPEN ON DATE reflects live unit status at report generation time, not a true historical reconstruction as of the selected date.',
            data,
            totals,
        });
    }
    catch (err) {
        next(err);
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
         COALESCE((SELECT COUNT(*) FROM towers t WHERE t.project_id = p.id AND t.deleted_at IS NULL), 0) AS total_towers,
         COALESCE((SELECT COUNT(*) FROM units u WHERE u.project_id = p.id), 0) AS total_units,
         COALESCE((SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status != 'available'), 0) AS sold_units,
         COALESCE((SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'available'), 0) AS unsold_units,
         COALESCE((SELECT SUM(u.carpet_area_sqft) FROM units u WHERE u.project_id = p.id), 0) AS salable_area,
         COALESCE((SELECT SUM(u.carpet_area_sqft) FROM units u WHERE u.project_id = p.id AND u.status != 'available'), 0) AS sold_area,
         COALESCE((SELECT SUM(u.carpet_area_sqft) FROM units u WHERE u.project_id = p.id AND u.status = 'available'), 0) AS balance_area,
         COALESCE((SELECT AVG(u.base_price_inr)  FROM units u WHERE u.project_id = p.id), 0) AS average_bsp,
         COALESCE((SELECT AVG(u.total_price_inr) FROM units u WHERE u.project_id = p.id), 0) AS average_cost,
         COALESCE(
           (SELECT SUM(r.amount_received_inr)
              FROM receipts r JOIN consumers c ON c.id = r.consumer_id LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id
             WHERE COALESCE(pp.project_id, c.project_id) = p.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE),
           0
         )                                                             AS total_collection
       FROM projects p
       ${whereClause}
       ORDER BY p.name`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// ─── Endpoint 6: Other Charges ────────────────────────────────────────────────
router.get('/other-charges', async (req, res, next) => {
    try {
        const { projectId, towerId } = req.query;
        const chargeType = (0, report_input_js_1.pick)(req.query.chargeType, 'chargeType', ['all', 'plc', 'other'], 'all');
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const ctP = p(chargeType || 'all');
        const query = `
      SELECT
        c.registration_no,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
        c.id AS consumer_id,
        u.unit_number, t.tower_name, u.bhk_type,
        p.name AS project_name,
        COALESCE(br.plc_amount,0)           AS booking_plc,
        COALESCE(br.other_charge_amount,0)  AS booking_other,
        COALESCE(br.other_charge_desc,'')   AS other_charge_desc,
        COALESCE((SELECT SUM(plc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IN (SELECT pl.id FROM payment_plans pl WHERE pl.consumer_id = c.id AND pl.unit_id = br.unit_id)),0) AS received_plc,
        COALESCE((SELECT SUM(edc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IN (SELECT pl.id FROM payment_plans pl WHERE pl.consumer_id = c.id AND pl.unit_id = br.unit_id)),0) AS received_edc,
        COALESCE((SELECT SUM(idc_amount)           FROM receipts r WHERE r.consumer_id = c.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IN (SELECT pl.id FROM payment_plans pl WHERE pl.consumer_id = c.id AND pl.unit_id = br.unit_id)),0) AS received_idc,
        COALESCE((SELECT SUM(other_charge_amount)  FROM receipts r WHERE r.consumer_id = c.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IN (SELECT pl.id FROM payment_plans pl WHERE pl.consumer_id = c.id AND pl.unit_id = br.unit_id)),0) AS received_other,
        COALESCE((SELECT SUM(COALESCE(plc_amount,0)+COALESCE(edc_amount,0)+COALESCE(idc_amount,0)+COALESCE(other_charge_amount,0))
          FROM receipts r WHERE r.consumer_id = c.id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IN (SELECT pl.id FROM payment_plans pl WHERE pl.consumer_id = c.id AND pl.unit_id = br.unit_id)),0) AS total_addon_received
      FROM consumers c
      JOIN (
        SELECT DISTINCT ON (consumer_id)
          consumer_id, unit_id, plc_amount, other_charge_amount, other_charge_desc
        FROM booking_records
        WHERE unit_id IS NOT NULL AND status IN ('complete','pending_payment','active')
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
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name)      AS consumer_name,
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
        WHERE unit_id IS NOT NULL AND status IN ('complete','pending_payment','active')
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
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
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
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
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
        ta.amount_assigned AS tds_paid,
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
      WHERE ta.released_at IS NULL
        AND (${pidP}::uuid IS NULL OR p.id = ${pidP}::uuid)
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
// ─── Endpoint: Conveyance Deed Date ───────────────────────────────────────────
router.get('/conveyance-deed-date', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const query = `
      SELECT
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
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
// GET /api/reports/all-applicants - All Applicants Report (per-booking, primary + co-applicants)
router.get('/all-applicants', async (req, res, next) => {
    try {
        const { projectId, bhkType, towerName, registrationNo, firstName, unitNumber, plan, broker } = req.query;
        const whereParams = [];
        const wp = (val) => { whereParams.push(val); return `$${whereParams.length}`; };
        let where = `WHERE br.status IN ('complete','pending_payment','active')`;
        if (projectId)
            where += ` AND p.id = ${wp(projectId)}::uuid`;
        if (bhkType)
            where += ` AND u.bhk_type ILIKE ${wp((0, report_input_js_1.like)(bhkType))}`;
        if (towerName)
            where += ` AND t.tower_name ILIKE ${wp((0, report_input_js_1.like)(towerName))}`;
        if (registrationNo)
            where += ` AND c.registration_no ILIKE ${wp((0, report_input_js_1.like)(registrationNo))}`;
        if (firstName)
            where += ` AND COALESCE(NULLIF(c.first_name, ''), c.name) ILIKE ${wp((0, report_input_js_1.like)(firstName))}`;
        if (unitNumber)
            where += ` AND u.unit_number ILIKE ${wp((0, report_input_js_1.like)(unitNumber))}`;
        if (plan)
            where += ` AND br.selected_plan_name = ${wp(plan)}`;
        if (broker)
            where += ` AND COALESCE(bk.firm_name, bk.name, 'Direct') ILIKE ${wp((0, report_input_js_1.like)(broker))}`;
        const query = `
      SELECT
        c.id,
        c.registration_no,
        COALESCE(NULLIF(c.first_name, ''), c.name) AS first_name,
        c.last_name,
        c.salutation,
        c.father_name,
        c.present_address,
        c.pan_no,
        c.email,
        c.aadhaar_no,
        c.mobile,
        u.unit_number,
        u.bhk_type,
        t.tower_name,
        p.name AS project_name,
        COALESCE(u.unit_number,'')
          || COALESCE(', Floor ' || u.floor::text, '')
          || COALESCE(', ' || t.tower_name, '')                                AS unit_address,
        COALESCE(ca.applicants, '[]'::json)                                    AS co_applicants
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'applicant_number', co.applicant_number,
            'name',             co.name,
            'salutation',       co.salutation,
            'father_name',      co.father_name,
            'address',          co.present_address,
            'pan_no',           co.pan_no,
            'email',            co.email,
            'mobile',           co.mobile,
            'aadhaar_no',       co.aadhaar_no
          ) ORDER BY co.applicant_number
        ) AS applicants
        FROM co_applicants co
        WHERE co.consumer_id = c.id
      ) ca ON true
      ${where}
      ORDER BY p.name ASC, c.registration_no ASC
    `;
        const result = await pool_1.db.query(query, whereParams);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/customer-payment-mismatch - Customer Payment Mismatch Report
// "Mismatch" = a receipt whose money was received but never tied to a specific demand/
// installment — applyWaterfall()'s existing "advance pool" category (demand_id IS NULL
// AND installment_index IS NULL), confirmed via audit as the only evidence-backed,
// data-present definition. Read-only reference to that categorization; applyWaterfall()
// itself is untouched.
// Row grain: one row per consumer (per booking), not per orphan receipt — the legacy
// screenshot shows one row per S.NO with no receipt-amount/count column, so a consumer
// with multiple qualifying orphan receipts (real case: Radhika has 2) still yields one
// row via EXISTS, not one row per receipt.
router.get('/customer-payment-mismatch', async (req, res, next) => {
    try {
        const { projectId, unitType, towerId, registrationNo, firstName, unitAddress } = req.query;
        const whereParams = [];
        const wp = (val) => { whereParams.push(val); return `$${whereParams.length}`; };
        let where = `WHERE br.status IN ('complete','pending_payment','active')
      AND EXISTS (
        SELECT 1 FROM receipts r
        WHERE r.consumer_id = c.id
          AND r.demand_id IS NULL
          AND r.installment_index IS NULL
          AND r.status NOT IN ('cancelled','bounced')
      )`;
        if (projectId)
            where += ` AND p.id = ${wp(projectId)}::uuid`;
        if (unitType)
            where += ` AND u.bhk_type ILIKE ${wp((0, report_input_js_1.like)(unitType))}`;
        if (towerId)
            where += ` AND t.id = ${wp(towerId)}::uuid`;
        if (registrationNo)
            where += ` AND c.registration_no ILIKE ${wp((0, report_input_js_1.like)(registrationNo))}`;
        if (firstName)
            where += ` AND COALESCE(NULLIF(c.first_name, ''), c.name) ILIKE ${wp((0, report_input_js_1.like)(firstName))}`;
        if (unitAddress)
            where += ` AND u.unit_number ILIKE ${wp((0, report_input_js_1.like)(unitAddress))}`;
        const query = `
      SELECT
        c.id,
        c.registration_no,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS name,
        COALESCE(t.tower_name, '—') AS tower_name,
        COALESCE(u.unit_number,'')
          || COALESCE(', Floor ' || u.floor::text, '')
          || COALESCE(', ' || t.tower_name, '')                                AS unit_address,
        COALESCE(bk.firm_name, bk.name, 'Direct')                              AS broker_company,
        br.booking_date                                                       AS registration_date
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      ${where}
      ORDER BY p.name ASC, c.registration_no ASC
    `;
        const result = await pool_1.db.query(query, whereParams);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/booking-record - Booking Record Report
// searchBy (all|project|broker|team) is a UI-organizing concept only — it does not change
// query logic here; the actual filtering is driven by whichever of projectId/brokerId/
// teamId/salesEmployeeId is actually supplied. Team filter is a real, schema-backed 2-hop
// join (sales_employee_id -> team_members.user_id -> team_members.team_id) confirmed via
// audit — teams/team_members tables exist (migration 024) but currently hold 0 rows in this
// database, so this filter is code-correct but unverifiable against real data today.
router.get('/booking-record', async (req, res, next) => {
    try {
        const { projectId, brokerId, salesEmployeeId, teamId, bookingFromDate, bookingToDate } = req.query;
        const whereParams = [];
        const wp = (val) => { whereParams.push(val); return `$${whereParams.length}`; };
        let where = `WHERE 1=1`;
        if (projectId)
            where += ` AND p.id = ${wp(projectId)}::uuid`;
        if (brokerId)
            where += ` AND br.main_broker_id = ${wp(brokerId)}::uuid`;
        if (salesEmployeeId)
            where += ` AND br.sales_employee_id = ${wp(salesEmployeeId)}::uuid`;
        if (teamId)
            where += ` AND br.sales_employee_id IN (SELECT user_id FROM team_members WHERE team_id = ${wp(teamId)}::uuid)`;
        if (bookingFromDate)
            where += ` AND br.booking_date >= ${wp(bookingFromDate)}::date`;
        if (bookingToDate)
            where += ` AND br.booking_date <= ${wp(bookingToDate)}::date`;
        const query = `
      SELECT
        c.registration_no,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.salutation, c.first_name, c.last_name)), ''), c.name) AS name,
        u.unit_number,
        t.tower_name,
        p.name                                                     AS project_name,
        br.booking_date,
        br.booking_amount,
        COALESCE(bk.firm_name, bk.name, 'Direct')                  AS broker_company,
        usr.name                                                   AS sales_employee_name,
        br.status
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      LEFT JOIN users usr ON usr.id = br.sales_employee_id
      ${where}
      ORDER BY p.name ASC, c.registration_no ASC
    `;
        const result = await pool_1.db.query(query, whereParams);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/addon-charges-report — Addon Charge Report (legacy OtherChargesReport.aspx /
// AdminFinalReport.aspx IFMS listing). Distinct from /other-charges (booking_records-based PLC/
// EDC/IDC summary) — this operates on addon_charge_master/consumer_addon_charges, one row per
// consumer per assigned charge. chargeName filters by exact addon_charge_master.charge_name value
// (dropdown populated via /addon-charge-names below), matching legacy's per-type listing (e.g. IFMS).
// registrationNo uses partial ILIKE per this file's established convention. unitAddress filters
// against u.unit_number, matching the "Unit Address" mislabel precedent already established at
// /customer-payment-mismatch (u.unit_number ILIKE, not a real address field — no real address
// field exists on units).
router.get('/addon-charges-report', async (req, res, next) => {
    try {
        const { projectId, towerId, chargeName, registrationNo, unitAddress } = req.query;
        const qp = [];
        const p = (v) => { qp.push(v); return `$${qp.length}`; };
        const pidP = p(projectId || null);
        const tidP = p(towerId || null);
        const cnP = p(chargeName || null);
        const regP = p(registrationNo ? (0, report_input_js_1.like)(registrationNo) : null);
        const uaP = p(unitAddress ? (0, report_input_js_1.like)(unitAddress) : null);
        const query = `
      SELECT
        cac.id,
        c.registration_no,
        c.name,
        u.bhk_type    AS unit_type,
        t.tower_name,
        u.floor,
        COALESCE(u.unit_number,'')
          || COALESCE(', Floor ' || u.floor::text, '')
          || COALESCE(', ' || t.tower_name, '')   AS unit_address,
        cac.charge_name,
        cac.amount
      FROM consumer_addon_charges cac
      JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
      JOIN consumers c ON c.id = cac.consumer_id
      JOIN units u ON u.id = c.allocated_unit_id
      JOIN projects pr ON pr.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      WHERE cac.status = 'active'
        AND (${pidP}::uuid IS NULL OR pr.id = ${pidP}::uuid)
        AND (${tidP}::uuid IS NULL OR t.id = ${tidP}::uuid)
        AND (${cnP}::text IS NULL OR acm.charge_name = ${cnP}::text)
        AND (${regP}::text IS NULL OR c.registration_no ILIKE ${regP}::text)
        AND (${uaP}::text IS NULL OR u.unit_number ILIKE ${uaP}::text)
      ORDER BY t.tower_name NULLS LAST, u.unit_number, cac.charge_name
    `;
        const result = await pool_1.db.query(query, qp);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/addon-charge-names — distinct charge_name values for the Addon Charge Report
// filter dropdown, deduped for display (charge_name is not unique in addon_charge_master).
router.get('/addon-charge-names', async (req, res, next) => {
    try {
        const result = await pool_1.db.query(`SELECT DISTINCT charge_name FROM addon_charge_master ORDER BY charge_name`);
        res.json({ success: true, data: result.rows.map((r) => r.charge_name) });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/bank-ledger-company-banks — active company_bank_accounts for the Company Bank
// filter dropdown on the Bank Ledger report.
router.get('/bank-ledger-company-banks', async (req, res, next) => {
    try {
        const result = await pool_1.db.query(`SELECT id, account_name, bank_name FROM company_bank_accounts WHERE is_active = true ORDER BY bank_name`);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reports/stock-report - Company Wise Stock Report (CompanyWiseStockReport.aspx equivalent).
// Company-level unit-inventory rollup, grouped by company + project. Reuses /inventory-details'
// simple two-way SOLD/UNSOLD split (SOLD = status != 'available', UNSOLD = status = 'available') —
// not /tower-floor-sales' four-way hold/temp_surrender carve-out, since this report has only two
// top-level buckets. Area basis = carpet_area_sqft, same as /inventory-details.
// Sold Stock (Value) reuses the canonical unitCostBase/net_basic_price construct (reports.ts:908-920)
// via LATERAL join to the unit's most recent non-cancelled booking_records row — real and computable
// since sold units have a booking. Unsold Stock (Value) is hardcoded 0: units.base_price_inr and
// units.total_price_inr are 100% NULL on all real data (confirmed via audit) and total_price_inr is
// never read anywhere else in the codebase — there is no per-unit price independent of a booking, so
// no real number can be shown for unbooked units without fabricating one.
router.get('/stock-report', async (req, res, next) => {
    try {
        const { companyId } = req.query;
        const cid = companyId || null;
        const result = await pool_1.db.query(`
      SELECT
        c.id                                                                    AS company_id,
        c.name                                                                  AS company_name,
        pr.id                                                                   AS project_id,
        pr.name                                                                 AS project_name,
        'Sq.Ft.'                                                                AS uom,
        COUNT(u.id)                                                             AS stock_unit,
        COALESCE(SUM(u.carpet_area_sqft), 0)                                    AS stock_area,
        COUNT(u.id) FILTER (WHERE u.status != 'available')                      AS sold_stock_unit,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status != 'available'), 0) AS sold_stock_area,
        COALESCE(SUM(
          CASE WHEN u.status != 'available' THEN
            ${(0, report_ledger_js_1.baseCostSql)('br', 'u')}
            - COALESCE(br.dealer_adjustment_amount, 0)
            - COALESCE(br.company_inaugural_disc, 0)
          ELSE 0 END
        ), 0)                                                                   AS sold_stock_value,
        COUNT(u.id) FILTER (WHERE u.status = 'available')                       AS unsold_stock_unit,
        COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status = 'available'), 0) AS unsold_stock_area,
        0                                                                       AS unsold_stock_value
      FROM projects pr
      JOIN companies c ON c.id = pr.company_id
      JOIN units u ON u.project_id = pr.id
      LEFT JOIN LATERAL (
        SELECT b.basic_rate_inr_sqft, b.balcony_charge_amount, b.dealer_adjustment_amount, b.company_inaugural_disc
        FROM booking_records b
        WHERE b.unit_id = u.id AND b.status != 'cancelled'
        ORDER BY b.created_at DESC
        LIMIT 1
      ) br ON true
      WHERE ($1::uuid IS NULL OR c.id = $1)
      GROUP BY c.id, c.name, pr.id, pr.name
      ORDER BY c.name, pr.name
      `, [cid]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// A refused value (400 / 403 / 404 thrown by the checks) answers as such, not as a server error
router.use((err, _req, res, next) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err)));
exports.default = router;
//# sourceMappingURL=reports.js.map