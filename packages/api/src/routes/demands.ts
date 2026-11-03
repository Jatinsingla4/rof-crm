/**
 * Demand routes (mounted at /api/payments): create the demand rows of a payment plan, raise / unraise them,
 * mark them sent, and the list / stage / status views. Every id and filter is checked before it reaches SQL.
 */
import { Router, Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';
import { applyWaterfall, WaterfallReceipt, WaterfallDemand } from '../utils/payment-waterfall.js';
import { resolveGstForComponents } from '../utils/gst-resolver.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { bad, failWith, uuid, has, text, day, body, inTx } from '../utils/input.js';
import { likeOf } from '../utils/applicant.js';

const router = Router();

const STATUSES = ['pending', 'demanded', 'paid', 'cancelled', 'raised'];
const MAX_RAISE = 2000;

const fail = (err: any, res: Response, next: NextFunction) => failWith(err, res, next, 'A demand for this instalment already exists');

// Integer query value inside [min, max], or the default when the value is absent
const int = (v: any, label: string, min: number, max: number, dflt?: number): number | undefined => {
  if (!has(v)) return dflt;
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} is not valid`);
  const n = Number(v);
  if (!/^-?\d+$/.test(String(v)) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
const query = (v: any, label: string, max = 100): string | null => (Array.isArray(v) ? (() => { throw bad(`${label} is not valid`); })() : text(v, label, max, false));
const statusOf = (v: any, label: string): string | null => {
  const s = query(v, label, 20);
  if (s && s !== 'all' && !STATUSES.includes(s)) throw bad(`${label} must be one of ${STATUSES.join(', ')}`);
  return s && s !== 'all' ? s : null;
};

// POST /demands/generate - create the pending demand rows from the instalment template of each payment plan
router.post('/demands/generate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const consumerId = has(b.consumerId) ? uuid(b.consumerId, 'consumerId') : null;
    const projectId = has(b.projectId) ? uuid(b.projectId, 'projectId') : null;
    const planName = text(b.planName, 'planName', 100, false);
    if (!consumerId && !projectId) throw bad('consumerId or projectId is required');

    const out = await inTx(async (c) => {
      // One booking per plan (the newest one that is not cancelled); a plan whose bookings are all cancelled gets no demands
      const plans = await c.query(
        `SELECT pp.id AS payment_plan_id, pp.consumer_id, pp.unit_id, pp.project_id, pp.total_amount_inr,
                co.name AS consumer_name, COALESCE(co.nationality, 'indian') AS nationality,
                br.booking_date, br.plc_amount, br.other_charge_amount, br.balcony_charge_amount, br.selected_plan_name
           FROM payment_plans pp
           JOIN consumers co ON co.id = pp.consumer_id
           LEFT JOIN LATERAL (SELECT * FROM booking_records b2
                               WHERE b2.consumer_id = pp.consumer_id AND b2.unit_id = pp.unit_id AND b2.status <> 'cancelled'
                               ORDER BY b2.created_at DESC LIMIT 1) br ON TRUE
          WHERE ($1::uuid IS NULL OR pp.consumer_id = $1) AND ($2::uuid IS NULL OR pp.project_id = $2)
            AND (br.id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM booking_records x WHERE x.consumer_id = pp.consumer_id AND x.unit_id = pp.unit_id))
          ORDER BY pp.id`,
        [consumerId, projectId]
      );
      if (!plans.rows.length) throw bad('No payment plans found for the given criteria', 404);

      const created: any[] = [];
      const skipped: { consumer_id: string; reason: string }[] = [];
      for (const plan of plans.rows) {
        // Two people generating at the same moment must not both insert the same instalment
        await c.query(`SELECT pg_advisory_xact_lock(hashtext('demand-gen:' || $1))`, [plan.payment_plan_id]);
        let name = planName || plan.selected_plan_name;
        if (!name) {
          const first = await c.query(`SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name LIMIT 1`, [plan.project_id]);
          name = first.rows[0]?.plan_name;
        }
        if (!name) { skipped.push({ consumer_id: plan.consumer_id, reason: 'The project has no payment plan template' }); continue; }
        const templates = await c.query(
          `SELECT installment_index, installment_name, percentage, installment_type, COALESCE(due_date_offset_days, 30) AS due_date_offset_days
             FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 ORDER BY installment_index`,
          [plan.project_id, name]
        );
        if (!templates.rows.length) { skipped.push({ consumer_id: plan.consumer_id, reason: `Payment plan "${name}" has no instalments` }); continue; }

        const projectName = (await c.query('SELECT name FROM projects WHERE id = $1', [plan.project_id])).rows[0]?.name || plan.project_id;
        const total = Number(plan.total_amount_inr);
        const plc = Number(plan.plc_amount || 0), other = Number(plan.other_charge_amount || 0), balcony = Number(plan.balcony_charge_amount || 0);
        const basic = total - plc - other - balcony;
        const bookingDate = plan.booking_date ? new Date(plan.booking_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const isNri = String(plan.nationality).toLowerCase() === 'nri';

        for (const t of templates.rows) {
          const exists = await c.query(`SELECT 1 FROM demands WHERE payment_plan_id = $1 AND installment_index = $2`, [plan.payment_plan_id, t.installment_index]);
          if (exists.rows.length) continue;
          const pct = Number(t.percentage) / 100;
          const { cgstAmount, sgstAmount } = await resolveGstForComponents(c, plan.project_id, projectName, bookingDate, isNri, [
            { chargeType: 'BASIC', amount: Math.round(basic * pct) },
            { chargeType: 'PLC', amount: Math.round(plc * pct) },
            { chargeType: 'OTHER CHARGE', amount: Math.round(other * pct) },
            { chargeType: 'BALCONY', amount: Math.round(balcony * pct) },
          ]);
          const offset = Number(t.due_date_offset_days) || 0;
          const dueDate = offset > 0 ? new Date(new Date(bookingDate).getTime() + offset * 86400000).toISOString().slice(0, 10) : null;
          const ins = await c.query(
            `INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount,
                                  status, demand_type, delivery_status, generated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, 'pending', NOW())
             RETURNING id, installment_index, amount_due_inr, cgst_amount, sgst_amount, status`,
            [plan.payment_plan_id, t.installment_index, plan.consumer_id, dueDate, Math.round(total * pct), cgstAmount, sgstAmount, t.installment_type || t.installment_name]
          );
          created.push({ ...ins.rows[0], consumer_name: plan.consumer_name });
          await auditChange(c, req, res, 'create', 'demand', ins.rows[0].id, undefined, { payment_plan_id: plan.payment_plan_id, installment_index: t.installment_index, amount_due_inr: Math.round(total * pct) });
        }
      }
      return { totalCreated: created.length, demands: created, skipped };
    });
    res.json({ success: true, data: out });
  } catch (err) { fail(err, res, next); }
});

// GET /demands/by-stage - stage x tower counts for the Stage Wise grid
router.get('/demands/by-stage', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!has(req.query.projectId)) throw bad('projectId is required');
    const projectId = uuid(req.query.projectId, 'projectId');

    const result = await db.query(`
      SELECT d.installment_index,
             COALESCE((SELECT pst.installment_name FROM plan_schedule_templates pst
                        WHERE pst.project_id = $1 AND pst.installment_index = d.installment_index
                        ORDER BY pst.plan_name LIMIT 1), 'Stage ' || d.installment_index) AS installment_name,
             t.id AS tower_id, t.tower_name,
             COUNT(DISTINCT d.consumer_id)                                      AS total_consumers,
             COUNT(DISTINCT d.consumer_id) FILTER (WHERE d.status = 'pending')  AS pending_count,
             COUNT(DISTINCT d.consumer_id) FILTER (WHERE d.status = 'demanded') AS raised_count,
             MIN(d.due_date)     FILTER (WHERE d.status = 'demanded')           AS installment_date,
             MIN(d.generated_at) FILTER (WHERE d.status = 'demanded')           AS raised_at,
             ARRAY_AGG(DISTINCT d.id) FILTER (WHERE d.status = 'pending')       AS pending_demand_ids,
             ARRAY_AGG(DISTINCT d.id) FILTER (WHERE d.status = 'demanded')      AS raised_demand_ids
        FROM demands d
        JOIN payment_plans pp ON pp.id = d.payment_plan_id
        JOIN units u  ON u.id = pp.unit_id
        JOIN towers t ON t.id = u.tower_id
       WHERE u.project_id = $1 AND d.status <> 'cancelled'
       GROUP BY d.installment_index, t.id, t.tower_name
       ORDER BY d.installment_index ASC, t.tower_name ASC`, [projectId]);

    const stageMap: Record<number, { installment_index: number; installment_name: string; towers: any[] }> = {};
    for (const row of result.rows) {
      const idx = row.installment_index;
      stageMap[idx] ??= { installment_index: idx, installment_name: row.installment_name, towers: [] };
      stageMap[idx].towers.push({
        tower_id: row.tower_id, tower_name: row.tower_name,
        total_consumers: parseInt(row.total_consumers), pending_count: parseInt(row.pending_count), raised_count: parseInt(row.raised_count),
        installment_date: row.installment_date ? new Date(row.installment_date).toISOString().split('T')[0] : null,
        raised_at: row.raised_at || null,
        pending_demand_ids: row.pending_demand_ids || [], raised_demand_ids: row.raised_demand_ids || [],
      });
    }
    res.json({ success: true, stages: Object.values(stageMap).sort((a, b) => a.installment_index - b.installment_index) });
  } catch (err) { fail(err, res, next); }
});

// GET /demands - list with filters (customer, instalment, tower, unit, stage grids)
router.get('/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [];
    const add = (v: any) => `$${params.push(v)}`;
    let where = '';

    if (has(q.consumerId)) {
      const id = add(uuid(q.consumerId, 'consumerId'));
      where += ` AND d.consumer_id = ${id} AND d.payment_plan_id = (
        SELECT pp2.id FROM payment_plans pp2
         WHERE pp2.consumer_id = ${id}
           AND pp2.unit_id = (SELECT b2.unit_id FROM booking_records b2 WHERE b2.consumer_id = ${id} AND b2.status IN ('complete','pending_payment','active') ORDER BY b2.created_at DESC LIMIT 1)
         ORDER BY pp2.created_at DESC LIMIT 1)`;
    }
    // A project may be given by id or by name
    const project = query(q.projectId, 'projectId');
    if (project) where += /^[0-9a-f-]{36}$/i.test(project) ? ` AND p.id = ${add(uuid(project, 'projectId'))}` : ` AND p.name ILIKE ${add(likeOf(project))}`;
    const type = query(q.installmentType, 'installmentType');
    if (type) where += ` AND d.demand_type ILIKE ${add(likeOf(type))}`;
    const index = int(q.installmentIndex, 'installmentIndex', 0, 500);
    if (index !== undefined) where += ` AND d.installment_index = ${add(index)}`;
    const tower = query(q.tower ?? q.towerId, 'tower');
    if (tower) where += /^[0-9a-f-]{36}$/i.test(tower) ? ` AND u.tower_id = ${add(uuid(tower, 'tower'))}` : ` AND tw.tower_name ILIKE ${add(likeOf(tower))}`;
    const floor = int(q.floor, 'floor', -10, 500);
    if (floor !== undefined) where += ` AND u.floor = ${add(floor)}`;
    const reg = query(q.registrationNo, 'registrationNo');
    if (reg) where += ` AND br.registration_no ILIKE ${add(likeOf(reg))}`;
    const name = query(q.name, 'name');
    if (name) where += ` AND c.name ILIKE ${add(likeOf(name))}`;
    const unit = query(q.unitAddress, 'unitAddress');
    if (unit) where += ` AND lower(u.unit_number) = lower(${add(unit)})`;
    const status = statusOf(q.status, 'status');
    if (status) {
      where += q.scope === 'customer' && status === 'pending'
        ? ` AND (d.status = ${add(status)} OR (d.status = 'paid' AND d.raised_at IS NULL))`
        : ` AND d.status = ${add(status)}`;
    }
    const from = day(q.from ?? q.dateFrom, 'from');
    if (from) where += ` AND d.due_date >= ${add(from)}`;
    const to = day(q.to ?? q.dateTo, 'to');
    if (to) where += ` AND d.due_date <= ${add(to)}`;
    const rFrom = day(q.raisedFrom, 'raisedFrom');
    if (rFrom) where += ` AND d.generated_at >= ${add(rFrom)}::date`;
    const rTo = day(q.raisedTo, 'raisedTo');
    if (rTo) where += ` AND d.generated_at < ${add(rTo)}::date + 1`;
    if (from && to && from > to) throw bad('from must not be after to');

    const pageSize = int(q.pageSize, 'pageSize', 1, 1000, 50)!;
    const page = int(q.page, 'page', 1, 100000, 1)!;

    const result = await db.query(
      `SELECT d.id, d.installment_index, d.consumer_id, d.amount_due_inr, d.cgst_amount, d.sgst_amount,
              d.addon_charge_amount, d.addon_cgst_amount, d.addon_sgst_amount,
              d.due_date, d.status, d.demand_type, d.delivery_status, d.sent_at, d.generated_at,
              c.name AS consumer_name, c.mobile, br.registration_no, pp.unit_id,
              u.unit_number AS unit_address, u.bhk_type AS unit_type, u.floor, tw.tower_name, p.name AS project_name,
              COALESCE(pst.installment_name, 'Instalment ' || d.installment_index::text) AS installment_name,
              (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = c.id AND status != 'cancelled') AS total_paid
         FROM demands d
         JOIN consumers c ON d.consumer_id = c.id
         JOIN payment_plans pp ON pp.id = d.payment_plan_id
         JOIN units u ON u.id = pp.unit_id
         JOIN projects p ON u.project_id = p.id
         LEFT JOIN towers tw ON u.tower_id = tw.id
         LEFT JOIN booking_records br ON br.consumer_id = c.id AND br.unit_id = pp.unit_id
         LEFT JOIN plan_schedule_templates pst
           ON pst.project_id = u.project_id AND pst.installment_index = d.installment_index AND pst.plan_name = br.selected_plan_name
        WHERE TRUE ${where}
        ORDER BY d.installment_index ASC, d.due_date ASC, d.id ASC
        LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`,
      params
    );
    const rows = result.rows;

    // total_paid per instalment is each instalment's clamped share of the receipts (waterfall), not a consumer-wide sum
    const pairs = new Map<string, { consumerId: string; unitId: string }>();
    for (const r of rows) pairs.set(`${r.consumer_id}:${r.unit_id}`, { consumerId: r.consumer_id, unitId: r.unit_id });
    const paid = new Map<string, Map<number, number>>();
    await Promise.all([...pairs.entries()].map(async ([key, { consumerId, unitId }]) => {
      const plan = `(SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2 ORDER BY created_at DESC LIMIT 1)`;
      const [rc, dm] = await Promise.all([
        db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at FROM receipts
                   WHERE consumer_id = $1 AND status = 'cleared' AND payment_plan_id = ${plan} ORDER BY received_date ASC, created_at ASC`, [consumerId, unitId]),
        db.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount
                    FROM demands WHERE consumer_id = $1 AND payment_plan_id = ${plan}`, [consumerId, unitId]),
      ]);
      paid.set(key, new Map(applyWaterfall(rc.rows as WaterfallReceipt[], dm.rows as WaterfallDemand[]).map((w) => [w.installment_index, w.paid])));
    }));

    const data = rows.map((r) => {
      const byIndex = paid.get(`${r.consumer_id}:${r.unit_id}`);
      const totalPaid = byIndex ? byIndex.get(Number(r.installment_index)) || 0 : parseFloat(r.total_paid);
      const netDue = parseFloat(r.amount_due_inr) + parseFloat(r.cgst_amount || 0) + parseFloat(r.sgst_amount || 0)
        + parseFloat(r.addon_charge_amount || 0) + parseFloat(r.addon_cgst_amount || 0) + parseFloat(r.addon_sgst_amount || 0);
      return { ...r, total_paid: totalPaid, balance: netDue - totalPaid };
    });
    res.json({ success: true, data });
  } catch (err) { fail(err, res, next); }
});

// PATCH /demands/activate - raise pending demands. A demand whose earlier instalment is still pending (or that is not pending) is skipped, the rest are raised.
router.patch('/demands/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!Array.isArray(b.demandIds) || !b.demandIds.length) throw bad('demandIds (a list of demand ids) is required');
    if (b.demandIds.length > MAX_RAISE) throw bad(`At most ${MAX_RAISE} demands can be raised at once`);
    const ids = [...new Set<string>(b.demandIds.map((x: any, i: number) => uuid(x, `demandIds[${i}]`)))];
    const due = day(b.installmentDate, 'installmentDate');
    if (!due) throw bad('installmentDate (the due date) is required');
    // One day of grace for the clock difference between the browser and the server
    if ((await db.query(`SELECT $1::date < CURRENT_DATE - 1 AS past`, [due])).rows[0].past) throw bad('The due date cannot be in the past');

    const out = await inTx(async (c) => {
      // Oldest instalment first, so a batch holding stage 1 and stage 2 raises both whatever order the ids arrive in
      const found = await c.query(
        `SELECT id, installment_index, consumer_id, payment_plan_id, status FROM demands WHERE id = ANY($1::uuid[]) ORDER BY payment_plan_id, installment_index FOR UPDATE`,
        [ids]
      );
      const byId = new Map<string, any>(found.rows.map((r: any) => [r.id, r]));
      const raised: string[] = [];
      const skippedIds: { id: string; reason: string }[] = ids.filter((id) => !byId.has(id)).map((id) => ({ id, reason: 'Demand not found' }));

      for (const d of found.rows) {
        if (d.status === 'demanded' || d.status === 'raised') { skippedIds.push({ id: d.id, reason: 'Already raised' }); continue; }
        if (d.status === 'paid') { skippedIds.push({ id: d.id, reason: 'Already paid' }); continue; }
        if (d.status !== 'pending') { skippedIds.push({ id: d.id, reason: `Demand is ${d.status}` }); continue; }
        if (d.installment_index > 0) {
          const prior = await c.query(
            `SELECT 1 FROM demands WHERE payment_plan_id = $1 AND installment_index < $2 AND status = 'pending' LIMIT 1`,
            [d.payment_plan_id, d.installment_index]
          );
          if (prior.rows.length) { skippedIds.push({ id: d.id, reason: `Installment ${d.installment_index}: prior stage(s) not yet raised` }); continue; }
        }
        await c.query(
          `UPDATE demands SET status = 'demanded', due_date = $1, generated_at = NOW(), raised_at = NOW(), raised_by = $3, delivery_status = 'queued' WHERE id = $2`,
          [due, d.id, req.userId || null]
        );
        await auditChange(c, req, res, 'update', 'demand', d.id, { status: 'pending' },
          { status: 'demanded', action: 'DEMAND_RAISE', due_date: due, consumer_id: d.consumer_id, installment_index: d.installment_index });
        raised.push(d.id);

        // Receipts recorded before the demand existed (instalment set, demand empty) now belong to it
        const retro = await c.query(
          `UPDATE receipts SET demand_id = $1, updated_at = NOW()
            WHERE consumer_id = $2 AND installment_index = $3 AND demand_id IS NULL AND status != 'cancelled'
              AND (payment_plan_id IS NULL OR payment_plan_id = $4)
          RETURNING amount_received_inr`,
          [d.id, d.consumer_id, d.installment_index, d.payment_plan_id]
        );
        if (retro.rows.length) {
          const sum = retro.rows.reduce((s: number, r: any) => s + parseFloat(r.amount_received_inr), 0);
          await c.query(
            `INSERT INTO financial_audit_logs (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [d.consumer_id, d.payment_plan_id, req.userId || null, 'receipts_retroactively_linked', JSON.stringify({ demand_id: null }), JSON.stringify({ demand_id: d.id }),
             `${retro.rows.length} receipt(s) totalling ₹${sum} retroactively linked to demand ${d.id} (installment_index=${d.installment_index})`]
          );
        }

        // Advance / booking receipts that already cover the whole demand mark it paid
        const [rc, dm] = await Promise.all([
          c.query(`SELECT id, amount_received_inr, demand_id, installment_index, status FROM receipts
                    WHERE consumer_id = $1 AND status != 'cancelled' AND (payment_plan_id IS NULL OR payment_plan_id = $2)`, [d.consumer_id, d.payment_plan_id]),
          c.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount
                     FROM demands WHERE payment_plan_id = $1 AND status <> 'cancelled'`, [d.payment_plan_id]),
        ]);
        const w = applyWaterfall(rc.rows as WaterfallReceipt[], dm.rows as WaterfallDemand[]).find((x) => x.demand_id === d.id);
        if (w?.fully_covered) {
          await c.query(`UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`, [d.id]);
          await c.query(
            `INSERT INTO financial_audit_logs (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks) VALUES ($1, $2, $3, 'demand_auto_paid', $4, $5, $6)`,
            [d.consumer_id, d.payment_plan_id, req.userId || null, '{"status":"demanded","delivery_status":"queued"}', '{"status":"paid","delivery_status":"paid"}',
             'Auto-marked paid: fully covered by advance/booking receipts via waterfall allocation']
          );
        }
      }
      return { raised: raised.length, skipped: skippedIds.length, skippedIds, activatedCount: raised.length };
    });
    res.json({ success: true, ...out });
  } catch (err) { fail(err, res, next); }
});

// Puts raised demands back to pending (the letter is withdrawn). Anything that is not raised is reported as failed.
const unraise = async (req: AuthRequest, res: Response, ids: string[], reason: string | null) =>
  inTx(async (c) => {
    const rows = await c.query(
      `SELECT id, status, due_date FROM demands WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [ids]
    );
    const failed: { id: string; reason: string }[] = ids.filter((id) => !rows.rows.some((r: any) => r.id === id)).map((id) => ({ id, reason: 'Demand not found' }));
    let cancelled = 0;
    for (const d of rows.rows) {
      if (d.status !== 'demanded' && d.status !== 'raised') { failed.push({ id: d.id, reason: `Only raised demands can be cancelled, this one is ${d.status}` }); continue; }
      await c.query(
        `UPDATE demands SET status = 'pending', delivery_status = 'pending', raised_at = NULL, raised_by = NULL, due_date = NULL, sent_at = NULL, updated_at = NOW() WHERE id = $1`, [d.id]
      );
      await auditChange(c, req, res, 'update', 'demand', d.id, { status: d.status, due_date: d.due_date }, { status: 'pending', action: 'DEMAND_UNRAISE', reason });
      cancelled++;
    }
    return { cancelled, failed };
  });

