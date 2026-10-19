--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

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
-- Name: allocation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.allocation_status AS ENUM (
    'allotted',
    'agreement_signed',
    'cancelled',
    'transferred'
);


--
-- Name: income_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.income_category AS ENUM (
    'EWS',
    'LIG',
    'MIG'
);


--
-- Name: kyc_document_type; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: lead_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_stage AS ENUM (
    'enquiry',
    'interested',
    'application_filed',
    'draw_entered',
    'allotted',
    'onboarded',
    'cancelled',
    'transferred'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'bank_transfer',
    'cheque',
    'neft',
    'rtgs',
    'upi',
    'demand_draft',
    'cash',
    'card',
    'tds_challan'
);


--
-- Name: role_name; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_name AS ENUM (
    'super_admin',
    'project_manager',
    'sales_executive',
    'accounts_finance',
    'support_agent',
    'read_only_viewer'
);


--
-- Name: unit_status; Type: TYPE; Schema: public; Owner: -
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
    'held',
    'temp_surrender',
    'booked'
);


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addon_charge_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addon_charge_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    charge_name character varying(200) NOT NULL,
    default_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cgst_pct numeric(6,4) DEFAULT 9.0000 NOT NULL,
    sgst_pct numeric(6,4) DEFAULT 9.0000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    rate_type character varying(20) DEFAULT 'flat'::character varying NOT NULL,
    rate_per_sqft_inr numeric(12,2),
    CONSTRAINT addon_charge_master_rate_type_check CHECK (((rate_type)::text = ANY ((ARRAY['flat'::character varying, 'per_sqft'::character varying])::text[])))
);


--
-- Name: allocations; Type: TABLE; Schema: public; Owner: -
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
    updated_at timestamp with time zone DEFAULT now(),
    agreement_execute_date date,
    registry_status character varying(50) DEFAULT 'pending'::character varying,
    conveyance_deed_date date,
    agreement_date date
);


--
-- Name: allotment_letters; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: applicant_addresses; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: applicant_details; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: application_history; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid
);


--
-- Name: bank_statement_imports; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    ifsc_prefix character varying(10),
    branch character varying(200),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: booking_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_counters (
    project_id uuid NOT NULL,
    last_number integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: booking_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_record_id uuid NOT NULL,
    consumer_id uuid NOT NULL,
    applicant_number integer DEFAULT 0 NOT NULL,
    document_type character varying(100) NOT NULL,
    document_name character varying(255),
    barcode_no character varying(100),
    physical_storage_no character varying(100),
    scan_reference_no character varying(100),
    file_url text,
    file_original_name character varying(255),
    file_mime_type character varying(100),
    file_size_bytes bigint,
    remarks text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: booking_forms; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: booking_payment_taxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_payment_taxes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_record_id uuid NOT NULL,
    s_tax_pct numeric(5,2) DEFAULT 0,
    cgst_pct numeric(5,2) DEFAULT 0,
    sgst_pct numeric(5,2) DEFAULT 0,
    gst_interest_pct numeric(5,2) DEFAULT 0,
    cgst_amount numeric(12,2) DEFAULT 0,
    sgst_amount numeric(12,2) DEFAULT 0,
    tds_amount numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: booking_records; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    basic_rate_inr_sqft numeric(12,2),
    carpet_area_sqft numeric(10,3),
    balcony_rate_applied_inr_sqft numeric(10,2),
    balcony_charge_amount numeric(12,2),
    balcony_cgst_amount numeric(12,2),
    balcony_sgst_amount numeric(12,2),
    registration_no character varying(100),
    form_no character varying(100),
    account_holder character varying(255),
    bank_branch character varying(255),
    booking_type character varying(255),
    broker_rebate_pct numeric(8,3),
    broker_rebate_rs numeric(14,2),
    broker_rebate_sqft numeric(14,2),
    comm_address_line1 text,
    comm_city character varying(255),
    comm_country character varying(255),
    comm_pin character varying(255),
    comm_state character varying(255),
    communication_mode character varying(255),
    company_inaugural_disc numeric(14,2),
    company_rebate_pct numeric(8,3),
    company_rebate_rs numeric(14,2),
    company_rebate_sqft numeric(14,2),
    completion_date date,
    dealer_adjustment_amount numeric(14,2),
    extra_add_on_type character varying(255),
    has_other_charge boolean,
    has_plc boolean,
    interest_amount numeric(14,2),
    interest_type character varying(255),
    invoice_date_by uuid,
    mailing_address_type text,
    main_broker_id uuid,
    on_account_of character varying(255),
    other_charge_amount numeric(14,2),
    other_charge_desc text,
    plc_amount numeric(14,2),
    possession_date date,
    received_for character varying(255),
    selected_plan_name character varying(255),
    self_or_loan character varying(255),
    tds_challan_id uuid,
    tds_type character varying(255),
    total_price_inr numeric(14,2),
    updated_at timestamp with time zone
);


--
-- Name: broadcast_campaigns; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: broker_applications; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: broker_commissions; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: broker_project_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broker_project_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    broker_id uuid NOT NULL,
    project_id uuid NOT NULL,
    mapped_at timestamp with time zone DEFAULT now(),
    mapped_by uuid
);


--
-- Name: broker_tax_config; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: brokers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: campaign_metrics; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: cancellations; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    booking_record_id uuid,
    surrender_type character varying(50) DEFAULT 'builder_cancellation'::character varying,
    refund_mode character varying(50),
    penalty_base_amount numeric(12,2) DEFAULT 0,
    penalty_total_amount numeric(12,2) DEFAULT 0,
    extra_addon_charges numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    gst_included boolean DEFAULT true,
    interest_included boolean DEFAULT true,
    premium_amount numeric(12,2) DEFAULT 0,
    bank_noc boolean DEFAULT false,
    broker_noc boolean DEFAULT false,
    remark text,
    created_by_user_id uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: charge_master_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.charge_master_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    charge_key character varying(100) NOT NULL,
    charge_name character varying(200) NOT NULL,
    rate_value numeric(12,2) NOT NULL,
    rate_unit character varying(20) DEFAULT 'per_sqft'::character varying NOT NULL,
    cap_value numeric(12,2),
    is_cap_configurable boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: cheque_bounce_logs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    state_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: co_applicants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.co_applicants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    relationship character varying(50),
    aadhaar_hash character varying(255),
    pan_hash character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    first_name character varying(100),
    last_name character varying(100),
    salutation character varying(20),
    mobile character varying(20),
    email character varying(255),
    dob date,
    pan_no character varying(20),
    aadhaar_no character varying(20),
    anniversary_date date,
    applicant_number integer,
    applicant_type character varying(255),
    communication_mode character varying(255),
    designation character varying(255),
    email_2 character varying(255),
    father_name character varying(255),
    gender character varying(255),
    has_poa boolean,
    mailing_address_type text,
    marital_status character varying(255),
    middle_name character varying(255),
    nationality character varying(255),
    no_of_children integer,
    office_address text,
    office_city character varying(255),
    office_country character varying(255),
    office_fax_no character varying(255),
    office_mobile_no character varying(255),
    office_phone_no character varying(255),
    office_pin character varying(255),
    office_state character varying(255),
    passport_no character varying(255),
    perm_address text,
    perm_city character varying(255),
    perm_country character varying(255),
    perm_fax_no character varying(255),
    perm_mobile_no character varying(255),
    perm_phone_no character varying(255),
    perm_pin character varying(255),
    perm_state character varying(255),
    photo_url character varying(255),
    poa_details text,
    present_address text,
    present_city character varying(255),
    present_country character varying(255),
    present_fax_no character varying(255),
    present_mobile_no character varying(255),
    present_phone_no character varying(255),
    present_pin character varying(255),
    present_state character varying(255),
    profession character varying(255)
);


--
-- Name: communication_status_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communication_status_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    category character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: communications; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(100),
    group_name character varying(255),
    address1 character varying(500),
    address2 text,
    address3 text,
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    pin_code character varying(20),
    phone character varying(20),
    fax character varying(20),
    email character varying(255),
    website character varying(255),
    gstin character varying(50),
    cin character varying(50),
    pan_no character varying(50),
    service_tax_no character varying(50),
    vat_no character varying(50),
    reg_address text,
    place_of_supply character varying(100),
    logo_url text,
    bank_company_name character varying(255),
    bank_account_no character varying(50),
    bank_ifsc character varying(20),
    bank_name character varying(255),
    bank_branch character varying(255),
    payable_at character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    account_name character varying(200),
    bank_name character varying(200) NOT NULL,
    account_number character varying(100) NOT NULL,
    ifsc_code character varying(20),
    branch character varying(200),
    payable_at character varying(200),
    account_type character varying(50) DEFAULT 'current'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: construction_milestones; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: consumer_addon_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consumer_addon_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    project_id uuid NOT NULL,
    charge_master_id uuid,
    charge_name character varying(200) NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    increase_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cgst_pct numeric(6,4) DEFAULT 9.0000 NOT NULL,
    sgst_pct numeric(6,4) DEFAULT 9.0000 NOT NULL,
    cgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sgst_amount numeric(12,2) DEFAULT 0 NOT NULL,
    itc_cgst numeric(12,2) DEFAULT 0 NOT NULL,
    itc_sgst numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    remark text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    waive_remark text,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: consumer_folders; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: consumers; Type: TABLE; Schema: public; Owner: -
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
    total_overdue_amt numeric(15,2) DEFAULT 0,
    aadhaar_no character varying(20),
    applicant_type character varying(20) DEFAULT 'individual'::character varying,
    company_name character varying(200),
    company_reg_no character varying(100),
    company_gstin character varying(20),
    authorized_person character varying(200),
    authorized_designation character varying(100),
    father_name character varying(200),
    aadhaar_number character varying(20),
    date_of_birth_alt date,
    age integer,
    mailing_address text,
    son_daughter_wife_of character varying(200),
    interest_start_date date,
    grace_period_days integer DEFAULT 0,
    anniversary_date date,
    comm_address_line1 text,
    comm_city character varying(255),
    comm_country character varying(255),
    comm_fax_no character varying(255),
    comm_mobile_no character varying(255),
    comm_phone_no character varying(255),
    comm_pin character varying(255),
    comm_state character varying(255),
    communication_mode character varying(255),
    designation character varying(255),
    email_2 character varying(255),
    fax_no character varying(255),
    has_poa boolean,
    mailing_address_type text,
    marital_status character varying(255),
    no_of_children integer,
    office_country character varying(255),
    office_fax_no character varying(255),
    office_mobile_no character varying(255),
    office_phone_no character varying(255),
    passport_no character varying(255),
    perm_fax_no character varying(255),
    perm_mobile_no character varying(255),
    perm_phone_no character varying(255),
    phone_no character varying(255),
    present_fax_no character varying(255),
    present_mobile_no character varying(255),
    present_phone_no character varying(255)
);


