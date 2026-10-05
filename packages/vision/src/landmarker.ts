/**
 * HandLandmarker setup (mediapipe-hands section 2). Assets come from this origin only (assets.ts).
 * Runs inside the vision worker, or on the main thread in the fallback path (pipeline.ts).
 */
import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { HAND_LANDMARKER_TASK_URL, MEDIAPIPE_WASM_URL } from "./assets";
import { VISION_CONSTANTS } from "./constants";

export type LandmarkerDelegate = "GPU" | "CPU";
export type { HandLandmarker, HandLandmarkerResult, NormalizedLandmark };

/**
 * Create a VIDEO-mode landmarker on the GPU delegate, falling back to CPU if GPU init throws.
 * The returned delegate is what actually initialised, so the caller can report it.
 */
export async function createHandLandmarker(): Promise<{
  landmarker: HandLandmarker;
  delegate: LandmarkerDelegate;
}> {
  // Classic loader in both places: Turbopack emits the vision worker as a classic script (importScripts works).
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  const create = (delegate: LandmarkerDelegate) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_LANDMARKER_TASK_URL, delegate },
      runningMode: "VIDEO",
      numHands: VISION_CONSTANTS.NUM_HANDS,
      minHandDetectionConfidence: VISION_CONSTANTS.PRESENCE_FLOOR,
      minHandPresenceConfidence: VISION_CONSTANTS.PRESENCE_FLOOR,
      minTrackingConfidence: VISION_CONSTANTS.PRESENCE_FLOOR,
    });
  try {
    return { landmarker: await create("GPU"), delegate: "GPU" };
  } catch (err) {
    console.warn("HandLandmarker GPU delegate failed, falling back to CPU", err);
    return { landmarker: await create("CPU"), delegate: "CPU" };
  }
}

/** Debug overlay: 21 landmarks and bones per hand, in unmirrored image space (mirror the canvas with CSS). */
export function drawHands(ctx: CanvasRenderingContext2D, hands: readonly NormalizedLandmark[][]): void {
  const draw = new DrawingUtils(ctx);
  for (const hand of hands) {
    draw.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color: "#4fd1c5", lineWidth: 3 });
    draw.drawLandmarks(hand, { color: "#f6e05e", radius: 3 });
  }
}
