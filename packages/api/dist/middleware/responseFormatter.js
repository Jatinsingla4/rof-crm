"use strict";
/**
 * Response Formatter Middleware
 * Fixes field name mismatches between backend and frontend
 * Converts units, renames fields, adds computed fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseFormatter = void 0;
const business_date_js_1 = require("../utils/business-date.js");
// ============================================
// UNIT STATUS → COLOR MAPPING
// ============================================
const statusColorMap = {
    'available': 'green',
    'hold': 'yellow',
    'application_received': 'orange',
    'draw_pending': 'orange',
    'allotted': 'blue',
    'agreement_signed': 'blue',
    'under_construction': 'purple',
    'oc_received': 'teal',
    'possession_handed_over': 'grey',
    'cancelled': 'red',
    'surrendered': 'red',
};
// ============================================
// FORMATTER FUNCTIONS
// ============================================
/**
 * Convert sqft to sqm (divide by 10.764)
 */
const sqftToSqm = (sqft) => {
    if (sqft === null || sqft === undefined)
        return null;
    return Math.round((sqft / 10.764) * 100) / 100;
};
/**
 * Format unit response: convert area units, add status color
 */
const formatUnit = (unit) => {
    return {
        ...unit,
        // Convert area fields from sqft to sqm
        area_sqm: sqftToSqm(unit.area_sqft),
        carpet_area_sqm: sqftToSqm(unit.carpet_area_sqft),
        super_area_sqm: sqftToSqm(unit.super_area_sqft),
        // Add status color mapping
        unit_status_color: statusColorMap[unit.status] || 'grey',
    };
};
/**
 * Format consumer response: rename fields, add computed fields
 */
const formatConsumer = (consumer) => {
    const formatted = {
        ...consumer,
        // Rename income_category to category
        category: consumer.income_category || consumer.category,
    };
    // Add payment_pct if total_amount exists
    if (consumer.total_amount && consumer.total_paid !== undefined) {
        formatted.payment_pct = Math.round((consumer.total_paid / consumer.total_amount) * 100);
    }
    return formatted;
};
/**
 * Format allocation response: add computed fields
 */
const formatAllocation = (allocation) => {
    const formatted = { ...allocation };
    // Add forfeiture and refund calculations if cancelled
    if (allocation.status === 'cancelled' && allocation.total_paid) {
        formatted.forfeiture_amount = 25000; // Base forfeiture
        formatted.refund_amount = Math.max(0, allocation.total_paid - formatted.forfeiture_amount);
    }
    // Add payment_pct if total_amount exists
    if (allocation.total_amount && allocation.total_paid !== undefined) {
        formatted.payment_pct = Math.round((allocation.total_paid / allocation.total_amount) * 100);
    }
    return formatted;
};
/**
 * Format demand response: add penal interest if overdue
 */
const formatDemand = (demand) => {
    const formatted = { ...demand };
    // Calculate penal interest if overdue (default rate from utils/penal-rate.ts)
    // Handle both amount_inr and amount_due_inr field names
    const amountInr = demand.amount_inr || demand.amount_due_inr;
    // QA-026/038: no interest figure is made up here any more. This used to charge the WHOLE instalment (amountInr x 15% x days since the due date) on every demand
    // response, ignoring part payments, grace days, the interest start date and the project rate (5,14,000 x 15% x 17 / 365 = 3,591 for an instalment that was paid but 14,000).
    // Interest comes from the one engine (utils/payment-waterfall.ts buildInterestRows) through the interest scheduler, the applicant file and /payments/overdue.
    void amountInr;
    return formatted;
};
/**
 * Format receipt response: standardize amount fields
 */
const formatReceipt = (receipt) => {
    return {
        ...receipt,
        // Ensure receipt has a consistent number format (e.g., REC-2026-001)
        receipt_no: receipt.receipt_no || `REC-${(0, business_date_js_1.businessYear)()}-${receipt.id?.substring(0, 6) || 'XXXX'}`,
    };
};
/**
 * Format document response: add delivery status from webhooks
 */
const formatDocument = (doc) => {
    return {
        ...doc,
        // Populate letter_sent_date from delivery_log if not set
        letter_sent_date: doc.letter_sent_date || doc.sent_at || null,
        // Track delivery status
        delivery_status: doc.delivery_status || 'pending',
    };
};
/**
 * Format communication response: add computed fields
 */
const formatCommunication = (comm) => {
    return {
        ...comm,
        // Add delivery tracking
        delivery_status: comm.delivery_status || 'pending',
        // These would be computed in a real scenario
        is_read: comm.is_read || false,
    };
};
/**
 * Recursively format a response object or array
 */
const formatResponseData = (data, endpoint) => {
    if (!data)
        return data;
    // Handle array responses
    if (Array.isArray(data)) {
        return data.map((item) => formatResponseData(item, endpoint));
    }
    // Handle object responses based on endpoint
    if (typeof data === 'object') {
        // Detect endpoint type and apply specific formatting
        if (endpoint.includes('/units')) {
            return formatUnit(data);
        }
        else if (endpoint.includes('/consumers')) {
            return formatConsumer(data);
        }
        else if (endpoint.includes('/allocations')) {
            return formatAllocation(data);
        }
        else if (endpoint.includes('/payments') && (endpoint.includes('/demands') || data.due_date)) {
            return formatDemand(data);
        }
        else if (endpoint.includes('/payments') && (endpoint.includes('/receipts') || data.receipt_no)) {
            return formatReceipt(data);
        }
        else if (endpoint.includes('/documents')) {
            return formatDocument(data);
        }
        else if (endpoint.includes('/communications')) {
            return formatCommunication(data);
        }
    }
    return data;
};
/**
 * Response Formatter Middleware
 * Intercepts all API responses and applies formatting
 */
const responseFormatter = (req, res, next) => {
    // Override res.json to format responses
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        // Only format successful API responses
        if (data && typeof data === 'object') {
            const endpoint = req.path;
            console.log(`[ResponseFormatter] Endpoint: ${endpoint}, Has data.data: ${!!data.data}`);
            // Format the data array or object
            if (data.data) {
                const formatted = formatResponseData(data.data, endpoint);
                console.log(`[ResponseFormatter] Formatted first item keys:`, Object.keys(formatted[0] || formatted).slice(0, 5));
                data.data = formatted;
            }
            // Ensure standard response envelope
            if (!data.success && !data.error && !data.message) {
                // If no success/error field, assume success
                data.success = res.statusCode >= 200 && res.statusCode < 300;
            }
        }
        return originalJson.call(this, data);
    };
    next();
};
exports.responseFormatter = responseFormatter;
exports.default = exports.responseFormatter;
//# sourceMappingURL=responseFormatter.js.map