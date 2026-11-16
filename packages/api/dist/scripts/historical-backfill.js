"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BACKFILL_REASON = void 0;
exports.snapshotsTask = snapshotsTask;
exports.allocationsTask = allocationsTask;
/**
 * Historical backfill (Phase 7): repairs for records made before migration 152. Two tasks, both dry runs unless --apply is given.
 *
 *   node dist/scripts/historical-backfill.js snapshots   [--apply --approved-by "Name"] [--project UUID] [--out DIR]
 *   node dist/scripts/historical-backfill.js allocations [--apply --approved-by "Name"] [--project UUID] [--out DIR]
 * --project limits the run to one project (a pilot before the rest).
 *
 * snapshots    one booking_agreement version for each live booking that has none, ONLY where the server quote equals what the payment plan bills (within Rs 1, BR-07).
 *              A booking with no rate, no carpet area, no plan, or a quote that differs from its plan is an exception for finance and is never written.
 *              Money is not touched: booking_records.total_price_inr and every demand, receipt and plan amount stay as they are.
 * allocations  receipt_allocation rows for every plan with cleared money, written the way the live code writes them (writeAllocations). Refused while the allocation
 *              and the status rules disagree on any demand (the shadow report), so finance sees every mismatch first.
 *
 * Always writes a review CSV to --out (default ./historical-out) whether or not --apply is given. Connects with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 * Undo: docs/remediation/historical/05-snapshot-ROLLBACK.sql and 04-allocation-ROLLBACK.sql. Never run against production without the owner's written approval.
 */
