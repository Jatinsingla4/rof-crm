"use strict";
/**
 * Audit Logger Middleware
 * Logs all create/update/delete operations to audit_logs table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = exports.auditChange = void 0;
// Bank account numbers are kept to their last four digits in the log
const MASKED_KEYS = ['account_number', 'bank_account_no'];
const maskSecrets = (o) => {
    if (!o)
        return o;
    const c = { ...o };
    for (const k of MASKED_KEYS)
        if (typeof c[k] === 'string')
            c[k] = 'XXXX' + c[k].slice(-4);
    return c;
};
// Logs one change and tells the generic autoAudit middleware not to log the same request again
const auditChange = (db, req, res, action, resourceType, resourceId, previousValues, newValues) => {
    res.locals.auditLogged = true;
    return (0, exports.logAudit)(db, req.userId || null, action, resourceType, resourceId, maskSecrets(previousValues), maskSecrets(newValues));
};
exports.auditChange = auditChange;
const logAudit = async (db, userId, action, resourceType, resourceId, previousValues, newValues) => {
    try {
        await db.query(`INSERT INTO audit_logs
       (user_id, action, resource_type, resource_id,
        previous_values, new_values, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`, [
            userId,
            action,
            resourceType,
            resourceId,
            previousValues ? JSON.stringify(previousValues) : null,
            newValues ? JSON.stringify(newValues) : null
        ]);
    }
    catch (error) {
        // Audit logging must NEVER crash the main request
        // Log to console but do not throw
        console.error('Audit log failed:', error);
    }
};
exports.logAudit = logAudit;
//# sourceMappingURL=auditLogger.js.map