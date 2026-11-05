"use strict";
/**
 * Payment Routes - Module D
 * Payment plans, demand letters, receipts, HRERA Rule 15 penal interest
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tds_js_1 = require("../utils/tds.js");
const express_1 = require("express");
const index_js_1 = require("../index.js");
const document_recalc_js_1 = require("../utils/document-recalc.js");
const payment_waterfall_js_1 = require("../utils/payment-waterfall.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const input_js_1 = require("../utils/input.js");
const penal_interest_js_1 = require("../utils/penal-interest.js");
const company_bank_js_1 = require("../utils/company-bank.js");
const financial_ops_js_1 = require("./financial-ops.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const gst_resolver_js_1 = require("../utils/gst-resolver.js");
const penal_rate_js_1 = require("../utils/penal-rate.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
/**
 * Calculate Penal Interest (Late Payment Penalty)
 * Rate: the penal_interest_rate_percent setting (utils/penal-rate.ts)
 */
const getPenalInterestRate = async (projectId) => {
    try {
        if (projectId) {
            const projRate = await index_js_1.db.query(`SELECT rate_percent FROM project_interest_rates WHERE project_id = $1 AND effective_from <= ${business_date_js_1.SQL_TODAY} ORDER BY effective_from DESC LIMIT 1`, [projectId]);
            if (projRate.rows.length > 0)
                return parseFloat(projRate.rows[0].rate_percent);
        }
        return await (0, penal_rate_js_1.getPenalRate)(index_js_1.db);
    }
    catch {
        return penal_rate_js_1.DEFAULT_PENAL_RATE;
    }
};
const calculatePenalInterest = (principalInr, daysOverdue, rate = penal_rate_js_1.DEFAULT_PENAL_RATE) => {
    return Math.round((principalInr * rate * daysOverdue / 365) / 100);
};
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
const optId = (v, label) => ((0, input_js_1.has)(v) ? (0, input_js_1.uuid)(v, label) : null);
const today = () => (0, business_date_js_1.businessToday)();
// POST /api/payments/payment-plans - Create the standard 8-step payment schedule for an allocation (accounts and finance only)
router.post('/payment-plans', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        for (const k of ['allocationId', 'consumerId', 'unitId', 'projectId', 'totalAmountInr'])
            if (!(0, input_js_1.has)(b[k]))
                throw (0, input_js_1.bad)(`${k} is required`);
        const allocationId = (0, input_js_1.uuid)(b.allocationId, 'allocationId'), consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), unitId = (0, input_js_1.uuid)(b.unitId, 'unitId'), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const totalAmountInr = (0, input_js_1.pos)(b.totalAmountInr, 'totalAmountInr', 0), allotmentDate = (0, input_js_1.day)(b.allotmentDate, 'allotmentDate');
        const planOut = await (0, input_js_1.inTx)(async (client) => {
            const al = (await client.query(`SELECT consumer_id, unit_id, project_id, status FROM allocations WHERE id = $1 FOR UPDATE`, [allocationId])).rows[0];
            if (!al)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            if (al.consumer_id !== consumerId || al.unit_id !== unitId || al.project_id !== projectId)
                throw (0, input_js_1.bad)('The allocation does not belong to this applicant, unit and project');
            if (['cancelled', 'transferred'].includes(al.status))
                throw (0, input_js_1.bad)(`This allocation is ${al.status}`, 409);
            if ((await client.query(`SELECT 1 FROM payment_plans WHERE allocation_id = $1 OR (consumer_id = $2 AND unit_id = $3)`, [allocationId, consumerId, unitId])).rows.length)
                throw (0, input_js_1.bad)('This allocation already has a payment plan', 409);
            const planId = (await client.query(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [allocationId, consumerId, unitId, projectId, totalAmountInr, req.userId])).rows[0].id;
            // Dynamic Schedule Generator
            const d = new Date(allotmentDate || (0, business_date_js_1.businessDayStart)());
            const m = (days) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd.toISOString().split('T')[0]; };
            const schedule = [
                { sn: 1, name: 'At the time of Application', pct: 5, due: m(0) },
                { sn: 2, name: 'Within 15 days of Allotment', pct: 20, due: m(15) },
                { sn: 3, name: 'Within 6 months from Allotment', pct: 12.5, due: m(180) },
                { sn: 4, name: 'Within 12 months from Allotment', pct: 12.5, due: m(360) },
                { sn: 5, name: 'Within 18 months from Allotment', pct: 12.5, due: m(540) },
                { sn: 6, name: 'Within 24 months from Allotment', pct: 12.5, due: m(720) },
                { sn: 7, name: 'Within 30 months from Allotment', pct: 12.5, due: m(900) },
                { sn: 8, name: 'Within 36 months from Allotment', pct: 12.5, due: m(1080) },
            ];
            const gstSettingsRes = await client.query(`SELECT key, value FROM global_settings WHERE key IN ('basic_cgst_percent', 'basic_sgst_percent')`);
            const gstSettings = Object.fromEntries(gstSettingsRes.rows.map((r) => [r.key, parseFloat(r.value)]));
            const legacyCgstPct = (gstSettings['basic_cgst_percent'] ?? 0.5) / 100;
            const legacySgstPct = (gstSettings['basic_sgst_percent'] ?? 0.5) / 100;
            let given = 0;
            for (const s of schedule) {
                const amt = s.sn === schedule.length ? totalAmountInr - given : Math.round(totalAmountInr * (s.pct / 100)); // the last step takes the rounding, the steps always add up to the total
                given += amt;
                const cgst = Math.round(amt * legacyCgstPct), sgst = Math.round(amt * legacySgstPct);
                await client.query(`INSERT INTO demands (payment_plan_id, consumer_id, installment_index, amount_due_inr, cgst_amount, sgst_amount, due_date, status, demand_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`, [planId, consumerId, s.sn, amt, cgst, sgst, s.due, s.name]);
            }
            await client.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks) VALUES ($1, $2, 'SCHEDULE_GENERATION', $3, 'AHP Payment Schedule Generated')`, [consumerId, req.userId, JSON.stringify({ allotment_date: allotmentDate, schedule })]);
            return { planId, schedule };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'payment_plan', planOut.planId, undefined, { allocation_id: allocationId, total_amount_inr: totalAmountInr });
        res.status(201).json({ success: true, data: planOut });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/overdue - List overdue payments with HRERA interest (paid and cancelled demands are not overdue)
router.get('/overdue', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT
        d.id, d.payment_plan_id, d.consumer_id, d.amount_due_inr, d.due_date,
        EXTRACT(DAY FROM NOW() - d.due_date)::INT as days_overdue,
        c.name as consumer_name, c.mobile
       FROM demands d
       JOIN consumers c ON d.consumer_id = c.id
       WHERE d.due_date < NOW() AND d.status NOT IN ('paid', 'cancelled')
       ORDER BY days_overdue DESC`);
        // Calculate penal interest for each
        const penalRate = await getPenalInterestRate();
        const data = result.rows.map((row) => ({
            ...row,
            penalInterestInr: row.days_overdue > 0 ? calculatePenalInterest(row.amount_due_inr, row.days_overdue, penalRate) : 0,
        }));
        res.json({ success: true, data });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/dashboard - Payment dashboard KPIs (live receipts only, unpaid demands only, one project when projectId is given)
