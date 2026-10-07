import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AttemptState, Lesson, SceneEvent, Task } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { countsAsAttempt } from "./counts-as-attempt";
import { evaluate } from "./evaluate";
import { TaskRunner } from "./task-runner";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const lesson = JSON.parse(
  readFileSync(join(ROOT, "content/lessons/anatomy/heart/prototype_v0.json"), "utf8"),
) as Lesson;
const [t_p1, t_p2] = lesson.activities[0]!.tasks as [Task, Task, Task];

const place = (componentId: string, socketId: string, t = 1): SceneEvent => ({ type: "place", componentId, socketId, t });
const drop = (componentId: string, cause: "release" | "lost", t = 1): SceneEvent => ({
  type: "drop",
  componentId,
  position: [0, 0, 0],
  cause,
  t,
});
const select = (componentId: string, t = 1): SceneEvent => ({ type: "select", componentId, method: "grab", t });
const fresh = (): AttemptState => ({ attempts: 0, hintsUsed: 0, steps: [] });

describe("countsAsAttempt (doc 06)", () => {
  it("never counts a drop caused by tracking loss, in any task type", () => {
    expect(countsAsAttempt(t_p1, drop("aorta", "lost"))).toBe(false);
    const remove: Task = { ...t_p1, type: "remove", expect: { componentId: "aorta", awayFromSocketId: "socket_aorta" } };
    expect(countsAsAttempt(remove, drop("aorta", "lost"))).toBe(false);
    expect(countsAsAttempt(remove, drop("aorta", "release"))).toBe(true);
  });

  it("on a place task, counts only place: not the select that starts a grab, not a drop outside every socket", () => {
    expect(countsAsAttempt(t_p1, place("aorta", "socket_aorta"))).toBe(true);
    expect(countsAsAttempt(t_p1, select("aorta"))).toBe(false);
    expect(countsAsAttempt(t_p1, drop("aorta", "release"))).toBe(false);
  });
});

describe("evaluate, place task (M8 acceptance)", () => {
  it("right part, right socket → correct with full score", () => {
    const r = evaluate(t_p1, place("aorta", "socket_aorta"), fresh());
    expect(r).toMatchObject({ correct: true, partial: false, score: 10 });
    expect(r.feedback).toMatchObject({ outcome: "correct", nextHintLevel: null });
  });

  it("right part, wrong socket → partial", () => {
    const r = evaluate(t_p1, place("aorta", "socket_pulmonary_artery"), fresh());
    expect(r).toMatchObject({ correct: false, partial: true, score: 3 });
    expect(r.feedback.outcome).toBe("partial");
    expect(r.feedback.actual).toEqual({ type: "place", componentId: "aorta", socketId: "socket_pulmonary_artery" });
  });

  it("wrong part → incorrect, even in the right socket", () => {
    const r = evaluate(t_p1, place("pulmonary_artery", "socket_aorta"), fresh());
    expect(r).toMatchObject({ correct: false, partial: false, score: 0 });
    expect(r.feedback).toMatchObject({ outcome: "incorrect", nextHintLevel: 1 });
  });

  it("is deterministic and advances the threaded attempt count", () => {
    const s = fresh();
    const a = evaluate(t_p2, place("aorta", "socket_aorta"), s);
    const b = evaluate(t_p2, place("aorta", "socket_aorta"), fresh());
    expect(a).toEqual(b);
    expect(s.attempts).toBe(1);
  });
});

describe("TaskRunner on prototype_v0", () => {
  const runner = () => {
    const r = new TaskRunner(lesson, { sessionId: "test", lessonHash: "test" });
    r.start(0);
    return r;
  };

  it("advances t_p1 → t_p2 → t_p3 → complete on correct placements", () => {
    const r = runner();
    expect(r.task?.id).toBe("t_p1");
    expect(r.onSceneEvent(place("aorta", "socket_aorta", 100))?.next).toBe("next_task");
    expect(r.task?.id).toBe("t_p2");
    r.onSceneEvent(place("pulmonary_artery", "socket_pulmonary_artery", 200));
    const last = r.onSceneEvent(place("left_ventricle", "socket_left_ventricle", 300));
    expect(last?.next).toBe("lesson_complete");
    expect(r.task).toBeNull();
    expect(r.attempts.map((a) => [a.taskId, a.outcome, a.durationMs])).toEqual([
      ["t_p1", "correct", 100],
      ["t_p2", "correct", 100],
      ["t_p3", "correct", 100],
    ]);
  });

  it("a lost drop is discarded: no verdict, no attempt, task stays open, never correct", () => {
    const r = runner();
    expect(r.onSceneEvent(drop("aorta", "lost"))).toBeNull();
    expect(r.attempts).toHaveLength(0);
    expect(r.task?.id).toBe("t_p1");
  });

  it("a release outside every socket is ignored on a place task (doc 06), not graded incorrect", () => {
    const r = runner();
    expect(r.onSceneEvent(drop("aorta", "release"))).toBeNull();
    expect(r.attempts).toHaveLength(0);
  });

  it("retries until maxAttempts (3), then moves on with the task marked failed", () => {
    const r = runner();
    expect(r.onSceneEvent(place("pulmonary_artery", "socket_aorta"))).toMatchObject({ next: "retry", attemptNo: 1 });
    expect(r.onSceneEvent(place("aorta", "socket_pulmonary_artery"))).toMatchObject({ next: "retry", attemptNo: 2 });
    expect(r.onSceneEvent(place("pulmonary_artery", "socket_aorta"))).toMatchObject({ next: "next_task", attemptNo: 3 });
    expect(r.task?.id).toBe("t_p2");
  });
});

describe("package boundary", () => {
  it("scene and learning do not depend on each other", () => {
    const deps = (pkg: string) =>
      Object.keys(JSON.parse(readFileSync(join(ROOT, "packages", pkg, "package.json"), "utf8")).dependencies ?? {});
    expect(deps("scene")).not.toContain("@grasp/learning");
    expect(deps("learning")).not.toContain("@grasp/scene");
  });
});
