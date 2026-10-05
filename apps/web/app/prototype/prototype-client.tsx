"use client";

/**
 * M0 acceptance readout (doc 17): frames rendered (must stop when the pointer stops), same-origin
 * MediaPipe and Draco assets answer 200, and the vision worker bundles and starts.
 */
import { PrototypeCanvas } from "@grasp/scene";
import {
  DRACO_DECODER_URL,
  HAND_LANDMARKER_TASK_URL,
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_URL,
  type WorkerOutbound,
} from "@grasp/vision";
import { useEffect, useRef, useState } from "react";
import { CameraPanel } from "./camera-panel";

const ASSETS = [
  HAND_LANDMARKER_TASK_URL,
  `${MEDIAPIPE_WASM_URL}/vision_wasm_internal.wasm`,
  `${DRACO_DECODER_URL}draco_decoder.wasm`,
];

export function PrototypeClient() {
  const frames = useRef(0);
  const frameText = useRef<HTMLSpanElement>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [worker, setWorker] = useState("starting");

  useEffect(() => {
    for (const url of ASSETS) {
      fetch(url, { method: "HEAD" })
        .then((r) => String(r.status))
        .catch(() => "failed")
        .then((status) => setAssets((a) => ({ ...a, [url]: status })));
    }

    // Bundling check only: the worker's init handler posts cv_status, then hits its M4 TODO.
    const w = new Worker(new URL("@grasp/vision/worker", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      if (e.data.type === "cv_status") setWorker(`loaded (cv_status: ${e.data.state})`);
    };
    w.onerror = (e) => {
      e.preventDefault();
      setWorker((s) => (s.startsWith("loaded") ? `${s}; init is a TODO until M4` : `error: ${e.message}`));
    };
    w.postMessage({ type: "init", wasmBaseUrl: MEDIAPIPE_WASM_URL, modelAssetPath: HAND_LANDMARKER_TASK_URL });
    return () => w.terminate();
  }, []);

  return (
    <main className="grid h-screen grid-rows-[1fr_auto]">
      <div className="grid min-h-0 grid-cols-[1fr_auto]">
        <PrototypeCanvas
          onFrame={() => {
            frames.current += 1;
            if (frameText.current) frameText.current.textContent = String(frames.current);
          }}
        />
        <CameraPanel />
      </div>
      <section className="bg-surface p-4 font-mono text-sm" aria-live="polite">
        <p>
          frames rendered: <span ref={frameText}>0</span>{" "}
          <span className="text-text-muted">(stops when the pointer stops)</span>
        </p>
        <p>mediapipe {MEDIAPIPE_VERSION}</p>
        {ASSETS.map((url) => (
          <p key={url}>
            {url}: {assets[url] ?? "…"}
          </p>
        ))}
        <p>worker: {worker}</p>
      </section>
    </main>
  );
}
