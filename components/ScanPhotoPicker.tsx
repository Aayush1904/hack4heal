'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compressDataUrl, fileToCompressedDataUrl } from '@/lib/image-utils';
import { HOLD_MS, NO_PERSON_HINT, buildBodyGuide, evaluateAlignment, type BodyProfile } from '@/lib/body-guide';
import { loadPoseDetector } from '@/lib/pose-detector';
import { BodyGuideOverlay } from './BodyGuideOverlay';

export const MAX_SCAN_IMAGES = 6;

interface ScanPhotoPickerProps {
  images: string[];
  onChange: (images: string[]) => void;
  onAnalyze: (images: string[]) => void;
  idPrefix: string;
  analyzeLabel?: string;
  /** Used to draw a body outline that matches the patient. */
  profile?: BodyProfile;
}

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '15px',
  borderRadius: '16px',
  backgroundColor: 'var(--text-primary)',
  color: 'var(--bg-primary)',
  border: 'none',
  fontFamily: 'var(--font-display)',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
  letterSpacing: '-0.01em',
};

const secondaryBtn: React.CSSProperties = {
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
};

export const ScanPhotoPicker: React.FC<ScanPhotoPickerProps> = ({
  images,
  onChange,
  onAnalyze,
  idPrefix,
  analyzeLabel = 'Analyze Burn →',
  profile = { gender: 'Other' },
}) => {
  const [useCamera, setUseCamera] = useState(false);
  // 'body' shows the body outline and takes the photo by itself when the patient fits it.
  const [mode, setMode] = useState<'body' | 'closeup'>('body');
  const [videoAspect, setVideoAspect] = useState(3 / 4);
  const [guide, setGuide] = useState<{ state: 'loading' | 'ready' | 'unavailable'; aligned: boolean; hint: string; progress: number }>({
    state: 'loading',
    aligned: false,
    hint: '',
    progress: 0,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setUseCamera(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setGuide({ state: 'loading', aligned: false, hint: '', progress: 0 });
    void loadPoseDetector().catch(() => undefined); // warm up while the camera opens
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setUseCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 100);
    } catch {
      alert('Camera not accessible. Please upload photos instead.');
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = await compressDataUrl(canvas.toDataURL('image/jpeg', 0.9));
    onChange([...images, dataUrl].slice(0, MAX_SCAN_IMAGES));
    stopCamera();
  };

  const bodyGuide = useMemo(
    () => buildBodyGuide({ gender: profile.gender, heightCm: profile.heightCm, weightKg: profile.weightKg, ageYears: profile.ageYears }),
    [profile.gender, profile.heightCm, profile.weightKg, profile.ageYears],
  );

  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  });

  // While the camera is open in full-body mode: look for the patient, and take the photo once they
  // have fitted the outline and held still.
  useEffect(() => {
    if (!useCamera || mode !== 'body') return;
    let stopped = false;
    let frame = 0;
    let lastRun = 0;
    let alignedSince: number | null = null;

    (async () => {
      let detector;
      try {
        detector = await loadPoseDetector();
      } catch {
        if (!stopped) setGuide({ state: 'unavailable', aligned: false, hint: '', progress: 0 });
        return;
      }
      if (stopped) return;
      setGuide((g) => ({ ...g, state: 'ready', hint: NO_PERSON_HINT }));

      const tick = (now: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        if (now - lastRun < 120) return; // about 8 checks a second is plenty
        lastRun = now;

        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth) return;
        const result = detector.detectForVideo(video, performance.now());
        const verdict = evaluateAlignment(result.landmarks[0], video.videoWidth / video.videoHeight, bodyGuide.targets);

        let progress = 0;
        if (verdict.aligned) {
          alignedSince ??= now;
          progress = Math.min(1, (now - alignedSince) / HOLD_MS);
        } else {
          alignedSince = null;
        }

        const rounded = Math.round(progress * 10) / 10;
        setGuide((g) =>
          g.aligned === verdict.aligned && g.hint === verdict.hint && g.progress === rounded
            ? g
            : { state: 'ready', aligned: verdict.aligned, hint: verdict.hint, progress: rounded },
        );

        if (progress >= 1) {
          stopped = true;
          void captureRef.current();
        }
      };
      frame = requestAnimationFrame(tick);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [useCamera, mode, bodyGuide]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_SCAN_IMAGES - images.length);
    e.target.value = '';
    if (files.length === 0) return;
    const added = await Promise.all(files.map(fileToCompressedDataUrl));
    onChange([...images, ...added].slice(0, MAX_SCAN_IMAGES));
  };

  const canAddMore = images.length < MAX_SCAN_IMAGES;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFiles}
        id={`${idPrefix}-file-input`}
      />

      {useCamera ? (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {([
              { id: 'body', label: 'Full body' },
              { id: 'closeup', label: 'Close-up' },
            ] as const).map((m) => (
              <button
                key={m.id}
                id={`${idPrefix}-mode-${m.id}`}
                onClick={() => setMode(m.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  border: `1px solid ${mode === m.id ? 'var(--border-active)' : 'var(--border-medium)'}`,
                  backgroundColor: mode === m.id ? 'var(--text-primary)' : 'var(--bg-surface)',
                  color: mode === m.id ? 'var(--bg-primary)' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: `${videoAspect}`, borderRadius: '20px', overflow: 'hidden', backgroundColor: '#000' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            {mode === 'body' && <BodyGuideOverlay guide={bodyGuide} aligned={guide.aligned} progress={guide.progress} />}

            {mode === 'body' && (
              <div
                id={`${idPrefix}-guide-hint`}
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  right: '10px',
                  textAlign: 'center',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  backgroundColor: guide.aligned ? 'rgba(22,163,74,0.9)' : 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  transition: 'background-color 0.2s ease',
                }}
              >
                {guide.state === 'loading' && 'Starting body detection...'}
                {guide.state === 'unavailable' && 'Auto-capture is not available. Line the patient up and tap the white button.'}
                {guide.state === 'ready' && (guide.hint || NO_PERSON_HINT)}
              </div>
            )}

            <div style={{ position: 'absolute', inset: 0, border: `2px solid ${guide.aligned && mode === 'body' ? '#22c55e' : 'var(--btn-accent)'}`, borderRadius: '20px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px' }}>
              <button
                id={`${idPrefix}-capture-btn`}
                onClick={capture}
                aria-label="Take photo"
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
                onClick={stopCamera}
                aria-label="Close camera"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  alignSelf: 'center',
                }}
              >
                ✕
              </button>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          {mode === 'body' && (
            <div id={`${idPrefix}-outline-caption`} style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)' }}>
              {bodyGuide.label ? `Outline drawn for: ${bodyGuide.label}` : 'Outline drawn for an average adult'}
            </div>
          )}
        </div>
      ) : images.length > 0 ? (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {images.map((src, i) => (
              <div key={i} style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', aspectRatio: '1 / 1', border: '1px solid var(--border-light)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Burn photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span
                  style={{
                    position: 'absolute',
                    left: '6px',
                    bottom: '6px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    color: '#fff',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '6px',
                    padding: '1px 6px',
                  }}
                >
                  #{i + 1}
                </span>
                <button
                  onClick={() => onChange(images.filter((_, k) => k !== i))}
                  aria-label={`Remove photo ${i + 1}`}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-tertiary)', marginTop: '8px' }}>
            {images.length} / {MAX_SCAN_IMAGES} photos · different angles or body parts are all merged into one assessment
          </div>
        </div>
      ) : (
        <div
          style={{
            borderRadius: '20px',
            border: '2px dashed var(--border-medium)',
            padding: '36px 20px',
            textAlign: 'center',
            marginBottom: '16px',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ fontSize: '38px', marginBottom: '8px' }}>📷</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>No photos yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-editorial)', marginTop: '4px' }}>
            Add one or several photos — full body or just the burned area
          </div>
        </div>
      )}

      {!useCamera && canAddMore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
          <button id={`${idPrefix}-open-camera-btn`} onClick={startCamera} style={images.length ? secondaryBtn : primaryBtn}>
            📷&ensp;{images.length ? 'Take Another Photo' : 'Open Camera'}
          </button>
          <button id={`${idPrefix}-upload-btn`} onClick={() => fileInputRef.current?.click()} style={secondaryBtn}>
            📁&ensp;{images.length ? 'Upload More Photos' : 'Upload Photos'}
          </button>
        </div>
      )}

      {!useCamera && images.length > 0 && (
        <button id={`${idPrefix}-analyze-btn`} onClick={() => onAnalyze(images)} style={{ ...primaryBtn, padding: '16px', fontSize: '15px', marginBottom: '10px' }}>
          {analyzeLabel.replace('{n}', String(images.length))}
        </button>
      )}
    </>
  );
};

export default ScanPhotoPicker;
