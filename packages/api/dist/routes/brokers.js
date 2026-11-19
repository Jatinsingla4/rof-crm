"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Brokers Routes
 * Broker registration (maker), approval (checker), status, project mapping, and the commission list / payment.
 * Rules:
 *  - a broker is registered as 'pending'; another person with checker access approves or rejects it (super_admin may do both)
 *  - commission is made by the booking (base price x rate, or a flat amount); here it can only be paid, once
 *  - paying works out GST and TDS from the broker's tax setup (default TDS 5%, GST 18%): net paid = commission + GST - TDS, to the paisa
 *  - a commission is paid only for a booking that has received its booking amount (cleared, once commission_requires_cleared_v1 is on), and never to a suspended broker
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const input_js_1 = require("../utils/input.js");
const applicant_js_1 = require("../utils/applicant.js");
const holds_js_1 = require("../utils/holds.js");
const financial_ops_js_1 = require("./financial-ops.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next, 'A broker with the same mobile or PAN already exists');
const BROKER_STATUS = ['pending', 'active', 'inactive', 'suspended', 'rejected'];
const COMMISSION_STATUS = ['pending', 'approved', 'paid', 'cancelled'];
const SENSITIVE = ['bank_account_details', 'pan', 'tax_id_pan', 'tax_id_gst'];
const sees = (req) => ['super_admin', 'accounts_finance'].includes(req.userRole || '');
const NO_PAN_TDS = 20; // a broker without a PAN is cut at least 20% (section 206AA)
// Bank details from the nested object or from the flat form fields; only the parts that were filled in are kept
const bankOf = (b) => {
    const src = b.bankAccountDetails !== undefined ? b.bankAccountDetails : b;
    if (src === null)
        return null;
    if (typeof src !== 'object' || Array.isArray(src))
        throw (0, input_js_1.bad)('Bank details are not valid');
    const pick = (...k) => k.map((x) => src[x]).find(input_js_1.has);
    const d = {};
    const holder = (0, input_js_1.text)(pick('accountName', 'bank_account_name', 'accountHolder'), 'Account holder name', 120, false);
    if (holder)
        d.accountName = holder;
    const acc = pick('accountNo', 'bank_account_no', 'accountNumber');
    if ((0, input_js_1.has)(acc)) {
        const a = String(acc).replace(/\s/g, '');
        if (!/^\d{6,18}$/.test(a))
            throw (0, input_js_1.bad)('Account number must be 6 to 18 digits');
        d.accountNo = a;
    }
    const ifsc = pick('ifsc', 'bank_ifsc');
    if ((0, input_js_1.has)(ifsc)) {
        const i = String(ifsc).toUpperCase().replace(/\s/g, '');
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(i))
            throw (0, input_js_1.bad)('IFSC must look like HDFC0001234');
        d.ifsc = i;
    }
    const bank = (0, input_js_1.text)(pick('bankName', 'bank_name'), 'Bank name', 120, false);
    if (bank)
        d.bankName = bank;
    const branch = (0, input_js_1.text)(pick('branch', 'bank_branch'), 'Bank branch', 120, false);
    if (branch)
        d.branch = branch;
    const touched = ['bankAccountDetails', 'accountName', 'bank_account_name', 'accountNo', 'bank_account_no', 'ifsc', 'bank_ifsc', 'bankName', 'bank_name', 'branch', 'bank_branch'].some((k) => b[k] !== undefined);
    if (!touched)
        return undefined;
    return Object.keys(d).length ? d : null;
};
// The broker columns a request may set (a key left out is not touched on edit)
const brokerFields = (b, forCreate) => {
    const o = {};
    const set = (col, v) => { if (v !== undefined)
        o[col] = v; };
    const given = (...k) => k.find((x) => b[x] !== undefined);
    const firmKey = given('firmName', 'firm_name'), nameKey = given('name'), contactKey = given('contact_person', 'contactPerson');
    const firm = firmKey ? (0, input_js_1.text)(b[firmKey], 'Firm name', 255, true) : forCreate ? (0, input_js_1.text)(undefined, 'Firm name', 255, true) : undefined;
    set('firm_name', firm);
    const contact = contactKey ? (0, input_js_1.text)(b[contactKey], 'Contact person', 255, false) : undefined;
    set('contact_person', contact);
    const nm = nameKey ? (0, input_js_1.text)(b.name, 'Name', 255, false) : undefined;
    if (forCreate)
        o.name = nm || contact || firm;
    else if (nameKey) {
        if (!nm)
            throw (0, input_js_1.bad)('Name is required');
        o.name = nm;
    }
    const mobKey = given('mobile');
    if (mobKey || forCreate)
        o.mobile = (0, applicant_js_1.mobileNo)(b.mobile, 'Mobile', true);
    const altKey = given('alt_mobile', 'altMobile');
    if (altKey)
        o.alt_mobile = (0, input_js_1.has)(b[altKey]) ? (0, applicant_js_1.mobileNo)(b[altKey], 'Alternate mobile') : null;
    const emailKey = given('email');
    if (emailKey)
        o.email = (0, applicant_js_1.emailAddr)(b.email);
    const reraKey = given('reraNumber', 'rera_no', 'rera_number');
    if (reraKey)
        o.rera_number = (0, input_js_1.text)(b[reraKey], 'RERA number', 100, false);
    const panKey = given('pan', 'pan_no');
    if (panKey) {
        const p = (0, applicant_js_1.panNo)(b[panKey]);
        o.pan = p;
        o.tax_id_pan = p;
    }
    const gstKey = given('gstNo', 'gst_no');
    if (gstKey)
        o.tax_id_gst = (0, applicant_js_1.gstinNo)(b[gstKey]);
    const addrKey = given('address');
    if (addrKey)
        o.address = (0, input_js_1.text)(b.address, 'Address', 500, false);
    const cityKey = given('city');
    if (cityKey)
        o.city = (0, input_js_1.text)(b.city, 'City', 100, false);
    const stateKey = given('state');
    if (stateKey)
        o.state = (0, input_js_1.text)(b.state, 'State', 100, false);
    const pinKey = given('pin_code', 'pinCode');
    if (pinKey) {
        const p = (0, input_js_1.text)(b[pinKey], 'Pin code', 10, false);
        if (p && !/^\d{6}$/.test(p))
            throw (0, input_js_1.bad)('Pin code must be 6 digits');
        o.pin_code = p;
    }
    const remKey = given('remarks');
    if (remKey)
        o.remarks = (0, input_js_1.text)(b.remarks, 'Remarks', 1000, false);
    const pctKey = given('commissionPct', 'commission_rate', 'commission_pct');
    if (pctKey) {
        if (!(0, input_js_1.has)(b[pctKey])) {
            if (!forCreate)
                throw (0, input_js_1.bad)('Commission rate is required');
        }
        else
            o.commission_pct = (0, input_js_1.num)(b[pctKey], 'Commission rate', 100, 2);
    }
    const bank = bankOf(b);
    if (bank !== undefined)
        o.bank_account_details = bank === null ? null : JSON.stringify(bank);
    const parentKey = given('parentBrokerId', 'parent_broker_id');
    if (parentKey)
        o.parent_broker_id = (0, input_js_1.has)(b[parentKey]) ? (0, input_js_1.uuid)(b[parentKey], 'Parent broker') : null;
    return o;
};
const visible = (req, row) => { if (!sees(req))
    for (const k of SENSITIVE)
        delete row[k]; return row; };
