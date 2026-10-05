# @grasp/learning

The deterministic learning engine from [docs/06-learning-engine.md](../../docs/06-learning-engine.md). It turns a scene event (`select`, `place`, `drop`) into evidence about a learning objective by comparing it with the active task's `expect` block in lesson JSON.

## Invariant

**Deterministic, declarative, never the tutor.** Same lesson JSON, same event stream, same result, in the gesture condition, the mouse condition, a unit test, and a server replay. The AI tutor explains and phrases hints from this package's output; it never grades (locked position 5). Nothing here reads XP or badges; mastery is derived from attempt scores only.

## Boundary

Imports only `@grasp/types` and `@grasp/content`. No DOM, React, Three.js, MediaPipe, or `fetch`. The log transport is injected by `apps/web/lib/logger-transport.ts`. This is what lets `apps/web`, `scripts/research`, and route handlers share one engine.

## Contents

| File | Owns | Status |
|---|---|---|
| `src/evaluate.ts` | `evaluate(task, event, attemptState)`: the five-case switch from `lesson-schema` §5 | stub, Phase D M8 |
| `src/counts-as-attempt.ts` | `countsAsAttempt(event)`: tracking-loss discard (`drop` with `cause: "lost"` never counts) | implemented, tested |
| `src/mastery.ts` | `computeMastery(attempts, objectives, lesson)`: weighted mean of latest normalised scores, assessment 2x | stub |
| `src/hints.ts` | `nextHint(task, hintsUsed)`: nudge, narrow, reveal; `tutor: true` is a request, with a static fallback | stub |
| `src/sequencing.ts` | activity completion, next task and activity, `TIME_PROMPT_MS`, default attempts per kind | stub, constants real |
| `src/remediation.ts` | repeated-failure policy: worked example, micro-task, retry, then mark failed | stub, constants real |
| `src/log-buffer.ts` | `LogBuffer` with `push` and `flush`; transport injected | stub, constants real |

## Milestones (docs/17)

| Milestone | This package delivers |
|---|---|
| M1 to M7 | Nothing; the smallest prototype (locked position 10) hard-codes one socket check in the scene |
| M8 | `evaluate`, `countsAsAttempt`, `nextHint`, sequencing for the heart lesson; fixture tests replaying recorded `LogEvent` streams |
| M9 | `computeMastery`, the mastery screen data, `LogBuffer` wired to `/api/events` |
| M10 | `remediation` policy; `time_prompt` at `TIME_PROMPT_MS` |
| V1 | `task.remediation` authored override; server-side replay for tamper checks |

## Testing

Colocated Vitest files (`*.test.ts`). The target for M8 is a fixture per task type plus one end-to-end replay of the heart lesson that asserts per-objective mastery.
