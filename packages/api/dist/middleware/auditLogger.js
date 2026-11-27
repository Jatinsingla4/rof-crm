"use strict";
/**
 * Audit Logger Middleware
 * Logs all create/update/delete operations to audit_logs table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = exports.auditChange = exports.maskSecrets = void 0;
// Bank account numbers and identity numbers (PAN, Aadhaar, passport) are kept to their last four characters in the log (QA-027). Applied to every entry, at any depth, so the generic
// autoAudit (which logs the whole response) cannot store one in clear. Masking a value that is already masked changes nothing.
const MASKED_KEYS = ['account_number', 'bank_account_no', 'pan_no', 'aadhaar_no', 'passport_no'];
const maskSecrets = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 4)
        return o;
    if (Array.isArray(o))
        return o.map((x) => (0, exports.maskSecrets)(x, depth + 1));
    const c = { ...o };
    for (const k of Object.keys(c)) {
        if (MASKED_KEYS.includes(k) && typeof c[k] === 'string' && c[k])
            c[k] = 'XXXX' + c[k].slice(-4);
        else if (c[k] && typeof c[k] === 'object')
            c[k] = (0, exports.maskSecrets)(c[k], depth + 1);
    }
    return c;
};
exports.maskSecrets = maskSecrets;
// Logs one change and tells the generic autoAudit middleware not to log the same request again
const auditChange = (db, req, res, action, resourceType, resourceId, previousValues, newValues) => {
    res.locals.auditLogged = true;
    return (0, exports.logAudit)(db, req.userId || null, action, resourceType, resourceId, (0, exports.maskSecrets)(previousValues), (0, exports.maskSecrets)(newValues));
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
            previousValues ? JSON.stringify((0, exports.maskSecrets)(previousValues)) : null,
            newValues ? JSON.stringify((0, exports.maskSecrets)(newValues)) : null
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