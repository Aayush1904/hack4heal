'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';
import { StoredPatient } from './HomeScreen';
import { analyzeBurnImages, AnalyzeBurnError } from '@/lib/analyze-burn';
import { compressDataUrl } from '@/lib/image-utils';
import { parklandFluidMl, type BurnRegionResult } from '@/lib/rule-of-nines';
import { ScanPhotoPicker } from './ScanPhotoPicker';

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

function BodySVG({ gender, burnPercent }: { gender: string; burnPercent?: number }) {
  const isFemale = gender === 'Female';
  const burnColor = burnPercent !== undefined
    ? burnPercent > 40 ? '#7c1d2e' : burnPercent > 25 ? '#b83355' : burnPercent > 10 ? '#f59e0b' : '#1d612e'
    : 'transparent';
  return (
    <svg viewBox="0 0 120 240" width="100" height="200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="22" rx="18" ry="20" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="54" y="40" width="12" height="10" rx="3" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {isFemale ? (
        <>
          <path d="M28 52 Q20 60 22 80 L42 82 L42 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M92 52 Q100 60 98 80 L78 82 L78 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M42 50 L78 50 L82 90 Q82 100 70 102 L50 102 Q38 100 38 90 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M38 90 Q35 108 38 116 L82 116 Q85 108 82 90" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M35 116 Q30 124 36 128 L84 128 Q90 124 85 116 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <path d="M22 52 Q14 60 16 82 L40 82 L40 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M98 52 Q106 60 104 82 L80 82 L80 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M40 50 L80 50 L82 106 Q82 116 74 118 L46 118 Q38 116 38 106 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
        </>
      )}
      <rect x="14" y="52" width="12" height="38" rx="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="12" y="92" width="11" height="36" rx="5" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <ellipse cx="17" cy="136" rx="7" ry="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="94" y="52" width="12" height="38" rx="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="97" y="92" width="11" height="36" rx="5" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <ellipse cx="103" cy="136" rx="7" ry="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="38" y={isFemale ? 128 : 118} width="18" height="44" rx="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="39" y={isFemale ? 174 : 164} width="16" height="40" rx="8" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <ellipse cx="47" cy={isFemale ? 219 : 209} rx="12" ry="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="64" y={isFemale ? 128 : 118} width="18" height="44" rx="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <rect x="65" y={isFemale ? 174 : 164} width="16" height="40" rx="8" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      <ellipse cx="73" cy={isFemale ? 219 : 209} rx="12" ry="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {burnPercent !== undefined && burnPercent > 0 && (
        <ellipse cx="60" cy={isFemale ? 80 : 85} rx={Math.min(30, 10 + burnPercent * 0.5)} ry={Math.min(25, 8 + burnPercent * 0.4)} fill={burnColor} opacity="0.28" />
      )}
    </svg>
  );
}

export const PatientDetailView: React.FC<PatientDetailViewProps> = ({ patient: initialPatient, onBack, onUpdatePatient, onOpenTriage }) => {
  const [patient, setPatient] = useState<StoredPatient>(initialPatient);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
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
  const handlePaintedTbsa = (tbsa: number, regions: BurnRegionResult[]) => {
    persistPatient({
      ...patient,
      burnPercent: tbsa,
      fluidMl: parklandFluidMl(patient.weightKg, tbsa),
      burnRegions: regions,
    });
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

      persistPatient({
        ...patient,
        burnPercent: result.tbsa,
        fluidMl: result.fluidMl,
        burnRegions: result.regions,
        burnDebug: {
          rawText: result.debug?.rawText,
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

  const severity = getBurnSeverity(patient.burnPercent);
  const bmi = (patient.weightKg / ((patient.heightCm / 100) ** 2)).toFixed(1);
  const createdAt = new Date(patient.createdAt);
  const formattedDate = createdAt.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

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

      {/* Hero card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '24px',
        padding: '20px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <BodySVG gender={patient.gender} burnPercent={patient.burnPercent} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: severity.color,
            backgroundColor: severity.bg,
            padding: '4px 10px',
            borderRadius: '999px',
            display: 'inline-block',
            marginBottom: '10px',
          }}>
            {severity.label}
          </div>
          <div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
              Burn TBSA
            </div>
            <div style={{ fontSize: '40px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: '1' }}>
              {patient.burnPercent !== undefined ? `${patient.burnPercent}%` : '—'}
            </div>
          </div>
          {patient.fluidMl !== undefined && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                Fluid (24h)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: '1' }}>
                {patient.fluidMl.toLocaleString()} mL
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive 3D body — doctor paints burn regions for visualization */}
      <BodyPaint3D
        gender={patient.gender}
        regions={patient.burnRegions}
        ageYears={patient.age}
        onTbsaChange={handlePaintedTbsa}
        debugInfo={patient.burnDebug}
      />

      {/* Triage CTA: only once a burn scan has been done */}
      {patient.burnPercent !== undefined && onOpenTriage && (
        <button
          id="open-patient-triage-btn"
          onClick={() => onOpenTriage(patient)}
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

      {/* Burn scan CTA when burnPercent is pending */}
      {patient.burnPercent === undefined && (
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

      {/* Captured image */}
      {patient.imageDataUrl && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 2px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
              Wound Photo
            </span>
            <button
              id="rescan-burn-btn"
              onClick={() => setIsScanModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: 'var(--text-accent-dark)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Update / Rescan
            </button>
          </div>
          <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
            <img src={patient.imageDataUrl} alt="Wound" style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      )}

      {/* Patient info */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '8px', padding: '0 2px' }}>
          Patient Profile
        </div>
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '20px',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
        }}>
          {[
            { label: 'Name', value: patient.name },
            { label: 'Age', value: `${patient.age} years` },
            { label: 'Gender', value: patient.gender },
            { label: 'Height', value: `${patient.heightCm} cm` },
            { label: 'Weight', value: `${patient.weightKg} kg` },
            { label: 'BMI', value: bmi },
            { label: 'Pediatric', value: patient.age < 18 ? 'Yes — special protocols apply' : 'No' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '13px 16px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                {row.label}
              </span>
              <span style={{
                fontSize: '13px',
                color: row.label === 'Pediatric' && patient.age < 18 ? '#b83355' : 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                textAlign: 'right',
                maxWidth: '60%',
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fluid schedule */}
      {patient.fluidMl !== undefined && (
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
              { phase: 'Phase 1', window: '0–8 hours', total: Math.round(patient.fluidMl * 0.5), rate: Math.round(patient.fluidMl * 0.5 / 8) },
              { phase: 'Phase 2', window: '8–24 hours', total: Math.round(patient.fluidMl * 0.5), rate: Math.round(patient.fluidMl * 0.5 / 16) },
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
                    Scan Burn Area
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
                    Capture or upload a clear photo of {patient.name}’s burn wound
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
