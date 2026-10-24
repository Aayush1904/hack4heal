/**
 * Mesh-driven Rule-of-Nines region map.
 *
 * Every vertex of the (normalised, 2-unit-tall, centred) body mesh is assigned to exactly one of the
 * 15 regions using a canonical frame:
 *   +y up, patient faces +z, patient's LEFT side is +x.
 * Models that face the other way (or are mirrored) are brought into this frame through
 * `frontSign` / `mirrorLR`, so region ids ("left_arm_front" ...) always mean the PATIENT's anatomy.
 *
 * Region-local (u, v) coordinates are what the vision model reports:
 *   u: 0 -> 1 = viewer's left -> right while looking AT that surface from outside
 *   v: 0 -> 1 = top -> bottom
 *
 * This file has no imports so it can be unit-tested with plain node.
 */

export const REGION_IDS = [
  'head_front',
  'head_back',
  'chest',
  'abdomen',
  'upper_back',
  'lower_back',
  'groin',
  'left_arm_front',
  'left_arm_back',
  'right_arm_front',
  'right_arm_back',
  'left_leg_front',
  'left_leg_back',
  'right_leg_front',
  'right_leg_back',
] as const;

export type RegionId = (typeof REGION_IDS)[number];

const BACK_REGIONS = new Set<string>([
  'head_back',
  'upper_back',
  'lower_back',
  'left_arm_back',
  'right_arm_back',
  'left_leg_back',
  'right_leg_back',
]);

export function regionSide(id: string): 'front' | 'back' {
  return BACK_REGIONS.has(id) ? 'back' : 'front';
}

export interface BodyProfile {
  /** y above which a vertex is head/neck */
  headY: number;
  /** y below which a vertex belongs to a leg */
  crotchY: number;
  /** |x| above which (between crotch and head) a vertex belongs to an arm */
  armX: (y: number) => number;
}

function interp(table: Array<[number, number]>, y: number): number {
  // table sorted by y descending
  if (y >= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    const [y0, v0] = table[i - 1];
    if (y >= y1) {
      const t = (y - y1) / (y0 - y1);
      return v1 + t * (v0 - v1);
    }
  }
  return table[table.length - 1][1];
}

export const MALE_PROFILE: BodyProfile = {
  headY: 0.76,
  crotchY: -0.12,
  armX: () => 0.235,
};

const FEMALE_ARM_TABLE: Array<[number, number]> = [
  [1, 0.15],
  [0.6, 0.15],
  [0.5, 0.16],
  [0.4, 0.215],
  [0.3, 0.255],
  [0.2, 0.28],
  [0.1, 0.285],
  [0, 0.3],
  [-1, 0.3],
];

export const FEMALE_PROFILE: BodyProfile = {
  headY: 0.84,
  crotchY: 0.0,
  armX: (y) => interp(FEMALE_ARM_TABLE, y),
};

type NumArray = ArrayLike<number>;

/**
 * Feet point forward, so the feet's mean z relative to the whole body tells which way the mesh faces.
 * Returns +1 if the mesh faces +z (expected), -1 if it faces -z.
 */
export function detectFrontSign(positions: NumArray): 1 | -1 {
  const n = positions.length / 3;
  let feetZ = 0;
  let feetN = 0;
  let allZ = 0;
  for (let i = 0; i < n; i++) {
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    allZ += z;
    if (y < -0.9) {
      feetZ += z;
      feetN++;
    }
  }
  if (feetN === 0) return 1;
  return feetZ / feetN - allZ / n >= 0 ? 1 : -1;
}

export interface RegionMap {
  vertexCount: number;
  /** index into REGION_IDS per vertex */
  regionIdx: Int8Array;
  /** region-local coordinates per vertex (see file header) */
  u: Float32Array;
  v: Float32Array;
  /** surface area share per vertex */
  area: Float32Array;
  /** total surface area per region */
  regionArea: Float64Array;
  /** vertex indices per region */
  regionVerts: Int32Array[];
  frontSign: 1 | -1;
  mirrorLR: boolean;
}

export interface BuildRegionMapOptions {
  positions: NumArray;
  normals: NumArray;
  index?: NumArray | null;
  profile: BodyProfile;
  frontSign?: 1 | -1;
  mirrorLR?: boolean;
}

