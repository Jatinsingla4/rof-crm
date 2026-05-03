--
-- PostgreSQL database dump
--

\restrict n1Q8L0QqIF9URdrc7VxkII1o1U5cd4qum6R00Ssqp6omUKV9BsJ5r1KL2DVwMLk

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: allocation_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.allocation_status AS ENUM (
    'allotted',
    'agreement_signed',
    'cancelled'
);


ALTER TYPE public.allocation_status OWNER TO postgres;

--
-- Name: income_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.income_category AS ENUM (
    'EWS',
    'LIG',
    'MIG'
);


ALTER TYPE public.income_category OWNER TO postgres;

--
-- Name: kyc_document_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_document_type AS ENUM (
    'aadhaar',
    'pan',
    'income_cert',
    'affidavit',
    'bank_details',
    'photo',
    'address_proof'
);


ALTER TYPE public.kyc_document_type OWNER TO postgres;

--
-- Name: lead_stage; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.lead_stage AS ENUM (
    'enquiry',
    'interested',
    'application_filed',
    'draw_entered',
    'allotted',
    'onboarded',
    'cancelled'
);


ALTER TYPE public.lead_stage OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'bank_transfer',
    'cheque',
    'neft',
    'rtgs',
    'upi'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: role_name; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role_name AS ENUM (
    'super_admin',
    'project_manager',
    'sales_executive',
    'accounts_finance',
    'support_agent',
    'read_only_viewer'
);


ALTER TYPE public.role_name OWNER TO postgres;

--
-- Name: unit_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.unit_status AS ENUM (
    'available',
    'application_received',
    'draw_pending',
    'allotted',
    'agreement_signed',
    'under_construction',
    'oc_received',
    'possession_handed_over',
    'locked',
    'held'
);


ALTER TYPE public.unit_status OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    project_id uuid NOT NULL,
    allocated_date timestamp with time zone DEFAULT now(),
    status public.allocation_status DEFAULT 'allotted'::public.allocation_status,
    allotment_letter_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid,
    remarks text,
    allotment_date date,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allocations OWNER TO postgres;

--
-- Name: allotment_letters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.allotment_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    allocation_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    letter_date date,
    terms_agreed boolean DEFAULT false,
    generated_at timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    delivery_channel character varying(50),
    remarks text
);


ALTER TABLE public.allotment_letters OWNER TO postgres;

--
-- Name: applicant_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applicant_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    applicant_id uuid,
    address_type character varying(30),
    address_line text,
    pin_code character varying(20),
    country character varying(100) DEFAULT 'India'::character varying,
    state character varying(100),
    city character varying(100),
    mobile_no character varying(20),
    phone_no character varying(30),
    fax_no character varying(30),
    is_mailing boolean DEFAULT false,
    comm_courier boolean DEFAULT false,
    comm_email boolean DEFAULT false,
    comm_sms boolean DEFAULT false,
    comm_no_comm boolean DEFAULT false,
    comm_by_hand boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.applicant_addresses OWNER TO postgres;

--
-- Name: applicant_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applicant_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_form_id uuid,
    applicant_order integer DEFAULT 1,
    salutation character varying(20),
    first_name character varying(100),
    middle_name character varying(100),
    last_name character varying(100),
    father_name character varying(200),
    date_of_birth date,
    anniversary_date date,
    nationality character varying(50),
    marital_status character varying(30),
    gender character varying(20),
    no_of_children integer DEFAULT 0,
    passport_no character varying(50),
    pan_no character varying(50),
    aadhaar_no_hash character varying(64),
    email_1 character varying(200),
    email_2 character varying(200),
    profession character varying(100),
    designation character varying(100),
    company_firm character varying(200),
    photo_url text,
    has_poa boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.applicant_details OWNER TO postgres;

--
-- Name: application_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.application_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    draw_date date,
    draw_result character varying(50),
    draw_position integer,
    waitlist_position integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.application_history OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    "timestamp" timestamp with time zone DEFAULT now(),
    action character varying(50),
    resource_type character varying(100),
    resource_id uuid,
    previous_values jsonb,
    new_values jsonb,
    immutable boolean DEFAULT true,
    retention_days integer DEFAULT 365
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    trigger_event character varying(100) NOT NULL,
    action_type character varying(100) NOT NULL,
    message_template text,
    delay_minutes integer DEFAULT 0,
    is_active boolean DEFAULT true,
    execution_count integer DEFAULT 0,
    last_executed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.automation_rules OWNER TO postgres;

--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    bank_name character varying(255) NOT NULL,
    account_number character varying(50) NOT NULL,
    ifsc_code character varying(20) NOT NULL,
    account_type character varying(50),
    balance_inr bigint DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bank_accounts OWNER TO postgres;

--
-- Name: bank_statement_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_statement_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    imported_by_user_id uuid NOT NULL,
    import_date date DEFAULT CURRENT_DATE NOT NULL,
    total_transactions integer DEFAULT 0,
    matched_count integer DEFAULT 0,
    unmatched_count integer DEFAULT 0,
    total_amount_inr numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'processing'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bank_statement_imports OWNER TO postgres;

--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    transaction_date date NOT NULL,
    description text,
    amount_inr numeric(15,2) NOT NULL,
    transaction_ref character varying(255),
    bank_account character varying(100),
    matched_receipt_id uuid,
    matched_demand_id uuid,
    match_status character varying(50) DEFAULT 'unmatched'::character varying NOT NULL,
    match_confidence numeric(5,2),
    matched_by_user_id uuid,
    matched_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bank_transactions OWNER TO postgres;

--
-- Name: banks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    ifsc_prefix character varying(10),
    branch character varying(200),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.banks OWNER TO postgres;

--
-- Name: booking_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid,
    project_id uuid,
    unit_id uuid,
    broker_id uuid,
    main_broker_id uuid,
    registration_no character varying(100),
    form_no character varying(100),
    application_date date DEFAULT CURRENT_DATE,
    customer_classification character varying(50),
    booking_type character varying(20) DEFAULT 'normal'::character varying,
    basic_price_inr numeric(15,2),
    gstin character varying(20),
    payment_plan_id uuid,
    company_inaugural_disc numeric(15,2) DEFAULT 0,
    company_rebate_rs numeric(15,2) DEFAULT 0,
    company_rebate_sqft numeric(15,2) DEFAULT 0,
    company_rebate_pct numeric(5,2) DEFAULT 0,
    broker_rebate_rs numeric(15,2) DEFAULT 0,
    broker_rebate_sqft numeric(15,2) DEFAULT 0,
    broker_rebate_pct numeric(5,2) DEFAULT 0,
    has_plc boolean DEFAULT false,
    has_other_charge boolean DEFAULT false,
    has_alteration boolean DEFAULT false,
    has_ifms boolean DEFAULT false,
    has_additional_charge boolean DEFAULT false,
    has_extra_charge boolean DEFAULT false,
    has_finance boolean DEFAULT false,
    has_nominee boolean DEFAULT false,
    sales_employee_id uuid,
    sales_remarks text,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.booking_forms OWNER TO postgres;

--
-- Name: booking_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.booking_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    project_id uuid,
    unit_id uuid,
    booking_date date DEFAULT CURRENT_DATE NOT NULL,
    booking_amount numeric(15,2) DEFAULT 0 NOT NULL,
    payment_mode character varying(50),
    payment_ref character varying(100),
    bank_name character varying(200),
    cheque_date date,
    discount_value numeric(15,2) DEFAULT 0,
    discount_reason text,
    discount_authorized_by uuid,
    broker_id uuid,
    broker_commission numeric(15,2) DEFAULT 0,
    broker_commission_type character varying(20) DEFAULT 'flat'::character varying,
    sales_employee_id uuid,
    nominee_name character varying(200),
    nominee_relation character varying(50),
    loan_amount numeric(15,2),
    finance_bank character varying(200),
    remarks text,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.booking_records OWNER TO postgres;

--
-- Name: broadcast_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broadcast_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    channel character varying(50) NOT NULL,
    message text,
    total_recipients integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'queued'::character varying,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    name character varying(255)
);


ALTER TABLE public.broadcast_campaigns OWNER TO postgres;

--
-- Name: broker_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broker_code character varying(50),
    company_name character varying(200),
    estd_year integer,
    first_name character varying(100),
    middle_name character varying(100),
    last_name character varying(100),
    designation character varying(100),
    date_of_birth date,
    anniversary_date date,
    deposit_money boolean DEFAULT false,
    gst_status character varying(20) DEFAULT 'unregistered'::character varying,
    rera_reg_no character varying(100),
    tan_no character varying(50),
    pan_no character varying(50),
    service_tax boolean DEFAULT false,
    references_info text,
    poa_date date,
    strength_of_force character varying(100),
    manager_name character varying(100),
    officer_name character varying(100),
    remark text,
    address text,
    phone_code character varying(10),
    phone_no character varying(30),
    city character varying(100),
    mobile_no character varying(20),
    state character varying(100),
    email character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.broker_applications OWNER TO postgres;

--
-- Name: broker_commissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broker_id uuid NOT NULL,
    consumer_id uuid,
    project_id uuid,
    unit_id uuid,
    commission_amount_inr numeric(14,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    paid_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.broker_commissions OWNER TO postgres;

--
-- Name: broker_project_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_project_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broker_id uuid NOT NULL,
    project_id uuid NOT NULL,
    mapped_at timestamp with time zone DEFAULT now(),
    mapped_by uuid
);


ALTER TABLE public.broker_project_mapping OWNER TO postgres;

--
-- Name: broker_tax_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.broker_tax_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broker_id uuid NOT NULL,
    tds_rate_pct numeric(5,2) DEFAULT 5.00,
    gst_rate_pct numeric(5,2) DEFAULT 18.00,
    is_gst_exempt boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


ALTER TABLE public.broker_tax_config OWNER TO postgres;

--
-- Name: brokers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brokers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    firm_name character varying(255),
    mobile character varying(20) NOT NULL,
    email character varying(255),
    rera_number character varying(100),
    pan character varying(20),
    address text,
    status character varying(50) DEFAULT 'active'::character varying,
    commission_pct numeric(5,2) DEFAULT 2.00,
    total_referrals integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_broker_id uuid,
    tax_id_gst character varying(20),
    tax_id_pan character varying(20),
    bank_account_details jsonb,
    approval_notes text,
    approved_at timestamp with time zone,
    approved_by uuid,
    CONSTRAINT brokers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying, 'pending'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.brokers OWNER TO postgres;

--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    user_id uuid,
    call_date timestamp with time zone DEFAULT now(),
    status_code character varying(50),
    sub_status_code character varying(100),
    ptp_date date,
    remarks text,
    next_call_date date
);


ALTER TABLE public.call_logs OWNER TO postgres;

--
-- Name: campaign_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaign_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    project_id uuid,
    campaign_type character varying(100),
    total_cost_inr numeric DEFAULT 0,
    total_leads_generated integer DEFAULT 0,
    leads_converted_to_allotted integer DEFAULT 0,
    conversion_rate numeric DEFAULT 0,
    revenue_generated_inr numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.campaign_metrics OWNER TO postgres;

--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    channel character varying(50),
    campaign_type character varying(100),
    project_id uuid,
    budget_inr numeric,
    start_date date,
    end_date date,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- Name: cancellations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cancellations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    allocation_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    cancellation_date date,
    reason text,
    forfeiture_amount_inr bigint DEFAULT 29500,
    refund_amount_inr bigint,
    refund_status character varying(50) DEFAULT 'initiated'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cancellations OWNER TO postgres;

--
-- Name: cheque_bounce_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cheque_bounce_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    bounce_date date DEFAULT CURRENT_DATE,
    penalty_amount_inr bigint DEFAULT 500,
    reason text,
    is_penalty_raised boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cheque_bounce_logs OWNER TO postgres;

--
-- Name: cities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    state_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cities OWNER TO postgres;

--
-- Name: co_applicants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.co_applicants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    relationship character varying(50),
    aadhaar_hash character varying(255),
    pan_hash character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.co_applicants OWNER TO postgres;

--
-- Name: communication_status_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communication_status_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    category character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.communication_status_codes OWNER TO postgres;

--
-- Name: communications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    channel character varying(50) NOT NULL,
    direction character varying(20) DEFAULT 'outbound'::character varying,
    subject character varying(255),
    message text,
    email_recipient character varying(255),
    phone_recipient character varying(20),
    status character varying(50) DEFAULT 'sent'::character varying,
    sent_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.communications OWNER TO postgres;

--
-- Name: construction_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.construction_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    milestone_name character varying(255) NOT NULL,
    milestone_type character varying(100) NOT NULL,
    description text,
    planned_date date,
    actual_date date,
    completion_percentage integer DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    notify_allottees boolean DEFAULT true,
    notification_sent_at timestamp with time zone,
    photos_urls text[],
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT construction_milestones_completion_percentage_check CHECK (((completion_percentage >= 0) AND (completion_percentage <= 100)))
);


ALTER TABLE public.construction_milestones OWNER TO postgres;

--
-- Name: consumer_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consumer_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    folder_name character varying(100) NOT NULL,
    folder_type character varying(50) NOT NULL,
    parent_folder_id uuid,
    sort_order integer DEFAULT 0,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.consumer_folders OWNER TO postgres;

--
-- Name: consumers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consumers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    photo_url text,
    mobile character varying(20) NOT NULL,
    email character varying(255),
    aadhaar_hash character varying(255),
    pan_hash character varying(255),
    parivar_pehchan_patra character varying(100),
    income_category public.income_category,
    lead_stage public.lead_stage DEFAULT 'enquiry'::public.lead_stage,
    project_id uuid,
    allocated_unit_id uuid,
    campaign_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    middle_name character varying(100),
    salutation character varying(20),
    dob date,
    gender character varying(10),
    profession character varying(100),
    nationality character varying(100),
    annual_income numeric(15,2),
    education character varying(100),
    company character varying(200),
    ppp_id character varying(100),
    pan_no character varying(20),
    alt_mobile character varying(20),
    source_of_enquiry character varying(100),
    referred_by character varying(200),
    present_address text,
    present_address_line2 character varying(255),
    present_city character varying(100),
    present_state character varying(100),
    present_pin character varying(10),
    present_country character varying(100) DEFAULT 'India'::character varying,
    perm_address text,
    perm_city character varying(100),
    perm_state character varying(100),
    perm_pin character varying(10),
    perm_country character varying(100) DEFAULT 'India'::character varying,
    office_address text,
    office_city character varying(100),
    office_state character varying(100),
    office_pin character varying(10),
    nominee_name character varying(200),
    nominee_relation character varying(50),
    nominee_dob date,
    nominee_share numeric(5,2) DEFAULT 100,
    finance_bank character varying(200),
    loan_amount numeric(15,2),
    loan_sanction_date date,
    registration_no character varying(100),
    form_no character varying(100),
    customer_classification character varying(100) DEFAULT 'General'::character varying,
    booking_date date,
    last_call_status character varying(50),
    last_call_sub_status character varying(100),
    promise_to_pay_date date,
    next_call_date date,
    total_overdue_amt numeric(15,2) DEFAULT 0
);


ALTER TABLE public.consumers OWNER TO postgres;

--
-- Name: conveyance_deeds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conveyance_deeds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid,
    project_id uuid,
    unit_id uuid,
    deed_date date,
    deed_no character varying(100),
    registry_office character varying(200),
    stamp_duty_inr numeric(15,2),
    status character varying(30) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.conveyance_deeds OWNER TO postgres;

--
-- Name: countries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.countries OWNER TO postgres;

--
-- Name: credit_debit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_debit_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    note_number character varying(50) NOT NULL,
    note_type character varying(20) NOT NULL,
    original_invoice_no character varying(50) NOT NULL,
    adjustment_amount numeric(15,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 5 NOT NULL,
    gst_amount numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    status character varying(30) DEFAULT 'issued'::character varying,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.credit_debit_notes OWNER TO postgres;

--
-- Name: custom_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.custom_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255),
    project_id uuid,
    report_type character varying(100) NOT NULL,
    filter_criteria jsonb,
    columns_selected text[],
    schedule_frequency character varying(50),
    schedule_recipients text[],
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.custom_reports OWNER TO postgres;

--
-- Name: demands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_plan_id uuid NOT NULL,
    installment_index integer NOT NULL,
    consumer_id uuid NOT NULL,
    due_date date NOT NULL,
    amount_due_inr bigint NOT NULL,
    days_until_due integer,
    generated_at timestamp with time zone DEFAULT now(),
    sent_via character varying(50),
    delivery_status character varying(50) DEFAULT 'queued'::character varying,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    tax_slab_id uuid,
    cgst_amount numeric(15,2) DEFAULT 0,
    sgst_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    demand_type character varying(100),
    raised_at timestamp with time zone,
    raised_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.demands OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    head_user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: document_dispatch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_dispatch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type character varying(150),
    dispatch_mode character varying(100),
    tracking_no character varying(100),
    consumer_id uuid,
    dispatched_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_dispatch OWNER TO postgres;

--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    body_html text NOT NULL,
    merge_fields text[],
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version_number integer DEFAULT 1
);


ALTER TABLE public.document_templates OWNER TO postgres;

--
-- Name: document_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.document_types OWNER TO postgres;

--
-- Name: document_vault; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_vault (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    allocation_id uuid,
    document_category character varying(100) NOT NULL,
    file_url text NOT NULL,
    file_name character varying(255),
    uploaded_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    folder_id uuid
);


ALTER TABLE public.document_vault OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    allocation_id uuid,
    template_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    html_content text NOT NULL,
    delivery_method character varying(50) DEFAULT 'email'::character varying,
    delivery_status character varying(50) DEFAULT 'pending'::character varying,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    sent_by_user_id uuid,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: draw_refunds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.draw_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    project_id uuid NOT NULL,
    draw_result character varying(50) DEFAULT 'unsuccessful'::character varying NOT NULL,
    booking_amount_paid_inr bigint NOT NULL,
    refund_amount_inr bigint NOT NULL,
    refund_due_by date NOT NULL,
    refund_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    refund_initiated_at timestamp with time zone,
    refund_completed_at timestamp with time zone,
    refund_reference character varying(255),
    notes text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.draw_refunds OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    user_id uuid,
    from_email character varying(255),
    to_email character varying(255),
    subject character varying(255),
    body text,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone
);


ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: employee_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid,
    employee_code character varying(50),
    designation character varying(150),
    joining_date date,
    salary_grade character varying(50),
    manager_id uuid,
    mobile_office character varying(20),
    mobile_personal character varying(20),
    emergency_contact character varying(20),
    address text,
    city character varying(100),
    state character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_profiles OWNER TO postgres;

--
-- Name: faq_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faq_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT false,
    view_count integer DEFAULT 0,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.faq_articles OWNER TO postgres;

--
-- Name: faq_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faq_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.faq_categories OWNER TO postgres;

--
-- Name: floors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.floors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tower_id uuid NOT NULL,
    floor_number integer NOT NULL,
    floor_name character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.floors OWNER TO postgres;

--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.global_settings (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.global_settings OWNER TO postgres;

--
-- Name: gst_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gst_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no character varying(50),
    invoice_date date DEFAULT CURRENT_DATE,
    invoice_type character varying(50) DEFAULT 'invoice'::character varying,
    project_id uuid,
    consumer_id uuid,
    unit_id uuid,
    payment_plan_id uuid,
    installment_name character varying(100),
    base_amount_inr numeric(15,2) DEFAULT 0,
    taxable_amount_inr numeric(15,2) DEFAULT 0,
    cgst_rate numeric(5,2) DEFAULT 9.00,
    sgst_rate numeric(5,2) DEFAULT 9.00,
    igst_rate numeric(5,2) DEFAULT 0,
    cgst_amount_inr numeric(15,2) DEFAULT 0,
    sgst_amount_inr numeric(15,2) DEFAULT 0,
    igst_amount_inr numeric(15,2) DEFAULT 0,
    total_amount_inr numeric(15,2) DEFAULT 0,
    supply_type character varying(20) DEFAULT 'intrastate'::character varying,
    place_of_supply character varying(100),
    hsn_sac_code character varying(20),
    status character varying(30) DEFAULT 'pending'::character varying,
    cancelled_at timestamp with time zone,
    cancelled_reason text,
    linked_invoice_id uuid,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gst_invoices OWNER TO postgres;

--
-- Name: gst_process_rights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gst_process_rights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    can_generate boolean DEFAULT false,
    can_cancel boolean DEFAULT false,
    can_reverse boolean DEFAULT false,
    can_manual boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gst_process_rights OWNER TO postgres;

--
-- Name: head_wise_costs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.head_wise_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_form_id uuid,
    cost_head character varying(100),
    amount_inr numeric(15,2),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.head_wise_costs OWNER TO postgres;

--
-- Name: import_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.import_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_name character varying(255) NOT NULL,
    import_type character varying(50) NOT NULL,
    total_rows integer DEFAULT 0,
    created_rows integer DEFAULT 0,
    skipped_rows integer DEFAULT 0,
    error_rows integer DEFAULT 0,
    status character varying(50) DEFAULT 'completed'::character varying,
    errors jsonb DEFAULT '[]'::jsonb,
    imported_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.import_history OWNER TO postgres;

--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_number character varying(100) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE,
    consumer_id uuid,
    debit_amount numeric(15,2) DEFAULT 0,
    credit_amount numeric(15,2) DEFAULT 0,
    ledger_head character varying(100) NOT NULL,
    remarks text,
    approved_by uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    document_type public.kyc_document_type NOT NULL,
    file_url text NOT NULL,
    expiry_date date,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by_user_id uuid,
    verified boolean DEFAULT false
);


ALTER TABLE public.kyc_documents OWNER TO postgres;

--
-- Name: loan_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loan_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    bank_name character varying(255),
    branch_name character varying(255),
    loan_amount bigint DEFAULT 0,
    sanction_letter_date date,
    tpa_signed_date date,
    loan_status character varying(50) DEFAULT 'applied'::character varying,
    disbursement_percentage integer DEFAULT 0,
    bank_contact_person character varying(100),
    bank_contact_mobile character varying(20),
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.loan_details OWNER TO postgres;

--
-- Name: nationalities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nationalities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.nationalities OWNER TO postgres;

--
-- Name: ownership_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ownership_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    old_consumer_id uuid NOT NULL,
    new_consumer_id uuid NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE,
    transfer_fee_inr bigint DEFAULT 0,
    admin_charges_inr bigint DEFAULT 0,
    approval_status character varying(50) DEFAULT 'pending'::character varying,
    transfer_remarks text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ownership_transfers OWNER TO postgres;

--
-- Name: parking_slots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parking_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    slot_number character varying(50) NOT NULL,
    parking_type character varying(50) DEFAULT 'covered'::character varying,
    floor integer DEFAULT 0,
    status character varying(50) DEFAULT 'available'::character varying,
    allotted_to_consumer_id uuid,
    allotted_unit_id uuid,
    amount_inr numeric(14,2) DEFAULT 0,
    allotted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.parking_slots OWNER TO postgres;

--
-- Name: parking_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parking_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.parking_types OWNER TO postgres;

--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    allocation_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    project_id uuid NOT NULL,
    total_amount_inr bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payment_plans OWNER TO postgres;

--
-- Name: penal_interests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.penal_interests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_plan_id uuid NOT NULL,
    installment_index integer NOT NULL,
    consumer_id uuid NOT NULL,
    principal_inr bigint NOT NULL,
    days_overdue integer,
    rate_percent numeric(5,2) DEFAULT 11.10,
    calculated_at timestamp with time zone DEFAULT now(),
    amount_inr bigint,
    status character varying(50) DEFAULT 'calculated'::character varying,
    escalated_at timestamp with time zone,
    escalated_to_user_id uuid,
    interest_waived_inr bigint DEFAULT 0
);


ALTER TABLE public.penal_interests OWNER TO postgres;

--
-- Name: plan_schedule_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_schedule_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    plan_name character varying(255) DEFAULT 'Standard AHP Plan'::character varying NOT NULL,
    installment_index integer DEFAULT 1 NOT NULL,
    installment_name character varying(255) NOT NULL,
    installment_type character varying(50) DEFAULT 'installment'::character varying NOT NULL,
    percentage numeric(7,3),
    flat_amount_inr bigint,
    due_date_offset_days integer DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.plan_schedule_templates OWNER TO postgres;

--
-- Name: professions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.professions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.professions OWNER TO postgres;

--
-- Name: project_smtp_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_smtp_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    host character varying(255) NOT NULL,
    port integer DEFAULT 587,
    username character varying(255),
    password_encrypted text,
    from_name character varying(255),
    from_email character varying(255),
    use_ssl boolean DEFAULT true,
    cc_emails text,
    bcc_emails text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.project_smtp_configs OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    rera_number character varying(100) NOT NULL,
    tcp_licence character varying(100) NOT NULL,
    location character varying(255),
    land_area_sqft bigint,
    total_units integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    group_name character varying(100) DEFAULT 'Affordable'::character varying
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_plan_id uuid NOT NULL,
    installment_index integer NOT NULL,
    consumer_id uuid NOT NULL,
    amount_received_inr bigint NOT NULL,
    payment_method public.payment_method,
    transaction_ref character varying(100),
    received_date date NOT NULL,
    received_by_user_id uuid,
    receipt_number character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    status character varying(30) DEFAULT 'pending'::character varying,
    authorized_by uuid,
    authorized_at timestamp with time zone,
    print_status character varying(20) DEFAULT 'not_printed'::character varying,
    approval_status character varying(20) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.receipts OWNER TO postgres;

--
-- Name: registry_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registry_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    allocation_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    appointment_date date,
    registry_date date,
    stamp_duty_amount bigint DEFAULT 0,
    conveyance_deed_no character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.registry_details OWNER TO postgres;

--
-- Name: remarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    user_id uuid,
    "timestamp" timestamp with time zone DEFAULT now(),
    channel character varying(50),
    subject character varying(255),
    notes text,
    follow_up_date date,
    follow_up_action text,
    tags text[]
);


ALTER TABLE public.remarks OWNER TO postgres;

--
-- Name: reminder_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reminder_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    reminder_name character varying(200) NOT NULL,
    prefix_name character varying(100),
    rank integer,
    days integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reminder_master OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name public.role_name NOT NULL,
    is_custom boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: salutations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salutations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.salutations OWNER TO postgres;

--
-- Name: sources_of_enquiry; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sources_of_enquiry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sources_of_enquiry OWNER TO postgres;

--
-- Name: states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    country_id uuid,
    code character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.states OWNER TO postgres;

--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    subject character varying(255) NOT NULL,
    description text NOT NULL,
    priority character varying(50) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'open'::character varying,
    assigned_to_user_id uuid,
    created_by_user_id uuid NOT NULL,
    sla_breach_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.support_tickets OWNER TO postgres;

--
-- Name: surrender_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.surrender_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid,
    allocation_id uuid,
    project_id uuid,
    unit_id uuid,
    surrender_date date DEFAULT CURRENT_DATE,
    reason text,
    forfeiture_amount_inr numeric(15,2) DEFAULT 29500,
    refund_amount_inr numeric(15,2),
    status character varying(30) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.surrender_applications OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    due_date date,
    assigned_to uuid,
    created_by uuid,
    consumer_id uuid,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tax_slabs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_slabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    cgst_percent numeric(5,2) DEFAULT 0.00,
    sgst_percent numeric(5,2) DEFAULT 0.00,
    igst_percent numeric(5,2) DEFAULT 0.00,
    effective_from date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tax_slabs OWNER TO postgres;

--
-- Name: tds_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tds_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challan_id uuid,
    consumer_id uuid,
    receipt_id uuid,
    amount_assigned numeric(15,2) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tds_assignments OWNER TO postgres;

--
-- Name: tds_challans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tds_challans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challan_number character varying(100) NOT NULL,
    challan_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    bank_name character varying(255),
    bsr_code character varying(50),
    financial_year character varying(20),
    quarter character varying(10),
    file_url text,
    status character varying(50) DEFAULT 'available'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tds_challans OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_team character varying(100) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    department_id uuid,
    team_head_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: towers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.towers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    tower_name character varying(100) NOT NULL,
    floors integer,
    units_per_floor integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


ALTER TABLE public.towers OWNER TO postgres;

--
-- Name: unit_holds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    broker_id uuid NOT NULL,
    client_name character varying(255),
    client_mobile character varying(20),
    held_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_by uuid
);


ALTER TABLE public.unit_holds OWNER TO postgres;

--
-- Name: unit_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name character varying(200) NOT NULL,
    description character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.unit_locations OWNER TO postgres;

--
-- Name: unit_shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    old_unit_id uuid,
    new_unit_id uuid,
    reason text,
    shift_date date DEFAULT CURRENT_DATE NOT NULL,
    shifted_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.unit_shifts OWNER TO postgres;

--
-- Name: unit_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    previous_status public.unit_status,
    new_status public.unit_status NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    changed_by_user_id uuid,
    reason text
);


ALTER TABLE public.unit_status_history OWNER TO postgres;

--
-- Name: unit_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unit_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    carpet_area_sqft numeric(10,2),
    balcony_area_sqft numeric(10,2),
    base_rate_sqft bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.unit_types OWNER TO postgres;

--
-- Name: units; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tower_id uuid NOT NULL,
    project_id uuid NOT NULL,
    unit_number character varying(50) NOT NULL,
    bhk_type character varying(50) NOT NULL,
    carpet_area_sqft integer,
    super_area_sqft integer,
    facing character varying(50),
    floor integer,
    balcony_area_sqft integer,
    base_price_inr bigint,
    total_price_inr bigint,
    floor_plan_url text,
    status public.unit_status DEFAULT 'available'::public.unit_status,
    status_changed_at timestamp with time zone DEFAULT now(),
    locked_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid,
    unit_type_id uuid,
    floor_id uuid,
    registry_status boolean DEFAULT false,
    registry_date date,
    mortgage_status boolean DEFAULT false,
    hold_status boolean DEFAULT false
);


ALTER TABLE public.units OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role_id uuid,
    project_ids uuid[],
    department character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    last_login_at timestamp with time zone,
    status character varying(50) DEFAULT 'active'::character varying,
    role character varying(50) DEFAULT 'sales_executive'::character varying,
    mobile character varying(20),
    password_hash character varying(255),
    is_active boolean DEFAULT true,
    assigned_project_ids jsonb DEFAULT '[]'::jsonb,
    created_by_user_id uuid
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: waitlists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.waitlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    unit_type_or_unit_id character varying(100),
    consumer_id uuid NOT NULL,
    position_ordered integer NOT NULL,
    promoted_to_allocation_id uuid,
    promoted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.waitlists OWNER TO postgres;

--
-- Name: whatsapps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.whatsapps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    user_id uuid,
    direction character varying(50),
    message_body text,
    media_url text,
    "timestamp" timestamp with time zone DEFAULT now(),
    delivered_at timestamp with time zone,
    read_at timestamp with time zone
);


ALTER TABLE public.whatsapps OWNER TO postgres;

--
-- Data for Name: allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allocations (id, consumer_id, unit_id, project_id, allocated_date, status, allotment_letter_id, created_at, created_by_user_id, remarks, allotment_date, updated_at) FROM stdin;
a1000000-0000-0000-0000-000000000001	d0000000-0000-0000-0000-000000000001	c0000000-0000-0000-0000-000000000020	a0000000-0000-0000-0000-000000000002	2026-05-01 10:23:33.012519+05:30	allotted	\N	2026-05-01 10:23:33.012519+05:30	\N	\N	\N	2026-05-01 17:50:25.30935+05:30
a1000000-0000-0000-0000-000000000002	d0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000021	a0000000-0000-0000-0000-000000000002	2026-05-01 10:23:33.012519+05:30	allotted	\N	2026-05-01 10:23:33.012519+05:30	\N	\N	\N	2026-05-01 17:50:25.30935+05:30
a1000000-0000-0000-0000-000000000003	d0000000-0000-0000-0000-000000000003	c0000000-0000-0000-0000-000000000022	a0000000-0000-0000-0000-000000000002	2026-05-01 10:23:33.012519+05:30	allotted	\N	2026-05-01 10:23:33.012519+05:30	\N	\N	\N	2026-05-01 17:50:25.30935+05:30
a1000000-0000-0000-0000-000000000004	d0000000-0000-0000-0000-000000000004	c0000000-0000-0000-0000-000000000023	a0000000-0000-0000-0000-000000000002	2026-05-01 10:23:33.012519+05:30	allotted	\N	2026-05-01 10:23:33.012519+05:30	\N	\N	\N	2026-05-01 17:50:25.30935+05:30
a1000000-0000-0000-0000-000000000005	d0000000-0000-0000-0000-000000000005	c0000000-0000-0000-0000-000000000024	a0000000-0000-0000-0000-000000000002	2026-05-01 10:23:33.012519+05:30	allotted	\N	2026-05-01 10:23:33.012519+05:30	\N	\N	\N	2026-05-01 17:50:25.30935+05:30
b0ec4fbc-b226-411d-a5d8-f8dab8de9698	e80b1a86-f98b-475b-b769-a620f86ef26f	6c7248f3-e2b9-49d0-85bb-364c1991ed08	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-04 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.076944+05:30	\N	\N	\N	2026-05-02 17:55:57.076944+05:30
e1533164-9d68-4716-a2a1-60134268474c	dccdc164-b2d6-472d-804c-711ff66ecf32	be8f73ba-c527-46f9-a4ee-a1409a86a289	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-11-09 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.088964+05:30	\N	\N	\N	2026-05-02 17:55:57.088964+05:30
7e1b7024-eedd-4ea5-9d30-fc1a07e44fbe	595ee972-df8f-41b2-9f9d-b31220ee462b	0687f0bd-dd4c-4e13-b029-fe03a1d335aa	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-30 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.090695+05:30	\N	\N	\N	2026-05-02 17:55:57.090695+05:30
6d23b1e0-9658-45dd-b366-94bcaf731323	f43c8424-9983-440f-8093-fe30acd7b756	68ed1a68-94f6-43f2-b734-752c3b72e55e	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-14 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.091955+05:30	\N	\N	\N	2026-05-02 17:55:57.091955+05:30
fd0209a4-d539-483f-a263-60829edec6ad	223abf20-2bf2-4332-aa59-0db5eeace7f5	a1d51fc3-7785-46ce-896f-3d8fbf4d5a28	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-23 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.093218+05:30	\N	\N	\N	2026-05-02 17:55:57.093218+05:30
51bf2c3d-1046-44ce-b717-0d8aff9885d3	4152814f-a12c-44be-9ccd-40e18069a7ba	8ed5e181-0c94-440c-9891-fb31741ecc1b	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-11-11 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.094369+05:30	\N	\N	\N	2026-05-02 17:55:57.094369+05:30
bc580518-3707-4c6a-8c11-ec1c5bc807ed	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	628faa0a-fa9d-4f4f-b924-156db77a0e05	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-31 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.095704+05:30	\N	\N	\N	2026-05-02 17:55:57.095704+05:30
b044af13-2286-4c4c-95c7-c0e8ab885287	7f823bf9-a429-4719-a175-070d4b1d0900	5aa53b12-4a5b-4d58-a920-f85569971a90	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-01-29 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.096708+05:30	\N	\N	\N	2026-05-02 17:55:57.096708+05:30
66fdc836-2432-4292-a807-6a51d0e63048	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	184ccaf3-9af3-4e04-86b3-84eec1301a9d	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-25 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.097609+05:30	\N	\N	\N	2026-05-02 17:55:57.097609+05:30
29bb0bd1-508d-4018-9313-31d9a690205c	5f5b341c-7f18-44fe-97cc-04205c3b1201	0901a207-bb0a-444d-97b9-94315f89c6d8	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-07 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.09863+05:30	\N	\N	\N	2026-05-02 17:55:57.09863+05:30
5608af0b-280d-4096-9427-46929b4fd8e0	0745814d-4302-4e64-ba13-c9201f12b39e	5832292b-42ea-4ee1-a8d6-8aae929a5454	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-25 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.099879+05:30	\N	\N	\N	2026-05-02 17:55:57.099879+05:30
f5825197-e780-44ae-8276-fa5617164349	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	9adfbcc2-7860-4e49-b922-7d9afe25e4d4	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-20 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.100832+05:30	\N	\N	\N	2026-05-02 17:55:57.100832+05:30
465f73e3-93c9-44d1-aa22-1b7564157838	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	a5224ea5-a9ef-43f4-84ea-2fe7962c5cf4	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-11 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.101789+05:30	\N	\N	\N	2026-05-02 17:55:57.101789+05:30
0a55727e-b4aa-4adf-914a-dee3e3d09821	78b750fd-aabd-4261-ac34-1cc5d075b8e4	182bee17-4938-475c-a9e1-63b280a0bd39	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-01-24 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.10253+05:30	\N	\N	\N	2026-05-02 17:55:57.10253+05:30
5db6a018-95da-4896-8b90-203a077027ce	155ba700-8d2e-4870-8706-58b86bfe1acb	d557893a-282d-42bb-81d5-eaf78ffd3b9a	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-26 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.103503+05:30	\N	\N	\N	2026-05-02 17:55:57.103503+05:30
c1ce4476-8fcb-4fcb-a35d-80c243a0fb3e	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	0ce4e4e5-8607-419e-9b6b-426759ae4e1a	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-12-30 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.104364+05:30	\N	\N	\N	2026-05-02 17:55:57.104364+05:30
b80b3e57-58be-423c-b0c0-1754176ea6fb	2c402c76-d75e-4867-b8f6-57eea5df59f5	2a2386c4-e84a-4b83-b239-9c2e778a430c	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-08 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.105595+05:30	\N	\N	\N	2026-05-02 17:55:57.105595+05:30
4a918b05-6378-4e61-ab1f-3be926542cf7	0ca11d19-3fb3-48e3-b038-b64c1f050d22	618ce32d-47f7-4e89-9a2f-bc20519e83d2	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-10 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.106541+05:30	\N	\N	\N	2026-05-02 17:55:57.106541+05:30
f28432e9-0b1f-4cbb-ba1f-b45db7cf2ab0	26dece45-7e64-4f12-8695-169443d725fa	2cda2328-170d-4d04-92ff-55773c84279a	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-02-10 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.107473+05:30	\N	\N	\N	2026-05-02 17:55:57.107473+05:30
fa852032-9102-4a69-b748-d007021108be	da038407-ad69-4a16-83d8-20c51a2acc1f	7915d0ad-7320-4169-8575-fe92ade1a1e1	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-02-01 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.108717+05:30	\N	\N	\N	2026-05-02 17:55:57.108717+05:30
1611e80b-5f56-4b8a-8921-0cad77154e34	36b736ff-deb8-417f-871f-70e5b22dd625	622c5913-3c8f-435f-9d3c-46aa69562f49	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-08 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.109584+05:30	\N	\N	\N	2026-05-02 17:55:57.109584+05:30
f7c903dc-8567-4a2e-925c-5d7669eb3803	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	f7afaefb-64ff-4f9a-baa2-7fc130b2b6ea	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-02-05 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.110457+05:30	\N	\N	\N	2026-05-02 17:55:57.110457+05:30
61e23076-ebb7-4f57-a1b5-4735d5561234	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	4c31c57d-2475-47fd-8ee2-178a6a76e6f0	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-11-25 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.11141+05:30	\N	\N	\N	2026-05-02 17:55:57.11141+05:30
63bcfbd3-736c-40d7-993a-c19f1655e61b	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	360af183-3c6d-456c-90cb-c2ebce9b8450	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-10 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.112764+05:30	\N	\N	\N	2026-05-02 17:55:57.112764+05:30
d34ec440-eac4-4579-bb8e-886d3403222e	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	9b429a8d-d6c5-4d8c-a617-1561e496566a	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-02-14 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.113724+05:30	\N	\N	\N	2026-05-02 17:55:57.113724+05:30
0d8e8bfa-8ec6-4764-b328-28c29e12088a	d645a156-8347-48a5-83eb-3992ab61d433	e3dc77da-9cdc-4118-9402-7f516785c9be	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-22 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.11479+05:30	\N	\N	\N	2026-05-02 17:55:57.11479+05:30
615c8c4c-767e-42d7-941f-9849d94998b1	56d25496-173d-4ecd-bfa2-27781316d4c0	9d335430-8562-422d-93c1-ba7903496729	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-22 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.115513+05:30	\N	\N	\N	2026-05-02 17:55:57.115513+05:30
3239952a-685d-4a75-8d6c-880c4f389c2d	aef03bae-eab0-4632-ba93-5ce01a16a1fc	6f31ff97-5605-4a80-822a-b490ed85de81	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-05 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.116281+05:30	\N	\N	\N	2026-05-02 17:55:57.116281+05:30
8d4b2b9a-e41d-4bf1-99e5-29e98f6328c6	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	c89490d0-4a76-49f8-98e2-982552961444	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-02-12 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.116895+05:30	\N	\N	\N	2026-05-02 17:55:57.116895+05:30
b6e0e4df-eb23-425f-9ff4-5141a0d0965c	ec6dda75-549b-4e80-a25e-38490c0b3d4d	7dce01af-144f-4a4f-9e8e-a33a31e104f8	b1256171-9b71-4d0e-bcb5-0d8a77187087	2025-11-15 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.11769+05:30	\N	\N	\N	2026-05-02 17:55:57.11769+05:30
191829db-ad7d-47ff-8867-59a5336ebaa9	e19ed374-a7fb-467d-92ee-581c7224d42a	5e6ef3b5-5b7f-40ff-aced-9bd6bff03569	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-03-24 00:00:00+05:30	allotted	\N	2026-05-02 17:55:57.11832+05:30	\N	\N	\N	2026-05-02 17:55:57.11832+05:30
0931c4c0-2d6f-4ac8-a357-f961fb21b94f	91fcbe12-96b5-44fc-b028-d3c6e73238de	ab74d555-5f4e-411f-ac34-19c02821ea64	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-04-28 00:00:00+05:30	cancelled	\N	2026-05-02 17:55:57.112089+05:30	\N	\N	\N	2026-05-02 20:14:59.002875+05:30
6fd02ed1-829b-4171-911f-b2b244e28c8e	c225e226-fc55-47c4-9905-26b52a33f960	ab74d555-5f4e-411f-ac34-19c02821ea64	b1256171-9b71-4d0e-bcb5-0d8a77187087	2026-05-02 20:14:59.002875+05:30	allotted	\N	2026-05-02 20:14:59.002875+05:30	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	\N	2026-05-02 20:14:59.002875+05:30
\.


