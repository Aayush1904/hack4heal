import { PatientRecord, ResuscitationOutput, ABATransferTrigger, LundBrowderSegment } from '@/types/burn';

// Lund-Browder anatomical reference data
// Relative surface area adjusts for head and thighs/legs by age
export const INITIAL_LUND_BROWDER_SEGMENTS: LundBrowderSegment[] = [
  {
    id: 'head-ant',
    name: 'Head & face (front)',
    category: 'head',
    baseAdultPercentage: 3.5,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 9.5;
      if (age < 5) return 8.5;
      if (age < 10) return 6.5;
      if (age < 15) return 4.5;
      return 3.5;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Face
  },
  {
    id: 'head-post',
    name: 'Head (back)',
    category: 'head',
    baseAdultPercentage: 3.5,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 9.5;
      if (age < 5) return 8.5;
      if (age < 10) return 6.5;
      if (age < 15) return 4.5;
      return 3.5;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true,
  },
  {
    id: 'neck-ant',
    name: 'Neck (front)',
    category: 'head',
    baseAdultPercentage: 1.0,
    getPercentageForAge: () => 1.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'neck-post',
    name: 'Neck (back)',
    category: 'head',
    baseAdultPercentage: 1.0,
    getPercentageForAge: () => 1.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'torso-ant',
    name: 'Chest & belly (front)',
    category: 'torso',
    baseAdultPercentage: 13.0,
    getPercentageForAge: () => 13.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'torso-post',
    name: 'Back (upper & lower)',
    category: 'torso',
    baseAdultPercentage: 13.0,
    getPercentageForAge: () => 13.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'buttock-r',
    name: 'Right Buttock',
    category: 'torso',
    baseAdultPercentage: 2.5,
    getPercentageForAge: () => 2.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'buttock-l',
    name: 'Left Buttock',
    category: 'torso',
    baseAdultPercentage: 2.5,
    getPercentageForAge: () => 2.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'genitalia',
    name: 'Genitals & groin',
    category: 'perineum',
    baseAdultPercentage: 1.0,
    getPercentageForAge: () => 1.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Genitalia / perineum
  },
  {
    id: 'arm-r-up',
    name: 'Right Upper Arm',
    category: 'arms',
    baseAdultPercentage: 4.0,
    getPercentageForAge: () => 4.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'arm-l-up',
    name: 'Left Upper Arm',
    category: 'arms',
    baseAdultPercentage: 4.0,
    getPercentageForAge: () => 4.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'arm-r-low',
    name: 'Right forearm',
    category: 'arms',
    baseAdultPercentage: 3.0,
    getPercentageForAge: () => 3.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'arm-l-low',
    name: 'Left forearm',
    category: 'arms',
    baseAdultPercentage: 3.0,
    getPercentageForAge: () => 3.0,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'hand-r',
    name: 'Right hand',
    category: 'arms',
    baseAdultPercentage: 2.5,
    getPercentageForAge: () => 2.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Hand
  },
  {
    id: 'hand-l',
    name: 'Left hand',
    category: 'arms',
    baseAdultPercentage: 2.5,
    getPercentageForAge: () => 2.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Hand
  },
  {
    id: 'thigh-r',
    name: 'Right Thigh',
    category: 'legs',
    baseAdultPercentage: 9.5,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 5.5;
      if (age < 5) return 6.5;
      if (age < 10) return 8.0;
      if (age < 15) return 8.5;
      return 9.5;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'thigh-l',
    name: 'Left Thigh',
    category: 'legs',
    baseAdultPercentage: 9.5,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 5.5;
      if (age < 5) return 6.5;
      if (age < 10) return 8.0;
      if (age < 15) return 8.5;
      return 9.5;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'leg-r-low',
    name: 'Right Lower Leg',
    category: 'legs',
    baseAdultPercentage: 7.0,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 5.0;
      if (age < 5) return 5.0;
      if (age < 10) return 6.0;
      if (age < 15) return 6.5;
      return 7.0;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'leg-l-low',
    name: 'Left Lower Leg',
    category: 'legs',
    baseAdultPercentage: 7.0,
    getPercentageForAge: (age: number) => {
      if (age < 1) return 5.0;
      if (age < 5) return 5.0;
      if (age < 10) return 6.0;
      if (age < 15) return 6.5;
      return 7.0;
    },
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
  },
  {
    id: 'foot-r',
    name: 'Right Foot',
    category: 'legs',
    baseAdultPercentage: 3.5,
    getPercentageForAge: () => 3.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Foot
  },
  {
    id: 'foot-l',
    name: 'Left Foot',
    category: 'legs',
    baseAdultPercentage: 3.5,
    getPercentageForAge: () => 3.5,
    partialBurnPercentage: 0,
    fullBurnPercentage: 0,
    isSpecialAnatomicalSite: true, // Foot
  },
];

