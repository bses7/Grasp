import type { SceneEvent } from "@grasp/types";

/**
 * Tracking-loss discard (docs/06 "Task types", docs/05 `drop.cause`).
 *
 * A `drop` whose `cause` is `"lost"` means hand tracking was lost mid-grab and
 * the scene settled the part where it was. The learner did nothing, so the
 * event is logged but never graded and never consumes an attempt, in every
 * task type. Every other scene event may count; the task-type filter
 * (e.g. a `select` during a `place` task is not an attempt) is applied by the
 * sequencing layer in Phase D, not here.
 */
export function countsAsAttempt(event: SceneEvent): boolean {
  if (event.type === "drop" && event.cause === "lost") return false;
  return true;
}
