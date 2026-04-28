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
  unitTypeOrUnitId: string; // Can be for unit type (2BHK) or specific unit
  consumerId: string;
  positionOrdered: number; // 1 = first in line
  promotedToAllocationId?: string; // When promoted
  promotedAt?: Date;
  createdAt: Date;
}

/**
 * E-Draw Result Import
 * CSV format from TCP Haryana portal
 */
export interface EDraw {
  applicantId: string; // TCP application ID (to be matched to Consumer.aadhaarHash)
  result: 'allotted' | 'waitlist' | 'unsuccessful';
  unitType?: string; // For allocation
  drawDate: Date;
  drawPosition?: number; // Position in draw result
}

export interface EDrawImportResult {
  totalResults: number;
  matched: number; // Successfully matched to consumers
  mismatched: number; // Could not auto-match
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
