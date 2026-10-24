/**
 * Burn resuscitation fluids, split by age as in current paediatric burn guidance
 * (ATLS / ABA, Lurie Children's, UTHealth, LA AAP):
 *
 *   13 years and younger, or 30 kg and under
 *     Lactated Ringer's 3 mL x kg x %TBSA over the first 24 h (half in the first 8 h from injury),
 *     PLUS maintenance D5LR by the 4-2-1 rule for children up to 30 kg (given on top, not titrated).
 *     Urine output target 1 mL/kg/h (<= 30 kg) or 0.5 mL/kg/h (> 30 kg).
 *
 *   14 years and older (and more than 30 kg)
 *     Lactated Ringer's 2 mL x kg x %TBSA over the first 24 h (ATLS / ABA starting rate, "Modified Brooke").
 *     The classic Parkland 4 mL x kg x %TBSA stays selectable by the clinician.
 *     Urine output target 0.5 - 1.0 mL/kg/h.
 *
 * The first estimate is only a starting rate: it is titrated hourly to urine output.
 */

export const PAEDIATRIC_MAX_AGE_YEARS = 13;
export const PAEDIATRIC_MAX_WEIGHT_KG = 30;

export type AdultFluidFormula = 'Parkland' | 'Modified Brooke';
export type FluidProtocol = AdultFluidFormula | 'Paediatric (3 mL/kg)';

export function isPaediatricBurnPatient(ageYears: number, weightKg: number): boolean {
  return ageYears <= PAEDIATRIC_MAX_AGE_YEARS || weightKg <= PAEDIATRIC_MAX_WEIGHT_KG;
}

/** Holliday-Segar / 4-2-1 maintenance, mL per hour. */
export function maintenanceMlPerHour(weightKg: number): number {
  const first = Math.min(weightKg, 10) * 4;
  const second = Math.min(Math.max(weightKg - 10, 0), 10) * 2;
  const rest = Math.max(weightKg - 20, 0) * 1;
  return Math.round(first + second + rest);
}

export interface BurnFluidPlan {
  protocol: FluidProtocol;
  isPaediatric: boolean;
  mlPerKgPerPercent: number;
  /** Lactated Ringer's for burn losses over 24 h */
  resuscitation24hMl: number;
  /** D5LR maintenance (children up to 30 kg only), mL/h and per 24 h; 0 when not needed */
  maintenanceMlPerH: number;
  maintenance24hMl: number;
  urineTargetMlPerKgH: { min: number; max: number };
  note: string;
}

export function planBurnFluids(opts: {
  ageYears: number;
  weightKg: number;
  tbsaPercent: number;
  adultFormula?: AdultFluidFormula;
}): BurnFluidPlan {
  const { ageYears, weightKg, tbsaPercent } = opts;
  const paediatric = isPaediatricBurnPatient(ageYears, weightKg);

  let protocol: FluidProtocol;
  let mlPerKgPerPercent: number;
  if (paediatric) {
    protocol = 'Paediatric (3 mL/kg)';
    mlPerKgPerPercent = 3;
  } else {
    protocol = opts.adultFormula ?? 'Modified Brooke';
    mlPerKgPerPercent = protocol === 'Parkland' ? 4 : 2;
  }

  const needsMaintenance = paediatric && weightKg <= PAEDIATRIC_MAX_WEIGHT_KG;
  const maintenanceMlPerH = needsMaintenance ? maintenanceMlPerHour(weightKg) : 0;

  const urineTargetMlPerKgH = paediatric
    ? weightKg <= PAEDIATRIC_MAX_WEIGHT_KG
      ? { min: 1.0, max: 1.0 }
      : { min: 0.5, max: 0.5 }
    : { min: 0.5, max: 1.0 };

  const note = paediatric
    ? needsMaintenance
      ? '3 mL/kg/%TBSA Lactated Ringer\'s plus D5LR maintenance (not titrated). Titrate LR to urine output 1 mL/kg/h.'
      : '3 mL/kg/%TBSA Lactated Ringer\'s. Titrate to urine output 0.5 mL/kg/h.'
    : `${mlPerKgPerPercent} mL/kg/%TBSA Lactated Ringer's. Titrate to urine output 0.5-1 mL/kg/h.`;

  return {
    protocol,
    isPaediatric: paediatric,
    mlPerKgPerPercent,
    resuscitation24hMl: Math.round(mlPerKgPerPercent * weightKg * tbsaPercent),
    maintenanceMlPerH,
    maintenance24hMl: maintenanceMlPerH * 24,
    urineTargetMlPerKgH,
    note,
  };
}

/** 24-hour resuscitation volume (Lactated Ringer's) for quick estimates, using the default protocol for the patient's age. */
export function estimateResuscitationMl(ageYears: number, weightKg: number, tbsaPercent: number): number {
  return planBurnFluids({ ageYears, weightKg, tbsaPercent }).resuscitation24hMl;
}
