/**
 * The body-shaped outline shown over the camera, and the check for whether a person fits inside it.
 *
 * The outline is drawn from the patient's gender, height, weight and age, so a child, a slim woman
 * and a heavy man each get a different shape. The check uses the same figure: it expects the
 * shoulders, hips, knees and ankles where this outline has them.
 *
 * The figure is drawn in a 100 x 200 box. On screen that box is centred in the camera image,
 * 90% of its height and exactly half as wide as it is tall, so 1 unit is 1/200 of body height.
 * Proportions are population averages. They make the outline a better match, not an exact one.
 */

export const FIGURE_TOP = 0.05; // of the camera image height
export const FIGURE_HEIGHT = 0.9; // of the camera image height
export const FIGURE_WIDTH_OF_HEIGHT = 0.5;

/** How long the person must stay in place before the photo is taken. */
export const HOLD_MS = 1200;

export interface BodyProfile {
  gender: 'Male' | 'Female' | 'Other';
  heightCm?: number;
  weightKg?: number;
  ageYears?: number;
}

export interface PoseLandmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface AlignmentResult {
  /** Every key body point is on the outline. */
  aligned: boolean;
  /** What to tell the person. */
  hint: string;
}

/** Where each key body point sits on the outline, as a fraction of the outline's width and height. */
export interface BodyTargets {
  nose: { x: number; y: number };
  shoulders: { left: number; right: number; y: number };
  hips: { left: number; right: number; y: number };
  knees: { left: number; right: number; y: number };
  ankles: { left: number; right: number; y: number };
}

