'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Eraser, Paintbrush, Rotate3d, Trash2, Undo2 } from 'lucide-react';

const MODEL_URLS = {
  Male: '/human_body_adult.glb',
  Female: '/female_body_base_mesh.glb',
  Other: '/human_body_adult.glb',
} as const;

export type BodyGender = keyof typeof MODEL_URLS;
const SKIN_COLOR = '#e9d8cf';
const MAX_UNDO = 15;

const BASE_COLOR = new THREE.Color(SKIN_COLOR);
const BASE_RGB = [BASE_COLOR.r, BASE_COLOR.g, BASE_COLOR.b] as const;

const BRUSH_COLOR = '#dc2626';

interface Brush {
  color: string;
  radius: number;
  erase: boolean;
  paintMode: boolean;
}

interface PainterApi {
  undo: () => void;
  clear: () => void;
}

interface PaintableBodyProps {
  url: string;
  brush: Brush;
  apiRef: React.MutableRefObject<PainterApi | null>;
  onReady: () => void;
  onHistoryChange: (depth: number) => void;
}

const PaintableBody: React.FC<PaintableBodyProps> = ({ url, brush, apiRef, onReady, onHistoryChange }) => {
  const { scene } = useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);

  const brushRef = useRef(brush);
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  const meshRef = useRef<THREE.Mesh>(null);

  const painting = useRef(false);
  const lastPoint = useRef<THREE.Vector3 | null>(null);
  const history = useRef<Float32Array[]>([]);
  const cursorRef = useRef<THREE.Mesh>(null);

  // Bake the glTF node transforms into the geometry, normalise it to a 2-unit-tall body
  // centred on the origin, and attach a per-vertex colour attribute to paint into.
  const geometry = useMemo(() => {
    scene.updateMatrixWorld(true);
    let source: THREE.Mesh | undefined;
    scene.traverse((o) => {
      if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh;
    });
    if (!source) throw new Error(`${url} contains no mesh`);

    const g = source.geometry.clone();
    g.applyMatrix4(source.matrixWorld);
    g.deleteAttribute('uv');
    g.computeBoundingBox();
    const size = g.boundingBox!.getSize(new THREE.Vector3());
    const center = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-center.x, -center.y, -center.z);
    const s = 2 / size.y;
    g.scale(s, s, s);
    g.computeBoundingBox();
    g.computeBoundingSphere();

    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = BASE_RGB[0];
      colors[i + 1] = BASE_RGB[1];
      colors[i + 2] = BASE_RGB[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [scene, url]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const colorAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    apiRef.current = {
      undo: () => {
        const prev = history.current.pop();
        if (!prev) return;
        (colorAttr.array as Float32Array).set(prev);
        colorAttr.needsUpdate = true;
        onHistoryChange(history.current.length);
        invalidate();
      },
      clear: () => {
        const arr = colorAttr.array as Float32Array;
        history.current.push(arr.slice());
        if (history.current.length > MAX_UNDO) history.current.shift();
        for (let i = 0; i < arr.length; i += 3) {
          arr[i] = BASE_RGB[0];
          arr[i + 1] = BASE_RGB[1];
          arr[i + 2] = BASE_RGB[2];
        }
        colorAttr.needsUpdate = true;
        onHistoryChange(history.current.length);
        invalidate();
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, invalidate, onHistoryChange]);

  // Keep the hover/brush cursor in sync with brush settings.
  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    cursor.scale.setScalar(brush.radius);
    (cursor.material as THREE.MeshBasicMaterial).color.set(brush.erase ? '#ffffff' : brush.color);
    invalidate();
  }, [brush.radius, brush.color, brush.erase, invalidate]);

  const paintAt = useCallback(
    (point: THREE.Vector3, normal: THREE.Vector3) => {
      const { color, radius, erase } = brushRef.current;
      const mesh = meshRef.current;
      if (!mesh) return;
      const attrs = mesh.geometry.attributes;
      const pos = attrs.position as THREE.BufferAttribute;
      const nor = attrs.normal as THREE.BufferAttribute;
      const col = attrs.color as THREE.BufferAttribute;
      const out = col.array as Float32Array;

      const target = erase ? BASE_COLOR : new THREE.Color(color);
      const r2 = radius * radius;
      const px = point.x, py = point.y, pz = point.z;

      for (let i = 0; i < pos.count; i++) {
        const dx = pos.getX(i) - px;
        const dy = pos.getY(i) - py;
        const dz = pos.getZ(i) - pz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        // Skip surfaces facing away from the stroke so paint doesn't bleed through thin limbs.
        if (nor.getX(i) * normal.x + nor.getY(i) * normal.y + nor.getZ(i) * normal.z < 0.2) continue;

        const a = Math.min(1, (1 - Math.sqrt(d2) / radius) * 2.2);
        const o = i * 3;
        out[o] += (target.r - out[o]) * a;
        out[o + 1] += (target.g - out[o + 1]) * a;
        out[o + 2] += (target.b - out[o + 2]) * a;
      }
      col.needsUpdate = true;
      invalidate();
    },
    [invalidate],
  );

  // Fill in the gap between two pointer samples so fast strokes stay continuous.
  const paintStroke = useCallback(
    (point: THREE.Vector3, normal: THREE.Vector3) => {
      const last = lastPoint.current;
      if (last) {
        const dist = last.distanceTo(point);
        const step = brushRef.current.radius * 0.4;
        const n = Math.min(20, Math.floor(dist / step));
        const tmp = new THREE.Vector3();
        for (let k = 1; k <= n; k++) paintAt(tmp.lerpVectors(last, point, k / (n + 1)), normal);
      }
      paintAt(point, normal);
      lastPoint.current = point.clone();
    },
    [paintAt],
  );

  const endStroke = () => {
    painting.current = false;
    lastPoint.current = null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!brushRef.current.paintMode || !e.face) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    painting.current = true;
    lastPoint.current = null;

    const arr = (meshRef.current!.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    history.current.push(arr.slice());
    if (history.current.length > MAX_UNDO) history.current.shift();
    onHistoryChange(history.current.length);

    paintStroke(e.point, e.face.normal);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const cursor = cursorRef.current;
    if (cursor) {
      cursor.visible = brushRef.current.paintMode;
      cursor.position.copy(e.point);
      invalidate();
    }
    if (painting.current && e.face) paintStroke(e.point, e.face.normal);
  };

  const onPointerOut = () => {
    if (cursorRef.current) {
      cursorRef.current.visible = false;
      invalidate();
    }
  };

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerOut={onPointerOut}
      >
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0} />
      </mesh>
      <mesh ref={cursorRef} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </>
  );
};