router.get('/dashboard', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const result = await index_js_1.db.query(`SELECT
         COALESCE((SELECT SUM(total_amount_inr) FROM payment_plans WHERE $1::uuid IS NULL OR project_id = $1), 0) AS total_receivables,
         COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r JOIN payment_plans p ON p.id = r.payment_plan_id
                    WHERE r.status NOT IN ('cancelled', 'bounced') AND ($1::uuid IS NULL OR p.project_id = $1)), 0) AS total_collected,
         (SELECT COUNT(*) FROM demands d JOIN payment_plans p ON p.id = d.payment_plan_id
           WHERE d.due_date < NOW() AND d.status NOT IN ('paid', 'cancelled') AND ($1::uuid IS NULL OR p.project_id = $1)) AS overdue_count`, [projectId]);
        const totalReceivables = Number(result.rows[0].total_receivables), totalCollected = Number(result.rows[0].total_collected), overdueCount = Number(result.rows[0].overdue_count);
        res.json({
            success: true,
            data: { kpis: {
                    totalReceivables, totalCollected,
                    collectionPercentage: totalReceivables > 0 ? Math.round((totalCollected / totalReceivables) * 100) : 0,
                    outstanding: totalReceivables - totalCollected,
                    overdueCount,
                } },
        });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── GST invoices ──────────────────────────────────────────────────────────────
// The columns as the Invoicing screen reads them (invoice_number, base_amount, gst_amount, gst_rate ...) next to the table's own
const INVOICE_COLS = `gi.*, gi.invoice_no AS invoice_number, gi.base_amount_inr::float8 AS base_amount,
  (COALESCE(gi.cgst_amount_inr,0) + COALESCE(gi.sgst_amount_inr,0) + COALESCE(gi.igst_amount_inr,0))::float8 AS gst_amount,
  gi.cgst_amount_inr::float8 AS cgst_amount, gi.sgst_amount_inr::float8 AS sgst_amount, gi.igst_amount_inr::float8 AS igst_amount, gi.total_amount_inr::float8 AS total_amount,
  (COALESCE(gi.cgst_rate,0) + COALESCE(gi.sgst_rate,0) + COALESCE(gi.igst_rate,0))::float8 AS gst_rate`;
const INVOICE_STATUS = ['pending', 'generated', 'cancelled'];
const INVOICE_TYPES = ['tax_invoice', 'proforma', 'receipt_voucher', 'invoice'];
// GET /api/payments/gst-invoices - List GST invoices
router.get('/gst-invoices', async (req, res, next) => {
    try {
        const q = req.query, params = [];
        let where = '';
        if ((0, input_js_1.has)(q.consumerId))
            where += ` AND gi.consumer_id = $${params.push((0, input_js_1.uuid)(q.consumerId, 'consumerId'))}`;
        if ((0, input_js_1.has)(q.projectId))
            where += ` AND gi.project_id = $${params.push((0, input_js_1.uuid)(q.projectId, 'projectId'))}`;
        const status = (0, input_js_1.oneOf)(q.status, 'status', INVOICE_STATUS);
        if (status)
            where += ` AND gi.status = $${params.push(status)}`;
        const no = (0, input_js_1.qtext)(q.invoiceNumber, 'invoiceNumber', 50);
        if (no)
            where += ` AND gi.invoice_no = $${params.push(no)}`;
        const from = (0, input_js_1.day)(q.from, 'from'), to = (0, input_js_1.day)(q.to, 'to');
        if (from)
            where += ` AND gi.invoice_date >= $${params.push(from)}`;
        if (to)
            where += ` AND gi.invoice_date <= $${params.push(to)}`;
        const { size, offset } = (0, input_js_1.paging)(q, 100, 1000);
        const result = await index_js_1.db.query(`SELECT ${INVOICE_COLS}, c.name AS consumer_name, p.name AS project_name
         FROM gst_invoices gi JOIN consumers c ON gi.consumer_id = c.id JOIN projects p ON gi.project_id = p.id
        WHERE 1=1 ${where} ORDER BY gi.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/payments/gst-invoices - Create a GST invoice (accounts and finance only)
// The tax is worked out here from the base amount and the rate: whatever tax or total the screen sends is ignored.
router.post('/gst-invoices', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumerId))
            throw (0, input_js_1.bad)('consumerId is required');
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), baseRaw = b.baseAmountInr ?? b.baseAmount;
        if (!(0, input_js_1.has)(baseRaw))
            throw (0, input_js_1.bad)('baseAmount is required');
        const base = (0, input_js_1.pos)(baseRaw, 'baseAmount'), supply = (0, input_js_1.oneOf)(b.supplyType, 'supplyType', ['intrastate', 'interstate']) || 'intrastate';
        const type = (0, input_js_1.oneOf)(b.invoiceType, 'invoiceType', INVOICE_TYPES) || 'invoice', invoiceDate = (0, input_js_1.day)(b.invoiceDate, 'invoiceDate') || today();
        const projectArg = optId(b.projectId, 'projectId'), unitArg = optId(b.unitId, 'unitId'), receiptId = optId(b.receiptId, 'receiptId');
        const desc = (0, input_js_1.text)(b.installmentName ?? b.description, 'description', 100, false), hsn = (0, input_js_1.text)(b.hsnCode, 'hsnCode', 20, false) || '9972';
        if ((0, input_js_1.has)(b.buyerGstin) && !(typeof b.buyerGstin === 'string' && /^[0-9A-Z]{15}$/.test(b.buyerGstin.trim().toUpperCase())))
            throw (0, input_js_1.bad)('buyerGstin must be 15 letters and digits');
        const gstin = (0, input_js_1.has)(b.buyerGstin) ? b.buyerGstin.trim().toUpperCase() : null;
        if (invoiceDate > (0, business_date_js_1.businessTomorrow)())
            throw (0, input_js_1.bad)('The invoice date cannot be in the future');
        const rate = (v, label) => (0, input_js_1.num)(v, label, 28, 2);
        let cgstRate, sgstRate, igstRate;
        if ((0, input_js_1.has)(b.cgstRate) || (0, input_js_1.has)(b.sgstRate) || (0, input_js_1.has)(b.igstRate)) {
            cgstRate = (0, input_js_1.has)(b.cgstRate) ? rate(b.cgstRate, 'cgstRate') : 0;
            sgstRate = (0, input_js_1.has)(b.sgstRate) ? rate(b.sgstRate, 'sgstRate') : 0;
            igstRate = (0, input_js_1.has)(b.igstRate) ? rate(b.igstRate, 'igstRate') : 0;
            if (igstRate > 0 && (cgstRate > 0 || sgstRate > 0))
                throw (0, input_js_1.bad)('An invoice carries IGST or CGST and SGST, not both');
        }
        else if ((0, input_js_1.has)(b.gstRate)) {
            const g = rate(b.gstRate, 'gstRate');
            [cgstRate, sgstRate, igstRate] = supply === 'interstate' ? [0, 0, g] : [(0, input_js_1.r2)(g / 2), (0, input_js_1.r2)(g / 2), 0];
        }
        else {
            cgstRate = 9;
            sgstRate = 9;
            igstRate = 0;
        }
        const cgst = (0, input_js_1.r2)(base * cgstRate / 100), sgst = (0, input_js_1.r2)(base * sgstRate / 100), igst = (0, input_js_1.r2)(base * igstRate / 100);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const al = (await c.query(`SELECT unit_id, project_id FROM allocations WHERE consumer_id = $1 AND status NOT IN ('cancelled', 'transferred') ORDER BY created_at DESC LIMIT 1`, [consumerId])).rows[0];
            if (!(await c.query(`SELECT 1 FROM consumers WHERE id = $1`, [consumerId])).rows.length)
                throw (0, input_js_1.bad)('Applicant not found', 404);
            const projectId = projectArg || al?.project_id;
            if (!projectId)
                throw (0, input_js_1.bad)('This applicant has no unit yet, send projectId');
            if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
                throw (0, input_js_1.bad)('Project not found', 404);
            if (receiptId) {
                const rc = (await c.query(`SELECT consumer_id, status, amount_received_inr FROM receipts WHERE id = $1 FOR UPDATE`, [receiptId])).rows[0];
                if (!rc || rc.consumer_id !== consumerId)
                    throw (0, input_js_1.bad)('That receipt does not belong to this applicant', 400);
                if (['cancelled', 'bounced'].includes(rc.status))
                    throw (0, input_js_1.bad)(`That receipt is ${rc.status}`, 409);
                // an invoice against a receipt cannot tax more than the money received (a 2.8 lakh receipt once got a 30 crore invoice)
                if (base > Number(rc.amount_received_inr))
                    throw (0, input_js_1.bad)(`The taxable amount cannot be more than the receipt amount (₹${Number(rc.amount_received_inr).toLocaleString('en-IN')})`, 400);
                if ((await c.query(`SELECT 1 FROM gst_invoices WHERE receipt_id = $1 AND status <> 'cancelled'`, [receiptId])).rows.length)
                    throw (0, input_js_1.bad)('An invoice was already generated for this receipt', 409);
            }
            const invoiceNo = await (0, penal_interest_js_1.nextNumber)(c, 'gst_invoices', 'invoice_no', 'INV', 5);
            return (await c.query(`INSERT INTO gst_invoices (invoice_no, invoice_date, invoice_type, project_id, consumer_id, unit_id, receipt_id, installment_name, base_amount_inr, taxable_amount_inr,
           cgst_rate, sgst_rate, igst_rate, cgst_amount_inr, sgst_amount_inr, igst_amount_inr, total_amount_inr, supply_type, hsn_sac_code, status, created_by_user_id, buyer_gstin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'generated',$19,$20) RETURNING id`, [invoiceNo, invoiceDate, type, projectId, consumerId, unitArg || al?.unit_id || null, receiptId, desc || 'Direct Payment', base, cgstRate, sgstRate, igstRate, cgst, sgst, igst, (0, input_js_1.r2)(base + cgst + sgst + igst), supply, hsn, req.userId, gstin])).rows[0].id;
        });
        const out = (await index_js_1.db.query(`SELECT ${INVOICE_COLS} FROM gst_invoices gi WHERE gi.id = $1`, [row])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'gst_invoice', row, undefined, { invoice_no: out.invoice_no, consumer_id: consumerId, total_amount_inr: out.total_amount_inr });
        res.status(201).json({ success: true, data: out });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// Cancels (or reverses) an invoice and issues a credit note for what the invoice still charged. Checker access, because the note is issued in one step.
const cancelInvoice = (reverse) => async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.invoiceNumber))
            throw (0, input_js_1.bad)('invoiceNumber is required');
        const invoiceNumber = (0, input_js_1.text)(b.invoiceNumber, 'invoiceNumber', 50, true), reason = (0, input_js_1.text)(b.reason, 'reason', 500, false) || (reverse ? 'Invoice reversed' : 'Invoice cancelled');
        const noteDate = (0, input_js_1.day)(reverse ? b.reversalDate : undefined, 'reversalDate');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const inv = (await c.query(`SELECT * FROM gst_invoices WHERE invoice_no = $1 FOR UPDATE`, [invoiceNumber])).rows[0];
            if (!inv)
                throw (0, input_js_1.bad)('Invoice not found', 404);
            if (inv.status === 'cancelled')
                throw (0, input_js_1.bad)('This invoice is already cancelled', 409);
            // Credit notes already issued on this invoice are not credited twice; notes still waiting are withdrawn
            await c.query(`UPDATE credit_debit_notes SET status = 'cancelled', rejected_by = $2, rejected_at = NOW(), rejection_reason = 'Invoice cancelled', updated_at = NOW() WHERE invoice_id = $1 AND status = 'pending'`, [inv.id, req.userId]);
            const credited = Number((await c.query(`SELECT COALESCE(SUM(adjustment_amount), 0) AS n FROM credit_debit_notes WHERE invoice_id = $1 AND note_type = 'credit' AND status = 'issued'`, [inv.id])).rows[0].n);
            const debited = Number((await c.query(`SELECT COALESCE(SUM(adjustment_amount), 0) AS n FROM credit_debit_notes WHERE invoice_id = $1 AND note_type = 'debit' AND status = 'issued'`, [inv.id])).rows[0].n);
            const adj = (0, input_js_1.r2)(Number(inv.taxable_amount_inr) + debited - credited);
            let note = null;
            if (adj > 0) {
                const tax = (0, input_js_1.r2)(Number(inv.cgst_amount_inr) + Number(inv.sgst_amount_inr) + Number(inv.igst_amount_inr));
                const gstAmt = adj === Number(inv.taxable_amount_inr) ? tax : (0, input_js_1.r2)(adj * (Number(inv.cgst_rate) + Number(inv.sgst_rate) + Number(inv.igst_rate)) / 100);
                const no = await (0, penal_interest_js_1.nextNumber)(c, 'credit_debit_notes', 'note_number', 'CDN', 4);
                note = (await c.query(`INSERT INTO credit_debit_notes (consumer_id, invoice_id, note_number, note_type, original_invoice_no, adjustment_amount, gst_rate, gst_amount, total_amount, note_date, reason, status, created_by_user_id, approved_by, approved_at)
           VALUES ($1,$2,$3,'credit',$4,$5,$6,$7,$8,COALESCE($9::date, ${business_date_js_1.SQL_TODAY}),$10,'issued',$11,$11,NOW()) RETURNING *`, [inv.consumer_id, inv.id, no, invoiceNumber, adj, (0, input_js_1.r2)(Number(inv.cgst_rate) + Number(inv.sgst_rate) + Number(inv.igst_rate)), gstAmt, (0, input_js_1.r2)(adj + gstAmt), noteDate, reason, req.userId])).rows[0];
            }
            await c.query(`UPDATE gst_invoices SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = $2, updated_at = NOW() WHERE id = $1`, [inv.id, reason]);
            return { id: inv.id, note };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'gst_invoice', out.id, { status: 'generated' }, { status: 'cancelled', reason, credit_note: out.note?.note_number });
        res.json({
            success: true,
            data: { invoiceNumber, status: 'cancelled', reason, creditNoteNumber: out.note?.note_number || null, creditNote: out.note },
            message: out.note ? 'Invoice cancelled and credit note issued' : 'Invoice cancelled (it was already fully credited)',
        });
    }
    catch (error) {
        fail(error, res, next);
    }
};
// POST /api/payments/gst-invoices/cancel and /reverse - the Cancel and Reverse tabs
router.post('/gst-invoices/cancel', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), input_js_1.financeOnly, cancelInvoice(false));
router.post('/gst-invoices/reverse', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), input_js_1.financeOnly, cancelInvoice(true));
// POST /api/payments/gst-invoices/credit-debit-note - the Credit / Debit Note tab: raises a note that a checker approves
router.post('/gst-invoices/credit-debit-note', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const row = await (0, financial_ops_js_1.raiseNote)(req, { note_type: b.noteType, original_invoice_no: b.originalInvoiceNumber, adjustment_amount: b.adjustmentAmount, gst_rate: b.gstRate, note_date: b.noteDate, reason: b.reason });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'credit_debit_note', row.id, undefined, { note_number: row.note_number, note_type: row.note_type, total_amount: row.total_amount });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/gst-invoices/:id/html (also /pdf) - the invoice as a printable page (print to PDF from the browser)
const invoicePage = async (req, res, next) => {
    try {
        const r = (await index_js_1.db.query(`SELECT ${INVOICE_COLS}, c.name AS consumer_name, c.registration_no, c.present_address, p.name AS project_name, u.unit_number
         FROM gst_invoices gi JOIN consumers c ON c.id = gi.consumer_id JOIN projects p ON p.id = gi.project_id LEFT JOIN units u ON u.id = gi.unit_id WHERE gi.id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Invoice id')])).rows[0];
        if (!r)
            throw (0, input_js_1.bad)('Invoice not found', 404);
        const e = pmtEsc, m = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const row = (k, v) => `<tr><td style="padding:4px 10px;color:#555">${k}</td><td style="padding:4px 10px"><b>${v}</b></td></tr>`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(r.invoice_no)}</title></head><body style="font-family:Arial,sans-serif;font-size:13px;max-width:720px;margin:24px auto">
<h2 style="margin:0">${e(String(r.invoice_type || 'invoice').replace(/_/g, ' ').toUpperCase())}${r.status === 'cancelled' ? ' (CANCELLED)' : ''}</h2>
<table style="margin:12px 0;border-collapse:collapse">${row('Invoice No.', e(r.invoice_no))}${row('Date', e(String(r.invoice_date).slice(0, 10)))}${row('Project', e(r.project_name))}${row('Unit', e(r.unit_number || '-'))}
${row('Buyer', e(r.consumer_name))}${row('Registration No.', e(r.registration_no || '-'))}${row('Buyer GSTIN', e(r.buyer_gstin || '-'))}${row('Description', e(r.installment_name || '-'))}${row('HSN / SAC', e(r.hsn_sac_code || '-'))}</table>
<table style="border-collapse:collapse;width:100%;border:1px solid #ccc"><tbody>
${row('Taxable amount', '&#8377; ' + m(r.base_amount))}${r.cgst_amount ? row(`CGST (${r.cgst_rate}%)`, '&#8377; ' + m(r.cgst_amount)) : ''}${r.sgst_amount ? row(`SGST (${r.sgst_rate}%)`, '&#8377; ' + m(r.sgst_amount)) : ''}${r.igst_amount ? row(`IGST (${r.igst_rate}%)`, '&#8377; ' + m(r.igst_amount)) : ''}${row('Total', '&#8377; ' + m(r.total_amount))}</tbody></table>
<p style="margin-top:20px"><button onclick="window.print()">Print</button></p></body></html>`);
    }
    catch (error) {
        fail(error, res, next);
    }
};
router.get('/gst-invoices/:id/html', invoicePage);
router.get('/gst-invoices/:id/pdf', invoicePage);
// GET /api/payments/gst-invoices-export?type=gstr1|gstr3b&month=YYYY-MM[&projectId=] - CSV for the filing (cancelled invoices left out, credit and debit notes netted)
router.get('/gst-invoices-export', async (req, res, next) => {
    try {
        const type = (0, input_js_1.oneOf)(req.query.type, 'type', ['gstr1', 'gstr3b']) || 'gstr1';
        const month = (0, input_js_1.qtext)(req.query.month, 'month', 7);
        if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
            throw (0, input_js_1.bad)('month must be YYYY-MM');
        const from = `${month}-01`, to = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5), 0)).toISOString().slice(0, 10);
        const params = [from, to];
        let more = '';
        if ((0, input_js_1.has)(req.query.projectId))
            more = ` AND gi.project_id = $${params.push((0, input_js_1.uuid)(req.query.projectId, 'projectId'))}`;
        const cell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t))
            t = "'" + t; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
        const csv = (head, rows) => [head, ...rows].map((l) => l.map(cell).join(',')).join('\n') + '\n';
        let out;
        if (type === 'gstr1') {
            const rows = (await index_js_1.db.query(`SELECT gi.invoice_no, gi.invoice_date, gi.buyer_gstin, c.name, gi.supply_type, gi.base_amount_inr, gi.cgst_rate + gi.sgst_rate + gi.igst_rate AS rate, gi.cgst_amount_inr, gi.sgst_amount_inr, gi.igst_amount_inr, gi.total_amount_inr
           FROM gst_invoices gi JOIN consumers c ON c.id = gi.consumer_id WHERE gi.status <> 'cancelled' AND gi.invoice_date BETWEEN $1 AND $2${more} ORDER BY gi.invoice_date, gi.invoice_no`, params)).rows;
            const notes = (await index_js_1.db.query(`SELECT n.note_number, n.note_date, n.note_type, n.original_invoice_no, n.adjustment_amount, n.gst_rate, n.gst_amount, n.total_amount
           FROM credit_debit_notes n JOIN gst_invoices gi ON gi.id = n.invoice_id WHERE n.status = 'issued' AND n.note_date BETWEEN $1 AND $2${more} ORDER BY n.note_date, n.note_number`, params)).rows;
            out = csv(['Invoice No', 'Date', 'Buyer GSTIN', 'Buyer', 'Supply', 'Taxable', 'Rate %', 'CGST', 'SGST', 'IGST', 'Total'], rows.map((r) => [r.invoice_no, String(r.invoice_date).slice(0, 10), r.buyer_gstin, r.name, r.supply_type, r.base_amount_inr, r.rate, r.cgst_amount_inr, r.sgst_amount_inr, r.igst_amount_inr, r.total_amount_inr]))
                + '\n' + csv(['Note No', 'Date', 'Type', 'Original Invoice', 'Taxable', 'Rate %', 'Tax', 'Total'], notes.map((n) => [n.note_number, String(n.note_date).slice(0, 10), n.note_type, n.original_invoice_no, n.adjustment_amount, n.gst_rate, n.gst_amount, n.total_amount]));
        }
        else {
            const t = (await index_js_1.db.query(`SELECT COALESCE(SUM(gi.base_amount_inr),0) AS taxable, COALESCE(SUM(gi.cgst_amount_inr),0) AS cgst, COALESCE(SUM(gi.sgst_amount_inr),0) AS sgst, COALESCE(SUM(gi.igst_amount_inr),0) AS igst
           FROM gst_invoices gi WHERE gi.status <> 'cancelled' AND gi.invoice_date BETWEEN $1 AND $2${more}`, params)).rows[0];
            const n = (await index_js_1.db.query(`SELECT COALESCE(SUM(CASE WHEN n.note_type='credit' THEN -n.adjustment_amount ELSE n.adjustment_amount END),0) AS taxable, COALESCE(SUM(CASE WHEN n.note_type='credit' THEN -n.gst_amount ELSE n.gst_amount END),0) AS tax
           FROM credit_debit_notes n JOIN gst_invoices gi ON gi.id = n.invoice_id WHERE n.status = 'issued' AND n.note_date BETWEEN $1 AND $2${more}`, params)).rows[0];
            out = csv(['Month', 'Taxable (invoices)', 'CGST', 'SGST', 'IGST', 'Taxable (notes, net)', 'Tax (notes, net)'], [[month, t.taxable, t.cgst, t.sgst, t.igst, n.taxable, n.tax]]);
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-${month}.csv"`);
        res.send(out);
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/payments/calculate-interest - Calculate HRERA interest on overdue
router.post('/calculate-interest', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.principalInr) || !(0, input_js_1.has)(b.daysOverdue))
            throw (0, input_js_1.bad)('principalInr and daysOverdue are required');
        const principalInr = (0, input_js_1.num)(b.principalInr, 'principalInr', 1000000000, 2), daysOverdue = (0, input_js_1.num)(b.daysOverdue, 'daysOverdue', 36500, 0);
        const penalRate = await getPenalInterestRate();
        const interest = calculatePenalInterest(principalInr, daysOverdue, penalRate);
        res.json({ success: true, data: { principalInr, daysOverdue, ratePercent: penalRate, interestInr: interest, totalWithInterest: principalInr + interest } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Draw refunds (pending -> initiated -> completed) ───────────────────────────
const DRAW_STATUS = ['pending', 'initiated', 'completed'];
// GET /api/payments/draw-refunds - List all draw refunds
router.get('/draw-refunds', async (req, res, next) => {
    try {
        const q = req.query, params = [];
        let where = '';
        const status = (0, input_js_1.oneOf)(q.status, 'status', DRAW_STATUS);
        if (status)
            where += ` AND refund_status = $${params.push(status)}`;
        if ((0, input_js_1.has)(q.projectId))
            where += ` AND project_id = $${params.push((0, input_js_1.uuid)(q.projectId, 'projectId'))}`;
        const { size, offset } = (0, input_js_1.paging)(q, 20, 500);
        const result = await index_js_1.db.query(`SELECT id, consumer_id, project_id, draw_result, booking_amount_paid_inr, refund_amount_inr, refund_due_by, refund_status,
              refund_initiated_at, refund_completed_at, refund_reference, created_at
         FROM draw_refunds WHERE 1=1 ${where} ORDER BY refund_due_by ASC, id LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/draw-refunds/overdue - Get overdue draw refunds
router.get('/draw-refunds/overdue', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT id, consumer_id, project_id, draw_result, booking_amount_paid_inr, refund_amount_inr, refund_due_by, refund_status,
              refund_initiated_at, created_at, EXTRACT(DAY FROM (NOW() - refund_due_by))::INT as days_overdue
         FROM draw_refunds WHERE refund_due_by < ${business_date_js_1.SQL_TODAY} AND refund_status NOT IN ('completed') ORDER BY refund_due_by ASC`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// One step of a draw refund; the row is locked and must be in the state the step starts from
const drawStep = (from, to, set) => async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Draw refund id'), s = set(req);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT refund_status, initiated_by, consumer_id, refund_amount_inr FROM draw_refunds WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Draw refund not found', 404);
            if (cur.refund_status !== from)
                throw (0, input_js_1.bad)(`Draw refund is ${cur.refund_status}, it must be ${from} for this step`, 409);
            if (to === 'completed') {
                (0, financial_ops_js_1.notOwn)(req, cur.initiated_by);
                await (0, financial_ops_js_1.postRefundJournal)(c, req, cur.consumer_id, Number(cur.refund_amount_inr), `Draw refund ${id} paid`, cur.initiated_by);
            }
            return (await c.query(`UPDATE draw_refunds SET refund_status = '${to}', ${s.sql} updated_at = NOW() WHERE id = $1 RETURNING id, consumer_id, refund_status, refund_initiated_at, refund_completed_at`, [id, ...s.params])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'draw_refund', id, { refund_status: from }, { refund_status: to });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
};
// PATCH /api/payments/draw-refunds/:id/initiate - Initiate draw refund (accounts and finance only)
router.patch('/draw-refunds/:id/initiate', input_js_1.financeOnly, drawStep('pending', 'initiated', (req) => {
    const b = (0, input_js_1.body)(req);
    return { sql: 'refund_initiated_at = NOW(), initiated_by = $4, refund_reference = $2, notes = COALESCE($3, notes),', params: [(0, input_js_1.text)(b.refundReference, 'refundReference', 255, true), (0, input_js_1.text)(b.notes, 'notes', 500, false), req.userId] };
}));
// PATCH /api/payments/draw-refunds/:id/complete - Complete draw refund (accounts and finance only)
router.patch('/draw-refunds/:id/complete', input_js_1.financeOnly, drawStep('initiated', 'completed', (req) => ({ sql: 'refund_completed_at = NOW(), refund_reference = COALESCE($2, refund_reference),', params: [(0, input_js_1.text)((0, input_js_1.body)(req).refundReference, 'refundReference', 255, false)] })));
/**
 * PATCH /api/payments/receipts/:id/bounce - Mark receipt as bounced
 */
router.patch('/receipts/:id/bounce', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Receipt id');
        const b = (0, input_js_1.body)(req);
        const reason = (0, input_js_1.text)(b.reason, 'reason', 200, false);
        const penaltyAmount = (0, input_js_1.has)(b.penaltyAmount) ? (0, input_js_1.num)(b.penaltyAmount, 'penaltyAmount', 1000000, 0) : 500;
        await client.query('BEGIN');
        // 1. Get receipt details
        const receiptRes = await client.query(`SELECT consumer_id, demand_id, amount_received_inr, payment_plan_id, installment_index, status
       FROM receipts WHERE id = $1 FOR UPDATE`, [id]);
        if (receiptRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Receipt not found' });
        }
        let { consumer_id, demand_id, amount_received_inr, payment_plan_id, installment_index } = receiptRes.rows[0];
        if (receiptRes.rows[0].status === 'bounced' || receiptRes.rows[0].status === 'cancelled')
            throw (0, input_js_1.bad)(`Receipt is already ${receiptRes.rows[0].status}`, 409);
        // 1b. If receipt has no payment_plan_id, fall back to linked demand's plan
        if (!payment_plan_id && demand_id) {
            const demandPlan = await client.query(`SELECT payment_plan_id, installment_index FROM demands WHERE id = $1`, [demand_id]);
            if (demandPlan.rows.length > 0) {
                payment_plan_id = payment_plan_id || demandPlan.rows[0].payment_plan_id;
                installment_index = installment_index ?? demandPlan.rows[0].installment_index;
            }
        }
        // Use 999 as sentinel installment_index for penalty demands with no installment context
        installment_index = installment_index ?? 999;
        // 2. Update receipt status
        await client.query(`UPDATE receipts SET status = 'bounced', updated_at = NOW() WHERE id = $1`, [id]);
        await (0, tds_js_1.releaseTdsForReceipt)(client, id, 'Receipt bounced');
        // 3. Re-open the demand if linked, but only if no other valid receipt still covers it
        if (demand_id) {
            const stillValid = await client.query(`SELECT id FROM receipts WHERE demand_id = $1
         AND status NOT IN ('bounced', 'cancelled') LIMIT 1`, [demand_id]);
            if (stillValid.rows.length === 0) {
                await client.query(`UPDATE demands SET status = 'pending',
           delivery_status = 'queued', updated_at = NOW()
           WHERE id = $1`, [demand_id]);
            }
        }
        // 3b. Recompute booking_amount for the specific booking this receipt applies to
        const bounceScope = await (0, payment_waterfall_js_1.resolveBookingScope)(client, { payment_plan_id, demand_id });
        if (bounceScope) {
            await (0, payment_waterfall_js_1.recomputeBookingAmount)(client, consumer_id, bounceScope.unitId, bounceScope.projectId, bounceScope.paymentPlanId);
            await (0, payment_waterfall_js_1.recomputeBookingPaymentTaxes)(client, consumer_id, bounceScope.unitId, bounceScope.projectId);
        }
        // 3c. Reverse installment-1 auto-raise if no valid idx1 receipt remains.
        // Also covers Step-G receipts (installment_index NULL, so the check above
        // never matches them directly) by checking whether THIS receipt is the one
        // recorded as having triggered the original auto-raise.
        const bounceWasTrigger = await client.query(`SELECT 1 FROM audit_logs WHERE action = 'DEMAND_RAISE' AND new_values->>'trigger_receipt_id' = $1 LIMIT 1`, [id]);
        if ((installment_index === 1 || bounceWasTrigger.rows.length > 0) && payment_plan_id) {
            await (0, payment_waterfall_js_1.reverseInstallment1IfNoValidReceipt)(client, payment_plan_id);
        }
        // 4. Log the bounce
        await client.query(`INSERT INTO cheque_bounce_logs (receipt_id, consumer_id, bounce_date, penalty_amount_inr, reason)
       VALUES ($1, $2, ${business_date_js_1.SQL_TODAY}, $3, $4)`, [id, consumer_id, penaltyAmount, reason || 'Cheque Bounced']);
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'receipt', id, { status: receiptRes.rows[0].status }, { status: 'bounced', penalty_amount_inr: penaltyAmount, reason });
        await client.query('COMMIT');
        res.json({ success: true, message: 'Receipt marked as bounced.' });
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        (0, input_js_1.failWith)(error, res, next);
    }
    finally {
        client.release();
    }
});
// POST /api/payments/receipts/:id/cancel - Cancel a receipt and reverse demand payment state
router.post('/receipts/:id/cancel', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Receipt id');
        const reason = (0, input_js_1.text)((0, input_js_1.body)(req).reason, 'reason', 200, false) || 'Cancelled by user';
        await client.query('BEGIN');
        const receiptResult = await client.query(`SELECT id, receipt_number, status, approval_status,
              demand_id, payment_plan_id, amount_received_inr, consumer_id, installment_index
       FROM receipts WHERE id = $1 FOR UPDATE`, [id]);
        if (receiptResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Receipt not found' });
        }
        const receipt = receiptResult.rows[0];
        if (receipt.status === 'cancelled') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Receipt is already cancelled' });
        }
        if (receipt.status === 'bounced') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'A bounced receipt has already been taken out of the account and cannot be cancelled' });
        }
        if (receipt.approval_status === 'approved') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Cannot cancel an approved receipt. Please use the formal reversal workflow.' });
        }
        // Step 1: Cancel the receipt
        await client.query(`UPDATE receipts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
        await (0, tds_js_1.releaseTdsForReceipt)(client, id, 'Receipt cancelled');
        // Step 2: Revert demand status AND delivery_status if linked and paid
        if (receipt.demand_id) {
            await client.query(`UPDATE demands
         SET status = 'demanded', delivery_status = 'queued', updated_at = NOW()
         WHERE id = $1 AND delivery_status = 'paid'`, [receipt.demand_id]);
        }
        // Step 2b: Waterfall recheck — revert any demands no longer covered after cancellation
        const [wfRcpts, wfDemands] = await Promise.all([
            client.query(`SELECT id, amount_received_inr, demand_id, installment_index, status
         FROM receipts
         WHERE consumer_id = $1 AND status != 'cancelled'`, [receipt.consumer_id]),
            client.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                addon_charge_amount, addon_cgst_amount, addon_sgst_amount,
                status, delivery_status
         FROM demands
         WHERE consumer_id = $1`, [receipt.consumer_id]),
        ]);
        const wfResults = (0, payment_waterfall_js_1.applyWaterfall)(wfRcpts.rows, wfDemands.rows);
        for (const wf of wfResults) {
            if (!wf.fully_covered) {
                const dbDemand = wfDemands.rows.find((d) => d.id === wf.demand_id);
                if (dbDemand && (dbDemand.status === 'paid' || dbDemand.delivery_status === 'paid')) {
                    await client.query(`UPDATE demands SET status = 'demanded', delivery_status = 'queued', updated_at = NOW()
             WHERE id = $1`, [wf.demand_id]);
                    try {
                        await client.query(`INSERT INTO financial_audit_logs
                 (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                            receipt.consumer_id,
                            receipt.payment_plan_id,
                            req.userId || null,
                            'demand_revert_on_cancel',
                            JSON.stringify({ status: dbDemand.status, delivery_status: dbDemand.delivery_status }),
                            JSON.stringify({ status: 'demanded', delivery_status: 'queued' }),
                            `Demand reverted: covering advance receipt cancelled. Receipt: ${receipt.receipt_number}`,
                        ]);
                    }
                    catch (auditErr) {
                        console.error('Audit log failed (non-fatal):', auditErr.message);
                    }
                }
            }
        }
        // Step 2c: Recompute booking_amount for the specific booking this receipt applies to
        const cancelScope = await (0, payment_waterfall_js_1.resolveBookingScope)(client, receipt);
        if (cancelScope) {
            await (0, payment_waterfall_js_1.recomputeBookingAmount)(client, receipt.consumer_id, cancelScope.unitId, cancelScope.projectId, cancelScope.paymentPlanId);
            await (0, payment_waterfall_js_1.recomputeBookingPaymentTaxes)(client, receipt.consumer_id, cancelScope.unitId, cancelScope.projectId);
        }
        // Step 2d: Reverse installment-1 auto-raise if no valid idx1 receipt remains.
        // Also covers Step-G receipts (installment_index NULL) by checking whether
        // THIS receipt is the one recorded as having triggered the original raise.
        const cancelWasTrigger = await client.query(`SELECT 1 FROM audit_logs WHERE action = 'DEMAND_RAISE' AND new_values->>'trigger_receipt_id' = $1 LIMIT 1`, [id]);
        if ((receipt.installment_index === 1 || cancelWasTrigger.rows.length > 0) && receipt.payment_plan_id) {
            await (0, payment_waterfall_js_1.reverseInstallment1IfNoValidReceipt)(client, receipt.payment_plan_id);
        }
        // Step 3: Write audit log (non-fatal)
        try {
            await client.query(`INSERT INTO financial_audit_logs
           (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                receipt.consumer_id,
                receipt.payment_plan_id,
                req.userId || null,
                'RECEIPT_CANCEL',
                JSON.stringify({ status: receipt.status, amount: receipt.amount_received_inr }),
                JSON.stringify({ status: 'cancelled' }),
                reason,
            ]);
        }
        catch (auditErr) {
            console.error('Audit log failed (non-fatal):', auditErr.message);
        }
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'receipt', id, { status: receipt.status }, { status: 'cancelled', reason });
        await client.query('COMMIT');
        return res.json({
            success: true,
            message: 'Receipt cancelled successfully',
            receiptNumber: receipt.receipt_number,
            demandReverted: !!receipt.demand_id,
        });
    }
    catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        (0, input_js_1.failWith)(error, res, next);
    }
    finally {
        client.release();
    }
});
// ── RECEIPT HTML HELPERS ─────────────────────────────────────────────────────
function pmtOrdinal(n) {
    const abs = Math.abs(n);
    const lastTwo = abs % 100;
    const lastOne = abs % 10;
    if (lastTwo >= 11 && lastTwo <= 13)
        return `${abs}th`;
    if (lastOne === 1)
        return `${abs}st`;
    if (lastOne === 2)
        return `${abs}nd`;
    if (lastOne === 3)
        return `${abs}rd`;
    return `${abs}th`;
}
function pmtNumberToWords(amount) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const twoDigits = (n) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    const threeDigits = (n) => n >= 100
        ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
        : twoDigits(n);
    if (!amount || amount === 0)
        return 'Zero Rupees Only';
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thou = Math.floor((rupees % 100000) / 1000);
    const rem = rupees % 1000;
    const parts = [];
    if (crore)
        parts.push(threeDigits(crore) + ' Crore');
    if (lakh)
        parts.push(threeDigits(lakh) + ' Lakh');
    if (thou)
        parts.push(threeDigits(thou) + ' Thousand');
    if (rem)
        parts.push(threeDigits(rem));
    let result = parts.join(' ') + ' Rupees';
    if (paise)
        result += ' and ' + twoDigits(paise) + ' Paise';
    return result + ' Only';
}
function pmtEsc(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pmtFmtDate(d) {
    if (d == null)
        return '—';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime()))
        return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function pmtFmtAmt(v) {
    const n = parseFloat(v ?? 0) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pmtPaymentNarrative(b) {
    const mode = (b.payment_mode || '').toLowerCase();
    const ref = (b.payment_ref || '').trim();
    const bank = (b.bank_name || '').trim();
    const branch = (b.bank_branch || '').trim();
    const dateStr = pmtFmtDate(b.cheque_date);
    const hasDate = dateStr !== '—';
    if (mode === 'cash')
        return 'in Cash.';
    if (mode === 'cheque') {
        const parts = ['vide Cheque'];
        if (ref)
            parts.push(`No. ${ref}`);
        if (hasDate)
            parts.push(`dated ${dateStr}`);
        if (bank)
            parts.push(`drawn on ${branch ? `${bank}, ${branch}` : bank}`);
        return parts.join(' ') + '.';
    }
    if (mode === 'demand_draft' || mode === 'draft') {
        const parts = ['vide Demand Draft'];
        if (ref)
            parts.push(`No. ${ref}`);
        if (hasDate)
            parts.push(`dated ${dateStr}`);
        if (bank)
            parts.push(`drawn on ${branch ? `${bank}, ${branch}` : bank}`);
        return parts.join(' ') + '.';
    }
    if (mode === 'neft' || mode === 'rtgs' || mode === 'online') {
        const parts = ['vide Online Transfer'];
        if (ref)
            parts.push(`Ref. No. ${ref}`);
        if (hasDate)
            parts.push(`dated ${dateStr}`);
        if (bank)
            parts.push(`through ${bank}`);
        return parts.join(' ') + '.';
    }
    if (mode === 'upi') {
        const parts = ['vide UPI'];
        if (ref)
            parts.push(`Ref. No. ${ref}`);
        if (hasDate)
            parts.push(`dated ${dateStr}`);
        return parts.join(' ') + '.';
    }
    if (mode === 'card') {
        const parts = ['vide Card Transaction'];
        if (ref)
            parts.push(`Ref. ${ref}`);
        if (hasDate)
            parts.push(`dated ${dateStr}`);
        if (bank)
            parts.push(`through ${bank}`);
        return parts.join(' ') + '.';
    }
    const modePretty = mode.replace(/\b\w/g, (c) => c.toUpperCase());
    const parts = [`vide ${modePretty}`];
    if (ref)
        parts.push(`Ref. ${ref}`);
    return parts.join(' ') + '.';
}
function buildPaymentReceiptCopy(r, settings, copyType, allInstallments) {
    const companyName = settings['company_name'] || '';
    const companyCin = settings['company_cin'] || '';
    const companyAddr = settings['company_address'] || '';
    const companyReg = settings['company_reg_addr'] || '';
    const companyPhone = settings['company_phone'] || '';
    const companyWeb = settings['company_website'] || '';
    const companyEmail = settings['company_email'] || '';
    const companyGstin = settings['company_gstin'] || '';
    const placeOfSupply = settings['place_of_supply'] || '';
    const hsnSacCode = settings['hsn_sac_code'] || '';
    const note1 = settings['receipt_note_1'] || '';
    const note2 = settings['receipt_note_2'] || '';
    const note3 = settings['receipt_note_3'] || '';
    const note4 = settings['receipt_note_4'] || '';
    const primaryName = [r.salutation, r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    const coNames = [];
    if (Array.isArray(r.co_applicants)) {
        for (const co of r.co_applicants) {
            const n = [co.salutation, co.first_name, co.last_name].filter(Boolean).join(' ').trim();
            if (n)
                coNames.push(`& ${n}`);
        }
    }
    const consumerName = [primaryName, ...coNames].join(' ').trim() || '—';
    const addrParts = [r.present_address, r.present_city, r.present_state].filter(Boolean);
    const address = addrParts.join(', ') + (r.present_pin ? ` - ${r.present_pin}` : '');
    const isNri = ['nri', 'oci', 'pio'].includes((r.nationality || '').toLowerCase());
    const totalAmount = parseFloat(r.amount_received_inr || 0);
    const amountWords = pmtNumberToWords(totalAmount);
    const floorOrdinal = r.floor != null ? pmtOrdinal(parseInt(r.floor)) : '—';
    const receiptNo = r.receipt_number || '—';
    const narrative = pmtPaymentNarrative({
        payment_mode: r.payment_method,
        payment_ref: r.transaction_ref,
        bank_name: r.bank_name,
        bank_branch: r.branch,
        cheque_date: r.cheque_date,
    });
    // ── BALCONY SETUP ──────────────────────────────────────────────────────
    const hasBalcony = r.balcony_charge_amount != null;
    const totalBalconyCharge = parseFloat(r.balcony_charge_amount || 0);
    // ── TABLE CELL HELPERS ─────────────────────────────────────────────────
    const TH = (s, w) => `<th style="${w ? `width:${w};` : ''}background:#f0f0f0;border:1px solid #999;padding:4px 6px;font-size:10px;text-align:center">${s}</th>`;
    const TDx = (s, extra = '') => `<td style="border:1px solid #999;padding:4px 6px;font-size:10px;${extra}">${s}</td>`;
    const TDR = (s, extra = '') => TDx(s, `text-align:right;${extra}`);
    const TDC = (s, extra = '') => TDx(s, `text-align:center;${extra}`);
    // Span wrapper: wraps a cell value with data-field-key for inline edit support
    const SF = (key, label, val, vtype, extra = '') => `<span data-field-key="${key}" data-field-label="${label}" data-value-type="${vtype}" data-section="table"${extra}>${val}</span>`;
    // ── ADDON GST RATES & AMOUNTS (needed before installment rows for back-calc) ───
    const addonCgstPct = parseFloat(settings['addon_cgst_percent'] || '9');
    const addonSgstPct = parseFloat(settings['addon_sgst_percent'] || '9');
    const basicCgstPct = parseFloat(settings['basic_cgst_percent'] || '0.5');
    const basicSgstPct = parseFloat(settings['basic_sgst_percent'] || '0.5');
    const calcAddonGst = (amount, cgstPct, sgstPct) => {
        if (isNri || amount <= 0)
            return { net: amount, cgst: 0, sgst: 0, total: amount };
        const cgst = Math.round(amount * cgstPct / 100 * 100) / 100;
        const sgst = Math.round(amount * sgstPct / 100 * 100) / 100;
        return { net: amount, cgst, sgst, total: amount + cgst + sgst };
    };
    const plcAmt = parseFloat(r.plc_amount || 0);
    const edcAmt = parseFloat(r.edc_amount || 0);
    const idcAmt = parseFloat(r.idc_amount || 0);
    const intAmt = parseFloat(r.interest_amount || 0) || parseFloat(r.penal_interest_amount || 0);
    const otherAmt = parseFloat(r.other_charge_amount || 0);
    const otherDesc = r.other_charge_desc || 'Other Charges';
    // Pre-compute addon gross total so we can back-calculate basic amount
    const addonGrossTotal = calcAddonGst(plcAmt, addonCgstPct, addonSgstPct).total +
        calcAddonGst(edcAmt, addonCgstPct, addonSgstPct).total +
        calcAddonGst(idcAmt, addonCgstPct, addonSgstPct).total +
        calcAddonGst(intAmt, basicCgstPct, basicSgstPct).total +
        calcAddonGst(otherAmt, addonCgstPct, addonSgstPct).total;
    // ── FIND CURRENT INSTALLMENT ONLY ──────────────────────────────────────
    const currentInstIdx = r.installment_index != null ? parseInt(r.installment_index) : -1;
    const currentInst = allInstallments.find(i => parseInt(i.installment_index) === currentInstIdx)
        || (allInstallments.length === 1 ? allInstallments[0] : null);
    // ── BUILD INSTALLMENT ROWS (this receipt only) ─────────────────────────
    // Use back-calculated basic gross (totalAmount - addonGross) so the
    // table total always equals the amount box — correct for partial payments.
    let tableBodyRows = '';
    let sumNet = 0, sumCgst = 0, sumSgst = 0, sumGross = 0;
    let sNo = 0;
    if (currentInst) {
        const basicGross = Math.max(0, totalAmount - addonGrossTotal);
        // Derive GST fractions from the demand's actual amounts
        const demandNet = parseFloat(currentInst.amount_due_inr || 0);
        const demandCgst = isNri ? 0 : parseFloat(currentInst.cgst_amount || 0);
        const demandSgst = isNri ? 0 : parseFloat(currentInst.sgst_amount || 0);
        const demandGross = demandNet + demandCgst + demandSgst;
        const cgstFrac = demandGross > 0 ? demandCgst / demandGross : 0;
        const sgstFrac = demandGross > 0 ? demandSgst / demandGross : 0;
        const pct = parseFloat(currentInst.percentage || 0);
        if (hasBalcony && pct > 0) {
            const balconyInstGross = Math.round(totalBalconyCharge * pct / 100);
            const balcCgst = Math.round(parseFloat(r.balcony_cgst_amount || 0) * pct / 100);
            const balcSgst = Math.round(parseFloat(r.balcony_sgst_amount || 0) * pct / 100);
            const basicInstGross = Math.max(0, basicGross - balconyInstGross - balcCgst - balcSgst);
            if (basicInstGross > 0) {
                sNo++;
                const instCgst = demandCgst - balcCgst;
                const instSgst = demandSgst - balcSgst;
                const instNet = basicInstGross - instCgst - instSgst;
                sumNet += instNet;
                sumCgst += instCgst;
                sumSgst += instSgst;
                sumGross += basicInstGross;
                tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', pmtEsc(currentInst.installment_name), 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'Basic', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(instNet), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(instCgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(instSgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(basicInstGross), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
            }
            if (balconyInstGross > 0) {
                sNo++;
                const balcTotal = balconyInstGross + balcCgst + balcSgst;
                sumNet += balconyInstGross;
                sumCgst += balcCgst;
                sumSgst += balcSgst;
                sumGross += balcTotal;
                tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', pmtEsc(currentInst.installment_name), 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'Balcony Charge', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(balconyInstGross), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(balcCgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(balcSgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(balcTotal), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
            }
        }
        else if (basicGross > 0) {
            sNo++;
            const instCgst = Math.round(basicGross * cgstFrac);
            const instSgst = Math.round(basicGross * sgstFrac);
            const instNet = basicGross - instCgst - instSgst;
            sumNet += instNet;
            sumCgst += instCgst;
            sumSgst += instSgst;
            sumGross += basicGross;
            tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', pmtEsc(currentInst.installment_name), 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'Basic', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(instNet), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(instCgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(instSgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(basicGross), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
        }
    }
    else if (r.installment_index != null && allInstallments.length === 0) {
        // Fallback — no demands raised yet; back-calculate from receipt total
        const basicGross = Math.max(0, totalAmount - addonGrossTotal);
        if (basicGross > 0) {
            sNo++;
            const cgst = isNri ? 0 : Math.round(basicGross * basicCgstPct / 100);
            const sgst = isNri ? 0 : Math.round(basicGross * basicSgstPct / 100);
            const net = basicGross - cgst - sgst;
            const fallbackName = `Installment #${r.installment_index}`;
            sumNet += net;
            sumCgst += cgst;
            sumSgst += sgst;
            sumGross += basicGross;
            tableBodyRows = `
        <tr>
          ${TDC('1')}
          ${TDx(SF('installmentName_1', 'Installment (Row 1)', pmtEsc(fallbackName), 'text'))}
          ${TDx(SF('chargeType_1', 'Charge Type (Row 1)', 'Basic', 'text'))}
          ${TDC(SF('hsnSac_1', 'HSN/SAC (Row 1)', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_1', 'Amount (Row 1)', pmtFmtAmt(net), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_1', 'CGST (Row 1)', pmtFmtAmt(cgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_1', 'SGST (Row 1)', pmtFmtAmt(sgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_1', 'Row Total (Row 1)', pmtFmtAmt(basicGross), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
        }
    }
    else if (currentInst == null && r.installment_index == null && r.demand_id == null) {
        // Other payment — no installment/demand link; render one row directly from receipt's own amounts
        const otherGross = totalAmount;
        const otherCgst = isNri ? 0 : parseFloat(r.cgst_amount || 0);
        const otherSgst = isNri ? 0 : parseFloat(r.sgst_amount || 0);
        const otherNet = otherGross - otherCgst - otherSgst;
        if (otherGross > 0) {
            sNo++;
            sumNet += otherNet;
            sumCgst += otherCgst;
            sumSgst += otherSgst;
            sumGross += otherGross;
            tableBodyRows += `
        <tr>
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', 'Payment', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'Basic', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(otherNet), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(otherCgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(otherSgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(otherGross), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
        }
    }
    // ── ADDON CHARGE ROWS ─────────────────────────────────────────────────
    const addonRowStyle = 'background:#fafafa;';
    let addonRows = '';
    if (plcAmt > 0) {
        sNo++;
        const g = calcAddonGst(plcAmt, addonCgstPct, addonSgstPct);
        sumNet += g.net;
        sumCgst += g.cgst;
        sumSgst += g.sgst;
        sumGross += g.total;
        addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', '<em>Addon</em>', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'PLC Charges', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(g.net), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(g.cgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(g.sgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(g.total), 'currency', ' data-gst-type="addon"'))}
        </tr>`;
    }
    if (edcAmt > 0) {
        sNo++;
        const g = calcAddonGst(edcAmt, addonCgstPct, addonSgstPct);
        sumNet += g.net;
        sumCgst += g.cgst;
        sumSgst += g.sgst;
        sumGross += g.total;
        addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', '<em>Addon</em>', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'EDC', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(g.net), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(g.cgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(g.sgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(g.total), 'currency', ' data-gst-type="addon"'))}
        </tr>`;
    }
    if (idcAmt > 0) {
        sNo++;
        const g = calcAddonGst(idcAmt, addonCgstPct, addonSgstPct);
        sumNet += g.net;
        sumCgst += g.cgst;
        sumSgst += g.sgst;
        sumGross += g.total;
        addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', '<em>Addon</em>', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'IDC', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(g.net), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(g.cgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(g.sgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(g.total), 'currency', ' data-gst-type="addon"'))}
        </tr>`;
    }
    if (intAmt > 0) {
        sNo++;
        const g = calcAddonGst(intAmt, basicCgstPct, basicSgstPct);
        sumNet += g.net;
        sumCgst += g.cgst;
        sumSgst += g.sgst;
        sumGross += g.total;
        addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', '', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', 'Interest', 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(g.net), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(g.cgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(g.sgst), 'currency', ' data-gst-type="basic"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(g.total), 'currency', ' data-gst-type="basic"'))}
        </tr>`;
    }
    if (otherAmt > 0) {
        sNo++;
        const g = calcAddonGst(otherAmt, addonCgstPct, addonSgstPct);
        sumNet += g.net;
        sumCgst += g.cgst;
        sumSgst += g.sgst;
        sumGross += g.total;
        addonRows += `
        <tr style="${addonRowStyle}">
          ${TDC(String(sNo))}
          ${TDx(SF('installmentName_' + sNo, 'Installment (Row ' + sNo + ')', '<em>Addon</em>', 'text'))}
          ${TDx(SF('chargeType_' + sNo, 'Charge Type (Row ' + sNo + ')', pmtEsc(otherDesc), 'text'))}
          ${TDC(SF('hsnSac_' + sNo, 'HSN/SAC (Row ' + sNo + ')', pmtEsc(hsnSacCode), 'text'))}
          ${TDR(SF('amountNet_' + sNo, 'Amount (Row ' + sNo + ')', pmtFmtAmt(g.net), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('cgstAmount_' + sNo, 'CGST (Row ' + sNo + ')', pmtFmtAmt(g.cgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('sgstAmount_' + sNo, 'SGST (Row ' + sNo + ')', pmtFmtAmt(g.sgst), 'currency', ' data-gst-type="addon"'))}
          ${TDR(SF('rowTotal_' + sNo, 'Row Total (Row ' + sNo + ')', pmtFmtAmt(g.total), 'currency', ' data-gst-type="addon"'))}
        </tr>`;
    }
    // ── SUMMARY ROWS ───────────────────────────────────────────────────────
    const summaryRows = `
        <tr style="font-weight:700;background:#f0f0f0">
          ${TDC('')}${TDx('')}${TDx('')}
          ${TDC('Total', 'font-weight:700')}
          ${TDR(SF('grandTotalNet', 'Grand Total (Net)', pmtFmtAmt(sumNet), 'currency'), 'font-weight:700')}
          ${TDR(SF('grandTotalCgst', 'Grand Total CGST', pmtFmtAmt(sumCgst), 'currency'), 'font-weight:700')}
          ${TDR(SF('grandTotalSgst', 'Grand Total SGST', pmtFmtAmt(sumSgst), 'currency'), 'font-weight:700')}
          ${TDR(SF('grandTotal', 'Grand Total', pmtFmtAmt(sumGross), 'currency'), 'font-weight:700')}
        </tr>`;
    return `
<div class="receipt-copy">

  <!-- HEADER -->
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-weight:700;font-size:15px">${pmtEsc(companyName)}</div>
    <div style="font-size:10px;margin-top:2px">CIN: ${pmtEsc(companyCin)}</div>
    <div style="font-size:10px;margin-top:2px">${pmtEsc(companyAddr)}</div>
    <div style="font-size:10px;margin-top:2px">Regd. Office: ${pmtEsc(companyReg)}</div>
    <div style="font-size:10px;margin-top:4px">${pmtEsc(companyPhone)} &nbsp;|&nbsp; ${pmtEsc(companyWeb)} &nbsp;|&nbsp; ${pmtEsc(companyEmail)}</div>
  </div>
  <hr style="border:none;border-top:1px solid #000;margin:8px 0">
  <div style="text-align:center;font-weight:700;font-size:16px;margin:10px 0 12px">RECEIPT</div>

  <!-- TWO-COLUMN INFO BLOCK -->
  <table style="width:100%;border:none;border-collapse:collapse;margin-bottom:14px">
    <tr>
      <td style="width:60%;vertical-align:top;border:none;padding:0">
        <div style="font-weight:700">Receipt No.: <span data-field-key="receiptNumber" data-field-label="Receipt Number" data-value-type="text" data-section="header">${pmtEsc(receiptNo)}</span></div>
        <div style="font-weight:700;font-size:13px;margin-top:2px">${pmtEsc(copyType)}</div>
        <div style="margin-top:6px">Customer ID: <span data-field-key="customerId" data-field-label="Customer ID" data-value-type="text" data-section="header">${pmtEsc((r.form_no || r.registration_no || '').toString())}</span></div>
        <div style="font-weight:700;margin-top:2px"><span data-field-key="consumerName" data-field-label="Consumer Name" data-value-type="text" data-section="header">${pmtEsc(consumerName)}</span></div>
        <div style="margin-top:2px;white-space:pre-wrap"><span data-field-key="consumerAddress" data-field-label="Consumer Address" data-value-type="text" data-section="header">${pmtEsc(address)}</span></div>
        <div style="margin-top:2px">(M): <span data-field-key="consumerMobile" data-field-label="Mobile" data-value-type="text" data-section="header">${pmtEsc(r.mobile || '—')}</span></div>
        <div>Email: <span data-field-key="consumerEmail" data-field-label="Email" data-value-type="text" data-section="header">${pmtEsc(r.email || '—')}</span></div>
      </td>
      <td style="width:40%;vertical-align:top;border:none;padding:0;text-align:right">
        <div>Place Of Supply: <span data-field-key="placeOfSupply" data-field-label="Place of Supply" data-value-type="text" data-section="header">${pmtEsc(placeOfSupply)}</span></div>
        <div style="margin-top:2px">GSTIN: <span data-field-key="companyGstin" data-field-label="GSTIN" data-value-type="text" data-section="header">${pmtEsc(companyGstin)}</span></div>
        <div style="margin-top:2px">CIN No.: <span data-field-key="companyCin" data-field-label="CIN No." data-value-type="text" data-section="header">${pmtEsc(companyCin)}</span></div>
        <div style="margin-top:2px">Receipt Date: <span data-field-key="receiptDate" data-field-label="Receipt Date" data-value-type="date" data-section="header">${pmtFmtDate(r.received_date)}</span></div>
      </td>
    </tr>
  </table>

  <!-- PAYMENT NARRATIVE -->
  <p style="margin:0 0 14px;line-height:1.7">
    Received with thanks from <strong><span data-field-key="narrativeConsumerName" data-field-label="Consumer Name (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(consumerName)}</span></strong>
    a sum of <strong>Rs. <span data-field-key="narrativeAmount" data-field-label="Amount (Narrative)" data-value-type="currency" data-section="narrative">${pmtFmtAmt(totalAmount)}</span> /-</strong>
    (<strong><span data-field-key="amountInWords" data-field-label="Amount in Words" data-value-type="text" data-section="narrative">${pmtEsc(amountWords)}</span></strong>)
    <span data-field-key="narrativePaymentMethod" data-field-label="Payment Method (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(narrative)}</span> against the Unit No.
    <strong><span data-field-key="narrativeUnitNo" data-field-label="Unit Number (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.unit_number || '—')}</span></strong> on
    <strong><span data-field-key="narrativeFloor" data-field-label="Floor (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(floorOrdinal)}</span> Floor</strong> in
    <strong><span data-field-key="narrativeProjectName" data-field-label="Project Name (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.project_name || '—')}</span></strong>,
    <span data-field-key="narrativeLocation" data-field-label="Project Location (Narrative)" data-value-type="text" data-section="narrative">${pmtEsc(r.project_location || '—')}</span>.
    as per following details:
  </p>

  <!-- INSTALLMENT TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px">
    <thead>
      <tr>
        ${TH('S.No.', '4%')}
        ${TH('Installment')}
        ${TH('Charge')}
        ${TH('HSN/SAC', '8%')}
        ${TH('Amount', '11%')}
        ${TH('CGST', '8%')}
        ${TH('SGST', '8%')}
        ${TH('Total Amount', '11%')}
      </tr>
    </thead>
    <tbody>
      ${tableBodyRows}
      ${addonRows}
      ${summaryRows}
    </tbody>
  </table>

  <!-- AMOUNT BOX -->
  <div style="display:inline-block;border:2px solid #000;padding:6px 14px;font-weight:bold;font-size:13px;margin:10px 0">&#8377; <span data-field-key="amountBox" data-field-label="Amount Box" data-value-type="currency" data-section="footer">${pmtFmtAmt(totalAmount)}</span>/-</div>

  <!-- SIGNATURE BLOCK -->
  <div style="text-align:right;margin-top:20px">
    <div>For ${pmtEsc(companyName)}</div>
    <div style="height:48px"></div>
    <div>Authorized Signatory</div>
  </div>

  <!-- NOTES -->
  <div style="margin-top:16px;font-size:10px;border-top:1px solid #ccc;padding-top:8px">
    <div style="font-weight:700;margin-bottom:4px">Notes :</div>
    <div>1. ${pmtEsc(note1)}</div>
    <div style="margin-top:3px">2. ${pmtEsc(note2)}</div>
    <div style="margin-top:3px">3. ${pmtEsc(note3)}</div>
    <div style="margin-top:3px">4. ${pmtEsc(note4)}</div>
  </div>

</div>`;
}
function buildPaymentReceiptHtml(r, settings, coApplicants, allInstallments) {
    r.co_applicants = coApplicants;
    const customerCopy = buildPaymentReceiptCopy(r, settings, 'CUSTOMER COPY', allInstallments);
    const officeCopy = buildPaymentReceiptCopy(r, settings, 'OFFICE COPY', allInstallments);
    const receiptNo = pmtEsc(r.receipt_number || '—');
    const emailSubject = encodeURIComponent(`Payment Receipt - ${r.receipt_number || ''}`);
    const emailBody = encodeURIComponent(`Dear Customer,\n\nPlease find your payment receipt details below.\nReceipt No: ${r.receipt_number || ''}\n\nRegards,\n${settings['company_name'] || 'ROF Group'}`);
    const emailHref = `mailto:${encodeURIComponent(r.email || '')}?subject=${emailSubject}&body=${emailBody}`;
    const btnNav = 'background:#ffffff;color:#1a3c5e;border:2px solid #1a3c5e;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px';
    const btnClose = 'background:#ffffff;color:#dc3545;border:2px solid #dc3545;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px';
    const hoverNav = `onmouseover="this.style.background='#1a3c5e';this.style.color='#ffffff'" onmouseout="this.style.background='#ffffff';this.style.color='#1a3c5e'"`;
    const hoverClose = `onmouseover="this.style.background='#dc3545';this.style.color='#ffffff'" onmouseout="this.style.background='#ffffff';this.style.color='#dc3545'"`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt - ${receiptNo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; margin: 20px; }
  .receipt-copy { max-width: 750px; margin: auto; border: 1px solid #000; padding: 24px; margin-bottom: 40px; }
  .hide-customer .customer-copy { display: none; }
  .hide-office   .office-copy   { display: none; }
  @media print {
    .no-print { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }
    .office-copy { page-break-before: always; }
    .customer-copy, .office-copy { margin-top: 0 !important; padding-top: 0 !important; }
    body { margin: 0 !important; padding: 0 !important; }
    @page { margin: 15mm; size: A4; }
  }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:1000;background:#1a3c5e;padding:10px 20px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
  <button onclick="document.body.className='';window.print()" style="${btnNav}" ${hoverNav}>&#128424; Print Both Copies</button>
  <button onclick="document.body.className='hide-office';window.print();setTimeout(()=>document.body.className='',500)" style="${btnNav}" ${hoverNav}>&#11015; Download Customer Copy</button>
  <button onclick="document.body.className='hide-customer';window.print();setTimeout(()=>document.body.className='',500)" style="${btnNav}" ${hoverNav}>&#11015; Download Office Copy</button>
  <button onclick="window.location.href='${emailHref}'" style="${btnNav}" ${hoverNav}>&#9993; E-Mail</button>
  <button onclick="window.opener ? window.close() : window.history.length > 1 ? window.history.back() : (window.location.href='/')" style="${btnClose}" ${hoverClose}>&#10005; Close</button>
</div>
<div class="no-print" style="height:52px"></div>

<div class="customer-copy">${customerCopy}</div>
<div class="office-copy">${officeCopy}</div>

</body>
</html>`;
}
// GET /api/payments/receipts/:id/html — Print-ready receipt with full plan breakdown
router.get('/receipts/:id/html', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Receipt id');
        const [settingsResult, receiptResult] = await Promise.all([
            index_js_1.db.query('SELECT key, value FROM global_settings'),
            index_js_1.db.query(`
        SELECT
          r.id, r.receipt_number, r.installment_index,
          r.consumer_id, r.payment_plan_id,
          r.amount_received_inr,
          r.plc_amount, r.edc_amount, r.idc_amount,
          r.other_charge_amount, r.other_charge_desc, r.interest_amount,
          r.payment_method, r.transaction_ref, r.received_date,
          r.bank_name, r.cheque_no, r.cheque_date, r.branch,
          c.salutation, c.first_name, c.last_name, c.mobile, c.email,
          c.nationality,
          c.present_address, c.present_city, c.present_state, c.present_pin,
          c.form_no, c.registration_no,
          p.id AS project_id,
          p.name AS project_name,
          p.location AS project_location,
          u.unit_number, u.floor, u.bhk_type,
          u.carpet_area_sqft, u.super_area_sqft, u.base_price_inr, u.total_price_inr,
          u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
          br.balcony_charge_amount, br.balcony_cgst_amount, br.balcony_sgst_amount,
          pp.total_amount_inr AS plan_total_inr,
          COALESCE(d.cgst_amount, CASE WHEN LOWER(COALESCE(c.nationality,'')) IN ('nri','oci','pio') THEN 0 ELSE gtax.cgst_paise / 100.0 END) AS cgst_amount,
          COALESCE(d.sgst_amount, CASE WHEN LOWER(COALESCE(c.nationality,'')) IN ('nri','oci','pio') THEN 0 ELSE (ttax.total_tax_paise - gtax.cgst_paise) / 100.0 END) AS sgst_amount
        FROM receipts r
        JOIN consumers c ON c.id = r.consumer_id
        LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id
        LEFT JOIN projects p ON p.id = pp.project_id
        LEFT JOIN units u ON u.id = pp.unit_id
        LEFT JOIN booking_records br ON br.consumer_id = r.consumer_id AND br.unit_id IS NOT NULL
        LEFT JOIN demands d ON d.id = r.demand_id
        LEFT JOIN LATERAL (
          SELECT gts.cgst_pct, gts.sgst_pct
          FROM gst_tax_charge_mapping gcm
          JOIN gst_slabs gs ON gs.id = gcm.slab_id
            AND gs.from_date <= ${business_date_js_1.SQL_TODAY} AND gs.to_date >= ${business_date_js_1.SQL_TODAY}
          JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
          WHERE gcm.project_id = p.id AND gcm.charge_type = 'BASIC'
          LIMIT 1
        ) grate ON true
        LEFT JOIN LATERAL (
          SELECT
            (ROUND(r.amount_received_inr * 100) -
              FLOOR(ROUND(r.amount_received_inr * 100) / (1 + (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)) / 100.0))
            )::bigint AS total_tax_paise
        ) ttax ON true
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN COALESCE(grate.cgst_pct,0.5) = COALESCE(grate.sgst_pct,0.5)
                THEN FLOOR(ttax.total_tax_paise / 2.0)
              ELSE ROUND(ttax.total_tax_paise * COALESCE(grate.cgst_pct,0.5) / (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)))
            END::bigint AS cgst_paise
        ) gtax ON true
        WHERE r.id = $1
      `, [id]),
        ]);
        if (!receiptResult.rows[0]) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        const receipt = receiptResult.rows[0];
        const settings = {};
        for (const row of settingsResult.rows)
            settings[row.key] = row.value;
        // Fetch full plan installments with status + plan template names
        let allInstallments = [];
        if (receipt.payment_plan_id) {
            try {
                const instResult = await index_js_1.db.query(`
          SELECT
            d.id AS demand_id,
            d.installment_index,
            d.demand_type,
            d.status AS demand_status,
            d.delivery_status,
            d.amount_due_inr,
            COALESCE(d.cgst_amount, 0) AS cgst_amount,
            COALESCE(d.sgst_amount, 0) AS sgst_amount,
            COALESCE(
              pst.installment_name,
              CASE
                WHEN d.demand_type = 'allotment'   THEN 'At the time of Allotment'
                WHEN d.demand_type = 'installment' THEN 'Installment #' || d.installment_index::text
                ELSE COALESCE(d.demand_type, 'Installment #' || d.installment_index::text)
              END
            ) AS installment_name,
            COALESCE(pst.percentage, 0) AS percentage,
            r2.id AS paid_receipt_id,
            r2.receipt_number AS paid_receipt_no,
            r2.received_date  AS paid_date,
            r2.amount_received_inr AS paid_amount
          FROM demands d
          LEFT JOIN LATERAL (
            SELECT pst2.installment_name, pst2.percentage
            FROM plan_schedule_templates pst2
            WHERE pst2.project_id = $2
              AND pst2.installment_index = d.installment_index
            ORDER BY pst2.plan_name
            LIMIT 1
          ) pst ON true
          LEFT JOIN LATERAL (
            SELECT r2.id, r2.receipt_number, r2.received_date, r2.amount_received_inr
            FROM receipts r2
            WHERE r2.payment_plan_id = d.payment_plan_id
              AND r2.installment_index = d.installment_index
              AND r2.status != 'cancelled'
            ORDER BY r2.created_at DESC
            LIMIT 1
          ) r2 ON true
          WHERE d.payment_plan_id = $1
          ORDER BY d.installment_index
        `, [receipt.payment_plan_id, receipt.project_id || null]);
                allInstallments = instResult.rows;
            }
            catch {
                allInstallments = [];
            }
        }
        let coApplicants = [];
        try {
            const coResult = await index_js_1.db.query(`SELECT salutation, first_name, last_name, applicant_number
         FROM co_applicants WHERE consumer_id = $1 ORDER BY applicant_number ASC`, [receipt.consumer_id]);
            coApplicants = coResult.rows;
        }
        catch {
            coApplicants = [];
        }
        // Fetch penal interest for this receipt's consumer + installment
        if (!receipt.interest_amount || parseFloat(receipt.interest_amount) === 0) {
            try {
                const penalResult = await index_js_1.db.query(`SELECT amount_inr, interest_waived_inr, rate_percent
           FROM penal_interests
           WHERE consumer_id = $1
             AND payment_plan_id = $2
             AND installment_index = $3
           ORDER BY calculated_at DESC LIMIT 1`, [receipt.consumer_id, receipt.payment_plan_id, receipt.installment_index]);
                if (penalResult.rows.length > 0) {
                    const pi = penalResult.rows[0];
                    const net = parseFloat(pi.amount_inr || 0) - parseFloat(pi.interest_waived_inr || 0);
                    if (net > 0)
                        receipt.penal_interest_amount = net;
                }
            }
            catch { /* non-fatal */ }
        }
        const html = buildPaymentReceiptHtml(receipt, settings, coApplicants, allInstallments);
        // Persist to documents table on first view so it can be edited later
        let receiptDocId = null;
        try {
            const existing = await index_js_1.db.query(`SELECT id FROM documents WHERE document_type = 'payment_receipt' AND reference_id = $1 LIMIT 1`, [id]);
            if (existing.rows.length === 0) {
                const docInsert = await index_js_1.db.query(`INSERT INTO documents (document_type, consumer_id, html_content, reference_id, document_subtype, version_number, edit_count, is_edited, created_by_user_id)
           VALUES ('payment_receipt', $1, $2, $3, 'receipt', 1, 0, FALSE, $4) RETURNING id`, [receipt.consumer_id, html, id, req.userId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
                receiptDocId = docInsert.rows[0].id;
                await index_js_1.db.query(`INSERT INTO document_versions (document_id, version_number, html_content, is_original, edit_reason)
           VALUES ($1, 1, $2, TRUE, 'Original generation')`, [receiptDocId, html]);
            }
            else {
                receiptDocId = existing.rows[0].id;
            }
        }
        catch { /* non-fatal — don't block the response */ }
        // Apply any active field overrides so edits persist across re-renders
        let finalHtml = html;
        if (receiptDocId) {
            try {
                const overridesRes = await index_js_1.db.query(`SELECT field_key, current_value FROM document_field_overrides
           WHERE document_id = $1 AND is_active = TRUE`, [receiptDocId]);
                if (overridesRes.rows.length > 0) {
                    const overridesMap = {};
                    overridesRes.rows.forEach((o) => {
                        overridesMap[o.field_key] = o.current_value;
                    });
                    finalHtml = (0, document_recalc_js_1.applyOverridesToHtml)(html, overridesMap);
                    // Keep stored html_content in sync
                    await index_js_1.db.query(`UPDATE documents SET html_content = $1, updated_at = NOW() WHERE id = $2`, [finalHtml, receiptDocId]);
                }
            }
            catch { /* non-fatal */ }
        }
        const token = (req.headers.authorization?.split(' ')[1] || req.query.token || '');
        const htmlWithEdit = receiptDocId
            ? finalHtml.replace('</body>', (0, document_recalc_js_1.buildEditScript)(receiptDocId, token, 'payment_receipt') + '\n</body>')
            : finalHtml;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlWithEdit);
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── RECEIPT ENTRY FORM (standalone HTML page) ─────────────────────────────────
function buildReceiptFormHtml(consumer, installments, banks, users, token, cgstPct, sgstPct) {
    const fmtN = (v) => {
        const n = parseFloat(String(v || 0));
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const today = (0, business_date_js_1.businessToday)();
    const inp = `width:100%;padding:6px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;box-sizing:border-box;height:30px;`;
    const instOpts = installments.map((x) => {
        const isPaid = x.demand_status === 'paid' || x.demand_delivery_status === 'paid';
        return `<option value="${x.installment_index}"${isPaid ? ' disabled style="color:#999;background:#f5f5f5;"' : ''}>${pmtEsc(x.installment_name)}${isPaid ? ' (Already Paid)' : ''}</option>`;
    }).join('') + `<option value="-1">Other</option>`;
    const bankOpts = `<option value="">&lt;-Select-&gt;</option>` + banks.map((b) => `<option value="${pmtEsc(b.name)}">${pmtEsc(b.name)}</option>`).join('');
    const userOpts = `<option value="">&lt;-Select-&gt;</option>` + users.map((u) => `<option value="${pmtEsc(u.id)}">${pmtEsc(u.name || u.email || u.id)}</option>`).join('');
    const bal = parseFloat(consumer.balance || 0);
    const balColor = bal > 0 ? '#c0392b' : '#27ae60';
    const toggleCSS = `
    .tgl{display:inline-flex;border:1px solid #ccc;border-radius:3px;overflow:hidden;}
    .tgl button{padding:5px 11px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:#f0f0f0;color:#555;}
    .tgl button.on{background:#1db5a0;color:#fff;}
    .tgl button.on2{background:#c0392b;color:#fff;}
  `;
    const tabs = ['Cheque', 'Draft', 'Online', 'Cash', 'Adjust', 'Dealer Adjustment', 'TDS Challan', 'Card'];
    const amountRow = (prefix, tabName) => {
        const sfx = tabName.replace(/\s/g, '');
        return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr) auto;gap:8px;margin-bottom:10px;align-items:end;">
      <div><label class="lbl">${prefix} Amount*</label><input type="number" id="rf-amount-${sfx}" placeholder="0.00" oninput="calcTotals()" style="${inp}"></div>
      <div><label class="lbl">Interest</label><input type="number" id="rf-interest-${sfx}" placeholder="0.00" oninput="calcTotals()" style="${inp}"></div>
      <div><label class="lbl">GST Interest (1.000%)</label><input type="number" id="rf-gst-interest-${sfx}" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">Paid</label><input type="number" id="rf-paid-${sfx}" placeholder="0.00" readonly style="${inp}background:#f8f9fa;font-weight:700;"></div>
      <div><label class="lbl">S.Tax (0.000%)</label><input type="number" id="rf-stax-${sfx}" value="0" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">CGST (0.500%)</label><input type="number" id="rf-cgst-${sfx}" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <div><label class="lbl">SGST (0.500%)</label><input type="number" id="rf-sgst-${sfx}" placeholder="0.00" readonly style="${inp}background:#f8f9fa;"></div>
      <button onclick="addExtraAddOn()" style="background:#1db5a0;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;height:30px;">+ Extra Add On</button>
    </div>`;
    };
    const chequeInstrRow = `
    <div style="display:grid;grid-template-columns:130px 150px 1fr 1fr 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Cheque No.</label><input type="text" id="rf-cheque-no" style="${inp}"></div>
      <div><label class="lbl">Cheque Date</label><input type="date" id="rf-cheque-date" value="${today}" style="${inp}"></div>
      <div><label class="lbl">Bank Name</label><select id="rf-bank" style="${inp}">${bankOpts}</select></div>
      <div><label class="lbl">Branch Name</label><input type="text" id="rf-branch" style="${inp}"></div>
      <div><label class="lbl">Employee</label><select id="rf-employee" style="${inp}">${userOpts}</select></div>
    </div>`;
    const onlineInstrRow = `
    <div style="display:grid;grid-template-columns:1fr 150px 1fr 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Transaction Ref.</label><input type="text" id="rf-txn-ref" style="${inp}"></div>
      <div><label class="lbl">Transaction Date</label><input type="date" id="rf-txn-date" value="${today}" style="${inp}"></div>
      <div><label class="lbl">Bank Name</label><select id="rf-bank-online" style="${inp}">${bankOpts}</select></div>
      <div><label class="lbl">Employee</label><select id="rf-employee-online" style="${inp}">${userOpts}</select></div>
    </div>`;
    const cashOnlyRow = `
    <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;align-items:end;">
      <div><label class="lbl">Employee</label><select id="rf-employee-cash" style="${inp}">${userOpts}</select></div>
    </div>`;
    const tabContents = {
        'Cheque': amountRow('Cheque', 'Cheque') + chequeInstrRow,
        'Draft': amountRow('Draft', 'Draft') + chequeInstrRow.replace(/rf-cheque-no/g, 'rf-draft-no').replace(/rf-cheque-date/g, 'rf-draft-date').replace(/rf-bank/g, 'rf-bank-draft').replace(/rf-branch/g, 'rf-branch-draft').replace(/rf-employee/g, 'rf-employee-draft').replace('Cheque No.', 'Draft No.').replace('Cheque Date', 'Draft Date'),
        'Online': amountRow('Online', 'Online') + onlineInstrRow,
        'Cash': amountRow('Cash', 'Cash') + cashOnlyRow,
        'Adjust': amountRow('Adjust', 'Adjust') + `<div><label class="lbl">Remarks</label><input type="text" id="rf-adjust-remarks" style="${inp}"></div>`,
        'Dealer Adjustment': amountRow('Dealer Adj.', 'Dealer Adjustment') + `<div><label class="lbl">Remarks</label><input type="text" id="rf-dealer-remarks" style="${inp}"></div>`,
        'TDS Challan': amountRow('TDS', 'TDS Challan') + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end;"><div><label class="lbl">Challan No.</label><input type="text" id="rf-challan-no" style="${inp}"></div><div><label class="lbl">BSR Code</label><input type="text" id="rf-bsr-code" style="${inp}"></div><div><label class="lbl">Deposit Date</label><input type="date" id="rf-deposit-date" style="${inp}"></div></div>`,
        'Card': amountRow('Card', 'Card') + `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:end;"><div><label class="lbl">Terminal ID</label><input type="text" id="rf-terminal-id" style="${inp}"></div><div><label class="lbl">Approval Code</label><input type="text" id="rf-approval-code" style="${inp}"></div><div><label class="lbl">Employee</label><select id="rf-employee-card" style="${inp}">${userOpts}</select></div></div>`,
    };
    const tabBtns = tabs.map((t, i) => `<button id="tab-btn-${t.replace(/\s/g, '')}" onclick="switchTab('${t}')" style="padding:7px 13px;border:1px solid #dee2e6;border-bottom:none;background:${i === 0 ? '#1db5a0' : '#f8f9fa'};color:${i === 0 ? '#fff' : '#333'};cursor:pointer;font-size:12px;font-weight:600;border-radius:4px 4px 0 0;">${t}</button>`).join(' ');
    const tabPanels = tabs.map((t, i) => `<div id="tab-panel-${t.replace(/\s/g, '')}" class="tab-panel" style="display:${i === 0 ? 'block' : 'none'};padding:14px;">${tabContents[t] || amountRow(t, t)}</div>`).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Receipt — ${pmtEsc(consumer.consumer_name)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:13px;background:#f4f6f8;padding:12px;}
  .lbl{display:block;font-size:11px;font-weight:600;color:#555;margin-bottom:3px;}
  ${toggleCSS}
  .sec{border:1px solid #b8d4e4;background:#fff;margin-bottom:0;}
  .sec:last-of-type{border-radius:0 0 4px 4px;}
  .sec-hdr{border-radius:4px 4px 0 0;background:#e8f4f8;border-bottom:1px solid #b8d4e4;padding:8px 14px;}
</style>
</head>
<body>

<!-- Section 1: Consumer Header -->
<div class="sec-hdr" style="border:1px solid #b8d4e4;border-radius:4px 4px 0 0;">
  <div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
    <span style="color:#c0392b;font-weight:bold;font-size:15px;">${pmtEsc((consumer.salutation ? consumer.salutation + ' ' : '') + consumer.consumer_name)} [${pmtEsc(consumer.registration_no || '—')}]</span>
    <span style="color:#c0392b;font-weight:bold;">Tower: ${pmtEsc(consumer.tower_name || '—')}</span>
    <span style="color:#c0392b;font-weight:bold;">Unit No.: ${pmtEsc(consumer.unit_number || '—')}</span>
    <span style="color:#c0392b;font-weight:bold;">TDS Applicable: No</span>
  </div>
  <div style="display:flex;gap:22px;flex-wrap:wrap;font-size:13px;color:#333;">
    <span>Unit Cost: <strong>${fmtN(consumer.base_price_inr)}</strong></span>
    <span>S. Tax: <strong>0</strong></span>
    <span>GST: <strong>${fmtN(consumer.total_gst)}</strong></span>
    <span>Total Cost: <strong>${fmtN(consumer.total_cost)}</strong></span>
    <span style="color:#1a56db;">Paid: <strong>${fmtN(consumer.total_paid)}</strong></span>
    <span style="color:${balColor};">Balance: <strong>${fmtN(bal)}</strong></span>
    <span>Interest: <strong>${fmtN(consumer.interest_paid)}</strong></span>
  </div>
</div>

<!-- Section 2: Payment Detail -->
<div class="sec" style="padding:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="color:#1a56db;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:.5px;">PAYMENT DETAIL</span>
    <div class="tgl">
      <button id="btn-self" class="on" onclick="setSelfLoan('self')">Self</button>
      <button id="btn-loan" onclick="setSelfLoan('loan')">Bank Loan</button>
    </div>
  </div>

  <!-- Row 1 -->
  <div style="display:grid;grid-template-columns:160px 1fr 1fr 1fr auto;gap:12px;margin-bottom:14px;align-items:end;">
    <div>
      <label class="lbl">Receipt Date*</label>
      <input type="date" id="rf-date" value="${today}" style="${inp}">
    </div>
    <div>
      <label class="lbl">Received For</label>
      <input type="text" id="rf-received-for" value="${pmtEsc(consumer.company_name || '')}" style="${inp}">
    </div>
    <div>
      <label class="lbl">Account Holder</label>
      <input type="text" id="rf-account-holder" style="${inp}">
    </div>
    <div>
      <label class="lbl">Remark</label>
      <input type="text" id="rf-remark" style="${inp}">
    </div>
    <div>
      <label class="lbl">Invoice Date By</label>
      <div class="tgl">
        <button id="btn-receipt-date" class="on" onclick="setInvoiceDateBy('receipt')">Receipt Date</button>
        <button id="btn-posting-date" onclick="setInvoiceDateBy('posting')">Posting Date</button>
      </div>
    </div>
  </div>

  <!-- Row 2 -->
  <div style="display:grid;grid-template-columns:260px 1fr 1fr 1fr;gap:12px;align-items:end;">
    <div>
      <label class="lbl">On Account Of</label>
      <div style="display:flex;gap:6px;">
        <select id="rf-account-of" style="${inp}flex:1;" onchange="onAccountOfChange()">
          ${instOpts}
        </select>
        <input type="text" id="rf-account-of-other" placeholder="Specify…" style="${inp}flex:1;display:none;">
      </div>
    </div>
    <div>
      <label class="lbl">Interest</label>
      <div class="tgl">
        <button id="btn-int-inclusive" onclick="setInterest('inclusive')">Inclusive</button>
        <button id="btn-int-exclusive" class="on" onclick="setInterest('exclusive')">Exclusive</button>
      </div>
    </div>
    <div>
      <label class="lbl">Extra Add On</label>
      <div class="tgl">
        <button id="btn-xao-inclusive" onclick="setExtraAddOn('inclusive')">Inclusive</button>
        <button id="btn-xao-exclusive" class="on" onclick="setExtraAddOn('exclusive')">Exclusive</button>
      </div>
    </div>
    <div>
      <label class="lbl">TDS</label>
      <div class="tgl">
        <button id="btn-tds-calc" onclick="setTds('calculate')">Calculate Exclusive</button>
        <button id="btn-tds-none" class="on" onclick="setTds('not_calculate')">Not Calculate</button>
      </div>
    </div>
  </div>
</div>

<!-- Section 3: Payment Tabs -->
<div class="sec">
  <div style="display:flex;gap:2px;padding:10px 14px 0;flex-wrap:wrap;border-bottom:2px solid #dee2e6;">
    ${tabBtns}
  </div>
  ${tabPanels}
</div>

<!-- Section 4: Save / Close -->
<div class="sec" style="padding:10px 14px;display:flex;gap:10px;background:#f8f9fa;">
  <button onclick="saveReceipt()" id="rf-save-btn" style="background:#1db5a0;color:#fff;border:none;padding:9px 26px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;letter-spacing:.5px;">SAVE</button>
  <button onclick="window.close()" style="background:#6c757d;color:#fff;border:none;padding:9px 20px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button>
</div>

<script>
const CONSUMER_ID = '${consumer.consumer_id}';
const PAYMENT_PLAN_ID = '${consumer.payment_plan_id || ''}';
const TOKEN = '${token}';
const API_BASE = window.location.origin + '/api';
const GST_CGST_PCT = ${cgstPct};
const GST_SGST_PCT = ${sgstPct};
let currentTab = 'Cheque';
let selfOrLoan = '${consumer.self_or_loan || 'self'}';
let invoiceDateBy = 'receipt';
let interestMode = 'exclusive';
let extraAddOnMode = 'exclusive';
let tdsMode = 'not_calculate';

function setSelfLoan(mode) {
  selfOrLoan = mode;
  document.getElementById('btn-self').className = mode === 'self' ? 'on' : '';
  document.getElementById('btn-loan').className = mode === 'loan' ? 'on' : '';
}

function setInvoiceDateBy(mode) {
  invoiceDateBy = mode;
  document.getElementById('btn-receipt-date').className = mode === 'receipt' ? 'on' : '';
  document.getElementById('btn-posting-date').className = mode === 'posting' ? 'on' : '';
}

function setInterest(mode) {
  interestMode = mode;
  document.getElementById('btn-int-inclusive').className = mode === 'inclusive' ? 'on' : '';
  document.getElementById('btn-int-exclusive').className = mode === 'exclusive' ? 'on' : '';
}

function setExtraAddOn(mode) {
  extraAddOnMode = mode;
  document.getElementById('btn-xao-inclusive').className = mode === 'inclusive' ? 'on' : '';
  document.getElementById('btn-xao-exclusive').className = mode === 'exclusive' ? 'on' : '';
}

function setTds(mode) {
  tdsMode = mode;
  document.getElementById('btn-tds-calc').className = mode === 'calculate' ? 'on' : '';
  document.getElementById('btn-tds-none').className = mode === 'not_calculate' ? 'on' : '';
}

function onAccountOfChange() {
  const sel = document.getElementById('rf-account-of');
  const other = document.getElementById('rf-account-of-other');
  if (other) other.style.display = sel.value === '-1' ? 'inline-block' : 'none';
}

function inclusiveGstSplit(grossAmount, cgstPct, sgstPct) {
  const grossPaise = Math.round((grossAmount || 0) * 100);
  const combinedRate = cgstPct + sgstPct;
  let basePaise, cgstPaise, sgstPaise;
  if (combinedRate > 0) {
    basePaise = Math.floor(grossPaise / (1 + combinedRate / 100));
    const totalTaxPaise = grossPaise - basePaise;
    if (cgstPct === sgstPct) {
      cgstPaise = Math.floor(totalTaxPaise / 2);
      sgstPaise = totalTaxPaise - cgstPaise;
    } else {
      cgstPaise = Math.round(totalTaxPaise * (cgstPct / combinedRate));
      sgstPaise = totalTaxPaise - cgstPaise;
    }
  } else {
    basePaise = grossPaise; cgstPaise = 0; sgstPaise = 0;
  }
  return { baseAmount: basePaise / 100, cgstAmount: cgstPaise / 100, sgstAmount: sgstPaise / 100 };
}

function calcTotals() {
  const sfx = currentTab.replace(/\\s/g,'');
  const amount = parseFloat(document.getElementById('rf-amount-' + sfx)?.value || 0);
  const interest = parseFloat(document.getElementById('rf-interest-' + sfx)?.value || 0);
  const gstInterest = parseFloat((interest * 0.01).toFixed(2));
  const split = inclusiveGstSplit(amount, GST_CGST_PCT, GST_SGST_PCT);
  const paid = amount + interest + gstInterest;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val.toFixed(2); };
  set('rf-gst-interest-' + sfx, gstInterest);
  set('rf-cgst-' + sfx, split.cgstAmount);
  set('rf-sgst-' + sfx, split.sgstAmount);
  set('rf-paid-' + sfx, paid);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
    btn.style.background = '#f8f9fa'; btn.style.color = '#333';
  });
  const panel = document.getElementById('tab-panel-' + tabName.replace(/\\s/g,''));
  if (panel) panel.style.display = 'block';
  const btn = document.getElementById('tab-btn-' + tabName.replace(/\\s/g,''));
  if (btn) { btn.style.background = '#1db5a0'; btn.style.color = '#fff'; }
  currentTab = tabName;
}

function addExtraAddOn() {
  alert('Extra Add On feature not yet implemented.');
}

function getFieldVal(id) {
  const el = document.getElementById(id);
  return el ? (el.value || '') : '';
}

async function saveReceipt() {
  const sfx = currentTab.replace(/\\s/g,'');
  const amount = parseFloat(getFieldVal('rf-amount-' + sfx) || 0);
  if (!amount || amount <= 0) { showMsg('Please enter an amount', true); return; }

  const receiptDate = getFieldVal('rf-date');
  if (!receiptDate) { showMsg('Please select receipt date', true); return; }

  const accountOfSel = document.getElementById('rf-account-of');
  const isOther = !accountOfSel || accountOfSel.value === '-1';
  const installmentIndex = !isOther && accountOfSel.value
    ? parseInt(accountOfSel.value)
    : null;

  const interest = parseFloat(getFieldVal('rf-interest-' + sfx) || 0);
  const gstInterest = parseFloat(getFieldVal('rf-gst-interest-' + sfx) || 0);
  const totalAmount = amount + interest + gstInterest;

  const modeMap = {
    'Cheque':'cheque','Draft':'demand_draft','Online':'bank_transfer',
    'Cash':'cash','Card':'card','Adjust':'cheque',
    'Dealer Adjustment':'cheque','TDS Challan':'tds_challan'
  };
  const adjustmentTabs = { 'Adjust':true, 'Dealer Adjustment':true };

  const bankName = getFieldVal('rf-bank') || getFieldVal('rf-bank-online') || getFieldVal('rf-bank-draft') || '';
  const branch = getFieldVal('rf-branch') || getFieldVal('rf-branch-online') || getFieldVal('rf-branch-draft') || '';
  const chequeNo = getFieldVal('rf-cheque-no') || getFieldVal('rf-draft-no') || getFieldVal('rf-txn-ref') || '';
  const chequeDate = getFieldVal('rf-cheque-date') || getFieldVal('rf-draft-date') || getFieldVal('rf-txn-date') || '';

  const payload = {
    consumerId: CONSUMER_ID,
    amountReceivedInr: totalAmount,
    baseAmount: amount,
    interestAmount: interest || undefined,
    paymentDate: receiptDate,
    paymentMode: modeMap[currentTab] || 'cash',
    isAdjustment: adjustmentTabs[currentTab] || undefined,
    bankName: bankName || undefined,
    branch: branch || undefined,
    chequeNo: chequeNo || undefined,
    chequeDate: chequeDate || undefined,
    remarks: getFieldVal('rf-remark') || undefined,
    installmentIndex: installmentIndex !== null ? installmentIndex : undefined,
    isOtherPayment: isOther || undefined,
    otherChargeDesc: isOther
      ? ((document.getElementById('rf-account-of-other')?.value || '').trim() || undefined)
      : undefined,
  };

  const saveBtn = document.getElementById('rf-save-btn');
  saveBtn.textContent = 'Saving…';
  saveBtn.disabled = true;

  try {
    const res = await fetch(API_BASE + '/payments/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    showMsg('Receipt ' + (data.data?.receipt_number || '') + ' created successfully!');
    setTimeout(() => {
      if (window.opener && !window.opener.closed) {
        try { window.opener.ReportsPage && window.opener.ReportsPage.fetchPaymentFile(); } catch(e) {}
      }
      window.close();
    }, 2200);
  } catch (err) {
    showMsg('Error: ' + err.message, true);
    saveBtn.textContent = 'SAVE';
    saveBtn.disabled = false;
  }
}

function showMsg(msg, isError) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 18px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);' + (isError ? 'background:#c0392b;color:#fff;' : 'background:#1db5a0;color:#fff;');
  d.textContent = (isError ? '✖ ' : '✔ ') + msg;
  document.body.appendChild(d);
  if (!isError) setTimeout(() => d.remove(), 3000);
}
</script>
</body>
</html>`;
}
// GET /api/payments/receipt-form/:consumerId — Serve standalone receipt entry form
router.get('/receipt-form/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id');
        const rawToken = (req.headers.authorization?.split(' ')[1] || req.query.token || '');
        const token = typeof rawToken === 'string' && /^[\w.\-]*$/.test(rawToken) ? rawToken : ''; // goes into a script: a token is letters, digits, . - _ only
        // 1. Consumer + financial summary
        const consumerResult = await index_js_1.db.query(`
      SELECT
        c.id AS consumer_id,
        c.registration_no,
        c.salutation,
        c.first_name || ' ' || COALESCE(c.last_name,'') AS consumer_name,
        c.finance_bank,
        c.loan_amount,
        u.unit_number,
        u.floor,
        COALESCE(NULLIF(ROUND(br.basic_rate_inr_sqft * br.carpet_area_sqft), 0), u.base_price_inr) AS base_price_inr,   -- the booked price, not the price of a unit the customer was shifted to
        u.total_price_inr,
        t.tower_name,
        p.name AS project_name,
        p.id AS project_id,
        br.id AS booking_record_id,
        pp.id AS payment_plan_id,
        COALESCE(br.self_or_loan, 'self') AS self_or_loan,
        COALESCE(br.plc_amount, 0) AS plc_amount,
        COALESCE(br.other_charge_amount, 0) AS other_charge_amount,
        COALESCE(dl.cgst, 0) AS cgst_amount,
        COALESCE(dl.sgst, 0) AS sgst_amount,
        COALESCE(dl.cgst, 0) + COALESCE(dl.sgst, 0) AS total_gst,
        COALESCE(dl.total, 0) AS total_cost,
        COALESCE(rc.paid, 0) AS total_paid,
        COALESCE(dl.total, 0) - COALESCE(rc.paid, 0) AS balance,
        COALESCE((
          SELECT SUM(r.interest_amount)
          FROM receipts r
          WHERE r.consumer_id = c.id AND r.status != 'cancelled'
        ), 0) AS interest_paid,
        COALESCE(pco.name, (SELECT value FROM global_settings WHERE key = 'company_name' LIMIT 1)) AS company_name
      FROM consumers c
      LEFT JOIN booking_records br ON br.consumer_id = c.id
      LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
      LEFT JOIN units u ON u.id = COALESCE(br.unit_id, pp.unit_id)
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN companies pco ON pco.id = p.company_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(cgst_amount,0) + COALESCE(addon_cgst_amount,0)) AS cgst,
               SUM(COALESCE(sgst_amount,0) + COALESCE(addon_sgst_amount,0)) AS sgst,
               SUM(amount_due_inr + COALESCE(cgst_amount,0) + COALESCE(sgst_amount,0) + COALESCE(addon_charge_amount,0) + COALESCE(addon_cgst_amount,0) + COALESCE(addon_sgst_amount,0)) AS total
        FROM demands WHERE consumer_id = c.id AND status <> 'cancelled') dl ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(amount_received_inr) AS paid FROM receipts
        WHERE consumer_id = c.id AND status NOT IN ('cancelled', 'bounced') AND NOT COALESCE(is_advance, false)) rc ON TRUE
      WHERE c.id = $1
        AND u.id IS NOT NULL
      ORDER BY COALESCE(br.created_at, pp.created_at) DESC
      LIMIT 1
    `, [consumerId]);
        if (!consumerResult.rows[0]) {
            return res.status(404).send('<h2>Consumer not found or no booking record exists.</h2>');
        }
        const consumer = consumerResult.rows[0];
        // 2. Installments from plan_schedule_templates with demand status for dropdown guard
        const instResult = await index_js_1.db.query(`
      SELECT DISTINCT ON (pst.installment_index)
        pst.installment_index,
        pst.installment_name,
        pst.percentage,
        COALESCE(pst.flat_amount_inr, 0) AS flat_amount,
        COALESCE(d.status, 'pending') AS demand_status,
        COALESCE(d.delivery_status, 'pending') AS demand_delivery_status
      FROM plan_schedule_templates pst
      LEFT JOIN demands d
        ON d.consumer_id = $2
       AND d.installment_index = pst.installment_index
      WHERE pst.project_id = $1
      ORDER BY pst.installment_index
    `, [consumer.project_id, consumerId]);
        // 3. Banks
        const banksResult = await index_js_1.db.query(`SELECT id, name FROM banks ORDER BY name`);
        // 4. Users
        const usersResult = await index_js_1.db.query(`SELECT id, name, email FROM users ORDER BY name LIMIT 50`);
        // 5. Resolve real project GST rate (percentage points) for CGST/SGST display calc
        const today = (0, business_date_js_1.businessToday)();
        const rate = await (0, gst_resolver_js_1.resolveRate)(index_js_1.db, consumer.project_id, consumer.project_name, 'BASIC', today);
        const cgstPct = rate.cgstPct * 100;
        const sgstPct = rate.sgstPct * 100;
        const html = buildReceiptFormHtml(consumer, instResult.rows, banksResult.rows, usersResult.rows, token, cgstPct, sgstPct);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── RECEIPT DETAIL PAGE (standalone HTML page) ─────────────────────────────────
async function buildReceiptDetailHtml(rows) {
    const fmtD = (d) => {
        if (!d)
            return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtN = (n) => parseFloat(String(n || 0)).toFixed(2);
    const capitalizeMode = (mode) => {
        if (!mode)
            return '—';
        const map = {
            cheque: 'Cheque', neft_rtgs: 'Online', bank_transfer: 'Online',
            upi: 'Online', cash: 'Cash', draft: 'Draft', card: 'Card', online: 'Online', neft: 'Online', rtgs: 'Online'
        };
        return map[mode.toLowerCase()] || mode;
    };
    const tdStyle = `border:1px solid #dee2e6;padding:6px 8px;font-size:12px;`;
    const dthStyle = `border:1px solid #2d4d7a;padding:5px 6px;text-align:center;font-size:11px;font-weight:bold;white-space:nowrap;`;
    const dtdStyle = `border:1px solid #dee2e6;padding:4px 6px;font-size:11px;`;
    const buildDetailRows = async (r) => {
        const isNri = ['nri', 'oci', 'pio'].includes((r.nationality || '').toLowerCase());
        const drows = [];
        let sno = 1;
        const basicAmt = parseFloat(String(r.amount_received_inr || 0));
        const basicCgst = parseFloat(String(r.cgst_amount || 0));
        const basicSgst = parseFloat(String(r.sgst_amount || 0));
        drows.push({ sno: sno++, installmentName: r.installment_name || '—', head: 'Basic Price', amount: basicAmt, cgst: basicCgst, sgst: basicSgst, netAmount: basicAmt });
        const pushChargeRow = async (amountRaw, head, chargeType) => {
            const a = parseFloat(String(amountRaw || 0));
            if (a <= 0)
                return;
            let c = 0, s = 0;
            if (!isNri) {
                const rate = await (0, gst_resolver_js_1.resolveRate)(index_js_1.db, r.project_id, r.project_name, chargeType, r.received_date);
                c = Math.round(a * rate.cgstPct * 100) / 100;
                s = Math.round(a * rate.sgstPct * 100) / 100;
            }
            drows.push({ sno: sno++, installmentName: '', head, amount: a, cgst: c, sgst: s, netAmount: a + c + s });
        };
        await pushChargeRow(r.plc_amount, 'PLC', 'PLC');
        await pushChargeRow(r.edc_amount, 'EDC', 'BASIC');
        await pushChargeRow(r.idc_amount, 'IDC', 'BASIC');
        await pushChargeRow(r.other_charge_amount, r.other_charge_desc || 'Other Charge', 'OTHER CHARGE');
        // Interest never carries GST — confirmed business rule, no rate lookup.
        if (parseFloat(String(r.interest_amount || 0)) > 0) {
            const a = parseFloat(String(r.interest_amount));
            drows.push({ sno: sno++, installmentName: '', head: 'Interest', amount: a, cgst: 0, sgst: 0, netAmount: a });
        }
        return drows;
    };
    if (!rows || rows.length === 0) {
        return `<!DOCTYPE html><html><head><title>Receipt Detail</title></head><body style="font-family:Arial;padding:20px;">
<div style="background:#1e3a5f;color:white;padding:10px 16px;border-radius:4px;font-weight:bold;font-size:14px;">RECEIPT DETAIL</div>
<p style="margin-top:40px;color:#666;text-align:center;padding:40px;">No receipts found for this consumer.</p>
<div style="margin-top:16px;"><button onclick="window.close()" style="background:#6c757d;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button></div>
</body></html>`;
    }
    const consumer = rows[0];
    let totalAmount = 0, totalGst = 0, totalInterest = 0, totalExtraCharge = 0, totalNet = 0;
    rows.forEach((r) => {
        const amt = parseFloat(String(r.amount_received_inr || 0));
        const intr = parseFloat(String(r.interest_amount || 0));
        const extra = parseFloat(String(r.plc_amount || 0)) + parseFloat(String(r.edc_amount || 0))
            + parseFloat(String(r.idc_amount || 0)) + parseFloat(String(r.other_charge_amount || 0));
        // amt is inclusive of GST — GST is informational only, not added to net
        totalAmount += amt;
        totalGst += parseFloat(String(r.cgst_amount || 0)) + parseFloat(String(r.sgst_amount || 0));
        totalInterest += intr;
        totalExtraCharge += extra;
        totalNet += amt + intr + extra;
    });
    const allDetailRows = await Promise.all(rows.map((r) => buildDetailRows(r)));
    const receiptRowsHtml = rows.map((r, idx) => {
        const amt = parseFloat(String(r.amount_received_inr || 0));
        const gst = parseFloat(String(r.cgst_amount || 0)) + parseFloat(String(r.sgst_amount || 0));
        const intr = parseFloat(String(r.interest_amount || 0));
        const extra = parseFloat(String(r.plc_amount || 0)) + parseFloat(String(r.edc_amount || 0))
            + parseFloat(String(r.idc_amount || 0)) + parseFloat(String(r.other_charge_amount || 0));
        const net = amt + intr + extra;
        const drows = allDetailRows[idx];
        const dtotal = drows.reduce((acc, dr) => ({
            amount: acc.amount + dr.amount, cgst: acc.cgst + dr.cgst,
            sgst: acc.sgst + dr.sgst, net: acc.net + dr.netAmount
        }), { amount: 0, cgst: 0, sgst: 0, net: 0 });
        // Status-based color coding — matches applicant file receipt section exactly
        const bg = { pending: '#FFFF99', deposited: '#d4edda', bounced: '#ffcccc', on_hold: '#cce5ff', cleared: '#ffffff', cancelled: '#e2e3e5' }[r.status] ?? '#ffffff';
        const detailRowsHtml = drows.map((dr) => `
        <tr>
          <td style="${dtdStyle}">${pmtEsc(dr.installmentName)}</td>
          <td style="${dtdStyle}">${pmtEsc(dr.head)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.amount)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.cgst)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dr.sgst)}</td>
          <td style="${dtdStyle}text-align:right;font-weight:600;">${fmtN(dr.netAmount)}</td>
        </tr>`).join('') + `
        <tr style="background:#d0e8f0;font-weight:bold;">
          <td colspan="2" style="${dtdStyle}text-align:right;">Total</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.amount)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.cgst)}</td>
          <td style="${dtdStyle}text-align:right;">${fmtN(dtotal.sgst)}</td>
          <td style="${dtdStyle}text-align:right;font-weight:bold;">${fmtN(dtotal.net)}</td>
        </tr>`;
        return `
    <tr style="background:${bg};vertical-align:top;">
      <td style="${tdStyle}text-align:center;">${idx + 1}</td>
      <td style="${tdStyle}">${pmtEsc(r.receipt_number || '—')}</td>
      <td style="${tdStyle}white-space:nowrap;">${fmtD(r.received_date)}</td>
      <td style="${tdStyle}">${capitalizeMode(r.payment_method)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(amt)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(gst)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(intr)}</td>
      <td style="${tdStyle}text-align:right;">${fmtN(extra)}</td>
      <td style="${tdStyle}text-align:right;font-weight:600;">${fmtN(net)}</td>
      <td style="${tdStyle}">${pmtEsc(r.entry_by || '—')}</td>
      <td style="${tdStyle}white-space:nowrap;">${fmtD(r.created_at)}</td>
      <td style="${tdStyle}padding:0;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:420px;">
          <thead>
            <tr style="background:#1e3a5f;color:white;">
              <th style="${dthStyle}">Installment Name</th>
              <th style="${dthStyle}">Head</th>
              <th style="${dthStyle}text-align:right;">Amount</th>
              <th style="${dthStyle}text-align:right;">CGST</th>
              <th style="${dthStyle}text-align:right;">SGST</th>
              <th style="${dthStyle}text-align:right;">Net Amount</th>
            </tr>
          </thead>
          <tbody>${detailRowsHtml}</tbody>
        </table>
      </td>
    </tr>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Receipt Detail — ${pmtEsc(consumer.consumer_name)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:Arial,sans-serif;font-size:12px;background:#f5f5f5;padding:16px;}
    @media print{.no-print{display:none!important;}body{padding:0;background:#fff;}}
  </style>
</head>
<body>
  <div style="background:#1e3a5f;color:white;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;border-radius:4px 4px 0 0;flex-wrap:wrap;gap:8px;">
    <span style="font-weight:bold;font-size:14px;letter-spacing:.5px;">RECEIPT DETAIL</span>
    <span><strong>Project:</strong> ${pmtEsc(consumer.project_name)}</span>
    <span><strong>Name:</strong> ${pmtEsc(consumer.consumer_name)}</span>
    <span><strong>Registration No.:</strong> ${pmtEsc(consumer.registration_no)}</span>
  </div>
  <div class="no-print" style="margin:8px 0;padding:8px 12px;background:white;border:1px solid #dee2e6;border-top:none;display:flex;gap:16px;flex-wrap:wrap;font-size:11px;align-items:center;">
    <strong>Status:</strong>
    <span style="background:#ffffff;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x2705; Cleared</span>
    <span style="background:#FFFF99;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x1F550; Pending</span>
    <span style="background:#d4edda;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x1F3E6; Deposited</span>
    <span style="background:#cce5ff;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x23F8; On Hold</span>
    <span style="background:#ffcccc;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x274C; Bounced</span>
    <span style="background:#e2e3e5;border:1px solid #ccc;padding:2px 8px;border-radius:3px;">&#x1F6AB; Cancelled</span>
  </div>
  <div style="overflow-x:auto;border:1px solid #dee2e6;border-top:none;background:white;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:1200px;">
      <thead>
        <tr style="background:#2d5282;color:white;">
          <th style="${tdStyle}text-align:center;background:#2d5282;color:white;font-weight:bold;">S.No</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Receipt No.</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Receipt Date</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Payment Mode</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">GST</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Interest</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Extra Charge Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;text-align:right;">Net Amount</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Entry By</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Entry Date</th>
          <th style="${tdStyle}background:#2d5282;color:white;font-weight:bold;">Detail</th>
        </tr>
      </thead>
      <tbody>${receiptRowsHtml}</tbody>
      <tfoot>
        <tr style="background:#e8f4f8;font-weight:bold;">
          <td colspan="3" style="${tdStyle}text-align:right;font-weight:bold;">Total</td>
          <td style="${tdStyle}"></td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalAmount)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalGst)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalInterest)}</td>
          <td style="${tdStyle}text-align:right;">${fmtN(totalExtraCharge)}</td>
          <td style="${tdStyle}text-align:right;font-weight:bold;">${fmtN(totalNet)}</td>
          <td colspan="3" style="${tdStyle}"></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="no-print" style="margin-top:16px;display:flex;gap:10px;">
    <button onclick="window.print()" style="background:#1db5a0;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">PRINT</button>
    <button onclick="window.close()" style="background:#6c757d;color:white;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">CLOSE</button>
  </div>
</body>
</html>`;
}
// GET /api/payments/receipt-detail/:consumerId — Standalone receipt detail page
router.get('/receipt-detail/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id');
        if (!(await index_js_1.db.query(`SELECT 1 FROM consumers WHERE id = $1`, [consumerId])).rows.length)
            throw (0, input_js_1.bad)('Applicant not found', 404);
        const result = await index_js_1.db.query(`
      SELECT
        r.id,
        r.receipt_number,
        r.received_date,
        r.payment_method,
        r.amount_received_inr,
        COALESCE(r.plc_amount, 0)          AS plc_amount,
        COALESCE(r.edc_amount, 0)          AS edc_amount,
        COALESCE(r.idc_amount, 0)          AS idc_amount,
        COALESCE(r.interest_amount, 0)     AS interest_amount,
        COALESCE(r.other_charge_amount, 0) AS other_charge_amount,
        r.other_charge_desc,
        r.installment_index,
        r.status,
        r.created_at,
        COALESCE(u.name, 'System')                            AS entry_by,
        CASE
          WHEN pst.installment_name IS NOT NULL
            THEN pst.installment_name
          WHEN r.installment_index IS NULL
            AND r.other_charge_desc IS NOT NULL
            AND r.other_charge_desc != ''
            THEN r.other_charge_desc
          WHEN r.installment_index IS NULL
            THEN 'Booking Amount'
          ELSE 'General Payment'
        END                                                    AS installment_name,
        c.first_name || ' ' || COALESCE(c.last_name, '')      AS consumer_name,
        c.registration_no,
        c.nationality,
        p.id    AS project_id,
        p.name  AS project_name,
        un.unit_number,
        t.tower_name,
        r.cgst_amount AS cgst_amount,
        r.sgst_amount AS sgst_amount
      FROM receipts r
      JOIN consumers c    ON c.id  = r.consumer_id
      JOIN payment_plans pp ON pp.id = r.payment_plan_id
      JOIN units un        ON un.id = pp.unit_id
      JOIN projects p      ON p.id  = pp.project_id
      LEFT JOIN towers t   ON t.id  = un.tower_id
      LEFT JOIN demands d  ON d.id  = r.demand_id
      LEFT JOIN users u    ON u.id  = r.received_by_user_id
      LEFT JOIN LATERAL (
        SELECT installment_name
        FROM   plan_schedule_templates
        WHERE  project_id       = p.id
          AND  installment_index = r.installment_index
        LIMIT 1
      ) pst ON true
      LEFT JOIN LATERAL (
        SELECT gts.cgst_pct, gts.sgst_pct
        FROM gst_tax_charge_mapping gcm
        JOIN gst_slabs gs ON gs.id = gcm.slab_id
          AND gs.from_date <= ${business_date_js_1.SQL_TODAY} AND gs.to_date >= ${business_date_js_1.SQL_TODAY}
        JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
        WHERE gcm.project_id = p.id AND gcm.charge_type = 'BASIC'
        LIMIT 1
      ) grate ON true
      LEFT JOIN LATERAL (
        SELECT
          (ROUND(r.amount_received_inr * 100) -
            FLOOR(ROUND(r.amount_received_inr * 100) / (1 + (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)) / 100.0))
          )::bigint AS total_tax_paise
      ) ttax ON true
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN COALESCE(grate.cgst_pct,0.5) = COALESCE(grate.sgst_pct,0.5)
              THEN FLOOR(ttax.total_tax_paise / 2.0)
            ELSE ROUND(ttax.total_tax_paise * COALESCE(grate.cgst_pct,0.5) / (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)))
          END::bigint AS cgst_paise
      ) gtax ON true
      WHERE r.consumer_id = $1
        AND r.status != 'cancelled'
      ORDER BY r.received_date ASC, r.created_at ASC
    `, [consumerId]);
        const html = await buildReceiptDetailHtml(result.rows);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── CHEQUE CLEARING ENDPOINTS ────────────────────────────────────────────────
// GET /api/payments/clearing-banks/:projectId - List active bank accounts for a project
// Fetches from company_bank_accounts via project → company linkage.
// Falls back to project-level bank_accounts if no company linked.
router.get('/clearing-banks/:projectId', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.params.projectId, 'Project id');
        if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw (0, input_js_1.bad)('Project not found', 404);
        // Primary: company bank accounts linked via project.company_id
        const companyResult = await index_js_1.db.query(`SELECT cba.id, cba.bank_name, cba.account_number, cba.ifsc_code,
              cba.branch, cba.is_primary, cba.account_name
       FROM company_bank_accounts cba
       JOIN companies comp ON comp.id = cba.company_id
       JOIN projects p ON p.company_id = comp.id
       WHERE p.id = $1 AND cba.is_active = true
       ORDER BY cba.is_primary DESC, cba.bank_name ASC`, [projectId]);
        if (companyResult.rows.length > 0) {
            return res.json({ success: true, data: companyResult.rows.map((r) => (0, company_bank_js_1.forRole)(req.userRole, r)) });
        }
        // Fallback: project-level bank_accounts (legacy)
        const fallbackResult = await index_js_1.db.query(`SELECT id, bank_name, account_number, ifsc_code
       FROM bank_accounts
       WHERE project_id = $1 AND is_active = true
       ORDER BY bank_name`, [projectId]);
        res.json({ success: true, data: fallbackResult.rows.map((r) => (0, company_bank_js_1.forRole)(req.userRole, r)) });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Interest: who may do what ──────────────────────────────────────────────────
// Reading and calculating: every role with payments access (project scope applies). Saving a calculation, rates, dates, grace days, manual interest: accounts and finance only.
// Deleting stored interest needs payments:delete (super_admin only, from rbac). Waivers live in financial-ops.ts.
const projectInScope = async (c, id) => { if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [id])).rows.length)
    throw (0, input_js_1.bad)('Project not found', 404); };
