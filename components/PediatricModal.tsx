'use client';

import React from 'react';
import { PhoneCall, ShieldAlert } from 'lucide-react';
import { PatientRecord } from '@/types/burn';

interface PediatricModalProps {
  patient: PatientRecord;
  isOpen: boolean;
  onClose: () => void;
}

export const PediatricModal: React.FC<PediatricModalProps> = ({ patient, isOpen, onClose }) => {
  if (!isOpen) return null;

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
          maxWidth: '400px',
          backgroundColor: '#fffffe',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(51, 39, 42, 0.25)',
          border: '2px solid var(--stroke)',
          fontFamily: 'var(--font-display)',
        }}
      >
        {/* Safety Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--stroke)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={24} color="#b83355" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Child patient: special care needed
            </div>
            <div style={{ fontSize: '10px', color: '#b83355', fontWeight: 700 }}>
              Applies to patients under 18 years or under 30 kg
            </div>
          </div>
        </div>

        {/* Clinical Rationale Box */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '14px',
            border: '1.5px solid var(--btn-accent)',
            fontSize: '11px',
            lineHeight: '1.5',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}
        >
          <strong style={{ color: '#b83355' }}>Adult fluid calculation is turned off.</strong>
          <br />
          Patient is <strong>{patient.ageYears} years old</strong>, weighing <strong>{patient.weightKg} kg</strong>.
          <ul style={{ paddingLeft: '16px', marginTop: '6px' }}>
            <li>Children lose heat and fluid faster and have small sugar reserves.</li>
            <li>Adult fluids without dextrose can cause <strong>dangerously low blood sugar and seizures</strong>.</li>
            <li>Use a paediatric protocol (Galveston or Carvajal) with dextrose maintenance fluid.</li>
          </ul>
        </div>

        {/* Manual Fallback Reference */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: '16px',
            padding: '12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            marginBottom: '18px',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Reference for a specialist
          </div>
          <div>• Fluids: Lactated Ringer&apos;s, 3 mL &times; kg &times; % burned (half in the first 8 hours)</div>
          <div>• Maintenance: D5 in 0.45% saline (Holliday-Segar)</div>
          <div>• Urine target: 1 mL/kg/hour</div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="tel:911"
            style={{
              backgroundColor: 'var(--btn-accent)',
              color: 'var(--btn-text)',
              border: '2px solid var(--stroke)',
              borderRadius: '14px',
              padding: '12px',
              textAlign: 'center',
              textDecoration: 'none',
              fontWeight: 800,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(51, 39, 42, 0.08)',
            }}
          >
            <PhoneCall size={16} />
            Call a paediatric burn specialist
          </a>

          <button
            onClick={onClose}
            style={{
              backgroundColor: '#fffffe',
              color: 'var(--text-primary)',
              borderRadius: '14px',
              padding: '10px',
              border: '1px solid var(--border-medium)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            I understand, continue manually
          </button>
        </div>
      </div>
    </div>
  );
};
