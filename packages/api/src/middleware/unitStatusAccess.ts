import { Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { isSuperAdmin } from './superAdmin.js';
import { unitStatusFilterFor, assertUnitGrantFilter } from '../utils/unit-grant.js';

export { UNIT_STATUS_MAP, unitStatusFilterFor, effectiveUnitAccess } from '../utils/unit-grant.js';

export async function applyUnitStatusFilter(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // super_admin sees everything
    if (isSuperAdmin(req)) {
      req.unitStatusFilter = null;
      return next();
    }

    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await db.query(
      `SELECT unit_status_access FROM users WHERE id = $1`,
      [userId]
    );

    req.unitStatusFilter = unitStatusFilterFor(result.rows[0]?.unit_status_access);

    next();
  } catch (err) {
    next(err);
  }
}

// Inventory views other than the list (details, counts, summaries, tower maps, area reports): the filter is loaded and a login with no
// inventory access is refused. A partial grant keeps the views that already follow the list's status rule.
export async function requireInventoryAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await applyUnitStatusFilter(req, res, (err?: any) => {
    if (err) return next(err);
    if (Array.isArray(req.unitStatusFilter) && req.unitStatusFilter.length === 0) {
      res.status(403).json({ error: 'Inventory access is not enabled for your login. Ask a super admin.' });
      return;
    }
    next();
  });
}

// Typed-UUID protection (plan 8.2): call it inside the transaction after the unit row is locked; the route must have run applyUnitStatusFilter.
export const assertUnitGrant = (req: AuthRequest, unitStatus: string | null | undefined): void => assertUnitGrantFilter(req.unitStatusFilter, unitStatus);
