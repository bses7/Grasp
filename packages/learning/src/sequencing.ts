import type { Activity, AttemptRecord, Lesson, Task } from "@grasp/types";

/**
 * Soft time prompt at 15 minutes of lesson time (docs/02, 06, 12, 14; pre-registered).
 * The HUD offers "continue" or "to_assessment" and logs the choice as `time_prompt`.
 * There is no hard cap; the assessment activity always runs in full.
 */
export const TIME_PROMPT_MS = 15 * 60 * 1000;

/** Default `maxAttempts` per activity kind when a task omits it (docs/06 "Faded guidance"). */
export const DEFAULT_MAX_ATTEMPTS: Readonly<Record<Activity["kind"], number>> = {
  introduction: 0,
  explore: 0,
  guided: 3,
  challenge: 3,
  assessment: 1,
  mastery: 0,
};

/** Assessment-activity tasks count twice in the mastery mean. */
export const ASSESSMENT_MASTERY_WEIGHT = 2;

/** Only these activity kinds produce attempts that feed mastery. */
export const GRADED_ACTIVITY_KINDS: ReadonlyArray<Activity["kind"]> = ["guided", "challenge", "assessment"];

/**
 * Completion rule for one activity (lesson-schema §3 `completion`):
 * `{ allTasks: true }` every task correct or marked failed;
 * `{ minCorrect: n }` at least n tasks correct;
 * `{ time: s }` at least s seconds elapsed in the activity.
 */
export function isActivityComplete(activity: Activity, attempts: AttemptRecord[], elapsedMs: number): boolean {
  const c = activity.completion;
  if ("allTasks" in c) return activity.tasks.every((t) => taskStatus(activity, t, attempts) !== "open");
  if ("minCorrect" in c) return activity.tasks.filter((t) => taskStatus(activity, t, attempts) === "correct").length >= c.minCorrect;
  return elapsedMs >= c.time * 1000;
}

/** `maxAttempts` for a task, falling back to the activity-kind default (docs/06 "Faded guidance"). */
export function maxAttemptsFor(activity: Activity, task: Task): number {
  return task.maxAttempts ?? DEFAULT_MAX_ATTEMPTS[activity.kind];
}

/** A task is correct once any attempt is correct, failed once its attempts are used up, else open. */
export function taskStatus(activity: Activity, task: Task, attempts: AttemptRecord[]): "correct" | "failed" | "open" {
  const mine = attempts.filter((a) => a.taskId === task.id && !a.microTask);
  if (mine.some((a) => a.outcome === "correct")) return "correct";
  return mine.length >= maxAttemptsFor(activity, task) ? "failed" : "open";
}

/** First task in `activity` that is neither correct nor failed, or `null`. */
export function nextTask(activity: Activity, attempts: AttemptRecord[]): Task | null {
  return activity.tasks.find((t) => taskStatus(activity, t, attempts) === "open") ?? null;
}

/** The activity after `currentId` in lesson order, or `null` after the last one. */
export function nextActivity(lesson: Lesson, currentId: string): Activity | null {
  const i = lesson.activities.findIndex((a) => a.id === currentId);
  return i >= 0 ? (lesson.activities[i + 1] ?? null) : null;
}