// PATCH /demands/bulk-cancel - unraise many
router.patch('/demands/bulk-cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!Array.isArray(b.demandIds) || !b.demandIds.length) throw bad('demandIds (a non-empty list) is required');
    if (b.demandIds.length > MAX_RAISE) throw bad(`At most ${MAX_RAISE} demands can be cancelled at once`);
    const ids = [...new Set<string>(b.demandIds.map((x: any, i: number) => uuid(x, `demandIds[${i}]`)))];
    const out = await unraise(req, res, ids, text(b.reason, 'reason', 200, false));
    res.json({ success: true, cancelled: out.cancelled, failed: out.failed.length, failedIds: out.failed.map((f) => f.id), failures: out.failed });
  } catch (err) { fail(err, res, next); }
});

// PATCH /demands/:id/send - note that the demand letter has been sent
router.patch('/demands/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Demand id');
    const b = body(req);
    const via = text(b.sentVia ?? b.channel, 'sentVia', 50, false);
    const cur = await db.query(`SELECT status FROM demands WHERE id = $1`, [id]);
    if (!cur.rows.length) throw bad('Demand not found', 404);
    if (cur.rows[0].status !== 'demanded' && cur.rows[0].status !== 'raised') throw bad(`Only a raised demand can be sent, this one is ${cur.rows[0].status}`, 409);
    const r = await db.query(
      `UPDATE demands SET delivery_status = 'sent', sent_at = NOW(), sent_via = COALESCE($1, sent_via) WHERE id = $2 AND status IN ('demanded','raised')
       RETURNING id, delivery_status, sent_at, sent_via`,
      [via, id]
    );
    if (!r.rows.length) throw bad('The demand changed while sending, try again', 409);
    await auditChange(db, req, res, 'update', 'demand', id, { delivery_status: 'queued' }, { delivery_status: 'sent', sent_via: r.rows[0].sent_via });
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { fail(err, res, next); }
});