/**
 * Calculates Total Body Surface Area (%) based on age-adjusted Lund-Browder segments.
 * Only 2nd degree (partial thickness) and 3rd degree (full thickness) count toward TBSA resuscitation!
 * Note: 1st degree erythema does NOT count towards TBSA per ABA guidelines.
 */
export function calculateLundBrowderTBSA(segments: LundBrowderSegment[], age: number): {
  totalTbsaPercent: number;
  partialTbsaPercent: number;
  fullTbsaPercent: number;
  specialSitesInvolved: string[];
} {
  let partialTbsa = 0;
  let fullTbsa = 0;
  const specialSites: string[] = [];

  for (const seg of segments) {
    const segMax = seg.getPercentageForAge(age);
    const partialContribution = (seg.partialBurnPercentage / 100) * segMax;
    const fullContribution = (seg.fullBurnPercentage / 100) * segMax;

    partialTbsa += partialContribution;
    fullTbsa += fullContribution;

    if (seg.isSpecialAnatomicalSite && (seg.partialBurnPercentage > 0 || seg.fullBurnPercentage > 0)) {
      specialSites.push(seg.name);
    }
  }

  const total = Number((partialTbsa + fullTbsa).toFixed(1));
  return {
    totalTbsaPercent: Math.min(total, 100),
    partialTbsaPercent: Number(partialTbsa.toFixed(1)),
    fullTbsaPercent: Number(fullTbsa.toFixed(1)),
    specialSitesInvolved: specialSites,
  };
}

/**
 * 100% Deterministic Resuscitation Calculator with Time-Zero & Safety Guardrails
 */
