/**
 * User & RBAC Types - ROF CRM
 * 6 pre-defined roles + custom role builder
 */

export type RoleName = 'super_admin' | 'project_manager' | 'sales_executive' | 'accounts_finance' | 'support_agent' | 'read_only_viewer';
export type Department = 'sales' | 'accounts' | 'support' | 'admin';
export type ResourceType = 'units' | 'consumers' | 'allotments' | 'payments' | 'documents' | 'communications' | 'users' | 'reports';
export type ActionType = 'view' | 'create' | 'edit' | 'delete' | 'export';
export type FieldMasking = 'none' | 'partial' | 'full';
export type PermissionScope = 'all_projects' | 'assigned_projects_only' | 'read_only';

export interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;
  projectIds: string[]; // Projects assigned to this user
  department: Department;
  createdAt: Date;
  lastLoginAt?: Date;
  status: 'active' | 'inactive';
}

export interface Role {
  id: string;
  name: RoleName;
  isCustom: boolean; // true for custom roles, false for pre-defined
  permissions: Permission[];
  createdAt: Date;
  createdByUserId?: string;
}

export interface Permission {
  id: string;
  roleId: string;
  resourceType: ResourceType;
  action: ActionType;
  fieldLevelMasking: FieldMasking;
  scope: PermissionScope;
}

/**
 * RBAC Roles - Pre-defined
 */
export const ROLE_DEFINITIONS: Record<RoleName, { name: RoleName; description: string }> = {
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
export const FIELD_MASKING_RULES: Record<RoleName, Partial<Record<string, FieldMasking>>> = {
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

export interface AuditLog {
  id: string;
  userId: string;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'export';
  resourceType: ResourceType;
  resourceId: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  immutable: true; // Cannot be modified or deleted
  retentionDays: 365;
}

export interface CreateUserInput {
  email: string;
  name: string;
  roleId: string;
  projectIds: string[];
  department: Department;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roleId?: string;
  projectIds?: string[];
  department?: Department;
  status?: 'active' | 'inactive';
}
