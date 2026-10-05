"use client";

/**
 * M1 (doc 17): mirrored 640x360 preview, 21 landmarks and bones on a 2D overlay, main-thread
 * VIDEO-mode inference, and an inference-time readout. Camera starts only on a click.
 * M2: One-Euro on every landmark coordinate plus a second filter on the cursor (pinch midpoint),
 * with sliders for minCutoff and beta and a live at-rest jitter RMS, filtered versus raw.
 * Frames never leave the tab; nothing here is logged.
 */
import {
  createHandLandmarker,
  drawHands,
  JitterMeter,
  LandmarkSmoother,
  OneEuroFilter,
  openCamera,
  pinchDist,
  pinchMidpoint,
  stopCamera,
  VISION_CONSTANTS,
  type HandLandmarker,
  type LandmarkerDelegate,
} from "@grasp/vision";
import { useEffect, useRef, useState } from "react";

type Status = "off" | "initialising" | "ok" | "no_hand" | "no_camera" | "error";

const WINDOW = 120; // frames in the rolling inference-time window (~4 s at 30 fps)

type Tuning = { minCutoff: number; beta: number };
const DEFAULT_TUNING: Tuning = {
  minCutoff: VISION_CONSTANTS.ONE_EURO_LANDMARKS.minCutoff,
  beta: VISION_CONSTANTS.ONE_EURO_LANDMARKS.beta,
};
// The cursor filter keeps doc 04's +0.5 Hz offset over the landmark filter (1.0 -> 1.5).
const CURSOR_CUTOFF_OFFSET =
  VISION_CONSTANTS.ONE_EURO_CURSOR.minCutoff - VISION_CONSTANTS.ONE_EURO_LANDMARKS.minCutoff;

