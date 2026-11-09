// Figures for the check list and the three legal letters (allotment, agreement for sale, conveyance deed).
import { db } from '../../index.js';
import { companyBankCols } from '../../utils/company-bank.js';
import { bad, realRera } from '../../utils/input.js';
import { applyRecalc, extractFieldValue, buildEditScript } from '../../utils/document-recalc.js';
import { writebackField, WritebackContext } from '../../utils/document-writeback.js';
import { applyWaterfall, buildInterestRows, WaterfallReceipt, WaterfallDemand } from '../../utils/payment-waterfall.js';
import { numberToWordsIndian, ordinalFloor, fmtDateIndia, fmtIndianNumber, fmtIndianNumberDecimal, fmtIndianMoneyDecimal, fmtIndianAreaDecimal } from './shells.js';
import { penalRateFrom } from '../../utils/penal-rate.js';
import { GenCtx } from './merge-demand.js';
import { SQL_TODAY, businessDayStart } from '../../utils/business-date.js';
// Check list
export async function checkListData(ctx: GenCtx): Promise<void> {
  const { req, consumerId, allocationId, template, d, includeAllDemands, dueDate } = ctx;
  let { mergeData, htmlContent } = ctx;
          const settingsResCL = await db.query(`SELECT key, value FROM global_settings`);
          const settingsCL: Record<string, string> = {};
          settingsResCL.rows.forEach((r: any) => { settingsCL[r.key] = r.value; });

          // Fetch per-project company details (overrides global_settings if found) —
          // same query as Demand Letter's per-project company resolution
          const projCompanyResCL = await db.query(`
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
          const projCompanyCL = projCompanyResCL.rows[0] || null;

          // Consumer + unit + tower + project + payment_plan — same
          // three-level fallback (allocation → payment_plan → booking_record)
          // as Demand Letter's planRes query
          const planResCL = await db.query(`
            SELECT
              c.name AS consumer_name, c.father_name, c.mobile, c.email,
              c.registration_no, c.present_address, c.nationality,
              c.interest_start_date, c.grace_period_days,
              COALESCE(u_al.unit_number, u_pp.unit_number, u_br.unit_number) AS unit_number,
              COALESCE(u_al.carpet_area_sqft, u_pp.carpet_area_sqft, u_br.carpet_area_sqft) AS carpet_area_sqft,
              COALESCE(u_al.balcony_area_sqft, u_pp.balcony_area_sqft, u_br.balcony_area_sqft) AS balcony_area_sqft,
              COALESCE(p_al.name, p_pp.name, p_br.name) AS project_name,
              COALESCE(p_al.id, p_pp.id, p_br.id) AS project_id,
              COALESCE(
                NULLIF(br.selected_plan_name, ''),
                (SELECT DISTINCT plan_name FROM plan_schedule_templates
                 WHERE project_id = COALESCE(p_al.id, p_pp.id, p_br.id) ORDER BY plan_name ASC LIMIT 1),
                'CLP'
              ) AS plan_name,
              br.booking_date,
              COALESCE(br.basic_rate_inr_sqft, 0) AS booking_basic_rate_inr_sqft,
              COALESCE(br.carpet_area_sqft, 0) AS booking_carpet_area_sqft,
              COALESCE(br.payment_mode, '') AS booking_payment_mode,
              br.balcony_charge_amount,
              br.balcony_cgst_amount,
              br.balcony_sgst_amount
            FROM consumers c
            LEFT JOIN LATERAL (
              SELECT * FROM allocations WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) al ON true
            LEFT JOIN units u_al ON u_al.id = al.unit_id
            LEFT JOIN projects p_al ON p_al.id = u_al.project_id
            LEFT JOIN payment_plans pp ON pp.consumer_id = c.id
            LEFT JOIN units u_pp ON u_pp.id = pp.unit_id
            LEFT JOIN projects p_pp ON p_pp.id = pp.project_id
            LEFT JOIN LATERAL (
              SELECT * FROM booking_records WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1
            ) br ON true
            LEFT JOIN units u_br ON u_br.id = br.unit_id
            LEFT JOIN projects p_br ON p_br.id = br.project_id
            WHERE c.id = $1
            ORDER BY pp.created_at DESC
            LIMIT 1
          `, [consumerId]);
          const planCL = planResCL.rows[0] || {};
          const projectIdCL = planCL.project_id;

          const coResCL = await db.query(
            `SELECT name, relationship FROM co_applicants WHERE consumer_id = $1 ORDER BY created_at ASC LIMIT 3`,
            [consumerId]
          );
          const coApplicantsCL = coResCL.rows
            .map((r: any) => r.name + (r.relationship ? ` (${r.relationship})` : ''))
            .join(', ');

          // Basic Price — sourced directly from rate × carpet area (real,
          // standalone), NOT from Demand Letter's per-installment split,
          // which folds addon charges into the Basic row. Sourcing
          // independently here avoids double-counting addon amounts that
          // are listed as their own rows below.
          const isNriCL = ['nri', 'oci', 'pio'].includes((planCL.nationality || '').toLowerCase());
          const gstPctCL = isNriCL ? 0 : 0.5;
          const bspRateCL = parseFloat(planCL.booking_basic_rate_inr_sqft || 0);
          const bspCarpetCL = parseFloat(planCL.booking_carpet_area_sqft || 0);
          const basicAmtCL = bspRateCL > 0 && bspCarpetCL > 0 ? Math.round(bspRateCL * bspCarpetCL) : 0;
          const basicCgstCL = Math.round(basicAmtCL * gstPctCL / 100);
          const basicSgstCL = Math.round(basicAmtCL * gstPctCL / 100);
          const basicDueCL = basicAmtCL + basicCgstCL + basicSgstCL;

          // Balcony Charge — direct from booking_records (real, standalone)
          const balconyAmtCL = parseFloat(planCL.balcony_charge_amount || 0);
          const balconyCgstCL = parseFloat(planCL.balcony_cgst_amount || 0);
          const balconySgstCL = parseFloat(planCL.balcony_sgst_amount || 0);
          const balconyDueCL = balconyAmtCL + balconyCgstCL + balconySgstCL;

          // Addon charges — one row per real, active consumer_addon_charges entry
          const addonResCL = await db.query(
            `SELECT charge_name, total_amount FROM consumer_addon_charges
             WHERE consumer_id = $1 AND status = 'active'
             ORDER BY effective_date ASC, created_at ASC`,
            [consumerId]
          );
          const addonRowsCL = addonResCL.rows.map((r: any) => ({
            label: r.charge_name || 'Addon Charge',
            due: parseFloat(r.total_amount || 0),
          }));

          const totalDueCL = basicDueCL + balconyDueCL + addonRowsCL.reduce((s: number, r: any) => s + r.due, 0);

          // Real total amount actually received (waterfall-allocated) —
          // same pattern as Demand Letter's totalPaid (documents.ts amtPaid
          // via wfMap). Used to prorate Receive across rows below, since
          // receipts are never tagged to a specific component in this schema.
          const [wfRcptsResCL, wfDemandsResCL] = await Promise.all([
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
          const allWfResultsCL = applyWaterfall(wfRcptsResCL.rows, wfDemandsResCL.rows);
          const totalPaidCL = allWfResultsCL.reduce((sum: number, w: any) => sum + (w.paid || 0), 0);

          // Interest — reuse buildInterestRows() with the same call signature
          // as Demand Letter (documents.ts:873-884), fed by ALL demands
          // (final statement, not date-cutoff based)
          let penalRateCL = penalRateFrom(settingsCL);
          if (projectIdCL) {
            try {
              const projRateResCL = await db.query(
                `SELECT rate_percent FROM project_interest_rates
                 WHERE project_id = $1 AND effective_from <= ${SQL_TODAY}
                 ORDER BY effective_from DESC LIMIT 1`,
                [projectIdCL]
              );
              if (projRateResCL.rows.length > 0) penalRateCL = parseFloat(projRateResCL.rows[0].rate_percent);
            } catch {
              // fall through to global rate
            }
          }

          const allInstallmentsResCL = await db.query(
            `SELECT DISTINCT ON (d.installment_index)
               COALESCE(pst.installment_index, d.installment_index) AS installment_index,
               COALESCE(pst.installment_name, d.demand_type, 'Installment') AS installment_name,
               pst.interest_rate_percent,
               d.id AS demand_id,
               d.amount_due_inr, d.cgst_amount, d.sgst_amount,
               d.addon_charge_amount, d.addon_cgst_amount, d.addon_sgst_amount,
               d.due_date
             FROM demands d
             LEFT JOIN plan_schedule_templates pst
               ON pst.project_id = $1 AND pst.plan_name = $2 AND pst.installment_index = d.installment_index
             WHERE d.consumer_id = $3
             ORDER BY d.installment_index ASC, d.created_at DESC`,
            [projectIdCL || null, planCL.plan_name || '', consumerId]
          );
          const demandsForIRCL = allInstallmentsResCL.rows.map((d: any) => ({
            id: String(d.demand_id),
            installment_index: Number(d.installment_index),
            installment_name: String(d.installment_name || '—'),
            due_date: d.due_date || null,
            amount_due_inr: d.amount_due_inr,
            interest_rate_percent: d.interest_rate_percent ? parseFloat(d.interest_rate_percent) : null,
            cgst_amount: d.cgst_amount,
            sgst_amount: d.sgst_amount,
            addon_charge_amount: d.addon_charge_amount,
            addon_cgst_amount: d.addon_cgst_amount,
            addon_sgst_amount: d.addon_sgst_amount,
          }));
          const irRowsCL = buildInterestRows(
            wfRcptsResCL.rows,
            demandsForIRCL,
            penalRateCL,
            {
              interestStartDate: planCL.interest_start_date ? new Date(String(planCL.interest_start_date)) : null,
              gracePeriodDays: parseInt(String(planCL.grace_period_days || 0)),
              asOfDate: businessDayStart(),
            }
          );
          const totalInterestCalcCL = irRowsCL.reduce((sum: number, ir: any) => sum + ir.interest_amount, 0);

          // Admin-approved interest amounts (respects waivers) take precedence, same as Demand Letter
          const piResCL = await db.query<{ net_interest_inr: number }>(
            `SELECT COALESCE(SUM(GREATEST(0, COALESCE(amount_inr,0) - COALESCE(interest_waived_inr,0))), 0) AS net_interest_inr
             FROM penal_interests WHERE consumer_id = $1`,
            [consumerId]
          );
          const totalInterestFromDBCL = Number(piResCL.rows[0]?.net_interest_inr || 0);
          const dueIntCL = totalInterestFromDBCL > 0 ? totalInterestFromDBCL : totalInterestCalcCL;

          const waiverResCL = await db.query<{ total_waived: number }>(
            `SELECT COALESCE(SUM(interest_waived_inr), 0) AS total_waived FROM penal_interests WHERE consumer_id = $1`,
            [consumerId]
          );
          const waiverIntCL = Number(waiverResCL.rows[0]?.total_waived || 0);

          // No mechanism in this schema splits a receipt into principal vs.
          // interest portions, so "interest received" cannot be honestly
          // derived from real payment data. Reported as 0 rather than fabricated.
          const receiveIntCL = 0;
          const balanceIntCL = Math.max(0, dueIntCL - receiveIntCL - waiverIntCL);

          // Build financial rows — Receive per row is prorated from the one
          // real, exact figure (totalPaidCL) by each row's Due share, since
          // receipts are never tagged to a specific component in this schema.
          const buildRowCL = (label: string, due: number) => {
            const receive = totalDueCL > 0 ? totalPaidCL * (due / totalDueCL) : 0;
            const balance = Math.max(0, due - receive);
            return `<tr>
              <td>${label}</td>
              <td class="tr">${fmtIndianMoneyDecimal(due)}</td>
              <td class="tr">${fmtIndianMoneyDecimal(receive)}</td>
              <td class="tr">0</td>
              <td class="tr">0</td>
              <td class="tr">0</td>
              <td class="tr">0</td>
              <td class="tr bold">${fmtIndianMoneyDecimal(balance)}</td>
            </tr>`;
          };

          let financeRowsCL = buildRowCL('Basic Price', basicDueCL);
          financeRowsCL += buildRowCL('Balcony Charge', balconyDueCL);
          for (const r of addonRowsCL) {
            financeRowsCL += buildRowCL(r.label, r.due);
          }
          const totalReceiveCL = totalPaidCL;
          const totalBalanceCL = Math.max(0, totalDueCL - totalReceiveCL);
          financeRowsCL += `<tr>
            <td class="bold">Total</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(totalDueCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(totalReceiveCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(dueIntCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(receiveIntCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(waiverIntCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(balanceIntCL)}</td>
            <td class="tr bold">${fmtIndianMoneyDecimal(totalBalanceCL)}</td>
          </tr>`;

          const totalAmountReceivedABCL = fmtIndianMoneyDecimal(totalReceiveCL + receiveIntCL);

          mergeData = {
            consumerName: planCL.consumer_name || d?.name || '—',
            coApplicants: coApplicantsCL || '—',
            customerId: planCL.registration_no || d?.registration_no || '—',
            printDate: fmtDateIndia(businessDayStart()),
            bookingDate: fmtDateIndia(planCL.booking_date),
            paymentMode: planCL.booking_payment_mode || '—',
            projectName: planCL.project_name || d?.project_name || '—',
            unitNumber: planCL.unit_number || d?.unit_number || '—',
            carpetArea: planCL.carpet_area_sqft ? fmtIndianAreaDecimal(parseFloat(planCL.carpet_area_sqft)) : '—',
            balconyArea: planCL.balcony_area_sqft ? fmtIndianAreaDecimal(parseFloat(planCL.balcony_area_sqft)) : '0',
            currentDate: fmtDateIndia(businessDayStart()),
            companyName: settingsCL['company_name'] || 'ROF INFRATECH & HOUSING PVT. LTD.',
            companyCin: settingsCL['company_cin'] || '—',
            companyAddress: settingsCL['company_address'] || '—',
            financeRows: financeRowsCL,
            totalAmountReceivedAB: totalAmountReceivedABCL,
          };

          // Override with per-project company if available (same precedence as Demand Letter)
          if (projCompanyCL) {
            if (projCompanyCL.name)     mergeData.companyName    = projCompanyCL.name;
            if (projCompanyCL.cin)      mergeData.companyCin     = projCompanyCL.cin;
            if (projCompanyCL.address1) mergeData.companyAddress = projCompanyCL.address1;
          }
  ctx.mergeData = mergeData;
  ctx.htmlContent = htmlContent;
}
// Allotment letter
export async function allotmentLetterData(ctx: GenCtx): Promise<void> {
  const { req, consumerId, allocationId, template, d, includeAllDemands, dueDate } = ctx;
  let { mergeData, htmlContent } = ctx;

          // Fetch global settings
          const settingsRes2 = await db.query(`SELECT key, value FROM global_settings`);
          const s2: Record<string, string> = {};
          settingsRes2.rows.forEach((r: any) => { s2[r.key] = r.value; });

          // Resolve allocationId — use body param or look up latest for this consumer
          let resolvedAllocId = allocationId as string | null;
          if (!resolvedAllocId) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId) {
            throw bad('No allocation found for this consumer', 400);
          }

          // Main data fetch — allocation as anchor
          const alRes = await db.query(`
            SELECT
              c.first_name, c.last_name,
              COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''),
                       c.name, '—') AS consumer_full_name,
              c.father_name,
              c.nationality,
              c.present_address, c.present_city, c.present_state, c.present_pin,
              c.phone_no AS landline_no,
              c.mobile, c.email,
              c.pan_no, c.aadhaar_no,
              c.registration_no,
              a.id AS allotment_id,
              a.consumer_id,
              a.unit_id,
              a.allotment_date,
              u.unit_number, u.bhk_type,
              u.floor,
              u.carpet_area_sqft,
              u.balcony_area_sqft,
              u.base_price_inr,
              u.total_price_inr,
              COALESCE(t.tower_name, 'N/A') AS tower_name,
              p.name AS project_name,
              p.location AS project_location,
              p.rera_number,
              p.possession_date,
              p.tcp_licence,
              p.id AS project_id,
              COALESCE(br.booking_amount, 0) AS earnest_amount,
              COALESCE(br.payment_mode, 'N/A') AS payment_mode,
              COALESCE(NULLIF(br.payment_ref,''), 'N/A') AS payment_ref,
              br.cheque_date,
              COALESCE(NULLIF(br.bank_name,''), 'N/A') AS booking_bank_name,
              COALESCE(NULLIF(br.bank_branch,''), 'N/A') AS booking_bank_branch,
              COALESCE(NULLIF(br.selected_plan_name,''), 'CLP') AS selected_plan_name
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN LATERAL (
              SELECT * FROM booking_records
              WHERE consumer_id = a.consumer_id AND project_id = a.project_id
              ORDER BY created_at DESC LIMIT 1
            ) br ON true
            WHERE a.id = $1
          `, [resolvedAllocId]);

          const al = alRes.rows[0];
          if (!al) throw bad('Allocation data not found', 404);

          const projectId2 = al.project_id;
          const planName2  = al.selected_plan_name || 'CLP';

          // Fetch payment plan total — includes PLC and other charges (not base-only like units.total_price_inr)
          const ppRes = await db.query(
            `SELECT total_amount_inr FROM payment_plans
             WHERE consumer_id = $1 AND unit_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [al.consumer_id, al.unit_id]
          );
          const totalPriceInr = parseFloat(
            ppRes.rows[0]?.total_amount_inr || al.total_price_inr || 0
          );

          // Fetch payment plan installments with fallback to first available plan
          let schedRows = await db.query(`
            SELECT installment_index, installment_name,
                   COALESCE(percentage, 0) AS percentage, flat_amount_inr
            FROM plan_schedule_templates
            WHERE project_id = $1 AND plan_name = $2
            ORDER BY installment_index
          `, [projectId2, planName2]);

          // Fallback to first plan if no rows
          if (schedRows.rows.length === 0) {
            const firstPlan = await db.query(
              `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC LIMIT 1`,
              [projectId2]
            );
            const fallbackPlan = firstPlan.rows[0]?.plan_name || 'CLP';
            schedRows = await db.query(`
              SELECT installment_index, installment_name,
                     COALESCE(percentage, 0) AS percentage, flat_amount_inr
              FROM plan_schedule_templates
              WHERE project_id = $1 AND plan_name = $2
              ORDER BY installment_index
            `, [projectId2, fallbackPlan]);
          }

          // Build payment schedule HTML rows — all cells tagged for inline editing
          let paymentScheduleRows = '';
          schedRows.rows.forEach((row: any, idx: number) => {
            const pct = parseFloat(row.percentage || 0);
            const amt = row.flat_amount_inr
              ? parseFloat(row.flat_amount_inr)
              : Math.round((pct / 100) * totalPriceInr);
            paymentScheduleRows += `<tr>
              <td class="tc">${idx + 1}</td>
              <td><span data-field-key="scheduleInstallmentName_${idx}" data-field-label="Schedule Installment (Row ${idx})" data-value-type="text" data-section="payment_schedule">${row.installment_name || 'Installment'}</span></td>
              <td class="tc"><span data-field-key="schedulePercentage_${idx}" data-field-label="Schedule Percentage (Row ${idx})" data-value-type="percentage" data-section="payment_schedule">${pct.toFixed(2)}</span>%</td>
              <td class="tr">&#8377; <span data-field-key="scheduleAmount_${idx}" data-field-label="Schedule Amount (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianMoneyDecimal(amt)}</span></td>
            </tr>`;
          });

          // Address string
          const addrParts = [al.present_address, al.present_city, al.present_state, al.present_pin]
            .filter(Boolean).join(', ');
          const consumerAddress = addrParts || 'N/A';

          // Rate per sqft
          const carpetSqft2 = parseFloat(al.carpet_area_sqft || 0);
          const ratePerSqft2 = carpetSqft2 > 0
            ? fmtIndianMoneyDecimal(totalPriceInr / carpetSqft2)
            : 'N/A';

          mergeData = {
            // Company
            companyName:    s2['company_name']    || 'ROF INFRATECH & HOUSING PVT. LTD.',
            companyAddress: s2['company_address']  || '—',
            companyPhone:   s2['company_phone']    || '—',
            companyEmail:   s2['company_email']    || '—',
            // Bank
            bankCompanyName: s2['bank_company_name'] || s2['company_name'] || '—',
            bankAccountNo:   s2['bank_account_no']   || '—',
            bankIfsc:        s2['bank_ifsc']          || '—',
            bankName:        s2['bank_name']          || '—',
            bankBranch:      s2['bank_branch']        || '—',
            // Dates
            letterDate:    fmtDateIndia(businessDayStart()),
            // Consumer
            consumerFullName: al.consumer_full_name || '—',
            consumerAddress:  consumerAddress,
            consumerMobile:   al.mobile     || 'N/A',
            consumerEmail:    al.email      || 'N/A',
            registrationNo:   al.registration_no || '—',
            bookingDate:      fmtDateIndia(al.allotment_date),
            fatherName:       al.father_name || 'N/A',
            nationality:      al.nationality || 'N/A',
            pinCode:          al.present_pin || 'N/A',
            landlineNo:       al.landline_no || 'N/A',
            panNo:            al.pan_no      || 'N/A',
            aadhaarNo:        al.aadhaar_no  || 'N/A',
            // Project
            projectName:             al.project_name      || '—',
            projectLocation:         al.project_location  || 'N/A',
            hareraNo:                realRera(al.rera_number),
            hareraDate:              'N/A',
            natureOfProject:         'N/A',
            proposedCompletionDate:  'N/A',
            proposedPossessionDate:  al.possession_date ? fmtDateIndia(al.possession_date) : 'N/A',
            licenseNo:               al.tcp_licence || 'N/A',
            licenseeName:            'N/A',
            collaboratorName:        'N/A',
            licenseMemoNo:           'N/A',
            licenseDate:             'N/A',
            licenseValidUpto:        'N/A',
            buildingPlanMemoNo:      'N/A',
            buildingPlanDate:        'N/A',
            buildingPlanValidUpto:   'N/A',
            envClearanceFileNo:      'N/A',
            envClearanceDate:        'N/A',
            // Unit
            unitNumber:       al.unit_number || '—',
            bhkType:          al.bhk_type    || 'N/A',
            carpetArea:       carpetSqft2 > 0 ? parseFloat(al.carpet_area_sqft).toFixed(3) : 'N/A',
            balconyArea:      al.balcony_area_sqft ? parseFloat(al.balcony_area_sqft).toFixed(3) : 'N/A',
            towerName:        al.tower_name  || 'N/A',
            floorNo:          ordinalFloor(al.floor),
            ratePerSqft:      ratePerSqft2,
            totalConsideration: fmtIndianMoneyDecimal(totalPriceInr),
            // Booking / Earnest money
            earnestAmount:       fmtIndianMoneyDecimal(parseFloat(al.earnest_amount || 0)),
            paymentRef:          al.payment_ref        || 'N/A',
            chequeDate:          al.cheque_date ? fmtDateIndia(al.cheque_date) : 'N/A',
            bookingBankName:     al.booking_bank_name  || 'N/A',
            bookingBankBranch:   al.booking_bank_branch|| 'N/A',
            // Payment plan
            selectedPlanName:    planName2,
            paymentScheduleRows: paymentScheduleRows,
          };

          // Override with per-project company for allotment letter
          const alCompanyRes = await db.query(`
            SELECT c.name, c.cin, c.gstin, c.address1, c.reg_address,
                   c.phone, c.website, c.email, c.place_of_supply, c.logo_url,
                   ${companyBankCols('c')}
            FROM companies c
            JOIN projects p ON p.company_id = c.id
            JOIN allocations al2 ON al2.unit_id IN (
              SELECT id FROM units WHERE project_id = p.id
            )
            WHERE al2.id = $1 LIMIT 1`, [resolvedAllocId]);
          const alCompany = alCompanyRes.rows[0] || null;
          if (alCompany) {
            if (alCompany.name)              mergeData.companyName        = alCompany.name;
            if (alCompany.address1)          mergeData.companyAddress     = alCompany.address1;
            if (alCompany.phone)             mergeData.companyPhone       = alCompany.phone;
            if (alCompany.email)             mergeData.companyEmail       = alCompany.email;
            if (alCompany.bank_company_name) mergeData.bankCompanyName    = alCompany.bank_company_name;
            if (alCompany.bank_account_no)   mergeData.bankAccountNo      = alCompany.bank_account_no;
            if (alCompany.bank_ifsc)         mergeData.bankIfsc           = alCompany.bank_ifsc;
            if (alCompany.bank_name)         mergeData.bankName           = alCompany.bank_name;
            if (alCompany.bank_branch)       mergeData.bankBranch         = alCompany.bank_branch;
          }

          // Override htmlContent with the file-based template
          try {
            const fsM = await import('fs');
            const pathM = await import('path');
            const currentDir = __dirname;
            const templatePath2 = pathM.resolve(currentDir, '../../db/allotment_letter_template.html');
            if (fsM.existsSync(templatePath2)) {
              htmlContent = fsM.readFileSync(templatePath2, 'utf8');
            }
          } catch (_e) { /* fallback to DB stub template */ }
  ctx.mergeData = mergeData;
  ctx.htmlContent = htmlContent;
}
// Agreement for sale (ATS)
export async function buyerBuilderAgreementData(ctx: GenCtx): Promise<void> {
  const { req, consumerId, allocationId, template, d, includeAllDemands, dueDate } = ctx;
  let { mergeData, htmlContent } = ctx;
          const settingsRes3 = await db.query(`SELECT key, value FROM global_settings`);
          const s3: Record<string, string> = {};
          settingsRes3.rows.forEach((r: any) => { s3[r.key] = r.value; });

          // Resolve allocationId
          let resolvedAllocId3 = allocationId as string | null;
          if (!resolvedAllocId3) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId3 = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId3) {
            throw bad('No allocation found for this consumer', 400);
          }


          // Main data fetch
          const atsRes = await db.query(`
            SELECT
              c.first_name, c.last_name, c.father_name, c.age, c.pan_no, c.aadhaar_no,
              c.present_address, c.mobile, c.email,
              a.id AS allotment_id, a.agreement_date,
              u.unit_number, u.bhk_type, u.floor, u.carpet_area_sqft, u.balcony_area_sqft, u.base_price_inr, u.total_price_inr,
              t.tower_name,
              p.name AS project_name, p.location, p.rera_number, p.tcp_licence as license_no, p.license_date,
              p.env_clearance_no, p.env_clearance_date, p.building_plan_memo_no, p.building_plan_date,
              p.land_owner_name, p.land_owner_llpin, p.land_owner_pan, p.land_owner_address,
              p.land_owner_gpa_vasika_no, p.land_owner_gpa_date, p.sale_deed_no, p.sale_deed_date,
              p.collaboration_agreement_date, p.khasra_details, p.village_name, p.sector_name, p.sub_registrar_office,
              p.authorised_signatory_name, p.authorised_signatory_aadhaar, p.board_resolution_date,
              p.id AS project_id, c.id AS consumer_id,
              br.booking_amount, br.selected_plan_name, br.balcony_charge_amount, br.basic_rate_inr_sqft,
              co.name AS company_name, co.cin, co.address1 AS promoter_address, co.pan_no AS company_pan
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN booking_records br ON br.consumer_id = a.consumer_id AND br.project_id = a.project_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE a.id = $1
          `, [resolvedAllocId3]);

          const ats = atsRes.rows[0];
          if (!ats) throw bad('Allocation data not found', 404);

          const projectId3 = ats.project_id;
          const planName3 = ats.selected_plan_name || 'CLP';

          // Fetch payment plan schedule
          let schedRes3 = await db.query(`
            SELECT installment_index, installment_name, COALESCE(percentage, 0) AS percentage, flat_amount_inr
            FROM plan_schedule_templates
            WHERE project_id = $1 AND plan_name = $2
            ORDER BY installment_index
          `, [projectId3, planName3]);

          if (schedRes3.rows.length === 0) {
            const firstPlan3 = await db.query(
              `SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name ASC LIMIT 1`,
              [projectId3]
            );
            const fallbackPlan3 = firstPlan3.rows[0]?.plan_name || 'CLP';
            schedRes3 = await db.query(`
              SELECT installment_index, installment_name, COALESCE(percentage, 0) AS percentage, flat_amount_inr
              FROM plan_schedule_templates
              WHERE project_id = $1 AND plan_name = $2
              ORDER BY installment_index
            `, [projectId3, fallbackPlan3]);
          }

          let totalPrice3 = parseFloat(ats.total_price_inr || 0);
          let paymentPlanRows = '';
          schedRes3.rows.forEach((row: any, idx: number) => {
            const pct = parseFloat(row.percentage || 0);
            const amt = row.flat_amount_inr
              ? parseFloat(row.flat_amount_inr)
              : Math.round((pct / 100) * totalPrice3);
            paymentPlanRows += `<tr>
              <td>${idx + 1}</td>
              <td>${row.installment_name || 'Installment'}</td>
              <td>${pct.toFixed(2)}%</td>
              <td>₹ ${fmtIndianMoneyDecimal(amt)}</td>
            </tr>`;
          });

          const carpetSqft3 = parseFloat(ats.carpet_area_sqft || 0);
          const balconySqft3 = parseFloat(ats.balcony_area_sqft || 0);
          const hasStoredBalcony3 = ats.balcony_charge_amount !== null && ats.balcony_charge_amount !== undefined;

          let basicPrice3: number;
          let balconyPrice3: number;
          if (hasStoredBalcony3) {
            basicPrice3 = Math.round(parseFloat(ats.basic_rate_inr_sqft || 0) * carpetSqft3);
            balconyPrice3 = parseFloat(ats.balcony_charge_amount || 0);
            totalPrice3 = basicPrice3 + balconyPrice3;
          } else {
            basicPrice3 = parseFloat(ats.base_price_inr || 0);
            balconyPrice3 = totalPrice3 - basicPrice3;
          }

          const basicRate3 = carpetSqft3 > 0 ? basicPrice3 / carpetSqft3 : 0;
          const balconyRate3 = balconySqft3 > 0 ? balconyPrice3 / balconySqft3 : 0;
          const bookingPct3 = (parseFloat(ats.booking_amount || 0) / totalPrice3 * 100).toFixed(2);

          mergeData = {
            allottee_name: `${ats.first_name || ''} ${ats.last_name || ''}`.trim() || '—',
            allottee_relation: 'S/o',
            allottee_relative_name: ats.father_name || '—',
            allottee_address: ats.present_address || '—',
            allottee_age: ats.age ? String(ats.age) : '—',
            allottee_aadhaar: ats.aadhaar_no || '—',
            allottee_pan: ats.pan_no || '—',
            promoter_name: ats.company_name || '—',
            promoter_cin: ats.cin || '—',
            promoter_pan: ats.company_pan || '—',
            promoter_address: ats.promoter_address || '—',
            project_name: (ats.project_name || '—').replace(/_TEST$/i, '').trim() || '—',
            harera_reg_no: realRera(ats.rera_number, '—'),
            license_no: ats.license_no || '—',
            license_date: fmtDateIndia(ats.license_date),
            village_name: ats.village_name || '—',
            sector_name: ats.sector_name || '—',
            district_name: ats.location || '—',
            env_clearance_no: ats.env_clearance_no || '—',
            env_clearance_date: fmtDateIndia(ats.env_clearance_date),
            building_plan_memo_no: ats.building_plan_memo_no || '—',
            building_plan_date: fmtDateIndia(ats.building_plan_date),
            land_owner_name: ats.land_owner_name || '—',
            land_owner_llpin: ats.land_owner_llpin || '—',
            land_owner_pan: ats.land_owner_pan || '—',
            land_owner_address: ats.land_owner_address || '—',
            land_owner_gpa_vasika_no: ats.land_owner_gpa_vasika_no || '—',
            land_owner_gpa_date: fmtDateIndia(ats.land_owner_gpa_date),
            sale_deed_no: ats.sale_deed_no || '—',
            sale_deed_date: fmtDateIndia(ats.sale_deed_date),
            collab_agreement_date: fmtDateIndia(ats.collaboration_agreement_date),
            flat_no: ats.unit_number || '—',
            tower_name: ats.tower_name || '—',
            floor_no: ordinalFloor(ats.floor),
            unit_type: ats.bhk_type || '—',
            carpet_area: carpetSqft3 > 0 ? carpetSqft3.toFixed(3) : '___',
            carpet_area_raw: carpetSqft3 > 0 ? carpetSqft3.toFixed(3) : '0',
            balcony_area: balconySqft3 > 0 ? balconySqft3.toFixed(3) : '___',
            balcony_area_raw: balconySqft3 > 0 ? balconySqft3.toFixed(3) : '0',
            parking_no: '—',
            total_price: fmtIndianNumberDecimal(totalPrice3),
            total_price_words: numberToWordsIndian(totalPrice3),
            basic_price: fmtIndianMoneyDecimal(basicPrice3),
            basic_price_words: numberToWordsIndian(basicPrice3),
            balcony_price: fmtIndianNumberDecimal(balconyPrice3),
            balcony_price_words: numberToWordsIndian(balconyPrice3),
            rate_per_sqft: fmtIndianMoneyDecimal(basicRate3),
            balcony_rate: balconyRate3.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
            booking_amount: fmtIndianMoneyDecimal(parseFloat(ats.booking_amount || 0)),
            booking_amount_words: numberToWordsIndian(parseFloat(ats.booking_amount || 0)),
            booking_amount_pct: bookingPct3,
            application_no: ats.consumer_id?.slice(0, 8).toUpperCase() || '—',
            agreement_date: fmtDateIndia(ats.agreement_date || businessDayStart()),
            agreement_day: new Date(ats.agreement_date || businessDayStart()).getDate().toString(),
            agreement_month: new Date(ats.agreement_date || businessDayStart()).toLocaleString('en-IN', { month: 'long' }),
            agreement_year: new Date(ats.agreement_date || businessDayStart()).getFullYear().toString(),
            auth_signatory_name: ats.authorised_signatory_name || '—',
            board_resolution_date: fmtDateIndia(ats.board_resolution_date),
            payment_plan_rows: paymentPlanRows,
            sub_registrar_office: ats.sub_registrar_office || '—',
            khasra_details: ats.khasra_details || '—',
          };
  ctx.mergeData = mergeData;
  ctx.htmlContent = htmlContent;
}
// Conveyance deed
export async function conveyanceDeedData(ctx: GenCtx): Promise<void> {
  const { req, consumerId, allocationId, template, d, includeAllDemands, dueDate } = ctx;
  let { mergeData, htmlContent } = ctx;
          const settingsRes4 = await db.query(`SELECT key, value FROM global_settings`);
          const s4: Record<string, string> = {};
          settingsRes4.rows.forEach((r: any) => { s4[r.key] = r.value; });

          // Resolve allocationId
          let resolvedAllocId4 = allocationId as string | null;
          if (!resolvedAllocId4) {
            const aRes = await db.query(
              `SELECT id FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [consumerId]
            );
            resolvedAllocId4 = aRes.rows[0]?.id || null;
          }

          if (!resolvedAllocId4) {
            throw bad('No allocation found for this consumer', 400);
          }

          // Main data fetch
          const cdRes = await db.query(`
            SELECT
              c.first_name, c.last_name, c.father_name, c.pan_no, c.aadhaar_no,
              c.present_address,
              a.id AS allotment_id, a.allotment_date, a.conveyance_deed_date,
              u.unit_number, u.floor, u.carpet_area_sqft, u.balcony_area_sqft, u.total_price_inr,
              t.tower_name,
              p.name AS project_name, p.location, p.rera_number, p.tcp_licence as license_no,
              p.env_clearance_no, p.building_plan_memo_no,
              p.land_owner_name, p.land_owner_llpin, p.land_owner_pan, p.land_owner_address,
              p.land_owner_gpa_vasika_no, p.land_owner_gpa_date, p.sale_deed_no, p.sale_deed_date,
              p.collaboration_agreement_date, p.khasra_details, p.village_name, p.sector_name,
              p.occupation_cert_memo_no, p.occupation_cert_date,
              p.deed_of_declaration_vasika_no, p.deed_of_declaration_date,
              p.sub_registrar_office, p.authorised_signatory_name, p.authorised_signatory_aadhaar,
              p.board_resolution_date, p.id AS project_id, c.id AS consumer_id,
              co.name AS company_name, co.cin, co.address1 AS promoter_address, co.pan_no AS company_pan
            FROM allocations a
            JOIN consumers c ON c.id = a.consumer_id
            JOIN units u ON u.id = a.unit_id
            JOIN projects p ON p.id = a.project_id
            LEFT JOIN towers t ON t.id = u.tower_id
            LEFT JOIN companies co ON co.id = p.company_id
            WHERE a.id = $1
          `, [resolvedAllocId4]);

          const cd = cdRes.rows[0];
          if (!cd) throw bad('Allocation data not found', 404);

          const deedDate = cd.conveyance_deed_date ? new Date(cd.conveyance_deed_date) : businessDayStart();
          const deedDay = String(deedDate.getDate());
          const deedMonthNum = deedDate.getMonth();
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const deedMonth = monthNames[deedMonthNum];
          const deedYear = String(deedDate.getFullYear());

          const consideration = parseFloat(cd.total_price_inr || 0);

          mergeData = {
            vendee_name: `${cd.first_name || ''} ${cd.last_name || ''}`.trim() || '—',
            vendee_relation: 'S/o',
            vendee_relative_name: cd.father_name || '—',
            vendee_address: cd.present_address || '—',
            vendee_aadhaar: cd.aadhaar_no || '—',
            vendee_pan: cd.pan_no || '—',
            property_no: cd.unit_number || '—',
            tower_name: cd.tower_name || '—',
            floor_no: ordinalFloor(cd.floor),
            carpet_area: (() => { const val = parseFloat(cd.carpet_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '___'; })(),
            carpet_area_raw: (() => { const val = parseFloat(cd.carpet_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '0'; })(),
            balcony_area: (() => { const val = parseFloat(cd.balcony_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '___'; })(),
            balcony_area_raw: (() => { const val = parseFloat(cd.balcony_area_sqft || '0'); return val > 0 ? val.toFixed(3) : '0'; })(),
            parking_no: '—',
            allotment_letter_date: fmtDateIndia(cd.allotment_date),
            consideration: fmtIndianMoneyDecimal(consideration),
            consideration_words: numberToWordsIndian(consideration),
            stamp_duty: '—',
            e_stamp_no: '—',
            project_name: (cd.project_name || '—').replace(/_TEST$/i, '').trim() || '—',
            license_no: cd.license_no || '—',
            harera_reg_no: realRera(cd.rera_number, '—'),
            village_name: cd.village_name || '—',
            sector_name: cd.sector_name || '—',
            khasra_details: cd.khasra_details || '—',
            sale_deed_no: cd.sale_deed_no || '—',
            sale_deed_date: fmtDateIndia(cd.sale_deed_date),
            collab_agreement_date: fmtDateIndia(cd.collaboration_agreement_date),
            oc_memo_no: cd.occupation_cert_memo_no || '—',
            oc_date: fmtDateIndia(cd.occupation_cert_date),
            deed_of_declaration_vasika_no: cd.deed_of_declaration_vasika_no || '—',
            deed_of_declaration_date: fmtDateIndia(cd.deed_of_declaration_date),
            deed_day: deedDay,
            deed_month: deedMonth,
            deed_year: deedYear,
            auth_signatory_name: cd.authorised_signatory_name || '—',
            auth_signatory_aadhaar: cd.authorised_signatory_aadhaar || '—',
            board_resolution_date: fmtDateIndia(cd.board_resolution_date),
            promoter_name: cd.company_name || '—',
            promoter_cin: cd.cin || '—',
            promoter_address: cd.promoter_address || '—',
            promoter_pan: cd.company_pan || '—',
            land_owner_name: cd.land_owner_name || '—',
            land_owner_llpin: cd.land_owner_llpin || '—',
            land_owner_pan: cd.land_owner_pan || '—',
            land_owner_address: cd.land_owner_address || '—',
            land_owner_gpa_vasika_no: cd.land_owner_gpa_vasika_no || '—',
            land_owner_gpa_date: fmtDateIndia(cd.land_owner_gpa_date),
            sub_registrar_office: cd.sub_registrar_office || '—',
          };
  ctx.mergeData = mergeData;
  ctx.htmlContent = htmlContent;
}
