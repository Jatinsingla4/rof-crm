/**
 * Audit Logger Middleware
 * Logs all create/update/delete operations to audit_logs table
 */
export const logAudit = async (db, userId, action, resourceType, resourceId, previousValues, newValues) => {
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
//# sourceMappingURL=auditLogger.js.map