/**
 * Phase 4 step 4.1: hint ladder, remediation, mastery and unlock, and the activity flow of the real
 * `anatomy.heart.chambers_v1` lesson, driven only by scene events and time.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Lesson, SceneEvent, Task } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { nextHint } from "./hints";
import { computeMastery, isLessonMastered, isUnlocked } from "./mastery";
import { shouldRemediate, synthesiseMicroTask } from "./remediation";
import { TaskRunner } from "./task-runner";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const lesson = JSON.parse(readFileSync(join(ROOT, "content/lessons/anatomy/heart/chambers_v1.json"), "utf8")) as Lesson;
const task = (id: string) => lesson.activities.flatMap((a) => a.tasks).find((t) => t.id === id)!;

let clock = 0;
const select = (componentId: string): SceneEvent => ({ type: "select", componentId, method: "dwell", t: (clock += 1000) });
const place = (componentId: string, socketId: string): SceneEvent => ({ type: "place", componentId, socketId, t: (clock += 1000) });

/** A runner past the introduction and explore activities (each ended by Continue, never by time). */
function atGuided(): TaskRunner {
  clock = 0;
  const r = new TaskRunner(lesson, { sessionId: "t", lessonHash: "t" });
  r.start(0);
  expect(r.activity?.kind).toBe("introduction");
  expect(r.tick(600_000)).toBe(false); // no timer
  expect(r.proceed(20_000)).toBe(true);
  expect(r.activity?.kind).toBe("explore");
  expect(r.proceed(80_000)).toBe(true);
  expect(r.activity?.kind).toBe("guided");
  expect(r.proceed(80_000)).toBe(false); // only task-less Continue activities
  clock = 80_000;
  return r;
}

describe("nextHint", () => {
  it("climbs the ladder and stops after level 3, skipping levels a task does not author", () => {
    const t = task("t_g1");
    expect([0, 1, 2, 3].map((n) => nextHint(t, n)?.level ?? null)).toEqual([1, 2, 3, null]);
    const sparse: Task = { ...t, hints: [{ level: 1, text: "a" }, { level: 3, highlight: ["aorta"] }] };
    expect([0, 1].map((n) => nextHint(sparse, n)?.level)).toEqual([1, 3]);
    expect(nextHint({ ...t, hints: [] }, 0)).toBeNull();
  });
});

describe("remediation policy", () => {
  it("runs once, in guided and challenge only", () => {
    expect(shouldRemediate("guided", 3, 3, false)).toBe(true);
    expect(shouldRemediate("guided", 3, 3, true)).toBe(false);
    expect(shouldRemediate("challenge", 2, 3, false)).toBe(false);
    expect(shouldRemediate("assessment", 1, 1, false)).toBe(false);
  });

  it("synthesises a one-step-down identify task, scored 0", () => {
    const m = synthesiseMicroTask(task("t_g3"));
    expect(m).toMatchObject({ id: "t_g3__micro", type: "identify", maxAttempts: 1, scoring: { correct: 0 } });
    expect(m.expect).toEqual({ componentId: (task("t_g3").expect as { componentId: string }).componentId });
    const id = synthesiseMicroTask(task("t_g1"));
    expect(id.hints.map((h) => h.level)).toEqual([3]); // identify: same task with the reveal applied
  });
});

