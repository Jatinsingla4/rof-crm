import { Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

// Maps unit_status_access value → allowed DB status values (null = no filter)
export const UNIT_STATUS_MAP: Record<string, string[] | null> = {
  none:           [],
  unit_hold:      ['held', 'locked'],
  available:      ['available'],
  available_hold: ['available', 'held', 'locked'],
  all:            null,
};

export async function applyUnitStatusFilter(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    const result = await db.query(
      `SELECT unit_status_access FROM users WHERE id = $1`,
      [userId]
    );

    const access: string = result.rows[0]?.unit_status_access || 'all';
    req.unitStatusFilter = UNIT_STATUS_MAP[access] ?? null;

    next();
  } catch (err) {
    next(err);
  }
}
