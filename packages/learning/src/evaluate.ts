import type { AttemptState, EvaluationResult, SceneEvent, Task } from "@grasp/types";

/**
 * Compare one scene event with the active task's `expect` block and return
 * `{ correct, partial, score, feedback }`.
 *
 * This is exactly the function in `lesson-schema` §5 and docs/06 "Learning
 * evaluation pseudocode". It is pure and synchronous: same task, event, and
 * attempt state always give the same result, for the gesture and the mouse
 * condition alike. The AI tutor never participates (locked position 5).
 *
 * Precondition: the caller has already filtered the event with
 * `countsAsAttempt` and the task-type rules in docs/06 (a `select` during a
 * `place` task, a `drop` outside every socket, and any `drop` with
 * `cause: "lost"` never reach this function).
 *
 * Phase D (M8) fills in the switch below.
 */
export function evaluate(task: Task, event: SceneEvent, attemptState: AttemptState): EvaluationResult {
  // switch (task.type) {
  //   case "identify":
  //     correct = event.type === "select" && event.componentId in expect.componentId (string or string[])
  //   case "place":
  //     correct = event.type === "place" && componentId === expect.componentId && socketId === expect.socketId
  //     partial = componentId === expect.componentId && socketId !== expect.socketId   // right part, wrong place
  //   case "remove":
  //     correct = event.type in ["drop", "place"] && componentId === expect.componentId
  //               && socketId !== expect.awayFromSocketId
  //   case "sequence":
  //     append { componentId, socketId? } to attemptState.steps
  //     a step without socketId matches a `select`; with socketId matches a `place`
  //     correct when steps match expect.steps (ordered if strictOrder, else as a set)
  //   case "compare":
  //     correct = event.type === "select" && event.componentId === expect.answer
  // }
  //
  // attemptState.attempts += 1
  // score = correct ? scoring.correct - hintsUsed * (scoring.hintPenalty ?? 0)
  //       : partial ? (scoring.partial ?? 0) : 0
  // feedback = {
  //   outcome: correct ? "correct" : partial ? "partial" : "incorrect",
  //   expected: task.expect, actual: eventSummary(event),
  //   nextHintLevel: correct ? null : min(hintsUsed + 1, 3)
  // }
  // return { correct, partial, score, feedback }
  void task;
  void event;
  void attemptState;
  throw new Error("TODO Phase D: evaluate (doc 06, M8)");
}
