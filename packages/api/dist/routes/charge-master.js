"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const gst_resolver_js_1 = require("../utils/gst-resolver.js");
const balcony_charge_js_1 = require("../utils/balcony-charge.js");
const project_settings_js_1 = require("../utils/project-settings.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
// Reading is open (the booking form needs the preview); changing a rate needs the master_data permission
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', 'edit'))
        return next();
    res.status(403).json({ error: 'You do not have permission to change charge rates' });
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only a JSON number or a plain digit string with up to 2 decimals counts ("1e2", "0x10", " 5 ", [5], true are refused)
const money = (v) => typeof v === 'number' ? v
    : typeof v === 'string' && /^[0-9]+(\.[0-9]{1,2})?$/.test(v) ? Number(v) : NaN;
const MAX_RATE = 1000000;
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
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/charge-master/config/:chargeKey - update rate_value (and cap_value where the charge allows it)
router.patch('/config/:chargeKey', async (req, res, next) => {
    try {
        const { chargeKey } = req.params;
        if (!/^[a-z0-9_]{1,60}$/.test(chargeKey))
            return res.status(404).json({ error: 'Charge config not found' });
        const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const { rate_value, cap_value } = body;
        const rate = money(rate_value);
        if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) {
            return res.status(400).json({ error: `Rate must be a number from 0 to ${MAX_RATE.toLocaleString('en-IN')}, up to 2 decimals` });
        }
        let cap;
        if (cap_value !== undefined) {
            cap = cap_value === null ? null : money(cap_value);
            if (cap !== null && (!Number.isFinite(cap) || cap < 0 || cap > 1e9)) {
                return res.status(400).json({ error: 'Cap must be a number from 0 to 1,000,000,000, up to 2 decimals' });
            }
        }
        // One transaction with a row lock, so two admins saving together cannot overwrite each other unseen
        const client = await index_js_1.db.connect();
        let prev, upd;
        try {
            await client.query('BEGIN');
            const cur = await client.query(`SELECT * FROM charge_master_config WHERE charge_key = $1 FOR UPDATE`, [chargeKey]);
            if (cur.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Charge config not found' });
            }
            prev = cur.rows[0];
            if (cap !== undefined && !prev.is_cap_configurable) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'cap_value is not configurable for this charge' });
            }
            upd = (await client.query(`UPDATE charge_master_config SET rate_value = $1, cap_value = $2, updated_at = NOW(), updated_by = $3
         WHERE charge_key = $4
         RETURNING id, charge_key, charge_name, rate_value, rate_unit, cap_value, is_cap_configurable, updated_at, updated_by`, [rate, cap === undefined ? prev.cap_value : cap, req.userId, chargeKey])).rows[0];
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'charge_master_config', upd.id, prev, upd);
        res.json({ success: true, data: upd });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/charge-master/balcony-preview?projectId=X&balconyAreaSqft=Y&bookingDate=Z
// Read-only estimate for the booking-form preview -- computes the same
// GST-exclusive/additive figure as booking.ts's write-point, via the
// shared computeBalconyCharge() function, so the preview can never drift
// from what actually gets stored at booking creation.
router.get('/balcony-preview', async (req, res, next) => {
    try {
        const { projectId, balconyAreaSqft, bookingDate } = req.query;
        if (!projectId || balconyAreaSqft === undefined) {
            return res.status(400).json({ success: false, error: 'projectId and balconyAreaSqft required' });
        }
        const area = money(balconyAreaSqft);
        if (typeof projectId !== 'string' || !UUID.test(projectId))
            return res.status(400).json({ success: false, error: 'projectId is not valid' });
        if (!Number.isFinite(area) || area > 100000)
            return res.status(400).json({ success: false, error: 'balconyAreaSqft must be a number from 0 to 100000' });
        if (bookingDate !== undefined) {
            try {
                (0, input_js_1.day)(bookingDate, 'bookingDate');
            }
            catch (e) {
                return res.status(400).json({ success: false, error: e.message });
            }
        }
        const resolveDate = bookingDate || (0, business_date_js_1.businessToday)();
        const projRes = await index_js_1.db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
        if (!projRes.rows.length)
            return res.status(404).json({ success: false, error: 'Project not found' });
        const projectName = projRes.rows[0].name;
        const { rate, cap, maxArea } = await (0, project_settings_js_1.balconyTerms)(index_js_1.db, projectId);
        let cgstPct, sgstPct;
        try {
            ({ cgstPct, sgstPct } = await (0, gst_resolver_js_1.resolveRate)(index_js_1.db, projectId, projectName, 'BASIC', resolveDate));
        }
        catch (e) {
            // A project with no GST mapping is a set-up gap the user can fix, not a server fault
            if (/^No GST mapping found/.test(e?.message))
                return res.status(422).json({ success: false, error: e.message });
            throw e;
        }
        const { balconyChargeAmount, balconyCgstAmount, balconySgstAmount } = (0, balcony_charge_js_1.computeBalconyCharge)(area, rate, cap, cgstPct, sgstPct, maxArea);
        res.json({
            success: true,
            data: { balconyChargeAmount, balconyCgstAmount, balconySgstAmount },
        });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=charge-master.js.map