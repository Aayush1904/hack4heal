'use client';

import React, { useState } from 'react';
import { PatientRecord, BurnMechanism } from '@/types/burn';
import { X, Save, ShieldAlert } from 'lucide-react';

interface EditPatientModalProps {
  patient: PatientRecord;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: PatientRecord) => void;
}

export const EditPatientModal: React.FC<EditPatientModalProps> = ({
  patient,
  isOpen,
  onClose,
  onSave,
}) => {
  const [ageYears, setAgeYears] = useState(patient.ageYears);
  const [weightKg, setWeightKg] = useState(patient.weightKg);
  const [gender, setGender] = useState(patient.gender);
  const [mechanism, setMechanism] = useState<BurnMechanism>(patient.mechanism);
  const [preHospitalFluidsMl, setPreHospitalFluidsMl] = useState(patient.preHospitalFluidsMl);
  const [suspectedInhalationInjury, setSuspectedInhalationInjury] = useState(patient.suspectedInhalationInjury);
  const [concomitantTrauma, setConcomitantTrauma] = useState(patient.concomitantTrauma);

  const injuryDate = new Date(patient.timeOfInjury);
  const refArrival = new Date(patient.timeOfArrival || '2026-10-24T10:00:00.000Z');
  const initialHoursAgo = Math.max(0, (refArrival.getTime() - injuryDate.getTime()) / (3600 * 1000));
  const [hoursAgo, setHoursAgo] = useState(Number(initialHoursAgo.toFixed(1)));

  if (!isOpen) return null;

  const handleSave = () => {
    const newInjuryTime = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
    onSave({
      ...patient,
      ageYears,
      weightKg,
      gender,
      mechanism,
      preHospitalFluidsMl,
      suspectedInhalationInjury,
      concomitantTrauma,
      timeOfInjury: newInjuryTime,
    });
    onClose();
  };

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
          maxWidth: '440px',
          maxHeight: '85vh',
          backgroundColor: '#fffffe',
          borderRadius: '28px',
          padding: '24px',
          boxShadow: '0 25px 60px rgba(51, 39, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-display)',
          border: '2px solid var(--stroke)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Patient details
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Case ID: {patient.crid}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>


        {/* Privacy notice */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '14px', backgroundColor: 'rgba(184,51,85,0.07)', border: '1px solid rgba(184,51,85,0.18)', marginBottom: '14px', fontSize: '11px', lineHeight: 1.5, color: '#b83355', fontWeight: 600 }}>
          <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>Protect patient privacy. Do not enter names, phone numbers, ID numbers, addresses or emails here. Use the case ID only.</span>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '4px' }}>
          {/* Age & Weight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Age (years)
              </label>
              <input
                type="number"
                value={ageYears}
                onChange={(e) => setAgeYears(Number(e.target.value))}
                min="0"
                max="110"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-medium)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  backgroundColor: '#fffffe',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
                Weight (kg)
              </label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                min="1"
                max="300"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-medium)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  backgroundColor: '#fffffe',
                }}
              />
            </div>
          </div>

          {/* Time-zero Elapsed Hours */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '16px', border: '1.5px solid var(--btn-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Time since injury:</span>
              <strong style={{ color: hoursAgo >= 6 ? '#b83355' : 'var(--text-primary)', fontWeight: 800 }}>{hoursAgo}h ago</strong>
            </div>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={hoursAgo}
              onChange={(e) => setHoursAgo(Number(e.target.value))}
              style={{ width: '100%', accentColor: hoursAgo >= 6 ? '#b83355' : 'var(--stroke)' }}
            />
            <div style={{ fontSize: '10px', color: 'var(--text-primary)', marginTop: '4px' }}>
              {hoursAgo >= 6 ? (
                <span style={{ color: '#b83355', fontWeight: 800 }}>
                  6 or more hours since injury. Extra catch-up fluid is blocked for safety.
                </span>
              ) : (
                'Fluids are counted from the time of the burn, not from arrival at hospital.'
              )}
            </div>
          </div>

          {/* Pre-hospital fluids */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
              Fluids given before arrival (mL)
            </label>
            <input
              type="number"
              value={preHospitalFluidsMl}
              onChange={(e) => setPreHospitalFluidsMl(Number(e.target.value))}
              step="50"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--border-medium)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                backgroundColor: '#fffffe',
              }}
            />
          </div>

          {/* Mechanism */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 700 }}>
              How did the burn happen?
            </label>
            <select
              value={mechanism}
              onChange={(e) => setMechanism(e.target.value as BurnMechanism)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--border-medium)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                backgroundColor: '#fffffe',
                color: 'var(--text-primary)',
              }}
            >
              <option value="Flame">Flame or flash fire</option>
              <option value="Scald">Hot liquid (scald)</option>
              <option value="Chemical">Chemical</option>
              <option value="Electrical">Electrical</option>
              <option value="Contact">Hot object (contact)</option>
              <option value="Radiation">Radiation</option>
            </select>
          </div>

          {/* ABA Triggers switches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={suspectedInhalationInjury}
                onChange={(e) => setSuspectedInhalationInjury(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#ff8ba7' }}
              />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Possible smoke or airway injury (soot, singed hair, enclosed space)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={concomitantTrauma}
                onChange={(e) => setConcomitantTrauma(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#ff8ba7' }}
              />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Other injuries (fractures, internal bleeding)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              backgroundColor: 'var(--btn-accent)',
              color: 'var(--btn-text)',
              border: '2px solid var(--stroke)',
              borderRadius: '14px',
              padding: '12px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(51, 39, 42, 0.08)',
            }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
