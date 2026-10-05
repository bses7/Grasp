/**
 * @grasp/learning
 *
 * The deterministic learning engine (docs/06-learning-engine.md, locked position 5).
 * Pure, isomorphic TypeScript: no DOM, React, Three.js, MediaPipe, or fetch.
 * The scene reports events, this package compares them with lesson JSON,
 * and the AI tutor only explains what this package decided.
 */

export { evaluate } from "./evaluate.js";
export { countsAsAttempt } from "./counts-as-attempt.js";
export { computeMastery } from "./mastery.js";
export type { MasteryByObjective } from "./mastery.js";
export { nextHint, MAX_HINT_LEVEL, FALLBACK_HINT_TEMPLATE } from "./hints.js";
export {
  TIME_PROMPT_MS,
  DEFAULT_MAX_ATTEMPTS,
  ASSESSMENT_MASTERY_WEIGHT,
  GRADED_ACTIVITY_KINDS,
  isActivityComplete,
  nextTask,
  nextActivity,
} from "./sequencing.js";
export { REMEDIATION_SEQUENCE, RETRY_HINTS_USED, shouldRemediate, synthesiseMicroTask } from "./remediation.js";
export type { RemediationStep } from "./remediation.js";
export { LogBuffer, FLUSH_INTERVAL_MS, FLUSH_BATCH_SIZE } from "./log-buffer.js";
export type { LogTransport } from "./log-buffer.js";
