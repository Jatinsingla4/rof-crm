/**
 * Audit Logger Middleware
 * Logs all create/update/delete operations to audit_logs table
 */

import { Pool } from 'pg';

// Bank account numbers and identity numbers (PAN, Aadhaar, passport) are kept to their last four characters in the log (QA-027). Applied to every entry, at any depth, so the generic
// autoAudit (which logs the whole response) cannot store one in clear. Masking a value that is already masked changes nothing.
const MASKED_KEYS = ['account_number', 'bank_account_no', 'pan_no', 'aadhaar_no', 'passport_no'];
export const maskSecrets = (o?: any, depth = 0): any => {
  if (!o || typeof o !== 'object' || depth > 4) return o;
  if (Array.isArray(o)) return o.map((x) => maskSecrets(x, depth + 1));
  const c: Record<string, any> = { ...o };
  for (const k of Object.keys(c)) {
    if (MASKED_KEYS.includes(k) && typeof c[k] === 'string' && c[k]) c[k] = 'XXXX' + c[k].slice(-4);
    else if (c[k] && typeof c[k] === 'object') c[k] = maskSecrets(c[k], depth + 1);
  }
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
  action: 'create' | 'update' | 'delete' | 'view' | 'login' | 'auth_blocked',
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
        previousValues ? JSON.stringify(maskSecrets(previousValues)) : null,
        newValues ? JSON.stringify(maskSecrets(newValues)) : null
      ]
    );
  } catch (error) {
    // Audit logging must NEVER crash the main request
    // Log to console but do not throw
    console.error('Audit log failed:', error);
  }
};
