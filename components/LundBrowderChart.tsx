'use client';

import React, { useState } from 'react';
import { LundBrowderSegment } from '@/types/burn';
import { Shield, ChevronRight, X } from 'lucide-react';

interface LundBrowderChartProps {
  segments: LundBrowderSegment[];
  patientAge: number;
  onUpdateSegment: (segmentId: string, partial: number, full: number) => void;
  onAddAuditLog: (action: any, details: string) => void;
}

export const LundBrowderChart: React.FC<LundBrowderChartProps> = ({
  segments,
  patientAge,
  onUpdateSegment,
  onAddAuditLog,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'torso' | 'arms' | 'legs' | 'head' | 'perineum'>('all');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const filteredSegments = selectedCategory === 'all'
    ? segments
    : segments.filter((s) => s.category === selectedCategory);

  const editingSegment = segments.find((s) => s.id === editingSegmentId);

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
          ANATOMICAL BODY MAP
        </span>

        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '3px 8px',
            borderRadius: 'var(--pill-radius)',
            fontWeight: 800,
          }}
        >
          AGE {patientAge}Y ADJUSTED
        </span>
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '16px',
        }}
      >
        {(['all', 'torso', 'arms', 'legs', 'head'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '5px 12px',
              borderRadius: 'var(--pill-radius)',
              border: selectedCategory === cat ? '2px solid var(--stroke)' : '1px solid var(--border-light)',
              backgroundColor: selectedCategory === cat ? 'var(--btn-accent)' : 'var(--bg-surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Editing Drawer if segment selected */}
      {editingSegment && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '18px',
            padding: '16px',
            border: '2px solid var(--stroke)',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                {editingSegment.name}
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                Max region: {editingSegment.getPercentageForAge(patientAge)}% TBSA
              </div>
            </div>
            <button
              onClick={() => setEditingSegmentId(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Burn percentage slider */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '6px' }}>
              <span>Burn Area:</span>
              <span>{editingSegment.partialBurnPercentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={editingSegment.partialBurnPercentage}
              onChange={(e) => {
                const val = Number(e.target.value);
                onUpdateSegment(editingSegment.id, val, 0);
                onAddAuditLog('TBSA_UPDATED', `${editingSegment.name} set to ${val}%`);
              }}
              style={{ width: '100%', accentColor: '#ff8ba7' }}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {[0, 25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  onUpdateSegment(editingSegment.id, pct, 0);
                  onAddAuditLog('TBSA_UPDATED', `${editingSegment.name} set to ${pct}%`);
                }}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: '8px',
                  backgroundColor: '#fffffe',
                  border: '1px solid var(--border-medium)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                {pct === 0 ? 'Clear' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Segments Clean List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredSegments.map((seg) => {
          const maxPct = seg.getPercentageForAge(patientAge);
          const effectiveTbsa = ((seg.partialBurnPercentage + seg.fullBurnPercentage) / 100) * maxPct;
          const isBurned = effectiveTbsa > 0;
          const isSelected = editingSegmentId === seg.id;

          return (
            <div
              key={seg.id}
              onClick={() => setEditingSegmentId(seg.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: isSelected ? 'var(--bg-secondary)' : isBurned ? 'rgba(255, 198, 199, 0.4)' : 'var(--bg-surface-subtle)',
                border: isSelected ? '2px solid var(--stroke)' : isBurned ? '1px solid var(--btn-accent)' : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {seg.isSpecialAnatomicalSite && (
                  <span title="Critical ABA Site (Face, Hand, Foot, Genitalia)">
                    <Shield size={14} color="#b83355" />
                  </span>
                )}
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {seg.name}
                  </div>
                  <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {seg.partialBurnPercentage > 0 ? `${seg.partialBurnPercentage}% involved` : `Up to ${maxPct}% TBSA`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: isBurned ? '#b83355' : 'var(--text-tertiary)',
                  }}
                >
                  +{effectiveTbsa.toFixed(1)}%
                </span>
                <ChevronRight size={14} color="var(--text-tertiary)" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
