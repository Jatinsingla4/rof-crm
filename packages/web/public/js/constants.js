// ROF CRM — Global Constants
// Shared enums, status maps, and config values

const ROF = {
  API_BASE: '/api',
  TOKEN_KEY: 'rof-jwt',
  THEME_KEY: 'rof-theme',

  LEAD_STAGES: ['enquiry','interested','application_filed','draw_entered','allotted','onboarded','cancelled'],

  UNIT_STATUSES: [
    'available','application_received','draw_pending','allotted',
    'agreement_signed','under_construction','oc_received','possession_handed_over','locked'
  ],

  INCOME_CATEGORIES: ['EWS','LIG','MIG'],

  PAYMENT_METHODS: ['bank_transfer','cheque','neft','rtgs','upi','cash','demand_draft'],

  CHANNELS: ['whatsapp','email','sms','instagram','facebook','internal'],

  DOCUMENT_CATEGORIES: ['KYC','Agreement','Payment','NOC','Legal','Other'],

  ROLES: ['super_admin','project_manager','sales_executive','accounts_finance','support_agent','read_only'],

  STATUS_CHIP: {
    // Unit statuses
    available:           { cls:'ch-green',  label:'Available' },
    application_received:{ cls:'ch-warn',   label:'App Received' },
    draw_pending:        { cls:'ch-gold',   label:'Draw Pending' },
    allotted:            { cls:'ch-blue',   label:'Allotted' },
    agreement_signed:    { cls:'ch-purple', label:'Agreement' },
    under_construction:  { cls:'ch-teal',   label:'U/C' },
    oc_received:         { cls:'ch-green',  label:'OC Received' },
    possession_handed_over:{ cls:'ch-teal', label:'Possession' },
    locked:              { cls:'ch-gray',   label:'Locked' },
    // Lead stages
    enquiry:             { cls:'ch-gray',   label:'Enquiry' },
    interested:          { cls:'ch-blue',   label:'Interested' },
    application_filed:   { cls:'ch-gold',   label:'App Filed' },
    draw_entered:        { cls:'ch-warn',   label:'Draw Entered' },
    onboarded:           { cls:'ch-teal',   label:'Onboarded' },
    cancelled:           { cls:'ch-red',    label:'Cancelled' },
    // Payment / demand statuses
    paid:                { cls:'ch-green',  label:'Paid' },
    pending:             { cls:'ch-warn',   label:'Pending' },
    overdue:             { cls:'ch-red',    label:'Overdue' },
    partial:             { cls:'ch-gold',   label:'Partial' },
    approved:            { cls:'ch-teal',   label:'Approved' },
    rejected:            { cls:'ch-red',    label:'Rejected' },
    // Generic states
    active:              { cls:'ch-teal',   label:'Active' },
    inactive:            { cls:'ch-gray',   label:'Inactive' },
    suspended:           { cls:'ch-red',    label:'Suspended' },
    held:                { cls:'ch-gold',   label:'Held' },
    expired:             { cls:'ch-gray',   label:'Expired' },
    converted:           { cls:'ch-green',  label:'Converted' },
    completed:           { cls:'ch-green',  label:'Completed' },
    // Plan installment types
    installment:         { cls:'ch-blue',   label:'Installment' },
    plc:                 { cls:'ch-purple', label:'PLC Charge' },
    other_charge:        { cls:'ch-warn',   label:'Other Charge' },
    booking:             { cls:'ch-teal',   label:'Booking' },
    possession:          { cls:'ch-green',  label:'Possession' },
    // Consumer statuses (Flask CRM field)
    Booked:              { cls:'ch-warn',   label:'Booked' },
    Allotted:            { cls:'ch-blue',   label:'Allotted' },
    'Agreement Signed':  { cls:'ch-purple', label:'Agreement' },
    Possession:          { cls:'ch-teal',   label:'Possession' },
    Overdue:             { cls:'ch-red',    label:'Overdue' },
    'Draw Pending':      { cls:'ch-gold',   label:'Draw Pending' },
    Cancelled:           { cls:'ch-gray',   label:'Cancelled' },
  },

  BHK_TYPES: ['Studio','1BHK','2BHK','3BHK'],
  TOWERS: ['A','B','C','D','E','F'],
  FACINGS: ['East','West','North','South','North-East','South-East','North-West','South-West'],
};

// Global page registry — must exist before any page module loads
const Pages = {};

// Page-scoped namespaces — declared early so modules can reference them
const SMPage  = {};   // Set Master
const SPJPage = {};   // Set Projects
const EmpPage = {};   // Employees
