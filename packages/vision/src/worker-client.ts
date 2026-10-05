/**
 * Main-thread side of the worker protocol: camera capture, bitmap transfer, event delivery.
 * Spec: doc 04 "Inference placement: Web Worker"; M4 in doc 17 adds the alternate-frame
 * main-thread fallback when the worker GPU path (OffscreenCanvas) is unavailable.
 */

import type { HoverResult } from "@grasp/types";
import type { InitMessage, WorkerOutbound } from "./worker/hand-landmarker.worker";

export type VisionInferencePath = "worker" | "main_thread_fallback";

export type VisionWorkerHandle = {
  readonly path: VisionInferencePath;
  /** Transfer one frame; the caller must not reuse the bitmap afterwards. */
  postFrame(bitmap: ImageBitmap, t: number): void;
  /** Reply to the most recent cursor with what the raycaster found. */
  postHoverResult(result: HoverResult): void;
  terminate(): void;
};

export type VisionWorkerOptions = Omit<InitMessage, "type">;

/**
 * Create the worker (or the fallback) and route every outbound message to `onEvent`.
 * `onEvent` receives both `InteractionEvent` and `CvStatus`; switch on `type`.
 */
export function createVisionWorker(
  onEvent: (message: WorkerOutbound) => void,
  options: VisionWorkerOptions,
): VisionWorkerHandle {
  void onEvent;
  void options;
  throw new Error("TODO Phase D: createVisionWorker (doc 04, M4)");
}

/** True when the GPU delegate can run inside a worker (Chrome, Edge); false forces the fallback. */
export function supportsOffscreenCanvas(): boolean {
  throw new Error("TODO Phase D: supportsOffscreenCanvas (doc 04, M4)");
}
