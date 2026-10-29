"use client";

/**
 * Learning environment (doc 11 wireframe, "Heart studio" look; roadmap Phase 4 step 4.4). One lesson, driven by the
 * TaskRunner: each activity sets the scene (pose, grab, orbit, sockets, visible parts), the HUD shows the level path,
 * mission card, hint button and card, feedback burst or card, hand-state chip, camera preview and controls strip, and the
 * seven failure states of doc 11 "Failure states on screen" appear here. The app wires scene → engine → scene;
 * the two packages never meet. Every event goes to a SessionLogger (download at the end).
 * Step 4.5: the page first creates or resumes the server session (POST /api/session), then resumes the runner
 * from its attempt log; attempts go to /api/attempts and events to /api/events through the logger transport.
 * Without a database the lesson still runs, unsaved, and says so.
 * Step 4.6: the lesson (and so the camera) starts only for a session with a consent record; otherwise the page goes
 * to /consent. Events are sent only with logging consent; attempts are always saved. The results show the
 * participant code for deletion or export requests.
 * ponytail: no pause overlay, settings sheet, Explain pill (Phase 5), 3rd-misfire calibration replay, or the
 * "three hovers without a commit" confusion signal yet; each is additive to this file.
 */
import { loadLesson, loadManifest } from "@grasp/content";
import { computeMastery, maxAttemptsFor, SessionLogger, TaskRunner, TIME_PROMPT_MS, type Verdict } from "@grasp/learning";
import { landmarkToNdc, LessonScene, SCENE_CONSTANTS, type CursorSpace, type LessonSceneReadyHandle } from "@grasp/scene";
import type { CvStatus as CvStatusMessage, Hint, InteractionEvent, SceneEvent } from "@grasp/types";
import { createMouseAdapter, DRACO_DECODER_URL, VISION_CONSTANTS, type VisionHandle } from "@grasp/vision";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Profiler, useEffect, useReducer, useRef, useState } from "react";
import { CameraPreview } from "@/components/hud/camera-preview";
import { CvStatus, type HandState } from "@/components/hud/cv-status";
import { OutcomeIcon, ROLE } from "@/components/hud/feedback-card";
import { HintCard } from "@/components/hud/hint-card";
import { ApiError, createSession, postAttempts, restartSession, updateSession, type SessionInfo } from "@/lib/api-client";
import { downloadJson } from "@/lib/download";
import { createLoggerTransport, type LoggerTransport } from "@/lib/logger-transport";

const ASSET_BASE_URL = process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "/models";
const VIEWPORT = { videoAspect: VISION_CONSTANTS.CAMERA.width / VISION_CONSTANTS.CAMERA.height };
const BANNER_MS = 4000;
const IDLE_HINT_MS = 15_000;
const NO_HAND_MS = { task: 3000, introduction: 10_000 };
const OFFER_MOUSE_MS = { noHand: 20_000, lowLight: 30_000 };
/** Introduction narration cards advance on their own (the activity completes by time), paused while held. */
const NARRATION_CARD_MS = 7000;
/** Card buttons that end a task need a longer hand dwell than the default (doc 11). */
const LONG_DWELL_MS = 1500;

/** `at` replays the burst animation for back-to-back correct answers; `headline` is the burst text. */
type Banner = { kind: "correct" | "partial" | "incorrect" | "recorded" | "info"; text: string; headline?: string; at?: number };

type Boot = Omit<SessionInfo, "contentChanged"> & { saved: boolean };

/** localStorage keeps the sessionId as the cookie's fallback (doc 03); wrapped because storage can throw. */
const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: the cookie alone carries the session */
    }
  },
};

/** One request per lesson and condition at a time: React's dev double mount must not race two inserts. */
const inflight = new Map<string, Promise<SessionInfo>>();

/** Creates or resumes the session for this lesson and condition, then mounts the lesson keyed on it. */
export function LessonClient({ lessonId }: { lessonId: string }) {
  const input = useSearchParams().get("input") === "mouse" ? "mouse" : "gesture";
  const router = useRouter();
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => {
    let alive = true;
    setBoot(null);
    const key = `grasp.session.${lessonId}.${input}`;
    let request = inflight.get(key);
    if (!request) {
      request = createSession({ sessionId: storage.get(key) ?? crypto.randomUUID(), lessonId, condition: input });
      inflight.set(key, request);
      void request.catch(() => {}).finally(() => inflight.delete(key));
    }
    request
      .then((s) => {
        storage.set(key, s.sessionId);
        if (alive) setBoot({ ...s, saved: true });
      })
      .catch((err) => {
        if (!alive) return;
        // No consented session: consent comes first. A database outage after consent in this tab runs unsaved.
        let consented = false;
        try {
          consented = !!sessionStorage.getItem("grasp.consent");
        } catch {
          /* storage blocked: treat as not consented */
        }
        if ((err instanceof ApiError && err.status === 404) || !consented) return router.replace("/consent");
        console.warn("session not saved:", err);
        const sessionId = crypto.randomUUID();
        let logging = false;
        try {
          logging = sessionStorage.getItem("grasp.consent.logging") === "1";
        } catch {
          /* unknown: treat as declined */
        }
        setBoot({ sessionId, resumed: false, condition: input, studyPhase: "dev", consentLogging: logging, participantCode: null, lessonHash: "unsaved", elapsedMs: 0, nextSeq: 0, attempts: [], skipped: [], saved: false });
      });
    return () => {
      alive = false;
    };
  }, [lessonId, input, router]);
  if (!boot) return <main className="grid h-screen place-items-center bg-bg text-text-muted">Loading the lesson…</main>;
  return <LessonRun key={`${boot.sessionId}-${input}`} lessonId={lessonId} input={input} boot={boot} />;
}

