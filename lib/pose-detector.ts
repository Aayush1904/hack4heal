import type { PoseLandmarker } from '@mediapipe/tasks-vision';

let loading: Promise<PoseLandmarker> | null = null;

/**
 * Loads the body-pose model once and reuses it. The files are served from /mediapipe, so nothing
 * is fetched from another site. Runs on the device. The camera image is never uploaded for this.
 */
export function loadPoseDetector(): Promise<PoseLandmarker> {
  if (!loading) {
    loading = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const create = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        return await create('GPU');
      } catch {
        return await create('CPU');
      }
    })().catch((error) => {
      loading = null; // allow a retry next time the camera opens
      throw error;
    });
  }
  return loading;
}
