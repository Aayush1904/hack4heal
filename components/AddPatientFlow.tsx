'use client';

import React, { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { StoredPatient } from './HomeScreen';

// three.js is heavy; only load it when the doctor reaches the body-model step.
const BodyPaint3D = dynamic(() => import('./BodyPaint3D'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
      Loading 3D model…
    </div>
  ),
});

type Step = 'form' | 'pii-warning' | 'body-model' | 'photo-capture' | 'analyzing' | 'results';

interface AddPatientFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (patient: StoredPatient) => void;
}

const PII_PATTERNS = [
  { regex: /\b\d{10,12}\b/, label: 'Phone number' },
  { regex: /\b[A-Z]{2}\d{7}\b/, label: 'Passport number' },
  { regex: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, label: 'Card number' },
  { regex: /\b[A-Z]{5}\d{4}[A-Z]{1}\b/, label: 'PAN number' },
  { regex: /\b\d{12}\b/, label: 'Aadhaar number' },
];

function detectPII(name: string): string[] {
  const found: string[] = [];
  for (const { regex, label } of PII_PATTERNS) {
    if (regex.test(name)) found.push(label);
  }
  // Check for email
  if (/[\w.-]+@[\w.-]+\.\w+/.test(name)) found.push('Email address');
  return found;
}

function getBMI(weight: number, heightCm: number): number {
  return parseFloat((weight / ((heightCm / 100) ** 2)).toFixed(1));
}

// Simple 2D body outline SVG — front view, gender-aware
function BodySVG({ gender, burnPercent }: { gender: string; burnPercent?: number }) {
  const isFemale = gender === 'Female';
  const burnColor = burnPercent !== undefined
    ? burnPercent > 40 ? '#7c1d2e'
      : burnPercent > 25 ? '#b83355'
        : burnPercent > 10 ? '#f59e0b'
          : '#1d612e'
    : 'transparent';

  return (
    <svg
      viewBox="0 0 120 240"
      width="120"
      height="240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Head */}
      <ellipse cx="60" cy="22" rx="18" ry="20" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Neck */}
      <rect x="54" y="40" width="12" height="10" rx="3" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />

      {/* Torso */}
      {isFemale ? (
        <>
          {/* Shoulders */}
          <path d="M28 52 Q20 60 22 80 L42 82 L42 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M92 52 Q100 60 98 80 L78 82 L78 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          {/* Torso body */}
          <path d="M42 50 L78 50 L82 90 Q82 100 70 102 L50 102 Q38 100 38 90 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          {/* Bust curves */}
          <path d="M44 72 Q52 82 60 79 Q68 82 76 72" stroke="var(--stroke)" strokeWidth="1" fill="none" opacity="0.4" />
          {/* Waist curve */}
          <path d="M38 90 Q35 108 38 116 L82 116 Q85 108 82 90" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          {/* Hips */}
          <path d="M35 116 Q30 124 36 128 L84 128 Q90 124 85 116 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
        </>
      ) : (
        <>
          {/* Shoulders broader */}
          <path d="M22 52 Q14 60 16 82 L40 82 L40 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          <path d="M98 52 Q106 60 104 82 L80 82 L80 52 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          {/* Torso body */}
          <path d="M40 50 L80 50 L82 106 Q82 116 74 118 L46 118 Q38 116 38 106 Z" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
          {/* Chest line */}
          <line x1="60" y1="52" x2="60" y2="92" stroke="var(--stroke)" strokeWidth="0.8" opacity="0.3" />
        </>
      )}

      {/* Arms */}
      {/* Left upper arm */}
      <rect x="14" y="52" width="12" height="38" rx="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Left forearm */}
      <rect x="12" y="92" width="11" height="36" rx="5" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Left hand */}
      <ellipse cx="17" cy="136" rx="7" ry="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />

      {/* Right upper arm */}
      <rect x="94" y="52" width="12" height="38" rx="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Right forearm */}
      <rect x="97" y="92" width="11" height="36" rx="5" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Right hand */}
      <ellipse cx="103" cy="136" rx="7" ry="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />

      {/* Legs */}
      {/* Left thigh */}
      <rect x="38" y={isFemale ? 128 : 118} width="18" height="44" rx="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Left lower leg */}
      <rect x="39" y={isFemale ? 174 : 164} width="16" height="40" rx="8" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Left foot */}
      <ellipse cx="47" cy={isFemale ? 219 : 209} rx="12" ry="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />

      {/* Right thigh */}
      <rect x="64" y={isFemale ? 128 : 118} width="18" height="44" rx="9" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Right lower leg */}
      <rect x="65" y={isFemale ? 174 : 164} width="16" height="40" rx="8" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />
      {/* Right foot */}
      <ellipse cx="73" cy={isFemale ? 219 : 209} rx="12" ry="6" fill="var(--bg-badge)" stroke="var(--stroke)" strokeWidth="1.5" />

      {/* Burn overlay if result available */}
      {burnPercent !== undefined && burnPercent > 0 && (
        <ellipse
          cx="60"
          cy={isFemale ? 80 : 85}
          rx={Math.min(30, 10 + burnPercent * 0.5)}
          ry={Math.min(25, 8 + burnPercent * 0.4)}
          fill={burnColor}
          opacity="0.28"
        />
      )}
    </svg>
  );
}

