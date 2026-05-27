/**
 * Broker Setup Routes (Compliance & Tax)
 */
import { Router } from 'express';
import { db } from '../index.js';
const router = Router();
// GET /api/broker-setup
router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(`SELECT btc.*, b.name as broker_name, b.firm_name
       FROM broker_tax_config btc
       JOIN brokers b ON btc.broker_id = b.id`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/broker-setup/:brokerId
router.get('/:brokerId', async (req, res, next) => {
    try {
        const { brokerId } = req.params;
        const result = await db.query(`SELECT * FROM broker_tax_config WHERE broker_id = $1`, [brokerId]);
        if (result.rows.length === 0) {
            // Return default config if none exists
            return res.json({ success: true, data: { broker_id: brokerId, tds_rate_pct: 5.00, gst_rate_pct: 18.00, is_gst_exempt: false } });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// POST or PATCH /api/broker-setup/:brokerId
router.post('/:brokerId', async (req, res, next) => {
    try {
        const { brokerId } = req.params;
        const { tdsRatePct, gstRatePct, isGstExempt } = req.body;
        const result = await db.query(`INSERT INTO broker_tax_config (broker_id, tds_rate_pct, gst_rate_pct, is_gst_exempt, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (broker_id) 
       DO UPDATE SET 
         tds_rate_pct = EXCLUDED.tds_rate_pct,
         gst_rate_pct = EXCLUDED.gst_rate_pct,
         is_gst_exempt = EXCLUDED.is_gst_exempt,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING *`, [brokerId, tdsRatePct ?? 5.00, gstRatePct ?? 18.00, isGstExempt ?? false, req.userId]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=broker_setup.js.map