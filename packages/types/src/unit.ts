/**
 * Unit Types - ROF CRM
 * Unit inventory with 8-stage status engine
 */

export type UnitStatus =
  | 'available'
  | 'application_received'
  | 'draw_pending'
  | 'allotted'
  | 'agreement_signed'
  | 'under_construction'
  | 'oc_received'
  | 'possession_handed_over'
  | 'locked';

export type BHKType = '1BHK' | '2BHK' | '3BHK' | 'Studio';
export type Facing = 'North' | 'South' | 'East' | 'West' | 'NE' | 'NW' | 'SE' | 'SW';

export interface Project {
  id: string;
  name: string;
  reraNumber: string; // RERA registration number
  tcpLicence: string; // Town & Country Planning licence
  location: string;
  landAreaSqft: number;
  totalUnits: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tower {
  id: string;
  projectId: string;
  towerName: string; // e.g., "Tower A", "Tower B"
  floors: number;
  unitsPerFloor: number;
  createdAt: Date;
}

export interface Unit {
  id: string;
  towerId: string;
  projectId: string;
  unitNumber: string; // e.g., "A-701", "B-1205" (unique per tower)
  bhkType: BHKType;
  carpetAreaSqft: number;
  superAreaSqft: number;
  facing: Facing;
  floor: number;
  balconyAreaSqft?: number;
  basePriceInr: number; // paise
  totalPriceInr: number; // paise (includes taxes, charges)
  floorPlanUrl?: string;
  status: UnitStatus;
  statusChangedAt: Date;
  lockedReason?: string; // If status = 'locked'
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
}

export interface UnitStatusHistory {
  id: string;
  unitId: string;
  previousStatus: UnitStatus;
  newStatus: UnitStatus;
  changedAt: Date;
  changedByUserId: string;
  reason?: string;
}

export interface UnitInventorySummary {
  projectId: string;
  totalUnits: number;
  available: number;
  applicationReceived: number;
  drawPending: number;
  allotted: number;
  agreementSigned: number;
  underConstruction: number;
  ocReceived: number;
  possessionHandedOver: number;
  locked: number;
  fillPercentage: number; // (allotted + agreement_signed + ...) / total * 100
}

export interface CreateUnitInput {
  towerId: string;
  unitNumber: string;
  bhkType: BHKType;
  carpetAreaSqft: number;
  superAreaSqft: number;
  facing: Facing;
  floor: number;
  balconyAreaSqft?: number;
  basePriceInr: number;
  totalPriceInr: number;
  floorPlanUrl?: string;
}

export interface UpdateUnitInput {
  basePriceInr?: number;
  totalPriceInr?: number;
  floorPlanUrl?: string;
  status?: UnitStatus;
}

export interface BulkUnitImportInput {
  projectId: string;
  towerId: string;
  units: CreateUnitInput[];
}
