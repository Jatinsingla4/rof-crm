"use strict";
/**
 * Document Field Write-back Engine — Phase 3/4
 *
 * After a document edit is saved to document_field_overrides, this module
 * propagates the change back to the authoritative source table so the live
 * record is kept in sync with the document.
 *
 * Write-back is BEST-EFFORT: if a write-back fails (e.g. no matching row),
 * the error is returned in the result and the caller decides whether to
 * surface it. The override in document_field_overrides is always saved first
 * and is the source of truth for document rendering.
 *
 * Field key categories handled here:
 *   Phase 3a — Consumer contact fields   (consumers table)
 *   Phase 3b — Receipt fields             (receipts table)
 *   Phase 3c — Demand row fields          (demands table, indexed)
 *   Phase 3d — Booking record fields      (booking_records table)
 *   Phase 3e — Unit fields                (units table)
 *   Phase 4a — Name composite             (consumers first_name + last_name)
 *   Phase 4b — Address composite          (consumers present_address)
 *   Projects  — rera_number, tcp_licence, location (projects table)
 *   Phase 5  — Aadhaar (consumers.aadhaar_no + consumers.aadhaar_hash)
 *
 * NOT handled here (document override only):
 *   Computed/cascade fields (amountInWords, grandTotal, etc.)
 *   Company constants (companyGstin, companyCin)
 *   Display-only labels (installmentName_{n}, chargeType_{n})
 *   Fields with no DB column (fatherName, landlineNo, projectSector, hareraDate, etc.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.writebackField = writebackField;
const crypto_1 = require("crypto");
const document_recalc_js_1 = require("./document-recalc.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Parses display date strings to ISO 8601 (YYYY-MM-DD).
 * Handles: "02/05/2026", "02 May 2026", "2026-05-02"
 */
function parseToISODate(v) {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    // dd/mm/yyyy
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy)
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // dd MMM yyyy (e.g. "02 May 2026")
    const MONTHS = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const mdy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (mdy) {
        const m = MONTHS[mdy[2].toLowerCase().slice(0, 3)];
        if (m)
            return `${mdy[3]}-${m}-${mdy[1].padStart(2, '0')}`;
    }
    return null;
}
/**
 * Strips currency symbols, commas, and whitespace and returns a number.
 * Returns null if the result is not a finite number.
 */
function parseAmount(v) {
    const cleaned = v.replace(/[₹,\s]/g, '').trim();
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : null;
}
/**
 * Looks up the unit_id for a consumer via their most-recent booking record.
 */
async function getUnitId(consumerId, client) {
    const res = await client.query(`SELECT unit_id FROM booking_records
     WHERE consumer_id = $1 AND unit_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`, [consumerId]);
    return res.rows[0]?.unit_id ?? null;
}
/**
 * Looks up the project_id and selected_plan_name for a consumer.
 */