--
-- Data for Name: allotment_letters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.allotment_letters (id, allocation_id, consumer_id, unit_id, letter_date, terms_agreed, generated_at, delivered_at, delivery_channel, remarks) FROM stdin;
\.


--
-- Data for Name: applicant_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applicant_addresses (id, applicant_id, address_type, address_line, pin_code, country, state, city, mobile_no, phone_no, fax_no, is_mailing, comm_courier, comm_email, comm_sms, comm_no_comm, comm_by_hand, created_at) FROM stdin;
\.


--
-- Data for Name: applicant_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applicant_details (id, booking_form_id, applicant_order, salutation, first_name, middle_name, last_name, father_name, date_of_birth, anniversary_date, nationality, marital_status, gender, no_of_children, passport_no, pan_no, aadhaar_no_hash, email_1, email_2, profession, designation, company_firm, photo_url, has_poa, created_at) FROM stdin;
\.


--
-- Data for Name: application_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.application_history (id, consumer_id, draw_date, draw_result, draw_position, waitlist_position, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, user_id, "timestamp", action, resource_type, resource_id, previous_values, new_values, immutable, retention_days) FROM stdin;
8e91b49f-188c-42c4-b1a1-4c406703547c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-01 18:14:39.47305+05:30	create	unknown	01306d9f-7d64-4e1e-89ec-1a1e19868540	{}	{"id": "01306d9f-7d64-4e1e-89ec-1a1e19868540", "name": "DEMO PROJECT ", "location": "Sector 20", "created_at": "2026-05-01T12:44:39.465Z", "rera_number": "1234", "tcp_licence": "566778"}	t	365
e7ceb377-73aa-4d6e-a7b5-7ccfddb44398	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-01 18:15:58.952911+05:30	update	01306d9f-7d64-4e1e-89ec-1a1e19868540	01306d9f-7d64-4e1e-89ec-1a1e19868540	{}	{"id": "01306d9f-7d64-4e1e-89ec-1a1e19868540", "name": "DEMO PROJECT", "location": "Sector 30", "updated_at": "2026-05-01T12:45:58.940Z", "total_units": 80}	t	365
009388ae-c0d8-4701-8a3a-8f0b31b96734	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-01 18:17:06.254488+05:30	create	01306d9f-7d64-4e1e-89ec-1a1e19868540	69f98f3c-2cce-4f2e-aad0-6fa4a68585b6	{}	{"id": "69f98f3c-2cce-4f2e-aad0-6fa4a68585b6", "project_id": "01306d9f-7d64-4e1e-89ec-1a1e19868540", "tower_name": "Tower B"}	t	365
c7bad370-0041-4802-aebd-b0a2d9799384	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 11:58:58.041228+05:30	update	01306d9f-7d64-4e1e-89ec-1a1e19868540	01306d9f-7d64-4e1e-89ec-1a1e19868540	{}	{"id": "01306d9f-7d64-4e1e-89ec-1a1e19868540", "name": "DEMO PROJECT", "location": "Sector 30", "updated_at": "2026-05-02T06:28:58.010Z", "total_units": 80}	t	365
d127f299-a24f-4abd-b16e-5c158f5e4442	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 11:59:20.610916+05:30	create	unknown	2fd05b46-2ca1-4c0b-a0ca-813c3e495770	{}	{"id": "2fd05b46-2ca1-4c0b-a0ca-813c3e495770", "name": "Demo 2nd may ", "location": null, "created_at": "2026-05-02T06:29:20.606Z", "rera_number": "3645", "tcp_licence": "784794"}	t	365
f1ff1da0-4ffe-474f-a09b-8c090f64a4df	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 12:00:05.791269+05:30	create	2fd05b46-2ca1-4c0b-a0ca-813c3e495770	f4ff8ae4-f2b0-4686-ba1d-1951cf8f0b7a	{}	{"id": "f4ff8ae4-f2b0-4686-ba1d-1951cf8f0b7a", "notes": null, "plan_name": "Standard AHP Plan", "created_at": "2026-05-02T06:30:05.776Z", "created_by": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "percentage": null, "project_id": "2fd05b46-2ca1-4c0b-a0ca-813c3e495770", "updated_at": "2026-05-02T06:30:05.776Z", "flat_amount_inr": null, "installment_name": "PLC Charge", "installment_type": "plc", "installment_index": 1, "due_date_offset_days": 0}	t	365
65aebf06-06e3-407c-8569-72aaed7fb080	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:03:50.767737+05:30	create	custom-report	674d05c9-140b-449a-99d0-87d44e6665e7	{}	{"id": "674d05c9-140b-449a-99d0-87d44e6665e7", "name": "Fixed Test Report", "created_at": "2026-05-02T12:33:50.748Z", "report_type": "inventory"}	t	365
19567328-6321-4bc1-b0bf-a37e689b680a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:04:26.696109+05:30	create	custom-report	e2b258d4-bad4-4c34-98f3-82cadeac4657	{}	{"id": "e2b258d4-bad4-4c34-98f3-82cadeac4657", "name": "Browser Created Report", "created_at": "2026-05-02T12:34:26.693Z", "report_type": "payment"}	t	365
55270bcb-29ec-4b9f-8705-ab2ea7f1baa4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:31.079951+05:30	create	campaigns	197deda8-75cf-4956-9d52-8c74f2ba6ca2	{}	{"id": "197deda8-75cf-4956-9d52-8c74f2ba6ca2", "name": "Test Email Campaign", "status": "queued", "channel": "email", "message": "Test message with {{consumer_name}}", "created_at": "2026-05-02T13:00:31.063Z"}	t	365
40da1cd9-3c78-4f1e-9620-e885159b9cf3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:31.114913+05:30	create	campaigns	5d9f750e-147f-4a97-b379-b7014cbf8b08	{}	{"id": "5d9f750e-147f-4a97-b379-b7014cbf8b08", "name": "Test Email Campaign", "status": "queued", "channel": "email", "message": "Test message with {{consumer_name}}", "created_at": "2026-05-02T13:00:31.113Z"}	t	365
883e5115-88d5-49c4-b28a-01fa175e0534	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:41.38894+05:30	create	campaigns	dd2a2c26-3f61-4d0b-a83b-cd9842ec67c2	{}	{"id": "dd2a2c26-3f61-4d0b-a83b-cd9842ec67c2", "name": "Test", "status": "queued", "channel": "email", "message": "Test", "created_at": "2026-05-02T13:00:41.387Z"}	t	365
9ba908e8-78bf-40e0-9559-85d75c1dcf32	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:53:35.938192+05:30	create	unknown	626fc003-bd10-473b-8c3a-16e7b97032d9	{}	{"id": "626fc003-bd10-473b-8c3a-16e7b97032d9", "name": "Phase 3 Test Project", "location": "Sector 99, Gurugram", "created_at": "2026-05-02T13:23:35.915Z", "rera_number": "RC/TEST/PHASE3/001", "tcp_licence": "TCP/TEST/PHASE3/001"}	t	365
9df715db-44b6-4c2a-88ae-668c3fbaeb5b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:55:32.124604+05:30	update	626fc003-bd10-473b-8c3a-16e7b97032d9	626fc003-bd10-473b-8c3a-16e7b97032d9	{}	{"id": "626fc003-bd10-473b-8c3a-16e7b97032d9", "name": "Phase 3 Test Project EDITED", "location": "Sector 99, Gurugram", "updated_at": "2026-05-02T13:25:32.084Z", "total_units": 50}	t	365
d87739ab-261e-4ee2-9c71-bb614afd63b5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:56:28.328697+05:30	create	626fc003-bd10-473b-8c3a-16e7b97032d9	da2b1767-d12a-46f8-a2b3-93520f311190	{}	{"id": "da2b1767-d12a-46f8-a2b3-93520f311190", "floors": null, "project_id": "626fc003-bd10-473b-8c3a-16e7b97032d9", "tower_name": "Tower A Phase 3", "units_per_floor": null}	t	365
b9db4e14-7745-4019-9890-ed830fea1626	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 20:14:59.074244+05:30	create	0931c4c0-2d6f-4ac8-a357-f961fb21b94f	7b9a8c13-8258-4d98-baf7-e5cf0001786a	{}	{"id": "7b9a8c13-8258-4d98-baf7-e5cf0001786a", "refund_amount_inr": "3208000"}	t	365
3067ad7c-19e2-43c0-9ccf-c77002eb2407	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 20:27:24.1978+05:30	create	unknown	081284e2-e83e-46a3-8096-445ea88119af	{}	{"id": "081284e2-e83e-46a3-8096-445ea88119af", "name": "Test Booking Phase 5", "email": null, "mobile": "9222222222", "created_at": "2026-05-02T14:57:24.193Z", "lead_stage": "enquiry", "project_id": null}	t	365
27f5c916-4c1c-4eb0-9908-0318ff019ddb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 21:02:21.394748+05:30	create	receipts	466f60d5-6c98-4236-9290-8e22d6d0cb0a	{}	{"id": "466f60d5-6c98-4236-9290-8e22d6d0cb0a", "status": "pending", "receipt_number": "REC-2026-0001", "amount_received_inr": "50000"}	t	365
98c73191-1651-4d79-8797-2f6d94cefd14	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 21:02:33.064528+05:30	create	receipts	91f1b617-b091-4fa3-bfc5-00f91b8c055c	{}	{"id": "91f1b617-b091-4fa3-bfc5-00f91b8c055c", "status": "pending", "receipt_number": "REC-2026-0002", "amount_received_inr": "25000"}	t	365
42b41967-4e6a-4d94-b429-41443e48cdb1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 21:02:40.316894+05:30	create	journals	5ca805c2-6ad9-43ad-963e-c25ebcceaea6	{}	{"id": "5ca805c2-6ad9-43ad-963e-c25ebcceaea6", "status": "pending", "created_at": "2026-05-02T15:32:40.313Z", "debit_amount": "10000.00", "entry_number": "JE-2026-0001", "credit_amount": "10000.00"}	t	365
fc8d23eb-d265-4b64-9bf8-e0aeced3b270	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 21:02:53.794734+05:30	create	tds	5a1a2d18-b10b-49ad-875e-7486d27e045e	{}	{"id": "5a1a2d18-b10b-49ad-875e-7486d27e045e", "amount": "150000.00", "status": "available", "created_at": "2026-05-02T15:32:53.793Z", "challan_date": "2026-05-01T18:30:00.000Z", "challan_number": "TDS-2026-0001"}	t	365
184ea552-923b-4efb-bede-e7991aab1033	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 21:29:10.849019+05:30	create	schedule	1b4d58c8-4e43-4e14-81ef-123751aa0e52	{}	{"id": "1b4d58c8-4e43-4e14-81ef-123751aa0e52", "status": "scheduled"}	t	365
9d7ae868-e73a-48fa-b730-597f401a21e8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:59:37.949685+05:30	create	unknown	2d7507fb-3ef8-423a-96f8-091b268cd5fc	{}	{"id": "2d7507fb-3ef8-423a-96f8-091b268cd5fc", "name": "ROF Regression Test Project 2026", "location": "Sector 93, Gurugram", "created_at": "2026-05-02T17:29:37.937Z", "rera_number": "RERA/GGM/2026/0099", "tcp_licence": "TCP/2026/5678"}	t	365
\.


