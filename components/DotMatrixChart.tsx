'use client';

import React, { useState } from 'react';
import { ResuscitationOutput } from '@/types/burn';

interface DotMatrixChartProps {
  resus: ResuscitationOutput;
  onSelectHour?: (hour: number) => void;
}

export const DotMatrixChart: React.FC<DotMatrixChartProps> = ({ resus, onSelectHour }) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const MAX_DOTS = 9;
  const maxRate = Math.max(...(resus.hourlySchedule.map((s) => s.hourlyRateMlH) || [1]), 100);

  return (
    <div style={{ marginTop: '16px', width: '100%' }}>
      {/* Dot Matrix Grid */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          height: '130px',
          padding: '8px 2px 6px 2px',
          borderBottom: '1px solid var(--border-light)',
          gap: '3px',
        }}
      >
        {resus.hourlySchedule.map((item) => {
          const dotsCount = Math.max(2, Math.round((item.hourlyRateMlH / maxRate) * MAX_DOTS));
          const isSelected = hoveredHour === item.hour;

          return (
            <div
              key={item.hour}
              onMouseEnter={() => {
                setHoveredHour(item.hour);
                onSelectHour?.(item.hour);
              }}
              onMouseLeave={() => setHoveredHour(null)}
              onClick={() => onSelectHour?.(item.hour)}
              style={{
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '4px',
                alignItems: 'center',
                flex: 1,
                cursor: 'pointer',
                padding: '2px 0',
                borderRadius: '6px',
                backgroundColor: isSelected ? 'rgba(255, 139, 167, 0.15)' : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            >
              {Array.from({ length: dotsCount }).map((_, dotIndex) => {
                let dotColor = 'var(--dot-empty)';

                if (item.isElapsed) {
                  dotColor = 'var(--dot-filled)';
                } else if (item.isCurrent) {
                  dotColor = dotIndex === dotsCount - 1 ? 'var(--dot-active)' : 'var(--dot-filled)';
                }

                return (
                  <span
                    key={dotIndex}
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: dotColor,
                      transition: 'transform 0.1s ease',
                      transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Axis Baseline Labels (Matching 'MAY $3,250' & 'JUN $12,392') */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '10px',
          fontSize: '11px',
          fontFamily: 'monospace',
          letterSpacing: '0.04em',
          color: 'var(--text-secondary)',
        }}
      >
        <span>00H INJURY</span>
        {hoveredHour ? (
          <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
            H{hoveredHour}: {resus.hourlySchedule[hoveredHour - 1]?.hourlyRateMlH} mL/h
          </span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
            +{resus.elapsedHoursFromInjury}h ELAPSED
          </span>
        )}
        <span>24H {resus.total24hMl.toLocaleString()} mL</span>
      </div>
    </div>
  );
};
