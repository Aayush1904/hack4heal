'use client';

import React from 'react';
import { Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { burnChange, getScanHistory, sinceFirstLabel } from '@/lib/scan-history';
import type { StoredPatient } from './HomeScreen';

interface ScanProgressProps {
  patient: StoredPatient;
  onAddFollowUp: () => void;
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A lower burn area is shown in green and a larger one in red. */
function changeStyle(change: number) {
  if (Math.abs(change) < 0.5) return { color: 'var(--text-tertiary)', bg: 'var(--bg-badge)', Icon: Minus, word: 'No change' };
  if (change < 0) return { color: '#1d612e', bg: 'var(--bg-tertiary)', Icon: TrendingDown, word: 'Smaller' };
  return { color: '#b83355', bg: 'var(--bg-secondary)', Icon: TrendingUp, word: 'Larger' };
}

const formatChange = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c).toFixed(1)} pts`;

function TrendChart({ values }: { values: number[] }) {
  const W = 320, H = 132, padX = 28, padTop = 26, padBottom = 26;
  const max = Math.max(10, ...values) * 1.15;
  const x = (i: number) => (values.length === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (values.length - 1));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Burn area at each scan" style={{ display: 'block' }}>
      <line x1={padX - 10} x2={W - padX + 10} y1={H - padBottom} y2={H - padBottom} stroke="var(--border-medium)" strokeWidth="1" />
      <path d={area} fill="var(--bg-secondary)" opacity="0.7" />
      <path d={line} fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const isLast = i === values.length - 1;
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={isLast ? 6 : 5} fill={isLast ? 'var(--btn-accent)' : 'var(--bg-surface)'} stroke="var(--stroke)" strokeWidth="2" />
            <text x={x(i)} y={y(v) - 11} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-primary)">
              {v}%
            </text>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-tertiary)">
              Scan {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-secondary)',
};

export const ScanProgress: React.FC<ScanProgressProps> = ({ patient, onAddFollowUp }) => {
  const history = getScanHistory(patient);
  if (history.length === 0) return null;

  const first = history[0];
  const latest = history[history.length - 1];
  const hasTrend = history.length > 1;
  const total = burnChange(first, latest);
  const totalStyle = changeStyle(total);
  const newestFirst = [...history].reverse();

  return (
    <section id="scan-progress" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 2px' }}>
        <span style={sectionLabel}>Progress</span>
        <button
          id="add-followup-scan-btn"
          onClick={onAddFollowUp}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 12px',
            borderRadius: '999px',
            border: '1px solid var(--border-active)',
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            fontSize: '12px',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            cursor: 'pointer',
          }}
        >
          <Plus size={13} strokeWidth={2.8} /> Follow-up scan
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-card)', padding: '18px 16px' }}>
        {hasTrend && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', backgroundColor: totalStyle.bg, color: totalStyle.color, fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
              <totalStyle.Icon size={14} strokeWidth={2.6} />
              {totalStyle.word}: {formatChange(total)}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)' }}>
              since the first scan
            </span>
          </div>
        )}

        {hasTrend ? (
          <>
            <TrendChart values={history.map((s) => s.burnPercent)} />

            {first.imageDataUrl && latest.imageDataUrl && (
              <>
                <div style={{ ...sectionLabel, margin: '18px 0 8px' }}>First scan and latest scan</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'First', scan: first },
                    { label: 'Latest', scan: latest },
                  ].map(({ label, scan }) => (
                    <div key={label} style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface-subtle)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={scan.imageDataUrl} alt={`${label} scan`} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>{scan.burnPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.5, fontFamily: 'var(--font-editorial)', color: 'var(--text-secondary)' }}>
            This is the first scan. Add a follow-up scan with new photos to see how the burn is changing.
          </p>
        )}

        {/* Timeline */}
        <div style={{ ...sectionLabel, margin: '20px 0 10px' }}>All scans</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {newestFirst.map((scan) => {
            const index = history.indexOf(scan);
            const prev = index > 0 ? history[index - 1] : null;
            const change = prev ? burnChange(prev, scan) : null;
            const style = change !== null ? changeStyle(change) : null;
            return (
              <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '16px', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-light)' }}>
                {scan.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scan.imageDataUrl} alt={`Scan ${index + 1}`} style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: 'var(--bg-badge)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                      Scan {index + 1}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                      {sinceFirstLabel(first.takenAt, scan.takenAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'var(--font-display)' }}>
                    {formatWhen(scan.takenAt)}
                    {scan.fluidMl !== undefined && <> &bull; {scan.fluidMl.toLocaleString()} mL fluid</>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    {scan.burnPercent}%
                  </div>
                  {style && change !== null && (
                    <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-display)', color: style.color }}>
                      {formatChange(change)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ marginTop: '14px', fontSize: '12px', lineHeight: 1.5, fontFamily: 'var(--font-editorial)', color: 'var(--text-tertiary)' }}>
          A lower number means a smaller burn area. Take each follow-up photo from the same angles for a fair comparison.
        </p>
      </div>
    </section>
  );
};
