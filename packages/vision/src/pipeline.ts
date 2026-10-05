/**
 * One frame in, interaction events and cv_status out (doc 04 "Gesture detection pseudocode").
 * The same class runs inside the vision worker and, for the fallback path, on the main thread,
 * so both paths produce identical event sequences (doc 17 M4 acceptance).
 * Landmarks exist only inside `process` for the current frame.
 */
import type { CvStatus, HoverResult, InteractionEvent } from "@grasp/types";
import { VISION_CONSTANTS as V } from "./constants";
import { CvStatusTracker } from "./cv-status";
import { FeatureExtractor } from "./features";
import { GestureFsm, type GestureFeatures } from "./gesture-fsm";
import { JitterMeter } from "./jitter";
import { createHandLandmarker, type HandLandmarker, type LandmarkerDelegate } from "./landmarker";
import { handSize, Landmark, type HandLandmarks } from "./landmarks";

export type PipelineOutput = {
  readonly messages: (InteractionEvent | CvStatus)[];
  readonly inferenceMs: number;
  /** At-rest cursor jitter RMS this frame, or null (moving, grabbing, or no hand). */
  readonly jitter: number | null;
  /** For the developer fixture recorder only; never logged. */
  readonly features: GestureFeatures | null;
};

/** Luminance is sampled every Nth frame; a GPU readback per frame is not worth it for a 2 s rule. */
const LUMINANCE_EVERY = 15;
/** Wrist travel per frame (normalized) under which a hand is treated as the same hand as last frame. */
const SAME_HAND_DIST = 0.15;

type Hand = { l: HandLandmarks; presence: number; box: number; size: number };

export class VisionPipeline {
  private readonly fsm = new GestureFsm();
  private readonly extractor = new FeatureExtractor();
  private readonly jitterMeter = new JitterMeter();
  private readonly status = new CvStatusTracker();
  private readonly lumCtx: OffscreenCanvasRenderingContext2D | null;
  private primaryWrist: { x: number; y: number } | null = null;
  private handCount = 0;
  private frame = 0;
  private luminance: number | null = null;

  private constructor(
    private readonly landmarker: HandLandmarker,
    readonly delegate: LandmarkerDelegate,
  ) {
    const { width, height } = V.LUMINANCE_SAMPLE;
    this.lumCtx =
      typeof OffscreenCanvas === "undefined"
        ? null
        : new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
  }

  static async create(): Promise<VisionPipeline> {
    const { landmarker, delegate } = await createHandLandmarker();
    return new VisionPipeline(landmarker, delegate);
  }

  /** `t` must strictly increase between calls (VIDEO running mode). */
  process(image: ImageBitmap | HTMLVideoElement, t: number): PipelineOutput {
    const t0 = performance.now();
    const result = this.landmarker.detectForVideo(image, t);
    const inferenceMs = performance.now() - t0;
    if (this.frame++ % LUMINANCE_EVERY === 0) this.luminance = this.sampleLuminance(image);

    const messages: (InteractionEvent | CvStatus)[] = [];
    const hands: Hand[] = result.landmarks
      .map((l, i) => ({ l, presence: result.handedness[i]?.[0]?.score ?? 0, box: boxFrac(l), size: handSize(l) }))
      .filter((h) => h.presence >= V.PRESENCE_FLOOR);
    if (hands.length !== this.handCount) {
      this.handCount = hands.length;
      messages.push({ type: "hand_count", n: hands.length, t });
    }

    const primary = this.choosePrimary(hands);
    // Too far or too close: the hand is tracked for cv_status but drives no gestures.
    const usable = primary && primary.box >= V.HAND_BOX_MIN_FRAC && primary.box <= V.HAND_BOX_MAX_FRAC ? primary : null;
    let features: GestureFeatures | null = null;
    let jitter: number | null = null;
    if (usable) {
      features = this.extractor.extract(usable.l, usable.presence, this.fsm.pinchActive, t).features;
    } else {
      this.extractor.reset();
    }

    messages.push(...this.fsm.step(features, t));

    if (features && this.fsm.state === "IDLE") jitter = this.jitterMeter.push(features.cursor.x, features.cursor.y, t);
    else this.jitterMeter.reset();

    const s = this.status.update(
      {
        handCount: hands.length,
        primaryBoxFrac: primary?.box ?? null,
        presence: primary?.presence ?? 0,
        luminance: this.luminance,
        fsmState: this.fsm.state,
      },
      t,
    );
    if (s) messages.push(s);
    return { messages, inferenceMs, jitter, features };
  }

  onHoverResult(r: HoverResult): void {
    this.fsm.onHoverResult(r);
  }

  close(): void {
    this.landmarker.close();
  }

  /**
   * Last frame's primary hand if it is still there (nearest wrist), else the largest hand.
   * ponytail: wrist proximity stands in for identity; doc 04's "switch only after 500 ms lost" rule
   * is not modelled. Add it if a second person in frame steals the cursor in hallway tests.
   */
  private choosePrimary(hands: Hand[]): Hand | null {
    let pick: Hand | null = null;
    if (this.primaryWrist) {
      let best = SAME_HAND_DIST;
      for (const h of hands) {
        const w = h.l[Landmark.WRIST]!;
        const d = Math.hypot(w.x - this.primaryWrist.x, w.y - this.primaryWrist.y);
        if (d < best) [best, pick] = [d, h];
      }
    }
    pick ??= hands.reduce<Hand | null>((a, h) => (!a || h.size > a.size ? h : a), null);
    this.primaryWrist = pick ? { x: pick.l[Landmark.WRIST]!.x, y: pick.l[Landmark.WRIST]!.y } : null;
    return pick;
  }

  /** Mean Rec. 709 luma of a 32x18 downsample; the pixels are discarded immediately. */
  private sampleLuminance(image: ImageBitmap | HTMLVideoElement): number | null {
    if (!this.lumCtx) return null;
    try {
      const { width, height } = V.LUMINANCE_SAMPLE;
      this.lumCtx.drawImage(image, 0, 0, width, height);
      const px = this.lumCtx.getImageData(0, 0, width, height).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
      return sum / (px.length / 4);
    } catch {
      return null;
    }
  }
}

/** Bounding-box width of the hand as a fraction of frame width. */
function boxFrac(l: HandLandmarks): number {
  let min = 1;
  let max = 0;
  for (const p of l) {
    if (p.x < min) min = p.x;
    if (p.x > max) max = p.x;
  }
  return max - min;
}
