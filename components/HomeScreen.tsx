'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PATIENTS_UPDATED, downloadBackup, loadPatients, restoreFromBackup } from '@/lib/patient-store';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { BurnRegionResult } from '@/lib/rule-of-nines';
import type { PaintedBurn, ScanRecord } from '@/lib/scan-history';

export interface StoredPatient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  heightCm: number;
  weightKg: number;
  burnPercent?: number;
  fluidMl?: number;
  burnRegions?: BurnRegionResult[];
  /** Temporary: raw vision output kept for the debug panel (see lib/debug-burn.ts). */
  burnDebug?: {
    rawText?: string;
    model?: string;
    notes?: string;
    confidence?: number;
    images?: Array<{ index: number; view: string; isFullBody: boolean; cues: string; regionsVisible: string[] }>;
  };
  imageDataUrl?: string;
  /** Every scan of this patient, oldest first. burnPercent, fluidMl and burnRegions above are the latest scan's estimate. */
  scans?: ScanRecord[];
  /** What the doctor painted on the 3D body. Separate from the scan estimate above. */
  painted?: PaintedBurn;
  createdAt: string;
}

interface HomeScreenProps {
  onAddPatient: () => void;
  onSelectPatient: (patient: StoredPatient) => void;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getBurnSeverity(percent?: number): { label: string; color: string; bg: string } {
  if (percent === undefined) return { label: 'PENDING', color: '#877478', bg: 'rgba(135,116,120,0.12)' };
  if (percent < 10) return { label: 'MINOR', color: '#1d612e', bg: 'rgba(29,97,46,0.10)' };
  if (percent < 25) return { label: 'MODERATE', color: '#b45309', bg: 'rgba(180,83,9,0.10)' };
  if (percent < 40) return { label: 'SEVERE', color: '#b83355', bg: 'rgba(184,51,85,0.10)' };
  return { label: 'CRITICAL', color: '#7c1d2e', bg: 'rgba(124,29,46,0.12)' };
}

function GenderIcon({ gender }: { gender: string }) {
  if (gender === 'Female') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <line x1="12" y1="12" x2="12" y2="20" />
        <line x1="9" y1="16" x2="15" y2="16" />
      </svg>
    );
  }
  if (gender === 'Male') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="14" r="4" />
        <line x1="13" y1="11" x2="20" y2="4" />
        <polyline points="16,4 20,4 20,8" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="8" x2="12" y2="2" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="8" y1="12" x2="2" y2="12" />
      <line x1="16" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onAddPatient, onSelectPatient }) => {
  const [patients, setPatients] = useState<StoredPatient[]>([]);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  // Depends on the visitor's clock, so it is set after load instead of during prerender.
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  useEffect(() => {
    const reload = () => setPatients(loadPatients());
    reload();
    window.addEventListener('storage', reload);
    window.addEventListener(PATIENTS_UPDATED, reload);
    return () => {
      window.removeEventListener('storage', reload);
      window.removeEventListener(PATIENTS_UPDATED, reload);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      {/* Hero greeting */}
      <div style={{ padding: '8px 2px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}>
          {greeting}, Doctor
        </span>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)',
          lineHeight: '1.1',
        }}>
          Patient<br />Dashboard
        </h1>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <div style={{
          flex: 1,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '20px',
          padding: '16px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {patients.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
            Total Patients
          </div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '20px',
          padding: '16px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b83355', fontFamily: 'var(--font-display)' }}>
            {patients.filter(p => (p.burnPercent ?? 0) >= 25).length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
            Severe / Critical
          </div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '20px',
          padding: '16px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', fontFamily: 'var(--font-display)' }}>
            {patients.filter(p => p.burnPercent === undefined).length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
            Awaiting Scan
          </div>
        </div>
      </div>

      {/* Add Patient CTA */}
      <button
        id="add-patient-btn"
        onClick={onAddPatient}
        style={{
          width: '100%',
          backgroundColor: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: '20px',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 20px rgba(51,39,42,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'var(--btn-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#33272a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
              Add New Patient
            </div>
            <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '1px', fontFamily: 'var(--font-display)' }}>
              Capture details & burn scan
            </div>
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </button>

      {/* Burn care guide */}
      <Link
        href="/guide"
        id="open-burn-guide-link"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '14px 18px',
          marginTop: '-12px',
          marginBottom: '28px',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          textDecoration: 'none',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookOpen size={19} strokeWidth={2.3} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', fontFamily: 'var(--font-display)' }}>
              Burn care guide
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px', fontFamily: 'var(--font-display)' }}>
              ABCDE steps and fluid formulas
            </div>
          </div>
        </div>
        <ChevronRight size={18} style={{ opacity: 0.5 }} />
      </Link>

      {/* Previous patients */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          padding: '0 2px',
        }}>
          <span style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 800,
          }}>
            Patient History
          </span>
          {patients.length > 0 && (
            <span style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
            }}>
              {patients.length} record{patients.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {patients.length === 0 ? (
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '20px',
            padding: '32px 20px',
            textAlign: 'center',
            border: '1px dashed var(--border-medium)',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🩺</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
              No patients yet
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)' }}>
              Add your first patient to begin burn assessment
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {patients.slice().reverse().map((patient) => {
              const severity = getBurnSeverity(patient.burnPercent);
              const bmi = (patient.weightKg / ((patient.heightCm / 100) ** 2)).toFixed(1);
              return (
                <div
                  key={patient.id}
                  id={`patient-card-${patient.id}`}
                  onClick={() => onSelectPatient(patient)}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: '20px',
                    padding: '14px 16px',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-card)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-badge)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    <GenderIcon gender={patient.gender} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {patient.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-editorial)',
                      marginTop: '1px',
                    }}>
                      {patient.age}yo {patient.gender[0]} &bull; {patient.weightKg}kg &bull; BMI {bmi}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'monospace',
                      marginTop: '3px',
                    }}>
                      {timeAgo(patient.createdAt)}
                    </div>
                  </div>

                  {/* Burn badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {patient.burnPercent !== undefined && (
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: severity.color,
                        fontFamily: 'var(--font-display)',
                        letterSpacing: '-0.01em',
                      }}>
                        {patient.burnPercent}%
                      </div>
                    )}
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      letterSpacing: '0.08em',
                      color: severity.color,
                      backgroundColor: severity.bg,
                      padding: '3px 7px',
                      borderRadius: '999px',
                    }}>
                      {severity.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Where the data lives, and a way to keep a copy of it */}
      <div style={{ marginTop: '24px', padding: '14px 16px', borderRadius: '18px', border: '1px dashed var(--border-medium)', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginBottom: '10px' }}>
          Patient data is saved on this device only. Keep a backup copy in case the phone or browser data is cleared.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            id="download-backup-btn"
            onClick={downloadBackup}
            style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-display)', cursor: 'pointer' }}
          >
            Download backup
          </button>
          <label
            style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid var(--border-medium)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 800, fontFamily: 'var(--font-display)', cursor: 'pointer' }}
          >
            Restore from backup
            <input
              id="restore-backup-input"
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const added = await restoreFromBackup(file);
                  setBackupNote(added ? `Restored ${added} patient${added === 1 ? '' : 's'}.` : 'No new patients in that file.');
                } catch {
                  setBackupNote('That file could not be read.');
                }
              }}
            />
          </label>
        </div>
        {backupNote && (
          <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>{backupNote}</div>
        )}
      </div>
    </div>
  );
};
