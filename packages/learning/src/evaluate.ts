import type { ActualSummary, AttemptState, EvaluationResult, HintLevel, SceneEvent, Task } from "@grasp/types";

/**
 * Compare one scene event with the active task's `expect` block and return
 * `{ correct, partial, score, feedback }`.
 *
 * This is exactly the function in `lesson-schema` §5 and docs/06 "Learning
 * evaluation pseudocode". It is deterministic: same task, event, and attempt
 * state always give the same result, for the gesture and the mouse condition
 * alike. The AI tutor never participates (locked position 5). It advances the
 * threaded `attemptState` (attempts, and steps for `sequence`) as the spec says.
 *
 * Precondition: the caller has already filtered the event with
 * `countsAsAttempt(task, event)` (a `select` during a `place` task, a `drop`
 * outside every socket, and any `drop` with `cause: "lost"` never reach this function).
 */
export function evaluate(task: Task, event: SceneEvent, attemptState: AttemptState): EvaluationResult {
  const actual = summarise(event);
  let correct = false;
  let partial = false;

  switch (task.type) {
    case "identify": {
      const ids = ([] as string[]).concat(task.expect.componentId);
      correct = event.type === "select" && !!event.componentId && ids.includes(event.componentId);
      break;
    }
    case "place":
      correct =
        event.type === "place" &&
        event.componentId === task.expect.componentId &&
        event.socketId === task.expect.socketId;
      // Right part, wrong place.
      partial = !correct && event.type === "place" && event.componentId === task.expect.componentId;
      break;
    case "remove":
      correct =
        (event.type === "drop" || event.type === "place") &&
        event.componentId === task.expect.componentId &&
        actual.socketId !== task.expect.awayFromSocketId;
      break;
    case "sequence": {
      if (actual.componentId) {
        attemptState.steps.push({ componentId: actual.componentId, ...(actual.socketId && { socketId: actual.socketId }) });
      }
      correct = stepsMatch(attemptState.steps, task.expect.steps, task.expect.strictOrder);
      break;
    }
    case "compare":
      correct = event.type === "select" && event.componentId === task.expect.answer;
      break;
  }

  attemptState.attempts += 1;
  const { scoring } = task;
  const score = correct
    ? scoring.correct - attemptState.hintsUsed * (scoring.hintPenalty ?? 0)
    : partial
      ? (scoring.partial ?? 0)
      : 0;
  return {
    correct,
    partial,
    score,
    feedback: {
      outcome: correct ? "correct" : partial ? "partial" : "incorrect",
      expected: task.expect,
      actual,
      nextHintLevel: correct ? null : (Math.min(attemptState.hintsUsed + 1, 3) as HintLevel),
    },
  };
}

/** What the engine stores and the tutor sees: ids only, never positions or landmarks. */
function summarise(event: SceneEvent): ActualSummary {
  switch (event.type) {
    case "select":
      return { type: event.type, ...(event.componentId ? { componentId: event.componentId } : { hotspotId: event.hotspotId }) };
    case "place":
      return { type: event.type, componentId: event.componentId, socketId: event.socketId };
    case "drop":
    case "hover":
      return { type: event.type, ...(event.componentId && { componentId: event.componentId }) };
  }
}

type Step = { componentId: string; socketId?: string };

function stepsMatch(actual: Step[], expected: Step[], strictOrder: boolean): boolean {
  if (actual.length !== expected.length) return false;
  const key = (s: Step) => `${s.componentId}@${s.socketId ?? ""}`;
  if (strictOrder) return actual.every((s, i) => key(s) === key(expected[i]!));
  const want = expected.map(key).sort();
  return actual.map(key).sort().every((k, i) => k === want[i]);
}
