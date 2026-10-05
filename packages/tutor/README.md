# @grasp/tutor

The tutor seam described in [docs/07-ai-tutor.md](../../docs/07-ai-tutor.md). In **MVP** this package is a deterministic template engine: it returns the authored hint for the current level and composes mistake explanations from manifest data (component `name`, `description`, `relations`, `tags`) through a typed template map. No network, no model, no paid or metered service at any tier.

Phase C status: scaffold. The `TutorService` interface, constants, the template map and its test, the Zod response schema and its test are real. `TemplateTutorService` methods throw `TODO Phase D`; the V1 engines throw `TODO V1`.

## Files

| File | Tier | Role |
|---|---|---|
| `src/tutor-service.ts` | MVP | `TutorService` interface, `TutorKind`, `TutorEngine` (`"template" \| "local"`) |
| `src/templates.ts` | MVP | `MISTAKE_TEMPLATES[taskType][outcome]`, `NARROW_CLAUSES`, `REVEAL_TEMPLATES`, `HINT_FALLBACK`, `fillTemplate`; the allowed placeholder set |
| `src/templates.test.ts` | MVP | Every (task type, outcome) key exists; only allowed placeholders; no reveal placeholder outside `REVEAL_TEMPLATES` |
| `src/template-tutor-service.ts` | MVP | `TemplateTutorService`: resolves templates from the manifest and lesson supplied by the caller; pure, called by the `/api/tutor` route handler |
| `src/response-schema.ts` | MVP | Zod `tutorResponseSchema`, `parseTutorResponse`; applied to every engine's output |
| `src/static-fallback.ts` | MVP | Same-level authored hint when a resolver throws or validation fails |
| `src/constants.ts` | MVP | `TUTOR_ENGINE_DEFAULT`, `MAX_HINT_CHARS`, call caps, `HINT_LATENCY_BUDGET_MS` (V1 gate) |
| `src/local-model-tutor-service.ts` | V1 | `LocalModelTutorService`: open-weights model on the lab laptop behind `/api/tutor`, selected by `TUTOR_LOCAL_URL` |
| `src/prompt.ts` | V1 | `LOCAL_MODEL_SYSTEM_PROMPT`, `buildLocalModelMessages`; plain role and user strings, no vendor fields |
| `src/remote-tutor-service.ts` | V1/Future | Python service seam behind `TUTOR_SERVICE_URL` |

## Invariants (locked positions 5 and 7)

- The tutor never grades. It receives the engine's `evaluation` as final and only explains or hints.
- The tutor never sees video, landmarks, or screenshots. Its inputs are `SceneState`, the task with its `expect` block, the evaluation result, and the hint level.
- Vocabulary is the model manifest. Templates carry no subject nouns; every noun is filled from manifest text or the task prompt.
- No reveal below hint level 3 is enforced by construction: `{expectedName}` and `{restRegion}` may appear only in `REVEAL_TEMPLATES`, and the test asserts it.
- Identical requests produce identical text (research reproducibility across participants).
- This package never imports `@grasp/vision` or `@grasp/scene`, never reads `process.env` or a file, and never names a model vendor or price.

## Engine selection

`TUTOR_ENGINE_DEFAULT = "template"`. The route handler picks `LocalModelTutorService` only when `TUTOR_LOCAL_URL` is set (V1), after the engine has passed the measurement gate in doc 07: p95 hint latency under `HINT_LATENCY_BUDGET_MS` (3,500 ms) with MediaPipe and R3F live, 30 fps held, 100 percent guardrail pass on a sample, reproducible output. The hosted deployment always runs the template engine.
