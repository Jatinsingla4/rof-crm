/**
 * ROF CRM - Shared TypeScript Types
 * Single source of truth for all domain types
 */
export * from './consumer';
export * from './unit';
export * from './allotment';
export * from './payment';
export * from './user';
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
//# sourceMappingURL=index.d.ts.map