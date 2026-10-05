"use client";

/**
 * Prototype CV panel (doc 17). Camera starts only on a click; frames never leave the tab.
 * M4: inference, smoothing and the FSM run in the vision worker (or the main-thread fallback with
 * `?cv=main`); this panel only renders what comes back: cursor dot, HUD glyph, cv_status, event
 * console with counters, perf_sample, and the feature recorder for FSM fixtures.
 * Landmarks stay inside the vision path, so the M1 skeleton overlay is gone; the cursor remains.
 */
import type { CvStatus, InteractionEvent, PerfSample } from "@grasp/types";
import {
  openCamera,
  startVision,
  stopCamera,
  VISION_CONSTANTS,
  type GestureFeatures,
  type GestureState,
  type VisionHandle,
  type VisionMessage,
} from "@grasp/vision";
import { useEffect, useRef, useState } from "react";

type Status = "off" | "starting" | "running" | "no_camera" | "error";
const LOG_LINES = 40;

const GLYPH: Record<GestureState, { icon: string; label: string }> = {
  NO_HAND: { icon: "·", label: "no hand" },
  IDLE: { icon: "✋", label: "open hand" },
  HOVER: { icon: "☝", label: "point" },
  GRABBING: { icon: "🤏", label: "pinch" },
  DRAGGING: { icon: "🤏", label: "pinch (dragging)" },
  LOST: { icon: "⚠", label: "tracking lost, holding" },
};

/** The worker owns the FSM; the panel mirrors its state from the events it emits. */
const STATE_AFTER: Partial<Record<InteractionEvent["type"], GestureState>> = {
  cursor: "IDLE",
  grab_start: "GRABBING",
  grab_move: "DRAGGING",
  grab_end: "IDLE",
  tracking_lost: "LOST",
  tracking_regained: "DRAGGING",
};

type Counts = { grab_start: number; release: number; lost: number; tracking_lost: number; grab_move: number };
const ZERO: Counts = { grab_start: 0, release: 0, lost: 0, tracking_lost: 0, grab_move: 0 };

type RecordedFrame = { t: number; f: Omit<GestureFeatures, "palmCenter"> | null };

/** Features rounded for a compact fixture; palmCenter is dropped (it is a landmark-derived point). */
function toFixtureFrame(f: GestureFeatures | null, t: number): RecordedFrame {
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  if (!f) return { t, f: null };
  const { palmCenter: _, cursor, ...rest } = f;
  return {
    t,
    f: { ...rest, handSize: r(f.handSize), pinchDist: r(f.pinchDist), presence: r(f.presence), cursor: { x: r(cursor.x), y: r(cursor.y) } },
  };
}

function describe(e: InteractionEvent): string {
  const t = e.t !== undefined ? `${(e.t / 1000).toFixed(2)}s` : "";
  const extra = e.type === "grab_end" ? ` reason=${e.reason}` : e.type === "hand_count" ? ` n=${e.n}` : "";
  return `${t} ${e.type}${extra}`;
}

