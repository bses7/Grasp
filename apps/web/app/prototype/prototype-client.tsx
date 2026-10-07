"use client";

/**
 * Prototype page (doc 17).
 * M5: the primitive scene driven by the mouse and keyboard, a "next drag ends as lost" toggle for the
 *     reason:"lost" path, and a React commit counter for the zero-commits-during-drag acceptance.
 * M6: the hand cursor drives hover, and the scene answers the worker's hover_result.
 * M7: `?input=gesture` (default) or `?input=mouse` picks the one adapter that drives the scene; the scene
 *     code is identical for both. Reset and per-run counters support the nine-of-ten placement runs.
 * M8: the learning engine grades scene events against content/lessons/anatomy/heart/prototype_v0.json and
 *     the HUD card shows each verdict; the app wires scene → engine → scene, the two packages never meet.
 * M9: the scene is the real heart GLB named by the lesson's modelId (heart_v1).
 * M10: every interaction, scene and engine event goes to a SessionLogger in the research LogEvent shape;
 *      "Download event log" saves it, and scripts/research/replay-log.ts re-grades it.
 * The keyboard works in both modes (accessibility, doc 05 section 7).
 */
import { loadLesson, loadManifest } from "@grasp/content";
import { maxAttemptsFor, SessionLogger, TaskRunner, type Verdict } from "@grasp/learning";
import { LessonScene, type CursorSpace, type LessonSceneReadyHandle } from "@grasp/scene";
import type { InteractionEvent, PerfSample, SceneEvent } from "@grasp/types";
import { createMouseAdapter, DRACO_DECODER_URL, VISION_CONSTANTS, type VisionHandle } from "@grasp/vision";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Profiler, useEffect, useRef, useState } from "react";
import { FeedbackCard, type FeedbackCardProps } from "@/components/hud/feedback-card";
import { downloadJson } from "@/lib/download";
import { CameraPanel } from "./camera-panel";

// M9: the lesson names its model; the page has no model-specific code.
const lesson = loadLesson("anatomy.heart.prototype_v0");
const manifest = loadManifest(lesson.modelId);
const activityScene = lesson.activities[0]!.scene;
const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "/models";
const nameOf = (id: string | null) => manifest.components.find((c) => c.id === id)?.name ?? "that part";

function newRunner() {
  const r = new TaskRunner(lesson, { sessionId: "prototype", lessonHash: "dev" });
  r.start(performance.now());
  return r;
}

/** Doc 11 feedback copy; the outcome itself comes from the engine. */
function feedbackText(v: Verdict): string {
  const out = v.result.feedback.outcome;
  const tail = v.next === "next_task" && out !== "correct" ? " Out of attempts, moving on." : "";
  if (out === "correct") return `${nameOf(v.componentId)} is in the right place.`;
  if (out === "partial") return `Right part, wrong place. Try another spot.${tail}`;
  return `Not this one. That is the ${nameOf(v.componentId).toLowerCase()}.${tail}`;
}
const VIEWPORT = { videoAspect: VISION_CONSTANTS.CAMERA.width / VISION_CONSTANTS.CAMERA.height };
const LOG_LINES = 12;

type Run = { places: number; dropRelease: number; dropLost: number; placed: Set<string> };
const newRun = (): Run => ({ places: 0, dropRelease: 0, dropLost: 0, placed: new Set() });

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

function summary(n: number, r: Run): string {
  return `run ${n}: ${r.placed.size}/3 placed, ${r.places} place, ${r.dropRelease} drop(release), ${r.dropLost} drop(lost)`;
}

