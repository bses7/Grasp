/**
 * Self-hosted MediaPipe asset paths (docs/15 "Dependency pinning"). The version is part of the
 * path so the immutable cache headers in infrastructure/vercel.json are safe across bumps.
 * `scripts/assets/sync-public.ts` fails if this does not match the installed @mediapipe/tasks-vision.
 */
export const MEDIAPIPE_VERSION = "1.0.1";
export const MEDIAPIPE_BASE_URL = `/mediapipe/${MEDIAPIPE_VERSION}`;
export const MEDIAPIPE_WASM_URL = `${MEDIAPIPE_BASE_URL}/wasm`;
export const HAND_LANDMARKER_TASK_URL = `${MEDIAPIPE_BASE_URL}/hand_landmarker.task`;
/** Pinned model build; the `/1/` segment is the model version, independent of the npm version. */
export const HAND_LANDMARKER_TASK_SOURCE =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
export const DRACO_DECODER_URL = "/draco/";