function classify(cx: number, y: number, nz: number, profile: BodyProfile): number {
  const front = nz >= 0;
  const left = cx > 0; // patient's left == +x in the canonical frame
  const idx = (id: RegionId) => REGION_IDS.indexOf(id);

  if (y >= profile.headY) return idx(front ? 'head_front' : 'head_back');

  if (y < profile.crotchY) {
    const side = left ? 'left' : 'right';
    return idx(`${side}_leg_${front ? 'front' : 'back'}` as RegionId);
  }

  if (Math.abs(cx) > profile.armX(y)) {
    const side = left ? 'left' : 'right';
    return idx(`${side}_arm_${front ? 'front' : 'back'}` as RegionId);
  }

  if (front && y < profile.crotchY + 0.1 && Math.abs(cx) < 0.07) return idx('groin');

  const yMid = (profile.headY - 0.04 + profile.crotchY) / 2;
  if (y >= yMid) return idx(front ? 'chest' : 'upper_back');
  return idx(front ? 'abdomen' : 'lower_back');
}

export function buildRegionMap(opts: BuildRegionMapOptions): RegionMap {
  const { positions, normals, index, profile } = opts;
  const frontSign = opts.frontSign ?? detectFrontSign(positions);
  const mirrorLR = opts.mirrorLR ?? false;
  const n = positions.length / 3;
  const sx = frontSign * (mirrorLR ? -1 : 1);

  const area = new Float32Array(n);
  const triCount = index ? index.length / 3 : n / 3;
  for (let t = 0; t < triCount; t++) {
    const a = index ? index[t * 3] : t * 3;
    const b = index ? index[t * 3 + 1] : t * 3 + 1;
    const c = index ? index[t * 3 + 2] : t * 3 + 2;
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const e1x = positions[b * 3] - ax, e1y = positions[b * 3 + 1] - ay, e1z = positions[b * 3 + 2] - az;
    const e2x = positions[c * 3] - ax, e2y = positions[c * 3 + 1] - ay, e2z = positions[c * 3 + 2] - az;
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    const tri = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz) / 3;
    area[a] += tri;
    area[b] += tri;
    area[c] += tri;
  }

  const regionIdx = new Int8Array(n);
  const cxs = new Float32Array(n);
  const cys = new Float32Array(n);
  const R = REGION_IDS.length;
  const minX = new Float64Array(R).fill(Infinity);
  const maxX = new Float64Array(R).fill(-Infinity);
  const minY = new Float64Array(R).fill(Infinity);
  const maxY = new Float64Array(R).fill(-Infinity);
  const regionArea = new Float64Array(R);
  const counts = new Int32Array(R);

  for (let i = 0; i < n; i++) {
    const cx = positions[i * 3] * sx;
    const y = positions[i * 3 + 1];
    const nz = normals[i * 3 + 2] * frontSign;
    const r = classify(cx, y, nz, profile);
    regionIdx[i] = r;
    cxs[i] = cx;
    cys[i] = y;
    if (cx < minX[r]) minX[r] = cx;
    if (cx > maxX[r]) maxX[r] = cx;
    if (y < minY[r]) minY[r] = y;
    if (y > maxY[r]) maxY[r] = y;
    regionArea[r] += area[i];
    counts[r]++;
  }

  const u = new Float32Array(n);
  const v = new Float32Array(n);
  const regionVerts: Int32Array[] = Array.from({ length: R }, (_, r) => new Int32Array(counts[r]));
  const fill = new Int32Array(R);
  for (let i = 0; i < n; i++) regionVerts[regionIdx[i]][fill[regionIdx[i]]++] = i;

  for (let r = 0; r < R; r++) {
    const id = REGION_IDS[r];
    const verts = regionVerts[r];
    if (verts.length === 0) continue;
    const back = regionSide(id) === 'back';

    if (id.includes('_arm_')) {
      // Arms hang diagonally in A-pose models: use a limb-aligned frame. v runs shoulder -> fingertips,
      // u runs across the limb, increasing towards the viewer's right when looking at the surface.
      const yCut = 0.15 * (maxY[r] - minY[r]);
      let ax = 0, ay = 0, an = 0, bx = 0, by = 0, bn = 0;
      for (const i of verts) {
        if (cys[i] >= maxY[r] - yCut) { ax += cxs[i]; ay += cys[i]; an++; }
        else if (cys[i] <= minY[r] + yCut) { bx += cxs[i]; by += cys[i]; bn++; }
      }
      ax /= Math.max(1, an); ay /= Math.max(1, an); bx /= Math.max(1, bn); by /= Math.max(1, bn);
      let dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const px = -dy, py = dx; // perpendicular; (1, 0) for a limb pointing straight down
      let minV = Infinity, maxV = -Infinity, minU = Infinity, maxU = -Infinity;
      for (const i of verts) {
        const rx = cxs[i] - ax, ry = cys[i] - ay;
        const pv = rx * dx + ry * dy;
        const pu = (rx * px + ry * py) * (back ? -1 : 1);
        v[i] = pv;
        u[i] = pu;
        if (pv < minV) minV = pv;
        if (pv > maxV) maxV = pv;
        if (pu < minU) minU = pu;
        if (pu > maxU) maxU = pu;
      }
      const sv = Math.max(1e-6, maxV - minV);
      const su = Math.max(1e-6, maxU - minU);
      for (const i of verts) {
        v[i] = (v[i] - minV) / sv;
        u[i] = (u[i] - minU) / su;
      }
      continue;
    }

    const spanX = Math.max(1e-6, maxX[r] - minX[r]);
    const spanY = Math.max(1e-6, maxY[r] - minY[r]);
    for (const i of verts) {
      u[i] = back ? (maxX[r] - cxs[i]) / spanX : (cxs[i] - minX[r]) / spanX;
      v[i] = (maxY[r] - cys[i]) / spanY;
    }
  }

  return { vertexCount: n, regionIdx, u, v, area, regionArea, regionVerts, frontSign, mirrorLR };
}