--
-- Name: conveyance_deeds; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_debit_notes; Type: TABLE; Schema: public; Owner: -
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
    updated_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    approved_by uuid,
    consumer_id uuid,
    rejected_at timestamp with time zone,
    rejected_by uuid,
    rejection_reason text
);


--
-- Name: custom_reports; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: demands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_plan_id uuid NOT NULL,
    installment_index integer NOT NULL,
    consumer_id uuid NOT NULL,
    due_date date,
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
    created_at timestamp with time zone DEFAULT now(),
    addon_charge_amount numeric(12,2) DEFAULT 0 NOT NULL,
    addon_cgst_amount numeric DEFAULT 0,
    addon_sgst_amount numeric DEFAULT 0
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: document_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    booking_record_id uuid,
    document_type character varying(100) NOT NULL,
    is_provided boolean DEFAULT false,
    barcode_no character varying(100),
    physical_storage_no character varying(100),
    scan_reference_no character varying(100),
    verified_by_user_id uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: document_dispatch; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: document_field_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_field_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    field_key character varying(150) NOT NULL,
    field_label character varying(255),
    section character varying(100) DEFAULT 'general'::character varying,
    original_value text,
    current_value text,
    value_type character varying(50) DEFAULT 'text'::character varying,
    edit_reason text,
    edited_by_user_id uuid,
    edited_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    source_table character varying(100),
    source_column character varying(100),
    source_record_id uuid,
    write_back_done boolean DEFAULT false,
    write_back_at timestamp with time zone
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    document_type character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    body_html text NOT NULL,
    merge_fields text[],
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    version_number integer DEFAULT 1,
    letter_meta jsonb
);


--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    document_from character varying(255),
    is_mandatory boolean,
    project_id uuid,
    required_at character varying(100),
    updated_at timestamp with time zone
);


--
-- Name: document_vault; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    version_number integer NOT NULL,
    html_content text NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    edit_reason character varying(500),
    fields_changed jsonb DEFAULT '[]'::jsonb,
    is_original boolean DEFAULT false
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
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
    deleted_by_user_id uuid,
    document_subtype character varying(255),
    edit_count integer,
    is_edited boolean,
    last_edited_at timestamp with time zone,
    last_edited_by uuid,
    reference_id uuid,
    updated_at timestamp with time zone,
    version_number integer
);


--
-- Name: draw_refunds; Type: TABLE; Schema: public; Owner: -
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_bank_account_id uuid
);


--
-- Name: emails; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: employee_profiles; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: faq_articles; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: faq_categories; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: financial_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    payment_plan_id uuid
);


--
-- Name: financial_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: floors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.floors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tower_id uuid NOT NULL,
    floor_number integer NOT NULL,
    floor_name character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_settings (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: gst_invoices; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: gst_process_rights; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: gst_slabs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gst_slabs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: gst_tax_charge_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gst_tax_charge_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    slab_id uuid NOT NULL,
    gst_tax_id uuid,
    charge_type character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT gst_tax_charge_mapping_charge_type_check CHECK (((charge_type)::text = ANY ((ARRAY['BASIC'::character varying, 'PLC'::character varying, 'OTHER CHARGE'::character varying, 'IFMS'::character varying, 'EXTRA ADD ON'::character varying, 'OTHERS'::character varying])::text[])))
);


--
-- Name: gst_tax_setup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gst_tax_setup (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slab_id uuid NOT NULL,
    gst_code character varying(50) NOT NULL,
    type character varying(10) NOT NULL,
    cgst_pct numeric(6,3) DEFAULT 0 NOT NULL,
    sgst_pct numeric(6,3) DEFAULT 0 NOT NULL,
    utgst_pct numeric(6,3) DEFAULT 0 NOT NULL,
    igst_pct numeric(6,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT gst_tax_setup_type_check CHECK (((type)::text = ANY ((ARRAY['INTER'::character varying, 'INTRA'::character varying, 'UT'::character varying])::text[])))
);


--
-- Name: head_wise_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.head_wise_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_form_id uuid,
    cost_head character varying(100),
    amount_inr numeric(15,2),
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: hsn_sac_code_assign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hsn_sac_code_assign (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hsn_sac_id uuid NOT NULL,
    project_id uuid NOT NULL,
    charge_type character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT hsn_sac_code_assign_charge_type_check CHECK (((charge_type)::text = ANY ((ARRAY['BASIC'::character varying, 'PLC'::character varying, 'OTHER CHARGE'::character varying, 'IFMS'::character varying, 'EXTRA ADD ON'::character varying, 'OTHERS'::character varying])::text[])))
);


--
-- Name: hsn_sac_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hsn_sac_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT hsn_sac_codes_type_check CHECK (((type)::text = ANY ((ARRAY['Goods'::character varying, 'Service'::character varying])::text[])))
);


--
-- Name: import_history; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: interest_waivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interest_waivers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    penal_interest_id uuid,
    payment_plan_id uuid,
    installment_index integer,
    waiver_amount_inr bigint DEFAULT 0 NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approved_at timestamp with time zone,
    document_path text,
    authorized_by_name text,
    created_at timestamp with time zone DEFAULT now(),
    rejected_at timestamp with time zone,
    rejected_by uuid,
    rejection_reason text,
    updated_at timestamp with time zone
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    approved_at timestamp with time zone,
    created_by_user_id uuid,
    rejected_at timestamp with time zone,
    rejected_by uuid,
    rejection_reason text,
    updated_at timestamp with time zone
);


--
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: loan_details; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: nationalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nationalities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: nav_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nav_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route character varying(200) NOT NULL,
    label character varying(200) NOT NULL,
    category character varying(100),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- Name: outgoing_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outgoing_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_bank_account_id uuid NOT NULL,
    amount_inr numeric(15,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payee character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reference_number character varying(100),
    notes text,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ownership_transfers; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    transfer_no character varying,
    application_date date,
    transfer_type character varying DEFAULT 'individual'::character varying,
    transfer_amount_inr bigint DEFAULT 0,
    stax_amount numeric(12,2) DEFAULT 0,
    cgst_amount numeric(12,2) DEFAULT 0,
    sgst_amount numeric(12,2) DEFAULT 0,
    igst_amount numeric(12,2) DEFAULT 0,
    ugst_amount numeric(12,2) DEFAULT 0,
    basic_price numeric(12,2) DEFAULT 0,
    gstin character varying,
    broker_company character varying,
    main_broker character varying,
    sales_person_name character varying,
    transfer_receipt_no character varying,
    approved_by character varying,
    approved_at timestamp with time zone,
    seller_total_paid_inr numeric(14,2) DEFAULT 0,
    seller_total_due_inr numeric(14,2) DEFAULT 0,
    seller_balance_inr numeric(14,2) DEFAULT 0
);


--
-- Name: parking_slots; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: parking_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parking_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_plans; Type: TABLE; Schema: public; Owner: -
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
    updated_at timestamp with time zone DEFAULT now(),
    advance_amount numeric(12,2) DEFAULT 0
);


