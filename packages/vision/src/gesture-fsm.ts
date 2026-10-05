/**
 * Gesture state machine: smoothed features in, interaction events out.
 * Spec: doc 04 "Gesture state machine" and "Gesture detection pseudocode".
 * The FSM never sees the scene graph; the only scene input is `onHoverResult`.
 */

import type { HoverResult, InteractionEvent } from "@grasp/types";
import type { Point3 } from "./landmarks";

export type GestureState = "NO_HAND" | "IDLE" | "HOVER" | "GRABBING" | "DRAGGING" | "LOST";

/** Candidate gesture after hysteresis, before hold-frame confirmation. */
export type GestureCandidate = "pinch" | "point" | "open_palm" | "unknown";

/** Per-frame features for the primary hand, already One-Euro filtered and scale-normalised. */
export type GestureFeatures = {
  readonly handSize: number;
  readonly pinchDist: number;
  readonly extended: Readonly<Record<"index" | "middle" | "ring" | "pinky", boolean>>;
  readonly extendedCount: number;
  readonly thumbExtended: boolean;
  /** Mirrored, clamped 0..1 viewport cursor (second One-Euro applied). */
  readonly cursor: { readonly x: number; readonly y: number };
  readonly palmCenter: Point3;
  readonly presence: number; // presence confidence of the primary hand
};

export class GestureFsm {
  state: GestureState = "NO_HAND";

  private lastHover: HoverResult | null = null;
  private holdFrames: Record<GestureCandidate, number> = {
    pinch: 0,
    point: 0,
    open_palm: 0,
    unknown: 0,
  };

  /**
   * Advance one frame. `features` is null when no primary hand passed the presence,
   * box-size, and edge filters this frame. Returns the events to post to the main thread,
   * each carrying `{ t, confidence }` metadata.
   */
  step(features: GestureFeatures | null, t: number): InteractionEvent[] {
    void features;
    void t;
    void this.lastHover;
    void this.holdFrames;
    throw new Error("TODO Phase D: GestureFsm.step (doc 04, M3)");
  }

  /** Main thread reply used for the grabbable-under-cursor rule before `grab_start`. */
  onHoverResult(r: HoverResult): void {
    void r;
    throw new Error("TODO Phase D: GestureFsm.onHoverResult (doc 04, M3)");
  }
}