// PATCH /demands/:id/cancel - unraise one
router.patch('/demands/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Demand id');
    const reason = text(body(req).reason, 'reason', 200, false);
    const exists = await db.query(`SELECT 1 FROM demands WHERE id = $1`, [id]);
    if (!exists.rows.length) throw bad('Demand not found', 404);
    const out = await unraise(req, res, [id], reason);
    if (out.failed.length) throw bad(`Cannot cancel this demand. ${out.failed[0].reason}`, 400);
    const d = (await db.query(`SELECT id, status, delivery_status, due_date FROM demands WHERE id = $1`, [id])).rows[0];
    res.json({ success: true, data: { ...d, cancel_reason: reason }, message: 'Demand cancelled and reset to pending' });
  } catch (err) { fail(err, res, next); }
});

// GET /demand-status - one row per customer with demand totals
router.get('/demand-status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [];
    const add = (v: any) => `$${params.push(v)}`;
    let where = 'WHERE TRUE';
    if (has(q.project_id)) where += ` AND p.id = ${add(uuid(q.project_id, 'project_id'))}`;
    const tower = query(q.tower, 'tower');   if (tower) where += ` AND t.tower_name ILIKE ${add(likeOf(tower))}`;
    const floor = int(q.floor, 'floor', -10, 500); if (floor !== undefined) where += ` AND u.floor = ${add(floor)}`;
    const reg = query(q.reg_no, 'reg_no');   if (reg) where += ` AND c.registration_no ILIKE ${add(likeOf(reg))}`;
    const name = query(q.name, 'name');
    if (name) { const n = add(likeOf(name)); where += ` AND (c.name ILIKE ${n} OR c.first_name ILIKE ${n} OR c.last_name ILIKE ${n})`; }
    const city = query(q.city, 'city');      if (city) where += ` AND c.present_city ILIKE ${add(likeOf(city))}`;
    // Customers that have at least one demand inside the due-date range
    const from = day(q.due_date_from, 'due_date_from');
    if (from) where += ` AND EXISTS (SELECT 1 FROM demands dd WHERE dd.consumer_id = c.id AND dd.due_date >= ${add(from)}::date)`;
    const to = day(q.due_date_to, 'due_date_to');
    if (to) where += ` AND EXISTS (SELECT 1 FROM demands dd WHERE dd.consumer_id = c.id AND dd.due_date <= ${add(to)}::date)`;
    if (from && to && from > to) throw bad('due_date_from must not be after due_date_to');
    const delivery = query(q.delivery_status, 'delivery_status', 50); if (delivery) where += ` AND d.delivery_status = ${add(delivery)}`;
    const dStatus = statusOf(q.demand_status, 'demand_status'); if (dStatus) where += ` AND d.status = ${add(dStatus)}`;

    const limit = int(q.limit, 'limit', 1, 1000, 50)!;
    const page = int(q.page, 'page', 1, 100000, 1)!;
    // Only the demands of this booking's own payment plan, and never the cancelled ones
    const FROM = `
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = br.unit_id
      LEFT JOIN towers t ON t.id = u.tower_id
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN demands d ON d.consumer_id = c.id AND d.status <> 'cancelled'
        AND d.payment_plan_id IN (SELECT pp.id FROM payment_plans pp WHERE pp.consumer_id = c.id AND pp.unit_id = u.id)
      ${where}`;
    const dataParams = [...params];
    const data = await db.query(`
      SELECT c.id AS consumer_id, u.id AS unit_id, c.registration_no, c.name, c.mobile, c.present_city,
             br.booking_date, br.booking_amount, u.unit_number, t.tower_name, u.floor AS floor_number, u.bhk_type, p.name AS project_name,
             (SELECT fl.floor_name FROM floors fl WHERE fl.tower_id = u.tower_id AND fl.floor_number = u.floor) AS floor_name,
             COUNT(d.id)::int AS total_demands,
             COUNT(CASE WHEN d.status = 'paid' THEN 1 END)::int AS paid_demands,
             COUNT(CASE WHEN d.status = 'demanded' THEN 1 END)::int AS active_demands,
             COUNT(CASE WHEN d.status = 'pending' THEN 1 END)::int AS pending_demands,
             COALESCE(SUM(d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0)), 0)::bigint AS total_due,
             COALESCE(SUM(CASE WHEN d.status = 'paid' THEN d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0) ELSE 0 END), 0)::bigint AS total_paid,
             COALESCE(SUM(CASE WHEN d.status != 'paid' THEN d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0) ELSE 0 END), 0)::bigint AS outstanding,
             MAX(d.delivery_status) AS delivery_status
      ${FROM}
      GROUP BY c.id, u.id, c.registration_no, c.name, c.mobile, c.present_city, br.id, br.booking_date, br.booking_amount, u.unit_number, t.tower_name, u.tower_id, u.floor, u.bhk_type, p.name
      ORDER BY c.name ASC, c.id ASC
      LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`, [...dataParams, limit, (page - 1) * limit]);
    const count = await db.query(`SELECT COUNT(DISTINCT br.id) AS total ${FROM}`, params);

    // paid and balance as the money really lands: cleared receipts fill the instalments in order (an overpayment runs into the next one)
    await Promise.all(data.rows.map(async (r: any) => {
      const plan = `(SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2 ORDER BY created_at DESC LIMIT 1)`;
      const [rc, dm] = await Promise.all([
        db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at FROM receipts
                   WHERE consumer_id = $1 AND status = 'cleared' AND payment_plan_id = ${plan} ORDER BY received_date ASC, created_at ASC`, [r.consumer_id, r.unit_id]),
        db.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount
                    FROM demands WHERE consumer_id = $1 AND payment_plan_id = ${plan} AND status <> 'cancelled'`, [r.consumer_id, r.unit_id]),
      ]);
      const due = (dm.rows as any[]).reduce((t, d) => t + ['amount_due_inr', 'cgst_amount', 'sgst_amount', 'addon_charge_amount', 'addon_cgst_amount', 'addon_sgst_amount'].reduce((x, k) => x + Number(d[k] || 0), 0), 0);
      const paid = applyWaterfall(rc.rows as WaterfallReceipt[], dm.rows as WaterfallDemand[]).reduce((t, w) => t + w.paid, 0);
      r.paid_amount = Math.round(paid * 100) / 100;
      r.balance_amount = Math.max(0, Math.round((due - paid) * 100) / 100);
      r.unadjusted_credit = Math.max(0, Math.round(((rc.rows as any[]).reduce((t, x) => t + Number(x.amount_received_inr), 0) - paid) * 100) / 100);
    }));

    res.json({ success: true, data: data.rows, total: parseInt(count.rows[0]?.total || '0'), page, limit });
  } catch (err) { fail(err, res, next); }
});

// GET /:paymentPlanId/demands - the demands of one payment plan
router.get('/:paymentPlanId/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plan = uuid(req.params.paymentPlanId, 'Payment plan id');
    const r = await db.query(
      `SELECT id, installment_index, amount_due_inr, due_date, delivery_status FROM demands WHERE payment_plan_id = $1 ORDER BY installment_index ASC`, [plan]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) { fail(err, res, next); }
});

router.use(pgErrorHandler);

export default router;
