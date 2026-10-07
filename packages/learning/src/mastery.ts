import type { AttemptRecord, Lesson, Objective } from "@grasp/types";

/** Mastery per objective id; `null` means no graded task for that objective has an attempt yet. */
export type MasteryByObjective = Record<string, number | null>;

/**
 * Per-objective mastery, derived only from attempt scores (docs/06 "Progress,
 * mastery, and the separation from XP"). XP and badges read this; nothing
 * here reads XP or badges.
 *
 * ```text
 * mastery(objective):
 *   tasks = all tasks with task.objectiveId == objective.id in guided, challenge, assessment activities
 *   for each task with at least one attempt:
 *     latest = clamp(latestAttempt(task).score / task.scoring.correct, 0, 1)
 *     weight = activity.kind == "assessment" ? 2 : 1
 *   if no task has an attempt: return null        // not started, never a false 0
 *   return sum(latest * weight) / sum(weight)
 *
 * mastered(objective) = mastery(objective) >= objective.masteryThreshold
 * ```
 *
 * `lesson` is needed because normalisation divides by `task.scoring.correct`
 * and the weight depends on the activity kind, neither of which an attempt
 * record carries. Phase D (M8).
 */
export function computeMastery(
  attempts: AttemptRecord[],
  objectives: Objective[],
  lesson: Lesson,
): MasteryByObjective {
  void attempts;
  void objectives;
  void lesson;
  throw new Error("TODO Phase D: computeMastery (doc 06, doc 13 Phase 4)");
}
