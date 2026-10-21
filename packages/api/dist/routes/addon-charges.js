"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeAddonDemands = recomputeAddonDemands;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
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
const bad = (message) => Object.assign(new Error(message), { http: 400 });
const fail = (err, res, next) => {
    if (err?.http)
        return res.status(err.http).json({ error: err.message });
    if (err?.code === '23505')
        return res.status(400).json({ error: 'An add-on charge with this name already exists in this project' });
    next(err);
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v, label) => { if (typeof v !== 'string' || !UUID.test(v))
    throw bad(`${label} is not valid`); return v; };
// A JSON number or a plain digit string only: "1e2", "0x10", " 5 ", [5], true are refused
const num = (v, label, max, decimals) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && new RegExp(`^[0-9]+(\\.[0-9]{1,${decimals}})?$`).test(v) ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > max || Math.abs(n * 10 ** decimals - Math.round(n * 10 ** decimals)) > 1e-6) {
        throw bad(`${label} must be a number from 0 to ${max.toLocaleString('en-IN')} with up to ${decimals} decimals`);
    }
    return n;
};
const has = (v) => v !== undefined && v !== null && v !== '';
const text = (v, label, max, required) => {
    if (!has(v)) {
        if (required)
            throw bad(`${label} is required`);
        return null;
    }
    if (typeof v !== 'string')
        throw bad(`${label} must be text`);
    const t = v.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!t) {
        if (required)
            throw bad(`${label} is required`);
        return null;
    }
    if (t.length > max)
        throw bad(`${label} can be at most ${max} characters`);
    if (/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069<>]/.test(t))
        throw bad(`${label} contains characters that are not allowed`);
    return t;
};
const day = (v) => {
    if (!has(v))
        return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v || v < '1990-01-01' || v > '2100-12-31')
        throw bad('Date must be a real date (YYYY-MM-DD)');
    return v;
};
const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
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
async function recomputeAddonDemands(client, consumerId, projectId, paymentPlanId, planName) {
    await lockConsumer(client, consumerId);
    await client.query(`UPDATE demands
     SET addon_charge_amount = 0,
         addon_cgst_amount = 0,
         addon_sgst_amount = 0,
         updated_at = NOW()
     WHERE payment_plan_id = $1
       AND status NOT IN ('cancelled')`, [paymentPlanId]);
    const chargesRes = await client.query(`SELECT id, charge_master_id, cgst_pct, sgst_pct,
            amount + COALESCE(increase_amount, 0) AS effective_amount
     FROM consumer_addon_charges
     WHERE consumer_id = $1
       AND project_id  = $2
       AND status = 'active'`, [consumerId, projectId]);
    if (!chargesRes.rows.length)
        return;
    for (const charge of chargesRes.rows) {
        const pctRes = await client.query(`SELECT pst.installment_index,
              SUM(pacp.pct) AS total_pct
       FROM plan_addon_charge_pct pacp
       JOIN plan_schedule_templates pst
         ON pst.id = pacp.plan_schedule_template_id
       WHERE pst.project_id       = $3
         AND lower(pst.plan_name) = lower($1)
         AND pacp.charge_master_id = $2
       GROUP BY pst.installment_index`, [planName, charge.charge_master_id, projectId]);
        for (const row of pctRes.rows) {
            const addonAmt = Math.round(parseFloat(charge.effective_amount) * parseFloat(row.total_pct) / 100 * 100) / 100;
            if (addonAmt === 0)
                continue;
            const addonCgstAmt = Math.round(addonAmt * parseFloat(charge.cgst_pct) / 100 * 100) / 100;
            const addonSgstAmt = Math.round(addonAmt * parseFloat(charge.sgst_pct) / 100 * 100) / 100;
            await client.query(`UPDATE demands
         SET addon_charge_amount = addon_charge_amount + $1,
             addon_cgst_amount = addon_cgst_amount + $2,
             addon_sgst_amount = addon_sgst_amount + $3,
             updated_at = NOW()
         WHERE payment_plan_id  = $4
           AND installment_index = $5
           AND status NOT IN ('cancelled')`, [addonAmt, addonCgstAmt, addonSgstAmt, paymentPlanId, row.installment_index]);
        }
    }
}
// Recompute demands for each customer, one at a time in a fixed order (no deadlocks between two admins)
async function recomputeFor(client, consumers) {
    for (const row of consumers) {
        const planInfo = await getPaymentPlanInfo(client, row.consumer_id, row.project_id);
        if (planInfo)
            await recomputeAddonDemands(client, row.consumer_id, row.project_id, planInfo.paymentPlanId, planInfo.planName);
    }
}
// Locks every customer holding an active charge of this master (sorted), returns them
async function lockHolders(client, masterId) {
    const r = await client.query(`SELECT DISTINCT consumer_id, project_id FROM consumer_addon_charges WHERE charge_master_id = $1 AND status = 'active' ORDER BY consumer_id`, [masterId]);
    for (const row of r.rows)
        await lockConsumer(client, row.consumer_id);
    return r.rows;
}
const inTx = async (fn) => {
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    }
    catch (e) {
        await client.query('ROLLBACK').catch(() => { });
        throw e;
    }
    finally {
        client.release();
    }
};
const gstPcts = (b, cur) => ({
    cgst: has(b.cgstPct) ? num(b.cgstPct, 'CGST %', 50, 4) : cur ? Number(cur.cgst_pct) : 9,
    sgst: has(b.sgstPct) ? num(b.sgstPct, 'SGST %', 50, 4) : cur ? Number(cur.sgst_pct) : 9,
});
const r2 = (n) => Math.round(n * 100) / 100;
// ── A: GET /api/addon-charges/master?projectId=uuid ──────────────────────────
router.get('/master', async (req, res, next) => {
    try {
        const projectId = uuid(req.query.projectId, 'projectId');
        const result = await index_js_1.db.query(`SELECT * FROM addon_charge_master WHERE project_id = $1 AND is_active = true ORDER BY charge_name ASC`, [projectId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── B: POST /api/addon-charges/master ────────────────────────────────────────
router.post('/master', async (req, res, next) => {
    try {
        const b = body(req);
        const projectId = uuid(b.projectId, 'projectId');
        const chargeName = text(b.chargeName, 'Charge name', 200, true);
        const rateType = !has(b.rateType) ? 'flat' : b.rateType;
        if (rateType !== 'flat' && rateType !== 'per_sqft')
            throw bad('Rate type must be flat or per_sqft');
        const { cgst, sgst } = gstPcts(b);
        let amount = 0, rate = null;
        if (rateType === 'per_sqft') {
            rate = num(b.ratePerSqftInr, 'Rate per sq.ft.', 1000000, 2);
            if (rate <= 0)
                throw bad('Rate per sq.ft. must be more than 0');
        }
        else {
            amount = has(b.defaultAmount) ? num(b.defaultAmount, 'Amount', 1000000000, 2) : 0;
        }
        if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
            throw Object.assign(new Error('Project not found'), { http: 404 });
        const made = await inTx(async (c) => {
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('addonmaster|' || $1 || '|' || lower($2)))`, [projectId, chargeName]);
            if ((await c.query(`SELECT 1 FROM addon_charge_master WHERE project_id = $1 AND is_active AND lower(charge_name) = lower($2)`, [projectId, chargeName])).rows.length) {
                throw bad(`An add-on charge named "${chargeName}" already exists in this project`);
            }
            return (await c.query(`INSERT INTO addon_charge_master (project_id, charge_name, default_amount, cgst_pct, sgst_pct, created_by, rate_type, rate_per_sqft_inr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [projectId, chargeName, amount, cgst, sgst, req.userId || null, rateType, rate])).rows[0];
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
        const mid = uuid(req.params.id, 'Charge master id');
        const b = body(req);
        if (b.isActive !== undefined && typeof b.isActive !== 'boolean')
            throw bad('isActive must be true or false');
        if (b.isActive === false)
            throw bad('To switch a charge off, use Deactivate (it also cancels the active customer charges)');
        const out = await inTx(async (c) => {
            const cur = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 FOR UPDATE`, [mid])).rows[0];
            if (!cur)
                throw Object.assign(new Error('Charge master not found'), { http: 404 });
            const name = has(b.chargeName) ? text(b.chargeName, 'Charge name', 200, true) : cur.charge_name;
            const rateType = has(b.rateType) ? b.rateType : cur.rate_type;
            if (rateType !== 'flat' && rateType !== 'per_sqft')
                throw bad('Rate type must be flat or per_sqft');
            const { cgst, sgst } = gstPcts(b, cur);
            let amount = Number(cur.default_amount), rate = cur.rate_per_sqft_inr == null ? null : Number(cur.rate_per_sqft_inr);
            if (rateType === 'per_sqft') {
                if (has(b.ratePerSqftInr))
                    rate = num(b.ratePerSqftInr, 'Rate per sq.ft.', 1000000, 2);
                if (!rate || rate <= 0)
                    throw bad('Rate per sq.ft. must be more than 0');
                amount = 0;
            }
            else {
                if (has(b.defaultAmount))
                    amount = num(b.defaultAmount, 'Amount', 1000000000, 2);
                rate = null;
            }
            if (name.toLowerCase() !== cur.charge_name.toLowerCase()) {
                await c.query(`SELECT pg_advisory_xact_lock(hashtext('addonmaster|' || $1 || '|' || lower($2)))`, [cur.project_id, name]);
                if ((await c.query(`SELECT 1 FROM addon_charge_master WHERE project_id = $1 AND is_active AND lower(charge_name) = lower($2) AND id <> $3`, [cur.project_id, name, mid])).rows.length) {
                    throw bad(`An add-on charge named "${name}" already exists in this project`);
                }
            }
            const holders = await lockHolders(c, mid);
            const master = (await c.query(`UPDATE addon_charge_master SET charge_name = $2, default_amount = $3, cgst_pct = $4, sgst_pct = $5, rate_type = $6,
           rate_per_sqft_inr = $7, is_active = COALESCE($8, is_active), updated_at = now() WHERE id = $1 RETURNING *`, [mid, name, amount, cgst, sgst, rateType, rate, b.isActive ?? null])).rows[0];
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
            await recomputeFor(c, holders);
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
        const mid = uuid(req.params.id, 'Charge master id');
        const out = await inTx(async (c) => {
            const cur = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 AND is_active FOR UPDATE`, [mid])).rows[0];
            if (!cur)
                throw Object.assign(new Error('Charge master not found or already deactivated'), { http: 404 });
            const holders = await lockHolders(c, mid);
            await c.query(`UPDATE addon_charge_master SET is_active = false, updated_at = now() WHERE id = $1`, [mid]);
            // Active customer charges of this type are cancelled and their demands recomputed
            await c.query(`UPDATE consumer_addon_charges SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE charge_master_id = $1 AND status = 'active'`, [mid]);
            await recomputeFor(c, holders);
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
        const consumerId = uuid(req.query.consumerId, 'consumerId');
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
        const b = body(req);
        const consumerId = uuid(b.consumerId, 'consumerId'), projectId = uuid(b.projectId, 'projectId');
        const chargeMasterId = has(b.chargeMasterId) ? uuid(b.chargeMasterId, 'chargeMasterId') : null;
        const amt = num(b.amount, 'Amount', 1000000000, 2);
        if (amt <= 0)
            throw bad('Amount must be more than 0');
        const remark = text(b.remark, 'Remark', 1000, false);
        const effectiveDate = day(b.effectiveDate) || new Date().toISOString().slice(0, 10);
        const out = await inTx(async (c) => {
            await lockConsumer(c, consumerId);
            if (!(await c.query(`SELECT 1 FROM booking_records WHERE consumer_id = $1 AND project_id = $2 AND status != 'cancelled'`, [consumerId, projectId])).rows.length) {
                throw bad('This customer has no active booking in this project');
            }
            let master = null;
            if (chargeMasterId) {
                master = (await c.query(`SELECT * FROM addon_charge_master WHERE id = $1 AND project_id = $2 AND is_active`, [chargeMasterId, projectId])).rows[0];
                if (!master)
                    throw bad('That add-on charge does not exist in this project (or is switched off)');
            }
            const chargeName = master ? master.charge_name : text(b.chargeName, 'Charge name', 200, true);
            const { cgst, sgst } = gstPcts(b, master || undefined);
            const dup = await c.query(chargeMasterId
                ? `SELECT 1 FROM consumer_addon_charges WHERE consumer_id = $1 AND project_id = $2 AND status = 'active' AND charge_master_id = $3`
                : `SELECT 1 FROM consumer_addon_charges WHERE consumer_id = $1 AND project_id = $2 AND status = 'active' AND charge_master_id IS NULL AND lower(charge_name) = lower($3)`, [consumerId, projectId, chargeMasterId || chargeName]);
            if (dup.rows.length)
                throw bad(`"${chargeName}" is already added for this customer. Edit it instead of adding it again.`);
            const cgstAmount = r2(amt * cgst / 100), sgstAmount = r2(amt * sgst / 100);
            const row = (await c.query(`INSERT INTO consumer_addon_charges (consumer_id, project_id, charge_master_id, charge_name, effective_date, amount, increase_amount,
           cgst_pct, sgst_pct, cgst_amount, sgst_amount, total_amount, remark, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [consumerId, projectId, chargeMasterId, chargeName, effectiveDate, amt, cgst, sgst, cgstAmount, sgstAmount, r2(amt + cgstAmount + sgstAmount), remark, req.userId || null])).rows[0];
            await recomputeFor(c, [{ consumer_id: consumerId, project_id: projectId }]);
            return row;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'consumer_addon_charge', out.id, undefined, out);
        res.status(201).json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// One customer charge, changed only while it is active
async function changeCharge(req, res, next, kind) {
    try {
        const cid = uuid(req.params.id, 'Charge id');
        const b = body(req);
        const remark = kind === 'edit' ? text(b.remark, 'Remark', 1000, false) : null;
        const waive = kind === 'waive' ? text(b.waiveRemark, 'Waive-off remark', 1000, true) : null;
        const amount = kind === 'edit' && has(b.amount) ? num(b.amount, 'Amount', 1000000000, 2) : null;
        const increase = kind === 'edit' && has(b.increaseAmount) ? num(b.increaseAmount, 'Increase amount', 1000000000, 2) : null;
        if (amount !== null && amount <= 0)
            throw bad('Amount must be more than 0');
        const out = await inTx(async (c) => {
            const pre = (await c.query(`SELECT consumer_id, project_id FROM consumer_addon_charges WHERE id = $1`, [cid])).rows[0];
            if (!pre)
                throw Object.assign(new Error('Charge not found'), { http: 404 });
            await lockConsumer(c, pre.consumer_id);
            const cur = (await c.query(`SELECT * FROM consumer_addon_charges WHERE id = $1 FOR UPDATE`, [cid])).rows[0];
            if (cur.status !== 'active')
                throw bad(`This charge is already ${cur.status}`);
            let upd;
            if (kind === 'edit') {
                const amt = amount ?? Number(cur.amount), inc = increase ?? Number(cur.increase_amount || 0), base = amt + inc;
                const cg = r2(base * Number(cur.cgst_pct) / 100), sg = r2(base * Number(cur.sgst_pct) / 100);
                upd = (await c.query(`UPDATE consumer_addon_charges SET amount = $2, increase_amount = $3, cgst_amount = $4, sgst_amount = $5, total_amount = $6,
             remark = COALESCE($7, remark), updated_at = now() WHERE id = $1 RETURNING *`, [cid, amt, inc, cg, sg, r2(base + cg + sg), remark])).rows[0];
            }
            else if (kind === 'cancel') {
                upd = (await c.query(`UPDATE consumer_addon_charges SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1 RETURNING id, status`, [cid])).rows[0];
            }
            else {
                upd = (await c.query(`UPDATE consumer_addon_charges SET status = 'waived', waive_remark = $2, updated_at = now() WHERE id = $1 RETURNING id, status`, [cid, waive])).rows[0];
            }
            await recomputeFor(c, [pre]);
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'consumer_addon_charge', cid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
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
        const projectId = uuid(q.projectId, 'projectId');
        const conditions = ['p.id = $1', "br.status != 'cancelled'"];
        const params = [projectId];
        const add = (sql, v) => { params.push(v); conditions.push(sql.replace('$$', '$' + params.length)); };
        if (has(q.towerId))
            add('t.id = $$', uuid(q.towerId, 'towerId'));
        for (const [key, sql] of [['unitType', "u.bhk_type ILIKE $$ ESCAPE '\\'"], ['paymentPlan', "br.selected_plan_name ILIKE $$ ESCAPE '\\'"],
            ['registrationNo', "c.registration_no ILIKE $$ ESCAPE '\\'"], ['unitNo', "u.unit_number ILIKE $$ ESCAPE '\\'"]]) {
            const v = text(q[key], key, 100, false);
            if (v)
                add(sql, `%${likeEsc(v)}%`);
        }
        const nm = text(q.name, 'name', 100, false);
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