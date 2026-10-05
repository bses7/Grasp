/**
 * Failure-state detection for the `cv_status` channel.
 * Spec: doc 04 "Failure-state signals". Emitted on change and at most every 250 ms.
 * Luminance is one scalar from a 32x18 downsample discarded in the pipeline; no pixels leave.
 * `initialising` and `no_camera` are emitted by the main thread before a pipeline exists.
 */

import type { CvHint, CvState, CvStatus } from "@grasp/types";
import { VISION_CONSTANTS as V } from "./constants";
import type { GestureState } from "./gesture-fsm";

export type CvStatusInput = {
  /** Hands that passed the presence floor this frame (0, 1, 2). */
  readonly handCount: number;
  /** Primary hand box width as a fraction of frame width, or null if no hand. */
  readonly primaryBoxFrac: number | null;
  /** Presence confidence of the primary hand this frame, 0 when there is none. */
  readonly presence: number;
  /** 0..255 mean of the downsampled frame, or null if not sampled. */
  readonly luminance: number | null;
  readonly fsmState: GestureState;
};

export class CvStatusTracker {
  private window: { t: number; presence: number; present: boolean }[] = [];
  private candidate: CvState | null = null;
  private candidateSince = 0;
  private state: CvState = "initialising";
  private stateSince = 0;
  private multiHandSince: number | null = null;
  private emitted: { state: CvState; hint: CvHint | undefined } | null = null;
  private emittedAt = -Infinity;

  /** Feed one frame; returns a `cv_status` to post, or null when nothing changed or it is too soon. */
  update(input: CvStatusInput, now: number): CvStatus | null {
    this.window.push({ t: now, presence: input.presence, present: input.handCount > 0 });
    while (this.window[0]!.t < now - V.LOW_CONFIDENCE_WINDOW_MS) this.window.shift();
    const presenceMean = this.window.reduce((s, w) => s + w.presence, 0) / this.window.length;
    let flicker = 0;
    for (let i = 1; i < this.window.length; i++) if (this.window[i]!.present !== this.window[i - 1]!.present) flicker++;
    const lum = input.luminance;
    const badLight = lum !== null && (lum < V.LUMINANCE_MIN || lum > V.LUMINANCE_MAX);

    const raw: CvState =
      input.fsmState === "LOST"
        ? "tracking_lost"
        : badLight && flicker >= V.LOW_CONFIDENCE_FLICKER_COUNT
          ? "low_confidence"
          : input.handCount === 0
            ? "no_hand"
            : input.primaryBoxFrac !== null && input.primaryBoxFrac < V.HAND_BOX_MIN_FRAC
              ? "hand_too_far"
              : input.primaryBoxFrac !== null && input.primaryBoxFrac > V.HAND_BOX_MAX_FRAC
                ? "hand_too_close"
                : badLight && presenceMean < V.LOW_CONFIDENCE_MEAN
                  ? "low_confidence"
                  : "ok";

    // Persistence: a new state must hold for its duration before it replaces the current one.
    if (raw !== this.candidate) {
      this.candidate = raw;
      this.candidateSince = now;
    }
    const need =
      raw === "no_hand" ? V.NO_HAND_TIMEOUT_MS : raw === "hand_too_far" || raw === "hand_too_close" ? V.DISTANCE_PERSIST_MS : 0;
    if (raw !== this.state && now - this.candidateSince >= need) {
      this.state = raw;
      this.stateSince = now;
    }

    this.multiHandSince = input.handCount > 1 ? (this.multiHandSince ?? now) : null;
    const hint: CvHint | undefined =
      this.state === "hand_too_far"
        ? "move_closer"
        : this.state === "hand_too_close"
          ? "move_back"
          : this.state === "low_confidence"
            ? "face_the_light"
            : this.state === "ok" && this.multiHandSince !== null && now - this.multiHandSince >= V.MULTI_HAND_HINT_MS
              ? "show_one_hand"
              : undefined;

    if (this.emitted?.state === this.state && this.emitted.hint === hint) return null;
    if (now - this.emittedAt < V.CV_STATUS_MIN_INTERVAL_MS) return null;
    this.emitted = { state: this.state, hint };
    this.emittedAt = now;
    return {
      type: "cv_status",
      state: this.state,
      sinceMs: Math.round(now - this.stateSince),
      ...(hint && { hint }),
      ...(lum !== null && { luminance: Math.round(lum) }),
    };
  }
}
