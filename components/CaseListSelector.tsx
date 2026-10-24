'use client';

import React from 'react';
import { PreloadedCase } from '@/lib/mock-cases';

interface CaseListSelectorProps {
  cases: PreloadedCase[];
  selectedCaseId: string;
  onSelectCase: (caseItem: PreloadedCase) => void;
  onCustomPatient: () => void;
}

export const CaseListSelector: React.FC<CaseListSelectorProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onCustomPatient,
}) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Section Header (Matching RECENT TRANSACTIONS in screenshot) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 800,
          }}
        >
          CLINICAL CASE REGISTRY
        </span>

        <button
          onClick={onCustomPatient}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            textDecoration: 'underline',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          + NEW TRIAGE
        </button>
      </div>

      {/* List of Case Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;

          let statusLabel = '';
          let statusColor = 'var(--text-primary)';

          if (c.patient.ageYears < 18) {
            statusLabel = 'PEDI LOCK';
            statusColor = '#b83355';
          } else if (c.id === 'case-8042') {
            statusLabel = 'DELAYED 6h';
            statusColor = '#d97706';
          } else if (c.id === 'case-8044') {
            statusLabel = 'ABA TR-REQ';
            statusColor = '#b83355';
          } else {
            statusLabel = '28.5% TBSA';
            statusColor = 'var(--text-primary)';
          }

          return (
            <div
              key={c.id}
              onClick={() => onSelectCase(c)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--item-radius)',
                padding: '14px 16px',
                border: isSelected ? '2px solid var(--stroke)' : '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Left Badge (OTF, TTF, VAR style) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'var(--btn-accent)' : 'var(--bg-badge)',
                    color: isSelected ? 'var(--btn-text)' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid var(--stroke)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {c.badgeType}
                </div>

                {/* Case Title and Metadata */}
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {c.name.split(':')[1] || c.name}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontFamily: 'var(--font-editorial)',
                      color: 'var(--text-secondary)',
                      marginTop: '1px',
                    }}
                  >
                    {c.patient.ageYears}yo {c.patient.gender[0]} &bull; {c.patient.weightKg}kg &bull; {c.tag}
                  </div>
                </div>
              </div>

              {/* Right Metric */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: statusColor,
                  textAlign: 'right',
                }}
              >
                {statusLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
