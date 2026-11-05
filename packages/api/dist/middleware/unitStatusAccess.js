"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUnitGrant = exports.effectiveUnitAccess = exports.unitStatusFilterFor = exports.UNIT_STATUS_MAP = void 0;
exports.applyUnitStatusFilter = applyUnitStatusFilter;
exports.requireInventoryAccess = requireInventoryAccess;
const index_js_1 = require("../index.js");
const superAdmin_js_1 = require("./superAdmin.js");
const unit_grant_js_1 = require("../utils/unit-grant.js");
var unit_grant_js_2 = require("../utils/unit-grant.js");
Object.defineProperty(exports, "UNIT_STATUS_MAP", { enumerable: true, get: function () { return unit_grant_js_2.UNIT_STATUS_MAP; } });
Object.defineProperty(exports, "unitStatusFilterFor", { enumerable: true, get: function () { return unit_grant_js_2.unitStatusFilterFor; } });
Object.defineProperty(exports, "effectiveUnitAccess", { enumerable: true, get: function () { return unit_grant_js_2.effectiveUnitAccess; } });
async function applyUnitStatusFilter(req, res, next) {
    try {
        // super_admin sees everything
        if ((0, superAdmin_js_1.isSuperAdmin)(req)) {
            req.unitStatusFilter = null;
            return next();
        }
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const result = await index_js_1.db.query(`SELECT unit_status_access FROM users WHERE id = $1`, [userId]);
        req.unitStatusFilter = (0, unit_grant_js_1.unitStatusFilterFor)(result.rows[0]?.unit_status_access);
        next();
    }
    catch (err) {
        next(err);
    }
}
// Inventory views other than the list (details, counts, summaries, tower maps, area reports): the filter is loaded and a login with no
// inventory access is refused. A partial grant keeps the views that already follow the list's status rule.
async function requireInventoryAccess(req, res, next) {
    await applyUnitStatusFilter(req, res, (err) => {
        if (err)
            return next(err);
        if (Array.isArray(req.unitStatusFilter) && req.unitStatusFilter.length === 0) {
            res.status(403).json({ error: 'Inventory access is not enabled for your login. Ask a super admin.' });
            return;
        }
        next();
    });
}
// Typed-UUID protection (plan 8.2): call it inside the transaction after the unit row is locked; the route must have run applyUnitStatusFilter.
const assertUnitGrant = (req, unitStatus) => (0, unit_grant_js_1.assertUnitGrantFilter)(req.unitStatusFilter, unitStatus);
exports.assertUnitGrant = assertUnitGrant;
//# sourceMappingURL=unitStatusAccess.js.map