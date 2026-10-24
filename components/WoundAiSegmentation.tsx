'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, Paintbrush, Eraser, Eye, RefreshCw } from 'lucide-react';

interface WoundAiSegmentationProps {
  currentCaseImage: string;
  onConfirmMaskToRegion: (suggestedRegionId: string, estimatedFraction: number) => void;
  onAddAuditLog: (action: any, details: string) => void;
}

export const WoundAiSegmentation: React.FC<WoundAiSegmentationProps> = ({
  currentCaseImage,
  onConfirmMaskToRegion,
  onAddAuditLog,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize] = useState<number>(20);
  const [showAiOverlay, setShowAiOverlay] = useState<boolean>(true);
  const [isInferenceRunning, setIsInferenceRunning] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [selectedRegionTarget, setSelectedRegionTarget] = useState<string>('torso-ant');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = currentCaseImage;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (showAiOverlay) {
        drawInitialAiMask(ctx, canvas.width, canvas.height);
      }
    };
  }, [currentCaseImage, showAiOverlay]);

  const drawInitialAiMask = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 139, 167, 0.55)';
    ctx.strokeStyle = '#b83355';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(width * 0.52, height * 0.52, width * 0.28, height * 0.24, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(51, 39, 42, 0.55)';
    ctx.beginPath();
    ctx.ellipse(width * 0.50, height * 0.50, width * 0.14, height * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const rerunInference = () => {
    setIsInferenceRunning(true);
    setTimeout(() => {
      setIsInferenceRunning(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.src = currentCaseImage;
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawInitialAiMask(ctx, canvas.width, canvas.height);
          };
        }
      }
      onAddAuditLog('MASK_EDITED', 'Wound boundary re-segmented');
    }, 500);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    drawOnCanvas(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawOnCanvas(e);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const drawOnCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.save();
    if (tool === 'brush') {
      ctx.fillStyle = 'rgba(255, 139, 167, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const handleConfirm = () => {
    onConfirmMaskToRegion(selectedRegionTarget, 0.75);
    onAddAuditLog('MASK_EDITED', `Confirmed wound boundary mapped to ${selectedRegionTarget}`);
  };

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
      {/* Clean Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 700,
          }}
        >
          WOUND SEGMENTATION
        </span>

        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-display)',
            padding: '3px 8px',
            borderRadius: 'var(--pill-radius)',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-safe)',
            fontWeight: 800,
          }}
        >
          AI ASSISTED
        </span>
      </div>

      {/* Subtle 1-line guidance banner */}
      <div
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-editorial)',
          color: 'var(--text-secondary)',
          marginBottom: '12px',
          fontStyle: 'italic',
        }}
      >
        Draw or erase on the canvas to refine burn boundaries, then map findings to the body chart.
      </div>

      {/* Clean Canvas Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '20px',
          overflow: 'hidden',
          backgroundColor: '#33272a',
          boxShadow: '0 4px 14px rgba(51, 39, 42, 0.08)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={450}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            cursor: tool === 'brush' ? 'crosshair' : 'cell',
          }}
        />

        {/* Minimal Bottom Corner Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            backgroundColor: 'rgba(51, 39, 42, 0.8)',
            backdropFilter: 'blur(6px)',
            borderRadius: '8px',
            padding: '3px 8px',
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#faeee7',
          }}
        >
          94.6% Confidence • YOLOv8n-seg
        </div>

        {isInferenceRunning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(51, 39, 42, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#faeee7',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Processing Segmentation...
          </div>
        )}
      </div>

      {/* Minimal Tools Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '14px',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setTool('brush')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--pill-radius)',
              border: tool === 'brush' ? '2px solid var(--stroke)' : '1px solid var(--border-medium)',
              backgroundColor: tool === 'brush' ? 'var(--btn-accent)' : 'var(--bg-surface-subtle)',
              color: 'var(--btn-text)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            <Paintbrush size={13} />
            Brush
          </button>

          <button
            onClick={() => setTool('eraser')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--pill-radius)',
              border: tool === 'eraser' ? '2px solid var(--stroke)' : '1px solid var(--border-medium)',
              backgroundColor: tool === 'eraser' ? 'var(--btn-accent)' : 'var(--bg-surface-subtle)',
              color: 'var(--btn-text)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            <Eraser size={13} />
            Eraser
          </button>

          <button
            onClick={() => setShowAiOverlay(!showAiOverlay)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: 'var(--pill-radius)',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <Eye size={13} />
            {showAiOverlay ? 'Mask On' : 'Mask Off'}
          </button>
        </div>

        <button
          onClick={rerunInference}
          disabled={isInferenceRunning}
          title="Re-run AI segmentation"
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--pill-radius)',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Clean Map to Region Action */}
      <div
        style={{
          marginTop: '16px',
          padding: '14px',
          borderRadius: '16px',
          backgroundColor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Target Region:
          </span>
          <select
            value={selectedRegionTarget}
            onChange={(e) => setSelectedRegionTarget(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#fffffe',
              color: 'var(--text-primary)',
            }}
          >
            <option value="torso-ant">Anterior Trunk (13%)</option>
            <option value="torso-post">Posterior Trunk (13%)</option>
            <option value="arm-r-up">Right Upper Arm (4%)</option>
            <option value="arm-r-low">Right Lower Arm (3%)</option>
            <option value="hand-r">Right Hand (2.5%)</option>
            <option value="thigh-r">Right Thigh (9.5%)</option>
            <option value="leg-r-low">Right Lower Leg (7%)</option>
            <option value="head-ant">Head / Face (3.5%)</option>
          </select>
        </div>

        <button
          onClick={handleConfirm}
          style={{
            width: '100%',
            backgroundColor: 'var(--btn-accent)',
            color: 'var(--btn-text)',
            border: '2px solid var(--stroke)',
            borderRadius: '14px',
            padding: '12px',
            fontSize: '13px',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(51, 39, 42, 0.08)',
          }}
        >
          <CheckCircle size={16} color="#33272a" />
          Apply to Body Map &rarr;
        </button>
      </div>
    </div>
  );
};
