/**
 * @grasp/vision public surface. Imports only @grasp/types and @mediapipe/tasks-vision.
 * The worker entry is NOT re-exported as a value (it would run `self.onmessage` on the main thread);
 * create it via `new Worker(new URL("@grasp/vision/worker", import.meta.url), { type: "module" })`.
 */

export { VISION_CONSTANTS, type OneEuroParams } from "./constants";
export {
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_URL,
  HAND_LANDMARKER_TASK_URL,
  DRACO_DECODER_URL,
} from "./assets";
export { openCamera, stopCamera } from "./capture";
export {
  createHandLandmarker,
  drawHands,
  type HandLandmarker,
  type HandLandmarkerResult,
  type LandmarkerDelegate,
  type NormalizedLandmark,
} from "./landmarker";
export {
  Landmark,
  handSize,
  pinchDist,
  fingerExtended,
  extendedCount,
  palmCenter,
  pinchMidpoint,
  cursorFor,
  type Point3,
  type HandLandmarks,
  type Finger,
} from "./landmarks";
export { OneEuroFilter, LandmarkSmoother } from "./one-euro";
export { JitterMeter } from "./jitter";
export { GestureFsm, type GestureState, type GestureCandidate, type GestureFeatures } from "./gesture-fsm";
export { computeCvStatus, type CvStatusInput } from "./cv-status";
export {
  createVisionWorker,
  supportsOffscreenCanvas,
  type VisionWorkerHandle,
  type VisionWorkerOptions,
  type VisionInferencePath,
} from "./worker-client";
export { createMouseAdapter, type MouseAdapterHandle } from "./mouse-adapter";
export {
  thresholdCalibration,
  calibrationTutorial,
  type MvpGesture,
  type CalibrationPrompt,
  type ThresholdCalibrationResult,
  type ThresholdCalibrationSample,
} from "./calibration";
export type {
  InitMessage,
  FrameMessage,
  HoverResultMessage,
  WorkerInbound,
  WorkerOutbound,
} from "./worker/hand-landmarker.worker";
