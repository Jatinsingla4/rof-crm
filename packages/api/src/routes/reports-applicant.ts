/**
 * Reports: Applicant Payment File and the Company Wise Summary.
 * Descriptive columns come from one query per booking; every money column comes from the shared ledger (see reports-dues.ts).
 */
import { Router } from 'express';
import { db } from '../db/pool.js';
import { pick, like, pageOf } from '../utils/report-input.js';
import { h, Q, flt, totalsOf } from './reports-dues.js';
import { baseCostSql, loadLedger, loadInterestCtx, interestOf, dueOf, sum, r2, pct, principalOf } from '../utils/report-ledger.js';

const router = Router();

// GET /applicant-payment-file - one row per live booking, with what was demanded, received, owed and charged as interest
router.get('/applicant-payment-file', h(async (req, res) => {
  const x = Q(req);
  const { size, page, offset } = pageOf(x, 100, 500);
  const where: string[] = [`br.status IN ('complete','pending_payment','active')`];
  const wp: any[] = [];
  const add = (v: any) => `$${wp.push(v)}`;
  if (x.projectId) where.push(`p.id = ${add(x.projectId)}::uuid`);
  if (x.towerId) where.push(`t.id = ${add(x.towerId)}::uuid`);
  if (x.bhkType) where.push(`u.bhk_type = ${add(x.bhkType)}`);
  if (x.planName) where.push(`br.selected_plan_name ILIKE ${add(like(x.planName))}`);
  if (x.brokerId) where.push(`br.main_broker_id = ${add(x.brokerId)}::uuid`);
  if (x.floor) where.push(`u.floor::text = ${add(x.floor)}`);
  if (x.customerClassification) where.push(`c.customer_classification = ${add(x.customerClassification)}`);
  if (x.employeeId) where.push(`br.sales_employee_id = ${add(x.employeeId)}::uuid`);
  if (x.selfOrLoan) where.push(`br.self_or_loan = ${add(x.selfOrLoan)}`);
  if (x.registrationNo) where.push(`c.registration_no ILIKE ${add(like(x.registrationNo))}`);
  if (x.name) where.push(`COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) ILIKE ${add(like(x.name))}`);
  if (x.unitNo) where.push(`u.unit_number ILIKE ${add(like(x.unitNo))}`);
  if (x.formNo) where.push(`c.form_no ILIKE ${add(like(x.formNo))}`);
  if (x.bookingFromDate) where.push(`br.booking_date >= ${add(x.bookingFromDate)}::date`);
  if (x.bookingToDate) where.push(`br.booking_date <= ${add(x.bookingToDate)}::date`);

  const unitCostBase = `
      ${baseCostSql('br', 'u')}`;
  const baseJoins = `
      FROM consumers c
      JOIN booking_records br ON br.consumer_id = c.id
      JOIN units u ON u.id = COALESCE(br.unit_id, c.allocated_unit_id)
      JOIN projects p ON p.id = u.project_id
      LEFT JOIN towers t ON t.id = u.tower_id
      LEFT JOIN LATERAL (SELECT allotment_date FROM allocations a WHERE a.consumer_id = c.id AND a.unit_id = u.id AND a.status <> 'cancelled' ORDER BY a.allotment_date DESC NULLS LAST LIMIT 1) al ON TRUE
      LEFT JOIN LATERAL (SELECT * FROM booking_payment_taxes b WHERE b.booking_record_id = br.id ORDER BY b.created_at DESC LIMIT 1) bpt ON TRUE
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      LEFT JOIN users usr ON usr.id = br.sales_employee_id`;
  // DISTINCT ON keeps the latest booking of an applicant
  const rows = (await db.query(`
    SELECT * FROM (
      SELECT DISTINCT ON (c.id)
        c.id                                                                    AS consumer_id,
        u.id                                                                    AS unit_id,
        c.registration_no,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name)     AS consumer_name,
        c.mobile,
        c.email,
        c.form_no,
        c.customer_classification,
        c.father_name,
        br.booking_date,
        br.selected_plan_name                                                   AS plan_name,
        br.self_or_loan,
        u.unit_number,
        u.floor,
        u.bhk_type,
        u.carpet_area_sqft,
        u.super_area_sqft,
        ${unitCostBase} AS base_price_inr,
        u.total_price_inr,
        t.tower_name,
        p.name                                                                  AS project_name,
        p.id                                                                    AS project_id,
        al.allotment_date,
        COALESCE(bk.firm_name, bk.name, 'Direct')                              AS broker_name,
        usr.name                                                                AS employee_name,
        COALESCE(c.finance_bank, br.bank_name, '')                             AS bank_name,
        COALESCE(c.loan_amount, 0)                                             AS loan_amount,
        COALESCE(br.basic_rate_inr_sqft, 0)                                     AS rate_per_sqft,
        COALESCE(br.dealer_adjustment_amount, 0)                               AS dealer_discount,
        COALESCE(br.company_inaugural_disc, 0)                                 AS inaugural_discount,
        COALESCE(br.approved_rebate_amount, 0)                                 AS company_rebate,
        COALESCE(br.dealer_adjustment_amount, 0)
          + COALESCE(br.company_inaugural_disc, 0)
          + COALESCE(br.approved_rebate_amount, 0)                             AS total_discount,
        ${unitCostBase}
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          - COALESCE(br.approved_rebate_amount, 0)                             AS net_basic_price,
        COALESCE(br.plc_amount, 0)                                             AS plc_amount,
        COALESCE(br.other_charge_amount, 0)                                    AS other_charge_amount,
        COALESCE(br.other_charge_desc, '')                                     AS other_charge_desc,
        (${unitCostBase}
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          - COALESCE(br.approved_rebate_amount, 0)
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0))                               AS total_unit_cost,
        br.status                                                              AS booking_status,
        CASE br.status
          WHEN 'pending_payment' THEN 'Pending Payment'
          WHEN 'active'          THEN 'Active'
          WHEN 'complete'        THEN 'Complete'
          ELSE br.status
        END                                                                    AS booking_status_label,
        COALESCE(u.unit_number,'')
          || COALESCE(', Floor ' || u.floor::text, '')
          || COALESCE(', ' || t.tower_name, '')                                AS unit_address,
        COALESCE((
          SELECT SUM(cac.amount)
          FROM consumer_addon_charges cac
          JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
          WHERE cac.consumer_id = c.id AND cac.status = 'active'
            AND acm.charge_name ILIKE 'IFMS%'
        ), 0)                                                                   AS ifms_amount,
        COALESCE((
          SELECT SUM(cac.amount)
          FROM consumer_addon_charges cac
          JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
          WHERE cac.consumer_id = c.id AND cac.status = 'active'
            AND acm.charge_name NOT ILIKE 'IFMS%'
        ), 0)                                                                   AS extra_addon_amount,
        ((${unitCostBase}
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          - COALESCE(br.approved_rebate_amount, 0)
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0))
          - COALESCE((
            SELECT SUM(cac.amount)
            FROM consumer_addon_charges cac
            JOIN addon_charge_master acm ON acm.id = cac.charge_master_id
            WHERE cac.consumer_id = c.id AND cac.status = 'active'
          ), 0))                                                                AS unit_cost_less_addon,
        COALESCE(bpt.cgst_pct, 0)                                              AS cost_cgst_pct,
        COALESCE(bpt.sgst_pct, 0)                                              AS cost_sgst_pct,
        COALESCE(bpt.cgst_amount, 0)                                           AS cost_cgst_amount,
        COALESCE(bpt.sgst_amount, 0)                                           AS cost_sgst_amount,
        COALESCE(bpt.s_tax_pct, 0)                                             AS s_tax_pct,
        (${unitCostBase}
          - COALESCE(br.dealer_adjustment_amount, 0)
          - COALESCE(br.company_inaugural_disc, 0)
          - COALESCE(br.approved_rebate_amount, 0)
          + COALESCE(br.plc_amount, 0)
          + COALESCE(br.other_charge_amount, 0)
          + COALESCE(bpt.cgst_amount, 0)
          + COALESCE(bpt.sgst_amount, 0)
          + CASE WHEN br.balcony_charge_amount IS NOT NULL
              THEN COALESCE(br.balcony_cgst_amount,0) + COALESCE(br.balcony_sgst_amount,0)
              ELSE 0 END)                                                      AS total_cost_with_gst
      ${baseJoins}
      WHERE ${where.join(' AND ')}
      ORDER BY c.id, br.booking_date DESC, br.created_at DESC) sub
    ORDER BY booking_date ASC, registration_no ASC`, wp)).rows;

  const ledger = rows.length ? await loadLedger({ consumerIds: [...new Set<string>(rows.map((r: any) => r.consumer_id))] }) : [];
  const byKey = new Map(ledger.map((p) => [`${p.consumer_id}:${p.unit_id}`, p]));
  const ictx = await loadInterestCtx(ledger);
  const num = (v: any) => parseFloat(v ?? '0') || 0;
  const NUM = ['loan_amount','rate_per_sqft','dealer_discount','inaugural_discount','company_rebate','total_discount','net_basic_price','base_price_inr','total_price_inr','carpet_area_sqft','super_area_sqft','plc_amount','other_charge_amount','total_unit_cost',
    'ifms_amount','extra_addon_amount','unit_cost_less_addon','cost_cgst_pct','cost_sgst_pct','cost_cgst_amount','cost_sgst_amount','s_tax_pct','total_cost_with_gst'];
  const out = rows.map((r: any) => {
    const o: any = { ...r };
    for (const f of NUM) o[f] = num(o[f]);
    const p = byKey.get(`${r.consumer_id}:${r.unit_id}`);
    const t = p ? totalsOf(p, dueOf(p, x.dueAsOnDate || null)) : null;
    const it = p ? interestOf(p, ictx) : null;
    return Object.assign(o, {
      dues_amount: t?.amount ?? 0, dues_cgst: t?.cgst ?? 0, dues_sgst: t?.sgst ?? 0, dues_total: t?.demanded ?? 0,
      received_amount: p?.received ?? 0, interest_received: p?.received_interest ?? 0,
      outstanding_amount: t?.outstanding ?? 0, outstanding_net: t?.os_amount ?? 0, outstanding_cgst: t?.os_cgst ?? 0, outstanding_sgst: t?.os_sgst ?? 0, credit_amount: t?.credit ?? 0,
      received_cgst: p?.received_cgst ?? 0, received_sgst: p?.received_sgst ?? 0,
      received_pct: p ? pct(principalOf(p.received, p.received_cgst, p.received_sgst, p.received_interest), p.unit_cost) : 0,
      interest_charged: it?.charged ?? 0, interest_waived: it?.waived ?? 0, interest_outstanding: it?.outstanding ?? 0,
    });
  });
  res.json({
    success: true, data: out.slice(offset, offset + size), total: out.length, page, pageSize: size, totalPages: Math.ceil(out.length / size),
    summary: { totalConsumers: out.length, totalDues: sum(out, (r) => r.dues_total), totalReceived: sum(out, (r) => r.received_amount), totalOutstanding: sum(out, (r) => r.outstanding_amount) },
  });
}));