export function PrototypeClient() {
  const input = useSearchParams().get("input") === "mouse" ? "mouse" : "gesture";
  const [log, setLog] = useState<string[]>([]);
  const [run, setRun] = useState<Run>(newRun);
  const [runs, setRuns] = useState<string[]>([]);
  const [armLost, setArmLost] = useState(false);
  const armLostRef = useRef(false);
  armLostRef.current = armLost;
  const commits = useRef(0);
  const dragging = useRef(false);
  const dragCommits = useRef<HTMLSpanElement>(null);
  const dispose = useRef<() => void>(undefined);
  const scene = useRef<LessonSceneReadyHandle | null>(null);
  const vision = useRef<VisionHandle | null>(null);
  const runner = useRef<TaskRunner | null>(null);
  runner.current ??= newRunner();
  // One session log per page load and input mode (the condition). Created on the client only.
  const logger = useRef<SessionLogger | null>(null);
  const L = () => {
    if (logger.current?.condition !== input) logger.current = new SessionLogger(crypto.randomUUID(), input, performance.now());
    return logger.current;
  };
  /** The component the scene grabbed during the current dispatch (from its select event). */
  const grabbed = useRef<string | null>(null);

  function logTaskStart(r: TaskRunner) {
    const task = r.task;
    const activity = r.activity;
    if (!task || !activity) return;
    L().log(
      "task_start",
      { taskId: task.id, taskType: task.type, objectiveId: task.objectiveId, activityId: activity.id, activityKind: activity.kind },
      performance.now(),
    );
  }

  // Session start: device_info for the mouse condition (the gesture one logs it when the camera is ready), first task.
  const started = useRef<SessionLogger | null>(null);
  useEffect(() => {
    const log = L();
    if (started.current === log) return; // React dev double-mount
    started.current = log;
    if (input === "mouse") {
      log.log("device_info", { ua: navigator.userAgent, gpuTier: null, cameraWidth: null, cameraHeight: null, workerPath: false }, performance.now());
    }
    logTaskStart(runner.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  /**
   * Every interaction event, from the mouse or the hand, goes through here: log it, then hand it to the scene.
   * grab_start is logged after dispatch so it carries what the scene grabbed (null: empty space or a miss).
   */
  function interact(e: InteractionEvent, space: CursorSpace) {
    const now = e.t ?? performance.now();
    const log = L();
    if (e.type === "grab_start") {
      grabbed.current = null;
      scene.current?.dispatch(e, space);
      log.grabStart(grabbed.current, e.cursor, now);
      return;
    }
    if (e.type === "grab_move") log.grabMove(e.cursor, e.zHintDelta, now);
    else if (e.type === "grab_end") log.grabEnd(e.reason, now);
    else if (e.type === "tracking_lost") log.trackingLost(now);
    else if (e.type === "tracking_regained") log.trackingRegained(now);
    else if (e.type === "hand_count") log.log("hand_count", { n: e.n }, now);
    scene.current?.dispatch(e, space);
  }
  const [card, setCard] = useState<FeedbackCardProps>(() => cardFor(runner.current!, null));

  function cardFor(r: TaskRunner, feedback: FeedbackCardProps["feedback"]): FeedbackCardProps {
    const task = r.task;
    const n = task ? r.attempts.filter((a) => a.taskId === task.id).length : 0;
    return { prompt: task?.prompt ?? null, attempt: task && r.activity ? { n, max: maxAttemptsFor(r.activity, task) } : null, feedback };
  }

  useEffect(() => () => dispose.current?.(), []);

  function onReady(handle: LessonSceneReadyHandle) {
    scene.current = handle;
    if (input !== "mouse") return;
    const route = (e: InteractionEvent) => {
      // Count commits from the first move to the release; the "Grabbed" announcement is not part of the drag.
      if (e.type === "grab_start") dragging.current = false;
      if (e.type === "grab_move" && !dragging.current) [dragging.current, commits.current] = [true, 0];
      if (e.type === "grab_end") {
        if (dragCommits.current) dragCommits.current.textContent = String(commits.current);
        if (armLostRef.current) {
          setArmLost(false);
          return interact({ ...e, reason: "lost" }, "canvas"); // stands in for the worker's grace expiry
        }
      }
      interact(e, "canvas");
    };
    dispose.current = createMouseAdapter(handle.canvas, route).dispose;
  }

  function onSceneEvent(e: SceneEvent) {
    console.log("scene", e);
    if (e.type === "hover") return; // frequent with a live cursor; the tint shows it
    setLog((l) => [...l, describe(e)].slice(-LOG_LINES));
    const log = L();
    if (e.type === "select") {
      grabbed.current = e.componentId ?? null;
      log.log("select", { componentId: e.componentId ?? null, hotspotId: e.hotspotId ?? null, method: e.method }, e.t);
    } else if (e.type === "place") {
      log.log("place", { componentId: e.componentId, socketId: e.socketId }, e.t);
    } else if (e.type === "drop") {
      log.log("drop", { componentId: e.componentId, cause: e.cause }, e.t); // no position (doc 14)
    }

    const verdict = runner.current!.onSceneEvent(e);
    if (verdict) {
      const { result, task } = verdict;
      log.log(
        "task_attempt",
        {
          taskId: task.id,
          taskType: task.type,
          attemptNo: verdict.attemptNo,
          correct: result.correct,
          partial: result.partial,
          score: result.score,
          hintsUsed: 0,
          componentId: result.feedback.actual.componentId ?? null,
          socketId: result.feedback.actual.socketId ?? null,
        },
        e.t,
      );
      if (verdict.next !== "retry") {
        log.log("task_end", { taskId: task.id, outcome: result.correct ? "correct" : "incorrect" }, e.t);
        logTaskStart(runner.current!);
      }
      const { outcome } = verdict.result.feedback;
      if (verdict.componentId) scene.current?.apply({ type: "highlight", ids: [verdict.componentId], style: outcome });
      setCard(cardFor(runner.current!, { outcome, text: feedbackText(verdict) }));
    }
    if (e.type === "place" || e.type === "drop") {
      setRun((r) => {
        const placed = new Set(r.placed);
        if (e.type === "place") placed.add(e.componentId);
        else placed.delete(e.componentId);
        return {
          places: r.places + (e.type === "place" ? 1 : 0),
          dropRelease: r.dropRelease + (e.type === "drop" && e.cause === "release" ? 1 : 0),
          dropLost: r.dropLost + (e.type === "drop" && e.cause === "lost" ? 1 : 0),
          placed,
        };
      });
    }
  }

  function resetRun() {
    L().log("scene_reset", { taskId: runner.current?.task?.id ?? null }, performance.now());
    scene.current?.apply({ type: "reset" });
    runner.current = newRunner();
    logTaskStart(runner.current);
    setCard(cardFor(runner.current, null));
    setRuns((rs) => [...rs, summary(rs.length + 1, run)]);
    setRun(newRun());
    setLog([]);
  }

  return (
    // Keyed on the mode: switching remounts the scene so exactly one adapter is attached.
    <main key={input} className="grid h-screen grid-cols-[1fr_auto]">
      <div className="grid min-h-0 grid-rows-[1fr_auto]">
        <div className="relative min-h-0">
        <FeedbackCard {...card} />
        <Profiler id="scene" onRender={() => void (commits.current += 1)}>
          <LessonScene
            manifest={manifest}
            pose={activityScene.pose}
            socketVisual={activityScene.socketVisual}
            allowGrab={activityScene.allowGrab}
            assetBaseUrl={ASSET_BASE_URL}
            dracoDecoderPath={DRACO_DECODER_URL}
            viewport={VIEWPORT}
            onReady={onReady}
            onHoverResult={(r) => vision.current?.postHoverResult(r)}
            onSceneEvent={onSceneEvent}
          />
        </Profiler>
        </div>
        <section className="bg-surface p-4 font-mono text-xs" aria-label="Scene events">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span>
              input: <b>{input}</b> (
              <Link className="underline" href={input === "mouse" ? "?input=gesture" : "?input=mouse"} prefetch={false}>
                switch to {input === "mouse" ? "gesture" : "mouse"}
              </Link>
              )
            </span>
            <span>
              {input === "gesture"
                ? "Start the camera, then pinch a part, drag it into a ring, open your hand."
                : "Drag a part into a ring."}{" "}
              Keyboard: Tab / Space / arrows, R resets.
            </span>
            <button type="button" className="rounded bg-accent px-3 py-1 text-bg" onClick={resetRun}>
              Reset (next run)
            </button>
            <button
              type="button"
              className="rounded bg-surface px-3 py-1 underline"
              onClick={() => {
                const log = L();
                downloadJson(`grasp-log-${log.condition}-${log.sessionId.slice(0, 8)}.json`, log.events);
              }}
            >
              Download event log
            </button>
            {input === "mouse" && (
              <>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={armLost} onChange={(e) => setArmLost(e.target.checked)} />
                  next drag ends as lost
                </label>
                <span>
                  React commits during last drag: <span ref={dragCommits}>n/a</span>
                </span>
              </>
            )}
          </div>
          <p className="mb-1 text-sm">
            {summary(runs.length + 1, run)}
            {run.placed.size === 3 && " ✓ all placed"}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <ol className="h-28 overflow-y-auto" aria-live="polite">
              {log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            <ol className="h-28 overflow-y-auto" aria-label="Completed runs">
              {runs.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      {input === "gesture" && (
        <CameraPanel
          onVisionReady={(h, camera) => {
            vision.current = h;
            if (h && camera) {
              L().log(
                "device_info",
                { ua: navigator.userAgent, gpuTier: null, cameraWidth: camera.width, cameraHeight: camera.height, workerPath: h.path === "worker" },
                performance.now(),
              );
            }
          }}
          onVisionEvent={(e) => interact(e, "camera")}
          onPerfSample={({ type: _, ...sample }: PerfSample) => L().log("perf_sample", sample, performance.now())}
        />
      )}
    </main>
  );
}
