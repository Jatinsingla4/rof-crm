"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_js_1 = require("../index.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const router = (0, express_1.Router)();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Format checks for tax and bank identifiers. Values are upper-cased before checking.
const FORMATS = {
    gstin: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'GSTIN must be 15 characters, for example 06ABCDE1234F1Z5'],
    pan_no: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must be 10 characters, for example ABCDE1234F'],
    cin: [/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, 'CIN must be 21 characters, for example U70100HR2015PTC012345'],
    bank_ifsc: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC must be 11 characters: 4 letters, 0, then 6 letters or digits'],
    pin_code: [/^[1-9][0-9]{5}$/, 'PIN code must be 6 digits'],
    phone: [/^[0-9+()\-\s]{6,20}$/, 'Phone number is not valid'],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is not valid'],
};
// Company details are printed into letters as HTML, so markup characters are not accepted in any text field
const hasMarkup = (v) => typeof v === 'string' && /[<>]/.test(v);
const COMPANY_COLUMNS = ['name', 'code', 'group_name', 'address1', 'address2', 'address3', 'city', 'state', 'country', 'pin_code',
    'phone', 'fax', 'email', 'website', 'gstin', 'cin', 'pan_no', 'service_tax_no', 'vat_no', 'reg_address', 'place_of_supply',
    'bank_company_name', 'bank_account_no', 'bank_ifsc', 'bank_name', 'bank_branch', 'payable_at'];
// Reads bank account fields from a request. Text is trimmed and blank becomes null. Returns snake_case values or an error.
const BANK_FIELDS = { accountName: 'account_name', bankName: 'bank_name', accountNumber: 'account_number',
    ifscCode: 'ifsc_code', branch: 'branch', payableAt: 'payable_at', accountType: 'account_type' };
