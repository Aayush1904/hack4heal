'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Eraser, Paintbrush, Trash2, Undo2 } from 'lucide-react';
import {
  FEMALE_PROFILE,
  MALE_PROFILE,
  REGION_IDS,
  buildRegionMap,
  detectFrontSign,
  measureBurn,
  selectPatchVertices,
  type RegionBurnStat,
  type RegionMap,
} from '@/lib/body-regions';
import {
  computeTbsa,
  depthHex,
  formatDepthLabel,
  regionLabel,
  type BurnDepth,
  type BurnRegionResult,
} from '@/lib/rule-of-nines';
import { DEBUG_BURN } from '@/lib/debug-burn';
import { BurnDebugPanel, regionDebugColor, type BurnDebugInfoView } from './BurnDebugPanel';

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

interface DebugFlags {
  overlay: boolean;
  points: boolean;
}

type OrbitControlsRef = React.MutableRefObject<React.ElementRef<typeof OrbitControls> | null>;

interface ViewApi {
  /** Turn the camera around the body to the given angle (0 = looking at +z). */
  setView: (azimuth: number) => void;
}

// The body is normalised to 2 units tall. The A-pose arms make it about 1.9 units wide.
const BODY_HEIGHT = 2;
const BODY_WIDTH = 1.9;
const FRAME_FILL = 0.94;

/**
 * Frames the body so it fills the view on any screen size, and handles rotating and zooming.
 * Painting pauses the controls while a stroke is in progress (see PaintableBody).
 */
const CameraRig: React.FC<{ controlsRef: OrbitControlsRef; viewRef: React.MutableRefObject<ViewApi | null> }> = ({
  controlsRef,
  viewRef,
}) => {
  const fov = useThree((s) => (s.camera as THREE.PerspectiveCamera).fov);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  const distance = useMemo(() => {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const aspect = width / Math.max(1, height);
    const forHeight = BODY_HEIGHT / FRAME_FILL / 2 / tanHalf;
    const forWidth = BODY_WIDTH / FRAME_FILL / 2 / (tanHalf * aspect);
    return Math.max(forHeight, forWidth);
  }, [fov, width, height]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Keep the current viewing angle if the user already turned the body, only fix the distance.
    const azimuth = controls.getAzimuthalAngle();
    controls.object.position.set(Math.sin(azimuth) * distance, 0, Math.cos(azimuth) * distance);
    controls.object.lookAt(0, 0, 0);
    controls.minDistance = distance * 0.45;
    controls.maxDistance = distance * 1.4;
    controls.update();
    invalidate();
  }, [controlsRef, distance, invalidate]);

  useEffect(() => {
    viewRef.current = {
      setView: (azimuth: number) => {
        const controls = controlsRef.current;
        if (!controls) return;
        const d = controls.getDistance();
        controls.object.position.set(Math.sin(azimuth) * d, 0, Math.cos(azimuth) * d);
        controls.object.lookAt(0, 0, 0);
        controls.update();
        invalidate();
      },
    };
    return () => {
      viewRef.current = null;
    };
  }, [controlsRef, viewRef, invalidate]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
      mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  );
};

interface PaintableBodyProps {
  controlsRef: OrbitControlsRef;
  url: string;
  brush: Brush;
  regions?: BurnRegionResult[];
  emittedKeyRef: React.MutableRefObject<string>;
  debug: DebugFlags;
  apiRef: React.MutableRefObject<PainterApi | null>;
  onReady: () => void;
  onHistoryChange: (depth: number) => void;
  onStats: (stats: RegionBurnStat[], userEdit: boolean, final: boolean) => void;
  onMapInfo: (info: { frontSign: 1 | -1; detectedFrontSign: 1 | -1; vertexCount: number }) => void;
}

