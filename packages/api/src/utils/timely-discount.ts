// Timely discount. A plan with "timely discount" on gives a discount % on every installment (a plan row of type "installment") that the customer pays IN FULL by its due date.
// The % is the plan's, or the customer's own when one was set (Customer Wise Timely Discount). The discount is on the installment's base amount (before GST).
// "Paid in full by the due date" is judged from the cleared receipts dated on or before the due date, with the same waterfall the rest of the CRM uses.
// An earned discount is raised as a credit note on that installment's invoice; if there is no invoice yet (or the note cannot be raised) it is kept as "waiting" and tried again on the next run.
import { applyWaterfall, WaterfallDemand, WaterfallReceipt } from './payment-waterfall.js';
import { raiseNote } from '../routes/financial-ops.js';

const r2 = (n: number) => Math.round(n * 100) / 100;

export type TimelyRun = { issued: number; waiting: number; checked: number; items: Array<{ consumer_id: string; installment: string; amount: number; status: string; note: string | null }> };

// pct that applies to one customer of one plan: his own if set, else the plan's (only a plan with timely discount on gives any)
export const effectivePct = (plan: { timely_discount: boolean; discount_pct: any }, own: any): number =>
  !plan.timely_discount ? 0 : own != null ? Number(own) : Number(plan.discount_pct);

export async function runTimelyDiscounts(db: any, req: any, projectId: string, consumerId?: string): Promise<TimelyRun> {
  const out: TimelyRun = { issued: 0, waiting: 0, checked: 0, items: [] };
  const custs = (await db.query(
    `SELECT DISTINCT ON (br.consumer_id) br.consumer_id, br.unit_id, br.selected_plan_name, h.timely_discount, h.discount_pct, ct.discount_pct AS own_pct
       FROM booking_records br
       JOIN plan_headers h ON h.project_id = br.project_id AND lower(h.plan_name) = lower(br.selected_plan_name)
       LEFT JOIN customer_timely_discount ct ON ct.consumer_id = br.consumer_id AND ct.project_id = br.project_id
      WHERE br.project_id = $1 AND COALESCE(br.status, '') NOT IN ('cancelled', 'canceled') AND ($2::uuid IS NULL OR br.consumer_id = $2)
      ORDER BY br.consumer_id, br.created_at DESC`, [projectId, consumerId ?? null])).rows;
  for (const cu of custs) {
    const pct = effectivePct(cu, cu.own_pct);
    if (!(pct > 0)) continue;
    const plan = (await db.query('SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2 ORDER BY created_at DESC LIMIT 1', [cu.consumer_id, cu.unit_id])).rows[0];
    if (!plan) continue;
    const demands = (await db.query(
      `SELECT d.id, d.installment_index, d.amount_due_inr, d.cgst_amount, d.sgst_amount, d.addon_charge_amount, d.addon_cgst_amount, d.addon_sgst_amount, d.due_date::text AS due_date,
              t.installment_name, t.installment_type
         FROM demands d LEFT JOIN plan_schedule_templates t ON t.project_id = $3 AND t.plan_name = $4 AND t.installment_index = d.installment_index
        WHERE d.consumer_id = $1 AND d.payment_plan_id = $2 AND d.status != 'cancelled' ORDER BY d.installment_index`, [cu.consumer_id, plan.id, projectId, cu.selected_plan_name])).rows;
    const receipts = (await db.query(
      `SELECT id, amount_received_inr, demand_id, installment_index, status, received_date::text AS received_date FROM receipts WHERE consumer_id = $1 AND status = 'cleared'`, [cu.consumer_id])).rows;
    const done = new Set((await db.query(`SELECT demand_id FROM timely_discount_awards WHERE consumer_id = $1 AND status = 'issued'`, [cu.consumer_id])).rows.map((x: any) => x.demand_id));
    for (const d of demands) {
      if (d.installment_type !== 'installment' || !d.due_date || done.has(d.id)) continue;
      out.checked++;
      const onTime = receipts.filter((x: any) => x.received_date && x.received_date <= d.due_date);
      const res = applyWaterfall(onTime as WaterfallReceipt[], demands as WaterfallDemand[]).find((w) => w.demand_id === d.id);
      if (!res?.fully_covered) continue;
      const base = Number(d.amount_due_inr), amount = r2(base * pct / 100);
      if (!(amount > 0)) continue;
      const paidOn = onTime.map((x: any) => x.received_date).sort().pop() as string;
      const inv = (await db.query(
        `SELECT id, cgst_rate, sgst_rate, igst_rate FROM gst_invoices WHERE consumer_id = $1 AND payment_plan_id = $2 AND installment_name = $3 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1`,
        [cu.consumer_id, plan.id, d.installment_name])).rows[0];
      let status = 'waiting', note: string | null = 'No invoice for this installment yet', noteId: string | null = null;
      if (inv) {
        try {
          const rate = Number(inv.cgst_rate || 0) + Number(inv.sgst_rate || 0) + Number(inv.igst_rate || 0);
          const n = await raiseNote(req, { invoice_id: inv.id, note_type: 'credit', adjustment_amount: amount, gst_rate: rate > 28 ? 28 : rate, reason: `Timely payment discount ${pct}% on ${d.installment_name}`.slice(0, 500) });
          status = 'issued'; note = null; noteId = n.id;
        } catch (e: any) { note = String(e?.message || 'The credit note could not be raised').slice(0, 300); }
      }
      await db.query(
        `INSERT INTO timely_discount_awards (consumer_id, project_id, demand_id, installment_name, base_amount, discount_pct, discount_amount, due_date, paid_on, credit_note_id, status, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (demand_id) DO UPDATE SET discount_pct = EXCLUDED.discount_pct, discount_amount = EXCLUDED.discount_amount, paid_on = EXCLUDED.paid_on, credit_note_id = EXCLUDED.credit_note_id, status = EXCLUDED.status, note = EXCLUDED.note
          WHERE timely_discount_awards.status = 'waiting'`,
        [cu.consumer_id, projectId, d.id, d.installment_name, base, pct, amount, d.due_date, paidOn, noteId, status, note, req?.userId ?? null]);
      if (status === 'issued') out.issued++; else out.waiting++;
      out.items.push({ consumer_id: cu.consumer_id, installment: d.installment_name, amount, status, note });
    }
  }
  return out;
}
