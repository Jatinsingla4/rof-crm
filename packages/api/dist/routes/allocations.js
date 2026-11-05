"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Allocation routes (mounted at /api/allocations): allotment, waitlist, cancelling an allocation, e-draw import, unit shifting, allotment letters.
 * Every id, date and filter is checked before it reaches SQL; each change runs in one transaction with the unit and applicant locked.
 */
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const input_js_1 = require("../utils/input.js");
const applicant_js_1 = require("../utils/applicant.js");
const applicant_fields_js_1 = require("../utils/applicant-fields.js");
const surrender_js_1 = require("./surrender.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const csvUpload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const STATUSES = ['allotted', 'agreement_signed', 'cancelled', 'transferred', 'booked'];
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'This record already exists');
const query = (v, label, max = 100) => {
    if (Array.isArray(v))
        throw (0, input_js_1.bad)(`${label} is not valid`);
    return (0, input_js_1.text)(v, label, max, false);
};
const int = (v, label, min, max, dflt) => {
    if (!(0, input_js_1.has)(v))
        return dflt;
    if (typeof v !== 'string' && typeof v !== 'number')
        throw (0, input_js_1.bad)(`${label} is not valid`);
    const n = Number(v);
    if (!/^-?\d+$/.test(String(v)) || n < min || n > max)
        throw (0, input_js_1.bad)(`${label} must be a whole number from ${min} to ${max}`);
    return n;
};
// A date that is not in the future (one day of grace for the clock difference between browser and server)
const pastDay = (v, label) => {
    const d = (0, input_js_1.day)(v, label);
    if (d && d > (0, business_date_js_1.businessTomorrow)())
        throw (0, input_js_1.bad)(`${label} cannot be in the future`);
    return d;
};
const history = (c, unitId, from, to, userId, reason) => c.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason) VALUES ($1, $2, $3, $4, $5)`, [unitId, from, to, userId || null, reason]);
// POST /api/allocations - allot a unit to an applicant (one click)
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        for (const k of ['consumerId', 'unitId', 'projectId'])
            if (!(0, input_js_1.has)(b[k]))
                throw (0, input_js_1.bad)(`${k} must be a valid UUID`);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), unitId = (0, input_js_1.uuid)(b.unitId, 'unitId'), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const date = pastDay(b.allotmentDate, 'allotmentDate'), remarks = (0, input_js_1.text)(b.remarks, 'remarks', 1000, false);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`alloc-unit:${unitId}`]);
            const unit = (await c.query(`SELECT status, project_id FROM units WHERE id = $1 FOR UPDATE`, [unitId])).rows[0];
            if (!unit)
                throw (0, input_js_1.bad)('Unit not found', 404);
            if (!['available', 'booked'].includes(unit.status))
                throw (0, input_js_1.bad)('Unit not available for allocation');
            if (unit.project_id !== projectId)
                throw (0, input_js_1.bad)('The unit does not belong to that project');
            const person = (await c.query(`SELECT id, project_id, allocated_unit_id FROM consumers WHERE id = $1 FOR UPDATE`, [consumerId])).rows[0];
            if (!person)
                throw (0, input_js_1.bad)('Applicant not found', 404);
            if (person.project_id && person.project_id !== projectId)
                throw (0, input_js_1.bad)('The applicant belongs to a different project than the unit');
            if (person.allocated_unit_id && person.allocated_unit_id !== unitId)
                throw (0, input_js_1.bad)('The applicant already holds another unit', 409);
            // A 'booked' unit already has an allocation from the booking: promote it. An 'available' unit gets a new one.
            let alloc;
            if (unit.status === 'booked') {
                alloc = await c.query(`UPDATE allocations SET status = 'allotted', allotment_date = COALESCE($1::date, ${business_date_js_1.SQL_TODAY}), remarks = COALESCE($2, remarks), updated_at = NOW()
            WHERE consumer_id = $3 AND unit_id = $4 AND status = 'booked' RETURNING id, allocated_date, allotment_date, remarks`, [date, remarks, consumerId, unitId]);
                if (alloc.rowCount === 0)
                    throw (0, input_js_1.bad)('No matching booked allocation found for this consumer and unit', 409);
            }
            else {
                if ((await c.query(`SELECT 1 FROM allocations WHERE unit_id = $1 AND status NOT IN ('cancelled', 'transferred') LIMIT 1`, [unitId])).rows.length)
                    throw (0, input_js_1.bad)('This unit already has an active allocation', 409);
                alloc = await c.query(`INSERT INTO allocations (consumer_id, unit_id, project_id, created_by_user_id, allotment_date, remarks) VALUES ($1, $2, $3, $4, COALESCE($5::date, ${business_date_js_1.SQL_TODAY}), $6)
           RETURNING id, allocated_date, allotment_date, remarks`, [consumerId, unitId, projectId, req.userId, date, remarks]);
            }
            await c.query(`UPDATE units SET status = 'allotted', status_changed_at = NOW() WHERE id = $1`, [unitId]);
            await c.query(`UPDATE consumers SET lead_stage = 'allotted', allocated_unit_id = $1 WHERE id = $2`, [unitId, consumerId]);
            await history(c, unitId, unit.status, 'allotted', req.userId, 'Allotment created');
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'allocation', alloc.rows[0].id, undefined, { consumer_id: consumerId, unit_id: unitId, previous_unit_status: unit.status });
            return alloc.rows[0];
        });
        res.status(201).json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/allocations/waitlist
router.get('/waitlist', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const result = await index_js_1.db.query(`SELECT w.id, w.consumer_id, w.project_id, w.position_ordered AS position,
              CASE WHEN w.promoted_to_allocation_id IS NOT NULL THEN 'promoted' ELSE 'waiting' END AS status, w.created_at AS applied_date,
              c.name AS consumer_name, c.mobile AS consumer_mobile, p.name AS project_name
         FROM waitlists w JOIN consumers c ON w.consumer_id = c.id JOIN projects p ON w.project_id = p.id
        WHERE ($1::uuid IS NULL OR w.project_id = $1) ORDER BY w.position_ordered ASC, w.id`, [projectId]);
        res.json({ success: true, data: result.rows, total: result.rowCount });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/allocations - list
router.get('/', async (req, res, next) => {
    try {
        const q = req.query;
        const params = [];
        const add = (v) => `$${params.push(v)}`;
        let where = '';
        if ((0, input_js_1.has)(q.projectId))
            where += ` AND a.project_id = ${add((0, input_js_1.uuid)(q.projectId, 'projectId'))}`;
        if ((0, input_js_1.has)(q.consumerId))
            where += ` AND a.consumer_id = ${add((0, input_js_1.uuid)(q.consumerId, 'consumerId'))}`;
        const status = query(q.status, 'status', 20);
        if (status && status !== 'all') {
            if (!STATUSES.includes(status))
                throw (0, input_js_1.bad)(`status must be one of ${STATUSES.join(', ')}`);
            where += ` AND a.status = ${add(status)}`;
        }
        else if (!status && !(0, input_js_1.has)(q.consumerId))
            where += ` AND a.status = 'allotted'`; // the allotment form tab shows the allotted ones by default
        const search = query(q.search, 'search');
        if (search) {
            const s = add((0, applicant_js_1.likeOf)(search));
            where += ` AND (c.name ILIKE ${s} OR c.mobile ILIKE ${s})`;
        }
        const reg = query(q.registrationNo, 'registrationNo');
        if (reg)
            where += ` AND c.registration_no ILIKE ${add((0, applicant_js_1.likeOf)(reg))}`;
        const first = query(q.firstName, 'firstName');
        if (first)
            where += ` AND c.first_name ILIKE ${add((0, applicant_js_1.likeOf)(first))}`;
        const unit = query(q.unitAddress, 'unitAddress');
        if (unit)
            where += ` AND u.unit_number ILIKE ${add((0, applicant_js_1.likeOf)(unit))}`;
        const from = (0, input_js_1.day)(q.dateFrom, 'dateFrom');
        if (from)
            where += ` AND a.allotment_date >= ${add(from)}`;
        const to = (0, input_js_1.day)(q.dateTo, 'dateTo');
        if (to)
            where += ` AND a.allotment_date <= ${add(to)}`;
        if (from && to && from > to)
            throw (0, input_js_1.bad)('dateFrom must not be after dateTo');
        const pageSize = int(q.pageSize, 'pageSize', 1, 1000, 20), page = int(q.page, 'page', 1, 100000, 1);
        const result = await index_js_1.db.query(`SELECT a.id, a.consumer_id, a.unit_id, a.allocated_date, a.allotment_date, a.status, a.project_id,
              c.name AS consumer_name, c.first_name, c.last_name, c.mobile, c.registration_no,
              u.unit_number, u.bhk_type, u.carpet_area_sqft, u.super_area_sqft, u.base_price_inr, u.total_price_inr,
              t.tower_name, p.name AS project_name, COALESCE(co.name, 'N/A') AS co_applicant_name, COALESCE(b.firm_name, 'Direct') AS broker_company
         FROM allocations a
         JOIN consumers c ON a.consumer_id = c.id
         JOIN units u ON a.unit_id = u.id
         LEFT JOIN towers t ON t.id = u.tower_id
         LEFT JOIN projects p ON p.id = a.project_id
         LEFT JOIN LATERAL (SELECT main_broker_id FROM booking_records WHERE consumer_id = a.consumer_id AND project_id = a.project_id ORDER BY created_at DESC LIMIT 1) bk ON true
         LEFT JOIN brokers b ON b.id = bk.main_broker_id
         LEFT JOIN LATERAL (SELECT name FROM co_applicants WHERE consumer_id = a.consumer_id LIMIT 1) co ON true
        WHERE TRUE ${where}
        ORDER BY a.allocated_date DESC, a.id LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/allocations/:id/cancel - cancel an allocation. The applicant forfeits up to 29,500 (25,000 + 18% GST) of what was paid and is refunded the rest.
