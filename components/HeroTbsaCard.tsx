'use client';

import React from 'react';
import { ResuscitationOutput } from '@/types/burn';
import { DotMatrixChart } from './DotMatrixChart';
import { AlertCircle } from 'lucide-react';

interface HeroTbsaCardProps {
  tbsaPercent: number;
  partialTbsaPercent: number;
  fullTbsaPercent: number;
  resus: ResuscitationOutput;
  selectedFormula: 'Parkland' | 'Modified Brooke';
  onFormulaChange: (formula: 'Parkland' | 'Modified Brooke') => void;
  weightKg: number;
  onEditPatient: () => void;
}

export const HeroTbsaCard: React.FC<HeroTbsaCardProps> = ({
  tbsaPercent,
  partialTbsaPercent,
  fullTbsaPercent,
  resus,
  selectedFormula,
  onFormulaChange,
  weightKg,
  onEditPatient,
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
      {/* Top Header: Section Title & Formula Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
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
          Burn size and fluid plan
        </span>

        {/* Clean Formula Switcher (children use the fixed paediatric protocol) */}
        {resus.isPaediatric ? (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-display)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-primary)' }}>
            Paediatric &middot; 3 mL/kg
          </span>
        ) : (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            fontSize: '10px',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.04em',
          }}
        >
          <button
            onClick={() => onFormulaChange('Parkland')}
            style={{
              background: 'none',
              border: 'none',
              color: selectedFormula === 'Parkland' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: selectedFormula === 'Parkland' ? 800 : 500,
              textTransform: 'uppercase',
              padding: '2px 4px',
              borderBottom: selectedFormula === 'Parkland' ? '2px solid var(--btn-accent)' : '2px solid transparent',
            }}
          >
            Parkland
          </button>
          <span style={{ color: 'var(--text-tertiary)' }}>•</span>
          <button
            onClick={() => onFormulaChange('Modified Brooke')}
            style={{
              background: 'none',
              border: 'none',
              color: selectedFormula === 'Modified Brooke' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: selectedFormula === 'Modified Brooke' ? 800 : 500,
              textTransform: 'uppercase',
              padding: '2px 4px',
              borderBottom: selectedFormula === 'Modified Brooke' ? '2px solid var(--btn-accent)' : '2px solid transparent',
            }}
          >
            Brooke
          </button>
        </div>
        )}
      </div>

      {/* Main Bold Metric: +28.5% TBSA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: '44px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            lineHeight: 1,
          }}
        >
          {tbsaPercent > 0 ? `${tbsaPercent.toFixed(1)}%` : '0.0%'}
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginLeft: '6px',
            }}
          >
            of body burned
          </span>
        </div>

        <button
          onClick={onEditPatient}
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid rgba(51, 39, 42, 0.12)',
            padding: '5px 12px',
            borderRadius: 'var(--pill-radius)',
          }}
        >
          {weightKg} kg · Edit
        </button>
      </div>

      {/* Clean Delayed Presentation Guard Badge if triggered */}
      {resus.isDelayedPresentationBlocked && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--btn-accent)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            color: 'var(--text-accent-dark)',
            fontWeight: 700,
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>Arrived {resus.delayedPresentationHours} hours after injury. Do not give extra fluid to catch up.</span>
        </div>
      )}

      {resus.isPaediatric && resus.maintenanceMlPerH > 0 && !resus.isPediatricBlocked && (
        <div style={{ marginTop: '12px', fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Plus D5LR maintenance: {resus.maintenanceMlPerH} mL/h ({resus.maintenance24hMl.toLocaleString()} mL/24h), not titrated
        </div>
      )}

      {/* Dot Matrix Chart */}
      {!resus.isPediatricBlocked && <DotMatrixChart resus={resus} />}

      {/* Resuscitation Rates Summary Pills */}
      {!resus.isPediatricBlocked && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-light)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: '16px',
              padding: '12px 14px',
              border: '1px solid var(--border-light)',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-display)',
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              First 8 hours
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                marginTop: '4px',
                color: 'var(--text-primary)',
              }}
            >
              {resus.phase1HourlyRateMlH}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                mL/h
              </span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: '16px',
              padding: '12px 14px',
              border: '1px solid var(--border-light)',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-display)',
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Next 16 hours
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                marginTop: '4px',
                color: 'var(--text-primary)',
              }}
            >
              {resus.phase2HourlyRateMlH}{' '}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                mL/h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Target Urine Output Guideline */}
      {!resus.isPediatricBlocked && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '11px',
            fontFamily: 'var(--font-editorial)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 4px 0 4px',
          }}
        >
          <span>Urine output target:</span>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: '11px' }}>
            {resus.urineOutputTargetMinMlH}–{resus.urineOutputTargetMaxMlH} mL/h
          </strong>
        </div>
      )}
    </div>
  );
};
