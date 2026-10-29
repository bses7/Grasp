/**
 * Every doc 14 section 2 metric for one session, from its ordered LogEvents plus its instrument_responses rows
 * (roadmap step 4.7; doc 12 A3). Pure: the metrics script feeds it rows from the database or a downloaded log.
 * A metric whose inputs were not logged is null (e.g. calibration before the tutorial exists, tests before the
 * instrument pages exist, every CV metric in the mouse condition).
 *
 * `checks` is the reconstruction test (A3) and the tracking-loss rule (A16): seq gaps or duplicates, attempts not
 * inside their task, and any `place` logged between tracking_lost and tracking_regained.
 *
 * ponytail: gesture precision counts false positives inside prompt windows only (doc 14 also counts emits outside
 * any window); "active" for engagement uses the logged interaction events, since hover is never logged.
 */
import type { LogEvent } from "@grasp/types";
import { falseStartRate } from "./logger";

export type InstrumentRow = { instrument: string; itemNo: number; response: string; correct: boolean | null };

type P = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : null);
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? s[0]!;
}
const median = (xs: number[]) => quantile(xs, 0.5);

/** Idle gap for the engagement active ratio (doc 14 2.4). */
const IDLE_GAP_MS = 10_000;
const ACTIVE_TYPES = new Set(["grab_start", "grab_end", "grab_move_summary", "select", "place", "drop", "tutor_message", "hint_shown"]);

