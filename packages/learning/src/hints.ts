import type { Hint, Task } from "@grasp/types";

/** Hint ladder depth: 1 nudge, 2 narrow, 3 reveal (docs/06 "Hints"). */
export const MAX_HINT_LEVEL = 3 as const;

/**
 * Deterministic fallback when a `tutor: true` hint cannot be served (route
 * unavailable or call cap reached): the hint's own static `text`/`highlight`
 * per the lesson-schema rule and doc 07. Narrows by component `type` without revealing.
 * Placeholders are filled from `feedback.actual` and the manifest component.
 */
export const FALLBACK_HINT_TEMPLATE = "That was the {actualName}. Look for a different {expectedType}." as const;

/**
 * Return the next hint on the ladder, or `null` when the ladder is exhausted
 * or the task has no hints (assessment tasks always have `hints: []`).
 *
 * Rules (docs/06):
 * - `hintsUsed` is the number already shown; the next level is `hintsUsed + 1`, capped at 3.
 * - A requested hint costs the same `hintPenalty` as an earned one.
 * - A hint with `tutor: true` is a *request* for the HUD to call `/api/tutor`;
 *   this package never calls the network. The hint's `text` or `highlight`,
 *   or `FALLBACK_HINT_TEMPLATE`, is the offline fallback.
 *
 * Phase D (M8).
 */
export function nextHint(task: Task, hintsUsed: number): Hint | null {
  void task;
  void hintsUsed;
  throw new Error("TODO Phase D: nextHint (doc 06, M8)");
}
