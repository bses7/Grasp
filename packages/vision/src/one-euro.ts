/**
 * One-Euro filter for one scalar channel (one landmark coordinate, or one cursor axis).
 * Reference: mediapipe-hands skill section 7; parameters in doc 04 "Smoothing".
 * Pure class; unit-tested at M2 with recorded feature fixtures (no landmarks persisted).
 */

import { VISION_CONSTANTS, type OneEuroParams } from "./constants";

export class OneEuroFilter {
  readonly params: OneEuroParams;

  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(params: OneEuroParams = VISION_CONSTANTS.ONE_EURO_LANDMARKS) {
    this.params = params;
  }

  /**
   * Filter one sample.
   * @param x raw value in normalized units
   * @param t timestamp in ms (monotonic; same clock as HandLandmarker timestamps)
   */
  filter(x: number, t: number): number {
    void x;
    void t;
    void this.xPrev;
    void this.dxPrev;
    void this.tPrev;
    throw new Error("TODO Phase D: OneEuroFilter.filter (doc 04, M2)");
  }

  /** Forget history, for example when the primary hand switches or tracking is regained. */
  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}