// It leaves the same state behind as a builder cancellation (booking, demands and commissions stop, the applicant is unlinked) and can be restored from the Surrender screens.
// The unit goes to the first applicant on the waitlist who can take it, otherwise it becomes available.
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Allocation id');
        const reason = (0, input_js_1.text)((0, input_js_1.body)(req).reason, 'reason', 1000, false);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const alloc = (await c.query(`SELECT id, consumer_id, unit_id FROM allocations WHERE id = $1`, [id])).rows[0];
            if (!alloc)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            const received = parseFloat((await c.query(`SELECT COALESCE(SUM(amount_received_inr), 0) AS s FROM receipts WHERE consumer_id = $1 AND status = 'cleared'`, [alloc.consumer_id])).rows[0].s);
            const forfeit = Math.min(29500, received), refund = Math.round((received - forfeit) * 100) / 100;
            const done = await (0, surrender_js_1.performSurrender)(c, req, res, {
                consumerId: alloc.consumer_id, allocationId: id, given: { booking: null, unit: null, project: null }, isCancel: true, date: (0, business_date_js_1.businessToday)(), sType: 'allocation_cancel', mode: null,
                f: { forfeit, refund, penBase: 0, penGst: 0, penTotal: 0, extra: 0, premium: 0, total: 0, gst: true, st: false, vat: false, interest: true, bankNoc: false, brokerNoc: false, reason, remark: null },
            });
            // Waitlist: the first waiting applicant who holds no unit gets it
            const unit = (await c.query(`SELECT project_id FROM units WHERE id = $1`, [alloc.unit_id])).rows[0];
            const next_ = (await c.query(`SELECT w.id, w.consumer_id FROM waitlists w JOIN consumers c ON c.id = w.consumer_id
          WHERE w.project_id = $1 AND w.promoted_to_allocation_id IS NULL AND c.allocated_unit_id IS NULL AND c.id <> $2
          ORDER BY w.position_ordered ASC LIMIT 1 FOR UPDATE OF w`, [unit.project_id, alloc.consumer_id])).rows[0];
            let promoted = null;
            if (next_) {
                const na = await c.query(`INSERT INTO allocations (consumer_id, unit_id, project_id, status, created_by_user_id) VALUES ($1, $2, $3, 'allotted', $4) RETURNING id`, [next_.consumer_id, alloc.unit_id, unit.project_id, req.userId]);
                await c.query(`UPDATE waitlists SET promoted_to_allocation_id = $1 WHERE id = $2`, [na.rows[0].id, next_.id]);
                await c.query(`UPDATE units SET status = 'allotted', status_changed_at = NOW() WHERE id = $1`, [alloc.unit_id]);
                await c.query(`UPDATE consumers SET lead_stage = 'allotted', allocated_unit_id = $1 WHERE id = $2`, [alloc.unit_id, next_.consumer_id]);
                await history(c, alloc.unit_id, 'available', 'allotted', req.userId, 'Auto-promoted from waitlist on cancellation');
                promoted = next_.consumer_id;
            }
            else {
                await history(c, alloc.unit_id, 'allotted', 'available', req.userId, 'Allocation cancelled');
            }
            return { id: done.surrenderId, refund_amount_inr: refund, forfeiture_amount_inr: forfeit, promoted_consumer_id: promoted };
        });
        res.json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// The e-draw file: a CSV with an applicant column (applicantId, aadhaar, registration_no or mobile) and a result column (result, draw_result or status)
