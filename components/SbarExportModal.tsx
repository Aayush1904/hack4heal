'use client';

import React, { useState } from 'react';
import { PatientRecord, ResuscitationOutput, ABATransferTrigger } from '@/types/burn';
import { Printer, Copy, Check, X, ShieldCheck } from 'lucide-react';

interface SbarExportModalProps {
  patient: PatientRecord;
  tbsaPercent: number;
  resus: ResuscitationOutput;
  triggers: ABATransferTrigger[];
  isOpen: boolean;
  onClose: () => void;
}

export const SbarExportModal: React.FC<SbarExportModalProps> = ({
  patient,
  tbsaPercent,
  resus,
  triggers,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeTriggers = triggers.filter((t) => t.triggered);

  const sbarText = `=== ABA BURN CENTER TRANSFER HANDOVER (SBAR PROTOCOL) ===
TIMESTAMP: ${patient.timeOfArrival || '2026-10-24T10:00:00Z'}
CLINICAL RESEARCH ID: ${patient.crid}
DE-IDENTIFIED MRN: ${patient.mrnDeidentified}

[ S - SITUATION ]
Patient is a ${patient.ageYears}yo ${patient.gender} (${patient.weightKg} kg) suffering from a ${patient.mechanism} burn injury.
Time of Injury: ${patient.timeOfInjury.slice(11, 16)} UTC (${resus.elapsedHoursFromInjury}h elapsed since Time-Zero).
Total Body Surface Area (TBSA): ${tbsaPercent.toFixed(1)}% (Lund-Browder mapped).
Airway / Inhalation Status: ${patient.suspectedInhalationInjury ? 'SUSPECTED INHALATION INJURY (STRIDOR/SOOT)' : 'Airway Intact, SpO2 stable'}.

[ B - BACKGROUND ]
Mechanism: ${patient.mechanism}
Pre-hospital IV fluid administered: ${patient.preHospitalFluidsMl} mL (Lactated Ringer's).
Comorbidities: ${patient.comorbidities.length > 0 ? patient.comorbidities.join(', ') : 'None documented'}.
Concomitant Trauma: ${patient.concomitantTrauma ? 'YES (Poly-trauma precautions)' : 'NO'}.

[ A - ASSESSMENT ]
Deterministic Resuscitation Formula: ${resus.formulaUsed} (Total 24h: ${resus.total24hMl.toLocaleString()} mL LR)
Phase 1 (First 8h from injury):
- Target 8h Quota: ${resus.phase1TargetMl} mL
- Remaining Phase 1 Fluid: ${resus.phase1RemainingMl} mL over ${resus.phase1RemainingHours}h
- Prescribed Infusion Rate: ${resus.phase1HourlyRateMlH} mL/h
Phase 2 (Hours 9-24):
- Infusion Rate: ${resus.phase2HourlyRateMlH} mL/h
Target Urine Output: ${resus.urineOutputTargetMinMlH} - ${resus.urineOutputTargetMaxMlH} mL/h (titrate to 0.5-1.0 mL/kg/h).
ABA Transfer Triggers Met: ${activeTriggers.map((t) => t.label).join('; ') || 'None'}.

[ R - RECOMMENDATION ]
1. Immediate critical care / aeromedical transport to Regional Burn Center.
2. Continue IV Lactated Ringer's at ${resus.phase1HourlyRateMlH} mL/h via large bore IV / IO.
3. Place Foley catheter with hourly urometer for strict fluid titration.
4. Keep patient warm (prevent hypothermia), clean dry dressings only (NO wet ice/antimicrobial ointments).
=========================================================`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sbarText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(51, 39, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '85vh',
          backgroundColor: '#fffffe',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(51, 39, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          border: '2px solid var(--stroke)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
              ABA SBAR TRANSFER PROTOCOL
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              STANDARDIZED CLINICAL HANDOVER SHEET
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Text Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid var(--border-light)',
            fontSize: '11px',
            lineHeight: '1.45',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            marginBottom: '16px',
          }}
        >
          {sbarText}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={copyToClipboard}
            style={{
              flex: 1,
              backgroundColor: 'var(--btn-accent)',
              color: 'var(--btn-text)',
              border: '2px solid var(--stroke)',
              borderRadius: '14px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(51, 39, 42, 0.08)',
            }}
          >
            {copied ? <Check size={16} color="#1d612e" /> : <Copy size={16} />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY SBAR REPORT'}
          </button>

          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#fffffe',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '14px',
              padding: '12px 16px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            PRINT
          </button>
        </div>
      </div>
    </div>
  );
};
