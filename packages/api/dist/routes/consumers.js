"use strict";
/**
 * Consumer Routes - Module B
 * All consumer endpoints: create, list, get, update, KYC, remarks
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const index_js_1 = require("../index.js");
const booking_js_1 = require("./booking.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const document_recalc_js_1 = require("../utils/document-recalc.js");
const payment_waterfall_js_1 = require("../utils/payment-waterfall.js");
const photoStorage = multer_1.default.diskStorage({
    destination(_req, _file, cb) {
        cb(null, path_1.default.join(__dirname, '../../uploads/consumer-photos'));
    },
    filename(req, file, cb) {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `${req.params.id}${ext}`);
    },
});
const photoUpload = (0, multer_1.default)({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (/^image\/(jpeg|jpg|png|gif)$/.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only jpeg, jpg, png, gif images are allowed'));
        }
    },
});
const coPhotoStorage = multer_1.default.diskStorage({
    destination(_req, _file, cb) {
        cb(null, path_1.default.join(__dirname, '../../uploads/co-applicant-photos'));
    },
    filename(req, file, cb) {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `co-${req.params.id}${ext}`);
    },
});
const coPhotoUpload = (0, multer_1.default)({
    storage: coPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (/^image\/(jpeg|jpg|png|gif)$/.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only jpeg, jpg, png, gif images are allowed'));
        }
    },
});
const addlPhotoStorage = multer_1.default.diskStorage({
    destination(_req, _file, cb) {
        cb(null, path_1.default.join(__dirname, '../../uploads/multi-applicant-photos'));
    },
    filename(req, file, cb) {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        cb(null, `addl-${req.params.applicantId}${ext}`);
    },
});
const addlPhotoUpload = (0, multer_1.default)({
    storage: addlPhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (/^image\/(jpeg|jpg|png|gif)$/.test(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only jpeg, jpg, png, gif images are allowed'));
        }
    },
});
const router = (0, express_1.Router)();
// POST /api/consumers - Create consumer
router.post('/', (0, processPermission_js_1.requireProcess)('new_applicant', 'maker'), async (req, res, next) => {
    try {
        const { 
        // Legacy / simple fields
        name, mobile, email, aadhaar, pan, incomeCategory, income_category, projectId, project_id, 
        // Extended booking form fields
        first_name, last_name, middle_name, salutation, dob, gender, profession, nationality, annual_income, education, company, ppp_id, pan_no, aadhaar_no, alt_mobile, source_of_enquiry, referred_by, lead_stage, form_no, 
        // Applicant type
        applicant_type, 
        // Company applicant fields
        company_name, company_reg_no, company_gstin, authorized_person, authorized_designation, 
        // Co-applicant fields
        co_applicant_first_name, co_applicant_last_name, co_applicant_salutation, co_applicant_pan_no, co_applicant_aadhaar_no, co_applicant_mobile, co_applicant_email, co_applicant_dob, co_applicant_relation, co_applicant_middle_name, co_applicant_gender, co_applicant_father_name, co_applicant_anniversary_date, co_applicant_marital_status, co_applicant_no_of_children, co_applicant_passport_no, co_applicant_email_2, co_applicant_designation, co_applicant_has_poa, co_applicant_nationality, co_applicant_profession, 
        // Co-applicant type + address (migration 041)
        co_applicant_type, co_present_address, co_present_city, co_present_state, co_present_pin, co_present_country, co_present_phone_no, co_present_fax_no, co_present_mobile_no, co_office_address, co_office_city, co_office_state, co_office_pin, co_office_country, co_office_phone_no, co_office_fax_no, co_office_mobile_no, co_perm_address, co_perm_city, co_perm_state, co_perm_pin, co_perm_country, co_perm_phone_no, co_perm_fax_no, co_perm_mobile_no, co_mailing_address_type, co_communication_mode, co_poa_details, 
        // Addresses
        present_address_line1, present_address_line2, present_city, present_state, present_pin, present_country, present_phone_no, present_fax_no, present_mobile_no, office_address_line1, office_city, office_state, office_pin, office_country, office_phone_no, office_fax_no, office_mobile_no, perm_address_line1, perm_city, perm_state, perm_pin, perm_country, perm_phone_no, perm_fax_no, perm_mobile_no, comm_address_line1, comm_pin, comm_city, comm_state, comm_country, comm_phone_no, comm_fax_no, comm_mobile_no, mailing_address_type, communication_mode, 
        // Nominee
        nominee_name, nominee_relation, nominee_dob, nominee_share, 
        // Finance
        finance_bank, loan_amount, loan_sanction_date, 
        // Legacy applicant fields (migration 035)
        father_name, anniversary_date, marital_status = 'not_specified', no_of_children = 0, passport_no, email_2, designation, has_poa = false, phone_no, fax_no, registration_no, } = req.body;
        const consumerMobile = mobile || req.body.mobile;
        const titleCase = (s) => s ? s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
        const consumerName = name
            ? titleCase(name)
            : [first_name, last_name].filter(Boolean).map(titleCase).join(' ') || 'Unknown';
        const projId = projectId || project_id || null;
        const incomeCat = incomeCategory || income_category || null;
        if (!consumerMobile) {
            return res.status(400).json({ error: 'Mobile number is required' });
        }
        // SHA-256 hash Aadhaar & PAN
        const rawAadhaar = aadhaar || aadhaar_no;
        const rawPan = pan || pan_no;
        const aadhaarHash = rawAadhaar ? (0, crypto_1.createHash)('sha256').update(rawAadhaar.replace(/\s/g, '')).digest('hex') : null;
        const panHash = rawPan ? (0, crypto_1.createHash)('sha256').update(rawPan.toUpperCase().trim()).digest('hex') : null;
        const result = await index_js_1.db.query(`INSERT INTO consumers (
         name, mobile, email, aadhaar_hash, aadhaar_no, pan_hash, pan_no, parivar_pehchan_patra,
         income_category, lead_stage, project_id, created_by_user_id,
         first_name, last_name, middle_name, salutation, dob, gender, profession, nationality,
         annual_income, education, company, alt_mobile,
         source_of_enquiry, referred_by,
         present_address, present_address_line2, present_city, present_state, present_pin, present_country,
         present_phone_no, present_fax_no, present_mobile_no,
         office_address, office_city, office_state, office_pin, office_country,
         office_phone_no, office_fax_no, office_mobile_no,
         perm_address, perm_city, perm_state, perm_pin, perm_country,
         perm_phone_no, perm_fax_no, perm_mobile_no,
         comm_address_line1, comm_pin, comm_city, comm_state, comm_country,
         comm_phone_no, comm_fax_no, comm_mobile_no,
         mailing_address_type, communication_mode,
         phone_no, fax_no,
         nominee_name, nominee_relation, nominee_dob, nominee_share,
         finance_bank, loan_amount, loan_sanction_date, form_no,
         applicant_type, company_name, company_reg_no, company_gstin, authorized_person, authorized_designation,
         father_name, anniversary_date, marital_status, no_of_children,
         passport_no, email_2, designation, has_poa,
         registration_no
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
         $27,$28,$29,$30,$31,$32,$33,$34,$35,
         $36,$37,$38,$39,$40,$41,$42,$43,
         $44,$45,$46,$47,$48,$49,$50,$51,
         $52,$53,$54,$55,$56,$57,$58,$59,
         $60,$61,$62,$63,
         $64,$65,$66,$67,
         $68,$69,$70,$71,
         $72,$73,$74,$75,$76,$77,
         $78,$79,$80,$81,$82,$83,$84,$85,
         $86
       )
       ON CONFLICT (project_id, mobile) DO UPDATE SET
         updated_at = NOW(),
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         salutation = EXCLUDED.salutation,
         email = EXCLUDED.email,
         middle_name = EXCLUDED.middle_name,
         father_name = EXCLUDED.father_name,
         dob = EXCLUDED.dob,
         gender = EXCLUDED.gender,
         pan_no = EXCLUDED.pan_no,
         aadhaar_no = EXCLUDED.aadhaar_no,
         nationality = EXCLUDED.nationality,
         profession = EXCLUDED.profession,
         company = EXCLUDED.company,
         designation = EXCLUDED.designation
       RETURNING id, name, mobile, email, lead_stage, project_id, created_at`, [
            consumerName, consumerMobile, email || null, aadhaarHash, rawAadhaar || null, panHash, rawPan || null, ppp_id || null,
            incomeCat, lead_stage || 'enquiry', projId, req.userId,
            first_name || null, last_name || null, middle_name || null, salutation || null,
            dob || null, gender || null, profession || null, nationality || null,
            annual_income ? parseFloat(annual_income) : null, education || null, company || null,
            alt_mobile || null,
            source_of_enquiry || null, referred_by || null,
            // present address
            present_address_line1 || null, present_address_line2 || null, present_city || null,
            present_state || null, present_pin || null, present_country || 'India',
            present_phone_no || null, present_fax_no || null, present_mobile_no || null,
            // office address
            office_address_line1 || null, office_city || null, office_state || null, office_pin || null, office_country || 'India',
            office_phone_no || null, office_fax_no || null, office_mobile_no || null,
            // perm address
            perm_address_line1 || null, perm_city || null, perm_state || null, perm_pin || null, perm_country || 'India',
            perm_phone_no || null, perm_fax_no || null, perm_mobile_no || null,
            // comm address
            comm_address_line1 || null, comm_pin || null, comm_city || null, comm_state || null, comm_country || 'India',
            comm_phone_no || null, comm_fax_no || null, comm_mobile_no || null,
            mailing_address_type || 'present', communication_mode || 'email',
            phone_no || null, fax_no || null,
            // nominee
            nominee_name || null, nominee_relation || null, nominee_dob || null,
            nominee_share ? parseFloat(nominee_share) : 100,
            // finance
            finance_bank || null, loan_amount ? parseFloat(loan_amount) : null, loan_sanction_date || null, form_no || null,
            // applicant meta
            applicant_type || 'individual',
            company_name || null, company_reg_no || null, company_gstin || null,
            authorized_person || null, authorized_designation || null,
            father_name || null, anniversary_date || null, marital_status || 'not_specified',
            no_of_children ? parseInt(no_of_children) : 0,
            passport_no || null, email_2 || null, designation || null,
            has_poa === true || has_poa === 'true',
            registration_no || null,
        ]);
        const consumer = result.rows[0];
        // If multiple applicant type and co-applicant data provided, insert co-applicant record
        if ((applicant_type === 'multiple') && co_applicant_first_name) {
            const coName = `${co_applicant_first_name || ''} ${co_applicant_last_name || ''}`.trim();
            await index_js_1.db.query(`INSERT INTO co_applicants
           (consumer_id, name, first_name, last_name, salutation, relationship,
            pan_no, aadhaar_no, mobile, email, dob,
            middle_name, gender, father_name, anniversary_date, marital_status,
            no_of_children, passport_no, email_2, designation, has_poa,
            nationality, profession, applicant_number,
            applicant_type,
            present_address, present_city, present_state, present_pin, present_country,
            present_phone_no, present_fax_no, present_mobile_no,
            office_address, office_city, office_state, office_pin, office_country,
            office_phone_no, office_fax_no, office_mobile_no,
            perm_address, perm_city, perm_state, perm_pin, perm_country,
            perm_phone_no, perm_fax_no, perm_mobile_no,
            mailing_address_type, communication_mode, poa_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
                 $25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,
                 $47,$48,$49,$50,$51,$52)`, [
                consumer.id,
                coName,
                co_applicant_first_name || null,
                co_applicant_last_name || null,
                co_applicant_salutation || null,
                co_applicant_relation || null,
                co_applicant_pan_no || null,
                co_applicant_aadhaar_no || null,
                co_applicant_mobile || null,
                co_applicant_email || null,
                co_applicant_dob || null,
                co_applicant_middle_name || null,
                co_applicant_gender || null,
                co_applicant_father_name || null,
                co_applicant_anniversary_date || null,
                co_applicant_marital_status || 'not_specified',
                co_applicant_no_of_children ? parseInt(co_applicant_no_of_children) : 0,
                co_applicant_passport_no || null,
                co_applicant_email_2 || null,
                co_applicant_designation || null,
                co_applicant_has_poa === true || co_applicant_has_poa === 'true',
                co_applicant_nationality || null,
                co_applicant_profession || null,
                2,
                // new fields (migration 041)
                co_applicant_type || 'co_applicant',
                co_present_address || null, co_present_city || null, co_present_state || null, co_present_pin || null, co_present_country || 'India',
                co_present_phone_no || null, co_present_fax_no || null, co_present_mobile_no || null,
                co_office_address || null, co_office_city || null, co_office_state || null, co_office_pin || null, co_office_country || 'India',
                co_office_phone_no || null, co_office_fax_no || null, co_office_mobile_no || null,
                co_perm_address || null, co_perm_city || null, co_perm_state || null, co_perm_pin || null, co_perm_country || 'India',
                co_perm_phone_no || null, co_perm_fax_no || null, co_perm_mobile_no || null,
                co_mailing_address_type || 'present', co_communication_mode || 'email', co_poa_details || null,
            ]);
        }
        res.status(201).json({ success: true, data: consumer });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                error: 'A consumer with this mobile number already exists for this project',
                code: 'DUPLICATE_CONSUMER',
            });
        }
        next(error);
    }
});
// GET /api/consumers - List all consumers (with search & filter)
router.get('/', async (req, res, next) => {
    const { projectId, leadStage, search, unitNo, mobile, regNo, dob, pan, address, city, state, email, firstName, middleName, lastName, secondApplicant, secondApplicantPan, page = 1, pageSize = 20, sortBy = 'created_at', sortOrder = 'desc', } = req.query;
    try {
        let query = `SELECT c.id, c.name, c.first_name, c.last_name, c.mobile, c.email, c.lead_stage, c.project_id, c.allocated_unit_id, c.created_at,
                        u.unit_number, u.super_area_sqft as unit_area, t.tower_name,
                        COALESCE(c.registration_no, br.registration_no) as registration_no, br.booking_date as registration_date,
                        b.name as broker_name,
                        co.name as second_applicant_name,
                        p.name as project_name
                 FROM consumers c
                 LEFT JOIN units u ON c.allocated_unit_id = u.id
                 LEFT JOIN towers t ON u.tower_id = t.id
                 LEFT JOIN LATERAL (
                   SELECT registration_no, booking_date, main_broker_id
                   FROM booking_records WHERE consumer_id = c.id
                   ORDER BY created_at DESC LIMIT 1
                 ) br ON true
                 LEFT JOIN brokers b ON br.main_broker_id = b.id
                 LEFT JOIN LATERAL (
                   SELECT name FROM co_applicants WHERE consumer_id = c.id LIMIT 1
                 ) co ON true
                 LEFT JOIN projects p ON c.project_id = p.id
                 WHERE 1=1`;
        const params = [];
        if (projectId) {
            query += ` AND c.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        if (leadStage) {
            query += ` AND c.lead_stage = $${params.length + 1}`;
            params.push(leadStage);
        }
        if (unitNo) {
            query += ` AND u.unit_number ILIKE $${params.length + 1}`;
            params.push(`%${unitNo}%`);
        }
        if (mobile) {
            query += ` AND c.mobile LIKE $${params.length + 1}`;
            params.push(`%${mobile}%`);
        }
        if (regNo) {
            query += ` AND c.registration_no ILIKE $${params.length + 1}`;
            params.push(`%${regNo}%`);
        }
        if (dob) {
            query += ` AND c.dob::date = $${params.length + 1}`;
            params.push(dob);
        }
        if (pan) {
            query += ` AND c.pan_no ILIKE $${params.length + 1}`;
            params.push(`%${pan}%`);
        }
        if (city) {
            query += ` AND c.present_city ILIKE $${params.length + 1}`;
            params.push(`%${city}%`);
        }
        if (address) {
            query += ` AND c.present_address ILIKE $${params.length + 1}`;
            params.push(`%${address}%`);
        }
        if (state) {
            query += ` AND c.present_state ILIKE $${params.length + 1}`;
            params.push(`%${state}%`);
        }
        if (email) {
            query += ` AND c.email ILIKE $${params.length + 1}`;
            params.push(`%${email}%`);
        }
        if (firstName) {
            query += ` AND c.first_name ILIKE $${params.length + 1}`;
            params.push(`%${firstName}%`);
        }
        if (middleName) {
            query += ` AND c.middle_name ILIKE $${params.length + 1}`;
            params.push(`%${middleName}%`);
        }
        if (lastName) {
            query += ` AND c.last_name ILIKE $${params.length + 1}`;
            params.push(`%${lastName}%`);
        }
        if (secondApplicant) {
            query += ` AND co.name ILIKE $${params.length + 1}`;
            params.push(`%${secondApplicant}%`);
        }
        if (secondApplicantPan) {
            query += ` AND EXISTS (SELECT 1 FROM co_applicants ca WHERE ca.consumer_id = c.id AND ca.pan_no ILIKE $${params.length + 1})`;
            params.push(`%${secondApplicantPan}%`);
        }
        if (search) {
            query += ` AND (c.name ILIKE $${params.length + 1} OR c.mobile LIKE $${params.length + 2} OR c.email ILIKE $${params.length + 3} OR u.unit_number ILIKE $${params.length + 4})`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        // Sorting
        query += ` ORDER BY ${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
        // Pagination
        const offset = (page - 1) * pageSize;
        query += ` LIMIT ${pageSize} OFFSET ${offset}`;
        // Build count query matching the data query filters
        let countQuery = `SELECT COUNT(*) FROM consumers c LEFT JOIN units u ON c.allocated_unit_id = u.id${secondApplicant ? ' LEFT JOIN co_applicants co ON co.consumer_id = c.id' : ''} WHERE 1=1`;
        const countParams = [];
        if (projectId) {
            countQuery += ` AND c.project_id = $${countParams.length + 1}`;
            countParams.push(projectId);
        }
        if (leadStage) {
            countQuery += ` AND c.lead_stage = $${countParams.length + 1}`;
            countParams.push(leadStage);
        }
        if (unitNo) {
            countQuery += ` AND u.unit_number ILIKE $${countParams.length + 1}`;
            countParams.push(`%${unitNo}%`);
        }
        if (mobile) {
            countQuery += ` AND c.mobile LIKE $${countParams.length + 1}`;
            countParams.push(`%${mobile}%`);
        }
        if (regNo) {
            countQuery += ` AND c.registration_no ILIKE $${countParams.length + 1}`;
            countParams.push(`%${regNo}%`);
        }
        if (pan) {
            countQuery += ` AND c.pan_no ILIKE $${countParams.length + 1}`;
            countParams.push(`%${pan}%`);
        }
        if (secondApplicant) {
            countQuery += ` AND co.name ILIKE $${countParams.length + 1}`;
            countParams.push(`%${secondApplicant}%`);
        }
        if (search) {
            countQuery += ` AND (c.name ILIKE $${countParams.length + 1} OR c.mobile LIKE $${countParams.length + 2} OR c.email ILIKE $${countParams.length + 3} OR u.unit_number ILIKE $${countParams.length + 4})`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const [dataResult, countResult] = await Promise.all([
            index_js_1.db.query(query, params),
            index_js_1.db.query(countQuery, countParams),
        ]);
        res.json({
            success: true,
            data: dataResult.rows,
            pagination: {
                page: page,
                pageSize: pageSize,
                total: parseInt(countResult.rows[0].count),
            },
        });
    }
    catch (error) {
        console.error('Database error:', error);
        next(error);
    }
});
// GET /api/consumers/:id - Get consumer detail
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT c.id, c.name, c.first_name, c.last_name, c.middle_name, c.photo_url,
              c.salutation, c.dob, c.gender, c.profession, c.nationality,
              c.annual_income, c.education, c.company, c.ppp_id, c.alt_mobile,
              c.mobile, c.email, c.email_2,
              c.aadhaar_no, c.aadhaar_hash, c.pan_no, c.parivar_pehchan_patra,
              c.registration_no, c.form_no, c.project_id,
              c.income_category, c.lead_stage, c.allocated_unit_id, c.created_at,
              c.father_name, c.anniversary_date, c.marital_status,
              c.no_of_children, c.passport_no, c.designation, c.has_poa,
              c.present_address, c.present_address_line2, c.present_city, c.present_state, c.present_pin, c.present_country,
              c.present_phone_no, c.present_fax_no, c.present_mobile_no,
              c.office_address, c.office_city, c.office_state, c.office_pin, c.office_country,
              c.office_phone_no, c.office_fax_no, c.office_mobile_no,
              c.perm_address, c.perm_city, c.perm_state, c.perm_pin, c.perm_country,
              c.perm_phone_no, c.perm_fax_no, c.perm_mobile_no,
              c.comm_address_line1, c.comm_pin, c.comm_city, c.comm_state, c.comm_country,
              c.comm_phone_no, c.comm_fax_no, c.comm_mobile_no,
              c.phone_no, c.fax_no,
              c.nominee_name, c.nominee_relation, c.nominee_dob, c.nominee_share,
              c.finance_bank, c.loan_amount, c.loan_sanction_date,
              c.applicant_type, c.company_name, c.company_reg_no, c.company_gstin,
              c.authorized_person, c.authorized_designation,
              c.mailing_address_type, c.communication_mode,
              u.unit_number, u.bhk_type, u.carpet_area_sqft, u.balcony_area_sqft, u.base_price_inr,
              p.name as project_name
       FROM consumers c
       LEFT JOIN units u ON c.allocated_unit_id = u.id
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Consumer not found' });
        }
        // Fetch KYC documents
        const kycResult = await index_js_1.db.query(`SELECT id, document_type, file_url, expiry_date, verified FROM kyc_documents WHERE consumer_id = $1`, [id]);
        // Fetch payment summary
        const paymentResult = await index_js_1.db.query(`SELECT
        SUM(total_amount_inr) as total_due,
        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = $1 AND status = 'cleared') as collected
       FROM payment_plans WHERE consumer_id = $1`, [id]);
        res.json({
            success: true,
            data: {
                ...result.rows[0],
                kycDocuments: kycResult.rows,
                paymentSummary: paymentResult.rows[0],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/consumers/:id - Update consumer
router.patch('/:id', (0, processPermission_js_1.requireProcess)('edit_applicant', 'maker'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, incomeCategory, income_category, leadStage, lead_stage, present_address_line1, present_city, present_state, present_pin, present_country, present_phone_no, present_fax_no, present_mobile_no, office_address_line1, office_city, office_state, office_pin, office_country, office_phone_no, office_fax_no, office_mobile_no, perm_address_line1, perm_city, perm_state, perm_pin, perm_country, perm_phone_no, perm_fax_no, perm_mobile_no, mobile, alt_mobile, profession, nationality, company, mailing_address_type, communication_mode, comm_address_line1, comm_pin, comm_city, comm_state, comm_country, comm_phone_no, comm_fax_no, comm_mobile_no, phone_no, fax_no, 
        // Previously missing from PATCH
        salutation, first_name, last_name, middle_name, dob, gender, education, annual_income, pan_no, aadhaar_no, ppp_id, 
        // New fields (migration 035)
        father_name, anniversary_date, marital_status, no_of_children, passport_no, email_2, designation, has_poa, } = req.body;
        const result = await index_js_1.db.query(`UPDATE consumers
       SET email               = COALESCE($2,  email),
           income_category     = COALESCE($3,  income_category),
           lead_stage          = COALESCE($4,  lead_stage),
           present_address     = COALESCE($5,  present_address),
           present_city        = COALESCE($6,  present_city),
           present_state       = COALESCE($7,  present_state),
           present_pin         = COALESCE($8,  present_pin),
           present_country     = COALESCE($9,  present_country),
           present_phone_no    = COALESCE($10, present_phone_no),
           present_fax_no      = COALESCE($11, present_fax_no),
           present_mobile_no   = COALESCE($12, present_mobile_no),
           office_address      = COALESCE($13, office_address),
           office_city         = COALESCE($14, office_city),
           office_state        = COALESCE($15, office_state),
           office_pin          = COALESCE($16, office_pin),
           office_country      = COALESCE($17, office_country),
           office_phone_no     = COALESCE($18, office_phone_no),
           office_fax_no       = COALESCE($19, office_fax_no),
           office_mobile_no    = COALESCE($20, office_mobile_no),
           perm_address        = COALESCE($21, perm_address),
           perm_city           = COALESCE($22, perm_city),
           perm_state          = COALESCE($23, perm_state),
           perm_pin            = COALESCE($24, perm_pin),
           perm_country        = COALESCE($25, perm_country),
           perm_phone_no       = COALESCE($26, perm_phone_no),
           perm_fax_no         = COALESCE($27, perm_fax_no),
           perm_mobile_no      = COALESCE($28, perm_mobile_no),
           mobile              = COALESCE($29, mobile),
           alt_mobile          = COALESCE($30, alt_mobile),
           profession          = COALESCE($31, profession),
           nationality         = COALESCE($32, nationality),
           company             = COALESCE($33, company),
           mailing_address_type= COALESCE($34, mailing_address_type),
           communication_mode  = COALESCE($35, communication_mode),
           comm_address_line1  = COALESCE($36, comm_address_line1),
           comm_pin            = COALESCE($37, comm_pin),
           comm_city           = COALESCE($38, comm_city),
           comm_state          = COALESCE($39, comm_state),
           comm_country        = COALESCE($40, comm_country),
           comm_phone_no       = COALESCE($41, comm_phone_no),
           comm_fax_no         = COALESCE($42, comm_fax_no),
           comm_mobile_no      = COALESCE($43, comm_mobile_no),
           phone_no            = COALESCE($44, phone_no),
           fax_no              = COALESCE($45, fax_no),
           salutation          = COALESCE($46, salutation),
           first_name          = COALESCE($47, first_name),
           last_name           = COALESCE($48, last_name),
           name                = REGEXP_REPLACE(TRIM(INITCAP(COALESCE($47, first_name)) || ' ' || INITCAP(COALESCE($48, last_name))), '\s+', ' ', 'g'),
           middle_name         = COALESCE($49, middle_name),
           dob                 = COALESCE($50, dob),
           gender              = COALESCE($51, gender),
           education           = COALESCE($52, education),
           annual_income       = COALESCE($53, annual_income),
           pan_no              = COALESCE($54, pan_no),
           aadhaar_no          = COALESCE($55, aadhaar_no),
           parivar_pehchan_patra = COALESCE($56, parivar_pehchan_patra),
           father_name         = COALESCE($57, father_name),
           anniversary_date    = COALESCE($58, anniversary_date),
           marital_status      = COALESCE($59, marital_status),
           no_of_children      = COALESCE($60, no_of_children),
           passport_no         = COALESCE($61, passport_no),
           email_2             = COALESCE($62, email_2),
           designation         = COALESCE($63, designation),
           has_poa             = COALESCE($64, has_poa),
           updated_at          = NOW()
       WHERE id = $65
       RETURNING id, name, email, income_category, lead_stage,
                 mailing_address_type, communication_mode,
                 comm_address_line1, comm_pin, comm_city, comm_state, comm_country,
                 updated_at`, [
            name || null, email || null,
            incomeCategory || income_category || null,
            leadStage || lead_stage || null,
            present_address_line1 || null, present_city || null, present_state || null,
            present_pin || null, present_country || null,
            present_phone_no || null, present_fax_no || null, present_mobile_no || null,
            office_address_line1 || null, office_city || null, office_state || null, office_pin || null, office_country || null,
            office_phone_no || null, office_fax_no || null, office_mobile_no || null,
            perm_address_line1 || null, perm_city || null, perm_state || null,
            perm_pin || null, perm_country || null,
            perm_phone_no || null, perm_fax_no || null, perm_mobile_no || null,
            mobile || null, alt_mobile || null,
            profession || null, nationality || null, company || null,
            mailing_address_type || null, communication_mode || null,
            comm_address_line1 || null, comm_pin || null, comm_city || null,
            comm_state || null, comm_country || null,
            comm_phone_no || null, comm_fax_no || null, comm_mobile_no || null,
            phone_no || null, fax_no || null,
            salutation || null, first_name || null, last_name || null, middle_name || null,
            dob || null, gender || null, education || null,
            annual_income ? parseFloat(annual_income) : null,
            pan_no || null, aadhaar_no || null, ppp_id || null,
            father_name || null, anniversary_date || null, marital_status || null,
            no_of_children != null ? parseInt(no_of_children) : null,
            passport_no || null, email_2 || null, designation || null,
            has_poa != null ? (has_poa === true || has_poa === 'true') : null,
            id,
        ]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Consumer not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/consumers/:id/photo - Upload consumer photo
router.post('/:id/photo', photoUpload.single('photo'), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required (jpeg, jpg, png, gif, max 5MB)' });
        }
        // Delete old photo from disk if one exists
        const existing = await index_js_1.db.query(`SELECT photo_url FROM consumers WHERE id = $1`, [id]);
        if (existing.rows[0]?.photo_url) {
            const oldPath = path_1.default.join(__dirname, '../../', existing.rows[0].photo_url.replace(/^\//, ''));
            if ((0, fs_1.existsSync)(oldPath)) {
                try {
                    (0, fs_1.unlinkSync)(oldPath);
                }
                catch { /* ignore if already deleted */ }
            }
        }
        const photoUrl = `/uploads/consumer-photos/${req.file.filename}`;
        await index_js_1.db.query(`UPDATE consumers SET photo_url = $1, updated_at = NOW() WHERE id = $2`, [photoUrl, id]);
        res.json({ success: true, data: { photo_url: photoUrl } });
    }
    catch (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large — maximum size is 5MB' });
        }
        next(err);
    }
});
// POST /api/consumers/:id/co-applicant-photo - Upload co-applicant photo
router.post('/:id/co-applicant-photo', coPhotoUpload.single('photo'), async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required (jpeg, jpg, png, gif, max 5MB)' });
        }
        const existing = await index_js_1.db.query(`SELECT photo_url FROM co_applicants WHERE consumer_id = $1`, [id]);
        if (existing.rows[0]?.photo_url) {
            const oldPath = path_1.default.join(__dirname, '../../', existing.rows[0].photo_url.replace(/^\//, ''));
            if ((0, fs_1.existsSync)(oldPath)) {
                try {
                    (0, fs_1.unlinkSync)(oldPath);
                }
                catch { /* ignore */ }
            }
        }
        const photoUrl = `/uploads/co-applicant-photos/${req.file.filename}`;
        await index_js_1.db.query(`UPDATE co_applicants SET photo_url = $1 WHERE consumer_id = $2`, [photoUrl, id]);
        res.json({ success: true, data: { photo_url: photoUrl } });
    }
    catch (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large — maximum size is 5MB' });
        }
        next(err);
    }
});
// POST /api/consumers/:id/kyc-documents - Upload KYC document
router.post('/:id/kyc-documents', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { documentType, fileUrl, expiryDate } = req.body;
        const result = await index_js_1.db.query(`INSERT INTO kyc_documents (consumer_id, document_type, file_url, expiry_date, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, document_type, file_url, expiry_date`, [id, documentType, fileUrl, expiryDate, req.userId]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/consumers/:id/remarks - Add remark
router.post('/:id/remarks', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { channel, subject, notes, followUpDate, tags } = req.body;
        const result = await index_js_1.db.query(`INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, channel, subject, notes, timestamp`, [id, req.userId, channel, subject, notes, followUpDate, JSON.stringify(tags || [])]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/consumers/:id/remarks - Get remarks log
router.get('/:id/remarks', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT id, channel, subject, notes, timestamp, follow_up_date, tags
       FROM remarks WHERE consumer_id = $1
       ORDER BY timestamp DESC`, [id]);
        res.json({
            success: true,
            data: result.rows,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/consumers/:id/base-rate - Update base rate and log to audit
router.post('/:id/base-rate', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { baseRate } = req.body;
        const consumerResult = await index_js_1.db.query(`SELECT allocated_unit_id FROM consumers WHERE id = $1`, [id]);
        if (consumerResult.rows.length === 0 || !consumerResult.rows[0].allocated_unit_id) {
            return res.status(400).json({ error: 'Consumer has no allocated unit' });
        }
        const unitId = consumerResult.rows[0].allocated_unit_id;
        // Get old basic price
        const unitResult = await index_js_1.db.query(`SELECT basic_price FROM units WHERE id = $1`, [unitId]);
        const oldPrice = unitResult.rows[0].basic_price;
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            await client.query(`UPDATE units SET basic_price = $1, updated_at = NOW() WHERE id = $2`, [baseRate, unitId]);
            await client.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, 'BASE_RATE_UPDATE', $3, $4, 'Manual update from Pricing Matrix')`, [id, req.userId, JSON.stringify({ basic_price: oldPrice }), JSON.stringify({ basic_price: baseRate })]);
            await client.query('COMMIT');
            res.json({ success: true, message: 'Base rate updated successfully' });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        next(error);
    }
});
// POST /api/consumers/:id/multi-applicants - Save/replace all multi applicants (applicant_number >= 2)
router.post('/:id/multi-applicants', async (req, res, next) => {
    try {
        const { id } = req.params;
        const applicants = req.body.applicants || [];
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            // Remove existing additional applicants (keep co-applicant at applicant_number = 2)
            await client.query(`DELETE FROM co_applicants WHERE consumer_id = $1 AND applicant_number > 2`, [id]);
            const inserted = [];
            for (let i = 0; i < applicants.length; i++) {
                const a = applicants[i];
                const coName = `${a.first_name || ''} ${a.last_name || ''}`.trim();
                const r = await client.query(`INSERT INTO co_applicants
             (consumer_id, name, first_name, last_name, salutation, relationship,
              pan_no, aadhaar_no, mobile, email, dob,
              middle_name, gender, father_name, anniversary_date, marital_status,
              no_of_children, passport_no, email_2, designation, has_poa,
              nationality, profession, applicant_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
           RETURNING id, applicant_number`, [
                    id, coName,
                    a.first_name || null, a.last_name || null, a.salutation || null, a.relation || null,
                    a.pan_no || null, a.aadhaar_no || null, a.mobile || null, a.email || null, a.dob || null,
                    a.middle_name || null, a.gender || null, a.father_name || null, a.anniversary_date || null,
                    a.marital_status || 'not_specified',
                    a.no_of_children ? parseInt(a.no_of_children) : 0,
                    a.passport_no || null, a.email_2 || null, a.designation || null,
                    a.has_poa === true || a.has_poa === 'true',
                    a.nationality || null, a.profession || null,
                    i + 3,
                ]);
                inserted.push(r.rows[0]);
            }
            await client.query('COMMIT');
            res.status(201).json({ success: true, data: inserted });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        next(error);
    }
});
// GET /api/consumers/:id/multi-applicants - List multi applicants
router.get('/:id/multi-applicants', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT id, consumer_id, name, first_name, last_name, salutation, relationship,
              pan_no, aadhaar_no, mobile, email, dob,
              middle_name, gender, father_name, anniversary_date, marital_status,
              no_of_children, passport_no, email_2, designation, has_poa,
              nationality, profession, photo_url, applicant_number
       FROM co_applicants
       WHERE consumer_id = $1 AND applicant_number > 2
       ORDER BY applicant_number`, [id]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/consumers/:id/multi-applicants/:applicantId - Delete one multi applicant and renumber
router.delete('/:id/multi-applicants/:applicantId', async (req, res, next) => {
    try {
        const { id, applicantId } = req.params;
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM co_applicants WHERE id = $1 AND consumer_id = $2 AND applicant_number > 2`, [applicantId, id]);
            // Renumber remaining additional applicants (>2) starting at 3
            const remaining = await client.query(`SELECT id FROM co_applicants WHERE consumer_id = $1 AND applicant_number > 2 ORDER BY applicant_number`, [id]);
            for (let i = 0; i < remaining.rows.length; i++) {
                await client.query(`UPDATE co_applicants SET applicant_number = $1 WHERE id = $2`, [i + 3, remaining.rows[i].id]);
            }
            await client.query('COMMIT');
            res.json({ success: true });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        next(error);
    }
});
// POST /api/consumers/:id/multi-applicant-photo/:applicantId - Upload photo for a specific multi applicant
router.post('/:id/multi-applicant-photo/:applicantId', addlPhotoUpload.single('photo'), async (req, res, next) => {
    try {
        const { applicantId } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required (jpeg, jpg, png, gif, max 5MB)' });
        }
        const existing = await index_js_1.db.query(`SELECT photo_url FROM co_applicants WHERE id = $1`, [applicantId]);
        if (existing.rows[0]?.photo_url) {
            const oldPath = path_1.default.join(__dirname, '../../', existing.rows[0].photo_url.replace(/^\//, ''));
            if ((0, fs_1.existsSync)(oldPath)) {
                try {
                    (0, fs_1.unlinkSync)(oldPath);
                }
                catch { /* ignore */ }
            }
        }
        const photoUrl = `/uploads/multi-applicant-photos/${req.file.filename}`;
        await index_js_1.db.query(`UPDATE co_applicants SET photo_url = $1 WHERE id = $2`, [photoUrl, applicantId]);
        res.json({ success: true, data: { photo_url: photoUrl } });
    }
    catch (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large — maximum size is 5MB' });
        }
        next(err);
    }
});
// GET /api/consumers/:id/applicant-file
// Returns a 3-page applicant file as HTML for printing.
// Supports ?token= query param for window.open() navigation.
router.get('/:id/applicant-file', async (req, res, next) => {
    try {
        const consumerId = req.params.id;
        // ── parallel queries ─────────────────
        const [settingsRes, consumerBookingRes, coApplicantsRes, parkingRes] = await Promise.all([
            index_js_1.db.query(`SELECT key, value FROM global_settings`),
            index_js_1.db.query(`
        SELECT br.*, br.communication_mode, br.mailing_address_type,
          c.first_name, c.last_name, c.middle_name, c.salutation,
          c.father_name, c.dob, c.mobile, c.email, c.email_2,
          c.pan_no, c.aadhaar_no, c.passport_no, c.nationality,
          c.gender, c.profession, c.designation, c.company,
          c.no_of_children, c.has_poa, c.marital_status,
          c.present_address, c.present_city, c.present_state,
          c.present_pin, c.present_country, c.present_phone_no,
          c.office_address, c.office_city, c.office_state, c.office_pin, c.office_country,
          c.perm_address, c.perm_city, c.perm_state, c.perm_pin, c.perm_country,
          c.comm_address_line1, c.comm_city, c.comm_state, c.comm_pin, c.comm_country,
          c.form_no AS consumer_form_no, c.registration_no AS consumer_reg_no,
          c.income_category, c.lead_stage, c.annual_income,
          u.unit_number, u.floor, u.bhk_type,
          u.carpet_area_sqft, u.super_area_sqft, u.balcony_area_sqft,
          u.base_price_inr, u.total_price_inr, u.facing,
          t.tower_name,
          p.name AS project_name, p.location AS project_location,
          p.rera_number,
          bpt.cgst_pct, bpt.sgst_pct,
          bpt.cgst_amount, bpt.sgst_amount,
          bpt.tds_amount, bpt.gst_interest_pct, bpt.s_tax_pct,
          b.name AS broker_name, b.rera_number AS broker_rera,
          e.name AS employee_name,
          u2.name AS created_by_name,
          COALESCE((
            SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = c.id
            AND r.status = 'cleared'
          ), 0) AS total_received_inr,
          COALESCE((
            SELECT json_agg(json_build_object(
              'installment_index', rr.installment_index,
              'total_paid', rr.total_paid
            ))
            FROM (
              SELECT installment_index,
                     SUM(amount_received_inr) AS total_paid
              FROM receipts
              WHERE consumer_id = c.id
                AND status = 'cleared'
              GROUP BY installment_index
            ) rr
          ), '[]'::json) AS installment_payments
        FROM consumers c
        LEFT JOIN booking_records br
          ON br.consumer_id = c.id
          AND br.status IN ('complete','pending_payment','active')
        LEFT JOIN units u ON u.id = br.unit_id
        LEFT JOIN towers t ON t.id = u.tower_id
        LEFT JOIN projects p ON p.id = br.project_id
        LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
        LEFT JOIN brokers b ON b.id = br.broker_id
        LEFT JOIN users e ON e.id = br.sales_employee_id
        LEFT JOIN users u2 ON u2.id = br.created_by
        WHERE c.id = $1
        ORDER BY br.created_at DESC
        LIMIT 1`, [consumerId]),
            index_js_1.db.query(`SELECT * FROM co_applicants WHERE consumer_id = $1 ORDER BY applicant_number ASC`, [consumerId]),
            index_js_1.db.query(`SELECT slot_number, parking_type AS type, floor, amount_inr
         FROM parking_slots WHERE allotted_to_consumer_id = $1`, [consumerId]),
        ]);
        if (consumerBookingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Consumer not found' });
        }
        const row = consumerBookingRes.rows[0];
        // ── build flat settings object ────────
        const settings = {};
        settingsRes.rows.forEach((r) => { settings[r.key] = r.value; });
        // ── separate consumer from booking ────
        const consumer = {
            id: consumerId,
            first_name: row.first_name,
            last_name: row.last_name,
            middle_name: row.middle_name,
            salutation: row.salutation,
            father_name: row.father_name,
            dob: row.dob,
            mobile: row.mobile,
            email: row.email,
            email_2: row.email_2,
            pan_no: row.pan_no,
            aadhaar_no: row.aadhaar_no,
            passport_no: row.passport_no,
            nationality: row.nationality,
            gender: row.gender,
            profession: row.profession,
            designation: row.designation,
            company: row.company,
            no_of_children: row.no_of_children,
            has_poa: row.has_poa,
            marital_status: row.marital_status,
            present_address: row.present_address,
            present_city: row.present_city,
            present_state: row.present_state,
            present_pin: row.present_pin,
            present_country: row.present_country,
            present_phone_no: row.present_phone_no,
            office_address: row.office_address,
            office_city: row.office_city,
            office_state: row.office_state,
            office_pin: row.office_pin,
            office_country: row.office_country,
            perm_address: row.perm_address,
            perm_city: row.perm_city,
            perm_state: row.perm_state,
            perm_pin: row.perm_pin,
            perm_country: row.perm_country,
            comm_address_line1: row.comm_address_line1,
            comm_city: row.comm_city,
            comm_state: row.comm_state,
            comm_pin: row.comm_pin,
            comm_country: row.comm_country,
            mailing_address_type: row.mailing_address_type,
            communication_mode: row.communication_mode,
            form_no: row.consumer_form_no,
            registration_no: row.consumer_reg_no,
            income_category: row.income_category,
            lead_stage: row.lead_stage,
            interest_start_date: row.interest_start_date ?? null,
            grace_period_days: row.grace_period_days ?? 0,
        };
        // ── sequential queries needing project_id ─
        const projectId = row.project_id || null;
        const selectedPlan = row.selected_plan_name || null;
        const [templatesRes, allocationRes, dispatchRes, receiptsRes, demandsRes] = await Promise.all([
            projectId && selectedPlan
                ? index_js_1.db.query(`SELECT * FROM plan_schedule_templates
             WHERE project_id = $1 AND plan_name = $2
             ORDER BY installment_index ASC`, [projectId, selectedPlan])
                : Promise.resolve({ rows: [] }),
            index_js_1.db.query(`SELECT * FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`, [consumerId]),
            index_js_1.db.query(`SELECT * FROM document_dispatch WHERE consumer_id = $1 ORDER BY dispatched_at DESC`, [consumerId]),
            index_js_1.db.query(`SELECT r.receipt_number, r.received_date, r.amount_received_inr,
                r.payment_method, r.cheque_no, r.transaction_ref, r.cheque_date,
                r.bank_name, r.branch, r.interest_amount, r.status,
                r.deposit_date, r.clearing_date, r.hold_remark,
                COALESCE(d.cgst_amount, ROUND(r.amount_received_inr * COALESCE((SELECT gts.cgst_pct / 100 FROM gst_tax_charge_mapping gcm JOIN gst_slabs gs ON gs.id = gcm.slab_id AND gs.from_date <= CURRENT_DATE AND gs.to_date >= CURRENT_DATE JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id WHERE gcm.project_id = proj.id AND gcm.charge_type = 'BASIC' LIMIT 1), 0.005))) AS cgst_amount,
                COALESCE(d.sgst_amount, ROUND(r.amount_received_inr * COALESCE((SELECT gts.sgst_pct / 100 FROM gst_tax_charge_mapping gcm JOIN gst_slabs gs ON gs.id = gcm.slab_id AND gs.from_date <= CURRENT_DATE AND gs.to_date >= CURRENT_DATE JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id WHERE gcm.project_id = proj.id AND gcm.charge_type = 'BASIC' LIMIT 1), 0.005))) AS sgst_amount,
                COALESCE(d.demand_type, 'Booking') AS on_account_of
         FROM receipts r
         LEFT JOIN demands d ON d.id = r.demand_id
         LEFT JOIN payment_plans pp2 ON pp2.id = r.payment_plan_id
         LEFT JOIN projects proj ON proj.id = pp2.project_id
         WHERE r.consumer_id = $1
           AND r.status != 'cancelled'
           AND r.payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY r.received_date ASC, r.created_at ASC`, [consumerId, row.unit_id]),
            index_js_1.db.query(`SELECT installment_index, due_date, status, amount_due_inr, addon_charge_amount, addon_cgst_amount, addon_sgst_amount, cgst_amount, sgst_amount
         FROM demands
         WHERE consumer_id = $1
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY installment_index ASC`, [consumerId, row.unit_id]),
        ]);
        // Waterfall allocation: replace installment_payments with accurate per-installment paid amounts.
        // The SQL subquery groups by installment_index which loses NULL-indexed advance receipts.
        const [wfRcptsRes, wfDemandsRes] = await Promise.all([
            index_js_1.db.query(`SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at
         FROM receipts WHERE consumer_id = $1 AND status = 'cleared'
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY received_date ASC, created_at ASC`, [consumerId, row.unit_id]),
            index_js_1.db.query(`SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                addon_charge_amount, addon_cgst_amount, addon_sgst_amount
         FROM demands WHERE consumer_id = $1
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )`, [consumerId, row.unit_id]),
        ]);
        row.installment_payments = (0, payment_waterfall_js_1.applyWaterfall)(wfRcptsRes.rows, wfDemandsRes.rows).map(w => ({
            installment_index: w.installment_index,
            total_paid: w.paid,
        }));
        // ── Addon charges ─────────────────────────
        const addonChargesRes = await index_js_1.db.query(`SELECT
         cac.id,
         cac.charge_name,
         cac.effective_date,
         cac.amount,
         cac.increase_amount,
         cac.cgst_pct,
         cac.sgst_pct,
         cac.cgst_amount,
         cac.sgst_amount,
         cac.itc_cgst,
         cac.itc_sgst,
         cac.total_amount,
         cac.remark,
         cac.status
       FROM consumer_addon_charges cac
       WHERE cac.consumer_id = $1
       AND cac.status = 'active'
       ORDER BY cac.effective_date ASC,
                cac.created_at ASC`, [consumerId]);
        const addonCharges = addonChargesRes.rows;
        // ── Interest calculation rows ─────────────
        let penalRate = parseFloat(settings['penal_interest_rate_percent'] || '15');
        if (projectId) {
            try {
                const projRateRes = await index_js_1.db.query(`SELECT rate_percent FROM project_interest_rates WHERE project_id = $1 AND effective_from <= CURRENT_DATE ORDER BY effective_from DESC LIMIT 1`, [projectId]);
                if (projRateRes.rows.length > 0)
                    penalRate = parseFloat(projRateRes.rows[0].rate_percent);
            }
            catch { /* fall through to global rate */ }
        }
        const templateNameMap = {};
        const templateRateMap = {};
        templatesRes.rows.forEach((t) => {
            templateNameMap[t.installment_index] = t.installment_name;
            templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
        });
        const demandsForInterest = demandsRes.rows.map((d) => ({
            ...d,
            installment_name: templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
            interest_rate_percent: templateRateMap[d.installment_index] ?? null,
        }));
        const interestCalcRows = (0, payment_waterfall_js_1.buildInterestRows)(wfRcptsRes.rows, demandsForInterest, penalRate, {
            interestStartDate: consumer.interest_start_date ? new Date(String(consumer.interest_start_date)) : null,
            gracePeriodDays: parseInt(String(consumer.grace_period_days || 0)),
        });
        // ─────────────────────────────────────────
        const waiverRes = await index_js_1.db.query(`SELECT COALESCE(SUM(waiver_amount_inr), 0) AS total_waived
       FROM interest_waivers
       WHERE consumer_id = $1
         AND status = 'approved'`, [consumerId]);
        const totalWaivedInr = parseFloat(waiverRes.rows[0]?.total_waived || 0);
        // Fetch OTHER CHARGE GST rate for correct Page 1 Pricing Summary GST
        // (other charges carry different GST rate than basic price)
        const otherChargeGstRes = await index_js_1.db.query(`SELECT gts.cgst_pct, gts.sgst_pct
       FROM gst_tax_charge_mapping gcm
       JOIN gst_slabs gs
         ON gs.id = gcm.slab_id
        AND gs.from_date <= CURRENT_DATE
        AND gs.to_date   >= CURRENT_DATE
       JOIN gst_tax_setup gts
         ON gts.id = gcm.gst_tax_id
       WHERE gcm.project_id  = $1
         AND gcm.charge_type = 'OTHER CHARGE'
       LIMIT 1`, [projectId]);
        let otherChargeCgstPct = parseFloat(otherChargeGstRes.rows[0]?.cgst_pct || 0);
        let otherChargeSgstPct = parseFloat(otherChargeGstRes.rows[0]?.sgst_pct || 0);
        if (otherChargeGstRes.rows.length === 0) {
            const basicFallback = await index_js_1.db.query(`SELECT gts.cgst_pct, gts.sgst_pct
         FROM gst_tax_charge_mapping gcm
         JOIN gst_slabs gs
           ON gs.id = gcm.slab_id
          AND gs.from_date <= CURRENT_DATE
          AND gs.to_date   >= CURRENT_DATE
         JOIN gst_tax_setup gts
           ON gts.id = gcm.gst_tax_id
         WHERE gcm.project_id  = $1
           AND gcm.charge_type = 'BASIC'
         LIMIT 1`, [projectId]);
            otherChargeCgstPct = parseFloat(basicFallback.rows[0]?.cgst_pct || 0);
            otherChargeSgstPct = parseFloat(basicFallback.rows[0]?.sgst_pct || 0);
            if (basicFallback.rows.length > 0) {
                console.warn(`[GST] No OTHER CHARGE mapping for project ${projectId} — using BASIC rate for APF display.`);
            }
        }
        const html = (0, booking_js_1.buildApplicantFileHtml)(row, consumer, coApplicantsRes.rows, settings, allocationRes.rows[0] || null, parkingRes.rows, templatesRes.rows, dispatchRes.rows, receiptsRes.rows, demandsRes.rows, interestCalcRows, addonCharges, totalWaivedInr, otherChargeCgstPct, otherChargeSgstPct);
        // Persist to documents table on first view so it can be edited later
        let applicantDocId = null;
        try {
            const existing = await index_js_1.db.query(`SELECT id FROM documents WHERE document_type = 'applicant_file' AND consumer_id = $1 AND reference_id = COALESCE($2::uuid, $1::uuid) LIMIT 1`, [consumerId, row.unit_id || null]);
            if (existing.rows.length === 0) {
                const docInsert = await index_js_1.db.query(`INSERT INTO documents (document_type, consumer_id, html_content, reference_id, document_subtype, version_number, edit_count, is_edited, created_by_user_id)
           VALUES ('applicant_file', $1, $2, COALESCE($4::uuid, $1::uuid), 'applicant_file', 1, 0, FALSE, $3) RETURNING id`, [consumerId, html, req.userId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', row.unit_id || null]);
                applicantDocId = docInsert.rows[0].id;
                await index_js_1.db.query(`INSERT INTO document_versions (document_id, version_number, html_content, is_original, edit_reason)
           VALUES ($1, 1, $2, TRUE, 'Original generation')`, [applicantDocId, html]);
            }
            else {
                applicantDocId = existing.rows[0].id;
            }
        }
        catch { /* non-fatal — don't block the response */ }
        // Apply any active field overrides so edits persist across re-renders
        let finalHtml = html;
        if (applicantDocId) {
            try {
                const overridesRes = await index_js_1.db.query(`SELECT field_key, current_value FROM document_field_overrides
           WHERE document_id = $1 AND is_active = TRUE`, [applicantDocId]);
                if (overridesRes.rows.length > 0) {
                    const overridesMap = {};
                    overridesRes.rows.forEach((o) => {
                        overridesMap[o.field_key] = o.current_value;
                    });
                    finalHtml = (0, document_recalc_js_1.applyOverridesToHtml)(html, overridesMap);
                    // Keep stored html_content in sync with override-applied version
                    await index_js_1.db.query(`UPDATE documents SET html_content = $1, updated_at = NOW() WHERE id = $2`, [finalHtml, applicantDocId]);
                }
            }
            catch { /* non-fatal */ }
        }
        const token = (req.headers.authorization?.split(' ')[1] || req.query.token || '');
        const htmlWithEdit = applicantDocId
            ? finalHtml.replace('</body>', (0, document_recalc_js_1.buildEditScript)(applicantDocId, token, 'applicant_file') + '\n</body>')
            : finalHtml;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlWithEdit);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=consumers.js.map