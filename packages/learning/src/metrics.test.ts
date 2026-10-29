import type { LogEvent } from "@grasp/types";
import { describe, expect, it } from "vitest";
import { sessionMetrics } from "./metrics";

let seq = 0;
const ev = (t: number, type: string, payload: Record<string, unknown> = {}): LogEvent =>
  ({ sessionId: "s", condition: "gesture", seq: seq++, t, type, payload }) as LogEvent;

/** One place task solved on the second try, one identify task, a tracking loss inside the place task. */
function session(): LogEvent[] {
  seq = 0;
  return [
    ev(0, "activity_start", { activityId: "a1", activityKind: "guided" }),
    ev(100, "task_start", { taskId: "p1", taskType: "place" }),
    ev(200, "grab_start", { componentId: "lv" }),
    ev(900, "grab_end", { componentId: "lv", reason: "release" }),
    ev(900, "grab_move_summary", { componentId: "lv", durationMs: 700, firstMoveMs: 50 }),
    ev(900, "place", { componentId: "lv", socketId: "s_ra" }),
    ev(900, "task_attempt", { taskId: "p1", taskType: "place", correct: false, partial: true }),
    ev(1000, "tracking_lost"),
    ev(3000, "tracking_regained", { durationMs: 2000 }),
    ev(3100, "grab_start", { componentId: "lv" }),
    ev(3500, "grab_end", { componentId: "lv", reason: "release" }),
    ev(3500, "grab_move_summary", { componentId: "lv", durationMs: 400, firstMoveMs: null }),
    ev(3500, "place", { componentId: "lv", socketId: "s_lv" }),
    ev(3500, "task_attempt", { taskId: "p1", taskType: "place", correct: true, partial: false }),
    ev(3500, "task_end", { taskId: "p1", outcome: "correct" }),
    ev(3600, "task_start", { taskId: "i1", taskType: "identify" }),
    ev(3700, "hint_shown", { taskId: "i1", level: 1 }),
    ev(4000, "select", { componentId: "ra", hotspotId: null }),
    ev(4000, "task_attempt", { taskId: "i1", taskType: "identify", correct: true }),
    ev(4000, "task_end", { taskId: "i1", outcome: "correct" }),
    ev(4100, "mastery_computed", { objectiveId: "o1", mastery: 0.9, threshold: 0.8 }),
    ev(4100, "mastery_computed", { objectiveId: "o2", mastery: 0.5, threshold: 0.8 }),
    ev(4100, "activity_end", { activityId: "a1" }),
  ];
}

describe("sessionMetrics", () => {
  it("computes the section-2 metrics", () => {
    const sus = Array.from({ length: 10 }, (_, i) => ({ instrument: "sus", itemNo: i + 1, response: i % 2 ? "1" : "5", correct: null }));
    const m = sessionMetrics(session(), sus);
    expect(m.lessonMs).toBe(4100);
    expect(m.cv?.trackingLostFraction).toBeCloseTo(2000 / 4100);
    expect(m.cv?.falseStartRate).toBe(0.5);
    expect(m.interaction.successRate).toBe(1);
    expect(m.interaction.placementAccuracy).toBe(0.5);
    expect(m.interaction.placementPartial).toBe(0.5);
    expect(m.interaction.selectionAccuracy).toBe(1);
    expect(m.interaction.taskTimeMedianMs).toEqual({ place: 3400, identify: 400 });
    expect(m.interaction.activeTaskTimeMedianMs.place).toBe(1400);
    expect(m.interaction.perTask[0]).toMatchObject({ taskId: "p1", attempts: 2, timeToFirstAttemptMs: 800, correct: true });
    expect(m.learning).toMatchObject({ taskCompletion: 1, masteryRate: 0.5, hintDependence: 0.5 });
    expect(m.ux.sus).toBe(100);
    expect(m.checks).toMatchObject({ seqProblems: [], orphanAttempts: [], placesWhileLost: [] });
    expect(m.ok).toBe(true);
  });

  it("flags a seq gap, an attempt outside its task, and a place while tracking is lost", () => {
    const e = session();
    const lostAt = e.findIndex((x) => x.type === "tracking_lost");
    e.splice(lostAt + 1, 0, { ...e[5]! }); // a place logged while tracking is lost
    e.forEach((x, i) => (x.seq = i));
    e.push({ ...e[6]!, seq: e.length + 1, t: 5000 }); // a task_attempt after its task ended, after a seq gap
    const m = sessionMetrics(e);
    expect(m.checks.placesWhileLost).toEqual([lostAt + 1]);
    expect(m.checks.orphanAttempts).toEqual([e.length]);
    expect(m.checks.seqProblems).toEqual([`gap before seq ${e.length}`]);
    expect(m.ok).toBe(false);
  });

  it("has no CV block in the mouse condition", () => {
    expect(sessionMetrics(session().map((x) => ({ ...x, condition: "mouse" as const }))).cv).toBeNull();
  });
});