const parseDrawCsv = (buf) => {
    const lines = buf.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2)
        throw (0, input_js_1.bad)('The file needs a header row and at least one result');
    const cells = (l) => l.split(',').map((x) => x.trim().replace(/^"|"$/g, '').trim());
    const head = cells(lines[0]).map((h) => h.toLowerCase().replace(/[\s-]+/g, '_'));
    const ai = head.findIndex((h) => ['applicantid', 'applicant_id', 'aadhaar', 'aadhaar_no', 'registration_no', 'reg_no', 'mobile'].includes(h));
    const ri = head.findIndex((h) => ['result', 'draw_result', 'status'].includes(h));
    if (ai < 0 || ri < 0)
        throw (0, input_js_1.bad)('The first row must name an applicant column (applicantId, aadhaar, registration_no or mobile) and a result column (result)');
    return lines.slice(1).map((l) => { const c = cells(l); return { applicantId: c[ai] || '', result: (c[ri] || '').toLowerCase() || null }; });
};
// POST /api/allocations/import-edraw - e-draw results: applicants of an unsuccessful draw who paid get a refund record (due in 30 days)
router.post('/import-edraw', (req, res, next) => csvUpload.single('file')(req, res, (e) => (e ? (0, input_js_1.failWith)(e?.code === 'LIMIT_FILE_SIZE' ? (0, input_js_1.bad)('The file is bigger than 2 MB') : e?.name === 'MulterError' ? (0, input_js_1.bad)('The file could not be read') : e, res, next) : next())), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.projectId))
            throw (0, input_js_1.bad)('projectId is required');
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const file = req.file;
        const results = file ? parseDrawCsv(file.buffer) : b.results;
        if (!Array.isArray(results) || !results.length)
            throw (0, input_js_1.bad)('results must be a list of draw results (or upload a CSV file)');
        if (results.length > 5000)
            throw (0, input_js_1.bad)('At most 5000 results can be imported at once');
        const bankAccount = (0, input_js_1.has)(b.companyBankAccountId) ? (0, input_js_1.uuid)(b.companyBankAccountId, 'companyBankAccountId') : null;
        const rows = results.map((row, i) => {
            if (!row || typeof row !== 'object' || Array.isArray(row))
                throw (0, input_js_1.bad)(`Result ${i + 1} is not valid`);
            const applicantId = (0, input_js_1.text)(row.applicantId, `Result ${i + 1}: applicantId`, 100, true);
            const result = (0, input_js_1.text)(row.result, `Result ${i + 1}: result`, 40, false);
            return { applicantId, result };
        });
        const out = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
                throw (0, input_js_1.bad)('Project not found', 404);
            if (bankAccount && !(await c.query(`SELECT 1 FROM company_bank_accounts WHERE id = $1`, [bankAccount])).rows.length)
                throw (0, input_js_1.bad)('Company bank account not found');
            let matched = 0, refundsCreated = 0, skipped = 0;
            const mismatches = [];
            for (const row of rows) {
                const p = (await c.query(`SELECT id, lead_stage, allocated_unit_id FROM consumers WHERE project_id = $2 AND (aadhaar_hash = $1 OR aadhaar_hash = $3 OR registration_no = $1 OR mobile = $1) ORDER BY id LIMIT 1 FOR UPDATE`, [row.applicantId, projectId, (0, applicant_fields_js_1.sha)(row.applicantId.replace(/[\s-]/g, ''))])).rows[0];
                if (!p) {
                    mismatches.push({ applicantId: row.applicantId, reason: 'Applicant not found' });
                    continue;
                }
                matched++;
                if (p.lead_stage === 'application_filed')
                    await c.query(`UPDATE consumers SET lead_stage = 'draw_entered' WHERE id = $1`, [p.id]);
                if (row.result === 'unsuccessful' || row.result === 'unsuccessful_draw') {
                    if (p.allocated_unit_id) {
                        skipped++;
                        mismatches.push({ applicantId: row.applicantId, reason: 'Applicant already holds a unit, no refund created' });
                        continue;
                    }
                    // Importing the same file twice must not create the refund twice
                    if ((await c.query(`SELECT 1 FROM draw_refunds WHERE consumer_id = $1 AND project_id = $2 AND draw_result = 'unsuccessful' LIMIT 1`, [p.id, projectId])).rows.length) {
                        skipped++;
                        continue;
                    }
                    const paid = parseFloat((await c.query(`SELECT COALESCE(SUM(amount_received_inr), 0) AS s FROM receipts WHERE consumer_id = $1 AND status = 'cleared'`, [p.id])).rows[0].s);
                    if (paid > 0) {
                        await c.query(`INSERT INTO draw_refunds (consumer_id, project_id, draw_result, booking_amount_paid_inr, refund_amount_inr, refund_due_by, refund_status, created_by_user_id, company_bank_account_id)
               VALUES ($1, $2, 'unsuccessful', $3, $3, ${business_date_js_1.SQL_TODAY} + INTERVAL '30 days', 'pending', $4, $5)`, [p.id, projectId, paid, req.userId, bankAccount]);
                        await c.query(`UPDATE consumers SET lead_stage = 'cancelled' WHERE id = $1`, [p.id]);
                        refundsCreated++;
                    }
                }
            }
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'edraw_import', projectId, undefined, { results: rows.length, matched, refunds_created: refundsCreated, skipped });
            const count = (re) => rows.filter((r) => r.result && re.test(r.result)).length;
            return { totalResults: rows.length, allotted: count(/^(allotted|successful)$/), waitlisted: count(/^waitlist/), unsuccessful: count(/^unsuccessful/), errors: mismatches.filter((m) => m.reason === 'Applicant not found').length, matched, mismatched: mismatches.filter((m) => m.reason === 'Applicant not found').length, mismatches, refundsCreated, skipped };
        });
        res.json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/allocations/shift - move an applicant to another unit of the same project. The booking, payment plan, allocation and pending commission move with the applicant;
