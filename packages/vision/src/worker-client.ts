/**
 * Main-thread side of the vision path: frame capture, bitmap transfer, event delivery, perf_sample.
 * Spec: doc 04 "Inference placement: Web Worker"; doc 17 M4.
 *
 * Worker path (MVP target): one ImageBitmap per new camera frame, transferred, at most one in flight
 * (a busy worker drops frames instead of queueing them). Fallback: the same VisionPipeline on the
 * main thread at alternate frames, used when OffscreenCanvas is missing, the worker fails to start,
 * or the caller forces it.
 */

import type { CvStatus, HoverResult, InteractionEvent, PerfSample } from "@grasp/types";
import { VISION_CONSTANTS } from "./constants";
import type { GestureFeatures } from "./gesture-fsm";
import type { LandmarkerDelegate } from "./landmarker";
import { VisionPipeline, type PipelineOutput } from "./pipeline";
import type { WorkerInbound, WorkerOutbound } from "./worker/hand-landmarker.worker";

export type VisionInferencePath = "worker" | "main_thread_fallback";

/** Everything the app receives: scene-bound events, the status channel, perf samples, and debug features. */
export type VisionMessage =
  | InteractionEvent
  | CvStatus
  | PerfSample
  | { readonly type: "features"; readonly t: number; readonly f: GestureFeatures | null };

export type StartVisionOptions = {
  /** A playing camera <video> (see openCamera). */
  readonly video: HTMLVideoElement;
  readonly onMessage: (message: VisionMessage) => void;
  /** Skip the worker even where it is supported (`?cv=main` on /prototype). */
  readonly forceMainThread?: boolean;
  /** Developer fixture recorder only. */
  readonly debugFeatures?: boolean;
};

export type VisionHandle = {
  readonly path: VisionInferencePath;
  readonly delegate: LandmarkerDelegate;
  /** Reply to the most recent cursor with what the raycaster found. */
  postHoverResult(result: HoverResult): void;
  stop(): void;
};

const PERF_WINDOW_MS = 5000;
const WORKER_INIT_TIMEOUT_MS = 30_000;

/** True when the GPU delegate can run inside a worker (Chrome, Edge); false forces the fallback. */
export function supportsOffscreenCanvas(): boolean {
  try {
    return typeof OffscreenCanvas !== "undefined" && !!new OffscreenCanvas(1, 1).getContext("webgl2");
  } catch {
    return false;
  }
}

type Backend = {
  readonly path: VisionInferencePath;
  readonly delegate: LandmarkerDelegate;
  submit(video: HTMLVideoElement, t: number): void;
  postHoverResult(r: HoverResult): void;
  stop(): void;
};

type FrameStats = { t: number; inferenceMs: number; jitter: number | null };

/**
 * Start inference on `video`. Emits `cv_status: initialising` at once; resolves when a path is running.
 * Rejects only if neither path can initialise.
 */
export async function startVision(opts: StartVisionOptions): Promise<VisionHandle> {
  const { video, onMessage } = opts;
  onMessage({ type: "cv_status", state: "initialising", sinceMs: 0 });

  const perf = new PerfWindow(onMessage);
  const onFrame = (s: FrameStats) => perf.frame(s, performance.now());

  let backend: Backend | null = null;
  if (!opts.forceMainThread && supportsOffscreenCanvas()) {
    backend = await startWorker(opts, onFrame).catch((err) => {
      console.warn("Vision worker unavailable, using main-thread fallback", err);
      return null;
    });
  }
  backend ??= await startMainThread(opts, onFrame);
  perf.start(backend);

  // VIDEO mode needs strictly increasing timestamps, whichever clock source below delivers them.
  let lastT = -Infinity;
  const submit = (now: number) => {
    lastT = Math.max(now, lastT + 0.001);
    backend.submit(video, lastT);
  };

  // Preferred: one callback per new camera frame (not per display refresh), so no frame is inferred twice.
  let stopped = false;
  let gotVideoFrame = false;
  let vfc = 0;
  let raf = 0;
  const viaVideoFrame: VideoFrameRequestCallback = (now) => {
    if (stopped) return;
    gotVideoFrame = true;
    cancelAnimationFrame(raf);
    submit(now);
    vfc = video.requestVideoFrameCallback(viaVideoFrame);
  };
  vfc = video.requestVideoFrameCallback(viaVideoFrame);

  // Watchdog: a hidden <video> or a headless browser may never present frames, so rVFC never fires.
  // Then pace with rAF at the camera frame rate (a frame may occasionally be inferred twice).
  const minInterval = (1000 / VISION_CONSTANTS.CAMERA.fps) * 0.9;
  let lastRafSubmit = -Infinity;
  const viaRaf = (now: number) => {
    if (stopped || gotVideoFrame) return;
    if (now - lastRafSubmit >= minInterval) {
      lastRafSubmit = now;
      submit(now);
    }
    raf = requestAnimationFrame(viaRaf);
  };
  const watchdog = setTimeout(() => {
    if (!gotVideoFrame) raf = requestAnimationFrame(viaRaf);
  }, 1000);

  return {
    path: backend.path,
    delegate: backend.delegate,
    postHoverResult: (r) => backend.postHoverResult(r),
    stop() {
      stopped = true;
      clearTimeout(watchdog);
      video.cancelVideoFrameCallback(vfc);
      cancelAnimationFrame(raf);
      perf.stop();
      backend.stop();
    },
  };
}

