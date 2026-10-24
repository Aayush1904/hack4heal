import { REGION_IDS, regionSide, type RegionId } from './body-regions';

export { REGION_IDS, regionSide };
export type { RegionId };

export type BurnDepth = 'superficial' | 'partial' | 'full' | 'mixed' | 'unknown';

export interface BurnPatch {
  /** % of the whole region covered by this patch (0-100) */
  coveragePct: number;
  center: { u: number; v: number };
  spread: { u: number; v: number };
}

export interface BurnRegionResult {
  id: string;
  /** % of THIS region's surface that is burned (0-100) */
  coveragePct: number;
  depth: BurnDepth;
  /** focal point of the burn inside the region, region-local coordinates (see lib/body-regions.ts) */
  center: { u: number; v: number };
  /** half-extent of the burn patch around `center`, same coordinates */
  spread?: { u: number; v: number };
  /** separate burned areas inside the region; when present they add up to coveragePct and drive the shading */
  patches?: BurnPatch[];
  /** the model's own figure for this region's share of total body surface (cross-check only) */
  tbsaContributionPct?: number;
  /** % of the region that was visible in the photo(s) */
  visiblePct?: number;
  /** region could not be assessed — excluded from TBSA and shading */
  unknown?: boolean;
}

export const REGION_LABELS: Record<RegionId, string> = {
  head_front: 'Head & neck (anterior)',
  head_back: 'Head & neck (posterior)',
  chest: 'Chest (anterior upper trunk)',
  abdomen: 'Abdomen & pelvis (anterior lower trunk)',
  upper_back: 'Upper back (posterior upper trunk)',
  lower_back: 'Lower back & buttocks (posterior lower trunk)',
  groin: 'Genitalia / perineum',
  left_arm_front: "Patient's LEFT arm, anterior (incl. hand)",
  left_arm_back: "Patient's LEFT arm, posterior (incl. hand)",
  right_arm_front: "Patient's RIGHT arm, anterior (incl. hand)",
  right_arm_back: "Patient's RIGHT arm, posterior (incl. hand)",
  left_leg_front: "Patient's LEFT leg, anterior (incl. foot)",
  left_leg_back: "Patient's LEFT leg, posterior (incl. foot)",
  right_leg_front: "Patient's RIGHT leg, anterior (incl. foot)",
  right_leg_back: "Patient's RIGHT leg, posterior (incl. foot)",
};

export function regionLabel(id: string): string {
  return REGION_LABELS[id as RegionId] ?? id;
}

/**
 * Rule-of-Nines weights (% of total body surface per region).
 * Adults / >=15y: head 9, each arm 9, trunk 36, each leg 18, genitalia 1.
 * Children use the standard paediatric adjustment (larger head, smaller legs).
 */
export function getRegionWeights(ageYears: number): Record<RegionId, number> {
  let head = 9;
  let leg = 18;
  if (ageYears <= 4) {
    head = 18;
    leg = 13.5;
  } else if (ageYears < 15) {
    head = 14;
    leg = 15.5;
  }
  return {
    head_front: head / 2,
    head_back: head / 2,
    chest: 9,
    abdomen: 9,
    upper_back: 9,
    lower_back: 9,
    groin: 1,
    left_arm_front: 4.5,
    left_arm_back: 4.5,
    right_arm_front: 4.5,
    right_arm_back: 4.5,
    left_leg_front: leg / 2,
    left_leg_back: leg / 2,
    right_leg_front: leg / 2,
    right_leg_back: leg / 2,
  };
}

export function computeTbsa(regions: BurnRegionResult[], ageYears = 30): number {
  const weights = getRegionWeights(ageYears);
  let total = 0;
  for (const r of regions) {
    if (r.unknown) continue;
    const w = weights[r.id as RegionId];
    if (w === undefined) continue;
    total += (Math.min(100, Math.max(0, r.coveragePct)) / 100) * w;
  }
  return Math.min(100, Math.round(total * 10) / 10);
}


export function depthHex(depth: BurnDepth): string {
  switch (depth) {
    case 'superficial':
      return '#f8a5a5';
    case 'full':
      return '#7f1d1d';
    case 'mixed':
      return '#b91c1c';
    default:
      return '#dc2626';
  }
}

export function formatDepthLabel(depth: BurnDepth): string {
  switch (depth) {
    case 'superficial':
      return 'superficial';
    case 'partial':
      return 'partial thickness';
    case 'full':
      return 'full thickness';
    case 'mixed':
      return 'mixed depth';
    default:
      return 'depth unknown';
  }
}

export function buildRegionPromptCatalog(ageYears: number): string {
  const weights = getRegionWeights(ageYears);
  return REGION_IDS.map(
    (id) => `- ${id}: ${REGION_LABELS[id]} — worth ${weights[id]}% of total body surface if 100% burned`,
  ).join('\n');
}
