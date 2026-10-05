/**
 * Web Worker entry: HandLandmarker inference, One-Euro smoothing, gesture FSM, cv_status.
 * Protocol: doc 04 "Interaction-event contract" and mediapipe-hands skill section 10.
 * Created by apps/web with `new Worker(new URL("@grasp/vision/worker", import.meta.url), { type: "module" })`.
 * Never import this file on the main thread; import its types via `@grasp/vision` instead.
 */

import type { CvStatus, HoverResult, InteractionEvent } from "@grasp/types";

declare const self: DedicatedWorkerGlobalScope;

/** Sent once. URLs must be same-origin (`/mediapipe/`), pinned version (doc 16). */
export type InitMessage = {
  readonly type: "init";
  readonly wasmBaseUrl: string;
  readonly modelAssetPath: string;
  readonly numHands?: 1 | 2;
  readonly delegate?: "GPU" | "CPU";
};

/** One camera frame; the bitmap is transferred, never copied, and closed after inference. */
export type FrameMessage = {
  readonly type: "frame";
  readonly bitmap: ImageBitmap;
  /** Monotonic ms, same clock as `performance.now()` on the main thread. */
  readonly t: number;
};

/** Main-thread reply for the grabbable-under-cursor rule. The worker learns nothing else about the scene. */
export type HoverResultMessage = HoverResult;

export type WorkerInbound = InitMessage | FrameMessage | HoverResultMessage;

/** Interaction events and cv_status share one outbound channel; consumers switch on `type`. */
export type WorkerOutbound = InteractionEvent | CvStatus;

function post(message: WorkerOutbound): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerInbound>): void => {
  const message = event.data;
  if (message.type === "init") {
    post({ type: "cv_status", state: "initialising", sinceMs: 0 });
    throw new Error("TODO Phase D: worker init and HandLandmarker.createFromOptions (doc 04, M4)");
  }
  if (message.type === "frame") {
    throw new Error("TODO Phase D: worker onFrame (doc 04, M4)");
  }
  if (message.type === "hover_result") {
    throw new Error("TODO Phase D: worker hover_result forwarding to GestureFsm (doc 04, M4)");
  }
};
