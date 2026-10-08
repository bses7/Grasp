/**
 * @grasp/learning
 *
 * The deterministic learning engine (docs/06-learning-engine.md, locked position 5).
 * Pure, isomorphic TypeScript: no DOM, React, Three.js, MediaPipe, or fetch.
 * The scene reports events, this package compares them with lesson JSON,
 * and the AI tutor only explains what this package decided.
 */

export { evaluate } from "./evaluate";
export { countsAsAttempt } from "./counts-as-attempt";
export { computeMastery } from "./mastery";
export type { MasteryByObjective } from "./mastery";
export { nextHint, MAX_HINT_LEVEL, FALLBACK_HINT_TEMPLATE } from "./hints";
export {
  TIME_PROMPT_MS,
  DEFAULT_MAX_ATTEMPTS,
  ASSESSMENT_MASTERY_WEIGHT,
  GRADED_ACTIVITY_KINDS,
  isActivityComplete,
  maxAttemptsFor,
  taskStatus,
  nextTask,
  nextActivity,
} from "./sequencing";
export { TaskRunner } from "./task-runner";
export type { TaskRunnerOptions, Verdict } from "./task-runner";
export { REMEDIATION_SEQUENCE, RETRY_HINTS_USED, shouldRemediate, synthesiseMicroTask } from "./remediation";
export type { RemediationStep } from "./remediation";
export { LogBuffer, FLUSH_INTERVAL_MS, FLUSH_BATCH_SIZE } from "./log-buffer";
export { SessionLogger, falseStartRate } from "./logger";
export type { LogTransport } from "./log-buffer";