function readBank(body) {
    const v = {};
    for (const [key, col] of Object.entries(BANK_FIELDS)) {
        let x = body?.[key];
        if (x === undefined)
            continue;
        if (x !== null && typeof x !== 'string')
            return { error: 'Invalid bank account details.' };
        x = (x || '').trim() || null;
        if (hasMarkup(x))
            return { error: 'Text cannot contain < or >.' };
        v[col] = x;
    }
    if ('bank_name' in v && !v.bank_name)
        return { error: 'Bank name is required.' };
    if ('account_number' in v && !v.account_number)
        return { error: 'Account number is required.' };
    // an Indian bank account number is digits only, 9 to 18 of them; "ABC" used to be saved as one
    if (v.account_number && !/^[0-9]{9,18}$/.test(v.account_number))
        return { error: 'Account number must be 9 to 18 digits.' };
    const ip = body?.isPrimary;
    if (ip !== undefined && typeof ip !== 'boolean')
        return { error: 'isPrimary must be true or false.' };
    return { v, isPrimary: ip };
}
const UPPERCASE_FIELDS = new Set(['gstin', 'pan_no', 'cin', 'bank_ifsc']);
// Returns the normalised value, or an error message. Empty values are allowed (the field is optional).
function checkFormat(field, value) {
    if (value == null)
        return { value };
    const v = UPPERCASE_FIELDS.has(field) ? value.toUpperCase() : value;
    const rule = FORMATS[field];
    return rule && !rule[0].test(v) ? { error: rule[1] } : { value: v };
}
const logoStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const dir = path_1.default.join(process.cwd(), 'uploads/company-logos');
        fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    // Saved under a temporary name first; the real name is given only after the file's bytes are checked,
    // so a bad upload never replaces the company's current logo
    filename: (req, file, cb) => {
        cb(null, `${req.params.id}.upload`);
    },
});
// The first bytes of a real PNG, JPEG or GIF. The type sent by the browser is not trusted.
const LOGO_MAGIC = [['.png', [0x89, 0x50, 0x4e, 0x47]], ['.jpg', [0xff, 0xd8, 0xff]], ['.gif', [0x47, 0x49, 0x46, 0x38]]];
function logoExtFromBytes(file) {
    const fd = fs_1.default.openSync(file, 'r');
    const head = Buffer.alloc(4);
    try {
        fs_1.default.readSync(fd, head, 0, 4, 0);
    }
    finally {
        fs_1.default.closeSync(fd);
    }
    return LOGO_MAGIC.find(([, magic]) => magic.every((b, i) => head[i] === b))?.[0] ?? null;
}
const uploadLogo = (0, multer_1.default)({
    storage: logoStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
        cb(null, allowed.includes(file.mimetype));
    },
});
// GET /api/companies
router.get('/', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT c.*, COUNT(DISTINCT p.id)::int AS project_count,
        (SELECT COUNT(*)::int FROM company_bank_accounts b
          WHERE b.company_id = c.id AND b.is_active = true AND b.is_primary = true) AS primary_accounts
      FROM companies c
      LEFT JOIN projects p ON p.company_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/companies/:id
router.get('/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT c.*,
        json_agg(json_build_object('id', p.id, 'name', p.name))
          FILTER (WHERE p.id IS NOT NULL) AS projects
      FROM companies c
      LEFT JOIN projects p ON p.company_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Company not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/companies
router.post('/', async (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can create companies' });
    try {
        const body = req.body || {};
        if (typeof body.name !== 'string' || !body.name.trim())
            return res.status(400).json({ error: 'Company name required' });
        const v = {};
        for (const col of COMPANY_COLUMNS) {
            let x = body[col];
            if (x === undefined) {
                v[col] = null;
                continue;
            }
            if (x !== null && typeof x !== 'string')
                return res.status(400).json({ error: `Invalid value for ${col}` });
            x = (x || '').trim() || null;
            if (hasMarkup(x))
                return res.status(400).json({ error: `${col} cannot contain < or >` });
            const r = FORMATS[col] ? checkFormat(col, x) : { value: x };
            if ('error' in r)
                return res.status(400).json({ error: r.error });
            v[col] = r.value;
        }
        if ((await index_js_1.db.query('SELECT 1 FROM companies WHERE lower(name) = lower($1)', [v.name])).rows.length) {
            return res.status(409).json({ error: 'A company with this name already exists' });
        }
        const slots = COMPANY_COLUMNS.map((c, i) => c === 'country' ? `COALESCE($${i + 1},'India')` : c === 'place_of_supply' ? `COALESCE($${i + 1},'Haryana')` : `$${i + 1}`);
        const result = await index_js_1.db.query(`INSERT INTO companies (${COMPANY_COLUMNS.join(', ')}, is_active, updated_at) VALUES (${slots.join(', ')}, true, NOW()) RETURNING *`, COMPANY_COLUMNS.map((c) => v[c]));
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'company', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/companies/:id
router.put('/:id', async (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can update companies' });
    try {
        const { id } = req.params;
        const { write_to_global_settings } = req.body || {};
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            // Only the fields present in the request are changed; a blank value clears the field
            const before = (await client.query('SELECT * FROM companies WHERE id = $1', [id])).rows[0];
            const body = req.body || {};
            const columns = COMPANY_COLUMNS;
            const sets = [];
            const vals = [];
            for (const col of columns) {
                let v = body[col];
                if (v === undefined)
                    continue;
                if (v !== null && typeof v !== 'string') {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `Invalid value for ${col}` });
                }
                if (hasMarkup(v) && (!before || v !== before[col])) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: `${col} cannot contain < or >` });
                }
                if (typeof v === 'string')
                    v = v.trim() || null;
                if (col === 'name' && !v) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Company name required' });
                }
                if (col === 'name' && before && v.toLowerCase() !== String(before.name).toLowerCase()
                    && (await client.query('SELECT 1 FROM companies WHERE lower(name) = lower($1) AND id <> $2', [v, id])).rows.length) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ error: 'A company with this name already exists' });
                }
                // A value that is unchanged is not re-checked, so an old record with a bad value can still be saved
                if (FORMATS[col] && before && v !== before[col]) {
                    const r = checkFormat(col, v);
                    if ('error' in r) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: r.error });
                    }
                    v = r.value;
                }
                vals.push(v);
                sets.push(`${col} = $${vals.length}`);
            }
            vals.push(id);
            const result = await client.query(`UPDATE companies SET ${sets.length ? sets.join(', ') + ', ' : ''}updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals);
            if (!result.rows[0]) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Company not found' });
            }
            const co = result.rows[0];
            if (write_to_global_settings === true) {
                const settings = [
                    ['company_name', co.name || ''],
                    ['company_cin', co.cin || ''],
                    ['company_gstin', co.gstin || ''],
                    ['company_address', co.address1 || ''],
                    ['company_reg_addr', co.reg_address || ''],
                    ['company_phone', co.phone || ''],
                    ['company_website', co.website || ''],
                    ['company_email', co.email || ''],
                    ['place_of_supply', co.place_of_supply || 'Haryana'],
                    ['bank_company_name', co.bank_company_name || co.name || ''],
                    ['bank_account_no', co.bank_account_no || ''],
                    ['bank_ifsc', co.bank_ifsc || ''],
                    ['bank_name', co.bank_name || ''],
                    ['bank_branch', co.bank_branch || ''],
                    ['company_logo_url', co.logo_url || ''],
                ];
                for (const [key, value] of settings) {
                    await client.query(`
            INSERT INTO global_settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [key, value]);
                }
            }
            await client.query('COMMIT');
            // write_to_global_settings is the "set as active company" switch: it changes what every letter and receipt prints
            await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'company', id, before, { ...co, write_to_global_settings: write_to_global_settings === true });
            res.json({ success: true, data: co });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        next(err);
    }
});
// GET /api/companies/:id/bank-accounts
router.get('/:id/bank-accounts', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`
      SELECT id, company_id, account_name, bank_name, account_number,
             ifsc_code, branch, payable_at, account_type, is_active,
             is_primary, created_at
      FROM company_bank_accounts
      WHERE company_id = $1 AND is_active = true
      ORDER BY is_primary DESC, created_at ASC
    `, [id]);
        return res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/companies/:id/bank-accounts
