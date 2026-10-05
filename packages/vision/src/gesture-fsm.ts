/**
 * Gesture state machine: smoothed features in, interaction events out.
 * Spec: doc 04 "Gesture state machine" and "Gesture detection pseudocode".
 * The FSM never sees the scene graph; the only scene input is `onHoverResult`.
 */

import type { Cursor, HoverResult, InteractionEvent } from "@grasp/types";
import { VISION_CONSTANTS } from "./constants";
import type { Point3 } from "./landmarks";
import { OneEuroFilter } from "./one-euro";

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

const H = VISION_CONSTANTS.HOLD_FRAMES;
/** Hold frames per candidate; "unknown" shares open_palm's count (both mean a neutral IDLE hand). */
const HOLD: Record<GestureCandidate, number> = {
  pinch: H.pinch,
  point: H.point,
  open_palm: H.open_palm,
  unknown: H.open_palm,
};

/**
 * M3 scope (doc 17): NO_HAND, IDLE, GRABBING, DRAGGING, LOST. `point` is classified but HOVER is
 * not entered until M6 wires the raycast; until then a pointing hand emits the neutral `cursor` event.
 */
export class GestureFsm {
  state: GestureState = "NO_HAND";

  private lastHover: HoverResult | null = null;
  private hoverAgeFrames = Infinity;
  private holdFrames: Record<GestureCandidate, number> = { pinch: 0, point: 0, open_palm: 0, unknown: 0 };
  private presentFrames = 0;
  private releaseFrames = 0;
  private noHandSince: number | null = null;
  private lastCursor: Cursor = { x: 0.5, y: 0.5 };
  private grabStartCursor: Cursor = { x: 0.5, y: 0.5 };
  private grabStartHandSize = 1;
  private readonly zHint = new OneEuroFilter(VISION_CONSTANTS.ONE_EURO_Z_HINT);
  /** A pinch refused by the grabbable rule must be released before another can start a grab. */
  private pinchRejected = false;

  /** True in GRABBING, DRAGGING and LOST: feature extraction uses the pinch-midpoint cursor. */
  get pinchActive(): boolean {
    return this.state === "GRABBING" || this.state === "DRAGGING" || this.state === "LOST";
  }

  /**
   * Advance one frame. `features` is null when no primary hand passed the presence,
   * box-size, and edge filters this frame. Returns the events to post to the main thread,
   * each carrying `{ t, confidence }` metadata.
   */
  step(features: GestureFeatures | null, t: number): InteractionEvent[] {
    const out: InteractionEvent[] = [];
    this.hoverAgeFrames += 1;
    if (features) this.stepHand(features, t, out);
    else this.stepNoHand(t, out);
    return out;
  }

  /** Main thread reply used for the grabbable-under-cursor rule before `grab_start`. */
  onHoverResult(r: HoverResult): void {
    this.lastHover = r;
    this.hoverAgeFrames = 0;
  }

  private stepNoHand(t: number, out: InteractionEvent[]): void {
    this.presentFrames = 0;
    this.releaseFrames = 0;
    this.resetHold();
    this.noHandSince ??= t;
    const gone = t - this.noHandSince;
    const { NO_HAND_TIMEOUT_MS, LOST_GRACE_MS } = VISION_CONSTANTS;

    if ((this.state === "GRABBING" || this.state === "DRAGGING") && gone > NO_HAND_TIMEOUT_MS) {
      this.state = "LOST";
      out.push({ type: "tracking_lost", t });
    } else if (this.state === "LOST" && gone > NO_HAND_TIMEOUT_MS + LOST_GRACE_MS) {
      // Grace expired: auto-release where the hand was last seen. The scene settles, never snaps.
      this.state = "IDLE";
      out.push({ type: "grab_end", cursor: this.lastCursor, reason: "lost", t });
    } else if ((this.state === "IDLE" || this.state === "HOVER") && gone > NO_HAND_TIMEOUT_MS) {
      this.state = "NO_HAND";
    }
  }

  private stepHand(f: GestureFeatures, t: number, out: InteractionEvent[]): void {
    this.noHandSince = null;
    if (this.state === "NO_HAND") {
      this.presentFrames += 1;
      if (this.presentFrames < HOLD.open_palm) return;
      this.state = "IDLE";
    }
    if (this.state === "LOST") {
      // Regained within the grace period: resume the drag; the scene recomputes its grab offset.
      this.state = "DRAGGING";
      out.push({ type: "tracking_regained", t });
    }
    this.lastCursor = f.cursor;

    // Classification with hysteresis: pinch beats point beats open_palm (doc 04 pseudocode step 3).
    const { PINCH_ENTER, PINCH_EXIT } = VISION_CONSTANTS;
    const pinchRule = this.pinchActive ? f.pinchDist < PINCH_EXIT : f.pinchDist < PINCH_ENTER;
    const candidate: GestureCandidate = pinchRule
      ? "pinch"
      : f.extended.index && !f.extended.middle && !f.extended.ring && !f.extended.pinky
        ? "point"
        : f.extendedCount === 4 && f.thumbExtended
          ? "open_palm"
          : "unknown";

    const held = this.holdFrames[candidate] + 1;
    this.resetHold();
    this.holdFrames[candidate] = held;
    const confirmed = held >= HOLD[candidate];
    const confidence = f.presence * Math.min(1, held / HOLD[candidate]);
    this.releaseFrames = f.pinchDist > PINCH_EXIT ? this.releaseFrames + 1 : 0;
    const meta = { t, confidence };

    if (this.state === "IDLE" || this.state === "HOVER") {
      if (!pinchRule) this.pinchRejected = false;
      if (confirmed && candidate === "pinch" && !this.pinchRejected) {
        const grab = this.grabDecision();
        if (grab === "grab") {
          this.state = "GRABBING";
          this.grabStartCursor = f.cursor;
          this.grabStartHandSize = f.handSize;
          this.zHint.reset();
          out.push({ type: "grab_start", cursor: f.cursor, ...meta });
          return;
        }
        if (grab === "refuse") this.pinchRejected = true;
      }
      out.push({ type: "cursor", cursor: f.cursor, ...meta });
      return;
    }

    // GRABBING or DRAGGING
    if (this.releaseFrames >= H.release) {
      this.state = "IDLE";
      out.push({ type: "grab_end", cursor: f.cursor, reason: "release", ...meta });
      return;
    }
    if (this.state === "GRABBING" && dist2(f.cursor, this.grabStartCursor) > VISION_CONSTANTS.DRAG_START_DIST) {
      this.state = "DRAGGING";
    }
    if (this.state === "DRAGGING") {
      const z = this.zHint.filter(f.handSize / this.grabStartHandSize - 1, t);
      const zHintDelta = Math.abs(z) < VISION_CONSTANTS.Z_HINT_DEAD_ZONE ? 0 : z;
      out.push({ type: "grab_move", cursor: f.cursor, zHintDelta, ...meta });
    }
  }

  /**
   * Grabbable-under-cursor rule (doc 04): grab over a grabbable component or empty space (orbit);
   * refuse over a non-grabbable one; wait if the main thread has not answered for the recent cursor.
   */
  private grabDecision(): "grab" | "refuse" | "wait" {
    if (!this.lastHover || this.hoverAgeFrames > VISION_CONSTANTS.HOVER_RESULT_MAX_AGE_FRAMES) return "wait";
    return this.lastHover.isGrabbable || this.lastHover.hoveredId === null ? "grab" : "refuse";
  }

  private resetHold(): void {
    this.holdFrames = { pinch: 0, point: 0, open_palm: 0, unknown: 0 };
  }
}

function dist2(a: Cursor, b: Cursor): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
