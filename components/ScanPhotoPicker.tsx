'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { compressDataUrl, fileToCompressedDataUrl } from '@/lib/image-utils';

export const MAX_SCAN_IMAGES = 6;

interface ScanPhotoPickerProps {
  images: string[];
  onChange: (images: string[]) => void;
  onAnalyze: (images: string[]) => void;
  idPrefix: string;
  analyzeLabel?: string;
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
}) => {
  const [useCamera, setUseCamera] = useState(false);
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
        <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', marginBottom: '16px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '280px', objectFit: 'cover', backgroundColor: '#000', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--btn-accent)', borderRadius: '20px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px' }}>
            <button
              id={`${idPrefix}-capture-btn`}
              onClick={capture}
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
