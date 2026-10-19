/**
 * Audit Logger Middleware
 * Logs all create/update/delete operations to audit_logs table
 */

import { Pool } from 'pg';

// Bank account numbers are kept to their last four digits in the log
const MASKED_KEYS = ['account_number', 'bank_account_no'];
const maskSecrets = (o?: object) => {
  if (!o) return o;
  const c: Record<string, any> = { ...o };
  for (const k of MASKED_KEYS) if (typeof c[k] === 'string') c[k] = 'XXXX' + c[k].slice(-4);
  return c;
};

// Logs one change and tells the generic autoAudit middleware not to log the same request again
export const auditChange = (
  db: Pick<Pool, 'query'>,
  req: { userId?: string },
  res: { locals: Record<string, any> },
  action: 'create' | 'update' | 'delete',
  resourceType: string,
  resourceId: string,
  previousValues?: object,
  newValues?: object
): Promise<void> => {
  res.locals.auditLogged = true;
  return logAudit(db, req.userId || null, action, resourceType, resourceId, maskSecrets(previousValues), maskSecrets(newValues));
};

export const logAudit = async (
  db: Pick<Pool, 'query'>,
  userId: string | null,
  action: 'create' | 'update' | 'delete' | 'view' | 'login',
  resourceType: string,
  resourceId: string,
  previousValues?: object,
  newValues?: object
): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO audit_logs
       (user_id, action, resource_type, resource_id,
        previous_values, new_values, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        previousValues ? JSON.stringify(previousValues) : null,
        newValues ? JSON.stringify(newValues) : null
      ]
    );
  } catch (error) {
    // Audit logging must NEVER crash the main request
    // Log to console but do not throw
    console.error('Audit log failed:', error);
  }
};
