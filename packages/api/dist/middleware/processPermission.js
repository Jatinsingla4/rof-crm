"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireProcess = requireProcess;
const index_js_1 = require("../index.js");
function requireProcess(processName, role) {
    return async (req, res, next) => {
        try {
            // super_admin bypasses all process checks
            if (req.userRole === 'super_admin') {
                return next();
            }
            const userId = req.userId;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const col = role === 'maker' ? 'is_maker' :
                role === 'checker' ? 'is_checker' :
                    'is_approver';
            const result = await index_js_1.db.query(`SELECT ${col} as has_permission
         FROM user_process_permissions
         WHERE user_id = $1 AND process_name = $2`, [userId, processName]);
            if (result.rows[0]?.has_permission !== true) {
                const label = processName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                res.status(403).json({
                    error: 'Permission denied',
                    detail: `You do not have ${role} access for ${label}`,
                });
                return;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
//# sourceMappingURL=processPermission.js.map