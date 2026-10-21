"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * GST Configuration: financial years, HSN/SAC codes and their assignment, GST slabs (date ranges), tax rates per slab,
 * the mapping of a charge type to a rate for each project, project GSTIN and RERA numbers.
 * Booking, receipts and demands read these tables to price GST, so every write is checked and audited.
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const VALID_CHARGE_TYPES = ['BASIC', 'PLC', 'OTHER CHARGE', 'IFMS', 'EXTRA ADD ON', 'OTHERS'];
const VALID_GST_TYPES = ['INTER', 'INTRA', 'UT'];
const VALID_HSN_TYPES = ['Goods', 'Service'];
// Reading is open to every signed-in user (booking forms show the rates). Any change needs the master_data permission.
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD')
        return next();
    const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'edit';
    if ((0, rbac_js_1.hasPermission)(req.userRole, 'master_data', action))
        return next();
    res.status(403).json({ error: 'You do not have permission to change GST configuration' });
});
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'This already exists');
const notFound = (what) => (0, input_js_1.bad)(`${what} not found`, 404);
// A global lock per area, so two admins adding at once cannot slip past an overlap or duplicate check
const lock = (c, key) => c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [key]);
const optId = (v, label) => ((0, input_js_1.has)(v) ? (0, input_js_1.uuid)(v, label) : null);
const one = async (c, sql, params) => (await c.query(sql, params)).rows[0];
const chargeType = (v) => { if (typeof v !== 'string' || !VALID_CHARGE_TYPES.includes(v))
    throw (0, input_js_1.bad)(`chargeType must be one of: ${VALID_CHARGE_TYPES.join(', ')}`); return v; };
const projectExists = async (c, id) => { if (!(await one(c, `SELECT 1 AS x FROM projects WHERE id = $1`, [id])))
    throw notFound('Project'); };