export function calculateResuscitation(
  patient: PatientRecord,
  tbsaPercent: number,
  formula: 'Parkland' | 'Modified Brooke' = 'Parkland',
  customCurrentTime?: Date
): ResuscitationOutput {
  // 1. PEDIATRIC BOUNDARY CHECK
  // Children (<18 yrs or <30 kg) require glucose-containing maintenance fluids and separate body-surface formulas.
  // The PoC strictly blocks autonomous fluid calculation for pediatrics.
  if (patient.ageYears < 18 || patient.weightKg < 30) {
    return {
      formulaUsed: formula,
      isPediatricBlocked: true,
      pediatricBlockReason: `Child patient (${patient.ageYears} yrs, ${patient.weightKg} kg). Adult fluid formulas can cause low blood sugar and dangerous swelling in children, so the automatic calculation is turned off. Call a paediatric burn specialist now.`,
      isDelayedPresentationBlocked: false,
      delayedPresentationHours: 0,
      total24hMl: 0,
      phase1TargetMl: 0,
      phase1RemainingMl: 0,
      phase1RemainingHours: 0,
      phase1HourlyRateMlH: 0,
      phase2TotalMl: 0,
      phase2HourlyRateMlH: 0,
      urineOutputTargetMinMlH: 0,
      urineOutputTargetMaxMlH: 0,
      elapsedHoursFromInjury: 0,
      hourlySchedule: [],
    };
  }

  // 2. TIME-ZERO SCHEDULING
  // Resuscitation timing starts at the exact time of injury, NOT when the patient arrives!
  const injuryDate = new Date(patient.timeOfInjury);
  const refDate = customCurrentTime || (patient.timeOfArrival ? new Date(patient.timeOfArrival) : new Date('2026-10-24T10:00:00.000Z'));
  const elapsedMs = Math.max(0, refDate.getTime() - injuryDate.getTime());
  const elapsedHours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(1));

  // 3. MULTIPLIER SELECTION
  // Parkland: 4 mL * kg * %TBSA
  // Modified Brooke: 2 mL * kg * %TBSA
  const multiplier = formula === 'Parkland' ? 4 : 2;
  const total24hMl = Math.round(multiplier * patient.weightKg * tbsaPercent);
  const phase1TargetMl = Math.round(total24hMl * 0.5); // First 8 hours from injury
  const phase2TotalMl = Math.round(total24hMl * 0.5); // Next 16 hours

  // 4. DELAYED PRESENTATION & RATE ADJUSTMENT
  const preHospitalGiven = patient.preHospitalFluidsMl || 0;
  const phase1RemainingMl = Math.max(0, phase1TargetMl - preHospitalGiven);
  const phase1RemainingHours = Math.max(0, Number((8.0 - elapsedHours).toFixed(1)));

  // Guardrail: Delayed Presentation >= 6.0 hours
  // If presentation is delayed >= 6 hours (leaving < 2 hours in Phase 1), attempting to infuse
  // the remaining Phase 1 volume in that short window causes fluid creep, abdominal compartment syndrome,
  // and lethal pulmonary edema. Automatic rate adjustments are strictly BLOCKED!
  const isDelayedPresentationBlocked = elapsedHours >= 6.0;
  let delayedPresentationWarning: string | undefined;

  let phase1HourlyRateMlH = 0;
  if (isDelayedPresentationBlocked) {
    delayedPresentationWarning = `Arrived ${elapsedHours} hours after injury. Do not give extra fluid to catch up: this can cause dangerous swelling. Adjust fluids to urine output (0.5 to 1.0 mL/kg/hour) and call a burn centre now.`;
    // Fallback safe rate: baseline hourly rate without aggressive bolus
    phase1HourlyRateMlH = Math.round(total24hMl / 24);
  } else if (phase1RemainingHours > 0) {
    phase1HourlyRateMlH = Math.round(phase1RemainingMl / phase1RemainingHours);
  } else {
    // Already past 8 hours
    phase1HourlyRateMlH = 0;
  }

  const phase2HourlyRateMlH = Math.round(phase2TotalMl / 16);

  // 5. URINE OUTPUT TARGETS
  // Adult normal target: 0.5 to 1.0 mL/kg/h
  // If high-voltage electrical burn, target increases to 1.0 - 1.5 mL/kg/h due to rhabdomyolysis
  const isHighVoltage = patient.mechanism === 'Electrical' && (patient.voltageKvolts || 0) >= 1.0;
  const urineMinMult = isHighVoltage ? 1.0 : 0.5;
  const urineMaxMult = isHighVoltage ? 1.5 : 1.0;
  const urineOutputTargetMinMlH = Math.round(patient.weightKg * urineMinMult);
  const urineOutputTargetMaxMlH = Math.round(patient.weightKg * urineMaxMult);

  // 6. 24-HOUR HOURLY SCHEDULE
  const hourlySchedule = [];
  let cumulative = 0;

  for (let h = 1; h <= 24; h++) {
    const isPhase1 = h <= 8;
    const rate = isPhase1 ? phase1HourlyRateMlH : phase2HourlyRateMlH;
    cumulative += rate;
    const isElapsed = h <= Math.floor(elapsedHours);
    const isCurrent = h === Math.floor(elapsedHours) + 1;

    hourlySchedule.push({
      hour: h,
      hourlyRateMlH: rate,
      cumulativeTargetMl: cumulative,
      phase: isPhase1 ? (1 as const) : (2 as const),
      isElapsed,
      isCurrent,
    });
  }

  return {
    formulaUsed: formula,
    isPediatricBlocked: false,
    isDelayedPresentationBlocked,
    delayedPresentationHours: elapsedHours,
    delayedPresentationWarning,
    total24hMl,
    phase1TargetMl,
    phase1RemainingMl,
    phase1RemainingHours,
    phase1HourlyRateMlH,
    phase2TotalMl,
    phase2HourlyRateMlH,
    urineOutputTargetMinMlH,
    urineOutputTargetMaxMlH,
    elapsedHoursFromInjury: elapsedHours,
    hourlySchedule,
  };
}

