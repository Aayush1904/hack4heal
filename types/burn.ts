export type BurnMechanism = 'Flame' | 'Scald' | 'Chemical' | 'Electrical' | 'Contact' | 'Radiation';

export interface LundBrowderSegment {
  id: string;
  name: string;
  category: 'head' | 'torso' | 'arms' | 'legs' | 'perineum';
  baseAdultPercentage: number;
  // Lund-Browder adjusts head and thigh/leg based on age (0y, 1y, 5y, 10y, 15y, Adult)
  getPercentageForAge: (age: number) => number;
  partialBurnPercentage: number; // 0 to 100% of this segment
  fullBurnPercentage: number;    // 0 to 100% of this segment (3rd degree)
  isSpecialAnatomicalSite?: boolean; // hands, feet, face, perineum, major joints
}

export interface PatientRecord {
  crid: string; // Clinical Research ID (e.g. CRID-8041-A)
  mrnDeidentified: string;
  ageYears: number;
  weightKg: number;
  gender: 'Male' | 'Female' | 'Other';
  mechanism: BurnMechanism;
  timeOfInjury: string; // ISO timestamp
  timeOfArrival: string; // ISO timestamp
  preHospitalFluidsMl: number; // Fluids already given in transit
  suspectedInhalationInjury: boolean;
  comorbidities: string[];
  concomitantTrauma: boolean;
  chemicalAgent?: string;
  voltageKvolts?: number;
}

export interface ResuscitationOutput {
  formulaUsed: 'Parkland' | 'Modified Brooke' | 'Paediatric (3 mL/kg)';
  isPaediatric: boolean;
  /** D5LR maintenance on top of the burn fluid (children up to 30 kg); 0 otherwise */
  maintenanceMlPerH: number;
  maintenance24hMl: number;
  fluidNote: string;
  isPediatricBlocked: boolean;
  pediatricBlockReason?: string;
  isDelayedPresentationBlocked: boolean;
  delayedPresentationHours: number;
  delayedPresentationWarning?: string;
  total24hMl: number;
  phase1TargetMl: number; // 50% of total
  phase1RemainingMl: number; // after subtracting pre-hospital fluids
  phase1RemainingHours: number; // (8 - elapsed)
  phase1HourlyRateMlH: number; // phase1RemainingMl / phase1RemainingHours
  phase2TotalMl: number; // 50% of total
  phase2HourlyRateMlH: number; // phase2TotalMl / 16 hours
  urineOutputTargetMinMlH: number;
  urineOutputTargetMaxMlH: number;
  elapsedHoursFromInjury: number;
  hourlySchedule: Array<{
    hour: number;
    hourlyRateMlH: number;
    cumulativeTargetMl: number;
    phase: 1 | 2;
    isElapsed: boolean;
    isCurrent: boolean;
  }>;
}

export interface ABATransferTrigger {
  id: string;
  label: string;
  description: string;
  triggered: boolean;
  category: 'TBSA' | 'Anatomy' | 'Depth' | 'Etiology' | 'Inhalation' | 'Special';
}

export interface AuditTrailEvent {
  id: string;
  timestamp: string;
  crid: string;
  clinicianId: string;
  action: 'TRIAGE_CREATED' | 'TBSA_UPDATED' | 'MASK_EDITED' | 'FORMULA_CHANGED' | 'DELAYED_RESUS_CALCULATED' | 'ABA_TRIGGERED' | 'HANDOVER_GENERATED';
  details: string;
  previousValue?: string;
  newValue?: string;
  hashPreview: string; // SHA-256 slice
}
