import type { Task, TutorRequest, TutorResponse } from "@grasp/types";
import { HINT_FALLBACK, fillTemplate } from "./templates";

/**
 * Zero-cost fallback from doc 07 "Latency and failure handling".
 *
 * Returns a TutorResponse built from the task's authored hint at
 * req.hintLevel: text from Hint.text, highlight from Hint.highlight,
 * revealsAnswer true only at level 3. If the hint has no text (a tutor: true
 * hint without an authored fallback, or no hint at that level), returns
 * "Look again at the task: {prompt}" plus any static highlight.
 *
 * Used when the template resolver throws or validation fails (MVP), and on
 * timeout, connection error, refusal, or call cap for a V1 local model. The
 * caller loads the task from the lesson by id, which is why the task is a
 * separate argument rather than trusted from the request body.
 */
export function staticFallback(req: TutorRequest, task: Task): TutorResponse {
  const h = task.hints.find((x) => x.level === req.hintLevel);
  return {
    kind: "hint",
    text: h?.text ?? fillTemplate(HINT_FALLBACK, { prompt: task.prompt }),
    referencedComponentIds: [],
    highlight: h?.highlight ?? [],
    revealsAnswer: req.hintLevel === 3,
  };
}