// A mobile or PAN that another live broker (not rejected) already has
const duplicate = async (c, o, selfId) => {
    if (o.mobile) {
        await (0, input_js_1.lock)(c, 'broker-mobile:' + o.mobile);
        if ((await c.query(`SELECT 1 FROM brokers WHERE mobile = $1 AND status <> 'rejected' AND id IS DISTINCT FROM $2 LIMIT 1`, [o.mobile, selfId])).rows.length)
            throw (0, input_js_1.bad)('A broker with this mobile number already exists', 409);
    }
    if (o.pan) {
        await (0, input_js_1.lock)(c, 'broker-pan:' + o.pan);
        if ((await c.query(`SELECT 1 FROM brokers WHERE pan = $1 AND status <> 'rejected' AND id IS DISTINCT FROM $2 LIMIT 1`, [o.pan, selfId])).rows.length)
            throw (0, input_js_1.bad)('A broker with this PAN already exists', 409);
    }
};
const parentOk = async (c, parentId, selfId) => {
    if (!parentId)
        return;
    if (parentId === selfId)
        throw (0, input_js_1.bad)('A broker cannot be its own parent');
    const p = (await c.query(`SELECT status FROM brokers WHERE id = $1`, [parentId])).rows[0];
    if (!p)
        throw (0, input_js_1.bad)('Parent broker not found', 404);
    if (p.status === 'rejected')
        throw (0, input_js_1.bad)('A rejected broker cannot be a parent');
    if (selfId && (await c.query(`WITH RECURSIVE up AS (SELECT id, parent_broker_id FROM brokers WHERE id = $1 UNION SELECT b.id, b.parent_broker_id FROM brokers b JOIN up ON b.id = up.parent_broker_id) SELECT 1 FROM up WHERE id = $2`, [parentId, selfId])).rows.length) {
        throw (0, input_js_1.bad)('This would make the broker its own ancestor');
    }
};
// ---------- commission ----------
const commissionFilter = (q) => {
    const params = [];
    let w = '';
    const add = (sql, v) => { params.push(v); w += ` AND ${sql.replace('?', '$' + params.length)}`; };
    if ((0, input_js_1.has)(q.brokerId))
        add('bc.broker_id = ?', (0, input_js_1.uuid)(q.brokerId, 'brokerId'));
    if ((0, input_js_1.has)(q.projectId))
        add('bc.project_id = ?', (0, input_js_1.uuid)(q.projectId, 'projectId'));
    const st = (0, input_js_1.oneOf)(q.status, 'status', COMMISSION_STATUS);
    if (st)
        add('bc.status = ?', st);
    const from = (0, input_js_1.day)(q.dateFrom, 'dateFrom'), to = (0, input_js_1.day)(q.dateTo, 'dateTo');
    if (from)
        add(`${(0, business_date_js_1.sqlDay)('bc.created_at')} >= ?`, from);
    if (to)
        add(`${(0, business_date_js_1.sqlDay)('bc.created_at')} <= ?`, to);
    if (from && to && from > to)
        throw (0, input_js_1.bad)('dateFrom is after dateTo');
    return { w, params };
};
// GET /api/brokers/commission
router.get('/commission', async (req, res, next) => {
    try {
        const { w, params } = commissionFilter(req.query);
        const { size, offset } = (0, input_js_1.paging)(req.query, 100, 500);
        const rows = (await index_js_1.db.query(`SELECT bc.id, bc.broker_id, b.name AS broker_name, b.firm_name, bc.consumer_id, c.name AS consumer_name,
              bc.project_id, p.name AS project_name, bc.unit_id, u.unit_number,
              bc.commission_amount_inr, bc.gst_amount, bc.tds_amount, bc.net_amount_inr, bc.status, bc.paid_at, bc.created_at, bc.notes,
              bk.booking_amount, bk.status AS booking_status, bk.registration_no,
              bk.broker_commission AS commission_value, bk.broker_commission_type AS commission_type,
              -- QA-009: the status is what finance recorded; this is what backs it. Cleared money of the booking against its booking amount (read only, nothing is reversed)
              cl.cleared AS cleared_money_inr, (cl.cleared + 0.005 >= GREATEST(COALESCE(bk.booking_amount, 0), 0.01)) AS cleared_basis_ok
         FROM broker_commissions bc
         LEFT JOIN brokers b ON bc.broker_id = b.id
         LEFT JOIN consumers c ON bc.consumer_id = c.id
         LEFT JOIN projects p ON bc.project_id = p.id
         LEFT JOIN units u ON bc.unit_id = u.id
         LEFT JOIN LATERAL (SELECT booking_amount, status, registration_no, broker_commission, broker_commission_type FROM booking_records
                             WHERE id = bc.booking_id) bk ON true
         LEFT JOIN LATERAL (SELECT ${(0, money_basis_js_1.eligibleSum)('r')} AS cleared FROM receipts r WHERE r.consumer_id = bc.consumer_id) cl ON true
        WHERE 1=1 ${w}
        ORDER BY bc.created_at DESC, bc.id LIMIT ${size} OFFSET ${offset}`, params)).rows;
        // totals over the whole filter, not just this page (a cancelled commission is not owed)
        const s = (await index_js_1.db.query(`SELECT COUNT(*)::int AS count, (COUNT(*) FILTER (WHERE status <> 'cancelled'))::int AS live,
              COALESCE(SUM(commission_amount_inr) FILTER (WHERE status <> 'cancelled'), 0) AS total,
              COALESCE(SUM(commission_amount_inr) FILTER (WHERE status IN ('pending', 'approved')), 0) AS pending,
              COALESCE(SUM(commission_amount_inr) FILTER (WHERE status = 'paid'), 0) AS paid,
              COALESCE(SUM(net_amount_inr) FILTER (WHERE status = 'paid'), 0) AS net_paid,
              COALESCE(SUM(commission_amount_inr) FILTER (WHERE status = 'cancelled'), 0) AS cancelled
         FROM broker_commissions bc WHERE 1=1 ${w}`, params)).rows[0];
        res.json({ success: true, data: rows, summary: s });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/brokers/commission/:id   { status: 'paid', notes? } or { notes }
router.patch('/commission/:id', (0, processPermission_js_1.requireProcess)('broker_payment_entry', 'maker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Commission id');
        const b = (0, input_js_1.body)(req);
        if ((0, input_js_1.has)(b.status) && b.status !== 'paid')
            throw (0, input_js_1.bad)("Only 'paid' can be set here, a commission is cancelled when its booking is cancelled or surrendered");
        const status = (0, input_js_1.has)(b.status) ? 'paid' : null;
        const notes = (0, input_js_1.text)(b.notes, 'Notes', 500, false);
        if (!status && notes === null)
            throw (0, input_js_1.bad)('Nothing to change: send status "paid" or notes');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cm = (await c.query(`SELECT * FROM broker_commissions WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cm)
                throw (0, input_js_1.bad)('Commission record not found', 404);
            if (!status)
                return { before: cm, after: (await c.query(`UPDATE broker_commissions SET notes = $2 WHERE id = $1 RETURNING id, status, paid_at, notes`, [id, notes])).rows[0] };
            if (cm.status === 'paid')
                throw (0, input_js_1.bad)('This commission is already paid', 409);
            if (cm.status === 'cancelled')
                throw (0, input_js_1.bad)('This commission is cancelled (its booking was cancelled or surrendered) and cannot be paid', 409);
            const amount = Number(cm.commission_amount_inr);
            if (!(amount > 0))
                throw (0, input_js_1.bad)('There is no commission amount to pay', 400);
            const brk = (await c.query(`SELECT status, pan FROM brokers WHERE id = $1`, [cm.broker_id])).rows[0];
            if (!brk || !['active', 'inactive'].includes(brk.status))
                throw (0, input_js_1.bad)(`The broker is ${brk?.status || 'missing'}, so commission cannot be paid`, 409);
            const bk = (await c.query(`SELECT status, consumer_id, booking_amount FROM booking_records WHERE id = $1`, [cm.booking_id])).rows[0];
            if (!bk || !['active', 'complete'].includes(bk.status))
                throw (0, input_js_1.bad)('The booking has not received its booking amount (or is cancelled), so commission cannot be paid yet', 409);
            // Flag commission_requires_cleared_v1 (off until finance turns it on): the booking amount must have CLEARED (BR-03), not only been written down.
            // With the flag off a payout needs only the booking to be active/complete, as before; the reconciliation lists paid commissions with no cleared receipt.
            if ((await c.query(`SELECT value FROM global_settings WHERE key = 'commission_requires_cleared_v1'`)).rows[0]?.value === 'on') {
                const cleared = Number((await c.query(`SELECT ${(0, money_basis_js_1.eligibleSum)('r')} AS n FROM receipts r WHERE r.consumer_id = $1`, [bk.consumer_id])).rows[0].n);
                const need = Math.max(Number(bk.booking_amount || 0), 0.01);
                if (cleared + 0.005 < need)
                    throw (0, input_js_1.bad)(`No cleared money behind this booking yet (cleared ${(0, input_js_1.r2)(cleared)}, booking amount ${(0, input_js_1.r2)(need)}). A commission is paid on cleared money, so it cannot be paid yet`, 409);
            }
            const cfg = (await c.query(`SELECT tds_rate_pct, gst_rate_pct, is_gst_exempt FROM broker_tax_config WHERE broker_id = $1`, [cm.broker_id])).rows[0];
            if (!cfg)
                throw (0, input_js_1.bad)('The tax setup (TDS and GST rate) of this broker is not done. Save it in Broker Setup first, then pay the commission.', 409);
            const own = Number(cfg.tds_rate_pct), tdsRate = brk.pan ? own : Math.max(own, NO_PAN_TDS), gstRate = cfg.is_gst_exempt ? 0 : Number(cfg.gst_rate_pct);
            const tds = (0, input_js_1.r2)(amount * tdsRate / 100), gst = (0, input_js_1.r2)(amount * gstRate / 100), net = (0, input_js_1.r2)(amount + gst - tds);
            const after = (await c.query(`UPDATE broker_commissions SET status = 'paid', paid_at = NOW(), paid_by = $2, gst_amount = $3, tds_amount = $4, net_amount_inr = $5, notes = COALESCE($6, notes)
          WHERE id = $1 RETURNING id, status, paid_at, commission_amount_inr, gst_amount, tds_amount, net_amount_inr`, [id, req.userId, gst, tds, net, notes])).rows[0];
            return { before: cm, after };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker_commission', id, { status: out.before.status }, out.after);
        res.json({ success: true, data: out.after });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/brokers
router.get('/', async (req, res, next) => {
    try {
        const status = (0, input_js_1.oneOf)(req.query.status, 'status', BROKER_STATUS);
        const search = (0, input_js_1.qtext)(req.query.search, 'search', 100);
        const { size, offset } = (0, input_js_1.paging)(req.query, 100, 500);
        const params = [];
        let w = '';
        if (status) {
            params.push(status);
            w += ` AND b.status = $${params.length}`;
        }
        if (search) {
            params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
            w += ` AND (b.name ILIKE $${params.length} OR b.mobile ILIKE $${params.length} OR b.firm_name ILIKE $${params.length})`;
        }
        const result = await index_js_1.db.query(`SELECT b.id, b.name, b.firm_name, b.contact_person, b.mobile, b.email, b.rera_number, b.city, b.state,
              b.status, b.commission_pct, b.total_referrals, b.created_at,
              COALESCE(SUM(bc.commission_amount_inr) FILTER (WHERE bc.status = 'paid'), 0) AS total_paid_inr,
              COALESCE(SUM(bc.commission_amount_inr) FILTER (WHERE bc.status IN ('pending', 'approved')), 0) AS total_pending_inr
         FROM brokers b LEFT JOIN broker_commissions bc ON b.id = bc.broker_id
        WHERE 1=1 ${w}
        GROUP BY b.id ORDER BY b.created_at DESC, b.id LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/brokers   (maker)
router.post('/', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'maker'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const o = brokerFields(b, true);
        if (o.commission_pct === undefined)
            o.commission_pct = 2;
        if (b.gst_on_commission !== undefined && !['yes', 'no'].includes(b.gst_on_commission))
            throw (0, input_js_1.bad)('gst_on_commission must be yes or no');
        const row = await (0, input_js_1.inTx)(async (c) => {
            await duplicate(c, o, null);
            await parentOk(c, o.parent_broker_id ?? null, null);
            o.status = 'pending';
            o.created_by = req.userId;
            const cols = Object.keys(o);
            const r = (await c.query(`INSERT INTO brokers (${cols.join(', ')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id, name, firm_name, mobile, status, commission_pct, created_at`, cols.map((k) => o[k]))).rows[0];
            if (b.gst_on_commission === 'no')
                await c.query(`INSERT INTO broker_tax_config (broker_id, is_gst_exempt, updated_by) VALUES ($1, true, $2)`, [r.id, req.userId]);
            return r;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'broker', row.id, undefined, { name: row.name, firm_name: row.firm_name, mobile: row.mobile });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/brokers/:id
router.get('/:id', async (req, res, next) => {
    try {
        const row = (await index_js_1.db.query(`SELECT * FROM brokers WHERE id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Broker id')])).rows[0];
        if (!row)
            return res.status(404).json({ error: 'Broker not found' });
        res.json({ success: true, data: visible(req, row) });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/brokers/:id   (maker) edit details; the status is changed by PATCH /:id/status
router.patch('/:id', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'maker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        const b = (0, input_js_1.body)(req);
        if (b.status !== undefined)
            throw (0, input_js_1.bad)('The status is changed through the status step (checker access)');
        const o = brokerFields(b, false);
        if (!Object.keys(o).length)
            throw (0, input_js_1.bad)('Nothing to change');
        const after = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT status FROM brokers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Broker not found', 404);
            if (cur.status === 'rejected')
                throw (0, input_js_1.bad)('A rejected broker cannot be edited', 409);
            await duplicate(c, o, id);
            if (o.parent_broker_id !== undefined)
                await parentOk(c, o.parent_broker_id, id);
            const cols = Object.keys(o);
            return (await c.query(`UPDATE brokers SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING id, name, firm_name, mobile, status, commission_pct`, [id, ...cols.map((k) => o[k])])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker', id, undefined, { fields: Object.keys(o) });
        res.json({ success: true, data: after });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/brokers/:id/approve   (checker, not the person who registered the broker)
router.patch('/:id/approve', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        const notes = (0, input_js_1.text)((0, input_js_1.body)(req).notes, 'Notes', 500, false);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT status, created_by, mobile, pan FROM brokers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Broker not found', 404);
            if (cur.status !== 'pending')
                throw (0, input_js_1.bad)(`Only a pending broker can be approved (this one is ${cur.status})`, 409);
            (0, financial_ops_js_1.notOwn)(req, cur.created_by);
            return (await c.query(`UPDATE brokers SET status = 'active', approval_notes = $2, approved_at = NOW(), approved_by = $3, updated_at = NOW() WHERE id = $1 RETURNING id, status`, [id, notes, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker', id, { status: 'pending' }, { status: 'active' });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/brokers/:id/reject   (checker)
router.patch('/:id/reject', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        const notes = (0, input_js_1.text)((0, input_js_1.body)(req).notes, 'Notes', 500, false);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT status, created_by FROM brokers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Broker not found', 404);
            if (cur.status !== 'pending')
                throw (0, input_js_1.bad)(`Only a pending broker can be rejected (this one is ${cur.status})`, 409);
            (0, financial_ops_js_1.notOwn)(req, cur.created_by);
            return (await c.query(`UPDATE brokers SET status = 'rejected', approval_notes = $2, approved_at = NOW(), approved_by = $3, updated_at = NOW() WHERE id = $1 RETURNING id, status`, [id, notes, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker', id, { status: 'pending' }, { status: 'rejected' });
        res.json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/brokers/:id/status   { status: active | inactive | suspended }   (checker). Holds of a broker who is switched off are released.
router.patch('/:id/status', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        const status = (0, input_js_1.oneOf)((0, input_js_1.body)(req).status, 'status', ['active', 'inactive', 'suspended']);
        if (!status)
            throw (0, input_js_1.bad)('status is required');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT status, created_by FROM brokers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Broker not found', 404);
            (0, financial_ops_js_1.notOwn)(req, cur.created_by);
            if (['pending', 'rejected'].includes(cur.status))
                throw (0, input_js_1.bad)(`A ${cur.status} broker is approved or rejected first, its status cannot be changed here`, 409);
            if (cur.status === status)
                throw (0, input_js_1.bad)(`The broker is already ${status}`, 409);
            let released = 0;
            if (status !== 'active') {
                for (const h of (await c.query(`SELECT id FROM unit_holds WHERE broker_id = $1 AND status = 'active'`, [id])).rows)
                    if (await (0, holds_js_1.closeHold)(c, h.id, 'cancelled', req.userId || null, `Broker ${status}, hold released`))
                        released++;
            }
            const row = (await c.query(`UPDATE brokers SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, status`, [id, status])).rows[0];
            return { row, released, was: cur.status };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker', id, { status: out.was }, { status, holdsReleased: out.released });
        res.json({ success: true, data: out.row, holdsReleased: out.released });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/brokers/:id/projects
router.get('/:id/projects', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        if (!(await index_js_1.db.query(`SELECT 1 FROM brokers WHERE id = $1`, [id])).rows.length)
            return res.status(404).json({ error: 'Broker not found' });
        const result = await index_js_1.db.query(`SELECT p.id, p.name FROM projects p JOIN broker_project_mapping bpm ON p.id = bpm.project_id WHERE bpm.broker_id = $1 ORDER BY p.name`, [id]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/brokers/:id/projects   { projectIds: [...] }  replaces the list (maker)
router.post('/:id/projects', (0, processPermission_js_1.requireProcess)('broker_range_entry', 'maker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        const raw = (0, input_js_1.body)(req).projectIds;
        if (!Array.isArray(raw))
            throw (0, input_js_1.bad)('projectIds must be a list');
        if (raw.length > 200)
            throw (0, input_js_1.bad)('At most 200 projects can be mapped');
        const ids = [...new Set(raw.map((p) => (0, input_js_1.uuid)(p, 'projectId')))];
        await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM brokers WHERE id = $1 FOR UPDATE`, [id])).rows.length)
                throw (0, input_js_1.bad)('Broker not found', 404);
            if (ids.length && (await c.query(`SELECT COUNT(*)::int AS n FROM projects WHERE id = ANY($1::uuid[])`, [ids])).rows[0].n !== ids.length)
                throw (0, input_js_1.bad)('A project does not exist', 404);
            await c.query(`DELETE FROM broker_project_mapping WHERE broker_id = $1`, [id]);
            if (ids.length)
                await c.query(`INSERT INTO broker_project_mapping (broker_id, mapped_by, project_id) SELECT $1, $2, UNNEST($3::uuid[])`, [id, req.userId, ids]);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'broker', id, undefined, { projectIds: ids });
        res.json({ success: true, message: 'Projects mapped successfully' });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/brokers/:id/sub-brokers
router.get('/:id/sub-brokers', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Broker id');
        if (!(await index_js_1.db.query(`SELECT 1 FROM brokers WHERE id = $1`, [id])).rows.length)
            return res.status(404).json({ error: 'Broker not found' });
        const result = await index_js_1.db.query(`SELECT id, name, firm_name, status, commission_pct FROM brokers WHERE parent_broker_id = $1 ORDER BY created_at`, [id]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=brokers.js.map