/**
 * ABA (American Burn Association) Transfer Criteria Evaluation
 */
export function evaluateABATransferCriteria(
  patient: PatientRecord,
  tbsaTotal: number,
  tbsaPartial: number,
  tbsaFull: number,
  specialSitesInvolved: string[]
): {
  transferRecommended: boolean;
  triggers: ABATransferTrigger[];
  criticalReasons: string[];
} {
  const triggers: ABATransferTrigger[] = [
    {
      id: 'partial-tbsa-10',
      label: 'Partial-thickness burn over 10% of body',
      description: 'Partial-thickness burns covering more than 10% of the body.',
      category: 'TBSA',
      triggered: tbsaPartial > 10.0,
    },
    {
      id: 'critical-anatomy',
      label: 'Face, hands, feet, genitals or joints',
      description: 'Burns that involve the face, hands, feet, genitals, groin or major joints.',
      category: 'Anatomy',
      triggered: specialSitesInvolved.length > 0,
    },
    {
      id: 'full-thickness-any',
      label: 'Full-thickness (3rd degree) burn',
      description: 'Any full-thickness burn, at any age. Usually needs surgery or skin grafting.',
      category: 'Depth',
      triggered: tbsaFull > 0,
    },
    {
      id: 'electrical-injury',
      label: 'Electrical or lightning burn',
      description: 'Can damage deep tissue and cause heart rhythm problems.',
      category: 'Etiology',
      triggered: patient.mechanism === 'Electrical',
    },
    {
      id: 'chemical-burn',
      label: 'Chemical burn',
      description: 'Needs special decontamination and specialist advice.',
      category: 'Etiology',
      triggered: patient.mechanism === 'Chemical',
    },
    {
      id: 'inhalation-injury',
      label: 'Possible smoke or airway injury',
      description: 'Airway swelling, fire in an enclosed space, sooty spit, or noisy breathing.',
      category: 'Inhalation',
      triggered: Boolean(patient.suspectedInhalationInjury),
    },
    {
      id: 'comorbidities',
      label: 'Existing medical conditions',
      description: 'Other health problems that could make treatment harder.',
      category: 'Special',
      triggered: patient.comorbidities && patient.comorbidities.length > 0,
    },
    {
      id: 'concomitant-trauma',
      label: 'Other injuries',
      description: 'Burn together with other injuries, such as fractures, bleeding or head injury.',
      category: 'Special',
      triggered: Boolean(patient.concomitantTrauma),
    },
    {
      id: 'pediatric-specialist',
      label: 'Child burn without trained staff',
      description: 'A child with a burn at a hospital that has no trained paediatric staff or equipment.',
      category: 'Special',
      triggered: patient.ageYears < 18,
    },
  ];

  const activeTriggers = triggers.filter((t) => t.triggered);
  const transferRecommended = activeTriggers.length > 0;
  const criticalReasons = activeTriggers.map((t) => `${t.label}: ${t.description}`);

  return {
    transferRecommended,
    triggers,
    criticalReasons,
  };
}
