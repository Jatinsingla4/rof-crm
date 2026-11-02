"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Broker Setup Routes (Compliance & Tax)
 * TDS and GST rates used when a broker's commission is paid. There are no default rates: a broker without a row cannot be paid a commission until its setup is saved.
 * Only super_admin and accounts_finance reach these routes (rbac 'broker_setup').
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
// GET /api/broker-setup  every broker with its effective TDS / GST setup ('configured' says whether it has its own row)
router.get('/', async (req, res, next) => {
    try {
        const { size, offset } = (0, input_js_1.paging)(req.query, 200, 500);
        const search = (0, input_js_1.qtext)(req.query.search, 'search', 100);
        const params = [];
        let w = `WHERE b.status NOT IN ('rejected')`;
        if (search) {
            params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
            w += ` AND (b.name ILIKE $1 OR b.firm_name ILIKE $1)`;
        }
        const result = await index_js_1.db.query(`SELECT b.id AS broker_id, b.name AS broker_name, b.firm_name, b.status AS broker_status,
              btc.tds_rate_pct, btc.gst_rate_pct,
              COALESCE(btc.is_gst_exempt, false) AS is_gst_exempt, (btc.id IS NOT NULL) AS configured, btc.updated_at
         FROM brokers b LEFT JOIN broker_tax_config btc ON btc.broker_id = b.id
         ${w} ORDER BY b.firm_name NULLS LAST, b.name LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/broker-setup/:brokerId
router.get('/:brokerId', async (req, res, next) => {
    try {
        const brokerId = (0, input_js_1.uuid)(req.params.brokerId, 'Broker id');
        if (!(await index_js_1.db.query(`SELECT 1 FROM brokers WHERE id = $1`, [brokerId])).rows.length)
            return res.status(404).json({ error: 'Broker not found' });
        const result = await index_js_1.db.query(`SELECT * FROM broker_tax_config WHERE broker_id = $1`, [brokerId]);
        if (result.rows.length === 0) {
            return res.json({ success: true, data: { broker_id: brokerId, tds_rate_pct: null, gst_rate_pct: null, is_gst_exempt: false, configured: false } });
        }
        res.json({ success: true, data: { ...result.rows[0], configured: true } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/broker-setup/:brokerId   a rate left out keeps its current value; the first time both rates are needed (there are no defaults)
router.post('/:brokerId', async (req, res, next) => {
    try {
        const brokerId = (0, input_js_1.uuid)(req.params.brokerId, 'Broker id');
        const b = (0, input_js_1.body)(req);
        // the highest GST slab is 28% and the highest ordinary TDS rate 30%; a 99% GST on a commission was once saved
        const tds = (0, input_js_1.has)(b.tdsRatePct) ? (0, input_js_1.num)(b.tdsRatePct, 'TDS rate', 30, 2) : null;
        const gst = (0, input_js_1.has)(b.gstRatePct) ? (0, input_js_1.num)(b.gstRatePct, 'GST rate', 28, 2) : null;
        const exempt = (0, input_js_1.flag)(b.isGstExempt, 'isGstExempt') ?? null;
        if (tds === null && gst === null && exempt === null)
            throw (0, input_js_1.bad)('Send tdsRatePct, gstRatePct or isGstExempt');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const brk = (await c.query(`SELECT status FROM brokers WHERE id = $1`, [brokerId])).rows[0];
            if (!brk)
                throw (0, input_js_1.bad)('Broker not found', 404);
            await (0, input_js_1.lock)(c, 'broker-tax:' + brokerId); // two first saves together: the second sees the first and is logged as an update
            const before = (await c.query(`SELECT tds_rate_pct, gst_rate_pct, is_gst_exempt FROM broker_tax_config WHERE broker_id = $1 FOR UPDATE`, [brokerId])).rows[0];
            if (!before && (tds === null || gst === null))
                throw (0, input_js_1.bad)('This broker has no tax setup yet: send both tdsRatePct and gstRatePct');
            const row = (await c.query(`INSERT INTO broker_tax_config (broker_id, tds_rate_pct, gst_rate_pct, is_gst_exempt, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, false), $5)
         ON CONFLICT (broker_id) DO UPDATE SET
           tds_rate_pct = COALESCE($2, broker_tax_config.tds_rate_pct),
           gst_rate_pct = COALESCE($3, broker_tax_config.gst_rate_pct),
           is_gst_exempt = COALESCE($4, broker_tax_config.is_gst_exempt),
           updated_at = NOW(), updated_by = $5
         RETURNING *`, [brokerId, tds, gst, exempt, req.userId])).rows[0];
            return { before, row };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, out.before ? 'update' : 'create', 'broker_tax_config', out.row.id, out.before, { tds_rate_pct: out.row.tds_rate_pct, gst_rate_pct: out.row.gst_rate_pct, is_gst_exempt: out.row.is_gst_exempt });
        res.json({ success: true, data: out.row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=broker_setup.js.map