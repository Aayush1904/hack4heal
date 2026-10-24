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

/**
 * The doctor's version of the burn on the 3D body. The model starts from the photo scan, and
 * this is saved the first time they paint or erase. It never changes the scan's own estimate.
 */
export interface PaintedBurn {
  /** The scan this painting belongs to ('none' if the patient had no scan). */
  scanId: string;
  percent: number;
  fluidMl: number;
  regions: BurnRegionResult[];
}

/** The id painted records use for a patient who has no scan yet. */
export const NO_SCAN_ID = 'none';

/**
 * The doctor's painting, but only if it belongs to the patient's latest scan. A painting that
 * is older than the latest scan, or was saved without a scan id, is ignored so the scan's own
 * percentage and regions show instead.
 */
export function getActivePainted(patient: PatientScanFields & { painted?: PaintedBurn }): PaintedBurn | undefined {
  if (!patient.painted) return undefined;
  const history = getScanHistory(patient);
  const latestId = history.length ? history[history.length - 1].id : NO_SCAN_ID;
  return patient.painted.scanId === latestId ? patient.painted : undefined;
}

/**
 * The burn size to use for triage and fluids: the doctor's painted version once they have
 * edited the 3D body, otherwise the estimate from the latest photo scan.
 */
export function getCurrentBurn(
  patient: PatientScanFields & { painted?: PaintedBurn },
): { percent?: number; fluidMl?: number; source: 'painted' | 'scan' | 'none' } {
  const painted = getActivePainted(patient);
  if (painted) {
    return { percent: painted.percent, fluidMl: painted.fluidMl, source: 'painted' };
  }
  if (patient.burnPercent !== undefined) {
    return { percent: patient.burnPercent, fluidMl: patient.fluidMl, source: 'scan' };
  }
  return { source: 'none' };
}
