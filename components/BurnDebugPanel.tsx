'use client';

/**
 * TEMPORARY developer panel for the burn-mapping pipeline.
 * Remove: delete this file, drop the <BurnDebugPanel/> usage in BodyPaint3D.tsx and the `debugInfo`
 * plumbing — or just set DEBUG_BURN = false in lib/debug-burn.ts.
 */

import React, { useState } from 'react';
import type { RegionBurnStat } from '@/lib/body-regions';
import { REGION_IDS, computeTbsa, getRegionWeights, regionLabel, type BurnRegionResult, type RegionId } from '@/lib/rule-of-nines';

export interface BurnDebugInfoView {
  rawText?: string;
  model?: string;
  notes?: string;
  confidence?: number;
  images?: Array<{ index: number; view: string; isFullBody: boolean; cues: string; regionsVisible: string[] }>;
}

interface Flags {
  overlay: boolean;
  points: boolean;
}

interface Props {
  regions?: BurnRegionResult[];
  stats: RegionBurnStat[] | null;
  ageYears: number;
  info?: BurnDebugInfoView;
  mapInfo: { frontSign: 1 | -1; detectedFrontSign: 1 | -1; vertexCount: number } | null;
  flags: Flags;
  onFlagsChange: (patch: Partial<Flags>) => void;
}

const HUES: Record<string, string> = {
  head: '#3b82f6',
  chest: '#22c55e',
  abdomen: '#eab308',
  upper_back: '#22c55e',
  lower_back: '#eab308',
  groin: '#ec4899',
  left_arm: '#f97316',
  right_arm: '#06b6d4',
  left_leg: '#a855f7',
  right_leg: '#14b8a6',
};

/** Region colour: bright for anterior regions, dark for posterior ones. */
export function regionDebugColor(id: string): string {
  const key = id.replace(/_(front|back)$/, '');
  const base = HUES[key] ?? '#ffffff';
  if (!/_back$/.test(id) && id !== 'upper_back' && id !== 'lower_back') return base;
  const n = parseInt(base.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.5);
  const g = Math.round(((n >> 8) & 255) * 0.5);
  const b = Math.round((n & 255) * 0.5);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: '11px' };

export const BurnDebugPanel: React.FC<Props> = ({ regions, stats, ageYears, info, mapInfo, flags, onFlagsChange }) => {
  const [open, setOpen] = useState(true);
  const weights = getRegionWeights(ageYears);

  const modelByRegion = new Map((regions ?? []).map((r) => [r.id, r]));
  const modelTbsa = regions ? computeTbsa(regions, ageYears) : null;
  const modelContribSum = regions
    ? Math.round(regions.reduce((a, r) => a + (r.tbsaContributionPct ?? 0), 0) * 10) / 10
    : null;
  const paintedTbsa = stats
    ? Math.round(stats.reduce((sum, s) => sum + s.fraction * (weights[s.id as RegionId] ?? 0), 0) * 10) / 10
    : null;

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        ...mono,
        padding: '5px 9px',
        borderRadius: '8px',
        border: '1px solid var(--border-medium)',
        background: active ? 'var(--text-primary)' : 'transparent',
        color: active ? 'var(--bg-surface)' : 'var(--text-primary)',
        cursor: 'pointer',
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ borderTop: '2px dashed #b45309', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ ...mono, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {open ? '▾' : '▸'} Debug · burn mapping (temporary)
      </button>

      {open && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {chip('Region overlay', flags.overlay, () => onFlagsChange({ overlay: !flags.overlay }))}
            {chip('Model points', flags.points, () => onFlagsChange({ points: !flags.points }))}          </div>

          <div style={{ ...mono, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            mesh faces: detected {mapInfo ? (mapInfo.detectedFrontSign > 0 ? '+z' : '-z') : '?'} · using{' '}
            {mapInfo ? (mapInfo.frontSign > 0 ? '+z' : '-z') : '?'} · verts {mapInfo?.vertexCount ?? '?'}
            <br />
            TBSA — model: <b>{modelTbsa ?? '—'}%</b> (model&apos;s own sum {modelContribSum ?? '—'}%
            {modelTbsa !== null && modelContribSum !== null && Math.abs(modelTbsa - modelContribSum) > 2 ? ' ⚠ mismatch' : ''}) · painted now: <b>{paintedTbsa ?? '—'}%</b>
            {info?.confidence !== undefined ? ` · confidence ${info.confidence}` : ''}
            <br />
            overlay: bright = front, dark = back. Blue head · green chest/upper back · yellow abdomen/lower back · orange L arm · cyan R arm · purple L leg · teal R leg · pink groin. (L/R = patient&apos;s.)
          </div>

          {info?.images && info.images.length > 0 && (
            <div style={{ ...mono, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {info.images.map((img) => (
                <div key={img.index}>
                  img {img.index}: <b>{img.view}</b>{img.isFullBody ? ' (full body)' : ''} — {img.cues}
                  {img.regionsVisible?.length ? ` [${img.regionsVisible.join(', ')}]` : ''}
                </div>
              ))}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...mono, width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '3px 4px' }}>region</th>
                  <th style={{ padding: '3px 4px' }}>w%</th>
                  <th style={{ padding: '3px 4px' }}>model cov</th>
                  <th style={{ padding: '3px 4px' }}>vis</th>
                  <th style={{ padding: '3px 4px' }}>model tbsa</th>
                  <th style={{ padding: '3px 4px' }}>patches (cov @ u,v)</th>
                  <th style={{ padding: '3px 4px' }}>painted</th>
                </tr>
              </thead>
              <tbody>
                {REGION_IDS.map((id) => {
                  const m = modelByRegion.get(id);
                  const s = stats?.find((x) => x.id === id);
                  return (
                    <tr key={id} style={{ borderTop: '1px solid var(--border-light)' }} title={regionLabel(id)}>
                      <td style={{ padding: '3px 4px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: regionDebugColor(id), marginRight: 5 }} />
                        {id}
                      </td>
                      <td style={{ padding: '3px 4px' }}>{weights[id]}</td>
                      <td style={{ padding: '3px 4px' }}>{m ? (m.unknown ? 'unknown' : `${m.coveragePct}% ${m.depth}`) : '—'}</td>
                      <td style={{ padding: '3px 4px' }}>{m?.visiblePct !== undefined ? `${Math.round(m.visiblePct)}%` : '—'}</td>
                      <td style={{ padding: '3px 4px' }}>
                        {m && !m.unknown && m.tbsaContributionPct !== undefined
                          ? `${m.tbsaContributionPct} (calc ${Math.round((m.coveragePct / 100) * (weights[id] ?? 0) * 10) / 10})`
                          : '—'}
                      </td>
                      <td style={{ padding: '3px 4px' }}>
                        {m && !m.unknown && m.coveragePct > 0
                          ? (m.patches?.length
                              ? m.patches
                              : [{ coveragePct: m.coveragePct, center: m.center }]
                            )
                              .map((p) => `${Math.round(p.coveragePct)}% @ ${p.center.u.toFixed(2)},${p.center.v.toFixed(2)}`)
                              .join(' | ')
                          : '—'}
                      </td>
                      <td style={{ padding: '3px 4px' }}>{s ? `${(s.fraction * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {info?.notes && <div style={{ ...mono, color: 'var(--text-secondary)' }}>notes: {info.notes}</div>}

          {info?.rawText && (
            <details>
              <summary style={{ ...mono, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 700 }}>raw model JSON</summary>
              <pre
                style={{
                  ...mono,
                  marginTop: '8px',
                  maxHeight: '220px',
                  overflow: 'auto',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-light)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {info.rawText}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
};
