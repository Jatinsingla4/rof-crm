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
    projectIds: string[];
    department: Department;
    createdAt: Date;
    lastLoginAt?: Date;
    status: 'active' | 'inactive';
}
export interface Role {
    id: string;
    name: RoleName;
    isCustom: boolean;
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
export declare const ROLE_DEFINITIONS: Record<RoleName, {
    name: RoleName;
    description: string;
}>;
/**
 * Field Masking Rules (per role)
 */
export declare const FIELD_MASKING_RULES: Record<RoleName, Partial<Record<string, FieldMasking>>>;
export interface AuditLog {
    id: string;
    userId: string;
    timestamp: Date;
    action: 'create' | 'update' | 'delete' | 'export';
    resourceType: ResourceType;
    resourceId: string;
    previousValues?: Record<string, any>;
    newValues?: Record<string, any>;
    immutable: true;
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
//# sourceMappingURL=user.d.ts.map