--
-- Name: payment_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consumer_id uuid NOT NULL,
    payment_plan_id uuid,
    original_receipt_id uuid,
    refund_amount_inr numeric(14,2) NOT NULL,
    reason text,
    refund_mode character varying(50),
    refund_reference character varying(255),
    refund_date date,
    status character varying(50) DEFAULT 'pending'::character varying,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now(),
    approved_by uuid,
    approved_at timestamp with time zone,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: penal_interests; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: plan_addon_charge_pct; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_addon_charge_pct (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_schedule_template_id uuid NOT NULL,
    charge_master_id uuid NOT NULL,
    pct numeric(7,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: plan_schedule_templates; Type: TABLE; Schema: public; Owner: -
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
    updated_at timestamp with time zone DEFAULT now(),
    interest_rate_percent numeric(6,2) DEFAULT NULL::numeric
);


--
-- Name: professions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.professions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_gstin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_gstin (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    gstin character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: project_interest_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_interest_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    rate_percent numeric(6,2) NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_rera_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_rera_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    tower_id uuid,
    rera_number character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: project_smtp_configs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
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
    group_name character varying(100) DEFAULT 'Affordable'::character varying,
    license_date date,
    license_valid_upto date,
    env_clearance_no character varying(200),
    env_clearance_date date,
    building_plan_memo_no character varying(200),
    building_plan_date date,
    collaboration_agreement_date date,
    collaboration_agreement_no character varying(100),
    land_owner_name character varying(300),
    land_owner_llpin character varying(50),
    land_owner_pan character varying(20),
    land_owner_address text,
    land_owner_gpa_vasika_no character varying(100),
    land_owner_gpa_date date,
    sale_deed_no character varying(100),
    sale_deed_date date,
    occupation_cert_memo_no character varying(200),
    occupation_cert_date date,
    deed_of_declaration_vasika_no character varying(100),
    deed_of_declaration_date date,
    khasra_details text,
    village_name character varying(200),
    sector_name character varying(100),
    sub_registrar_office character varying(200),
    authorised_signatory_name character varying(200),
    authorised_signatory_aadhaar character varying(20),
    board_resolution_date date,
    company_id uuid,
    possession_date date
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_plan_id uuid,
    installment_index integer,
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
    updated_at timestamp with time zone DEFAULT now(),
    cgst_amount numeric(15,2) DEFAULT 0.00,
    sgst_amount numeric(15,2) DEFAULT 0.00,
    is_advance boolean DEFAULT false,
    advance_from_demand_id uuid,
    deposit_date date,
    clearing_date date,
    hold_remark text,
    clearing_bank_id uuid,
    is_adjustment boolean DEFAULT false,
    company_bank_account_id uuid,
    bank_name character varying(255),
    branch character varying(255),
    cheque_date date,
    cheque_no character varying(255),
    demand_id uuid,
    edc_amount numeric(14,2),
    idc_amount numeric(14,2),
    interest_amount numeric(14,2),
    other_charge_amount numeric(14,2),
    other_charge_desc text,
    plc_amount numeric(14,2),
    printed_at timestamp with time zone,
    printed_by uuid
);


--
-- Name: registry_details; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: remarks; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: reminder_master; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: role_page_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_page_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_name character varying(100) NOT NULL,
    page_id uuid NOT NULL,
    can_view boolean DEFAULT true
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    is_custom boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid,
    description text,
    is_active boolean,
    is_system boolean,
    label character varying(255)
);


--
-- Name: salutations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salutations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sources_of_enquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources_of_enquiry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    country_id uuid,
    code character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: surrender_applications; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp with time zone DEFAULT now(),
    booking_record_id uuid,
    surrender_type character varying(50) DEFAULT 'voluntary'::character varying,
    refund_mode character varying(50),
    penalty_base_amount numeric(12,2) DEFAULT 0,
    penalty_gst_amount numeric(12,2) DEFAULT 0,
    penalty_total_amount numeric(12,2) DEFAULT 0,
    extra_addon_charges numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    gst_included boolean DEFAULT true,
    service_tax_included boolean DEFAULT false,
    vat_included boolean DEFAULT false,
    interest_included boolean DEFAULT true,
    premium_amount numeric(12,2) DEFAULT 0,
    bank_noc boolean DEFAULT false,
    broker_noc boolean DEFAULT false,
    noc_document_path character varying(500),
    remark text,
    updated_at timestamp with time zone DEFAULT now(),
    pre_surrender_unit_status text,
    cancelled_demand_snapshot jsonb
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: tax_slabs; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: tds_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tds_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challan_id uuid,
    consumer_id uuid,
    receipt_id uuid,
    amount_assigned numeric(15,2) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now()
);


--
-- Name: tds_challans; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_team character varying(100) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: towers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: transfer_fee_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfer_fee_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    transfer_fee_inr numeric(12,2) DEFAULT 0 NOT NULL,
    admin_charges_inr numeric(12,2) DEFAULT 0 NOT NULL,
    cgst_pct numeric(6,4) DEFAULT 0 NOT NULL,
    sgst_pct numeric(6,4) DEFAULT 0 NOT NULL,
    igst_pct numeric(6,4) DEFAULT 0 NOT NULL,
    ugst_pct numeric(6,4) DEFAULT 0 NOT NULL,
    service_tax_pct numeric(6,4) DEFAULT 12.3600 NOT NULL,
    is_foc boolean DEFAULT false NOT NULL,
    effective_from date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unit_holds; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: unit_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unit_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name character varying(200) NOT NULL,
    description character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: unit_shifts; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: unit_status_history; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: unit_types; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tower_id uuid NOT NULL,
    project_id uuid NOT NULL,
    unit_number character varying(50) NOT NULL,
    bhk_type character varying(50) NOT NULL,
    carpet_area_sqft numeric(10,3),
    super_area_sqft numeric(10,3),
    facing character varying(50),
    floor integer,
    balcony_area_sqft numeric(10,3),
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
    hold_status boolean DEFAULT false,
    basic_price numeric(14,2),
    parking_number character varying(255),
    balcony_rate_inr_sqft numeric(14,2),
    balcony_rate_cap_inr numeric(14,2)
);


--
-- Name: user_company_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_company_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    access_level character varying(50) DEFAULT 'read'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid
);


--
-- Name: user_ip_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_ip_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address character varying(64) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_process_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_process_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    process_name character varying(100) NOT NULL,
    is_maker boolean DEFAULT false,
    is_checker boolean DEFAULT false,
    is_approver boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    created_by_user_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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
    created_by_user_id uuid,
    token_version integer DEFAULT 0 NOT NULL,
    authorized_download boolean,
    authorized_print boolean,
    employee_id uuid,
    home_page_widgets jsonb,
    unit_status_access character varying(255),
    updated_at timestamp with time zone,
    username character varying(255),
    ip_security_enabled boolean DEFAULT false
);


--
-- Name: waitlists; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: whatsapps; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: addon_charge_master addon_charge_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_charge_master
    ADD CONSTRAINT addon_charge_master_pkey PRIMARY KEY (id);


--
-- Name: allocations allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_pkey PRIMARY KEY (id);


--
-- Name: allotment_letters allotment_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allotment_letters
    ADD CONSTRAINT allotment_letters_pkey PRIMARY KEY (id);


--
-- Name: applicant_addresses applicant_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_addresses
    ADD CONSTRAINT applicant_addresses_pkey PRIMARY KEY (id);


--
-- Name: applicant_details applicant_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_details
    ADD CONSTRAINT applicant_details_pkey PRIMARY KEY (id);


--
-- Name: application_history application_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_imports bank_statement_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: banks banks_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_name_key UNIQUE (name);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (id);


--
-- Name: booking_counters booking_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_counters
    ADD CONSTRAINT booking_counters_pkey PRIMARY KEY (project_id);


--
-- Name: booking_documents booking_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_documents
    ADD CONSTRAINT booking_documents_pkey PRIMARY KEY (id);


--
-- Name: booking_forms booking_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_pkey PRIMARY KEY (id);


--
-- Name: booking_forms booking_forms_registration_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_registration_no_key UNIQUE (registration_no);


--
-- Name: booking_payment_taxes booking_payment_taxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payment_taxes
    ADD CONSTRAINT booking_payment_taxes_pkey PRIMARY KEY (id);


--
-- Name: booking_records booking_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_pkey PRIMARY KEY (id);


--
-- Name: broadcast_campaigns broadcast_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_pkey PRIMARY KEY (id);


--
-- Name: broker_applications broker_applications_broker_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_applications
    ADD CONSTRAINT broker_applications_broker_code_key UNIQUE (broker_code);


--
-- Name: broker_applications broker_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_applications
    ADD CONSTRAINT broker_applications_pkey PRIMARY KEY (id);


--
-- Name: broker_commissions broker_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_pkey PRIMARY KEY (id);


--
-- Name: broker_project_mapping broker_project_mapping_broker_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_broker_id_project_id_key UNIQUE (broker_id, project_id);


--
-- Name: broker_project_mapping broker_project_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_pkey PRIMARY KEY (id);


--
-- Name: broker_tax_config broker_tax_config_broker_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_broker_id_key UNIQUE (broker_id);


--
-- Name: broker_tax_config broker_tax_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_pkey PRIMARY KEY (id);


--
-- Name: brokers brokers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_metrics campaign_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: cancellations cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_pkey PRIMARY KEY (id);


--
-- Name: charge_master_config charge_master_config_charge_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master_config
    ADD CONSTRAINT charge_master_config_charge_key_key UNIQUE (charge_key);


--
-- Name: charge_master_config charge_master_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master_config
    ADD CONSTRAINT charge_master_config_pkey PRIMARY KEY (id);


--
-- Name: cheque_bounce_logs cheque_bounce_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheque_bounce_logs
    ADD CONSTRAINT cheque_bounce_logs_pkey PRIMARY KEY (id);


