"use strict";
/**
 * Bank Reconciliation Routes
 * Import a bank statement (CSV), match each credit line to the receipt that paid it, match by hand, ignore or undo.
 * Matching only links a bank line to a receipt or demand; it never changes the receipt or the demand.
 * Only people who can create payments (admin, project manager, accounts) may see or change bank lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const sync_1 = require("csv-parse/sync");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
router.use((0, rbac_js_1.requirePermission)('payments', 'create'));
const MAX_ROWS = 5000, MAX_CSV = 2000000;
const STATUSES = ['unmatched', 'auto_matched', 'manually_matched', 'ignored'];
// Bank text is not typed by us: take out what could break a page, keep the rest
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// Indian statements are day first: 2026-03-05, 05/03/2026 or 05-03-2026; anything else (or 31/02) is refused, never guessed
const bankDate = (v) => {
    const s = String(v ?? '').trim();
    let y, m, d, k;
    if ((k = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)))
        [, y, m, d] = k;
    else if ((k = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)))
        [, d, m, y] = k;
    else
        throw (0, input_js_1.bad)('Date must be YYYY-MM-DD or DD/MM/YYYY');
    const iso = `${y}-${m}-${d}`;
    if (new Date(iso).toISOString().slice(0, 10) !== iso || iso < '2000-01-01' || iso > '2100-12-31')
        throw (0, input_js_1.bad)('Date is not a real date');
    return iso;
};
// 1,23,456.50 and -500 are fine; 0, text, 3 decimals and more than 100 crore are not
const bankAmount = (v) => {
    const s = String(v ?? '').replace(/[,\s]/g, '');
    if (!/^-?\d+(\.\d{1,2})?$/.test(s))
        throw (0, input_js_1.bad)('Amount must be a number with up to 2 decimals');
    const n = Number(s);
    if (n === 0)
        throw (0, input_js_1.bad)('Amount cannot be 0');
    if (Math.abs(n) > 1000000000)
        throw (0, input_js_1.bad)('Amount is too large');
    return n;
};
const projectOf = async (id) => {
    if (!(await index_js_1.db.query(`SELECT 1 FROM projects WHERE id = $1`, [id])).rows.length)
        throw (0, input_js_1.bad)('Project not found', 404);
};
// The counts on an import are always read back from its lines, so a manual change cannot leave them stale
const recount = (c, importId) => c.query(`UPDATE bank_statement_imports i SET
      matched_count = s.m, unmatched_count = s.u
     FROM (SELECT COUNT(*) FILTER (WHERE match_status IN ('auto_matched','manually_matched'))::int AS m, COUNT(*) FILTER (WHERE match_status = 'unmatched')::int AS u
             FROM bank_transactions WHERE import_id = $1) s
    WHERE i.id = $1`, [importId]);
// POST /api/reconciliation/import - the whole file or nothing
router.post('/import', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.projectId) || !(0, input_js_1.has)(b.fileName) || !(0, input_js_1.has)(b.csvContent))
            throw (0, input_js_1.bad)('Missing required fields: projectId, fileName, csvContent');
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), fileName = (0, input_js_1.text)(b.fileName, 'fileName', 255, true);
        if (typeof b.csvContent !== 'string')
            throw (0, input_js_1.bad)('csvContent must be the text of the CSV file');
        if (b.csvContent.length > MAX_CSV)
            throw (0, input_js_1.bad)('The file is too large (2 MB at most)');
        let records;
        try {
            records = (0, sync_1.parse)(b.csvContent, { columns: (h) => h.map((x) => x.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
        }
        catch (e) {
            throw (0, input_js_1.bad)('Invalid CSV format: ' + String(e.message).split('\n')[0]);
        }
        if (!records.length)
            throw (0, input_js_1.bad)('CSV file is empty');
        if (records.length > MAX_ROWS)
            throw (0, input_js_1.bad)(`The file has ${records.length} rows; ${MAX_ROWS} at most in one import`);
        const missing = ['date', 'description', 'amount'].filter((k) => !(k in records[0]));
        if (missing.length)
            throw (0, input_js_1.bad)(`Missing required columns: ${missing.join(', ')} (Date, Description, Amount; Reference and Account are optional)`);
        const rows = [], errors = [];
        records.forEach((r, i) => {
            try {
                rows.push({ date: bankDate(r.date), desc: clean(r.description, 500), amount: bankAmount(r.amount), ref: clean(r.reference, 100) || null, account: clean(r.account, 100) || null });
            }
            catch (e) {
                errors.push(`Row ${i + 2}: ${e.http ? e.message : 'cannot be read'}`);
            }
        });
        if (errors.length)
            return res.status(422).json({ error: `The file has ${errors.length} row(s) with problems, nothing was imported. ${errors.slice(0, 5).join(' | ')}${errors.length > 5 ? ` | and ${errors.length - 5} more` : ''}`, errors: errors.slice(0, 50) });
        const hash = (0, node_crypto_1.createHash)('sha256').update(b.csvContent.replace(/\r\n/g, '\n').trim()).digest('hex');
        const out = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length)
                throw (0, input_js_1.bad)('Project not found', 404);
            await (0, input_js_1.lock)(c, `bank-import:${projectId}`);
            const same = (await c.query(`SELECT id, file_name, import_date FROM bank_statement_imports WHERE project_id = $1 AND file_hash = $2`, [projectId, hash])).rows[0];
            if (same)
                throw (0, input_js_1.bad)(`This statement was already imported as "${same.file_name}" on ${new Date(same.import_date).toISOString().slice(0, 10)}`, 409);
            const imp = (await c.query(`INSERT INTO bank_statement_imports (project_id, file_name, imported_by_user_id, import_date, total_transactions, total_amount_inr, file_hash, status)
         VALUES ($1, $2, $3, ${business_date_js_1.SQL_TODAY}, $4, $5, $6, 'processing') RETURNING id`, [projectId, fileName, req.userId, rows.length, rows.reduce((s, r) => s + r.amount, 0), hash])).rows[0];
            await c.query(`INSERT INTO bank_transactions (import_id, project_id, transaction_date, description, amount_inr, transaction_ref, bank_account, match_status)
         SELECT $1, $2, x.d::date, x.t, x.a::numeric, x.r, x.b, 'unmatched' FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) AS x(d, t, a, r, b)`, [imp.id, projectId, rows.map((r) => r.date), rows.map((r) => r.desc), rows.map((r) => String(r.amount)), rows.map((r) => r.ref), rows.map((r) => r.account)]);
            // A credit is matched to a receipt of the same project when the reference and the amount are the same, the receipt is live, nobody else holds it,
            // and exactly one receipt fits the line and exactly one line fits the receipt. Anything less sure stays unmatched for a person to decide.
            await c.query(`WITH cand AS (
           SELECT t.id AS tid, r.id AS rid FROM bank_transactions t
             JOIN receipts r ON r.transaction_ref = t.transaction_ref AND r.amount_received_inr::numeric = t.amount_inr
             JOIN payment_plans pp ON pp.id = r.payment_plan_id AND pp.project_id = t.project_id
            WHERE t.import_id = $1 AND t.amount_inr > 0 AND r.status NOT IN ('cancelled','bounced')
              AND NOT EXISTS (SELECT 1 FROM bank_transactions o WHERE o.matched_receipt_id = r.id)),
         one AS (SELECT tid, rid, COUNT(*) OVER (PARTITION BY tid) AS per_line, COUNT(*) OVER (PARTITION BY rid) AS per_receipt FROM cand)
         UPDATE bank_transactions t SET matched_receipt_id = one.rid, match_status = 'auto_matched', match_confidence = 95, matched_at = NOW()
           FROM one WHERE one.tid = t.id AND one.per_line = 1 AND one.per_receipt = 1`, [imp.id]);
            await c.query(`UPDATE bank_statement_imports SET status = 'completed' WHERE id = $1`, [imp.id]);
            await recount(c, imp.id);
            return (await c.query(`SELECT id AS "importId", file_name AS "fileName", total_transactions AS "totalTransactions", matched_count AS "matchedCount", unmatched_count AS "unmatchedCount", total_amount_inr AS "totalAmount" FROM bank_statement_imports WHERE id = $1`, [imp.id])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'bank_statement_import', out.importId, undefined, { project_id: projectId, file_name: fileName, lines: rows.length, matched: out.matchedCount });
        res.status(201).json({ success: true, data: { ...out, totalAmount: Number(out.totalAmount) } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next, 'This statement was already imported');
    }
});
// GET /api/reconciliation/imports
router.get('/imports', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const { size, offset } = (0, input_js_1.paging)(req.query, 20, 200);
        const where = projectId ? 'WHERE i.project_id = $1' : '';
        const params = projectId ? [projectId] : [];
        const [rows, count] = await Promise.all([
            index_js_1.db.query(`SELECT i.id, i.project_id, p.name AS project_name, i.file_name, i.imported_by_user_id, u.name AS imported_by_name, i.import_date::text AS import_date, i.total_transactions, i.matched_count, i.unmatched_count, i.total_amount_inr, i.status, i.created_at
           FROM bank_statement_imports i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.imported_by_user_id ${where}
          ORDER BY i.import_date DESC, i.created_at DESC, i.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, size, offset]),
            index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM bank_statement_imports i ${where}`, params),
        ]);
        res.json({ success: true, data: rows.rows, pagination: { page: offset / size + 1, pageSize: size, total: count.rows[0].n } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/reconciliation/imports/:importId/transactions
router.get('/imports/:importId/transactions', async (req, res, next) => {
    try {
        const importId = (0, input_js_1.uuid)(req.params.importId, 'Import id');
        const status = (0, input_js_1.oneOf)(req.query.matchStatus, 'matchStatus', STATUSES);
        const { size, offset } = (0, input_js_1.paging)(req.query, 50, 500);
        if (!(await index_js_1.db.query(`SELECT 1 FROM bank_statement_imports WHERE id = $1`, [importId])).rows.length)
            throw (0, input_js_1.bad)('Import not found', 404);
        const params = [importId];
        const where = status ? ` AND t.match_status = $${params.push(status)}` : '';
        const [rows, count] = await Promise.all([
            index_js_1.db.query(`SELECT t.id, t.import_id, t.transaction_date::text AS transaction_date, t.description, t.amount_inr, t.transaction_ref, t.bank_account, t.matched_receipt_id, t.matched_demand_id,
                t.match_status, t.match_confidence, t.matched_by_user_id, t.matched_at, t.notes, t.created_at, r.receipt_number, c.name AS consumer_name
           FROM bank_transactions t LEFT JOIN receipts r ON r.id = t.matched_receipt_id LEFT JOIN consumers c ON c.id = r.consumer_id
          WHERE t.import_id = $1${where} ORDER BY t.transaction_date DESC, t.created_at, t.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, size, offset]),
            index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM bank_transactions t WHERE t.import_id = $1${where}`, params),
        ]);
        res.json({ success: true, data: rows.rows, pagination: { page: offset / size + 1, pageSize: size, total: count.rows[0].n } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// One line changed by hand: locked, checked, then the import's counts are read back
const change = async (req, res, next, action, set) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Transaction id'), b = (0, input_js_1.body)(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const t = (await c.query(`SELECT id, import_id, project_id, amount_inr, match_status, matched_receipt_id, matched_demand_id FROM bank_transactions WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!t)
                throw (0, input_js_1.bad)('Transaction not found', 404);
            const s = await set(c, t, b);
            const row = (await c.query(`UPDATE bank_transactions SET ${s.sql}, matched_by_user_id = $${s.values.length + 1}, matched_at = NOW() WHERE id = $${s.values.length + 2}
         RETURNING id, match_status, matched_receipt_id, matched_demand_id, notes`, [...s.values, req.userId, id])).rows[0];
            await recount(c, t.import_id);
            return { row, before: { match_status: t.match_status, matched_receipt_id: t.matched_receipt_id, matched_demand_id: t.matched_demand_id } };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'bank_transaction', id, out.before, { ...out.row, action });
        res.json({ success: true, data: out.row });
    }
    catch (error) {
        (0, input_js_1.failWith)(error?.code === '23505' ? (0, input_js_1.bad)('That receipt is already matched to another bank line', 409) : error, res, next);
    }
};
// PATCH /api/reconciliation/transactions/:id/match - by hand: a receipt, a demand or both; replaces what the line pointed at before
router.patch('/transactions/:id/match', (req, res, next) => change(req, res, next, 'match', async (c, t, b) => {
    if (!(0, input_js_1.has)(b.receiptId) && !(0, input_js_1.has)(b.demandId))
        throw (0, input_js_1.bad)('Must provide either receiptId or demandId');
    const receiptId = (0, input_js_1.has)(b.receiptId) ? (0, input_js_1.uuid)(b.receiptId, 'receiptId') : null, demandId = (0, input_js_1.has)(b.demandId) ? (0, input_js_1.uuid)(b.demandId, 'demandId') : null, notes = (0, input_js_1.text)(b.notes, 'notes', 500, false);
    if (!(Number(t.amount_inr) > 0))
        throw (0, input_js_1.bad)('A debit line cannot be matched to a customer receipt or demand', 409);
    if (receiptId) {
        const r = (await c.query(`SELECT r.status, pp.project_id FROM receipts r LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE r.id = $1`, [receiptId])).rows[0];
        if (!r)
            throw (0, input_js_1.bad)('Receipt not found', 404);
        if (r.project_id !== t.project_id)
            throw (0, input_js_1.bad)('This receipt belongs to another project than the bank statement', 409);
        if (['cancelled', 'bounced'].includes(r.status))
            throw (0, input_js_1.bad)(`A ${r.status} receipt cannot be matched`, 409);
        if ((await c.query(`SELECT 1 FROM bank_transactions WHERE matched_receipt_id = $1 AND id <> $2`, [receiptId, t.id])).rows.length)
            throw (0, input_js_1.bad)('That receipt is already matched to another bank line', 409);
    }
    if (demandId) {
        const d = (await c.query(`SELECT d.status, pp.project_id FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id WHERE d.id = $1`, [demandId])).rows[0];
        if (!d)
            throw (0, input_js_1.bad)('Demand not found', 404);
        if (d.project_id !== t.project_id)
            throw (0, input_js_1.bad)('This demand belongs to another project than the bank statement', 409);
        if (d.status === 'cancelled')
            throw (0, input_js_1.bad)('A cancelled demand cannot be matched', 409);
    }
    return { sql: `matched_receipt_id = $1, matched_demand_id = $2, match_status = 'manually_matched', match_confidence = NULL, notes = COALESCE($3, notes)`, values: [receiptId, demandId, notes] };
}));
// PATCH /api/reconciliation/transactions/:id/ignore - not a customer payment (charges, interest, own transfers); links are dropped
router.patch('/transactions/:id/ignore', (req, res, next) => change(req, res, next, 'ignore', async (_c, _t, b) => ({
    sql: `matched_receipt_id = NULL, matched_demand_id = NULL, match_status = 'ignored', match_confidence = NULL, notes = COALESCE($1, notes)`, values: [(0, input_js_1.text)(b.notes, 'notes', 500, false)]
})));
// PATCH /api/reconciliation/transactions/:id/unmatch - back to unmatched (undo a match or an ignore)
router.patch('/transactions/:id/unmatch', (req, res, next) => change(req, res, next, 'unmatch', async (_c, t) => {
    if (t.match_status === 'unmatched')
        throw (0, input_js_1.bad)('This line is already unmatched', 409);
    return { sql: `matched_receipt_id = NULL, matched_demand_id = NULL, match_status = 'unmatched', match_confidence = NULL`, values: [] };
}));
exports.default = router;
//# sourceMappingURL=reconciliation.js.map