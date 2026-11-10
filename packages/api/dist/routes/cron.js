"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Jobs started by Vercel Cron (owner decision, scheduler: Vercel Cron is the primary scheduler).
 * Vercel calls the path with `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET environment variable is set; without the secret the job refuses to run.
 * Every job is idempotent: running it twice on the same day changes nothing the second time and writes no second audit row.
 */
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../index.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const allowed = (req) => {
    const secret = process.env.CRON_SECRET;
    if (!secret)
        return false;
    const want = Buffer.from(`Bearer ${secret}`), given = Buffer.from(String(req.headers.authorization || ''));
    return given.length === want.length && (0, node_crypto_1.timingSafeEqual)(given, want);
};
// GET /api/cron/daily-status: stores the demand status that is already true by date (D1: due date reached means demanded) on every plan that has such a demand
router.get('/daily-status', async (req, res, next) => {
    try {
        if (!process.env.CRON_SECRET)
            return res.status(503).json({ error: 'The daily job is not configured: CRON_SECRET is not set' });
        if (!allowed(req))
            return res.status(401).json({ error: 'Unauthorized' });
        const plans = (await index_js_1.db.query(`SELECT DISTINCT d.payment_plan_id, d.consumer_id FROM demands d
        WHERE d.status = 'pending' AND d.due_date IS NOT NULL AND d.due_date <= ${business_date_js_1.SQL_TODAY} AND d.payment_plan_id IS NOT NULL`)).rows;
        let changed = 0;
        for (const p of plans) {
            const c = await index_js_1.db.connect();
            try {
                await c.query('BEGIN');
                await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`receipt-consumer:${p.consumer_id}`]); // the same lock as every money path
                changed += await (0, money_basis_js_1.recomputePlan)(c, p.payment_plan_id, null);
                await c.query('COMMIT');
            }
            catch (e) {
                await c.query('ROLLBACK').catch(() => { });
                throw e;
            }
            finally {
                c.release();
            }
        }
        res.json({ success: true, date: (0, business_date_js_1.businessToday)(), plans: plans.length, demandsUpdated: changed });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=cron.js.map