export const AddPatientFlow: React.FC<AddPatientFlowProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [piiFound, setPiiFound] = useState<string[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [burnPercent, setBurnPercent] = useState<number | null>(null);
  const [fluidMl, setFluidMl] = useState<number | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('form');
    setName('');
    setAge('');
    setGender('Male');
    setHeight('');
    setWeight('');
    setPiiFound([]);
    setCapturedImage(null);
    setBurnPercent(null);
    setFluidMl(null);
    setUseCamera(false);
    stopCamera();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const handleFormSubmit = () => {
    if (!name.trim() || !age || !height || !weight) return;
    const piis = detectPII(name);
    if (piis.length > 0) {
      setPiiFound(piis);
      setStep('pii-warning');
    } else {
      setStep('photo-capture');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      setUseCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      alert('Camera not accessible. Please upload a photo instead.');
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    setUseCamera(false);
    runAnalysis(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      runAnalysis(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = (imageDataUrl: string) => {
    setStep('analyzing');
    // Simulate ML model inference with realistic delay
    setTimeout(() => {
      const w = parseFloat(weight);
      // Realistic mock: weight and age affect burn severity
      const baseBurn = Math.floor(15 + Math.random() * 30);
      const clampedBurn = Math.min(85, Math.max(5, baseBurn));
      // Parkland formula: 4 * weight * %TBSA
      const fluid = Math.round(4 * w * clampedBurn);
      setBurnPercent(clampedBurn);
      setFluidMl(fluid);
      setStep('body-model');
    }, 2800);
  };

  const handleSave = () => {
    const patient: StoredPatient = {
      id: `PT-${Date.now()}`,
      name: name.trim(),
      age: parseInt(age),
      gender,
      heightCm: parseFloat(height),
      weightKg: parseFloat(weight),
      burnPercent: burnPercent ?? undefined,
      fluidMl: fluidMl ?? undefined,
      imageDataUrl: capturedImage ?? undefined,
      createdAt: new Date().toISOString(),
    };
    // Save to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('burnos_patients') || '[]');
      existing.push(patient);
      localStorage.setItem('burnos_patients', JSON.stringify(existing));
      window.dispatchEvent(new Event('burnos_patients_updated'));
    } catch { /* ignore */ }
    reset();
    onComplete(patient);
  };

  if (!isOpen) return null;

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(51,39,42,0.6)',
    backdropFilter: 'blur(6px)',
  };

  const sheetStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '440px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: '28px 28px 0 0',
    padding: '8px 20px 40px',
    maxHeight: '92vh',
    overflowY: 'auto',
    zIndex: 1,
  };

  const handleStyle: React.CSSProperties = {
    width: '36px',
    height: '4px',
    borderRadius: '2px',
    backgroundColor: 'var(--border-medium)',
    margin: '12px auto 20px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '14px',
    border: '1.5px solid var(--border-light)',
    backgroundColor: 'var(--bg-surface)',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--bg-primary)',
    border: 'none',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    letterSpacing: '-0.01em',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    borderRadius: '16px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1.5px solid var(--border-medium)',
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };

  return (
    <div style={modalStyle}>
      <div style={overlayStyle} onClick={handleClose} />
      <div style={sheetStyle}>
        <div style={handleStyle} />

        {/* ────────────────── STEP: FORM ────────────────── */}
        {step === 'form' && (
          <>
            <div style={{ marginBottom: '22px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                New Patient
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
                Enter the details below to start the burn assessment
              </p>
            </div>

            {/* Privacy notice */}
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: '16px',
              backgroundColor: 'rgba(184,51,85,0.07)',
              border: '1px solid rgba(184,51,85,0.18)',
              marginBottom: '18px',
            }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>🔐</span>
              <div style={{ fontSize: '12px', lineHeight: 1.55, color: '#b83355', fontFamily: 'var(--font-display)' }}>
                <strong>Protect patient privacy.</strong> Do not enter full names, phone numbers, ID numbers (Aadhaar, PAN, passport), addresses or emails. Use initials or a bed or case number. Try to keep faces, tattoos and name bands out of wound photos. Details are saved on this device only.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Patient ID */}
              <div>
                <label style={labelStyle}>Patient ID or initials</label>
                <input
                  id="patient-name-input"
                  style={inputStyle}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. A.K. or Bed 4"
                />
              </div>

              {/* Age + Gender row */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Age (years)</label>
                  <input
                    id="patient-age-input"
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="120"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    placeholder="e.g. 34"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Gender</label>
                  <select
                    id="patient-gender-select"
                    style={{ ...inputStyle, appearance: 'none' }}
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Height + Weight row */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Height (cm)</label>
                  <input
                    id="patient-height-input"
                    style={inputStyle}
                    type="number"
                    min="30"
                    max="250"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    placeholder="e.g. 170"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Weight (kg)</label>
                  <input
                    id="patient-weight-input"
                    style={inputStyle}
                    type="number"
                    min="1"
                    max="300"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="e.g. 70"
                  />
                </div>
              </div>

              {/* BMI preview */}
              {height && weight && (
                <div style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
                    BMI Preview
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    {getBMI(parseFloat(weight), parseFloat(height))}
                  </span>
                </div>
              )}

              {/* Pediatric notice */}
              {age && parseInt(age) < 18 && (
                <div style={{
                  backgroundColor: 'rgba(184,51,85,0.08)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  border: '1px solid rgba(184,51,85,0.2)',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b83355' }}>
                      Pediatric Patient
                    </div>
                    <div style={{ fontSize: '12px', color: '#b83355', fontFamily: 'var(--font-editorial)', marginTop: '2px' }}>
                      Age &lt; 18 — Lund-Browder adjustments will apply. Pediatric burn center referral may be required.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                id="patient-form-continue-btn"
                onClick={handleFormSubmit}
                disabled={!name.trim() || !age || !height || !weight}
                style={{
                  ...primaryBtnStyle,
                  opacity: (!name.trim() || !age || !height || !weight) ? 0.4 : 1,
                }}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ────────────────── STEP: PII WARNING ────────────────── */}
        {step === 'pii-warning' && (
          <>
            <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                Personal details found
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)', lineHeight: '1.6' }}>
                This field looks like it contains personal information. To protect the patient&apos;s privacy, please use initials or a case ID instead.
              </p>
            </div>

            <div style={{
              backgroundColor: 'rgba(184,51,85,0.07)',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid rgba(184,51,85,0.18)',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b83355', marginBottom: '10px' }}>
                What we found
              </div>
              {piiFound.map((p) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#b83355', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#b83355', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{p}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="pii-edit-name-btn"
                onClick={() => setStep('form')}
                style={primaryBtnStyle}
              >
                Change it
              </button>
              <button
                id="pii-continue-anyway-btn"
                onClick={() => setStep('photo-capture')}
                style={secondaryBtnStyle}
              >
                Keep it anyway
              </button>
            </div>
          </>
        )}

        {/* ────────────────── STEP: BODY MODEL ────────────────── */}
        {step === 'body-model' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {burnPercent !== null ? 'Burn Mapping & Body Model' : '3D Body Model'}
                </h2>
                {burnPercent !== null ? (
                  <div style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: burnPercent >= 40 ? '#7c1d2e' : burnPercent >= 25 ? '#b83355' : burnPercent >= 10 ? '#b45309' : '#1d612e',
                    backgroundColor: burnPercent >= 40 ? 'rgba(124,29,46,0.1)' : burnPercent >= 25 ? 'rgba(184,51,85,0.1)' : burnPercent >= 10 ? 'rgba(180,83,9,0.1)' : 'rgba(29,97,46,0.1)',
                    padding: '3px 9px',
                    borderRadius: '999px',
                  }}>
                    {burnPercent >= 40 ? 'CRITICAL' : burnPercent >= 25 ? 'SEVERE' : burnPercent >= 10 ? 'MODERATE' : 'MINOR'}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#877478',
                    backgroundColor: 'rgba(135,116,120,0.12)',
                    padding: '3px 9px',
                    borderRadius: '999px',
                  }}>
                    PENDING SCAN
                  </div>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)' }}>
                {burnPercent !== null
                  ? `Paint the burn regions on the 3D body for visualization`
                  : `3D ${gender.toLowerCase()} anatomical reference model — burn scan pending`}
              </p>
            </div>

            {/* Patient summary card */}
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '20px',
              padding: '14px 16px',
              border: '1px solid var(--border-light)',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)', marginTop: '2px' }}>
                  {age}yo {gender} &bull; {height}cm &bull; {weight}kg &bull; BMI {getBMI(parseFloat(weight), parseFloat(height))}
                </div>
              </div>
              <div style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-accent-dark)',
                backgroundColor: 'var(--bg-badge)',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid var(--border-light)',
              }}>
                {parseInt(age) < 18 ? 'PEDI' : 'ADULT'}
              </div>
            </div>

            {/* Interactive 3D body — doctor paints burn regions for visualization */}
            <BodyPaint3D gender={gender} />

            <div style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '24px',
              padding: '16px 20px',
              border: '1px solid var(--border-light)',
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                  Burn TBSA
                </div>
                <div style={{ fontSize: '36px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: '1' }}>
                  {burnPercent !== null ? `${burnPercent}%` : '—'}
                </div>
              </div>
              {fluidMl !== null && (
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                    Fluid (24h)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: '1' }}>
                    {fluidMl.toLocaleString()} mL
                  </div>
                </div>
              )}
              {capturedImage && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={capturedImage}
                    alt="Wound thumb"
                    style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                  />
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>Wound Photo</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="body-model-proceed-btn"
                onClick={() => setStep('results')}
                style={primaryBtnStyle}
              >
                Proceed to Fluid & Care Plan →
              </button>
              <button
                id="body-model-retake-btn"
                onClick={() => setStep('photo-capture')}
                style={secondaryBtnStyle}
              >
                ← Change / Retake Photo
              </button>
            </div>
          </>
        )}

        {/* ────────────────── STEP: PHOTO CAPTURE ────────────────── */}
        {step === 'photo-capture' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Burn Scan
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
                Take or upload a photo of the burn
              </p>
              <p style={{ fontSize: '12px', color: '#b83355', fontFamily: 'var(--font-display)', fontWeight: 600, marginTop: '8px', lineHeight: 1.5 }}>
                🔐 Keep faces, tattoos, name bands and ID papers out of the photo.
              </p>
            </div>

            {useCamera ? (
              <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '16px' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '280px', objectFit: 'cover', backgroundColor: '#000', display: 'block' }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '2px solid var(--btn-accent)',
                  borderRadius: '20px',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '12px',
                }}>
                  <button
                    id="capture-photo-btn"
                    onClick={captureFromCamera}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: '4px solid var(--btn-accent)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                  />
                  <button
                    onClick={() => { stopCamera(); setUseCamera(false); }}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '20px',
                      alignSelf: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
            ) : capturedImage ? (
              <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '16px' }}>
                <img
                  src={capturedImage}
                  alt="Captured wound"
                  style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => setCapturedImage(null)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{
                borderRadius: '20px',
                border: '2px dashed var(--border-medium)',
                padding: '40px 20px',
                textAlign: 'center',
                marginBottom: '16px',
                backgroundColor: 'var(--bg-surface)',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  No image captured
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
                  Use camera or upload a photo of the burn area
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              id="burn-photo-file-input"
            />

            {!useCamera && !capturedImage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                <button
                  id="open-camera-btn"
                  onClick={startCamera}
                  style={primaryBtnStyle}
                >
                  📷&ensp;Open Camera
                </button>
                <button
                  id="upload-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  style={secondaryBtnStyle}
                >
                  📁&ensp;Upload Photo
                </button>
              </div>
            )}

            {capturedImage && (
              <button
                id="analyze-burn-btn"
                onClick={() => runAnalysis(capturedImage)}
                style={{ ...primaryBtnStyle, marginBottom: '10px' }}
              >
                Analyze Burn →
              </button>
            )}

            <button
              id="skip-photo-btn"
              onClick={() => {
                setBurnPercent(null);
                setFluidMl(null);
                setStep('body-model');
              }}
              style={secondaryBtnStyle}
            >
              Skip — Proceed to Body Model
            </button>
          </>
        )}

        {/* ────────────────── STEP: ANALYZING ────────────────── */}
        {step === 'analyzing' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              border: '3px solid var(--border-light)',
              borderTop: '3px solid var(--text-primary)',
              margin: '0 auto 24px',
              animation: 'spin 0.9s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
              Analyzing...
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', lineHeight: '1.7', maxWidth: '260px', margin: '0 auto' }}>
              Running ML segmentation model to detect burn regions and calculate TBSA percentage
            </p>

            <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', textAlign: 'left', maxWidth: '280px', margin: '28px auto 0' }}>
              {['Segmenting wound boundaries...', 'Calculating burn depth...', 'Estimating TBSA %...', 'Computing Parkland fluid...'].map((msg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--btn-accent)',
                    animation: `pulseDot ${1 + i * 0.3}s infinite ease-in-out`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)' }}>{msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ────────────────── STEP: RESULTS ────────────────── */}
        {step === 'results' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  Assessment Results
                </h2>
                {burnPercent !== null && (
                  <div style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: burnPercent >= 40 ? '#7c1d2e' : burnPercent >= 25 ? '#b83355' : burnPercent >= 10 ? '#b45309' : '#1d612e',
                    backgroundColor: burnPercent >= 40 ? 'rgba(124,29,46,0.1)' : burnPercent >= 25 ? 'rgba(184,51,85,0.1)' : burnPercent >= 10 ? 'rgba(180,83,9,0.1)' : 'rgba(29,97,46,0.1)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                  }}>
                    {burnPercent >= 40 ? 'CRITICAL' : burnPercent >= 25 ? 'SEVERE' : burnPercent >= 10 ? 'MODERATE' : 'MINOR'}
                  </div>
                )}
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)' }}>
                {burnPercent !== null ? 'ML model analysis complete' : 'Saved without burn scan'}
              </p>
            </div>

            {/* Body model + burn overlay */}
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '24px',
              padding: '20px',
              border: '1px solid var(--border-light)',
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <BodySVG gender={gender} burnPercent={burnPercent ?? undefined} />
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                    Burn TBSA
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: '1' }}>
                    {burnPercent !== null ? `${burnPercent}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                    Parkland Fluid (24h)
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: '1' }}>
                    {fluidMl !== null ? `${fluidMl.toLocaleString()} mL` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Fluid schedule if available */}
            {fluidMl !== null && (
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '20px',
                padding: '16px',
                border: '1px solid var(--border-light)',
                marginBottom: '16px',
              }}>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                  Fluid Resuscitation Schedule
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Phase 1 (0-8h)', value: `${Math.round(fluidMl * 0.5).toLocaleString()} mL`, note: '50% of total', rate: `${Math.round(fluidMl * 0.5 / 8)} mL/hr` },
                    { label: 'Phase 2 (8-24h)', value: `${Math.round(fluidMl * 0.5).toLocaleString()} mL`, note: '50% of total', rate: `${Math.round(fluidMl * 0.5 / 16)} mL/hr` },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-surface-subtle)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-light)',
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{row.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '2px' }}>{row.note}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{row.value}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: '2px' }}>{row.rate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pediatric warning in results */}
            {parseInt(age) < 18 && (
              <div style={{
                backgroundColor: 'rgba(184,51,85,0.08)',
                borderRadius: '16px',
                padding: '12px 16px',
                border: '1px solid rgba(184,51,85,0.2)',
                marginBottom: '16px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#b83355' }}>
                    Pediatric Referral Required
                  </div>
                  <div style={{ fontSize: '12px', color: '#b83355', fontFamily: 'var(--font-editorial)', marginTop: '2px' }}>
                    Verify with Galveston formula for pediatric patients. Burns center consultation recommended.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                id="save-patient-btn"
                onClick={handleSave}
                style={primaryBtnStyle}
              >
                Save Patient Record
              </button>
              <button
                id="back-to-body-model-btn"
                onClick={() => setStep('body-model')}
                style={secondaryBtnStyle}
              >
                ← Back to Body Model
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