// the new unit takes the status the old one had and the old unit becomes available. (Prices are not recalculated.)
router.post('/shift', (0, processPermission_js_1.requireProcess)('unit_shifting', 'maker'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumerId) || !(0, input_js_1.has)(b.newUnitId))
            throw (0, input_js_1.bad)('consumerId and newUnitId are required');
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), newUnitId = (0, input_js_1.uuid)(b.newUnitId, 'newUnitId');
        const reason = (0, input_js_1.text)(b.reason, 'reason', 500, false), date = pastDay(b.shiftDate, 'shiftDate') || (0, business_date_js_1.businessToday)();
        const out = await (0, input_js_1.inTx)(async (c) => {
            const person = (await c.query(`SELECT id, allocated_unit_id FROM consumers WHERE id = $1`, [consumerId])).rows[0];
            if (!person)
                throw (0, input_js_1.bad)('Applicant not found', 404);
            if (!person.allocated_unit_id)
                throw (0, input_js_1.bad)('Consumer has no active unit allocation');
            const oldUnitId = person.allocated_unit_id;
            if (oldUnitId === newUnitId)
                throw (0, input_js_1.bad)('The applicant already holds that unit');
            // Both units locked in id order, so two shifts cannot wait on each other
            for (const u of [oldUnitId, newUnitId].sort())
                await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`alloc-unit:${u}`]);
            await c.query(`SELECT id FROM consumers WHERE id = $1 FOR UPDATE`, [consumerId]);
            const cur = (await c.query(`SELECT allocated_unit_id FROM consumers WHERE id = $1`, [consumerId])).rows[0];
            if (cur.allocated_unit_id !== oldUnitId)
                throw (0, input_js_1.bad)('The applicant\'s unit changed meanwhile, try again', 409);
            const units = (await c.query(`SELECT id, status, unit_number, project_id FROM units WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[oldUnitId, newUnitId]])).rows;
            const oldU = units.find((u) => u.id === oldUnitId), newU = units.find((u) => u.id === newUnitId);
            if (!newU)
                throw (0, input_js_1.bad)('New unit not found', 404);
            if (newU.status !== 'available')
                throw (0, input_js_1.bad)('New unit is not available');
            if (newU.project_id !== oldU.project_id)
                throw (0, input_js_1.bad)('The new unit must be in the same project');
            if ((await c.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND status <> 'cancelled' LIMIT 1`, [newUnitId])).rows.length)
                throw (0, input_js_1.bad)('The new unit has a booking', 409);
            await c.query(`INSERT INTO unit_shifts (consumer_id, old_unit_id, new_unit_id, reason, shift_date, shifted_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)`, [consumerId, oldUnitId, newUnitId, reason, date, req.userId]);
            await c.query(`UPDATE allocations SET unit_id = $1, updated_at = NOW() WHERE consumer_id = $2 AND unit_id = $3 AND status NOT IN ('cancelled', 'transferred')`, [newUnitId, consumerId, oldUnitId]);
            await c.query(`UPDATE booking_records SET unit_id = $1 WHERE consumer_id = $2 AND unit_id = $3 AND status <> 'cancelled'`, [newUnitId, consumerId, oldUnitId]);
            await c.query(`UPDATE payment_plans SET unit_id = $1 WHERE consumer_id = $2 AND unit_id = $3`, [newUnitId, consumerId, oldUnitId]);
            await c.query(`UPDATE broker_commissions SET unit_id = $1 WHERE consumer_id = $2 AND unit_id = $3 AND status = 'pending'`, [newUnitId, consumerId, oldUnitId]);
            await c.query(`UPDATE consumers SET allocated_unit_id = $1 WHERE id = $2`, [newUnitId, consumerId]);
            await c.query(`UPDATE units SET status = $2, status_changed_at = NOW() WHERE id = $1`, [newUnitId, oldU.status]);
            await c.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`, [oldUnitId]);
            await history(c, newUnitId, 'available', oldU.status, req.userId, `Unit shifting from ${oldU.unit_number}`);
            await history(c, oldUnitId, oldU.status, 'available', req.userId, `Unit shifting to ${newU.unit_number}`);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'unit_shift', consumerId, { unit_id: oldUnitId }, { unit_id: newUnitId, reason });
            return { consumer_id: consumerId, old_unit_id: oldUnitId, new_unit_id: newUnitId, new_unit_number: newU.unit_number };
        });
        res.json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/allocations/shifts - unit shift history
router.get('/shifts', async (req, res, next) => {
    try {
        const q = req.query;
        const params = [];
        const add = (v) => `$${params.push(v)}`;
        let where = '';
        if ((0, input_js_1.has)(q.projectId))
            where += ` AND nu.project_id = ${add((0, input_js_1.uuid)(q.projectId, 'projectId'))}`;
        const from = (0, input_js_1.day)(q.from, 'from');
        if (from)
            where += ` AND us.shift_date >= ${add(from)}`;
        const to = (0, input_js_1.day)(q.to, 'to');
        if (to)
            where += ` AND us.shift_date <= ${add(to)}`;
        if (from && to && from > to)
            throw (0, input_js_1.bad)('from must not be after to');
        const pageSize = int(q.pageSize, 'pageSize', 1, 1000, 100);
        const result = await index_js_1.db.query(`SELECT us.*, c.name AS consumer_name, c.mobile, ou.unit_number AS old_unit_number, nu.unit_number AS new_unit_number, p.name AS project_name
         FROM unit_shifts us JOIN consumers c ON c.id = us.consumer_id LEFT JOIN units ou ON ou.id = us.old_unit_id LEFT JOIN units nu ON nu.id = us.new_unit_id LEFT JOIN projects p ON p.id = nu.project_id
        WHERE TRUE ${where} ORDER BY us.shift_date DESC, us.created_at DESC, us.id LIMIT ${add(pageSize)}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/allocations/generate-letters - an allotment letter record for every allotted applicant that has none (once, even if two people click at the same moment)
