/**
 * Two-hand gestures, outside the study only (the pipeline's `extraGestures`): both hands pinching.
 * Started over the model, spreading or closing the hands zooms; started on empty space, the separation sets how
 * far the parts spread (pull apart to spread, push together to reassemble). Twisting the hands like a steering
 * wheel rolls the model in both modes.
 * Inputs are the two hands' smoothed, mirrored features, so the line between the pinch points is on-screen.
 */
import type { InteractionEvent } from "@grasp/types";
import { VISION_CONSTANTS as V } from "./constants";
import type { GestureFeatures } from "./gesture-fsm";

/** Cursor x is in frame widths and y in frame heights; this puts both in the same units. */
const ASPECT = V.CAMERA.width / V.CAMERA.height;
/** Both hands pinching this many frames before the gesture starts (pinch's own hold). */
const HOLD = V.HOLD_FRAMES.pinch;

export class TwoHandGesture {
  private s: { zoom: boolean; d: number; a: number; d0: number } | null = null; // d0: separation at the start
  private frames = 0;

  get active(): boolean {
    return this.s !== null;
  }

  /**
   * @param overModel the primary hand's last hover hit a part (decides zoom vs explode at the start)
   * @returns null when this frame is not a two-hand gesture (the one-hand FSM steps as usual)
   */
  step(a: GestureFeatures | null, b: GestureFeatures | null, overModel: boolean, t: number): InteractionEvent[] | null {
    const limit = this.s ? V.PINCH_EXIT : V.PINCH_ENTER;
    if (!a || !b || a.pinchDist >= limit || b.pinchDist >= limit) {
      this.s = null;
      this.frames = 0;
      return null;
    }
    const x = (b.cursor.x - a.cursor.x) * ASPECT;
    const y = b.cursor.y - a.cursor.y;
    const d = Math.hypot(x, y);
    const ang = Math.atan2(y, x);
    if (!this.s) {
      if (++this.frames < HOLD) return null;
      this.s = { zoom: overModel, d, a: ang, d0: d };
      return [];
    }
    const s = this.s;
    const out: InteractionEvent[] = [];
    const roll = ((ang - s.a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(roll) >= V.TWO_HAND_ROLL_DEAD) {
      out.push({ type: "model_turn", dx: 0, dy: 0, roll, t });
      s.a = ang;
    }
    if (Math.abs(d / s.d - 1) >= V.TWO_HAND_ZOOM_DEAD) {
      // Zoom: hands apart brings the camera closer. Explode: doubling the starting separation spreads by +1.
      out.push(s.zoom ? { type: "model_zoom", factor: s.d / d, t } : { type: "model_explode", delta: (d - s.d) / s.d0, t });
      s.d = d;
    }
    return out;
  }
}
