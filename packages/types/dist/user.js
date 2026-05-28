/**
 * User & RBAC Types - ROF CRM
 * 6 pre-defined roles + custom role builder
 */
/**
 * RBAC Roles - Pre-defined
 */
export const ROLE_DEFINITIONS = {
    super_admin: {
        name: 'super_admin',
        description: 'Full access to all modules, all projects, all actions',
    },
    project_manager: {
        name: 'project_manager',
        description: 'Full access to assigned projects only',
    },
    sales_executive: {
        name: 'sales_executive',
        description: 'Assigned leads only; Consumers, Allotments, Communications modules',
    },
    accounts_finance: {
        name: 'accounts_finance',
        description: 'Payments module (full), Documents (demand + receipt only), Consumers (read-only)',
    },
    support_agent: {
        name: 'support_agent',
        description: 'Communications, Remarks Log, Consumers (read-only)',
    },
    read_only_viewer: {
        name: 'read_only_viewer',
        description: 'Dashboards, Reports, Consumers (read-only), read-only view of all modules',
    },
};
/**
 * Field Masking Rules (per role)
 */
export const FIELD_MASKING_RULES = {
    super_admin: {},
    project_manager: {
        aadhaar: 'partial',
        pan: 'partial',
        bank_details: 'partial',
    },
    sales_executive: {
        aadhaar: 'full',
        pan: 'full',
        bank_details: 'full',
        payment_amounts: 'full',
    },
    accounts_finance: {
        bank_details: 'none',
        aadhaar: 'partial',
        pan: 'partial',
    },
    support_agent: {
        aadhaar: 'full',
        pan: 'full',
        bank_details: 'full',
        payment_amounts: 'full',
    },
    read_only_viewer: {
        aadhaar: 'full',
        pan: 'full',
        bank_details: 'full',
        payment_amounts: 'full',
    },
};
//# sourceMappingURL=user.js.map