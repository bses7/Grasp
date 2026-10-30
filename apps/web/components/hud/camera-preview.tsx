"use client";

/**
 * Lesson camera preview (doc 11 "Camera preview and tracking-active indicator"): mirrored video bottom-left,
 * 256×144 at 80% opacity, 384×216 when a failure state expands it, with a "Tracking" dot whenever frames are
 * processed, and the MediaPipe hand landmarks drawn over the video so the learner sees what is tracked. The
 * landmarks are drawn and dropped each frame; they never reach the lesson, the logger or the network. The camera starts only on a click and frames never leave the tab. Unlike the prototype's
 * CameraPanel it has no console or recorder; the lesson reads the vision path through the callbacks.
 * ponytail: no 32 px collapse toggle yet; the preview is small and always visible, which the ethics rule needs.
 */
import type { CvStatus, InteractionEvent, PerfSample } from "@grasp/types";
import { drawHands, openCamera, startVision, stopCamera, type VisionHandle } from "@grasp/vision";
import { useEffect, useRef, useState } from "react";

export type CameraPreviewProps = {
  expanded: boolean;
  onVisionEvent: (event: InteractionEvent) => void;
  /** Fist turn and two-hand gestures (dev and dev sessions; never pilot or main study). */
  extraGestures?: boolean;
  onVisionReady: (handle: VisionHandle | null, camera?: { width: number; height: number }) => void;
  onCvStatus: (status: CvStatus | null) => void;
  onPerfSample: (sample: PerfSample) => void;
};

type Status = "off" | "starting" | "running" | "failed";

export function CameraPreview({ expanded, extraGestures, onVisionEvent, onVisionReady, onCvStatus, onPerfSample }: CameraPreviewProps) {
  const video = useRef<HTMLVideoElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(undefined);
  const [status, setStatus] = useState<Status>("off");
  // Latest callbacks for the long-lived vision handler.
  const cb = useRef({ onVisionEvent, onCvStatus, onPerfSample });
  cb.current = { onVisionEvent, onCvStatus, onPerfSample };

  useEffect(() => () => stopRef.current?.(), []);

  async function start() {
    const v = video.current!;
    setStatus("starting");
    let stream: MediaStream;
    try {
      stream = await openCamera(v);
    } catch {
      setStatus("failed");
      return cb.current.onCvStatus({ type: "cv_status", state: "no_camera", sinceMs: 0 });
    }
    let handle: VisionHandle;
    try {
      handle = await startVision({
        video: v,
        forceMainThread: new URLSearchParams(location.search).get("cv") === "main",
        showHands: true,
        extraGestures,
        onMessage: (m) => {
          if (m.type === "hands") {
            const c = overlay.current;
            const ctx = c?.getContext("2d");
            if (!c || !ctx) return;
            if (c.width !== v.videoWidth) [c.width, c.height] = [v.videoWidth, v.videoHeight];
            ctx.clearRect(0, 0, c.width, c.height);
            return drawHands(ctx, m.hands);
          }
          if (m.type === "cv_status") return cb.current.onCvStatus(m);
          if (m.type === "perf_sample") return cb.current.onPerfSample(m);
          if (m.type === "features") return;
          if ("cursor" in m && dot.current) {
            dot.current.style.display = "block";
            dot.current.style.left = `${m.cursor.x * 100}%`;
            dot.current.style.top = `${m.cursor.y * 100}%`;
          } else if (dot.current && (m.type === "tracking_lost" || (m.type === "hand_count" && m.n === 0))) {
            dot.current.style.display = "none";
          }
          cb.current.onVisionEvent(m);
        },
      });
    } catch {
      stopCamera(stream);
      return setStatus("failed");
    }
    onVisionReady(handle, { width: v.videoWidth, height: v.videoHeight });
    setStatus("running");
    stopRef.current = () => {
      onVisionReady(null);
      overlay.current?.getContext("2d")?.clearRect(0, 0, overlay.current.width, overlay.current.height);
      handle.stop();
      stopCamera(stream);
      stopRef.current = undefined;
      cb.current.onCvStatus(null);
      setStatus("off");
    };
  }

  const running = status === "running";
  return (
    <section
      aria-label="Camera preview"
      className={`card absolute bottom-4 left-4 z-20 overflow-hidden border-[6px] border-surface bg-[#d9d2c4] transition-all ${
        expanded ? "h-[216px] w-[384px] opacity-100" : "h-[144px] w-[256px] opacity-80 hover:opacity-100"
      }`}
    >
      <video ref={video} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" muted playsInline />
      <canvas ref={overlay} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <div ref={dot} aria-hidden className="absolute hidden size-2.5 -translate-1/2 rounded-full bg-white" />
      {expanded && running && (
        // Hand silhouette guide: where an open palm about 40 cm away sits.
        <div aria-hidden className="absolute top-1/2 left-1/2 h-3/5 w-1/4 -translate-1/2 rounded-t-full border-2 border-dashed border-white/60" />
      )}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-text">
        <span aria-hidden className={`size-2 rounded-full ${running ? "bg-success" : "bg-text-muted"}`} />
        {running ? "Tracking" : "Paused"}
      </div>
      {running ? (
        <button
          type="button"
          className="absolute right-1.5 bottom-1.5 rounded-full bg-surface px-2 py-0.5 text-xs text-text underline"
          onClick={() => stopRef.current?.()}
        >
          Camera off
        </button>
      ) : (
        <button
          type="button"
          className="btn absolute inset-0 m-auto h-fit w-fit"
          disabled={status === "starting"}
          onClick={start}
        >
          {status === "failed" ? "Camera blocked: retry" : status === "starting" ? "Starting…" : "Start camera"}
        </button>
      )}
    </section>
  );
}
