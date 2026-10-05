"use client";

/**
 * Prototype page (doc 17). M5: the primitive scene driven by the mouse and keyboard, with a scene
 * event console, a "next drag ends as lost" toggle for the reason:"lost" path, and a React commit
 * counter for the zero-commits-during-drag acceptance. The camera panel runs alongside; M7 joins them.
 */
import { ModelManifestSchema } from "@grasp/content";
import { LessonScene, type LessonSceneReadyHandle } from "@grasp/scene";
import type { InteractionEvent, SceneEvent } from "@grasp/types";
import { createMouseAdapter } from "@grasp/vision";
import { Profiler, useEffect, useRef, useState } from "react";
import protoPrimitives from "../../../../content/models/proto_primitives.json";
import { CameraPanel } from "./camera-panel";

const manifest = ModelManifestSchema.parse(protoPrimitives);
const LOG_LINES = 12;

function describe(e: SceneEvent): string {
  const t = `${(e.t / 1000).toFixed(2)}s`;
  switch (e.type) {
    case "place":
      return `${t} place ${e.componentId} → ${e.socketId}`;
    case "drop":
      return `${t} drop ${e.componentId} cause=${e.cause} at [${e.position.join(", ")}]`;
    case "select":
      return `${t} select ${e.componentId ?? e.hotspotId} (${e.method})`;
    case "hover":
      return `${t} hover ${e.componentId}`;
  }
}

export function PrototypeClient() {
  const [log, setLog] = useState<string[]>([]);
  const [armLost, setArmLost] = useState(false);
  const armLostRef = useRef(false);
  armLostRef.current = armLost;
  const commits = useRef(0);
  const dragging = useRef(false);
  const dragCommits = useRef<HTMLSpanElement>(null);
  const dispose = useRef<() => void>(undefined);

  useEffect(() => () => dispose.current?.(), []);

  function onReady(handle: LessonSceneReadyHandle) {
    const route = (e: InteractionEvent) => {
      // Count commits from the first move to the release; the "Grabbed" announcement is not part of the drag.
      if (e.type === "grab_start") dragging.current = false;
      if (e.type === "grab_move" && !dragging.current) [dragging.current, commits.current] = [true, 0];
      if (e.type === "grab_end") {
        if (dragCommits.current) dragCommits.current.textContent = String(commits.current);
        if (armLostRef.current) {
          setArmLost(false);
          return handle.dispatch({ ...e, reason: "lost" }); // stands in for the worker's grace expiry
        }
      }
      handle.dispatch(e);
    };
    dispose.current = createMouseAdapter(handle.canvas, route).dispose;
  }

  return (
    <main className="grid h-screen grid-cols-[1fr_auto]">
      <div className="grid min-h-0 grid-rows-[1fr_auto]">
        <Profiler id="scene" onRender={() => void (commits.current += 1)}>
          <LessonScene
            manifest={manifest}
            onReady={onReady}
            onSceneEvent={(e) => {
              console.log("scene", e);
              setLog((l) => [...l, describe(e)].slice(-LOG_LINES));
            }}
          />
        </Profiler>
        <section className="bg-surface p-4 font-mono text-xs" aria-label="Scene events">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span>Drag a part into a ring (mouse), or Tab / Space / arrows.</span>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={armLost} onChange={(e) => setArmLost(e.target.checked)} />
              next drag ends as lost
            </label>
            <span>
              React commits during last drag: <span ref={dragCommits}>n/a</span>
            </span>
          </div>
          <ol className="h-28 overflow-y-auto" aria-live="polite">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </section>
      </div>
      <CameraPanel />
    </main>
  );
}
