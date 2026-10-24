import { PatientRecord } from '@/types/burn';

export interface PreloadedCase {
  id: string;
  name: string;
  summary: string;
  tag: string;
  badgeType: 'OTF' | 'TTF' | 'VAR' | 'SYS';
  patient: PatientRecord;
  presetSegments: Record<string, { partial: number; full: number }>;
  woundImageUrl: string;
}

// Fixed deterministic baseline for hydration stability
const BASE_TIME = '2026-10-24T10:00:00.000Z';
const formatIso = (hoursAgo: number) => {
  const t = new Date(BASE_TIME).getTime() - hoursAgo * 3600 * 1000;
  return new Date(t).toISOString();
};

export const PRELOADED_CASES: PreloadedCase[] = [
  {
    id: 'case-8041',
    name: 'Case #B-8041: Adult Thermal Flame',
    summary: '36yo M • 72 kg • Flame burn anterior torso & right arm • Time-Zero +2.0h',
    tag: 'FLAME',
    badgeType: 'OTF',
    woundImageUrl: '/burn_torso.svg',
    patient: {
      crid: 'CRID-8041-A',
      mrnDeidentified: 'PT-99410',
      ageYears: 36,
      weightKg: 72,
      gender: 'Male',
      mechanism: 'Flame',
      timeOfInjury: formatIso(2.0),
      timeOfArrival: BASE_TIME,
      preHospitalFluidsMl: 600,
      suspectedInhalationInjury: false,
      comorbidities: [],
      concomitantTrauma: false,
    },
    presetSegments: {
      'torso-ant': { partial: 85, full: 20 },
      'arm-r-up': { partial: 70, full: 0 },
      'arm-r-low': { partial: 80, full: 0 },
      'hand-r': { partial: 60, full: 0 },
    },
  },
  {
    id: 'case-8042',
    name: 'Case #B-8042: Delayed Presentation (+6.5h)',
    summary: '54yo M • 80 kg • Rural transport delay • Triggers Safe Titration Guardrail',
    tag: 'DELAY',
    badgeType: 'TTF',
    woundImageUrl: '/burn_arm.svg',
    patient: {
      crid: 'CRID-8042-D',
      mrnDeidentified: 'PT-88219',
      ageYears: 54,
      weightKg: 80,
      gender: 'Male',
      mechanism: 'Flame',
      timeOfInjury: formatIso(6.5), // > 6h delay
      timeOfArrival: BASE_TIME,
      preHospitalFluidsMl: 1000,
      suspectedInhalationInjury: false,
      comorbidities: ['Hypertension'],
      concomitantTrauma: false,
    },
    presetSegments: {
      'torso-ant': { partial: 60, full: 0 },
      'thigh-r': { partial: 80, full: 30 },
      'leg-r-low': { partial: 50, full: 0 },
    },
  },
  {
    id: 'case-8043',
    name: 'Case #B-8043: Pediatric Boundary Lock',
    summary: '7yo F • 22 kg • Scald burn • Complete Adult Calculation Lockout',
    tag: 'PEDI',
    badgeType: 'VAR',
    woundImageUrl: '/burn_scald.svg',
    patient: {
      crid: 'CRID-8043-P',
      mrnDeidentified: 'PT-77103',
      ageYears: 7,
      weightKg: 22,
      gender: 'Female',
      mechanism: 'Scald',
      timeOfInjury: formatIso(1.2),
      timeOfArrival: BASE_TIME,
      preHospitalFluidsMl: 150,
      suspectedInhalationInjury: false,
      comorbidities: [],
      concomitantTrauma: false,
    },
    presetSegments: {
      'torso-ant': { partial: 70, full: 0 },
      'thigh-l': { partial: 50, full: 0 },
    },
  },
  {
    id: 'case-8044',
    name: 'Case #B-8044: Industrial Chemical & Inhalation',
    summary: '42yo F • 60 kg • Alkaline chemical splash • Critical ABA Transfer',
    tag: 'ABA-TR',
    badgeType: 'SYS',
    woundImageUrl: '/burn_face.svg',
    patient: {
      crid: 'CRID-8044-C',
      mrnDeidentified: 'PT-66382',
      ageYears: 42,
      weightKg: 60,
      gender: 'Female',
      mechanism: 'Chemical',
      timeOfInjury: formatIso(1.5),
      timeOfArrival: BASE_TIME,
      preHospitalFluidsMl: 400,
      suspectedInhalationInjury: true,
      comorbidities: ['Asthma'],
      concomitantTrauma: false,
      chemicalAgent: 'Sodium Hydroxide (pH 13.5)',
    },
    presetSegments: {
      'head-ant': { partial: 80, full: 20 },
      'neck-ant': { partial: 90, full: 0 },
      'arm-l-up': { partial: 50, full: 0 },
      'hand-l': { partial: 70, full: 10 },
    },
  },
];
