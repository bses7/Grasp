/**
 * Web Worker entry: HandLandmarker inference, One-Euro smoothing, gesture FSM, cv_status.
 * Protocol: doc 04 "Interaction-event contract" and mediapipe-hands skill section 10.
 * Created by worker-client.ts; never import this file on the main thread (it assigns `self.onmessage`).
 * Bitmaps arrive transferred, are used for one inference, and are closed; landmarks never leave.
 */

import type { CvStatus, HoverResult, InteractionEvent } from "@grasp/types";
import type { GestureFeatures } from "../gesture-fsm";
import type { HandLandmarks } from "../landmarks";
import type { LandmarkerDelegate } from "../landmarker";
import { VisionPipeline } from "../pipeline";

declare const self: DedicatedWorkerGlobalScope;

/** Sent once. Asset URLs are the pinned same-origin constants in assets.ts. */
export type InitMessage = {
  readonly type: "init";
  /** Developer fixture recorder (doc 17 M3): also post per-frame features. Never set in a study build. */
  readonly debugFeatures?: boolean;
  /** Also post each frame's landmarks for the on-screen preview overlay (display only, never logged). */
  readonly showHands?: boolean;
  /** Fist turn and two-hand gestures (outside the study only). */
  readonly extraGestures?: boolean;
};

/** One camera frame; the bitmap is transferred, never copied, and closed after inference. */
export type FrameMessage = {
  readonly type: "frame";
  readonly bitmap: ImageBitmap;
  /** Main-thread `performance.now()` at the video frame callback; strictly increasing. */
  readonly t: number;
};

/** Main-thread reply for the grabbable-under-cursor rule. The worker learns nothing else about the scene. */
export type HoverResultMessage = HoverResult;

export type WorkerInbound = InitMessage | FrameMessage | HoverResultMessage;

/** Worker plumbing, consumed by worker-client.ts and not forwarded to the scene. */
export type WorkerControl =
  | { readonly type: "ready"; readonly delegate: LandmarkerDelegate }
  | { readonly type: "error"; readonly message: string }
  /** One per frame message, after its events; releases the client's one-frame-in-flight slot. */
  | { readonly type: "frame_done"; readonly t: number; readonly inferenceMs: number; readonly jitter: number | null }
  | { readonly type: "features"; readonly t: number; readonly f: GestureFeatures | null }
  | { readonly type: "hands"; readonly hands: HandLandmarks[] };

export type WorkerOutbound = InteractionEvent | CvStatus | WorkerControl;

function post(message: WorkerOutbound): void {
  self.postMessage(message);
}

let pipeline: VisionPipeline | null = null;
let debugFeatures = false;
let showHands = false;

self.onmessage = async (event: MessageEvent<WorkerInbound>): Promise<void> => {
  const message = event.data;
  if (message.type === "init") {
    debugFeatures = message.debugFeatures ?? false;
    showHands = message.showHands ?? false;
    try {
      pipeline = await VisionPipeline.create(message.extraGestures ?? false);
      post({ type: "ready", delegate: pipeline.delegate });
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (message.type === "frame") {
    const { bitmap, t } = message;
    let inferenceMs = 0;
    let jitter: number | null = null;
    try {
      if (!pipeline) return;
      const out = pipeline.process(bitmap, t);
      for (const m of out.messages) post(m);
      if (debugFeatures) post({ type: "features", t, f: out.features });
      if (showHands) post({ type: "hands", hands: out.hands });
      ({ inferenceMs, jitter } = out);
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      bitmap.close();
      post({ type: "frame_done", t, inferenceMs, jitter });
    }
    return;
  }
  if (message.type === "hover_result") pipeline?.onHoverResult(message);
};