const towerOf = async (c, towerId, projectId) => { if (towerId && !(await c.query(`SELECT 1 FROM towers WHERE id = $1 AND project_id = $2`, [towerId, projectId])).rows.length)
    throw (0, input_js_1.bad)('That tower is not in this project', 400); };
const consumerRow = async (c, id) => { if (!(await c.query(`SELECT 1 FROM consumers WHERE id = $1`, [id])).rows.length)
    throw (0, input_js_1.bad)('Consumer not found', 404); };
const filterText = (v, label) => (0, input_js_1.qtext)(v, label, 100);
// POST /api/payments/interest-scheduler - Batch interest calculation for a project (persist: true saves it, accounts and finance only)
router.post('/interest-scheduler', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(b.project_id, 'project_id'), tower_id = optId(b.tower_id, 'tower_id'), persist = (0, input_js_1.flag)(b.persist, 'persist') === true;
        if (persist && !['super_admin', 'accounts_finance'].includes(req.userRole || ''))
            throw (0, input_js_1.bad)('Only accounts and finance can save the interest calculation', 403);
        await projectInScope(index_js_1.db, project_id);
        await towerOf(index_js_1.db, tower_id, project_id);
        // Step A: penal rate (project-level override → global fallback)
        const penalRate = await getPenalInterestRate(project_id);
        // Step B: all consumers for project (optionally filtered by tower)
        const consumersRes = await index_js_1.db.query(`SELECT DISTINCT
         c.id                   AS consumer_id,
         c.name                 AS consumer_name,
         c.registration_no,
         pp.id                  AS payment_plan_id,
         c.grace_period_days,
         c.interest_start_date
       FROM consumers c
       JOIN allocations a  ON a.consumer_id = c.id
       JOIN units u        ON u.id = a.unit_id
       JOIN towers t       ON t.id = u.tower_id
       LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
       WHERE t.project_id = $1
         AND ($2::uuid IS NULL OR t.id = $2)
         AND c.id IS NOT NULL`, [project_id, tower_id]);
        const details = [];
        let totalInterest = 0;
        let consumersWithInterest = 0, skippedNoPlan = 0;
        // Fetch installment name + rate map once for the whole project
        const templatesRes = await index_js_1.db.query(`SELECT installment_index, installment_name, interest_rate_percent
       FROM plan_schedule_templates
       WHERE project_id = $1
       ORDER BY installment_index ASC`, [project_id]);
        const templateNameMap = {};
        const templateRateMap = {};
        templatesRes.rows.forEach((t) => {
            templateNameMap[t.installment_index] = t.installment_name;
            templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
        });
        // Step C: per-consumer calculation
        for (const consumer of consumersRes.rows) {
            const cid = consumer.consumer_id;
            const receiptsRes = await index_js_1.db.query(`SELECT id, amount_received_inr, demand_id, installment_index,
                status, received_date, created_at
         FROM receipts
         WHERE consumer_id = $1
           AND status NOT IN ('cancelled','bounced')
         ORDER BY received_date ASC, created_at ASC`, [cid]);
            const demandsRaw = await index_js_1.db.query(`SELECT id, installment_index, amount_due_inr, due_date,
                cgst_amount, sgst_amount,
                addon_charge_amount, addon_cgst_amount, addon_sgst_amount
         FROM demands
         WHERE consumer_id = $1
         ORDER BY installment_index ASC`, [cid]);
            const demandsRes = { rows: demandsRaw.rows.map((d) => ({
                    ...d,
                    installment_name: templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
                    interest_rate_percent: templateRateMap[d.installment_index] ?? null,
                })) };
            const allRows = (0, payment_waterfall_js_1.buildInterestRows)(receiptsRes.rows, demandsRes.rows, penalRate, {
                gracePeriodDays: parseInt(String(consumer.grace_period_days || 0)),
                interestStartDate: consumer.interest_start_date
                    ? new Date(String(consumer.interest_start_date))
                    : null,
                asOfDate: (0, business_date_js_1.businessDayStart)(),
            });
            const interestRows = allRows.filter(r => r.interest_amount > 0);
            // Step D: persist if requested (what was waived comes back with the new rows; manual interest is left alone)
            if (persist) {
                if (consumer.payment_plan_id)
                    await (0, input_js_1.inTx)((c) => (0, penal_interest_js_1.persistInterest)(c, cid, consumer.payment_plan_id, interestRows));
                else
                    skippedNoPlan++;
            }
            if (interestRows.length > 0) {
                const consumerTotal = interestRows.reduce((s, r) => s + r.interest_amount, 0);
                totalInterest += consumerTotal;
                consumersWithInterest++;
                details.push({
                    consumer_id: cid,
                    consumer_name: consumer.consumer_name,
                    registration_number: consumer.registration_no,
                    total_interest: Math.round(consumerTotal * 100) / 100,
                    rows: interestRows,
                });
            }
        }
        if (persist)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'penal_interest', project_id, undefined, { scope: tower_id ? 'tower' : 'project', consumers: consumersRes.rows.length, skipped_no_plan: skippedNoPlan });
        res.json({
            success: true,
            summary: {
                consumers_processed: consumersRes.rows.length,
                consumers_with_interest: consumersWithInterest,
                total_interest_inr: Math.round(totalInterest * 100) / 100,
                persisted: persist,
                skipped_no_plan: skippedNoPlan,
            },
            details,
        });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// DELETE /api/payments/interest-scheduler - Remove the stored calculated interest of a project (manual entries stay; waivers come back when it is calculated again)