router.post('/generate-letters', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)((0, input_js_1.body)(req).projectId) ? (0, input_js_1.uuid)((0, input_js_1.body)(req).projectId, 'projectId') : null;
        const out = await (0, input_js_1.inTx)(async (c) => {
            const rows = await c.query(`SELECT a.id, a.consumer_id, a.unit_id, a.allotment_date FROM allocations a JOIN units u ON a.unit_id = u.id
          WHERE a.status::text = 'allotted' AND a.allotment_letter_id IS NULL AND ($1::uuid IS NULL OR u.project_id = $1) ORDER BY a.id FOR UPDATE OF a`, [projectId]);
            for (const a of rows.rows) {
                const l = await c.query(`INSERT INTO allotment_letters (allocation_id, consumer_id, unit_id, letter_date) VALUES ($1, $2, $3, COALESCE($4, ${business_date_js_1.SQL_TODAY})) RETURNING id`, [a.id, a.consumer_id, a.unit_id, a.allotment_date || null]);
                await c.query(`UPDATE allocations SET allotment_letter_id = $1 WHERE id = $2`, [l.rows[0].id, a.id]);
            }
            if (rows.rows.length)
                await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'allotment_letters', projectId || rows.rows[0].id, undefined, { generated: rows.rows.length });
            return { total: rows.rows.length, generated: rows.rows.length, message: `${rows.rows.length} allotment letter(s) queued for generation` };
        });
        res.json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=allocations.js.map