/**
 * Smoothed landmarks -> GestureFeatures for the FSM (doc 04 "Gesture detection pseudocode" steps 1-2).
 * Owns the 63 landmark filters and the cursor filters, so one instance per tracked hand.
 * Used on the main thread at M3 and inside the worker from M4.
 */
import { VISION_CONSTANTS, type OneEuroParams } from "./constants";
import type { GestureFeatures } from "./gesture-fsm";
import {
  cursorFor,
  extendedCount,
  fingerExtended,
  handSize,
  palmCenter,
  pinchDist,
  thumbExtended,
  type Point3,
} from "./landmarks";
import { LandmarkSmoother, OneEuroFilter } from "./one-euro";

export class FeatureExtractor {
  private readonly smoother: LandmarkSmoother;
  private readonly cx: OneEuroFilter;
  private readonly cy: OneEuroFilter;

  constructor(
    landmarkParams: OneEuroParams = VISION_CONSTANTS.ONE_EURO_LANDMARKS,
    cursorParams: OneEuroParams = VISION_CONSTANTS.ONE_EURO_CURSOR,
  ) {
    this.smoother = new LandmarkSmoother(landmarkParams);
    this.cx = new OneEuroFilter(cursorParams);
    this.cy = new OneEuroFilter(cursorParams);
  }

  /**
   * @param pinchActive the FSM is in GRABBING, DRAGGING or LOST; selects the pinch-midpoint cursor
   * @returns features plus the smoothed landmarks (for a debug overlay only; never logged)
   */
  extract<T extends Point3>(
    hand: readonly T[],
    presence: number,
    pinchActive: boolean,
    t: number,
  ): { features: GestureFeatures; smoothed: T[] } {
    const l = this.smoother.filter(hand, t);
    const raw = cursorFor(l, pinchActive);
    const cursor = {
      // Mirrored so the cursor moves with the learner (mediapipe-hands section 2), clamped to the viewport.
      x: clamp01(1 - this.cx.filter(raw.x, t)),
      y: clamp01(this.cy.filter(raw.y, t)),
    };
    const extended = {
      index: fingerExtended(l, "index"),
      middle: fingerExtended(l, "middle"),
      ring: fingerExtended(l, "ring"),
      pinky: fingerExtended(l, "pinky"),
    };
    return {
      smoothed: l,
      features: {
        handSize: handSize(l),
        pinchDist: pinchDist(l),
        extended,
        extendedCount: extendedCount(l),
        thumbExtended: thumbExtended(l),
        cursor,
        palmCenter: palmCenter(l),
        presence,
      },
    };
  }

  /** Call when the hand is lost or the primary hand changes, so history from another hand is not blended in. */
  reset(): void {
    this.smoother.reset();
    this.cx.reset();
    this.cy.reset();
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
