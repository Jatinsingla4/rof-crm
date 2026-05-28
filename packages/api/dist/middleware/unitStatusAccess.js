"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNIT_STATUS_MAP = void 0;
exports.applyUnitStatusFilter = applyUnitStatusFilter;
const index_js_1 = require("../index.js");
// Maps unit_status_access value → allowed DB status values (null = no filter)
exports.UNIT_STATUS_MAP = {
    unit_hold: ['held', 'locked'],
    available: ['available'],
    available_hold: ['available', 'held', 'locked'],
    all: null,
};
async function applyUnitStatusFilter(req, res, next) {
    try {
        // super_admin sees everything
        if (req.userRole === 'super_admin') {
            req.unitStatusFilter = null;
            return next();
        }
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await index_js_1.db.query(`SELECT unit_status_access FROM users WHERE id = $1`, [userId]);
        const access = result.rows[0]?.unit_status_access || 'all';
        req.unitStatusFilter = exports.UNIT_STATUS_MAP[access] ?? null;
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=unitStatusAccess.js.map