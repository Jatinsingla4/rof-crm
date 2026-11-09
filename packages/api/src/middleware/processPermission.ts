import { Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

export type ProcessName =
  | 'new_applicant'
  | 'edit_applicant'
  | 'unit_shifting'
  | 'applicant_transfer'
  | 'receipt'
  | 'interest_waiver'
  | 'jv_refund_drcr'
  | 'broker_range_entry'
  | 'broker_payment_entry'
  | 'company_rebate'
  | 'credit_allocation';

export type PermissionRole = 'maker' | 'checker' | 'approver';

export function requireProcess(processName: ProcessName, role: PermissionRole) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

      const col =
        role === 'maker'   ? 'is_maker'   :
        role === 'checker' ? 'is_checker' :
                             'is_approver';

      const result = await db.query(
        `SELECT ${col} as has_permission
         FROM user_process_permissions
         WHERE user_id = $1 AND process_name = $2`,
        [userId, processName]
      );

      if (result.rows[0]?.has_permission !== true) {
        const label = processName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        res.status(403).json({
          error: 'Permission denied',
          detail: `You do not have ${role} access for ${label}`,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