const PaintableBody: React.FC<PaintableBodyProps> = ({
  controlsRef,
  url,
  brush,
  regions,
  emittedKeyRef,
  debug,
  apiRef,
  onReady,
  onHistoryChange,
  onStats,
  onMapInfo,
}) => {
  const { scene } = useGLTF(url);
  const invalidate = useThree((s) => s.invalidate);

  const brushRef = useRef(brush);
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  useEffect(() => {
    const restore = () => {
      if (controlsRef.current) controlsRef.current.enabled = true;
    };
    window.addEventListener('pointerup', restore);
    window.addEventListener('pointercancel', restore);
    window.addEventListener('blur', restore);
    return () => {
      window.removeEventListener('pointerup', restore);
      window.removeEventListener('pointercancel', restore);
      window.removeEventListener('blur', restore);
    };
  }, [controlsRef]);

  const meshRef = useRef<THREE.Mesh>(null);
  const appliedOrient = useRef<string | null>(null);
  const appliedRegions = useRef<string>('');

  const painting = useRef(false);
  const liveFrame = useRef(0);
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
    if (!g.attributes.normal) g.computeVertexNormals();
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

  const detectedFrontSign = useMemo(() => detectFrontSign(geometry.attributes.position.array), [geometry]);

  // Rule-of-Nines region id + region-local (u, v) for every vertex, in the patient's anatomical frame.
  const regionMap: RegionMap = useMemo(
    () =>
      buildRegionMap({
        positions: geometry.attributes.position.array,
        normals: geometry.attributes.normal.array,
        index: geometry.index?.array ?? null,
        profile: url === MODEL_URLS.Female ? FEMALE_PROFILE : MALE_PROFILE,
        frontSign: detectedFrontSign,
      }),
    [geometry, url, detectedFrontSign],
  );

  useEffect(() => {
    onMapInfo({ frontSign: regionMap.frontSign, detectedFrontSign, vertexCount: regionMap.vertexCount });
  }, [regionMap, detectedFrontSign, onMapInfo]);

  const overlayGeometry = useMemo(() => {
    if (!DEBUG_BURN) return null;
    const g = geometry.clone();
    const colors = new Float32Array(regionMap.vertexCount * 3);
    const c = new THREE.Color();
    for (let i = 0; i < regionMap.vertexCount; i++) {
      c.set(regionDebugColor(REGION_IDS[regionMap.regionIdx[i]]));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [geometry, regionMap]);

  useEffect(() => () => overlayGeometry?.dispose(), [overlayGeometry]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  const emitStats = useCallback(
    (userEdit: boolean, final = true) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const colors = (mesh.geometry.attributes.color as THREE.BufferAttribute).array;
      onStats(measureBurn(regionMap, colors, BASE_RGB), userEdit, final);
    },
    [regionMap, onStats],
  );

  const resetColors = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = BASE_RGB[0];
      arr[i + 1] = BASE_RGB[1];
      arr[i + 2] = BASE_RGB[2];
    }
    attr.needsUpdate = true;
  }, []);

  const pushHistory = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const arr = (mesh.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;
    history.current.push(arr.slice());
    if (history.current.length > MAX_UNDO) history.current.shift();
    onHistoryChange(history.current.length);
  }, [onHistoryChange]);

  /** Paint the vision-model result: each region gets a patch around its focal point sized to its coverage. */
  const shadeRegions = useCallback(
    (results: BurnRegionResult[]) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const attr = mesh.geometry.attributes.color as THREE.BufferAttribute;
      const out = attr.array as Float32Array;
      const tmp = new THREE.Color();

      for (const res of results) {
        if (res.unknown || res.coveragePct <= 0) continue;
        const r = REGION_IDS.indexOf(res.id as (typeof REGION_IDS)[number]);
        if (r < 0) continue;
        const patches = res.patches?.length
          ? res.patches
          : [{ coveragePct: res.coveragePct, center: res.center, spread: res.spread ?? { u: 0.5, v: 0.5 } }];
        tmp.set(depthHex(res.depth));
        for (const patch of patches) {
          if (patch.coveragePct <= 0) continue;
          const verts = selectPatchVertices(regionMap, r, { center: patch.center, spread: patch.spread }, patch.coveragePct / 100);
          for (const i of verts) {
            out[i * 3] = tmp.r;
            out[i * 3 + 1] = tmp.g;
            out[i * 3 + 2] = tmp.b;
          }
        }
      }
      attr.needsUpdate = true;
      invalidate();
    },
    [regionMap, invalidate],
  );

  useEffect(() => {
    if (!meshRef.current) return;
    const regionsKey = regions?.length ? JSON.stringify(regions) : '';
    const orientKey = `${regionMap.frontSign}|${regionMap.mirrorLR}`;

    const orientChanged = appliedOrient.current !== orientKey;
    const regionsChanged = appliedRegions.current !== regionsKey;
    if (!orientChanged && !regionsChanged) return;

    const isEcho = !orientChanged && regionsKey !== '' && regionsKey === emittedKeyRef.current;
    appliedOrient.current = orientKey;
    appliedRegions.current = regionsKey;
    if (isEcho) return;

    if (regions?.length) {
      pushHistory();
      resetColors();
      shadeRegions(regions);
    }
    invalidate();
    emitStats(false);
  }, [regions, regionMap, emittedKeyRef, pushHistory, resetColors, shadeRegions, emitStats, invalidate]);

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
        emitStats(true);
      },
      clear: () => {
        pushHistory();
        resetColors();
        invalidate();
        emitStats(true);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, invalidate, onHistoryChange, emitStats, pushHistory, resetColors]);

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
      if (!liveFrame.current) {
        liveFrame.current = requestAnimationFrame(() => {
          liveFrame.current = 0;
          emitStats(true, false);
        });
      }
    },
    [paintAt, emitStats],
  );

  useEffect(
    () => () => {
      if (liveFrame.current) cancelAnimationFrame(liveFrame.current);
    },
    [],
  );

  const endStroke = () => {
    if (controlsRef.current) controlsRef.current.enabled = true;
    const wasPainting = painting.current;
    painting.current = false;
    lastPoint.current = null;
    if (wasPainting) emitStats(true);
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!brushRef.current.paintMode || !e.face) return;
    e.stopPropagation();
    // A drag that starts on the body paints. A drag that starts anywhere else rotates the body.
    if (controlsRef.current) controlsRef.current.enabled = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    painting.current = true;
    lastPoint.current = null;
    pushHistory();
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

  // Debug markers: where the model said each burn is, projected onto the mesh.
  const markers = useMemo(() => {
    if (!DEBUG_BURN || !debug.points || !regions) return [];
    const pos = geometry.attributes.position;
    const list: Array<{ id: string; position: [number, number, number]; color: string }> = [];
    for (const res of regions) {
      if (res.unknown || res.coveragePct <= 0) continue;
      const r = REGION_IDS.indexOf(res.id as (typeof REGION_IDS)[number]);
      if (r < 0) continue;
      let best = -1;
      let bestD = Infinity;
      for (const i of regionMap.regionVerts[r]) {
        const du = regionMap.u[i] - res.center.u;
        const dv = regionMap.v[i] - res.center.v;
        const d = du * du + dv * dv;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) list.push({ id: res.id, position: [pos.getX(best), pos.getY(best), pos.getZ(best)], color: regionDebugColor(res.id) });
    }
    return list;
  }, [debug.points, regions, regionMap, geometry]);

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
      {DEBUG_BURN && overlayGeometry && debug.overlay && (
        <mesh geometry={overlayGeometry} raycast={() => null}>
          <meshBasicMaterial vertexColors transparent opacity={0.65} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {markers.map((m) => (
        <group key={m.id} position={m.position}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.03, 12, 10]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} />
          </mesh>
          <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                transform: 'translateY(-14px)',
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                padding: '1px 4px',
                borderRadius: '4px',
                color: '#fff',
                background: 'rgba(0,0,0,0.75)',
                borderLeft: `3px solid ${m.color}`,
              }}
            >
              {m.id}
            </div>
          </Html>
        </group>
      ))}
      <mesh ref={cursorRef} visible={false} raycast={() => null}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </>
  );
};

