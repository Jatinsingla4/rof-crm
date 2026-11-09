"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performSurrender = void 0;
/**
 * Surrender and builder-cancellation routes (mounted at /api/surrender): find the applicant, show the account, surrender / cancel (the unit goes back,
 * demands stop), list, and restore. Every id, date, amount and filter is checked; the ids are checked against each other, not trusted.
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const input_js_1 = require("../utils/input.js");
const broker_js_1 = require("../utils/broker.js");
const applicant_js_1 = require("../utils/applicant.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'This record already exists');
const query = (v, label, max = 100) => {
    if (Array.isArray(v))
        throw (0, input_js_1.bad)(`${label} is not valid`);
    return (0, input_js_1.text)(v, label, max, false);
};
// ── A: GET /api/surrender/consumers?projectId=&registrationNo=&firstName=&unitAddress= ──
router.get('/consumers', async (req, res, next) => {
    try {
        if (!(0, input_js_1.has)(req.query.projectId))
            throw (0, input_js_1.bad)('projectId is required');
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        const registrationNo = query(req.query.registrationNo, 'registrationNo'), firstName = query(req.query.firstName, 'firstName'), unitAddress = query(req.query.unitAddress, 'unitAddress');
        const conditions = ['p.id = $1', "a.status NOT IN ('cancelled','transferred')", "br.status != 'cancelled'"];
        const params = [projectId];
        let idx = 2;
        if (registrationNo) {
            conditions.push(`c.registration_no ILIKE $${idx++}`);
            params.push((0, applicant_js_1.likeOf)(registrationNo));
        }
        if (firstName) {
            conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
            params.push((0, applicant_js_1.likeOf)(firstName));
            idx++;
        }
        if (unitAddress) {
            conditions.push(`u.unit_number ILIKE $${idx++}`);
            params.push((0, applicant_js_1.likeOf)(unitAddress));
        }
        const where = 'WHERE ' + conditions.join(' AND ');
        const result = await index_js_1.db.query(`SELECT
         c.id AS consumer_id,
         c.first_name,
         c.last_name,
         COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''), c.name) AS full_name,
         c.registration_no,
         c.lead_stage,
         br.id AS booking_id,
         br.booking_date,
         br.selected_plan_name,
         br.status AS booking_status,
         u.unit_number,
         u.bhk_type,
         t.tower_name,
         p.name AS project_name,
         p.id AS project_id,
         a.id AS allocation_id,
         a.allotment_date,
         a.status AS allocation_status,
         b.firm_name AS broker_company
       FROM consumers c
       JOIN booking_records br ON br.consumer_id = c.id AND br.status != 'cancelled'
       JOIN allocations a ON a.consumer_id = c.id AND a.status NOT IN ('cancelled','transferred')
       JOIN units u ON u.id = br.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
       JOIN projects p ON p.id = br.project_id
       LEFT JOIN brokers b ON b.id = br.broker_id
       ${where}
       ORDER BY c.registration_no ASC`, params);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── B: GET /api/surrender/detail/:consumerId ─────────────────────────────────
router.get('/detail/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Applicant id');
        const [mainRes, coAppRes, receiptsRes, demandsRes, scheduleRes, waiverRes, addonRes, dispatchRes, penalRes, unclearedRes,] = await Promise.all([
            index_js_1.db.query(`SELECT
           c.id, c.first_name, c.last_name, c.salutation, c.father_name,
           c.present_address, c.present_city, c.present_state, c.present_pin,
           c.mobile, c.email, c.pan_no, c.aadhaar_no,
           c.registration_no, c.lead_stage,
           br.id AS booking_id,
           br.booking_date, br.booking_amount,
           br.company_inaugural_disc,
           br.selected_plan_name,
           br.basic_rate_inr_sqft, br.approved_rebate_amount,
           br.plc_amount, br.other_charge_amount, br.balcony_charge_amount,
           br.other_charge_desc,
           br.booking_type,
           br.status AS booking_status,
           u.id AS unit_id,
           u.unit_number, u.floor,
           u.bhk_type,
           u.super_area_sqft,
           COALESCE(NULLIF(br.carpet_area_sqft, 0), u.carpet_area_sqft) AS carpet_area_sqft,
           t.tower_name,
           p.id AS project_id,
           p.name AS project_name,
           p.location AS project_location,
           b.firm_name AS broker_company,
           b.name AS broker_name,
           bpt.cgst_pct, bpt.sgst_pct,
           bpt.cgst_amount, bpt.sgst_amount,
           a.id AS allocation_id,
           a.allotment_date,
           a.agreement_execute_date,
           pp.id AS payment_plan_id,
           pp.total_amount_inr
         FROM consumers c
         JOIN booking_records br ON br.consumer_id = c.id AND br.status != 'cancelled'
         JOIN allocations a ON a.consumer_id = c.id AND a.status NOT IN ('cancelled','transferred')
         JOIN units u ON u.id = br.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         JOIN projects p ON p.id = br.project_id
         LEFT JOIN brokers b ON b.id = br.broker_id
         LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
         LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
         WHERE c.id = $1
         ORDER BY br.created_at DESC
         LIMIT 1`, [consumerId]),
            index_js_1.db.query(`SELECT * FROM co_applicants WHERE consumer_id = $1 LIMIT 1`, [consumerId]),
            index_js_1.db.query(`SELECT r.id, r.receipt_number, r.received_date, r.payment_method,
                r.amount_received_inr, r.cheque_no, r.bank_name,
                r.clearing_date, r.status, r.interest_amount
         FROM receipts r
         WHERE r.consumer_id = $1 AND r.status = 'cleared' AND NOT COALESCE(r.is_advance, false)
         ORDER BY r.received_date ASC`, [consumerId]),
            index_js_1.db.query(`SELECT d.installment_index, d.due_date, d.amount_due_inr,
                d.cgst_amount, d.sgst_amount, d.status
         FROM demands d
         WHERE d.consumer_id = $1
         ORDER BY d.installment_index ASC`, [consumerId]),
            index_js_1.db.query(`SELECT pst.installment_index, pst.installment_name,
                pst.percentage, pst.flat_amount_inr, pst.due_date_offset_days
         FROM plan_schedule_templates pst
         WHERE pst.project_id = (
           SELECT project_id FROM booking_records
           WHERE consumer_id = $1 AND status != 'cancelled'
           ORDER BY created_at DESC LIMIT 1
         )
         AND pst.plan_name = (
           SELECT selected_plan_name FROM booking_records
           WHERE consumer_id = $1 AND status != 'cancelled'
           ORDER BY created_at DESC LIMIT 1
         )
         ORDER BY pst.installment_index ASC`, [consumerId]),
            index_js_1.db.query(`SELECT COALESCE(SUM(iw.waiver_amount_inr), 0) AS total_waived
         FROM interest_waivers iw
         WHERE iw.consumer_id = $1 AND iw.status = 'approved'`, [consumerId]),
            index_js_1.db.query(`SELECT charge_name, total_amount, effective_date, cgst_amount, sgst_amount
         FROM consumer_addon_charges
         WHERE consumer_id = $1 AND status = 'active'`, [consumerId]),
            index_js_1.db.query(`SELECT document_type, dispatch_mode, tracking_no, dispatched_at
         FROM document_dispatch
         WHERE consumer_id = $1
         ORDER BY dispatched_at DESC`, [consumerId]),
            index_js_1.db.query(`SELECT COALESCE(SUM(pi.amount_inr), 0) AS total_interest
         FROM penal_interests pi
         WHERE pi.consumer_id = $1`, [consumerId]),
            // money on receipts that are not in the bank yet (pending, authorized, deposited, on hold): shown, but never counted as received
            index_js_1.db.query(`SELECT r.id, r.receipt_number, r.received_date, r.payment_method, r.amount_received_inr, r.status
           FROM receipts r
          WHERE r.consumer_id = $1 AND r.status NOT IN ('cleared', 'cancelled', 'bounced') AND NOT COALESCE(r.is_advance, false)
          ORDER BY r.received_date ASC`, [consumerId]),
        ]);
        if (mainRes.rows.length === 0) {
            throw (0, input_js_1.bad)('Consumer not found or no active booking', 404);
        }
        const row = mainRes.rows[0];
        // ── derive financials ─────────────────────────────────────────────────────
        const carpetArea = parseFloat(row.carpet_area_sqft || 0);
        const basicRate = parseFloat(row.basic_rate_inr_sqft || 0);
        const grossBasicPrice = basicRate > 0 && carpetArea > 0
            ? Math.round(basicRate * carpetArea)
            : parseFloat(row.booking_amount || 0);
        const inauguralDiscount = parseFloat(row.company_inaugural_disc || 0);
        const approvedRebate = parseFloat(row.approved_rebate_amount || 0); // an approved company rebate comes off the basic price too (QA-007)
        const netBasicPrice = grossBasicPrice - inauguralDiscount - approvedRebate; // the same net price the payment plan and the demand letter use
        const plcAmount = parseFloat(row.plc_amount || 0);
        const otherCharge = parseFloat(row.other_charge_amount || 0);
        const addonTotal = addonRes.rows.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0);
        const balconyCharge = parseFloat(row.balcony_charge_amount || 0);
        const agreementValue = netBasicPrice + plcAmount + otherCharge + balconyCharge;
        // tax as billed on the live demands (the same figure the Applicant File shows); the booking-time tax row only when nothing is billed yet
        const live = demandsRes.rows.filter((d) => d.status !== 'cancelled');
        const cgst = live.length ? live.reduce((s, d) => s + parseFloat(d.cgst_amount || 0), 0) : parseFloat(row.cgst_amount || 0);
        const sgst = live.length ? live.reduce((s, d) => s + parseFloat(d.sgst_amount || 0), 0) : parseFloat(row.sgst_amount || 0);
        const totalConsideration = agreementValue + addonTotal + cgst + sgst; // add-on charges already include their own GST
        const totalInterest = parseFloat(penalRes.rows[0]?.total_interest || 0);
        const totalWaived = parseFloat(waiverRes.rows[0]?.total_waived || 0);
        const totalReceivables = totalConsideration + totalInterest - totalWaived;
        const totalReceived = receiptsRes.rows.reduce((s, r) => s + parseFloat(r.amount_received_inr || 0), 0);
        const totalInterestPaid = receiptsRes.rows.reduce((s, r) => s + parseFloat(r.interest_amount || 0), 0);
        const balance = totalReceivables - totalReceived - totalInterestPaid;
        return res.json({
            success: true,
            data: {
                consumer: {
                    id: row.id,
                    first_name: row.first_name,
                    last_name: row.last_name,
                    salutation: row.salutation,
                    father_name: row.father_name,
                    present_address: row.present_address,
                    present_city: row.present_city,
                    present_state: row.present_state,
                    present_pin: row.present_pin,
                    mobile: row.mobile,
                    email: row.email,
                    pan_no: row.pan_no,
                    aadhaar_no: row.aadhaar_no,
                    registration_no: row.registration_no,
                    lead_stage: row.lead_stage,
                },
                coApplicant: coAppRes.rows[0] || null,
                booking: {
                    id: row.booking_id,
                    booking_date: row.booking_date,
                    booking_amount: row.booking_amount,
                    selected_plan_name: row.selected_plan_name,
                    basic_rate_inr_sqft: row.basic_rate_inr_sqft,
                    plc_amount: row.plc_amount,
                    other_charge_amount: row.other_charge_amount,
                    other_charge_desc: row.other_charge_desc,
                    booking_type: row.booking_type,
                    booking_status: row.booking_status,
                    cgst_pct: row.cgst_pct,
                    sgst_pct: row.sgst_pct,
                    cgst_amount: row.cgst_amount,
                    sgst_amount: row.sgst_amount,
                },
                unit: {
                    id: row.unit_id,
                    unit_number: row.unit_number,
                    floor: row.floor,
                    bhk_type: row.bhk_type,
                    super_area_sqft: row.super_area_sqft,
                    carpet_area_sqft: row.carpet_area_sqft,
                },
                tower: { tower_name: row.tower_name },
                project: { id: row.project_id, name: row.project_name, location: row.project_location },
                broker: { firm_name: row.broker_company, name: row.broker_name },
                allocation: {
                    id: row.allocation_id,
                    allotment_date: row.allotment_date,
                    agreement_execute_date: row.agreement_execute_date,
                },
                receipts: receiptsRes.rows,
                unclearedReceipts: unclearedRes.rows,
                demands: demandsRes.rows,
                scheduleTemplates: scheduleRes.rows,
                addonCharges: addonRes.rows,
                documentDispatches: dispatchRes.rows,
                financials: {
                    carpetArea,
                    basicRate,
                    grossBasicPrice,
                    inauguralDiscount,
                    netBasicPrice,
                    plcAmount,
                    otherCharge,
                    addonTotal,
                    agreementValue,
                    cgst,
                    sgst,
                    totalConsideration,
                    totalInterest,
                    totalWaived,
                    totalReceivables,
                    totalReceived,
                    totalInterestPaid,
                    balance,
                    unclearedTotal: unclearedRes.rows.reduce((s, r) => s + parseFloat(r.amount_received_inr || 0), 0),
                },
            },
        });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── C: POST /api/surrender ────────────────────────────────────────────────────
const SURRENDER_TYPES = ['voluntary', 'refund_case', 'non_refund', 'partial_refund', 'builder_cancellation'];
const REFUND_MODES = ['cash', 'draft', 'cheque', 'online', 'neft', 'rtgs', 'upi', 'bank_transfer', 'demand_draft'];
const MAX = 10000000000;
const money = (v, label) => ((0, input_js_1.has)(v) ? (0, input_js_1.num)(v, label, MAX, 2) : 0);
// The totals the page works out may be negative (a refund is due) and may carry floating-point tails: signed, rounded to paise
const signed = (v, label) => {
    if (!(0, input_js_1.has)(v))
        return 0;
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?[0-9]+(\.[0-9]+)?$/.test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n) || Math.abs(n) > MAX)
        throw (0, input_js_1.bad)(`${label} must be a number between -${MAX.toLocaleString('en-IN')} and ${MAX.toLocaleString('en-IN')}`);
    return Math.round(n * 100) / 100;
};
const r2 = (n) => Math.round(n * 100) / 100;
const performSurrender = async (c, req, res, p) => {
    const { consumerId, allocationId, given, isCancel, date, sType, mode, f } = p;
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`surrender-alloc:${allocationId}`]);
    const alloc = (await c.query(`SELECT id, consumer_id, unit_id, project_id, status FROM allocations WHERE id = $1 FOR UPDATE`, [allocationId])).rows[0];
    if (!alloc)
        throw (0, input_js_1.bad)('Allocation not found', 404);
    if (alloc.consumer_id !== consumerId)
        throw (0, input_js_1.bad)('This allocation does not belong to that applicant');
    if (alloc.status === 'cancelled')
        throw (0, input_js_1.bad)('This allocation is already surrendered or cancelled', 409);
    if (alloc.status === 'transferred')
        throw (0, input_js_1.bad)('This allocation was transferred to another applicant', 409);
    if (!alloc.unit_id)
        throw (0, input_js_1.bad)('This allocation has no unit');
    if (given.unit && given.unit !== alloc.unit_id)
        throw (0, input_js_1.bad)('The unit does not match the allocation');
    const unit = (await c.query(`SELECT id, project_id, status FROM units WHERE id = $1 FOR UPDATE`, [alloc.unit_id])).rows[0];
    if (given.project && given.project !== unit.project_id)
        throw (0, input_js_1.bad)('The project does not match the unit');
    const person = (await c.query(`SELECT id, lead_stage, allocated_unit_id FROM consumers WHERE id = $1 FOR UPDATE`, [consumerId])).rows[0];
    const booking = given.booking
        ? (await c.query(`SELECT id, consumer_id, unit_id, status FROM booking_records WHERE id = $1 FOR UPDATE`, [given.booking])).rows[0]
        : (await c.query(`SELECT id, consumer_id, unit_id, status FROM booking_records WHERE consumer_id = $1 AND unit_id = $2 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [consumerId, alloc.unit_id])).rows[0];
    if (given.booking && !booking)
        throw (0, input_js_1.bad)('Booking not found', 404);
    if (booking && (booking.consumer_id !== consumerId || booking.unit_id !== alloc.unit_id))
        throw (0, input_js_1.bad)('The booking does not belong to this applicant and unit');
    if (booking && booking.status === 'cancelled')
        throw (0, input_js_1.bad)('This booking is already cancelled', 409);
    // What the applicant has paid (cleared receipts, as the account screen shows it): forfeiture and refund together cannot exceed it
    const received = parseFloat((await c.query(`SELECT COALESCE(SUM(amount_received_inr), 0) AS s FROM receipts WHERE consumer_id = $1 AND status = 'cleared' AND is_advance IS NOT TRUE`, [consumerId])).rows[0].s);
    if (f.forfeit > received + 0.005)
        throw (0, input_js_1.bad)(`The forfeiture (${f.forfeit}) is more than the amount received (${received})`);
    if (f.forfeit + f.refund > received + 1)
        throw (0, input_js_1.bad)(`Forfeiture plus refund (${r2(f.forfeit + f.refund)}) is more than the amount received (${received})`);
    // What this changes, kept so a restore can put it back
    const commissions = booking
        ? (await c.query(`SELECT id FROM broker_commissions WHERE booking_id = $1 AND status = 'pending'`, [booking.id])).rows.map((r) => r.id) : [];
    const demands = (await c.query(`SELECT id, status FROM demands WHERE consumer_id = $1 AND status IN ('pending', 'overdue', 'demanded', 'partial') AND payment_plan_id IN (SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2)`, [consumerId, alloc.unit_id])).rows;
    const snapshot = JSON.stringify(demands.map((r) => ({ demand_id: r.id, previous_status: r.status })));
    const preState = JSON.stringify({ booking_status: booking?.status ?? null, allocation_status: alloc.status, lead_stage: person.lead_stage, allocated_unit_id: person.allocated_unit_id, commission_ids: commissions });
    let surrenderId;
    if (isCancel) {
        surrenderId = (await c.query(`INSERT INTO cancellations (consumer_id, allocation_id, booking_record_id, cancellation_date, reason, forfeiture_amount_inr, refund_amount_inr, refund_status, surrender_type, refund_mode,
           penalty_base_amount, penalty_total_amount, extra_addon_charges, total_amount, gst_included, interest_included, premium_amount, bank_noc, broker_noc, remark, created_by_user_id,
           pre_surrender_unit_status, cancelled_demand_snapshot, pre_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'initiated',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING id`, [consumerId, allocationId, booking?.id ?? null, date, f.reason, f.forfeit, f.refund, sType, mode, f.penBase, f.penTotal, f.extra, f.total, f.gst, f.interest, f.premium, f.bankNoc, f.brokerNoc, f.remark,
            req.userId || null, unit.status, snapshot, preState])).rows[0].id;
    }
    else {
        surrenderId = (await c.query(`INSERT INTO surrender_applications (consumer_id, allocation_id, booking_record_id, project_id, unit_id, surrender_date, reason, forfeiture_amount_inr, refund_amount_inr, status, surrender_type, refund_mode,
           penalty_base_amount, penalty_gst_amount, penalty_total_amount, extra_addon_charges, total_amount, gst_included, service_tax_included, vat_included, interest_included, premium_amount,
           bank_noc, broker_noc, remark, created_by_user_id, pre_surrender_unit_status, cancelled_demand_snapshot, pre_state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING id`, [consumerId, allocationId, booking?.id ?? null, unit.project_id, alloc.unit_id, date, f.reason, f.forfeit, f.refund, sType, mode, f.penBase, f.penGst, f.penTotal, f.extra, f.total, f.gst, f.st, f.vat,
            f.interest, f.premium, f.bankNoc, f.brokerNoc, f.remark, req.userId || null, unit.status, snapshot, preState])).rows[0].id;
    }
    await c.query(`UPDATE allocations SET status = 'cancelled', updated_at = now() WHERE id = $1`, [allocationId]);
    await c.query(`UPDATE consumers SET lead_stage = 'cancelled', allocated_unit_id = NULL WHERE id = $1 AND allocated_unit_id IS NOT DISTINCT FROM $2`, [consumerId, alloc.unit_id]);
    await c.query(`UPDATE consumers SET lead_stage = 'cancelled' WHERE id = $1`, [consumerId]);
    if (booking)
        await c.query(`UPDATE booking_records SET status = 'cancelled' WHERE id = $1`, [booking.id]);
    await c.query(`UPDATE units SET status = $2 WHERE id = $1`, [alloc.unit_id, isCancel ? 'available' : 'temp_surrender']);
    // the parking slots of this unit go back to the pool (a restore does not take them back: someone else may hold them by then)
    await c.query(`UPDATE parking_slots SET status = 'available', allotted_to_consumer_id = NULL, allotted_unit_id = NULL, allotted_at = NULL WHERE allotted_to_consumer_id = $1 AND (allotted_unit_id = $2 OR allotted_unit_id IS NULL)`, [consumerId, alloc.unit_id]);
    // Every demand of this unit's plan that is still to be paid stops (the paid ones stay as history)
    if (demands.length)
        await c.query(`UPDATE demands SET status = 'cancelled', updated_at = NOW() WHERE id = ANY($1::uuid[])`, [demands.map((d) => d.id)]);
    if (commissions.length)
        await c.query(`UPDATE broker_commissions SET status = 'cancelled' WHERE id = ANY($1::uuid[])`, [commissions]);
    if (isCancel && booking)
        await (0, broker_js_1.flagPaidCommission)(c, booking.id); // an allocation made on the Allotment screen has no booking
    await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', isCancel ? 'cancellation' : 'surrender', surrenderId, undefined, { consumer_id: consumerId, allocation_id: allocationId, unit_id: alloc.unit_id, surrender_type: sType, forfeiture_amount_inr: f.forfeit, refund_amount_inr: f.refund, demands_cancelled: demands.length });
    return { surrenderId, type: isCancel ? 'cancellation' : 'surrender' };
};
exports.performSurrender = performSurrender;
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumerId) || !(0, input_js_1.has)(b.allocationId))
            throw (0, input_js_1.bad)('consumerId and allocationId are required');
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), allocationId = (0, input_js_1.uuid)(b.allocationId, 'allocationId');
        const given = { booking: (0, input_js_1.has)(b.bookingId) ? (0, input_js_1.uuid)(b.bookingId, 'bookingId') : null, unit: (0, input_js_1.has)(b.unitId) ? (0, input_js_1.uuid)(b.unitId, 'unitId') : null, project: (0, input_js_1.has)(b.projectId) ? (0, input_js_1.uuid)(b.projectId, 'projectId') : null };
        if (b.type !== undefined && b.type !== 'surrender' && b.type !== 'cancellation')
            throw (0, input_js_1.bad)('type must be surrender or cancellation');
        const isCancel = b.type === 'cancellation';
        const date = (0, input_js_1.day)(b.surrenderDate, 'Surrender date') || (0, business_date_js_1.businessToday)();
        if (date > (0, business_date_js_1.businessTomorrow)())
            throw (0, input_js_1.bad)('Surrender date cannot be in the future');
        const sType = (0, input_js_1.has)(b.surrenderType) ? String(b.surrenderType) : isCancel ? 'builder_cancellation' : 'voluntary';
        if (!SURRENDER_TYPES.includes(sType))
            throw (0, input_js_1.bad)(`surrenderType must be one of ${SURRENDER_TYPES.join(', ')}`);
        const mode = (0, input_js_1.has)(b.refundMode) ? String(b.refundMode).toLowerCase() : null;
        if (mode && !REFUND_MODES.includes(mode))
            throw (0, input_js_1.bad)(`refundMode must be one of ${REFUND_MODES.join(', ')}`);
        const f = {
            forfeit: money(b.forfeitureAmount, 'Forfeiture amount'), refund: money(b.refundAmount, 'Refund amount'),
            penBase: money(b.penaltyBaseAmount, 'Penalty base amount'), penGst: money(b.penaltyGstAmount, 'Penalty GST'), penTotal: money(b.penaltyTotalAmount, 'Penalty total'),
            extra: money(b.extraAddonCharges, 'Extra add-on charges'), premium: money(b.premiumAmount, 'Premium amount'), total: signed(b.totalAmount, 'Total amount'),
            gst: (0, input_js_1.flag)(b.gstIncluded, 'gstIncluded') ?? true, st: (0, input_js_1.flag)(b.serviceTaxIncluded, 'serviceTaxIncluded') ?? false, vat: (0, input_js_1.flag)(b.vatIncluded, 'vatIncluded') ?? false, interest: (0, input_js_1.flag)(b.interestIncluded, 'interestIncluded') ?? true,
            bankNoc: (0, input_js_1.flag)(b.bankNoc, 'bankNoc') ?? false, brokerNoc: (0, input_js_1.flag)(b.brokerNoc, 'brokerNoc') ?? false, reason: (0, input_js_1.text)(b.reason, 'Reason', 1000, false), remark: (0, input_js_1.text)(b.remark, 'Remark', 1000, false),
        };
        const out = await (0, input_js_1.inTx)((c) => (0, exports.performSurrender)(c, req, res, { consumerId, allocationId, given, isCancel, date, sType, mode, f }));
        return res.status(201).json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── D: GET /api/surrender/list?projectId=&type= ──────────────────────────────
router.get('/list', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const type = query(req.query.type, 'type', 20);
        if (type && type !== 'surrender' && type !== 'cancellation')
            throw (0, input_js_1.bad)('type must be surrender or cancellation');
        if (type === 'cancellation') {
            const result = await index_js_1.db.query(`SELECT cn.*, COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''), c.name) AS full_name, c.first_name, c.last_name, c.registration_no,
                u.unit_number, t.tower_name, p.name AS project_name
           FROM cancellations cn
           JOIN consumers c ON c.id = cn.consumer_id
           LEFT JOIN booking_records br ON br.id = cn.booking_record_id
           LEFT JOIN units u ON u.id = br.unit_id
           LEFT JOIN towers t ON t.id = u.tower_id
           LEFT JOIN projects p ON p.id = br.project_id
          WHERE ($1::uuid IS NULL OR br.project_id = $1)
          ORDER BY cn.created_at DESC, cn.id LIMIT 5000`, [projectId]);
            return res.json({ success: true, data: result.rows });
        }
        const result = await index_js_1.db.query(`SELECT sa.*, COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''), c.name) AS full_name, c.first_name, c.last_name, c.registration_no,
              u.unit_number, t.tower_name, p.name AS project_name
         FROM surrender_applications sa
         JOIN consumers c ON c.id = sa.consumer_id
         LEFT JOIN units u ON u.id = sa.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         LEFT JOIN projects p ON p.id = sa.project_id
        WHERE ($1::uuid IS NULL OR sa.project_id = $1)
        ORDER BY sa.created_at DESC, sa.id LIMIT 5000`, [projectId]);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── E: POST /api/surrender/restore ───────────────────────────────────────────
// Puts the applicant, booking, allocation, unit, demands and commissions back as the surrender found them. The ids sent by the page are only checked against the stored record.
router.post('/restore', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.surrenderId))
            throw (0, input_js_1.bad)('surrenderId is required');
        const surrenderId = (0, input_js_1.uuid)(b.surrenderId, 'surrenderId');
        if (b.type !== undefined && b.type !== 'surrender' && b.type !== 'cancellation')
            throw (0, input_js_1.bad)('type must be surrender or cancellation');
        const isCancel = b.type === 'cancellation';
        const sent = ['consumerId', 'allocationId', 'unitId', 'bookingId'].map((k) => [k, (0, input_js_1.has)(b[k]) ? (0, input_js_1.uuid)(b[k], k) : null]);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`surrender-restore:${surrenderId}`]);
            const tbl = isCancel ? 'cancellations' : 'surrender_applications';
            const s = (await c.query(`SELECT * FROM ${tbl} WHERE id = $1 FOR UPDATE`, [surrenderId])).rows[0];
            if (!s)
                throw (0, input_js_1.bad)(`${isCancel ? 'Cancellation' : 'Surrender'} record not found`, 404);
            const state = isCancel ? s.refund_status : s.status;
            if (state === 'restored')
                throw (0, input_js_1.bad)('This applicant has already been restored', 409);
            if (isCancel && state !== 'initiated')
                throw (0, input_js_1.bad)(`The refund is ${state}, so the cancellation can no longer be restored`, 409);
            if (!isCancel && !['pending', 'approved'].includes(state))
                throw (0, input_js_1.bad)(`A surrender that is ${state} cannot be restored`, 409);
            const alloc = (await c.query(`SELECT id, unit_id, status FROM allocations WHERE id = $1 FOR UPDATE`, [s.allocation_id])).rows[0];
            if (!alloc)
                throw (0, input_js_1.bad)('The allocation of this record no longer exists', 409);
            const real = { consumerId: s.consumer_id, allocationId: s.allocation_id, unitId: alloc.unit_id, bookingId: s.booking_record_id };
            for (const [k, v] of sent)
                if (v && real[k] && v !== real[k])
                    throw (0, input_js_1.bad)(`${k} does not match this ${isCancel ? 'cancellation' : 'surrender'}`);
            if (alloc.status !== 'cancelled')
                throw (0, input_js_1.bad)('The allocation is not cancelled, so there is nothing to restore', 409);
            // The unit must still be where the surrender left it: nobody else may have taken it
            const unit = (await c.query(`SELECT id, status FROM units WHERE id = $1 FOR UPDATE`, [alloc.unit_id])).rows[0];
            const left = isCancel ? 'available' : 'temp_surrender';
            if (!unit || unit.status !== left)
                throw (0, input_js_1.bad)(`The unit is now "${unit?.status}" and was taken again after the ${isCancel ? 'cancellation' : 'surrender'}, so this applicant cannot be restored`, 409);
            if ((await c.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND status NOT IN ('cancelled') LIMIT 1`, [alloc.unit_id])).rows.length)
                throw (0, input_js_1.bad)('Another booking exists on this unit, so this applicant cannot be restored', 409);
            if ((await c.query(`SELECT 1 FROM allocations WHERE unit_id = $1 AND id <> $2 AND status NOT IN ('cancelled', 'transferred') LIMIT 1`, [alloc.unit_id, alloc.id])).rows.length)
                throw (0, input_js_1.bad)('Another applicant holds this unit, so this applicant cannot be restored', 409);
            const person = (await c.query(`SELECT id, allocated_unit_id FROM consumers WHERE id = $1 FOR UPDATE`, [s.consumer_id])).rows[0];
            if (person.allocated_unit_id && person.allocated_unit_id !== alloc.unit_id)
                throw (0, input_js_1.bad)('The applicant owns another unit now, so this one cannot be restored', 409);
            const pre = s.pre_state || {}; // old records (before this was kept) fall back to the earlier behaviour
            await c.query(`UPDATE ${tbl} SET ${isCancel ? 'refund_status' : 'status'} = 'restored', updated_at = now() WHERE id = $1`, [surrenderId]);
            await c.query(`UPDATE allocations SET status = $2, updated_at = now() WHERE id = $1`, [alloc.id, pre.allocation_status || 'allotted']);
            await c.query(`UPDATE consumers SET lead_stage = $2, allocated_unit_id = $3 WHERE id = $1`, [s.consumer_id, pre.lead_stage && pre.lead_stage !== 'cancelled' ? pre.lead_stage : 'allotted', alloc.unit_id]);
            if (s.booking_record_id)
                await c.query(`UPDATE booking_records SET status = $2 WHERE id = $1`, [s.booking_record_id, pre.booking_status || 'complete']);
            await c.query(`UPDATE units SET status = $2 WHERE id = $1`, [alloc.unit_id, s.pre_surrender_unit_status || 'locked']);
            const snap = Array.isArray(s.cancelled_demand_snapshot) ? s.cancelled_demand_snapshot : [];
            for (const e of snap)
                await c.query(`UPDATE demands SET status = $2, updated_at = NOW() WHERE id = $1 AND status = 'cancelled'`, [e.demand_id, e.previous_status]);
            if (Array.isArray(pre.commission_ids) && pre.commission_ids.length)
                await c.query(`UPDATE broker_commissions SET status = 'pending' WHERE id = ANY($1::uuid[]) AND status = 'cancelled'`, [pre.commission_ids]);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', isCancel ? 'cancellation' : 'surrender', surrenderId, { status: state }, { status: 'restored', unit_id: alloc.unit_id, demands_restored: snap.length });
            return { demandsRestored: snap.length };
        });
        return res.json({ success: true, ...out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=surrender.js.map