// GSTIN: 2-digit state code, PAN, entity number, Z, check character (the check character is verified)
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const gstinOk = (g) => {
    if (!/^(0[1-9]|[1-2][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g))
        return false;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
        const p = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
        sum += Math.floor(p / 36) + (p % 36);
    }
    return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14];
};
const gstin = (v) => {
    if (typeof v !== 'string')
        throw (0, input_js_1.bad)('GSTIN is required');
    const g = v.trim().toUpperCase();
    if (!gstinOk(g))
        throw (0, input_js_1.bad)('GSTIN is not valid (15 characters: state code, PAN, entity number, Z, check character)');
    return g;
};
// ── helpers for the screens ──────────────────────────────────────────────────
router.get('/projects', async (_req, res, next) => {
    try {
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT id, name FROM projects ORDER BY name ASC`)).rows });
    }
    catch (err) {
        next(err);
    }
});
router.get('/towers', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT id, tower_name FROM towers WHERE project_id = $1 AND deleted_at IS NULL ORDER BY tower_name ASC`, [projectId])).rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 1: FINANCIAL YEARS ────────────────────────────────────────────────────
router.get('/financial-years', async (_req, res, next) => {
    try {
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT id, name, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date, is_active, created_at, updated_at FROM financial_years ORDER BY financial_years.from_date DESC`)).rows });
    }
    catch (err) {
        next(err);
    }
});
// Years must not overlap; the active one is the only active one
const fyCheck = async (c, name, from, to, selfId) => {
    if (from > to)
        throw (0, input_js_1.bad)('From date must not be after To date');
    const clash = await one(c, `SELECT name FROM financial_years WHERE from_date <= $2::date AND to_date >= $1::date AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`, [from, to, selfId]);
    if (clash)
        throw (0, input_js_1.bad)(`These dates overlap the financial year "${clash.name}"`);
    if (await one(c, `SELECT 1 AS x FROM financial_years WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2)`, [name, selfId]))
        throw (0, input_js_1.bad)(`A financial year named "${name}" already exists`);
};
router.post('/financial-years', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const name = (0, input_js_1.text)(b.name, 'Name', 50, true);
        const from = (0, input_js_1.day)(b.fromDate, 'From date'), to = (0, input_js_1.day)(b.toDate, 'To date');
        if (!from || !to)
            throw (0, input_js_1.bad)('From date and To date are required');
        const active = (0, input_js_1.flag)(b.isActive, 'isActive') ?? false;
        const made = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|fy');
            await fyCheck(c, name, from, to, null);
            if (active)
                await c.query(`UPDATE financial_years SET is_active = false, updated_at = now() WHERE is_active`);
            return (await c.query(`INSERT INTO financial_years (name, from_date, to_date, is_active, created_by) VALUES ($1, $2::date, $3::date, $4, $5) RETURNING *`, [name, from, to, active, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'financial_year', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/financial-years/:id', async (req, res, next) => {
    try {
        const fid = (0, input_js_1.uuid)(req.params.id, 'Financial year id');
        const b = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|fy');
            const cur = await one(c, `SELECT *, to_char(from_date, 'YYYY-MM-DD') AS f, to_char(to_date, 'YYYY-MM-DD') AS t FROM financial_years WHERE id = $1 FOR UPDATE`, [fid]);
            if (!cur)
                throw notFound('Financial year');
            const name = (0, input_js_1.has)(b.name) ? (0, input_js_1.text)(b.name, 'Name', 50, true) : cur.name;
            const from = ((0, input_js_1.has)(b.fromDate) ? (0, input_js_1.day)(b.fromDate, 'From date') : cur.f);
            const to = ((0, input_js_1.has)(b.toDate) ? (0, input_js_1.day)(b.toDate, 'To date') : cur.t);
            const active = (0, input_js_1.flag)(b.isActive, 'isActive') ?? cur.is_active;
            await fyCheck(c, name, from, to, fid);
            if (active && !cur.is_active)
                await c.query(`UPDATE financial_years SET is_active = false, updated_at = now() WHERE is_active AND id <> $1`, [fid]);
            const upd = (await c.query(`UPDATE financial_years SET name = $2, from_date = $3::date, to_date = $4::date, is_active = $5, updated_at = now() WHERE id = $1 RETURNING *`, [fid, name, from, to, active])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'financial_year', fid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/financial-years/:id', async (req, res, next) => {
    try {
        const fid = (0, input_js_1.uuid)(req.params.id, 'Financial year id');
        const gone = (await index_js_1.db.query(`DELETE FROM financial_years WHERE id = $1 RETURNING *`, [fid])).rows[0];
        if (!gone)
            throw notFound('Financial year');
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'financial_year', fid, gone, undefined);
        res.json({ success: true, data: { id: fid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 2: HSN/SAC CODES ─────────────────────────────────────────────────────
// HSN (goods): 4, 6 or 8 digits. SAC (service): 6 digits starting 99.
const hsnCode = (v, type) => {
    const c = (0, input_js_1.text)(v, 'Code', 20, true);
    if (type === 'Service' ? !/^99\d{4}$/.test(c) : !/^\d{4}(\d{2}(\d{2})?)?$/.test(c)) {
        throw (0, input_js_1.bad)(type === 'Service' ? 'A service (SAC) code is 6 digits starting with 99' : 'A goods (HSN) code is 4, 6 or 8 digits');
    }
    return c;
};
const hsnType = (v) => { if (typeof v !== 'string' || !VALID_HSN_TYPES.includes(v))
    throw (0, input_js_1.bad)("Type must be 'Goods' or 'Service'"); return v; };
router.get('/hsn-sac-codes', async (_req, res, next) => {
    try {
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT * FROM hsn_sac_codes WHERE is_active = true ORDER BY code ASC`)).rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/hsn-sac-codes', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const type = hsnType(b.type);
        const code = hsnCode(b.code, type);
        const made = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|hsn|' + code);
            const ex = await one(c, `SELECT * FROM hsn_sac_codes WHERE code = $1`, [code]);
            if (ex?.is_active)
                throw (0, input_js_1.bad)(`Code ${code} already exists`);
            // A code that was removed earlier comes back with the type given now
            if (ex)
                return (await c.query(`UPDATE hsn_sac_codes SET is_active = true, type = $2, updated_at = now() WHERE id = $1 RETURNING *`, [ex.id, type])).rows[0];
            return (await c.query(`INSERT INTO hsn_sac_codes (code, type, created_by) VALUES ($1, $2, $3) RETURNING *`, [code, type, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'hsn_sac_code', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/hsn-sac-codes/:id', async (req, res, next) => {
    try {
        const hid = (0, input_js_1.uuid)(req.params.id, 'HSN/SAC id');
        const b = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = await one(c, `SELECT * FROM hsn_sac_codes WHERE id = $1 AND is_active FOR UPDATE`, [hid]);
            if (!cur)
                throw notFound('HSN/SAC code');
            const type = (0, input_js_1.has)(b.type) ? hsnType(b.type) : cur.type;
            const code = hsnCode((0, input_js_1.has)(b.code) ? b.code : cur.code, type);
            await lock(c, 'gst|hsn|' + code);
            if (await one(c, `SELECT 1 AS x FROM hsn_sac_codes WHERE code = $1 AND id <> $2`, [code, hid]))
                throw (0, input_js_1.bad)(`Code ${code} already exists`);
            const upd = (await c.query(`UPDATE hsn_sac_codes SET code = $2, type = $3, updated_at = now() WHERE id = $1 RETURNING *`, [hid, code, type])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'hsn_sac_code', hid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/hsn-sac-codes/:id', async (req, res, next) => {
    try {
        const hid = (0, input_js_1.uuid)(req.params.id, 'HSN/SAC id');
        const cur = await (0, input_js_1.inTx)(async (c) => {
            const row = await one(c, `SELECT * FROM hsn_sac_codes WHERE id = $1 AND is_active FOR UPDATE`, [hid]);
            if (!row)
                throw notFound('HSN/SAC code');
            const used = await one(c, `SELECT count(*)::int AS n FROM hsn_sac_code_assign WHERE hsn_sac_id = $1`, [hid]);
            if (used.n)
                throw (0, input_js_1.bad)(`Code ${row.code} is assigned to ${used.n} charge(s). Remove those assignments first.`, 409);
            await c.query(`UPDATE hsn_sac_codes SET is_active = false, updated_at = now() WHERE id = $1`, [hid]);
            return row;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'hsn_sac_code', hid, cur, { ...cur, is_active: false });
        res.json({ success: true, data: { id: hid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 3: HSN/SAC CODE ASSIGN ───────────────────────────────────────────────
router.get('/hsn-sac-assign', async (req, res, next) => {
    try {
        const projectId = optId(req.query.projectId, 'projectId');
        const result = await index_js_1.db.query(`SELECT hsa.id, hsa.project_id, hsa.hsn_sac_id, hsa.charge_type, hsa.created_at, h.code AS hsn_code, h.type AS hsn_type, p.name AS project_name
         FROM hsn_sac_code_assign hsa JOIN hsn_sac_codes h ON h.id = hsa.hsn_sac_id JOIN projects p ON p.id = hsa.project_id
        WHERE ($1::uuid IS NULL OR hsa.project_id = $1) ORDER BY p.name, hsa.charge_type`, [projectId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.post('/hsn-sac-assign', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const hsnSacId = (0, input_js_1.uuid)(b.hsnSacId, 'hsnSacId'), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), ct = chargeType(b.chargeType);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, `gst|assign|${projectId}|${ct}`);
            await projectExists(c, projectId);
            if (!(await one(c, `SELECT 1 AS x FROM hsn_sac_codes WHERE id = $1 AND is_active`, [hsnSacId])))
                throw (0, input_js_1.bad)('That HSN/SAC code does not exist (or was removed)');
            const prev = await one(c, `SELECT * FROM hsn_sac_code_assign WHERE project_id = $1 AND charge_type = $2`, [projectId, ct]);
            const row = (await c.query(`INSERT INTO hsn_sac_code_assign (hsn_sac_id, project_id, charge_type, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, charge_type) DO UPDATE SET hsn_sac_id = $1, updated_at = now() RETURNING *`, [hsnSacId, projectId, ct, req.userId || null])).rows[0];
            return { prev, row };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, out.prev ? 'update' : 'create', 'hsn_sac_assignment', out.row.id, out.prev, out.row);
        res.status(201).json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/hsn-sac-assign/:id', async (req, res, next) => {
    try {
        const aid = (0, input_js_1.uuid)(req.params.id, 'Assignment id');
        const gone = (await index_js_1.db.query(`DELETE FROM hsn_sac_code_assign WHERE id = $1 RETURNING *`, [aid])).rows[0];
        if (!gone)
            throw notFound('Assignment');
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'hsn_sac_assignment', aid, gone, undefined);
        res.json({ success: true, data: { id: aid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 4: GST SLABS (date ranges; two ranges must never cover the same day, or a rate lookup is ambiguous) ──
router.get('/gst-slabs', async (_req, res, next) => {
    try {
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT id, to_char(from_date, 'YYYY-MM-DD') AS from_date, to_char(to_date, 'YYYY-MM-DD') AS to_date, is_active, created_at, updated_at FROM gst_slabs WHERE is_active = true ORDER BY gst_slabs.from_date DESC`)).rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/gst-slabs', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const from = (0, input_js_1.day)(b.fromDate, 'From date'), to = (0, input_js_1.day)(b.toDate, 'To date');
        if (!from || !to)
            throw (0, input_js_1.bad)('From date and To date are required');
        if (from > to)
            throw (0, input_js_1.bad)('From date must not be after To date');
        const made = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|slab');
            const clash = await one(c, `SELECT to_char(from_date,'DD Mon YYYY') AS f, to_char(to_date,'DD Mon YYYY') AS t FROM gst_slabs WHERE is_active AND from_date <= $2::date AND to_date >= $1::date LIMIT 1`, [from, to]);
            if (clash)
                throw (0, input_js_1.bad)(`These dates overlap the slab ${clash.f} - ${clash.t}. A day can belong to one slab only.`);
            return (await c.query(`INSERT INTO gst_slabs (from_date, to_date, created_by) VALUES ($1::date, $2::date, $3) RETURNING *`, [from, to, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'gst_slab', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/gst-slabs/:id', async (req, res, next) => {
    try {
        const sid = (0, input_js_1.uuid)(req.params.id, 'Slab id');
        const cur = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|slab');
            const row = await one(c, `SELECT * FROM gst_slabs WHERE id = $1 FOR UPDATE`, [sid]);
            if (!row)
                throw notFound('GST slab');
            if ((await one(c, `SELECT count(*)::int AS n FROM gst_tax_setup WHERE slab_id = $1`, [sid])).n)
                throw (0, input_js_1.bad)('Cannot delete a slab that has tax rates. Delete the rates first.', 409);
            // Deleting the slab would silently delete every project's charge mapping in it, and Booking would stop finding a rate
            if ((await one(c, `SELECT count(*)::int AS n FROM gst_tax_charge_mapping WHERE slab_id = $1`, [sid])).n)
                throw (0, input_js_1.bad)('Cannot delete a slab that projects are mapped to. Remove those mappings first.', 409);
            await c.query(`DELETE FROM gst_slabs WHERE id = $1`, [sid]);
            return row;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'gst_slab', sid, cur, undefined);
        res.json({ success: true, data: { id: sid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 5: GST TAX SETUP ─────────────────────────────────────────────────────
router.get('/gst-tax-setup', async (req, res, next) => {
    try {
        const slabId = optId(req.query.slabId, 'slabId');
        const result = await index_js_1.db.query(`SELECT gts.*, to_char(gs.from_date, 'YYYY-MM-DD') AS from_date, to_char(gs.to_date, 'YYYY-MM-DD') AS to_date, TO_CHAR(gs.from_date,'DD Mon YYYY') || ' - ' || TO_CHAR(gs.to_date,'DD Mon YYYY') AS slab_label
         FROM gst_tax_setup gts JOIN gst_slabs gs ON gs.id = gts.slab_id
        WHERE ($1::uuid IS NULL OR gts.slab_id = $1) ORDER BY gs.from_date DESC, gts.gst_code ASC`, [slabId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// INTRA = CGST + SGST (equal halves); INTER = IGST only; UT = UTGST only. Booking charges CGST + SGST.
const taxRates = (b, cur) => {
    const pick = (k, col, label) => (0, input_js_1.has)(b[k]) ? (0, input_js_1.num)(b[k], label, 100, 3) : cur ? Number(cur[col]) : 0;
    return { cgst: pick('cgstPct', 'cgst_pct', 'CGST %'), sgst: pick('sgstPct', 'sgst_pct', 'SGST %'), utgst: pick('utgstPct', 'utgst_pct', 'UTGST %'), igst: pick('igstPct', 'igst_pct', 'IGST %') };
};
const taxRules = (type, r) => {
    const eq = (a, b) => Math.abs(a - b) < 1e-9;
    if (type === 'INTRA' && !(eq(r.cgst, r.sgst) && r.igst === 0 && r.utgst === 0))
        throw (0, input_js_1.bad)('An INTRA rate has equal CGST and SGST, and no IGST or UTGST');
    if (type === 'INTER' && !(r.igst >= 0 && r.cgst === 0 && r.sgst === 0 && r.utgst === 0))
        throw (0, input_js_1.bad)('An INTER rate has IGST only');
    if (type === 'UT' && !(r.cgst === 0 && r.sgst === 0 && r.igst === 0))
        throw (0, input_js_1.bad)('A UT rate has UTGST only');
};
const gstType = (v) => { if (typeof v !== 'string' || !VALID_GST_TYPES.includes(v))
    throw (0, input_js_1.bad)(`type must be one of: ${VALID_GST_TYPES.join(', ')}`); return v; };
const taxDup = async (c, slabId, code, type, selfId) => {
    if (await one(c, `SELECT 1 AS x FROM gst_tax_setup WHERE slab_id = $1 AND lower(gst_code) = lower($2) AND type = $3 AND ($4::uuid IS NULL OR id <> $4)`, [slabId, code, type, selfId])) {
        throw (0, input_js_1.bad)(`A ${type} rate with the code "${code}" already exists in this slab`);
    }
};
router.post('/gst-tax-setup', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const slabId = (0, input_js_1.uuid)(b.slabId, 'slabId'), code = (0, input_js_1.text)(b.gstCode, 'GST code', 50, true), type = gstType(b.type);
        const r = taxRates(b);
        taxRules(type, r);
        const made = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, `gst|tax|${slabId}|${code.toLowerCase()}|${type}`);
            if (!(await one(c, `SELECT 1 AS x FROM gst_slabs WHERE id = $1 AND is_active`, [slabId])))
                throw (0, input_js_1.bad)('That slab does not exist');
            await taxDup(c, slabId, code, type, null);
            return (await c.query(`INSERT INTO gst_tax_setup (slab_id, gst_code, type, cgst_pct, sgst_pct, utgst_pct, igst_pct, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [slabId, code, type, r.cgst, r.sgst, r.utgst, r.igst, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'gst_tax_setup', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/gst-tax-setup/:id', async (req, res, next) => {
    try {
        const tid = (0, input_js_1.uuid)(req.params.id, 'Tax setup id');
        const b = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = await one(c, `SELECT * FROM gst_tax_setup WHERE id = $1 FOR UPDATE`, [tid]);
            if (!cur)
                throw notFound('GST tax setup');
            const code = (0, input_js_1.has)(b.gstCode) ? (0, input_js_1.text)(b.gstCode, 'GST code', 50, true) : cur.gst_code;
            const type = (0, input_js_1.has)(b.type) ? gstType(b.type) : cur.type;
            const r = taxRates(b, cur);
            taxRules(type, r);
            // A rate used by a project mapping must stay INTRA, because Booking charges CGST + SGST
            if (type !== 'INTRA' && (await one(c, `SELECT 1 AS x FROM gst_tax_charge_mapping WHERE gst_tax_id = $1`, [tid])))
                throw (0, input_js_1.bad)('This rate is mapped to a project charge, so it must stay INTRA', 409);
            await lock(c, `gst|tax|${cur.slab_id}|${code.toLowerCase()}|${type}`);
            await taxDup(c, cur.slab_id, code, type, tid);
            const upd = (await c.query(`UPDATE gst_tax_setup SET gst_code = $2, type = $3, cgst_pct = $4, sgst_pct = $5, utgst_pct = $6, igst_pct = $7, updated_at = now() WHERE id = $1 RETURNING *`, [tid, code, type, r.cgst, r.sgst, r.utgst, r.igst])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'gst_tax_setup', tid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/gst-tax-setup/:id', async (req, res, next) => {
    try {
        const tid = (0, input_js_1.uuid)(req.params.id, 'Tax setup id');
        const cur = await (0, input_js_1.inTx)(async (c) => {
            const row = await one(c, `SELECT * FROM gst_tax_setup WHERE id = $1 FOR UPDATE`, [tid]);
            if (!row)
                throw notFound('GST tax setup');
            // The mapping would otherwise keep a missing rate and Booking would stop finding one
            const used = await one(c, `SELECT count(*)::int AS n FROM gst_tax_charge_mapping WHERE gst_tax_id = $1`, [tid]);
            if (used.n)
                throw (0, input_js_1.bad)(`This rate is used by ${used.n} project charge mapping(s). Remove or change those first.`, 409);
            await c.query(`DELETE FROM gst_tax_setup WHERE id = $1`, [tid]);
            return row;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'gst_tax_setup', tid, cur, undefined);
        res.json({ success: true, data: { id: tid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 6: GST TAX CHARGE MAPPING ────────────────────────────────────────────
router.get('/gst-charge-mapping', async (req, res, next) => {
    try {
        const projectId = optId(req.query.projectId, 'projectId'), slabId = optId(req.query.slabId, 'slabId');
        const result = await index_js_1.db.query(`SELECT gcm.*, p.name AS project_name, gts.gst_code, gts.type AS gst_type, gts.cgst_pct, gts.sgst_pct, gts.utgst_pct, gts.igst_pct,
              TO_CHAR(gs.from_date,'DD Mon YYYY') || ' - ' || TO_CHAR(gs.to_date,'DD Mon YYYY') AS slab_label
         FROM gst_tax_charge_mapping gcm JOIN projects p ON p.id = gcm.project_id JOIN gst_slabs gs ON gs.id = gcm.slab_id
         LEFT JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
        WHERE ($1::uuid IS NULL OR gcm.project_id = $1) AND ($2::uuid IS NULL OR gcm.slab_id = $2) ORDER BY p.name, gcm.charge_type`, [projectId, slabId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.post('/gst-charge-mapping', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), slabId = (0, input_js_1.uuid)(b.slabId, 'slabId'), gstTaxId = (0, input_js_1.uuid)(b.gstTaxId, 'gstTaxId'), ct = chargeType(b.chargeType);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, `gst|map|${projectId}|${slabId}|${ct}`);
            await projectExists(c, projectId);
            if (!(await one(c, `SELECT 1 AS x FROM gst_slabs WHERE id = $1 AND is_active`, [slabId])))
                throw (0, input_js_1.bad)('That slab does not exist');
            const tax = await one(c, `SELECT slab_id, type FROM gst_tax_setup WHERE id = $1`, [gstTaxId]);
            if (!tax)
                throw (0, input_js_1.bad)('That tax rate does not exist');
            if (tax.slab_id !== slabId)
                throw (0, input_js_1.bad)('That tax rate belongs to a different slab');
            if (tax.type !== 'INTRA')
                throw (0, input_js_1.bad)('Booking charges CGST + SGST, so map an INTRA rate');
            const prev = await one(c, `SELECT * FROM gst_tax_charge_mapping WHERE project_id = $1 AND slab_id = $2 AND charge_type = $3`, [projectId, slabId, ct]);
            const row = (await c.query(`INSERT INTO gst_tax_charge_mapping (project_id, slab_id, gst_tax_id, charge_type, created_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (project_id, slab_id, charge_type) DO UPDATE SET gst_tax_id = $3, updated_at = now() RETURNING *`, [projectId, slabId, gstTaxId, ct, req.userId || null])).rows[0];
            return { prev, row };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, out.prev ? 'update' : 'create', 'gst_charge_mapping', out.row.id, out.prev, out.row);
        res.status(201).json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.delete('/gst-charge-mapping/:id', async (req, res, next) => {
    try {
        const mid = (0, input_js_1.uuid)(req.params.id, 'Mapping id');
        const gone = (await index_js_1.db.query(`DELETE FROM gst_tax_charge_mapping WHERE id = $1 RETURNING *`, [mid])).rows[0];
        if (!gone)
            throw notFound('Charge mapping');
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'gst_charge_mapping', mid, gone, undefined);
        res.json({ success: true, data: { id: mid } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/gst-configuration/resolve?projectId=X&chargeType=BASIC&date=Y: the rate Booking would use (same lookup and BASIC fallback)
router.get('/resolve', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId'), ct = chargeType(req.query.chargeType);
        const resolveDate = (0, input_js_1.day)(req.query.date, 'date') || new Date().toISOString().split('T')[0];
        const proj = (await index_js_1.db.query(`SELECT name FROM projects WHERE id = $1`, [projectId])).rows[0];
        if (!proj)
            throw notFound('Project');
        const find = async (type) => (await index_js_1.db.query(`SELECT gts.cgst_pct, gts.sgst_pct FROM gst_tax_charge_mapping gcm
         JOIN gst_slabs gs ON gs.id = gcm.slab_id AND gs.from_date <= $3::date AND gs.to_date >= $3::date
         JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
        WHERE gcm.project_id = $1 AND gcm.charge_type = $2 LIMIT 1`, [projectId, type, resolveDate])).rows[0];
        let row = await find(ct), fallback = false;
        if (!row && ct !== 'BASIC') {
            row = await find('BASIC');
            fallback = !!row;
        }
        if (!row)
            return res.status(404).json({ success: false, error: `No GST mapping for ${ct} on ${proj.name}` });
        res.json({ success: true, data: { cgstPct: parseFloat(row.cgst_pct), sgstPct: parseFloat(row.sgst_pct), fallback } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 7: PROJECT WISE GSTIN ─────────────────────────────────────────────────
router.get('/project-gstin', async (_req, res, next) => {
    try {
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT pg.id, pg.project_id, pg.gstin, pg.is_active, p.name AS project_name FROM project_gstin pg JOIN projects p ON p.id = pg.project_id ORDER BY p.name ASC`)).rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/project-gstin', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const g = gstin(b.gstin);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, 'gst|gstin|' + projectId);
            await projectExists(c, projectId);
            const prev = await one(c, `SELECT * FROM project_gstin WHERE project_id = $1`, [projectId]);
            const row = (await c.query(`INSERT INTO project_gstin (project_id, gstin, created_by) VALUES ($1, $2, $3) ON CONFLICT (project_id) DO UPDATE SET gstin = $2, updated_at = now() RETURNING *`, [projectId, g, req.userId || null])).rows[0];
            return { prev, row };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, out.prev ? 'update' : 'create', 'project_gstin', out.row.id, out.prev, out.row);
        res.status(201).json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/project-gstin/:id', async (req, res, next) => {
    try {
        const gid = (0, input_js_1.uuid)(req.params.id, 'Project GSTIN id');
        const g = gstin((0, input_js_1.body)(req).gstin);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const prev = await one(c, `SELECT * FROM project_gstin WHERE id = $1 FOR UPDATE`, [gid]);
            if (!prev)
                throw notFound('Project GSTIN');
            return { prev, row: (await c.query(`UPDATE project_gstin SET gstin = $2, updated_at = now() WHERE id = $1 RETURNING *`, [gid, g])).rows[0] };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project_gstin', gid, out.prev, out.row);
        res.json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ── TAB 8: PROJECT WISE RERA NO. ─────────────────────────────────────────────
router.get('/project-rera', async (req, res, next) => {
    try {
        const projectId = optId(req.query.projectId, 'projectId');
        const result = await index_js_1.db.query(`SELECT prn.id, prn.project_id, prn.tower_id, prn.rera_number, p.name AS project_name, t.tower_name
         FROM project_rera_numbers prn JOIN projects p ON p.id = prn.project_id LEFT JOIN towers t ON t.id = prn.tower_id
        WHERE ($1::uuid IS NULL OR prn.project_id = $1) ORDER BY p.name, t.tower_name`, [projectId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
const reraNo = (v) => {
    const r = (0, input_js_1.text)(v, 'RERA number', 100, true);
    if (!/^[A-Za-z0-9][A-Za-z0-9 ./()\-]*$/.test(r))
        throw (0, input_js_1.bad)('RERA number can have letters, digits and . / ( ) - only');
    return r;
};
router.post('/project-rera', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const towerId = optId(b.towerId, 'towerId');
        const rera = reraNo(b.reraNumber);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await lock(c, `gst|rera|${projectId}|${towerId || ''}`);
            await projectExists(c, projectId);
            if (towerId && !(await one(c, `SELECT 1 AS x FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`, [towerId, projectId])))
                throw (0, input_js_1.bad)('That tower does not belong to this project');
            // The table's unique key ignores rows with no tower, so the project-level row is looked up here
            const prev = await one(c, `SELECT * FROM project_rera_numbers WHERE project_id = $1 AND tower_id IS NOT DISTINCT FROM $2::uuid`, [projectId, towerId]);
            const row = prev
                ? (await c.query(`UPDATE project_rera_numbers SET rera_number = $2, updated_at = now() WHERE id = $1 RETURNING *`, [prev.id, rera])).rows[0]
                : (await c.query(`INSERT INTO project_rera_numbers (project_id, tower_id, rera_number, created_by) VALUES ($1, $2, $3, $4) RETURNING *`, [projectId, towerId, rera, req.userId || null])).rows[0];
            return { prev, row };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, out.prev ? 'update' : 'create', 'project_rera', out.row.id, out.prev, out.row);
        res.status(201).json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/project-rera/:id', async (req, res, next) => {
    try {
        const rid = (0, input_js_1.uuid)(req.params.id, 'RERA id');
        const rera = reraNo((0, input_js_1.body)(req).reraNumber);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const prev = await one(c, `SELECT * FROM project_rera_numbers WHERE id = $1 FOR UPDATE`, [rid]);
            if (!prev)
                throw notFound('RERA number');
            return { prev, row: (await c.query(`UPDATE project_rera_numbers SET rera_number = $2, updated_at = now() WHERE id = $1 RETURNING *`, [rid, rera])).rows[0] };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project_rera', rid, out.prev, out.row);
        res.json({ success: true, data: out.row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=gst-configuration.js.map