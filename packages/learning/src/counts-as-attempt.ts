import type { SceneEvent, Task } from "@grasp/types";

/**
 * Which scene events are attempts at the active task (docs/06 "Task types" and "Learning evaluation
 * pseudocode"). Everything else is logged by the caller but never graded and never consumes an attempt.
 *
 * - Tracking-loss discard, first and in every task type: a `drop` with `cause: "lost"` means hand tracking
 *   was lost mid-grab and the scene settled the part; the learner did nothing.
 * - `place`: only a `place` counts. A `select` is how the learner grabs, and a `drop` outside every socket is
 *   repositioning, not an answer.
 * - `remove`: a `drop` or `place` of the expected component.
 * - `identify` and `compare`: a `select`. `sequence`: a `select` or a `place`.
 */
export function countsAsAttempt(task: Task, event: SceneEvent): boolean {
  if (event.type === "drop" && event.cause === "lost") return false;
  switch (task.type) {
    case "identify":
    case "compare":
      return event.type === "select";
    case "place":
      return event.type === "place";
    case "remove":
      return (event.type === "drop" || event.type === "place") && event.componentId === task.expect.componentId;
    case "sequence":
      return event.type === "select" || event.type === "place";
  }
}