--
-- Data for Name: automation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.automation_rules (id, name, trigger_event, action_type, message_template, delay_minutes, is_active, execution_count, last_executed_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_accounts (id, project_id, bank_name, account_number, ifsc_code, account_type, balance_inr, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: bank_statement_imports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_statement_imports (id, project_id, file_name, imported_by_user_id, import_date, total_transactions, matched_count, unmatched_count, total_amount_inr, status, created_at) FROM stdin;
\.


--
-- Data for Name: bank_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_transactions (id, import_id, transaction_date, description, amount_inr, transaction_ref, bank_account, matched_receipt_id, matched_demand_id, match_status, match_confidence, matched_by_user_id, matched_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: banks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.banks (id, name, ifsc_prefix, branch, created_at) FROM stdin;
5664cd6a-4656-4ff8-a693-a5575b6ed8b0	State Bank of India	SBIN	\N	2026-04-30 02:43:08.545172+05:30
c31c814a-3f43-4435-9e58-ccee04a42727	Punjab National Bank	PUNB	\N	2026-04-30 02:43:08.545172+05:30
37d48f50-68d1-4fcb-9c19-59a28affc21b	HDFC Bank	HDFC	\N	2026-04-30 02:43:08.545172+05:30
e307a987-3bd9-4567-bcbf-810a09b56cd2	ICICI Bank	ICIC	\N	2026-04-30 02:43:08.545172+05:30
b583c873-5368-4f16-bd6d-921f71e1a8af	Axis Bank	UTIB	\N	2026-04-30 02:43:08.545172+05:30
110e7f36-ecaf-4206-82b0-631cd5de9187	Kotak Mahindra Bank	KKBK	\N	2026-04-30 02:43:08.545172+05:30
9914887b-cee9-4686-ae8c-f1a2b7aa0740	Bank of Baroda	BARB	\N	2026-04-30 02:43:08.545172+05:30
d7488c60-2a3c-4058-984a-010d15ae3dd9	Canara Bank	CNRB	\N	2026-04-30 02:43:08.545172+05:30
d42a6042-ee19-4a56-866b-8242990a2900	Union Bank of India	UBIN	\N	2026-04-30 02:43:08.545172+05:30
dcfa0aa3-2ae7-4bb2-8930-c51eaa97ce1b	IndusInd Bank	INDB	\N	2026-04-30 02:43:08.545172+05:30
bf50be59-c104-4452-bacf-d2bf446394b5	YES Bank	YESB	\N	2026-04-30 02:43:08.545172+05:30
f195b20a-663f-4600-a210-fb618ea7d4a6	IDFC First Bank	IDFB	\N	2026-04-30 02:43:08.545172+05:30
69bc0499-79c8-453a-a70d-4c2dd87678be	Bank of India	BKID	\N	2026-04-30 02:43:08.545172+05:30
94777772-8e6a-4612-be1f-6cfd712c78c4	Central Bank of India	CBIN	\N	2026-04-30 02:43:08.545172+05:30
6185dcb0-06a8-4ee2-bf8f-7a2c816e8ff5	Indian Bank	IDIB	\N	2026-04-30 02:43:08.545172+05:30
f43f7db5-7c14-4fe5-bc74-bb333b8dc239	UCO Bank	UCBA	\N	2026-04-30 02:43:08.545172+05:30
\.


--
-- Data for Name: booking_forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_forms (id, consumer_id, project_id, unit_id, broker_id, main_broker_id, registration_no, form_no, application_date, customer_classification, booking_type, basic_price_inr, gstin, payment_plan_id, company_inaugural_disc, company_rebate_rs, company_rebate_sqft, company_rebate_pct, broker_rebate_rs, broker_rebate_sqft, broker_rebate_pct, has_plc, has_other_charge, has_alteration, has_ifms, has_additional_charge, has_extra_charge, has_finance, has_nominee, sales_employee_id, sales_remarks, status, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: booking_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.booking_records (id, consumer_id, project_id, unit_id, booking_date, booking_amount, payment_mode, payment_ref, bank_name, cheque_date, discount_value, discount_reason, discount_authorized_by, broker_id, broker_commission, broker_commission_type, sales_employee_id, nominee_name, nominee_relation, loan_amount, finance_bank, remarks, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: broadcast_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broadcast_campaigns (id, project_id, channel, message, total_recipients, delivered_count, status, created_by_user_id, created_at, updated_at, name) FROM stdin;
197deda8-75cf-4956-9d52-8c74f2ba6ca2	a0000000-0000-0000-0000-000000000001	email	Test message with {{consumer_name}}	0	0	queued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:31.063119+05:30	2026-05-02 18:30:31.063119+05:30	Test Email Campaign
5d9f750e-147f-4a97-b379-b7014cbf8b08	a0000000-0000-0000-0000-000000000001	email	Test message with {{consumer_name}}	0	0	queued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:31.113942+05:30	2026-05-02 18:30:31.113942+05:30	Test Email Campaign
dd2a2c26-3f61-4d0b-a83b-cd9842ec67c2	a0000000-0000-0000-0000-000000000001	email	Test	0	0	queued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:30:41.387273+05:30	2026-05-02 18:30:41.387273+05:30	Test
\.


--
-- Data for Name: broker_applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broker_applications (id, broker_code, company_name, estd_year, first_name, middle_name, last_name, designation, date_of_birth, anniversary_date, deposit_money, gst_status, rera_reg_no, tan_no, pan_no, service_tax, references_info, poa_date, strength_of_force, manager_name, officer_name, remark, address, phone_code, phone_no, city, mobile_no, state, email, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: broker_commissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broker_commissions (id, broker_id, consumer_id, project_id, unit_id, commission_amount_inr, status, paid_at, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: broker_project_mapping; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broker_project_mapping (id, broker_id, project_id, mapped_at, mapped_by) FROM stdin;
\.


--
-- Data for Name: broker_tax_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.broker_tax_config (id, broker_id, tds_rate_pct, gst_rate_pct, is_gst_exempt, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: brokers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brokers (id, name, firm_name, mobile, email, rera_number, pan, address, status, commission_pct, total_referrals, created_by, created_at, updated_at, parent_broker_id, tax_id_gst, tax_id_pan, bank_account_details, approval_notes, approved_at, approved_by) FROM stdin;
\.


--
-- Data for Name: call_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.call_logs (id, consumer_id, user_id, call_date, status_code, sub_status_code, ptp_date, remarks, next_call_date) FROM stdin;
\.


--
-- Data for Name: campaign_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaign_metrics (id, campaign_id, project_id, campaign_type, total_cost_inr, total_leads_generated, leads_converted_to_allotted, conversion_rate, revenue_generated_inr, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, name, channel, campaign_type, project_id, budget_inr, start_date, end_date, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cancellations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cancellations (id, allocation_id, consumer_id, cancellation_date, reason, forfeiture_amount_inr, refund_amount_inr, refund_status, created_at) FROM stdin;
7b9a8c13-8258-4d98-baf7-e5cf0001786a	0931c4c0-2d6f-4ac8-a357-f961fb21b94f	91fcbe12-96b5-44fc-b028-d3c6e73238de	2026-05-02	voluntary_surrender	29500	3208000	initiated	2026-05-02 20:14:59.002875+05:30
\.


--
-- Data for Name: cheque_bounce_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cheque_bounce_logs (id, receipt_id, consumer_id, bounce_date, penalty_amount_inr, reason, is_penalty_raised, created_at) FROM stdin;
\.


--
-- Data for Name: cities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cities (id, name, state_id, created_at) FROM stdin;
b58958bb-22b8-4355-9b59-347d6247512f	Amritsar	2da5d13b-8316-40d8-a153-e7bced2c5918	2026-04-30 02:43:08.545172+05:30
c55aefbf-ac25-4df8-97b8-cd331362892f	Ludhiana	2da5d13b-8316-40d8-a153-e7bced2c5918	2026-04-30 02:43:08.545172+05:30
34a57eca-6b9d-473e-888f-0eb6722a2a88	Chandigarh	2da5d13b-8316-40d8-a153-e7bced2c5918	2026-04-30 02:43:08.545172+05:30
fe872e42-32c3-438f-9e1f-0e8b623ce220	Jodhpur	ed834fe1-fe8b-4c4e-989f-584be875aa50	2026-04-30 02:43:08.545172+05:30
bde35444-3766-4ce3-9819-8c190dfff285	Jaipur	ed834fe1-fe8b-4c4e-989f-584be875aa50	2026-04-30 02:43:08.545172+05:30
d645a8cb-2dee-4464-aee9-291089eca867	Agra	7809cfb2-ec95-4c98-9003-2c817aed6e76	2026-04-30 02:43:08.545172+05:30
fc1b0391-8a87-45fc-a98c-123eddd41e6a	Ghaziabad	7809cfb2-ec95-4c98-9003-2c817aed6e76	2026-04-30 02:43:08.545172+05:30
beeb97e1-a81e-4842-8944-f016bae6f0f3	Noida	7809cfb2-ec95-4c98-9003-2c817aed6e76	2026-04-30 02:43:08.545172+05:30
0bb39b1d-b4bb-4ae2-9471-21b94429e9eb	New Delhi	d8f4ddfd-a2e5-4808-a308-051ae8ba4326	2026-04-30 02:43:08.545172+05:30
95663ab8-4c45-41d5-b625-1dce41c561cd	Hisar	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
be1b34f2-4a1b-4e60-808f-bf2e649b73d7	Rohtak	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
a5eedb08-87e1-43f0-81d0-8975ba1210bb	Sonipat	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
8d638397-7607-4ff2-b623-b59ecd169044	Panipat	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
e28dd2b6-6cad-495d-a969-e345176f5c6f	Karnal	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
36db5bde-ccf4-4080-a354-ac42c2a77faa	Ambala	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
8e185eb1-646f-41ca-9483-c2514674192a	Faridabad	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
ce08dce3-43ec-40a6-90f7-e450f50aefb1	Gurugram	08430fee-34ad-4b9a-9ddd-83f779b52b33	2026-04-30 02:43:08.545172+05:30
\.


--
-- Data for Name: co_applicants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.co_applicants (id, consumer_id, name, relationship, aadhaar_hash, pan_hash, created_at, updated_at) FROM stdin;
e0000000-0000-0000-0000-000000000001	d0000000-0000-0000-0000-000000000001	Mrs. Usha rohila	Wife	593e5f125889de21a77fb527932249b38880eb5a94aac0e573f05a997ceb2f29	a4c8813ef92f2161861fc1bc54c738f5d4c5c9ada0f13ebce9e8a298fec54813	2026-05-01 10:23:33.011588+05:30	2026-05-01 17:50:25.308446+05:30
\.


--
-- Data for Name: communication_status_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.communication_status_codes (id, code, category, is_active, created_at) FROM stdin;
81e77c0c-423c-4e25-88af-add71a49a0ab	Call Again	Calling	t	2026-05-01 04:59:00.903697+05:30
dea34fe0-d6d5-45ee-a1b1-53499c7a8ea5	Next Followup	Calling	t	2026-05-01 04:59:00.903697+05:30
7a9304fa-553d-48a7-a626-f7b634923d30	Promise to Pay	Calling	t	2026-05-01 04:59:00.903697+05:30
80c9b1f4-d0a0-4a8a-88e6-0fa5e1a25ff4	Not Reachable	Calling	t	2026-05-01 04:59:00.903697+05:30
49d93c70-6cdb-414d-9a51-212d0267e36e	Disconnected	Calling	t	2026-05-01 04:59:00.903697+05:30
fa67e8fa-addb-4790-b81b-2aaa8d319062	Wrong Number	Calling	t	2026-05-01 04:59:00.903697+05:30
e3873624-0bb7-47a8-9279-1a5771da0009	Interested	Calling	t	2026-05-01 04:59:00.903697+05:30
65c37f6b-00bd-485a-8915-b7a6b1bd3340	Not Interested	Calling	t	2026-05-01 04:59:00.903697+05:30
\.


--
-- Data for Name: communications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.communications (id, consumer_id, channel, direction, subject, message, email_recipient, phone_recipient, status, sent_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: construction_milestones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.construction_milestones (id, project_id, milestone_name, milestone_type, description, planned_date, actual_date, completion_percentage, status, notify_allottees, notification_sent_at, photos_urls, created_by_user_id, updated_by_user_id, created_at, updated_at) FROM stdin;
4c31dfd4-6668-4e84-8a41-6197b0086f9e	b1256171-9b71-4d0e-bcb5-0d8a77187087	Foundation Complete	foundation	\N	2025-06-26	2025-06-30	100	completed	t	\N	\N	\N	\N	2026-05-02 17:55:57.213301+05:30	2026-05-02 17:55:57.213301+05:30
24c3b8c4-a3f3-41cf-a2c4-debedd1e02bd	b1256171-9b71-4d0e-bcb5-0d8a77187087	Plinth Level Complete	structure	\N	2025-09-24	2025-09-28	100	completed	t	\N	\N	\N	\N	2026-05-02 17:55:57.216483+05:30	2026-05-02 17:55:57.216483+05:30
4fc3cbcd-8abc-4171-bc09-ad368316e3f4	b1256171-9b71-4d0e-bcb5-0d8a77187087	Ground Floor Slab Cast	structure	\N	2025-10-24	2025-10-25	100	completed	t	\N	\N	\N	\N	2026-05-02 17:55:57.216998+05:30	2026-05-02 17:55:57.216998+05:30
28290aa4-f472-4146-893a-958f7edf526d	b1256171-9b71-4d0e-bcb5-0d8a77187087	Structural Frame Complete	structure	\N	2026-03-23	2026-03-20	100	completed	t	\N	\N	\N	\N	2026-05-02 17:55:57.217473+05:30	2026-05-02 17:55:57.217473+05:30
96bc2992-75c7-4259-9d0e-5ab98ccd2dc2	b1256171-9b71-4d0e-bcb5-0d8a77187087	MEP Rough Work Complete	mep	\N	2026-06-21	2026-06-16	100	completed	t	\N	\N	\N	\N	2026-05-02 17:55:57.218593+05:30	2026-05-02 17:55:57.218593+05:30
d51f7693-c7d0-441d-bb06-121deef7c220	b1256171-9b71-4d0e-bcb5-0d8a77187087	MEP Final Connections	mep	\N	2026-09-19	\N	60	in_progress	t	\N	\N	\N	\N	2026-05-02 17:55:57.219266+05:30	2026-05-02 17:55:57.219266+05:30
d09b3b70-e11f-4d01-a934-22e91b9fa668	b1256171-9b71-4d0e-bcb5-0d8a77187087	Internal Finishing Start	finishing	\N	2026-09-19	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.219612+05:30	2026-05-02 17:55:57.219612+05:30
efaaeb0b-b62d-47a5-8903-b843812faf99	b1256171-9b71-4d0e-bcb5-0d8a77187087	Internal Finishing Complete	finishing	\N	2026-12-18	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.219894+05:30	2026-05-02 17:55:57.219894+05:30
897b7a74-062e-4c19-9d5b-23302f7c4d99	b1256171-9b71-4d0e-bcb5-0d8a77187087	External Finishing	finishing	\N	2027-01-17	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.220167+05:30	2026-05-02 17:55:57.220167+05:30
a7aaa8fe-df1d-4808-84bb-9d0cbc0f7b5b	b1256171-9b71-4d0e-bcb5-0d8a77187087	Legal Approvals	legal	\N	2027-03-18	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.220481+05:30	2026-05-02 17:55:57.220481+05:30
bab6b466-a648-41f1-95be-4c9a39bf49d9	b1256171-9b71-4d0e-bcb5-0d8a77187087	OC Obtained	legal	\N	2027-04-17	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.220825+05:30	2026-05-02 17:55:57.220825+05:30
f88e5cc8-78c0-4dd6-b502-2b2944adecf1	b1256171-9b71-4d0e-bcb5-0d8a77187087	Possession Handover	handover	\N	2027-05-17	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.221166+05:30	2026-05-02 17:55:57.221166+05:30
fe909ea0-0c44-4d2f-9457-2d5b4ff22fc6	b1256171-9b71-4d0e-bcb5-0d8a77187087	Post-Handover Support	handover	\N	2027-06-16	\N	0	pending	t	\N	\N	\N	\N	2026-05-02 17:55:57.22148+05:30	2026-05-02 17:55:57.22148+05:30
\.


--
-- Data for Name: consumer_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consumer_folders (id, consumer_id, folder_name, folder_type, parent_folder_id, sort_order, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: consumers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.consumers (id, name, photo_url, mobile, email, aadhaar_hash, pan_hash, parivar_pehchan_patra, income_category, lead_stage, project_id, allocated_unit_id, campaign_id, created_at, updated_at, created_by_user_id, first_name, last_name, middle_name, salutation, dob, gender, profession, nationality, annual_income, education, company, ppp_id, pan_no, alt_mobile, source_of_enquiry, referred_by, present_address, present_address_line2, present_city, present_state, present_pin, present_country, perm_address, perm_city, perm_state, perm_pin, perm_country, office_address, office_city, office_state, office_pin, nominee_name, nominee_relation, nominee_dob, nominee_share, finance_bank, loan_amount, loan_sanction_date, registration_no, form_no, customer_classification, booking_date, last_call_status, last_call_sub_status, promise_to_pay_date, next_call_date, total_overdue_amt) FROM stdin;
e80b1a86-f98b-475b-b769-a620f86ef26f	Anjali Chopra	\N	9049316668	anjali.chopra@email.com	8c0d29f8a98a2d33d58ad664d259975a43a0ed14403e1fbd005bb5ac83ab995b	d39c528aa890024490ae1cc1f4500d36c2ae4899623026d5746e78e039bed1d3	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	6c7248f3-e2b9-49d0-85bb-364c1991ed08	\N	2026-05-02 17:55:57.057349+05:30	2026-05-02 17:55:57.088026+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
dccdc164-b2d6-472d-804c-711ff66ecf32	Divya Chopra	\N	9749468452	divya.chopra@email.com	f0fdadb2d10fbfa9a2dda71b327a7607dbdac577dc7f851a5f8d5f906e386f4b	5a37fd75a50cb5aa865532f1aef7534d9fe28764fd66c915a455d657705d59f5	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	be8f73ba-c527-46f9-a4ee-a1409a86a289	\N	2026-05-02 17:55:57.059344+05:30	2026-05-02 17:55:57.090275+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
595ee972-df8f-41b2-9f9d-b31220ee462b	Vikram Malhotra	\N	9115292477	vikram.malhotra@email.com	487baa389076f6350922167090485bff007afa98fa6595302b9c2190a5efe92f	47fe5919c20070edb81cc3508c5f4670f119d1cd2755d04fbb4eaff80fe88d1c	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	0687f0bd-dd4c-4e13-b029-fe03a1d335aa	\N	2026-05-02 17:55:57.059897+05:30	2026-05-02 17:55:57.091589+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
f43c8424-9983-440f-8093-fe30acd7b756	Neha Malhotra	\N	9213274102	neha.malhotra@email.com	c69302eb9cf6a32c97475c5d981dde9274399d73a35407cbb533bb95208843b8	08f00eafb335dee06909053533fc9639859da1ce5042b6224341113b4c9b486a	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	68ed1a68-94f6-43f2-b734-752c3b72e55e	\N	2026-05-02 17:55:57.060614+05:30	2026-05-02 17:55:57.092722+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
223abf20-2bf2-4332-aa59-0db5eeace7f5	Amit Sharma	\N	9303154129	amit.sharma@email.com	61d6acc83c1f998f9aa739717312842d8e68cd180d751e734d99611f3687ec73	e3ee4072ad743af331c1ac163dd31f74e75c41cb36e148c88f6dc069975b97e3	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	a1d51fc3-7785-46ce-896f-3d8fbf4d5a28	\N	2026-05-02 17:55:57.061084+05:30	2026-05-02 17:55:57.093951+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
d0000000-0000-0000-0000-000000000002	Mr. Dharam Veer	\N	8448393206	dharamveer4229@gmail.com	c3d6a87684aa2b19ed5d0df064942cf19b7c14ea4e039562613454fa7ea797a5	60bd00950219e47364782a6703d62ea709f911300c172ba3fa90524f2d88b7e9	\N	\N	allotted	a0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000021	\N	2026-05-01 10:23:33.008981+05:30	2026-05-01 19:03:52.413566+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	85400.00
d0000000-0000-0000-0000-000000000005	Mr. Rohit Kumar Singh	\N	9041003354	singhar87@gmail.com	9ab2508ccb8698eea2c4d0c0c105ce3127b3d8b5fc9055b1de0278d6c7cadf76	4a3aa924ac3562559c24cf62d2807cd20cb8fe3bb9c2191f4af5a32a54107e09	\N	\N	allotted	a0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000024	\N	2026-05-01 10:23:33.008981+05:30	2026-05-01 19:03:52.413566+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	12500.00
d0000000-0000-0000-0000-000000000001	Mr. Amit Rohilla	\N	9729693567	amit.rohilla.184@gmail.com	74cecfff761c50717f9f39951069b0b4331e84dd01ba9336388584564edc3c9d	443cc2685f43b2bd51148919b84996e27b190662e251396cd910ad166d36ea03	\N	\N	allotted	a0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000020	\N	2026-05-01 10:23:33.008981+05:30	2026-05-01 19:03:52.413566+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	125000.00
d0000000-0000-0000-0000-000000000003	Mr. Prem Kumar	\N	9910077853	vikas.yadav@philbygroup.in	247c6c1f4e3b736149c413087ec0cdf5302eaaec6612640e950a004cb56634cb	0e84425420190a5dc8d0a3d72d2576edf20a83bf3ea87f70d33d428ec429ad4d	\N	\N	allotted	a0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000022	\N	2026-05-01 10:23:33.008981+05:30	2026-05-01 19:03:52.413566+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
d0000000-0000-0000-0000-000000000004	Ms. Rashmi Gupta	\N	9911292456	rashmi.rgupta21@gmail.com	db8ab016959877d2aedad9d697b4de6ddb18889dc7485877dc8d16028a93da36	83364fa637f02e77cc286f8ff7f4e6e4fadf7144ea87c929dcef541c4f0031f9	\N	\N	allotted	a0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000023	\N	2026-05-01 10:23:33.008981+05:30	2026-05-01 19:03:52.413566+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	42000.00
4152814f-a12c-44be-9ccd-40e18069a7ba	Sneha Nair	\N	9348486950	sneha.nair@email.com	e6fe1318ef37c383d3fc2c513341c2027bc2ccb3e87df870903e3b8fc72654d0	23237e8c00677f3af6a7a8a5204f201c4cdb407ce64b4a136d724d7cbe25bd72	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	8ed5e181-0c94-440c-9891-fb31741ecc1b	\N	2026-05-02 17:55:57.061455+05:30	2026-05-02 17:55:57.095309+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	Ananya Verma	\N	9144304738	ananya.verma@email.com	61e73d5e7232382ae015c56bc7e9b69271dd5a4dd6fc058f087722d291609f93	49e55f1356cde32a255ee51ecb9e4866f2f749d0b0c152db114defb01d06aff9	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	628faa0a-fa9d-4f4f-b924-156db77a0e05	\N	2026-05-02 17:55:57.061762+05:30	2026-05-02 17:55:57.096348+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
7f823bf9-a429-4719-a175-070d4b1d0900	Isha Menon	\N	9399957339	isha.menon@email.com	2ec7e0b3669125a59e2a1ac4e74b443ecb47b104477666e8eb66f8e70e1360c9	2758bc31a4005437f9f6d155138a3c1b3163a17a583a2de51e2b172b6df3283f	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	5aa53b12-4a5b-4d58-a920-f85569971a90	\N	2026-05-02 17:55:57.062045+05:30	2026-05-02 17:55:57.097317+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	Amit Gupta	\N	9569197224	amit.gupta@email.com	775c3a7e7e4fa9e26f87afa7f475aa76ba97b31ed268c2cc69cbff23f65b4047	c28f9cd9d50000ced6523a51759d8421d58a890c87ace482e410b071ba9d752f	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	184ccaf3-9af3-4e04-86b3-84eec1301a9d	\N	2026-05-02 17:55:57.062425+05:30	2026-05-02 17:55:57.098273+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
5f5b341c-7f18-44fe-97cc-04205c3b1201	Amit Bhat	\N	9606935667	amit.bhat@email.com	50f9d743e7ae01acd0234f3d4f60a0b36882597c2006add23c013cb0175ee469	0a6cb075728855e3029659c937d4d4fa2a7e75854959ee949d96dba36bde1861	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	0901a207-bb0a-444d-97b9-94315f89c6d8	\N	2026-05-02 17:55:57.062847+05:30	2026-05-02 17:55:57.099443+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
0745814d-4302-4e64-ba13-c9201f12b39e	Isha Nair	\N	9381035277	isha.nair@email.com	b06c75dddd726c0eca0c0f9cdebec59c936dab5864fb255d40457de14fe900f9	1cec785413279fadbafcb30da65cf143e3841e32e09940cd67b72c29e25399d9	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	5832292b-42ea-4ee1-a8d6-8aae929a5454	\N	2026-05-02 17:55:57.06325+05:30	2026-05-02 17:55:57.100487+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
3c7cc2ab-8f34-4f4c-88c7-d9efdd5bbb6a	Ananya Pillai	\N	9518869343	ananya.pillai@email.com	3b3a3f18127eb999c09d8d42cbd8a7787975adb9e9f300883cc849f4a2741878	ee7210e9bb98a82a818bf0cc2857a72d5a4eb1c77084d4cfb379b0e3619a5539	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.073291+05:30	2026-05-02 17:55:57.073291+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
a7074e69-7fc4-4367-a791-5f8c0be5abbb	Harsh Singh	\N	9030595280	harsh.singh@email.com	83c52a1d4be7073b78fba74d79242fc517dd0f72671a0de162db87540aa43ce4	0b974833f7540ffc30c8fff9d76ebf3c60f7c893b09c9abfb26066f7bd8fa6f7	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.073704+05:30	2026-05-02 17:55:57.073704+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
5e5f97ea-f96a-4aac-ab6e-93b497c432ee	Arjun Iyer	\N	9845572956	arjun.iyer@email.com	f7151e07718df801c639c1d26502ca2fbba59d9338247e1ca4b438bda1108c86	00db14d24101a17705566ad33e22ee7d2e89be2b99ec9431c2f58bd712111e85	\N	MIG	onboarded	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.074022+05:30	2026-05-02 17:55:57.074022+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
0ccb0e9b-4b67-4c79-8802-7ec0c63b188c	Priya Joshi	\N	9442557839	priya.joshi@email.com	5ba1fe6dfc85c6f00657fdc2e86b942dc39b7cde186f520720c059556e93db19	3ed15dc6cac01c04f11e2742d6193036a9de08b49be9d2ee348333165f419a75	\N	LIG	onboarded	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.074562+05:30	2026-05-02 17:55:57.074562+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
e6481d2a-38fc-43dc-8099-55e6bfe41bd9	Karan Menon	\N	9717703635	karan.menon@email.com	9d24c681d969a6a5df91fcaac98ba6ac72a2f011b9e808eb9a34bb6453728f18	56a25acf1480674de255ab342eab8864ab93ab1ffc28e14404edee1fdc313683	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	a5224ea5-a9ef-43f4-84ea-2fe7962c5cf4	\N	2026-05-02 17:55:57.065116+05:30	2026-05-02 17:55:57.10227+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
78b750fd-aabd-4261-ac34-1cc5d075b8e4	Priya Malhotra	\N	9777070508	priya.malhotra@email.com	171f8aa8dbff9a4155dd247bef9b305a7d4a6f2e3e68eeb85cbe298a622f0bb3	2bf71dc143ae0ac98de5c0e97bd49ae90372ea8e945ac340245fa6f16b0d8b9d	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	182bee17-4938-475c-a9e1-63b280a0bd39	\N	2026-05-02 17:55:57.065437+05:30	2026-05-02 17:55:57.103186+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
155ba700-8d2e-4870-8706-58b86bfe1acb	Rajesh Bhat	\N	9258123207	rajesh.bhat@email.com	32847926a07349f9cc5199131a59ee25bbff232066ac14406a39406aa3e80e72	b9e19350c9f58d800ddceb691d7be54dd72655f994306fa2b5c9494730c9d475	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	d557893a-282d-42bb-81d5-eaf78ffd3b9a	\N	2026-05-02 17:55:57.065779+05:30	2026-05-02 17:55:57.104+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
4e5ea527-b9a7-4d8a-8d44-c346508d0e05	Vikram Patel	\N	9604291129	vikram.patel@email.com	33f89a30e51d7cd826fc6a1f7635e687b272a8bc618211d7245fe905dab3a319	db33e56c47865791eeffad515e9626ae0004d3f570660029b23e023313279200	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	0ce4e4e5-8607-419e-9b6b-426759ae4e1a	\N	2026-05-02 17:55:57.066105+05:30	2026-05-02 17:55:57.105152+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
2c402c76-d75e-4867-b8f6-57eea5df59f5	Isha Kumar	\N	9897578978	isha.kumar@email.com	917fac15127ad406e160ac2478690c9111af2303a80e7e2ba421d5a4b42edb5f	3610314f9944cf85d5ebae5f9fbc75edef5a1832e6635889451916c75a1c0a43	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	2a2386c4-e84a-4b83-b239-9c2e778a430c	\N	2026-05-02 17:55:57.06649+05:30	2026-05-02 17:55:57.106188+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
0ca11d19-3fb3-48e3-b038-b64c1f050d22	Rajesh Iyer	\N	9164563896	rajesh.iyer@email.com	92cc3619651db29a0bcab8c912f90e67cbb39dd449c71dc781f918249fc166e2	02abe1e9629a527e848c9d7f9103b04be4300c074ad4c2dda653f0fb8a01c351	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	618ce32d-47f7-4e89-9a2f-bc20519e83d2	\N	2026-05-02 17:55:57.066973+05:30	2026-05-02 17:55:57.107136+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
26dece45-7e64-4f12-8695-169443d725fa	Aditya Sharma	\N	9764112781	aditya.sharma@email.com	9820a1c485da970c76ebc93fe4bd4ec76f77b5ad4788934cc1f5efcc037c7835	3d7e7aaf0cc5d0c2e048fe46b0d93e2943bd60536674ee7672f634e45b0a6e5e	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	2cda2328-170d-4d04-92ff-55773c84279a	\N	2026-05-02 17:55:57.067539+05:30	2026-05-02 17:55:57.108375+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
da038407-ad69-4a16-83d8-20c51a2acc1f	Sneha Patel	\N	9850990010	sneha.patel@email.com	5a0b5847c5b81d74d80d884eae725921b317d084e80099c242199e68d40f4f63	71c317564086ea3e8b4687b0a1dc537018ab4f002a31d85a6b17eb1087f9a766	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	7915d0ad-7320-4169-8575-fe92ade1a1e1	\N	2026-05-02 17:55:57.068219+05:30	2026-05-02 17:55:57.109273+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
36b736ff-deb8-417f-871f-70e5b22dd625	Vikram Desai	\N	9280830401	vikram.desai@email.com	abeaa046ae4388ef886f533d2750c28271c5ae0f05579a1c5d3444f2b37b1a0b	53cf8ce876eb53c113486c3e7a03771872568c6e57c7f4a932c493dfdda80c34	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	622c5913-3c8f-435f-9d3c-46aa69562f49	\N	2026-05-02 17:55:57.068926+05:30	2026-05-02 17:55:57.110151+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
85f7abda-4b11-4b0b-8b28-5b41e0284b0c	Pooja Rao	\N	9115545897	pooja.rao@email.com	8ee9584534315bb1e14f08dd5ea79be634c611a5b90209ecccaff474f5c6692d	458440463fdc237e4ac2e4363c9093dcbf1b3c15a492a6df8f5134ddf3e84513	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	f7afaefb-64ff-4f9a-baa2-7fc130b2b6ea	\N	2026-05-02 17:55:57.069308+05:30	2026-05-02 17:55:57.110957+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
448e78b1-b97d-4183-8f0f-5f4e2fbe348f	Sanjay Rao	\N	9441762862	sanjay.rao@email.com	6037ddb71676d37bebdeb84ab7c4b38b69caadd363daef2c26cfce78d2e05cd0	65db72d59f3552faed8ff6b73a5f8200c775534ae1e1129173eb6a4a144778af	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	4c31c57d-2475-47fd-8ee2-178a6a76e6f0	\N	2026-05-02 17:55:57.069809+05:30	2026-05-02 17:55:57.111842+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	Ananya Bhat	\N	9863640263	ananya.bhat@email.com	d80170c921cbb89b58bf3d16421e497668d631c05f72f3411e5b66ee04b44086	0fba87b31a1177da4a0442e02ef5ed571eb372b83135871aa0920b716caf2ac7	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	360af183-3c6d-456c-90cb-c2ebce9b8450	\N	2026-05-02 17:55:57.070398+05:30	2026-05-02 17:55:57.113364+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
3a7b9e60-d641-4ce9-9a51-77951d5ce24e	Divya Khanna	\N	9146464801	divya.khanna@email.com	3414815657ddfe05f84f49bc4d1a2a629ad28eb067635489199247d644d7d994	67043cbb4d1843af1b02fd3c90fd457d6eb5fef7579cd358e06e776ad0ca56dd	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	9b429a8d-d6c5-4d8c-a617-1561e496566a	\N	2026-05-02 17:55:57.070654+05:30	2026-05-02 17:55:57.114349+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
56d25496-173d-4ecd-bfa2-27781316d4c0	Nikhil Khanna	\N	9728864532	nikhil.khanna@email.com	3ce4a7a37a393c865089fcfeb6c87537354eaf22df7ea8b52c1c581378e0ad62	a7209eb08a912d809008f878bc028ccdff4b48a387c2140264e16f2224f2744c	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	9d335430-8562-422d-93c1-ba7903496729	\N	2026-05-02 17:55:57.07115+05:30	2026-05-02 17:55:57.11602+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
aef03bae-eab0-4632-ba93-5ce01a16a1fc	Priya Menon	\N	9468024233	priya.menon@email.com	cd84b7375dc48195f06ddecddb70bea0892c0db1d0f109d7bf3403df1b189e11	4badc7fc5ca427b34a0325aa3f38d834f34b7afdc263f387afb79c0f6b2d1176	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	6f31ff97-5605-4a80-822a-b490ed85de81	\N	2026-05-02 17:55:57.071556+05:30	2026-05-02 17:55:57.116666+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
a2fad86a-9c4c-4296-b061-3e2fb65aaadf	Ananya Singh	\N	9642537798	ananya.singh@email.com	c99980799a7e812695403bdcfd4b5251c82575efc0ef906f6ff0c1289013bdf9	3e02d74a4bace80f44b8fe8d7acd82b4de6a7fd51f87007eb4fa3f95d600fa30	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	c89490d0-4a76-49f8-98e2-982552961444	\N	2026-05-02 17:55:57.071804+05:30	2026-05-02 17:55:57.117297+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
ec6dda75-549b-4e80-a25e-38490c0b3d4d	Amit Iyer	\N	9359995459	amit.iyer@email.com	5d5afd5e22c2829744ff179ccb0a466aac9bb7f55a0cd4177edab03f43b4d267	f3f82ef10ec919242e195acbc92fa036445f46f316be6e2691332f19e7861190	\N	LIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	7dce01af-144f-4a4f-9e8e-a33a31e104f8	\N	2026-05-02 17:55:57.072147+05:30	2026-05-02 17:55:57.118086+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
e19ed374-a7fb-467d-92ee-581c7224d42a	Rohan Kumar	\N	9839136615	rohan.kumar@email.com	d2b599cbd8b79fe5a374d2c627aa90ff8a0241a637a9b9b69f350e55a9f8665b	6550cc74c233497c30a3619a34a2bb3c3519684d7f7c8e76ac8abdaa53e8f8bc	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	5e6ef3b5-5b7f-40ff-aced-9bd6bff03569	\N	2026-05-02 17:55:57.072522+05:30	2026-05-02 17:55:57.118705+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
c225e226-fc55-47c4-9905-26b52a33f960	Karan Malhotra	\N	9635953444	karan.malhotra@email.com	7ec15769c76f64f99c61f2513f4db4574041e9584ce86dc9dd6949f768468c77	6505edad0641f110e235049a8c03a97dd46c3345171656e09b6b596760f35d4b	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	ab74d555-5f4e-411f-ac34-19c02821ea64	\N	2026-05-02 17:55:57.072883+05:30	2026-05-02 20:14:59.002875+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
ef59f346-f6e5-4348-b27f-9310581b53f0	Priya Bansal	\N	9308071721	priya.bansal@email.com	766bf214939f589655c2be7f4a26c7434d0d448a157c4e80d2d55aeaf725229a	40f78365741c1f5c123d3f3d07f37afcaf0bede639efe7f6f4a64fd8cf763ef3	\N	LIG	onboarded	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.075014+05:30	2026-05-02 17:55:57.075014+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
2d70e395-f5a6-495f-9608-a3f124655def	Sanjay Bansal	\N	9445429497	sanjay.bansal@email.com	d711090d80413e759b9151210685a90d5f005a30d496da2534d5d37a443b35a5	941d9a3bb0c17efe525f0fca2bd932493f1be4a3ada5eea91c927e71b409a427	\N	EWS	onboarded	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.075506+05:30	2026-05-02 17:55:57.075506+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
298d80b6-41e7-4547-8085-2d3a94afbde2	Vikram Menon	\N	9590199602	vikram.menon@email.com	183e8b48953a728d36958b1736659432f65640325c7189835227021cc1ed8461	5c1cdd1be433beb7313d7427ca5baf6a7dd9f5a9b7afc8af253f76397e351a10	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.075884+05:30	2026-05-02 17:55:57.075884+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
fb0b3bed-4f57-4c7e-a429-6db8077f38e8	Harsh Malhotra	\N	9773104679	harsh.malhotra@email.com	2e749244a55fc88c7791d103ec51b898254536971efea020d35a92ab0378f4a5	bc71af6afbe5d2981b0f92a836e5f89fcebf0a026e40bf009bf68a71e1f8da66	\N	MIG	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	9adfbcc2-7860-4e49-b922-7d9afe25e4d4	\N	2026-05-02 17:55:57.063815+05:30	2026-05-02 17:55:57.101422+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
d645a156-8347-48a5-83eb-3992ab61d433	Sneha Singh	\N	9031102931	sneha.singh@email.com	c678caf260efaf53542e41486c55df8c6785aacc5d847a8c1916a25571d06f3c	c6824f2ef9dfffa4f64a3bfc5a061109cf98e8a033f815ca41e785485931ddb7	\N	EWS	allotted	b1256171-9b71-4d0e-bcb5-0d8a77187087	e3dc77da-9cdc-4118-9402-7f516785c9be	\N	2026-05-02 17:55:57.070905+05:30	2026-05-02 17:55:57.11526+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
91fcbe12-96b5-44fc-b028-d3c6e73238de	Rajesh Arora	\N	9185214208	rajesh.arora@email.com	404ea7bc1cade044fe3746231a4bfe569bd3c07606144c743e46a5cb98bdcba2	9780e4f6ba34a7325908e827612572a89f37654b5dab6788c9759b11cc54c6cb	\N	MIG	cancelled	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	\N	2026-05-02 17:55:57.070123+05:30	2026-05-02 20:14:59.002875+05:30	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
081284e2-e83e-46a3-8096-445ea88119af	Test Booking Phase 5	\N	9222222222	\N	\N	2d697faac3ed0d7573d7267cb72a7b38469975b0e2c46fd8aa6e59dd3f25ac40	\N	EWS	enquiry	\N	\N	\N	2026-05-02 20:27:24.193759+05:30	2026-05-02 20:27:24.193759+05:30	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Test Booking Phase 5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	AAAAA1111A	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N	\N	100.00	\N	\N	\N	\N	\N	General	\N	\N	\N	\N	\N	0.00
\.


--
-- Data for Name: conveyance_deeds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conveyance_deeds (id, consumer_id, project_id, unit_id, deed_date, deed_no, registry_office, stamp_duty_inr, status, created_at) FROM stdin;
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.countries (id, name, code, created_at) FROM stdin;
af4c55f4-fb67-4311-a376-43872ee32193	India	IN	2026-04-30 02:43:08.545172+05:30
5c6dc255-7bfb-4f7c-b48d-1e32de34ddd9	USA	US	2026-04-30 02:43:08.545172+05:30
cc6065e5-2f6b-471b-8807-1211829f2af1	UK	GB	2026-04-30 02:43:08.545172+05:30
f657cae6-ecdc-4f52-8133-2e6b5b82c6a5	UAE	AE	2026-04-30 02:43:08.545172+05:30
2b6c87b1-f949-41c8-bc38-4dc4145c7533	Canada	CA	2026-04-30 02:43:08.545172+05:30
1605f199-98ae-4061-ba15-a333da68e28c	Australia	AU	2026-04-30 02:43:08.545172+05:30
b84ed343-2d60-4734-a135-131c9ee6af74	Singapore	SG	2026-04-30 02:43:08.545172+05:30
\.


--
-- Data for Name: credit_debit_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credit_debit_notes (id, invoice_id, note_number, note_type, original_invoice_no, adjustment_amount, gst_rate, gst_amount, total_amount, note_date, reason, status, created_by_user_id, created_at, updated_at) FROM stdin;
404a3f85-ed95-4f1b-bd43-3d21f690a94c	eb03b143-dd73-4eaa-a2d0-fe7b4d5dca23	CN-2026-0001	credit-note	INV/2026/00001	10000.00	5.00	500.00	10500.00	2026-05-02	Phase 8 final verification	issued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:44:17.80106+05:30	2026-05-02 22:44:17.80106+05:30
86591313-f897-4154-adfd-8ee8cfbcb3d7	db1f39ce-39ef-4f8d-9f81-4062b4449bd6	CN-2026-0002	credit-note	INV/2026/00002	50000.00	5.00	2500.00	52500.00	2026-05-02	Phase 8 reversal test	issued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:44:31.852493+05:30	2026-05-02 22:44:31.852493+05:30
09372ea8-0f72-402c-a105-ac5d5e45aed1	eb03b143-dd73-4eaa-a2d0-fe7b4d5dca23	DN-2026-0001	debit-note	INV/2026/00001	5000.00	5.00	250.00	5250.00	2026-05-02	Phase 8 debit note test	issued	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:44:43.787451+05:30	2026-05-02 22:44:43.787451+05:30
\.


--
-- Data for Name: custom_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.custom_reports (id, name, project_id, report_type, filter_criteria, columns_selected, schedule_frequency, schedule_recipients, created_by_user_id, created_at, updated_at) FROM stdin;
674d05c9-140b-449a-99d0-87d44e6665e7	Fixed Test Report	\N	inventory	{}	{}	\N	\N	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:03:50.748917+05:30	2026-05-02 18:03:50.748917+05:30
e2b258d4-bad4-4c34-98f3-82cadeac4657	Browser Created Report	\N	payment	{}	{}	\N	\N	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 18:04:26.693734+05:30	2026-05-02 18:04:26.693734+05:30
\.


--
-- Data for Name: demands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.demands (id, payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, days_until_due, generated_at, sent_via, delivery_status, sent_at, delivered_at, read_at, tax_slab_id, cgst_amount, sgst_amount, status, demand_type, raised_at, raised_by, updated_at, created_at) FROM stdin;
f0000000-0000-0000-0000-000000000001	a2000000-0000-0000-0000-000000000001	1	d0000000-0000-0000-0000-000000000001	2026-04-26	125000	\N	2026-05-01 10:23:33.017741+05:30	\N	sent	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-01 17:50:25.30456+05:30	2026-05-01 17:50:25.305831+05:30
f0000000-0000-0000-0000-000000000002	a2000000-0000-0000-0000-000000000002	1	d0000000-0000-0000-0000-000000000002	2026-04-21	85400	\N	2026-05-01 10:23:33.017741+05:30	\N	sent	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-01 17:50:25.30456+05:30	2026-05-01 17:50:25.305831+05:30
867a729c-3672-4d54-bfa7-0c06488e3e16	e4a96f26-93bf-4225-a3b7-5854ba540e5a	4	e80b1a86-f98b-475b-b769-a620f86ef26f	2026-04-02	437500	\N	2026-05-02 17:55:57.125296+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.125296+05:30	2026-05-02 17:55:57.125296+05:30
5549f960-f592-419e-a778-1acc47fc4b72	abb9789a-730a-40db-98d4-234036e7f0bc	4	dccdc164-b2d6-472d-804c-711ff66ecf32	2026-04-02	437500	\N	2026-05-02 17:55:57.127925+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.127925+05:30	2026-05-02 17:55:57.127925+05:30
30d3938b-3f05-4051-a0ff-70e7d04e6c90	882ece5e-960a-4b4d-b727-e7d94db5a3d1	4	595ee972-df8f-41b2-9f9d-b31220ee462b	2026-04-02	437500	\N	2026-05-02 17:55:57.130759+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.130759+05:30	2026-05-02 17:55:57.130759+05:30
625bff52-d764-40a6-802f-fd3dbd5d07c5	3e05ef55-b423-4335-bb20-35e0d64548e9	4	f43c8424-9983-440f-8093-fe30acd7b756	2026-04-02	437500	\N	2026-05-02 17:55:57.133647+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.133647+05:30	2026-05-02 17:55:57.133647+05:30
bd8f3932-1718-45f7-b6ac-3e09ed62d3a8	63567fe7-f498-499a-a518-d8c78df50f23	4	223abf20-2bf2-4332-aa59-0db5eeace7f5	2026-04-02	437500	\N	2026-05-02 17:55:57.136994+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.136994+05:30	2026-05-02 17:55:57.136994+05:30
5c888ea4-6399-4a93-a353-90f6a7685afe	466867d9-efa9-43d7-9192-41aef19d6d6e	4	4152814f-a12c-44be-9ccd-40e18069a7ba	2026-04-02	437500	\N	2026-05-02 17:55:57.139698+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.139698+05:30	2026-05-02 17:55:57.139698+05:30
ee1c781a-830a-4849-aa48-7703d819cc84	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	4	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	2026-04-02	437500	\N	2026-05-02 17:55:57.142913+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.142913+05:30	2026-05-02 17:55:57.142913+05:30
bc18d411-771a-4ced-a9dc-ccdabcb3734a	f5b2ae92-eb8b-4618-beec-31d583ad9463	4	7f823bf9-a429-4719-a175-070d4b1d0900	2026-04-02	437500	\N	2026-05-02 17:55:57.144946+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.144946+05:30	2026-05-02 17:55:57.144946+05:30
ed5f434e-c12d-48c1-90aa-e54318cfe786	5e90ed90-484f-4107-9c10-29eb14af86f2	4	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	2026-04-02	437500	\N	2026-05-02 17:55:57.147074+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.147074+05:30	2026-05-02 17:55:57.147074+05:30
2816472a-aba6-4b13-b7cd-d319f575b137	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	4	5f5b341c-7f18-44fe-97cc-04205c3b1201	2026-04-02	437500	\N	2026-05-02 17:55:57.149161+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.149161+05:30	2026-05-02 17:55:57.149161+05:30
6abff260-2bfc-486a-934a-a704ce8f86f9	9ed62614-52e0-4646-8d91-5db1315e9bfe	4	0745814d-4302-4e64-ba13-c9201f12b39e	2026-04-02	437500	\N	2026-05-02 17:55:57.151318+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.151318+05:30	2026-05-02 17:55:57.151318+05:30
d8462191-d981-4e8a-bcef-cbb08497f3e8	8335d296-fd14-4e05-ac91-9e3eb8d96065	4	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	2026-04-02	437500	\N	2026-05-02 17:55:57.153364+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.153364+05:30	2026-05-02 17:55:57.153364+05:30
1d5c5951-3fc6-4645-a2fc-7f75e10b48ec	f49004ce-9937-41b1-b214-01b95284d84c	4	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	2026-04-02	437500	\N	2026-05-02 17:55:57.157335+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.157335+05:30	2026-05-02 17:55:57.157335+05:30
6f9de6ad-7543-4a2a-9d94-29a8a5a8dc28	6af45069-bcbe-4a42-904a-2390ac4162c0	4	78b750fd-aabd-4261-ac34-1cc5d075b8e4	2026-04-02	437500	\N	2026-05-02 17:55:57.159849+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.159849+05:30	2026-05-02 17:55:57.159849+05:30
9924d5ed-e323-4e6f-9a12-b8e3cc269c0c	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	4	155ba700-8d2e-4870-8706-58b86bfe1acb	2026-04-02	437500	\N	2026-05-02 17:55:57.163133+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.163133+05:30	2026-05-02 17:55:57.163133+05:30
7cc59f04-c838-40fe-9b24-17c706570cba	f990d8b1-24f4-47b6-9e90-26d5000edf2f	4	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	2026-04-02	437500	\N	2026-05-02 17:55:57.1658+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.1658+05:30	2026-05-02 17:55:57.1658+05:30
05603098-5416-4240-882f-6bc836aae086	90d93ba2-a692-4310-b041-85a9d0c62218	4	2c402c76-d75e-4867-b8f6-57eea5df59f5	2026-04-02	437500	\N	2026-05-02 17:55:57.168316+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.168316+05:30	2026-05-02 17:55:57.168316+05:30
e3082e67-71b9-4b67-b43d-e0dbfca16672	02a6ec05-765e-4a37-92e3-507ebc424ae5	4	0ca11d19-3fb3-48e3-b038-b64c1f050d22	2026-04-02	437500	\N	2026-05-02 17:55:57.171317+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.171317+05:30	2026-05-02 17:55:57.171317+05:30
511fca25-ff1d-4711-a3cb-dbb793870835	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	4	26dece45-7e64-4f12-8695-169443d725fa	2026-04-02	437500	\N	2026-05-02 17:55:57.173949+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.173949+05:30	2026-05-02 17:55:57.173949+05:30
21ec18c3-018e-4980-98dd-34b4110a1802	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	4	da038407-ad69-4a16-83d8-20c51a2acc1f	2026-04-02	437500	\N	2026-05-02 17:55:57.176304+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.176304+05:30	2026-05-02 17:55:57.176304+05:30
df0dc4b0-ddb3-4c10-8002-1479b93bd020	c75c47b7-f19d-43aa-851b-ac037dc60633	4	36b736ff-deb8-417f-871f-70e5b22dd625	2026-04-02	437500	\N	2026-05-02 17:55:57.179355+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.179355+05:30	2026-05-02 17:55:57.179355+05:30
72ccc19a-fb10-421a-9ad2-267307b3279d	6fc82a50-2ec0-46a1-aaec-718130518126	4	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	2026-04-02	437500	\N	2026-05-02 17:55:57.182476+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.182476+05:30	2026-05-02 17:55:57.182476+05:30
0722992f-8b0d-4ce9-9ad8-2e7f54867ad4	551de9ea-a8fc-4589-9d16-c24e82963df7	4	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	2026-04-02	437500	\N	2026-05-02 17:55:57.185511+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.185511+05:30	2026-05-02 17:55:57.185511+05:30
0a1fb3ed-5f5b-4746-977a-dfd3319be002	52df20b9-a5ac-4847-b816-bfd113daadf2	4	91fcbe12-96b5-44fc-b028-d3c6e73238de	2026-04-02	437500	\N	2026-05-02 17:55:57.188803+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.188803+05:30	2026-05-02 17:55:57.188803+05:30
c8fc3236-0708-4943-b659-d8495b681730	6e4fe697-23da-40cb-bc5d-607360878fca	4	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	2026-04-02	437500	\N	2026-05-02 17:55:57.191815+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.191815+05:30	2026-05-02 17:55:57.191815+05:30
9c9705c2-6950-4e35-b7ec-a9df37a0f0fa	6f27ee05-ff3d-424b-a244-ebcc2757cdff	4	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	2026-04-02	437500	\N	2026-05-02 17:55:57.194609+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.194609+05:30	2026-05-02 17:55:57.194609+05:30
fa2ba270-e0fe-4172-847c-7e9f22c51824	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	4	d645a156-8347-48a5-83eb-3992ab61d433	2026-04-02	437500	\N	2026-05-02 17:55:57.197381+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.197381+05:30	2026-05-02 17:55:57.197381+05:30
aa4892f6-1a28-4e86-8337-42c1fe69f818	3ef512de-0246-4ddb-8099-b4341f3ec492	4	56d25496-173d-4ecd-bfa2-27781316d4c0	2026-04-02	437500	\N	2026-05-02 17:55:57.20054+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.20054+05:30	2026-05-02 17:55:57.20054+05:30
9600d8b2-7aa8-4901-a28d-7e5123e2f9d3	b6f82e67-3c41-486a-8009-c9b7ee2e46af	4	aef03bae-eab0-4632-ba93-5ce01a16a1fc	2026-04-02	437500	\N	2026-05-02 17:55:57.203405+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.203405+05:30	2026-05-02 17:55:57.203405+05:30
cf4d23d1-e123-4072-baed-29e8e2796e75	2f887aa0-2926-41a2-83bf-0fca6b7697fe	4	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	2026-04-02	437500	\N	2026-05-02 17:55:57.206106+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.206106+05:30	2026-05-02 17:55:57.206106+05:30
f79c34b1-b86b-47a3-8d6e-dbd6bb466f2a	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	4	ec6dda75-549b-4e80-a25e-38490c0b3d4d	2026-04-02	437500	\N	2026-05-02 17:55:57.209077+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.209077+05:30	2026-05-02 17:55:57.209077+05:30
1e67f5f6-d864-4d60-bd93-9b9fd3990d10	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	4	e19ed374-a7fb-467d-92ee-581c7224d42a	2026-04-02	437500	\N	2026-05-02 17:55:57.212692+05:30	\N	queued	\N	\N	\N	\N	0.00	0.00	pending	\N	\N	\N	2026-05-02 17:55:57.212692+05:30	2026-05-02 17:55:57.212692+05:30
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, description, head_user_id, is_active, created_by, created_at, updated_at) FROM stdin;
54673bf9-5dd4-486c-963a-7e23ae2aa83d	Sales	Sales and pre-sales team	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
c2ae4f50-7556-41d5-a1c9-170e3c8a488b	Accounts	Accounts and finance team	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
3c1e77b8-e47c-4829-bf54-7cdf08dad6a3	Operations	Operations and project delivery	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
7ea262b7-659f-4ab0-92ac-1dd4a1eecaf4	CRM	Customer relationship management	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
0a7a68ae-11ef-4314-9b9f-37c7b5b9c020	Legal	Legal and documentation	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
1c66d5f0-a141-4ae4-b665-ecbaddb52363	Marketing	Marketing and campaigns	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
4ac24572-e07c-480b-b988-48c1683f2cba	Administration	HR and administration	\N	t	\N	2026-04-30 17:17:49.248553+05:30	2026-04-30 17:17:49.248553+05:30
\.


--
-- Data for Name: document_dispatch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_dispatch (id, document_type, dispatch_mode, tracking_no, consumer_id, dispatched_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: document_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_templates (id, project_id, document_type, name, body_html, merge_fields, created_by_user_id, created_at, updated_at, version_number) FROM stdin;
\.


--
-- Data for Name: document_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_types (id, name, category, description, created_at) FROM stdin;
d174be7e-15aa-4f42-aabd-ae2a459b6fa0	Allotment Letter	allotment	Official unit allotment letter	2026-04-30 16:47:58.899931+05:30
7336ac18-46ed-4fd2-8568-bd6fb0b18b22	Demand Letter	payment	Payment demand notice	2026-04-30 16:47:58.906493+05:30
271d1ff1-344c-4aac-b419-069ad13f355b	Payment Receipt	payment	Payment receipt acknowledgement	2026-04-30 16:47:58.907181+05:30
99911c5e-ed83-4074-8cff-5372eca3c81c	Buyer-Builder Agreement	legal	BBA Sale Agreement	2026-04-30 16:47:58.907667+05:30
211298a0-c34c-4984-a19f-1609545e69e8	No Objection Certificate	legal	NOC for property transfer	2026-04-30 16:47:58.908147+05:30
5ec62d99-7c7a-4b03-a584-d3340364b04e	Possession Letter	possession	Unit possession handover letter	2026-04-30 16:47:58.908658+05:30
f4469b37-0cf0-49f4-9aab-3afa61e422ed	Cancellation Letter	legal	Allotment cancellation letter	2026-04-30 16:47:58.909301+05:30
ca4b237c-e24e-4a8a-b0df-3799de3a4a9a	Welcome Letter	onboarding	Welcome letter for new allottees	2026-04-30 16:47:58.910092+05:30
e926e3fd-92b8-4a81-a9e7-7680b7225be9	KYC Document	kyc	Know Your Customer identity document	2026-04-30 16:47:58.910562+05:30
1385d8cf-b7fc-4dba-9aaf-b03afa4d1f86	Income Certificate	kyc	Income proof document	2026-04-30 16:47:58.911527+05:30
524025da-f06a-4621-b01b-f98cf4628173	Aadhaar Card	kyc	Government ID Aadhaar	2026-04-30 16:47:58.912135+05:30
40a796e5-13a6-4107-8330-853c6c1ac285	PAN Card	kyc	Permanent Account Number card	2026-04-30 16:47:58.912483+05:30
1a2b867e-a51d-44ba-a44e-e1b038e27fce	Affidavit	kyc	Self-declaration affidavit	2026-04-30 16:47:58.912965+05:30
4d6fd6b3-04b4-4abc-83ad-e9ecbd0e7547	Bank Statement	financial	Bank account statement	2026-04-30 16:47:58.913314+05:30
43940ec2-2769-418d-a1e1-e1c79f3e266d	Photograph	kyc	Passport size photograph	2026-04-30 16:47:58.913646+05:30
\.


--
-- Data for Name: document_vault; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_vault (id, consumer_id, allocation_id, document_category, file_url, file_name, uploaded_by_user_id, created_at, folder_id) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, consumer_id, allocation_id, template_id, document_type, html_content, delivery_method, delivery_status, created_by_user_id, created_at, sent_at, sent_by_user_id, deleted_at, deleted_by_user_id) FROM stdin;
\.


--
-- Data for Name: draw_refunds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.draw_refunds (id, consumer_id, project_id, draw_result, booking_amount_paid_inr, refund_amount_inr, refund_due_by, refund_status, refund_initiated_at, refund_completed_at, refund_reference, notes, created_by_user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emails (id, consumer_id, user_id, from_email, to_email, subject, body, sent_at, opened_at, clicked_at) FROM stdin;
\.


--
-- Data for Name: employee_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee_profiles (id, user_id, department_id, employee_code, designation, joining_date, salary_grade, manager_id, mobile_office, mobile_personal, emergency_contact, address, city, state, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: faq_articles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.faq_articles (id, category_id, title, content, tags, is_published, view_count, helpful_count, not_helpful_count, created_by_user_id, updated_by_user_id, created_at, updated_at) FROM stdin;
aa4d3054-15a7-4a94-9981-9f8c197898ae	5e8709cd-3c44-4273-adc1-1b08a01b661e	What happens if a customer misses an instalment?	# Missed Instalment Policy\n\nMissing an instalment can have serious consequences for both the buyer and their allotment.\n\n## Immediate Actions (Days 1-7):\n1. Demand letter is automatically sent\n2. Email notification sent to customer\n3. WhatsApp reminder sent to customer mobile\n4. No penalties applied yet\n\n## Follow-up Actions (Days 8-15):\n1. Second demand letter sent (marked as "Final Notice")\n2. Escalation to Project Manager\n3. Customer support team reaches out directly\n4. HRERA penal interest starts accumulating\n\n## Consequences (After 15 Days):\n1. Penal interest calculated per HRERA Rule 15 (11.10% p.a.)\n2. Allotment may be flagged for cancellation review\n3. Customer can be blacklisted for future projects\n4. Legal notice may be issued\n\n## Customer Options:\n- **Pay in Full**: Clears all arrears and interest\n- **Negotiate Payment Plan**: Discuss with Project Manager for EMI arrangement\n- **Surrender**: Forfeit ₹25,000 + 18% GST = ₹29,500; remaining amount refunded\n\n## Best Practice:\nContact customers proactively 7-10 days before due date to avoid issues.\n	{payment,missed,overdue,consequences}	t	0	0	0	\N	\N	2026-04-28 05:45:29.367107+05:30	2026-04-28 05:45:29.367107+05:30
d29a487e-0336-4be6-8bb8-6a4551febcdf	7fe5d5a3-aac3-4abe-b8bc-12b0c891aa1b	What is the e-draw process and how are results imported?	# E-Draw Process & Results Import\n\nThe e-draw (electronic draw/lottery) is conducted by TCP Haryana to allocate AHP units transparently.\n\n## E-Draw Timeline:\n1. **Applicants Register**: Buyers submit application on edraw.tcpharyana.gov.in\n2. **Government Conducts Draw**: Automated, video-recorded lottery by TCP\n3. **Results Published**: Government releases results (Allotted, Waitlist, Unsuccessful)\n4. **ROF Downloads**: ROF downloads CSV/Excel from TCP portal\n5. **CRM Import**: Results imported into ROF CRM system\n\n## Import Process in CRM:\n1. Go to **Allocations > Import E-Draw Results**\n2. Upload CSV/Excel file from TCP Haryana portal\n3. System matches applicants by Aadhaar hash\n4. Matched applicants auto-advance to "Draw Entered" stage\n5. Mismatches flagged for manual review\n\n## CSV File Format:\nThe file should contain columns:\n- Applicant ID (or Aadhaar)\n- Name\n- Unit Type (BHK) preference\n- Result (Allotted / Waitlist / Unsuccessful)\n\n## Matching Logic:\n- System hashes the Aadhaar in the CSV file\n- Compares against hashed Aadhaar in consumer records\n- Only matches within the same project\n\n## Common Issues:\n| Issue | Solution |\n|-------|----------|\n| "Applicant not found" | Check if applicant was already registered in CRM |\n| Multiple matches | Happens if same Aadhaar has duplicate records; merge consumer records first |\n| Import fails | Ensure CSV format matches; re-download fresh file from TCP |\n\n## After Import:\n- Next step: Allotment creation for "Allotted" results\n- Waitlisted applicants wait for cancellation\n- Unsuccessful applicants should be refunded (outside CRM)\n	{e-draw,import,allocation,tcp}	t	0	0	0	\N	\N	2026-04-28 05:45:29.367542+05:30	2026-04-28 05:45:29.367542+05:30
51ebab29-f0cf-4609-bf01-07db76d435af	7fe5d5a3-aac3-4abe-b8bc-12b0c891aa1b	How does the waitlist promotion work?	# Waitlist Promotion Process\n\nWhen an allotted unit is cancelled or the buyer defaults, the next waitlisted customer is automatically promoted.\n\n## Automatic Promotion:\n1. Original allottee cancels or defaults\n2. CRM searches for next waitlist candidate with same BHK type in same project\n3. Candidate is automatically promoted to allotment\n4. Unit reassigned to new allottee\n5. Payment plan created; welcome letter sent\n\n## Manual Promotion:\nIn some cases, ROF may manually select a waitlist candidate:\n1. Go to **Allocations > Waitlist**\n2. Select candidate to promote\n3. Choose available unit of same type\n4. System validates match and creates allotment\n5. New customer notified\n\n## Candidate Selection:\nWaitlist is ordered by:\n1. Registration date (FIFO)\n2. BHK type preference\n3. Project preference\n4. Income category (if applicable)\n\n## Customer Communication:\n- Promotion letter sent via email + WhatsApp\n- Payment plan details shared\n- Welcome onboarding call scheduled\n- First instalment due within 15 days\n\n## Tracking:\n- Waitlist position visible in CRM\n- Promotion date recorded in remarks\n- Customer journey reflects: Waitlist → Allotted → Onboarded\n	{waitlist,promotion,cancellation,default}	t	0	0	0	\N	\N	2026-04-28 05:45:29.36799+05:30	2026-04-28 05:45:29.36799+05:30
7d5d2d2d-b9c0-4fc8-994a-9bf8f51574f4	a3b88539-ee31-40a5-9eba-369725a679c0	How do I generate a demand letter for a customer?	# Generating Demand Letters\n\nDemand letters notify customers about upcoming or overdue payments.\n\n## Types of Demand Letters:\n1. **Pre-Due Reminder** (15 days before): Gentle reminder\n2. **Pre-Due Notice** (7 days before): More formal\n3. **Demand Letter** (On due date): Official demand\n4. **Overdue Notice** (3+ days late): Urgent notice with interest calculation\n\n## Steps to Generate:\n1. Go to **Payments > Demand Letters**\n2. Filter by:\n   - Project\n   - Payment Plan\n   - Due date range\n3. Select customers needing letters\n4. Choose template (or custom)\n5. Review merge fields (names, amounts, dates auto-populate)\n6. Generate PDF or send directly\n7. Delivery method: Email, WhatsApp, Print\n\n## Automatic Generation:\n- 15-day pre-due reminder: Auto-generated, manual review before send\n- 7-day pre-due notice: Auto-generated, manual review before send\n- On due date: Auto-generated, sent automatically via email\n- Overdue notices: Triggered manually or by sales manager escalation\n\n## Template Fields:\nDemand letters include auto-populated fields:\n- Customer name & contact\n- Payment plan details\n- Instalment number and amount\n- Due date\n- HRERA penal interest (if overdue)\n- Bank account details for payment\n- Reference number\n\n## Sending:\n- Check delivery status (Sent, Delivered, Read)\n- Re-send if delivery fails\n- Confirm in remarks log when sent\n	{demand,letter,template,payment}	t	0	0	0	\N	\N	2026-04-28 05:45:29.368407+05:30	2026-04-28 05:45:29.368407+05:30
9dce3946-aca1-4665-9e70-852ca00b18ee	5e8709cd-3c44-4273-adc1-1b08a01b661e	How is penal interest calculated under HRERA Rule 15?	# HRERA Rule 15: Penal Interest Calculation\n\nWhen a buyer misses a payment deadline, ROF applies penal interest per HRERA Rule 15.\n\n## Formula:\nInterest = Principal × Rate × Time / 100\n\n## Parameters:\n- **Principal**: The overdue amount in INR\n- **Rate**: 11.10% per annum (SBI MCLR + 2%)\n- **Time**: Number of days overdue / 365\n\n## Example:\nIf a buyer owes ₹10,00,000 and is 30 days overdue:\nInterest = 10,00,000 × 11.10 × (30/365) / 100\nInterest ≈ ₹9,123\n\n## Key Points:\n- Interest is calculated daily\n- The CRM automatically calculates this on the Overdue Demands report\n- ROF must communicate the penal interest amount when sending overdue notices\n- Buyers have the right to dispute excessive interest if they believe it violates HRERA guidelines\n	{HRERA,interest,overdue,calculations}	t	4	1	0	\N	\N	2026-04-28 05:45:29.361034+05:30	2026-04-28 05:45:29.361034+05:30
51f84792-ba94-4b74-8021-8ca9e4f26ccd	a3b88539-ee31-40a5-9eba-369725a679c0	What documents are needed for a No Objection Certificate (NOC)?	# No Objection Certificate (NOC) Requirements\n\nA No Objection Certificate is required before a buyer can register their property with the government.\n\n## What is an NOC?\nAn NOC from ROF confirms that:\n- All payments have been made in full\n- No dues are outstanding\n- The buyer is in good standing\n- Property transfer is authorized\n\n## When is NOC Needed?\n- Before property registration\n- For property mutation\n- For loan disbursement (if buyer taking mortgage)\n- For resale (if buyer selling to another party)\n\n## Documents Required from Buyer:\n1. **Allotment Letter** (Original)\n2. **Buyer-Builder Agreement (BBA)** (Signed copy)\n3. **All Payment Receipts** (Complete payment history)\n4. **Possession Letter** (From ROF)\n5. **NOC Application Form** (Provided by ROF)\n6. **Identity Proof** (Copy)\n7. **Address Proof** (Copy)\n\n## ROF's Verification Process:\n1. Customer submits documents\n2. Finance team verifies all payments complete\n3. Legal team reviews BBA and possession status\n4. Compliance check against RERA/HRERA\n5. Approval and NOC issuance (2-3 working days)\n\n## NOC Generation in CRM:\n1. Go to **Documents > NOC Requests**\n2. Search customer by name/ID\n3. System auto-checks: All payments done? Yes/No\n4. If Yes: Auto-generate NOC with signature block\n5. If No: Show outstanding amount; flag for follow-up\n6. Send to customer via email + WhatsApp\n7. Track delivery status\n\n## Common Rejections:\n| Issue | Cause | Solution |\n|-------|-------|----------|\n| NOC Denied | Outstanding payment | Clear dues; reapply |\n| NOC Delayed | Missing documents | Submit all required docs |\n| NOC Verification Failed | BBA not signed | Obtain signed copy |\n\n## Timeline:\n- Application to NOC: 3-5 working days\n- Registration with government: 7-15 days (depends on local authorities)\n	{NOC,certificate,documents,registration}	t	0	0	0	\N	\N	2026-04-28 05:45:29.368954+05:30	2026-04-28 05:45:29.368954+05:30
80cc623f-ac31-463a-8918-eb015eab1ae7	6dedc57d-673a-4b17-9d5d-0c14bbd6f01f	What is the one-application-per-family rule?	# One-Application-Per-Family Rule (AHP Compliance)\n\nThis is a government mandate under Haryana AHP to prevent fraud and ensure fair allocation.\n\n## The Rule:\n**Only ONE member of a family can hold an active allotment in a single AHP project at any point in time.**\n\n## What is "Family"?\nDefined by the Parivar Pehchan Patra (PPP), which is:\n- Haryana Family ID card\n- Used to identify household members\n- Mandatory for AHP applications\n\n## Enforcement in CRM:\n1. When a consumer is created with a PPP, CRM checks for duplicates\n2. If another family member has an active allotment in same project → **Rejected**\n3. Error message: "DUPLICATE_FAMILY_APPLICATION"\n4. Suggestion: Add as co-applicant instead, or wait for first allotment to complete\n\n## Examples:\n\n| Scenario | Allowed? | Why |\n|----------|----------|-----|\n| Father and son apply for same project | No | Same family, same project |\n| Father applies for Project A; son for Project B | Yes | Different projects |\n| Father allotted; mother cancels; mother reapplies | Yes | After cancellation, rule resets |\n| Co-applicant added to existing allotment | Yes | Co-applicants share one allotment |\n\n## Co-Applicant Strategy:\nInstead of separate applications, use:\n1. **Primary Applicant**: Main buyer (e.g., Father)\n2. **Co-Applicants**: Family members (e.g., Wife, Adult Son)\n- Only one allotment for the family\n- Stronger application (combined income)\n- Benefits shared among family\n\n## CRM Implementation:\n- Parivar Pehchan Patra field in consumer profile\n- Unique index on (ppp, project_id, lead_stage) excluding cancelled\n- System validation prevents creation of duplicate applications\n- Manual override available to Super Admin (with audit log)\n\n## What Happens if Duplicate Detected?\n1. Second application rejected at creation\n2. Error message shown: "A member of this family already has an active application"\n3. First application link provided for reference\n4. Suggestion: Contact Project Manager to discuss options\n	{one-family,AHP,PPP,rule,duplicate}	t	0	0	0	\N	\N	2026-04-28 05:45:29.36977+05:30	2026-04-28 05:45:29.36977+05:30
37ce64e6-1929-4156-836b-364216c60c68	6dedc57d-673a-4b17-9d5d-0c14bbd6f01f	What are the cancellation and forfeiture rules under AHP?	# Cancellation and Forfeiture Policy\n\nWhen an allottee cancels or defaults, ROF applies forfeiture and refund rules per AHP guidelines.\n\n## Forfeiture Amount:\n**₹25,000 + 18% GST = ₹29,500**\n\nThis is deducted from all payments received by the buyer.\n\n## When Cancellation Happens:\n1. **Buyer Requests**: Written cancellation request\n2. **Default**: Buyer misses payment for 60+ days; ROF initiates\n3. **ROF Initiates**: Due to policy violation or government mandate\n\n## Refund Calculation:\n```\nRefund = Total Payments Received - ₹29,500 (forfeiture)\n```\n\n## Example:\n| Item | Amount |\n|------|--------|\n| Total payments received | ₹50,00,000 |\n| Forfeiture | -₹29,500 |\n| **Refund** | **₹49,70,500** |\n\n## Timeline:\n1. **Cancellation approved**: Recorded in CRM\n2. **Forfeiture deducted**: Automatically calculated\n3. **Refund initiated**: Finance team processes (5-7 days)\n4. **Bank transfer**: Sent to buyer's registered bank account\n5. **Confirmation**: Email + WhatsApp sent to buyer\n\n## Waitlist Promotion:\n- Upon cancellation, unit becomes available\n- Next waitlisted customer with same BHK type automatically promoted\n- If no waitlist candidate, unit returned to "Available" status\n\n## HRERA Compliance:\n- Forfeiture amount capped by HRERA guidelines\n- ROF cannot forfeit more than 10% of transaction value (or ₹29,500, whichever is lower)\n- Refund must be processed within 30 days\n- If refund delayed beyond 30 days: 10% annual interest applies\n\n## CRM Workflow:\n1. Go to **Allocations > Cancel**\n2. Provide cancellation reason\n3. System calculates forfeiture and refund\n4. Create cancellation record\n5. Send cancellation letter + refund notification\n6. Promote waitlist candidate (auto or manual)\n7. Record in remarks log\n\n## What Buyer Needs to Know:\n- Cancellation reason (voluntary vs default)\n- Forfeiture amount\n- Refund amount\n- Bank details for transfer\n- Timeline for refund\n- Impact on future applications (may be blacklisted)\n	{cancellation,forfeiture,refund,default,AHP}	t	0	0	0	\N	\N	2026-04-28 05:45:29.370318+05:30	2026-04-28 05:45:29.370318+05:30
a3bbc728-5305-43e5-9f8b-ad9ecb1ff962	a3b88539-ee31-40a5-9eba-369725a679c0	Test Article	Test content	{test}	f	0	0	0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	2026-04-28 09:15:56.135479+05:30	2026-04-28 09:15:56.135479+05:30
\.


--
-- Data for Name: faq_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.faq_categories (id, name, description, sort_order, is_active, created_by_user_id, created_at) FROM stdin;
5e8709cd-3c44-4273-adc1-1b08a01b661e	Payment Queries	Questions about payment calculations, HRERA penal interest, and instalment schedules	1	t	\N	2026-04-28 05:45:29.360246+05:30
7fe5d5a3-aac3-4abe-b8bc-12b0c891aa1b	Allotment Process	E-draw results, allotment letters, waitlist management, and cancellations	2	t	\N	2026-04-28 05:45:29.360246+05:30
a3b88539-ee31-40a5-9eba-369725a679c0	Document Requests	Document generation, demand letters, receipts, and agreements	3	t	\N	2026-04-28 05:45:29.360246+05:30
6dedc57d-673a-4b17-9d5d-0c14bbd6f01f	Policy & Rules	AHP compliance, one-application-per-family rule, and ROF policies	4	t	\N	2026-04-28 05:45:29.360246+05:30
\.


--
-- Data for Name: floors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.floors (id, tower_id, floor_number, floor_name, created_at) FROM stdin;
\.


--
-- Data for Name: global_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.global_settings (key, value, description, updated_at) FROM stdin;
penal_interest_rate_percent	15.0	Annual interest rate for late payments (Legacy standard)	2026-05-01 02:49:44.720072+05:30
\.


--
-- Data for Name: gst_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gst_invoices (id, invoice_no, invoice_date, invoice_type, project_id, consumer_id, unit_id, payment_plan_id, installment_name, base_amount_inr, taxable_amount_inr, cgst_rate, sgst_rate, igst_rate, cgst_amount_inr, sgst_amount_inr, igst_amount_inr, total_amount_inr, supply_type, place_of_supply, hsn_sac_code, status, cancelled_at, cancelled_reason, linked_invoice_id, created_by_user_id, created_at, updated_at) FROM stdin;
eb03b143-dd73-4eaa-a2d0-fe7b4d5dca23	INV/2026/00001	2026-05-02	tax_invoice	a0000000-0000-0000-0000-000000000001	e80b1a86-f98b-475b-b769-a620f86ef26f	\N	\N	\N	100000.00	0.00	2.50	2.50	0.00	2500.00	2500.00	0.00	105000.00	intrastate	\N	\N	issued	\N	\N	\N	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:09:14.77739+05:30	2026-05-02 22:09:14.77739+05:30
db1f39ce-39ef-4f8d-9f81-4062b4449bd6	INV/2026/00002	2026-05-02	tax_invoice	a0000000-0000-0000-0000-000000000001	e80b1a86-f98b-475b-b769-a620f86ef26f	\N	\N	\N	50000.00	0.00	2.50	2.50	0.00	1250.00	1250.00	0.00	52500.00	intrastate	\N	\N	reversed	\N	\N	\N	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 22:44:24.364112+05:30	2026-05-02 22:44:31.852493+05:30
\.


--
-- Data for Name: gst_process_rights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gst_process_rights (id, user_id, can_generate, can_cancel, can_reverse, can_manual, updated_at) FROM stdin;
\.


--
-- Data for Name: head_wise_costs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.head_wise_costs (id, booking_form_id, cost_head, amount_inr, description, created_at) FROM stdin;
\.


--
-- Data for Name: import_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.import_history (id, file_name, import_type, total_rows, created_rows, skipped_rows, error_rows, status, errors, imported_by, created_at) FROM stdin;
\.


--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_entries (id, entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks, approved_by, status, created_at) FROM stdin;
5ca805c2-6ad9-43ad-963e-c25ebcceaea6	JE-2026-0001	2026-05-02	\N	10000.00	10000.00	Waiver	Test journal entry with matching debit/credit	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	pending	2026-05-02 21:02:40.313715+05:30
\.


--
-- Data for Name: kyc_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kyc_documents (id, consumer_id, document_type, file_url, expiry_date, uploaded_at, uploaded_by_user_id, verified) FROM stdin;
\.


--
-- Data for Name: loan_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loan_details (id, consumer_id, bank_name, branch_name, loan_amount, sanction_letter_date, tpa_signed_date, loan_status, disbursement_percentage, bank_contact_person, bank_contact_mobile, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nationalities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nationalities (id, name, created_at) FROM stdin;
6537e3f9-094c-4a29-9cba-f4d724920e26	Indian	2026-04-30 02:30:21.682923+05:30
68f04351-9ade-4b5e-91e8-f93cbd8571fa	NRI	2026-04-30 02:30:21.682923+05:30
67599a1b-a0c2-4b9d-b2ed-95e60099f3a9	OCI	2026-04-30 02:30:21.682923+05:30
da87db65-7c18-4bd2-9986-1244f0eed3d1	Foreign National	2026-04-30 02:30:21.682923+05:30
\.


--
-- Data for Name: ownership_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ownership_transfers (id, unit_id, old_consumer_id, new_consumer_id, transfer_date, transfer_fee_inr, admin_charges_inr, approval_status, transfer_remarks, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: parking_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parking_slots (id, project_id, slot_number, parking_type, floor, status, allotted_to_consumer_id, allotted_unit_id, amount_inr, allotted_at, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: parking_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parking_types (id, name, description, is_active, created_at) FROM stdin;
44589935-2cb1-4e98-9892-f2f5e1eebc6d	Car Parking	\N	t	2026-04-30 17:17:49.224138+05:30
adc81fae-d4c4-4537-81d3-e236db181a57	Scooter Parking	\N	t	2026-04-30 17:17:49.224138+05:30
add807ca-91d2-416e-8282-e3d373be17af	Bike Parking	\N	t	2026-04-30 17:17:49.224138+05:30
a885375a-8e45-466e-aca1-f088ff922e47	Car Parking	\N	t	2026-04-30 18:41:10.431718+05:30
bd03ea73-473d-49ea-9c9f-038532b65c7e	Scooter Parking	\N	t	2026-04-30 18:41:10.431718+05:30
5aff6fe2-3e58-4b3e-84f8-9cc347fefd37	Bike Parking	\N	t	2026-04-30 18:41:10.431718+05:30
5a4bb2d8-bb63-4a39-b08a-9b2924599b51	Car Parking	\N	t	2026-04-30 18:41:42.971573+05:30
c8552f77-25e9-439a-b396-76bbc477e666	Scooter Parking	\N	t	2026-04-30 18:41:42.971573+05:30
0d32c8bc-f869-492d-8baa-63e29d4ad16f	Bike Parking	\N	t	2026-04-30 18:41:42.971573+05:30
\.


--
-- Data for Name: payment_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_plans (id, allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_at, created_by_user_id, updated_at) FROM stdin;
a2000000-0000-0000-0000-000000000001	a1000000-0000-0000-0000-000000000001	d0000000-0000-0000-0000-000000000001	c0000000-0000-0000-0000-000000000020	a0000000-0000-0000-0000-000000000002	6000000	2026-05-01 10:23:33.015466+05:30	\N	2026-05-01 17:50:25.312724+05:30
a2000000-0000-0000-0000-000000000002	a1000000-0000-0000-0000-000000000002	d0000000-0000-0000-0000-000000000002	c0000000-0000-0000-0000-000000000021	a0000000-0000-0000-0000-000000000002	6000000	2026-05-01 10:23:33.015466+05:30	\N	2026-05-01 17:50:25.312724+05:30
e4a96f26-93bf-4225-a3b7-5854ba540e5a	b0ec4fbc-b226-411d-a5d8-f8dab8de9698	e80b1a86-f98b-475b-b769-a620f86ef26f	6c7248f3-e2b9-49d0-85bb-364c1991ed08	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.119205+05:30	\N	2026-05-02 17:55:57.119205+05:30
abb9789a-730a-40db-98d4-234036e7f0bc	e1533164-9d68-4716-a2a1-60134268474c	dccdc164-b2d6-472d-804c-711ff66ecf32	be8f73ba-c527-46f9-a4ee-a1409a86a289	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.126115+05:30	\N	2026-05-02 17:55:57.126115+05:30
882ece5e-960a-4b4d-b727-e7d94db5a3d1	7e1b7024-eedd-4ea5-9d30-fc1a07e44fbe	595ee972-df8f-41b2-9f9d-b31220ee462b	0687f0bd-dd4c-4e13-b029-fe03a1d335aa	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.128573+05:30	\N	2026-05-02 17:55:57.128573+05:30
3e05ef55-b423-4335-bb20-35e0d64548e9	6d23b1e0-9658-45dd-b366-94bcaf731323	f43c8424-9983-440f-8093-fe30acd7b756	68ed1a68-94f6-43f2-b734-752c3b72e55e	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.131089+05:30	\N	2026-05-02 17:55:57.131089+05:30
63567fe7-f498-499a-a518-d8c78df50f23	fd0209a4-d539-483f-a263-60829edec6ad	223abf20-2bf2-4332-aa59-0db5eeace7f5	a1d51fc3-7785-46ce-896f-3d8fbf4d5a28	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.134022+05:30	\N	2026-05-02 17:55:57.134022+05:30
466867d9-efa9-43d7-9192-41aef19d6d6e	51bf2c3d-1046-44ce-b717-0d8aff9885d3	4152814f-a12c-44be-9ccd-40e18069a7ba	8ed5e181-0c94-440c-9891-fb31741ecc1b	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.137256+05:30	\N	2026-05-02 17:55:57.137256+05:30
534badd0-bab2-4aa3-9d0a-1e91a13a14d3	bc580518-3707-4c6a-8c11-ec1c5bc807ed	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	628faa0a-fa9d-4f4f-b924-156db77a0e05	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.140039+05:30	\N	2026-05-02 17:55:57.140039+05:30
f5b2ae92-eb8b-4618-beec-31d583ad9463	b044af13-2286-4c4c-95c7-c0e8ab885287	7f823bf9-a429-4719-a175-070d4b1d0900	5aa53b12-4a5b-4d58-a920-f85569971a90	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.143098+05:30	\N	2026-05-02 17:55:57.143098+05:30
5e90ed90-484f-4107-9c10-29eb14af86f2	66fdc836-2432-4292-a807-6a51d0e63048	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	184ccaf3-9af3-4e04-86b3-84eec1301a9d	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.145134+05:30	\N	2026-05-02 17:55:57.145134+05:30
bc4640d9-6cef-4b70-80e6-88f2aeb5d235	29bb0bd1-508d-4018-9313-31d9a690205c	5f5b341c-7f18-44fe-97cc-04205c3b1201	0901a207-bb0a-444d-97b9-94315f89c6d8	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.147307+05:30	\N	2026-05-02 17:55:57.147307+05:30
9ed62614-52e0-4646-8d91-5db1315e9bfe	5608af0b-280d-4096-9427-46929b4fd8e0	0745814d-4302-4e64-ba13-c9201f12b39e	5832292b-42ea-4ee1-a8d6-8aae929a5454	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.149367+05:30	\N	2026-05-02 17:55:57.149367+05:30
8335d296-fd14-4e05-ac91-9e3eb8d96065	f5825197-e780-44ae-8276-fa5617164349	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	9adfbcc2-7860-4e49-b922-7d9afe25e4d4	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.151514+05:30	\N	2026-05-02 17:55:57.151514+05:30
f49004ce-9937-41b1-b214-01b95284d84c	465f73e3-93c9-44d1-aa22-1b7564157838	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	a5224ea5-a9ef-43f4-84ea-2fe7962c5cf4	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.153735+05:30	\N	2026-05-02 17:55:57.153735+05:30
6af45069-bcbe-4a42-904a-2390ac4162c0	0a55727e-b4aa-4adf-914a-dee3e3d09821	78b750fd-aabd-4261-ac34-1cc5d075b8e4	182bee17-4938-475c-a9e1-63b280a0bd39	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.15761+05:30	\N	2026-05-02 17:55:57.15761+05:30
d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	5db6a018-95da-4896-8b90-203a077027ce	155ba700-8d2e-4870-8706-58b86bfe1acb	d557893a-282d-42bb-81d5-eaf78ffd3b9a	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.160394+05:30	\N	2026-05-02 17:55:57.160394+05:30
f990d8b1-24f4-47b6-9e90-26d5000edf2f	c1ce4476-8fcb-4fcb-a35d-80c243a0fb3e	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	0ce4e4e5-8607-419e-9b6b-426759ae4e1a	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.163335+05:30	\N	2026-05-02 17:55:57.163335+05:30
90d93ba2-a692-4310-b041-85a9d0c62218	b80b3e57-58be-423c-b0c0-1754176ea6fb	2c402c76-d75e-4867-b8f6-57eea5df59f5	2a2386c4-e84a-4b83-b239-9c2e778a430c	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.166074+05:30	\N	2026-05-02 17:55:57.166074+05:30
02a6ec05-765e-4a37-92e3-507ebc424ae5	4a918b05-6378-4e61-ab1f-3be926542cf7	0ca11d19-3fb3-48e3-b038-b64c1f050d22	618ce32d-47f7-4e89-9a2f-bc20519e83d2	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.168723+05:30	\N	2026-05-02 17:55:57.168723+05:30
df6ba823-b1ed-44b5-8dd9-4f078bba3fba	f28432e9-0b1f-4cbb-ba1f-b45db7cf2ab0	26dece45-7e64-4f12-8695-169443d725fa	2cda2328-170d-4d04-92ff-55773c84279a	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.171565+05:30	\N	2026-05-02 17:55:57.171565+05:30
c747815b-5cc3-40b0-a9a9-a4370bb95bf7	fa852032-9102-4a69-b748-d007021108be	da038407-ad69-4a16-83d8-20c51a2acc1f	7915d0ad-7320-4169-8575-fe92ade1a1e1	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.174192+05:30	\N	2026-05-02 17:55:57.174192+05:30
c75c47b7-f19d-43aa-851b-ac037dc60633	1611e80b-5f56-4b8a-8921-0cad77154e34	36b736ff-deb8-417f-871f-70e5b22dd625	622c5913-3c8f-435f-9d3c-46aa69562f49	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.176635+05:30	\N	2026-05-02 17:55:57.176635+05:30
6fc82a50-2ec0-46a1-aaec-718130518126	f7c903dc-8567-4a2e-925c-5d7669eb3803	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	f7afaefb-64ff-4f9a-baa2-7fc130b2b6ea	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.179716+05:30	\N	2026-05-02 17:55:57.179716+05:30
551de9ea-a8fc-4589-9d16-c24e82963df7	61e23076-ebb7-4f57-a1b5-4735d5561234	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	4c31c57d-2475-47fd-8ee2-178a6a76e6f0	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.182836+05:30	\N	2026-05-02 17:55:57.182836+05:30
52df20b9-a5ac-4847-b816-bfd113daadf2	0931c4c0-2d6f-4ac8-a357-f961fb21b94f	91fcbe12-96b5-44fc-b028-d3c6e73238de	ab74d555-5f4e-411f-ac34-19c02821ea64	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.185891+05:30	\N	2026-05-02 17:55:57.185891+05:30
6e4fe697-23da-40cb-bc5d-607360878fca	63bcfbd3-736c-40d7-993a-c19f1655e61b	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	360af183-3c6d-456c-90cb-c2ebce9b8450	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.189123+05:30	\N	2026-05-02 17:55:57.189123+05:30
6f27ee05-ff3d-424b-a244-ebcc2757cdff	d34ec440-eac4-4579-bb8e-886d3403222e	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	9b429a8d-d6c5-4d8c-a617-1561e496566a	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.192126+05:30	\N	2026-05-02 17:55:57.192126+05:30
37dcfa11-e39d-448d-b96b-7b71c24eb6a3	0d8e8bfa-8ec6-4764-b328-28c29e12088a	d645a156-8347-48a5-83eb-3992ab61d433	e3dc77da-9cdc-4118-9402-7f516785c9be	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.194972+05:30	\N	2026-05-02 17:55:57.194972+05:30
3ef512de-0246-4ddb-8099-b4341f3ec492	615c8c4c-767e-42d7-941f-9849d94998b1	56d25496-173d-4ecd-bfa2-27781316d4c0	9d335430-8562-422d-93c1-ba7903496729	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.197722+05:30	\N	2026-05-02 17:55:57.197722+05:30
b6f82e67-3c41-486a-8009-c9b7ee2e46af	3239952a-685d-4a75-8d6c-880c4f389c2d	aef03bae-eab0-4632-ba93-5ce01a16a1fc	6f31ff97-5605-4a80-822a-b490ed85de81	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.200798+05:30	\N	2026-05-02 17:55:57.200798+05:30
2f887aa0-2926-41a2-83bf-0fca6b7697fe	8d4b2b9a-e41d-4bf1-99e5-29e98f6328c6	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	c89490d0-4a76-49f8-98e2-982552961444	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.203744+05:30	\N	2026-05-02 17:55:57.203744+05:30
fd8e90dd-6794-44a8-ae6f-56c0ff47503d	b6e0e4df-eb23-425f-9ff4-5141a0d0965c	ec6dda75-549b-4e80-a25e-38490c0b3d4d	7dce01af-144f-4a4f-9e8e-a33a31e104f8	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.206482+05:30	\N	2026-05-02 17:55:57.206482+05:30
bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	191829db-ad7d-47ff-8867-59a5336ebaa9	e19ed374-a7fb-467d-92ee-581c7224d42a	5e6ef3b5-5b7f-40ff-aced-9bd6bff03569	b1256171-9b71-4d0e-bcb5-0d8a77187087	6825000	2026-05-02 17:55:57.20941+05:30	\N	2026-05-02 17:55:57.20941+05:30
\.


--
-- Data for Name: penal_interests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.penal_interests (id, payment_plan_id, installment_index, consumer_id, principal_inr, days_overdue, rate_percent, calculated_at, amount_inr, status, escalated_at, escalated_to_user_id, interest_waived_inr) FROM stdin;
\.


--
-- Data for Name: plan_schedule_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plan_schedule_templates (id, project_id, plan_name, installment_index, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, notes, created_by, created_at, updated_at) FROM stdin;
a3000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	PLP@92	1	At the time of booking	installment	10.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000002	a0000000-0000-0000-0000-000000000001	PLP@92	2	Within 30 Days of Booking	installment	30.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000003	a0000000-0000-0000-0000-000000000001	PLP@92	3	On Completion of Super Structure	installment	30.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000004	a0000000-0000-0000-0000-000000000001	PLP@92	4	On Intimation for offer of Possession	installment	30.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000006	a0000000-0000-0000-0000-000000000001	CLP@92	2	Within 30 Days of Booking	installment	30.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000007	a0000000-0000-0000-0000-000000000001	CLP@92	3	On the start of Excavation	installment	20.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000008	a0000000-0000-0000-0000-000000000001	CLP@92	4	On Casting of Ground Floor Slab	installment	30.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000009	a0000000-0000-0000-0000-000000000001	CLP@92	5	On Intimation for offer of Possession	installment	10.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:23:33.016424+05:30
a3000000-0000-0000-0000-000000000005	a0000000-0000-0000-0000-000000000001	CLP@92	1	At the time of booking	installment	25.000	\N	0	\N	\N	2026-05-01 10:23:33.016424+05:30	2026-05-01 10:58:21.019668+05:30
f4ff8ae4-f2b0-4686-ba1d-1951cf8f0b7a	2fd05b46-2ca1-4c0b-a0ca-813c3e495770	Standard AHP Plan	1	PLC Charge	plc	\N	\N	0	\N	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-02 12:00:05.776088+05:30	2026-05-02 12:00:05.776088+05:30
\.


--
-- Data for Name: professions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.professions (id, name, created_at) FROM stdin;
e9291162-c5d9-4d15-84e7-7a418e4805f3	Business	2026-04-30 02:30:21.682923+05:30
3e417f33-14fd-49e1-a89d-8ac3ac7406f2	Service	2026-04-30 02:30:21.682923+05:30
23b9e6f1-c4a6-40bf-a766-931dc412d871	Professional	2026-04-30 02:30:21.682923+05:30
5924e5e1-1e92-45ca-a5d9-2dcfeecd26d1	Self Employed	2026-04-30 02:30:21.682923+05:30
72a63a73-4536-4929-b9fe-071b1c6fb78a	Retired	2026-04-30 02:30:21.682923+05:30
c64266d5-1f93-4077-a0f0-46a5bc7da321	Homemaker	2026-04-30 02:30:21.682923+05:30
38e898eb-a602-4caf-9bde-353ad3b69e37	Student	2026-04-30 02:30:21.682923+05:30
b8590876-4283-4508-961a-a8b1cbd5e6a6	Other	2026-04-30 02:30:21.682923+05:30
\.


--
-- Data for Name: project_smtp_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_smtp_configs (id, project_id, host, port, username, password_encrypted, from_name, from_email, use_ssl, cc_emails, bcc_emails, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, rera_number, tcp_licence, location, land_area_sqft, total_units, created_at, updated_at, group_name) FROM stdin;
a0000000-0000-0000-0000-000000000001	ROF GALLLERIA_TEST	HRERA-GLR-2024-TEST	TCP-GLR-2024-001	SECTOR-108	8755	19	2026-05-01 10:23:33.002471+05:30	2026-05-01 10:23:33.002471+05:30	Affordable
a0000000-0000-0000-0000-000000000002	ROF ALANTE_TEST	HRERA-ALN-2024-TEST	TCP-ALN-2024-001	Village Dharampura, Sector 108, Gurugram, Haryana	234117	12	2026-05-01 10:23:33.002471+05:30	2026-05-01 10:23:33.002471+05:30	Affordable
932c2701-b563-4b53-a8f7-28ed79484752	ROF NEW	3773891	27829	Sector 20	\N	\N	2026-05-01 10:34:48.814495+05:30	2026-05-01 10:34:48.814495+05:30	Affordable
028fb80b-5212-4d5f-a5fd-7c6f1a9c7eb4	Avi Gupta	2345	4134	Sector 20	\N	\N	2026-05-01 17:01:14.431739+05:30	2026-05-01 17:01:14.431739+05:30	Affordable
01306d9f-7d64-4e1e-89ec-1a1e19868540	DEMO PROJECT	1234	566778	Sector 30	\N	80	2026-05-01 18:14:39.465923+05:30	2026-05-02 11:58:58.010821+05:30	Affordable
2fd05b46-2ca1-4c0b-a0ca-813c3e495770	Demo 2nd may 	3645	784794	\N	\N	\N	2026-05-02 11:59:20.606012+05:30	2026-05-02 11:59:20.606012+05:30	Affordable
b1256171-9b71-4d0e-bcb5-0d8a77187087	ROF Serenity Residences - Phase 2	HRERA/GGM/Project/2024/00024165	TCP-2024-0024165	Sector 50, Gurugram	\N	\N	2026-05-02 17:55:57.014878+05:30	2026-05-02 17:55:57.014878+05:30	Affordable
626fc003-bd10-473b-8c3a-16e7b97032d9	Phase 3 Test Project EDITED	RC/TEST/PHASE3/001	TCP/TEST/PHASE3/001	Sector 99, Gurugram	\N	50	2026-05-02 18:53:35.915847+05:30	2026-05-02 18:55:32.084475+05:30	Affordable
2d7507fb-3ef8-423a-96f8-091b268cd5fc	ROF Regression Test Project 2026	RERA/GGM/2026/0099	TCP/2026/5678	Sector 93, Gurugram	100	\N	2026-05-02 22:59:37.937076+05:30	2026-05-02 22:59:37.937076+05:30	Affordable
\.


--
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.receipts (id, payment_plan_id, installment_index, consumer_id, amount_received_inr, payment_method, transaction_ref, received_date, received_by_user_id, receipt_number, created_at, status, authorized_by, authorized_at, print_status, approval_status, approved_by, approved_at, updated_at) FROM stdin;
70000000-0000-0000-0000-000000000001	a2000000-0000-0000-0000-000000000001	1	d0000000-0000-0000-0000-000000000001	50000	cheque	\N	2026-05-01	\N	\N	2026-05-01 10:23:33.018876+05:30	authorized	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-05-01 17:51:13.704583+05:30	not_printed	pending	\N	\N	2026-05-01 17:51:13.704583+05:30
704f78f1-e7b2-455f-a7be-64014db7a353	e4a96f26-93bf-4225-a3b7-5854ba540e5a	0	e80b1a86-f98b-475b-b769-a620f86ef26f	350000	neft	TRF1777724757119773079	2025-10-10	\N	\N	2026-05-02 17:55:57.120826+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.120826+05:30
0e795a6c-9413-4f00-9a8e-bedb821d6fc8	e4a96f26-93bf-4225-a3b7-5854ba540e5a	1	e80b1a86-f98b-475b-b769-a620f86ef26f	700000	cheque	TRF1777724757122678532	2025-12-14	\N	\N	2026-05-02 17:55:57.123507+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.123507+05:30
28f7e444-1862-443f-85d2-8fbd4b730183	e4a96f26-93bf-4225-a3b7-5854ba540e5a	2	e80b1a86-f98b-475b-b769-a620f86ef26f	437500	neft	TRF1777724757122285918	2026-06-12	\N	\N	2026-05-02 17:55:57.123847+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.123847+05:30
cf1f9655-3555-470a-9760-9a7a71b906c7	e4a96f26-93bf-4225-a3b7-5854ba540e5a	3	e80b1a86-f98b-475b-b769-a620f86ef26f	437500	cheque	TRF1777724757123828137	2026-12-09	\N	\N	2026-05-02 17:55:57.124129+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.124129+05:30
7d7659bf-1dc6-4d00-9f66-c8cc1355777f	e4a96f26-93bf-4225-a3b7-5854ba540e5a	4	e80b1a86-f98b-475b-b769-a620f86ef26f	437500	neft	TRF1777724757123826483	2027-06-07	\N	\N	2026-05-02 17:55:57.124397+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.124397+05:30
084e83b1-1279-42cb-a6f4-674048631238	e4a96f26-93bf-4225-a3b7-5854ba540e5a	2	e80b1a86-f98b-475b-b769-a620f86ef26f	437500	upi	TRF1777724757123602460	2026-06-12	\N	\N	2026-05-02 17:55:57.124768+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.124768+05:30
bb4bb98a-e6c2-4c99-9165-e6ae24183c6d	e4a96f26-93bf-4225-a3b7-5854ba540e5a	3	e80b1a86-f98b-475b-b769-a620f86ef26f	437500	bank_transfer	TRF1777724757124660335	2026-12-09	\N	\N	2026-05-02 17:55:57.12506+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.12506+05:30
bd03a38a-2db5-4db5-83a0-6d92f60e92af	abb9789a-730a-40db-98d4-234036e7f0bc	0	dccdc164-b2d6-472d-804c-711ff66ecf32	350000	rtgs	TRF1777724757125777065	2025-09-15	\N	\N	2026-05-02 17:55:57.126427+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.126427+05:30
8c7b3302-ca5f-4096-87ef-ed565acba5d1	abb9789a-730a-40db-98d4-234036e7f0bc	1	dccdc164-b2d6-472d-804c-711ff66ecf32	700000	neft	TRF1777724757125400431	2025-11-19	\N	\N	2026-05-02 17:55:57.126647+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.126647+05:30
c7a2a8b7-48de-4def-985d-9c5c56725eae	abb9789a-730a-40db-98d4-234036e7f0bc	2	dccdc164-b2d6-472d-804c-711ff66ecf32	437500	neft	TRF1777724757126822123	2026-05-18	\N	\N	2026-05-02 17:55:57.126851+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.126851+05:30
6dbbf6dc-c502-4883-9f6f-44b39530725b	abb9789a-730a-40db-98d4-234036e7f0bc	3	dccdc164-b2d6-472d-804c-711ff66ecf32	437500	rtgs	TRF1777724757126595916	2026-11-14	\N	\N	2026-05-02 17:55:57.127087+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.127087+05:30
8e52124f-2225-466a-bf59-844c064fdc8d	abb9789a-730a-40db-98d4-234036e7f0bc	4	dccdc164-b2d6-472d-804c-711ff66ecf32	437500	cheque	TRF1777724757126616262	2027-05-13	\N	\N	2026-05-02 17:55:57.127304+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.127304+05:30
89c53ef9-1a8b-433f-95d5-c4502d779a7b	abb9789a-730a-40db-98d4-234036e7f0bc	2	dccdc164-b2d6-472d-804c-711ff66ecf32	437500	upi	TRF1777724757126907667	2026-05-18	\N	\N	2026-05-02 17:55:57.127498+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.127498+05:30
a3643d95-b5a9-43ee-bf56-83249d29b122	abb9789a-730a-40db-98d4-234036e7f0bc	3	dccdc164-b2d6-472d-804c-711ff66ecf32	437500	cheque	TRF1777724757126841797	2026-11-14	\N	\N	2026-05-02 17:55:57.127687+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.127687+05:30
69096d22-6434-4b12-a574-2cb17f78ad33	882ece5e-960a-4b4d-b727-e7d94db5a3d1	0	595ee972-df8f-41b2-9f9d-b31220ee462b	350000	neft	TRF1777724757128241730	2026-03-06	\N	\N	2026-05-02 17:55:57.128899+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.128899+05:30
a9f363d1-47d0-447b-8258-9cd7a941b250	882ece5e-960a-4b4d-b727-e7d94db5a3d1	1	595ee972-df8f-41b2-9f9d-b31220ee462b	700000	cheque	TRF1777724757128274594	2026-05-10	\N	\N	2026-05-02 17:55:57.129106+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.129106+05:30
635077fd-8b3e-4b6e-8e71-5ba0d38a1aae	882ece5e-960a-4b4d-b727-e7d94db5a3d1	2	595ee972-df8f-41b2-9f9d-b31220ee462b	437500	cheque	TRF1777724757128122578	2026-11-06	\N	\N	2026-05-02 17:55:57.129348+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.129348+05:30
9577c450-66bd-48e4-9e21-bc7ec09d313b	882ece5e-960a-4b4d-b727-e7d94db5a3d1	3	595ee972-df8f-41b2-9f9d-b31220ee462b	437500	neft	TRF1777724757128533563	2027-05-05	\N	\N	2026-05-02 17:55:57.129621+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.129621+05:30
efb6e89d-faef-43cd-b80b-f7fb48914655	882ece5e-960a-4b4d-b727-e7d94db5a3d1	4	595ee972-df8f-41b2-9f9d-b31220ee462b	437500	rtgs	TRF1777724757129168775	2027-11-01	\N	\N	2026-05-02 17:55:57.12993+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.12993+05:30
8dce55ce-0aa3-48d1-a4de-1d2d4ec3f667	882ece5e-960a-4b4d-b727-e7d94db5a3d1	2	595ee972-df8f-41b2-9f9d-b31220ee462b	437500	neft	TRF1777724757129586239	2026-11-06	\N	\N	2026-05-02 17:55:57.130231+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.130231+05:30
9aa1dad1-50c8-46f0-9ce3-19853c19aa7c	882ece5e-960a-4b4d-b727-e7d94db5a3d1	3	595ee972-df8f-41b2-9f9d-b31220ee462b	437500	cheque	TRF1777724757129342397	2027-05-05	\N	\N	2026-05-02 17:55:57.130496+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.130496+05:30
f4892301-787e-4c78-b515-2ed1b7c3a829	3e05ef55-b423-4335-bb20-35e0d64548e9	0	f43c8424-9983-440f-8093-fe30acd7b756	350000	rtgs	TRF1777724757130673977	2025-10-20	\N	\N	2026-05-02 17:55:57.131475+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.131475+05:30
c84611b0-44ac-421b-b4fb-c2f7381b6ef5	3e05ef55-b423-4335-bb20-35e0d64548e9	1	f43c8424-9983-440f-8093-fe30acd7b756	700000	cheque	TRF1777724757130728397	2025-12-24	\N	\N	2026-05-02 17:55:57.131687+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.131687+05:30
c79b984d-e824-498b-9262-285c0071ab7a	3e05ef55-b423-4335-bb20-35e0d64548e9	2	f43c8424-9983-440f-8093-fe30acd7b756	437500	cheque	TRF1777724757131465350	2026-06-22	\N	\N	2026-05-02 17:55:57.131888+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.131888+05:30
30f0bae3-f349-4988-92b9-8a4567df68c2	3e05ef55-b423-4335-bb20-35e0d64548e9	3	f43c8424-9983-440f-8093-fe30acd7b756	437500	neft	TRF1777724757131700085	2026-12-19	\N	\N	2026-05-02 17:55:57.132137+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.132137+05:30
e5094e24-284d-4a1a-83b0-00ea922b6c78	3e05ef55-b423-4335-bb20-35e0d64548e9	4	f43c8424-9983-440f-8093-fe30acd7b756	437500	cheque	TRF1777724757131882667	2027-06-17	\N	\N	2026-05-02 17:55:57.132585+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.132585+05:30
0288b492-66b3-40c8-be27-df0d1185775f	3e05ef55-b423-4335-bb20-35e0d64548e9	2	f43c8424-9983-440f-8093-fe30acd7b756	437500	bank_transfer	TRF1777724757131222624	2026-06-22	\N	\N	2026-05-02 17:55:57.132862+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.132862+05:30
eeb3333d-1181-450f-b1d8-8ae56c0ba8f9	3e05ef55-b423-4335-bb20-35e0d64548e9	3	f43c8424-9983-440f-8093-fe30acd7b756	437500	upi	TRF1777724757132172089	2026-12-19	\N	\N	2026-05-02 17:55:57.133205+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.133205+05:30
f594174a-6894-4523-a56c-a4dfb72d0b54	63567fe7-f498-499a-a518-d8c78df50f23	0	223abf20-2bf2-4332-aa59-0db5eeace7f5	350000	rtgs	TRF1777724757134920602	2026-01-27	\N	\N	2026-05-02 17:55:57.135396+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.135396+05:30
d5d46b81-4de2-4370-b7b1-445fbd6163ab	63567fe7-f498-499a-a518-d8c78df50f23	1	223abf20-2bf2-4332-aa59-0db5eeace7f5	700000	rtgs	TRF1777724757134099626	2026-04-02	\N	\N	2026-05-02 17:55:57.135719+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.135719+05:30
2f5b94df-f0cf-4030-9a6d-bf3c9ab6b49d	63567fe7-f498-499a-a518-d8c78df50f23	2	223abf20-2bf2-4332-aa59-0db5eeace7f5	437500	cheque	TRF1777724757135177789	2026-09-29	\N	\N	2026-05-02 17:55:57.135991+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.135991+05:30
e2f1b1d7-104d-41d0-9bf4-50462b7b0607	63567fe7-f498-499a-a518-d8c78df50f23	3	223abf20-2bf2-4332-aa59-0db5eeace7f5	437500	rtgs	TRF1777724757135016792	2027-03-28	\N	\N	2026-05-02 17:55:57.136209+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.136209+05:30
0d5cc612-a3f2-48c6-9158-73284b3ef66b	63567fe7-f498-499a-a518-d8c78df50f23	4	223abf20-2bf2-4332-aa59-0db5eeace7f5	437500	rtgs	TRF1777724757135024081	2027-09-24	\N	\N	2026-05-02 17:55:57.136418+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.136418+05:30
ee2a50df-c973-4591-8a7b-7bbdc956e9cf	63567fe7-f498-499a-a518-d8c78df50f23	2	223abf20-2bf2-4332-aa59-0db5eeace7f5	437500	neft	TRF1777724757135850155	2026-09-29	\N	\N	2026-05-02 17:55:57.136618+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.136618+05:30
282fd948-6a40-4cd7-87cc-e2fdcb6e803e	63567fe7-f498-499a-a518-d8c78df50f23	3	223abf20-2bf2-4332-aa59-0db5eeace7f5	437500	neft	TRF1777724757135732320	2027-03-28	\N	\N	2026-05-02 17:55:57.136806+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.136806+05:30
48973972-6e27-4168-a288-ca1850dcaf20	466867d9-efa9-43d7-9192-41aef19d6d6e	0	4152814f-a12c-44be-9ccd-40e18069a7ba	350000	cheque	TRF1777724757136959261	2025-09-17	\N	\N	2026-05-02 17:55:57.13771+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.13771+05:30
92b489b7-1665-45f3-bb31-05e4fb8ccae8	466867d9-efa9-43d7-9192-41aef19d6d6e	1	4152814f-a12c-44be-9ccd-40e18069a7ba	700000	rtgs	TRF1777724757137220690	2025-11-21	\N	\N	2026-05-02 17:55:57.138111+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.138111+05:30
1d2acf09-ce42-4674-8a05-debab63ba96a	466867d9-efa9-43d7-9192-41aef19d6d6e	2	4152814f-a12c-44be-9ccd-40e18069a7ba	437500	cheque	TRF1777724757137835916	2026-05-20	\N	\N	2026-05-02 17:55:57.138488+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.138488+05:30
752c81cd-f750-4d8f-9e84-f138160e68e1	466867d9-efa9-43d7-9192-41aef19d6d6e	3	4152814f-a12c-44be-9ccd-40e18069a7ba	437500	upi	TRF1777724757137184557	2026-11-16	\N	\N	2026-05-02 17:55:57.138747+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.138747+05:30
703f18d8-7e3f-4faf-862a-192198e315d3	466867d9-efa9-43d7-9192-41aef19d6d6e	4	4152814f-a12c-44be-9ccd-40e18069a7ba	437500	bank_transfer	TRF1777724757138054586	2027-05-15	\N	\N	2026-05-02 17:55:57.139051+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.139051+05:30
cacf756e-be46-479f-a6be-7b29d9f6a1b8	466867d9-efa9-43d7-9192-41aef19d6d6e	2	4152814f-a12c-44be-9ccd-40e18069a7ba	437500	upi	TRF1777724757138816328	2026-05-20	\N	\N	2026-05-02 17:55:57.139295+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.139295+05:30
af6eb0d0-5149-4a5c-8c90-b802d9f11904	466867d9-efa9-43d7-9192-41aef19d6d6e	3	4152814f-a12c-44be-9ccd-40e18069a7ba	437500	rtgs	TRF1777724757138785504	2026-11-16	\N	\N	2026-05-02 17:55:57.1395+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.1395+05:30
46ad6e87-e593-48c5-ba97-cfdd3e55b08e	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	0	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	350000	cheque	TRF1777724757139132784	2025-11-06	\N	\N	2026-05-02 17:55:57.140331+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.140331+05:30
e39f6316-f782-4b2d-9659-1da6dbb716f6	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	1	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	700000	rtgs	TRF1777724757139378820	2026-01-10	\N	\N	2026-05-02 17:55:57.140568+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.140568+05:30
f6a4b4ab-c062-4853-9466-a9b4279303f9	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	2	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	437500	upi	TRF1777724757140280828	2026-07-09	\N	\N	2026-05-02 17:55:57.14179+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14179+05:30
523dab14-f2a7-4508-a232-d02e0ba5be2f	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	3	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	437500	neft	TRF1777724757141618370	2027-01-05	\N	\N	2026-05-02 17:55:57.142018+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.142018+05:30
a2b12fe3-66ae-4aef-907f-5c4641508f98	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	4	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	437500	cheque	TRF1777724757141532411	2027-07-04	\N	\N	2026-05-02 17:55:57.142317+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.142317+05:30
19050d6f-e08b-4eb7-81af-a2bdd1db25b0	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	2	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	437500	rtgs	TRF1777724757141080143	2026-07-09	\N	\N	2026-05-02 17:55:57.142526+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.142526+05:30
90b8e2f7-5d81-4fbe-a038-f538899f1cc3	534badd0-bab2-4aa3-9d0a-1e91a13a14d3	3	faa51d10-6b33-4a1c-9f43-e47dbe94b7ff	437500	rtgs	TRF1777724757141925544	2027-01-05	\N	\N	2026-05-02 17:55:57.142723+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.142723+05:30
a5722850-3489-4307-86ad-1ed8798433d3	f5b2ae92-eb8b-4618-beec-31d583ad9463	0	7f823bf9-a429-4719-a175-070d4b1d0900	350000	neft	TRF1777724757142740712	2025-12-05	\N	\N	2026-05-02 17:55:57.143332+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.143332+05:30
d088bbc2-6813-4e09-9b39-ae2f4d9bc4bd	f5b2ae92-eb8b-4618-beec-31d583ad9463	1	7f823bf9-a429-4719-a175-070d4b1d0900	700000	upi	TRF1777724757142620064	2026-02-08	\N	\N	2026-05-02 17:55:57.143577+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.143577+05:30
0be756a2-67b0-4e76-9e9f-2e4319019fed	f5b2ae92-eb8b-4618-beec-31d583ad9463	2	7f823bf9-a429-4719-a175-070d4b1d0900	437500	rtgs	TRF1777724757142763903	2026-08-07	\N	\N	2026-05-02 17:55:57.14382+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14382+05:30
668aa998-f87b-4058-ab1c-3c7e88731e45	f5b2ae92-eb8b-4618-beec-31d583ad9463	3	7f823bf9-a429-4719-a175-070d4b1d0900	437500	neft	TRF1777724757143162699	2027-02-03	\N	\N	2026-05-02 17:55:57.144066+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.144066+05:30
6a472057-032a-4a28-812f-2611eaaaa924	f5b2ae92-eb8b-4618-beec-31d583ad9463	4	7f823bf9-a429-4719-a175-070d4b1d0900	437500	neft	TRF1777724757143013293	2027-08-02	\N	\N	2026-05-02 17:55:57.144278+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.144278+05:30
6f730714-c0c3-44ee-a4c3-5e062ed54315	f5b2ae92-eb8b-4618-beec-31d583ad9463	2	7f823bf9-a429-4719-a175-070d4b1d0900	437500	rtgs	TRF1777724757143960059	2026-08-07	\N	\N	2026-05-02 17:55:57.144496+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.144496+05:30
dd50b489-4df0-40ec-8490-4c0fee8e49dd	f5b2ae92-eb8b-4618-beec-31d583ad9463	3	7f823bf9-a429-4719-a175-070d4b1d0900	437500	upi	TRF1777724757143940711	2027-02-03	\N	\N	2026-05-02 17:55:57.14474+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14474+05:30
1594022f-aabd-41f1-bd24-b4f13862825b	5e90ed90-484f-4107-9c10-29eb14af86f2	0	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	350000	neft	TRF1777724757144860426	2025-10-31	\N	\N	2026-05-02 17:55:57.14543+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14543+05:30
b673cd33-85cb-4d7e-8cb2-8346eb32bf15	5e90ed90-484f-4107-9c10-29eb14af86f2	1	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	700000	rtgs	TRF1777724757144136099	2026-01-04	\N	\N	2026-05-02 17:55:57.145684+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.145684+05:30
06652d0f-3d32-4c8f-a224-a8baf986be57	5e90ed90-484f-4107-9c10-29eb14af86f2	2	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	437500	neft	TRF1777724757145489919	2026-07-03	\N	\N	2026-05-02 17:55:57.14591+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14591+05:30
3b6ac403-7520-46ca-adc3-4c8f4256145c	5e90ed90-484f-4107-9c10-29eb14af86f2	3	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	437500	upi	TRF1777724757145002815	2026-12-30	\N	\N	2026-05-02 17:55:57.14614+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14614+05:30
b8d828e6-0a43-4c96-9b6b-0fc4b49bbe12	5e90ed90-484f-4107-9c10-29eb14af86f2	4	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	437500	neft	TRF1777724757145928227	2027-06-28	\N	\N	2026-05-02 17:55:57.146339+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.146339+05:30
09fe2588-ffcf-4fcd-8f92-d90e4d8409e0	5e90ed90-484f-4107-9c10-29eb14af86f2	2	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	437500	upi	TRF1777724757145648469	2026-07-03	\N	\N	2026-05-02 17:55:57.146533+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.146533+05:30
006e45ac-2c5d-4725-8b6e-ba1dfedda07f	5e90ed90-484f-4107-9c10-29eb14af86f2	3	2c9b3f4f-36b5-4c06-bac1-450cdfaa6e23	437500	upi	TRF1777724757145764717	2026-12-30	\N	\N	2026-05-02 17:55:57.146719+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.146719+05:30
e4526a09-e81a-4369-8512-1feb990271ec	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	0	5f5b341c-7f18-44fe-97cc-04205c3b1201	350000	cheque	TRF1777724757146726311	2026-02-11	\N	\N	2026-05-02 17:55:57.147543+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.147543+05:30
35ed7294-8c85-4916-9942-d605e4740b3e	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	1	5f5b341c-7f18-44fe-97cc-04205c3b1201	700000	cheque	TRF1777724757147628084	2026-04-17	\N	\N	2026-05-02 17:55:57.147858+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.147858+05:30
3eb4b2f1-c683-44e4-a07c-2bc50cbaf71d	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	2	5f5b341c-7f18-44fe-97cc-04205c3b1201	437500	cheque	TRF1777724757147470909	2026-10-14	\N	\N	2026-05-02 17:55:57.148066+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.148066+05:30
10b4c574-5ca0-4762-b312-c9a453840f10	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	3	5f5b341c-7f18-44fe-97cc-04205c3b1201	437500	cheque	TRF1777724757147183848	2027-04-12	\N	\N	2026-05-02 17:55:57.14826+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.14826+05:30
39a6c27b-dec7-4461-b752-e8d31da43054	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	4	5f5b341c-7f18-44fe-97cc-04205c3b1201	437500	bank_transfer	TRF1777724757147446800	2027-10-09	\N	\N	2026-05-02 17:55:57.148558+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.148558+05:30
d0e422f6-d70c-47dd-972d-307ebaf6a20e	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	2	5f5b341c-7f18-44fe-97cc-04205c3b1201	437500	rtgs	TRF1777724757147037168	2026-10-14	\N	\N	2026-05-02 17:55:57.148765+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.148765+05:30
3a2b7f0b-df16-48e2-92da-b488929329d5	bc4640d9-6cef-4b70-80e6-88f2aeb5d235	3	5f5b341c-7f18-44fe-97cc-04205c3b1201	437500	cheque	TRF1777724757148835993	2027-04-12	\N	\N	2026-05-02 17:55:57.148969+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.148969+05:30
7f502238-5849-4407-a617-0311424c34b5	9ed62614-52e0-4646-8d91-5db1315e9bfe	0	0745814d-4302-4e64-ba13-c9201f12b39e	350000	cheque	TRF1777724757148121173	2026-01-29	\N	\N	2026-05-02 17:55:57.149569+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.149569+05:30
c5441793-3e36-47c2-9463-12fe650e8286	9ed62614-52e0-4646-8d91-5db1315e9bfe	1	0745814d-4302-4e64-ba13-c9201f12b39e	700000	rtgs	TRF1777724757148132855	2026-04-04	\N	\N	2026-05-02 17:55:57.149785+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.149785+05:30
fd82d464-8186-4e96-871b-0ed01dfbd2b9	9ed62614-52e0-4646-8d91-5db1315e9bfe	2	0745814d-4302-4e64-ba13-c9201f12b39e	437500	rtgs	TRF1777724757149945988	2026-10-01	\N	\N	2026-05-02 17:55:57.150127+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.150127+05:30
7c45b3f7-a516-47ba-8f4c-dedb0eaac657	9ed62614-52e0-4646-8d91-5db1315e9bfe	3	0745814d-4302-4e64-ba13-c9201f12b39e	437500	bank_transfer	TRF1777724757149663253	2027-03-30	\N	\N	2026-05-02 17:55:57.150442+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.150442+05:30
3f8a5b23-a3ee-4a34-a839-f3c6c626edd5	9ed62614-52e0-4646-8d91-5db1315e9bfe	4	0745814d-4302-4e64-ba13-c9201f12b39e	437500	upi	TRF1777724757149357008	2027-09-26	\N	\N	2026-05-02 17:55:57.150688+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.150688+05:30
63c93bd7-76b4-40ab-a221-2039a0f87323	9ed62614-52e0-4646-8d91-5db1315e9bfe	2	0745814d-4302-4e64-ba13-c9201f12b39e	437500	rtgs	TRF1777724757150820322	2026-10-01	\N	\N	2026-05-02 17:55:57.15091+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.15091+05:30
234fab6c-12d6-4f83-8d3e-00bfaa34540b	9ed62614-52e0-4646-8d91-5db1315e9bfe	3	0745814d-4302-4e64-ba13-c9201f12b39e	437500	bank_transfer	TRF1777724757150742684	2027-03-30	\N	\N	2026-05-02 17:55:57.151115+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.151115+05:30
58d72925-7413-4a80-bd12-9dd498ae347c	8335d296-fd14-4e05-ac91-9e3eb8d96065	0	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	350000	neft	TRF1777724757150397513	2025-10-26	\N	\N	2026-05-02 17:55:57.15183+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.15183+05:30
1118e7d5-f0e5-4177-affa-01ba0467363a	8335d296-fd14-4e05-ac91-9e3eb8d96065	1	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	700000	bank_transfer	TRF1777724757151886147	2025-12-30	\N	\N	2026-05-02 17:55:57.152046+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.152046+05:30
09179a6a-6c2c-4487-a378-3b48dec733fb	8335d296-fd14-4e05-ac91-9e3eb8d96065	2	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	437500	neft	TRF1777724757151531963	2026-06-28	\N	\N	2026-05-02 17:55:57.152243+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.152243+05:30
fb2f8e4e-c472-4225-81e5-60199ab2d4e7	8335d296-fd14-4e05-ac91-9e3eb8d96065	3	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	437500	upi	TRF1777724757151444417	2026-12-25	\N	\N	2026-05-02 17:55:57.152434+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.152434+05:30
122e365e-8455-4a2b-83d9-c02bd99feb9a	8335d296-fd14-4e05-ac91-9e3eb8d96065	4	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	437500	rtgs	TRF1777724757151872575	2027-06-23	\N	\N	2026-05-02 17:55:57.152627+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.152627+05:30
ab059379-9db5-42b4-bb35-e75c55a5f745	8335d296-fd14-4e05-ac91-9e3eb8d96065	2	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	437500	upi	TRF1777724757151971820	2026-06-28	\N	\N	2026-05-02 17:55:57.152825+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.152825+05:30
a2e27393-6eb5-4001-8cc7-5a38a61b6a56	8335d296-fd14-4e05-ac91-9e3eb8d96065	3	fb0b3bed-4f57-4c7e-a429-6db8077f38e8	437500	bank_transfer	TRF1777724757152738514	2026-12-25	\N	\N	2026-05-02 17:55:57.153012+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.153012+05:30
a7fc714e-cfd6-412b-8291-1455b5c03e01	f49004ce-9937-41b1-b214-01b95284d84c	0	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	350000	rtgs	TRF1777724757153709049	2025-10-17	\N	\N	2026-05-02 17:55:57.154255+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.154255+05:30
a81ba168-909b-4d54-8f22-9e214c897c28	f49004ce-9937-41b1-b214-01b95284d84c	1	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	700000	rtgs	TRF1777724757153513293	2025-12-21	\N	\N	2026-05-02 17:55:57.154643+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.154643+05:30
0ce840c2-be50-4b02-b146-683d3e780bff	f49004ce-9937-41b1-b214-01b95284d84c	2	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	437500	cheque	TRF1777724757154088445	2026-06-19	\N	\N	2026-05-02 17:55:57.155241+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.155241+05:30
0006275a-439f-4309-a34c-f49105f5333a	f49004ce-9937-41b1-b214-01b95284d84c	3	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	437500	upi	TRF1777724757154678638	2026-12-16	\N	\N	2026-05-02 17:55:57.155657+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.155657+05:30
38389572-dca6-44f2-b74b-11707b408ddd	f49004ce-9937-41b1-b214-01b95284d84c	4	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	437500	bank_transfer	TRF1777724757155361061	2027-06-14	\N	\N	2026-05-02 17:55:57.156191+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.156191+05:30
ad906840-a54f-4e15-b1df-82242d3bedf0	f49004ce-9937-41b1-b214-01b95284d84c	2	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	437500	upi	TRF1777724757155805912	2026-06-19	\N	\N	2026-05-02 17:55:57.156651+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.156651+05:30
3bba0708-0433-4dbf-87a6-609975a3bbaa	f49004ce-9937-41b1-b214-01b95284d84c	3	e6481d2a-38fc-43dc-8099-55e6bfe41bd9	437500	bank_transfer	TRF1777724757156876462	2026-12-16	\N	\N	2026-05-02 17:55:57.156985+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.156985+05:30
2a082b50-acf1-48c9-8869-d8d1ce58f2a5	6af45069-bcbe-4a42-904a-2390ac4162c0	0	78b750fd-aabd-4261-ac34-1cc5d075b8e4	350000	bank_transfer	TRF1777724757157958968	2025-11-30	\N	\N	2026-05-02 17:55:57.157868+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.157868+05:30
85d72926-8c19-4ada-a7d8-1639ef2c876a	6af45069-bcbe-4a42-904a-2390ac4162c0	1	78b750fd-aabd-4261-ac34-1cc5d075b8e4	700000	cheque	TRF1777724757157519399	2026-02-03	\N	\N	2026-05-02 17:55:57.158109+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.158109+05:30
c5081e0b-b657-4db4-8de7-f0f9ad64c065	6af45069-bcbe-4a42-904a-2390ac4162c0	2	78b750fd-aabd-4261-ac34-1cc5d075b8e4	437500	rtgs	TRF1777724757157304993	2026-08-02	\N	\N	2026-05-02 17:55:57.15837+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.15837+05:30
2e1b4c16-66a4-4576-a21b-14a23102a128	6af45069-bcbe-4a42-904a-2390ac4162c0	3	78b750fd-aabd-4261-ac34-1cc5d075b8e4	437500	upi	TRF1777724757157143778	2027-01-29	\N	\N	2026-05-02 17:55:57.158659+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.158659+05:30
3cc1d24d-ae0e-4771-aa93-4106c6e90a95	6af45069-bcbe-4a42-904a-2390ac4162c0	4	78b750fd-aabd-4261-ac34-1cc5d075b8e4	437500	bank_transfer	TRF1777724757158750790	2027-07-28	\N	\N	2026-05-02 17:55:57.158944+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.158944+05:30
57ce114b-b82c-4e96-a4b7-41c5a81a1e49	6af45069-bcbe-4a42-904a-2390ac4162c0	2	78b750fd-aabd-4261-ac34-1cc5d075b8e4	437500	bank_transfer	TRF1777724757158601712	2026-08-02	\N	\N	2026-05-02 17:55:57.159241+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.159241+05:30
d6aa0d29-fb55-4acc-a3ab-8d73a34112a6	6af45069-bcbe-4a42-904a-2390ac4162c0	3	78b750fd-aabd-4261-ac34-1cc5d075b8e4	437500	cheque	TRF1777724757158224710	2027-01-29	\N	\N	2026-05-02 17:55:57.159554+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.159554+05:30
469b3639-25ca-4499-a612-cac7254aa6b1	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	0	155ba700-8d2e-4870-8706-58b86bfe1acb	350000	cheque	TRF1777724757160340702	2026-01-30	\N	\N	2026-05-02 17:55:57.161041+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.161041+05:30
6a207ae6-b70f-4120-8dd8-432149b1b411	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	1	155ba700-8d2e-4870-8706-58b86bfe1acb	700000	upi	TRF1777724757160885849	2026-04-05	\N	\N	2026-05-02 17:55:57.161421+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.161421+05:30
98ebb07f-0fbf-43e6-82c9-746781a26845	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	2	155ba700-8d2e-4870-8706-58b86bfe1acb	437500	upi	TRF1777724757160428304	2026-10-02	\N	\N	2026-05-02 17:55:57.161733+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.161733+05:30
580992df-7966-46c9-b0fe-343081120a0f	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	3	155ba700-8d2e-4870-8706-58b86bfe1acb	437500	rtgs	TRF1777724757161641445	2027-03-31	\N	\N	2026-05-02 17:55:57.162037+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.162037+05:30
7dc909ad-f472-4b10-9d0d-2c174fbecafd	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	4	155ba700-8d2e-4870-8706-58b86bfe1acb	437500	upi	TRF1777724757161994057	2027-09-27	\N	\N	2026-05-02 17:55:57.162298+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.162298+05:30
1a52f45d-a82c-4a47-a575-ab3ee93ebb40	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	2	155ba700-8d2e-4870-8706-58b86bfe1acb	437500	neft	TRF1777724757161572542	2026-10-02	\N	\N	2026-05-02 17:55:57.16269+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.16269+05:30
184f17a7-a3c3-4b4b-80c2-6fa64629156a	d56d6263-4ed6-45b2-8b5f-4c478c66b3a0	3	155ba700-8d2e-4870-8706-58b86bfe1acb	437500	rtgs	TRF1777724757162501255	2027-03-31	\N	\N	2026-05-02 17:55:57.162938+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.162938+05:30
4805f287-5a6b-4cc5-b700-fe1184a52904	f990d8b1-24f4-47b6-9e90-26d5000edf2f	0	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	350000	bank_transfer	TRF1777724757162709233	2025-11-05	\N	\N	2026-05-02 17:55:57.163564+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.163564+05:30
f0721745-fe4a-4659-8de2-43ae7f6693d9	f990d8b1-24f4-47b6-9e90-26d5000edf2f	1	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	700000	cheque	TRF1777724757163699601	2026-01-09	\N	\N	2026-05-02 17:55:57.163943+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.163943+05:30
8844770a-c51b-4efe-93a3-024de34f6b00	f990d8b1-24f4-47b6-9e90-26d5000edf2f	2	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	437500	bank_transfer	TRF1777724757163088855	2026-07-08	\N	\N	2026-05-02 17:55:57.164268+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.164268+05:30
5c21f19c-5320-44be-9ae1-e546fdf2a3a7	f990d8b1-24f4-47b6-9e90-26d5000edf2f	3	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	437500	rtgs	TRF1777724757163894151	2027-01-04	\N	\N	2026-05-02 17:55:57.164633+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.164633+05:30
cd405e7f-71de-40cc-8552-67d22575ed91	f990d8b1-24f4-47b6-9e90-26d5000edf2f	4	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	437500	neft	TRF1777724757164058679	2027-07-03	\N	\N	2026-05-02 17:55:57.164884+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.164884+05:30
4a5d72ec-4879-46ea-afe7-de8dddb97396	f990d8b1-24f4-47b6-9e90-26d5000edf2f	2	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	437500	neft	TRF1777724757164567680	2026-07-08	\N	\N	2026-05-02 17:55:57.165198+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.165198+05:30
81162643-4bcb-47e8-bc25-830b5ab08dfd	f990d8b1-24f4-47b6-9e90-26d5000edf2f	3	4e5ea527-b9a7-4d8a-8d44-c346508d0e05	437500	upi	TRF1777724757164555823	2027-01-04	\N	\N	2026-05-02 17:55:57.165486+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.165486+05:30
ae0b0537-032e-411c-8aee-2aa69c4aaaa1	90d93ba2-a692-4310-b041-85a9d0c62218	0	2c402c76-d75e-4867-b8f6-57eea5df59f5	350000	cheque	TRF1777724757165161069	2026-02-12	\N	\N	2026-05-02 17:55:57.166282+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.166282+05:30
900ae0a4-dc97-497c-80c0-9eb9e93286a1	90d93ba2-a692-4310-b041-85a9d0c62218	1	2c402c76-d75e-4867-b8f6-57eea5df59f5	700000	upi	TRF1777724757165583349	2026-04-18	\N	\N	2026-05-02 17:55:57.166487+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.166487+05:30
435d9ae8-49af-49f7-9d2b-a3d1b00dad58	90d93ba2-a692-4310-b041-85a9d0c62218	2	2c402c76-d75e-4867-b8f6-57eea5df59f5	437500	upi	TRF1777724757165737548	2026-10-15	\N	\N	2026-05-02 17:55:57.166736+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.166736+05:30
28bb2001-e0c0-4d5e-ae64-614a11c2733d	90d93ba2-a692-4310-b041-85a9d0c62218	3	2c402c76-d75e-4867-b8f6-57eea5df59f5	437500	cheque	TRF1777724757166323482	2027-04-13	\N	\N	2026-05-02 17:55:57.166965+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.166965+05:30
db66dc19-1fbd-4585-b6c2-a9f1fe5602d7	90d93ba2-a692-4310-b041-85a9d0c62218	4	2c402c76-d75e-4867-b8f6-57eea5df59f5	437500	rtgs	TRF1777724757166339699	2027-10-10	\N	\N	2026-05-02 17:55:57.167384+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.167384+05:30
501b55ea-0c1f-42f0-9c8b-d6b576682fa9	90d93ba2-a692-4310-b041-85a9d0c62218	2	2c402c76-d75e-4867-b8f6-57eea5df59f5	437500	bank_transfer	TRF1777724757166443376	2026-10-15	\N	\N	2026-05-02 17:55:57.16774+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.16774+05:30
aa00e815-c400-446b-9cfc-d2fd6903f5e8	90d93ba2-a692-4310-b041-85a9d0c62218	3	2c402c76-d75e-4867-b8f6-57eea5df59f5	437500	rtgs	TRF1777724757167940947	2027-04-13	\N	\N	2026-05-02 17:55:57.168066+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.168066+05:30
e7657105-353d-44f8-b5f7-8cceb7fba323	02a6ec05-765e-4a37-92e3-507ebc424ae5	0	0ca11d19-3fb3-48e3-b038-b64c1f050d22	350000	neft	TRF1777724757168966408	2026-01-14	\N	\N	2026-05-02 17:55:57.169246+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.169246+05:30
0105ee39-2ef6-4314-a23a-b4b004c2d31a	02a6ec05-765e-4a37-92e3-507ebc424ae5	1	0ca11d19-3fb3-48e3-b038-b64c1f050d22	700000	rtgs	TRF1777724757168108902	2026-03-20	\N	\N	2026-05-02 17:55:57.169544+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.169544+05:30
683fe457-8e52-43e0-8f6b-b0e42f0df235	02a6ec05-765e-4a37-92e3-507ebc424ae5	2	0ca11d19-3fb3-48e3-b038-b64c1f050d22	437500	bank_transfer	TRF1777724757168850294	2026-09-16	\N	\N	2026-05-02 17:55:57.169792+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.169792+05:30
4ccacd07-d2b5-432f-973a-0c5482258107	02a6ec05-765e-4a37-92e3-507ebc424ae5	3	0ca11d19-3fb3-48e3-b038-b64c1f050d22	437500	rtgs	TRF1777724757169126913	2027-03-15	\N	\N	2026-05-02 17:55:57.170132+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.170132+05:30
c008a654-5887-4afa-8baf-b49ab9c95321	02a6ec05-765e-4a37-92e3-507ebc424ae5	4	0ca11d19-3fb3-48e3-b038-b64c1f050d22	437500	rtgs	TRF1777724757169471708	2027-09-11	\N	\N	2026-05-02 17:55:57.170588+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.170588+05:30
59ca194e-518b-489c-b59b-376036d85cff	02a6ec05-765e-4a37-92e3-507ebc424ae5	2	0ca11d19-3fb3-48e3-b038-b64c1f050d22	437500	neft	TRF1777724757170066837	2026-09-16	\N	\N	2026-05-02 17:55:57.170889+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.170889+05:30
d3847654-08de-4860-9ca6-a55f5977dec6	02a6ec05-765e-4a37-92e3-507ebc424ae5	3	0ca11d19-3fb3-48e3-b038-b64c1f050d22	437500	rtgs	TRF1777724757170660698	2027-03-15	\N	\N	2026-05-02 17:55:57.171106+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.171106+05:30
d05d5c99-eaa3-4556-b925-a5e534efd118	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	0	26dece45-7e64-4f12-8695-169443d725fa	350000	rtgs	TRF1777724757171062602	2025-12-17	\N	\N	2026-05-02 17:55:57.171934+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.171934+05:30
1b305705-f7de-4033-9a68-e6e3b688b6aa	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	1	26dece45-7e64-4f12-8695-169443d725fa	700000	rtgs	TRF1777724757171373024	2026-02-20	\N	\N	2026-05-02 17:55:57.172239+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.172239+05:30
2ac706d2-b295-440f-9f40-1a3e0b7f90d2	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	2	26dece45-7e64-4f12-8695-169443d725fa	437500	cheque	TRF1777724757171303260	2026-08-19	\N	\N	2026-05-02 17:55:57.172474+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.172474+05:30
60914d03-2354-47b5-bed0-365157f4acb8	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	3	26dece45-7e64-4f12-8695-169443d725fa	437500	cheque	TRF1777724757171018455	2027-02-15	\N	\N	2026-05-02 17:55:57.172678+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.172678+05:30
17e3585e-149c-45eb-83ad-929a5d71dda1	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	4	26dece45-7e64-4f12-8695-169443d725fa	437500	cheque	TRF1777724757172267016	2027-08-14	\N	\N	2026-05-02 17:55:57.173033+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.173033+05:30
fc982ea2-cfa1-4730-96f3-0b1a97644cb4	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	2	26dece45-7e64-4f12-8695-169443d725fa	437500	rtgs	TRF1777724757172694743	2026-08-19	\N	\N	2026-05-02 17:55:57.173383+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.173383+05:30
3ce9a7da-6c21-4516-959b-b0f02c3e1ff0	df6ba823-b1ed-44b5-8dd9-4f078bba3fba	3	26dece45-7e64-4f12-8695-169443d725fa	437500	neft	TRF1777724757172429543	2027-02-15	\N	\N	2026-05-02 17:55:57.173594+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.173594+05:30
62694bb2-bece-426f-a5fd-cde53cc44614	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	0	da038407-ad69-4a16-83d8-20c51a2acc1f	350000	neft	TRF1777724757173160168	2025-12-08	\N	\N	2026-05-02 17:55:57.174408+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.174408+05:30
0f09bfde-d6e2-468d-bead-47258ce99e9b	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	1	da038407-ad69-4a16-83d8-20c51a2acc1f	700000	bank_transfer	TRF1777724757173661930	2026-02-11	\N	\N	2026-05-02 17:55:57.174801+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.174801+05:30
eeba9056-f997-4a34-803c-48ec03bd6850	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	2	da038407-ad69-4a16-83d8-20c51a2acc1f	437500	neft	TRF1777724757174031450	2026-08-10	\N	\N	2026-05-02 17:55:57.175019+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.175019+05:30
88e36ca6-7114-4e51-8457-ec9562e803e6	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	3	da038407-ad69-4a16-83d8-20c51a2acc1f	437500	bank_transfer	TRF1777724757174096749	2027-02-06	\N	\N	2026-05-02 17:55:57.175399+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.175399+05:30
26052581-596a-427e-b451-16587a9a4359	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	4	da038407-ad69-4a16-83d8-20c51a2acc1f	437500	bank_transfer	TRF1777724757174481259	2027-08-05	\N	\N	2026-05-02 17:55:57.175656+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.175656+05:30
40f9bbf5-5bb1-42cb-93c8-d9c2a83c3651	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	2	da038407-ad69-4a16-83d8-20c51a2acc1f	437500	cheque	TRF1777724757175310369	2026-08-10	\N	\N	2026-05-02 17:55:57.175858+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.175858+05:30
f636ce28-f4ed-4c5f-8514-b47d93bf24ed	c747815b-5cc3-40b0-a9a9-a4370bb95bf7	3	da038407-ad69-4a16-83d8-20c51a2acc1f	437500	upi	TRF1777724757175050685	2027-02-06	\N	\N	2026-05-02 17:55:57.176054+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.176054+05:30
c8b251b3-309c-4104-8608-a52a4682ef94	c75c47b7-f19d-43aa-851b-ac037dc60633	0	36b736ff-deb8-417f-871f-70e5b22dd625	350000	bank_transfer	TRF1777724757176698866	2026-01-12	\N	\N	2026-05-02 17:55:57.176853+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.176853+05:30
74ed8768-f204-45d2-bd86-1a9f9deb0fa1	c75c47b7-f19d-43aa-851b-ac037dc60633	1	36b736ff-deb8-417f-871f-70e5b22dd625	700000	rtgs	TRF1777724757176916881	2026-03-18	\N	\N	2026-05-02 17:55:57.177232+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.177232+05:30
cdeee035-90d7-4007-a52b-036eb5446d0e	c75c47b7-f19d-43aa-851b-ac037dc60633	2	36b736ff-deb8-417f-871f-70e5b22dd625	437500	rtgs	TRF1777724757176260138	2026-09-14	\N	\N	2026-05-02 17:55:57.177601+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.177601+05:30
49e13c94-1268-47c3-8f4e-bac7b7dfbac4	c75c47b7-f19d-43aa-851b-ac037dc60633	3	36b736ff-deb8-417f-871f-70e5b22dd625	437500	rtgs	TRF1777724757177396490	2027-03-13	\N	\N	2026-05-02 17:55:57.177973+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.177973+05:30
edf36b01-e960-46a1-9052-dd93f24be435	c75c47b7-f19d-43aa-851b-ac037dc60633	4	36b736ff-deb8-417f-871f-70e5b22dd625	437500	bank_transfer	TRF1777724757177219385	2027-09-09	\N	\N	2026-05-02 17:55:57.178347+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.178347+05:30
f3cdb64f-8847-4ad6-b735-fc60fafb3a46	c75c47b7-f19d-43aa-851b-ac037dc60633	2	36b736ff-deb8-417f-871f-70e5b22dd625	437500	rtgs	TRF1777724757177363738	2026-09-14	\N	\N	2026-05-02 17:55:57.178684+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.178684+05:30
6976898c-b58f-47a8-b7f2-e29a94d658fd	c75c47b7-f19d-43aa-851b-ac037dc60633	3	36b736ff-deb8-417f-871f-70e5b22dd625	437500	neft	TRF1777724757178810496	2027-03-13	\N	\N	2026-05-02 17:55:57.179006+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.179006+05:30
36c4f8d3-a846-48d1-8095-defc6deb2973	6fc82a50-2ec0-46a1-aaec-718130518126	0	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	350000	neft	TRF1777724757179453680	2025-12-12	\N	\N	2026-05-02 17:55:57.179963+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.179963+05:30
c0facc6c-dc9b-4af8-a4fa-50654592ba07	6fc82a50-2ec0-46a1-aaec-718130518126	1	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	700000	bank_transfer	TRF1777724757179535964	2026-02-15	\N	\N	2026-05-02 17:55:57.180382+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.180382+05:30
0f86064b-0890-42d6-90c1-225ae5532cef	6fc82a50-2ec0-46a1-aaec-718130518126	2	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	437500	neft	TRF1777724757179658287	2026-08-14	\N	\N	2026-05-02 17:55:57.180919+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.180919+05:30
0343ec08-40d2-44f7-b6cb-6e05e71bd953	6fc82a50-2ec0-46a1-aaec-718130518126	3	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	437500	rtgs	TRF1777724757180741605	2027-02-10	\N	\N	2026-05-02 17:55:57.181247+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.181247+05:30
8b3d9197-fdf6-4809-a618-f6c72592a429	6fc82a50-2ec0-46a1-aaec-718130518126	4	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	437500	rtgs	TRF1777724757180802214	2027-08-09	\N	\N	2026-05-02 17:55:57.181503+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.181503+05:30
8c247c4f-ec02-4e8e-9e81-b678a64959a0	6fc82a50-2ec0-46a1-aaec-718130518126	2	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	437500	upi	TRF1777724757181683551	2026-08-14	\N	\N	2026-05-02 17:55:57.181972+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.181972+05:30
b7e56e6f-838c-41db-9de8-2240f49e953a	6fc82a50-2ec0-46a1-aaec-718130518126	3	85f7abda-4b11-4b0b-8b28-5b41e0284b0c	437500	upi	TRF1777724757181740272	2027-02-10	\N	\N	2026-05-02 17:55:57.182238+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.182238+05:30
09cdf353-8b07-4e3e-a6c1-cedd25efef19	551de9ea-a8fc-4589-9d16-c24e82963df7	0	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	350000	neft	TRF1777724757182071294	2025-10-01	\N	\N	2026-05-02 17:55:57.183153+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.183153+05:30
bd61f35b-cdc0-4865-9af5-9ce0e8f67f62	551de9ea-a8fc-4589-9d16-c24e82963df7	1	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	700000	bank_transfer	TRF1777724757182282445	2025-12-05	\N	\N	2026-05-02 17:55:57.183408+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.183408+05:30
077266a4-8685-4aa0-9723-7bbbd61d3143	551de9ea-a8fc-4589-9d16-c24e82963df7	2	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	437500	cheque	TRF1777724757182276430	2026-06-03	\N	\N	2026-05-02 17:55:57.183619+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.183619+05:30
28d5c109-89dd-405d-8c98-bc2848c5ecf9	551de9ea-a8fc-4589-9d16-c24e82963df7	3	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	437500	upi	TRF1777724757183547472	2026-11-30	\N	\N	2026-05-02 17:55:57.183938+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.183938+05:30
c58a8ac7-1436-4661-9b8a-314938ad5625	551de9ea-a8fc-4589-9d16-c24e82963df7	4	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	437500	bank_transfer	TRF1777724757183451875	2027-05-29	\N	\N	2026-05-02 17:55:57.184339+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.184339+05:30
f581e4fe-9925-4f15-94ab-8186a0bf7aa1	551de9ea-a8fc-4589-9d16-c24e82963df7	2	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	437500	neft	TRF1777724757183346100	2026-06-03	\N	\N	2026-05-02 17:55:57.18469+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.18469+05:30
3910e1ac-e07f-4dcc-bccf-220cd7e6569d	551de9ea-a8fc-4589-9d16-c24e82963df7	3	448e78b1-b97d-4183-8f0f-5f4e2fbe348f	437500	cheque	TRF1777724757184117964	2026-11-30	\N	\N	2026-05-02 17:55:57.185115+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.185115+05:30
987f2ae4-0c59-4e0c-bd45-1e5c42acd549	52df20b9-a5ac-4847-b816-bfd113daadf2	0	91fcbe12-96b5-44fc-b028-d3c6e73238de	350000	cheque	TRF1777724757185029723	2026-03-04	\N	\N	2026-05-02 17:55:57.186177+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.186177+05:30
d0c638a8-8911-4a92-9758-fa1777d89da9	52df20b9-a5ac-4847-b816-bfd113daadf2	1	91fcbe12-96b5-44fc-b028-d3c6e73238de	700000	upi	TRF1777724757185341887	2026-05-08	\N	\N	2026-05-02 17:55:57.186579+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.186579+05:30
f84a9c20-7226-4afe-9b93-ddf353f98cb1	52df20b9-a5ac-4847-b816-bfd113daadf2	2	91fcbe12-96b5-44fc-b028-d3c6e73238de	437500	cheque	TRF1777724757186800099	2026-11-04	\N	\N	2026-05-02 17:55:57.18694+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.18694+05:30
9e6e0b42-4cf2-4b0a-9754-ccfcd069e5a9	52df20b9-a5ac-4847-b816-bfd113daadf2	3	91fcbe12-96b5-44fc-b028-d3c6e73238de	437500	rtgs	TRF1777724757186595618	2027-05-03	\N	\N	2026-05-02 17:55:57.187221+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.187221+05:30
20b9a4b0-7e3f-4b17-b806-aa1ca9b873f7	52df20b9-a5ac-4847-b816-bfd113daadf2	4	91fcbe12-96b5-44fc-b028-d3c6e73238de	437500	bank_transfer	TRF1777724757186781649	2027-10-30	\N	\N	2026-05-02 17:55:57.187669+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.187669+05:30
7e017d2b-d99f-494d-bc59-e99c95396deb	52df20b9-a5ac-4847-b816-bfd113daadf2	2	91fcbe12-96b5-44fc-b028-d3c6e73238de	437500	cheque	TRF1777724757187095085	2026-11-04	\N	\N	2026-05-02 17:55:57.188093+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.188093+05:30
5e409cf8-b515-4391-9681-6fd85828a7bc	52df20b9-a5ac-4847-b816-bfd113daadf2	3	91fcbe12-96b5-44fc-b028-d3c6e73238de	437500	rtgs	TRF1777724757187034432	2027-05-03	\N	\N	2026-05-02 17:55:57.188418+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.188418+05:30
c1d5cae5-d32e-4f8e-a096-52906bb6f17e	6e4fe697-23da-40cb-bc5d-607360878fca	0	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	350000	bank_transfer	TRF1777724757188846422	2026-02-14	\N	\N	2026-05-02 17:55:57.189446+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.189446+05:30
7154581b-2f25-4314-9f94-fde92aa26172	6e4fe697-23da-40cb-bc5d-607360878fca	1	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	700000	neft	TRF1777724757188438995	2026-04-20	\N	\N	2026-05-02 17:55:57.189722+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.189722+05:30
776fed42-437a-4a94-81b5-5f45327e75d9	6e4fe697-23da-40cb-bc5d-607360878fca	2	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	437500	neft	TRF1777724757189230216	2026-10-17	\N	\N	2026-05-02 17:55:57.189983+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.189983+05:30
30ecbb84-e45e-4a44-b219-32e7e2bdbdb4	6e4fe697-23da-40cb-bc5d-607360878fca	3	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	437500	rtgs	TRF1777724757189496395	2027-04-15	\N	\N	2026-05-02 17:55:57.190345+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.190345+05:30
3ecb571a-b344-4330-87b3-aa56f31e4b98	6e4fe697-23da-40cb-bc5d-607360878fca	4	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	437500	neft	TRF1777724757189801765	2027-10-12	\N	\N	2026-05-02 17:55:57.190658+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.190658+05:30
33bc104c-4bec-441a-ba5a-159aff8f7bdf	6e4fe697-23da-40cb-bc5d-607360878fca	2	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	437500	cheque	TRF1777724757190049896	2026-10-17	\N	\N	2026-05-02 17:55:57.191075+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.191075+05:30
71708cfa-baf2-4d0d-aa95-80a3032c1c10	6e4fe697-23da-40cb-bc5d-607360878fca	3	94d72c41-b7c4-4e2a-b012-12d15f4f9cd6	437500	bank_transfer	TRF1777724757190576301	2027-04-15	\N	\N	2026-05-02 17:55:57.191463+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.191463+05:30
657d88d2-1eb9-4230-a28f-ad0572c089a5	6f27ee05-ff3d-424b-a244-ebcc2757cdff	0	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	350000	rtgs	TRF1777724757191984104	2025-12-21	\N	\N	2026-05-02 17:55:57.192415+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.192415+05:30
8f5a1588-7245-4d69-963c-48cae14b7137	6f27ee05-ff3d-424b-a244-ebcc2757cdff	1	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	700000	cheque	TRF1777724757191744776	2026-02-24	\N	\N	2026-05-02 17:55:57.192803+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.192803+05:30
2004b260-7a2c-464b-a054-fc80fe737bff	6f27ee05-ff3d-424b-a244-ebcc2757cdff	2	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	437500	neft	TRF1777724757192676313	2026-08-23	\N	\N	2026-05-02 17:55:57.193157+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.193157+05:30
f0adc6dd-b9e3-42bc-81f7-d78b4726598e	6f27ee05-ff3d-424b-a244-ebcc2757cdff	3	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	437500	upi	TRF1777724757192675318	2027-02-19	\N	\N	2026-05-02 17:55:57.193472+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.193472+05:30
e848a5cd-5d93-4d59-8746-c8b1f27f5b40	6f27ee05-ff3d-424b-a244-ebcc2757cdff	4	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	437500	bank_transfer	TRF1777724757192353094	2027-08-18	\N	\N	2026-05-02 17:55:57.19377+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.19377+05:30
49b87a06-12ac-4107-a4d1-5620c614ec68	6f27ee05-ff3d-424b-a244-ebcc2757cdff	2	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	437500	neft	TRF1777724757193161590	2026-08-23	\N	\N	2026-05-02 17:55:57.194012+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.194012+05:30
06084f05-c91e-4810-be8d-b06fff2bd973	6f27ee05-ff3d-424b-a244-ebcc2757cdff	3	3a7b9e60-d641-4ce9-9a51-77951d5ce24e	437500	rtgs	TRF1777724757193140314	2027-02-19	\N	\N	2026-05-02 17:55:57.194373+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.194373+05:30
438ded2a-a649-42af-9262-97144df8d60c	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	0	d645a156-8347-48a5-83eb-3992ab61d433	350000	bank_transfer	TRF1777724757194836497	2026-01-26	\N	\N	2026-05-02 17:55:57.19529+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.19529+05:30
8b99d2a9-9e58-4ae3-82ac-30d7528f81b8	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	1	d645a156-8347-48a5-83eb-3992ab61d433	700000	neft	TRF1777724757194828880	2026-04-01	\N	\N	2026-05-02 17:55:57.195723+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.195723+05:30
7d220d58-0735-4cfc-b8b6-c2a2195cfd9d	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	2	d645a156-8347-48a5-83eb-3992ab61d433	437500	upi	TRF1777724757195199359	2026-09-28	\N	\N	2026-05-02 17:55:57.195972+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.195972+05:30
818ced82-9d16-48d8-bdd0-dbbd4f94feec	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	3	d645a156-8347-48a5-83eb-3992ab61d433	437500	upi	TRF1777724757195982252	2027-03-27	\N	\N	2026-05-02 17:55:57.196166+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.196166+05:30
0168e896-f862-4378-aa46-328436314858	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	4	d645a156-8347-48a5-83eb-3992ab61d433	437500	rtgs	TRF1777724757195109119	2027-09-23	\N	\N	2026-05-02 17:55:57.196354+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.196354+05:30
fc7d6c93-0aa9-4787-a5d2-477218ff18e2	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	2	d645a156-8347-48a5-83eb-3992ab61d433	437500	cheque	TRF1777724757195952558	2026-09-28	\N	\N	2026-05-02 17:55:57.19673+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.19673+05:30
2af35064-4da7-4f17-bd7d-dcf27d836737	37dcfa11-e39d-448d-b96b-7b71c24eb6a3	3	d645a156-8347-48a5-83eb-3992ab61d433	437500	neft	TRF1777724757196826186	2027-03-27	\N	\N	2026-05-02 17:55:57.197059+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.197059+05:30
bf8bfffd-ee93-49cb-aebd-8ff83bb832e0	3ef512de-0246-4ddb-8099-b4341f3ec492	0	56d25496-173d-4ecd-bfa2-27781316d4c0	350000	upi	TRF1777724757197206682	2026-01-26	\N	\N	2026-05-02 17:55:57.197969+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.197969+05:30
20470457-ce2c-4de9-b4a7-0928d515ebb0	3ef512de-0246-4ddb-8099-b4341f3ec492	1	56d25496-173d-4ecd-bfa2-27781316d4c0	700000	cheque	TRF1777724757197262763	2026-04-01	\N	\N	2026-05-02 17:55:57.198341+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.198341+05:30
ee699ae8-7ba5-46ae-956c-59b6879cbcab	3ef512de-0246-4ddb-8099-b4341f3ec492	2	56d25496-173d-4ecd-bfa2-27781316d4c0	437500	neft	TRF1777724757197159669	2026-09-28	\N	\N	2026-05-02 17:55:57.198653+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.198653+05:30
06b65d98-2233-4a71-a935-70028a05b098	3ef512de-0246-4ddb-8099-b4341f3ec492	3	56d25496-173d-4ecd-bfa2-27781316d4c0	437500	cheque	TRF1777724757198513187	2027-03-27	\N	\N	2026-05-02 17:55:57.198984+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.198984+05:30
c2b7205a-226d-4d32-8320-ffbc2308669a	3ef512de-0246-4ddb-8099-b4341f3ec492	4	56d25496-173d-4ecd-bfa2-27781316d4c0	437500	bank_transfer	TRF1777724757198870152	2027-09-23	\N	\N	2026-05-02 17:55:57.199365+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.199365+05:30
00b48ab0-975d-4d39-beb9-c5a280a46f85	3ef512de-0246-4ddb-8099-b4341f3ec492	2	56d25496-173d-4ecd-bfa2-27781316d4c0	437500	bank_transfer	TRF1777724757198556334	2026-09-28	\N	\N	2026-05-02 17:55:57.199699+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.199699+05:30
e7cdc556-e9c8-40be-bb1c-e55df8ece4ea	3ef512de-0246-4ddb-8099-b4341f3ec492	3	56d25496-173d-4ecd-bfa2-27781316d4c0	437500	bank_transfer	TRF1777724757199883218	2027-03-27	\N	\N	2026-05-02 17:55:57.200239+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.200239+05:30
f2f1a7ac-1222-47b2-989a-6ff2dde90a03	b6f82e67-3c41-486a-8009-c9b7ee2e46af	0	aef03bae-eab0-4632-ba93-5ce01a16a1fc	350000	bank_transfer	TRF1777724757200407533	2026-02-09	\N	\N	2026-05-02 17:55:57.201077+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.201077+05:30
2c18b001-1fa3-4573-8319-bdd6b535835b	b6f82e67-3c41-486a-8009-c9b7ee2e46af	1	aef03bae-eab0-4632-ba93-5ce01a16a1fc	700000	cheque	TRF1777724757200535654	2026-04-15	\N	\N	2026-05-02 17:55:57.201484+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.201484+05:30
be1a8613-3cd1-4973-a1f5-6061c54cf745	b6f82e67-3c41-486a-8009-c9b7ee2e46af	2	aef03bae-eab0-4632-ba93-5ce01a16a1fc	437500	neft	TRF1777724757200714783	2026-10-12	\N	\N	2026-05-02 17:55:57.201825+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.201825+05:30
f57755bc-8782-4f45-8caf-847fd3f76c1a	b6f82e67-3c41-486a-8009-c9b7ee2e46af	3	aef03bae-eab0-4632-ba93-5ce01a16a1fc	437500	cheque	TRF1777724757201817635	2027-04-10	\N	\N	2026-05-02 17:55:57.202181+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.202181+05:30
4484a399-a02a-402d-801e-93860f73d3ee	b6f82e67-3c41-486a-8009-c9b7ee2e46af	4	aef03bae-eab0-4632-ba93-5ce01a16a1fc	437500	cheque	TRF1777724757201732453	2027-10-07	\N	\N	2026-05-02 17:55:57.202558+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.202558+05:30
c142e7aa-45e2-4305-99e6-088c8a05a1af	b6f82e67-3c41-486a-8009-c9b7ee2e46af	2	aef03bae-eab0-4632-ba93-5ce01a16a1fc	437500	cheque	TRF1777724757201990386	2026-10-12	\N	\N	2026-05-02 17:55:57.20283+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.20283+05:30
37bc535b-ec7b-481c-8c32-f3e97fe055d1	b6f82e67-3c41-486a-8009-c9b7ee2e46af	3	aef03bae-eab0-4632-ba93-5ce01a16a1fc	437500	bank_transfer	TRF1777724757202004858	2027-04-10	\N	\N	2026-05-02 17:55:57.20307+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.20307+05:30
efb1c92c-54b2-4c0e-842e-5456a159b01f	2f887aa0-2926-41a2-83bf-0fca6b7697fe	0	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	350000	bank_transfer	TRF1777724757203852381	2025-12-19	\N	\N	2026-05-02 17:55:57.204083+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.204083+05:30
939df579-380a-4272-9bac-968c9b122095	2f887aa0-2926-41a2-83bf-0fca6b7697fe	1	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	700000	bank_transfer	TRF1777724757203485179	2026-02-22	\N	\N	2026-05-02 17:55:57.204545+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.204545+05:30
b2ab5781-2eee-4c89-ae48-00ace22c379d	2f887aa0-2926-41a2-83bf-0fca6b7697fe	2	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	437500	cheque	TRF1777724757203694045	2026-08-21	\N	\N	2026-05-02 17:55:57.204849+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.204849+05:30
21397329-d3df-4533-8abe-62740e8db896	2f887aa0-2926-41a2-83bf-0fca6b7697fe	3	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	437500	neft	TRF1777724757204116617	2027-02-17	\N	\N	2026-05-02 17:55:57.205085+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.205085+05:30
f2401cfd-0878-4764-94f3-8f6bd5b509c6	2f887aa0-2926-41a2-83bf-0fca6b7697fe	4	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	437500	neft	TRF1777724757204458427	2027-08-16	\N	\N	2026-05-02 17:55:57.205458+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.205458+05:30
6215d4a7-9144-47d9-bd7f-3087932920ee	2f887aa0-2926-41a2-83bf-0fca6b7697fe	2	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	437500	cheque	TRF1777724757204869127	2026-08-21	\N	\N	2026-05-02 17:55:57.205715+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.205715+05:30
c7174ea2-683f-4ecd-9602-e61f30ca1f54	2f887aa0-2926-41a2-83bf-0fca6b7697fe	3	a2fad86a-9c4c-4296-b061-3e2fb65aaadf	437500	rtgs	TRF1777724757205324669	2027-02-17	\N	\N	2026-05-02 17:55:57.205914+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.205914+05:30
b3f3caf2-8a2e-4dca-b70f-e12839ae5956	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	0	ec6dda75-549b-4e80-a25e-38490c0b3d4d	350000	cheque	TRF1777724757205727564	2025-09-21	\N	\N	2026-05-02 17:55:57.206809+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.206809+05:30
b64ee191-11a6-4c26-a49b-89b9bd0d42fc	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	1	ec6dda75-549b-4e80-a25e-38490c0b3d4d	700000	bank_transfer	TRF1777724757206412384	2025-11-25	\N	\N	2026-05-02 17:55:57.207091+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.207091+05:30
37193665-c2c9-48d8-b634-f075c98cc723	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	2	ec6dda75-549b-4e80-a25e-38490c0b3d4d	437500	upi	TRF1777724757206124917	2026-05-24	\N	\N	2026-05-02 17:55:57.207404+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.207404+05:30
0945c011-bf80-4c6c-a231-dfdd7a0dc486	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	3	ec6dda75-549b-4e80-a25e-38490c0b3d4d	437500	upi	TRF1777724757206554475	2026-11-20	\N	\N	2026-05-02 17:55:57.207666+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.207666+05:30
a0361e01-7d5f-47cc-8c32-e6f301dd4ba3	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	4	ec6dda75-549b-4e80-a25e-38490c0b3d4d	437500	bank_transfer	TRF1777724757207917223	2027-05-19	\N	\N	2026-05-02 17:55:57.208027+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.208027+05:30
958105c1-6f79-4ebf-a824-704ce6b6395c	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	2	ec6dda75-549b-4e80-a25e-38490c0b3d4d	437500	upi	TRF1777724757207982876	2026-05-24	\N	\N	2026-05-02 17:55:57.208293+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.208293+05:30
d47f1c37-c73c-4828-89b5-b24c2b338011	fd8e90dd-6794-44a8-ae6f-56c0ff47503d	3	ec6dda75-549b-4e80-a25e-38490c0b3d4d	437500	neft	TRF1777724757207083385	2026-11-20	\N	\N	2026-05-02 17:55:57.20866+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.20866+05:30
87d73f1c-417b-4d3d-9462-70b078472131	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	0	e19ed374-a7fb-467d-92ee-581c7224d42a	350000	upi	TRF1777724757208985535	2026-01-28	\N	\N	2026-05-02 17:55:57.20973+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.20973+05:30
79e071ec-a2d6-4a18-a149-fe6d2ebf163b	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	1	e19ed374-a7fb-467d-92ee-581c7224d42a	700000	bank_transfer	TRF1777724757209498339	2026-04-03	\N	\N	2026-05-02 17:55:57.210143+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.210143+05:30
45693f51-397f-49ca-aecb-34be5ab33a3e	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	2	e19ed374-a7fb-467d-92ee-581c7224d42a	437500	rtgs	TRF1777724757209314941	2026-09-30	\N	\N	2026-05-02 17:55:57.2105+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.2105+05:30
f79af980-bc2a-4223-b994-e1c32b65a27c	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	3	e19ed374-a7fb-467d-92ee-581c7224d42a	437500	upi	TRF1777724757209028407	2027-03-29	\N	\N	2026-05-02 17:55:57.210918+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.210918+05:30
9f6d2b0c-73f0-4e9e-979c-764b379890ec	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	4	e19ed374-a7fb-467d-92ee-581c7224d42a	437500	neft	TRF1777724757210600231	2027-09-25	\N	\N	2026-05-02 17:55:57.211428+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.211428+05:30
934ceeaa-3a7c-4a10-9832-aeffcd7446a4	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	2	e19ed374-a7fb-467d-92ee-581c7224d42a	437500	rtgs	TRF1777724757210395051	2026-09-30	\N	\N	2026-05-02 17:55:57.211777+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.211777+05:30
e9a272fc-524e-497a-ad1d-67f696871835	bfb8837a-b5ef-49c8-a8e8-300e8ece7f7e	3	e19ed374-a7fb-467d-92ee-581c7224d42a	437500	rtgs	TRF1777724757211340591	2027-03-29	\N	\N	2026-05-02 17:55:57.212202+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 17:55:57.212202+05:30
466f60d5-6c98-4236-9290-8e22d6d0cb0a	a2000000-0000-0000-0000-000000000001	1	d0000000-0000-0000-0000-000000000001	50000	neft	NEFT2026050200001	2026-05-02	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	REC-2026-0001	2026-05-02 21:02:21.388151+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 21:02:21.388151+05:30
91f1b617-b091-4fa3-bfc5-00f91b8c055c	a2000000-0000-0000-0000-000000000001	1	d0000000-0000-0000-0000-000000000001	25000	cheque	CHQ123456789	2026-05-02	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	REC-2026-0002	2026-05-02 21:02:33.062441+05:30	pending	\N	\N	not_printed	pending	\N	\N	2026-05-02 21:02:33.062441+05:30
\.


--
-- Data for Name: registry_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registry_details (id, allocation_id, unit_id, consumer_id, appointment_date, registry_date, stamp_duty_amount, conveyance_deed_no, status, remarks, created_at, updated_at) FROM stdin;
1b4d58c8-4e43-4e14-81ef-123751aa0e52	6fd02ed1-829b-4171-911f-b2b244e28c8e	ab74d555-5f4e-411f-ac34-19c02821ea64	c225e226-fc55-47c4-9905-26b52a33f960	2026-05-02	\N	0	\N	scheduled		2026-05-02 21:29:10.846473+05:30	2026-05-02 21:29:10.846473+05:30
\.


--
-- Data for Name: remarks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remarks (id, consumer_id, user_id, "timestamp", channel, subject, notes, follow_up_date, follow_up_action, tags) FROM stdin;
\.


--
-- Data for Name: reminder_master; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reminder_master (id, project_id, reminder_name, prefix_name, rank, days, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, is_custom, created_at, created_by_user_id) FROM stdin;
\.


--
-- Data for Name: salutations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salutations (id, name, created_at) FROM stdin;
5227bf67-d8e9-45c7-a8ff-c01cdf42286a	Mr.	2026-04-30 02:30:21.682923+05:30
cf593766-1ff7-4401-ad5c-5a5c0aaf8163	Mrs.	2026-04-30 02:30:21.682923+05:30
937e796e-b2e2-44de-8e73-413260ab580d	Ms.	2026-04-30 02:30:21.682923+05:30
98dfa924-834b-4f2c-b63f-6632c3130ca9	Dr.	2026-04-30 02:30:21.682923+05:30
77623ef3-cb28-4b7f-b837-374de6664ec6	Er.	2026-04-30 02:30:21.682923+05:30
f60e2c38-071a-4c99-ac06-387a37d89e2c	CA	2026-04-30 02:30:21.682923+05:30
2279ac80-fcb2-48f4-ba57-7257ffc3b29f	Adv.	2026-04-30 02:30:21.682923+05:30
\.


--
-- Data for Name: sources_of_enquiry; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sources_of_enquiry (id, name, description, created_at) FROM stdin;
f1f30eed-a311-4789-8f4a-1cdd5cfe2c5e	Walk-in	\N	2026-04-30 02:30:21.682923+05:30
878f5088-45be-44e7-b41b-4c37e57bbf82	Website	\N	2026-04-30 02:30:21.682923+05:30
6a91a1c3-f7ed-4fe6-a1b4-292db7782e9e	Referral	\N	2026-04-30 02:30:21.682923+05:30
3576dd2f-9646-4e4f-93bb-0a376bb31a19	Broker	\N	2026-04-30 02:30:21.682923+05:30
882220ef-a69a-4ad3-956b-a48ae989695f	Advertisement	\N	2026-04-30 02:30:21.682923+05:30
499baefd-5b7e-4fe4-898d-39f259d4dd26	Social Media	\N	2026-04-30 02:30:21.682923+05:30
fb86285b-ec97-4a64-86bf-be4fffe059f0	Hoarding/Banner	\N	2026-04-30 02:30:21.682923+05:30
7977c238-80cc-4115-bfea-477401e1309e	Exhibition	\N	2026-04-30 02:30:21.682923+05:30
8c258ce7-c2c5-445e-9261-d53390a8a4fa	Cold Call	\N	2026-04-30 02:30:21.682923+05:30
9e41beaf-55df-4945-bb11-10e2c3fcbbc6	Email Campaign	\N	2026-04-30 02:30:21.682923+05:30
85858d02-0e08-4552-8d4a-cd7f4f5f7f37	WhatsApp	\N	2026-04-30 02:30:21.682923+05:30
6c910347-4e50-4d35-9593-192ec32a99ad	Other	\N	2026-04-30 02:30:21.682923+05:30
\.


--
-- Data for Name: states; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.states (id, name, country_id, code, created_at) FROM stdin;
1da36814-1ea0-4277-b716-e506c168cfa8	Uttarakhand	af4c55f4-fb67-4311-a376-43872ee32193	UK	2026-04-30 02:43:08.545172+05:30
9bc90d0e-7b86-4900-8016-4150237e3c45	Himachal Pradesh	af4c55f4-fb67-4311-a376-43872ee32193	HP	2026-04-30 02:43:08.545172+05:30
5f9182c8-e1cb-4172-977f-d8f4569f5724	Telangana	af4c55f4-fb67-4311-a376-43872ee32193	TG	2026-04-30 02:43:08.545172+05:30
99a4ef5f-2502-4303-a64f-80927ba96691	West Bengal	af4c55f4-fb67-4311-a376-43872ee32193	WB	2026-04-30 02:43:08.545172+05:30
ff65009c-1efc-41f8-95b8-2c138c2bf7e1	Madhya Pradesh	af4c55f4-fb67-4311-a376-43872ee32193	MP	2026-04-30 02:43:08.545172+05:30
24586b4d-ebc3-4f7e-9cde-a490254c462c	Gujarat	af4c55f4-fb67-4311-a376-43872ee32193	GJ	2026-04-30 02:43:08.545172+05:30
b1cbf391-e9ad-4c77-a701-a6b561887ba5	Tamil Nadu	af4c55f4-fb67-4311-a376-43872ee32193	TN	2026-04-30 02:43:08.545172+05:30
3ec01011-0d1d-488b-8035-58308080c4f6	Karnataka	af4c55f4-fb67-4311-a376-43872ee32193	KA	2026-04-30 02:43:08.545172+05:30
f2c0951f-e7a1-42c8-b04b-1c8a537372a4	Maharashtra	af4c55f4-fb67-4311-a376-43872ee32193	MH	2026-04-30 02:43:08.545172+05:30
2da5d13b-8316-40d8-a153-e7bced2c5918	Punjab	af4c55f4-fb67-4311-a376-43872ee32193	PB	2026-04-30 02:43:08.545172+05:30
ed834fe1-fe8b-4c4e-989f-584be875aa50	Rajasthan	af4c55f4-fb67-4311-a376-43872ee32193	RJ	2026-04-30 02:43:08.545172+05:30
7809cfb2-ec95-4c98-9003-2c817aed6e76	Uttar Pradesh	af4c55f4-fb67-4311-a376-43872ee32193	UP	2026-04-30 02:43:08.545172+05:30
d8f4ddfd-a2e5-4808-a308-051ae8ba4326	Delhi	af4c55f4-fb67-4311-a376-43872ee32193	DL	2026-04-30 02:43:08.545172+05:30
08430fee-34ad-4b9a-9ddd-83f779b52b33	Haryana	af4c55f4-fb67-4311-a376-43872ee32193	HR	2026-04-30 02:43:08.545172+05:30
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_tickets (id, consumer_id, subject, description, priority, status, assigned_to_user_id, created_by_user_id, sla_breach_at, resolved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: surrender_applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.surrender_applications (id, consumer_id, allocation_id, project_id, unit_id, surrender_date, reason, forfeiture_amount_inr, refund_amount_inr, status, approved_by, approved_at, created_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, status, priority, due_date, assigned_to, created_by, consumer_id, completed_at, created_at, updated_at) FROM stdin;
80000000-0000-0000-0000-000000000001	Follow up on payment	Amit requested call back after 2pm	open	high	2026-05-01	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	\N	d0000000-0000-0000-0000-000000000001	\N	2026-05-01 10:23:33.02012+05:30	2026-05-01 10:23:33.02012+05:30
\.


--
-- Data for Name: tax_slabs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_slabs (id, name, cgst_percent, sgst_percent, igst_percent, effective_from, is_active, created_at) FROM stdin;
cdbfed5c-a42f-450e-a308-8f9fb2aaf3a9	Residential GST (1%)	0.50	0.50	0.00	2026-04-30	t	2026-04-30 18:41:42.988588+05:30
f7bdf9db-3ae7-4608-892c-164dc9f50dc5	Residential GST (5%)	2.50	2.50	0.00	2026-04-30	t	2026-04-30 18:41:42.988588+05:30
7acaaef6-55fb-4a07-bd47-e1f735fc931f	Commercial GST (12%)	6.00	6.00	0.00	2026-04-30	t	2026-04-30 18:41:42.988588+05:30
c3a503a7-5783-4a93-afcc-1777686dad06	Commercial GST (18%)	9.00	9.00	0.00	2026-04-30	t	2026-04-30 18:41:42.988588+05:30
\.


--
-- Data for Name: tds_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tds_assignments (id, challan_id, consumer_id, receipt_id, amount_assigned, assigned_at) FROM stdin;
\.


--
-- Data for Name: tds_challans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tds_challans (id, challan_number, challan_date, amount, bank_name, bsr_code, financial_year, quarter, file_url, status, created_at) FROM stdin;
5a1a2d18-b10b-49ad-875e-7486d27e045e	TDS-2026-0001	2026-05-02	150000.00	ICICI Bank	0061130000000	\N	\N	\N	available	2026-05-02 21:02:53.793134+05:30
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.team_members (id, team_id, user_id, role_in_team, joined_at) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teams (id, name, department_id, team_head_id, description, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: towers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.towers (id, project_id, tower_name, floors, units_per_floor, created_at, updated_at, deleted_at) FROM stdin;
b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	Ground	1	19	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000002	a0000000-0000-0000-0000-000000000002	Tower A	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000003	a0000000-0000-0000-0000-000000000002	Tower B	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000004	a0000000-0000-0000-0000-000000000002	Tower C	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000005	a0000000-0000-0000-0000-000000000002	Tower D	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000006	a0000000-0000-0000-0000-000000000002	Tower E	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
b0000000-0000-0000-0000-000000000007	a0000000-0000-0000-0000-000000000002	Tower F	15	1	2026-05-01 10:23:33.004397+05:30	2026-05-01 17:50:25.278685+05:30	\N
fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	Tower A	8	10	2026-05-02 17:55:57.019942+05:30	2026-05-02 17:55:57.019942+05:30	\N
da2b1767-d12a-46f8-a2b3-93520f311190	626fc003-bd10-473b-8c3a-16e7b97032d9	Tower A Phase 3	\N	\N	2026-05-02 18:56:28.317513+05:30	2026-05-02 19:13:00.115366+05:30	2026-05-02 19:13:00.115366+05:30
69f98f3c-2cce-4f2e-aad0-6fa4a68585b6	01306d9f-7d64-4e1e-89ec-1a1e19868540	Tower B	\N	\N	2026-05-01 18:17:06.248108+05:30	2026-05-02 19:14:21.931507+05:30	2026-05-02 19:14:21.931507+05:30
\.


--
-- Data for Name: unit_holds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_holds (id, unit_id, broker_id, client_name, client_mobile, held_at, expires_at, status, notes, created_by) FROM stdin;
\.


--
-- Data for Name: unit_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_locations (id, project_id, name, description, created_at) FROM stdin;
\.


--
-- Data for Name: unit_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_shifts (id, consumer_id, old_unit_id, new_unit_id, reason, shift_date, shifted_by_user_id, created_at) FROM stdin;
\.


--
-- Data for Name: unit_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_status_history (id, unit_id, previous_status, new_status, changed_at, changed_by_user_id, reason) FROM stdin;
21569334-49e0-4be6-8e1a-9b67125ec2f1	ab74d555-5f4e-411f-ac34-19c02821ea64	allotted	allotted	2026-05-02 20:14:59.002875+05:30	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Auto-promoted from waitlist on cancellation
\.


--
-- Data for Name: unit_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unit_types (id, project_id, name, description, carpet_area_sqft, balcony_area_sqft, base_rate_sqft, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: units; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.units (id, tower_id, project_id, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, facing, floor, balcony_area_sqft, base_price_inr, total_price_inr, floor_plan_url, status, status_changed_at, locked_reason, created_at, updated_at, created_by_user_id, unit_type_id, floor_id, registry_status, registry_date, mortgage_status, hold_status) FROM stdin;
c0000000-0000-0000-0000-000000000001	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-01	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000002	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-02	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000003	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-03	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000004	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-04	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000005	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-05	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000006	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-06	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000007	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-07	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000008	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-08	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000009	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-09	Shop	194	352	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000010	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-10	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000011	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-11	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000012	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-12	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000013	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-12A	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000014	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-14	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000015	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-15	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000016	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-16	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000017	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-17	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000018	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-18	Shop	129	235	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000019	b0000000-0000-0000-0000-000000000001	a0000000-0000-0000-0000-000000000001	G-19	Shop	161	293	\N	0	\N	\N	\N	\N	available	2026-05-01 10:23:33.006077+05:30	\N	2026-05-01 10:23:33.006077+05:30	2026-05-01 10:23:33.006077+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000020	b0000000-0000-0000-0000-000000000002	a0000000-0000-0000-0000-000000000002	A-101	Type-A (3 BHK)	646	\N	\N	\N	122	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000021	b0000000-0000-0000-0000-000000000002	a0000000-0000-0000-0000-000000000002	A-102	Type-A (3 BHK)	646	\N	\N	\N	122	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000022	b0000000-0000-0000-0000-000000000003	a0000000-0000-0000-0000-000000000002	B-1508	Type-B (2 BHK+ST)	646	\N	\N	\N	105	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000023	b0000000-0000-0000-0000-000000000003	a0000000-0000-0000-0000-000000000002	B-1204	Type-B (2 BHK+ST)	646	\N	\N	\N	105	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000024	b0000000-0000-0000-0000-000000000004	a0000000-0000-0000-0000-000000000002	C-905	Type-C (3 BHK)	646	\N	\N	\N	91	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000025	b0000000-0000-0000-0000-000000000004	a0000000-0000-0000-0000-000000000002	C-906	Type-C (3 BHK)	646	\N	\N	\N	91	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000026	b0000000-0000-0000-0000-000000000005	a0000000-0000-0000-0000-000000000002	D-303	Type-D (2 BHK+ST)	646	\N	\N	\N	120	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000027	b0000000-0000-0000-0000-000000000005	a0000000-0000-0000-0000-000000000002	D-304	Type-D (2 BHK+ST)	646	\N	\N	\N	120	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000028	b0000000-0000-0000-0000-000000000006	a0000000-0000-0000-0000-000000000002	E-101	Type-A (3 BHK)	646	\N	\N	\N	122	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000029	b0000000-0000-0000-0000-000000000006	a0000000-0000-0000-0000-000000000002	E-102	Type-A (3 BHK)	646	\N	\N	\N	122	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000030	b0000000-0000-0000-0000-000000000007	a0000000-0000-0000-0000-000000000002	F-101	Type-1A (1 BHK)	409	\N	\N	\N	79	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
c0000000-0000-0000-0000-000000000031	b0000000-0000-0000-0000-000000000007	a0000000-0000-0000-0000-000000000002	F-102	Type-1A (1 BHK)	409	\N	\N	\N	79	\N	\N	\N	available	2026-05-01 10:23:33.008417+05:30	\N	2026-05-01 10:23:33.008417+05:30	2026-05-01 10:23:33.008417+05:30	\N	\N	\N	f	\N	f	f
be8f73ba-c527-46f9-a4ee-a1409a86a289	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1B	1.5BHK	750	938	North	1	112	4000000	4720000	\N	allotted	2026-05-02 17:55:57.025144+05:30	\N	2026-05-02 17:55:57.025144+05:30	2026-05-02 17:55:57.0898+05:30	\N	\N	\N	f	\N	f	f
0687f0bd-dd4c-4e13-b029-fe03a1d335aa	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1C	1BHK	550	688	West	1	82	4000000	4720000	\N	allotted	2026-05-02 17:55:57.02623+05:30	\N	2026-05-02 17:55:57.02623+05:30	2026-05-02 17:55:57.091234+05:30	\N	\N	\N	f	\N	f	f
68ed1a68-94f6-43f2-b734-752c3b72e55e	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1D	1BHK	550	688	North	1	82	4000000	4720000	\N	allotted	2026-05-02 17:55:57.026889+05:30	\N	2026-05-02 17:55:57.026889+05:30	2026-05-02 17:55:57.092353+05:30	\N	\N	\N	f	\N	f	f
a1d51fc3-7785-46ce-896f-3d8fbf4d5a28	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1E	1BHK	550	688	North	1	82	5000000	5900000	\N	allotted	2026-05-02 17:55:57.027521+05:30	\N	2026-05-02 17:55:57.027521+05:30	2026-05-02 17:55:57.093659+05:30	\N	\N	\N	f	\N	f	f
8ed5e181-0c94-440c-9891-fb31741ecc1b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1F	1.5BHK	750	938	South	1	112	3500000	4130000	\N	allotted	2026-05-02 17:55:57.028464+05:30	\N	2026-05-02 17:55:57.028464+05:30	2026-05-02 17:55:57.094693+05:30	\N	\N	\N	f	\N	f	f
628faa0a-fa9d-4f4f-b924-156db77a0e05	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1G	2BHK	950	1188	East	1	142	5000000	5900000	\N	allotted	2026-05-02 17:55:57.029397+05:30	\N	2026-05-02 17:55:57.029397+05:30	2026-05-02 17:55:57.096077+05:30	\N	\N	\N	f	\N	f	f
5aa53b12-4a5b-4d58-a920-f85569971a90	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1H	1BHK	550	688	North	1	82	3500000	4130000	\N	allotted	2026-05-02 17:55:57.030122+05:30	\N	2026-05-02 17:55:57.030122+05:30	2026-05-02 17:55:57.097045+05:30	\N	\N	\N	f	\N	f	f
184ccaf3-9af3-4e04-86b3-84eec1301a9d	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1I	2BHK	950	1188	West	1	142	3500000	4130000	\N	allotted	2026-05-02 17:55:57.030682+05:30	\N	2026-05-02 17:55:57.030682+05:30	2026-05-02 17:55:57.097925+05:30	\N	\N	\N	f	\N	f	f
0901a207-bb0a-444d-97b9-94315f89c6d8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1J	1.5BHK	750	938	North	1	112	4000000	4720000	\N	allotted	2026-05-02 17:55:57.03143+05:30	\N	2026-05-02 17:55:57.03143+05:30	2026-05-02 17:55:57.098942+05:30	\N	\N	\N	f	\N	f	f
5832292b-42ea-4ee1-a8d6-8aae929a5454	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2A	1BHK	550	688	South	2	82	4000000	4720000	\N	allotted	2026-05-02 17:55:57.031917+05:30	\N	2026-05-02 17:55:57.031917+05:30	2026-05-02 17:55:57.10017+05:30	\N	\N	\N	f	\N	f	f
9adfbcc2-7860-4e49-b922-7d9afe25e4d4	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2B	2BHK	950	1188	South	2	142	3500000	4130000	\N	allotted	2026-05-02 17:55:57.032413+05:30	\N	2026-05-02 17:55:57.032413+05:30	2026-05-02 17:55:57.101146+05:30	\N	\N	\N	f	\N	f	f
a5224ea5-a9ef-43f4-84ea-2fe7962c5cf4	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2C	1BHK	550	688	East	2	82	4000000	4720000	\N	allotted	2026-05-02 17:55:57.03309+05:30	\N	2026-05-02 17:55:57.03309+05:30	2026-05-02 17:55:57.102061+05:30	\N	\N	\N	f	\N	f	f
182bee17-4938-475c-a9e1-63b280a0bd39	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2D	1.5BHK	750	938	South	2	112	4000000	4720000	\N	allotted	2026-05-02 17:55:57.033459+05:30	\N	2026-05-02 17:55:57.033459+05:30	2026-05-02 17:55:57.102784+05:30	\N	\N	\N	f	\N	f	f
d557893a-282d-42bb-81d5-eaf78ffd3b9a	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2E	1BHK	550	688	South	2	82	3500000	4130000	\N	allotted	2026-05-02 17:55:57.033709+05:30	\N	2026-05-02 17:55:57.033709+05:30	2026-05-02 17:55:57.103729+05:30	\N	\N	\N	f	\N	f	f
0ce4e4e5-8607-419e-9b6b-426759ae4e1a	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2F	1.5BHK	750	938	West	2	112	4000000	4720000	\N	allotted	2026-05-02 17:55:57.033938+05:30	\N	2026-05-02 17:55:57.033938+05:30	2026-05-02 17:55:57.104807+05:30	\N	\N	\N	f	\N	f	f
2a2386c4-e84a-4b83-b239-9c2e778a430c	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2G	2BHK	950	1188	West	2	142	3500000	4130000	\N	allotted	2026-05-02 17:55:57.034147+05:30	\N	2026-05-02 17:55:57.034147+05:30	2026-05-02 17:55:57.105889+05:30	\N	\N	\N	f	\N	f	f
618ce32d-47f7-4e89-9a2f-bc20519e83d2	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2H	2BHK	950	1188	West	2	142	4000000	4720000	\N	allotted	2026-05-02 17:55:57.03435+05:30	\N	2026-05-02 17:55:57.03435+05:30	2026-05-02 17:55:57.106826+05:30	\N	\N	\N	f	\N	f	f
2cda2328-170d-4d04-92ff-55773c84279a	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2I	2BHK	950	1188	West	2	142	3500000	4130000	\N	allotted	2026-05-02 17:55:57.034664+05:30	\N	2026-05-02 17:55:57.034664+05:30	2026-05-02 17:55:57.107925+05:30	\N	\N	\N	f	\N	f	f
fd1b4279-63f8-4947-a94a-4b8623af50c1	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4C	1BHK	550	688	South	4	82	3500000	4130000	\N	available	2026-05-02 17:55:57.040511+05:30	\N	2026-05-02 17:55:57.040511+05:30	2026-05-02 17:55:57.040511+05:30	\N	\N	\N	f	\N	f	f
58f80cb0-0d11-4008-b0b4-0e7d5a36cf3d	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4D	1BHK	550	688	South	4	82	4500000	5310000	\N	available	2026-05-02 17:55:57.040861+05:30	\N	2026-05-02 17:55:57.040861+05:30	2026-05-02 17:55:57.040861+05:30	\N	\N	\N	f	\N	f	f
81ca9673-458f-4275-81cb-6219c6573ad8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4E	1BHK	550	688	North	4	82	5000000	5900000	\N	available	2026-05-02 17:55:57.041178+05:30	\N	2026-05-02 17:55:57.041178+05:30	2026-05-02 17:55:57.041178+05:30	\N	\N	\N	f	\N	f	f
d73d2050-2ae4-4d74-bc73-9a4404c38645	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4F	2BHK	950	1188	South	4	142	4000000	4720000	\N	available	2026-05-02 17:55:57.04141+05:30	\N	2026-05-02 17:55:57.04141+05:30	2026-05-02 17:55:57.04141+05:30	\N	\N	\N	f	\N	f	f
7e0a49bf-d7cd-4ff0-9e56-36b775a6288d	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4G	1BHK	550	688	West	4	82	4000000	4720000	\N	available	2026-05-02 17:55:57.041622+05:30	\N	2026-05-02 17:55:57.041622+05:30	2026-05-02 17:55:57.041622+05:30	\N	\N	\N	f	\N	f	f
ce7460d5-2f42-4191-88c8-87ec3034661b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4H	2BHK	950	1188	North	4	142	5000000	5900000	\N	available	2026-05-02 17:55:57.041909+05:30	\N	2026-05-02 17:55:57.041909+05:30	2026-05-02 17:55:57.041909+05:30	\N	\N	\N	f	\N	f	f
e5bfc595-33af-429f-bdea-fe4ef9d028a2	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4I	1.5BHK	750	938	North	4	112	3500000	4130000	\N	available	2026-05-02 17:55:57.042205+05:30	\N	2026-05-02 17:55:57.042205+05:30	2026-05-02 17:55:57.042205+05:30	\N	\N	\N	f	\N	f	f
c543f442-61c6-441b-8ad3-125db9c6d0f0	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4J	2BHK	950	1188	North	4	142	5000000	5900000	\N	available	2026-05-02 17:55:57.042595+05:30	\N	2026-05-02 17:55:57.042595+05:30	2026-05-02 17:55:57.042595+05:30	\N	\N	\N	f	\N	f	f
d6868044-51ae-491d-b0fb-a2e6c0e451b9	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5A	1BHK	550	688	West	5	82	3500000	4130000	\N	available	2026-05-02 17:55:57.042925+05:30	\N	2026-05-02 17:55:57.042925+05:30	2026-05-02 17:55:57.042925+05:30	\N	\N	\N	f	\N	f	f
88b289ff-e121-4f15-8f2b-27db4cfdfaea	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5B	1BHK	550	688	East	5	82	3500000	4130000	\N	available	2026-05-02 17:55:57.043505+05:30	\N	2026-05-02 17:55:57.043505+05:30	2026-05-02 17:55:57.043505+05:30	\N	\N	\N	f	\N	f	f
0b3ace9e-c0ab-4dbe-9ee4-7ad762c4a0d1	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5C	1BHK	550	688	South	5	82	3500000	4130000	\N	available	2026-05-02 17:55:57.04396+05:30	\N	2026-05-02 17:55:57.04396+05:30	2026-05-02 17:55:57.04396+05:30	\N	\N	\N	f	\N	f	f
ac56d6a9-7cbd-459d-9c91-f991c82b7ea8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5D	1.5BHK	750	938	North	5	112	4500000	5310000	\N	available	2026-05-02 17:55:57.044535+05:30	\N	2026-05-02 17:55:57.044535+05:30	2026-05-02 17:55:57.044535+05:30	\N	\N	\N	f	\N	f	f
3cb33a53-5c0f-4faa-824d-129ee5586e94	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5E	1BHK	550	688	East	5	82	4500000	5310000	\N	available	2026-05-02 17:55:57.045173+05:30	\N	2026-05-02 17:55:57.045173+05:30	2026-05-02 17:55:57.045173+05:30	\N	\N	\N	f	\N	f	f
0555631b-2002-4108-aaa5-55d588ac1efa	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5F	2BHK	950	1188	East	5	142	3500000	4130000	\N	available	2026-05-02 17:55:57.045614+05:30	\N	2026-05-02 17:55:57.045614+05:30	2026-05-02 17:55:57.045614+05:30	\N	\N	\N	f	\N	f	f
14576b25-f613-4751-b7ed-06c6d51eb4f2	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5G	1BHK	550	688	North	5	82	3500000	4130000	\N	available	2026-05-02 17:55:57.046206+05:30	\N	2026-05-02 17:55:57.046206+05:30	2026-05-02 17:55:57.046206+05:30	\N	\N	\N	f	\N	f	f
9772616e-a9b0-490c-9c02-b1065f7267e6	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5H	2BHK	950	1188	West	5	142	4500000	5310000	\N	available	2026-05-02 17:55:57.046571+05:30	\N	2026-05-02 17:55:57.046571+05:30	2026-05-02 17:55:57.046571+05:30	\N	\N	\N	f	\N	f	f
a4b50de9-0478-42c3-bf9c-f49132528e1b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5I	1.5BHK	750	938	North	5	112	5000000	5900000	\N	available	2026-05-02 17:55:57.046916+05:30	\N	2026-05-02 17:55:57.046916+05:30	2026-05-02 17:55:57.046916+05:30	\N	\N	\N	f	\N	f	f
e33a24e2-547e-4b5a-90ef-a1444b31908b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	5J	1BHK	550	688	North	5	82	3500000	4130000	\N	available	2026-05-02 17:55:57.04739+05:30	\N	2026-05-02 17:55:57.04739+05:30	2026-05-02 17:55:57.04739+05:30	\N	\N	\N	f	\N	f	f
ec220c16-f887-48a9-b6d5-37b3affb45fd	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6A	1.5BHK	750	938	East	6	112	4500000	5310000	\N	available	2026-05-02 17:55:57.047981+05:30	\N	2026-05-02 17:55:57.047981+05:30	2026-05-02 17:55:57.047981+05:30	\N	\N	\N	f	\N	f	f
51d8bab3-69b7-4f82-945f-63298abd860c	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6B	1.5BHK	750	938	North	6	112	5000000	5900000	\N	available	2026-05-02 17:55:57.048349+05:30	\N	2026-05-02 17:55:57.048349+05:30	2026-05-02 17:55:57.048349+05:30	\N	\N	\N	f	\N	f	f
169d6338-677e-4079-8469-7c4125c77eef	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6C	1.5BHK	750	938	North	6	112	5000000	5900000	\N	available	2026-05-02 17:55:57.048606+05:30	\N	2026-05-02 17:55:57.048606+05:30	2026-05-02 17:55:57.048606+05:30	\N	\N	\N	f	\N	f	f
334c8a1f-45dc-4853-914c-3113fa948363	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6D	1BHK	550	688	South	6	82	4500000	5310000	\N	available	2026-05-02 17:55:57.048912+05:30	\N	2026-05-02 17:55:57.048912+05:30	2026-05-02 17:55:57.048912+05:30	\N	\N	\N	f	\N	f	f
72a1e990-b0e9-425a-985f-0e39765d3fa3	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6E	1.5BHK	750	938	West	6	112	5000000	5900000	\N	available	2026-05-02 17:55:57.049199+05:30	\N	2026-05-02 17:55:57.049199+05:30	2026-05-02 17:55:57.049199+05:30	\N	\N	\N	f	\N	f	f
fbf5ed5c-7000-48bc-a59e-4e6fd2ddf892	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6F	1.5BHK	750	938	South	6	112	3500000	4130000	\N	available	2026-05-02 17:55:57.049543+05:30	\N	2026-05-02 17:55:57.049543+05:30	2026-05-02 17:55:57.049543+05:30	\N	\N	\N	f	\N	f	f
421a0010-3827-43cc-b6b5-c927637c6844	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6G	1BHK	550	688	North	6	82	3500000	4130000	\N	available	2026-05-02 17:55:57.049784+05:30	\N	2026-05-02 17:55:57.049784+05:30	2026-05-02 17:55:57.049784+05:30	\N	\N	\N	f	\N	f	f
9980f9d7-a9e0-4ab1-bcda-76c07e8ff4e7	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6H	2BHK	950	1188	South	6	142	4500000	5310000	\N	available	2026-05-02 17:55:57.050009+05:30	\N	2026-05-02 17:55:57.050009+05:30	2026-05-02 17:55:57.050009+05:30	\N	\N	\N	f	\N	f	f
12fb98ca-28d4-4efc-bd0f-da3af76228a8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6I	1BHK	550	688	East	6	82	3500000	4130000	\N	available	2026-05-02 17:55:57.050386+05:30	\N	2026-05-02 17:55:57.050386+05:30	2026-05-02 17:55:57.050386+05:30	\N	\N	\N	f	\N	f	f
0def1f1d-44be-454d-828c-6479a6466944	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	6J	1.5BHK	750	938	South	6	112	4000000	4720000	\N	available	2026-05-02 17:55:57.050662+05:30	\N	2026-05-02 17:55:57.050662+05:30	2026-05-02 17:55:57.050662+05:30	\N	\N	\N	f	\N	f	f
1ee4c92a-ae4b-461c-8f9b-f25c16ec4dad	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7A	2BHK	950	1188	North	7	142	3500000	4130000	\N	available	2026-05-02 17:55:57.050972+05:30	\N	2026-05-02 17:55:57.050972+05:30	2026-05-02 17:55:57.050972+05:30	\N	\N	\N	f	\N	f	f
c36257da-4c53-45bf-9b85-a24f201065ee	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7B	1.5BHK	750	938	West	7	112	3500000	4130000	\N	available	2026-05-02 17:55:57.051419+05:30	\N	2026-05-02 17:55:57.051419+05:30	2026-05-02 17:55:57.051419+05:30	\N	\N	\N	f	\N	f	f
b1c358db-561d-4c2c-a544-7ec739ca01c7	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7C	2BHK	950	1188	West	7	142	4500000	5310000	\N	available	2026-05-02 17:55:57.051674+05:30	\N	2026-05-02 17:55:57.051674+05:30	2026-05-02 17:55:57.051674+05:30	\N	\N	\N	f	\N	f	f
0ad7fd7c-391c-40ee-9790-2864ded5d6e0	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7D	2BHK	950	1188	South	7	142	3500000	4130000	\N	available	2026-05-02 17:55:57.051912+05:30	\N	2026-05-02 17:55:57.051912+05:30	2026-05-02 17:55:57.051912+05:30	\N	\N	\N	f	\N	f	f
ea329da1-6168-433d-969b-e2c09429e105	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7E	1.5BHK	750	938	West	7	112	3500000	4130000	\N	available	2026-05-02 17:55:57.052149+05:30	\N	2026-05-02 17:55:57.052149+05:30	2026-05-02 17:55:57.052149+05:30	\N	\N	\N	f	\N	f	f
622c5913-3c8f-435f-9d3c-46aa69562f49	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3A	2BHK	950	1188	East	3	142	4500000	5310000	\N	allotted	2026-05-02 17:55:57.036572+05:30	\N	2026-05-02 17:55:57.036572+05:30	2026-05-02 17:55:57.109894+05:30	\N	\N	\N	f	\N	f	f
f7afaefb-64ff-4f9a-baa2-7fc130b2b6ea	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3B	2BHK	950	1188	North	3	142	3500000	4130000	\N	allotted	2026-05-02 17:55:57.036807+05:30	\N	2026-05-02 17:55:57.036807+05:30	2026-05-02 17:55:57.110725+05:30	\N	\N	\N	f	\N	f	f
4c31c57d-2475-47fd-8ee2-178a6a76e6f0	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3C	2BHK	950	1188	North	3	142	4000000	4720000	\N	allotted	2026-05-02 17:55:57.037153+05:30	\N	2026-05-02 17:55:57.037153+05:30	2026-05-02 17:55:57.111628+05:30	\N	\N	\N	f	\N	f	f
360af183-3c6d-456c-90cb-c2ebce9b8450	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3E	1BHK	550	688	East	3	82	4000000	4720000	\N	allotted	2026-05-02 17:55:57.037576+05:30	\N	2026-05-02 17:55:57.037576+05:30	2026-05-02 17:55:57.112981+05:30	\N	\N	\N	f	\N	f	f
9b429a8d-d6c5-4d8c-a617-1561e496566a	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3F	2BHK	950	1188	South	3	142	5000000	5900000	\N	allotted	2026-05-02 17:55:57.037841+05:30	\N	2026-05-02 17:55:57.037841+05:30	2026-05-02 17:55:57.114046+05:30	\N	\N	\N	f	\N	f	f
e3dc77da-9cdc-4118-9402-7f516785c9be	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3G	1.5BHK	750	938	West	3	112	4500000	5310000	\N	allotted	2026-05-02 17:55:57.038041+05:30	\N	2026-05-02 17:55:57.038041+05:30	2026-05-02 17:55:57.115034+05:30	\N	\N	\N	f	\N	f	f
9d335430-8562-422d-93c1-ba7903496729	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3H	1.5BHK	750	938	East	3	112	4500000	5310000	\N	allotted	2026-05-02 17:55:57.038237+05:30	\N	2026-05-02 17:55:57.038237+05:30	2026-05-02 17:55:57.115767+05:30	\N	\N	\N	f	\N	f	f
6f31ff97-5605-4a80-822a-b490ed85de81	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3I	1.5BHK	750	938	West	3	112	4500000	5310000	\N	allotted	2026-05-02 17:55:57.038558+05:30	\N	2026-05-02 17:55:57.038558+05:30	2026-05-02 17:55:57.116478+05:30	\N	\N	\N	f	\N	f	f
c89490d0-4a76-49f8-98e2-982552961444	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3J	1BHK	550	688	West	3	82	4500000	5310000	\N	allotted	2026-05-02 17:55:57.039082+05:30	\N	2026-05-02 17:55:57.039082+05:30	2026-05-02 17:55:57.117098+05:30	\N	\N	\N	f	\N	f	f
7dce01af-144f-4a4f-9e8e-a33a31e104f8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4A	2BHK	950	1188	South	4	142	4000000	4720000	\N	allotted	2026-05-02 17:55:57.039396+05:30	\N	2026-05-02 17:55:57.039396+05:30	2026-05-02 17:55:57.11789+05:30	\N	\N	\N	f	\N	f	f
5e6ef3b5-5b7f-40ff-aced-9bd6bff03569	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	4B	1.5BHK	750	938	West	4	112	3500000	4130000	\N	allotted	2026-05-02 17:55:57.039732+05:30	\N	2026-05-02 17:55:57.039732+05:30	2026-05-02 17:55:57.11851+05:30	\N	\N	\N	f	\N	f	f
ab74d555-5f4e-411f-ac34-19c02821ea64	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	3D	2BHK	950	1188	North	3	142	4500000	5310000	\N	allotted	2026-05-02 20:14:59.002875+05:30	\N	2026-05-02 17:55:57.037367+05:30	2026-05-02 20:14:59.002875+05:30	\N	\N	\N	f	\N	f	f
394be63c-88e7-4605-92c8-160c1448d66b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7F	2BHK	950	1188	North	7	142	5000000	5900000	\N	available	2026-05-02 17:55:57.052374+05:30	\N	2026-05-02 17:55:57.052374+05:30	2026-05-02 17:55:57.052374+05:30	\N	\N	\N	f	\N	f	f
d81e8d58-0fcd-4df9-a9b6-5e3d47d63be8	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7G	2BHK	950	1188	East	7	142	3500000	4130000	\N	available	2026-05-02 17:55:57.052803+05:30	\N	2026-05-02 17:55:57.052803+05:30	2026-05-02 17:55:57.052803+05:30	\N	\N	\N	f	\N	f	f
bd8edb14-e175-4489-b4d1-4fe102b2d00e	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7H	1BHK	550	688	South	7	82	4000000	4720000	\N	available	2026-05-02 17:55:57.053038+05:30	\N	2026-05-02 17:55:57.053038+05:30	2026-05-02 17:55:57.053038+05:30	\N	\N	\N	f	\N	f	f
d029aa41-e994-4b38-9240-d8c190e93b81	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7I	2BHK	950	1188	East	7	142	4500000	5310000	\N	available	2026-05-02 17:55:57.05326+05:30	\N	2026-05-02 17:55:57.05326+05:30	2026-05-02 17:55:57.05326+05:30	\N	\N	\N	f	\N	f	f
dbb7c4a8-7191-470d-8e9c-06e180323894	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	7J	1BHK	550	688	North	7	82	5000000	5900000	\N	available	2026-05-02 17:55:57.053471+05:30	\N	2026-05-02 17:55:57.053471+05:30	2026-05-02 17:55:57.053471+05:30	\N	\N	\N	f	\N	f	f
903f9b89-9a2d-4113-b4eb-024a6a36abc4	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8A	2BHK	950	1188	West	8	142	4000000	4720000	\N	available	2026-05-02 17:55:57.053832+05:30	\N	2026-05-02 17:55:57.053832+05:30	2026-05-02 17:55:57.053832+05:30	\N	\N	\N	f	\N	f	f
d497b747-50a0-4cb8-9289-2901d882cd55	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8B	1BHK	550	688	West	8	82	4500000	5310000	\N	available	2026-05-02 17:55:57.05421+05:30	\N	2026-05-02 17:55:57.05421+05:30	2026-05-02 17:55:57.05421+05:30	\N	\N	\N	f	\N	f	f
269460b3-9479-4d9a-9495-4db264426119	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8C	2BHK	950	1188	East	8	142	4500000	5310000	\N	available	2026-05-02 17:55:57.054639+05:30	\N	2026-05-02 17:55:57.054639+05:30	2026-05-02 17:55:57.054639+05:30	\N	\N	\N	f	\N	f	f
28cfed06-7760-46eb-8340-b856fbf8e15e	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8D	1.5BHK	750	938	West	8	112	5000000	5900000	\N	available	2026-05-02 17:55:57.054879+05:30	\N	2026-05-02 17:55:57.054879+05:30	2026-05-02 17:55:57.054879+05:30	\N	\N	\N	f	\N	f	f
bc1ac33f-5122-4d01-a8ab-c173748c8df0	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8E	1BHK	550	688	South	8	82	3500000	4130000	\N	available	2026-05-02 17:55:57.055107+05:30	\N	2026-05-02 17:55:57.055107+05:30	2026-05-02 17:55:57.055107+05:30	\N	\N	\N	f	\N	f	f
a54e7498-35b6-430c-b9f4-4bbb4754f56c	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8F	1BHK	550	688	North	8	82	4000000	4720000	\N	available	2026-05-02 17:55:57.055324+05:30	\N	2026-05-02 17:55:57.055324+05:30	2026-05-02 17:55:57.055324+05:30	\N	\N	\N	f	\N	f	f
387c2832-e518-49e7-95e4-e81cbc59092e	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8G	2BHK	950	1188	East	8	142	4000000	4720000	\N	available	2026-05-02 17:55:57.055627+05:30	\N	2026-05-02 17:55:57.055627+05:30	2026-05-02 17:55:57.055627+05:30	\N	\N	\N	f	\N	f	f
12ef10bd-47ed-4425-9491-7b20e9179c1b	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8H	1.5BHK	750	938	North	8	112	3500000	4130000	\N	available	2026-05-02 17:55:57.055922+05:30	\N	2026-05-02 17:55:57.055922+05:30	2026-05-02 17:55:57.055922+05:30	\N	\N	\N	f	\N	f	f
d7575d10-c241-42c9-bb71-8f02fb8291e0	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8I	1BHK	550	688	North	8	82	3500000	4130000	\N	available	2026-05-02 17:55:57.056157+05:30	\N	2026-05-02 17:55:57.056157+05:30	2026-05-02 17:55:57.056157+05:30	\N	\N	\N	f	\N	f	f
3a2acbae-de4e-4b9e-8a59-ae46875220be	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	8J	2BHK	950	1188	North	8	142	3500000	4130000	\N	available	2026-05-02 17:55:57.056494+05:30	\N	2026-05-02 17:55:57.056494+05:30	2026-05-02 17:55:57.056494+05:30	\N	\N	\N	f	\N	f	f
6c7248f3-e2b9-49d0-85bb-364c1991ed08	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	1A	1.5BHK	750	938	East	1	112	4500000	5310000	\N	allotted	2026-05-02 17:55:57.023186+05:30	\N	2026-05-02 17:55:57.023186+05:30	2026-05-02 17:55:57.079143+05:30	\N	\N	\N	f	\N	f	f
7915d0ad-7320-4169-8575-fe92ade1a1e1	fa59caa4-2671-4cd7-a01f-e44b8aab9227	b1256171-9b71-4d0e-bcb5-0d8a77187087	2J	2BHK	950	1188	North	2	142	4000000	4720000	\N	allotted	2026-05-02 17:55:57.034883+05:30	\N	2026-05-02 17:55:57.034883+05:30	2026-05-02 17:55:57.109004+05:30	\N	\N	\N	f	\N	f	f
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, name, role_id, project_ids, department, created_at, last_login_at, status, role, mobile, password_hash, is_active, assigned_project_ids, created_by_user_id) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	testuser@rof.com	Test User	\N	\N	\N	2026-04-28 06:42:01.513846+05:30	\N	active	super_admin	\N	$2a$12$XQrcmI1YY1NZuHJng5xR1u5CQ4IbELN2H0lrhEzhO87Taq3U4jJwy	t	[]	\N
\.


--
-- Data for Name: waitlists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.waitlists (id, project_id, unit_type_or_unit_id, consumer_id, position_ordered, promoted_to_allocation_id, promoted_at, created_at) FROM stdin;
1a307690-2eb4-4a32-a0eb-db35e84c6876	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	3c7cc2ab-8f34-4f4c-88c7-d9efdd5bbb6a	2	\N	\N	2026-05-02 17:55:57.223234+05:30
e4ab9f00-cc26-414e-9f3a-1755c66ec4b9	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	a7074e69-7fc4-4367-a791-5f8c0be5abbb	3	\N	\N	2026-05-02 17:55:57.223512+05:30
68afccde-fb63-4ecb-a902-09aa6dfbd979	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	5e5f97ea-f96a-4aac-ab6e-93b497c432ee	4	\N	\N	2026-05-02 17:55:57.223902+05:30
94780048-ea42-483a-880e-579be623bf06	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	0ccb0e9b-4b67-4c79-8802-7ec0c63b188c	5	\N	\N	2026-05-02 17:55:57.224141+05:30
10206547-81e0-4a91-bcc5-b3375ac074d0	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	ef59f346-f6e5-4348-b27f-9310581b53f0	6	\N	\N	2026-05-02 17:55:57.224363+05:30
2ef7ab8f-1d7b-47a1-a80c-1f3aebdce7bf	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	2d70e395-f5a6-495f-9608-a3f124655def	7	\N	\N	2026-05-02 17:55:57.224581+05:30
cae65d3d-a371-4d79-b655-13842f1479d9	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	298d80b6-41e7-4547-8085-2d3a94afbde2	8	\N	\N	2026-05-02 17:55:57.224742+05:30
ca749f8a-2411-40cf-ade9-75abd8913875	b1256171-9b71-4d0e-bcb5-0d8a77187087	\N	c225e226-fc55-47c4-9905-26b52a33f960	1	6fd02ed1-829b-4171-911f-b2b244e28c8e	\N	2026-05-02 17:55:57.221998+05:30
\.


--
-- Data for Name: whatsapps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.whatsapps (id, consumer_id, user_id, direction, message_body, media_url, "timestamp", delivered_at, read_at) FROM stdin;
\.


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_unit_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_unit_id_status_key UNIQUE (unit_id, status);


--
-- Name: allotment_letters allotment_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allotment_letters
    ADD CONSTRAINT allotment_letters_pkey PRIMARY KEY (id);


--
-- Name: applicant_addresses applicant_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant_addresses
    ADD CONSTRAINT applicant_addresses_pkey PRIMARY KEY (id);


--
-- Name: applicant_details applicant_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant_details
    ADD CONSTRAINT applicant_details_pkey PRIMARY KEY (id);


--
-- Name: application_history application_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_imports bank_statement_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: banks banks_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_name_key UNIQUE (name);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: booking_forms booking_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_pkey PRIMARY KEY (id);


--
-- Name: booking_forms booking_forms_registration_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_registration_no_key UNIQUE (registration_no);


--
-- Name: booking_records booking_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_pkey PRIMARY KEY (id);


--
-- Name: broadcast_campaigns broadcast_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_pkey PRIMARY KEY (id);


--
-- Name: broker_applications broker_applications_broker_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_applications
    ADD CONSTRAINT broker_applications_broker_code_key UNIQUE (broker_code);


--
-- Name: broker_applications broker_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_applications
    ADD CONSTRAINT broker_applications_pkey PRIMARY KEY (id);


--
-- Name: broker_commissions broker_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_pkey PRIMARY KEY (id);


--
-- Name: broker_project_mapping broker_project_mapping_broker_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_broker_id_project_id_key UNIQUE (broker_id, project_id);


--
-- Name: broker_project_mapping broker_project_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_pkey PRIMARY KEY (id);


--
-- Name: broker_tax_config broker_tax_config_broker_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_broker_id_key UNIQUE (broker_id);


--
-- Name: broker_tax_config broker_tax_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_pkey PRIMARY KEY (id);


--
-- Name: brokers brokers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_metrics campaign_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: cancellations cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_pkey PRIMARY KEY (id);


--
-- Name: cheque_bounce_logs cheque_bounce_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cheque_bounce_logs
    ADD CONSTRAINT cheque_bounce_logs_pkey PRIMARY KEY (id);


--
-- Name: cities cities_name_state_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_name_state_id_key UNIQUE (name, state_id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: co_applicants co_applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.co_applicants
    ADD CONSTRAINT co_applicants_pkey PRIMARY KEY (id);


--
-- Name: communication_status_codes communication_status_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_status_codes
    ADD CONSTRAINT communication_status_codes_code_key UNIQUE (code);


--
-- Name: communication_status_codes communication_status_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communication_status_codes
    ADD CONSTRAINT communication_status_codes_pkey PRIMARY KEY (id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: construction_milestones construction_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_pkey PRIMARY KEY (id);


--
-- Name: consumer_folders consumer_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_pkey PRIMARY KEY (id);


--
-- Name: consumers consumers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_pkey PRIMARY KEY (id);


--
-- Name: consumers consumers_project_id_mobile_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_project_id_mobile_key UNIQUE (project_id, mobile);


--
-- Name: conveyance_deeds conveyance_deeds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_pkey PRIMARY KEY (id);


--
-- Name: countries countries_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_name_key UNIQUE (name);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: credit_debit_notes credit_debit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_note_number_key UNIQUE (note_number);


--
-- Name: credit_debit_notes credit_debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_pkey PRIMARY KEY (id);


--
-- Name: custom_reports custom_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_pkey PRIMARY KEY (id);


--
-- Name: demands demands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_dispatch document_dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_name_key UNIQUE (name);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: document_vault document_vault_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: draw_refunds draw_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_employee_code_key UNIQUE (employee_code);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_key UNIQUE (user_id);


--
-- Name: faq_articles faq_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_pkey PRIMARY KEY (id);


--
-- Name: faq_categories faq_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_categories
    ADD CONSTRAINT faq_categories_pkey PRIMARY KEY (id);


--
-- Name: floors floors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_pkey PRIMARY KEY (id);


--
-- Name: floors floors_tower_id_floor_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_tower_id_floor_number_key UNIQUE (tower_id, floor_number);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (key);


--
-- Name: gst_invoices gst_invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: gst_invoices gst_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_pkey PRIMARY KEY (id);


--
-- Name: gst_process_rights gst_process_rights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_pkey PRIMARY KEY (id);


--
-- Name: gst_process_rights gst_process_rights_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_user_id_key UNIQUE (user_id);


--
-- Name: head_wise_costs head_wise_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.head_wise_costs
    ADD CONSTRAINT head_wise_costs_pkey PRIMARY KEY (id);


--
-- Name: import_history import_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT import_history_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- Name: loan_details loan_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_details
    ADD CONSTRAINT loan_details_pkey PRIMARY KEY (id);


--
-- Name: nationalities nationalities_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nationalities
    ADD CONSTRAINT nationalities_name_key UNIQUE (name);


--
-- Name: nationalities nationalities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nationalities
    ADD CONSTRAINT nationalities_pkey PRIMARY KEY (id);


--
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_project_id_slot_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_project_id_slot_number_key UNIQUE (project_id, slot_number);


--
-- Name: parking_types parking_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_types
    ADD CONSTRAINT parking_types_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: penal_interests penal_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_pkey PRIMARY KEY (id);


--
-- Name: plan_schedule_templates plan_schedule_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_pkey PRIMARY KEY (id);


--
-- Name: professions professions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professions
    ADD CONSTRAINT professions_name_key UNIQUE (name);


--
-- Name: professions professions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.professions
    ADD CONSTRAINT professions_pkey PRIMARY KEY (id);


--
-- Name: project_smtp_configs project_smtp_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_pkey PRIMARY KEY (id);


--
-- Name: project_smtp_configs project_smtp_configs_project_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_project_id_key UNIQUE (project_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_rera_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_rera_number_key UNIQUE (rera_number);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: registry_details registry_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registry_details
    ADD CONSTRAINT registry_details_pkey PRIMARY KEY (id);


--
-- Name: remarks remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_pkey PRIMARY KEY (id);


--
-- Name: reminder_master reminder_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminder_master
    ADD CONSTRAINT reminder_master_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_is_custom_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_is_custom_key UNIQUE (name, is_custom);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salutations salutations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salutations
    ADD CONSTRAINT salutations_name_key UNIQUE (name);


--
-- Name: salutations salutations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salutations
    ADD CONSTRAINT salutations_pkey PRIMARY KEY (id);


--
-- Name: sources_of_enquiry sources_of_enquiry_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sources_of_enquiry
    ADD CONSTRAINT sources_of_enquiry_name_key UNIQUE (name);


--
-- Name: sources_of_enquiry sources_of_enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sources_of_enquiry
    ADD CONSTRAINT sources_of_enquiry_pkey PRIMARY KEY (id);


--
-- Name: states states_name_country_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_country_id_key UNIQUE (name, country_id);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: surrender_applications surrender_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tax_slabs tax_slabs_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_slabs
    ADD CONSTRAINT tax_slabs_name_key UNIQUE (name);


--
-- Name: tax_slabs tax_slabs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_slabs
    ADD CONSTRAINT tax_slabs_pkey PRIMARY KEY (id);


--
-- Name: tds_assignments tds_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_pkey PRIMARY KEY (id);


--
-- Name: tds_challans tds_challans_challan_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_challans
    ADD CONSTRAINT tds_challans_challan_number_key UNIQUE (challan_number);


--
-- Name: tds_challans tds_challans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_challans
    ADD CONSTRAINT tds_challans_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: towers towers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_pkey PRIMARY KEY (id);


--
-- Name: towers towers_project_id_tower_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_project_id_tower_name_key UNIQUE (project_id, tower_name);


--
-- Name: unit_holds unit_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_pkey PRIMARY KEY (id);


--
-- Name: unit_holds unit_holds_unit_id_status_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_unit_id_status_key UNIQUE (unit_id, status);


--
-- Name: unit_locations unit_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_locations
    ADD CONSTRAINT unit_locations_pkey PRIMARY KEY (id);


--
-- Name: unit_shifts unit_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_pkey PRIMARY KEY (id);


--
-- Name: unit_status_history unit_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_status_history
    ADD CONSTRAINT unit_status_history_pkey PRIMARY KEY (id);


--
-- Name: unit_types unit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_pkey PRIMARY KEY (id);


--
-- Name: unit_types unit_types_project_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_project_id_name_key UNIQUE (project_id, name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: units units_tower_id_unit_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_tower_id_unit_number_key UNIQUE (tower_id, unit_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: waitlists waitlists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_pkey PRIMARY KEY (id);


--
-- Name: whatsapps whatsapps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatsapps
    ADD CONSTRAINT whatsapps_pkey PRIMARY KEY (id);


--
-- Name: idx_allocations_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocations_consumer ON public.allocations USING btree (consumer_id);


--
-- Name: idx_allocations_unit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocations_unit ON public.allocations USING btree (unit_id);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_automation_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_active ON public.automation_rules USING btree (is_active);


--
-- Name: idx_bank_statement_imports_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_statement_imports_project ON public.bank_statement_imports USING btree (project_id);


--
-- Name: idx_bank_statement_imports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_statement_imports_status ON public.bank_statement_imports USING btree (status);


--
-- Name: idx_bank_transactions_amount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_amount ON public.bank_transactions USING btree (amount_inr);


--
-- Name: idx_bank_transactions_import; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_import ON public.bank_transactions USING btree (import_id);


--
-- Name: idx_bank_transactions_match_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_match_status ON public.bank_transactions USING btree (match_status);


--
-- Name: idx_bank_transactions_ref; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_ref ON public.bank_transactions USING btree (transaction_ref);


--
-- Name: idx_booking_forms_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_forms_consumer ON public.booking_forms USING btree (consumer_id);


--
-- Name: idx_booking_forms_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_forms_project ON public.booking_forms USING btree (project_id);


--
-- Name: idx_booking_forms_reg_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_forms_reg_no ON public.booking_forms USING btree (registration_no);


--
-- Name: idx_booking_records_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_records_consumer ON public.booking_records USING btree (consumer_id);


--
-- Name: idx_booking_records_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_booking_records_project ON public.booking_records USING btree (project_id);


--
-- Name: idx_broadcast_campaigns_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broadcast_campaigns_created ON public.broadcast_campaigns USING btree (created_at DESC);


--
-- Name: idx_broadcast_campaigns_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broadcast_campaigns_project ON public.broadcast_campaigns USING btree (project_id);


--
-- Name: idx_broadcast_campaigns_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broadcast_campaigns_status ON public.broadcast_campaigns USING btree (status);


--
-- Name: idx_broker_commissions_broker; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broker_commissions_broker ON public.broker_commissions USING btree (broker_id);


--
-- Name: idx_broker_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_broker_parent ON public.brokers USING btree (parent_broker_id);


--
-- Name: idx_call_logs_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_consumer ON public.call_logs USING btree (consumer_id);


--
-- Name: idx_campaign_metrics_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_metrics_campaign ON public.campaign_metrics USING btree (campaign_id);


--
-- Name: idx_campaign_metrics_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_metrics_project ON public.campaign_metrics USING btree (project_id);


--
-- Name: idx_campaign_metrics_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaign_metrics_type ON public.campaign_metrics USING btree (campaign_type);


--
-- Name: idx_campaigns_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_channel ON public.campaigns USING btree (channel);


--
-- Name: idx_campaigns_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_project ON public.campaigns USING btree (project_id);


--
-- Name: idx_communications_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communications_channel ON public.communications USING btree (channel);


--
-- Name: idx_communications_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communications_consumer ON public.communications USING btree (consumer_id);


--
-- Name: idx_communications_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communications_created ON public.communications USING btree (created_at DESC);


--
-- Name: idx_consumer_folders_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumer_folders_consumer ON public.consumer_folders USING btree (consumer_id);


--
-- Name: idx_consumer_folders_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumer_folders_parent ON public.consumer_folders USING btree (parent_folder_id);


--
-- Name: idx_consumer_folders_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumer_folders_type ON public.consumer_folders USING btree (folder_type);


--
-- Name: idx_consumers_aadhaar; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumers_aadhaar ON public.consumers USING btree (aadhaar_hash);


--
-- Name: idx_consumers_classification; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumers_classification ON public.consumers USING btree (customer_classification);


--
-- Name: idx_consumers_mobile_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumers_mobile_project ON public.consumers USING btree (project_id, mobile);


--
-- Name: idx_consumers_overdue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumers_overdue ON public.consumers USING btree (total_overdue_amt) WHERE (total_overdue_amt > (0)::numeric);


--
-- Name: idx_consumers_ppp_project_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_consumers_ppp_project_unique ON public.consumers USING btree (parivar_pehchan_patra, project_id) WHERE ((parivar_pehchan_patra IS NOT NULL) AND (lead_stage <> 'cancelled'::public.lead_stage));


--
-- Name: idx_consumers_reg_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consumers_reg_no ON public.consumers USING btree (registration_no);


--
-- Name: idx_credit_debit_notes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_created_at ON public.credit_debit_notes USING btree (created_at);


--
-- Name: idx_credit_debit_notes_invoice_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_invoice_id ON public.credit_debit_notes USING btree (invoice_id);


--
-- Name: idx_credit_debit_notes_note_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_note_number ON public.credit_debit_notes USING btree (note_number);


--
-- Name: idx_credit_debit_notes_note_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_note_type ON public.credit_debit_notes USING btree (note_type);


--
-- Name: idx_credit_debit_notes_original_invoice_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_original_invoice_no ON public.credit_debit_notes USING btree (original_invoice_no);


--
-- Name: idx_credit_debit_notes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_debit_notes_status ON public.credit_debit_notes USING btree (status);


--
-- Name: idx_custom_reports_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_reports_created_at ON public.custom_reports USING btree (created_at DESC);


--
-- Name: idx_custom_reports_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_reports_created_by ON public.custom_reports USING btree (created_by_user_id);


--
-- Name: idx_custom_reports_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_custom_reports_project ON public.custom_reports USING btree (project_id);


--
-- Name: idx_demands_consumer_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demands_consumer_due_date ON public.demands USING btree (consumer_id, due_date);


--
-- Name: idx_document_vault_allocation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_vault_allocation ON public.document_vault USING btree (allocation_id);


--
-- Name: idx_document_vault_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_vault_category ON public.document_vault USING btree (document_category);


--
-- Name: idx_document_vault_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_vault_consumer ON public.document_vault USING btree (consumer_id);


--
-- Name: idx_document_vault_folder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_vault_folder ON public.document_vault USING btree (folder_id);


--
-- Name: idx_documents_allocation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_allocation ON public.documents USING btree (allocation_id);


--
-- Name: idx_documents_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_consumer ON public.documents USING btree (consumer_id);


--
-- Name: idx_documents_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_delivery_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_delivery_status ON public.documents USING btree (delivery_status);


--
-- Name: idx_documents_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_template ON public.documents USING btree (template_id);


--
-- Name: idx_draw_refunds_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_draw_refunds_consumer ON public.draw_refunds USING btree (consumer_id);


--
-- Name: idx_draw_refunds_due_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_draw_refunds_due_by ON public.draw_refunds USING btree (refund_due_by);


--
-- Name: idx_draw_refunds_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_draw_refunds_project ON public.draw_refunds USING btree (project_id);


--
-- Name: idx_draw_refunds_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_draw_refunds_status ON public.draw_refunds USING btree (refund_status);


--
-- Name: idx_employee_profiles_dept; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_profiles_dept ON public.employee_profiles USING btree (department_id);


--
-- Name: idx_employee_profiles_manager; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_profiles_manager ON public.employee_profiles USING btree (manager_id);


--
-- Name: idx_employee_profiles_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_profiles_user ON public.employee_profiles USING btree (user_id);


--
-- Name: idx_faq_articles_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_articles_category ON public.faq_articles USING btree (category_id);


--
-- Name: idx_faq_articles_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_articles_published ON public.faq_articles USING btree (is_published);


--
-- Name: idx_faq_articles_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_articles_search ON public.faq_articles USING gin (to_tsvector('english'::regconfig, (((title)::text || ' '::text) || content)));


--
-- Name: idx_faq_articles_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_faq_articles_tags ON public.faq_articles USING gin (tags);


--
-- Name: idx_floors_tower; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_floors_tower ON public.floors USING btree (tower_id);


--
-- Name: idx_gst_invoices_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gst_invoices_consumer ON public.gst_invoices USING btree (consumer_id);


--
-- Name: idx_gst_invoices_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gst_invoices_project ON public.gst_invoices USING btree (project_id);


--
-- Name: idx_gst_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gst_invoices_status ON public.gst_invoices USING btree (status);


--
-- Name: idx_milestones_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestones_project ON public.construction_milestones USING btree (project_id);


--
-- Name: idx_milestones_project_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestones_project_status ON public.construction_milestones USING btree (project_id, status);


--
-- Name: idx_milestones_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestones_status ON public.construction_milestones USING btree (status);


--
-- Name: idx_parking_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_consumer ON public.parking_slots USING btree (allotted_to_consumer_id);


--
-- Name: idx_parking_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_project ON public.parking_slots USING btree (project_id);


--
-- Name: idx_parking_slots_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_slots_project ON public.parking_slots USING btree (project_id);


--
-- Name: idx_parking_slots_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parking_slots_status ON public.parking_slots USING btree (status);


--
-- Name: idx_plan_templates_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_plan_templates_plan ON public.plan_schedule_templates USING btree (project_id, plan_name);


--
-- Name: idx_plan_templates_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_plan_templates_project ON public.plan_schedule_templates USING btree (project_id);


--
-- Name: idx_receipts_payment_plan; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_receipts_payment_plan ON public.receipts USING btree (payment_plan_id);


--
-- Name: idx_remarks_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remarks_consumer ON public.remarks USING btree (consumer_id);


--
-- Name: idx_support_tickets_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets USING btree (assigned_to_user_id);


--
-- Name: idx_support_tickets_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_consumer ON public.support_tickets USING btree (consumer_id);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_surrender_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_surrender_consumer ON public.surrender_applications USING btree (consumer_id);


--
-- Name: idx_tasks_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_assigned ON public.tasks USING btree (assigned_to);


--
-- Name: idx_tasks_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_consumer ON public.tasks USING btree (consumer_id);


--
-- Name: idx_tasks_due; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_due ON public.tasks USING btree (due_date);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);


--
-- Name: idx_teams_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_teams_department ON public.teams USING btree (department_id);


--
-- Name: idx_towers_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_towers_deleted_at ON public.towers USING btree (deleted_at);


--
-- Name: idx_unit_holds_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unit_holds_expiry ON public.unit_holds USING btree (expires_at, status);


--
-- Name: idx_unit_locations_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unit_locations_project ON public.unit_locations USING btree (project_id);


--
-- Name: idx_unit_shifts_consumer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unit_shifts_consumer ON public.unit_shifts USING btree (consumer_id);


--
-- Name: idx_unit_shifts_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unit_shifts_date ON public.unit_shifts USING btree (shift_date);


--
-- Name: idx_unit_types_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unit_types_project ON public.unit_types USING btree (project_id);


--
-- Name: idx_units_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_units_project ON public.units USING btree (project_id);


--
-- Name: idx_units_registry_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_units_registry_status ON public.units USING btree (registry_status);


--
-- Name: idx_units_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_units_status ON public.units USING btree (status);


--
-- Name: allocations update_allocations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consumers update_consumers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_consumers_updated_at BEFORE UPDATE ON public.consumers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: demands update_demands_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_demands_updated_at BEFORE UPDATE ON public.demands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_plans update_payment_plans_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: receipts update_receipts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: towers update_towers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_towers_updated_at BEFORE UPDATE ON public.towers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: allocations allocations_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: allocations allocations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: allocations allocations_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: allotment_letters allotment_letters_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.allotment_letters
    ADD CONSTRAINT allotment_letters_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: applicant_addresses applicant_addresses_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant_addresses
    ADD CONSTRAINT applicant_addresses_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_details(id);


--
-- Name: applicant_details applicant_details_booking_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant_details
    ADD CONSTRAINT applicant_details_booking_form_id_fkey FOREIGN KEY (booking_form_id) REFERENCES public.booking_forms(id);


--
-- Name: application_history application_history_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: automation_rules automation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_statement_imports bank_statement_imports_imported_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_imported_by_user_id_fkey FOREIGN KEY (imported_by_user_id) REFERENCES public.users(id);


--
-- Name: bank_statement_imports bank_statement_imports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: bank_transactions bank_transactions_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_matched_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_by_user_id_fkey FOREIGN KEY (matched_by_user_id) REFERENCES public.users(id);


--
-- Name: bank_transactions bank_transactions_matched_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_demand_id_fkey FOREIGN KEY (matched_demand_id) REFERENCES public.demands(id);


--
-- Name: bank_transactions bank_transactions_matched_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_receipt_id_fkey FOREIGN KEY (matched_receipt_id) REFERENCES public.receipts(id);


--
-- Name: booking_forms booking_forms_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.broker_applications(id);


--
-- Name: booking_forms booking_forms_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: booking_forms booking_forms_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: booking_forms booking_forms_main_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_main_broker_id_fkey FOREIGN KEY (main_broker_id) REFERENCES public.broker_applications(id);


--
-- Name: booking_forms booking_forms_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: booking_forms booking_forms_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: booking_forms booking_forms_sales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_sales_employee_id_fkey FOREIGN KEY (sales_employee_id) REFERENCES public.users(id);


--
-- Name: booking_forms booking_forms_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: booking_records booking_records_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: booking_records booking_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_discount_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_discount_authorized_by_fkey FOREIGN KEY (discount_authorized_by) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: booking_records booking_records_sales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_sales_employee_id_fkey FOREIGN KEY (sales_employee_id) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: broadcast_campaigns broadcast_campaigns_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: broadcast_campaigns broadcast_campaigns_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: broker_commissions broker_commissions_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_commissions broker_commissions_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: broker_commissions broker_commissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: broker_commissions broker_commissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: broker_commissions broker_commissions_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: broker_project_mapping broker_project_mapping_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_project_mapping broker_project_mapping_mapped_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_mapped_by_fkey FOREIGN KEY (mapped_by) REFERENCES public.users(id);


--
-- Name: broker_project_mapping broker_project_mapping_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: broker_tax_config broker_tax_config_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_tax_config broker_tax_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_parent_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_parent_broker_id_fkey FOREIGN KEY (parent_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;


--
-- Name: call_logs call_logs_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_status_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_status_code_fkey FOREIGN KEY (status_code) REFERENCES public.communication_status_codes(code);


--
-- Name: call_logs call_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: campaign_metrics campaign_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: campaign_metrics campaign_metrics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: campaigns campaigns_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: campaigns campaigns_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: cancellations cancellations_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: cancellations cancellations_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: co_applicants co_applicants_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.co_applicants
    ADD CONSTRAINT co_applicants_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: communications communications_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: communications communications_sent_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES public.users(id);


--
-- Name: construction_milestones construction_milestones_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: construction_milestones construction_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: construction_milestones construction_milestones_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: consumer_folders consumer_folders_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: consumer_folders consumer_folders_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: consumer_folders consumer_folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.consumer_folders(id);


--
-- Name: consumers consumers_allocated_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_allocated_unit_id_fkey FOREIGN KEY (allocated_unit_id) REFERENCES public.units(id);


--
-- Name: consumers consumers_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: consumers consumers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conveyance_deeds conveyance_deeds_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: conveyance_deeds conveyance_deeds_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conveyance_deeds conveyance_deeds_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: credit_debit_notes credit_debit_notes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: credit_debit_notes credit_debit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.gst_invoices(id) ON DELETE CASCADE;


--
-- Name: custom_reports custom_reports_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: custom_reports custom_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: demands demands_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: demands demands_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: demands demands_raised_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.users(id);


--
-- Name: demands demands_tax_slab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_tax_slab_id_fkey FOREIGN KEY (tax_slab_id) REFERENCES public.tax_slabs(id);


--
-- Name: departments departments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_dispatch document_dispatch_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: document_dispatch document_dispatch_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: document_templates document_templates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: document_vault document_vault_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: document_vault document_vault_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: document_vault document_vault_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.consumer_folders(id);


--
-- Name: document_vault document_vault_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: documents documents_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: documents documents_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_sent_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);


--
-- Name: draw_refunds draw_refunds_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: draw_refunds draw_refunds_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: draw_refunds draw_refunds_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: emails emails_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: employee_profiles employee_profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: faq_articles faq_articles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.faq_categories(id);


--
-- Name: faq_articles faq_articles_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: faq_articles faq_articles_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: faq_categories faq_categories_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faq_categories
    ADD CONSTRAINT faq_categories_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: floors floors_tower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_tower_id_fkey FOREIGN KEY (tower_id) REFERENCES public.towers(id) ON DELETE CASCADE;


--
-- Name: gst_invoices gst_invoices_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: gst_invoices gst_invoices_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: gst_invoices gst_invoices_linked_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_linked_invoice_id_fkey FOREIGN KEY (linked_invoice_id) REFERENCES public.gst_invoices(id);


--
-- Name: gst_invoices gst_invoices_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: gst_invoices gst_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: gst_invoices gst_invoices_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: gst_process_rights gst_process_rights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: head_wise_costs head_wise_costs_booking_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.head_wise_costs
    ADD CONSTRAINT head_wise_costs_booking_form_id_fkey FOREIGN KEY (booking_form_id) REFERENCES public.booking_forms(id);


--
-- Name: import_history import_history_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT import_history_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.users(id);


--
-- Name: journal_entries journal_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: journal_entries journal_entries_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: kyc_documents kyc_documents_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: parking_slots parking_slots_allotted_to_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_allotted_to_consumer_id_fkey FOREIGN KEY (allotted_to_consumer_id) REFERENCES public.consumers(id);


--
-- Name: parking_slots parking_slots_allotted_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_allotted_unit_id_fkey FOREIGN KEY (allotted_unit_id) REFERENCES public.units(id);


--
-- Name: parking_slots parking_slots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: parking_slots parking_slots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: payment_plans payment_plans_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: payment_plans payment_plans_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: payment_plans payment_plans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: payment_plans payment_plans_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: penal_interests penal_interests_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: penal_interests penal_interests_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: plan_schedule_templates plan_schedule_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: plan_schedule_templates plan_schedule_templates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_smtp_configs project_smtp_configs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: receipts receipts_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.users(id);


--
-- Name: receipts receipts_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: receipts receipts_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: remarks remarks_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: reminder_master reminder_master_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reminder_master
    ADD CONSTRAINT reminder_master_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: states states_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: support_tickets support_tickets_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: surrender_applications surrender_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: surrender_applications surrender_applications_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: surrender_applications surrender_applications_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tasks tasks_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tds_assignments tds_assignments_challan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_challan_id_fkey FOREIGN KEY (challan_id) REFERENCES public.tds_challans(id);


--
-- Name: tds_assignments tds_assignments_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: tds_assignments tds_assignments_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: teams teams_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: teams teams_team_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_team_head_id_fkey FOREIGN KEY (team_head_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: towers towers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: unit_holds unit_holds_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: unit_holds unit_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: unit_holds unit_holds_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: unit_locations unit_locations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_locations
    ADD CONSTRAINT unit_locations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: unit_shifts unit_shifts_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: unit_shifts unit_shifts_new_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_new_unit_id_fkey FOREIGN KEY (new_unit_id) REFERENCES public.units(id);


--
-- Name: unit_shifts unit_shifts_old_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_old_unit_id_fkey FOREIGN KEY (old_unit_id) REFERENCES public.units(id);


--
-- Name: unit_shifts unit_shifts_shifted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_shifted_by_user_id_fkey FOREIGN KEY (shifted_by_user_id) REFERENCES public.users(id);


--
-- Name: unit_status_history unit_status_history_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_status_history
    ADD CONSTRAINT unit_status_history_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: unit_types unit_types_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: units units_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id);


--
-- Name: units units_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: units units_tower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_tower_id_fkey FOREIGN KEY (tower_id) REFERENCES public.towers(id);


--
-- Name: units units_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_types(id);


--
-- Name: waitlists waitlists_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: waitlists waitlists_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: whatsapps whatsapps_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.whatsapps
    ADD CONSTRAINT whatsapps_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_append_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY audit_logs_append_only ON public.audit_logs USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--

\unrestrict n1Q8L0QqIF9URdrc7VxkII1o1U5cd4qum6R00Ssqp6omUKV9BsJ5r1KL2DVwMLk

