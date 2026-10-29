import type { Activity, AttemptState, Task } from "@grasp/types";

/**
 * Repeated-failure policy, failure state 7 (docs/02, docs/06 "Repeated-failure policy").
 * Runs once per task, in guided and challenge activities only, never in assessment.
 *
 * 1. worked_example  the engine animates `expect` (place: tween into socket and back;
 *                    identify/compare: pulse the answer with camera framing;
 *                    sequence: highlight steps in order, 600 ms apart)
 * 2. micro_task      a prerequisite task one Bloom step down, synthesised from `expect`
 *                    (place/remove -> identify the same component; sequence -> identify the
 *                    first wrong step; compare -> identify each candidate; identify -> same task
 *                    with the level-3 highlight active); scored 0, logged with `remediated: true`
 * 3. retry           original prompt, attempts reset, score counts with `hintsUsed = 3`
 * 4. second exhaustion: task recorded as failed, score 0, objective flagged on the mastery screen
 */
export const REMEDIATION_SEQUENCE = ["worked_example", "micro_task", "retry"] as const;
export type RemediationStep = (typeof REMEDIATION_SEQUENCE)[number];

/** Hints are treated as fully used on the retry so the retry score cannot exceed an unaided one. */
export const RETRY_HINTS_USED = 3;

/**
 * True when attempts are exhausted in a guided or challenge activity and this
 * task has not been remediated yet. Phase D (M8).
 */
export function shouldRemediate(
  activityKind: Activity["kind"],
  attemptsMade: number,
  maxAttempts: number,
  alreadyRemediated: boolean,
): boolean {
  return (activityKind === "guided" || activityKind === "challenge") && attemptsMade >= maxAttempts && !alreadyRemediated;
}

/** Component id as words for a synthesised prompt ("left_ventricle" -> "left ventricle"). */
const words = (id: string) => id.replace(/_/g, " ");

/**
 * Synthesise the prerequisite micro-task from the failed task's `expect`.
 * Not stored as content; `task.remediation` (V1) will override it when present.
 * Always an `identify` (one Bloom step down), one attempt, scored 0, id `<task.id>__micro`.
 * `state` supplies a sequence task's collected steps, to find the first wrong one.
 */
export function synthesiseMicroTask(task: Task, state?: AttemptState): Task {
  const base = { id: `${task.id}__micro`, objectiveId: task.objectiveId, maxAttempts: 1, scoring: { correct: 0 } };
  const identify = (componentId: string | string[], prompt: string, hints: Task["hints"] = []): Task => ({
    ...base,
    type: "identify",
    prompt,
    hints,
    expect: { componentId },
  });
  switch (task.type) {
    case "place":
    case "remove":
      return identify(task.expect.componentId, `First, point to the ${words(task.expect.componentId)}.`);
    case "sequence": {
      const steps = state?.steps ?? [];
      const wrong = task.expect.steps.find((s, i) => steps[i]?.componentId !== s.componentId) ?? task.expect.steps[0]!;
      return identify(wrong.componentId, `First, point to the ${words(wrong.componentId)}.`);
    }
    case "compare":
      // ponytail: one identify accepting either candidate, not one per candidate; split it if pilots show the need.
      return identify([...task.expect.componentIds], `First, point to the ${task.expect.componentIds.map(words).join(" or the ")}.`);
    case "identify":
      // Same task with the level-3 reveal applied from the start.
      return identify(task.expect.componentId, task.prompt, task.hints.filter((h) => h.level === 3));
  }
}
