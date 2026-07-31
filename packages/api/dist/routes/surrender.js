"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// ── A: GET /api/surrender/consumers?projectId=&registrationNo=&firstName=&unitAddress= ──
router.get('/consumers', async (req, res, next) => {
    try {
        const { projectId, registrationNo, firstName, unitAddress } = req.query;
        if (!projectId)
            return res.status(400).json({ error: 'projectId is required' });
        const conditions = ['p.id = $1', "a.status NOT IN ('cancelled','transferred')", "br.status != 'cancelled'"];
        const params = [projectId];
        let idx = 2;
        if (registrationNo) {
            conditions.push(`c.registration_no ILIKE $${idx++}`);
            params.push(`%${registrationNo}%`);
        }
        if (firstName) {
            conditions.push(`(c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`);
            params.push(`%${firstName}%`);
            idx++;
        }
        if (unitAddress) {
            conditions.push(`u.unit_number ILIKE $${idx++}`);
            params.push(`%${unitAddress}%`);
        }
        const where = 'WHERE ' + conditions.join(' AND ');
        const result = await index_js_1.db.query(`SELECT
         c.id AS consumer_id,
         c.first_name,
         c.last_name,
         TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS full_name,
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
        next(err);
    }
});
// ── B: GET /api/surrender/detail/:consumerId ─────────────────────────────────
router.get('/detail/:consumerId', async (req, res, next) => {
    try {
        const { consumerId } = req.params;
        const [mainRes, coAppRes, receiptsRes, demandsRes, scheduleRes, waiverRes, addonRes, dispatchRes, penalRes,] = await Promise.all([
            index_js_1.db.query(`SELECT
           c.id, c.first_name, c.last_name, c.salutation, c.father_name,
           c.present_address, c.present_city, c.present_state, c.present_pin,
           c.mobile, c.email, c.pan_no, c.aadhaar_no,
           c.registration_no, c.lead_stage,
           br.id AS booking_id,
           br.booking_date, br.booking_amount,
           br.selected_plan_name,
           br.basic_rate_inr_sqft,
           br.plc_amount, br.other_charge_amount,
           br.other_charge_desc,
           br.booking_type,
           br.status AS booking_status,
           u.id AS unit_id,
           u.unit_number, u.floor,
           u.bhk_type,
           u.super_area_sqft,
           u.carpet_area_sqft,
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
         WHERE r.consumer_id = $1 AND r.status = 'cleared'
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
        ]);
        if (mainRes.rows.length === 0) {
            return res.status(404).json({ error: 'Consumer not found or no active booking' });
        }
        const row = mainRes.rows[0];
        // ── derive financials ─────────────────────────────────────────────────────
        const carpetArea = parseFloat(row.carpet_area_sqft || 0);
        const basicRate = parseFloat(row.basic_rate_inr_sqft || 0);
        const netBasicPrice = basicRate > 0 && carpetArea > 0
            ? Math.round(basicRate * carpetArea)
            : parseFloat(row.booking_amount || 0);
        const plcAmount = parseFloat(row.plc_amount || 0);
        const otherCharge = parseFloat(row.other_charge_amount || 0);
        const addonTotal = addonRes.rows.reduce((s, c) => s + parseFloat(c.total_amount || 0), 0);
        const agreementValue = netBasicPrice + plcAmount + otherCharge + addonTotal;
        const cgst = parseFloat(row.cgst_amount || 0);
        const sgst = parseFloat(row.sgst_amount || 0);
        const totalConsideration = agreementValue + cgst + sgst;
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
                demands: demandsRes.rows,
                scheduleTemplates: scheduleRes.rows,
                addonCharges: addonRes.rows,
                documentDispatches: dispatchRes.rows,
                financials: {
                    carpetArea,
                    basicRate,
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
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// ── C: POST /api/surrender ────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
    try {
        const { consumerId, allocationId, bookingId, unitId, projectId, type, surrenderDate, surrenderType, reason, forfeitureAmount, refundAmount, penaltyBaseAmount, penaltyGstAmount, penaltyTotalAmount, extraAddonCharges, totalAmount, gstIncluded, serviceTaxIncluded, vatIncluded, interestIncluded, premiumAmount, bankNoc, brokerNoc, refundMode, remark, } = req.body;
        if (!consumerId || !allocationId) {
            return res.status(400).json({ error: 'consumerId and allocationId are required' });
        }
        await index_js_1.db.query('BEGIN');
        try {
            let surrenderId;
            let preSurrenderUnitStatus = null;
            if (type !== 'cancellation' && unitId) {
                const unitRes = await index_js_1.db.query(`SELECT status FROM units WHERE id = $1`, [unitId]);
                preSurrenderUnitStatus = unitRes.rows[0]?.status ?? null;
            }
            let cancelledDemandSnapshot = null;
            if (type !== 'cancellation') {
                const demandsRes = await index_js_1.db.query(`SELECT id, status FROM demands
           WHERE consumer_id = $1 AND status IN ('pending', 'overdue', 'demanded')
           AND demand_type IN ('installment', 'bounce_penalty')`, [consumerId]);
                cancelledDemandSnapshot = JSON.stringify(demandsRes.rows.map((r) => ({ demand_id: r.id, previous_status: r.status })));
            }
            if (type === 'cancellation') {
                const ins = await index_js_1.db.query(`INSERT INTO cancellations
             (consumer_id, allocation_id, booking_record_id, cancellation_date,
              reason, forfeiture_amount_inr, refund_amount_inr, refund_status,
              surrender_type, refund_mode, penalty_base_amount, penalty_total_amount,
              extra_addon_charges, total_amount, gst_included, interest_included,
              premium_amount, bank_noc, broker_noc, remark, created_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'initiated',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           RETURNING id`, [
                    consumerId, allocationId, bookingId || null,
                    surrenderDate || new Date().toISOString().slice(0, 10),
                    reason || null,
                    parseFloat(forfeitureAmount || 0),
                    parseFloat(refundAmount || 0),
                    surrenderType || 'builder_cancellation',
                    refundMode || null,
                    parseFloat(penaltyBaseAmount || 0),
                    parseFloat(penaltyTotalAmount || 0),
                    parseFloat(extraAddonCharges || 0),
                    parseFloat(totalAmount || 0),
                    gstIncluded !== false,
                    interestIncluded !== false,
                    parseFloat(premiumAmount || 0),
                    bankNoc === true,
                    brokerNoc === true,
                    remark || null,
                    req.userId || null,
                ]);
                surrenderId = ins.rows[0].id;
            }
            else {
                const ins = await index_js_1.db.query(`INSERT INTO surrender_applications
             (consumer_id, allocation_id, booking_record_id, project_id, unit_id,
              surrender_date, reason, forfeiture_amount_inr, refund_amount_inr,
              status, surrender_type, refund_mode,
              penalty_base_amount, penalty_gst_amount, penalty_total_amount,
              extra_addon_charges, total_amount,
              gst_included, service_tax_included, vat_included, interest_included,
              premium_amount, bank_noc, broker_noc, remark, created_by_user_id,
              pre_surrender_unit_status, cancelled_demand_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
           RETURNING id`, [
                    consumerId, allocationId, bookingId || null,
                    projectId || null, unitId || null,
                    surrenderDate || new Date().toISOString().slice(0, 10),
                    reason || null,
                    parseFloat(forfeitureAmount || 0),
                    parseFloat(refundAmount || 0),
                    surrenderType || 'voluntary',
                    refundMode || null,
                    parseFloat(penaltyBaseAmount || 0),
                    parseFloat(penaltyGstAmount || 0),
                    parseFloat(penaltyTotalAmount || 0),
                    parseFloat(extraAddonCharges || 0),
                    parseFloat(totalAmount || 0),
                    gstIncluded !== false,
                    serviceTaxIncluded === true,
                    vatIncluded === true,
                    interestIncluded !== false,
                    parseFloat(premiumAmount || 0),
                    bankNoc === true,
                    brokerNoc === true,
                    remark || null,
                    req.userId || null,
                    preSurrenderUnitStatus,
                    cancelledDemandSnapshot,
                ]);
                surrenderId = ins.rows[0].id;
            }
            await index_js_1.db.query(`UPDATE allocations SET status = 'cancelled', updated_at = now() WHERE id = $1`, [allocationId]);
            await index_js_1.db.query(`UPDATE consumers SET lead_stage = 'cancelled' WHERE id = $1`, [consumerId]);
            if (bookingId) {
                await index_js_1.db.query(`UPDATE booking_records SET status = 'cancelled' WHERE id = $1`, [bookingId]);
            }
            if (unitId) {
                const newUnitStatus = type === 'cancellation' ? 'available' : 'temp_surrender';
                await index_js_1.db.query(`UPDATE units SET status = $2 WHERE id = $1`, [unitId, newUnitStatus]);
            }
            await index_js_1.db.query(`UPDATE demands SET status = 'cancelled'
         WHERE consumer_id = $1 AND status IN ('pending', 'overdue', 'demanded')
         AND demand_type = 'installment'`, [consumerId]);
            await index_js_1.db.query(`UPDATE demands SET status = 'cancelled'
         WHERE consumer_id = $1 AND status IN ('pending', 'overdue', 'demanded')
         AND demand_type = 'bounce_penalty'`, [consumerId]);
            await index_js_1.db.query('COMMIT');
            return res.status(201).json({ success: true, data: { surrenderId, type: type || 'surrender' } });
        }
        catch (txErr) {
            await index_js_1.db.query('ROLLBACK');
            throw txErr;
        }
    }
    catch (err) {
        next(err);
    }
});
// ── D: GET /api/surrender/list?projectId=&type= ──────────────────────────────
router.get('/list', async (req, res, next) => {
    try {
        const { projectId, type } = req.query;
        if (type === 'cancellation') {
            const conditions = [];
            const params = [];
            if (projectId) {
                // cancellations has no project_id column — filter via allocation join
                conditions.push(`br.project_id = $1`);
                params.push(projectId);
            }
            const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            const result = await index_js_1.db.query(`SELECT cn.*,
                TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS full_name,
                c.first_name, c.last_name, c.registration_no,
                u.unit_number, t.tower_name,
                p.name AS project_name
         FROM cancellations cn
         JOIN consumers c ON c.id = cn.consumer_id
         LEFT JOIN booking_records br ON br.id = cn.booking_record_id
         LEFT JOIN units u ON u.id = br.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         LEFT JOIN projects p ON p.id = br.project_id
         ${where}
         ORDER BY cn.created_at DESC`, params);
            return res.json({ success: true, data: result.rows });
        }
        // Default: surrender_applications
        const conditions = [];
        const params = [];
        if (projectId) {
            conditions.push(`sa.project_id = $1`);
            params.push(projectId);
        }
        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await index_js_1.db.query(`SELECT sa.*,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS full_name,
              c.first_name, c.last_name, c.registration_no,
              u.unit_number, t.tower_name,
              p.name AS project_name
       FROM surrender_applications sa
       JOIN consumers c ON c.id = sa.consumer_id
       LEFT JOIN units u ON u.id = sa.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN projects p ON p.id = sa.project_id
       ${where}
       ORDER BY sa.created_at DESC`, params);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// ── E: POST /api/surrender/restore ───────────────────────────────────────────
router.post('/restore', async (req, res, next) => {
    try {
        const { surrenderId, type, consumerId, allocationId, unitId, bookingId } = req.body;
        if (!surrenderId || !consumerId || !allocationId) {
            return res.status(400).json({ error: 'surrenderId, consumerId and allocationId are required' });
        }
        await index_js_1.db.query('BEGIN');
        try {
            let preSurrenderUnitStatus = null;
            if (type === 'cancellation') {
                await index_js_1.db.query(`UPDATE cancellations SET refund_status = 'restored', updated_at = now() WHERE id = $1`, [surrenderId]);
            }
            else {
                const saRes = await index_js_1.db.query(`UPDATE surrender_applications SET status = 'restored', updated_at = now() WHERE id = $1
           RETURNING pre_surrender_unit_status, cancelled_demand_snapshot`, [surrenderId]);
                preSurrenderUnitStatus = saRes.rows[0]?.pre_surrender_unit_status ?? null;
                const cancelledDemandSnapshot = saRes.rows[0]?.cancelled_demand_snapshot ?? null;
                if (cancelledDemandSnapshot) {
                    for (const entry of cancelledDemandSnapshot) {
                        await index_js_1.db.query(`UPDATE demands SET status = $2 WHERE id = $1 AND status = 'cancelled'`, [entry.demand_id, entry.previous_status]);
                    }
                }
                else {
                    console.warn(`[surrender/restore] surrenderId=${surrenderId} has no cancelled_demand_snapshot (legacy row) -- demands not reversed`);
                }
            }
            await index_js_1.db.query(`UPDATE allocations SET status = 'allotted', updated_at = now() WHERE id = $1`, [allocationId]);
            await index_js_1.db.query(`UPDATE consumers SET lead_stage = 'allotted' WHERE id = $1`, [consumerId]);
            if (bookingId) {
                await index_js_1.db.query(`UPDATE booking_records SET status = 'complete' WHERE id = $1`, [bookingId]);
            }
            if (unitId) {
                if (!preSurrenderUnitStatus) {
                    console.warn(`[surrender/restore] surrenderId=${surrenderId} unitId=${unitId} has no pre_surrender_unit_status snapshot (legacy row) -- falling back to 'locked'`);
                }
                const restoredUnitStatus = preSurrenderUnitStatus || 'locked';
                await index_js_1.db.query(`UPDATE units SET status = $2 WHERE id = $1`, [unitId, restoredUnitStatus]);
            }
            await index_js_1.db.query('COMMIT');
            return res.json({ success: true });
        }
        catch (txErr) {
            await index_js_1.db.query('ROLLBACK');
            throw txErr;
        }
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=surrender.js.map