--
-- Name: cities cities_name_state_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_name_state_id_key UNIQUE (name, state_id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: co_applicants co_applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_applicants
    ADD CONSTRAINT co_applicants_pkey PRIMARY KEY (id);


--
-- Name: communication_status_codes communication_status_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_status_codes
    ADD CONSTRAINT communication_status_codes_code_key UNIQUE (code);


--
-- Name: communication_status_codes communication_status_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communication_status_codes
    ADD CONSTRAINT communication_status_codes_pkey PRIMARY KEY (id);


--
-- Name: communications communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_bank_accounts company_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bank_accounts
    ADD CONSTRAINT company_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: construction_milestones construction_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_pkey PRIMARY KEY (id);


--
-- Name: consumer_addon_charges consumer_addon_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_addon_charges
    ADD CONSTRAINT consumer_addon_charges_pkey PRIMARY KEY (id);


--
-- Name: consumer_folders consumer_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_pkey PRIMARY KEY (id);


--
-- Name: consumers consumers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_pkey PRIMARY KEY (id);


--
-- Name: consumers consumers_project_id_mobile_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_project_id_mobile_key UNIQUE (project_id, mobile);


--
-- Name: conveyance_deeds conveyance_deeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_pkey PRIMARY KEY (id);


--
-- Name: countries countries_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_name_key UNIQUE (name);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: credit_debit_notes credit_debit_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_note_number_key UNIQUE (note_number);


--
-- Name: credit_debit_notes credit_debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_pkey PRIMARY KEY (id);


--
-- Name: custom_reports custom_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_pkey PRIMARY KEY (id);


--
-- Name: demands demands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_checklists document_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_checklists
    ADD CONSTRAINT document_checklists_pkey PRIMARY KEY (id);


--
-- Name: document_dispatch document_dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_pkey PRIMARY KEY (id);


--
-- Name: document_field_overrides document_field_overrides_document_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_field_overrides
    ADD CONSTRAINT document_field_overrides_document_id_field_key_key UNIQUE (document_id, field_key);


--
-- Name: document_field_overrides document_field_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_field_overrides
    ADD CONSTRAINT document_field_overrides_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_name_key UNIQUE (name);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: document_vault document_vault_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_document_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_version_number_key UNIQUE (document_id, version_number);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: draw_refunds draw_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_employee_code_key UNIQUE (employee_code);


--
-- Name: employee_profiles employee_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_pkey PRIMARY KEY (id);


--
-- Name: employee_profiles employee_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_key UNIQUE (user_id);


--
-- Name: faq_articles faq_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_pkey PRIMARY KEY (id);


--
-- Name: faq_categories faq_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_categories
    ADD CONSTRAINT faq_categories_pkey PRIMARY KEY (id);


--
-- Name: financial_audit_logs financial_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_audit_logs
    ADD CONSTRAINT financial_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: financial_years financial_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_pkey PRIMARY KEY (id);


--
-- Name: floors floors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_pkey PRIMARY KEY (id);


--
-- Name: floors floors_tower_id_floor_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_tower_id_floor_number_key UNIQUE (tower_id, floor_number);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (key);


--
-- Name: gst_tax_charge_mapping gst_charge_mapping_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_charge_mapping_unique UNIQUE (project_id, slab_id, charge_type);


--
-- Name: gst_invoices gst_invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: gst_invoices gst_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_pkey PRIMARY KEY (id);


--
-- Name: gst_process_rights gst_process_rights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_pkey PRIMARY KEY (id);


--
-- Name: gst_process_rights gst_process_rights_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_user_id_key UNIQUE (user_id);


--
-- Name: gst_slabs gst_slabs_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_slabs
    ADD CONSTRAINT gst_slabs_date_unique UNIQUE (from_date, to_date);


--
-- Name: gst_slabs gst_slabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_slabs
    ADD CONSTRAINT gst_slabs_pkey PRIMARY KEY (id);


--
-- Name: gst_tax_charge_mapping gst_tax_charge_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_tax_charge_mapping_pkey PRIMARY KEY (id);


--
-- Name: gst_tax_setup gst_tax_setup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_setup
    ADD CONSTRAINT gst_tax_setup_pkey PRIMARY KEY (id);


--
-- Name: gst_tax_setup gst_tax_setup_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_setup
    ADD CONSTRAINT gst_tax_setup_unique UNIQUE (slab_id, gst_code, type);


--
-- Name: head_wise_costs head_wise_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_wise_costs
    ADD CONSTRAINT head_wise_costs_pkey PRIMARY KEY (id);


--
-- Name: hsn_sac_code_assign hsn_sac_assign_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_code_assign
    ADD CONSTRAINT hsn_sac_assign_unique UNIQUE (project_id, charge_type);


--
-- Name: hsn_sac_code_assign hsn_sac_code_assign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_code_assign
    ADD CONSTRAINT hsn_sac_code_assign_pkey PRIMARY KEY (id);


--
-- Name: hsn_sac_codes hsn_sac_codes_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_codes
    ADD CONSTRAINT hsn_sac_codes_code_unique UNIQUE (code);


--
-- Name: hsn_sac_codes hsn_sac_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_codes
    ADD CONSTRAINT hsn_sac_codes_pkey PRIMARY KEY (id);


--
-- Name: import_history import_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT import_history_pkey PRIMARY KEY (id);


--
-- Name: interest_waivers interest_waivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interest_waivers
    ADD CONSTRAINT interest_waivers_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- Name: loan_details loan_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loan_details
    ADD CONSTRAINT loan_details_pkey PRIMARY KEY (id);


--
-- Name: nationalities nationalities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nationalities
    ADD CONSTRAINT nationalities_name_key UNIQUE (name);


--
-- Name: nationalities nationalities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nationalities
    ADD CONSTRAINT nationalities_pkey PRIMARY KEY (id);


--
-- Name: nav_pages nav_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nav_pages
    ADD CONSTRAINT nav_pages_pkey PRIMARY KEY (id);


--
-- Name: nav_pages nav_pages_route_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nav_pages
    ADD CONSTRAINT nav_pages_route_key UNIQUE (route);


--
-- Name: outgoing_payments outgoing_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_payments
    ADD CONSTRAINT outgoing_payments_pkey PRIMARY KEY (id);


--
-- Name: ownership_transfers ownership_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ownership_transfers
    ADD CONSTRAINT ownership_transfers_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_pkey PRIMARY KEY (id);


--
-- Name: parking_slots parking_slots_project_id_slot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_project_id_slot_number_key UNIQUE (project_id, slot_number);


--
-- Name: parking_types parking_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_types
    ADD CONSTRAINT parking_types_pkey PRIMARY KEY (id);


--
-- Name: payment_plans payment_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);


--
-- Name: payment_refunds payment_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_pkey PRIMARY KEY (id);


--
-- Name: penal_interests penal_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_pkey PRIMARY KEY (id);


--
-- Name: plan_addon_charge_pct plan_addon_charge_pct_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_addon_charge_pct
    ADD CONSTRAINT plan_addon_charge_pct_pkey PRIMARY KEY (id);


--
-- Name: plan_addon_charge_pct plan_addon_pct_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_addon_charge_pct
    ADD CONSTRAINT plan_addon_pct_unique UNIQUE (plan_schedule_template_id, charge_master_id);


--
-- Name: plan_schedule_templates plan_schedule_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_pkey PRIMARY KEY (id);


--
-- Name: professions professions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professions
    ADD CONSTRAINT professions_name_key UNIQUE (name);


--
-- Name: professions professions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.professions
    ADD CONSTRAINT professions_pkey PRIMARY KEY (id);


--
-- Name: project_gstin project_gstin_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gstin
    ADD CONSTRAINT project_gstin_pkey PRIMARY KEY (id);


--
-- Name: project_gstin project_gstin_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gstin
    ADD CONSTRAINT project_gstin_unique UNIQUE (project_id);


--
-- Name: project_interest_rates project_interest_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_interest_rates
    ADD CONSTRAINT project_interest_rates_pkey PRIMARY KEY (id);


--
-- Name: project_rera_numbers project_rera_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rera_numbers
    ADD CONSTRAINT project_rera_numbers_pkey PRIMARY KEY (id);


--
-- Name: project_rera_numbers project_rera_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rera_numbers
    ADD CONSTRAINT project_rera_unique UNIQUE (project_id, tower_id);


--
-- Name: project_smtp_configs project_smtp_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_pkey PRIMARY KEY (id);


