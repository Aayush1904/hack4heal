import type { BurnRegionResult } from '@/lib/rule-of-nines';

/**
 * One burn scan of a patient. Iteration 1 is the first scan, each follow-up adds another.
 * `burnPercent` is the estimate for the photo(s) of that scan. It is not changed when the
 * doctor later paints on the 3D body, so the scan and the painted number stay separate.
 */
export interface ScanRecord {
  id: string;
  takenAt: string;
  burnPercent: number;
  fluidMl?: number;
  regions?: BurnRegionResult[];
  /** Small thumbnail of the first photo of this scan. */
  imageDataUrl?: string;
  confidence?: number;
}

interface PatientScanFields {
  createdAt: string;
  burnPercent?: number;
  fluidMl?: number;
  burnRegions?: BurnRegionResult[];
  imageDataUrl?: string;
  scans?: ScanRecord[];
}

/**
 * All scans of a patient, oldest first. Patients saved before progress tracking have no
 * `scans` list, so their single scan is rebuilt from the top-level fields as iteration 1.
 */
export function getScanHistory(patient: PatientScanFields): ScanRecord[] {
  // An empty list is still the real history (a patient who has not been scanned yet).
  if (patient.scans) return patient.scans;
  if (patient.burnPercent === undefined) return [];
  return [
    {
      id: 'scan-1',
      takenAt: patient.createdAt,
      burnPercent: patient.burnPercent,
      fluidMl: patient.fluidMl,
      regions: patient.burnRegions,
      imageDataUrl: patient.imageDataUrl,
    },
  ];
}

/** Change in burn area between two scans, in percentage points. */
export function burnChange(from: ScanRecord, to: ScanRecord): number {
  return Number((to.burnPercent - from.burnPercent).toFixed(1));
}

/** How long after the first scan another scan was taken, e.g. "+3 h" or "Day 4". */
export function sinceFirstLabel(firstIso: string, atIso: string): string {
  const minutes = Math.max(0, (new Date(atIso).getTime() - new Date(firstIso).getTime()) / 60000);
  if (minutes < 1) return 'Start';
  if (minutes < 60) return `+${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `+${Math.round(hours)} h`;
  return `Day ${Math.floor(hours / 24)}`;
}

/** What the doctor painted on the 3D body. Starts empty and is worked out as they paint. */
export interface PaintedBurn {
  percent: number;
  fluidMl: number;
  regions: BurnRegionResult[];
}

/**
 * The burn size to use for triage and fluids: what the doctor painted once they have painted
 * something, otherwise the estimate from the latest photo scan.
 */
export function getCurrentBurn(patient: {
  burnPercent?: number;
  fluidMl?: number;
  painted?: PaintedBurn;
}): { percent?: number; fluidMl?: number; source: 'painted' | 'scan' | 'none' } {
  if (patient.painted && patient.painted.percent > 0) {
    return { percent: patient.painted.percent, fluidMl: patient.painted.fluidMl, source: 'painted' };
  }
  if (patient.burnPercent !== undefined) {
    return { percent: patient.burnPercent, fluidMl: patient.fluidMl, source: 'scan' };
  }
  return { source: 'none' };
}