router.delete('/interest-scheduler', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(b.project_id, 'project_id'), tower_id = optId(b.tower_id, 'tower_id');
        await projectInScope(index_js_1.db, project_id);
        await towerOf(index_js_1.db, tower_id, project_id);
        const result = await index_js_1.db.query(`DELETE FROM penal_interests
       WHERE status = 'calculated' AND consumer_id IN (
         SELECT DISTINCT c.id
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id
         JOIN units u       ON u.id = a.unit_id
         JOIN towers t      ON t.id = u.tower_id
         WHERE t.project_id = $1
           AND ($2::uuid IS NULL OR t.id = $2)
       )`, [project_id, tower_id]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'penal_interest', project_id, undefined, { scope: tower_id ? 'tower' : 'project', deleted: result.rowCount });
        res.json({ success: true, deleted: result.rowCount });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Project-wise Interest Master endpoints ─────────────────────────────────
// GET /api/payments/interest-master/:projectId — rate history for a project
router.get('/interest-master/:projectId', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT pir.id, pir.rate_percent, pir.effective_from, pir.created_at, pir.interest_type, pir.compound_frequency, pir.calculated_on,
              u.name AS created_by_name
       FROM project_interest_rates pir
       LEFT JOIN users u ON u.id = pir.created_by
       WHERE pir.project_id = $1
       ORDER BY pir.effective_from DESC, pir.created_at DESC`, [(0, input_js_1.uuid)(req.params.projectId, 'Project id')]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// The rate that starts on a date is one per project (the newest date wins when penal interest is worked out), so a second one on the same date is refused
const rateInput = (b, cur) => {
    if (!(0, input_js_1.has)(b.rate_percent))
        throw (0, input_js_1.bad)('rate_percent is required');
    // Simple or Compound (with how often it compounds) and what the interest is calculated on, as the client's interest master has them
    const type = (0, input_js_1.has)(b.interest_type) ? (0, input_js_1.oneOf)(b.interest_type, 'interest_type', ['Simple', 'Compound']) : cur?.interest_type ?? 'Simple';
    const freq = type === 'Compound' ? ((0, input_js_1.has)(b.compound_frequency) ? (0, input_js_1.oneOf)(b.compound_frequency, 'compound_frequency', ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly']) : ('compound_frequency' in b ? null : cur?.compound_frequency ?? null)) : null;
    if (type === 'Compound' && !freq)
        throw (0, input_js_1.bad)('compound_frequency is required for compound interest');
    if (type === 'Simple' && (0, input_js_1.has)(b.compound_frequency))
        throw (0, input_js_1.bad)('compound_frequency is only for compound interest');
    const on = (0, input_js_1.has)(b.calculated_on) ? (0, input_js_1.text)(b.calculated_on, 'calculated_on', 30, true) : cur?.calculated_on ?? 'Receipt Date Wise';
    return { rate: (0, input_js_1.num)(b.rate_percent, 'Interest rate', 100, 2), from: (0, input_js_1.day)(b.effective_from, 'Effective date'), type, freq, on };
};
// POST /api/payments/interest-master — create new project interest rate (accounts and finance only)
router.post('/interest-master', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(b.project_id, 'project_id'), ri = rateInput(b), { rate, from } = ri, eff = from || today();
        const row = await (0, input_js_1.inTx)(async (c) => {
            await projectInScope(c, project_id);
            await (0, input_js_1.lock)(c, 'rate:' + project_id);
            if ((await c.query(`SELECT 1 FROM project_interest_rates WHERE project_id = $1 AND effective_from = $2`, [project_id, eff])).rows.length)
                throw (0, input_js_1.bad)('A rate already starts on this date, edit that one', 409);
            return (await c.query(`INSERT INTO project_interest_rates (project_id, rate_percent, effective_from, created_by, interest_type, compound_frequency, calculated_on) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, rate_percent, effective_from, created_at, interest_type, compound_frequency, calculated_on`, [project_id, rate, eff, req.userId || null, ri.type, ri.freq, ri.on])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'project_interest_rate', row.id, undefined, { project_id, rate_percent: rate, effective_from: eff });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PUT /api/payments/interest-master/:id — update an existing rate record (accounts and finance only)
router.put('/interest-master/:id', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Rate id'), rb = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT project_id, rate_percent, effective_from, interest_type, compound_frequency, calculated_on FROM project_interest_rates WHERE id = $1`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Rate record not found', 404);
            const { rate, from, type, freq, on } = rateInput(rb, cur);
            await (0, input_js_1.lock)(c, 'rate:' + cur.project_id);
            if (from && (await c.query(`SELECT 1 FROM project_interest_rates WHERE project_id = $1 AND effective_from = $2 AND id <> $3`, [cur.project_id, from, id])).rows.length)
                throw (0, input_js_1.bad)('A rate already starts on this date', 409);
            const row = (await c.query(`UPDATE project_interest_rates SET rate_percent = $1, effective_from = COALESCE($2, effective_from), interest_type = $4, compound_frequency = $5, calculated_on = $6 WHERE id = $3 RETURNING id, rate_percent, effective_from, interest_type, compound_frequency, calculated_on`, [rate, from, id, type, freq, on])).rows[0];
            return { row, cur, rate, from };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project_interest_rate', id, { rate_percent: out.cur.rate_percent, effective_from: out.cur.effective_from }, { rate_percent: out.rate, effective_from: out.from });
        res.json({ success: true, data: out.row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Installment-wise Interest endpoints ────────────────────────────────────
// GET /api/payments/plan-names/:projectId — distinct plan names for a project
router.get('/plan-names/:projectId', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC`, [(0, input_js_1.uuid)(req.params.projectId, 'Project id')]);
        res.json({ success: true, data: result.rows.map((r) => r.plan_name) });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/installment-interest/:projectId/:planName — installments with current rates
router.get('/installment-interest/:projectId/:planName', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT installment_index, installment_name, percentage, interest_rate_percent
       FROM plan_schedule_templates
       WHERE project_id = $1 AND plan_name = $2
       ORDER BY installment_index ASC`, [(0, input_js_1.uuid)(req.params.projectId, 'Project id'), (0, input_js_1.text)(req.params.planName, 'Plan name', 100, true)]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PUT /api/payments/installment-interest/:projectId/:planName — batch update per-installment rates (accounts and finance only)
router.put('/installment-interest/:projectId/:planName', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.params.projectId, 'Project id'), planName = (0, input_js_1.text)(req.params.planName, 'Plan name', 100, true);
        const rates = (0, input_js_1.body)(req).rates; // Array<{ installment_index: number; interest_rate_percent: number | null }>
        if (!Array.isArray(rates) || !rates.length)
            throw (0, input_js_1.bad)('rates array is required');
        if (rates.length > 200)
            throw (0, input_js_1.bad)('At most 200 installments at a time');
        const seen = new Set();
        const clean = rates.map((r) => {
            if (!r || typeof r !== 'object' || Array.isArray(r))
                throw (0, input_js_1.bad)('Each rate must be an object');
            if (typeof r.installment_index !== 'number' || !Number.isInteger(r.installment_index) || r.installment_index < 1 || r.installment_index > 999)
                throw (0, input_js_1.bad)('installment_index must be a whole number from 1 to 999');
            if (seen.has(r.installment_index))
                throw (0, input_js_1.bad)(`Installment ${r.installment_index} is listed twice`);
            seen.add(r.installment_index);
            return { idx: r.installment_index, rate: (0, input_js_1.has)(r.interest_rate_percent) ? (0, input_js_1.num)(r.interest_rate_percent, 'interest_rate_percent', 100, 2) : null };
        });
        await (0, input_js_1.inTx)(async (c) => {
            for (const r of clean) {
                const u = await c.query(`UPDATE plan_schedule_templates SET interest_rate_percent = $1 WHERE project_id = $2 AND plan_name = $3 AND installment_index = $4`, [r.rate, projectId, planName, r.idx]);
                if (!u.rowCount)
                    throw (0, input_js_1.bad)(`Installment ${r.idx} is not in this plan`, 404);
            }
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'installment_interest', projectId, undefined, { plan_name: planName, rates: clean });
        res.json({ success: true, updated: clean.length });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Customer Wise Interest endpoints ──────────────────────────────────────────
// GET /api/payments/customer-wise-consumers — list consumers for a project with interest dates
router.get('/customer-wise-consumers', async (req, res, next) => {
    try {
        const q = req.query;
        if (!(0, input_js_1.has)(q.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(q.project_id, 'project_id'), tower_id = optId(q.tower_id, 'tower_id');
        const registration_no = filterText(q.registration_no, 'registration_no'), first_name = filterText(q.first_name, 'first_name'), unit_address = filterText(q.unit_address, 'unit_address');
        const result = await index_js_1.db.query(`WITH base AS (
         SELECT DISTINCT ON (c.id)
           c.id AS consumer_id,
           c.name,
           c.registration_no,
           u.unit_number AS unit_address,
           t.tower_name,
           t.project_id,
           pp.id AS payment_plan_id,
           COALESCE(
             (SELECT DISTINCT pst.plan_name
              FROM plan_schedule_templates pst
              WHERE pst.project_id = t.project_id
              LIMIT 1),
             'Payment Plan'
           ) AS payment_plan,
           c.interest_start_date,
           c.grace_period_days,
           COALESCE(
             (SELECT SUM(pi2.amount_inr)
              FROM penal_interests pi2
              WHERE pi2.consumer_id = c.id),
             0
           ) AS total_penal_interest_inr
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id AND a.status NOT IN ('cancelled', 'transferred')
         JOIN units u ON u.id = a.unit_id
         JOIN towers t ON t.id = u.tower_id
         LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
         WHERE t.project_id = $1
           AND ($2::uuid IS NULL OR t.id = $2::uuid)
           AND ($3::text IS NULL OR c.registration_no ILIKE '%' || $3 || '%')
           AND ($4::text IS NULL OR c.name ILIKE '%' || $4 || '%')
           AND ($5::text IS NULL OR u.unit_number ILIKE '%' || $5 || '%')
         ORDER BY c.id, pp.created_at DESC NULLS LAST
       )
       SELECT * FROM base ORDER BY name ASC`, [project_id, tower_id, registration_no, first_name, unit_address]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/payments/consumer-interest-date/:consumerId — set interest_start_date and remove stale calculated interest (accounts and finance only)
router.patch('/consumer-interest-date/:consumerId', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id'), b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.interest_start_date))
            throw (0, input_js_1.bad)('interest_start_date is required');
        const interest_start_date = (0, input_js_1.day)(b.interest_start_date, 'interest_start_date');
        const row = await (0, input_js_1.inTx)(async (c) => {
            await (0, input_js_1.lock)(c, 'pi:' + consumerId);
            const u = await c.query(`UPDATE consumers SET interest_start_date = $1 WHERE id = $2 RETURNING id, interest_start_date`, [interest_start_date, consumerId]);
            if (!u.rows[0])
                throw (0, input_js_1.bad)('Consumer not found', 404);
            await c.query(`DELETE FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated' AND ${(0, business_date_js_1.sqlDay)('calculated_at')} < $2::date`, [consumerId, interest_start_date]);
            return u.rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'consumer_interest', consumerId, undefined, { interest_start_date });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// DELETE /api/payments/consumer-interest/:consumerId — delete ALL stored interest of a consumer, manual entries too (super_admin only, from rbac)
router.delete('/consumer-interest/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id');
        const result = await (0, input_js_1.inTx)(async (c) => {
            await consumerRow(c, consumerId);
            await (0, input_js_1.lock)(c, 'pi:' + consumerId);
            return c.query(`DELETE FROM penal_interests WHERE consumer_id = $1`, [consumerId]);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'consumer_interest', consumerId, undefined, { deleted: result.rowCount });
        res.json({ success: true, deleted: result.rowCount });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/interest-waiver-list — project-level consumer list for waive-off screen
router.get('/interest-waiver-list', async (req, res, next) => {
    try {
        const q = req.query;
        if (!(0, input_js_1.has)(q.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(q.project_id, 'project_id');
        const type = (0, input_js_1.oneOf)(q.type, 'type', ['All', 'Self', 'Pending', 'Loan Sanctioned']);
        const registration_no = filterText(q.registration_no, 'registration_no'), first_name = filterText(q.first_name, 'first_name'), unit_address = filterText(q.unit_address, 'unit_address');
        const result = await index_js_1.db.query(`WITH base AS (
         SELECT DISTINCT ON (c.id)
           c.id AS consumer_id,
           c.name,
           c.registration_no,
           u.unit_number AS unit_address,
           CASE
             WHEN c.loan_amount > 0 AND c.loan_sanction_date IS NOT NULL THEN 'Loan Sanctioned'
             WHEN c.loan_amount > 0 AND c.loan_sanction_date IS NULL     THEN 'Pending'
             ELSE 'Self'
           END AS type,
           c.loan_amount,
           c.loan_sanction_date
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id AND a.status NOT IN ('cancelled', 'transferred')
         JOIN units u       ON u.id = a.unit_id
         JOIN towers t      ON t.id = u.tower_id
         WHERE t.project_id = $1
         ORDER BY c.id, a.created_at DESC
       )
       SELECT
         b.*,
         COALESCE(SUM(pi.amount_inr), 0)            AS total_interest_inr,
         COALESCE(SUM(pi.interest_waived_inr), 0)   AS total_waived_inr,
         COALESCE(SUM(pi.amount_inr) - SUM(pi.interest_waived_inr), 0) AS balance_interest_inr,
         0 AS paid_interest_inr
       FROM base b
       LEFT JOIN penal_interests pi ON pi.consumer_id = b.consumer_id AND pi.status IN ('calculated', 'manual')
       WHERE ($2::text IS NULL OR b.type = $2)
         AND ($3::text IS NULL OR b.registration_no ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR b.name ILIKE '%' || $4 || '%')
         AND ($5::text IS NULL OR b.unit_address ILIKE '%' || $5 || '%')
       GROUP BY b.consumer_id, b.name, b.registration_no, b.unit_address, b.type, b.loan_amount, b.loan_sanction_date
       ORDER BY b.name ASC`, [project_id, type && type !== 'All' ? type : null, registration_no, first_name, unit_address]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/payments/consumer-interest-detail/:consumerId — recalc, persist, return rows
router.post('/consumer-interest-detail/:consumerId', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id');
        const out = await (0, input_js_1.inTx)(async (client) => {
            await (0, input_js_1.lock)(client, 'pi:' + consumerId);
            // Fetch consumer with project context
            const consumerRes = await client.query(`SELECT c.id, c.interest_start_date, c.grace_period_days,
                pp.id AS payment_plan_id,
                t.project_id
         FROM consumers c
         LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
         LEFT JOIN allocations a   ON a.consumer_id = c.id
         LEFT JOIN units u         ON u.id = a.unit_id
         LEFT JOIN towers t        ON t.id = u.tower_id
         WHERE c.id = $1
         ORDER BY pp.created_at DESC
         LIMIT 1`, [consumerId]);
            if (!consumerRes.rows[0])
                throw (0, input_js_1.bad)('Consumer not found', 404);
            const consumer = consumerRes.rows[0];
            const projectId = consumer.project_id;
            // Penal rate
            const penalRate = await getPenalInterestRate(projectId);
            // Template name/rate map for this project
            const templatesRes = await client.query(`SELECT installment_index, installment_name, interest_rate_percent
         FROM plan_schedule_templates
         WHERE project_id = $1
         ORDER BY installment_index ASC`, [projectId]);
            const templateNameMap = {};
            const templateRateMap = {};
            templatesRes.rows.forEach((t) => {
                templateNameMap[t.installment_index] = t.installment_name;
                templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
            });
            // Receipts
            const receiptsRes = await client.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
         FROM receipts
         WHERE consumer_id = $1 AND status NOT IN ('cancelled','bounced')
         ORDER BY received_date ASC, created_at ASC`, [consumerId]);
            // Demands
            const demandsRaw = await client.query(`SELECT id, installment_index, amount_due_inr, due_date,
                cgst_amount, sgst_amount,
                addon_charge_amount, addon_cgst_amount, addon_sgst_amount
         FROM demands
         WHERE consumer_id = $1
         ORDER BY installment_index ASC`, [consumerId]);
            const demands = demandsRaw.rows.map((d) => ({
                ...d,
                installment_name: templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
                interest_rate_percent: templateRateMap[d.installment_index] ?? null,
            }));
            // Calculate
            const allRows = (0, payment_waterfall_js_1.buildInterestRows)(receiptsRes.rows, demands, penalRate, {
                interestStartDate: consumer.interest_start_date ? new Date(String(consumer.interest_start_date)) : null,
                gracePeriodDays: parseInt(String(consumer.grace_period_days || 0)),
                asOfDate: (0, business_date_js_1.businessDayStart)(),
            });
            const interestRows = allRows.filter((r) => r.interest_amount > 0);
            // Replace the stored rows; what was waived comes back with them (a consumer without a payment plan has nowhere to store interest)
            const penalIdMap = consumer.payment_plan_id ? await (0, penal_interest_js_1.persistInterest)(client, consumerId, consumer.payment_plan_id, interestRows) : {};
            const waivedRes = await client.query(`SELECT COALESCE(SUM(interest_waived_inr), 0) AS total_waived_inr FROM penal_interests WHERE consumer_id = $1 AND status IN ('calculated', 'manual')`, [consumerId]);
            return { allRows, penalIdMap, consumer, totalWaived: parseFloat(waivedRes.rows[0].total_waived_inr) };
        });
        const totalInterest = out.allRows.reduce((s, r) => s + r.interest_amount, 0);
        res.json({
            success: true,
            rows: out.allRows,
            penal_interest_ids: out.penalIdMap,
            payment_plan_id: out.consumer.payment_plan_id,
            summary: {
                total_interest: Math.round(totalInterest * 100) / 100,
                total_waived: out.totalWaived,
                balance_interest: Math.round((totalInterest - out.totalWaived) * 100) / 100,
            },
        });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/payments/manual-interest — insert a manual penal_interest record (accounts and finance only)
router.post('/manual-interest', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumer_id) || !(0, input_js_1.has)(b.amount_inr))
            throw (0, input_js_1.bad)('consumer_id and amount_inr are required');
        const consumerId = (0, input_js_1.uuid)(b.consumer_id, 'consumer_id'), amount = (0, input_js_1.pos)(b.amount_inr, 'amount_inr', 0), planArg = optId(b.payment_plan_id, 'payment_plan_id');
        const idx = (0, input_js_1.has)(b.installment_index) ? b.installment_index : null;
        if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 1 || idx > 999)
            throw (0, input_js_1.bad)('installment_index is required, a whole number from 1 to 999');
        const row = await (0, input_js_1.inTx)(async (c) => {
            await consumerRow(c, consumerId);
            await (0, input_js_1.lock)(c, 'pi:' + consumerId);
            const plan = (await c.query(`SELECT id FROM payment_plans WHERE consumer_id = $1 AND ($2::uuid IS NULL OR id = $2) ORDER BY created_at DESC LIMIT 1`, [consumerId, planArg])).rows[0];
            if (!plan)
                throw (0, input_js_1.bad)(planArg ? 'That payment plan does not belong to this consumer' : 'This consumer has no payment plan', 400);
            return (await c.query(`INSERT INTO penal_interests (consumer_id, payment_plan_id, installment_index, principal_inr, days_overdue, rate_percent, amount_inr, calculated_at, status)
         VALUES ($1, $2, $3, 0, 0, 0, $4, NOW(), 'manual') RETURNING *`, [consumerId, plan.id, idx, amount])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'penal_interest', row.id, undefined, { consumer_id: consumerId, amount_inr: amount, installment_index: row.installment_index, manual: true });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/payments/consumer-waiver-report — reads from interest_waivers (permanent, never wiped)
router.get('/consumer-waiver-report', async (req, res, next) => {
    try {
        if (!(0, input_js_1.has)(req.query.project_id))
            throw (0, input_js_1.bad)('project_id is required');
        const project_id = (0, input_js_1.uuid)(req.query.project_id, 'project_id');
        const result = await index_js_1.db.query(`SELECT
         c.id AS consumer_id,
         c.name AS consumer_name,
         c.registration_no,
         u.unit_number AS unit_address,
         t.tower_name,
         COALESCE(iw_agg.waiver_count, 0)       AS waiver_count,
         COALESCE(iw_agg.total_waived_inr, 0)   AS total_waived_inr,
         iw_agg.last_waiver_date,
         COALESCE(pi_agg.total_interest_inr, 0) AS total_interest_inr,
         GREATEST(
           COALESCE(pi_agg.total_interest_inr, 0) - COALESCE(iw_agg.total_waived_inr, 0),
           0
         ) AS balance_interest_inr
       FROM consumers c
       JOIN allocations a ON a.consumer_id = c.id
       JOIN units u       ON u.id = a.unit_id
       JOIN towers t      ON t.id = u.tower_id
       LEFT JOIN (
         SELECT consumer_id,
           COUNT(*)                  AS waiver_count,
           SUM(waiver_amount_inr)    AS total_waived_inr,
           MAX(created_at)           AS last_waiver_date
         FROM interest_waivers
         WHERE status = 'approved'
         GROUP BY consumer_id
       ) iw_agg ON iw_agg.consumer_id = c.id
       LEFT JOIN (
         SELECT consumer_id,
           SUM(amount_inr) AS total_interest_inr
         FROM penal_interests
         WHERE status IN ('calculated', 'manual')
         GROUP BY consumer_id
       ) pi_agg ON pi_agg.consumer_id = c.id
       WHERE t.project_id = $1
         AND COALESCE(iw_agg.total_waived_inr, 0) > 0
       ORDER BY c.name ASC`, [project_id]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/payments/consumer-grace-period/:consumerId — set grace_period_days (accounts and finance only)
router.patch('/consumer-grace-period/:consumerId', input_js_1.financeOnly, async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.params.consumerId, 'Consumer id'), g = (0, input_js_1.body)(req).grace_period_days;
        if (!(0, input_js_1.has)(g))
            throw (0, input_js_1.bad)('grace_period_days is required');
        const days = typeof g === 'number' ? g : typeof g === 'string' && /^\d+$/.test(g) ? Number(g) : NaN;
        if (!Number.isInteger(days) || days < 0 || days > 3650)
            throw (0, input_js_1.bad)('grace_period_days must be a whole number from 0 to 3650');
        const row = await (0, input_js_1.inTx)(async (c) => {
            await (0, input_js_1.lock)(c, 'pi:' + consumerId);
            const u = await c.query(`UPDATE consumers SET grace_period_days = $1 WHERE id = $2 RETURNING id, grace_period_days`, [days, consumerId]);
            if (!u.rows[0])
                throw (0, input_js_1.bad)('Consumer not found', 404);
            // Clear stale calculated interest so next recalc uses the new grace period
            await c.query(`DELETE FROM penal_interests WHERE consumer_id = $1 AND status = 'calculated'`, [consumerId]);
            return u.rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'consumer_interest', consumerId, undefined, { grace_period_days: days });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=payments.js.map