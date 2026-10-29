import type { AttemptRecord, Lesson, Objective, Task } from "@grasp/types";
import { ASSESSMENT_MASTERY_WEIGHT, GRADED_ACTIVITY_KINDS } from "./sequencing";

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
 * record carries. Micro-task attempts (remediation, scored 0) are excluded.
 */
export function computeMastery(
  attempts: AttemptRecord[],
  objectives: Objective[],
  lesson: Lesson,
): MasteryByObjective {
  const graded: { task: Task; weight: number }[] = lesson.activities
    .filter((a) => (GRADED_ACTIVITY_KINDS as readonly string[]).includes(a.kind))
    .flatMap((a) => a.tasks.map((task) => ({ task, weight: a.kind === "assessment" ? ASSESSMENT_MASTERY_WEIGHT : 1 })));

  const out: MasteryByObjective = {};
  for (const o of objectives) {
    let sum = 0;
    let weights = 0;
    for (const { task, weight } of graded.filter((g) => g.task.objectiveId === o.id)) {
      const latest = attempts
        .filter((a) => a.taskId === task.id && !a.microTask)
        .reduce<AttemptRecord | null>((best, a) => (!best || a.t >= best.t ? a : best), null);
      if (!latest) continue; // not attempted: excluded, never a false 0
      sum += Math.min(1, Math.max(0, latest.score / task.scoring.correct)) * weight;
      weights += weight;
    }
    out[o.id] = weights ? sum / weights : null;
  }
  return out;
}

/** Every objective has mastery at or above its threshold (an untouched objective is not mastered). */
export function isLessonMastered(mastery: MasteryByObjective, objectives: Objective[]): boolean {
  return objectives.every((o) => (mastery[o.id] ?? -1) >= o.masteryThreshold);
}

/** unlock(lesson) = every lesson in `prerequisites` is mastered (doc 06). XP never enters this rule. */
export function isUnlocked(lesson: Lesson, masteredLessonIds: ReadonlySet<string>): boolean {
  return (lesson.prerequisites ?? []).every((id) => masteredLessonIds.has(id));
}
