/**
 * Booking Routes
 * Handles booking form submission, list, view, and edit booking records
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { resolveGstForComponents, resolveRate } from '../utils/gst-resolver.js';
import { computeBalconyCharge } from '../utils/balcony-charge.js';
import { computeInclusiveGstSplit } from '../utils/gst-backward-derive.js';
import { recomputeAddonDemands } from './addon-charges.js';
import { checkAndAutoRaiseInstallment1, cascadeOverpaymentExcess } from '../utils/payment-waterfall.js';

const router = Router();

// Generate registration number with project-based prefix and sequential numbering
async function generateRegistrationNo(projectId: string, client: any): Promise<string> {
  const year = new Date().getFullYear();

  // Get project name for prefix
  const projResult = await client.query(
    'SELECT name FROM projects WHERE id = $1',
    [projectId]
  );

  if (projResult.rowCount === 0) {
    throw new Error('Project not found');
  }

  // Generate 4-letter code from project name
  // ROF ALANTE_TEST → ALAN
  // ROF GALLLERIA_TEST → GALL
  const projectName = projResult.rows[0].name
    .replace(/^ROF\s+/i, '')  // Remove "ROF " prefix
    .replace(/_TEST$/i, '')   // Remove "_TEST" suffix
    .replace(/[^A-Z]/gi, '')  // Keep only letters
    .toUpperCase()
    .substring(0, 4)           // Take first 4 letters
    .padEnd(4, 'X');           // Pad if shorter

  // Increment counter atomically
  let counterResult = await client.query(
    `UPDATE booking_counters
     SET last_number = last_number + 1,
         updated_at = NOW()
     WHERE project_id = $1
     RETURNING last_number`,
    [projectId]
  );

  if (counterResult.rowCount === 0) {
    // Insert if not exists (race condition safety)
    await client.query(
      `INSERT INTO booking_counters (project_id, last_number)
       VALUES ($1, 1)
       ON CONFLICT (project_id)
       DO UPDATE SET
         last_number = booking_counters.last_number + 1,
         updated_at = NOW()`,
      [projectId]
    );
    // Fetch the updated value
    counterResult = await client.query(
      'SELECT last_number FROM booking_counters WHERE project_id = $1',
      [projectId]
    );
  }

  const num = counterResult.rows[0].last_number;
  return `${projectName}-${year}-${String(num).padStart(4, '0')}`;
}

// GET /api/booking/check-cheque?ref=XXXX[&exclude_id=UUID]
// Returns whether a cheque/reference number already exists in booking_records or receipts.
// Must be registered BEFORE /:id so Express resolves it as a static path.
router.get('/check-cheque', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ref = (req.query.ref as string || '').trim();
    const excludeId = (req.query.exclude_id as string || '').trim() || null;

    if (!ref) {
      return res.status(400).json({ error: 'ref query parameter is required' });
    }

    // Run both table checks in parallel
    const [bookingResult, receiptResult] = await Promise.all([
      db.query(
        `SELECT id, registration_no, booking_date, payment_mode
         FROM booking_records
         WHERE payment_ref = $1
           AND status != 'cancelled'
           AND ($2::uuid IS NULL OR id != $2::uuid)
         LIMIT 1`,
        [ref, excludeId]
      ),
      db.query(
        `SELECT id, receipt_number, received_date, payment_method
         FROM receipts
         WHERE transaction_ref = $1
           AND status NOT IN ('bounced', 'cancelled')
         LIMIT 1`,
        [ref]
      ),
    ]);

    if (bookingResult.rows.length > 0) {
      const row = bookingResult.rows[0];
      return res.json({
        exists: true,
        found_in: 'booking',
        detail: {
          id: row.id,
          reference: row.registration_no,
          date: row.booking_date,
          type: row.payment_mode,
        },
      });
    }

    if (receiptResult.rows.length > 0) {
      const row = receiptResult.rows[0];
      return res.json({
        exists: true,
        found_in: 'receipt',
        detail: {
          id: row.id,
          reference: row.receipt_number,
          date: row.received_date,
          type: row.payment_method,
        },
      });
    }

    return res.json({ exists: false, found_in: null, detail: null });
  } catch (err) { next(err); }
});

// GET /api/booking/check-form-no?formNo=XXXX[&excludeId=UUID]
// Returns whether a form number is available (not used by any active booking).
router.get('/check-form-no', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { formNo, excludeId } = req.query as Record<string, string>;

    if (!formNo || !formNo.trim()) {
      return res.json({ available: true });
    }

    const result = await db.query(
      `SELECT id
       FROM booking_records
       WHERE form_no = $1
         AND status != 'cancelled'
         AND ($2::uuid IS NULL OR id != $2::uuid)
       LIMIT 1`,
      [formNo.trim(), excludeId || null]
    );

    if (result.rows.length > 0) {
      return res.json({
        available: false,
        message: `Form No. "${formNo.trim()}" is already in use.`,
      });
    }

    return res.json({ available: true });
  } catch (err) { next(err); }
});

// POST /api/booking
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      consumer_id, project_id, unit_id, booking_date, booking_amount,
      payment_mode, payment_ref, bank_name, cheque_date,
      company_inaugural_disc = 0, company_rebate_rs = 0, company_rebate_sqft = 0, company_rebate_pct = 0,
      broker_id, broker_commission, broker_commission_type,
      booking_type = 'direct', main_broker_id,
      broker_rebate_rs = 0, broker_rebate_sqft = 0, broker_rebate_pct = 0,
      mailing_address_type = 'present', communication_mode = 'email',
      comm_address_line1, comm_pin, comm_city, comm_state, comm_country,
      sales_employee_id, nominee_name, nominee_relation,
      loan_amount, finance_bank, remarks, form_no,
      has_plc = false, plc_amount = 0,
      has_other_charge = false, other_charge_amount = 0, other_charge_desc = null,
      // Payment detail fields (migration 042)
      bank_branch = null,
      received_for = null,
      account_holder = null,
      on_account_of = 'Booking',
      invoice_date_by = 'receipt_date',
      interest_type = 'exclusive',
      extra_add_on_type = 'exclusive',
      tds_type = 'not_calculate',
      self_or_loan = 'self',
      interest_amount = 0,
      dealer_adjustment_amount = 0,
      tds_challan_id = null,
      // Tax values
      s_tax_pct = 0, cgst_pct = 0, sgst_pct = 0, gst_interest_pct = 0,
      cgst_amount = 0, sgst_amount = 0, tds_amount = 0,
      selected_plan_name = null,
      // Staff-entered unit pricing (migration 051)
      basic_price = 0,        // rate ₹/sqft entered in the booking form
      carpet_area_sqft = 0,   // carpet area submitted by the form
    } = req.body;

    if (!consumer_id) return res.status(400).json({ error: 'consumer_id is required' });
    if (!unit_id || String(unit_id).trim() === '') return res.status(400).json({ error: 'Unit selection is required' });
    if (!selected_plan_name || String(selected_plan_name).trim() === '') return res.status(400).json({ error: 'Payment plan is required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Prevent Double Booking: Check if unit is available
      if (unit_id) {
        const unitCheck = await client.query(
          `SELECT status FROM units WHERE id = $1 FOR UPDATE`,
          [unit_id]
        );

        if (unitCheck.rows.length === 0) {
          throw new Error('Selected unit does not exist');
        }

        if (unitCheck.rows[0].status !== 'available') {
          throw new Error('Double Booking Prevented: Unit is no longer available');
        }
      }

      // Prevent duplicate active bookings on the same unit —
      // scoped by unit_id alone (not consumer_id), since a unit
      // can only have ONE active (pending_payment, active, or complete)
      // booking at a time regardless of who it's for.
      const existingBooking = await client.query(
        `SELECT br.id, br.status, u.unit_number,
                c.first_name, c.last_name, c.registration_no
         FROM booking_records br
         LEFT JOIN units u ON u.id = br.unit_id
         LEFT JOIN consumers c ON c.id = br.consumer_id
         WHERE br.unit_id = $1 AND br.status IN ('pending_payment', 'active', 'complete')
         LIMIT 1`,
        [unit_id]
      );
      if (existingBooking.rows.length > 0) {
        await client.query('ROLLBACK');
        const existing = existingBooking.rows[0];
        return res.status(400).json({
          error: `Unit ${existing.unit_number} already has an active booking (${existing.status}) for ${existing.first_name} ${existing.last_name} (${existing.registration_no}). Cancel or complete the existing booking first.`
        });
      }

      // Generate registration and form numbers
      const registrationNo = await generateRegistrationNo(project_id, client);
      const formNo = form_no || registrationNo;

      // Determine status: pending_payment when no amount and no mode provided
      const isPendingPayment = (!booking_amount || parseFloat(booking_amount) === 0) && !payment_mode;
      const bookingStatus = isPendingPayment ? 'pending_payment' : 'active';

      const result = await client.query(
        `INSERT INTO booking_records (
           consumer_id, project_id, unit_id, booking_date, booking_amount,
           payment_mode, payment_ref, bank_name, cheque_date,
           company_inaugural_disc, company_rebate_rs, company_rebate_sqft, company_rebate_pct,
           broker_id, broker_commission, broker_commission_type,
           booking_type, main_broker_id,
           broker_rebate_rs, broker_rebate_sqft, broker_rebate_pct,
           mailing_address_type, communication_mode,
           comm_address_line1, comm_pin, comm_city, comm_state, comm_country,
           sales_employee_id, nominee_name, nominee_relation,
           loan_amount, finance_bank, remarks, registration_no, form_no,
           has_plc, plc_amount, has_other_charge, other_charge_amount, other_charge_desc,
           created_by,
           bank_branch, received_for, account_holder, on_account_of,
           invoice_date_by, interest_type, extra_add_on_type, tds_type, self_or_loan,
           interest_amount, dealer_adjustment_amount, tds_challan_id,
           selected_plan_name,
           status,
           basic_rate_inr_sqft, carpet_area_sqft
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
           $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,
           $43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,
           $55,$56,$57,$58
         )
         RETURNING *`,
        [
          consumer_id, project_id||null, unit_id||null,
          booking_date||new Date().toISOString().split('T')[0],
          parseFloat(booking_amount||0),
          payment_mode||null, payment_ref||null, bank_name||null, cheque_date||null,
          parseFloat(company_inaugural_disc||0), parseFloat(company_rebate_rs||0),
          parseFloat(company_rebate_sqft||0), parseFloat(company_rebate_pct||0),
          broker_id||null, parseFloat(broker_commission||0), broker_commission_type||'flat',
          booking_type||'direct', main_broker_id||null,
          parseFloat(broker_rebate_rs||0), parseFloat(broker_rebate_sqft||0), parseFloat(broker_rebate_pct||0),
          mailing_address_type||'present', communication_mode||'email',
          comm_address_line1||null, comm_pin||null, comm_city||null, comm_state||null, comm_country||'India',
          sales_employee_id||null, nominee_name||null, nominee_relation||null,
          loan_amount?parseFloat(loan_amount):null, finance_bank||null, remarks||null,
          registrationNo, formNo,
          has_plc === true || has_plc === 'true',
          parseFloat(plc_amount||0),
          has_other_charge === true || has_other_charge === 'true',
          parseFloat(other_charge_amount||0),
          other_charge_desc||null,
          req.userId,
          // payment detail (migration 042)
          bank_branch||null, received_for||null, account_holder||null, on_account_of||'Booking',
          invoice_date_by||'receipt_date', interest_type||'exclusive', extra_add_on_type||'exclusive',
          tds_type||'not_calculate', self_or_loan||'self',
          parseFloat(interest_amount||0), parseFloat(dealer_adjustment_amount||0),
          tds_challan_id||null,
          selected_plan_name||null,
          bookingStatus,
          parseFloat(basic_price||0) > 0 ? parseFloat(basic_price) : null,
          parseFloat(carpet_area_sqft||0) > 0 ? parseFloat(carpet_area_sqft) : null,
        ]
      );

      // Resolve BASIC GST rate server-side (same pattern as PATCH /:id) and
      // derive cgst_amount/sgst_amount from the confirmed booking_amount --
      // never trust client-submitted cgst_pct/sgst_pct/cgst_amount/sgst_amount.
      const bookingDateForGstCreate = booking_date || new Date().toISOString().split('T')[0];

      const projectRowForGstCreate = project_id
        ? await client.query('SELECT name FROM projects WHERE id = $1', [project_id])
        : { rows: [] as any[] };
      const projectNameForGstCreate = projectRowForGstCreate.rows[0]?.name || project_id;

      const consumerRowForGstCreate = await client.query(
        'SELECT nationality FROM consumers WHERE id = $1',
        [consumer_id]
      );
      const isNriForGstCreate = ['nri', 'NRI', 'oci', 'OCI', 'pio', 'PIO']
        .includes(consumerRowForGstCreate.rows[0]?.nationality);

      const gstRateForBptCreate = (isNriForGstCreate || !project_id)
        ? { cgstPct: 0, sgstPct: 0 }
        : await resolveRate(
            db,
            project_id,
            projectNameForGstCreate,
            'BASIC',
            bookingDateForGstCreate
          );

      const cgstPctForBptCreate = gstRateForBptCreate.cgstPct * 100;
      const sgstPctForBptCreate = gstRateForBptCreate.sgstPct * 100;
      const gstSplitCreate = computeInclusiveGstSplit(
        parseFloat(booking_amount || 0),
        cgstPctForBptCreate,
        sgstPctForBptCreate
      );

      // Insert tax breakdown row (always, even if all zeros)
      await client.query(
        `INSERT INTO booking_payment_taxes
           (booking_record_id, s_tax_pct, cgst_pct, sgst_pct, gst_interest_pct,
            cgst_amount, sgst_amount, tds_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          result.rows[0].id,
          parseFloat(s_tax_pct||0), cgstPctForBptCreate, sgstPctForBptCreate,
          parseFloat(gst_interest_pct||0), gstSplitCreate.cgstAmount,
          gstSplitCreate.sgstAmount, parseFloat(tds_amount||0),
        ]
      );

      // Lock unit only when payment is present (active booking). pending_payment keeps unit available.
      if (unit_id && bookingStatus !== 'pending_payment') {
        await client.query(
          `UPDATE units SET status = 'locked', status_changed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [unit_id]
        );
        await client.query(
          `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_at, changed_by_user_id, reason)
           VALUES ($1, 'available', 'locked', NOW(), $2, $3)`,
          [unit_id, req.userId, `Booking confirmed - ${registrationNo}`]
        );
      }

      // Registration number is permanent once assigned.
      // Do not overwrite on re-booking — this previously caused a real data-corruption
      // incident (consumer 9e9d7841, TULA-2026-0002 wrongly overwritten to ALAN-2026-0016
      // during unrelated testing).
      const existingConsumer = await client.query(
        `SELECT registration_no, project_id FROM consumers WHERE id = $1`,
        [consumer_id]
      );
      const existingRegNo = existingConsumer.rows[0]?.registration_no;
      const existingProjectId = existingConsumer.rows[0]?.project_id;

      if (existingRegNo && existingProjectId !== project_id) {
        // Different project than consumer's original registration — reject.
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Consumer is already registered as ${existingRegNo} under a different project. Create a new consumer record to book under this project instead.`
        });
      }

      // Update consumer with form number, communication preferences, and comm address.
      // registration_no is only set on first-ever assignment; a same-project re-book
      // (e.g. post-surrender) preserves the consumer's original registration_no.
      if (existingRegNo) {
        await client.query(
          `UPDATE consumers
           SET form_no = $1,
               mailing_address_type = $2, communication_mode = $3,
               comm_address_line1 = COALESCE($4, comm_address_line1),
               comm_pin           = COALESCE($5, comm_pin),
               comm_city          = COALESCE($6, comm_city),
               comm_state         = COALESCE($7, comm_state),
               comm_country       = COALESCE($8, comm_country),
               lead_stage         = CASE WHEN lead_stage = 'cancelled' THEN 'enquiry' ELSE lead_stage END
           WHERE id = $9`,
          [formNo, mailing_address_type||'present', communication_mode||'email',
           comm_address_line1||null, comm_pin||null, comm_city||null, comm_state||null, comm_country||null,
           consumer_id]
        );
      } else {
        await client.query(
          `UPDATE consumers
           SET registration_no = $1, form_no = $2,
               mailing_address_type = $3, communication_mode = $4,
               comm_address_line1 = COALESCE($5, comm_address_line1),
               comm_pin           = COALESCE($6, comm_pin),
               comm_city          = COALESCE($7, comm_city),
               comm_state         = COALESCE($8, comm_state),
               comm_country       = COALESCE($9, comm_country),
               lead_stage         = CASE WHEN lead_stage = 'cancelled' THEN 'enquiry' ELSE lead_stage END
           WHERE id = $10`,
          [registrationNo, formNo, mailing_address_type||'present', communication_mode||'email',
           comm_address_line1||null, comm_pin||null, comm_city||null, comm_state||null, comm_country||null,
           consumer_id]
        );
      }

      // Auto-create pending commission record when booking type is broker
      if (booking_type === 'broker' && broker_id) {
        await client.query(
          `INSERT INTO broker_commissions
             (broker_id, consumer_id, project_id, unit_id, commission_amount_inr, status, created_by)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
          [broker_id, consumer_id, project_id||null, unit_id||null,
           parseFloat(broker_commission||0), req.userId]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        data: {
          ...result.rows[0],
          registration_no: registrationNo,
          form_no: formNo
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// GET /api/booking
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { project_id, consumer_id, status, page = 1, pageSize = 20 } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (project_id) { where += ` AND br.project_id = $${params.length+1}`; params.push(project_id); }
    if (consumer_id){ where += ` AND br.consumer_id = $${params.length+1}`; params.push(consumer_id); }
    if (status)     { where += ` AND br.status = $${params.length+1}`; params.push(status); }

    const offset = ((page as number) - 1) * (pageSize as number);
    params.push(pageSize, offset);

    const result = await db.query(`
      SELECT br.*, c.name as consumer_name, c.mobile, p.name as project_name, u.unit_number
      FROM booking_records br
      JOIN consumers c ON c.id = br.consumer_id
      LEFT JOIN projects p ON p.id = br.project_id
      LEFT JOIN units u ON u.id = br.unit_id
      ${where}
      ORDER BY br.created_at DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/booking/:id/edit  — General-purpose edit: updates booking fields + consumer personal details.
// Distinct from PATCH /:id which handles Step 2 payment confirmation only.
// Must be registered BEFORE PATCH /:id to ensure Express resolves /edit as a static suffix.
router.patch('/:id/edit', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      // booking_records fields (locked fields excluded: unit_id, project_id, selected_plan_name, payment_plan_id, booking_amount, status)
      booking_date,
      basic_rate_inr_sqft, carpet_area_sqft,
      form_no,
      broker_id, main_broker_id,
      broker_commission, broker_commission_type,
      company_inaugural_disc,
      company_rebate_rs, company_rebate_sqft, company_rebate_pct,
      broker_rebate_rs, broker_rebate_sqft, broker_rebate_pct,
      sales_employee_id, remarks, booking_type,
      // consumers fields
      salutation, first_name, middle_name, last_name,
      mobile, email, dob, gender, nationality, marital_status,
      pan_no, aadhaar_no, father_name,
      present_address_line1, present_city, present_state, present_pin, present_country,
      office_address_line1, office_city, office_state, office_pin,
      perm_address_line1, perm_city, perm_state, perm_pin,
      applicant_type, income_category,
      profession, designation, company,
      email_2, passport_no, annual_income,
      present_phone_no, office_country, perm_country,
      comm_address_line1, comm_city, comm_state, comm_pin, comm_country,
    } = req.body;

    // Fetch booking to get consumer_id
    const lookup = await db.query(
      `SELECT id, consumer_id FROM booking_records WHERE id = $1`,
      [id]
    );
    if (!lookup.rows[0]) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const consumerId = lookup.rows[0].consumer_id;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Update booking_records
      const brResult = await client.query(
        `UPDATE booking_records SET
           booking_date           = COALESCE($2::date,  booking_date),
           basic_rate_inr_sqft    = COALESCE($3,        basic_rate_inr_sqft),
           carpet_area_sqft       = COALESCE($4,        carpet_area_sqft),
           form_no                = COALESCE($5,        form_no),
           broker_id              = COALESCE($6,        broker_id),
           main_broker_id         = COALESCE($7,        main_broker_id),
           broker_commission      = COALESCE($8,        broker_commission),
           broker_commission_type = COALESCE($9,        broker_commission_type),
           company_inaugural_disc = COALESCE($10,       company_inaugural_disc),
           company_rebate_rs      = COALESCE($11,       company_rebate_rs),
           company_rebate_sqft    = COALESCE($12,       company_rebate_sqft),
           company_rebate_pct     = COALESCE($13,       company_rebate_pct),
           broker_rebate_rs       = COALESCE($14,       broker_rebate_rs),
           broker_rebate_sqft     = COALESCE($15,       broker_rebate_sqft),
           broker_rebate_pct      = COALESCE($16,       broker_rebate_pct),
           sales_employee_id      = COALESCE($17,       sales_employee_id),
           remarks                = COALESCE($18,       remarks),
           booking_type           = COALESCE($19,       booking_type)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          booking_date            || null,
          basic_rate_inr_sqft  != null ? parseFloat(basic_rate_inr_sqft)  : null,
          carpet_area_sqft     != null ? parseFloat(carpet_area_sqft)     : null,
          form_no                 || null,
          broker_id               || null,
          main_broker_id          || null,
          broker_commission    != null ? parseFloat(broker_commission)    : null,
          broker_commission_type  || null,
          company_inaugural_disc != null ? parseFloat(company_inaugural_disc) : null,
          company_rebate_rs    != null ? parseFloat(company_rebate_rs)    : null,
          company_rebate_sqft  != null ? parseFloat(company_rebate_sqft)  : null,
          company_rebate_pct   != null ? parseFloat(company_rebate_pct)   : null,
          broker_rebate_rs     != null ? parseFloat(broker_rebate_rs)     : null,
          broker_rebate_sqft   != null ? parseFloat(broker_rebate_sqft)   : null,
          broker_rebate_pct    != null ? parseFloat(broker_rebate_pct)    : null,
          sales_employee_id       || null,
          remarks                 || null,
          booking_type            || null,
        ]
      );

      // Update consumers
      const cResult = await client.query(
        `UPDATE consumers SET
           salutation              = COALESCE($2,  salutation),
           first_name              = COALESCE($3,  first_name),
           middle_name             = COALESCE($4,  middle_name),
           last_name               = COALESCE($5,  last_name),
           name                    = REGEXP_REPLACE(TRIM(INITCAP(COALESCE($3, first_name)) || ' ' || INITCAP(COALESCE($5, last_name))), '\\s+', ' ', 'g'),
           mobile                  = COALESCE($6,  mobile),
           email                   = COALESCE($7,  email),
           dob                     = COALESCE($8,  dob),
           gender                  = COALESCE($9,  gender),
           nationality             = COALESCE($10, nationality),
           marital_status          = COALESCE($11, marital_status),
           pan_no                  = COALESCE($12, pan_no),
           aadhaar_no              = COALESCE($13, aadhaar_no),
           father_name             = COALESCE($14, father_name),
           present_address         = COALESCE($15, present_address),
           present_city            = COALESCE($16, present_city),
           present_state           = COALESCE($17, present_state),
           present_pin             = COALESCE($18, present_pin),
           present_country         = COALESCE($19, present_country),
           office_address          = COALESCE($20, office_address),
           office_city             = COALESCE($21, office_city),
           office_state            = COALESCE($22, office_state),
           office_pin              = COALESCE($23, office_pin),
           perm_address            = COALESCE($24, perm_address),
           perm_city               = COALESCE($25, perm_city),
           perm_state              = COALESCE($26, perm_state),
           perm_pin                = COALESCE($27, perm_pin),
           applicant_type          = COALESCE($28, applicant_type),
           income_category         = COALESCE($29::income_category, income_category),
           form_no                 = COALESCE($30, form_no),
           profession              = COALESCE($31, profession),
           designation             = COALESCE($32, designation),
           company                 = COALESCE($33, company),
           email_2                 = COALESCE($34, email_2),
           passport_no             = COALESCE($35, passport_no),
           annual_income           = COALESCE($36, annual_income),
           present_phone_no        = COALESCE($37, present_phone_no),
           office_country          = COALESCE($38, office_country),
           perm_country            = COALESCE($39, perm_country),
           comm_address_line1      = COALESCE($40, comm_address_line1),
           comm_city               = COALESCE($41, comm_city),
           comm_state              = COALESCE($42, comm_state),
           comm_pin                = COALESCE($43, comm_pin),
           comm_country            = COALESCE($44, comm_country),
           updated_at              = NOW()
         WHERE id = $1
         RETURNING id, name, first_name, last_name, salutation, mobile, email,
                   dob, gender, nationality, marital_status, pan_no, aadhaar_no,
                   father_name, present_address, present_city, present_state,
                   present_pin, present_country, office_address, office_city,
                   office_state, office_pin, perm_address, perm_city, perm_state,
                   perm_pin, applicant_type, income_category, registration_no,
                   form_no, email_2, passport_no, profession, designation, company,
                   present_phone_no, office_country, perm_country,
                   comm_address_line1, comm_city, comm_state, comm_pin, comm_country`,
        [
          consumerId,
          salutation              || null,
          first_name              || null,
          middle_name             || null,
          last_name               || null,
          mobile                  || null,
          email                   || null,
          dob                     || null,
          gender                  || null,
          nationality             || null,
          marital_status          || null,
          pan_no                  || null,
          aadhaar_no              || null,
          father_name             || null,
          present_address_line1   || null,
          present_city            || null,
          present_state           || null,
          present_pin             || null,
          present_country         || null,
          office_address_line1    || null,
          office_city             || null,
          office_state            || null,
          office_pin              || null,
          perm_address_line1      || null,
          perm_city               || null,
          perm_state              || null,
          perm_pin                || null,
          applicant_type          || null,
          income_category         || null,
          form_no                 || null,
          profession              || null,
          designation             || null,
          company                 || null,
          email_2                 || null,
          passport_no             || null,
          annual_income != null ? parseFloat(annual_income) : null,
          present_phone_no        || null,
          office_country          || null,
          perm_country            || null,
          comm_address_line1      || null,
          comm_city               || null,
          comm_state              || null,
          comm_pin                || null,
          comm_country            || null,
        ]
      );

      await client.query('COMMIT');
      res.json({
        success: true,
        data: {
          booking: brResult.rows[0],
          consumer: cResult.rows[0],
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// PATCH /api/booking/:id  — Step 2: save payment details for a pending_payment booking
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      booking_amount, payment_mode, payment_ref, bank_name, bank_branch, cheque_date,
      received_for, account_holder, on_account_of, invoice_date_by,
      interest_type, extra_add_on_type, tds_type, self_or_loan,
      interest_amount = 0, dealer_adjustment_amount = 0, tds_challan_id = null,
      s_tax_pct = 0, cgst_pct = 0, sgst_pct = 0, gst_interest_pct = 0,
      cgst_amount = 0, sgst_amount = 0, tds_amount = 0,
    } = req.body;

    if (!booking_amount || parseFloat(booking_amount) === 0) {
      return res.status(400).json({ error: 'booking_amount must be greater than zero' });
    }
    if (!payment_mode) {
      return res.status(400).json({ error: 'payment_mode is required' });
    }

    // Duplicate cheque/reference check (excluding current booking)
    if (payment_ref) {
      const [bookingDup, receiptDup] = await Promise.all([
        db.query(
          `SELECT registration_no FROM booking_records WHERE payment_ref = $1 AND id != $2 LIMIT 1`,
          [payment_ref, id]
        ),
        db.query(
          `SELECT receipt_number FROM receipts WHERE transaction_ref = $1 LIMIT 1`,
          [payment_ref]
        ),
      ]);
      if (bookingDup.rows.length > 0) {
        return res.status(409).json({
          error: `Reference "${payment_ref}" already used in booking ${bookingDup.rows[0].registration_no}`,
        });
      }
      if (receiptDup.rows.length > 0) {
        return res.status(409).json({
          error: `Reference "${payment_ref}" already used in receipt ${receiptDup.rows[0].receipt_number}`,
        });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const updateResult = await client.query(
        `UPDATE booking_records SET
           booking_amount          = $1,
           payment_mode            = $2,
           payment_ref             = $3,
           bank_name               = $4,
           bank_branch             = $5,
           cheque_date             = $6,
           received_for            = $7,
           account_holder          = $8,
           on_account_of           = $9,
           invoice_date_by         = $10,
           interest_type           = $11,
           extra_add_on_type       = $12,
           tds_type                = $13,
           self_or_loan            = $14,
           interest_amount         = $15,
           dealer_adjustment_amount= $16,
           tds_challan_id          = $17,
           status                  = 'complete'
         WHERE id = $18
         RETURNING *`,
        [
          parseFloat(booking_amount),
          payment_mode, payment_ref||null, bank_name||null, bank_branch||null, cheque_date||null,
          received_for||null, account_holder||null, on_account_of||'Booking',
          invoice_date_by||'receipt_date', interest_type||'exclusive',
          extra_add_on_type||'exclusive', tds_type||'not_calculate', self_or_loan||'self',
          parseFloat(interest_amount||0), parseFloat(dealer_adjustment_amount||0),
          tds_challan_id||null,
          id,
        ]
      );

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = updateResult.rows[0];

      // Resolve BASIC GST rate from System A (gst_tax_charge_mapping) to store
      // correct rate in booking_payment_taxes. Replaces frontend-submitted
      // cgst_pct/sgst_pct which came from the disconnected tax_slabs table.
      const bookingDateForGst = booking.booking_date
        ? new Date(booking.booking_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const projectRowForGst = await client.query(
        'SELECT name FROM projects WHERE id = $1',
        [booking.project_id]
      );
      const projectNameForGst = projectRowForGst.rows[0]?.name || booking.project_id;

      const consumerRowForGst = await client.query(
        'SELECT nationality FROM consumers WHERE id = $1',
        [booking.consumer_id]
      );
      const isNriForGst = ['nri', 'NRI', 'oci', 'OCI', 'pio', 'PIO']
        .includes(consumerRowForGst.rows[0]?.nationality);

      const gstRateForBpt = isNriForGst
        ? { cgstPct: 0, sgstPct: 0 }
        : await resolveRate(
            db,
            booking.project_id,
            projectNameForGst,
            'BASIC',
            bookingDateForGst
          );

      // Amount is always derived server-side from the resolved rate and the
      // confirmed booking_amount -- the frontend-submitted cgst_amount/
      // sgst_amount is ignored (it was flat-multiplied client-side and is
      // never authoritative; see computeInclusiveGstSplit()).
      const cgstPctForBpt = gstRateForBpt.cgstPct * 100;
      const sgstPctForBpt = gstRateForBpt.sgstPct * 100;
      const gstSplit = computeInclusiveGstSplit(
        parseFloat(booking.booking_amount),
        cgstPctForBpt,
        sgstPctForBpt
      );

      // Upsert tax row (delete + insert to handle both old and new bookings cleanly)
      await client.query(
        `DELETE FROM booking_payment_taxes WHERE booking_record_id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO booking_payment_taxes
           (booking_record_id, s_tax_pct, cgst_pct, sgst_pct, gst_interest_pct,
            cgst_amount, sgst_amount, tds_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          parseFloat(s_tax_pct||0), cgstPctForBpt, sgstPctForBpt,
          parseFloat(gst_interest_pct||0), gstSplit.cgstAmount,
          gstSplit.sgstAmount, parseFloat(tds_amount||0),
        ]
      );

      // Lock the unit now that payment is confirmed
      if (booking.unit_id) {
        await client.query(
          `UPDATE units SET status = 'locked', status_changed_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND status != 'locked'`,
          [booking.unit_id]
        );
        await client.query(
          `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_at, changed_by_user_id, reason)
           VALUES ($1, 'available', 'locked', NOW(), $2, $3)
           ON CONFLICT DO NOTHING`,
          [booking.unit_id, req.userId, `Payment confirmed - ${booking.registration_no}`]
        );
      }

      // Auto-create allocation + payment_plan on payment confirmation (idempotent)
      if (booking.unit_id && booking.consumer_id) {
        const existingAlloc = await client.query(
          `SELECT id FROM allocations WHERE consumer_id = $1 AND unit_id = $2 LIMIT 1`,
          [booking.consumer_id, booking.unit_id]
        );
        if (existingAlloc.rows.length === 0) {
          const unitRow = await client.query(
            `SELECT base_price_inr, carpet_area_sqft, balcony_area_sqft FROM units WHERE id = $1`,
            [booking.unit_id]
          );
          const unitBasePriceInr = parseInt(unitRow.rows[0]?.base_price_inr || 0);
          const bookingRate     = parseFloat(booking.basic_rate_inr_sqft || 0);
          // booking_records.carpet_area_sqft stores carpet+balcony combined
          // (confirmed via live-data audit) -- use the units table's true
          // carpet area here instead, so Net Basic Price and Balcony Charge
          // don't double-count the balcony portion.
          const trueCarpetArea  = parseFloat(unitRow.rows[0]?.carpet_area_sqft || 0);
          const trueBalconyArea = parseFloat(unitRow.rows[0]?.balcony_area_sqft || 0);
          const basicCost = (bookingRate > 0 && trueCarpetArea > 0)
            ? Math.round(bookingRate * trueCarpetArea)
            : unitBasePriceInr;

          // Balcony Charge (Phase 2): MIN(true balcony area x configured rate, cap)
          const balconyConfigRow = await client.query(
            `SELECT rate_value, cap_value FROM charge_master_config WHERE charge_key = 'balcony_charge'`
          );
          const balconyRateApplied = parseFloat(balconyConfigRow.rows[0]?.rate_value || 0);
          const balconyCapValue    = balconyConfigRow.rows[0]?.cap_value != null
            ? parseFloat(balconyConfigRow.rows[0].cap_value)
            : null;
          // Same BASIC GST rate already resolved above for booking_payment_taxes
          // (gstRateForBpt) -- reuse rather than re-querying gst_tax_charge_mapping.
          // gstRateForBpt is already zeroed for NRI/OCI/PIO (isNriForGst, above).
          const { balconyChargeAmount, balconyCgstAmount, balconySgstAmount } = computeBalconyCharge(
            trueBalconyArea,
            balconyRateApplied,
            balconyCapValue,
            gstRateForBpt.cgstPct,
            gstRateForBpt.sgstPct
          );

          await client.query(
            `UPDATE booking_records
               SET balcony_charge_amount = $1,
                   balcony_cgst_amount = $2,
                   balcony_sgst_amount = $3,
                   balcony_rate_applied_inr_sqft = $4
             WHERE id = $5`,
            [balconyChargeAmount, balconyCgstAmount, balconySgstAmount, balconyRateApplied || null, booking.id]
          );

          const totalAmount = basicCost
            + parseFloat(booking.plc_amount || 0)
            + parseFloat(booking.other_charge_amount || 0)
            - parseFloat(booking.company_inaugural_disc || 0)
            + balconyChargeAmount;

          const allocRow = await client.query(
            `INSERT INTO allocations
               (consumer_id, unit_id, project_id, status, allotment_date, allocated_date, created_by_user_id)
             VALUES ($1, $2, $3, 'booked', NULL, NOW(), $4)
             RETURNING id`,
            [booking.consumer_id, booking.unit_id, booking.project_id, req.userId]
          );
          const allocationId = allocRow.rows[0].id;

          const planRow = await client.query(
            `INSERT INTO payment_plans
               (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [allocationId, booking.consumer_id, booking.unit_id, booking.project_id, Math.round(totalAmount), req.userId]
          );
          const paymentPlanId = planRow.rows[0].id;

          await client.query(
            `UPDATE consumers SET allocated_unit_id = $1 WHERE id = $2`,
            [booking.unit_id, booking.consumer_id]
          );

          await client.query(
            `UPDATE units SET status = 'booked', updated_at = NOW() WHERE id = $1`,
            [booking.unit_id]
          );

          // Auto-generate pending demand records from the consumer's payment plan template
          const selectedPlanName = booking.selected_plan_name;
          if (selectedPlanName && booking.project_id) {
            const templates = await client.query(
              `SELECT installment_index, installment_name, installment_type,
                      percentage, flat_amount_inr, due_date_offset_days
               FROM plan_schedule_templates
               WHERE project_id = $1 AND plan_name = $2
               ORDER BY installment_index`,
              [booking.project_id, selectedPlanName]
            );
            const bookingDateStr = booking.booking_date
              ? safeLocalDate(booking.booking_date)
              : safeLocalDate(new Date());

            const projectRes = await client.query(
              'SELECT name FROM projects WHERE id = $1',
              [booking.project_id]
            );
            const projectName = projectRes.rows[0]?.name || booking.project_id;

            const consumerRes = await client.query(
              'SELECT nationality FROM consumers WHERE id = $1',
              [booking.consumer_id]
            );
            const isNri = ['nri', 'NRI', 'oci', 'OCI', 'pio', 'PIO']
              .includes(consumerRes.rows[0]?.nationality);

            for (const tmpl of templates.rows) {
              const pct = parseFloat(tmpl.percentage || 0) / 100;
              const amountDue = tmpl.flat_amount_inr
                ? parseInt(tmpl.flat_amount_inr)
                : Math.round(totalAmount * pct);
              const basicPortion = tmpl.flat_amount_inr
                ? amountDue
                : Math.round(basicCost * pct);
              const plcPortion = tmpl.flat_amount_inr
                ? 0
                : Math.round(parseFloat(booking.plc_amount || 0) * pct);
              const otherPortion = tmpl.flat_amount_inr
                ? 0
                : Math.round(parseFloat(booking.other_charge_amount || 0) * pct);
              const balconyPortion = tmpl.flat_amount_inr
                ? 0
                : Math.round(balconyChargeAmount * pct);
              const { cgstAmount, sgstAmount } = await resolveGstForComponents(
                client,
                booking.project_id,
                projectName,
                bookingDateStr,
                isNri,
                [
                  { chargeType: 'BASIC', amount: basicPortion },
                  { chargeType: 'PLC', amount: plcPortion },
                  { chargeType: 'OTHER CHARGE', amount: otherPortion },
                  { chargeType: 'BALCONY', amount: balconyPortion },
                ]
              );
              const offsetDays = parseInt(tmpl.due_date_offset_days || 0);
              // Two separate queries to avoid unreferenced $4/$5 params when due_date is NULL
              if (offsetDays > 0) {
                await client.query(
                  `INSERT INTO demands (payment_plan_id, installment_index, consumer_id,
                                        due_date, amount_due_inr, cgst_amount, sgst_amount,
                                        status, demand_type, delivery_status, generated_at)
                   VALUES ($1, $2, $3, $4::date + ($5 * INTERVAL '1 day'), $6, $7, $8,
                           'pending', $9, 'pending', NOW())`,
                  [paymentPlanId, tmpl.installment_index, booking.consumer_id,
                   bookingDateStr, offsetDays, amountDue, cgstAmount, sgstAmount,
                   tmpl.installment_type || tmpl.installment_name]
                );
              } else {
                await client.query(
                  `INSERT INTO demands (payment_plan_id, installment_index, consumer_id,
                                        due_date, amount_due_inr, cgst_amount, sgst_amount,
                                        status, demand_type, delivery_status, generated_at)
                   VALUES ($1, $2, $3, NULL, $4, $5, $6,
                           'pending', $7, 'pending', NOW())`,
                  [paymentPlanId, tmpl.installment_index, booking.consumer_id,
                   amountDue, cgstAmount, sgstAmount,
                   tmpl.installment_type || tmpl.installment_name]
                );
              }
            }
          }

          // Step G: Auto-create booking receipt so payment is visible in all reports
          const bookingAmt = Math.round(parseFloat(booking.booking_amount || 0));
          if (bookingAmt > 0) {
            const validPayMethods = ['bank_transfer', 'cheque', 'neft', 'rtgs', 'upi'];
            const payMethod = validPayMethods.includes(booking.payment_mode) ? booking.payment_mode : 'bank_transfer';
            const bookingDateStr = booking.booking_date
              ? safeLocalDate(booking.booking_date)
              : safeLocalDate(new Date());
            const receiptNum = `REC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
            const stepGReceiptRes = await client.query(
              `INSERT INTO receipts
                 (consumer_id, payment_plan_id, installment_index, amount_received_inr,
                  payment_method, transaction_ref, received_date, received_by_user_id,
                  receipt_number, bank_name, branch, cheque_no, cheque_date, plc_amount,
                  status, approval_status, print_status)
               VALUES ($1, $2, NULL, $3, $4::payment_method, $5, $6::date, $7, $8,
                       $9, $10, $11, $12::date, 0, 'pending', 'pending', 'not_printed')
               RETURNING id`,
              [
                booking.consumer_id,
                paymentPlanId,
                bookingAmt,
                payMethod,
                booking.payment_ref || null,
                bookingDateStr,
                booking.created_by || req.userId,
                receiptNum,
                booking.bank_name || null,
                booking.bank_branch || null,
                booking.payment_mode === 'cheque' ? (booking.payment_ref || null) : null,
                booking.cheque_date || null,
              ]
            );
            const stepGReceiptId = stepGReceiptRes.rows[0].id;

            // Auto-raise installment 1 from this Step-G receipt, same as a
            // manual receipt would via POST /payments/receipts.
            await checkAndAutoRaiseInstallment1(client, paymentPlanId, stepGReceiptId, bookingDateStr, req.userId || null);

            // If the Step-G amount exceeds installment 1's net due, cascade
            // the excess forward the same way a manual receipt's overpayment
            // already does.
            const inst1Res = await client.query(
              `SELECT id, amount_due_inr, cgst_amount, sgst_amount FROM demands
               WHERE payment_plan_id = $1 AND installment_index = 1 AND demand_type = 'installment'
               ORDER BY created_at ASC LIMIT 1`,
              [paymentPlanId]
            );
            if (inst1Res.rows.length > 0) {
              const inst1 = inst1Res.rows[0];
              const inst1NetDue = parseFloat(inst1.amount_due_inr)
                + parseFloat(inst1.cgst_amount || 0)
                + parseFloat(inst1.sgst_amount || 0);
              const stepGExcess = bookingAmt - inst1NetDue;
              if (stepGExcess > 0) {
                await cascadeOverpaymentExcess(
                  client, booking.consumer_id, paymentPlanId, inst1.id,
                  stepGExcess, payMethod, req.userId || null
                );
              }
            }
          }

          // Step H: Auto-apply plan-level addon
          // charge templates to this consumer.
          // Uses plan_addon_charge_pct + addon_charge_master
          // to create consumer_addon_charges rows
          // and update demands.addon_charge_amount.
          // Only runs once per consumer+unit
          // (inside existingAlloc === 0 guard).
          const bookingDateStr = booking.booking_date
            ? safeLocalDate(booking.booking_date)
            : safeLocalDate(new Date());

          const addonPctRows = await client.query(
            `SELECT DISTINCT
               pac.charge_master_id,
               acm.charge_name,
               acm.default_amount,
               acm.cgst_pct,
               acm.sgst_pct
             FROM plan_addon_charge_pct pac
             JOIN plan_schedule_templates pst
               ON pst.id = pac.plan_schedule_template_id
             JOIN addon_charge_master acm
               ON acm.id = pac.charge_master_id
             WHERE pst.project_id = $1
               AND pst.plan_name = $2
               AND acm.is_active = true`,
            [booking.project_id, booking.selected_plan_name]
          );

          for (const row of addonPctRows.rows) {
            // Skip if already exists (idempotency guard)
            const existing = await client.query(
              `SELECT id FROM consumer_addon_charges
               WHERE consumer_id = $1
                 AND project_id = $2
                 AND charge_master_id = $3`,
              [booking.consumer_id, booking.project_id, row.charge_master_id]
            );
            if (existing.rows.length > 0) continue;

            // Compute GST amounts from master
            const amt = parseFloat(row.default_amount);
            const cPct = parseFloat(row.cgst_pct);
            const sPct = parseFloat(row.sgst_pct);
            const cgstAmt = Math.round(amt * cPct / 100 * 100) / 100;
            const sgstAmt = Math.round(amt * sPct / 100 * 100) / 100;
            const totalAmt = amt + cgstAmt + sgstAmt;

            await client.query(
              `INSERT INTO consumer_addon_charges
                 (consumer_id, project_id, charge_master_id, charge_name,
                  effective_date, amount, increase_amount, cgst_pct,
                  sgst_pct, cgst_amount, sgst_amount, total_amount,
                  created_by)
               VALUES
                 ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12)`,
              [
                booking.consumer_id,
                booking.project_id,
                row.charge_master_id,
                row.charge_name,
                bookingDateStr,
                amt, cPct, sPct,
                cgstAmt, sgstAmt, totalAmt,
                req.userId
              ]
            );
          }

          // Recompute addon demand amounts for all installed charges
          if (addonPctRows.rows.length > 0) {
            await recomputeAddonDemands(
              client,
              booking.consumer_id,
              booking.project_id,
              paymentPlanId,
              booking.selected_plan_name
            );
          }
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, data: updateResult.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── RECEIPT HELPERS ──────────────────────────

function ordinal(n: number): string {
  const abs = Math.abs(Math.floor(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${abs}th`;
  const lastOne = abs % 10;
  if (lastOne === 1) return `${abs}st`;
  if (lastOne === 2) return `${abs}nd`;
  if (lastOne === 3) return `${abs}rd`;
  return `${abs}th`;
}

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n: number): string =>
    n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');

  const threeDigits = (n: number): string =>
    n >= 100
      ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '')
      : twoDigits(n);

  if (!amount || amount === 0) return 'Zero Rupees Only';

  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);

  const crore = Math.floor(rupees / 10000000);
  const lakh  = Math.floor((rupees % 10000000) / 100000);
  const thou  = Math.floor((rupees % 100000) / 1000);
  const rem   = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh)  parts.push(threeDigits(lakh)  + ' Lakh');
  if (thou)  parts.push(threeDigits(thou)  + ' Thousand');
  if (rem)   parts.push(threeDigits(rem));

  let result = parts.join(' ') + ' Rupees';
  if (paise) result += ' and ' + twoDigits(paise) + ' Paise';
  return result + ' Only';
}

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: any): string {
  if (d == null) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmt(v: any): string {
  const n = parseFloat(v ?? 0) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Returns YYYY-MM-DD using local (IST) time components.
// Avoids the pg DATE→JS Date bug where midnight IST = prior day in UTC.
function safeLocalDate(d: any): string {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function instrumentLabel(mode: string): string {
  const m = (mode || '').toLowerCase();
  if (m === 'cheque')                    return 'Cheque No.';
  if (m === 'demand_draft' || m === 'draft') return 'DD No.';
  if (m === 'neft' || m === 'rtgs' || m === 'online') return 'Transaction Ref.';
  if (m === 'upi')                       return 'UPI Ref.';
  if (m === 'card')                      return 'Card Auth. No.';
  if (m === 'cash')                      return 'N/A';
  if (m === 'adjust')                    return 'Adjustment Ref.';
  if (m === 'dealer_adjustment')         return 'Dealer Ref.';
  if (m === 'tds_challan')               return 'Challan No.';
  return 'Reference No.';
}

function paymentNarrative(b: any): string {
  const mode    = (b.payment_mode || '').toLowerCase();
  const ref     = (b.payment_ref  || '').trim();
  const bank    = (b.bank_name    || '').trim();
  const branch  = (b.bank_branch  || '').trim();
  const dateStr = fmtDate(b.cheque_date);
  const hasDate = dateStr !== '—';

  if (mode === 'cash') {
    return 'in Cash.';
  }

  if (mode === 'cheque') {
    const parts: string[] = ['vide Cheque'];
    if (ref)     parts.push(`No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank) {
      const bankStr = branch ? `${bank}, ${branch}` : bank;
      parts.push(`drawn on ${bankStr}`);
    }
    return parts.join(' ') + '.';
  }

  if (mode === 'demand_draft' || mode === 'draft') {
    const parts: string[] = ['vide Demand Draft'];
    if (ref)     parts.push(`No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank) {
      const bankStr = branch ? `${bank}, ${branch}` : bank;
      parts.push(`drawn on ${bankStr}`);
    }
    return parts.join(' ') + '.';
  }

  if (mode === 'neft' || mode === 'rtgs' || mode === 'online') {
    const parts: string[] = ['vide Online Transfer'];
    if (ref)     parts.push(`Ref. No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`through ${bank}`);
    return parts.join(' ') + '.';
  }

  if (mode === 'upi') {
    const parts: string[] = ['vide UPI'];
    if (ref)     parts.push(`Ref. No. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    return parts.join(' ') + '.';
  }

  if (mode === 'card') {
    const parts: string[] = ['vide Card Transaction'];
    if (ref)     parts.push(`Ref. ${ref}`);
    if (hasDate) parts.push(`dated ${dateStr}`);
    if (bank)    parts.push(`through ${bank}`);
    return parts.join(' ') + '.';
  }

  // Fallback: capitalise mode words
  const modePretty = mode.replace(/\b\w/g, (c: string) => c.toUpperCase());
  const parts: string[] = [`vide ${modePretty}`];
  if (ref) parts.push(`Ref. ${ref}`);
  return parts.join(' ') + '.';
}

// ── APPLICANT FILE HELPERS ───────────────

function capitalize(str: string): string {
  if (str == null) return '—';
  return String(str).replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function fmtIndianNumber(v: any): string {
  const n = parseFloat(v ?? 0) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtIndianCurrency(v: any): string {
  return 'Rs. ' + fmtIndianNumber(v);
}

function ordinalFloor(n: any): string {
  if (n == null) return '—';
  const num = parseInt(n);
  if (isNaN(num)) return '—';
  if (num === 0) return 'Ground Floor';
  return ordinal(num) + ' Floor';
}

function getMailingAddress(consumer: any): string {
  const type = (consumer.mailing_address_type || 'present').toLowerCase();
  let addr: string, city: string, state: string, pin: string;
  if (type === 'office') {
    addr  = consumer.office_address || '';
    city  = consumer.office_city    || '';
    state = consumer.office_state   || '';
    pin   = consumer.office_pin     || '';
  } else if (type === 'permanent') {
    addr  = consumer.perm_address || '';
    city  = consumer.perm_city    || '';
    state = consumer.perm_state   || '';
    pin   = consumer.perm_pin     || '';
  } else {
    addr  = consumer.present_address || '';
    city  = consumer.present_city    || '';
    state = consumer.present_state   || '';
    pin   = consumer.present_pin     || '';
  }
  const parts = [addr, city, state, pin].map(s => s.trim()).filter(Boolean);
  return parts.length ? parts.join(', ') : 'N/A';
}

function amtWords(amount: number): string {
  const raw = numberToWords(amount);
  const capitalised = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return capitalised.replace(/\bonly\b$/i, 'only.');
}

// ── PAGE 1 BUILDER ───────────────────────

function buildApplicantPage1(
  b: any,
  consumer: any,
  coApplicants: any[],
  settings: Record<string, string>,
  allocation: any | null,
  parkingSlots: any[] = [],
  addonCharges: any[] = [],
  receiptRows: any[] = [],
  totalWaivedInr: number = 0,
  otherChargeCgstPct: number = 0,
  otherChargeSgstPct: number = 0,
): string {

  // ── derived values ──────────────────────
  const projectName   = esc(b.project_name  || '—');
  const fullName      = [consumer.salutation, consumer.first_name,
    consumer.middle_name || '', consumer.last_name].filter(Boolean).join(' ').trim() || '—';
  const customerId    = esc(consumer.form_no || consumer.registration_no || '—');
  const presentAddr   = [consumer.present_address, consumer.present_city,
    consumer.present_state, consumer.present_pin ? `- ${consumer.present_pin}` : '']
    .filter(Boolean).join(', ');

  const carpetArea       = parseFloat(b.carpet_area_sqft     || 0);
  const superArea        = parseFloat(b.super_area_sqft      || 0);
  const balconyArea      = parseFloat(b.balcony_area_sqft    || 0);
  const storedRate       = parseFloat(b.basic_rate_inr_sqft  || 0);
  const unitBasePrice    = parseFloat(b.base_price_inr       || 0);
  const ratePerSqft      = storedRate > 0 ? storedRate
                         : (carpetArea > 0 ? unitBasePrice / carpetArea : 0);
  // b.carpet_area_sqft/b.balcony_area_sqft here come from the units join
  // (u.carpet_area_sqft/u.balcony_area_sqft placed after br.* in the SELECT
  // that feeds this function -- confirmed via live query test that the
  // units-sourced value overwrites the polluted booking_records column in
  // the resulting row object), so these are already TRUE carpet/balcony
  // areas, not the combined value. Net Basic Price is always true-carpet
  // only; Balcony Charge is shown as its own separate line (see Other
  // Charges table below), not folded into basePrice.
  const basePrice        = (storedRate > 0 && carpetArea > 0)
                         ? Math.round(storedRate * carpetArea)
                         : unitBasePrice;
  const plcAmount     = parseFloat(b.plc_amount        || 0);
  const otherCharge   = parseFloat(b.other_charge_amount || 0);
  const balconyChargeAmount = b.balcony_charge_amount != null ? parseFloat(b.balcony_charge_amount) : 0;
  const balconyCgstAmount   = b.balcony_cgst_amount   != null ? parseFloat(b.balcony_cgst_amount)   : 0;
  const balconySgstAmount   = b.balcony_sgst_amount   != null ? parseFloat(b.balcony_sgst_amount)   : 0;
  const balconyChargeTotal  = balconyChargeAmount + balconyCgstAmount + balconySgstAmount;
  const isGstExempt   = ['nri','oci','pio'].includes((consumer.nationality || '').toLowerCase());
  const cgstPct       = isGstExempt ? 0 : parseFloat(b.cgst_pct          || 0);
  const sgstPct       = isGstExempt ? 0 : parseFloat(b.sgst_pct          || 0);
  const interest      = parseFloat(b.interest_amount   || 0);
  const bookingAmt    = parseFloat(b.booking_amount    || 0);

  const netBasicPrice      = basePrice;
  const addonTotal         = addonCharges.reduce((sum: number, c: any) => sum + parseFloat(c.total_amount || 0), 0);
  const agreementValue     = netBasicPrice + plcAmount + otherCharge + addonTotal + balconyChargeAmount;
  const totalConsideration = agreementValue;
  // Split GST: basic+PLC at booking rate, other charges at their own GST rate
  const basicPlusPLC  = basePrice + plcAmount;
  const cgst          = (!isGstExempt && cgstPct > 0) ? Math.round(basicPlusPLC * cgstPct / 100) + Math.round(otherCharge * otherChargeCgstPct / 100) + balconyCgstAmount : 0;
  const sgst          = (!isGstExempt && sgstPct > 0) ? Math.round(basicPlusPLC * sgstPct / 100) + Math.round(otherCharge * otherChargeSgstPct / 100) + balconySgstAmount : 0;
  const totalTax           = cgst + sgst;
  const totalWithTax       = totalConsideration + totalTax;
  const totalReceivables   = totalWithTax + interest;
  const totalReceived      = parseFloat(b.total_received_inr || 0);
  // Show only cleared receipts. No fallback to booking amount — if nothing cleared yet, show ₹0.
  const lessReceipt        = totalReceived;
  const paidPct            = totalReceivables > 0
    ? (lessReceipt / totalReceivables * 100).toFixed(2) : '0.00';
  const balance            = totalReceivables - lessReceipt;

  const allotmentDate  = fmtDate(allocation?.allotment_date || b.allotment_date);
  const agreementDate  = fmtDate(b.agreement_date);
  const completionDate = fmtDate(b.completion_date);

  // ── shared styles ───────────────────────
  const baseFont  = 'font-family:Arial,sans-serif;font-size:11px;color:#000;';
  const sectionHd = `style="${baseFont}font-weight:700;font-size:12px;border-bottom:1px solid #000;padding-bottom:2px;margin:14px 0 6px;text-align:center;"`;
  const cellLbl   = `style="${baseFont}padding:2px 8px 2px 0;vertical-align:top;white-space:nowrap;font-weight:600;"`;
  const cellVal   = `style="${baseFont}padding:2px 0;vertical-align:top;"`;
  const thStyle   = `style="${baseFont}font-weight:700;background:#e8e8e8;border:1px solid #999;padding:3px 5px;text-align:center;"`;
  const tdStyle   = `style="${baseFont}border:1px solid #999;padding:3px 5px;text-align:center;"`;
  const tdR       = `style="${baseFont}border:1px solid #999;padding:3px 5px;text-align:right;"`;
  const tdL       = `style="${baseFont}border:1px solid #999;padding:3px 5px;text-align:left;"`;

  // ── helper: two-column detail layout ────
  function detailRow(label: string, value: string): string {
    return `<tr><td ${cellLbl}>${label}:</td><td ${cellVal}>${value}</td></tr>`;
  }
  function twoColBlock(leftRows: string[][], rightRows: string[][]): string {
    const maxLen = Math.max(leftRows.length, rightRows.length);
    let rows = '';
    for (let i = 0; i < maxLen; i++) {
      const l = leftRows[i]  || ['', ''];
      const r = rightRows[i] || ['', ''];
      rows += `<tr>
        <td style="${baseFont}padding:2px 8px 2px 0;vertical-align:top;white-space:nowrap;font-weight:600;width:13%">${esc(l[0])}${l[0] ? ':' : ''}</td>
        <td style="${baseFont}padding:2px 12px 2px 0;vertical-align:top;width:37%">${l[1]}</td>
        <td style="${baseFont}padding:2px 8px 2px 0;vertical-align:top;white-space:nowrap;font-weight:600;width:13%">${esc(r[0])}${r[0] ? ':' : ''}</td>
        <td style="${baseFont}padding:2px 0;vertical-align:top;width:37%">${r[1]}</td>
      </tr>`;
    }
    return `<table style="width:100%;border-collapse:collapse;">${rows}</table>`;
  }

  // ── helper: pricing row ─────────────────
  function pRow(label: string, value: string, bold = false): string {
    const fw = bold ? 'font-weight:700;' : '';
    return `<tr>
      <td style="${baseFont}${fw}padding:2px 8px;width:70%">${label}</td>
      <td style="${baseFont}${fw}padding:2px 8px;text-align:right;">${value}</td>
    </tr>`;
  }

  // ── SECTION 1 — HEADER ──────────────────
  const header = `
    <div style="text-align:center;margin-bottom:10px;">
      <div style="${baseFont}font-weight:700;font-size:14px;">APPLICANT FILE (${projectName})</div>
      <div style="${baseFont}font-size:10px;">Last Update: ${fmtDate(b.updated_at)} By: admin</div>
      <div style="${baseFont}font-size:10px;">Customer ID: ${customerId}</div>
    </div>`;

  // ── SECTION 2 — FIRST APPLICANT ─────────
  const hasLoan = (b.self_or_loan || 'self').toLowerCase() === 'loan'
    || (b.finance_bank && b.finance_bank.trim().length > 0);
  const loanInfo = hasLoan
    ? `Yes - ${esc(b.finance_bank || 'Bank Loan')}${b.loan_amount && Number(b.loan_amount) > 0 ? ` (Amount: ${fmtIndianCurrency(b.loan_amount)})` : ''}`
    : 'No';

  const wrap = (key: string, label: string, val: string, vt = 'text', section = 'applicant') =>
    `<span data-field-key="${key}" data-field-label="${label}" data-value-type="${vt}" data-section="${section}">${val}</span>`;

  const leftCols: string[][] = [
    ['Name',           wrap('consumerName',    'Consumer Name',    esc(fullName))],
    ['S/o',            wrap('fatherName',      'Father Name',      esc(consumer.father_name || 'N/A'))],
    ['Present Address',wrap('consumerAddress', 'Present Address',  esc(presentAddr || 'N/A'))],
    ['Mailing Address',wrap('mailingAddress',  'Mailing Address',  esc(getMailingAddress(consumer)))],
    ['Contact No.',    wrap('consumerMobile',  'Contact No.',      esc(consumer.mobile || 'N/A'))],
    ['LandLine No.',   wrap('landlineNo',      'Landline Number',  esc(consumer.present_phone_no || 'N/A'))],
    ['Email Id',       wrap('consumerEmail',   'Email Id',         esc(consumer.email || 'N/A'))],
    ['PAN No.',        wrap('panNo',           'PAN No.',          esc(consumer.pan_no || 'N/A'))],
    ['Aadhar No.',     wrap('aadhaarNo',       'Aadhar No.',       esc(consumer.aadhaar_no || 'N/A'))],
    ['Date Of Birth',  wrap('dob',             'Date Of Birth',    fmtDate(consumer.dob), 'date')],
  ];
  const rightCols: string[][] = [
    ['Project',          wrap('projectName',      'Project Name',         esc(b.project_name || 'N/A'),          'text', 'unit_info')],
    ['Tower',            wrap('towerName',         'Tower Name',           esc(b.tower_name || 'N/A'),            'text', 'unit_info')],
    ['Floor',            wrap('floorNo',           'Floor',                ordinalFloor(b.floor),                 'text', 'unit_info')],
    ['Unit No.',         wrap('unitNumber',        'Unit Number',          esc(b.unit_number || 'N/A'),           'text', 'unit_info')],
    ['Unit Type',        wrap('bhkType',           'Unit Type',            esc(b.bhk_type || 'N/A'),              'text', 'unit_info')],
    ['Location',         wrap('projectLocation',   'Location',             esc(b.project_location || 'N/A'),      'text', 'unit_info')],
    ['Facing',           wrap('facing',            'Facing',               esc(b.unit_facing || b.facing || 'N/A'), 'text', 'unit_info')],
    ['Gender',           wrap('gender',            'Gender',               esc(consumer.gender || 'N/A'),         'text', 'consumer_info')],
    ['Marital Status',   wrap('maritalStatus',     'Marital Status',       esc(consumer.marital_status || 'N/A'), 'text', 'consumer_info')],
    ['Nationality',      wrap('nationality',       'Nationality',          esc(consumer.nationality || 'N/A'),    'text', 'consumer_info')],
    ['Reg. No.',         wrap('registrationNo',    'Registration Number',  esc(b.registration_no || 'N/A'),       'text', 'consumer_info')],
    ['Booking Date',     wrap('bookingDate',       'Booking Date',         fmtDate(b.booking_date),               'date', 'booking_details')],
    ['Booking Amount',   wrap('bookingAmount',     'Booking Amount',       fmtIndianCurrency(bookingAmt),         'currency', 'booking_details')],
    ['Payment Mode',     wrap('paymentMode',       'Payment Mode',         capitalize(b.payment_mode || 'N/A'),   'text', 'booking_details')],
    ['Bank Name',        wrap('bookingBankName',   'Bank Name (Booking)',  esc(b.bank_name || 'N/A'),             'text', 'booking_details')],
    ['Cheque No.',       wrap('bookingChequeNo',   'Cheque Number',        esc(b.payment_ref || 'N/A'),           'text', 'booking_details')],
    ['Cheque Date',      wrap('bookingChequeDate', 'Cheque Date',          fmtDate(b.cheque_date),                'date', 'booking_details')],
    ['Loan Information', wrap('loanInfo',          'Loan Information',     loanInfo,                              'text', 'booking_details')],
    ['Payment Plan',     wrap('selectedPlanName',  'Payment Plan',         esc(b.selected_plan_name || 'N/A'),    'text', 'booking_details')],
    ['Broker Code',      wrap('brokerReraNo',      'Broker RERA No.',      esc(b.broker_rera || 'N/A'),           'text', 'booking_details')],
    ['Main Broker Name', wrap('brokerName',        'Broker Name',          esc(b.broker_name || 'Direct'),        'text', 'booking_details')],
    ['Employee Name',    wrap('employeeName',      'Employee Name',        esc(b.employee_name || 'N/A'),         'text', 'booking_details')],
    ['Booking Created By', esc(b.created_by_name || 'admin')],
    ['Preferable Comm. Mode', capitalize(b.communication_mode || 'N/A')],
    ['Document Status', 'N/A'],
  ];

  const firstApplicant = `
    <div ${sectionHd}>First Applicant</div>
    ${twoColBlock(leftCols, rightCols)}`;

  // ── SECTION 3 — CO-APPLICANTS ────────────
  let coApplicantHtml = '';
  if (coApplicants.length > 0) {
    coApplicants.forEach((co: any, idx: number) => {
      const coLabel = (co.applicant_type || '').toLowerCase() === 'nominee'
        ? 'Nominee' : `Co Applicant ${idx + 1}`;
      const coName = [co.salutation, co.first_name, co.middle_name || '', co.last_name]
        .filter(Boolean).join(' ').trim() || '—';
      const coLeft: string[][] = [
        ['Name',          wrap(`coApplicantName_${idx}`,     `Co-applicant Name (${idx})`,     esc(coName), 'text', 'co_applicants')],
        ['Relation',      wrap(`coApplicantRelation_${idx}`, `Co-applicant Relation (${idx})`, esc(co.applicant_type || 'N/A'), 'text', 'co_applicants')],
        ['S/o',           esc(co.father_name || 'N/A')],
        ['Contact No.',   wrap(`coApplicantMobile_${idx}`,   `Co-applicant Mobile (${idx})`,   esc(co.mobile || 'N/A'), 'text', 'co_applicants')],
        ['Email Id',      wrap(`coApplicantEmail_${idx}`,    `Co-applicant Email (${idx})`,    esc(co.email  || 'N/A'), 'text', 'co_applicants')],
        ['PAN No.',       wrap(`coApplicantPan_${idx}`,      `Co-applicant PAN (${idx})`,      esc(co.pan_no || 'N/A'), 'text', 'co_applicants')],
        ['Aadhar No.',    wrap(`coApplicantAadhaar_${idx}`,  `Co-applicant Aadhaar (${idx})`,  esc(co.aadhaar_no || 'N/A'), 'text', 'co_applicants')],
        ['Date Of Birth', wrap(`coApplicantDob_${idx}`,      `Co-applicant DOB (${idx})`,      fmtDate(co.dob), 'date', 'co_applicants')],
      ];
      coApplicantHtml += `
        <div ${sectionHd}>${esc(coLabel)}</div>
        ${twoColBlock(coLeft, [])}`;
    });
  }

  // ── SECTION 4 — PRICING SUMMARY ──────────
  // ── helper: itemized tax breakup sub-rows (display/verification only —
  // the final CGST(Rs.)/SGST(Rs.) totals below remain sourced from the
  // already-computed cgst/sgst values, never re-derived from these lines)
  function taxSubHeaderRow(label: string): string {
    return `<tr><td colspan="2" style="${baseFont}font-style:italic;color:#666;padding:2px 8px 1px 20px;">${label}</td></tr>`;
  }
  function taxSubRow(label: string, valueHtml: string): string {
    return `<tr>
      <td style="${baseFont}font-style:italic;color:#444;padding:1px 8px 1px 32px;">${label}</td>
      <td style="${baseFont}font-style:italic;color:#444;padding:1px 8px;text-align:right;">${valueHtml}</td>
    </tr>`;
  }

  const basicPlusPlcCgst   = Math.round(basicPlusPLC * cgstPct / 100);
  const basicPlusPlcSgst   = Math.round(basicPlusPLC * sgstPct / 100);
  const otherChargeCgstAmt = Math.round(otherCharge * otherChargeCgstPct / 100);
  const otherChargeSgstAmt = Math.round(otherCharge * otherChargeSgstPct / 100);

  const taxBreakupBlock = isGstExempt ? '' : `
    <tr><td colspan="2" style="${baseFont}font-weight:700;padding:4px 8px 1px;">Tax Breakup:</td></tr>
    ${taxSubHeaderRow(`Basic Price + PLC (Rs. ${fmtIndianNumber(basicPlusPLC)})`)}
    ${taxSubRow(`CGST @ ${cgstPct}%`,
      `<span data-field-key="taxBreakupBasicPlcCgst" data-field-label="Basic+PLC CGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(basicPlusPlcCgst)}</span>`)}
    ${taxSubRow(`SGST @ ${sgstPct}%`,
      `<span data-field-key="taxBreakupBasicPlcSgst" data-field-label="Basic+PLC SGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(basicPlusPlcSgst)}</span>`)}
    ${otherCharge > 0 ? `
    ${taxSubHeaderRow(`Other Charges (Rs. ${fmtIndianNumber(otherCharge)})`)}
    ${taxSubRow(`CGST @ ${otherChargeCgstPct}%`,
      `<span data-field-key="taxBreakupOtherChargeCgst" data-field-label="Other Charges CGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(otherChargeCgstAmt)}</span>`)}
    ${taxSubRow(`SGST @ ${otherChargeSgstPct}%`,
      `<span data-field-key="taxBreakupOtherChargeSgst" data-field-label="Other Charges SGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(otherChargeSgstAmt)}</span>`)}` : ''}
    ${b.balcony_charge_amount != null ? `
    ${taxSubHeaderRow(`Balcony Charge (Rs. ${fmtIndianNumber(balconyChargeAmount)}) + GST — Total Rs. ${fmtIndianNumber(balconyChargeTotal)}`)}
    ${taxSubRow(`CGST @ ${cgstPct}%`,
      `<span data-field-key="taxBreakupBalconyCgst" data-field-label="Balcony CGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(balconyCgstAmount)}</span>`)}
    ${taxSubRow(`SGST @ ${sgstPct}%`,
      `<span data-field-key="taxBreakupBalconySgst" data-field-label="Balcony SGST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(balconySgstAmount)}</span>`)}` : ''}
    ${addonTotal > 0 ? `
    ${taxSubHeaderRow(`Add on Charges — GST already included in Rs. ${fmtIndianNumber(addonTotal)}`)}
    ${taxSubHeaderRow(`(see Other/Addon Charges table below for full breakdown)`)}` : ''}
  `;

  const pricingTable = `
    <table style="width:100%;border-collapse:collapse;">
      ${pRow('Carpet Area (Sq. Ft.)',
        `<span data-field-key="carpetArea" data-field-label="Carpet Area (sqft)" data-value-type="number" data-section="pricing">${carpetArea.toFixed(3)}</span>`)}
      ${pRow('Balcony Area (Sq. Ft.)',
        `<span data-field-key="balconyArea" data-field-label="Balcony Area (sqft)" data-value-type="number" data-section="pricing">${balconyArea.toFixed(3)}</span>`)}
      ${pRow('Rate (Rs./Sq. Ft.)',
        `<span data-field-key="ratePerSqft" data-field-label="Rate per Sqft" data-value-type="currency" data-section="pricing">${ratePerSqft.toFixed(3)}</span>`)}
      ${pRow(`Net Basic Price (Rs. ${ratePerSqft.toFixed(2)}/Sq. Ft.)`,
        `<span data-field-key="netBasicPrice" data-field-label="Net Basic Price" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(netBasicPrice)}</span>`, true)}
      ${pRow('Add: PLC (Rs.)',
        `<span data-field-key="plcCharge" data-field-label="PLC Charges" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(plcAmount)}</span>`)}
      ${pRow('Add: Other Charges (Rs.)',
        `<span data-field-key="otherCharges" data-field-label="Other Charges" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(otherCharge)}</span>`)}
      ${pRow('Add on Charges (Rs.)',
        `<span data-field-key="addonTotal" data-field-label="Add on Charges" data-value-type="currency" data-section="pricing" style="display:block;text-align:right;">${fmtIndianCurrency(addonTotal)}</span>`)}
      ${b.balcony_charge_amount != null ? pRow('Add: Balcony Charge (Rs.)',
        `<span data-field-key="balconyChargeDisplay" data-field-label="Balcony Charge" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(balconyChargeAmount)}</span>`
      ) : ''}
      ${pRow('Agreement Value',
        `<span data-field-key="agreementValue" data-field-label="Agreement Value" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(agreementValue)}</span>`, true)}
      ${pRow('Total Consideration',  fmtIndianCurrency(totalConsideration), true)}
      ${taxBreakupBlock}
      ${pRow('CGST (Rs.)',
        `<span data-field-key="cgstAmount" data-field-label="CGST Amount" data-value-type="currency" data-section="pricing" data-cgst-pct="${cgstPct}">${fmtIndianCurrency(cgst)}</span>`)}
      ${pRow('SGST (Rs.)',
        `<span data-field-key="sgstAmount" data-field-label="SGST Amount" data-value-type="currency" data-section="pricing" data-sgst-pct="${sgstPct}">${fmtIndianCurrency(sgst)}</span>`)}
      ${isGstExempt ? `<tr><td colspan="2" style="${baseFont}padding:2px 8px;font-style:italic;color:#666;">(GST Exempt — NRI/OCI/PIO)</td></tr>` : ''}
      ${pRow('',                     fmtIndianCurrency(totalTax))}
      ${pRow('Total Consideration With Tax',
        `<span data-field-key="totalAmountWithGst" data-field-label="Total with GST" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(totalWithTax)}</span>`, true)}
      <tr><td colspan="2" style="${baseFont}padding:2px 8px;font-style:italic;">In words: (${amtWords(totalWithTax)})</td></tr>
      ${pRow('Interest (Rs.)',
        `<span data-field-key="interestAmt" data-field-label="Interest Amount" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(interest)}</span>`)}
      ${pRow('Interest Waive off (Rs.)', 'Rs. 0.00')}
      ${pRow('',                         fmtIndianCurrency(interest))}
      ${pRow('Total Receivables',
        `<span data-field-key="totalReceivables" data-field-label="Total Receivables" data-value-type="currency" data-section="pricing">${fmtIndianCurrency(totalReceivables)}</span>`, true)}
      ${pRow(`Less Receipt (Rs.) (${paidPct} % Paid Amount)`, fmtIndianCurrency(lessReceipt))}
      ${pRow('Balance (Rs.) (To be Paid)', fmtIndianCurrency(balance), true)}
    </table>`;

  const pricingSection = `
    <div ${sectionHd}>Pricing Summary</div>
    ${pricingTable}`;

  // ── SECTION 5 — MILESTONE TIMELINE ───────
  const milestones = [
    { label: 'BOOKING',   date: fmtDate(b.booking_date) },
    { label: 'ALLOTMENT', date: allotmentDate !== '—' ? allotmentDate : '—' },
    { label: 'AGREEMENT', date: agreementDate !== '—' ? agreementDate  : '—' },
    { label: 'COMPLETION',date: completionDate !== '—' ? completionDate : '—' },
  ];
  const milestoneBoxes = milestones.map(m => `
    <td style="width:25%;text-align:center;border:1px solid #999;padding:6px 4px;${baseFont}">
      <div style="font-weight:700;font-size:11px;">${m.label}</div>
      <div style="font-size:10px;margin-top:3px;">${m.date}</div>
    </td>`).join('');
  const milestoneSection = `
    <div ${sectionHd}>Milestone Timeline</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <tr>${milestoneBoxes}</tr>
    </table>`;

  // ── SECTION 6 — OTHER CHARGES TABLE ──────
  let otherChargeRows = '';
  let ocRowNum = 0;
  if (b.has_plc) {
    ocRowNum++;
    otherChargeRows += `<tr>
      <td ${tdStyle}>${ocRowNum}</td>
      <td ${tdL}>PLC</td>
      <td ${tdStyle}>—</td><td ${tdStyle}>—</td><td ${tdStyle}>—</td>
      <td ${tdR}>${fmtIndianNumber(plcAmount)}</td>
      <td ${tdL}>—</td>
    </tr>`;
  }
  if (b.has_other_charge) {
    ocRowNum++;
    otherChargeRows += `<tr>
      <td ${tdStyle}>${ocRowNum}</td>
      <td ${tdL}>Other Charge</td>
      <td ${tdStyle}>—</td><td ${tdStyle}>—</td><td ${tdStyle}>—</td>
      <td ${tdR}>${fmtIndianNumber(otherCharge)}</td>
      <td ${tdL}>${esc(b.other_charge_desc || '—')}</td>
    </tr>`;
  }
  if (b.balcony_charge_amount != null) {
    ocRowNum++;
    otherChargeRows += `<tr>
      <td ${tdStyle}>${ocRowNum}</td>
      <td ${tdL}>Balcony Charge</td>
      <td ${tdStyle}>—</td><td ${tdStyle}>—</td><td ${tdStyle}>—</td>
      <td ${tdR}>${fmtIndianNumber(balconyChargeTotal)}</td>
      <td ${tdL}>—</td>
    </tr>`;
  }
  if (!otherChargeRows) {
    otherChargeRows = `<tr>
      <td ${tdStyle}>—</td><td ${tdL}>—</td>
      <td ${tdStyle}>—</td><td ${tdStyle}>—</td><td ${tdStyle}>—</td>
      <td ${tdR}>—</td><td ${tdL}>—</td>
    </tr>`;
  }
  const otherChargesSection = `
    <div ${sectionHd}>Other Charges</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.NO.</th><th ${thStyle}>OTHER CHARGE</th>
        <th ${thStyle}>PAID QTY.</th><th ${thStyle}>FREE QTY.</th>
        <th ${thStyle}>TOTAL QTY.</th><th ${thStyle}>AMOUNT</th>
        <th ${thStyle}>DESCRIPTION</th>
      </tr></thead>
      <tbody>${otherChargeRows}</tbody>
      <tfoot><tr>
        <td colspan="5" ${tdR} style="${baseFont}border:1px solid #999;padding:3px 5px;font-weight:700;text-align:right;">Total:</td>
        <td ${tdR}><strong>${fmtIndianNumber(plcAmount + otherCharge + balconyChargeTotal)}</strong></td>
        <td ${tdL}></td>
      </tr></tfoot>
    </table>`;

  // ── SECTION 7 — ADDON CHARGES TABLE ──────
  const addonRows = addonCharges.filter((c: any) => parseFloat(c.total_amount || 0) > 0).map((c: any) => ({
    id:                 c.id,
    chargeName:         c.charge_name,
    effectiveDate:      c.effective_date,
    amount:             parseFloat(c.amount || 0),
    increaseAmount:     parseFloat(c.increase_amount || 0),
    amountWithIncrease: parseFloat(c.amount || 0) + parseFloat(c.increase_amount || 0),
    cgstPct:            parseFloat(c.cgst_pct || 0),
    sgstPct:            parseFloat(c.sgst_pct || 0),
    cgstAmount:         parseFloat(c.cgst_amount || 0),
    sgstAmount:         parseFloat(c.sgst_amount || 0),
    itcCgst:            parseFloat(c.itc_cgst || 0),
    itcSgst:            parseFloat(c.itc_sgst || 0),
    totalAmount:        parseFloat(c.total_amount || 0),
    remark:             c.remark || '',
  }));

  const addonBodyRows = addonRows.length === 0
    ? `<tr><td colspan="11" style="${baseFont}border:1px solid #999;padding:4px 8px;text-align:center;color:#666;">No addon charges for this customer.</td></tr>`
    : addonRows.map((r, i) => `<tr>
        <td ${tdStyle}>${i + 1}</td>
        <td ${tdL}>${esc(r.chargeName)}</td>
        <td ${tdStyle}>${r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td ${tdR}>${fmtIndianNumber(r.amount)}</td>
        <td ${tdR}>${fmtIndianNumber(r.increaseAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(r.amountWithIncrease)}</td>
        <td ${tdR}>${fmtIndianNumber(r.cgstAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(r.sgstAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(r.itcCgst)}</td>
        <td ${tdR}>${fmtIndianNumber(r.itcSgst)}</td>
        <td ${tdR}>${fmtIndianNumber(r.totalAmount)}</td>
      </tr>`).join('');

  const addonTotals = addonRows.reduce(
    (acc, r) => ({
      amount:             acc.amount + r.amount,
      increaseAmount:     acc.increaseAmount + r.increaseAmount,
      amountWithIncrease: acc.amountWithIncrease + r.amountWithIncrease,
      cgstAmount:         acc.cgstAmount + r.cgstAmount,
      sgstAmount:         acc.sgstAmount + r.sgstAmount,
      itcCgst:            acc.itcCgst + r.itcCgst,
      itcSgst:            acc.itcSgst + r.itcSgst,
      totalAmount:        acc.totalAmount + r.totalAmount,
    }),
    { amount: 0, increaseAmount: 0, amountWithIncrease: 0, cgstAmount: 0, sgstAmount: 0, itcCgst: 0, itcSgst: 0, totalAmount: 0 },
  );

  const addonTotalsRow = addonRows.length > 0
    ? `<tr style="font-weight:bold">
        <td colspan="3" style="${baseFont}border:1px solid #999;padding:3px 5px;font-weight:700;text-align:right;">Total:</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.amount)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.increaseAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.amountWithIncrease)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.cgstAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.sgstAmount)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.itcCgst)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.itcSgst)}</td>
        <td ${tdR}>${fmtIndianNumber(addonTotals.totalAmount)}</td>
      </tr>`
    : '';

  const addonSection = `
    <div ${sectionHd}>Other/Addon Charges</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.NO.</th>
        <th ${thStyle}>CHARGE NAME</th>
        <th ${thStyle}>EFF. DATE</th>
        <th ${thStyle}>AMOUNT</th>
        <th ${thStyle}>INC. AMT</th>
        <th ${thStyle}>AMT+INC</th>
        <th ${thStyle}>CGST</th>
        <th ${thStyle}>SGST</th>
        <th ${thStyle}>ITC CGST</th>
        <th ${thStyle}>ITC SGST</th>
        <th ${thStyle}>TOTAL</th>
      </tr></thead>
      <tbody>
        ${addonBodyRows}
        ${addonTotalsRow}
      </tbody>
    </table>`;

  // ── SECTION 8 — PARKING DETAIL ────────────
  let parkingRows = '';
  if (parkingSlots.length > 0) {
    parkingSlots.forEach((ps: any, idx: number) => {
      parkingRows += `<tr>
        <td ${tdStyle}>${idx + 1}</td>
        <td ${tdL}>${esc(ps.parking_type || '—')}</td>
        <td ${tdL}>${esc(ps.slot_number  || 'N/A')}</td>
      </tr>`;
    });
  } else {
    parkingRows = `<tr>
      <td ${tdStyle}>1</td><td ${tdL}>—</td><td ${tdL}>N/A</td>
    </tr>`;
  }
  const parkingSection = `
    <div ${sectionHd}>Parking Detail</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.NO.</th><th ${thStyle}>TYPE</th><th ${thStyle}>PARKING ADDRESS</th>
      </tr></thead>
      <tbody>${parkingRows}</tbody>
    </table>`;

  // ── SECTION 9 — TAX DETAILS ───────────────
  const taxSection = `
    <div ${sectionHd}>Tax Details</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.NO.</th><th ${thStyle}>NAME</th>
        <th ${thStyle}>TOTAL</th><th ${thStyle}>PAID</th><th ${thStyle}>BALANCE</th>
      </tr></thead>
      <tbody>
        <tr>
          <td ${tdStyle}>1</td><td ${tdL}>CGST</td>
          <td ${tdR}>${fmtIndianNumber(cgst)}</td>
          <td ${tdR}>${fmtIndianNumber(cgst)}</td>
          <td ${tdR}>0.00</td>
        </tr>
        <tr>
          <td ${tdStyle}>2</td><td ${tdL}>SGST</td>
          <td ${tdR}>${fmtIndianNumber(sgst)}</td>
          <td ${tdR}>${fmtIndianNumber(sgst)}</td>
          <td ${tdR}>0.00</td>
        </tr>
      </tbody>
      <tfoot><tr>
        <td colspan="2" style="${baseFont}border:1px solid #999;padding:3px 5px;font-weight:700;text-align:right;">Total:</td>
        <td ${tdR}><strong>${fmtIndianNumber(totalTax)}</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(totalTax)}</strong></td>
        <td ${tdR}><strong>0.00</strong></td>
      </tr></tfoot>
    </table>`;

  // ── SECTION 10 — PAYMENT CONTRIBUTION ────
  // Compute cleared receipt totals for Payment Contribution table
  const clearedReceipts  = (receiptRows || []).filter((r: any) => r.status === 'cleared');
  // amount_received_inr is GST-inclusive — subtract cgst + sgst to get base
  const clearedBase      = clearedReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.amount_received_inr || 0) - parseFloat(r.cgst_amount || 0) - parseFloat(r.sgst_amount || 0), 0);
  const clearedCgst      = clearedReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.cgst_amount || 0), 0);
  const clearedSgst      = clearedReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.sgst_amount || 0), 0);
  const clearedInterest  = clearedReceipts.reduce((sum: number, r: any) => sum + parseFloat(r.interest_amount || 0), 0);
  const contribAmt       = clearedBase;
  const contribCgst      = clearedCgst;
  const contribSgst      = clearedSgst;
  const contribInterest  = clearedInterest;
  const contribTotal     = clearedBase + clearedCgst + clearedSgst + clearedInterest;
  const payContribSection = `
    <div ${sectionHd}>Payment Contribution</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>NAME</th><th ${thStyle}>AMOUNT</th>
        <th ${thStyle}>CGST</th><th ${thStyle}>SGST</th>
        <th ${thStyle}>INTEREST</th><th ${thStyle}>TOTAL</th>
      </tr></thead>
      <tbody><tr>
        <td ${tdL}>Own Contribution</td>
        <td ${tdR}>${fmtIndianNumber(contribAmt)}</td>
        <td ${tdR}>${fmtIndianNumber(contribCgst)}</td>
        <td ${tdR}>${fmtIndianNumber(contribSgst)}</td>
        <td ${tdR}>${fmtIndianNumber(contribInterest)}</td>
        <td ${tdR}>${fmtIndianNumber(contribTotal)}</td>
      </tr></tbody>
      <tfoot><tr>
        <td ${tdL}><strong>Total</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(contribAmt)}</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(contribCgst)}</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(contribSgst)}</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(contribInterest)}</strong></td>
        <td ${tdR}><strong>${fmtIndianNumber(contribTotal)}</strong></td>
      </tr></tfoot>
    </table>`;

  // ── SECTION 11 — INTEREST SUMMARY ────────
  const interestSummary = `
    <div ${sectionHd}>Interest Summary</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>TOTAL INTEREST</th><th ${thStyle}>WAIVE OFF</th>
        <th ${thStyle}>PAID</th><th ${thStyle}>PAID GST</th>
        <th ${thStyle}>BALANCE GST</th><th ${thStyle}>TOTAL INTEREST</th>
      </tr></thead>
      <tbody><tr>
        <td ${tdR}>${fmtIndianNumber(interest)}</td>
        <td ${tdR}>${fmtIndianNumber(totalWaivedInr)}</td>
        <td ${tdR}>${fmtIndianNumber(interest)}</td>
        <td ${tdR}>0.00</td>
        <td ${tdR}>0.00</td>
        <td ${tdR}>${fmtIndianNumber(interest)}</td>
      </tr></tbody>
    </table>`;

  // ── FOOTER ───────────────────────────────
  const footer = `
    <div style="margin-top:16px;${baseFont}">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          Project: ${projectName} &nbsp;&nbsp;
          First Applicant: ${esc(fullName)} &nbsp;&nbsp;
          Customer ID: ${customerId}
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;">(1/3)</div>
          <div>Date: ${fmtDate(new Date())}</div>
        </div>
      </div>
    </div>`;

  return `
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#000;padding:20px;max-width:900px;margin:0 auto;">
      ${header}
      ${firstApplicant}
      ${coApplicantHtml}
      ${pricingSection}
      ${milestoneSection}
      ${otherChargesSection}
      ${addonSection}
      ${parkingSection}
      ${taxSection}
      ${payContribSection}
      ${interestSummary}
      ${footer}
    </div>`;
}

// ── PAGE 2 BUILDER ───────────────────────

function buildApplicantPage2(
  b: any,
  consumer: any,
  scheduleTemplates: any[],
  settings: Record<string, string>,
  receiptRows: any[] = [],
  demands: any[] = [],
  interestCalcRows: any[] = [],
  otherChargeCgstPct: number = 0,
  otherChargeSgstPct: number = 0,
): string {

  // ── derived values ──────────────────────
  const projectName = esc(b.project_name || '—');
  const fullName    = [consumer.salutation, consumer.first_name,
    consumer.middle_name || '', consumer.last_name].filter(Boolean).join(' ').trim() || '—';
  const customerId  = esc(consumer.form_no || consumer.registration_no || '—');

  const storedRate    = parseFloat(b.basic_rate_inr_sqft  || 0);
  const carpetAreaP2  = parseFloat(b.carpet_area_sqft     || 0);
  const balconyAreaP2 = parseFloat(b.balcony_area_sqft    || 0);
  const unitBasePrice = parseFloat(b.base_price_inr       || 0);
  // b.carpet_area_sqft/b.balcony_area_sqft here are true units-table values
  // (see buildApplicantPage1's identical comment -- same b object, same
  // units-join-overwrite behavior). Net Basic Price is always true-carpet
  // only; Balcony Charge is shown as its own separate line (see
  // OTHER/ADDON CHARGES table below), not folded into basePrice.
  const basePrice     = (storedRate > 0 && carpetAreaP2 > 0)
    ? Math.round(storedRate * carpetAreaP2)
    : unitBasePrice;
  const plcAmount     = parseFloat(b.plc_amount           || 0);
  const otherCharge   = parseFloat(b.other_charge_amount  || 0);
  const balconyChargeAmount = b.balcony_charge_amount != null ? parseFloat(b.balcony_charge_amount) : 0;
  const balconyCgstAmount   = b.balcony_cgst_amount   != null ? parseFloat(b.balcony_cgst_amount)   : 0;
  const balconySgstAmount   = b.balcony_sgst_amount   != null ? parseFloat(b.balcony_sgst_amount)   : 0;
  const balconyChargeTotal  = balconyChargeAmount + balconyCgstAmount + balconySgstAmount;
  const cgstPct       = parseFloat(b.cgst_pct             || 0);
  const sgstPct       = parseFloat(b.sgst_pct             || 0);
  const cgstAmt       = parseFloat(b.cgst_amount          || 0);
  const sgstAmt       = parseFloat(b.sgst_amount          || 0);
  const interest      = parseFloat(b.interest_amount      || 0);
  const bookingAmt    = parseFloat(b.booking_amount       || 0);

  const bookingDate  = b.booking_date ? new Date(b.booking_date) : null;

  // ── shared styles ───────────────────────
  const baseFont = 'font-family:Arial,sans-serif;font-size:8px;color:#000;';
  const thStyle  = `style="${baseFont}font-weight:700;background:#e8e8e8;border:1px solid #999;padding:2px 3px;text-align:center;white-space:nowrap;"`;
  const tdC      = `style="${baseFont}border:1px solid #999;padding:2px 3px;text-align:center;"`;
  const tdR      = `style="${baseFont}border:1px solid #999;padding:2px 3px;text-align:right;"`;
  const tdL      = `style="${baseFont}border:1px solid #999;padding:2px 3px;text-align:left;"`;
  const tdBR     = `style="${baseFont}border:1px solid #999;padding:2px 3px;text-align:right;font-weight:700;"`;
  const sectionHd = `style="${baseFont}font-weight:700;font-size:12px;border-bottom:1px solid #000;padding-bottom:2px;margin:14px 0 6px;text-align:center;"`;

  // ── demand due date map: installment_index → due_date ──
  const demandDueDateMap: Record<number, string> = {};
  demands.forEach((d: any) => {
    if (d.due_date != null && d.installment_index != null) {
      demandDueDateMap[Number(d.installment_index)] = d.due_date;
    }
  });

  // ── demand amount map: installment_index → DB-stored amounts ──
  // Use these instead of recalculating from percentages to avoid JS float rounding gaps
  const demandAmountMap: Record<number, { amt: number; cgst: number; sgst: number; addon: number; addonCgst: number; addonSgst: number }> = {};
  demands.forEach((d: any) => {
    if (d.installment_index != null) {
      demandAmountMap[Number(d.installment_index)] = {
        amt:       Number(d.amount_due_inr      || 0),
        cgst:      Number(d.cgst_amount         || 0),
        sgst:      Number(d.sgst_amount         || 0),
        addon:     Number(d.addon_charge_amount || 0),
        addonCgst: Number(d.addon_cgst_amount   || 0),
        addonSgst: Number(d.addon_sgst_amount   || 0),
      };
    }
  });

  function fmtDDMMYYYY(dateVal: any): string {
    if (!dateVal) return '—';
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  // ── date helper: offset from booking_date (fallback only) ──
  function dueDateStr(offsetDays: any): string {
    if (offsetDays == null || !bookingDate) return '—';
    const d = new Date(bookingDate);
    d.setDate(d.getDate() + parseInt(offsetDays));
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  // ── PAGE HEADER ─────────────────────────
  const pageHeader = `
    <div style="${baseFont}display:flex;justify-content:space-between;margin-bottom:8px;">
      <div>Project: ${projectName} &nbsp;&nbsp; First Applicant: ${esc(fullName)} &nbsp;&nbsp; Customer ID: ${customerId}</div>
      <div style="font-weight:700;">(2/3)</div>
    </div>`;

  // ── SECTION 1 — PAYMENT SCHEDULE ─────────
  const selectedPlan = b.selected_plan_name || null;
  const filteredTemplates = selectedPlan
    ? scheduleTemplates.filter((t: any) => t.plan_name === selectedPlan)
    : [];

  const paidMap: Record<number, number> = {};
  (b.installment_payments || []).forEach((p: any) => {
    paidMap[Number(p.installment_index)] = parseFloat(p.total_paid || 0);
  });

  let schedRows = '';
  let totPct = 0, totNetBsp = 0, totOther = 0, totAddon = 0, totBalcony = 0, totInstAmt = 0;
  let totCgst = 0, totSgst = 0, totNetDue = 0, totPaid = 0;

  if (filteredTemplates.length === 0) {
    schedRows = `<tr><td colspan="14" style="${baseFont}border:1px solid #999;padding:6px;text-align:center;">No payment plan selected</td></tr>`;
  } else {
    filteredTemplates.forEach((t: any, idx: number) => {
      const pct        = parseFloat(t.percentage || 0);
      const netBsp     = basePrice * pct / 100;
      const otherInst  = (plcAmount + otherCharge) * pct / 100;
      const dbAmt      = demandAmountMap[t.installment_index];
      // Use DB-stored amounts when available — avoids JS float rounding gap (e.g. 626.45 vs 626.00)
      const instAmt    = dbAmt ? dbAmt.amt   : Math.round(netBsp + otherInst);
      const addonInst  = dbAmt ? dbAmt.addon : 0;
      // Remainder-derived so netBsp + balconyInst + otherInst + addonInst
      // reconciles to instAmt exactly -- but some already-paid legacy demand
      // rows carry a stale instAmt from before the current pricing model,
      // unrelated to balcony, which would make the remainder wildly overstate
      // balcony's share. Fall back to the independent pct-of-balcony estimate
      // whenever the two diverge by more than Rs. 1000 (normal reconciliation
      // drift seen across every verified row stays under Rs. 500; the stale
      // legacy rows are off by Rs. 20,000+).
      const independentBalcony = t.flat_amount_inr
        ? 0
        : Math.round(balconyChargeAmount * pct / 100);
      const remainderBalcony = t.flat_amount_inr
        ? 0
        : Math.max(0, instAmt - netBsp - otherInst - addonInst);
      const balconyInst = Math.abs(remainderBalcony - independentBalcony) > 1000
        ? independentBalcony
        : remainderBalcony;
      const instCgst   = dbAmt ? dbAmt.cgst  : Math.round((netBsp + otherInst) * cgstPct) / 100;
      const instSgst   = dbAmt ? dbAmt.sgst : Math.round((netBsp + otherInst) * sgstPct) / 100;
      const addonCgstInst = dbAmt ? dbAmt.addonCgst : 0;
      const addonSgstInst = dbAmt ? dbAmt.addonSgst : 0;
      const netDue     = instAmt + instCgst + instSgst + addonInst + addonCgstInst + addonSgstInst;
      const dueDate    = demandDueDateMap[t.installment_index] != null
        ? fmtDDMMYYYY(demandDueDateMap[t.installment_index])
        : '—';

      const paidForRow    = paidMap[t.installment_index] || 0;
      const balanceForRow = Math.max(0, netDue - paidForRow);

      totPct     += pct;
      totNetBsp  += netBsp;
      totOther   += otherInst;
      totAddon   += addonInst;
      totBalcony += balconyInst;
      totInstAmt += instAmt;
      totCgst    += instCgst;
      totSgst    += instSgst;
      totNetDue  += netDue;
      totPaid    += paidForRow;

      schedRows += `<tr>
        <td ${tdC}>${idx + 1}</td>
        <td ${tdL}><span data-field-key="schedInstallmentName_${idx}" data-field-label="Schedule Name (Row ${idx})" data-value-type="text" data-section="payment_schedule">${esc(t.installment_name)}</span></td>
        <td ${tdC}><span data-field-key="schedDueDate_${idx}" data-field-label="Due Date (Row ${idx})" data-value-type="date" data-section="payment_schedule">${dueDate}</span></td>
        <td ${tdR}><span data-field-key="schedPercentage_${idx}" data-field-label="Schedule % (Row ${idx})" data-value-type="percentage" data-section="payment_schedule">${pct.toFixed(2)}</span></td>
        <td ${tdR}>${fmtIndianNumber(netBsp)}</td>
        <td ${tdR}>${fmtIndianNumber(balconyInst)}</td>
        <td ${tdR}>${fmtIndianNumber(otherInst)}</td>
        <td ${tdR}>${fmtIndianNumber(addonInst)}</td>
        <td ${tdR}><span data-field-key="schedAmount_${idx}" data-field-label="Amount (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(instAmt)}</span></td>
        <td ${tdR}><span data-field-key="schedCgst_${idx}" data-field-label="CGST (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(instCgst)}</span></td>
        <td ${tdR}><span data-field-key="schedSgst_${idx}" data-field-label="SGST (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(instSgst)}</span></td>
        <td ${tdR}><span data-field-key="schedTotal_${idx}" data-field-label="Total (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(netDue)}</span></td>
        <td ${tdR}><span data-field-key="schedPaid_${idx}" data-field-label="Paid (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(paidForRow)}</span></td>
        <td ${tdR}><span data-field-key="schedBalance_${idx}" data-field-label="Balance (Row ${idx})" data-value-type="currency" data-section="payment_schedule">${fmtIndianNumber(balanceForRow)}</span></td>
      </tr>`;
    });
  }

  const schedTotalRow = filteredTemplates.length > 0 ? `
    <tr>
      <td ${tdBR} colspan="3">* Total:</td>
      <td ${tdBR}>${totPct.toFixed(2)}</td>
      <td ${tdBR}>${fmtIndianNumber(totNetBsp)}</td>
      <td ${tdBR}>${fmtIndianNumber(totBalcony)}</td>
      <td ${tdBR}>${fmtIndianNumber(totOther)}</td>
      <td ${tdBR}>${fmtIndianNumber(totAddon)}</td>
      <td ${tdBR}>${fmtIndianNumber(totInstAmt)}</td>
      <td ${tdBR}>${fmtIndianNumber(totCgst)}</td>
      <td ${tdBR}>${fmtIndianNumber(totSgst)}</td>
      <td ${tdBR}>${fmtIndianNumber(totNetDue)}</td>
      <td ${tdBR}>${fmtIndianNumber(totPaid)}</td>
      <td ${tdBR}>${fmtIndianNumber(totNetDue - totPaid)}</td>
    </tr>` : '';

  const schedSection = `
    <div ${sectionHd}>PAYMENTS SCHEDULE</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.NO.</th>
        <th ${thStyle}>INSTALLMENT NAME</th>
        <th ${thStyle}>DUE DATE</th>
        <th ${thStyle}>%</th>
        <th ${thStyle}>NET BSP</th>
        <th ${thStyle}>BALCONY CHARGE</th>
        <th ${thStyle}>OTHER CHARGES</th>
        <th ${thStyle}>ADDON CHARGES</th>
        <th ${thStyle}>INST. AMT. DUE</th>
        <th ${thStyle}>INST. CGST</th>
        <th ${thStyle}>SGST</th>
        <th ${thStyle}>NET DUE</th>
        <th ${thStyle}>RECEIVED</th>
        <th ${thStyle}>OUTSTANDING</th>
      </tr></thead>
      <tbody>${schedRows}</tbody>
      <tfoot>${schedTotalRow}</tfoot>
    </table>`;

  // ── SECTION 3 — RECEIPT INFORMATION ──────
  const paymentStatus = b.status === 'complete' ? 'Cleared' : 'Pending';
  const rowBg = paymentStatus === 'Pending'
    ? 'background:#FFFF99'
    : (b.self_or_loan === 'loan' ? 'background:#FFD580' : 'background:#ffffff');
  const netBookingBase = bookingAmt - cgstAmt - sgstAmt;

  // Receipt-table-specific styles (9px font, tighter padding, no nowrap)
  const rFont  = 'font-family:Arial,sans-serif;font-size:9px;color:#000;';
  const rthS   = `style="${rFont}font-weight:700;background:#e8e8e8;border:1px solid #999;padding:2px 3px;text-align:center;overflow-wrap:break-word;"`;
  const rtdC   = `style="${rFont}border:1px solid #999;padding:2px 3px;text-align:center;"`;
  const rtdL   = `style="${rFont}border:1px solid #999;padding:2px 3px;text-align:left;"`;
  const rtdR   = `style="${rFont}border:1px solid #999;padding:2px 3px;text-align:right;"`;
  const rtdRN  = `style="${rFont}border:1px solid #999;padding:2px 3px;text-align:right;white-space:nowrap;"`;
  const rtdBR  = `style="${rFont}border:1px solid #999;padding:2px 3px;text-align:right;font-weight:700;"`;

  const receiptTableRows = receiptRows.length > 0
    ? receiptRows.map((r: any, i: number) => {
        const rCgst   = parseFloat(r.cgst_amount        || 0);
        const rSgst   = parseFloat(r.sgst_amount        || 0);
        const rGross  = parseFloat(r.amount_received_inr || 0);
        const rInt    = parseFloat(r.interest_amount     || 0);
        const rNet    = rGross - rCgst - rSgst;
        const instrNo = r.payment_method === 'cheque' ? (r.cheque_no || '—') : (r.transaction_ref || '—');
        const rRowBg  = ({ pending:'background:#FFFF99', deposited:'background:#d4edda', bounced:'background:#ffcccc', on_hold:'background:#cce5ff', cleared:'background:#ffffff', cancelled:'background:#e2e3e5' } as Record<string,string>)[r.status] ?? 'background:#ffffff';
        const rStatus = ({ pending:'Pending', deposited:'Deposited', cleared:'Cleared', bounced:'Bounced', on_hold:'On Hold', cancelled:'Cancelled' } as Record<string,string>)[r.status] ?? (r.status || 'Pending');
        return `<tr style="${rRowBg}">
          <td ${rtdC}>${i + 1}</td>
          <td ${rtdL}>${esc(r.receipt_number || '—')}</td>
          <td ${rtdC}>${fmtDate(r.received_date)}</td>
          <td ${rtdL}>${capitalize(r.payment_method || '—')}</td>
          <td ${rtdL}>${esc(instrNo)}</td>
          <td ${rtdC}>${fmtDate(r.cheque_date)}</td>
          <td ${rtdL}>${esc(r.bank_name || '—')}</td>
          <td ${rtdL}>${esc(r.branch || '—')}</td>
          <td ${rtdC}>${fmtDate(r.deposit_date)}</td>
          <td ${rtdC}>${fmtDate(r.clearing_date)}</td>
          <td ${rtdC}>—</td>
          <td ${rtdRN}>${fmtIndianNumber(rNet)}</td>
          <td ${rtdRN}>${fmtIndianNumber(rCgst)}</td>
          <td ${rtdRN}>${fmtIndianNumber(rSgst)}</td>
          <td ${rtdRN}>${fmtIndianNumber(rInt)}</td>
          <td ${rtdR}>0.00</td>
          <td ${rtdRN}>${fmtIndianNumber(rGross)}</td>
          <td ${rtdC}>${rStatus}</td>
          <td ${rtdL}>${esc(r.hold_remark || '—')}</td>
          <td ${rtdL}>N/A</td>
          <td ${rtdL}>${esc(r.on_account_of || 'Booking')}</td>
        </tr>`;
      }).join('')
    : `<tr><td ${rtdC} colspan="21" style="${rFont}padding:4px;text-align:center;">No receipts recorded.</td></tr>`;

  const rReceivedRows  = receiptRows.filter((r: any) => ['pending','deposited','cleared','on_hold'].includes(r.status));
  const rReceivedGross = rReceivedRows.reduce((s: number, r: any) => s + parseFloat(r.amount_received_inr || 0), 0);
  const rReceivedCgst  = rReceivedRows.reduce((s: number, r: any) => s + parseFloat(r.cgst_amount || 0), 0);
  const rReceivedSgst  = rReceivedRows.reduce((s: number, r: any) => s + parseFloat(r.sgst_amount || 0), 0);
  const rReceivedInt   = rReceivedRows.reduce((s: number, r: any) => s + parseFloat(r.interest_amount || 0), 0);
  const rReceivedNet   = rReceivedGross - rReceivedCgst - rReceivedSgst;
  const rPendingGross  = receiptRows.filter((r: any) => ['pending','deposited','on_hold'].includes(r.status)).reduce((s: number, r: any) => s + parseFloat(r.amount_received_inr || 0), 0);
  const rClearedGross  = receiptRows.filter((r: any) => r.status === 'cleared').reduce((s: number, r: any) => s + parseFloat(r.amount_received_inr || 0), 0);

  const receiptSection = `
    <div ${sectionHd}>RECEIPT INFORMATION</div>
    <div style="text-align:right;font-size:9px;margin-bottom:4px;font-family:Arial,sans-serif;">
      <span style="display:inline-flex;align-items:center;gap:3px;margin-right:10px">
        <span style="display:inline-block;width:12px;height:12px;background:#FF9999;border:1px solid #999"></span>
        Bounce cheque
      </span>
      <span style="display:inline-flex;align-items:center;gap:3px;margin-right:10px">
        <span style="display:inline-block;width:12px;height:12px;background:#FFFF99;border:1px solid #999"></span>
        Pending cheque
      </span>
      <span style="display:inline-flex;align-items:center;gap:3px;margin-right:10px">
        <span style="display:inline-block;width:12px;height:12px;background:#FFD580;border:1px solid #999"></span>
        Loan Receipt
      </span>
      <span style="display:inline-flex;align-items:center;gap:3px;margin-right:10px">
        <span style="display:inline-block;width:12px;height:12px;background:#cce5ff;border:1px solid #999"></span>
        On Hold
      </span>
      <span style="display:inline-flex;align-items:center;gap:3px">
        <span style="display:inline-block;width:12px;height:12px;background:#d4edda;border:1px solid #999"></span>
        Deposited
      </span>
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead><tr>
        <th ${rthS} style="width:3%">S.NO.</th>
        <th ${rthS} style="width:7%">RECEIPT NO.</th>
        <th ${rthS} style="width:5%">RECEIPT DATE</th>
        <th ${rthS} style="width:3%">MODE</th>
        <th ${rthS} style="width:4%">INSTRUMENT NO.</th>
        <th ${rthS} style="width:5%">INSTRUMENT DATE</th>
        <th ${rthS} style="width:10%">DRAWN ON</th>
        <th ${rthS} style="width:4%">CLEARING BANK</th>
        <th ${rthS} style="width:5%">DEPOSIT DATE</th>
        <th ${rthS} style="width:5%">CLEARING DATE</th>
        <th ${rthS} style="width:2%">BOUNCE DATE</th>
        <th ${rthS} style="width:7%">AMOUNT</th>
        <th ${rthS} style="width:6%">CGST</th>
        <th ${rthS} style="width:6%">SGST</th>
        <th ${rthS} style="width:4%">INTEREST</th>
        <th ${rthS} style="width:2%">EXTRA</th>
        <th ${rthS} style="width:7%">NET AMOUNT</th>
        <th ${rthS} style="width:5%">PAYMENT STATUS</th>
        <th ${rthS} style="width:4%">HOLD REMARKS</th>
        <th ${rthS} style="width:2%">REMARK</th>
        <th ${rthS} style="width:4%">ON ACCOUNT OF</th>
      </tr></thead>
      <tbody>${receiptTableRows}</tbody>
      <tfoot>
        <tr>
          <td ${rtdBR} colspan="11">Received Amt.:</td>
          <td ${rtdBR}>${fmtIndianNumber(rReceivedNet)}</td>
          <td ${rtdBR}>${fmtIndianNumber(rReceivedCgst)}</td>
          <td ${rtdBR}>${fmtIndianNumber(rReceivedSgst)}</td>
          <td ${rtdBR}>${fmtIndianNumber(rReceivedInt)}</td>
          <td ${rtdBR}>0.00</td>
          <td ${rtdBR}>${fmtIndianNumber(rReceivedGross)}</td>
          <td ${rtdBR} colspan="4"></td>
        </tr>
        <tr style="background:#FFFF99">
          <td ${rtdBR} colspan="11">Pending Amt.:</td>
          <td ${rtdBR}>${fmtIndianNumber(rPendingGross)}</td>
          <td ${rtdBR}>0.00</td><td ${rtdBR}>0.00</td>
          <td ${rtdBR}>0.00</td><td ${rtdBR}>0.00</td>
          <td ${rtdBR}>${fmtIndianNumber(rPendingGross)}</td>
          <td ${rtdBR} colspan="4"></td>
        </tr>
        <tr>
          <td ${rtdBR} colspan="11">Cleared Amt.:</td>
          <td ${rtdBR}>${fmtIndianNumber(rClearedGross)}</td>
          <td ${rtdBR}>0.00</td><td ${rtdBR}>0.00</td>
          <td ${rtdBR}>0.00</td><td ${rtdBR}>0.00</td>
          <td ${rtdBR}>${fmtIndianNumber(rClearedGross)}</td>
          <td ${rtdBR} colspan="4"></td>
        </tr>
      </tfoot>
    </table>
    </div>`;

  // ── SECTION 4 — INTEREST TABLE ────────────
  let interestRows = '';
  if (filteredTemplates.length === 0) {
    interestRows = `<tr><td colspan="12" style="${baseFont}border:1px solid #999;padding:6px;text-align:center;">No payment plan selected</td></tr>`;
  } else if (interestCalcRows.length === 0) {
    interestRows = `<tr><td colspan="12" style="${baseFont}border:1px solid #999;padding:6px;text-align:center;">No installment data available</td></tr>`;
  } else {
    let rowNum = 0;
    let totalInterest = 0;
    interestCalcRows.forEach((ir: any) => {
      rowNum++;
      totalInterest += parseFloat(ir.interest_amount || 0);
      const instDate  = fmtDDMMYYYY(ir.installment_date);
      const rcvdDate  = ir.date_received ? fmtDDMMYYYY(ir.date_received) : '—';
      const amtRecd   = ir.amount_received > 0 ? fmtIndianNumber(ir.amount_received) : '—';
      const delayAmt  = ir.delay_amount > 0
        ? fmtIndianNumber(ir.delay_amount)
        : ir.delay_amount < 0
          ? fmtIndianNumber(Math.abs(ir.delay_amount)) + '(Adv)'
          : '0.00';
      const roiFmt    = ir.roi > 0 ? ir.roi.toFixed(2) + '%' : '—';
      const intPrdFmt = ir.interest_period > 0 ? String(ir.interest_period) : '—';

      if (ir.is_first_receipt) {
        interestRows += `<tr>
          <td ${tdC}>${rowNum}</td>
          <td ${tdL}>${esc(ir.installment_name)}</td>
          <td ${tdC}>${instDate}</td>
          <td ${tdR}>${fmtIndianNumber(ir.due_amount)}</td>
          <td ${tdR}>${amtRecd}</td>
          <td ${tdC}>${rcvdDate}</td>
          <td ${tdR}>${delayAmt}</td>
          <td ${tdC}>${ir.delay_days > 0 ? ir.delay_days : 0}</td>
          <td ${tdC}>${ir.grace_period}</td>
          <td ${tdC}>${intPrdFmt}</td>
          <td ${tdC}>${roiFmt}</td>
          <td ${tdR}>${fmtIndianNumber(ir.interest_amount)}</td>
        </tr>`;
      } else {
        interestRows += `<tr>
          <td ${tdC}>${rowNum}</td>
          <td ${tdL}>—</td>
          <td ${tdC}>—</td>
          <td ${tdR}>—</td>
          <td ${tdR}>${amtRecd}</td>
          <td ${tdC}>${rcvdDate}</td>
          <td ${tdR}>${delayAmt}</td>
          <td ${tdC}>${ir.delay_days > 0 ? ir.delay_days : 0}</td>
          <td ${tdC}>${ir.grace_period}</td>
          <td ${tdC}>${intPrdFmt}</td>
          <td ${tdC}>${roiFmt}</td>
          <td ${tdR}>${fmtIndianNumber(ir.interest_amount)}</td>
        </tr>`;
      }
    });
    interestRows += `<tr>
      <td ${tdC} colspan="11" style="text-align:right;font-weight:bold;${baseFont}">TOTAL INTEREST</td>
      <td ${tdR} style="font-weight:bold;">${fmtIndianNumber(totalInterest)}</td>
    </tr>`;
  }

  const interestSection = `
    <div ${sectionHd}>INTEREST</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <thead><tr>
        <th ${thStyle} style="width:4%">S.NO.</th>
        <th ${thStyle} style="width:12%">INST. NAME</th>
        <th ${thStyle} style="width:9%">INST. DATE</th>
        <th ${thStyle} style="width:9%">DUE AMT.</th>
        <th ${thStyle} style="width:9%">AMT. RECD.</th>
        <th ${thStyle} style="width:9%">DATE RECD.</th>
        <th ${thStyle} style="width:9%">DELAY AMT.</th>
        <th ${thStyle} style="width:7%">DELAY DAYS</th>
        <th ${thStyle} style="width:8%">GRACE PRD.</th>
        <th ${thStyle} style="width:8%">INT. PERIOD</th>
        <th ${thStyle} style="width:5%">ROI</th>
        <th ${thStyle} style="width:11%">INT. AMOUNT</th>
      </tr></thead>
      <tbody>${interestRows}</tbody>
    </table>`;

  // ── SECTION 5 — REMARKS ──────────────────
  const remarksSection = `
    <div ${sectionHd}>REMARKS</div>
    <div style="${baseFont}margin-bottom:6px;">
      <strong>Registration Remarks:</strong> ${esc(b.remarks || 'N/A')}
    </div>
    <div style="${baseFont}">
      <strong>Allotment Remarks:</strong> N/A
    </div>`;

  // ── PAGE FOOTER ──────────────────────────
  const footer = `
    <div style="margin-top:16px;${baseFont}display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        Project: ${projectName} &nbsp;&nbsp;
        First Applicant: ${esc(fullName)} &nbsp;&nbsp;
        Customer ID: ${customerId}
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;">(2/3)</div>
        <div>Date: ${fmtDate(new Date())}</div>
      </div>
    </div>`;

  return `
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#000;padding:20px;max-width:1200px;margin:0 auto;">
      ${pageHeader}
      ${schedSection}
      ${receiptSection}
      ${interestSection}
      ${remarksSection}
      ${footer}
    </div>`;
}

// ── PAGE 3 BUILDER ───────────────────────

async function buildApplicantPage3(
  b: any,
  consumer: any,
  settings: Record<string, string>,
  documentDispatches: any[],
  consumerId: string,
): Promise<string> {

  // ── derived values ──────────────────────
  const projectName = esc(b.project_name || '—');
  const fullName    = [consumer.salutation, consumer.first_name,
    consumer.middle_name || '', consumer.last_name].filter(Boolean).join(' ').trim() || '—';
  const customerId  = esc(consumer.form_no || consumer.registration_no || '—');

  // ── shared styles ───────────────────────
  const baseFont  = 'font-family:Arial,sans-serif;font-size:11px;color:#000;';
  const thStyle   = `style="${baseFont}font-weight:700;background:#e8e8e8;border:1px solid #999;padding:3px 6px;text-align:center;"`;
  const tdC       = `style="${baseFont}border:1px solid #999;padding:3px 6px;text-align:center;"`;
  const tdL       = `style="${baseFont}border:1px solid #999;padding:3px 6px;text-align:left;"`;
  const cellLbl   = `style="${baseFont}padding:2px 10px 2px 0;vertical-align:top;font-weight:600;white-space:nowrap;width:22%;"`;
  const cellVal   = `style="${baseFont}padding:2px 0;vertical-align:top;"`;
  const sectionHd = `style="${baseFont}font-weight:700;font-size:12px;border-bottom:1px solid #000;padding-bottom:2px;margin:14px 0 6px;text-align:center;"`;

  // ── PAGE HEADER ─────────────────────────
  const pageHeader = `
    <div style="${baseFont}display:flex;justify-content:space-between;margin-bottom:8px;">
      <div>Project: ${projectName} &nbsp;&nbsp; First Applicant: ${esc(fullName)} &nbsp;&nbsp; Customer ID: ${customerId}</div>
      <div style="font-weight:700;">(3/3)</div>
    </div>`;

  // ── SECTION 1 — DOCUMENT DISPATCH ────────
  let dispatchRows = '';
  if (documentDispatches.length > 0) {
    documentDispatches.forEach((d: any, idx: number) => {
      dispatchRows += `<tr>
        <td ${tdC}>${idx + 1}</td>
        <td ${tdL}>${esc(d.document_type || d.document_name || '—')}</td>
        <td ${tdL}>${esc(d.dispatch_mode || '—')}</td>
        <td ${tdL}>${esc(d.tracking_no   || '—')}</td>
        <td ${tdC}>${fmtDate(d.dispatched_at)}</td>
        <td ${tdL}>${esc(d.remarks       || '—')}</td>
      </tr>`;
    });
  } else {
    for (let i = 1; i <= 3; i++) {
      dispatchRows += `<tr>
        <td ${tdC}>${i}</td>
        <td ${tdL}>—</td><td ${tdL}>—</td>
        <td ${tdL}>—</td><td ${tdC}>—</td><td ${tdL}>—</td>
      </tr>`;
    }
  }

  const dispatchSection = `
    <div ${sectionHd}>DOCUMENT DISPATCH</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.No.</th>
        <th ${thStyle}>Document Name</th>
        <th ${thStyle}>Dispatch Type</th>
        <th ${thStyle}>Dispatch No./Name</th>
        <th ${thStyle}>Dispatch Date</th>
        <th ${thStyle}>Remarks</th>
      </tr></thead>
      <tbody>${dispatchRows}</tbody>
    </table>`;

  // ── SECTION 2 — COMMUNICATIONS LOG ───────
  const commsSection = `
    <div ${sectionHd}>COMMUNICATIONS</div>
    <div style="${baseFont}color:#888;font-style:italic;padding:6px 0;">No communications recorded.</div>`;

  // ── SECTION 3 — KYC DOCUMENTS STATUS ─────
  const kycDocs = [
    { name: 'PAN Card',     number: consumer.pan_no     || '—', submitted: !!consumer.pan_no },
    { name: 'Aadhaar Card', number: consumer.aadhaar_no || '—', submitted: !!consumer.aadhaar_no },
    { name: 'Passport',     number: consumer.passport_no|| '—', submitted: !!consumer.passport_no },
    { name: 'Photograph',   number: '—',                         submitted: false },
  ];

  const kycRows = kycDocs.map((doc, idx) => `<tr>
    <td ${tdC}>${idx + 1}</td>
    <td ${tdL}>${esc(doc.name)}</td>
    <td ${tdL}>${esc(doc.number)}</td>
    <td ${tdC}>${doc.submitted ? 'Submitted' : 'Pending'}</td>
    <td ${tdC}>—</td>
    <td ${tdL}>—</td>
  </tr>`).join('');

  const kycSection = `
    <div ${sectionHd}>KYC DOCUMENTS</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.No.</th>
        <th ${thStyle}>Document Type</th>
        <th ${thStyle}>Document Number</th>
        <th ${thStyle}>Status</th>
        <th ${thStyle}>Verified Date</th>
        <th ${thStyle}>Remarks</th>
      </tr></thead>
      <tbody>${kycRows}</tbody>
    </table>`;

  // ── SECTION 4 — BOOKING DOCUMENTS ────────
  const bookingDocsSection = `
    <div ${sectionHd}>BOOKING DOCUMENTS</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th ${thStyle}>S.No.</th>
        <th ${thStyle}>Document Type</th>
        <th ${thStyle}>Barcode No.</th>
        <th ${thStyle}>Physical Storage</th>
        <th ${thStyle}>Scan Ref.</th>
        <th ${thStyle}>Status</th>
      </tr></thead>
      <tbody>
        <tr><td colspan="6" style="${baseFont}border:1px solid #999;padding:8px;text-align:center;color:#888;font-style:italic;">
          No booking documents recorded.
        </td></tr>
      </tbody>
    </table>`;

  // ── SECTION 5 — NOMINEE DETAILS ──────────
  const nomineeRows = [
    ['Nominee Name',   esc(b.nominee_name     || 'N/A')],
    ['Relation',       esc(b.nominee_relation || 'N/A')],
    ['Finance Type',   capitalize(b.self_or_loan || 'self')],
    ['Finance Bank',   esc(b.finance_bank     || 'N/A')],
    ['Loan Amount',    b.loan_amount ? fmtIndianCurrency(b.loan_amount) : 'N/A'],
  ].map(([l, v]) => `<tr><td ${cellLbl}>${l}:</td><td ${cellVal}>${v}</td></tr>`).join('');

  const nomineeSection = `
    <div ${sectionHd}>NOMINEE DETAILS</div>
    <table style="width:100%;border-collapse:collapse;">${nomineeRows}</table>`;

  // ── SECTION 6 — REGISTRATION DETAILS ─────
  const wrapP3 = (key: string, label: string, val: string, vt = 'text', section = 'misc') =>
    `<span data-field-key="${key}" data-field-label="${label}" data-value-type="${vt}" data-section="${section}">${val}</span>`;

  const regRows = [
    ['Registration No.',  esc(b.registration_no || '—')],
    ['Form No.',          esc(consumer.form_no  || '—')],
    ['Booking Date',      fmtDate(b.booking_date)],
    ['Booking Type',      capitalize(b.booking_type || 'direct')],
    ['RERA No.',          esc(b.rera_number      || 'N/A')],
    ['Status',            capitalize(b.status    || 'active')],
    ['Allotment Date',    wrapP3('allotmentDate',  'Allotment Date',  fmtDate(b.allotment_date)  !== '—' ? fmtDate(b.allotment_date)  : 'Not yet allotted', 'date')],
    ['Agreement Date',    wrapP3('agreementDate',  'Agreement Date',  fmtDate(b.agreement_date)  !== '—' ? fmtDate(b.agreement_date)  : 'Not yet signed',   'date')],
    ['Completion Date',   wrapP3('completionDate', 'Completion Date', fmtDate(b.completion_date) !== '—' ? fmtDate(b.completion_date) : 'Not yet completed', 'date')],
    ['Possession Date',   wrapP3('possessionDate', 'Possession Date', fmtDate(b.possession_date) !== '—' ? fmtDate(b.possession_date) : 'Not yet given',    'date')],
  ].map(([l, v]) => `<tr><td ${cellLbl}>${l}:</td><td ${cellVal}>${v}</td></tr>`).join('');

  const regSection = `
    <div ${sectionHd}>REGISTRATION DETAILS</div>
    <table style="width:100%;border-collapse:collapse;">${regRows}</table>`;

  // ── SECTION 6b — TRANSFER DETAILS ────────
  const transferRowsRes = await db.query(
    `SELECT t.id, t.transfer_date, t.transfer_no, t.transfer_type, t.transfer_amount_inr,
            t.broker_company, t.main_broker, t.sales_person_name, t.approval_status,
            t.old_consumer_id, t.new_consumer_id, t.created_at,
            oc.name AS old_owner_name, oc.first_name AS old_first_name, oc.last_name AS old_last_name,
            nc.name AS new_owner_name, nc.first_name AS new_first_name, nc.last_name AS new_last_name
     FROM ownership_transfers t
     JOIN consumers oc ON oc.id = t.old_consumer_id
     JOIN consumers nc ON nc.id = t.new_consumer_id
     WHERE t.old_consumer_id = $1 OR t.new_consumer_id = $1
     ORDER BY t.created_at ASC`,
    [consumerId],
  );

  let transferSection = '';
  if (transferRowsRes.rows.length > 0) {
    const transferBlocks = await Promise.all(transferRowsRes.rows.map(async (t: any) => {
      const oldName = t.old_owner_name || [t.old_first_name, t.old_last_name].filter(Boolean).join(' ').trim() || '—';
      const newName = t.new_owner_name || [t.new_first_name, t.new_last_name].filter(Boolean).join(' ').trim() || '—';
      const brokerSales = [t.broker_company, t.main_broker, t.sales_person_name].filter(Boolean).join(' / ');

      let linkHtml = '';
      if (t.old_consumer_id === consumerId) {
        const snap = await db.query(
          `SELECT id FROM documents
           WHERE document_type = 'applicant_file' AND document_subtype = 'transfer_snapshot'
             AND consumer_id = $1 AND reference_id = $2 LIMIT 1`,
          [consumerId, t.id],
        );
        if (snap.rows.length > 0) {
          linkHtml = `<div style="margin-top:2px;"><a href="/api/documents/${snap.rows[0].id}/html" target="_blank">View Old Applicant File</a></div>`;
        } else {
          const fallback = await db.query(
            `SELECT id FROM documents
             WHERE document_type = 'applicant_file' AND consumer_id = $1 AND created_at < $2
             ORDER BY created_at DESC LIMIT 1`,
            [consumerId, t.created_at],
          );
          if (fallback.rows.length > 0) {
            linkHtml = `<div style="margin-top:2px;"><a href="/api/documents/${fallback.rows[0].id}/html" target="_blank">View Old Applicant File (recovered, pre-transfer)</a></div>`;
          }
        }
      }

      const tRows = [
        ['Transfer Date', fmtDate(t.transfer_date)],
        ['Transfer No.', esc(t.transfer_no || '—')],
        ['Old Owner', esc(oldName)],
        ['New Owner', esc(newName)],
        ['Transfer Type', capitalize(t.transfer_type || '—')],
        ['Transfer Amount', fmtIndianCurrency(t.transfer_amount_inr || 0)],
        ...(brokerSales ? [['Broker / Sales Person', esc(brokerSales)]] : []),
        ['Approval Status', capitalize(t.approval_status || '—')],
      ].map(([l, v]) => `<tr><td ${cellLbl}>${l}:</td><td ${cellVal}>${v}</td></tr>`).join('');

      return `<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">${tRows}</table>${linkHtml}`;
    }));

    transferSection = `
      <div ${sectionHd}>TRANSFER DETAILS</div>
      ${transferBlocks.join('<div style="margin:8px 0;border-top:1px dashed #999;"></div>')}`;
  }

  // ── PAGE FOOTER ──────────────────────────
  const footer = `
    <div style="margin-top:20px;${baseFont}">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          Project: ${projectName} &nbsp;&nbsp;
          First Applicant: ${esc(fullName)} &nbsp;&nbsp;
          Customer ID: ${customerId}
        </div>
        <div style="text-align:center;font-weight:700;">(3/3)</div>
        <div style="text-align:right;">Date: ${fmtDate(new Date())}</div>
      </div>
    </div>`;

  return `
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#000;padding:20px;max-width:900px;margin:0 auto;">
      ${pageHeader}
      ${dispatchSection}
      ${commsSection}
      ${kycSection}
      ${bookingDocsSection}
      ${nomineeSection}
      ${regSection}
      ${transferSection}
      ${footer}
    </div>`;
}

// ── APPLICANT FILE HTML WRAPPER ───────────

export async function buildApplicantFileHtml(
  b: any,
  consumer: any,
  coApplicants: any[],
  settings: Record<string, string>,
  allocation: any | null,
  parkingSlots: any[],
  scheduleTemplates: any[],
  documentDispatches: any[],
  receiptRows: any[] = [],
  demands: any[] = [],
  interestCalcRows: any[] = [],
  addonCharges: any[] = [],
  totalWaivedInr: number = 0,
  otherChargeCgstPct: number = 0,
  otherChargeSgstPct: number = 0,
  consumerId: string = '',
): Promise<string> {
  const page1 = buildApplicantPage1(b, consumer, coApplicants, settings, allocation, parkingSlots, addonCharges, receiptRows, totalWaivedInr, otherChargeCgstPct, otherChargeSgstPct);
  const page2 = buildApplicantPage2(b, consumer, scheduleTemplates, settings, receiptRows, demands, interestCalcRows, otherChargeCgstPct, otherChargeSgstPct);
  const page3 = await buildApplicantPage3(b, consumer, settings, documentDispatches, consumerId);

  const regNo = esc(b.registration_no || consumer.registration_no || 'Applicant File');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Applicant File — ${regNo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 20px; }
    .page { max-width: 900px; margin: 0 auto; padding: 24px; border: 1px solid #ccc; margin-bottom: 40px; }
    .page-break { page-break-before: always; }
    table { border-collapse: collapse; width: 100%; font-size: 10px; }
    th { background: #f0f0f0; border: 1px solid #999; padding: 5px 6px; text-align: center; font-weight: bold; }
    td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
    .label { font-weight: bold; padding-right: 8px; white-space: nowrap; }
    .section-title { font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; margin-bottom: 8px; margin-top: 16px; padding-bottom: 2px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
    .kv-row { display: flex; margin-bottom: 3px; }
    .milestone-bar { display: flex; gap: 8px; margin: 12px 0; }
    .milestone-box { flex: 1; border: 1px solid #999; text-align: center; padding: 8px 4px; }
    .milestone-label { font-weight: bold; font-size: 10px; }
    .milestone-date { font-size: 10px; margin-top: 4px; color: #333; }
    .no-print { display: block; }
    .action-bar {
      background: #ffffff;
      border-top: 2px solid #e0e0e0;
      padding: 12px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 24px;
    }
    .action-btn {
      background: #17a2b8;
      color: #ffffff;
      border: none;
      padding: 7px 14px;
      font-size: 11px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      border-radius: 3px;
      cursor: pointer;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .action-btn:hover { opacity: 0.85; }
    .action-btn-primary { background: #e83e5a; }
    .action-btn-warning { background: #fd7e14; }
    @media print {
      body { margin: 0; }
      .page {
        border: none;
        box-shadow: none;
        margin: 0 auto;
        margin-bottom: 0;
        padding: 6mm;
        max-width: 100%;
      }
      .page-break { page-break-before: always; }
      .no-print { display: none !important; }
      .action-bar { display: none !important; }
      @page { margin: 12mm; size: A4; }
    }
  </style>
</head>
<body>
  <!-- LETTER MODAL -->
  <div id="letter-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;">
    <div style="background:#fff;margin:10% auto;padding:0;max-width:600px;border-radius:4px;overflow:hidden;">
      <div style="background:#1a3c5e;color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:bold;font-size:13px;letter-spacing:1px;">LETTER</span>
        <span onclick="closeLetterModal()" style="cursor:pointer;font-size:20px;line-height:1;">&times;</span>
      </div>
      <div style="padding:0;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px;border:1px solid #ccc;text-align:center;width:60px;">SR.NO.</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:left;">LETTER TYPE</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:center;">DUE DATE</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:center;width:60px;">PRINT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;">1</td>
              <td style="padding:8px;border:1px solid #ccc;">Demand</td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><input type="date" id="date-demand" style="border:1px solid #ccc;padding:3px;font-size:11px;"></td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><a href="#" onclick="printLetter('demand_letter',document.getElementById('date-demand').value);return false;" style="color:#1a3c5e;font-weight:bold;text-decoration:none;">Print</a></td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;">2</td>
              <td style="padding:8px;border:1px solid #ccc;">Reminder 1</td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><input type="date" id="date-reminder1" style="border:1px solid #ccc;padding:3px;font-size:11px;"></td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><a href="#" onclick="printLetter('reminder_1',document.getElementById('date-reminder1').value);return false;" style="color:#1a3c5e;font-weight:bold;text-decoration:none;">Print</a></td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;">3</td>
              <td style="padding:8px;border:1px solid #ccc;">Reminder 2</td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><input type="date" id="date-reminder2" style="border:1px solid #ccc;padding:3px;font-size:11px;"></td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><a href="#" onclick="printLetter('reminder_2',document.getElementById('date-reminder2').value);return false;" style="color:#1a3c5e;font-weight:bold;text-decoration:none;">Print</a></td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;">4</td>
              <td style="padding:8px;border:1px solid #ccc;">Termination</td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><input type="date" id="date-termination" style="border:1px solid #ccc;padding:3px;font-size:11px;"></td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;"><a href="#" onclick="printLetter('termination',document.getElementById('date-termination').value);return false;" style="color:#1a3c5e;font-weight:bold;text-decoration:none;">Print</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="padding:12px;text-align:right;border-top:1px solid #eee;">
        <button onclick="closeLetterModal()" style="background:#6c757d;color:#fff;border:none;padding:6px 16px;border-radius:3px;cursor:pointer;font-size:11px;">Close</button>
      </div>
    </div>
  </div>

  <!-- RECEIPT DETAIL MODAL -->
  <div id="receipt-detail-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;">
    <div style="background:#fff;margin:5% auto;padding:24px;max-width:900px;max-height:80vh;overflow-y:auto;border-radius:4px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">Receipt Detail</h3>
        <button onclick="document.getElementById('receipt-detail-modal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;">&#10005;</button>
      </div>
      <div id="receipt-detail-content">Loading...</div>
    </div>
  </div>

  <!-- TAX DETAIL MODAL -->
  <div id="tax-detail-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;">
    <div style="background:#fff;margin:5% auto;padding:24px;max-width:900px;max-height:80vh;overflow-y:auto;border-radius:4px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">Tax Detail</h3>
        <button onclick="document.getElementById('tax-detail-modal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;">&#10005;</button>
      </div>
      <div id="tax-detail-content">Loading...</div>
    </div>
  </div>

  <script>
    var CONSUMER_ID = '${consumer.id}';
    var BOOKING_ID = '${b.id}';
    var TOKEN = new URLSearchParams(window.location.search).get('token') || '';

    function openLetterModal() {
      document.getElementById('letter-modal').style.display = 'block';
    }
    function closeLetterModal() {
      document.getElementById('letter-modal').style.display = 'none';
    }
    document.getElementById('letter-modal').addEventListener('click', function(e) {
      if (e.target === this) closeLetterModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeLetterModal();
        document.getElementById('receipt-detail-modal').style.display = 'none';
        document.getElementById('tax-detail-modal').style.display = 'none';
      }
    });

    async function printLetter(documentType, dueDate) {
      if (documentType !== 'demand_letter') {
        alert(documentType.replace(/_/g, ' ') + ' template coming soon');
        return;
      }
      if (!dueDate || dueDate.trim() === '') {
        alert('Please enter a Due Date before printing the Demand Letter.');
        return;
      }
      // Open window synchronously before any await so popup blocker won't trigger
      var win = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');
      if (!win) {
        alert('Please allow popups for this site, then try again');
        return;
      }
      win.document.write('<p style="font-family:Arial;padding:40px;font-size:14px;">Generating letter, please wait…</p>');
      try {
        var genRes = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
          body: JSON.stringify({ consumerId: CONSUMER_ID, documentType: 'demand_letter', dueDate: dueDate })
        });
        if (!genRes.ok) {
          var errData = await genRes.json().catch(function() { return {}; });
          win.close();
          alert('Failed to generate letter: ' + genRes.status + ' — ' + (errData.error || genRes.statusText));
          return;
        }
        var genData = await genRes.json();
        var documentId = (genData.data && genData.data.documentId) || genData.documentId;
        if (!documentId) {
          win.close();
          alert('Failed to generate letter: No document ID returned');
          return;
        }
        var htmlRes = await fetch('/api/documents/' + documentId + '/html', {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        var html = await htmlRes.text();
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var blobUrl = URL.createObjectURL(blob);
        win.location.href = blobUrl;
        setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 60000);
        closeLetterModal();
      } catch(err) {
        win.close();
        alert('Error: ' + err.message);
      }
    }

    async function openReceiptDetail() {
      document.getElementById('receipt-detail-modal').style.display = 'block';
      var content = document.getElementById('receipt-detail-content');
      content.innerHTML = 'Loading...';
      try {
        var res = await fetch('/api/payments/receipts?consumerId=' + CONSUMER_ID, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        var data = await res.json();
        var receipts = data.data || data || [];
        if (!Array.isArray(receipts) || receipts.length === 0) {
          content.innerHTML = '<p style="color:#666;padding:12px;">No receipts found.</p>';
          return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
        html += '<tr style="background:#1a3c5e;color:#fff;">';
        html += '<th style="padding:6px;border:1px solid #ccc;">Receipt No</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;">Date</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;">Mode</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">Amount</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;">Status</th>';
        html += '</tr>';
        receipts.forEach(function(r) {
          html += '<tr>';
          html += '<td style="padding:5px;border:1px solid #ccc;">' + (r.receipt_number || '—') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;">' + ((r.received_date || '').split('T')[0] || '—') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;">' + (r.payment_method || '—') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + Number(r.amount_received_inr || 0).toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;">' + (r.status || '—') + '</td>';
          html += '</tr>';
        });
        html += '</table>';
        content.innerHTML = html;
      } catch(err) {
        content.innerHTML = '<p style="color:#dc3545;">Error loading receipts: ' + err.message + '</p>';
      }
    }

    async function openTaxDetail() {
      document.getElementById('tax-detail-modal').style.display = 'block';
      var content = document.getElementById('tax-detail-content');
      content.innerHTML = 'Loading...';
      try {
        var res = await fetch('/api/payments/demands?consumerId=' + CONSUMER_ID, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        var data = await res.json();
        var demands = data.data || data || [];
        if (!Array.isArray(demands) || demands.length === 0) {
          content.innerHTML = '<p style="color:#666;padding:12px;">No demand data found.</p>';
          return;
        }
        var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
        html += '<tr style="background:#1a3c5e;color:#fff;">';
        html += '<th style="padding:6px;border:1px solid #ccc;">Installment</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">Amount</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">CGST</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">SGST</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">Total Tax</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">Paid</th>';
        html += '<th style="padding:6px;border:1px solid #ccc;text-align:right;">Balance</th>';
        html += '</tr>';
        demands.forEach(function(d) {
          var amt = Number(d.amount_due_inr || 0);
          var cgst = Number(d.cgst_amount || 0);
          var sgst = Number(d.sgst_amount || 0);
          var totalTax = cgst + sgst;
          var paid = Number(d.total_paid || d.amount_paid || 0);
          var balance = Math.max(0, amt + totalTax - paid);
          html += '<tr>';
          html += '<td style="padding:5px;border:1px solid #ccc;">' + (d.demand_type || d.installment_label || '—') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + amt.toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + cgst.toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + sgst.toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + totalTax.toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;">' + paid.toLocaleString('en-IN') + '</td>';
          html += '<td style="padding:5px;border:1px solid #ccc;text-align:right;font-weight:bold;color:#dc3545;">' + balance.toLocaleString('en-IN') + '</td>';
          html += '</tr>';
        });
        html += '</table>';
        content.innerHTML = html;
      } catch(err) {
        content.innerHTML = '<p style="color:#dc3545;">Error loading tax detail: ' + err.message + '</p>';
      }
    }

    async function openReceiptDetailPage(consumerId) {
      try {
        var res = await fetch('/api/payments/receipt-detail/' + consumerId, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        var html = await res.text();
        var blob = new Blob([html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var win = window.open(url, '_blank', 'width=1400,height=750,resizable=yes,scrollbars=yes');
        if (win) {
          setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
        } else {
          URL.revokeObjectURL(url);
          alert('Please allow popups for this site to open the receipt detail.');
        }
      } catch(err) {
        alert('Could not open receipt detail: ' + err.message);
      }
    }

    async function openNewReceiptForm(consumerId) {
      try {
        var res = await fetch('/api/payments/receipt-form/' + consumerId, {
          headers: { 'Authorization': 'Bearer ' + TOKEN }
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        var html = await res.text();
        var blob = new Blob([html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var win = window.open(url, '_blank', 'width=1200,height=750,resizable=yes,scrollbars=yes');
        if (win) {
          win.addEventListener('unload', function() { window.location.reload(); });
          setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
        } else {
          URL.revokeObjectURL(url);
          alert('Please allow popups for this site to open the receipt form.');
        }
      } catch(err) {
        alert('Could not open receipt form: ' + err.message);
      }
    }
  </script>
  <div class="page" id="page1">${page1}</div>
  <div class="page page-break" id="page2">${page2}</div>
  <div class="page page-break" id="page3">${page3}</div>

  <div class="no-print action-bar">
    <button class="action-btn" onclick="openNewReceiptForm(CONSUMER_ID)">RECEIPT</button>
    <button class="action-btn" onclick="alert('Lock feature coming soon')">LOCK</button>
    <button class="action-btn" onclick="window.print()">PRINT</button>
    <button class="action-btn" onclick="alert('Document upload coming soon')">DOCUMENT</button>
    <button class="action-btn" onclick="document.getElementById('page3')&&document.getElementById('page3').scrollIntoView({behavior:'smooth'})">PRINTED DOCUMENT</button>
    <button class="action-btn action-btn-warning" onclick="alert('Reset Interest coming soon')">RESET INTEREST</button>
    <button class="action-btn action-btn-primary" onclick="openLetterModal()">LETTER</button>
    <button class="action-btn" onclick="alert('History coming soon')">HISTORY</button>
    <button class="action-btn" onclick="openReceiptDetailPage(CONSUMER_ID)">RECEIPT DETAIL</button>
    <button class="action-btn" onclick="openTaxDetail()">TAX DETAIL</button>
    <button class="action-btn" onclick="alert('Invoice coming soon')">INVOICE</button>
  </div>
</body>
</html>`;
}

function buildReceiptCopy(b: any, settings: Record<string, string>, copyType: string): string {
  // Company details from settings
  const companyName  = settings['company_name']    || '';
  const companyCin   = settings['company_cin']      || '';
  const companyAddr  = settings['company_address']  || '';
  const companyReg   = settings['company_reg_addr'] || '';
  const companyPhone = settings['company_phone']    || '';
  const companyWeb   = settings['company_website']  || '';
  const companyEmail = settings['company_email']    || '';
  const companyGstin = settings['company_gstin']    || '';
  const placeOfSupply = settings['place_of_supply'] || '';
  const hsnSacCode   = settings['hsn_sac_code']     || '';
  const note1 = settings['receipt_note_1'] || '';
  const note2 = settings['receipt_note_2'] || '';
  const note3 = settings['receipt_note_3'] || '';
  const note4 = settings['receipt_note_4'] || '';

  // Consumer name (primary + co-applicants)
  const primaryName = [b.salutation, b.first_name, b.last_name].filter(Boolean).join(' ').trim();
  const coNames: string[] = [];
  if (Array.isArray(b.co_applicants)) {
    for (const co of b.co_applicants) {
      const n = [co.salutation, co.first_name, co.last_name].filter(Boolean).join(' ').trim();
      if (n) coNames.push(`& ${n}`);
    }
  }
  const consumerName = [primaryName, ...coNames].join(' ').trim() || '—';

  // Address
  const addrParts = [b.present_address, b.present_city, b.present_state].filter(Boolean);
  const address = addrParts.join(', ') + (b.present_pin ? ` - ${b.present_pin}` : '');

  // Receipt number
  const projectCode = (b.project_name || '')
    .replace(/_TEST$/i, '')
    .replace(/\s+/g, '-')
    .toUpperCase();
  const receiptRef = (b.form_no || b.registration_no || '').toString().trim();
  const receiptNo = receiptRef ? `${projectCode}/REC/${receiptRef}` : `${projectCode}/REC/—`;

  // Payment amounts
  const amount      = parseFloat(b.booking_amount || 0);
  const cgst        = parseFloat(b.cgst_amount    || 0);
  const sgst        = parseFloat(b.sgst_amount    || 0);
  const tds         = parseFloat(b.tds_amount     || 0);
  const netAmount   = amount - cgst - sgst;
  const totalAmount = amount;
  const amountWords = numberToWords(totalAmount);

  // Floor ordinal
  const floorOrdinal = b.floor != null ? ordinal(parseInt(b.floor)) : '—';

  // Payment narrative
  const narrative = paymentNarrative(b);

  return `
<div class="receipt-copy">

  <!-- HEADER -->
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-weight:700;font-size:15px">${esc(companyName)}</div>
    <div style="font-size:10px;margin-top:2px">CIN: ${esc(companyCin)}</div>
    <div style="font-size:10px;margin-top:2px">${esc(companyAddr)}</div>
    <div style="font-size:10px;margin-top:2px">Regd. Office: ${esc(companyReg)}</div>
    <div style="font-size:10px;margin-top:4px">${esc(companyPhone)} &nbsp;|&nbsp; ${esc(companyWeb)} &nbsp;|&nbsp; ${esc(companyEmail)}</div>
  </div>
  <hr style="border:none;border-top:1px solid #000;margin:8px 0">
  <div style="text-align:center;font-weight:700;font-size:16px;margin:10px 0 12px">RECEIPT</div>

  <!-- TWO-COLUMN INFO BLOCK -->
  <table style="width:100%;border:none;border-collapse:collapse;margin-bottom:14px">
    <tr>
      <td style="width:60%;vertical-align:top;border:none;padding:0">
        <div style="font-weight:700">Receipt No.: ${esc(receiptNo)}</div>
        <div style="font-weight:700;font-size:13px;margin-top:2px">${esc(copyType)}</div>
        <div style="margin-top:6px">Customer ID: ${esc((b.form_no || b.registration_no || '').toString())}</div>
        <div style="font-weight:700;margin-top:2px">${esc(consumerName)}</div>
        <div style="margin-top:2px;white-space:pre-wrap">${esc(address)}</div>
        <div style="margin-top:2px">(M): ${esc(b.mobile || '—')}</div>
        <div>Email: ${esc(b.email || '—')}</div>
      </td>
      <td style="width:40%;vertical-align:top;border:none;padding:0;text-align:right">
        <div>Place Of Supply: ${esc(placeOfSupply)}</div>
        <div style="margin-top:2px">GSTIN: ${esc(companyGstin)}</div>
        <div style="margin-top:2px">CIN No.: ${esc(companyCin)}</div>
        <div style="margin-top:2px">Receipt Date: ${fmtDate(b.booking_date)}</div>
      </td>
    </tr>
  </table>

  <!-- PAYMENT NARRATIVE -->
  <p style="margin:0 0 14px;line-height:1.7">
    Received with thanks from <strong>${esc(consumerName)}</strong>
    a sum of <strong>Rs. ${fmtAmt(totalAmount)} /-</strong>
    (<strong>${esc(amountWords)}</strong>)
    ${esc(narrative)} against the Unit No.
    <strong>${esc(b.unit_number || '—')}</strong> on
    <strong>${esc(floorOrdinal)} Floor</strong> in
    <strong>${esc(b.project_name || '—')}</strong>,
    ${esc(b.project_location || b.location || '—')}.
    as per following details:
  </p>

  <!-- INSTALLMENT TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px">
    <thead>
      <tr>
        <th style="width:4%">S.No.</th>
        <th>Installment</th>
        <th>Charge</th>
        <th style="width:9%">HSN/SAC</th>
        <th style="width:11%">Amount</th>
        <th style="width:9%">CGST</th>
        <th style="width:9%">SGST</th>
        <th style="width:12%">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center">1</td>
        <td>At the time of Booking</td>
        <td>Basic</td>
        <td style="text-align:center">${esc(hsnSacCode)}</td>
        <td style="text-align:right">${fmtAmt(netAmount)}</td>
        <td style="text-align:right">${fmtAmt(cgst)}</td>
        <td style="text-align:right">${fmtAmt(sgst)}</td>
        <td style="text-align:right">${fmtAmt(totalAmount)}</td>
      </tr>
      <tr class="total-row">
        <td></td><td></td><td></td>
        <td style="text-align:center;font-weight:700">Total</td>
        <td style="text-align:right">${fmtAmt(netAmount)}</td>
        <td style="text-align:right">${fmtAmt(cgst)}</td>
        <td style="text-align:right">${fmtAmt(sgst)}</td>
        <td style="text-align:right">${fmtAmt(totalAmount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- AMOUNT BOX -->
  <div class="amt-box">&#8377; ${fmtAmt(totalAmount)}/-</div>

  <!-- SIGNATURE BLOCK -->
  <div style="text-align:right;margin-top:20px">
    <div>For ${esc(companyName)}</div>
    <div style="height:48px"></div>
    <div>Authorized Signatory</div>
  </div>

  <!-- NOTES -->
  <div style="margin-top:16px;font-size:10px;border-top:1px solid #ccc;padding-top:8px">
    <div style="font-weight:700;margin-bottom:4px">Notes :</div>
    <div>1. ${esc(note1)}</div>
    <div style="margin-top:3px">2. ${esc(note2)}</div>
    <div style="margin-top:3px">3. ${esc(note3)}</div>
    <div style="margin-top:3px">4. ${esc(note4)}</div>
  </div>

</div>`;
}

function buildReceiptHtml(b: any, settings: Record<string, string>, coApplicants: any[]): string {
  b.co_applicants = coApplicants;

  const customerCopy = buildReceiptCopy(b, settings, 'CUSTOMER COPY');
  const officeCopy   = buildReceiptCopy(b, settings, 'OFFICE COPY');

  const regNo = esc(b.registration_no || '—');

  const emailSubject = encodeURIComponent(`Booking Receipt - ${b.registration_no || ''}`);
  const emailBody    = encodeURIComponent(
    `Dear Customer,\n\nPlease find your booking receipt details below.\nRegistration No: ${b.registration_no || ''}\n\nRegards,\n${settings['company_name'] || 'ROF Group'}`
  );
  const emailHref = `mailto:${encodeURIComponent(b.email || '')}?subject=${emailSubject}&body=${emailBody}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt - ${regNo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; background: #fff; margin: 20px; }
  .receipt-copy { max-width: 750px; margin: auto; border: 1px solid #000; padding: 24px; margin-bottom: 40px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #f0f0f0; border: 1px solid #999; padding: 6px 8px; text-align: center; }
  td { border: 1px solid #999; padding: 5px 8px; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .amt-box { display: inline-block; border: 2px solid #000; padding: 6px 14px; font-weight: bold; font-size: 13px; margin: 10px 0; }
  .no-print { margin-bottom: 20px; }
  .hide-customer .customer-copy { display: none; }
  .hide-office   .office-copy   { display: none; }
  @media print {
    .no-print { display: none; }
    .office-copy { page-break-before: always; }
    @page { margin: 15mm; size: A4; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="document.body.className='';window.print()" style="background:#fff;border:1px solid #333;padding:7px 14px;cursor:pointer;border-radius:3px;font-size:12px;margin-right:8px">&#128424; Print Both Copies</button>
  <button onclick="document.body.className='hide-office';window.print();setTimeout(()=>document.body.className='',500)" style="background:#fff;border:1px solid #333;padding:7px 14px;cursor:pointer;border-radius:3px;font-size:12px;margin-right:8px">Download Customer Copy</button>
  <button onclick="document.body.className='hide-customer';window.print();setTimeout(()=>document.body.className='',500)" style="background:#fff;border:1px solid #333;padding:7px 14px;cursor:pointer;border-radius:3px;font-size:12px;margin-right:8px">Download Office Copy</button>
  <button onclick="window.location.href='${emailHref}'" style="background:#fff;border:1px solid #333;padding:7px 14px;cursor:pointer;border-radius:3px;font-size:12px;margin-right:8px">&#9993; E-Mail</button>
  <button onclick="window.opener ? window.close() : window.history.length > 1 ? window.history.back() : (window.location.href='/')" style="background:#fff;border:1px solid #333;padding:7px 14px;cursor:pointer;border-radius:3px;font-size:12px">&#10005; Close</button>
</div>

<div class="customer-copy">${customerCopy}</div>
<div class="office-copy">${officeCopy}</div>

</body>
</html>`;
}

// GET /api/booking/:id/receipt-html  — must be registered before /:id
router.get('/:id/receipt-html', async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = req.params.id;

    // Run settings query and booking query in parallel
    const [settingsResult, bookingResult] = await Promise.all([
      db.query('SELECT key, value FROM global_settings'),
      db.query(`
        SELECT br.*,
          c.salutation, c.first_name, c.last_name,
          c.mobile, c.email,
          c.present_address, c.present_city,
          c.present_state, c.present_pin,
          c.pan_no,
          p.name as project_name,
          p.location as project_location,
          p.rera_number,
          u.unit_number, u.floor, u.bhk_type,
          u.carpet_area_sqft, u.balcony_area_sqft, u.super_area_sqft,
          u.base_price_inr, u.total_price_inr,
          bpt.s_tax_pct, bpt.cgst_pct, bpt.sgst_pct,
          bpt.cgst_amount, bpt.sgst_amount,
          bpt.tds_amount, bpt.gst_interest_pct
        FROM booking_records br
        JOIN consumers c ON c.id = br.consumer_id
        LEFT JOIN projects p ON p.id = br.project_id
        LEFT JOIN units u ON u.id = br.unit_id
        LEFT JOIN booking_payment_taxes bpt
          ON bpt.booking_record_id = br.id
        WHERE br.id = $1
      `, [bookingId]),
    ]);

    if (!bookingResult.rows[0]) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Build settings key-value object
    const settings: Record<string, string> = {};
    for (const row of settingsResult.rows) {
      settings[row.key] = row.value;
    }

    // Load co-applicants using consumer_id from booking result
    let coApplicants: any[] = [];
    try {
      const coResult = await db.query(
        `SELECT salutation, first_name, last_name, applicant_number
         FROM co_applicants
         WHERE consumer_id = $1
         ORDER BY applicant_number ASC`,
        [booking.consumer_id]
      );
      coApplicants = coResult.rows;
    } catch {
      coApplicants = [];
    }

    const html = buildReceiptHtml(booking, settings, coApplicants);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[receipt-html]', err);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// GET /api/booking/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT br.*,
             c.name as consumer_name, c.mobile, c.nationality,
             p.name as project_name,
             u.unit_number,
             b.name as broker_name, b.firm_name as broker_firm_name,
             mb.name as main_broker_name, mb.firm_name as main_broker_firm_name,
             json_build_object(
               'id',               bpt.id,
               's_tax_pct',        bpt.s_tax_pct,
               'cgst_pct',         bpt.cgst_pct,
               'sgst_pct',         bpt.sgst_pct,
               'gst_interest_pct', bpt.gst_interest_pct,
               'cgst_amount',      bpt.cgst_amount,
               'sgst_amount',      bpt.sgst_amount,
               'tds_amount',       bpt.tds_amount
             ) as taxes
      FROM booking_records br
      JOIN consumers c ON c.id = br.consumer_id
      LEFT JOIN projects p ON p.id = br.project_id
      LEFT JOIN units u ON u.id = br.unit_id
      LEFT JOIN brokers b ON b.id = br.broker_id
      LEFT JOIN brokers mb ON mb.id = br.main_broker_id
      LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
      WHERE br.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Booking not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

export default router;
