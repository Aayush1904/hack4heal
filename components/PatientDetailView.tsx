'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';
import { StoredPatient } from './HomeScreen';
import { analyzeBurnImages, AnalyzeBurnError } from '@/lib/analyze-burn';
import { compressDataUrl } from '@/lib/image-utils';
import { parklandFluidMl, type BurnRegionResult } from '@/lib/rule-of-nines';
import { ScanPhotoPicker } from './ScanPhotoPicker';
import { ScanProgress } from './ScanProgress';
import { getCurrentBurn, getScanHistory, type ScanRecord } from '@/lib/scan-history';

// three.js is heavy; load it only when a patient is opened.
const BodyPaint3D = dynamic(() => import('./BodyPaint3D'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
      Loading 3D model…
    </div>
  ),
});

interface PatientDetailViewProps {
  patient: StoredPatient;
  onBack: () => void;
  onUpdatePatient?: (patient: StoredPatient) => void;
  onOpenTriage?: (patient: StoredPatient) => void;
}

function getBurnSeverity(percent?: number): { label: string; color: string; bg: string } {
  if (percent === undefined) return { label: 'PENDING', color: '#877478', bg: 'rgba(135,116,120,0.12)' };
  if (percent < 10) return { label: 'MINOR', color: '#1d612e', bg: 'rgba(29,97,46,0.10)' };
  if (percent < 25) return { label: 'MODERATE', color: '#b45309', bg: 'rgba(180,83,9,0.10)' };
  if (percent < 40) return { label: 'SEVERE', color: '#b83355', bg: 'rgba(184,51,85,0.10)' };
  return { label: 'CRITICAL', color: '#7c1d2e', bg: 'rgba(124,29,46,0.12)' };
}

