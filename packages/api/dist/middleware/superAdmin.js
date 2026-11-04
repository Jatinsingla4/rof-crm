"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.isSuperAdmin = void 0;
const isSuperAdmin = (req) => req.userRole === 'super_admin' && req.roleName === 'super_admin';
exports.isSuperAdmin = isSuperAdmin;
const requireSuperAdmin = (req, res, next) => (0, exports.isSuperAdmin)(req) ? next() : res.status(403).json({ error: 'Only super_admin can do this' });
exports.requireSuperAdmin = requireSuperAdmin;
//# sourceMappingURL=superAdmin.js.map