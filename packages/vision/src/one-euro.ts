/**
 * One-Euro filter for one scalar channel (one landmark coordinate, or one cursor axis).
 * Reference: mediapipe-hands skill section 7; parameters in doc 04 "Smoothing".
 * Pure class; unit-tested at M2 with recorded feature fixtures (no landmarks persisted).
 */

import { VISION_CONSTANTS, type OneEuroParams } from "./constants";
import type { Point3 } from "./landmarks";

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
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = t;
      return x;
    }
    const dt = (t - this.tPrev) / 1000;
    if (dt <= 0) return this.xPrev; // repeated timestamp: no new information
    const { minCutoff, beta, dCutoff } = this.params;
    const dx = (x - this.xPrev) / dt;
    this.dxPrev += alpha(dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = minCutoff + beta * Math.abs(this.dxPrev);
    this.xPrev += alpha(cutoff, dt) * (x - this.xPrev);
    this.tPrev = t;
    return this.xPrev;
  }

  /** Forget history, for example when the primary hand switches or tracking is regained. */
  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

/** Low-pass smoothing factor for a cutoff frequency (Hz) and sample interval (s). */
function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** One OneEuroFilter per coordinate of the 21 landmarks of one hand (63 channels). */
export class LandmarkSmoother {
  private readonly filters: OneEuroFilter[];

  constructor(params: OneEuroParams = VISION_CONSTANTS.ONE_EURO_LANDMARKS) {
    this.filters = Array.from({ length: 63 }, () => new OneEuroFilter(params));
  }

  /** Smoothed copy of `hand`; extra fields (e.g. MediaPipe's `visibility`) are kept. */
  filter<T extends Point3>(hand: readonly T[], t: number): T[] {
    return hand.map((p, i) => ({
      ...p,
      x: this.filters[i * 3]!.filter(p.x, t),
      y: this.filters[i * 3 + 1]!.filter(p.y, t),
      z: this.filters[i * 3 + 2]!.filter(p.z, t),
    }));
  }

  reset(): void {
    for (const f of this.filters) f.reset();
  }
}
