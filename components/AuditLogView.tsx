'use client';

import React from 'react';
import { AuditTrailEvent } from '@/types/burn';
import { Lock, History, Database, Check } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditTrailEvent[];
  crid: string;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  TRIAGE_CREATED: 'Patient added',
  TBSA_UPDATED: 'Burn area changed',
  MASK_EDITED: 'Photo outline changed',
  FORMULA_CHANGED: 'Fluid formula changed',
  DELAYED_RESUS_CALCULATED: 'Late arrival checked',
  ABA_TRIGGERED: 'Transfer criteria met',
  HANDOVER_GENERATED: 'Handover note created',
};

const formatClinician = (id: string) =>
  id
    .replace(/_MD_\d+$/, '')
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, crid, onClose }) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} color="var(--text-primary)" />
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
            Activity log
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      {/* Compliance Notice */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: '14px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid rgba(51, 39, 42, 0.08)',
          marginBottom: '16px',
          fontSize: '11px',
          fontFamily: 'var(--font-display)',
          color: 'var(--text-safe)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        <Lock size={14} color="#1d612e" />
        <span>
          Case ID: <strong>{crid}</strong>. Every change is recorded and cannot be edited.
        </span>
      </div>

      {/* Audit Log Entries List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-light)',
              fontSize: '11px',
              fontFamily: 'var(--font-display)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{ACTION_LABELS[log.action] ?? log.action}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{log.details}</div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--text-tertiary)',
                fontSize: '9px',
                borderTop: '1px dashed var(--border-light)',
                paddingTop: '4px',
              }}
            >
              <span>By {formatClinician(log.clinicianId)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
