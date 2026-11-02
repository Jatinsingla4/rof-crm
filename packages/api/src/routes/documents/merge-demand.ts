// Demand letter figures: rows per installment, waterfall of receipts, penal interest, company and bank details.
import { db } from '../../index.js';
import { companyBankCols } from '../../utils/company-bank.js';
import { bad } from '../../utils/input.js';
import { applyRecalc, extractFieldValue, buildEditScript } from '../../utils/document-recalc.js';
import { writebackField, WritebackContext } from '../../utils/document-writeback.js';
import { applyWaterfall, buildInterestRows, WaterfallReceipt, WaterfallDemand } from '../../utils/payment-waterfall.js';
import { numberToWordsIndian, ordinalFloor, fmtDateIndia, fmtIndianNumber, fmtIndianNumberDecimal, fmtIndianMoneyDecimal, fmtIndianAreaDecimal } from './shells.js';
import { penalRateFrom } from '../../utils/penal-rate.js';
export interface GenCtx {
  req: any; consumerId: string; allocationId?: string; template: any; d: any;
  includeAllDemands?: boolean; dueDate?: string; mergeData: any; htmlContent: string;
}
// Fills ctx.mergeData for a demand letter
export async function demandLetterData(ctx: GenCtx): Promise<void> {
  const { req, consumerId, allocationId, template, d, includeAllDemands, dueDate } = ctx;
  let { mergeData, htmlContent } = ctx;
          const includeInterest = req.body.includeInterest !== false;
          const demandIdFilter = req.body.demandId as string | undefined;

          // Fetch global_settings as key→value map
          const settingsRes = await db.query(`SELECT key, value FROM global_settings`);
          const settings: Record<string, string> = {};
          settingsRes.rows.forEach((r: any) => { settings[r.key] = r.value; });
          let penalRate = penalRateFrom(settings);

          // Fetch per-project company details (overrides global_settings if found)
          const projCompanyRes = await db.query(`
            SELECT c.name, c.cin, c.gstin, c.address1, c.reg_address,
                   c.phone, c.website, c.email, c.place_of_supply, c.logo_url,
                   ${companyBankCols('c')}
            FROM companies c
            JOIN projects p ON p.company_id = c.id
            JOIN units u ON u.project_id = p.id
            LEFT JOIN allocations al ON al.unit_id = u.id AND al.consumer_id = $1
            LEFT JOIN payment_plans pp ON pp.consumer_id = $1
            LEFT JOIN booking_records br ON br.consumer_id = $1
            WHERE al.consumer_id = $1 OR pp.consumer_id = $1 OR br.consumer_id = $1
            LIMIT 1`, [consumerId]);
          const projCompany = projCompanyRes.rows[0] || null;

          // Fetch consumer + unit + tower + project + payment_plan
          // Unit resolved: allocation → payment_plan → booking_record (three-level fallback)
          const planRes = await db.query(`
            SELECT
              c.name AS consumer_name, c.father_name, c.mobile, c.email,
              c.registration_no, c.income_category, c.present_address,
              c.nationality, c.interest_start_date, c.grace_period_days,
              COALESCE(u_al.unit_number, u_pp.unit_number, u_br.unit_number) AS unit_number,
              COALESCE(u_al.bhk_type, u_pp.bhk_type, u_br.bhk_type) AS bhk_type,
              COALESCE(u_al.carpet_area_sqft, u_pp.carpet_area_sqft, u_br.carpet_area_sqft) AS carpet_area_sqft,
              COALESCE(u_al.balcony_area_sqft, u_pp.balcony_area_sqft, u_br.balcony_area_sqft) AS balcony_area_sqft,
              COALESCE(u_al.super_area_sqft, u_pp.super_area_sqft, u_br.super_area_sqft) AS super_area_sqft,
              COALESCE(u_al.base_price_inr, u_pp.base_price_inr, u_br.base_price_inr) AS base_price_inr,
              COALESCE(u_al.total_price_inr, u_pp.total_price_inr, u_br.total_price_inr) AS total_price_inr_unit,
              COALESCE(u_al.floor, u_pp.floor, u_br.floor) AS floor,
              COALESCE(u_al.facing, u_pp.facing, u_br.facing) AS facing,
              COALESCE(t_al.tower_name, t_pp.tower_name, t_br.tower_name) AS tower_name,
              COALESCE(p_al.name, p_pp.name, p_br.name) AS project_name,
              COALESCE(p_al.location, p_pp.location, p_br.location) AS project_location,
              COALESCE(p_al.rera_number, p_pp.rera_number, p_br.rera_number) AS rera_number,
              COALESCE(p_al.id, p_pp.id, p_br.id) AS project_id,
              pp.id AS payment_plan_id,
              COALESCE(pp.total_amount_inr, u_br.total_price_inr) AS total_amount_inr,
              COALESCE(
                NULLIF(br.selected_plan_name, ''),
                (SELECT DISTINCT plan_name FROM plan_schedule_templates
                 WHERE project_id = COALESCE(p_al.id, p_pp.id, p_br.id) ORDER BY plan_name ASC LIMIT 1),
                'CLP'
              ) AS plan_name,
              al.allotment_date,
              br.booking_date,
              COALESCE(br.booking_amount, 0) AS booking_amount,
              COALESCE(br.basic_rate_inr_sqft, 0) AS booking_basic_rate_inr_sqft,
              COALESCE(br.carpet_area_sqft, 0) AS booking_carpet_area_sqft,
              COALESCE(br.other_charge_amount, 0) AS other_charge_amount,
              COALESCE(br.other_charge_desc, '') AS other_charge_desc,
              COALESCE(br.payment_mode, '') AS booking_payment_mode,
              COALESCE(NULLIF(br.payment_ref, ''), '') AS booking_payment_ref,
              COALESCE(NULLIF(br.bank_name, ''), '') AS booking_bank_name,
              br.cheque_date AS booking_cheque_date,
              br.balcony_charge_amount,
              br.balcony_cgst_amount,
              br.balcony_sgst_amount,
              COALESCE((
                SELECT SUM(r.amount_received_inr)
                FROM receipts r
                WHERE r.consumer_id = c.id
                AND r.status = 'cleared'
              ), 0) AS total_received_inr
            FROM consumers c
            LEFT JOIN LATERAL (
              SELECT * FROM allocations WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) al ON true
            LEFT JOIN units u_al ON u_al.id = al.unit_id
            LEFT JOIN towers t_al ON t_al.id = u_al.tower_id
            LEFT JOIN projects p_al ON p_al.id = u_al.project_id
            LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
            LEFT JOIN units u_pp ON u_pp.id = pp.unit_id
            LEFT JOIN towers t_pp ON t_pp.id = u_pp.tower_id
            LEFT JOIN projects p_pp ON p_pp.id = pp.project_id
            LEFT JOIN LATERAL (
              SELECT * FROM booking_records WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) br ON true
            LEFT JOIN units u_br ON u_br.id = br.unit_id
            LEFT JOIN towers t_br ON t_br.id = u_br.tower_id
            LEFT JOIN projects p_br ON p_br.id = br.project_id
            WHERE c.id = $1
            ORDER BY pp.created_at DESC
            LIMIT 1
          `, [consumerId]);

          const plan = planRes.rows[0] || {};

          if (plan?.project_id) {
            try {
              const projRateRes = await db.query(
                `SELECT rate_percent FROM project_interest_rates
                 WHERE project_id = $1
                   AND effective_from <= CURRENT_DATE
                 ORDER BY effective_from DESC
                 LIMIT 1`,
                [plan.project_id]
              );
              if (projRateRes.rows.length > 0) {
                penalRate = parseFloat(projRateRes.rows[0].rate_percent);
              }
            } catch {
              // fall through to global rate
            }
          }

          // Fetch co-applicants
          const coRes = await db.query(
            `SELECT name, relationship FROM co_applicants WHERE consumer_id = $1 ORDER BY created_at ASC LIMIT 3`,
            [consumerId]
          );
          const coApplicants = coRes.rows
            .map((r: any) => r.name + (r.relationship ? ` (${r.relationship})` : ''))
            .join(', ');

          // Only show formally raised installments (status='demanded') in the letter.
          const planId = plan.payment_plan_id;
          const projectId = plan.project_id;
          const planName = plan.plan_name || 'CLP';
          const totalAmountInr = parseFloat(plan.total_amount_inr || 0);
          const allotmentDate = plan.allotment_date ? new Date(plan.allotment_date) : null;
          const isNri = ['nri','oci','pio'].includes((plan.nationality || '').toLowerCase());
          // AHP GST: 1% total (0.5% CGST + 0.5% SGST) for residents, 0 for NRI
          const defaultCgstPct = isNri ? 0 : 0.5;
          const defaultSgstPct = isNri ? 0 : 0.5;

          const allInstallmentsQuery = `
            SELECT DISTINCT ON (d.installment_index)
              COALESCE(pst.installment_index, d.installment_index) AS installment_index,
              COALESCE(pst.installment_name, d.demand_type, 'Installment') AS installment_name,
              COALESCE(pst.percentage, 0) AS percentage,
              COALESCE(pst.due_date_offset_days, 0) AS due_date_offset_days,
              pst.interest_rate_percent,
              d.id AS demand_id,
              d.status AS demand_status,
              d.delivery_status,
              d.amount_due_inr,
              d.cgst_amount,
              d.sgst_amount,
              d.addon_charge_amount,
              d.addon_cgst_amount,
              d.addon_sgst_amount,
              d.due_date,
              COALESCE(
                (SELECT SUM(r.amount_received_inr) FROM receipts r
                 WHERE r.demand_id = d.id AND r.status = 'cleared'), 0
              ) AS amount_paid,
              GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue
            FROM demands d
            LEFT JOIN plan_schedule_templates pst
              ON pst.project_id = $1
              AND pst.plan_name = $2
              AND pst.installment_index = d.installment_index
            WHERE d.consumer_id = $3
            ORDER BY d.installment_index ASC, d.created_at DESC
          `;

          const demandQuery = `
            SELECT
              pst.installment_index,
              pst.installment_name,
              pst.percentage,
              pst.due_date_offset_days,
              pst.interest_rate_percent,
              d.id AS demand_id,
              d.status AS demand_status,
              d.delivery_status,
              d.amount_due_inr,
              d.cgst_amount,
              d.sgst_amount,
              d.addon_charge_amount,
              d.addon_cgst_amount,
              d.addon_sgst_amount,
              d.due_date,
              COALESCE(
                (SELECT SUM(r.amount_received_inr) FROM receipts r
                 WHERE r.demand_id = d.id AND r.status = 'cleared'),
                0
              ) AS amount_paid,
              GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue
            FROM demands d
            JOIN plan_schedule_templates pst
              ON pst.project_id = $2
              AND pst.plan_name = $3
              AND pst.installment_index = d.installment_index
            WHERE d.payment_plan_id = $1
              AND d.status IN ('demanded', 'paid')
              AND d.due_date IS NOT NULL
              AND d.due_date <= $4::date
            ORDER BY pst.installment_index ASC
          `;
          const demandParams: any[] = [planId, projectId, planName, dueDate];

          // Fallback: only if no project could be resolved at all
          let demandsRes: any;
          if (includeAllDemands) {
            demandsRes = await db.query(allInstallmentsQuery, [projectId || null, planName || '', consumerId]);
          } else if (!projectId) {
            const fallbackQuery = `
              SELECT DISTINCT ON (d.installment_index) d.*,
                COALESCE(pst2.installment_name, d.demand_type, 'Installment') AS installment_name,
                d.amount_due_inr, d.cgst_amount, d.sgst_amount, d.due_date,
                COALESCE(
                  (SELECT SUM(amount_received_inr) FROM receipts
                   WHERE demand_id = d.id AND status = 'cleared'), 0
                ) AS amount_paid,
                GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) AS days_overdue,
                COALESCE(pst2.percentage, 0) AS percentage,
                pst2.interest_rate_percent
              FROM demands d
              LEFT JOIN payment_plans pp2 ON pp2.id = d.payment_plan_id
              LEFT JOIN plan_schedule_templates pst2
                ON pst2.project_id = pp2.project_id AND pst2.installment_index = d.installment_index
              WHERE d.consumer_id = $1
                AND d.status IN ('demanded', 'paid')
                AND d.due_date IS NOT NULL
                AND d.due_date <= $2::date
              ORDER BY d.installment_index ASC`;
            demandsRes = await db.query(fallbackQuery, [consumerId, dueDate]);
          } else {
            demandsRes = await db.query(demandQuery, demandParams);
          }

          // Count all template installments for this plan (used to decide Other Charges visibility)
          const planSchedCountRes = projectId && planName
            ? await db.query(`SELECT COUNT(*) FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2`, [projectId, planName])
            : { rows: [{ count: '0' }] };
          const totalPlanInstallments = parseInt(planSchedCountRes.rows[0]?.count || '0');

          // Build waterfall allocation map: demand_id → total paid (linked + advance pool)
          const [wfRcptsRes, wfDemandsRes] = await Promise.all([
            db.query<WaterfallReceipt>(
              `SELECT id, amount_received_inr, demand_id, installment_index, status,
                      received_date, payment_method
               FROM receipts WHERE consumer_id = $1 AND status = 'cleared'`,
              [consumerId]
            ),
            db.query<WaterfallDemand>(
              `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                      addon_charge_amount, addon_cgst_amount, addon_sgst_amount
               FROM demands WHERE consumer_id = $1`,
              [consumerId]
            ),
          ]);
          const allWfResults = applyWaterfall(wfRcptsRes.rows, wfDemandsRes.rows);
          const wfMap = new Map(allWfResults.map(w => [w.demand_id, w.paid]));

          // Fetch approved interest from penal_interests table — respects
          // admin-approved amounts and waivers
          const piRes = await db.query<{
            installment_index: number;
            net_interest_inr: number;
          }>(`
            SELECT
              installment_index,
              GREATEST(0,
                COALESCE(amount_inr, 0)
                - COALESCE(interest_waived_inr, 0)
              ) AS net_interest_inr
            FROM penal_interests
            WHERE consumer_id = $1
            ORDER BY installment_index
          `, [consumerId]);

          // Build map: installment_index → net interest
          const piMap = new Map<number, number>();
          piRes.rows.forEach(r => {
            piMap.set(r.installment_index, Number(r.net_interest_inr));
          });

          // Sum total interest from DB
          const totalInterestFromDB =
            piRes.rows.reduce((sum, r) => sum + Number(r.net_interest_inr), 0);

          // Build interest map via buildInterestRows (same logic as applicant file).
          // Uses actual receipt dates for paid demands; asOfDate for still-unpaid ones.
          const letterAsOfDate = new Date(); // interest always
          // uses real today -- dueDate (entered by staff) only
          // filters which installments appear on the letter,
          // never affects how much interest has accrued
          const demandsForIR = demandsRes.rows
            .filter((d: any) => !!d.demand_id)
            .map((d: any) => ({
              id: String(d.demand_id),
              installment_index: Number(d.installment_index),
              installment_name: String(d.installment_name || d.demand_type || '—'),
              due_date: d.due_date || null,
              amount_due_inr: d.amount_due_inr,
              interest_rate_percent: d.interest_rate_percent ? parseFloat(d.interest_rate_percent) : null,
              cgst_amount: d.cgst_amount,
              sgst_amount: d.sgst_amount,
              addon_charge_amount: d.addon_charge_amount,
              addon_cgst_amount: d.addon_cgst_amount,
              addon_sgst_amount: d.addon_sgst_amount,
            }));
          const irRows = buildInterestRows(
            wfRcptsRes.rows,
            demandsForIR,
            penalRate,
            {
              interestStartDate: plan.interest_start_date
                ? new Date(String(plan.interest_start_date))
                : null,
              gracePeriodDays: parseInt(String(plan.grace_period_days || 0)),
              asOfDate: letterAsOfDate,
            }
          );
          // Sum interest per installment_index (partial payments may produce multiple rows)
          const irMap = new Map<number, number>();
          for (const ir of irRows) {
            irMap.set(ir.installment_index, (irMap.get(ir.installment_index) || 0) + ir.interest_amount);
          }
          // piMap overrides take precedence (admin-approved amounts)
          for (const [idx, piAmt] of piMap.entries()) {
            if (piAmt > 0) irMap.set(idx, piAmt);
          }

          let totalDue = 0, totalPaid = 0, totalCgst = 0, totalSgst = 0;
          let totalInterestCalc = 0;  // always-calculated interest for with-interest mode

          // BSP amount-based split ratio for Basic Price vs Balcony Charges rows
          const bookingBspRate   = parseFloat(plan.booking_basic_rate_inr_sqft || 0);
          const bookingCarpetSqft = parseFloat(plan.booking_carpet_area_sqft   || 0);
          const totalBsp = bookingBspRate > 0 && bookingCarpetSqft > 0
            ? Math.round(bookingBspRate * bookingCarpetSqft)
            : 0;
          // Recalculate total from rate × super_area to correct any legacy
          // bookings where total_amount_inr was double-counted
          const recalcTotal = bookingBspRate > 0 && bookingCarpetSqft > 0
            ? Math.round(bookingBspRate * bookingCarpetSqft)
            : totalAmountInr;
          const basicRatio = totalBsp > 0 && recalcTotal > 0
            ? totalBsp / recalcTotal
            : 1;
          // True unit areas for direct area-based row split
          const trueCarpet  = parseFloat(plan.carpet_area_sqft  || 0);
          const trueBalcony = parseFloat(plan.balcony_area_sqft || 0);
          const superArea = trueCarpet + trueBalcony;

          let rowsNoInterest = '';
          let rowsWithInterest = '';

          // DS: tagged span helper for demand letter table cells
          const DS = (key: string, label: string, val: number, extra = '') =>
            `<span data-field-key="${key}" data-field-label="${label}" data-value-type="currency" data-section="payment_table"${extra}>${fmtIndianMoneyDecimal(val)}</span>`;

          demandsRes.rows.forEach((dm: any, idx: number) => {
            // If demand exists, use its amounts; otherwise calculate from template percentage
            const hasDemand = !!dm.demand_id;
            const pct = parseFloat(dm.percentage || 0) / 100;
            const calculatedAmt = Math.round(recalcTotal * pct);
            // Addon charges: included in installment/cgst/sgst so all
            // downstream (amtDue, basicAmt, balconyAmt, totalDue, totalPayable,
            // amountInWords) auto-correct. hasDemand guard ensures 0 for
            // non-demanded/fallback rows. Non-addon bookings unaffected
            // (columns default 0 per migration 081).
            const addonAmt = hasDemand
              ? parseFloat(dm.addon_charge_amount || 0)
              : 0;
            const addonCgst = hasDemand
              ? parseFloat(dm.addon_cgst_amount || 0)
              : 0;
            const addonSgst = hasDemand
              ? parseFloat(dm.addon_sgst_amount || 0)
              : 0;
            const installment = (hasDemand
              ? parseFloat(dm.amount_due_inr || 0)
              : calculatedAmt) + addonAmt;
            const cgst = (hasDemand
              ? parseFloat(dm.cgst_amount || 0)
              : Math.round(installment * defaultCgstPct / 100))
              + addonCgst;
            const sgst = (hasDemand
              ? parseFloat(dm.sgst_amount || 0)
              : Math.round(installment * defaultSgstPct / 100))
              + addonSgst;
            const totalGst = cgst + sgst;
            const amtDue = installment + cgst + sgst;
            // Use waterfall allocation (covers advance/booking receipts) with fallback to direct linkage.
            // dm.demand_id is set by the main query alias; dm.id is set by fallback (d.*).
            const dmId = dm.demand_id || dm.id || null;
            const amtPaid = dmId ? (wfMap.get(dmId) ?? parseFloat(dm.amount_paid || 0)) : parseFloat(dm.amount_paid || 0);

            // Due date: from demand if raised, else calculate from allotment date + offset.
            // Milestone-based installments have offset_days = 0; they show '—' until demanded.
            let dueDateVal: Date | null = null;
            if (dm.due_date) {
              // Parse DB date (YYYY-MM-DD comes as UTC midnight) → normalize to local midnight
              // so day-count arithmetic is timezone-correct
              const raw = new Date(dm.due_date);
              dueDateVal = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
            } else if (dm.due_date_offset_days > 0 && allotmentDate) {
              // Genuine offset-based installment (e.g. "Within 15 days of allotment")
              dueDateVal = new Date(allotmentDate);
              dueDateVal.setDate(dueDateVal.getDate() + parseInt(dm.due_date_offset_days));
            }
            // else: milestone-based with no stored date → dueDateVal stays null → renders '—'

            // Interest from buildInterestRows (uses actual receipt dates for paid demands,
            // accrues to letterAsOfDate for unpaid; piMap overrides already applied to irMap).
            const rowInterest = irMap.get(dm.installment_index) || 0;

            totalDue += amtDue;
            totalPaid += amtPaid;
            totalCgst += cgst;
            totalSgst += sgst;
            totalInterestCalc += rowInterest;

            const cgstPct = (defaultCgstPct > 0 || cgst > 0)
              ? (installment > 0 ? ((cgst / installment) * 100).toFixed(2) : defaultCgstPct.toFixed(2))
              : '0.00';
            const sgstPct = (defaultSgstPct > 0 || sgst > 0)
              ? (installment > 0 ? ((sgst / installment) * 100).toFixed(2) : defaultSgstPct.toFixed(2))
              : '0.00';

            // Split into Basic Price (carpet area) and Balcony Charges rows.
            // For bookings with a stored balcony_charge_amount (Phase 2,
            // computed once at booking creation), derive each row from its
            // own true/stored source (this installment's proportional share)
            // instead of a ratio-based split of the combined installment
            // amount. Historical (NULL) bookings keep the exact prior
            // ratio-based split unchanged -- zero regression.
            const hasStoredBalcony = plan.balcony_charge_amount != null;
            const carpetOnlyRatio = superArea > 0 ? trueCarpet / superArea : 1;
            // balconyAmt is the true, independently-rounded proportional share
            // of the stored balcony total; basicAmt is defined as the remainder
            // of this installment's real due amount, guaranteeing an exact sum
            // by construction (same remainder pattern as the GST split below
            // and the payment waterfall) instead of two independent roundings
            // that could land ±1 rupee apart.
            const balconyAmtStored = hasStoredBalcony
              ? Math.round(parseFloat(plan.balcony_charge_amount || 0) * pct)
              : 0;
            const basicAmt = hasStoredBalcony
              ? installment - balconyAmtStored
              : Math.round(installment * carpetOnlyRatio);
            const balconyAmt = hasStoredBalcony
              ? balconyAmtStored
              : installment - basicAmt;
            // Use carpet/superArea ratio for GST + interest split —
            // basicRatio = 1.0 (totalBsp === recalcTotal) so cannot use it here
            const carpetRatio = superArea > 0 ? trueCarpet / superArea : 1;
            const balconyCgstShare = hasStoredBalcony ? Math.round(parseFloat(plan.balcony_cgst_amount || 0) * pct) : 0;
            const balconySgstShare = hasStoredBalcony ? Math.round(parseFloat(plan.balcony_sgst_amount || 0) * pct) : 0;
            const basicCgst = hasStoredBalcony ? cgst - balconyCgstShare : Math.round(cgst * carpetRatio);
            const balconyCgst = hasStoredBalcony ? balconyCgstShare : cgst - basicCgst;
            const basicSgst = hasStoredBalcony ? sgst - balconySgstShare : Math.round(sgst * carpetRatio);
            const balconySgst = hasStoredBalcony ? balconySgstShare : sgst - basicSgst;
            const basicDue = basicAmt + basicCgst + basicSgst;
            const balconyDue = balconyAmt + balconyCgst + balconySgst;
            // Waterfall: fill Row 1 up to full basicDue (base + GST), then remainder to Row 2
            const basicPaid = Math.min(amtPaid, basicDue);
            const balconyPaid = Math.max(0, amtPaid - basicPaid);
            const basicPayable = Math.max(0, basicDue - basicPaid);
            const balconyPayable = Math.max(0, balconyDue - balconyPaid);

            // Interest split for with-interest version
            const basicInterest = Math.round(rowInterest * carpetRatio);
            const balconyInterest = rowInterest - basicInterest;
            const basicDueWI = basicDue + basicInterest;
            const balconyDueWI = balconyDue + balconyInterest;
            const basicPayableWI = Math.max(0, basicDueWI - basicPaid);
            const balconyPayableWI = Math.max(0, balconyDueWI - balconyPaid);

            const label = dm.installment_name || dm.installment_label || dm.demand_type || 'Installment';
            const dueDt = dueDateVal ? fmtDateIndia(dueDateVal) : '—';

            // 12-column row (without interest) — Particulars (timing, spanned) + Charge Type (not spanned)
            rowsNoInterest += `<tr>
              <td class="tc" rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${idx + 1}</td>
              <td rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${label}</td>
              <td>Basic Price</td>
              <td class="tc" data-field-key="dueDate_${idx}" data-field-label="Due Date (Row ${idx})" data-value-type="date" data-section="payment_table">${dueDt}</td>
              <td class="tr">${DS(`basicAmt_${idx}`, `Basic Amount (Row ${idx})`, basicAmt, ` data-cgst-pct="${cgstPct}" data-gst-type="basic"`)}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`basicCgst_${idx}`, `CGST Amount (Row ${idx})`, basicCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`basicSgst_${idx}`, `SGST Amount (Row ${idx})`, basicSgst)}</td>
              <td class="tr">${DS(`basicTotal_${idx}`, `Row Total (Row ${idx})`, basicDue)}</td>
              <td class="tr">${DS(`basicPaid_${idx}`, `Amount Paid (Row ${idx})`, basicPaid)}</td>
              <td class="tr bold">${DS(`basicPayable_${idx}`, `Net Payable (Row ${idx})`, basicPayable)}</td>
            </tr>
            ${trueBalcony > 0 ? `<tr>
              <td>Balcony Charges</td>
              <td class="tc">${dueDt}</td>
              <td class="tr">${DS(`balconyAmt_${idx}`, `Balcony Amount (Row ${idx})`, balconyAmt, ' data-gst-type="basic"')}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`balconyCgst_${idx}`, `Balcony CGST (Row ${idx})`, balconyCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`balconySgst_${idx}`, `Balcony SGST (Row ${idx})`, balconySgst)}</td>
              <td class="tr">${DS(`balconyTotal_${idx}`, `Balcony Total (Row ${idx})`, balconyDue)}</td>
              <td class="tr">${DS(`balconyPaid_${idx}`, `Balcony Paid (Row ${idx})`, balconyPaid)}</td>
              <td class="tr bold">${DS(`balconyPayable_${idx}`, `Balcony Payable (Row ${idx})`, balconyPayable)}</td>
            </tr>` : ''}`;

            // 13-column row (with interest — adds Interest col after SGST)
            rowsWithInterest += `<tr>
              <td class="tc" rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${idx + 1}</td>
              <td rowspan="${trueBalcony > 0 ? 2 : 1}" style="vertical-align:middle">${label}</td>
              <td>Basic Price</td>
              <td class="tc" data-field-key="dueDate_${idx}" data-field-label="Due Date (Row ${idx})" data-value-type="date" data-section="interest_table">${dueDt}</td>
              <td class="tr">${DS(`basicAmt_${idx}`, `Basic Amount (Row ${idx})`, basicAmt, ` data-cgst-pct="${cgstPct}" data-gst-type="basic"`)}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`basicCgst_${idx}`, `CGST Amount (Row ${idx})`, basicCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`basicSgst_${idx}`, `SGST Amount (Row ${idx})`, basicSgst)}</td>
              <td class="tr" style="color:#c00"><span data-field-key="basicInterest_${idx}" data-field-label="Penal Interest (Row ${idx})" data-value-type="currency" data-section="interest_table">${fmtIndianMoneyDecimal(basicInterest)}</span></td>
              <td class="tr">${DS(`basicTotal_${idx}`, `Row Total (Row ${idx})`, basicDueWI)}</td>
              <td class="tr">${DS(`basicPaid_${idx}`, `Amount Paid (Row ${idx})`, basicPaid)}</td>
              <td class="tr bold">${DS(`basicPayable_${idx}`, `Net Payable (Row ${idx})`, basicPayableWI)}</td>
            </tr>
            ${trueBalcony > 0 ? `<tr>
              <td>Balcony Charges</td>
              <td class="tc">${dueDt}</td>
              <td class="tr">${DS(`balconyAmt_${idx}`, `Balcony Amount (Row ${idx})`, balconyAmt, ' data-gst-type="basic"')}</td>
              <td class="tc">${cgstPct}%</td>
              <td class="tr">${DS(`balconyCgst_${idx}`, `Balcony CGST (Row ${idx})`, balconyCgst)}</td>
              <td class="tc">${sgstPct}%</td>
              <td class="tr">${DS(`balconySgst_${idx}`, `Balcony SGST (Row ${idx})`, balconySgst)}</td>
              <td class="tr" style="color:#c00"><span data-field-key="balconyInterest_${idx}" data-field-label="Balcony Interest (Row ${idx})" data-value-type="currency" data-section="interest_table">${fmtIndianMoneyDecimal(balconyInterest)}</span></td>
              <td class="tr">${DS(`balconyTotal_${idx}`, `Balcony Total (Row ${idx})`, balconyDueWI)}</td>
              <td class="tr">${DS(`balconyPaid_${idx}`, `Balcony Paid (Row ${idx})`, balconyPaid)}</td>
              <td class="tr bold">${DS(`balconyPayable_${idx}`, `Balcony Payable (Row ${idx})`, balconyPayableWI)}</td>
            </tr>` : ''}`;
          });

          // Other Charges row (IFMS etc.) — appended after all installment rows
          const planOtherCharge = parseFloat(plan.other_charge_amount || 0);
          const planOtherDesc   = plan.other_charge_desc || 'Other Charges';
          const planOcCgst = planOtherCharge > 0 ? Math.round(planOtherCharge * defaultCgstPct / 100) : 0;
          const planOcSgst = planOtherCharge > 0 ? Math.round(planOtherCharge * defaultSgstPct / 100) : 0;
          const planOcDue  = planOtherCharge + planOcCgst + planOcSgst;
          // Calculate how much of Other Charge has been paid via installment payments.
          // OC is embedded in each demand proportionally: ocProportion = OC / totalAmountInr
          // totalPaid is GST-inclusive waterfall total across all rendered demands.
          // Must use totalAmountInr (BSP+OC) NOT recalcTotal (BSP only).
          const ocProportion = planOtherCharge > 0 && totalAmountInr > 0
            ? planOtherCharge / totalAmountInr
            : 0;
          const ocPaid = planOtherCharge > 0
            ? Math.round(totalPaid * ocProportion)
            : 0;
          const ocPayable = Math.max(0, Math.round(planOcDue - ocPaid));
          // Universal rule: show Other Charges row ONLY when ALL installments of
          // this payment plan are shown in this demand letter.
          const demandsShownCount = demandsRes.rows.length;
          const showOtherCharges = planOtherCharge > 0
            && totalPlanInstallments > 0
            && demandsShownCount >= totalPlanInstallments;
          if (showOtherCharges) {
            rowsNoInterest += `<tr style="background:#f9f9f9">
              <td class="tc">—</td>
              <td><strong>Other Charges</strong></td>
              <td>${planOtherDesc}</td>
              <td class="tc">—</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOtherCharge)}</td>
              <td class="tc">${defaultCgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcCgst)}</td>
              <td class="tc">${defaultSgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcSgst)}</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcDue)}</td>
              <td class="tr">${fmtIndianMoneyDecimal(ocPaid)}</td>
              <td class="tr bold">${ocPayable === 0 ? '0' : '—'}</td>
            </tr>`;
            rowsWithInterest += `<tr style="background:#f9f9f9">
              <td class="tc">—</td>
              <td><strong>Other Charges</strong></td>
              <td>${planOtherDesc}</td>
              <td class="tc">—</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOtherCharge)}</td>
              <td class="tc">${defaultCgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcCgst)}</td>
              <td class="tc">${defaultSgstPct.toFixed(2)}%</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcSgst)}</td>
              <td class="tr" style="color:#c00">0.00</td>
              <td class="tr">${fmtIndianMoneyDecimal(planOcDue)}</td>
              <td class="tr">${fmtIndianMoneyDecimal(ocPaid)}</td>
              <td class="tr bold">${ocPayable === 0 ? '0' : '—'}</td>
            </tr>`;
          }

          // Guard against slight overpayment (advance receipt covers base+GST, totalDue tracks base only)
          const totalPayable = Math.max(0, totalDue - totalPaid);
          // Use DB-sourced interest when available (respects waivers)
          const effectiveInterest = totalInterestFromDB > 0 ? totalInterestFromDB : totalInterestCalc;
          const totalPayableWithInterest = Math.max(0, totalDue - totalPaid + effectiveInterest);
          const ratePerSqft = parseFloat(plan.booking_basic_rate_inr_sqft || 0) > 0
            ? parseFloat(plan.booking_basic_rate_inr_sqft)
            : (plan.carpet_area_sqft > 0
              ? (plan.base_price_inr || 0) / plan.carpet_area_sqft
              : 0);
          const lastDemand = demandsRes.rows[demandsRes.rows.length - 1];
          // Compute last due date across all rows
          const lastDueDate = demandsRes.rows.reduce((acc: Date | null, dm: any) => {
            const d = dm.due_date ? new Date(dm.due_date)
              : (allotmentDate && dm.due_date_offset_days != null
                ? new Date(+allotmentDate + parseInt(dm.due_date_offset_days) * 86400000)
                : null);
            return d && (!acc || d > acc) ? d : acc;
          }, null);

          mergeData = {
            // Consumer
            consumerName: plan.consumer_name || d?.name || '—',
            fatherName: plan.father_name || d?.father_name || '—',
            coApplicants: coApplicants || '—',
            coApplicantRow: coRes.rows.length > 0
              ? `<div class="info-row"><span class="info-lbl">Co-Applicant(s)</span><span class="info-val">${coApplicants}</span></div>`
              : '',
            mobile: plan.mobile || d?.mobile || '—',
            email: plan.email || d?.email || '—',
            customerId: plan.registration_no || d?.registration_no || '—',
            address: plan.present_address || d?.present_address || '—',
            incomeCategory: plan.income_category || '—',
            // Unit
            unitNumber: plan.unit_number || d?.unit_number || '—',
            unitCategory: plan.bhk_type || d?.bhk_type || '—',
            towerName: plan.tower_name || '—',
            floorNo: ordinalFloor(plan.floor),
            carpetArea: plan.carpet_area_sqft ? fmtIndianAreaDecimal(parseFloat(plan.carpet_area_sqft)) : '—',
            balconyArea: plan.balcony_area_sqft ? fmtIndianAreaDecimal(parseFloat(plan.balcony_area_sqft)) : '0',
            superArea: plan.super_area_sqft ? fmtIndianAreaDecimal(parseFloat(plan.super_area_sqft)) : '—',
            facing: plan.facing || '—',
            ratePerSqft: fmtIndianMoneyDecimal(ratePerSqft),
            // Project
            projectName: plan.project_name || d?.project_name || '—',
            projectSector: plan.project_location || d?.project_sector || '—',
            projectLocation: plan.project_location || '—',
            reraNo: plan.rera_number || d?.project_rera || '—',
            // Dates
            allotmentDate: fmtDateIndia(plan.allotment_date),
            bookingDate: fmtDateIndia(plan.booking_date),
            dueDate: lastDueDate ? fmtDateIndia(lastDueDate) : (dueDate ? fmtDateIndia(new Date(dueDate)) : '—'),
            invoiceDate: dueDate ? fmtDateIndia(new Date(dueDate)) : fmtDateIndia(new Date()),
            currentDate: fmtDateIndia(new Date()),
            day: String(new Date().getDate()),
            month: new Date().toLocaleString('en-IN', { month: 'long' }),
            year: String(new Date().getFullYear()),
            // Payment plan
            planName: plan.plan_name || '—',
            totalAmount: plan.total_amount_inr ? fmtIndianMoneyDecimal(parseFloat(plan.total_amount_inr)) : '—',
            // Company identity
            companyName: settings['company_name'] || 'ROF INFRATECH & HOUSING PVT. LTD.',
            // Demand rows & totals
            demandRows: rowsNoInterest,
            demandRowsWithInterest: rowsWithInterest,
            totalDue: fmtIndianMoneyDecimal(totalDue),
            totalPaid: fmtIndianMoneyDecimal(totalPaid),
            // Use DB total if available, fallback to live computed value
            totalInterest: fmtIndianMoneyDecimal(
              totalInterestFromDB > 0 ? totalInterestFromDB : totalInterestCalc),
            totalInterestCalc: fmtIndianMoneyDecimal(totalInterestCalc),
            totalPayable: fmtIndianMoneyDecimal(totalPayable),
            totalPayableWithInterest: fmtIndianMoneyDecimal(totalPayableWithInterest),
            totalCgst: fmtIndianMoneyDecimal(totalCgst),
            totalSgst: fmtIndianMoneyDecimal(totalSgst),
            totalGstAmount: fmtIndianMoneyDecimal(totalCgst + totalSgst),
            amountInWords: numberToWordsIndian(totalPayable),
            amountInWordsWithInterest: numberToWordsIndian(totalPayableWithInterest),
            totalPayableWords: numberToWordsIndian(totalPayable),
            // Bank / RTGS
            bankCompanyName: settings['bank_company_name'] || '—',
            bankAccountNo: settings['bank_account_no'] || '—',
            bankIfsc: settings['bank_ifsc'] || '—',
            bankName: settings['bank_name'] || '—',
            bankBranch: settings['bank_branch'] || '—',
            // Company identity (GST compliance)
            companyCin: settings['company_cin'] || '—',
            companyAddress: settings['company_address'] || '—',
            companyRegAddr: settings['company_reg_addr'] || '—',
            companyGstin: settings['company_gstin'] || '—',
            placeOfSupply: settings['place_of_supply'] || '—',
            companyPhone: settings['company_phone'] || '—',
            companyWebsite: settings['company_website'] || '—',
            companyEmail: settings['company_email'] || '—',
            // Notes
            demandNote1: settings['demand_note_1'] || '',
            demandNote2: settings['demand_note_2'] || '',
            demandNote3: settings['demand_note_3'] || '',
            demandNote4: settings['demand_note_4'] || '',
            penalRate: penalRate.toFixed(2),
            bookingAmountRaw: String(parseFloat(plan.booking_amount || 0)),
            totalReceivedRaw: String(parseFloat(plan.total_received_inr || 0)),
            bookingPaymentMode: plan.booking_payment_mode || '',
            bookingPaymentRef: plan.booking_payment_ref || '',
            bookingBankName: plan.booking_bank_name || '',
            bookingChequeDate: plan.booking_cheque_date ? fmtDateIndia(plan.booking_cheque_date) : '',
          };

          // Override with per-project company if available
          if (projCompany) {
            if (projCompany.name)              mergeData.companyName        = projCompany.name;
            if (projCompany.cin)               mergeData.companyCin         = projCompany.cin;
            if (projCompany.gstin)             mergeData.companyGstin       = projCompany.gstin;
            if (projCompany.address1)          mergeData.companyAddress     = projCompany.address1;
            if (projCompany.reg_address)       mergeData.companyRegAddr     = projCompany.reg_address;
            if (projCompany.phone)             mergeData.companyPhone       = projCompany.phone;
            if (projCompany.website)           mergeData.companyWebsite     = projCompany.website;
            if (projCompany.email)             mergeData.companyEmail       = projCompany.email;
            if (projCompany.place_of_supply)   mergeData.placeOfSupply      = projCompany.place_of_supply;
            if (projCompany.logo_url)          (mergeData as any).companyLogoUrl = projCompany.logo_url;
            if (projCompany.bank_company_name) mergeData.bankCompanyName    = projCompany.bank_company_name;
            if (projCompany.bank_account_no)   mergeData.bankAccountNo      = projCompany.bank_account_no;
            if (projCompany.bank_ifsc)         mergeData.bankIfsc           = projCompany.bank_ifsc;
            if (projCompany.bank_name)         mergeData.bankName           = projCompany.bank_name;
            if (projCompany.bank_branch)       mergeData.bankBranch         = projCompany.bank_branch;
          }

          // Advance Payment Adjustment section removed — not shown in letter
  ctx.mergeData = mergeData;
  ctx.htmlContent = htmlContent;
}