export interface BodyGuide {
  head: { cx: number; cy: number; rx: number; ry: number };
  /** SVG path for everything below the head. Left open at the neck so no line is drawn across the head. */
  path: string;
  targets: BodyTargets;
  /** Shown to the user, for example "Male, 175 cm, 80 kg". */
  label: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Widths {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  arm: number;
}

// Half-widths in figure units for an average-build adult of each sex.
const MALE: Widths = { shoulder: 26, chest: 20, waist: 16.5, hip: 19, arm: 5.2 };
const FEMALE: Widths = { shoulder: 23.5, chest: 18, waist: 14.5, hip: 20.5, arm: 4.6 };

function baseWidths(gender: BodyProfile['gender']): Widths {
  if (gender === 'Male') return MALE;
  if (gender === 'Female') return FEMALE;
  return {
    shoulder: (MALE.shoulder + FEMALE.shoulder) / 2,
    chest: (MALE.chest + FEMALE.chest) / 2,
    waist: (MALE.waist + FEMALE.waist) / 2,
    hip: (MALE.hip + FEMALE.hip) / 2,
    arm: (MALE.arm + FEMALE.arm) / 2,
  };
}

/** Body mass index, or undefined if height or weight is missing or not believable. */
function bmiOf(profile: BodyProfile): number | undefined {
  const { heightCm: h, weightKg: w } = profile;
  if (!h || !w || h < 45 || h > 250 || w < 2 || w > 350) return undefined;
  return w / ((h / 100) * (h / 100));
}

const mirror = (p: [number, number]): [number, number] => [100 - p[0], p[1]];

/** A smooth curve through the points (Catmull-Rom converted to cubic curves). The path is open. */
function smoothPath(points: Array<[number, number]>): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Build the outline and the matching fit-check targets for one patient. */
export function buildBodyGuide(profile: BodyProfile): BodyGuide {
  const age = profile.ageYears ?? 30;
  const isChild = age < 18;
  const childT = clamp(age / 18, 0, 1);

  // How heavy the person is for their size. A child is compared with a typical child of their age.
  const bmi = bmiOf(profile) ?? (isChild ? lerp(15.5, 22, clamp((age - 5) / 13, 0, 1)) : 23);
  const referenceBmi = isChild ? lerp(15.5, 22, clamp((age - 5) / 13, 0, 1)) : 22.5;
  const build = clamp(1 + 0.045 * (bmi - referenceBmi), 0.78, 1.7);

  const base = baseWidths(profile.gender);
  const childWidth = isChild ? lerp(0.8, 1, childT) : 1;
  const wShoulder = base.shoulder * (1 + (build - 1) * 0.45) * childWidth;
  const wChest = base.chest * build * childWidth;
  const wWaist = base.waist * (1 + (build - 1) * 1.25) * childWidth;
  const wHip = base.hip * (1 + (build - 1) * 0.95) * childWidth;
  const limb = (1 + (build - 1) * 0.7) * childWidth;
  const wArm = base.arm * limb;

  // Vertical layout. Children have a bigger head and shorter legs.
  const headRatio = isChild ? lerp(0.19, 0.135, clamp((age - 2) / 16, 0, 1)) : 0.135;
  const yChin = 200 * headRatio;
  const yShoulder = yChin + 9;
  const yCrotch = 200 * (isChild ? lerp(0.56, 0.53, childT) : 0.53);
  const yWaist = lerp(yShoulder, yCrotch, 0.5);
  const yHipWidest = lerp(yWaist, yCrotch, 0.65);
  const yAnkle = 190;
  const yKnee = lerp(yCrotch, yAnkle, 0.44);
  const yFoot = 198;

  const headRy = yChin / 2;
  const head = { cx: 50, cy: headRy, rx: headRy * 0.66, ry: headRy };

  // Legs: the centre line runs from the hip down to the ankle, with a thickness that tapers.
  const legCentreHip = wHip * 0.52;
  const legCentreAnkle = wHip * 0.4;
  const legCentreAt = (y: number) => lerp(legCentreHip, legCentreAnkle, clamp((y - yCrotch) / (yAnkle - yCrotch), 0, 1));
  const thigh = wHip * 0.5;
  const knee = thigh * 0.62;
  const calf = thigh * 0.6;
  const ankle = thigh * 0.38;
  const yCalf = lerp(yKnee, yAnkle, 0.35);

  // Arms hang slightly away from the body (a relaxed A-pose).
  const armAngle = (isChild ? 20 : 17) * (Math.PI / 180);
  const armLength = 200 * (isChild ? 0.38 : 0.4);
  const shoulderJoint = { x: wShoulder - 4.5, y: yShoulder + 4 };
  const dir = { x: Math.sin(armAngle), y: Math.cos(armAngle) };
  const out = { x: Math.cos(armAngle), y: -Math.sin(armAngle) };
  const along = (t: number, side: number, half: number): [number, number] => [
    shoulderJoint.x + dir.x * armLength * t + out.x * side * half,
    shoulderJoint.y + dir.y * armLength * t + out.y * side * half,
  ];
  const upperHalf = wArm;
  const foreHalf = wArm * 0.78;
  const handHalf = wArm * 0.62;

  // Right side of the figure, from the neck down to the foot. Distances are from the centre line (x = 50).
  const right: Array<[number, number]> = [
    [wShoulder * 0.2, yChin - 1], // neck
    [wShoulder * 0.28, yShoulder - 3.5],
    [wShoulder * 0.7, yShoulder - 1.5], // top of shoulder
    [wShoulder, yShoulder + 3], // shoulder tip
    along(0.1, 1, upperHalf + 0.4),
    along(0.5, 1, foreHalf + 0.4), // outer arm
    along(1, 1, handHalf), // outer hand
    along(1.04, 0, handHalf * 0.7), // fingertips
    along(1, -1, handHalf), // inner hand
    along(0.5, -1, foreHalf), // inner arm
    along(0.16, -1, upperHalf * 0.95), // inner arm near the armpit
    [wChest, yShoulder + 30], // chest side
    [wWaist, yWaist], // waist
    [wHip, yHipWidest], // widest part of the hips
    [legCentreAt(yCrotch + 12) + thigh, yCrotch + 12], // outer thigh
    [legCentreAt(yKnee) + knee, yKnee], // knee
    [legCentreAt(yCalf) + calf, yCalf], // calf
    [legCentreAt(yAnkle) + ankle, yAnkle], // ankle
    [legCentreAt(yAnkle) + ankle + 7.5, yFoot - 1], // toe
    [legCentreAt(yAnkle) - ankle - 1, yFoot], // heel side of the foot
    [legCentreAt(yAnkle) - ankle, yAnkle],
    [legCentreAt(yCalf) - calf, yCalf],
    [legCentreAt(yKnee) - knee, yKnee],
    [legCentreAt(yCrotch + 12) - thigh, yCrotch + 12], // inner thigh
    [1.4, yCrotch], // crotch
  ];
  const toSvg = (p: [number, number]): [number, number] => [50 + p[0], p[1]];
  const crotch = toSvg(right[right.length - 1]);
  const rightSide = right.slice(0, -1).map(toSvg); // neck to inner thigh, on the right
  // Trace the outline from the left of the neck, down the left side, through the crotch,
  // and back up the right side to the right of the neck.
  const leftSide = rightSide.map(mirror);
  const path = smoothPath([...leftSide, crotch, ...[...rightSide].reverse()]);

  const hipX = legCentreAt(yCrotch) * 0.96;
  const targets: BodyTargets = {
    nose: { x: 0.5, y: (0.58 * yChin) / 200 },
    shoulders: { left: 0.5 - shoulderJoint.x / 100, right: 0.5 + shoulderJoint.x / 100, y: shoulderJoint.y / 200 },
    hips: { left: 0.5 - hipX / 100, right: 0.5 + hipX / 100, y: (yCrotch - 3) / 200 },
    knees: { left: 0.5 - legCentreAt(yKnee) / 100, right: 0.5 + legCentreAt(yKnee) / 100, y: yKnee / 200 },
    ankles: { left: 0.5 - legCentreAnkle / 100, right: 0.5 + legCentreAnkle / 100, y: yAnkle / 200 },
  };

  const parts: string[] = [];
  if (profile.gender !== 'Other') parts.push(profile.gender);
  if (profile.heightCm) parts.push(`${Math.round(profile.heightCm)} cm`);
  if (profile.weightKg) parts.push(`${Math.round(profile.weightKg)} kg`);
  return { head, path, targets, label: parts.join(', ') };
}

// ── Checking a person against the outline ─────────────────────────

// How far a body point may be from its spot on the outline, as a fraction of the outline's size.
const TOLERANCE_X = 0.17;
const TOLERANCE_Y = 0.075;
const MIN_VISIBILITY = 0.5;

// MediaPipe pose landmark numbers.
const NOSE = 0;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;

export const NO_PERSON_HINT = 'Get the whole body in the frame';

/** Check one detected person against the outline. `aspect` is the camera image's width divided by its height. */
export function evaluateAlignment(landmarks: PoseLandmark[] | undefined, aspect: number, targets: BodyTargets): AlignmentResult {
  if (!landmarks || landmarks.length < 29) return { aligned: false, hint: NO_PERSON_HINT };

  const figureWidth = (FIGURE_HEIGHT * FIGURE_WIDTH_OF_HEIGHT) / aspect;
  const toFigure = (p: PoseLandmark) => ({
    x: (p.x - 0.5) / figureWidth + 0.5,
    y: (p.y - FIGURE_TOP) / FIGURE_HEIGHT,
  });

  const key = [NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE].map((i) => landmarks[i]);
  const allVisible = key.every(
    (p) => (p.visibility ?? 1) >= MIN_VISIBILITY && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
  );
  if (!allVisible) return { aligned: false, hint: 'Step back so the whole body, head to feet, is in the frame' };

  const nose = toFigure(landmarks[NOSE]);
  const pair = (a: number, b: number) => {
    // The two sides of the body can appear either way round, so sort them left to right on screen.
    const [p, q] = [toFigure(landmarks[a]), toFigure(landmarks[b])].sort((m, n) => m.x - n.x);
    return { left: p, right: q };
  };
  const shoulders = pair(L_SHOULDER, R_SHOULDER);
  const hips = pair(L_HIP, R_HIP);
  const knees = pair(L_KNEE, R_KNEE);
  const ankles = pair(L_ANKLE, R_ANKLE);

  const checks: Array<[{ x: number; y: number }, number, number]> = [
    [nose, targets.nose.x, targets.nose.y],
    [shoulders.left, targets.shoulders.left, targets.shoulders.y],
    [shoulders.right, targets.shoulders.right, targets.shoulders.y],
    [hips.left, targets.hips.left, targets.hips.y],
    [hips.right, targets.hips.right, targets.hips.y],
    [knees.left, targets.knees.left, targets.knees.y],
    [knees.right, targets.knees.right, targets.knees.y],
    [ankles.left, targets.ankles.left, targets.ankles.y],
    [ankles.right, targets.ankles.right, targets.ankles.y],
  ];
  const aligned = checks.every(([p, tx, ty]) => Math.abs(p.x - tx) <= TOLERANCE_X && Math.abs(p.y - ty) <= TOLERANCE_Y);
  if (aligned) return { aligned: true, hint: 'Hold still' };

  // Work out the most useful single instruction.
  const ankleY = (ankles.left.y + ankles.right.y) / 2;
  const bodyHeight = (ankleY - nose.y) / (targets.ankles.y - targets.nose.y);
  if (bodyHeight > 1.14) return { aligned: false, hint: 'Step back a little' };
  if (bodyHeight < 0.84) return { aligned: false, hint: 'Move a little closer' };

  const centreX = (hips.left.x + hips.right.x) / 2;
  if (centreX < 0.5 - 0.1) return { aligned: false, hint: 'Move the patient right in the frame' };
  if (centreX > 0.5 + 0.1) return { aligned: false, hint: 'Move the patient left in the frame' };

  const centreY = (nose.y + ankleY) / 2;
  const targetY = (targets.nose.y + targets.ankles.y) / 2;
  if (centreY < targetY - 0.06) return { aligned: false, hint: 'Tilt the camera up a little' };
  if (centreY > targetY + 0.06) return { aligned: false, hint: 'Tilt the camera down a little' };

  return { aligned: false, hint: 'Almost there. Stand straight and match the outline' };
}
