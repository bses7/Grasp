/**
 * Tutor configuration constants from docs/07-ai-tutor.md.
 *
 * The MVP engine is the deterministic template tutor (locked position 7).
 * No model identifiers, token limits, or prices live here or anywhere else in
 * the repository: a hosted metered API is never an option.
 */

/** Engine selected when TUTOR_LOCAL_URL is not set. */
export const TUTOR_ENGINE_DEFAULT = "template" as const;

/**
 * V1 local-model gate only (doc 07 "Tutor engine", measurement gate). A local
 * open-weights engine must deliver p95 hint latency under this budget with
 * MediaPipe and R3F live, or it is not used. Also the per-call timeout for
 * LocalModelTutorService, no retry. The template tutor has no latency to gate.
 */
export const HINT_LATENCY_BUDGET_MS = 3500 as const;

/** Call caps from doc 07 "Latency and failure handling", counted per sessionId; bound log volume and laptop load. */
export const MAX_CALLS_PER_ATTEMPT = 1 as const;
export const MAX_CALLS_PER_TASK = 3 as const;
export const MAX_CALLS_PER_LESSON = 12 as const;

/** Cap on TutorResponse.text; a longer text is truncated at a sentence boundary or falls back to the static hint. */
export const MAX_HINT_CHARS = 320 as const;

export const TUTOR_CONSTANTS = {
  engineDefault: TUTOR_ENGINE_DEFAULT,
  hintLatencyBudgetMs: HINT_LATENCY_BUDGET_MS,
  maxCallsPerAttempt: MAX_CALLS_PER_ATTEMPT,
  maxCallsPerTask: MAX_CALLS_PER_TASK,
  maxCallsPerLesson: MAX_CALLS_PER_LESSON,
  maxHintChars: MAX_HINT_CHARS,
} as const;

export type TutorConstants = typeof TUTOR_CONSTANTS;