export const BodyPaint3D: React.FC<{ gender?: BodyGender; height?: number }> = ({ gender = 'Male', height = 380 }) => {
  const [radius, setRadius] = useState(0.09);
  const [erase, setErase] = useState(false);
  const [paintMode, setPaintMode] = useState(true);
  const [ready, setReady] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const apiRef = useRef<PainterApi | null>(null);

  const brush = useMemo<Brush>(() => ({ color: BRUSH_COLOR, radius, erase, paintMode }), [radius, erase, paintMode]);
  const handleReady = useCallback(() => setReady(true), []);

  const toolBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '999px',
    border: `1px solid ${active ? 'var(--border-active)' : 'var(--border-medium)'}`,
    backgroundColor: active ? 'var(--text-primary)' : 'var(--bg-surface)',
    color: active ? 'var(--bg-surface)' : 'var(--text-primary)',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '24px',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        marginBottom: '16px',
      }}
    >
      <div style={{ position: 'relative', height: `${height}px`, backgroundColor: 'var(--bg-surface-subtle)' }}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: [0, 0, 4.4], fov: 35 }}
          style={{ touchAction: 'none', cursor: paintMode ? 'crosshair' : 'grab' }}
        >
          <hemisphereLight args={['#ffffff', '#d9c2b8', 1.1]} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} />
          <directionalLight position={[-4, 2, -4]} intensity={0.7} />
          <Suspense fallback={null}>
            <PaintableBody key={gender} url={MODEL_URLS[gender]} brush={brush} apiRef={apiRef} onReady={handleReady} onHistoryChange={setUndoDepth} />
          </Suspense>
          <OrbitControls enabled={!paintMode} enablePan={false} minDistance={2.5} maxDistance={7} />
        </Canvas>

        {!ready && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 800,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          >
            Loading 3D model…
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '12px',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        >
          {paintMode ? 'Drag on body to paint' : 'Drag to rotate · pinch to zoom'}
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="body-paint-mode-btn"
            onClick={() => {
              setPaintMode(true);
              setErase(false);
            }}
            style={{ ...toolBtn(paintMode && !erase), flex: 1, justifyContent: 'center' }}
          >
            <Paintbrush size={14} /> Paint
          </button>
          <button
            id="body-rotate-mode-btn"
            onClick={() => setPaintMode(false)}
            style={{ ...toolBtn(!paintMode), flex: 1, justifyContent: 'center' }}
          >
            <Rotate3d size={14} /> Rotate
          </button>
          <button
            id="body-paint-eraser-btn"
            onClick={() => {
              setPaintMode(true);
              setErase(true);
            }}
            style={{ ...toolBtn(paintMode && erase), flex: 1, justifyContent: 'center' }}
          >
            <Eraser size={14} /> Erase
          </button>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Brush
          <input
            type="range"
            min={0.04}
            max={0.2}
            step={0.01}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--text-primary)' }}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="body-paint-undo-btn"
            onClick={() => apiRef.current?.undo()}
            disabled={undoDepth === 0}
            style={toolBtn(false, undoDepth === 0)}
          >
            <Undo2 size={14} /> Undo
          </button>
          <button id="body-paint-clear-btn" onClick={() => apiRef.current?.clear()} style={toolBtn(false)}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodyPaint3D;
