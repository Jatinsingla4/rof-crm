"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeAddonDemands = recomputeAddonDemands;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
// ── Access, input rules ──────────────────────────────────────────────────────
// Reading is open to every signed-in user. Changing the charge master needs master_data; giving, editing,
// cancelling or waiving a customer's charge changes their demands, so it needs payments "edit".
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD')
        return next();
    const onMaster = req.path.startsWith('/master');
    const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'edit';
    if (onMaster ? (0, rbac_js_1.hasPermission)(req.userRole, 'master_data', action) : (0, rbac_js_1.hasPermission)(req.userRole, 'payments', 'edit'))
        return next();
    res.status(403).json({ error: onMaster ? 'You do not have permission to change add-on charge masters' : 'You do not have permission to change customer add-on charges' });
});
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'An add-on charge with this name already exists in this project');
const likeEsc = (v) => v.replace(/[\\%_]/g, '\\$&');
// One customer's add-on work runs one at a time, so a double click or two users cannot double-add or half-recompute
const lockConsumer = (client, consumerId) => client.query(`SELECT pg_advisory_xact_lock(hashtext('addon|' || $1))`, [consumerId]);
async function getPaymentPlanInfo(client, consumerId, projectId) {
    const res = await client.query(`SELECT pp.id AS payment_plan_id,
            br.selected_plan_name AS plan_name
     FROM booking_records br
     JOIN payment_plans pp
       ON pp.consumer_id = br.consumer_id
      AND pp.unit_id = br.unit_id
     WHERE br.consumer_id = $1
       AND br.project_id  = $2
       AND br.status != 'cancelled'
     ORDER BY br.created_at DESC
     LIMIT 1`, [consumerId, projectId]);
    if (!res.rows.length)
        return null;
    return {
        paymentPlanId: res.rows[0].payment_plan_id,
        planName: res.rows[0].plan_name,
    };
}
// A demand that already has money against it (marked paid, or a receipt that is not bounced/cancelled) is frozen: its add-on
// figures never change. Extra add-on that would have fallen on a frozen demand moves to the next unpaid demand; a cut that
// would fall on a frozen demand is refused (accounts issue a credit note or refund instead).
async function recomputeAddonDemands(client, consumerId, projectId, paymentPlanId, planName) {
    await lockConsumer(client, consumerId);
    const demands = (await client.query(`SELECT d.id, d.installment_index AS idx, d.addon_charge_amount AS a, d.addon_cgst_amount AS c, d.addon_sgst_amount AS s,
            (d.status = 'paid' OR EXISTS (SELECT 1 FROM receipts r
               WHERE COALESCE(r.status, '') NOT IN ('bounced', 'cancelled')
                 AND (r.demand_id = d.id OR (r.payment_plan_id = d.payment_plan_id AND r.installment_index = d.installment_index)))) AS locked
       FROM demands d WHERE d.payment_plan_id = $1 AND d.status NOT IN ('cancelled')
      ORDER BY d.installment_index, d.created_at, d.id FOR UPDATE OF d`, [paymentPlanId])).rows
        .map((d) => ({ id: d.id, idx: Number(d.idx), a: Number(d.a || 0), c: Number(d.c || 0), s: Number(d.s || 0), locked: !!d.locked }));
    // What each instalment should carry now, from the active charges
    const want = new Map();
    const charges = (await client.query(`SELECT charge_master_id, cgst_pct, sgst_pct, amount + COALESCE(increase_amount, 0) AS effective_amount
       FROM consumer_addon_charges WHERE consumer_id = $1 AND project_id = $2 AND status = 'active'`, [consumerId, projectId])).rows;
    for (const charge of charges) {
        const pctRes = await client.query(`SELECT pst.installment_index, SUM(pacp.pct) AS total_pct
         FROM plan_addon_charge_pct pacp JOIN plan_schedule_templates pst ON pst.id = pacp.plan_schedule_template_id
        WHERE pst.project_id = $3 AND lower(pst.plan_name) = lower($1) AND pacp.charge_master_id = $2
        GROUP BY pst.installment_index`, [planName, charge.charge_master_id, projectId]);
        for (const row of pctRes.rows) {
            const a = (0, input_js_1.r2)(parseFloat(charge.effective_amount) * parseFloat(row.total_pct) / 100);
            if (a === 0)
                continue;
            const w = want.get(Number(row.installment_index)) || { a: 0, c: 0, s: 0 };
            w.a = (0, input_js_1.r2)(w.a + a);
            w.c = (0, input_js_1.r2)(w.c + (0, input_js_1.r2)(a * parseFloat(charge.cgst_pct) / 100));
            w.s = (0, input_js_1.r2)(w.s + (0, input_js_1.r2)(a * parseFloat(charge.sgst_pct) / 100));
            want.set(Number(row.installment_index), w);
        }
    }
    // Frozen demands: keep as they are; collect what they are short of, refuse what they are over
    const carry = { a: 0, c: 0, s: 0 };
    let from = null;
    for (const d of demands.filter((x) => x.locked)) {
        const w = want.get(d.idx) || { a: 0, c: 0, s: 0 };
        const diff = (w.a + w.c + w.s) - (d.a + d.c + d.s);
        if (diff < -0.005)
            throw (0, input_js_1.bad)(`Instalment ${d.idx} already has a payment, so the add-on billed there (₹${(d.a + d.c + d.s).toFixed(2)} with GST) cannot be reduced. Ask accounts for a credit note or refund.`);
        if (diff > 0.005) {
            carry.a += w.a - d.a;
            carry.c += w.c - d.c;
            carry.s += w.s - d.s;
            from = from === null ? d.idx : Math.min(from, d.idx);
        }
    }
    const open = demands.filter((x) => !x.locked);
    const moved = carry.a + carry.c + carry.s > 0.005;
    let target = null;
    if (moved) {
        target = open.find((x) => x.idx > from) || open[0];
        if (!target)
            throw (0, input_js_1.bad)('Every instalment already has a payment, so this add-on cannot be billed on a demand. Ask accounts to raise a separate demand.');
    }
    let shifted = false;
    for (const d of open) {
        const w = want.get(d.idx) || { a: 0, c: 0, s: 0 };
        const add = d === target ? carry : { a: 0, c: 0, s: 0 };
        if (d === target && Math.abs((0, input_js_1.r2)(w.a + add.a) - d.a) > 0.005)
            shifted = true;
        await client.query(`UPDATE demands SET addon_charge_amount = $2, addon_cgst_amount = $3, addon_sgst_amount = $4, updated_at = NOW() WHERE id = $1`, [d.id, (0, input_js_1.r2)(w.a + add.a), (0, input_js_1.r2)(w.c + add.c), (0, input_js_1.r2)(w.s + add.s)]);
    }
    // the note is only for a change made now, not for a shift that was already in place
    return { movedAmount: shifted ? (0, input_js_1.r2)(carry.a + carry.c + carry.s) : 0, movedToInstalment: shifted ? target.idx : null };
}
// Recompute demands for each customer, one at a time in a fixed order (no deadlocks between two admins)
async function recomputeFor(client, consumers, batch = false) {
    const moves = [];
    const blocked = [];
    for (const row of consumers) {
        const planInfo = await getPaymentPlanInfo(client, row.consumer_id, row.project_id);
        if (!planInfo)
            continue;
        try {
            moves.push(await recomputeAddonDemands(client, row.consumer_id, row.project_id, planInfo.paymentPlanId, planInfo.planName));
        }
        catch (e) {
            if (!batch || !e?.http)
                throw e;
            const n = await client.query(`SELECT COALESCE(NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''), name, registration_no, id::text) AS n FROM consumers WHERE id = $1`, [row.consumer_id]);
            blocked.push(n.rows[0]?.n || row.consumer_id);
        }
    }
    if (blocked.length) {
        throw (0, input_js_1.bad)(`${blocked.length} customer(s) already have payments against this add-on, so it cannot be reduced or removed: ${blocked.slice(0, 5).join(', ')}${blocked.length > 5 ? ' …' : ''}. Ask accounts for credit notes or refunds first.`);
    }
    return moves.find((m) => m.movedAmount > 0) || { movedAmount: 0, movedToInstalment: null };
}
const movedNote = (m) => m.movedAmount > 0
    ? { note: `Part of this add-on fell on an instalment that already has a payment, so ₹${m.movedAmount.toFixed(2)} (with GST) was billed on instalment ${m.movedToInstalment} instead.` } : {};