function LessonRun({ lessonId, input, boot }: { lessonId: string; input: "gesture" | "mouse"; boot: Boot }) {
  // ?cells=off for the pre-pilot backdrop measurement (doc 11): blood cells on vs off, same session.
  const cells = useSearchParams().get("cells") !== "off";
  // Read once per mount; LessonRun only renders in the browser (after the session request).
  const [reducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [{ lesson, manifest }] = useState(() => {
    const l = loadLesson(lessonId);
    return { lesson: l, manifest: loadManifest(l.modelId) };
  });
  const nameOf = (id: string | null | undefined) =>
    manifest.components.find((c) => c.id === id)?.name ?? manifest.hotspots.find((h) => h.id === id)?.label ?? "that part";

  const [, render] = useReducer((n: number) => n + 1, 0);
  const t0 = useRef(0);
  const runner = useRef<TaskRunner | null>(null);
  const logger = useRef<SessionLogger | null>(null);
  const scene = useRef<LessonSceneReadyHandle | null>(null);
  const vision = useRef<VisionHandle | null>(null);
  const disposeMouse = useRef<() => void>(undefined);
  const now = () => performance.now() - t0.current;

  const [banner, setBanner] = useState<Banner | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintPulse, setHintPulse] = useState(false);
  const [narration, setNarration] = useState(0);
  const [gestureLabel, setGestureLabel] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<Verdict | null>(null);
  const [timePrompt, setTimePrompt] = useState(false);
  const [hand, setHand] = useState<HandState>("NO_HAND");
  const handRef = useRef<HandState>("NO_HAND");
  const [cv, setCv] = useState<CvStatusMessage | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  // Failure states 1 and 2: which card shows, and whether the mouse is offered.
  const [alert, setAlert] = useState<{ kind: "no_hand" | "low_light"; offerMouse: boolean } | null>(null);

  // Per-task and per-drag bookkeeping read by handlers; never React state (zero commits during a drag).
  // React commits, counted by the Profiler around the page for the A9 drag check (development builds only).
  const commits = useRef(0);
  const m = useRef({
    activityId: "",
    activityAt: 0,
    /** When the narration card last changed, and whether the pointer or hand is over the instruction panel. */
    cardAt: 0,
    cardHold: false,
    taskId: "",
    /** The page control the pointing hand is dwelling on (doc 05 dwell, applied to HUD buttons). */
    uiDwell: null as { el: HTMLElement; since: number } | null,
    /** A pinch that started on a page control clicked it; its moves and release stay out of the scene. */
    pinchOnControl: false,
    lastActionAt: 0,
    falseStarts: 0,
    drag: null as { componentId: string | null; moved: boolean; moves: number; commitsAt?: number } | null,
    grabbed: null as string | null,
    noHandSince: null as number | null,
    lowLightSince: null as number | null,
    prompted: false,
    masteryLogged: false,
  });

  // One runner, logger and transport per session. t0 puts now() on the session clock (ms since it started), so a
  // resumed log and attempt times continue where the last page load stopped; the logger's own t0 is therefore 0.
  const transport = useRef<LoggerTransport | null>(null);
  const attemptIds = useRef<string[]>([]);
  const savedAttempts = useRef(boot.attempts.length);
  if (!runner.current) {
    t0.current = performance.now() - boot.elapsedMs;
    runner.current = new TaskRunner(lesson, { sessionId: boot.sessionId, lessonHash: boot.lessonHash });
    if (boot.attempts.length || boot.skipped.length) runner.current.resume(boot.attempts, boot.skipped, now());
    else runner.current.start(now());
    m.current.masteryLogged = runner.current.done; // a reload of the results screen does not log mastery again
    logger.current = new SessionLogger(boot.sessionId, input, 0, (e) => transport.current?.enqueue(e), boot.nextSeq);
  }
  const r = runner.current;
  const log = logger.current!;
  // Created per mount (React's dev double mount disposes the first); the logger's sink reads the live one.
  useEffect(() => {
    if (!boot.saved) return;
    const tr = (transport.current = createLoggerTransport(() => boot.consentLogging));
    return () => {
      tr.dispose();
      transport.current = null;
    };
  }, [boot.saved]);

  // On page close, beacon any attempt not yet saved, so a reload resumes with it (the ids keep it idempotent).
  useEffect(() => {
    if (!boot.saved) return;
    const onHide = () => {
      const from = savedAttempts.current;
      const rest = r.attempts.slice(from).map((a, i) => ({ ...a, id: (attemptIds.current[from + i] ??= crypto.randomUUID()) }));
      for (let i = 0; i < rest.length; i += 50) navigator.sendBeacon("/api/attempts", JSON.stringify({ attempts: rest.slice(i, i + 50) }));
    };
    addEventListener("pagehide", onHide);
    return () => removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot.saved]);

  /** Send attempts not yet saved; each keeps one client id, so a retry never duplicates a row. */
  const posting = useRef(false);
  function saveAttempts() {
    if (!boot.saved || posting.current || savedAttempts.current >= r.attempts.length) return;
    const from = savedAttempts.current;
    const batch = r.attempts.slice(from, from + 50).map((a, i) => ({ ...a, id: (attemptIds.current[from + i] ??= crypto.randomUUID()) }));
    posting.current = true;
    postAttempts(batch)
      .then(() => void (savedAttempts.current = from + batch.length))
      .catch((err) => console.warn("attempts not saved yet:", err))
      .finally(() => void (posting.current = false));
  }

  function showBanner(b: Banner | null) {
    clearTimeout(bannerTimer.current);
    setBanner(b);
    if (b) bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS);
  }

  /** Log activity and task boundaries after any runner change, and reset per-task HUD state. */
  function sync() {
    const t = now();
    const a = r.activity;
    if (a && a.id !== m.current.activityId) {
      if (m.current.activityId) log.log("activity_end", { activityId: m.current.activityId }, t);
      log.log("activity_start", { activityId: a.id, activityKind: a.kind }, t);
      m.current.activityId = a.id;
      m.current.activityAt = m.current.cardAt = t;
      setNarration(0);
      m.current.lastActionAt = t;
    }
    const task = r.task;
    if ((task?.id ?? "") !== m.current.taskId) {
      m.current.taskId = task?.id ?? "";
      m.current.falseStarts = 0;
      m.current.lastActionAt = t;
      setHint(null);
      setHintPulse(false);
      setGestureLabel(null);
      if (task && a) {
        log.log("task_start", { taskId: task.id, taskType: task.type, objectiveId: task.objectiveId, activityId: a.id, activityKind: a.kind }, t);
      }
    }
    if (r.done && !m.current.masteryLogged) {
      m.current.masteryLogged = true;
      const mastery = computeMastery(r.attempts, lesson.objectives, lesson);
      for (const o of lesson.objectives) {
        log.log("mastery_computed", { objectiveId: o.id, mastery: mastery[o.id] ?? null, threshold: o.masteryThreshold }, t);
      }
      void transport.current?.flush();
      if (boot.saved) updateSession(boot.sessionId, { ended: true }).catch((err) => console.warn("end not saved:", err));
    }
    saveAttempts();
    render();
  }

  // Session start: device_info for the mouse condition (the gesture one logs it when the camera starts).
  useEffect(() => {
    if (input === "mouse") log.log("device_info", { gpuTier: null, cameraWidth: null, cameraHeight: null, workerPath: false }, now());
    if (boot.resumed && (boot.attempts.length || boot.skipped.length)) showBanner({ kind: "info", text: "Welcome back. You are where you left off." });
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Clock: time-completed activities, failure states 1, 2 and 6, and the 15-minute prompt.
  useEffect(() => {
    const id = setInterval(() => {
      const t = now();
      if (r.tick(t)) sync();
      saveAttempts(); // retries a failed save
      const a = r.activity;
      const mm = m.current;
      if (r.task && t - mm.lastActionAt > IDLE_HINT_MS) setHintPulse(true);
      if (a?.narration && !mm.cardHold && t - mm.cardAt >= NARRATION_CARD_MS) {
        mm.cardAt = t;
        setNarration((n) => Math.min(n + 1, a.narration!.length - 1));
      }
      if (!mm.prompted && !r.done && t >= TIME_PROMPT_MS) {
        mm.prompted = true;
        setTimePrompt(true);
      }
      if (input !== "gesture" || !cameraOn || r.done) return setAlert(null);
      const lost = mm.noHandSince !== null ? t - mm.noHandSince : 0;
      const dark = mm.lowLightSince !== null ? t - mm.lowLightSince : 0;
      const wait = a?.kind === "introduction" ? NO_HAND_MS.introduction : NO_HAND_MS.task;
      setAlert((prev) => {
        const next =
          lost >= wait
            ? { kind: "no_hand" as const, offerMouse: lost >= OFFER_MOUSE_MS.noHand }
            : dark > 0
              ? { kind: "low_light" as const, offerMouse: dark >= OFFER_MOUSE_MS.lowLight }
              : null;
        return prev?.kind === next?.kind && prev?.offerMouse === next?.offerMouse ? prev : next;
      });
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, cameraOn]);

  useEffect(() => () => disposeMouse.current?.(), []);

  /**
   * The hand has no mouse button, so a point held on a page control for DWELL_SELECT_MS clicks it, with an
   * accent outline while it fills. Returns true when the cursor is over a control (the scene then gets a
   * plain cursor, so nothing behind the control is dwell-selected).
   */
  function elementAt(cursor: Extract<InteractionEvent, { type: "hover" }>["cursor"]): Element | null {
    const canvas = scene.current?.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const ndc = landmarkToNdc(cursor, { videoAspect: VIEWPORT.videoAspect, canvasAspect: rect.width / rect.height, mirrored: true, reachScale: SCENE_CONSTANTS.REACH_SCALE });
    return document.elementFromPoint(rect.left + ((ndc.x + 1) / 2) * rect.width, rect.top + ((1 - ndc.y) / 2) * rect.height);
  }
  const controlAt = (hit: Element | null) => hit?.closest<HTMLElement>("button:not(:disabled), a[href]") ?? null;

  function dwellOnControl(e: Extract<InteractionEvent, { type: "cursor" | "hover" }>, t: number): boolean {
    const hit = elementAt(e.cursor);
    const el = controlAt(hit);
    const mm = m.current;
    mm.cardHold = !!hit?.closest("[data-hold]");
    if (mm.uiDwell && (mm.uiDwell.el !== el || e.type !== "hover")) {
      mm.uiDwell.el.style.outline = "";
      mm.uiDwell = null;
    }
    if (el && e.type === "hover") {
      mm.uiDwell ??= { el, since: t };
      el.style.outline = "3px solid var(--accent)";
      if (t - mm.uiDwell.since >= (Number(el.dataset.dwellMs) || SCENE_CONSTANTS.DWELL_SELECT_MS)) {
        el.style.outline = "";
        mm.uiDwell = null;
        el.click();
      }
    }
    return !!el;
  }

  function setHandState(s: HandState) {
    if (handRef.current === s) return;
    handRef.current = s;
    setHand(s);
  }

  /** Every interaction event, from the mouse or the hand: log, failure-state bookkeeping, then the scene. */
  function interact(e: InteractionEvent, space: CursorSpace) {
    const t = now();
    const mm = m.current;
    // A pinch on a page control clicks it at once (pinch is deliberate, so even long-dwell buttons like Skip).
    if (space === "camera" && e.type === "grab_start") {
      const el = controlAt(elementAt(e.cursor));
      if (el) {
        mm.pinchOnControl = true;
        el.click();
        return;
      }
    }
    if (mm.pinchOnControl && (e.type === "grab_move" || e.type === "grab_end")) {
      if (e.type === "grab_end") mm.pinchOnControl = false;
      return;
    }
    switch (e.type) {
      case "grab_start":
        mm.grabbed = null;
        scene.current?.dispatch(e, space);
        log.grabStart(mm.grabbed, e.cursor, t);
        mm.drag = { componentId: mm.grabbed, moved: false, moves: 0 };
        mm.lastActionAt = t;
        return setHandState(mm.grabbed ? "GRABBING" : "ORBIT");
      case "grab_move":
        log.grabMove(e.cursor, e.zHintDelta, t);
        // A9 (dev): count commits from the third move, after the one-off "Dragging" state change has committed.
        if (mm.drag && ++mm.drag.moves === 3) mm.drag.commitsAt = commits.current;
        if (mm.drag && !mm.drag.moved) {
          mm.drag.moved = true;
          if (mm.drag.componentId) setGestureLabel(null); // a grab that moves clears "Pinch, then move"
          if (handRef.current === "GRABBING") setHandState("DRAGGING");
        }
        break;
      case "grab_end": {
        log.grabEnd(e.reason, t);
        if (mm.drag?.commitsAt !== undefined && commits.current > mm.drag.commitsAt) {
          console.warn(`A9: ${commits.current - mm.drag.commitsAt} React commits during a ${mm.drag.moves}-move drag (target 0 per frame)`);
        }
        // Failure state 3: a grab released before it moved, the second on this task (never a lost grab).
        const task = r.task;
        if (e.reason === "release" && mm.drag?.componentId && !mm.drag.moved && (task?.type === "place" || task?.type === "remove")) {
          if (++mm.falseStarts >= 2) setGestureLabel(input === "gesture" ? "Pinch, then move" : "Press, then drag");
        }
        mm.drag = null;
        setHandState("IDLE");
        break;
      }
      case "tracking_lost":
        log.trackingLost(t);
        if (mm.drag) showBanner({ kind: "info", text: "Lost your hand. Hold still." });
        setHandState("LOST");
        break;
      case "tracking_regained":
        log.trackingRegained(t);
        if (mm.drag) showBanner({ kind: "info", text: "Welcome back." });
        setHandState(mm.drag?.componentId ? "DRAGGING" : mm.drag ? "ORBIT" : "IDLE");
        break;
      case "hand_count":
        log.log("hand_count", { n: e.n }, t);
        if (e.n === 0) {
          mm.noHandSince ??= t;
          setHandState("NO_HAND");
        } else {
          mm.noHandSince = null;
        }
        break;
      case "cursor":
      case "hover":
        mm.noHandSince = null;
        if (!mm.drag) setHandState(e.type === "hover" ? "HOVER" : "IDLE");
        if (space === "camera" && dwellOnControl(e, t)) return scene.current?.dispatch({ ...e, type: "cursor" }, space);
        break;
    }
    scene.current?.dispatch(e, space);
  }

  function onReady(handle: LessonSceneReadyHandle) {
    scene.current = handle;
    if (input === "mouse") disposeMouse.current = createMouseAdapter(handle.canvas, (e) => interact(e, "canvas")).dispose;
  }

  function feedbackText(v: Verdict): string {
    const out = v.result.feedback.outcome;
    if (v.micro) return "Now try the original task again.";
    const tail = (v.next === "next_task" || v.next === "next_activity" || v.next === "lesson_complete") && out !== "correct" ? " Moving on." : "";
    if (v.task.type === "sequence") return out === "correct" ? "Correct order." : `Not this order. Start again from the first one.${tail}`;
    if (out === "correct") return v.task.type === "place" ? `${nameOf(v.componentId)} is in the right place.` : `That is the ${nameOf(v.componentId).toLowerCase()}.`;
    if (out === "partial") return `Right part, wrong place. Try another spot.${tail}`;
    return `Not this one. That is the ${nameOf(v.componentId).toLowerCase()}.${tail}`;
  }

  function applyHint(h: Hint, source: "earned" | "requested") {
    log.log("hint_shown", { taskId: r.task?.id ?? null, level: h.level, source: "static" }, now());
    setHint(h);
    if (source === "earned") setHintPulse(true);
    if (h.highlight) scene.current?.apply({ type: "highlight", ids: h.highlight });
    if (h.cameraTo) scene.current?.apply({ type: "cameraTo", target: h.cameraTo });
  }

  function onSceneEvent(e: SceneEvent) {
    if (e.type === "hover") return;
    const t = now();
    const mm = m.current;
    mm.lastActionAt = t;
    setHintPulse(false);
    if (e.type === "select") {
      mm.grabbed = e.componentId ?? null;
      log.log("select", { componentId: e.componentId ?? null, hotspotId: e.hotspotId ?? null, method: e.method }, t);
      const task = r.task;
      // Failure state 3: pointing at a part when the task wants it moved.
      if (e.method === "dwell" && e.componentId && (task?.type === "place" || task?.type === "remove")) setGestureLabel("Pinch to grab");
      if (e.hotspotId) {
        const h = manifest.hotspots.find((x) => x.id === e.hotspotId);
        if (h?.body) showBanner({ kind: "info", text: `${h.label}: ${h.body}` });
      }
    } else if (e.type === "place") {
      log.log("place", { componentId: e.componentId, socketId: e.socketId }, t);
    } else if (e.type === "drop") {
      log.log("drop", { componentId: e.componentId, cause: e.cause }, t);
      if (e.cause === "lost") showBanner({ kind: "info", text: "The part was put down where it was." });
    }

    const v = r.onSceneEvent({ ...e, t });
    if (!v) {
      if (r.sequenceProgress) render(); // "Step n of m"
      return;
    }
    const { result, task } = v;
    log.log(
      "task_attempt",
      {
        taskId: task.id,
        taskType: task.type,
        attemptNo: v.attemptNo,
        correct: result.correct,
        partial: result.partial,
        score: result.score,
        hintsUsed: r.hintsUsed,
        componentId: result.feedback.actual.componentId ?? null,
        socketId: result.feedback.actual.socketId ?? null,
      },
      t,
    );
    const assessed = lesson.activities.find((a) => a.tasks.some((x) => x.id === task.id))?.kind === "assessment";
    const outcome = result.feedback.outcome;
    if (v.next === "next_task" || v.next === "next_activity" || v.next === "lesson_complete") {
      log.log("task_end", { taskId: task.id, outcome: result.correct ? "correct" : "incorrect" }, t);
    }
    if (assessed) {
      showBanner({ kind: "recorded", text: "Recorded." });
    } else {
      if (v.componentId) scene.current?.apply({ type: "highlight", ids: [v.componentId], style: outcome });
      showBanner({ kind: outcome, text: feedbackText(v), at: t, headline: task.type === "place" ? "Perfect fit!" : "That's it!" });
      if (v.hint) applyHint(v.hint, "earned");
      else if (!result.correct && v.next === "retry") setHintPulse(true);
    }
    if (v.remediation) setRemediation(v);
    sync();
  }

  function turnCard(step: 1 | -1) {
    m.current.cardAt = now();
    setNarration((n) => n + step);
  }

  function requestHint() {
    const h = r.requestHint();
    if (h) applyHint(h, "requested");
    render();
  }

  function showMe(v: Verdict) {
    const ex = v.remediation!.workedExample.expect as { componentId?: string; socketId?: string; answer?: string };
    const id = ex.componentId ?? ex.answer;
    if (!id) return;
    scene.current?.apply({ type: "cameraTo", target: id });
    scene.current?.apply({ type: "demonstrate", componentId: id, ...(ex.socketId && { socketId: ex.socketId }) });
  }

  function skip() {
    const task = remediation?.task;
    setRemediation(null);
    if (!task) return;
    r.skip(now());
    log.log("task_end", { taskId: task.id, outcome: "skipped" }, now());
    if (boot.saved) updateSession(boot.sessionId, { skip: task.id }).catch((err) => console.warn("skip not saved:", err));
    showBanner({ kind: "info", text: "Skipped for now. It is listed under Review at the end." });
    sync();
  }

  /** The side button that ends the introduction and explore activities (`completion: { continue: true }`). */
  function proceed() {
    if (r.proceed(now())) sync();
  }

  function answerTimePrompt(choice: "continue" | "assess") {
    setTimePrompt(false);
    log.log("time_prompt", { lessonMs: Math.round(now()), activityId: r.activity?.id ?? null, taskId: r.task?.id ?? null, choice }, now());
    if (choice === "assess" && r.toAssessment(now())) sync();
  }

  const activity = r.activity;
  const task = r.task;
  const sceneCfg = activity?.scene ?? lesson.activities[0]!.scene;
  const isAssessment = activity?.kind === "assessment";
  const taskIdx = activity && task ? activity.tasks.indexOf(task) : -1;
  const hintLevels = task && !isAssessment ? task.hints.length : 0;
  const hintsRevealed = task ? task.hints.filter((h) => h.level <= r.hintsUsed).length : 0;
  const cards = activity?.narration ?? [];
  const seqTotal = task?.type === "sequence" ? task.expect.steps.length : 0;
  const instruction =
    task?.prompt ??
    (activity?.kind === "introduction"
      ? (cards[narration] ?? activity.title)
      : activity?.kind === "explore"
        ? "Look around. Turn the heart, and point at a gold marker to read about that part. Start the lesson when you are ready."
        : null);
  const urlFor = (mode: "mouse" | "gesture") => `?input=${mode}`;
  const maxTries = task && activity && !isAssessment ? maxAttemptsFor(activity, task) : 0;
  const dialogOpen = !!remediation || timePrompt || r.done;
  const correct = banner?.kind === "correct" ? banner : null;

  return (
    // Keyed on the mode: switching remounts the scene so exactly one adapter is attached.
    <Profiler id="lesson" onRender={() => void (commits.current += 1)}>
    <main key={input} className="relative h-screen overflow-hidden text-text">
      <Backdrop cells={cells} />
      <div className="absolute inset-0">
        <LessonScene
          manifest={manifest}
          pose={sceneCfg.pose}
          allowGrab={sceneCfg.allowGrab}
          allowOrbit={sceneCfg.allowOrbit}
          socketVisual={sceneCfg.socketsVisible === false ? "none" : sceneCfg.socketVisual}
          visibleComponents={sceneCfg.visibleComponents}
          showHotspots={activity?.kind === "introduction" || activity?.kind === "explore"}
          autoRotate={activity?.kind === "introduction"}
          reducedMotion={reducedMotion}
          assetBaseUrl={ASSET_BASE_URL}
          dracoDecoderPath={DRACO_DECODER_URL}
          viewport={VIEWPORT}
          onReady={onReady}
          onHoverResult={(h) => vision.current?.postHoverResult(h)}
          onSceneEvent={onSceneEvent}
        />
      </div>
      {/* scene-dim (doc 02's 60%) under failure state 1 and every dialog; pointer events pass through. */}
      {(alert?.kind === "no_hand" || dialogOpen) && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[rgb(58_31_43/0.4)]" />}

      <LevelPath activities={lesson.activities} current={r.done ? lesson.activities.length : activity ? lesson.activities.indexOf(activity) : 0} />

      <div className="absolute top-4 right-4 flex items-center gap-3">
        {!boot.saved && (
          <span className="rounded-full border border-dashed border-text-muted bg-surface px-3 py-1 text-xs text-text-muted" title="No database connection: progress is kept in this tab only.">
            Not saving
          </span>
        )}
        {input === "mouse" && <span className="rounded-full bg-surface px-3 py-1 text-sm font-semibold">Mouse and keyboard</span>}
      </div>

      {alert && (
        <div role="alert" className="card absolute top-24 left-1/2 z-10 w-[min(28rem,90%)] -translate-x-1/2 border-2 border-warn-tracking p-4">
          <p>
            {alert.kind === "no_hand"
              ? "Show me your hand. Palm toward the camera, about 40 cm away."
              : "Hard to see your hand. Face a light or move away from the window."}
          </p>
          {alert.offerMouse &&
            (boot.studyPhase === "dev" ? (
              <Link className="mt-2 inline-block text-accent underline" href={urlFor("mouse")} prefetch={false}>
                Trouble? Use the mouse instead
              </Link>
            ) : (
              // A study session's condition is fixed by its code; switching would invalidate it (doc 02 failure state 1).
              <p className="mt-2 font-semibold">Still having trouble? Please call the researcher.</p>
            ))}
        </div>
      )}

      {!r.done && (
        // Left gutter: mission card (the instruction), then the feedback card for partial, incorrect and notices.
        <div className="absolute top-[92px] left-4 flex w-[min(330px,calc(100%-2rem))] flex-col gap-3">
          <section
            aria-label="Instruction"
            data-hold
            onPointerEnter={() => void (m.current.cardHold = true)}
            onPointerLeave={() => void (m.current.cardHold = false)}
            className="card p-4"
          >
            {activity && (
              <p className="text-xs font-semibold tracking-widest text-amber-ink uppercase">
                {KIND_LABEL[activity.kind]}
                {taskIdx >= 0 && ` · Task ${taskIdx + 1} of ${activity.tasks.length}`}
              </p>
            )}
            <h2 className="mt-1 font-display text-[22px] leading-7 font-bold">{instruction}</h2>
            {seqTotal > 0 && r.sequenceProgress > 0 && <p className="mt-1 text-sm text-text-muted">Step {r.sequenceProgress + 1} of {seqTotal}</p>}
            {hintPulse && hintLevels > hintsRevealed && <p className="mt-1 text-sm font-semibold text-accent">Need a hint?</p>}
            {activity?.kind === "introduction" && cards.length > 1 && (
              <div className="mt-3 flex gap-2">
                {narration > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={() => turnCard(-1)}>
                    Back
                  </button>
                )}
                {narration < cards.length - 1 && (
                  <button type="button" className="btn btn-ghost" onClick={() => turnCard(1)}>
                    Next
                  </button>
                )}
              </div>
            )}
            {task && (isAssessment || maxTries > 0) && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-text-muted">
                {isAssessment ? (
                  "1 attempt"
                ) : (
                  <>
                    {Array.from({ length: maxTries }, (_, i) => (
                      <span key={i} aria-hidden className={`size-3.5 rounded-full ${i < maxTries - r.attemptsUsed ? "bg-accent" : "border-2 border-text-muted"}`} />
                    ))}
                    <span className="ml-1">
                      {Math.max(maxTries - r.attemptsUsed, 0)} {maxTries - r.attemptsUsed === 1 ? "try" : "tries"} left
                    </span>
                  </>
                )}
              </p>
            )}
          </section>
          <div role="status" aria-live="polite">
            {banner && !correct && <FeedbackLine banner={banner} />}
          </div>
          {gestureLabel && <p className="w-fit rounded-full bg-surface px-3 py-1 text-sm font-semibold shadow-[var(--shadow-card)]">{gestureLabel}</p>}
        </div>
      )}

      {correct && <Burst key={correct.at} headline={correct.headline ?? "Correct!"} sub={correct.text} />}

      {!r.done && !isAssessment && (
        <div className="absolute top-[92px] right-4">
          <HintCard levels={hintLevels} used={hintsRevealed} hint={hint} pulse={hintPulse} onRequest={requestHint} />
        </div>
      )}

      {activity && !activity.tasks.length && "continue" in activity.completion && !remediation && !timePrompt && (
        // On the side, clear of the model; big enough to point at and hold, or pinch.
        <button type="button" className="btn absolute top-1/2 right-4 -translate-y-1/2 px-7 py-5 text-[20px]" onClick={proceed}>
          {activity.kind === "introduction" ? "Continue →" : "Start the lesson →"}
        </button>
      )}

      {remediation && (
        <div role="dialog" aria-label="Let's look at this together" className="card absolute top-1/2 left-1/2 w-[min(30rem,90%)] -translate-1/2 p-6 text-center">
          <Mascot />
          <h2 className="mt-2 font-display text-[28px] leading-9 font-bold">Let&apos;s look at this together</h2>
          <p className="mt-1 text-text-muted">No points this time, and that is fine.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn" onClick={() => showMe(remediation)}>
              Show me
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setRemediation(null)}>
              Try once more
            </button>
            <button type="button" className="btn btn-ghost" data-dwell-ms={LONG_DWELL_MS} onClick={skip}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {timePrompt && (
        <div role="dialog" aria-label="Time check" className="card absolute top-1/2 left-1/2 w-[min(28rem,90%)] -translate-1/2 p-6">
          <p className="text-lg">You have been working for 15 minutes. Keep going, or go to the final check?</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn" onClick={() => answerTimePrompt("continue")}>
              Keep going
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => answerTimePrompt("assess")}>
              Go to the check
            </button>
          </div>
        </div>
      )}

      {r.done && (
        <Results lesson={lesson} runner={r} nameOfTask={(id) => lesson.activities.flatMap((a) => a.tasks).find((x) => x.id === id)?.prompt ?? id} participantCode={boot.participantCode}
          onTryAgain={
            boot.studyPhase !== "dev"
              ? undefined
              : async () => {
                  transport.current?.dispose(); // send this run's last events first
                  if (boot.saved) {
                    try {
                      const { sessionId } = await restartSession(boot.sessionId);
                      localStorage.setItem(`grasp.session.${lessonId}.${input}`, sessionId);
                    } catch (err) {
                      return console.warn("try again failed:", err);
                    }
                  }
                  location.reload();
                }
          }
          onDownload={!boot.consentLogging ? undefined : () => downloadJson(`grasp-log-${log.condition}-${log.sessionId.slice(0, 8)}.json`, log.events)} />
      )}

      <footer className="absolute bottom-4 left-1/2 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-full bg-surface px-4 py-2 text-sm text-text-muted opacity-80 shadow-[var(--shadow-card)] hover:opacity-100">
        {(input === "gesture" ? GESTURE_KEYS : MOUSE_KEYS).map(([key, verb]) => (
          <span key={verb} className="flex items-center gap-1.5">
            <b className="rounded-md border border-text-muted px-1.5 font-semibold text-text">{key}</b>
            {verb}
          </span>
        ))}
        {boot.studyPhase === "dev" && (
          <Link className="underline" href={urlFor(input === "mouse" ? "gesture" : "mouse")} prefetch={false}>
            Use {input === "mouse" ? "the camera" : "the mouse"}
          </Link>
        )}
      </footer>

      {input === "gesture" && (
        <>
          {/* Hand-state chip sits above the camera preview, whose height doubles while a failure card shows. */}
          <div className={`absolute left-4 z-20 ${alert ? "bottom-[244px]" : "bottom-[172px]"}`}>
            <CvStatus state={cameraOn ? hand : "NO_HAND"} cv={cv} />
          </div>
          <CameraPreview
            expanded={alert !== null}
            onVisionEvent={(e) => interact(e, "camera")}
            onVisionReady={(h, camera) => {
              vision.current = h;
              setCameraOn(!!h);
              m.current.noHandSince = h ? now() : null;
              if (h && camera) {
                log.log("device_info", { gpuTier: null, cameraWidth: camera.width, cameraHeight: camera.height, workerPath: h.path === "worker" }, now());
              }
            }}
            onCvStatus={(s) => {
              setCv(s);
              const t = now();
              if (s?.state === "low_confidence") m.current.lowLightSince ??= t;
              else m.current.lowLightSince = null;
              if (s?.state === "no_hand") m.current.noHandSince ??= t;
            }}
            onPerfSample={({ type: _, ...sample }) => log.log("perf_sample", sample, now())}
          />
        </>
      )}
    </main>
    </Profiler>
  );
}

const KIND_LABEL: Record<string, string> = {
  introduction: "Introduction",
  explore: "Explore",
  guided: "Guided",
  challenge: "Challenge",
  assessment: "Final check",
};
const GESTURE_KEYS = [["☝ hold", "pick"], ["🤏", "grab"], ["🤏 on empty space", "turn"], ["✋", "let go"]] as const;
const MOUSE_KEYS = [["Click", "select"], ["Drag", "move"], ["Drag empty or arrows", "turn"], ["Wheel or + −", "zoom"], ["X", "explode"], ["R", "reset"]] as const;

/** CSS backdrop behind the transparent canvas (doc 11 "Backdrop"): plinth and at most four blood cells in the gutters. */
function Backdrop({ cells }: { cells: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="plinth" />
      {cells && (
        <>
          <div className="cell" style={{ width: 46, height: 46, left: "6%", top: "58%" }} />
          <div className="cell" style={{ width: 28, height: 28, left: "18%", top: "82%", animationDelay: "-3s" }} />
          <div className="cell" style={{ width: 56, height: 56, right: "6%", top: "64%", animationDelay: "-5s" }} />
          <div className="cell" style={{ width: 22, height: 22, right: "20%", top: "86%", animationDelay: "-1.5s" }} />
        </>
      )}
    </div>
  );
}

/** Level path, top centre (doc 11): one node per activity; done, current and upcoming differ in shape, not only colour. */
function LevelPath({ activities, current }: { activities: ReturnType<typeof loadLesson>["activities"]; current: number }) {
  const done = current >= activities.length;
  return (
    <nav aria-label="Lesson progress" className="card absolute top-4 left-1/2 flex -translate-x-1/2 items-center px-4 py-2">
      {activities.map((a, i) => (
        <span key={a.id} className="flex items-center">
          {i > 0 && <span aria-hidden className={`h-1 w-6 ${i <= current ? "bg-success-ink" : "bg-track"}`} />}
          <span
            aria-current={i === current ? "step" : undefined}
            aria-label={`${a.title}${i < current ? ", done" : i === current ? ", current" : ""}`}
            className={`grid place-items-center rounded-full font-display font-bold ${
              i < current
                ? "size-[34px] bg-success-ink text-white"
                : i === current
                  ? "size-11 bg-accent text-accent-ink ring-2 ring-accent ring-offset-2 ring-offset-surface"
                  : "size-[34px] border-2 border-track bg-surface text-text-muted"
            }`}
          >
            {i < current ? "✓" : a.kind === "assessment" ? "📋" : i + 1}
          </span>
        </span>
      ))}
      <span className="ml-4 hidden text-sm whitespace-nowrap text-text-muted sm:block">
        <strong className="block font-display text-[15px] text-text">{done ? "Lesson complete" : activities[current]?.title}</strong>
        {done ? `${activities.length} of ${activities.length} stages` : `Stage ${current + 1} of ${activities.length}`}
      </span>
    </nav>
  );
}

/** Correct outcome: a burst above the model, with a sub-line card (doc 11 feedback vocabulary). Never for mistakes. */
function Burst({ headline, sub }: { headline: string; sub: string }) {
  return (
    <div role="status" className="pointer-events-none absolute top-[88px] left-1/2 -translate-x-1/2 text-center">
      <div className="burst relative">
        <p className="font-display text-[54px] leading-[56px] font-extrabold text-success-ink [text-shadow:0_0_2px_var(--surface),0_0_6px_var(--surface),0_0_12px_var(--surface),0_3px_0_var(--surface)]">{headline}</p>
        <span className="spark -top-2 -left-6 bg-gold" />
        <span className="spark -top-6 left-1/4 bg-accent" style={{ animationDelay: "80ms" }} />
        <span className="spark top-2 -right-6 bg-success" style={{ animationDelay: "40ms" }} />
        <span className="spark -bottom-3 right-1/4 bg-gold" style={{ animationDelay: "120ms" }} />
      </div>
      <p className="card mt-3 inline-flex items-center gap-2 px-4 py-2 text-base">
        <OutcomeIcon outcome="correct" />
        {sub}
      </p>
    </div>
  );
}

/** Partial, incorrect and notices: a calm card under the mission card (no burst for mistakes). */
function FeedbackLine({ banner }: { banner: Banner }) {
  if (banner.kind === "info" || banner.kind === "recorded" || banner.kind === "correct") {
    return (
      <p className="card flex items-center gap-2 p-3 text-sm text-text-muted">
        {banner.kind === "recorded" && <span aria-hidden>📋</span>}
        {banner.text}
      </p>
    );
  }
  return (
    <p className="card flex items-start gap-2 border-l-4 p-3 text-sm" style={{ borderLeftColor: ROLE[banner.kind].color }}>
      <OutcomeIcon outcome={banner.kind} />
      <span>
        <b>{ROLE[banner.kind].label}.</b> {banner.text}
      </span>
    </p>
  );
}

/** Static heart mascot, remediation dialog only (doc 11). */
function Mascot() {
  return (
    <svg aria-hidden className="mx-auto size-[72px]" viewBox="0 0 80 80">
      <path d="M40 72 C 16 58 6 42 8 28 C 10 14 26 10 34 18 C 37 21 39 24 40 27 C 41 24 43 21 46 18 C 54 10 70 14 72 28 C 74 42 64 58 40 72 Z" fill="var(--accent)" stroke="var(--text)" strokeWidth="3" />
      <circle cx="30" cy="36" r="4" fill="var(--text)" />
      <circle cx="50" cy="36" r="4" fill="var(--text)" />
      <path d="M32 48 Q 40 54 48 48" stroke="var(--text)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** doc 08 mastery bands as result medals (doc 11): icon and word, never colour alone. */
function band(v: number | null | undefined, threshold: number) {
  if (v === null || v === undefined) return { label: "Not started", icon: "–", cls: "border-2 border-dashed border-text-muted bg-surface text-text-muted" };
  if (v >= threshold) return { label: "Mastered", icon: "✓", cls: "bg-success-ink text-white" };
  if (v >= 0.5) return { label: "Nearly there", icon: "◐", cls: "border-2 border-partial bg-surface text-text" };
  return { label: "Keep practising", icon: "↻", cls: "bg-surface-edge text-text" };
}

/** Mastery per objective and what to review (doc 11 "Score / Progress"). No stars, XP or badges in MVP. */
function Results({
  lesson,
  runner,
  nameOfTask,
  participantCode,
  onTryAgain,
  onDownload,
}: {
  lesson: ReturnType<typeof loadLesson>;
  runner: TaskRunner;
  nameOfTask: (id: string) => string;
  participantCode: string | null;
  /** Dev sessions only: start the lesson over in a fresh session. */
  onTryAgain?: () => void;
  /** Only with logging consent: without it no event log may leave the page, not even as a download (locked position 2). */
  onDownload?: () => void;
}) {
  const mastery = computeMastery(runner.attempts, lesson.objectives, lesson);
  const graded = lesson.activities.filter((a) => a.kind === "guided" || a.kind === "challenge" || a.kind === "assessment");
  const missed = graded
    .flatMap((a) => a.tasks)
    .filter((t) => runner.skipped.includes(t.id) || !runner.attempts.some((x) => x.taskId === t.id && x.outcome === "correct"))
    .map((t) => t.id);
  return (
    <section aria-label="Your results" className="card absolute top-1/2 left-1/2 max-h-[80vh] w-[min(40rem,calc(100%-2rem))] -translate-1/2 overflow-y-auto p-7">
      <h2 className="text-center font-display text-[40px] leading-[48px] font-extrabold">Lesson complete!</h2>
      <ul className="mt-5">
        {lesson.objectives.map((o) => {
          const v = mastery[o.id];
          const b = band(v, o.masteryThreshold);
          const pct = Math.round((v ?? 0) * 100);
          return (
            <li key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 border-t border-surface-edge py-3">
              <p className="text-sm">{o.statement}</p>
              <span className={`flex items-center gap-1.5 rounded-full px-3 py-0.5 text-sm font-semibold ${b.cls}`}>
                <span aria-hidden>{b.icon}</span>
                {b.label}
              </span>
              <div className="col-span-2 h-2.5 overflow-hidden rounded-full border-[1.5px] border-text-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={o.statement}>
                <div className={`h-full ${b.label === "Mastered" ? "bg-success" : "bg-partial"}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {missed.length > 0 && (
        <>
          <h3 className="mt-4 font-display text-lg font-bold">Review</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-text-muted">
            {missed.map((id) => (
              <li key={id}>{nameOfTask(id)}</li>
            ))}
          </ul>
        </>
      )}
      {participantCode && (
        <p className="mt-5 text-center text-sm text-text-muted">
          Your participant code <strong className="font-display text-xl tracking-widest text-text">{participantCode}</strong>
          <br />
          Write it down: quote it to the researcher to see or delete your data.
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onTryAgain && (
          <button type="button" className="btn" onClick={onTryAgain}>
            Try again
          </button>
        )}
        {onDownload && (
          <button type="button" className="btn btn-ghost" onClick={onDownload}>
            Download event log
          </button>
        )}
      </div>
    </section>
  );
}