export interface PatchSpec {
  center: { u: number; v: number };
  spread?: { u: number; v: number };
}

/**
 * Map vision-model patch coordinates onto the mesh region frame.
 * Arm *_back regions flip the tangential u axis when the map is built; mirror u so a dorsal hand burn does not land on the palm.
 */
export function remapModelPatchForMesh(regionId: string, patch: PatchSpec): PatchSpec {
  if (!/_arm_back$/.test(regionId)) return patch;
  return {
    center: { u: 1 - patch.center.u, v: patch.center.v },
    spread: patch.spread,
  };
}

/**
 * Vertices of a region, ordered by elliptical distance from the patch centre, truncated so their
 * surface area equals `fraction` of the whole region's area.
 */
export function selectPatchVertices(map: RegionMap, regionIndex: number, patch: PatchSpec, fraction: number): number[] {
  const verts = map.regionVerts[regionIndex];
  if (!verts || verts.length === 0 || fraction <= 0) return [];
  const su = Math.max(0.05, patch.spread?.u ?? 0.5);
  const sv = Math.max(0.05, patch.spread?.v ?? 0.5);
  const scored: Array<{ i: number; d: number }> = new Array(verts.length);
  for (let k = 0; k < verts.length; k++) {
    const i = verts[k];
    const du = (map.u[i] - patch.center.u) / su;
    const dv = (map.v[i] - patch.center.v) / sv;
    scored[k] = { i, d: du * du + dv * dv };
  }
  scored.sort((a, b) => a.d - b.d);
  const target = Math.min(1, fraction) * map.regionArea[regionIndex];
  const out: number[] = [];
  let acc = 0;
  for (const s of scored) {
    out.push(s.i);
    acc += map.area[s.i];
    if (acc >= target) break;
  }
  return out;
}

export interface RegionBurnStat {
  id: RegionId;
  /** fraction (0-1) of the region's surface area that is painted */
  fraction: number;
  centroidU: number;
  centroidV: number;
  spreadU: number;
  spreadV: number;
}

/**
 * `colors` is the live per-vertex colour buffer, `base` the unpainted skin colour. A vertex counts as
 * burned when its colour is further than `threshold` from the base colour.
 */
export function measureBurn(map: RegionMap, colors: NumArray, base: readonly [number, number, number], threshold = 0.14): RegionBurnStat[] {
  const R = REGION_IDS.length;
  const stats: RegionBurnStat[] = [];
  for (let r = 0; r < R; r++) {
    const verts = map.regionVerts[r];
    let burned = 0;
    let su = 0;
    let sv = 0;
    let suu = 0;
    let svv = 0;
    for (let k = 0; k < verts.length; k++) {
      const i = verts[k];
      const dr = colors[i * 3] - base[0];
      const dg = colors[i * 3 + 1] - base[1];
      const db = colors[i * 3 + 2] - base[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) <= threshold) continue;
      const a = map.area[i];
      burned += a;
      su += a * map.u[i];
      sv += a * map.v[i];
      suu += a * map.u[i] * map.u[i];
      svv += a * map.v[i] * map.v[i];
    }
    const total = map.regionArea[r];
    const fraction = total > 0 ? burned / total : 0;
    const cu = burned > 0 ? su / burned : 0.5;
    const cv = burned > 0 ? sv / burned : 0.5;
    const varU = burned > 0 ? Math.max(0, suu / burned - cu * cu) : 0;
    const varV = burned > 0 ? Math.max(0, svv / burned - cv * cv) : 0;
    stats.push({
      id: REGION_IDS[r],
      fraction,
      centroidU: cu,
      centroidV: cv,
      spreadU: Math.min(0.5, Math.max(0.1, Math.sqrt(varU) * 2)),
      spreadV: Math.min(0.5, Math.max(0.1, Math.sqrt(varV) * 2)),
    });
  }
  return stats;
}