export function sessionMetrics(input: readonly LogEvent[], instruments: readonly InstrumentRow[] = []) {
  const E = [...input].sort((a, b) => a.seq - b.seq);
  const of = (type: string) => E.filter((e) => e.type === type);
  const p = (e: LogEvent) => e.payload as P;
  const gesture = E[0]?.condition === "gesture";

  const starts = of("activity_start");
  const ends = of("activity_end");
  const tFirst = starts[0]?.t ?? E[0]?.t ?? 0;
  const tLast = ends.at(-1)?.t ?? E.at(-1)?.t ?? 0;
  const T = Math.max(0, tLast - tFirst);
  const lostMs = of("tracking_regained").reduce((s, e) => s + (num(p(e).durationMs) ?? 0), 0);

  // --- 2.1 CV (gesture condition only) ---
  let cv = null;
  if (gesture) {
    const prompts = of("calibration_prompt");
    const emits = of("gesture_emit");
    const answers = prompts.map((e) => {
      const until = e.t + (num(p(e).windowMs) ?? 0);
      return { expected: String(p(e).expectedGesture), got: emits.find((g) => g.t >= e.t && g.t <= until)?.payload.gesture ?? null };
    });
    const gestures = [...new Set(answers.map((a) => a.expected))];
    const perf = of("perf_sample").map(p);
    const vals = (k: string) => perf.map((s) => num(s[k])).filter((x): x is number => x !== null);
    cv = {
      gestureAccuracy: ratio(answers.filter((a) => a.got === a.expected).length, answers.length),
      precision: Object.fromEntries(
        gestures.map((g) => [g, ratio(answers.filter((a) => a.got === g && a.expected === g).length, answers.filter((a) => a.got === g).length)]),
      ),
      recall: Object.fromEntries(
        gestures.map((g) => [g, ratio(answers.filter((a) => a.got === g && a.expected === g).length, answers.filter((a) => a.expected === g).length)]),
      ),
      falseStartRate: falseStartRate(E).rate,
      trackingLostPerMin: T > 0 ? of("tracking_lost").length / (T / 60_000) : null,
      trackingLostFraction: ratio(lostMs, T),
      jitterNorm: mean(vals("jitterNorm")),
      inferenceMsP50: median(vals("inferenceMsP50")),
      inferenceMsP95: quantile(vals("inferenceMsP95"), 0.95),
      e2eMsP50: median(vals("e2eMsP50")),
      fps: mean(vals("fps")),
      multiHandFrames: of("hand_count").filter((e) => (num(p(e).n) ?? 0) > 1).length,
    };
  }

  // --- 2.2 Interaction ---
  const attempts = of("task_attempt");
  const ofTaskType = (type: string) => attempts.filter((e) => p(e).taskType === type);
  const summaries = of("grab_move_summary");
  const tasks = new Map<string, { type: string; start: number; end: number | null; firstAttempt: number | null; attempts: number; correct: boolean }>();
  for (const e of E) {
    const id = p(e).taskId as string | undefined;
    if (!id) continue;
    if (e.type === "task_start" && !tasks.has(id)) tasks.set(id, { type: String(p(e).taskType), start: e.t, end: null, firstAttempt: null, attempts: 0, correct: false });
    const task = tasks.get(id);
    if (!task) continue;
    if (e.type === "task_attempt") {
      task.attempts++;
      task.firstAttempt ??= e.t - task.start;
      task.correct ||= p(e).correct === true;
    }
    if (e.type === "task_end") task.end = e.t;
  }
  const lostWithin = (from: number, to: number) =>
    of("tracking_regained").filter((e) => e.t > from && e.t <= to).reduce((s, e) => s + (num(p(e).durationMs) ?? 0), 0);
  const perTask = [...tasks].map(([taskId, x]) => ({
    taskId,
    taskType: x.type,
    timeMs: x.end === null ? null : x.end - x.start,
    activeTimeMs: x.end === null ? null : x.end - x.start - lostWithin(x.start, x.end),
    timeToFirstAttemptMs: x.firstAttempt,
    attempts: x.attempts,
    correct: x.correct,
  }));
  const byType = (k: "timeMs" | "activeTimeMs") =>
    Object.fromEntries(
      [...new Set(perTask.map((x) => x.taskType))].map((type) => [type, median(perTask.filter((x) => x.taskType === type && x[k] !== null).map((x) => x[k]!))]),
    );
  const interaction = {
    successRate: ratio(of("place").length, of("grab_start").filter((e) => p(e).componentId != null).length),
    lossCausedDrops: of("drop").filter((e) => p(e).cause === "lost").length,
    selectionAccuracy: ratio(ofTaskType("identify").filter((e) => p(e).correct === true).length, ofTaskType("identify").length),
    placementAccuracy: ratio(ofTaskType("place").filter((e) => p(e).correct === true).length, ofTaskType("place").length),
    placementPartial: ratio(ofTaskType("place").filter((e) => p(e).partial === true).length, ofTaskType("place").length),
    taskTimeMedianMs: byType("timeMs"),
    activeTaskTimeMedianMs: byType("activeTimeMs"),
    attemptsPerTask: mean(perTask.filter((x) => x.correct).map((x) => x.attempts)),
    orbits: summaries.filter((e) => p(e).componentId == null && p(e).firstMoveMs != null).length,
    orbitMs: summaries.filter((e) => p(e).componentId == null && p(e).firstMoveMs != null).reduce((s, e) => s + (num(p(e).durationMs) ?? 0), 0),
    misses: summaries.filter((e) => p(e).componentId == null && p(e).firstMoveMs == null).length,
    perTask,
  };

  // --- 2.3 Learning ---
  const score = (instrument: string) => {
    const rows = instruments.filter((r) => r.instrument === instrument);
    return rows.length ? rows.filter((r) => r.correct).length : null;
  };
  const pre = score("pre");
  const post = score("post");
  const mastery = of("mastery_computed").map(p);
  const hints = of("hint_shown");
  const learning = {
    preTest: pre,
    postTest: post,
    normalisedGain: pre !== null && post !== null && pre < 15 ? (post - pre) / (15 - pre) : null,
    retention: score("retention"),
    taskCompletion: ratio(perTask.filter((x) => x.correct).length, perTask.length),
    masteryRate: ratio(mastery.filter((m) => num(m.mastery) !== null && num(m.mastery)! >= num(m.threshold)!).length, mastery.length),
    mastery: Object.fromEntries(mastery.map((m) => [String(m.objectiveId), num(m.mastery)])),
    hintDependence: ratio(hints.length, of("task_start").length),
    hintsByLevel: Object.fromEntries([1, 2, 3].map((l) => [l, hints.filter((e) => p(e).level === l).length])),
  };

  // --- 2.4 UX ---
  const items = (instrument: string) =>
    new Map(instruments.filter((r) => r.instrument === instrument).map((r) => [r.itemNo, Number(r.response)]));
  const sus = items("sus");
  const tlx = items("tlx");
  const active = E.filter((e) => ACTIVE_TYPES.has(e.type) && e.t >= tFirst && e.t <= tLast).map((e) => e.t);
  let idle = 0;
  let prev = tFirst;
  for (const t of [...active, tLast]) {
    if (t - prev > IDLE_GAP_MS) idle += t - prev;
    prev = t;
  }
  const explore = starts.find((e) => p(e).activityKind === "explore");
  const exploreEnd = explore && ends.find((e) => e.t >= explore.t && p(e).activityId === p(explore).activityId);
  const tutor = of("tutor_message").filter((e) => ["hint", "explain_mistake"].includes(String(p(e).kind)));
  const ux = {
    sus: sus.size === 10 ? 2.5 * [...sus].reduce((s, [i, r]) => s + (i % 2 ? r - 1 : 5 - r), 0) : null,
    rawTlx: tlx.size === 6 ? mean([...tlx.values()].map((r) => r * 5)) : null,
    activeRatio: T > 0 ? (T - idle) / T : null,
    exploreMs: explore && exploreEnd ? exploreEnd.t - explore.t : null,
    hotspotSelects: of("select").filter((e) => p(e).hotspotId != null).length,
    tutorUse: tutor.filter((e) => p(e).source === "tutor").length,
    tutorStaticFallbacks: tutor.filter((e) => p(e).source === "static").length,
    satisfaction: items("satisfaction").get(1) ?? null,
  };

  // --- Reconstruction (A3) and tracking loss (A16) ---
  const seqProblems: string[] = [];
  E.forEach((e, i) => {
    if (i && e.seq === E[i - 1]!.seq) seqProblems.push(`duplicate seq ${e.seq}`);
    else if (i && e.seq !== E[i - 1]!.seq + 1) seqProblems.push(`gap before seq ${e.seq}`);
  });
  const orphanAttempts: number[] = [];
  let currentTask: string | null = null;
  let lost = false;
  const placesWhileLost: number[] = [];
  for (const e of E) {
    if (e.type === "task_start") currentTask = String(p(e).taskId);
    if (e.type === "task_end" && p(e).taskId === currentTask) currentTask = null;
    if (e.type === "task_attempt" && p(e).taskId !== currentTask) orphanAttempts.push(e.seq);
    if (e.type === "tracking_lost") lost = true;
    if (e.type === "tracking_regained") lost = false;
    if (e.type === "place" && lost) placesWhileLost.push(e.seq);
  }
  const checks = { events: E.length, attempts: attempts.length, seqProblems, orphanAttempts, placesWhileLost };
  const ok = !seqProblems.length && !orphanAttempts.length && !placesWhileLost.length;

  return { condition: E[0]?.condition ?? null, lessonMs: T, cv, interaction, learning, ux, checks, ok };
}

export type SessionMetrics = ReturnType<typeof sessionMetrics>;
