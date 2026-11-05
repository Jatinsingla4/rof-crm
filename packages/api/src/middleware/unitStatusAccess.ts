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

// Typed-UUID protection (plan 8.2): call it inside the transaction after the unit row is locked; the route must have run applyUnitStatusFilter.
export const assertUnitGrant = (req: AuthRequest, unitStatus: string | null | undefined): void => assertUnitGrantFilter(req.unitStatusFilter, unitStatus);