export const PatientDetailView: React.FC<PatientDetailViewProps> = ({ patient: initialPatient, onBack, onUpdatePatient, onOpenTriage }) => {
  const [patient, setPatient] = useState<StoredPatient>(initialPatient);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [view, setView] = useState<'scan' | 'model'>('scan');
  // Totals while a stroke is in progress. They are saved with the patient when the stroke ends.
  const [liveBurn, setLiveBurn] = useState<{ percent: number; fluidMl: number } | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    setPatient(initialPatient);
  }, [initialPatient]);

  const handleCloseScanModal = () => {
    setCapturedImages([]);
    setIsAnalyzing(false);
    setScanError(null);
    setIsScanModalOpen(false);
  };

  const persistPatient = (updated: StoredPatient) => {
    try {
      const existing: StoredPatient[] = JSON.parse(localStorage.getItem('burnos_patients') || '[]');
      const updatedList = existing.map(p => p.id === updated.id ? updated : p);
      localStorage.setItem('burnos_patients', JSON.stringify(updatedList));
      window.dispatchEvent(new Event('burnos_patients_updated'));
    } catch (err) {
      console.error('Error saving patient update to localStorage:', err);
    }
    setPatient(updated);
    onUpdatePatient?.(updated);
  };

  // The doctor edited the painting: burn % and fluid follow what is painted.
  const handlePaintedTbsa = (tbsa: number, regions: BurnRegionResult[], final: boolean) => {
    const fluidMl = parklandFluidMl(patient.weightKg, tbsa);
    if (!final) {
      setLiveBurn({ percent: tbsa, fluidMl });
      return;
    }
    // Painting is stored on its own. It never changes the estimate saved with each scan.
    setLiveBurn(null);
    persistPatient({ ...patient, painted: { percent: tbsa, fluidMl, regions } });
  };

  const runScanAnalysis = async (images: string[]) => {
    setIsAnalyzing(true);
    setScanError(null);
    try {
      const result = await analyzeBurnImages({
        images,
        age: patient.age,
        gender: patient.gender,
        weightKg: patient.weightKg,
      });
      const thumb = await compressDataUrl(images[0], 480, 0.7);

      // Every scan is added to the history, so a follow-up never overwrites an earlier one.
      const record: ScanRecord = {
        id: `scan-${Date.now()}`,
        takenAt: new Date().toISOString(),
        burnPercent: result.tbsa,
        fluidMl: result.fluidMl,
        regions: result.regions,
        imageDataUrl: thumb,
        confidence: result.confidence,
      };

      persistPatient({
        ...patient,
        scans: [...getScanHistory(patient), record],
        painted: undefined,
        burnPercent: result.tbsa,
        fluidMl: result.fluidMl,
        burnRegions: result.regions,
        burnDebug: {
          model: result.debug?.model,
          notes: result.notes,
          confidence: result.confidence,
          images: result.images,
        },
        imageDataUrl: thumb,
      });
      setIsAnalyzing(false);
      setIsScanModalOpen(false);
      setCapturedImages([]);
    } catch (err) {
      const message = err instanceof AnalyzeBurnError ? err.message : 'Burn analysis failed.';
      setScanError(message);
      setIsAnalyzing(false);
    }
  };

  const paintedPercent = liveBurn?.percent ?? patient.painted?.percent ?? 0;
  const paintedFluidMl = liveBurn?.fluidMl ?? patient.painted?.fluidMl ?? 0;
  const severity = getBurnSeverity(paintedPercent);
  const current = getCurrentBurn(patient);
  const history = getScanHistory(patient);
  const latestScan = history.length ? history[history.length - 1] : null;
  const scanSeverity = getBurnSeverity(latestScan?.burnPercent);
  const isFollowUp = history.length > 0;
  const bmi = (patient.weightKg / ((patient.heightCm / 100) ** 2)).toFixed(1);
  const createdAt = new Date(patient.createdAt);
  const formattedDate = createdAt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const triageCta = (
    <>
      {current.percent !== undefined && onOpenTriage && (
        <button
          id="open-patient-triage-btn"
          onClick={() => onOpenTriage({ ...patient, burnPercent: current.percent, fluidMl: current.fluidMl })}
          style={{
            width: '100%',
            padding: '16px',
            marginBottom: '16px',
            borderRadius: '18px',
            border: '2px solid var(--stroke)',
            backgroundColor: 'var(--btn-accent)',
            color: 'var(--btn-text)',
            fontSize: '15px',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(51, 39, 42, 0.08)',
          }}
        >
          Open triage <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      )}
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      {/* Back header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button
          id="back-to-home-btn"
          onClick={onBack}
          style={{
            width: '38px',
            height: '38px',
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {patient.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '1px' }}>
            {formattedDate}
          </div>
        </div>
      </div>

      {/* Patient details, at the top of the page */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-card)', padding: '16px 18px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Patient details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 10px' }}>
          {[
            { label: 'Age', value: `${patient.age} yrs` },
            { label: 'Gender', value: patient.gender },
            { label: 'Child (under 18)', value: patient.age < 18 ? 'Yes' : 'No', alert: patient.age < 18 },
            { label: 'Height', value: `${patient.heightCm} cm` },
            { label: 'Weight', value: `${patient.weightKg} kg` },
            { label: 'BMI', value: bmi },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{row.label}</div>
              <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', fontFamily: 'var(--font-display)', color: row.alert ? '#b83355' : 'var(--text-primary)', marginTop: '2px' }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
        {patient.age < 18 && (
          <p style={{ marginTop: '12px', fontSize: '13px', fontFamily: 'var(--font-editorial)', color: '#b83355', lineHeight: 1.45 }}>
            Special child burn protocols apply. Adult fluid formulas can be unsafe.
          </p>
        )}
      </div>

      {/* Two pages: the photo scan result, and the 3D model the doctor paints on */}
      <div role="tablist" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '999px', backgroundColor: 'var(--bg-badge)', marginBottom: '16px' }}>
        {([
          { id: 'scan', label: 'Burn scan' },
          { id: 'model', label: '3D model' },
        ] as const).map((t) => (
          <button
            key={t.id}
            id={`patient-tab-${t.id}`}
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: view === t.id ? 'var(--text-primary)' : 'transparent',
              color: view === t.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'scan' && (
        <>
      {/* Result of the photo scan */}
      {latestScan && (
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', marginBottom: '16px' }}>
          {latestScan.imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latestScan.imageDataUrl} alt="Burn photo" style={{ width: '100%', height: '210px', objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
                Scan {history.length} &bull; {new Date(latestScan.takenAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: scanSeverity.color, backgroundColor: scanSeverity.bg, padding: '4px 10px', borderRadius: '999px' }}>
                {scanSeverity.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '2px' }}>
                  Burn area from the photo
                </div>
                <div style={{ fontSize: '44px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
                  {latestScan.burnPercent}%
                </div>
              </div>
              {latestScan.fluidMl !== undefined && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '2px' }}>
                    Fluid (24 h)
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
                    {latestScan.fluidMl.toLocaleString()} mL
                  </div>
                </div>
              )}
            </div>
            <p style={{ marginTop: '12px', fontSize: '13px', lineHeight: 1.5, fontFamily: 'var(--font-editorial)', color: 'var(--text-tertiary)' }}>
              Estimated by AI from the uploaded photo. You can mark the burn yourself on the 3D model page.
            </p>
          </div>
        </div>
      )}

      {/* Burn scan CTA when burnPercent is pending */}
      {history.length === 0 && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '20px',
          padding: '18px 20px',
          border: '1.5px dashed var(--btn-accent)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,139,167,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}>
              📷
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                Burn Scan Pending
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)', marginTop: '2px' }}>
                No wound photo was scanned yet. Take or upload a photo to calculate TBSA% and Parkland fluid formula.
              </div>
            </div>
          </div>
          <button
            id="perform-burn-scan-btn"
            onClick={() => setIsScanModalOpen(true)}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '14px',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'opacity 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Perform Burn Scan Now
          </button>
        </div>
      )}

      {/* Progress: every scan of this patient, with the change since the first */}
      <ScanProgress patient={patient} onAddFollowUp={() => setIsScanModalOpen(true)} />

      {/* Triage */}
      {triageCta}

        </>
      )}

      {view === 'model' && (
        <>
      {/* Burn area from the painting. Starts at 0 and is worked out as the doctor paints. */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '24px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-card)', padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
            Painted on the 3D model
          </span>
          {paintedPercent > 0 && (
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: severity.color, backgroundColor: severity.bg, padding: '4px 10px', borderRadius: '999px' }}>
              {severity.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '2px' }}>
              Burn area
            </div>
            <div style={{ fontSize: '44px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1 }}>
              {paintedPercent}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: '2px' }}>
              Fluid (24 h)
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
              {paintedFluidMl.toLocaleString()} mL
            </div>
          </div>
        </div>
        <p style={{ marginTop: '12px', fontSize: '13px', lineHeight: 1.5, fontFamily: 'var(--font-editorial)', color: 'var(--text-tertiary)' }}>
          {paintedPercent === 0
            ? 'Paint the burned areas in red. The burn area and fluid are worked out as you paint.'
            : 'Worked out from what you painted. Triage uses this number.'}
          {latestScan && <> Photo scan estimate: {latestScan.burnPercent}%.</>}
        </p>
      </div>

      {/* Interactive 3D body — doctor paints burn regions for visualization */}
      <BodyPaint3D
        gender={patient.gender}
        regions={patient.painted?.regions}
        ageYears={patient.age}
        onTbsaChange={handlePaintedTbsa}
        debugInfo={patient.burnDebug}
      />

      {triageCta}

      {/* Fluid schedule */}
      {paintedFluidMl > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '8px', padding: '0 2px' }}>
            Parkland Fluid Schedule
          </div>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '20px',
            padding: '16px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {[
              { phase: 'Phase 1', window: '0–8 hours', total: Math.round(paintedFluidMl * 0.5), rate: Math.round(paintedFluidMl * 0.5 / 8) },
              { phase: 'Phase 2', window: '8–24 hours', total: Math.round(paintedFluidMl * 0.5), rate: Math.round(paintedFluidMl * 0.5 / 16) },
            ].map(row => (
              <div key={row.phase} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: '14px',
                border: '1px solid var(--border-light)',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{row.phase}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '2px' }}>{row.window}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{row.total.toLocaleString()} mL</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '2px' }}>{row.rate} mL/hr</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        </>
      )}

      {/* ────────────────── BURN SCAN MODAL ────────────────── */}
      {isScanModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(51,39,42,0.6)',
              backdropFilter: 'blur(6px)',
            }}
            onClick={handleCloseScanModal}
          />
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '28px 28px 0 0',
            padding: '8px 20px 36px',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 1,
          }}>
            <div style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--border-medium)',
              margin: '12px auto 20px',
            }} />

            {/* Analyzing State */}
            {isAnalyzing ? (
              <div style={{ textAlign: 'center', padding: '36px 16px' }}>
                <div style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-light)',
                  borderTop: '3px solid var(--text-primary)',
                  margin: '0 auto 20px',
                  animation: 'spin 0.9s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <h3 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                  Analyzing Burn Photo...
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', lineHeight: '1.6', maxWidth: '280px', margin: '0 auto 24px' }}>
                  Rule-of-Nines assessment and 3D burn mapping for {patient.name}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', maxWidth: '260px', margin: '0 auto' }}>
                  {['Segmenting wound margins...', 'Classifying burn depth...', 'Calculating TBSA percentage...', 'Computing Parkland resuscitation...'].map((msg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--btn-accent)',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)' }}>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {isFollowUp ? 'Follow-up scan' : 'Scan Burn Area'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
                    {isFollowUp
                      ? `Take new photos of ${patient.name}’s burn from the same angles as before. The result is added to the progress history.`
                      : `Capture or upload a clear photo of ${patient.name}’s burn wound`}
                  </p>
                </div>

                {scanError && (
                  <div style={{
                    marginBottom: '14px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(124,29,46,0.08)',
                    border: '1px solid rgba(124,29,46,0.2)',
                    fontSize: '13px',
                    color: '#7c1d2e',
                    fontFamily: 'var(--font-editorial)',
                    lineHeight: 1.5,
                  }}>
                    {scanError}
                  </div>
                )}

                <ScanPhotoPicker
                  idPrefix="detail-scan"
                  images={capturedImages}
                  onChange={setCapturedImages}
                  onAnalyze={runScanAnalysis}
                  analyzeLabel="Analyze {n} photo(s) & Calculate TBSA ?"
                />

                <button
                  onClick={handleCloseScanModal}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '14px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)',
                    border: 'none',
                    fontFamily: 'var(--font-display)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