async function getBookingPlanInfo(consumerId, client) {
    const res = await client.query(`SELECT project_id, selected_plan_name FROM booking_records
     WHERE consumer_id = $1 AND unit_id IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`, [consumerId]);
    return {
        projectId: res.rows[0]?.project_id ?? null,
        planName: res.rows[0]?.selected_plan_name ?? null,
    };
}
const WRITEBACK_MAP = {
    // ─── Phase 3a — Consumer contact/identity ──────────────────────────────────
    consumerMobile: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET mobile = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'mobile' };
    },
    mobile: async (v, ctx, client) => WRITEBACK_MAP.consumerMobile(v, ctx, client),
    consumerEmail: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET email = $1, updated_at = NOW() WHERE id = $2`, [v.trim().toLowerCase(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'email' };
    },
    email: async (v, ctx, client) => WRITEBACK_MAP.consumerEmail(v, ctx, client),
    panNo: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET pan_no = $1, updated_at = NOW() WHERE id = $2`, [v.trim().toUpperCase(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'pan_no' };
    },
    // Phase 5 — Aadhaar: validates 12-digit format, stores plain text in aadhaar_no
    // and SHA-256 hex in aadhaar_hash (same method used in consumers.ts POST handler).
    aadhaarNo: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const cleaned = v.replace(/[\s\-]/g, '').trim();
        if (!/^\d{12}$/.test(cleaned))
            return { written: false, error: `invalid aadhaar: must be 12 digits, got "${cleaned}"` };
        const hash = (0, crypto_1.createHash)('sha256').update(cleaned).digest('hex');
        await client.query(`UPDATE consumers SET aadhaar_no = $1, aadhaar_hash = $2, updated_at = NOW() WHERE id = $3`, [cleaned, hash, ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'aadhaar_no + aadhaar_hash' };
    },
    pinCode: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET present_pin = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'present_pin' };
    },
    nationality: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET nationality = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'nationality' };
    },
    registrationNo: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET registration_no = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'registration_no' };
    },
    customerId: async (v, ctx, client) => WRITEBACK_MAP.registrationNo(v, ctx, client),
    // ─── Phase 3b — Receipt fields ─────────────────────────────────────────────
    receiptDate: async (v, ctx, client) => {
        if (!ctx.referenceId)
            return { written: false, error: 'no reference_id (receipts.id)' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        await client.query(`UPDATE receipts SET received_date = $1, updated_at = NOW() WHERE id = $2`, [iso, ctx.referenceId]);
        return { written: true, table: 'receipts', column: 'received_date' };
    },
    receiptNumber: async (v, ctx, client) => {
        if (!ctx.referenceId)
            return { written: false, error: 'no reference_id (receipts.id)' };
        await client.query(`UPDATE receipts SET receipt_number = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.referenceId]);
        return { written: true, table: 'receipts', column: 'receipt_number' };
    },
    // ─── Phase 3d — Booking record fields ─────────────────────────────────────
    bookingDate: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        await client.query(`UPDATE booking_records SET booking_date = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [iso, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'booking_date' };
    },
    allotmentDate: async (v, ctx, client) => {
        if (!ctx.allocationId && !ctx.consumerId)
            return { written: false, error: 'no allocation context' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        if (ctx.allocationId) {
            await client.query(`UPDATE allocations SET allotment_date = $1, updated_at = NOW() WHERE id = $2`, [iso, ctx.allocationId]);
        }
        else {
            await client.query(`UPDATE allocations SET allotment_date = $1, updated_at = NOW()
         WHERE consumer_id = $2`, [iso, ctx.consumerId]);
        }
        return { written: true, table: 'allocations', column: 'allotment_date' };
    },
    earnestAmount: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const num = parseAmount(v);
        if (num === null)
            return { written: false, error: `invalid amount: ${v}` };
        await client.query(`UPDATE booking_records SET booking_amount = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [num, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'booking_amount' };
    },
    bookingAmount: async (v, ctx, c) => WRITEBACK_MAP.earnestAmount(v, ctx, c),
    bookingAmountValue: async (v, ctx, c) => WRITEBACK_MAP.earnestAmount(v, ctx, c),
    bookingPaymentMode: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE booking_records SET payment_mode = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'payment_mode' };
    },
    bookingPaymentRef: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE booking_records SET payment_ref = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'payment_ref' };
    },
    bookingBankName: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE booking_records SET bank_name = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'bank_name' };
    },
    bookingBankBranch: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE booking_records SET bank_branch = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'bank_branch' };
    },
    chequeDate: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        await client.query(`UPDATE booking_records SET cheque_date = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [iso, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'cheque_date' };
    },
    planName: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE booking_records SET selected_plan_name = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'selected_plan_name' };
    },
    selectedPlanName: async (v, ctx, c) => WRITEBACK_MAP.planName(v, ctx, c),
    interestAmt: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const num = parseAmount(v);
        if (num === null)
            return { written: false, error: `invalid amount: ${v}` };
        await client.query(`UPDATE booking_records SET interest_amount = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [num, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'interest_amount' };
    },
    proposedPossessionDate: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        // Write to booking_records.possession_date (consumer-level authoritative source)
        await client.query(`UPDATE booking_records SET possession_date = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [iso, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'possession_date' };
    },
    proposedCompletionDate: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        await client.query(`UPDATE booking_records SET completion_date = $1
       WHERE consumer_id = $2 AND unit_id IS NOT NULL`, [iso, ctx.consumerId]);
        return { written: true, table: 'booking_records', column: 'completion_date' };
    },
    // ─── Phase 3e — Unit fields ────────────────────────────────────────────────
    balconyArea: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const num = parseAmount(v);
        if (num === null)
            return { written: false, error: `invalid number: ${v}` };
        const unitId = await getUnitId(ctx.consumerId, client);
        if (!unitId)
            return { written: false, error: 'no unit found for consumer' };
        await client.query(`UPDATE units SET balcony_area_sqft = $1, updated_at = NOW() WHERE id = $2`, [num, unitId]);
        return { written: true, table: 'units', column: 'balcony_area_sqft' };
    },
    // carpetArea: prefer allocations.unit_id (direct), fall back to booking_records via consumer
    carpetArea: async (v, ctx, client) => {
        const area = parseAmount(v);
        if (area === null || area <= 0)
            return { written: false, error: `invalid area: ${v}` };
        let unitId = null;
        if (ctx.allocationId) {
            const r = await client.query(`SELECT unit_id FROM allocations WHERE id = $1 AND unit_id IS NOT NULL`, [ctx.allocationId]);
            unitId = r.rows[0]?.unit_id ?? null;
        }
        if (!unitId && ctx.consumerId) {
            unitId = await getUnitId(ctx.consumerId, client);
        }
        if (!unitId)
            return { written: false, error: 'unit not found' };
        await client.query(`UPDATE units SET carpet_area_sqft = $1, updated_at = NOW() WHERE id = $2`, [area, unitId]);
        return { written: true, table: 'units', column: 'carpet_area_sqft' };
    },
    // totalConsideration is assembled from base_price + plc + other at render time;
    // base_price_inr is shared across all consumers on the unit — unsafe to write back.
    // The override in document_field_overrides is the source of truth for rendered value.
    totalConsideration: async () => ({
        written: false,
        error: 'computed field: base_price_inr+plc+other — no single safe DB column; override is source of truth',
    }),
    // ratePerSqft = totalConsideration / carpetArea — fully derived, no DB column
    ratePerSqft: async () => ({
        written: false,
        error: 'computed field: totalConsideration/carpetArea — no DB column',
    }),
    // agreementValue = netBasicPrice + plc + other — fully derived, no DB column
    agreementValue: async () => ({
        written: false,
        error: 'computed field: no DB column',
    }),
    unitNumber: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const unitId = await getUnitId(ctx.consumerId, client);
        if (!unitId)
            return { written: false, error: 'no unit found for consumer' };
        await client.query(`UPDATE units SET unit_number = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), unitId]);
        return { written: true, table: 'units', column: 'unit_number' };
    },
    bhkType: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const unitId = await getUnitId(ctx.consumerId, client);
        if (!unitId)
            return { written: false, error: 'no unit found for consumer' };
        await client.query(`UPDATE units SET bhk_type = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), unitId]);
        return { written: true, table: 'units', column: 'bhk_type' };
    },
    // ─── Projects fields ───────────────────────────────────────────────────────
    projectLocation: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const br = await client.query(`SELECT project_id FROM booking_records
       WHERE consumer_id = $1 AND unit_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`, [ctx.consumerId]);
        if (!br.rows[0]?.project_id)
            return { written: false, error: 'no project found' };
        await client.query(`UPDATE projects SET location = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), br.rows[0].project_id]);
        return { written: true, table: 'projects', column: 'location' };
    },
    reraNo: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const br = await client.query(`SELECT project_id FROM booking_records
       WHERE consumer_id = $1 AND unit_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`, [ctx.consumerId]);
        if (!br.rows[0]?.project_id)
            return { written: false, error: 'no project found' };
        await client.query(`UPDATE projects SET rera_number = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), br.rows[0].project_id]);
        return { written: true, table: 'projects', column: 'rera_number' };
    },
    hareraNo: async (v, ctx, c) => WRITEBACK_MAP.reraNo(v, ctx, c),
    licenseNo: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const br = await client.query(`SELECT project_id FROM booking_records
       WHERE consumer_id = $1 AND unit_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`, [ctx.consumerId]);
        if (!br.rows[0]?.project_id)
            return { written: false, error: 'no project found' };
        await client.query(`UPDATE projects SET tcp_licence = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), br.rows[0].project_id]);
        return { written: true, table: 'projects', column: 'tcp_licence' };
    },
    // ─── Phase 4a — Name composite ─────────────────────────────────────────────
    consumerName: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const parts = v.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        await client.query(`UPDATE consumers SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3`, [firstName, lastName, ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'first_name+last_name' };
    },
    narrativeConsumerName: async (v, ctx, c) => WRITEBACK_MAP.consumerName(v, ctx, c),
    consumerFullName: async (v, ctx, c) => WRITEBACK_MAP.consumerName(v, ctx, c),
    // ─── Phase 4b — Address composite ─────────────────────────────────────────
    consumerAddress: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET present_address = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'present_address' };
    },
    address: async (v, ctx, c) => WRITEBACK_MAP.consumerAddress(v, ctx, c),
    // ─── Phase 4c — ATS/Conveyance Deed fields ─────────────────────────────────
    // Allottee fields (Agreement for Sale buyer)
    allottee_name: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const parts = v.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        await client.query(`UPDATE consumers SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3`, [firstName, lastName, ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'first_name+last_name' };
    },
    allottee_address: async (v, ctx, c) => WRITEBACK_MAP.consumerAddress(v, ctx, c),
    allottee_aadhaar: async (v, ctx, c) => WRITEBACK_MAP.aadhaarNo(v, ctx, c),
    allottee_pan: async (v, ctx, c) => WRITEBACK_MAP.panNo(v, ctx, c),
    allottee_age: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const num = parseInt(v.trim(), 10);
        if (isNaN(num) || num < 0 || num > 150)
            return { written: false, error: `invalid age: ${v}` };
        await client.query(`UPDATE consumers SET age = $1, updated_at = NOW() WHERE id = $2`, [num, ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'age' };
    },
    allottee_relative_name: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET father_name = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'father_name' };
    },
    allottee_relation: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET son_daughter_wife_of = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'son_daughter_wife_of' };
    },
    // Vendee fields (Conveyance Deed buyer/receiver)
    vendee_name: async (v, ctx, c) => WRITEBACK_MAP.allottee_name(v, ctx, c),
    vendee_address: async (v, ctx, c) => WRITEBACK_MAP.consumerAddress(v, ctx, c),
    vendee_aadhaar: async (v, ctx, c) => WRITEBACK_MAP.aadhaarNo(v, ctx, c),
    vendee_pan: async (v, ctx, c) => WRITEBACK_MAP.panNo(v, ctx, c),
    vendee_relative_name: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET father_name = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'father_name' };
    },
    vendee_relation: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        await client.query(`UPDATE consumers SET son_daughter_wife_of = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), ctx.consumerId]);
        return { written: true, table: 'consumers', column: 'son_daughter_wife_of' };
    },
    // Unit/Property fields
    flat_no: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const unitId = await getUnitId(ctx.consumerId, client);
        if (!unitId)
            return { written: false, error: 'no unit found for consumer' };
        await client.query(`UPDATE units SET unit_number = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), unitId]);
        return { written: true, table: 'units', column: 'unit_number' };
    },
    property_no: async (v, ctx, c) => WRITEBACK_MAP.flat_no(v, ctx, c),
    carpet_area: async (v, ctx, c) => WRITEBACK_MAP.carpetArea(v, ctx, c),
    balcony_area: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        let unitId = null;
        if (ctx.allocationId) {
            const r = await client.query(`SELECT unit_id FROM allocations WHERE id = $1 AND unit_id IS NOT NULL`, [ctx.allocationId]);
            unitId = r.rows[0]?.unit_id ?? null;
        }
        if (!unitId && ctx.consumerId) {
            unitId = await getUnitId(ctx.consumerId, client);
        }
        if (!unitId)
            return { written: false, error: 'unit not found' };
        const area = parseAmount(v);
        if (area === null)
            return { written: false, error: `invalid area: ${v}` };
        await client.query(`UPDATE units SET balcony_area_sqft = $1, updated_at = NOW() WHERE id = $2`, [area, unitId]);
        return { written: true, table: 'units', column: 'balcony_area_sqft' };
    },
    parking_no: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const unitId = await getUnitId(ctx.consumerId, client);
        if (!unitId)
            return { written: false, error: 'no unit found for consumer' };
        await client.query(`UPDATE units SET parking_number = $1, updated_at = NOW() WHERE id = $2`, [v.trim(), unitId]);
        return { written: true, table: 'units', column: 'parking_number' };
    },
    // Agreement date fields
    agreement_date: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        const r = await client.query(`SELECT id FROM allocations WHERE consumer_id = $1 LIMIT 1`, [ctx.consumerId]);
        if (!r.rows[0])
            return { written: false, error: 'no allocation found' };
        await client.query(`UPDATE allocations SET agreement_date = $1, updated_at = NOW() WHERE id = $2`, [iso, r.rows[0].id]);
        return { written: true, table: 'allocations', column: 'agreement_date' };
    },
    agreement_day: async (v, ctx, c) => WRITEBACK_MAP.agreement_date(v, ctx, c),
    agreement_month: async (v, ctx, c) => WRITEBACK_MAP.agreement_date(v, ctx, c),
    agreement_year: async (v, ctx, c) => WRITEBACK_MAP.agreement_date(v, ctx, c),
    // Conveyance deed date
    conveyance_deed_date: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(v);
        if (!iso)
            return { written: false, error: `invalid date: ${v}` };
        const r = await client.query(`SELECT id FROM allocations WHERE consumer_id = $1 LIMIT 1`, [ctx.consumerId]);
        if (!r.rows[0])
            return { written: false, error: 'no allocation found' };
        await client.query(`UPDATE allocations SET conveyance_deed_date = $1, updated_at = NOW() WHERE id = $2`, [iso, r.rows[0].id]);
        return { written: true, table: 'allocations', column: 'conveyance_deed_date' };
    },
    deed_day: async (v, ctx, c) => WRITEBACK_MAP.conveyance_deed_date(v, ctx, c),
    deed_month: async (v, ctx, c) => WRITEBACK_MAP.conveyance_deed_date(v, ctx, c),
    deed_year: async (v, ctx, c) => WRITEBACK_MAP.conveyance_deed_date(v, ctx, c),
    // Consideration/Price fields
    total_price: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const price = parseAmount(v);
        if (price === null)
            return { written: false, error: `invalid price: ${v}` };
        const r = await client.query(`SELECT id FROM booking_records WHERE consumer_id = $1 LIMIT 1`, [ctx.consumerId]);
        if (!r.rows[0])
            return { written: false, error: 'no booking record found' };
        await client.query(`UPDATE booking_records SET total_price_inr = $1, updated_at = NOW() WHERE id = $2`, [price, r.rows[0].id]);
        return { written: true, table: 'booking_records', column: 'total_price_inr' };
    },
    booking_amount: async (v, ctx, client) => {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const amount = parseAmount(v);
        if (amount === null)
            return { written: false, error: `invalid amount: ${v}` };
        const r = await client.query(`SELECT id FROM booking_records WHERE consumer_id = $1 LIMIT 1`, [ctx.consumerId]);
        if (!r.rows[0])
            return { written: false, error: 'no booking record found' };
        await client.query(`UPDATE booking_records SET booking_amount = $1, updated_at = NOW() WHERE id = $2`, [amount, r.rows[0].id]);
        return { written: true, table: 'booking_records', column: 'booking_amount' };
    },
    consideration: async (v, ctx, c) => WRITEBACK_MAP.total_price(v, ctx, c),
    // Project fields (RERA, License, etc.)
    harera_reg_no: async (v, ctx, c) => WRITEBACK_MAP.reraNo(v, ctx, c),
    license_no: async (v, ctx, c) => WRITEBACK_MAP.licenseNo(v, ctx, c),
    // Computed/read-only fields
    tower_name: async () => ({
        written: false,
        error: 'tower_name is display-only from units table; edits not propagated. Override saved for display only.',
    }),
    floor_no: async () => ({
        written: false,
        error: 'floor_no is display-only; computed from unit details. Override saved for display only.',
    }),
    unit_type: async () => ({
        written: false,
        error: 'unit_type is computed from units table; not independently updatable. Override saved for display only.',
    }),
    project_name: async () => ({
        written: false,
        error: 'project_name is from projects table and should not be edited in document. Override saved for display only.',
    }),
    promoter_name: async () => ({
        written: false,
        error: 'promoter_name is from projects table and should not be edited in document. Override saved for display only.',
    }),
    promoter_cin: async () => ({
        written: false,
        error: 'promoter_cin is from projects table and should not be edited in document. Override saved for display only.',
    }),
    promoter_pan: async () => ({
        written: false,
        error: 'promoter_pan is from projects table and should not be edited in document. Override saved for display only.',
    }),
    promoter_address: async () => ({
        written: false,
        error: 'promoter_address is from projects table and should not be edited in document. Override saved for display only.',
    }),
    village_name: async () => ({
        written: false,
        error: 'village_name is from projects table; edit via project settings. Override saved for display only.',
    }),
    sector_name: async () => ({
        written: false,
        error: 'sector_name is from projects table; edit via project settings. Override saved for display only.',
    }),
    land_owner_name: async () => ({
        written: false,
        error: 'land_owner_name is from projects table; edit via project settings. Override saved for display only.',
    }),
    land_owner_llpin: async () => ({
        written: false,
        error: 'land_owner_llpin is from projects table; edit via project settings. Override saved for display only.',
    }),
    land_owner_pan: async () => ({
        written: false,
        error: 'land_owner_pan is from projects table; edit via project settings. Override saved for display only.',
    }),
    payment_plan_rows: async () => ({
        written: false,
        error: 'payment_plan_rows is computed from demands table. Edit individual demand rows instead.',
    }),
    // Display-only aliases
    allottee_aadhaar_display: async () => ({ written: false }),
    vendee_aadhaar_display: async () => ({ written: false }),
    allottee_pan_display: async () => ({ written: false }),
    vendee_pan_display: async () => ({ written: false }),
};
// ─── Receipt charge-type → DB column map (amountNet write-back) ──────────────
// Columns are hardcoded — NEVER interpolated from user input. No SQL injection risk.
const CHARGE_COLUMN_MAP = {
    'basic': 'amount_received_inr',
    'plc charges': 'plc_amount',
    'plc': 'plc_amount',
    'edc': 'edc_amount',
    'idc': 'idc_amount',
    'interest': 'interest_amount',
    'other': 'other_charge_amount',
    'balcony charge': null, // no independent DB column
    'balcony': null,
};
// Returns the receipts column for a given chargeType label, or null for no-column rows.
// Returns null for empty chargeType (row not found in document) or unrecognised labels.
function getReceiptColumn(chargeType) {
    const key = chargeType.toLowerCase().trim();
    if (!key)
        return null; // empty → row doesn't exist in this document
    if (key in CHARGE_COLUMN_MAP)
        return CHARGE_COLUMN_MAP[key];
    for (const [k, col] of Object.entries(CHARGE_COLUMN_MAP)) {
        if (k && key.includes(k))
            return col;
    }
    return null; // unrecognised charge type — don't guess
}
// ─── Indexed field handler ────────────────────────────────────────────────────
/**
 * Handles field keys with a numeric suffix: dueDate_0, basicAmt_2, rcptNo_1, etc.
 * Returns null if the field key pattern is not recognised.
 */
async function handleIndexedField(fieldKey, value, ctx, client) {
    const match = fieldKey.match(/^(dueDate|basicAmt|basicCgst|basicSgst|scheduleInstallmentName|schedInstallmentName|rcptNo|rcptDate|rcptBank|amountNet|schedDueDate)_(\d+)$/);
    if (!match)
        return null;
    const prefix = match[1];
    const index = parseInt(match[2], 10);
    // ── Demand row fields (indexed by installment_index) ──────────────────────
    if (['basicAmt', 'basicCgst', 'basicSgst', 'dueDate'].includes(prefix)) {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        if (prefix === 'dueDate') {
            const iso = parseToISODate(value);
            if (!iso)
                return { written: false, error: `invalid date: ${value}` };
            await client.query(`UPDATE demands SET due_date = $1, updated_at = NOW()
         WHERE consumer_id = $2 AND installment_index = $3`, [iso, ctx.consumerId, index]);
            return { written: true, table: 'demands', column: 'due_date' };
        }
        const COL_MAP = {
            basicAmt: 'amount_due_inr',
            basicCgst: 'cgst_amount',
            basicSgst: 'sgst_amount',
        };
        const col = COL_MAP[prefix];
        const num = parseAmount(value);
        if (num === null)
            return { written: false, error: `invalid amount: ${value}` };
        await client.query(`UPDATE demands SET ${col} = $1, updated_at = NOW()
       WHERE consumer_id = $2 AND installment_index = $3`, [num, ctx.consumerId, index]);
        return { written: true, table: 'demands', column: col };
    }
    // ── Plan schedule template fields ─────────────────────────────────────────
    // WARNING: plan_schedule_templates are shared across all consumers on the
    // same plan+project. Updating one consumer's document will affect the template
    // for all consumers. Use with caution; logged to audit_logs.
    if (['scheduleInstallmentName', 'schedInstallmentName'].includes(prefix)) {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const info = await getBookingPlanInfo(ctx.consumerId, client);
        if (!info.projectId || !info.planName)
            return { written: false, error: 'no booking plan found for consumer' };
        const instRow = await client.query(`SELECT id FROM plan_schedule_templates
       WHERE project_id = $1 AND plan_name = $2
       ORDER BY installment_index ASC
       LIMIT 1 OFFSET $3`, [info.projectId, info.planName, index]);
        if (!instRow.rows[0])
            return { written: false, error: `schedule row at position ${index} not found` };
        await client.query(`UPDATE plan_schedule_templates
       SET installment_name = $1, updated_at = NOW()
       WHERE id = $2`, [value.trim(), instRow.rows[0].id]);
        return { written: true, table: 'plan_schedule_templates', column: 'installment_name' };
    }
    // ── Receipt row fields (index 0 = booking record; index 1+ = receipts table) ──
    if (prefix === 'rcptNo') {
        if (index === 0)
            return { written: false }; // booking record ref — skip
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const res = await client.query(`SELECT id FROM receipts
       WHERE consumer_id = $1 AND status != 'cancelled'
       ORDER BY received_date ASC, created_at ASC
       LIMIT 1 OFFSET $2`, [ctx.consumerId, index - 1]);
        if (!res.rows[0])
            return { written: false, error: `receipt at index ${index} not found` };
        await client.query(`UPDATE receipts SET receipt_number = $1, updated_at = NOW() WHERE id = $2`, [value.trim(), res.rows[0].id]);
        return { written: true, table: 'receipts', column: 'receipt_number' };
    }
    if (prefix === 'rcptDate') {
        if (index === 0)
            return { written: false }; // booking record — skip
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const iso = parseToISODate(value);
        if (!iso)
            return { written: false, error: `invalid date: ${value}` };
        const res = await client.query(`SELECT id FROM receipts
       WHERE consumer_id = $1 AND status != 'cancelled'
       ORDER BY received_date ASC, created_at ASC
       LIMIT 1 OFFSET $2`, [ctx.consumerId, index - 1]);
        if (!res.rows[0])
            return { written: false, error: `receipt at index ${index} not found` };
        await client.query(`UPDATE receipts SET received_date = $1, updated_at = NOW() WHERE id = $2`, [iso, res.rows[0].id]);
        return { written: true, table: 'receipts', column: 'received_date' };
    }
    if (prefix === 'rcptBank') {
        if (index === 0)
            return { written: false }; // booking record — skip
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const res = await client.query(`SELECT id FROM receipts
       WHERE consumer_id = $1 AND status != 'cancelled'
       ORDER BY received_date ASC, created_at ASC
       LIMIT 1 OFFSET $2`, [ctx.consumerId, index - 1]);
        if (!res.rows[0])
            return { written: false, error: `receipt at index ${index} not found` };
        await client.query(`UPDATE receipts SET bank_name = $1, updated_at = NOW() WHERE id = $2`, [value.trim(), res.rows[0].id]);
        return { written: true, table: 'receipts', column: 'bank_name' };
    }
    // ── amountNet_{n} — net amount per receipt table row ──────────────────────
    // Reads chargeType_{n} from the pre-edit HTML to identify the DB column.
    // ctx.referenceId must be the receipts.id (set for payment_receipt documents).
    if (prefix === 'amountNet') {
        if (!ctx.referenceId)
            return { written: false, error: 'no referenceId for receipt' };
        const amount = parseAmount(value);
        if (amount === null)
            return { written: false, error: `invalid amount: ${value}` };
        // Resolve charge type from the pre-edit HTML passed in context.
        const chargeType = (0, document_recalc_js_1.extractFieldValue)(ctx.currentHtml, `chargeType_${index}`) || '';
        const col = getReceiptColumn(chargeType);
        if (col === null)
            return { written: false, error: `no DB column for charge type: ${chargeType || '(empty)'}` };
        // amount_received_inr is bigint — must be a whole number
        const dbValue = col === 'amount_received_inr' ? Math.round(amount) : amount;
        await client.query(`UPDATE receipts SET ${col} = $1, updated_at = NOW() WHERE id = $2`, [dbValue, ctx.referenceId]);
        return { written: true, table: 'receipts', column: col };
    }
    // ── schedDueDate_{n} — due date for payment schedule row n ───────────────────
    // index is the 0-based loop position in the rendered schedule (sorted by
    // installment_index ASC). We use OFFSET to map loop position → template row,
    // because installment_index starts at 1 (not 0) in practice.
    // plan_schedule_templates is a shared project-level template — updating it
    // affects all consumers on the same plan (same as schedInstallmentName).
    if (prefix === 'schedDueDate') {
        if (!ctx.consumerId)
            return { written: false, error: 'no consumer_id' };
        const newIso = parseToISODate(value);
        if (!newIso)
            return { written: false, error: `invalid date: ${value}` };
        // Get project_id, plan_name, and booking_date in one query
        const brRow = await client.query(`SELECT project_id, selected_plan_name, booking_date
       FROM booking_records
       WHERE consumer_id = $1 AND unit_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`, [ctx.consumerId]);
        if (!brRow.rows[0])
            return { written: false, error: 'no booking record found for consumer' };
        const { project_id: projectId, selected_plan_name: planName, booking_date: bookingDate } = brRow.rows[0];
        if (!projectId || !planName)
            return { written: false, error: 'no project/plan found on booking record' };
        if (!bookingDate)
            return { written: false, error: 'no booking_date on booking record' };
        // Resolve template row by loop position (OFFSET = idx, sorted by installment_index)
        const instRow = await client.query(`SELECT id, installment_name, due_date_offset_days
       FROM plan_schedule_templates
       WHERE project_id = $1 AND plan_name = $2
       ORDER BY installment_index ASC
       LIMIT 1 OFFSET $3`, [projectId, planName, index]);
        if (!instRow.rows[0])
            return { written: false, error: `schedule row at position ${index} not found` };
        const inst = instRow.rows[0];
        // Milestone-linked installments have offset_days=0 or NULL (triggered by construction
        // events, not calendar dates). Reverse-computing an offset makes no semantic sense;
        // the override in document_field_overrides is sufficient for display.
        if (!inst.due_date_offset_days || inst.due_date_offset_days === 0)
            return {
                written: false,
                error: `milestone-linked installment '${inst.installment_name}': offset=0, no date to reverse-compute. Override saved for display only.`,
            };
        // Reverse-compute: new_offset = new_date - booking_date (days)
        const newDate = new Date(newIso);
        const anchor = new Date(bookingDate);
        // Normalise both to UTC midnight so timezone doesn't skew day count
        const newUtc = Date.UTC(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
        const anchorUtc = Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
        const newOffset = Math.round((newUtc - anchorUtc) / 86400000);
        if (newOffset <= 0)
            return {
                written: false,
                error: `new due date must be after booking date (${bookingDate.toISOString().slice(0, 10)})`,
            };
        await client.query(`UPDATE plan_schedule_templates
       SET due_date_offset_days = $1, updated_at = NOW()
       WHERE id = $2`, [newOffset, inst.id]);
        return { written: true, table: 'plan_schedule_templates', column: 'due_date_offset_days' };
    }
    return null;
}
// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Attempts to write a document field edit back to its authoritative source table.
 *
 * @param fieldKey   - The data-field-key from the HTML span (e.g. "consumerMobile")
 * @param value      - The new value as a string (exactly as the user typed it)
 * @param ctx        - Document context (ids needed to locate the source row)
 * @param client     - A pg PoolClient (from db.connect()) for transactional writes
 * @returns WritebackResult — written: false means "no write-back needed" (not an error)
 */
async function writebackField(fieldKey, value, ctx, client) {
    try {
        // 1. Try static map
        if (WRITEBACK_MAP[fieldKey]) {
            return await WRITEBACK_MAP[fieldKey](value, ctx, client);
        }
        // 2. Try indexed field handler
        const indexed = await handleIndexedField(fieldKey, value, ctx, client);
        if (indexed !== null)
            return indexed;
        // 3. Unknown field — document override only, no write-back needed
        return { written: false };
    }
    catch (err) {
        return { written: false, error: err.message };
    }
}
//# sourceMappingURL=document-writeback.js.map