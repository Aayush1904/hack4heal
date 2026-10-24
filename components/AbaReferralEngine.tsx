'use client';

import React from 'react';
import { ABATransferTrigger, PatientRecord } from '@/types/burn';
import { AlertTriangle, CheckCircle, FileText, PhoneCall } from 'lucide-react';

interface AbaReferralEngineProps {
  transferRecommended: boolean;
  triggers: ABATransferTrigger[];
  criticalReasons: string[];
  patient: PatientRecord;
  tbsaPercent: number;
  onGenerateSbar: () => void;
  onToggleManualTrigger: (triggerId: string) => void;
}

export const AbaReferralEngine: React.FC<AbaReferralEngineProps> = ({
  transferRecommended,
  triggers,
  criticalReasons,
  patient,
  tbsaPercent,
  onGenerateSbar,
  onToggleManualTrigger,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--card-radius)',
        padding: '24px 20px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 700,
          }}
        >
          Burn centre transfer check
        </span>

        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-display)',
            padding: '3px 8px',
            borderRadius: 'var(--pill-radius)',
            backgroundColor: transferRecommended ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
            color: transferRecommended ? 'var(--text-accent-dark)' : 'var(--text-safe)',
            fontWeight: 800,
          }}
        >
          {transferRecommended ? 'Transfer advised' : 'Can stay here'}
        </span>
      </div>

      {/* Clean Status Card */}
      <div
        style={{
          padding: '16px',
          borderRadius: '18px',
          backgroundColor: transferRecommended ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
          border: transferRecommended ? '2px solid var(--btn-accent)' : '1px solid #a3e6af',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          {transferRecommended ? (
            <AlertTriangle size={18} color="var(--text-accent-dark)" />
          ) : (
            <CheckCircle size={18} color="#1d612e" />
          )}
          <span
            style={{
              fontSize: '14px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              color: transferRecommended ? 'var(--text-accent-dark)' : 'var(--text-safe)',
            }}
          >
            {transferRecommended
              ? 'Transfer to a burn centre'
              : 'Can be treated at this hospital'}
          </span>
        </div>

        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-editorial)',
            color: 'var(--text-primary)',
          }}
        >
          {transferRecommended
            ? `This patient meets ${criticalReasons.length} transfer ${criticalReasons.length === 1 ? 'criterion' : 'criteria'} (American Burn Association). Contact a burn centre now.`
            : 'No transfer criteria met. Keep giving IV fluids and recheck often.'}
        </div>
      </div>

      {/* Triggers Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {triggers.map((trigger) => (
          <div
            key={trigger.id}
            onClick={() => onToggleManualTrigger(trigger.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '14px',
              backgroundColor: trigger.triggered ? 'var(--bg-secondary)' : 'var(--bg-surface-subtle)',
              border: trigger.triggered ? '1px solid var(--btn-accent)' : '1px solid var(--border-light)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={trigger.triggered}
                readOnly
                style={{
                  accentColor: '#ff8ba7',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {trigger.label}
              </span>
            </div>

          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onGenerateSbar}
          style={{
            flex: 1,
            backgroundColor: 'var(--btn-accent)',
            color: 'var(--btn-text)',
            border: '2px solid var(--stroke)',
            borderRadius: '14px',
            padding: '12px',
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(51, 39, 42, 0.06)',
          }}
        >
          <FileText size={15} color="#33272a" />
          Handover note
        </button>

        <a
          href="tel:911"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--stroke)',
            borderRadius: '14px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          <PhoneCall size={14} />
          Call
        </a>
      </div>
    </div>
  );
};
