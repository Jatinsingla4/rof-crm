"use strict";
/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces role-based permissions across all API routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.hasPermission = exports.BASE_ROLES = exports.SYSTEM_ROLES = void 0;
const rolePermissions = {
    super_admin: {
        consumers: ['view', 'create', 'edit', 'delete'],
        units: ['view', 'create', 'edit', 'delete'],
        allocations: ['view', 'create', 'edit', 'delete'],
        payments: ['view', 'create', 'edit', 'delete'],
        documents: ['view', 'create', 'edit', 'delete'],
        communications: ['view', 'create', 'edit', 'delete'],
        reports: ['view', 'create', 'edit', 'delete'],
        users: ['view', 'create', 'edit', 'delete'],
        broker_setup: ['view', 'create', 'edit', 'delete'],
        inventory_hold: ['view', 'create', 'edit', 'delete'],
        smtp_configs: ['view', 'create', 'edit', 'delete'],
        calling: ['view', 'create', 'edit', 'delete'],
        master_data: ['view', 'create', 'edit', 'delete'],
    },
    project_manager: {
        consumers: ['view', 'create', 'edit'],
        units: ['view', 'create', 'edit'],
        allocations: ['view', 'create', 'edit'],
        payments: ['view', 'create', 'edit'],
        documents: ['view', 'create', 'edit'],
        communications: ['view', 'create', 'edit'],
        reports: ['view'],
        users: ['view'],
        inventory_hold: ['view', 'create', 'edit'],
        master_data: ['view', 'create', 'edit'],
    },
    sales_executive: {
        consumers: ['view', 'create', 'edit'],
        units: ['view'],
        allocations: ['view'],
        payments: ['view'],
        documents: ['view', 'create'],
        communications: ['view', 'create'],
        reports: ['view'],
        users: [],
        inventory_hold: ['view', 'create', 'edit'],
    },
    accounts_finance: {
        consumers: ['view'],
        units: ['view'],
        allocations: ['view'],
        payments: ['view', 'create', 'edit'],
        documents: ['view', 'create'],
        communications: ['view'],
        reports: ['view', 'create'],
        users: [],
        broker_setup: ['view', 'create', 'edit'],
        smtp_configs: ['view', 'create', 'edit'],
        calling: ['view', 'create', 'edit'],
    },
    support_agent: {
        consumers: ['view'],
        units: ['view'],
        allocations: ['view'],
        payments: ['view'],
        documents: ['view'],
        communications: ['view', 'create'],
        reports: [],
        users: [],
    },
    read_only_viewer: {
        consumers: ['view'],
        units: ['view'],
        allocations: ['view'],
        payments: ['view'],
        documents: ['view'],
        communications: ['view'],
        reports: ['view'],
        users: [],
    },
};
exports.SYSTEM_ROLES = Object.keys(rolePermissions);
// A custom role may borrow the API permissions of any system role except super_admin
exports.BASE_ROLES = exports.SYSTEM_ROLES.filter((r) => r !== 'super_admin');
const hasPermission = (role, resource, action) => !!(role && rolePermissions[role]?.[resource]?.includes(action));
exports.hasPermission = hasPermission;
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        const userRole = req.userRole;
        if (!userRole) {
            return res.status(401).json({ error: 'Unauthorized: No role assigned' });
        }
        const permissions = rolePermissions[userRole];
        if (!permissions) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Unknown role: '${userRole}'`,
            });
        }
        const allowed = permissions[resource]?.includes(action);
        if (!allowed) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Role '${userRole}' does not have '${action}' permission on '${resource}'`,
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
//# sourceMappingURL=rbac.js.map