function startWorker(opts: StartVisionOptions, onFrame: (s: FrameStats) => void): Promise<Backend> {
  const worker = new Worker(new URL("./worker/hand-landmarker.worker.ts", import.meta.url), { type: "module" });
  const send = (m: WorkerInbound, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  let inFlight = false;
  let ready = false;

  return new Promise<Backend>((resolve, reject) => {
    const fail = (reason: unknown) => {
      clearTimeout(timer);
      worker.terminate();
      reject(reason);
    };
    const timer = setTimeout(() => fail(new Error("vision worker init timed out")), WORKER_INIT_TIMEOUT_MS);
    worker.onerror = (e) => fail(new Error(e.message || "vision worker failed to load"));

    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const m = e.data;
      if (m.type === "ready") {
        ready = true;
        clearTimeout(timer);
        worker.onerror = (err) => console.error("vision worker error", err.message);
        resolve({
          path: "worker",
          delegate: m.delegate,
          submit(video, t) {
            if (inFlight) return; // drop: the worker is still on the previous frame
            inFlight = true;
            createImageBitmap(video).then(
              (bitmap) => send({ type: "frame", bitmap, t }, [bitmap]),
              () => (inFlight = false),
            );
          },
          postHoverResult: (r) => send(r),
          stop: () => worker.terminate(),
        });
      } else if (m.type === "error") {
        // Before ready: init failed, so fall back. After: one bad frame, keep running.
        if (ready) console.error("vision worker:", m.message);
        else fail(new Error(m.message));
      } else if (m.type === "frame_done") {
        inFlight = false;
        onFrame(m);
      } else {
        opts.onMessage(m);
      }
    };
    send({ type: "init", debugFeatures: opts.debugFeatures });
  });
}

async function startMainThread(opts: StartVisionOptions, onFrame: (s: FrameStats) => void): Promise<Backend> {
  const pipeline = await VisionPipeline.create();
  let frame = 0;
  const deliver = (out: PipelineOutput, t: number) => {
    for (const m of out.messages) opts.onMessage(m);
    if (opts.debugFeatures) opts.onMessage({ type: "features", t, f: out.features });
    onFrame({ t, inferenceMs: out.inferenceMs, jitter: out.jitter });
  };
  return {
    path: "main_thread_fallback",
    delegate: pipeline.delegate,
    submit(video, t) {
      if (frame++ % 2 === 1) return; // alternate frames keep the render loop within budget (doc 04)
      deliver(pipeline.process(video, t), t);
    },
    postHoverResult: (r) => pipeline.onHoverResult(r),
    stop: () => pipeline.close(),
  };
}

/** Collects render and inference timings and emits one `perf_sample` per PERF_WINDOW_MS. */
class PerfWindow {
  private frameMs: number[] = [];
  private inferenceMs: number[] = [];
  private e2eMs: number[] = [];
  private jitter: number[] = [];
  private lastRaf = 0;
  private windowStart = 0;
  private raf = 0;
  private backend: Backend | null = null;

  constructor(private readonly emit: (m: PerfSample) => void) {}

  start(backend: Backend): void {
    this.backend = backend;
    this.windowStart = performance.now();
    const tick = (now: number) => {
      if (this.lastRaf) this.frameMs.push(now - this.lastRaf);
      this.lastRaf = now;
      if (now - this.windowStart >= PERF_WINDOW_MS) this.flush(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  frame(s: FrameStats, now: number): void {
    this.inferenceMs.push(s.inferenceMs);
    this.e2eMs.push(now - s.t);
    if (s.jitter !== null) this.jitter.push(s.jitter);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private flush(now: number): void {
    const elapsed = now - this.windowStart;
    this.emit({
      type: "perf_sample",
      fps: Math.round((this.frameMs.length / elapsed) * 1000 * 10) / 10,
      frameMsP95: round1(percentile(this.frameMs, 0.95) ?? 0),
      inferenceMsP50: round1(percentile(this.inferenceMs, 0.5)),
      inferenceMsP95: round1(percentile(this.inferenceMs, 0.95)),
      e2eMsP50: round1(percentile(this.e2eMs, 0.5)),
      jitterNorm: this.jitter.length ? Math.round((this.jitter.reduce((a, b) => a + b, 0) / this.jitter.length) * 1e5) / 1e5 : null,
      delegate: this.backend?.delegate ?? null,
      path: this.backend?.path ?? null,
    });
    this.frameMs = [];
    this.inferenceMs = [];
    this.e2eMs = [];
    this.jitter = [];
    this.windowStart = now;
  }
}

function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
}

function round1(n: number): number;
function round1(n: number | null): number | null;
function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}
