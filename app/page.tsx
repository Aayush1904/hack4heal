'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { HomeScreen, StoredPatient } from '@/components/HomeScreen';
import { AddPatientFlow } from '@/components/AddPatientFlow';
import { PatientDetailView } from '@/components/PatientDetailView';

// ── Lazy-load the heavy triage workspace so Turbopack doesn't
//    time-out parsing all these large files on the initial page load.
const TriageWorkspace = dynamic(() => import('@/components/TriageWorkspace'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '3px solid var(--border-light)',
        borderTop: '3px solid var(--text-primary)',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{
        fontSize: '11px',
        fontFamily: 'monospace',
        fontWeight: 800,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: 'var(--text-tertiary)',
      }}>
        Loading Triage Workspace…
      </span>
    </div>
  ),
});

type AppView = 'home' | 'triage-workspace';

export default function BurnOsApp() {
  const [appView, setAppView] = useState<AppView>('home');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedStoredPatient, setSelectedStoredPatient] = useState<StoredPatient | null>(null);
  // Patient being triaged. Triage can only be opened from a patient's detail page.
  const [triagePatient, setTriagePatient] = useState<StoredPatient | null>(null);

  // ── Patient Detail View ────────────────────────────────────────
  if (appView === 'home' && selectedStoredPatient) {
    return (
      <main className="app-viewport">
        <header style={{ marginBottom: '0px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            padding: '0 2px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src="/assets/logo.png"
                alt="Burn OS"
                style={{ height: '64px', width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            </div>
          </div>
        </header>

        <PatientDetailView
          patient={selectedStoredPatient}
          onBack={() => setSelectedStoredPatient(null)}
          onUpdatePatient={(p) => setSelectedStoredPatient(p)}
          onOpenTriage={(p) => {
            setTriagePatient(p);
            setAppView('triage-workspace');
          }}
        />

        <AddPatientFlow
          isOpen={isAddPatientOpen}
          onClose={() => setIsAddPatientOpen(false)}
          onComplete={(p) => {
            setIsAddPatientOpen(false);
            setSelectedStoredPatient(p);
          }}
        />
      </main>
    );
  }

  // ── Home Screen ────────────────────────────────────────────────
  if (appView === 'home' || !triagePatient) {
    return (
      <main className="app-viewport">
        <header style={{ marginBottom: '0px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            padding: '0 2px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src="/assets/logo.png"
                alt="Burn OS"
                style={{ height: '64px', width: 'auto', display: 'block', objectFit: 'contain' }}
              />
            </div>
          </div>
        </header>

        <HomeScreen
          onAddPatient={() => setIsAddPatientOpen(true)}
          onSelectPatient={(p) => setSelectedStoredPatient(p)}
        />

        <AddPatientFlow
          isOpen={isAddPatientOpen}
          onClose={() => setIsAddPatientOpen(false)}
          onComplete={(p) => {
            setIsAddPatientOpen(false);
            setSelectedStoredPatient(p);
          }}
        />
      </main>
    );
  }

  // ── Triage Workspace (lazy-loaded) ────────────────────────────
  return (
    <main className="app-viewport">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '0px',
      }}>
        <button
          id="back-to-home-triage-btn"
          onClick={() => setAppView('home')}
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
        <span style={{
          fontSize: '11px',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}>
          Triage
        </span>
      </div>

      <TriageWorkspace key={triagePatient.id} patient={triagePatient} />
    </main>
  );
}
