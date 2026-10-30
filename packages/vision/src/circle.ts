/**
 * Easter egg (dev sessions only, never logged): two quick circles drawn in the air with the cursor.
 * Sums the turning angle of the cursor around the centroid of the last WINDOW_MS of points; two full turns on a
 * roughly round path of a visible size fire once, then the detector rests for COOLDOWN_MS.
 */
import type { InteractionEvent } from "@grasp/types";
import { VISION_CONSTANTS as V } from "./constants";

const WINDOW_MS = 2500;
const TURNS = 2;
const MIN_RADIUS = 0.04; // frame heights (aspect-corrected), so a jittery still hand never qualifies
const MAX_RADIUS_SPREAD = 0.45; // radius std / mean: a round path, not a zigzag
const COOLDOWN_MS = 3000;
const ASPECT = V.CAMERA.width / V.CAMERA.height;

export class CircleDetector {
  private pts: { x: number; y: number; t: number }[] = [];
  private restUntil = 0;

  /** Feed the cursor of a neutral or pointing hand; null (other states, no hand) clears the path. */
  step(cursor: { x: number; y: number } | null, t: number): InteractionEvent | null {
    if (!cursor || t < this.restUntil) {
      this.pts = [];
      return null;
    }
    this.pts.push({ x: cursor.x * ASPECT, y: cursor.y, t });
    while (this.pts.length && t - this.pts[0]!.t > WINDOW_MS) this.pts.shift();
    if (this.pts.length < 20) return null;

    const n = this.pts.length;
    const cx = this.pts.reduce((s, p) => s + p.x, 0) / n;
    const cy = this.pts.reduce((s, p) => s + p.y, 0) / n;
    const r = this.pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
    const mean = r.reduce((s, v) => s + v, 0) / n;
    if (mean < MIN_RADIUS) return null;
    const sd = Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    if (sd / mean > MAX_RADIUS_SPREAD) return null;

    let turned = 0;
    for (let i = 1; i < n; i++) {
      const a0 = Math.atan2(this.pts[i - 1]!.y - cy, this.pts[i - 1]!.x - cx);
      const a1 = Math.atan2(this.pts[i]!.y - cy, this.pts[i]!.x - cx);
      turned += ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    }
    if (Math.abs(turned) < TURNS * 2 * Math.PI) return null;
    this.pts = [];
    this.restUntil = t + COOLDOWN_MS;
    // y points down on screen, so a positive sum is clockwise as the learner sees it.
    return { type: "spell_circle", clockwise: turned > 0, t };
  }
}