// GET /summary-report - Company Wise Summary: stock, sold value and the money position of each project of each company
router.get('/summary-report', h(async (req, res) => {
  const x = Q(req);
  const cid = x.companyId || null;
  const stock = (await db.query(`
    SELECT comp.id AS company_id, comp.name AS company_name, pr.id AS project_id, pr.name AS project_name, 'Sq.Ft.' AS uom,
           COUNT(u.id)::int AS total_unit, COALESCE(SUM(u.carpet_area_sqft), 0) AS total_area,
           COUNT(u.id) FILTER (WHERE u.status != 'available')::int AS sold_unit, COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status != 'available'), 0) AS sold_area,
           COUNT(u.id) FILTER (WHERE u.status = 'available')::int AS balance_unit, COALESCE(SUM(u.carpet_area_sqft) FILTER (WHERE u.status = 'available'), 0) AS balance_area,
           COALESCE(SUM(CASE WHEN u.status != 'available' THEN
             ${baseCostSql('b', 'u')}
             - COALESCE(b.dealer_adjustment_amount, 0) - COALESCE(b.company_inaugural_disc, 0) - COALESCE(b.approved_rebate_amount, 0) ELSE 0 END), 0) AS sold_value
      FROM projects pr JOIN companies comp ON comp.id = pr.company_id JOIN units u ON u.project_id = pr.id
      LEFT JOIN LATERAL (SELECT bb.basic_rate_inr_sqft, bb.balcony_charge_amount, bb.dealer_adjustment_amount, bb.company_inaugural_disc, bb.approved_rebate_amount FROM booking_records bb
                          WHERE bb.unit_id = u.id AND bb.status != 'cancelled' ORDER BY bb.created_at DESC LIMIT 1) b ON TRUE
     WHERE ($1::uuid IS NULL OR comp.id = $1::uuid)
     GROUP BY comp.id, comp.name, pr.id, pr.name ORDER BY comp.name, pr.name`, [cid])).rows;
  const plans = await loadLedger({ companyId: cid || undefined });
  const ictx = await loadInterestCtx(plans);
  const byProject = new Map<string, typeof plans>();
  for (const p of plans) { if (!byProject.has(p.project_id)) byProject.set(p.project_id, []); byProject.get(p.project_id)!.push(p); }
  const data = stock.map((r: any) => {
    const ps = byProject.get(r.project_id) || [];
    const ts = ps.map((p) => totalsOf(p, dueOf(p)));
    const balance = sum(ts, (t) => t.outstanding);
    return {
      ...r, total_area: Number(r.total_area), sold_area: Number(r.sold_area), balance_area: Number(r.balance_area), sold_value: r2(Number(r.sold_value)),
      upto_demanded: sum(ts, (t) => t.demanded), upto_received: sum(ps, (p) => p.received), balance_recoverable: balance, credit_amount: sum(ts, (t) => t.credit),
      due_interest: sum(ps, (p) => interestOf(p, ictx).outstanding), current_os: balance,
    };
  });
  res.json({ success: true, data });
}));

export default router;