describe("TaskRunner on chambers_v1", () => {
  it("walks introduction and explore by time, then reveals hints on incorrect attempts and charges for them", () => {
    const r = atGuided();
    const t = r.task!;
    expect(t.id).toBe("t_g1");
    const wrong = (t.expect as { componentId: string }).componentId === "right_ventricle" ? "left_atrium" : "right_ventricle";
    const v1 = r.onSceneEvent(select(wrong))!;
    expect(v1).toMatchObject({ next: "retry", hint: { level: 1 } });
    const v2 = r.onSceneEvent(select((t.expect as { componentId: string }).componentId))!;
    expect(v2.result.correct).toBe(true);
    expect(v2.result.score).toBe(t.scoring.correct - 1 * (t.scoring.hintPenalty ?? 0));
    expect(v2.next).toBe("next_task");
  });

  it("charges a requested hint like an earned one", () => {
    const r = atGuided();
    const t = r.task!;
    expect(r.requestHint()?.level).toBe(1);
    expect(r.requestHint()?.level).toBe(2);
    const v = r.onSceneEvent(select((t.expect as { componentId: string }).componentId))!;
    expect(v.result.score).toBe(t.scoring.correct - 2 * (t.scoring.hintPenalty ?? 0));
  });

  it("remediates after exhaustion: micro-task, then a retry that scores as if every hint was used", () => {
    const r = atGuided();
    const t = r.task!;
    const right = (t.expect as { componentId: string }).componentId;
    const wrong = right === "right_ventricle" ? "left_atrium" : "right_ventricle";
    r.onSceneEvent(select(wrong));
    r.onSceneEvent(select(wrong));
    const v3 = r.onSceneEvent(select(wrong))!;
    expect(v3.next).toBe("remediate");
    expect(v3.remediation?.workedExample.id).toBe(t.id);
    expect(r.task?.id).toBe(`${t.id}__micro`);

    const micro = r.onSceneEvent(select(wrong))!; // micro-task: one attempt whatever the outcome
    expect(micro).toMatchObject({ micro: true, next: "retry" });
    expect(r.task?.id).toBe(t.id);

    const retry = r.onSceneEvent(select(right))!;
    expect(retry.result.correct).toBe(true);
    expect(retry.attemptNo).toBe(1); // attempts reset
    expect(retry.result.score).toBe(t.scoring.correct - 3 * (t.scoring.hintPenalty ?? 0));
    const rec = r.attempts.filter((a) => a.taskId === t.id);
    expect(rec.map((a) => a.remediated)).toEqual([false, false, false, true]);
    expect(r.attempts.find((a) => a.microTask)?.score).toBe(0);
  });

  it("fails the task on a second exhaustion and moves on", () => {
    const r = atGuided();
    const t = r.task!;
    const wrong = (t.expect as { componentId: string }).componentId === "right_ventricle" ? "left_atrium" : "right_ventricle";
    for (let i = 0; i < 3; i++) r.onSceneEvent(select(wrong));
    r.onSceneEvent(select(wrong)); // micro
    r.onSceneEvent(select(wrong));
    r.onSceneEvent(select(wrong));
    const last = r.onSceneEvent(select(wrong))!;
    expect(last.next).toBe("next_task");
    expect(r.task?.id).not.toBe(t.id);
  });
});

describe("mastery and unlock", () => {
  it("weights assessment 2x, normalises by scoring.correct, ignores micro-tasks, and reports untouched objectives as null", () => {
    const at = (taskId: string, activityKind: "guided" | "assessment", score: number, t: number, microTask = false) => ({
      sessionId: "s",
      lessonId: lesson.id,
      lessonHash: "h",
      activityId: "x",
      activityKind,
      taskId,
      taskType: task(taskId)?.type ?? "identify",
      objectiveId: task(taskId)?.objectiveId ?? "obj_identify_chambers",
      attemptNo: 1,
      microTask,
      remediated: false,
      outcome: score > 0 ? ("correct" as const) : ("incorrect" as const),
      score,
      scoreMax: task(taskId)?.scoring.correct ?? 0,
      hintsUsed: 0,
      durationMs: 0,
      actual: { type: "select" },
      t,
    });
    const obj = task("t_g1").objectiveId;
    const assessTask = lesson.activities.find((a) => a.kind === "assessment")!.tasks.find((t) => t.objectiveId === obj)!;
    const g1Max = task("t_g1").scoring.correct;
    const attempts = [
      at("t_g1", "guided", 0, 1), // superseded by the later attempt
      at("t_g1", "guided", g1Max, 2),
      at("t_g1__micro", "guided", 0, 3, true), // ignored
      at(assessTask.id, "assessment", 0, 4),
    ];
    const m = computeMastery(attempts, lesson.objectives, lesson);
    expect(m[obj]).toBeCloseTo((1 * 1 + 0 * 2) / 3);
    const untouched = lesson.objectives.find((o) => o.id !== obj && !attempts.some((a) => a.objectiveId === o.id))!;
    expect(m[untouched.id]).toBeNull();
    expect(isLessonMastered(m, lesson.objectives)).toBe(false);
  });

  it("unlocks a lesson only when every prerequisite lesson is mastered", () => {
    expect(isUnlocked({ ...lesson, prerequisites: [] }, new Set())).toBe(true);
    expect(isUnlocked({ ...lesson, prerequisites: ["anatomy.heart.chambers_v1"] }, new Set())).toBe(false);
    expect(isUnlocked({ ...lesson, prerequisites: ["anatomy.heart.chambers_v1"] }, new Set(["anatomy.heart.chambers_v1"]))).toBe(true);
  });
});

