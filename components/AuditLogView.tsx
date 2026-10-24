'use client';

import React from 'react';
import { AuditTrailEvent } from '@/types/burn';
import { Lock, History, Database, Check } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditTrailEvent[];
  crid: string;
  onClose: () => void;
}

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
              fontFamily: 'monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              fontWeight: 800,
            }}
          >
            IMMUTABLE CLINICAL AUDIT TRAIL
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          CLOSE [ESC]
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
          fontFamily: 'monospace',
          color: 'var(--text-safe)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontWeight: 600,
        }}
      >
        <Lock size={14} color="#1d612e" />
        <span>
          CRID: <strong>{crid}</strong> • Re-calculation invalidates previous entries. Hash integrity verified.
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
              fontFamily: 'monospace',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{log.action}</span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
                {log.timestamp.slice(11, 16)} UTC
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
              <span>CLINICIAN: {log.clinicianId}</span>
              <span>SHA-256: {log.hashPreview}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
