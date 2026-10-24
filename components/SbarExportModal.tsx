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

  const sbarText = `BURN CENTRE TRANSFER HANDOVER
Time: ${patient.timeOfArrival || '2026-10-24T10:00:00Z'}
Case ID: ${patient.crid}

SITUATION
${patient.ageYears} year old ${patient.gender.toLowerCase()}, ${patient.weightKg} kg, with a ${patient.mechanism.toLowerCase()} burn.
Injury was ${resus.elapsedHoursFromInjury} hours ago (at ${patient.timeOfInjury.slice(11, 16)} UTC).
Burned body area: ${tbsaPercent.toFixed(1)}%.
Airway: ${patient.suspectedInhalationInjury ? 'POSSIBLE SMOKE INJURY (noisy breathing or soot)' : 'Clear, oxygen levels stable'}.

BACKGROUND
Cause of burn: ${patient.mechanism}.
IV fluid given before arrival: ${patient.preHospitalFluidsMl} mL (Lactated Ringer's).
Existing conditions: ${patient.comorbidities.length > 0 ? patient.comorbidities.join(', ') : 'None recorded'}.
Other injuries: ${patient.concomitantTrauma ? 'Yes, treat as multiple trauma' : 'No'}.

ASSESSMENT
Fluid formula: ${resus.formulaUsed} (24 hour total: ${resus.total24hMl.toLocaleString()} mL Lactated Ringer's).
First 8 hours after injury:
- Fluid due: ${resus.phase1TargetMl} mL
- Still to give: ${resus.phase1RemainingMl} mL over ${resus.phase1RemainingHours} hours
- Rate: ${resus.phase1HourlyRateMlH} mL/hour
Hours 9 to 24:
- Rate: ${resus.phase2HourlyRateMlH} mL/hour
Urine target: ${resus.urineOutputTargetMinMlH} to ${resus.urineOutputTargetMaxMlH} mL/hour (0.5 to 1.0 mL/kg/hour).
Transfer criteria met: ${activeTriggers.map((t) => t.label).join('; ') || 'None'}.

RECOMMENDATION
1. Transfer to a burn centre with critical care support.
2. Continue Lactated Ringer's at ${resus.phase1HourlyRateMlH} mL/hour through a large IV or IO line.
3. Place a urinary catheter and measure urine every hour.
4. Keep the patient warm. Use clean, dry dressings only (no wet ice or ointments).`;

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
              Transfer handover note
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Copy or print to send with the patient
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
            {copied ? 'Copied' : 'Copy note'}
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
            Print
          </button>
        </div>
      </div>
    </div>
  );
};