// Locks every customer holding an active charge of this master (sorted), returns them
async function lockHolders(client, masterId) {
    const r = await client.query(`SELECT DISTINCT consumer_id, project_id FROM consumer_addon_charges WHERE charge_master_id = $1 AND status = 'active' ORDER BY consumer_id`, [masterId]);
    for (const row of r.rows)
        await lockConsumer(client, row.consumer_id);
    return r.rows;
}
const gstPcts = (b, cur) => ({
    cgst: (0, input_js_1.has)(b.cgstPct) ? (0, input_js_1.num)(b.cgstPct, 'CGST %', 50, 4) : cur ? Number(cur.cgst_pct) : 9,
    sgst: (0, input_js_1.has)(b.sgstPct) ? (0, input_js_1.num)(b.sgstPct, 'SGST %', 50, 4) : cur ? Number(cur.sgst_pct) : 9,
});
// ── A: GET /api/addon-charges/master?projectId=uuid ──────────────────────────
router.get('/master', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        const result = await index_js_1.db.query(`SELECT m.*, (SELECT COUNT(*)::int FROM plan_addon_charge_pct p WHERE p.charge_master_id = m.id) AS plan_pct_rows FROM addon_charge_master m WHERE m.project_id = $1 AND m.is_active = true ORDER BY m.charge_name ASC`, [projectId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// The client's add-on master options: charge type, when it applies (Possession or a date set per customer), which area it is calculated on, and whether it counts in the dues
const addonOptions = (b, cur) => {
    const applyDate = (0, input_js_1.has)(b.applyDateType) ? (0, input_js_1.oneOf)(b.applyDateType, 'Apply date type', ['Possession', 'Customer Wise Date']) : cur?.apply_date_type ?? 'Customer Wise Date';
    const calc = (0, input_js_1.has)(b.calculateRateType) ? (0, input_js_1.text)(b.calculateRateType, 'Calculate rate type', 30, true) : cur?.calculate_rate_type ?? 'Old Area';
    const chargeType = (0, input_js_1.has)(b.chargeType) ? (0, input_js_1.text)(b.chargeType, 'Charge type', 30, true) : cur?.charge_type ?? 'Other';
    if (b.includeInDues !== undefined && typeof b.includeInDues !== 'boolean')
        throw (0, input_js_1.bad)('includeInDues must be true or false');
    const flag = (k, col) => { if (b[k] !== undefined && typeof b[k] !== 'boolean')
        throw (0, input_js_1.bad)(`${k} must be true or false`); return b[k] ?? cur?.[col] ?? false; };
    const f = { mandatory: flag('isMandatory', 'is_mandatory'), parking: flag('isParking', 'is_parking'), inventory: flag('inventoryBase', 'inventory_base'), multiple: flag('multipleBooking', 'multiple_booking'), alteration: flag('isAlteration', 'is_alteration'), agreement: flag('isAgreement', 'is_agreement') };
    if (f.inventory && !f.parking)
        throw (0, input_js_1.bad)('Inventory base is only for a parking charge');
    const qty = (0, input_js_1.has)(b.quantity) ? (0, input_js_1.num)(b.quantity, 'Quantity', 100000, 0) : 'quantity' in b ? null : cur?.quantity ?? null;
    if (qty != null && !Number.isInteger(qty))
        throw (0, input_js_1.bad)('Quantity must be a whole number');
    const eff = (0, input_js_1.has)(b.effectiveDate) ? (0, input_js_1.day)(b.effectiveDate, 'Effective date') : 'effectiveDate' in b ? null : cur?.effective_date ?? null;
    const descr = (0, input_js_1.has)(b.description) ? (0, input_js_1.text)(b.description, 'Description', 500, false) : 'description' in b ? null : cur?.description ?? null;
    return { applyDate, calc, chargeType, inDues: b.includeInDues ?? cur?.include_in_dues ?? true, ...f, qty, eff, descr };
};
// ── B: POST /api/addon-charges/master ────────────────────────────────────────
router.post('/master', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const chargeName = (0, input_js_1.text)(b.chargeName, 'Charge name', 200, true);
        const rateType = !(0, input_js_1.has)(b.rateType) ? 'flat' : b.rateType;
        if (rateType !== 'flat' && rateType !== 'per_sqft')
            throw (0, input_js_1.bad)('Rate type must be flat or per_sqft');
        const { cgst, sgst } = gstPcts(b);
        let amount = 0, rate = null;
        if (rateType === 'per_sqft') {
            rate = (0, input_js_1.num)(b.ratePerSqftInr, 'Rate per sq.ft.', 1000000, 2);
            if (rate <= 0)
                throw (0, input_js_1.bad)('Rate per sq.ft. must be more than 0');
        }
        else {
            amount = (0, input_js_1.has)(b.defaultAmount) ? (0, input_js_1.num)(b.defaultAmount, 'Amount', 1000000000, 2) : 0;
        }
        const opt = addonOptions(b);
        if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw Object.assign(new Error('Project not found'), { http: 404 });
        const made = await (0, input_js_1.inTx)(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('addonmaster|' || $1 || '|' || lower($2)))`, [projectId, chargeName]);
            if ((await c.query(`SELECT 1 FROM addon_charge_master WHERE project_id = $1 AND is_active AND lower(charge_name) = lower($2)`, [projectId, chargeName])).rows.length) {
                throw (0, input_js_1.bad)(`An add-on charge named "${chargeName}" already exists in this project`);
            }
            return (await c.query(`INSERT INTO addon_charge_master (project_id, charge_name, default_amount, cgst_pct, sgst_pct, created_by, rate_type, rate_per_sqft_inr, apply_date_type, calculate_rate_type, include_in_dues, charge_type, is_mandatory, is_parking, inventory_base, multiple_booking, is_alteration, is_agreement, quantity, effective_date, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`, [projectId, chargeName, amount, cgst, sgst, req.userId || null, rateType, rate, opt.applyDate, opt.calc, opt.inDues, opt.chargeType, opt.mandatory, opt.parking, opt.inventory, opt.multiple, opt.alteration, opt.agreement, opt.qty, opt.eff, opt.descr])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'addon_charge_master', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── C: PATCH /api/addon-charges/master/:id ───────────────────────────────────
router.patch('/master/:id', async (req, res, next) => {
    try {
        const mid = (0, input_js_1.uuid)(req.params.id, 'Charge master id');
        const b = (0, input_js_1.body)(req);
        if (b.isActive !== undefined && typeof b.isActive !== 'boolean')
            throw (0, input_js_1.bad)('isActive must be true or false');
        if (b.isActive === false)
            throw (0, input_js_1.bad)('To switch a charge off, use Deactivate (it also cancels the active customer charges)');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 FOR UPDATE`, [mid])).rows[0];
            if (!cur)
                throw Object.assign(new Error('Charge master not found'), { http: 404 });
            const name = (0, input_js_1.has)(b.chargeName) ? (0, input_js_1.text)(b.chargeName, 'Charge name', 200, true) : cur.charge_name;
            const opt = addonOptions(b, cur);
            const rateType = (0, input_js_1.has)(b.rateType) ? b.rateType : cur.rate_type;
            if (rateType !== 'flat' && rateType !== 'per_sqft')
                throw (0, input_js_1.bad)('Rate type must be flat or per_sqft');
            const { cgst, sgst } = gstPcts(b, cur);
            let amount = Number(cur.default_amount), rate = cur.rate_per_sqft_inr == null ? null : Number(cur.rate_per_sqft_inr);
            if (rateType === 'per_sqft') {
                if ((0, input_js_1.has)(b.ratePerSqftInr))
                    rate = (0, input_js_1.num)(b.ratePerSqftInr, 'Rate per sq.ft.', 1000000, 2);
                if (!rate || rate <= 0)
                    throw (0, input_js_1.bad)('Rate per sq.ft. must be more than 0');
                amount = 0;
            }
            else {
                if ((0, input_js_1.has)(b.defaultAmount))
                    amount = (0, input_js_1.num)(b.defaultAmount, 'Amount', 1000000000, 2);
                rate = null;
            }
            if (name.toLowerCase() !== cur.charge_name.toLowerCase()) {
                await c.query(`SELECT pg_advisory_xact_lock(hashtext('addonmaster|' || $1 || '|' || lower($2)))`, [cur.project_id, name]);
                if ((await c.query(`SELECT 1 FROM addon_charge_master WHERE project_id = $1 AND is_active AND lower(charge_name) = lower($2) AND id <> $3`, [cur.project_id, name, mid])).rows.length) {
                    throw (0, input_js_1.bad)(`An add-on charge named "${name}" already exists in this project`);
                }
            }
            const holders = await lockHolders(c, mid);
            const master = (await c.query(`UPDATE addon_charge_master SET charge_name = $2, default_amount = $3, cgst_pct = $4, sgst_pct = $5, rate_type = $6,
           rate_per_sqft_inr = $7, is_active = COALESCE($8, is_active), apply_date_type = $9, calculate_rate_type = $10, include_in_dues = $11, charge_type = $12,
           is_mandatory = $13, is_parking = $14, inventory_base = $15, multiple_booking = $16, is_alteration = $17, is_agreement = $18, quantity = $19, effective_date = $20, description = $21, updated_at = now() WHERE id = $1 RETURNING *`, [mid, name, amount, cgst, sgst, rateType, rate, b.isActive ?? null, opt.applyDate, opt.calc, opt.inDues, opt.chargeType, opt.mandatory, opt.parking, opt.inventory, opt.multiple, opt.alteration, opt.agreement, opt.qty, opt.eff, opt.descr])).rows[0];
            // Active customer charges follow the master: GST is on (amount + increase) so per-customer increases are kept;
            // per-sq.ft. charges are priced from each customer's own unit
            if (rateType === 'per_sqft') {
                await c.query(`UPDATE consumer_addon_charges cac
              SET amount = computed.new_amount, cgst_pct = $2, sgst_pct = $3,
                  cgst_amount = ROUND((computed.new_amount + COALESCE(cac.increase_amount,0)) * $2 / 100, 2),
                  sgst_amount = ROUND((computed.new_amount + COALESCE(cac.increase_amount,0)) * $3 / 100, 2),
                  total_amount = (computed.new_amount + COALESCE(cac.increase_amount,0))
                    + ROUND((computed.new_amount + COALESCE(cac.increase_amount,0)) * $2 / 100, 2)
                    + ROUND((computed.new_amount + COALESCE(cac.increase_amount,0)) * $3 / 100, 2),
                  updated_at = NOW()
             FROM (SELECT DISTINCT ON (cac2.id) cac2.id AS charge_id, ROUND($4::numeric * u.carpet_area_sqft, 2) AS new_amount
                     FROM consumer_addon_charges cac2
                     JOIN booking_records br ON br.consumer_id = cac2.consumer_id AND br.project_id = cac2.project_id AND br.status != 'cancelled'
                     JOIN units u ON u.id = br.unit_id
                    WHERE cac2.charge_master_id = $1 AND cac2.status = 'active'
                    ORDER BY cac2.id, br.created_at DESC) computed
            WHERE cac.id = computed.charge_id`, [mid, cgst, sgst, rate]);
            }
            else {
                await c.query(`UPDATE consumer_addon_charges
              SET amount = $2, cgst_pct = $3, sgst_pct = $4,
                  cgst_amount = ROUND(($2 + COALESCE(increase_amount, 0)) * $3 / 100, 2),
                  sgst_amount = ROUND(($2 + COALESCE(increase_amount, 0)) * $4 / 100, 2),
                  total_amount = ($2 + COALESCE(increase_amount, 0)) + ROUND(($2 + COALESCE(increase_amount, 0)) * $3 / 100, 2)
                    + ROUND(($2 + COALESCE(increase_amount, 0)) * $4 / 100, 2),
                  updated_at = NOW()
            WHERE charge_master_id = $1 AND status = 'active'`, [mid, amount, cgst, sgst]);
            }
            await recomputeFor(c, holders, true);
            return { cur, master, affected: holders.length };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'addon_charge_master', mid, out.cur, out.master);
        res.json({ success: true, data: out.master, affectedConsumers: out.affected });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── D: DELETE /api/addon-charges/master/:id (soft delete) ────────────────────
router.delete('/master/:id', async (req, res, next) => {
    try {
        const mid = (0, input_js_1.uuid)(req.params.id, 'Charge master id');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 AND is_active FOR UPDATE`, [mid])).rows[0];
            if (!cur)
                throw Object.assign(new Error('Charge master not found or already deactivated'), { http: 404 });
            const holders = await lockHolders(c, mid);
            await c.query(`UPDATE addon_charge_master SET is_active = false, updated_at = now() WHERE id = $1`, [mid]);
            // Active customer charges of this type are cancelled and their demands recomputed
            await c.query(`UPDATE consumer_addon_charges SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE charge_master_id = $1 AND status = 'active'`, [mid]);
            await recomputeFor(c, holders, true);
            return { cur, affected: holders.length };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'addon_charge_master', mid, out.cur, { ...out.cur, is_active: false });
        res.json({ success: true, affectedConsumers: out.affected });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── E: GET /api/addon-charges/consumer?consumerId=uuid ───────────────────────
router.get('/consumer', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.query.consumerId, 'consumerId');
        const result = await index_js_1.db.query(`SELECT cac.*, acm.charge_name AS master_charge_name
         FROM consumer_addon_charges cac LEFT JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
        WHERE cac.consumer_id = $1 AND cac.status = 'active' ORDER BY cac.effective_date ASC, cac.created_at ASC`, [consumerId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── F: POST /api/addon-charges/consumer ──────────────────────────────────────
router.post('/consumer', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const chargeMasterId = (0, input_js_1.has)(b.chargeMasterId) ? (0, input_js_1.uuid)(b.chargeMasterId, 'chargeMasterId') : null;
        const amt = (0, input_js_1.num)(b.amount, 'Amount', 1000000000, 2);
        if (amt <= 0)
            throw (0, input_js_1.bad)('Amount must be more than 0');
        const remark = (0, input_js_1.text)(b.remark, 'Remark', 1000, false);
        const effectiveDate = (0, input_js_1.day)(b.effectiveDate) || new Date().toISOString().slice(0, 10);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lockConsumer(c, consumerId);
            if (!(await c.query(`SELECT 1 FROM booking_records WHERE consumer_id = $1 AND project_id = $2 AND status != 'cancelled'`, [consumerId, projectId])).rows.length) {
                throw (0, input_js_1.bad)('This customer has no active booking in this project');
            }
            let master = null;
            if (chargeMasterId) {
                master = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 AND project_id = $2 AND is_active`, [chargeMasterId, projectId])).rows[0];
                if (!master)
                    throw (0, input_js_1.bad)('That add-on charge does not exist in this project (or is switched off)');
            }
            const chargeName = master ? master.charge_name : (0, input_js_1.text)(b.chargeName, 'Charge name', 200, true);
            const { cgst, sgst } = gstPcts(b, master || undefined);
            const dup = await c.query(chargeMasterId
                ? `SELECT 1 FROM consumer_addon_charges WHERE consumer_id = $1 AND project_id = $2 AND status = 'active' AND charge_master_id = $3`
                : `SELECT 1 FROM consumer_addon_charges WHERE consumer_id = $1 AND project_id = $2 AND status = 'active' AND charge_master_id IS NULL AND lower(charge_name) = lower($3)`, [consumerId, projectId, chargeMasterId || chargeName]);
            if (dup.rows.length)
                throw (0, input_js_1.bad)(`"${chargeName}" is already added for this customer. Edit it instead of adding it again.`);
            const cgstAmount = (0, input_js_1.r2)(amt * cgst / 100), sgstAmount = (0, input_js_1.r2)(amt * sgst / 100);
            const row = (await c.query(`INSERT INTO consumer_addon_charges (consumer_id, project_id, charge_master_id, charge_name, effective_date, amount, increase_amount,
           cgst_pct, sgst_pct, cgst_amount, sgst_amount, total_amount, remark, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [consumerId, projectId, chargeMasterId, chargeName, effectiveDate, amt, cgst, sgst, cgstAmount, sgstAmount, (0, input_js_1.r2)(amt + cgstAmount + sgstAmount), remark, req.userId || null])).rows[0];
            const moved = await recomputeFor(c, [{ consumer_id: consumerId, project_id: projectId }]);
            return { row, moved };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'consumer_addon_charge', out.row.id, undefined, { ...out.row, moved_to_next_instalment: out.moved });
        res.status(201).json({ success: true, data: out.row, ...movedNote(out.moved) });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// One customer charge, changed only while it is active
async function changeCharge(req, res, next, kind) {
    try {
        const cid = (0, input_js_1.uuid)(req.params.id, 'Charge id');
        const b = (0, input_js_1.body)(req);
        const remark = kind === 'edit' ? (0, input_js_1.text)(b.remark, 'Remark', 1000, false) : null;
        const waive = kind === 'waive' ? (0, input_js_1.text)(b.waiveRemark, 'Waive-off remark', 1000, true) : null;
        const amount = kind === 'edit' && (0, input_js_1.has)(b.amount) ? (0, input_js_1.num)(b.amount, 'Amount', 1000000000, 2) : null;
        const increase = kind === 'edit' && (0, input_js_1.has)(b.increaseAmount) ? (0, input_js_1.num)(b.increaseAmount, 'Increase amount', 1000000000, 2) : null;
        if (amount !== null && amount <= 0)
            throw (0, input_js_1.bad)('Amount must be more than 0');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const pre = (await c.query(`SELECT consumer_id, project_id FROM consumer_addon_charges WHERE id = $1`, [cid])).rows[0];
            if (!pre)
                throw Object.assign(new Error('Charge not found'), { http: 404 });
            await lockConsumer(c, pre.consumer_id);
            const cur = (await c.query(`SELECT * FROM consumer_addon_charges WHERE id = $1 FOR UPDATE`, [cid])).rows[0];
            if (cur.status !== 'active')
                throw (0, input_js_1.bad)(`This charge is already ${cur.status}`);
            let upd;
            if (kind === 'edit') {
                const amt = amount ?? Number(cur.amount), inc = increase ?? Number(cur.increase_amount || 0), base = amt + inc;
                const cg = (0, input_js_1.r2)(base * Number(cur.cgst_pct) / 100), sg = (0, input_js_1.r2)(base * Number(cur.sgst_pct) / 100);
                upd = (await c.query(`UPDATE consumer_addon_charges SET amount = $2, increase_amount = $3, cgst_amount = $4, sgst_amount = $5, total_amount = $6,
             remark = COALESCE($7, remark), updated_at = now() WHERE id = $1 RETURNING *`, [cid, amt, inc, cg, sg, (0, input_js_1.r2)(base + cg + sg), remark])).rows[0];
            }
            else if (kind === 'cancel') {
                upd = (await c.query(`UPDATE consumer_addon_charges SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING id, status`, [cid])).rows[0];
            }
            else {
                upd = (await c.query(`UPDATE consumer_addon_charges SET status = 'waived', waive_remark = $2, updated_at = now() WHERE id = $1 RETURNING id, status`, [cid, waive])).rows[0];
            }
            const moved = await recomputeFor(c, [pre]);
            return { cur, upd, moved };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'consumer_addon_charge', cid, out.cur, { ...out.upd, moved_to_next_instalment: out.moved });
        res.json({ success: true, data: out.upd, ...movedNote(out.moved) });
    }
    catch (err) {
        fail(err, res, next);
    }
}
// ── G / H / I: edit, cancel, waive a customer's charge ───────────────────────
router.patch('/consumer/:id', (req, res, next) => changeCharge(req, res, next, 'edit'));
router.patch('/consumer/:id/cancel', (req, res, next) => changeCharge(req, res, next, 'cancel'));
router.patch('/consumer/:id/waive', (req, res, next) => changeCharge(req, res, next, 'waive'));
// ── J: GET /api/addon-charges/consumers?projectId=uuid&... ───────────────────
router.get('/consumers', async (req, res, next) => {
    try {
        const q = req.query;
        const projectId = (0, input_js_1.uuid)(q.projectId, 'projectId');
        const conditions = ['p.id = $1', "br.status != 'cancelled'"];
        const params = [projectId];
        const add = (sql, v) => { params.push(v); conditions.push(sql.replace('$$', '$' + params.length)); };
        if ((0, input_js_1.has)(q.towerId))
            add('t.id = $$', (0, input_js_1.uuid)(q.towerId, 'towerId'));
        for (const [key, sql] of [['unitType', "u.bhk_type ILIKE $$ ESCAPE '\\'"], ['paymentPlan', "br.selected_plan_name ILIKE $$ ESCAPE '\\'"],
            ['registrationNo', "c.registration_no ILIKE $$ ESCAPE '\\'"], ['unitNo', "u.unit_number ILIKE $$ ESCAPE '\\'"]]) {
            const v = (0, input_js_1.text)(q[key], key, 100, false);
            if (v)
                add(sql, `%${likeEsc(v)}%`);
        }
        const nm = (0, input_js_1.text)(q.name, 'name', 100, false);
        if (nm) {
            params.push(`%${likeEsc(nm)}%`);
            conditions.push(`(c.first_name ILIKE $${params.length} ESCAPE '\\' OR c.last_name ILIKE $${params.length} ESCAPE '\\')`);
        }
        const result = await index_js_1.db.query(`SELECT c.id AS consumer_id, c.first_name, c.last_name,
              TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS full_name, c.registration_no,
              br.id AS booking_id, br.booking_date, br.selected_plan_name AS payment_plan,
              u.id AS unit_id, u.unit_number, u.bhk_type AS unit_type, u.super_area_sqft, u.carpet_area_sqft,
              t.tower_name, p.name AS project_name,
              COALESCE((SELECT SUM(cac.total_amount) FROM consumer_addon_charges cac WHERE cac.consumer_id = c.id AND cac.status = 'active'), 0) AS addon_total
         FROM consumers c
         JOIN booking_records br ON br.consumer_id = c.id
         JOIN units u ON u.id = br.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         JOIN projects p ON p.id = br.project_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.registration_no ASC`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=addon-charges.js.map