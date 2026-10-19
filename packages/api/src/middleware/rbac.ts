/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces role-based permissions across all API routes
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../index.js';

const rolePermissions: Record<string, Record<string, string[]>> = {
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

export const SYSTEM_ROLES = Object.keys(rolePermissions);
// A custom role may borrow the API permissions of any system role except super_admin
export const BASE_ROLES = SYSTEM_ROLES.filter((r) => r !== 'super_admin');

export const hasPermission = (role: string | undefined, resource: string, action: string) =>
  !!(role && rolePermissions[role]?.[resource]?.includes(action));

export const requirePermission = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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
