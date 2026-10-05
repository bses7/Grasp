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
 * Phase D (M8).
 */
export function isActivityComplete(activity: Activity, attempts: AttemptRecord[], elapsedMs: number): boolean {
  void activity;
  void attempts;
  void elapsedMs;
  throw new Error("TODO Phase D: isActivityComplete (doc 06, M8)");
}

/** First task in `activity` that is neither correct nor failed, or `null`. Phase D (M8). */
export function nextTask(activity: Activity, attempts: AttemptRecord[]): Task | null {
  void activity;
  void attempts;
  throw new Error("TODO Phase D: nextTask (doc 06, M8)");
}

/** The activity after `currentId` in lesson order, or `null` after `mastery`. Phase D (M8). */
export function nextActivity(lesson: Lesson, currentId: string): Activity | null {
  void lesson;
  void currentId;
  throw new Error("TODO Phase D: nextActivity (doc 06, M8)");
}
