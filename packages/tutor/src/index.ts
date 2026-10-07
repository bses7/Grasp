// @grasp/tutor public surface. See README.md and docs/07-ai-tutor.md.
// Every engine runs inside the /api/tutor route handler on our own server; the
// V1 local-model engine only on a lab-laptop instance. Nothing here calls a
// hosted or metered service.

export type { TutorService, TutorKind, TutorEngine } from "./tutor-service";
export {
  TUTOR_ENGINE_DEFAULT,
  HINT_LATENCY_BUDGET_MS,
  MAX_CALLS_PER_ATTEMPT,
  MAX_CALLS_PER_TASK,
  MAX_CALLS_PER_LESSON,
  MAX_HINT_CHARS,
  TUTOR_CONSTANTS,
} from "./constants";
export type { TutorConstants } from "./constants";
export {
  TASK_TYPES,
  EXPLAIN_OUTCOMES,
  ALLOWED_PLACEHOLDERS,
  REVEAL_PLACEHOLDERS,
  PLACEHOLDER_RE,
  MISTAKE_TEMPLATES,
  SEQUENCE_START_TEMPLATE,
  NARROW_CLAUSES,
  REVEAL_TEMPLATES,
  HINT_FALLBACK,
  fillTemplate,
} from "./templates";
export type { ExplainOutcome, Placeholder, NarrowKey } from "./templates";
export { tutorResponseSchema, parseTutorResponse } from "./response-schema";
export { TemplateTutorService } from "./template-tutor-service";
export type { TemplateTutorServiceOptions } from "./template-tutor-service";
export { staticFallback } from "./static-fallback";
export { LocalModelTutorService } from "./local-model-tutor-service";
export type { LocalModelTutorServiceOptions } from "./local-model-tutor-service";
export { LOCAL_MODEL_SYSTEM_PROMPT, buildLocalModelMessages } from "./prompt";
export type { LocalModelMessage } from "./prompt";
export { RemoteTutorService } from "./remote-tutor-service";
export type { RemoteTutorServiceOptions } from "./remote-tutor-service";