describe("prototype lesson still runs end to end", () => {
  it("places three parts and completes", () => {
    const proto = JSON.parse(readFileSync(join(ROOT, "content/lessons/anatomy/heart/prototype_v0.json"), "utf8")) as Lesson;
    const r = new TaskRunner(proto, { sessionId: "t", lessonHash: "t" });
    r.start(0);
    r.onSceneEvent(place("aorta", "socket_aorta"));
    r.onSceneEvent(place("pulmonary_artery", "socket_pulmonary_artery"));
    expect(r.onSceneEvent(place("left_ventricle", "socket_left_ventricle"))?.next).toBe("lesson_complete");
    expect(r.done).toBe(true);
  });
});

describe("sequence tasks", () => {
  it("counts matching steps as progress, grades a wrong step as one attempt and clears the steps", () => {
    const seq = lesson.activities.find((a) => a.tasks.some((t) => t.id === "t_c5"))!;
    const one: Lesson = { ...lesson, activities: [{ ...seq, tasks: [task("t_c5")] }] };
    const r = new TaskRunner(one, { sessionId: "t", lessonHash: "t" });
    r.start(0);
    expect(r.onSceneEvent(select("right_atrium"))).toBeNull();
    expect(r.sequenceProgress).toBe(1);
    const wrong = r.onSceneEvent(select("left_atrium"))!;
    expect(wrong).toMatchObject({ next: "retry", attemptNo: 1 });
    expect(r.sequenceProgress).toBe(0);
    for (const id of ["right_atrium", "right_ventricle", "left_atrium"]) expect(r.onSceneEvent(select(id))).toBeNull();
    const done = r.onSceneEvent(select("left_ventricle"))!;
    expect(done.result.correct).toBe(true);
    expect(done.attemptNo).toBe(2);
  });
});

describe("skip and toAssessment", () => {
  it("skips the original task during remediation and moves on without an attempt", () => {
    const r = atGuided();
    const t = r.task!;
    const wrong = (t.expect as { componentId: string }).componentId === "right_ventricle" ? "left_atrium" : "right_ventricle";
    for (let i = 0; i < 3; i++) r.onSceneEvent(select(wrong));
    expect(r.task?.id).toBe(`${t.id}__micro`);
    const n = r.attempts.length;
    expect(r.skip(clock)).toBe("next_task");
    expect(r.attempts.length).toBe(n);
    expect(r.skipped).toEqual([t.id]);
    expect(r.task?.id).not.toBe(t.id);
  });

  it("jumps to the assessment activity once", () => {
    const r = atGuided();
    expect(r.toAssessment(90_000)).toBe(true);
    expect(r.activity?.kind).toBe("assessment");
    expect(r.task).not.toBeNull();
    expect(r.toAssessment(91_000)).toBe(false);
  });
});

describe("resume from the attempt log", () => {
  it("reopens the same task with attempts and the revealed hint, and keeps skipped tasks closed", () => {
    const a = atGuided();
    const t = a.task!;
    const wrong = (t.expect as { componentId: string }).componentId === "right_ventricle" ? "left_atrium" : "right_ventricle";
    a.onSceneEvent(select(wrong));
    const b = new TaskRunner(lesson, { sessionId: "t", lessonHash: "t" });
    b.resume(a.attempts, [], 200_000);
    expect(b.activity?.kind).toBe("guided");
    expect(b.task?.id).toBe(t.id);
    expect(b.attemptsUsed).toBe(1);
    expect(b.hintsUsed).toBe(1);

    const c = new TaskRunner(lesson, { sessionId: "t", lessonHash: "t" });
    c.resume(a.attempts, [t.id], 200_000);
    expect(c.task?.id).not.toBe(t.id);
  });

  it("treats a reload between remediation and its micro-task as the micro-task done", () => {
    const a = atGuided();
    const t = a.task!;
    const wrong = (t.expect as { componentId: string }).componentId === "right_ventricle" ? "left_atrium" : "right_ventricle";
    for (let i = 0; i < 3; i++) a.onSceneEvent(select(wrong));
    const b = new TaskRunner(lesson, { sessionId: "t", lessonHash: "t" });
    b.resume(a.attempts, [], 200_000);
    expect(b.task?.id).toBe(t.id);
    expect(b.attemptsUsed).toBe(0);
    expect(b.hintsUsed).toBe(3);
  });

  it("starts at the beginning with an empty log", () => {
    const b = new TaskRunner(lesson, { sessionId: "t", lessonHash: "t" });
    b.resume([], [], 0);
    expect(b.activity?.kind).toBe("introduction");
  });
});
