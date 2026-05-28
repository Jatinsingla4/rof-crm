/**
 * Allotment Types - ROF CRM
 * E-draw results, allocation, allotment letters, waitlists, cancellations
 */
export type AllocationStatus = 'allotted' | 'agreement_signed' | 'cancelled';
export interface Allocation {
    id: string;
    consumerId: string;
    unitId: string;
    projectId: string;
    allocatedDate: Date;
    status: AllocationStatus;
    allotmentLetterId?: string;
    createdAt: Date;
    createdByUserId: string;
}
export interface AllotmentLetter {
    id: string;
    allocationId: string;
    consumerId: string;
    unitId: string;
    letterDate: Date;
    termsAgreed: boolean;
    generatedAt: Date;
    deliveredAt?: Date;
    deliveryChannel: 'email' | 'whatsapp' | 'print';
}
export interface Waitlist {
    id: string;
    projectId: string;
    unitTypeOrUnitId: string;
    consumerId: string;
    positionOrdered: number;
    promotedToAllocationId?: string;
    promotedAt?: Date;
    createdAt: Date;
}
/**
 * E-Draw Result Import
 * CSV format from TCP Haryana portal
 */
export interface EDraw {
    applicantId: string;
    result: 'allotted' | 'waitlist' | 'unsuccessful';
    unitType?: string;
    drawDate: Date;
    drawPosition?: number;
}
export interface EDrawImportResult {
    totalResults: number;
    matched: number;
    mismatched: number;
    mismatches: Array<{
        applicantId: string;
        reason: string;
    }>;
}
export interface CreateAllocationInput {
    consumerId: string;
    unitId: string;
    projectId: string;
}
export interface CreateWaitlistInput {
    consumerId: string;
    projectId: string;
    unitTypeOrUnitId: string;
}
export interface PromoteWaitlistInput {
    waitlistId: string;
    unitId: string;
}
//# sourceMappingURL=allotment.d.ts.map