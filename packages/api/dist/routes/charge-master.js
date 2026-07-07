"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const gst_resolver_js_1 = require("../utils/gst-resolver.js");
const balcony_charge_js_1 = require("../utils/balcony-charge.js");
const router = (0, express_1.Router)();
// GET /api/charge-master/config - list all charge master config rows
router.get('/config', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT id, charge_key, charge_name, rate_value, rate_unit, cap_value,
              is_cap_configurable, updated_at, updated_by
       FROM charge_master_config
       ORDER BY charge_name`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/charge-master/config/:chargeKey - update rate_value for a charge
router.patch('/config/:chargeKey', async (req, res, next) => {
    try {
        const { chargeKey } = req.params;
        const { rate_value, cap_value } = req.body;
        if (rate_value === undefined || rate_value === null || isNaN(parseFloat(rate_value))) {
            return res.status(400).json({ error: 'rate_value is required and must be a number' });
        }
        const existing = await index_js_1.db.query(`SELECT is_cap_configurable FROM charge_master_config WHERE charge_key = $1`, [chargeKey]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Charge config not found' });
        }
        if (cap_value !== undefined && !existing.rows[0].is_cap_configurable) {
            return res.status(400).json({ error: 'cap_value is not configurable for this charge' });
        }
        const result = await index_js_1.db.query(`UPDATE charge_master_config
       SET rate_value = $1, updated_at = NOW(), updated_by = $2
       WHERE charge_key = $3
       RETURNING id, charge_key, charge_name, rate_value, rate_unit, cap_value,
                 is_cap_configurable, updated_at, updated_by`, [parseFloat(rate_value), req.userId, chargeKey]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/charge-master/balcony-preview?projectId=X&balconyAreaSqft=Y&bookingDate=Z
// Read-only estimate for the booking-form preview -- computes the same
// GST-inclusive paise-reconciliation figure as booking.ts's write-point,
// via the shared computeBalconyCharge() function, so the preview can
// never drift from what actually gets stored at booking creation.
router.get('/balcony-preview', async (req, res, next) => {
    try {
        const { projectId, balconyAreaSqft, bookingDate } = req.query;
        if (!projectId || balconyAreaSqft === undefined) {
            return res.status(400).json({ success: false, error: 'projectId and balconyAreaSqft required' });
        }
        const resolveDate = bookingDate || new Date().toISOString().split('T')[0];
        const projRes = await index_js_1.db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
        const projectName = projRes.rows[0]?.name || projectId;
        const configRow = await index_js_1.db.query(`SELECT rate_value, cap_value FROM charge_master_config WHERE charge_key = 'balcony_charge'`);
        const rate = parseFloat(configRow.rows[0]?.rate_value || 0);
        const cap = configRow.rows[0]?.cap_value != null ? parseFloat(configRow.rows[0].cap_value) : null;
        const { cgstPct, sgstPct } = await (0, gst_resolver_js_1.resolveRate)(index_js_1.db, projectId, projectName, 'BASIC', resolveDate);
        const { balconyChargeAmount, balconyCgstAmount, balconySgstAmount } = (0, balcony_charge_js_1.computeBalconyCharge)(parseFloat(balconyAreaSqft), rate, cap, cgstPct, sgstPct);
        res.json({
            success: true,
            data: { balconyChargeAmount, balconyCgstAmount, balconySgstAmount },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=charge-master.js.map