export function CameraPanel() {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(undefined);
  const [status, setStatus] = useState<Status>("off");
  const [detail, setDetail] = useState("");
  const [cv, setCv] = useState<CvStatus | null>(null);
  const [perf, setPerf] = useState<PerfSample | null>(null);
  const [fsmState, setFsmState] = useState<GestureState>("NO_HAND");
  const [log, setLog] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts>(ZERO);
  const recording = useRef<RecordedFrame[] | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => () => stopRef.current?.(), []);

  async function start() {
    const v = video.current!;
    const c = overlay.current!;
    const ctx = c.getContext("2d")!;
    setStatus("starting");

    let stream: MediaStream;
    try {
      stream = await openCamera(v);
    } catch (err) {
      setStatus("no_camera");
      setCv({ type: "cv_status", state: "no_camera", sinceMs: 0 });
      setDetail(err instanceof Error ? err.message : String(err));
      return;
    }

    let handle: VisionHandle | null = null;
    let state: GestureState = "NO_HAND";

    const onMessage = (m: VisionMessage) => {
      if (m.type === "cv_status") {
        setCv(m);
        if (m.state === "no_hand" && state !== "NO_HAND") setFsmState((state = "NO_HAND"));
        return;
      }
      if (m.type === "perf_sample") return setPerf(m);
      if (m.type === "features") {
        recording.current?.push(toFixtureFrame(m.f, m.t));
        return;
      }

      const next = STATE_AFTER[m.type];
      if (next && next !== state) setFsmState((state = next));

      if ("cursor" in m) {
        // M3/M4 stub: everything is grabbable until M6 raycasts the scene.
        handle?.postHoverResult({ type: "hover_result", hoveredId: null, isGrabbable: true, t: m.t ?? 0 });
        // The cursor is already mirrored into viewport space, so this canvas is not CSS-flipped.
        if (c.width !== v.videoWidth) [c.width, c.height] = [v.videoWidth, v.videoHeight];
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.beginPath();
        ctx.arc(m.cursor.x * c.width, m.cursor.y * c.height, 9, 0, 2 * Math.PI);
        ctx.fillStyle = state === "GRABBING" || state === "DRAGGING" ? "#e53e3e" : "#f7fafc";
        ctx.fill();
      } else if (m.type === "tracking_lost" || m.type === "hand_count") {
        if (m.type === "tracking_lost" || m.n === 0) ctx.clearRect(0, 0, c.width, c.height);
      }

      if (m.type === "cursor") return;
      if (m.type === "grab_move") return setCounts((n) => ({ ...n, grab_move: n.grab_move + 1 }));
      setCounts((n) => ({
        ...n,
        grab_start: n.grab_start + (m.type === "grab_start" ? 1 : 0),
        tracking_lost: n.tracking_lost + (m.type === "tracking_lost" ? 1 : 0),
        release: n.release + (m.type === "grab_end" && m.reason === "release" ? 1 : 0),
        lost: n.lost + (m.type === "grab_end" && m.reason === "lost" ? 1 : 0),
      }));
      setLog((l) => [...l, describe(m)].slice(-LOG_LINES));
    };

    try {
      const forceMainThread = new URLSearchParams(location.search).get("cv") === "main";
      handle = await startVision({ video: v, onMessage, forceMainThread, debugFeatures: true });
    } catch (err) {
      stopCamera(stream);
      setStatus("error");
      setDetail(err instanceof Error ? err.message : String(err));
      return;
    }
    setStatus("running");
    setDetail(`camera ${v.videoWidth}x${v.videoHeight}, path ${handle.path}, delegate ${handle.delegate}`);

    stopRef.current = () => {
      handle?.stop();
      stopCamera(stream);
      ctx.clearRect(0, 0, c.width, c.height);
      stopRef.current = undefined;
      setStatus("off");
      setDetail("");
      setCv(null);
      setFsmState("NO_HAND");
    };
  }

  function toggleRecording() {
    if (!recording.current) {
      recording.current = [];
      setIsRecording(true);
      return;
    }
    const frames = recording.current;
    recording.current = null;
    setIsRecording(false);
    if (frames.length === 0) return;
    const t0 = frames[0]!.t;
    const fixture = {
      note: "Recorded on /prototype. Features only, no landmarks. Add an `expect` block, e.g. { grabPairs: 20, tolerance: 2 }.",
      frames: frames.map((f) => ({ ...f, t: Math.round((f.t - t0) * 10) / 10 })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(fixture)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `features-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const running = status === "running";
  const glyph = GLYPH[fsmState];
  const budget = VISION_CONSTANTS.INFERENCE_P95_BUDGET_MS;

  return (
    <section className="flex w-[672px] max-w-full flex-col gap-2 overflow-y-auto p-4" aria-label="Camera and hand tracking">
      <div className="relative aspect-video w-[640px] max-w-full overflow-hidden rounded bg-black">
        {/* Mirrored so on-screen motion matches the learner's motion. */}
        <video ref={video} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={overlay} className="absolute inset-0 h-full w-full object-cover" />
        {running && (
          <div
            className="absolute top-2 left-2 flex items-center gap-2 rounded bg-black/60 px-3 py-1 text-white"
            role="status"
            aria-label={`gesture: ${glyph.label}`}
          >
            <span className="text-4xl leading-none" aria-hidden>
              {glyph.icon}
            </span>
            <span className="font-mono text-sm">{glyph.label}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
        {running ? (
          <button type="button" className="rounded bg-surface px-3 py-1 underline" onClick={() => stopRef.current?.()}>
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-accent px-3 py-1 text-bg disabled:opacity-50"
            disabled={status === "starting"}
            onClick={start}
          >
            Start camera
          </button>
        )}
        <span>
          cv_status: {cv ? `${cv.state}${cv.hint ? ` (${cv.hint})` : ""}` : status}
        </span>
        <button
          type="button"
          className="rounded bg-surface px-3 py-1 underline disabled:opacity-50"
          disabled={!running && !isRecording}
          onClick={toggleRecording}
        >
          {isRecording ? "Stop and save features" : "Record features"}
        </button>
        <button
          type="button"
          className="rounded bg-surface px-3 py-1 underline"
          onClick={() => {
            setCounts(ZERO);
            setLog([]);
          }}
        >
          Reset counters
        </button>
      </div>
      <p className="font-mono text-xs text-text-muted">{detail}</p>
      <p className="font-mono text-xs">
        {perf
          ? `perf (5 s): fps ${perf.fps}, frameMs p95 ${perf.frameMsP95}, inference p50 ${perf.inferenceMsP50} p95 ${perf.inferenceMsP95} ` +
            `(budget ≤ ${budget}), e2e p50 ${perf.e2eMsP50} ms, jitter ${perf.jitterNorm ?? "n/a"}, luminance ${cv?.luminance ?? "n/a"}`
          : running
            ? "perf: first sample after 5 s"
            : ""}
      </p>
      <p className="font-mono text-sm">
        grab_start {counts.grab_start} · grab_end release {counts.release} · grab_end lost {counts.lost} · tracking_lost{" "}
        {counts.tracking_lost} · grab_move {counts.grab_move}
      </p>
      <ol
        className="h-32 overflow-y-auto rounded bg-surface p-2 font-mono text-xs"
        aria-label="Interaction events"
        ref={(el) => {
          if (el) el.scrollTop = el.scrollHeight;
        }}
      >
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