router.post('/:id/bank-accounts', async (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can add bank accounts' });
    let client;
    try {
        const { id } = req.params;
        const parsed = readBank(req.body);
        if ('error' in parsed)
            return res.status(400).json({ success: false, error: parsed.error });
        const { v } = parsed;
        if (!v.bank_name || !v.account_number)
            return res.status(400).json({ success: false, error: 'Bank name and account number are required.' });
        const ifsc = checkFormat('bank_ifsc', v.ifsc_code ?? null);
        if ('error' in ifsc)
            return res.status(400).json({ success: false, error: ifsc.error });
        client = await index_js_1.db.connect();
        await client.query('BEGIN');
        // Locking the company row makes two simultaneous requests take turns, so there is never more than one primary account
        if (!(await client.query('SELECT 1 FROM companies WHERE id = $1 FOR UPDATE', [id])).rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Company not found.' });
        }
        // The first account of a company is always its primary account
        const hasPrimary = (await client.query(`SELECT 1 FROM company_bank_accounts WHERE company_id = $1 AND is_active = true AND is_primary = true`, [id])).rows.length > 0;
        const makePrimary = parsed.isPrimary === true || !hasPrimary;
        if (makePrimary)
            await client.query(`UPDATE company_bank_accounts SET is_primary = false, updated_at = now() WHERE company_id = $1`, [id]);
        const result = await client.query(`
      INSERT INTO company_bank_accounts (company_id, account_name, bank_name, account_number, ifsc_code, branch, payable_at, account_type, is_primary)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'current'), $9) RETURNING *`, [id, v.account_name ?? null, v.bank_name, v.account_number, ifsc.value, v.branch ?? null, v.payable_at ?? null, v.account_type ?? null, makePrimary]);
        await client.query('COMMIT');
        // Audited on the same connection: asking the pool for a second one while holding this one can deadlock a busy pool
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'create', 'company_bank_account', result.rows[0].id, undefined, result.rows[0]);
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        if (client)
            await client.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        if (client)
            client.release();
    }
});
// PATCH /api/companies/:companyId/bank-accounts/:bankId  (only the fields sent are changed; a blank value clears a field)
router.patch('/:companyId/bank-accounts/:bankId', async (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can update bank accounts' });
    let client;
    try {
        const { companyId, bankId } = req.params;
        const parsed = readBank(req.body);
        if ('error' in parsed)
            return res.status(400).json({ success: false, error: parsed.error });
        const { v } = parsed;
        if (!Object.keys(v).length && parsed.isPrimary === undefined)
            return res.status(400).json({ success: false, error: 'Nothing to update.' });
        client = await index_js_1.db.connect();
        await client.query('BEGIN');
        await client.query('SELECT 1 FROM companies WHERE id = $1 FOR UPDATE', [companyId]);
        const before = (await client.query('SELECT * FROM company_bank_accounts WHERE id = $1 AND company_id = $2 AND is_active = true FOR UPDATE', [bankId, companyId])).rows[0];
        if (!before) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Bank account not found.' });
        }
        if (before.is_primary && parsed.isPrimary === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'A company needs a primary account. Make another account primary instead.' });
        }
        if ('ifsc_code' in v && v.ifsc_code !== before.ifsc_code) {
            const r = checkFormat('bank_ifsc', v.ifsc_code);
            if ('error' in r) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: r.error });
            }
            v.ifsc_code = r.value;
        }
        if (parsed.isPrimary === true) {
            await client.query(`UPDATE company_bank_accounts SET is_primary = false, updated_at = now() WHERE company_id = $1 AND id <> $2`, [companyId, bankId]);
        }
        const cols = Object.keys(v);
        const vals = cols.map((c) => v[c]);
        const sets = cols.map((c, i) => `${c} = $${i + 1}`);
        if (parsed.isPrimary !== undefined) {
            vals.push(parsed.isPrimary);
            sets.push(`is_primary = $${vals.length}`);
        }
        vals.push(bankId, companyId);
        const result = await client.query(`UPDATE company_bank_accounts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length - 1} AND company_id = $${vals.length} RETURNING *`, vals);
        await client.query('COMMIT');
        await (0, auditLogger_js_1.auditChange)(client, req, res, 'update', 'company_bank_account', bankId, before, result.rows[0]);
        return res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        if (client)
            await client.query('ROLLBACK').catch(() => { });
        next(err);
    }
    finally {
        if (client)
            client.release();
    }
});
// DELETE /api/companies/:companyId/bank-accounts/:bankId (soft delete)
router.delete('/:companyId/bank-accounts/:bankId', async (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can delete bank accounts' });
    try {
        const { companyId, bankId } = req.params;
        const target = (await index_js_1.db.query(`SELECT is_primary FROM company_bank_accounts WHERE id = $1 AND company_id = $2 AND is_active = true`, [bankId, companyId])).rows[0];
        if (target?.is_primary) {
            const others = (await index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM company_bank_accounts WHERE company_id = $1 AND is_active = true AND id <> $2`, [companyId, bankId])).rows[0].n;
            if (others)
                return res.status(409).json({ success: false, error: 'This is the primary account. Make another account primary before deleting it.' });
        }
        const result = await index_js_1.db.query(`
      UPDATE company_bank_accounts SET is_active = false, updated_at = now()
      WHERE id = $1 AND company_id = $2 AND is_active = true
      RETURNING *
    `, [bankId, companyId]);
        if (!result.rows.length)
            return res.status(404).json({ success: false, error: 'Bank account not found.' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'company_bank_account', bankId, result.rows[0]);
        return res.json({ success: true, data: { id: bankId } });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/companies/:id/logo
// Role and id are checked before multer, so nothing is written for a forbidden or malformed request
const logoGuard = (req, res, next) => {
    if (req.userRole !== 'super_admin')
        return res.status(403).json({ error: 'Only super_admin can upload logos' });
    if (!UUID_RE.test(req.params.id))
        return res.status(400).json({ error: 'Invalid company id' });
    req.params.id = req.params.id.toLowerCase();
    next();
};
// Upload problems (too large, wrong field, bad multipart) are client errors, not server errors
const logoUpload = (req, res, next) => uploadLogo.single('logo')(req, res, (err) => {
    if (!err)
        return next();
    if (err instanceof multer_1.default.MulterError) {
        return err.code === 'LIMIT_FILE_SIZE' ? res.status(413).json({ error: 'Logo is larger than 2 MB' }) : res.status(400).json({ error: 'Invalid upload' });
    }
    return res.status(400).json({ error: 'Invalid upload' });
});
router.post('/:id/logo', logoGuard, logoUpload, async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded. Use a PNG, JPG or GIF image.' });
        if (req.file.size === 0) {
            fs_1.default.unlink(req.file.path, () => { });
            return res.status(400).json({ error: 'The file is empty' });
        }
        const ext = logoExtFromBytes(req.file.path);
        if (!ext) {
            fs_1.default.unlink(req.file.path, () => { });
            return res.status(400).json({ error: 'The file is not a valid PNG, JPG or GIF image' });
        }
        const finalName = `${req.params.id}${ext}`;
        const finalPath = path_1.default.join(path_1.default.dirname(req.file.path), finalName);
        fs_1.default.renameSync(req.file.path, finalPath);
        const logoUrl = `/uploads/company-logos/${finalName}`;
        const updated = await index_js_1.db.query(`UPDATE companies SET logo_url = $1, updated_at = NOW() WHERE id = $2`, [logoUrl, req.params.id]);
        if (!updated.rowCount) {
            fs_1.default.unlink(finalPath, () => { });
            return res.status(404).json({ error: 'Company not found' });
        }
        // Remove an older logo saved with another extension
        for (const other of ['.png', '.jpg', '.gif'])
            if (other !== ext)
                fs_1.default.unlink(path_1.default.join(path_1.default.dirname(finalPath), `${req.params.id}${other}`), () => { });
        await index_js_1.db.query(`
      INSERT INTO global_settings (key, value, updated_at) VALUES ('company_logo_url', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`, [logoUrl]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'company', req.params.id, undefined, { logo_url: logoUrl });
        res.json({ success: true, logo_url: logoUrl });
    }
    catch (err) {
        next(err);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=companies.js.map