--
-- Name: project_smtp_configs project_smtp_configs_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_project_id_key UNIQUE (project_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_rera_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_rera_number_key UNIQUE (rera_number);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: registry_details registry_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registry_details
    ADD CONSTRAINT registry_details_pkey PRIMARY KEY (id);


--
-- Name: remarks remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_pkey PRIMARY KEY (id);


--
-- Name: reminder_master reminder_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_master
    ADD CONSTRAINT reminder_master_pkey PRIMARY KEY (id);


--
-- Name: role_page_access role_page_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_page_access
    ADD CONSTRAINT role_page_access_pkey PRIMARY KEY (id);


--
-- Name: role_page_access role_page_access_role_name_page_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_page_access
    ADD CONSTRAINT role_page_access_role_name_page_id_key UNIQUE (role_name, page_id);


--
-- Name: roles roles_name_is_custom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_is_custom_key UNIQUE (name, is_custom);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salutations salutations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salutations
    ADD CONSTRAINT salutations_name_key UNIQUE (name);


--
-- Name: salutations salutations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salutations
    ADD CONSTRAINT salutations_pkey PRIMARY KEY (id);


--
-- Name: sources_of_enquiry sources_of_enquiry_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources_of_enquiry
    ADD CONSTRAINT sources_of_enquiry_name_key UNIQUE (name);


--
-- Name: sources_of_enquiry sources_of_enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources_of_enquiry
    ADD CONSTRAINT sources_of_enquiry_pkey PRIMARY KEY (id);


--
-- Name: states states_name_country_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_name_country_id_key UNIQUE (name, country_id);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: surrender_applications surrender_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tax_slabs tax_slabs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_slabs
    ADD CONSTRAINT tax_slabs_name_key UNIQUE (name);


--
-- Name: tax_slabs tax_slabs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_slabs
    ADD CONSTRAINT tax_slabs_pkey PRIMARY KEY (id);


--
-- Name: tds_assignments tds_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_pkey PRIMARY KEY (id);


--
-- Name: tds_challans tds_challans_challan_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_challans
    ADD CONSTRAINT tds_challans_challan_number_key UNIQUE (challan_number);


--
-- Name: tds_challans tds_challans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_challans
    ADD CONSTRAINT tds_challans_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: towers towers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_pkey PRIMARY KEY (id);


--
-- Name: towers towers_project_id_tower_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_project_id_tower_name_key UNIQUE (project_id, tower_name);


--
-- Name: transfer_fee_master transfer_fee_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_fee_master
    ADD CONSTRAINT transfer_fee_master_pkey PRIMARY KEY (id);


--
-- Name: transfer_fee_master transfer_fee_master_project_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_fee_master
    ADD CONSTRAINT transfer_fee_master_project_unique UNIQUE (project_id);


--
-- Name: unit_holds unit_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_pkey PRIMARY KEY (id);


--
-- Name: unit_holds unit_holds_unit_id_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_unit_id_status_key UNIQUE (unit_id, status);


--
-- Name: unit_locations unit_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_locations
    ADD CONSTRAINT unit_locations_pkey PRIMARY KEY (id);


--
-- Name: unit_shifts unit_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_pkey PRIMARY KEY (id);


--
-- Name: unit_status_history unit_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_history
    ADD CONSTRAINT unit_status_history_pkey PRIMARY KEY (id);


--
-- Name: unit_types unit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_pkey PRIMARY KEY (id);


--
-- Name: unit_types unit_types_project_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_project_id_name_key UNIQUE (project_id, name);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: units units_tower_id_unit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_tower_id_unit_number_key UNIQUE (tower_id, unit_number);


--
-- Name: user_company_access user_company_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_pkey PRIMARY KEY (id);


--
-- Name: user_company_access user_company_access_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_user_id_company_id_key UNIQUE (user_id, company_id);


--
-- Name: user_ip_restrictions user_ip_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ip_restrictions
    ADD CONSTRAINT user_ip_restrictions_pkey PRIMARY KEY (id);


--
-- Name: user_ip_restrictions user_ip_restrictions_user_id_ip_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ip_restrictions
    ADD CONSTRAINT user_ip_restrictions_user_id_ip_address_key UNIQUE (user_id, ip_address);


--
-- Name: user_process_permissions user_process_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_process_permissions
    ADD CONSTRAINT user_process_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_process_permissions user_process_permissions_user_id_process_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_process_permissions
    ADD CONSTRAINT user_process_permissions_user_id_process_name_key UNIQUE (user_id, process_name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: waitlists waitlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_pkey PRIMARY KEY (id);


--
-- Name: whatsapps whatsapps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapps
    ADD CONSTRAINT whatsapps_pkey PRIMARY KEY (id);


--
-- Name: co_applicants_consumer_applicant_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX co_applicants_consumer_applicant_unique ON public.co_applicants USING btree (consumer_id, applicant_number);


--
-- Name: idx_addon_charge_master_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_addon_charge_master_project ON public.addon_charge_master USING btree (project_id);


--
-- Name: idx_allocations_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_consumer ON public.allocations USING btree (consumer_id);


--
-- Name: idx_allocations_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_allocations_unit ON public.allocations USING btree (unit_id);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_automation_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_active ON public.automation_rules USING btree (is_active);


--
-- Name: idx_bank_accounts_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_company_id ON public.bank_accounts USING btree (company_id);


--
-- Name: idx_bank_statement_imports_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statement_imports_project ON public.bank_statement_imports USING btree (project_id);


--
-- Name: idx_bank_statement_imports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_statement_imports_status ON public.bank_statement_imports USING btree (status);


--
-- Name: idx_bank_transactions_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_amount ON public.bank_transactions USING btree (amount_inr);


--
-- Name: idx_bank_transactions_import; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_import ON public.bank_transactions USING btree (import_id);


--
-- Name: idx_bank_transactions_match_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_match_status ON public.bank_transactions USING btree (match_status);


--
-- Name: idx_bank_transactions_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_transactions_ref ON public.bank_transactions USING btree (transaction_ref);


--
-- Name: idx_booking_counters_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_counters_project ON public.booking_counters USING btree (project_id);


--
-- Name: idx_booking_docs_applicant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_docs_applicant ON public.booking_documents USING btree (applicant_number);


--
-- Name: idx_booking_docs_booking_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_docs_booking_record ON public.booking_documents USING btree (booking_record_id);


--
-- Name: idx_booking_docs_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_docs_consumer ON public.booking_documents USING btree (consumer_id);


--
-- Name: idx_booking_docs_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_docs_deleted ON public.booking_documents USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_booking_forms_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_forms_consumer ON public.booking_forms USING btree (consumer_id);


--
-- Name: idx_booking_forms_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_forms_project ON public.booking_forms USING btree (project_id);


--
-- Name: idx_booking_forms_reg_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_forms_reg_no ON public.booking_forms USING btree (registration_no);


--
-- Name: idx_booking_payment_taxes_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_payment_taxes_booking ON public.booking_payment_taxes USING btree (booking_record_id);


--
-- Name: idx_booking_records_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_records_consumer ON public.booking_records USING btree (consumer_id);


--
-- Name: idx_booking_records_form_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_records_form_no ON public.booking_records USING btree (form_no);


--
-- Name: idx_booking_records_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_records_project ON public.booking_records USING btree (project_id);


--
-- Name: idx_booking_records_registration_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_records_registration_no ON public.booking_records USING btree (registration_no);


--
-- Name: idx_broadcast_campaigns_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_campaigns_created ON public.broadcast_campaigns USING btree (created_at DESC);


--
-- Name: idx_broadcast_campaigns_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_campaigns_project ON public.broadcast_campaigns USING btree (project_id);


--
-- Name: idx_broadcast_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broadcast_campaigns_status ON public.broadcast_campaigns USING btree (status);


--
-- Name: idx_broker_commissions_broker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_commissions_broker ON public.broker_commissions USING btree (broker_id);


--
-- Name: idx_broker_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_parent ON public.brokers USING btree (parent_broker_id);


--
-- Name: idx_call_logs_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_call_logs_consumer ON public.call_logs USING btree (consumer_id);


--
-- Name: idx_campaign_metrics_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_metrics_campaign ON public.campaign_metrics USING btree (campaign_id);


--
-- Name: idx_campaign_metrics_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_metrics_project ON public.campaign_metrics USING btree (project_id);


--
-- Name: idx_campaign_metrics_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_metrics_type ON public.campaign_metrics USING btree (campaign_type);


--
-- Name: idx_campaigns_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_channel ON public.campaigns USING btree (channel);


--
-- Name: idx_campaigns_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_project ON public.campaigns USING btree (project_id);


--
-- Name: idx_cba_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cba_company_id ON public.company_bank_accounts USING btree (company_id);


--
-- Name: idx_cba_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cba_is_active ON public.company_bank_accounts USING btree (is_active);


--
-- Name: idx_communications_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_channel ON public.communications USING btree (channel);


--
-- Name: idx_communications_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_consumer ON public.communications USING btree (consumer_id);


--
-- Name: idx_communications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_communications_created ON public.communications USING btree (created_at DESC);


--
-- Name: idx_companies_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_id ON public.companies USING btree (id);


--
-- Name: idx_consumer_addon_charges_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumer_addon_charges_consumer ON public.consumer_addon_charges USING btree (consumer_id);


--
-- Name: idx_consumer_addon_charges_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumer_addon_charges_project ON public.consumer_addon_charges USING btree (project_id);


--
-- Name: idx_consumer_folders_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumer_folders_consumer ON public.consumer_folders USING btree (consumer_id);


--
-- Name: idx_consumer_folders_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumer_folders_parent ON public.consumer_folders USING btree (parent_folder_id);


--
-- Name: idx_consumer_folders_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumer_folders_type ON public.consumer_folders USING btree (folder_type);


--
-- Name: idx_consumers_aadhaar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_aadhaar ON public.consumers USING btree (aadhaar_hash);


--
-- Name: idx_consumers_aadhaar_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_aadhaar_no ON public.consumers USING btree (aadhaar_no);


--
-- Name: idx_consumers_classification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_classification ON public.consumers USING btree (customer_classification);


--
-- Name: idx_consumers_mobile_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_mobile_project ON public.consumers USING btree (project_id, mobile);


--
-- Name: idx_consumers_overdue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_overdue ON public.consumers USING btree (total_overdue_amt) WHERE (total_overdue_amt > (0)::numeric);


--
-- Name: idx_consumers_ppp_project_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_consumers_ppp_project_unique ON public.consumers USING btree (parivar_pehchan_patra, project_id) WHERE ((parivar_pehchan_patra IS NOT NULL) AND (lead_stage <> 'cancelled'::public.lead_stage));


--
-- Name: idx_consumers_reg_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consumers_reg_no ON public.consumers USING btree (registration_no);


--
-- Name: idx_credit_debit_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_created_at ON public.credit_debit_notes USING btree (created_at);


--
-- Name: idx_credit_debit_notes_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_invoice_id ON public.credit_debit_notes USING btree (invoice_id);


--
-- Name: idx_credit_debit_notes_note_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_note_number ON public.credit_debit_notes USING btree (note_number);


--
-- Name: idx_credit_debit_notes_note_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_note_type ON public.credit_debit_notes USING btree (note_type);


--
-- Name: idx_credit_debit_notes_original_invoice_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_original_invoice_no ON public.credit_debit_notes USING btree (original_invoice_no);


--
-- Name: idx_credit_debit_notes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_debit_notes_status ON public.credit_debit_notes USING btree (status);


--
-- Name: idx_custom_reports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_reports_created_at ON public.custom_reports USING btree (created_at DESC);


--
-- Name: idx_custom_reports_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_reports_created_by ON public.custom_reports USING btree (created_by_user_id);


--
-- Name: idx_custom_reports_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_reports_project ON public.custom_reports USING btree (project_id);


--
-- Name: idx_demands_consumer_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demands_consumer_due_date ON public.demands USING btree (consumer_id, due_date);


--
-- Name: idx_doc_checklists_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_checklists_consumer ON public.document_checklists USING btree (consumer_id);


--
-- Name: idx_document_vault_allocation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_vault_allocation ON public.document_vault USING btree (allocation_id);


--
-- Name: idx_document_vault_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_vault_category ON public.document_vault USING btree (document_category);


--
-- Name: idx_document_vault_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_vault_consumer ON public.document_vault USING btree (consumer_id);


--
-- Name: idx_document_vault_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_vault_folder ON public.document_vault USING btree (folder_id);


--
-- Name: idx_document_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_versions_created_at ON public.document_versions USING btree (created_at DESC);


--
-- Name: idx_document_versions_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_versions_document ON public.document_versions USING btree (document_id);


--
-- Name: idx_documents_allocation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_allocation ON public.documents USING btree (allocation_id);


--
-- Name: idx_documents_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_consumer ON public.documents USING btree (consumer_id);


--
-- Name: idx_documents_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_delivery_status ON public.documents USING btree (delivery_status);


--
-- Name: idx_documents_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_template ON public.documents USING btree (template_id);


--
-- Name: idx_draw_refunds_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draw_refunds_consumer ON public.draw_refunds USING btree (consumer_id);


--
-- Name: idx_draw_refunds_due_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draw_refunds_due_by ON public.draw_refunds USING btree (refund_due_by);


--
-- Name: idx_draw_refunds_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draw_refunds_project ON public.draw_refunds USING btree (project_id);


--
-- Name: idx_draw_refunds_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_draw_refunds_status ON public.draw_refunds USING btree (refund_status);


--
-- Name: idx_employee_profiles_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_profiles_dept ON public.employee_profiles USING btree (department_id);


--
-- Name: idx_employee_profiles_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_profiles_manager ON public.employee_profiles USING btree (manager_id);


--
-- Name: idx_employee_profiles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_profiles_user ON public.employee_profiles USING btree (user_id);


--
-- Name: idx_faq_articles_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_articles_category ON public.faq_articles USING btree (category_id);


--
-- Name: idx_faq_articles_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_articles_published ON public.faq_articles USING btree (is_published);


--
-- Name: idx_faq_articles_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_articles_search ON public.faq_articles USING gin (to_tsvector('english'::regconfig, (((title)::text || ' '::text) || content)));


--
-- Name: idx_faq_articles_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_articles_tags ON public.faq_articles USING gin (tags);


--
-- Name: idx_financial_audit_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_audit_consumer ON public.financial_audit_logs USING btree (consumer_id);


--
-- Name: idx_financial_years_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_years_active ON public.financial_years USING btree (is_active);


--
-- Name: idx_floors_tower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_floors_tower ON public.floors USING btree (tower_id);


--
-- Name: idx_gst_charge_mapping_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_charge_mapping_project ON public.gst_tax_charge_mapping USING btree (project_id);


--
-- Name: idx_gst_invoices_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_invoices_consumer ON public.gst_invoices USING btree (consumer_id);


--
-- Name: idx_gst_invoices_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_invoices_project ON public.gst_invoices USING btree (project_id);


--
-- Name: idx_gst_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_invoices_status ON public.gst_invoices USING btree (status);


--
-- Name: idx_gst_slabs_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_slabs_dates ON public.gst_slabs USING btree (from_date, to_date);


--
-- Name: idx_gst_tax_setup_slab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gst_tax_setup_slab ON public.gst_tax_setup USING btree (slab_id);


--
-- Name: idx_hsn_sac_assign_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hsn_sac_assign_project ON public.hsn_sac_code_assign USING btree (project_id);


--
-- Name: idx_hsn_sac_codes_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hsn_sac_codes_type ON public.hsn_sac_codes USING btree (type);


--
-- Name: idx_interest_waivers_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interest_waivers_consumer ON public.interest_waivers USING btree (consumer_id);


--
-- Name: idx_interest_waivers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interest_waivers_status ON public.interest_waivers USING btree (status);


--
-- Name: idx_loan_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loan_consumer ON public.loan_details USING btree (consumer_id);


--
-- Name: idx_milestones_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_project ON public.construction_milestones USING btree (project_id);


--
-- Name: idx_milestones_project_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_project_status ON public.construction_milestones USING btree (project_id, status);


--
-- Name: idx_milestones_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_status ON public.construction_milestones USING btree (status);


--
-- Name: idx_outgoing_payments_bank_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outgoing_payments_bank_account ON public.outgoing_payments USING btree (company_bank_account_id);


--
-- Name: idx_outgoing_payments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outgoing_payments_date ON public.outgoing_payments USING btree (payment_date);


--
-- Name: idx_outgoing_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outgoing_payments_status ON public.outgoing_payments USING btree (status);


--
-- Name: idx_parking_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parking_consumer ON public.parking_slots USING btree (allotted_to_consumer_id);


--
-- Name: idx_parking_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parking_project ON public.parking_slots USING btree (project_id);


--
-- Name: idx_parking_slots_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parking_slots_project ON public.parking_slots USING btree (project_id);


--
-- Name: idx_parking_slots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parking_slots_status ON public.parking_slots USING btree (status);


--
-- Name: idx_plan_addon_pct_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_addon_pct_master ON public.plan_addon_charge_pct USING btree (charge_master_id);


--
-- Name: idx_plan_addon_pct_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_addon_pct_template ON public.plan_addon_charge_pct USING btree (plan_schedule_template_id);


--
-- Name: idx_plan_templates_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_templates_plan ON public.plan_schedule_templates USING btree (project_id, plan_name);


--
-- Name: idx_plan_templates_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_templates_project ON public.plan_schedule_templates USING btree (project_id);


--
-- Name: idx_project_gstin_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_gstin_project ON public.project_gstin USING btree (project_id);


--
-- Name: idx_project_interest_rates_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_interest_rates_project ON public.project_interest_rates USING btree (project_id, effective_from DESC);


--
-- Name: idx_project_rera_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_rera_project ON public.project_rera_numbers USING btree (project_id);


--
-- Name: idx_projects_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_company_id ON public.projects USING btree (company_id);


--
-- Name: idx_receipts_payment_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_payment_plan ON public.receipts USING btree (payment_plan_id);


--
-- Name: idx_registry_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_registry_unit ON public.registry_details USING btree (unit_id);


--
-- Name: idx_remarks_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_remarks_consumer ON public.remarks USING btree (consumer_id);


--
-- Name: idx_support_tickets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets USING btree (assigned_to_user_id);


--
-- Name: idx_support_tickets_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_consumer ON public.support_tickets USING btree (consumer_id);


--
-- Name: idx_support_tickets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_surrender_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surrender_consumer ON public.surrender_applications USING btree (consumer_id);


--
-- Name: idx_tasks_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assigned ON public.tasks USING btree (assigned_to);


--
-- Name: idx_tasks_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_consumer ON public.tasks USING btree (consumer_id);


--
-- Name: idx_tasks_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due ON public.tasks USING btree (due_date);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);


--
-- Name: idx_teams_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_department ON public.teams USING btree (department_id);


--
-- Name: idx_towers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_towers_deleted_at ON public.towers USING btree (deleted_at);


--
-- Name: idx_transfer_fee_master_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_fee_master_project ON public.transfer_fee_master USING btree (project_id);


--
-- Name: idx_transfer_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transfer_unit ON public.ownership_transfers USING btree (unit_id);


--
-- Name: idx_unit_holds_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_holds_expiry ON public.unit_holds USING btree (expires_at, status);


--
-- Name: idx_unit_locations_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_locations_project ON public.unit_locations USING btree (project_id);


--
-- Name: idx_unit_shifts_consumer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_shifts_consumer ON public.unit_shifts USING btree (consumer_id);


--
-- Name: idx_unit_shifts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_shifts_date ON public.unit_shifts USING btree (shift_date);


--
-- Name: idx_unit_types_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unit_types_project ON public.unit_types USING btree (project_id);


--
-- Name: idx_units_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_project ON public.units USING btree (project_id);


--
-- Name: idx_units_registry_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_registry_status ON public.units USING btree (registry_status);


--
-- Name: idx_units_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_units_status ON public.units USING btree (status);


--
-- Name: idx_user_company_access_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_company_access_company ON public.user_company_access USING btree (company_id);


--
-- Name: idx_user_company_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_company_access_user ON public.user_company_access USING btree (user_id);


--
-- Name: idx_user_process_permissions_process; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_process_permissions_process ON public.user_process_permissions USING btree (process_name);


--
-- Name: idx_user_process_permissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_process_permissions_user ON public.user_process_permissions USING btree (user_id);


--
-- Name: uq_booking_records_active_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_booking_records_active_unit ON public.booking_records USING btree (unit_id) WHERE ((status)::text = ANY ((ARRAY['pending_payment'::character varying, 'active'::character varying, 'complete'::character varying])::text[]));


--
-- Name: allocations update_allocations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON public.allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: consumers update_consumers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_consumers_updated_at BEFORE UPDATE ON public.consumers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: demands update_demands_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_demands_updated_at BEFORE UPDATE ON public.demands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_plans update_payment_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: receipts update_receipts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: towers update_towers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_towers_updated_at BEFORE UPDATE ON public.towers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: units update_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: addon_charge_master addon_charge_master_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_charge_master
    ADD CONSTRAINT addon_charge_master_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: addon_charge_master addon_charge_master_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addon_charge_master
    ADD CONSTRAINT addon_charge_master_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: allocations allocations_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: allocations allocations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: allocations allocations_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allocations
    ADD CONSTRAINT allocations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: allotment_letters allotment_letters_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allotment_letters
    ADD CONSTRAINT allotment_letters_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: applicant_addresses applicant_addresses_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_addresses
    ADD CONSTRAINT applicant_addresses_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicant_details(id);


--
-- Name: applicant_details applicant_details_booking_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicant_details
    ADD CONSTRAINT applicant_details_booking_form_id_fkey FOREIGN KEY (booking_form_id) REFERENCES public.booking_forms(id);


--
-- Name: application_history application_history_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: automation_rules automation_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bank_accounts bank_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: bank_statement_imports bank_statement_imports_imported_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_imported_by_user_id_fkey FOREIGN KEY (imported_by_user_id) REFERENCES public.users(id);


--
-- Name: bank_statement_imports bank_statement_imports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_imports
    ADD CONSTRAINT bank_statement_imports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: bank_transactions bank_transactions_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_matched_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_by_user_id_fkey FOREIGN KEY (matched_by_user_id) REFERENCES public.users(id);


--
-- Name: bank_transactions bank_transactions_matched_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_demand_id_fkey FOREIGN KEY (matched_demand_id) REFERENCES public.demands(id);


--
-- Name: bank_transactions bank_transactions_matched_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_matched_receipt_id_fkey FOREIGN KEY (matched_receipt_id) REFERENCES public.receipts(id);


--
-- Name: booking_counters booking_counters_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_counters
    ADD CONSTRAINT booking_counters_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: booking_documents booking_documents_booking_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_documents
    ADD CONSTRAINT booking_documents_booking_record_id_fkey FOREIGN KEY (booking_record_id) REFERENCES public.booking_records(id) ON DELETE CASCADE;


--
-- Name: booking_documents booking_documents_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_documents
    ADD CONSTRAINT booking_documents_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: booking_documents booking_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_documents
    ADD CONSTRAINT booking_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: booking_documents booking_documents_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_documents
    ADD CONSTRAINT booking_documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: booking_forms booking_forms_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.broker_applications(id);


--
-- Name: booking_forms booking_forms_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: booking_forms booking_forms_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: booking_forms booking_forms_main_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_main_broker_id_fkey FOREIGN KEY (main_broker_id) REFERENCES public.broker_applications(id);


--
-- Name: booking_forms booking_forms_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: booking_forms booking_forms_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: booking_forms booking_forms_sales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_sales_employee_id_fkey FOREIGN KEY (sales_employee_id) REFERENCES public.users(id);


--
-- Name: booking_forms booking_forms_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_forms
    ADD CONSTRAINT booking_forms_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: booking_payment_taxes booking_payment_taxes_booking_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payment_taxes
    ADD CONSTRAINT booking_payment_taxes_booking_record_id_fkey FOREIGN KEY (booking_record_id) REFERENCES public.booking_records(id) ON DELETE CASCADE;


--
-- Name: booking_records booking_records_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: booking_records booking_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_discount_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_discount_authorized_by_fkey FOREIGN KEY (discount_authorized_by) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: booking_records booking_records_sales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_sales_employee_id_fkey FOREIGN KEY (sales_employee_id) REFERENCES public.users(id);


--
-- Name: booking_records booking_records_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_records
    ADD CONSTRAINT booking_records_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: broadcast_campaigns broadcast_campaigns_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: broadcast_campaigns broadcast_campaigns_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broadcast_campaigns
    ADD CONSTRAINT broadcast_campaigns_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: broker_commissions broker_commissions_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_commissions broker_commissions_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: broker_commissions broker_commissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: broker_commissions broker_commissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: broker_commissions broker_commissions_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_commissions
    ADD CONSTRAINT broker_commissions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: broker_project_mapping broker_project_mapping_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_project_mapping broker_project_mapping_mapped_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_mapped_by_fkey FOREIGN KEY (mapped_by) REFERENCES public.users(id);


--
-- Name: broker_project_mapping broker_project_mapping_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_project_mapping
    ADD CONSTRAINT broker_project_mapping_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: broker_tax_config broker_tax_config_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: broker_tax_config broker_tax_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_tax_config
    ADD CONSTRAINT broker_tax_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: brokers brokers_parent_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_parent_broker_id_fkey FOREIGN KEY (parent_broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;


--
-- Name: call_logs call_logs_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_status_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_status_code_fkey FOREIGN KEY (status_code) REFERENCES public.communication_status_codes(code);


--
-- Name: call_logs call_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: campaign_metrics campaign_metrics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: campaign_metrics campaign_metrics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_metrics
    ADD CONSTRAINT campaign_metrics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: campaigns campaigns_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: campaigns campaigns_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: cancellations cancellations_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: cancellations cancellations_booking_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_booking_record_id_fkey FOREIGN KEY (booking_record_id) REFERENCES public.booking_records(id);


--
-- Name: cancellations cancellations_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: cancellations cancellations_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellations
    ADD CONSTRAINT cancellations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: charge_master_config charge_master_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.charge_master_config
    ADD CONSTRAINT charge_master_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: co_applicants co_applicants_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.co_applicants
    ADD CONSTRAINT co_applicants_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: communications communications_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: communications communications_sent_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communications
    ADD CONSTRAINT communications_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES public.users(id);


--
-- Name: company_bank_accounts company_bank_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bank_accounts
    ADD CONSTRAINT company_bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_bank_accounts company_bank_accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_bank_accounts
    ADD CONSTRAINT company_bank_accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: construction_milestones construction_milestones_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: construction_milestones construction_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: construction_milestones construction_milestones_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: consumer_addon_charges consumer_addon_charges_charge_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_addon_charges
    ADD CONSTRAINT consumer_addon_charges_charge_master_id_fkey FOREIGN KEY (charge_master_id) REFERENCES public.addon_charge_master(id);


--
-- Name: consumer_addon_charges consumer_addon_charges_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_addon_charges
    ADD CONSTRAINT consumer_addon_charges_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: consumer_addon_charges consumer_addon_charges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_addon_charges
    ADD CONSTRAINT consumer_addon_charges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: consumer_addon_charges consumer_addon_charges_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_addon_charges
    ADD CONSTRAINT consumer_addon_charges_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: consumer_folders consumer_folders_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: consumer_folders consumer_folders_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: consumer_folders consumer_folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumer_folders
    ADD CONSTRAINT consumer_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.consumer_folders(id);


--
-- Name: consumers consumers_allocated_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_allocated_unit_id_fkey FOREIGN KEY (allocated_unit_id) REFERENCES public.units(id);


--
-- Name: consumers consumers_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: consumers consumers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consumers
    ADD CONSTRAINT consumers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conveyance_deeds conveyance_deeds_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: conveyance_deeds conveyance_deeds_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: conveyance_deeds conveyance_deeds_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveyance_deeds
    ADD CONSTRAINT conveyance_deeds_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: credit_debit_notes credit_debit_notes_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: credit_debit_notes credit_debit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_debit_notes
    ADD CONSTRAINT credit_debit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.gst_invoices(id) ON DELETE CASCADE;


--
-- Name: custom_reports custom_reports_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: custom_reports custom_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: demands demands_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: demands demands_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: demands demands_raised_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.users(id);


--
-- Name: demands demands_tax_slab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demands
    ADD CONSTRAINT demands_tax_slab_id_fkey FOREIGN KEY (tax_slab_id) REFERENCES public.tax_slabs(id);


--
-- Name: departments departments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: departments departments_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: document_checklists document_checklists_booking_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_checklists
    ADD CONSTRAINT document_checklists_booking_record_id_fkey FOREIGN KEY (booking_record_id) REFERENCES public.booking_records(id);


--
-- Name: document_checklists document_checklists_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_checklists
    ADD CONSTRAINT document_checklists_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: document_checklists document_checklists_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_checklists
    ADD CONSTRAINT document_checklists_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES public.users(id);


--
-- Name: document_dispatch document_dispatch_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: document_dispatch document_dispatch_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_dispatch
    ADD CONSTRAINT document_dispatch_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: document_field_overrides document_field_overrides_edited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_field_overrides
    ADD CONSTRAINT document_field_overrides_edited_by_user_id_fkey FOREIGN KEY (edited_by_user_id) REFERENCES public.users(id);


--
-- Name: document_templates document_templates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: document_vault document_vault_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: document_vault document_vault_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: document_vault document_vault_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.consumer_folders(id);


--
-- Name: document_vault document_vault_uploaded_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_vault
    ADD CONSTRAINT document_vault_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id);


--
-- Name: document_versions document_versions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: documents documents_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: documents documents_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_deleted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_user_id_fkey FOREIGN KEY (deleted_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_sent_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES public.users(id);


--
-- Name: documents documents_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.document_templates(id);


--
-- Name: draw_refunds draw_refunds_company_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_company_bank_account_id_fkey FOREIGN KEY (company_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;


--
-- Name: draw_refunds draw_refunds_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: draw_refunds draw_refunds_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: draw_refunds draw_refunds_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.draw_refunds
    ADD CONSTRAINT draw_refunds_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: emails emails_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: employee_profiles employee_profiles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: employee_profiles employee_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_profiles
    ADD CONSTRAINT employee_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: faq_articles faq_articles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.faq_categories(id);


--
-- Name: faq_articles faq_articles_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: faq_articles faq_articles_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_articles
    ADD CONSTRAINT faq_articles_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: faq_categories faq_categories_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_categories
    ADD CONSTRAINT faq_categories_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: financial_audit_logs financial_audit_logs_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_audit_logs
    ADD CONSTRAINT financial_audit_logs_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: financial_audit_logs financial_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_audit_logs
    ADD CONSTRAINT financial_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: financial_years financial_years_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_years
    ADD CONSTRAINT financial_years_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: floors floors_tower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.floors
    ADD CONSTRAINT floors_tower_id_fkey FOREIGN KEY (tower_id) REFERENCES public.towers(id) ON DELETE CASCADE;


--
-- Name: gst_invoices gst_invoices_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: gst_invoices gst_invoices_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: gst_invoices gst_invoices_linked_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_linked_invoice_id_fkey FOREIGN KEY (linked_invoice_id) REFERENCES public.gst_invoices(id);


--
-- Name: gst_invoices gst_invoices_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: gst_invoices gst_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: gst_invoices gst_invoices_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_invoices
    ADD CONSTRAINT gst_invoices_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: gst_process_rights gst_process_rights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_process_rights
    ADD CONSTRAINT gst_process_rights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: gst_slabs gst_slabs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_slabs
    ADD CONSTRAINT gst_slabs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: gst_tax_charge_mapping gst_tax_charge_mapping_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_tax_charge_mapping_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: gst_tax_charge_mapping gst_tax_charge_mapping_gst_tax_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_tax_charge_mapping_gst_tax_id_fkey FOREIGN KEY (gst_tax_id) REFERENCES public.gst_tax_setup(id) ON DELETE SET NULL;


--
-- Name: gst_tax_charge_mapping gst_tax_charge_mapping_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_tax_charge_mapping_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: gst_tax_charge_mapping gst_tax_charge_mapping_slab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_charge_mapping
    ADD CONSTRAINT gst_tax_charge_mapping_slab_id_fkey FOREIGN KEY (slab_id) REFERENCES public.gst_slabs(id) ON DELETE CASCADE;


--
-- Name: gst_tax_setup gst_tax_setup_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_setup
    ADD CONSTRAINT gst_tax_setup_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: gst_tax_setup gst_tax_setup_slab_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gst_tax_setup
    ADD CONSTRAINT gst_tax_setup_slab_id_fkey FOREIGN KEY (slab_id) REFERENCES public.gst_slabs(id) ON DELETE CASCADE;


--
-- Name: head_wise_costs head_wise_costs_booking_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_wise_costs
    ADD CONSTRAINT head_wise_costs_booking_form_id_fkey FOREIGN KEY (booking_form_id) REFERENCES public.booking_forms(id);


--
-- Name: hsn_sac_code_assign hsn_sac_code_assign_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_code_assign
    ADD CONSTRAINT hsn_sac_code_assign_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: hsn_sac_code_assign hsn_sac_code_assign_hsn_sac_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_code_assign
    ADD CONSTRAINT hsn_sac_code_assign_hsn_sac_id_fkey FOREIGN KEY (hsn_sac_id) REFERENCES public.hsn_sac_codes(id) ON DELETE CASCADE;


--
-- Name: hsn_sac_code_assign hsn_sac_code_assign_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_code_assign
    ADD CONSTRAINT hsn_sac_code_assign_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: hsn_sac_codes hsn_sac_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hsn_sac_codes
    ADD CONSTRAINT hsn_sac_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: import_history import_history_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_history
    ADD CONSTRAINT import_history_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.users(id);


--
-- Name: interest_waivers interest_waivers_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interest_waivers
    ADD CONSTRAINT interest_waivers_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: journal_entries journal_entries_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: kyc_documents kyc_documents_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: outgoing_payments outgoing_payments_company_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_payments
    ADD CONSTRAINT outgoing_payments_company_bank_account_id_fkey FOREIGN KEY (company_bank_account_id) REFERENCES public.company_bank_accounts(id);


--
-- Name: outgoing_payments outgoing_payments_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing_payments
    ADD CONSTRAINT outgoing_payments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: parking_slots parking_slots_allotted_to_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_allotted_to_consumer_id_fkey FOREIGN KEY (allotted_to_consumer_id) REFERENCES public.consumers(id);


--
-- Name: parking_slots parking_slots_allotted_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_allotted_unit_id_fkey FOREIGN KEY (allotted_unit_id) REFERENCES public.units(id);


--
-- Name: parking_slots parking_slots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: parking_slots parking_slots_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parking_slots
    ADD CONSTRAINT parking_slots_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: payment_plans payment_plans_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: payment_plans payment_plans_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: payment_plans payment_plans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: payment_plans payment_plans_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: payment_refunds payment_refunds_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: payment_refunds payment_refunds_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: payment_refunds payment_refunds_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_refunds
    ADD CONSTRAINT payment_refunds_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: penal_interests penal_interests_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: penal_interests penal_interests_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.penal_interests
    ADD CONSTRAINT penal_interests_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: plan_addon_charge_pct plan_addon_charge_pct_charge_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_addon_charge_pct
    ADD CONSTRAINT plan_addon_charge_pct_charge_master_id_fkey FOREIGN KEY (charge_master_id) REFERENCES public.addon_charge_master(id) ON DELETE CASCADE;


--
-- Name: plan_addon_charge_pct plan_addon_charge_pct_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_addon_charge_pct
    ADD CONSTRAINT plan_addon_charge_pct_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: plan_addon_charge_pct plan_addon_charge_pct_plan_schedule_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_addon_charge_pct
    ADD CONSTRAINT plan_addon_charge_pct_plan_schedule_template_id_fkey FOREIGN KEY (plan_schedule_template_id) REFERENCES public.plan_schedule_templates(id) ON DELETE CASCADE;


--
-- Name: plan_schedule_templates plan_schedule_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: plan_schedule_templates plan_schedule_templates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_schedule_templates
    ADD CONSTRAINT plan_schedule_templates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_gstin project_gstin_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gstin
    ADD CONSTRAINT project_gstin_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_gstin project_gstin_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gstin
    ADD CONSTRAINT project_gstin_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_interest_rates project_interest_rates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_interest_rates
    ADD CONSTRAINT project_interest_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_interest_rates project_interest_rates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_interest_rates
    ADD CONSTRAINT project_interest_rates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_rera_numbers project_rera_numbers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rera_numbers
    ADD CONSTRAINT project_rera_numbers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_rera_numbers project_rera_numbers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rera_numbers
    ADD CONSTRAINT project_rera_numbers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_rera_numbers project_rera_numbers_tower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rera_numbers
    ADD CONSTRAINT project_rera_numbers_tower_id_fkey FOREIGN KEY (tower_id) REFERENCES public.towers(id) ON DELETE SET NULL;


--
-- Name: project_smtp_configs project_smtp_configs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_smtp_configs
    ADD CONSTRAINT project_smtp_configs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_advance_from_demand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_advance_from_demand_id_fkey FOREIGN KEY (advance_from_demand_id) REFERENCES public.demands(id);


--
-- Name: receipts receipts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: receipts receipts_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.users(id);


--
-- Name: receipts receipts_clearing_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_clearing_bank_id_fkey FOREIGN KEY (clearing_bank_id) REFERENCES public.banks(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_company_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_company_bank_account_id_fkey FOREIGN KEY (company_bank_account_id) REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: receipts receipts_payment_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id);


--
-- Name: remarks remarks_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: reminder_master reminder_master_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_master
    ADD CONSTRAINT reminder_master_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: role_page_access role_page_access_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_page_access
    ADD CONSTRAINT role_page_access_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.nav_pages(id) ON DELETE CASCADE;


--
-- Name: states states_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: support_tickets support_tickets_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.allocations(id);


--
-- Name: surrender_applications surrender_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_booking_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_booking_record_id_fkey FOREIGN KEY (booking_record_id) REFERENCES public.booking_records(id);


--
-- Name: surrender_applications surrender_applications_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: surrender_applications surrender_applications_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: surrender_applications surrender_applications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: surrender_applications surrender_applications_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surrender_applications
    ADD CONSTRAINT surrender_applications_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tasks tasks_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tds_assignments tds_assignments_challan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_challan_id_fkey FOREIGN KEY (challan_id) REFERENCES public.tds_challans(id);


--
-- Name: tds_assignments tds_assignments_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: tds_assignments tds_assignments_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tds_assignments
    ADD CONSTRAINT tds_assignments_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: teams teams_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: teams teams_team_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_team_head_id_fkey FOREIGN KEY (team_head_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: towers towers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.towers
    ADD CONSTRAINT towers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transfer_fee_master transfer_fee_master_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfer_fee_master
    ADD CONSTRAINT transfer_fee_master_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: unit_holds unit_holds_broker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_broker_id_fkey FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE CASCADE;


--
-- Name: unit_holds unit_holds_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: unit_holds unit_holds_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_holds
    ADD CONSTRAINT unit_holds_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: unit_locations unit_locations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_locations
    ADD CONSTRAINT unit_locations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: unit_shifts unit_shifts_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id) ON DELETE CASCADE;


--
-- Name: unit_shifts unit_shifts_new_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_new_unit_id_fkey FOREIGN KEY (new_unit_id) REFERENCES public.units(id);


--
-- Name: unit_shifts unit_shifts_old_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_old_unit_id_fkey FOREIGN KEY (old_unit_id) REFERENCES public.units(id);


--
-- Name: unit_shifts unit_shifts_shifted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_shifts
    ADD CONSTRAINT unit_shifts_shifted_by_user_id_fkey FOREIGN KEY (shifted_by_user_id) REFERENCES public.users(id);


--
-- Name: unit_status_history unit_status_history_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_status_history
    ADD CONSTRAINT unit_status_history_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: unit_types unit_types_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unit_types
    ADD CONSTRAINT unit_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: units units_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_floor_id_fkey FOREIGN KEY (floor_id) REFERENCES public.floors(id);


--
-- Name: units units_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: units units_tower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_tower_id_fkey FOREIGN KEY (tower_id) REFERENCES public.towers(id);


--
-- Name: units units_unit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_unit_type_id_fkey FOREIGN KEY (unit_type_id) REFERENCES public.unit_types(id);


--
-- Name: user_company_access user_company_access_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: user_company_access user_company_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_ip_restrictions user_ip_restrictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_ip_restrictions
    ADD CONSTRAINT user_ip_restrictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_process_permissions user_process_permissions_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_process_permissions
    ADD CONSTRAINT user_process_permissions_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: user_process_permissions user_process_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_process_permissions
    ADD CONSTRAINT user_process_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: waitlists waitlists_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: waitlists waitlists_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlists
    ADD CONSTRAINT waitlists_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: whatsapps whatsapps_consumer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapps
    ADD CONSTRAINT whatsapps_consumer_id_fkey FOREIGN KEY (consumer_id) REFERENCES public.consumers(id);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_append_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_append_only ON public.audit_logs USING (true) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--


