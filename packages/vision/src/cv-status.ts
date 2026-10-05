/**
 * Failure-state detection for the `cv_status` channel.
 * Spec: doc 04 "Failure-state signals". Emitted on change and at most every 250 ms.
 * Luminance is one scalar from a 32x18 downsample discarded in the worker; no pixels leave.
 */

import type { CvStatus } from "@grasp/types";
import type { GestureState } from "./gesture-fsm";

export type CvStatusInput = {
  readonly cameraReady: boolean;
  readonly landmarkerReady: boolean;
  /** Hands that passed the presence floor this frame (0, 1, 2). */
  readonly handCount: number;
  /** Primary hand box width as a fraction of frame width, or null if no hand. */
  readonly primaryBoxFrac: number | null;
  /** Mean presence confidence over the LOW_CONFIDENCE_WINDOW_MS window. */
  readonly presenceMean: number;
  /** Detection on/off flips within the same window. */
  readonly flickerCount: number;
  /** 0..255 mean of the downsampled frame, or null if not sampled. */
  readonly luminance: number | null;
  readonly fsmState: GestureState;
};

/**
 * Compute the current `CvStatus` from the frame summary. Pure with respect to its
 * inputs apart from `nowMs` and the previous status, which supply `sinceMs` and rate-limiting.
 */
export function computeCvStatus(
  input: CvStatusInput,
  previous: CvStatus | null,
  nowMs: number,
): CvStatus | null {
  void input;
  void previous;
  void nowMs;
  throw new Error("TODO Phase D: computeCvStatus (doc 04, M4)");
}