function makeFilters({ minCutoff, beta }: Tuning) {
  const dCutoff = VISION_CONSTANTS.ONE_EURO_LANDMARKS.dCutoff;
  const cursorParams = { minCutoff: minCutoff + CURSOR_CUTOFF_OFFSET, beta, dCutoff };
  return {
    landmarks: new LandmarkSmoother({ minCutoff, beta, dCutoff }),
    cx: new OneEuroFilter(cursorParams),
    cy: new OneEuroFilter(cursorParams),
    jitter: new JitterMeter(),
    rawJitter: new JitterMeter(),
  };
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x * ctx.canvas.width, y * ctx.canvas.height, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

export function CameraPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const timing = useRef<HTMLSpanElement>(null);
  const jitterText = useRef<HTMLSpanElement>(null);
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING);
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const stopRef = useRef<() => void>(undefined);
  const [status, setStatus] = useState<Status>("off");
  const [detail, setDetail] = useState("");

  useEffect(() => () => stopRef.current?.(), []);

  async function start() {
    const v = video.current!;
    const c = overlay.current!;
    setStatus("initialising");

    let stream: MediaStream;
    try {
      stream = await openCamera(v);
    } catch (err) {
      setStatus("no_camera");
      setDetail(err instanceof Error ? err.message : String(err));
      return;
    }

    let landmarker: HandLandmarker;
    let delegate: LandmarkerDelegate;
    try {
      ({ landmarker, delegate } = await createHandLandmarker());
    } catch (err) {
      stopCamera(stream);
      setStatus("error");
      setDetail(err instanceof Error ? err.message : String(err));
      return;
    }

    const ctx = c.getContext("2d")!;

    const samples: number[] = [];
    let frame = 0;
    let filters = makeFilters(tuningRef.current);
    let filtersFor = tuningRef.current;
    let lastJitter = { filtered: null as number | null, raw: null as number | null };
    let lastVideoTime = -1;
    let lastStatus: Status = "initialising";
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (v.currentTime === lastVideoTime) return; // no new camera frame since last inference
      lastVideoTime = v.currentTime;
      // The real frame size can arrive after play() resolves; keep the overlay matched to it.
      if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        setDetail(`camera ${v.videoWidth}x${v.videoHeight}, delegate ${delegate}`);
      }

      const t0 = performance.now();
      const result = landmarker.detectForVideo(v, t0);
      const ms = performance.now() - t0;
      // Slider moved: rebuild the filters with the new parameters (history restarts).
      if (filtersFor !== tuningRef.current) {
        filtersFor = tuningRef.current;
        filters = makeFilters(filtersFor);
      }

      ctx.clearRect(0, 0, c.width, c.height);
      // ponytail: primary hand = first detected; the continuity rule (doc 04) arrives with the FSM at M3/M4.
      const hand = result.landmarks[0];
      let pinchText = "";
      if (hand) {
        const smooth = filters.landmarks.filter(hand, t0);
        const raw = pinchMidpoint(hand);
        const mid = pinchMidpoint(smooth);
        const cursor = { x: filters.cx.filter(mid.x, t0), y: filters.cy.filter(mid.y, t0) };
        drawHands(ctx, [smooth]);
        dot(ctx, raw.x, raw.y, 4, "#a0aec0");
        dot(ctx, cursor.x, cursor.y, 8, "#e53e3e");
        lastJitter = {
          filtered: filters.jitter.push(cursor.x, cursor.y, t0),
          raw: filters.rawJitter.push(raw.x, raw.y, t0),
        };
        pinchText = `, pinchDist ${pinchDist(smooth).toFixed(2)}`;
      } else {
        filters = makeFilters(filtersFor);
        lastJitter = { filtered: null, raw: null };
      }

      samples.push(ms);
      if (samples.length > WINDOW) samples.shift();
      if (++frame % 10 === 0 && jitterText.current) {
        const { filtered, raw } = lastJitter;
        jitterText.current.textContent =
          filtered === null
            ? `jitter: hold your hand still to measure${pinchText}`
            : `jitter at rest: cursor ${filtered.toFixed(4)} ${filtered <= VISION_CONSTANTS.JITTER_TARGET ? "PASS" : "FAIL"}` +
              ` (target ≤ ${VISION_CONSTANTS.JITTER_TARGET}), raw ${raw?.toFixed(4) ?? "n/a"}${pinchText}`;
      }
      if (frame % 10 === 0 && timing.current) {
        const sorted = [...samples].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
        const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
        const budget = VISION_CONSTANTS.INFERENCE_P95_BUDGET_MS;
        timing.current.textContent =
          `inference ${ms.toFixed(1)} ms, p50 ${p50.toFixed(1)}, p95 ${p95.toFixed(1)} ` +
          `(budget p95 ≤ ${budget}; M1 target < 25) over ${samples.length} frames`;
      }

      const next: Status = result.landmarks.length > 0 ? "ok" : "no_hand";
      if (next !== lastStatus) setStatus((lastStatus = next));
    };
    raf = requestAnimationFrame(loop);

    stopRef.current = () => {
      cancelAnimationFrame(raf);
      landmarker.close();
      stopCamera(stream);
      ctx.clearRect(0, 0, c.width, c.height);
      stopRef.current = undefined;
      setStatus("off");
      setDetail("");
    };
  }

  const running = status === "ok" || status === "no_hand";

  return (
    <section className="flex flex-col gap-2 p-4" aria-label="Camera and hand landmarks">
      <div className="relative aspect-video w-[640px] max-w-full overflow-hidden rounded bg-black">
        {/* Mirrored so on-screen motion matches the learner's motion; landmarks are drawn unmirrored and flipped with the canvas. */}
        <video ref={video} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={overlay} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      </div>
      <div className="flex items-center gap-3 font-mono text-sm">
        {running ? (
          <button type="button" className="rounded bg-surface px-3 py-1 underline" onClick={() => stopRef.current?.()}>
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-accent px-3 py-1 text-bg disabled:opacity-50"
            disabled={status === "initialising"}
            onClick={start}
          >
            Start camera
          </button>
        )}
        <span role="status">status: {status}</span>
      </div>
      <p className="font-mono text-xs text-text-muted">{detail}</p>
      <p className="font-mono text-xs">
        <span ref={timing} />
      </p>
      <p className="font-mono text-xs">
        <span ref={jitterText} />
      </p>
      <fieldset className="grid grid-cols-[auto_1fr_4ch] items-center gap-x-3 gap-y-1 font-mono text-xs">
        <legend className="mb-1">One-Euro (landmarks; cursor uses minCutoff +{CURSOR_CUTOFF_OFFSET})</legend>
        <label htmlFor="minCutoff">minCutoff Hz</label>
        <input
          id="minCutoff"
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={tuning.minCutoff}
          onChange={(e) => setTuning((t) => ({ ...t, minCutoff: Number(e.target.value) }))}
        />
        <span>{tuning.minCutoff.toFixed(1)}</span>
        <label htmlFor="beta">beta</label>
        <input
          id="beta"
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={tuning.beta}
          onChange={(e) => setTuning((t) => ({ ...t, beta: Number(e.target.value) }))}
        />
        <span>{tuning.beta.toFixed(1)}</span>
      </fieldset>
      <p className="font-mono text-xs text-text-muted">
        grey dot: raw pinch midpoint; red dot: filtered cursor
      </p>
    </section>
  );
}