export interface BodyPaint3DProps {
  gender?: BodyGender;
  height?: number;
  /** Vision-model result used to pre-shade the body (re-applied whenever it changes). */
  regions?: BurnRegionResult[];
  ageYears?: number;
  /** Fired when the doctor edits the painting; regions are derived from what is painted. */
  onTbsaChange?: (tbsa: number, regions: BurnRegionResult[], final: boolean) => void;
  /** Temporary debug data (raw model output etc.), only shown when DEBUG_BURN is on. */
  debugInfo?: BurnDebugInfoView;
}

export const BodyPaint3D: React.FC<BodyPaint3DProps> = ({
  gender = 'Male',
  height = 440,
  regions,
  ageYears = 30,
  onTbsaChange,
  debugInfo,
}) => {
  const [radius, setRadius] = useState(0.09);
  const [erase, setErase] = useState(false);
  // Painting is always on. Rotating needs no mode: dragging the background (or two fingers) turns the body.
  const paintMode = true;
  const [ready, setReady] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const [stats, setStats] = useState<RegionBurnStat[] | null>(null);
  const [mapInfo, setMapInfo] = useState<{ frontSign: 1 | -1; detectedFrontSign: 1 | -1; vertexCount: number } | null>(null);
  const [debug, setDebug] = useState<DebugFlags>({ overlay: false, points: false });
  const apiRef = useRef<PainterApi | null>(null);
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls> | null>(null);
  const viewRef = useRef<ViewApi | null>(null);
  const emittedKeyRef = useRef('');

  const regionsRef = useRef(regions);
  useEffect(() => {
    regionsRef.current = regions;
  }, [regions]);
  const onTbsaChangeRef = useRef(onTbsaChange);
  useEffect(() => {
    onTbsaChangeRef.current = onTbsaChange;
  }, [onTbsaChange]);

  const brush = useMemo<Brush>(() => ({ color: BRUSH_COLOR, radius, erase, paintMode }), [radius, erase, paintMode]);
  const handleReady = useCallback(() => setReady(true), []);

  const handleStats = useCallback(
    (next: RegionBurnStat[], userEdit: boolean, final: boolean) => {
      if (final) setStats(next);
      if (!userEdit) return;
      const prior = new Map((regionsRef.current ?? []).map((r) => [r.id, r]));
      const derived: BurnRegionResult[] = next.map((s) => {
        const before = prior.get(s.id);
        if (s.fraction >= 0.005) {
          const depth: BurnDepth = before && before.depth !== 'unknown' ? before.depth : 'partial';
          return {
            id: s.id,
            coveragePct: Math.round(s.fraction * 1000) / 10,
            depth,
            center: { u: s.centroidU, v: s.centroidV },
            spread: { u: s.spreadU, v: s.spreadV },
            visiblePct: 100,
          };
        }
        if (before?.unknown) return before;
        return {
          id: s.id,
          coveragePct: 0,
          depth: 'unknown',
          center: { u: 0.5, v: 0.5 },
          visiblePct: before?.visiblePct ?? 100,
        };
      });
      emittedKeyRef.current = JSON.stringify(derived);
      onTbsaChangeRef.current?.(computeTbsa(derived, ageYears), derived, final);
    },
    [ageYears],
  );

  const regionLegend = useMemo(() => {
    if (!regions?.length) return [];
    return regions
      .filter((r) => !r.unknown && r.coveragePct > 0)
      .map((r) => `${regionLabel(r.id)} ${Math.round(r.coveragePct)}% · ${formatDepthLabel(r.depth)}`);
  }, [regions]);

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
          style={{ touchAction: 'none', cursor: 'crosshair' }}
        >
          <hemisphereLight args={['#ffffff', '#d9c2b8', 1.1]} />
          <directionalLight position={[3, 4, 5]} intensity={1.6} />
          <directionalLight position={[-4, 2, -4]} intensity={0.7} />
          <Suspense fallback={null}>
            <PaintableBody
              key={gender}
              controlsRef={controlsRef}
              url={MODEL_URLS[gender]}
              brush={brush}
              regions={regions}
              emittedKeyRef={emittedKeyRef}
              debug={debug}
              apiRef={apiRef}
              onReady={handleReady}
              onHistoryChange={setUndoDepth}
              onStats={handleStats}
              onMapInfo={setMapInfo}
            />
          </Suspense>
          <CameraRig controlsRef={controlsRef} viewRef={viewRef} />
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

        <div style={{ position: 'absolute', top: '8px', right: '10px', display: 'flex', gap: '6px' }}>
          {([
            { id: 'body-view-front-btn', label: 'Front', angle: 0 },
            { id: 'body-view-back-btn', label: 'Back', angle: Math.PI },
          ] as const).map((v) => (
            <button
              key={v.id}
              id={v.id}
              onClick={() => viewRef.current?.setView(mapInfo?.frontSign === -1 ? v.angle + Math.PI : v.angle)}
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '12px', lineHeight: 1.4, fontFamily: 'var(--font-editorial)', color: 'var(--text-tertiary)' }}>
          Drag on the body to paint. Drag outside it, or use two fingers, to rotate and zoom.
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            id="body-paint-mode-btn"
            onClick={() => {
              setErase(false);
            }}
            style={{ ...toolBtn(!erase), flex: 1, justifyContent: 'center' }}
          >
            <Paintbrush size={14} /> Paint
          </button>
          <button
            id="body-paint-eraser-btn"
            onClick={() => {
              setErase(true);
            }}
            style={{ ...toolBtn(erase), flex: 1, justifyContent: 'center' }}
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

        {regionLegend.length > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--border-light)',
              paddingTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              Pre-shaded regions (Rule of Nines)
            </div>
            {regionLegend.map((line) => (
              <div key={line} style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-editorial)' }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {DEBUG_BURN && (
          <BurnDebugPanel
            regions={regions}
            stats={stats}
            ageYears={ageYears}
            info={debugInfo}
            mapInfo={mapInfo}
            flags={debug}
            onFlagsChange={(patch) => setDebug((d) => ({ ...d, ...patch }))}
          />
        )}
      </div>
    </div>
  );
};

export default BodyPaint3D;
