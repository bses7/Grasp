/**
 * Cursor jitter for `perf_sample.jitterNorm` (doc 14) and the M2 tuning readout (doc 17).
 * Interpretation: RMS distance of the cursor from its own mean over the last JITTER_WINDOW_MS,
 * reported only while the window's net speed is below JITTER_REST_SPEED (the hand is "at rest").
 * Holds cursor scalars only; no landmarks.
 */
import { VISION_CONSTANTS } from "./constants";

type Sample = { x: number; y: number; t: number };

export class JitterMeter {
  private samples: Sample[] = [];

  /** Add one cursor sample (normalized units, ms). Returns jitter RMS when at rest, else null. */
  push(x: number, y: number, t: number): number | null {
    this.samples.push({ x, y, t });
    while (this.samples[0]!.t < t - VISION_CONSTANTS.JITTER_WINDOW_MS) this.samples.shift();
    if (this.samples.length < 10) return null;

    const first = this.samples[0]!;
    const dt = (t - first.t) / 1000;
    if (dt <= 0 || Math.hypot(x - first.x, y - first.y) / dt >= VISION_CONSTANTS.JITTER_REST_SPEED) return null;

    const n = this.samples.length;
    const mx = this.samples.reduce((s, p) => s + p.x, 0) / n;
    const my = this.samples.reduce((s, p) => s + p.y, 0) / n;
    const sq = this.samples.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0);
    return Math.sqrt(sq / n);
  }

  reset(): void {
    this.samples = [];
  }
}