const pg_1 = require("pg");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const agreement_snapshot_js_1 = require("../utils/agreement-snapshot.js");
const receipt_allocation_shadow_js_1 = require("../utils/receipt-allocation-shadow.js");
const receipt_allocation_js_1 = require("../utils/receipt-allocation.js");
const money_basis_js_1 = require("../utils/money-basis.js");
exports.BACKFILL_REASON = 'historical backfill (Phase 7)';
const TOLERANCE = 1; // BR-07: Rs 1
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (name) => process.argv.includes(name);
const csv = (rows) => {
    if (!rows.length)
        return '';
    const cols = Object.keys(rows[0]);
    const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
};
async function snapshotsTask(db, apply, projectId = null) {
    const bs = (await db.query(`SELECT br.*, u.carpet_area_sqft AS u_carpet, u.balcony_area_sqft AS u_balcony, u.super_area_sqft AS u_super, pp.total_amount_inr AS plan_total
       FROM booking_records br JOIN units u ON u.id = br.unit_id
       LEFT JOIN allocations a ON a.consumer_id = br.consumer_id AND a.unit_id = br.unit_id AND a.status NOT IN ('cancelled','transferred')
       LEFT JOIN payment_plans pp ON pp.allocation_id = a.id
      WHERE br.status IN ('pending_payment','active','complete')
        AND NOT EXISTS (SELECT 1 FROM booking_agreement ba WHERE ba.booking_id = br.id AND ba.is_current)
        AND ($1::uuid IS NULL OR br.project_id = $1::uuid)
      ORDER BY br.created_at`, [projectId])).rows;
    const review = [];
    for (const b of bs) {
        const row = { booking_id: b.id, registration_no: b.registration_no, status: b.status, booking_rate: Number(b.basic_rate_inr_sqft) || 0, plan_total_inr: b.plan_total == null ? null : Number(b.plan_total), quote_value_inr: null, difference_inr: null, verdict: '', note: '' };
        let q = null;
        try {
            q = await (0, agreement_snapshot_js_1.quoteBookingRow)(db, b, { carpet_area_sqft: b.u_carpet, balcony_area_sqft: b.u_balcony });
        }
        catch (e) {
            row.verdict = 'exception';
            row.note = `quote failed: ${e.message}`;
            review.push(row);
            continue;
        }
        if (!q) {
            row.verdict = 'exception';
            row.note = 'no rate or no carpet area on the booking: the schedule uses the unit master price, a snapshot must not copy it silently';
            review.push(row);
            continue;
        }
        row.quote_value_inr = q.agreement_value_inr;
        if (b.plan_total == null) {
            row.verdict = 'exception';
            row.note = 'no payment plan to compare with';
            review.push(row);
            continue;
        }
        row.difference_inr = Math.round((q.agreement_value_inr - Number(b.plan_total)) * 100) / 100;
        if (Math.abs(row.difference_inr) > TOLERANCE) {
            row.verdict = 'exception';
            row.note = 'the server quote differs from what the plan bills: finance decides which is right';
            review.push(row);
            continue;
        }
        row.verdict = apply ? 'written' : 'would_write';
        review.push(row);
        if (apply) {
            await db.query(`INSERT INTO booking_agreement (booking_id, version, is_current, rate_inr_sqft, carpet_area_sqft, super_area_sqft, balcony_area_sqft, basic_inr, balcony_inr, plc_inr, other_charge_inr, discount_inr, agreement_value_inr, tax_lines, reason, created_by)
         VALUES ($1, 1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, NULL)`, [b.id, b.basic_rate_inr_sqft, b.u_carpet, b.u_super ?? null, b.u_balcony ?? null, q.basic_inr, q.balcony_inr, q.plc_inr, q.other_charge_inr, q.discount_inr, q.agreement_value_inr, JSON.stringify(q.tax_lines), exports.BACKFILL_REASON]);
        }
    }
    return review;
}
async function allocationsTask(db, apply, projectId = null) {
    const shadow = await (0, receipt_allocation_shadow_js_1.allocationShadow)(db, projectId);
    const summary = [{ plans_checked: shadow.plans_checked, demands_checked: shadow.demands_checked, rows_planned: shadow.rows_planned, receipts_over_allocated: shadow.receipts_over_allocated, mismatch_count: shadow.mismatch_count, applied: false, rows_written: 0 }];
    if (apply && (shadow.mismatch_count > 0 || shadow.receipts_over_allocated > 0))
        return { summary, mismatches: shadow.mismatches, refused: 'the allocation and the status rules disagree: finance reviews the mismatches first' };
    if (apply) {
        const plans = (await db.query(`SELECT DISTINCT r.payment_plan_id FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE r.status = 'cleared' AND r.is_advance IS NOT TRUE AND ($1::uuid IS NULL OR pp.project_id = $1::uuid)`, [projectId])).rows;
        let rows = 0;
        for (const { payment_plan_id: planId } of plans) {
            const ds = (await db.query(`SELECT ${money_basis_js_1.DEMAND_COLS} FROM demands WHERE payment_plan_id = $1`, [planId])).rows;
            if (ds.length)
                rows += await (0, receipt_allocation_js_1.writeAllocations)(db, planId, ds);
        }
        summary[0].applied = true;
        summary[0].rows_written = rows;
    }
    return { summary, mismatches: shadow.mismatches, refused: null };
}
async function main() {
    const task = process.argv[2], apply = has('--apply'), out = arg('--out') || './historical-out';
    if (!['snapshots', 'allocations'].includes(task)) {
        console.error('usage: historical-backfill.js snapshots|allocations [--apply --approved-by "Name"] [--out DIR]');
        process.exit(2);
    }
    const approvedBy = arg('--approved-by'), projectId = arg('--project') || null;
    if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
        console.error('--project must be a project id (uuid)');
        process.exit(2);
    }
    if (apply && !approvedBy) {
        console.error('--apply needs --approved-by "Name": who approved this run');
        process.exit(2);
    }
    const pool = new pg_1.Pool({ host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    fs_1.default.mkdirSync(out, { recursive: true });
    const client = await pool.connect();
    try {
        console.log(`database ${process.env.DB_NAME} on ${process.env.DB_HOST}; task ${task}; ${apply ? `APPLY, approved by ${approvedBy}` : 'dry run, nothing is written'}${projectId ? `; project ${projectId} only` : ''}`);
        await client.query('BEGIN');
        if (task === 'snapshots') {
            const review = await snapshotsTask(client, apply, projectId);
            fs_1.default.writeFileSync(path_1.default.join(out, 'agreement-snapshot-review.csv'), csv(review));
            const n = (v) => review.filter((r) => r.verdict === v).length;
            console.log(`bookings without a snapshot: ${review.length}; ${apply ? 'written' : 'would write'}: ${n(apply ? 'written' : 'would_write')}; exceptions: ${n('exception')}`);
        }
        else {
            const r = await allocationsTask(client, apply, projectId);
            fs_1.default.writeFileSync(path_1.default.join(out, 'receipt-allocation-summary.csv'), csv(r.summary));
            fs_1.default.writeFileSync(path_1.default.join(out, 'receipt-allocation-mismatches.csv'), csv(r.mismatches));
            console.log(JSON.stringify(r.summary[0]));
            if (r.refused) {
                console.error(`REFUSED: ${r.refused}`);
                await client.query('ROLLBACK');
                process.exit(3);
            }
        }
        await client.query(apply ? 'COMMIT' : 'ROLLBACK');
        console.log(`review files are in ${path_1.default.resolve(out)}`);
    }
    catch (e) {
        await client.query('ROLLBACK').catch(() => { });
        throw e;
    }
    finally {
        client.release();
        await pool.end();
    }
}
// run only when started from the command line, so the tests can import the tasks
if (process.argv[1] && /historical-backfill\.(js|ts)$/.test(process.argv[1]))
    main().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=historical-backfill.js.map