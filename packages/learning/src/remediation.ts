import type { Activity, Task } from "@grasp/types";

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
  void activityKind;
  void attemptsMade;
  void maxAttempts;
  void alreadyRemediated;
  throw new Error("TODO Phase D: shouldRemediate (doc 06, M8)");
}

/**
 * Synthesise the prerequisite micro-task from the failed task's `expect`.
 * Not stored as content; `task.remediation` (V1) will override it when present.
 * Phase D (M8).
 */
export function synthesiseMicroTask(task: Task): Task {
  void task;
  throw new Error("TODO Phase D: synthesiseMicroTask (doc 06, M8)");
}
