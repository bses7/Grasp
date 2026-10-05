# Recommended Technology Stack

This file collects every technology recommended across [03](03-system-architecture.md), [04](04-computer-vision.md), [05](05-3d-interaction.md), [07](07-ai-tutor.md), [10](10-3d-content-system.md), [14](14-evaluation-methodology.md), and [16](16-folder-structure.md) into one table scored on the eight-point checklist from `project-conventions`, lists what the brief proposed that is deliberately not adopted, and closes with the final architecture diagram and the migration path. It mostly concerns **MVP**; **V1** rows exist where the MVP choice has a known successor. The detailed alternatives tables live in the owning docs and are linked, not repeated.

## Stack table

Columns 4 to 11 are the eight checklist points. "Necessary?" names the simpler alternative when the answer is not a plain yes.

| Layer | Choice | Tier | Why appropriate | Limitations | Browser performance | Accessibility | Privacy | Scalability | Complexity | Necessary? |
|---|---|---|---|---|---|---|---|---|---|---|
| Framework | Next.js, App Router ([03](03-system-architecture.md#backend-runtime-nextjs-route-handlers-versus-fastapi)) | **MVP** | Pages, static assets, and the five route handlers in one deploy; free on Vercel | Hobby 10 s function timeout; cold starts; Node only | Server code never ships; client bundle is React plus packages | None directly | Same origin, no CORS surface; secrets server-side; no third-party API called | Serverless, scales to zero and to the study | Low; one file per endpoint | Yes; the no-backend alternative is locked position 10 and is exceeded once persistence exists |
| UI runtime | React 19 | **MVP** | Required by Next.js and R3F; HUD and scene in one tree | Per-frame `setState` kills frame rate; discipline required | Fine when per-frame data stays in refs | Standard DOM, ARIA works | None | N/A | Low | Yes |
| Language | TypeScript, strict | **MVP** | Six typed interfaces in `packages/types` are the architecture | Types do not survive to a Python service without JSON Schema export | None | None | None | N/A | Low | Yes; plain JS loses the contracts |
| 3D | Three.js via React Three Fiber + Drei ([05](05-3d-interaction.md#1-library-decision)) | **MVP** | Declarative scene beside the HUD; `useGLTF`, `Html`, orbit rig free | WebGL on an iGPU is the ceiling; Drei pins a Three.js range | Negligible wrapper cost; `frameloop="demand"` idles the scene | `Html` labels are real DOM; keyboard path is ours | Renders locally, no network | Content-agnostic scene code | Low for a React developer; `r3f-perf` in dev only | Yes; plain Three.js is simpler per file but costs more HUD sync code |
| Asset pipeline | gltf-transform CLI + Draco (meshopt fallback) ([05 §8](05-3d-interaction.md#8-glb-authoring-and-compression-pipeline), [10](10-3d-content-system.md#authoring-workflow)) | **MVP** | Scriptable dedup, prune, weld, simplify, compress; under 5 MB per model | Draco decode adds 100–300 ms on first load | Smaller downloads; decoder is ~300 KB, self-hosted | None | None | CDN bandwidth drops roughly 5× | Low; one shell script | Yes; uncompressed GLBs break the 5 MB budget |
| Hand tracking | `@mediapipe/tasks-vision` HandLandmarker, WASM + GPU delegate, self-hosted and pinned ([04](04-computer-vision.md#hand-tracking-library)) | **MVP** | Only maintained in-browser option with no training; 21 landmarks, handedness | Relative noisy `z`; backlighting and occlusion; ~10 MB assets | 12–20 ms per frame on iGPU | Gesture input excludes some learners; mouse path always present | Frames processed and discarded in memory; nothing leaves the device | Zero server cost | Low; one init pattern | Yes for the gesture condition; the mouse condition is the simpler alternative and ships regardless |
| Inference placement | Web Worker with `ImageBitmap` transfer ([04](04-computer-vision.md#inference-placement-web-worker)) | **MVP** | Inference never blocks rendering | GPU delegate in a worker needs `OffscreenCanvas`; Safari partial | Returns the whole render budget to R3F | None | None | Client-side only | Moderate; ~200 lines of `postMessage` typing | Yes on iGPU laptops; alternate-frame main-thread fallback is the simpler path and ships as fallback |
| Smoothing | One-Euro filter, in-house | **MVP** | Two parameters, adaptive; standard for pointer-like input | Needs tuning from logs (`beta` especially) | Under 1 ms | Reduces jitter for tremor | None | N/A | ~60 lines | Yes; EMA is simpler but lags on every move |
| Input abstraction | Mouse adapter emitting the same `InteractionEvent` ([05 §7](05-3d-interaction.md#7-mouse-and-keyboard-equivalents)) | **MVP** | One scene code path; valid research control | Must stay feature-matched to gestures or the study is confounded | None | This is the accessibility path | None | N/A | Low | Yes; required by locked position 8 |
| State | Zustand ([03](03-system-architecture.md#state-management)) | **MVP** | Transient subscriptions keep per-frame data out of React | No enforced structure | Protects the frame budget | Discrete updates feed ARIA live regions | Nothing persists | N/A | Three small files | Yes; Context re-renders every consumer |
| Styling | Tailwind CSS + CSS custom-property tokens ([11](11-ui-ux.md)) | **MVP** | One token source read by DOM and scene | Class soup if undisciplined | Build-time CSS, no runtime | Contrast values live in tokens | None | N/A | Low | Yes; plain CSS loses shared names with the 3D layer |
| Accessible primitives | Radix UI (unstyled) | **MVP** | Dialogs, focus traps, live regions done correctly | Another dependency; headless means we style everything | Small | This is the point | None | N/A | Low | Yes; hand-rolled dialogs get focus management wrong |
| Validation | Zod, with JSON Schema export | **MVP** | One library validates lesson JSON at build and API payloads at runtime; the JSON Schema feeds editors and a future Pydantic layer | Error messages need shaping for authors | Small client bundle for the manifest schema only | None | Unknown fields rejected at the trust boundary | N/A | Low | Yes; TypeScript alone validates nothing at runtime |
| AI tutor | `packages/tutor` template engine (`TemplateTutorService`): hint ladder plus manifest `description`, `relations`, `tags` filled into fixed templates ([AI Tutor](07-ai-tutor.md)) | **MVP** | Deterministic, reproducible in the study, zero cost, no network, no vendor; the same `TutorService` seam as any later engine | Cannot answer free text or phrase beyond its templates; explanation quality is bounded by manifest authoring | None; a few hundred lines of pure TypeScript | Plain text plus highlight ids | Scene state and task only; nothing leaves the deployment | Stateless; no per-call cost at any scale | Low; templates plus Zod output validation | Yes for `tutor: true` hints and mistake explanations; static hints alone are the simpler alternative and remain the fallback |
| AI tutor, local model | Open-weights model run locally: Ollama on the lab laptop behind `/api/tutor`, or WebLLM in the browser, as `LocalTutorService` ([AI Tutor](07-ai-tutor.md)) | **V1**, only after measurement | Richer phrasing of the same scene-state payload without any metered API | Must meet the 3.5 s hint budget without breaking the 30 fps budget; WebLLM competes with MediaPipe and R3F for the GPU; Ollama ties the tutor to one machine | WebLLM: multi-GB download and GPU contention; Ollama: none in the browser | Same as template | Same as template; stays on the lab network | One laptop; not a hosted service | Moderate; one adapter class and a measurement harness | Not until the template engine is shown insufficient; a hosted metered API is excluded by rule |
| Database | Postgres on Neon free tier (Supabase acceptable; final call in [09](09-database.md)) | **MVP** | Relational fits attempts, progress, and append-only logs; branching for schema changes | Free tier sleeps and caps compute hours; connection limits | None | None | Researcher's own database; deletion per session in one place | Thousands of sessions untouched | Low with Drizzle | Yes; the JSON-download fallback alone fails the S2 linkage requirement |
| ORM and migrations | Drizzle ORM | **MVP** | SQL-shaped, typed schema in `packages/db`, migration files in Git | Younger than Prisma; fewer examples | None | None | None | Fine | Low | Yes; raw SQL is simpler per query but loses typed rows in route handlers |
| Hosting | Vercel Hobby | **MVP** | Zero-config Next.js deploy from Git; preview URLs for pilot content | 10 s functions, 100 GB bandwidth, non-commercial terms; no paid plan at any tier, so growth is met by R2 free-tier assets and session archiving | Edge CDN for static assets | None | Logs retained by Vercel; no learner identity in them | Scales to the study; cost appears at thousands of lessons | Lowest | Yes; self-hosting costs more time than it saves |
| Object storage and CDN | Cloudflare R2 with a custom domain (alternatives compared in [10 GLB hosting](10-3d-content-system.md#glb-hosting): `public/`, Vercel Blob, Supabase Storage) | **V1** | 10 GB free, zero egress fees, immutable versioned keys `models/<modelId>/`; decouples GLB changes from deploys | Separate account and CORS config; another credential; a CSP `connect-src` entry | Cached GLB on repeat visits; one extra connection on first load | None | Learner IPs reach Cloudflare for asset fetches only; no learner-specific data | Bandwidth is the first thing that grows ([15](15-risks-security-scalability.md#scalability)) | Low; one upload script and one environment variable | Not for MVP: the pilot serves GLB from `apps/web/public/` on Vercel's edge cache, one 5 MB model to a few hundred sessions within Hobby limits. Move to R2 before the main study |
| Local development | Docker Compose, Postgres only | **MVP** | One command gives a disposable local database | Docker Desktop on Windows is heavy | None | None | None | N/A | Five-line compose file | Yes; a Neon dev branch is the simpler alternative if Docker is unwanted |
| Monorepo | pnpm workspaces ([16](16-folder-structure.md#workspace-tooling)) | **MVP** | Strict linking enforces package boundaries | One more tool | None | None | None | Fine to ten packages | Three-line config | Yes; a flat package cannot protect the engine's purity |
| Testing | Vitest for packages; Playwright for the study flow | Vitest **MVP**, Playwright **V1** | `evaluate()` and the FSM are pure functions; a smoke test of consent → lesson protects the pilot | Gesture input cannot be e2e-tested without recorded landmarks; FSM tests use synthetic landmark sequences | None | Playwright with axe adds an accessibility gate in **V1** | The no-network test from [14 §7](14-evaluation-methodology.md#7-ethics-consent-and-data-minimisation) lives here | N/A | Low | Vitest yes; Playwright can wait until the second lesson |
| Tooling and CI | ESLint (`next/core-web-vitals`, `no-restricted-imports`), Prettier, GitHub Actions | **MVP** | Boundary rule enforced in lint; `content:validate` on every push | Nothing notable | None | `eslint-plugin-jsx-a11y` catches basics | None | N/A | Low | Yes; cheap and prevents a broken manifest reaching a participant |
| Content authoring | Blender glTF exporter | **MVP** | Free, scriptable, names meshes and socket empties directly | Largest single content effort in MVP | N/A | N/A | N/A | N/A | High skill, low tooling | Yes; adapting a CC-licensed model is the simpler alternative |
| Research logging | Own route handler to Postgres; end-of-session JSON download fallback ([14 §6.4](14-evaluation-methodology.md#64-logger-transport)) | **MVP** | Schema control, deletion by key, no third party | Batching and retry written by hand | One `fetch` per 10 s, `sendBeacon` on unload | None | Data stays in the researcher's database | Thousands of sessions | ~200 lines | Yes; a study without reliable logs is not a study |
| Authentication | None: anonymous research sessions ([03](03-system-architecture.md#authentication)); Auth.js or Supabase Auth later | None **MVP**, accounts **V1** | Pseudonymous by construction | No cross-device continuity | None | Removes a login barrier | Strongest option | One row per participant | One route handler | Accounts are unnecessary until other people use the product |
| Error monitoring | None in MVP; Sentry free tier at V1 with `sessionId` scrubbed | **V1** | Route handler logs suffice for a pilot the developer attends | Client errors in unattended sessions go unseen | Sentry SDK adds ~30 KB | None | Must scrub `sessionId` before enabling | Fine | Low | Not for MVP; `console.error` plus the `status` column in `ai_interactions` is the alternative |

## Deliberately not adopted for MVP

The brief's draft assumes a conventional CV platform. These are the pieces that do not survive the solo-developer and in-browser constraints.

| Technology from the brief | Tier | One-line reason |
|---|---|---|
| FastAPI | **V1/Future** | The server does no numerical work; five JSON route handlers in the existing app replace it (locked position 1). Attaches at `services/` only for Python-only inference |
| Python backend generally | **V1/Future** | Same reason; TypeScript end to end keeps one language and one type system until a training pipeline exists |
| MediaPipe Pose | **Future** | Pose-based gestures are Future per locked position 2; doubles inference cost for no MVP task |
| Separate AI service | **V1/Future** | The tutor is one HTTP call behind `TutorService`; `RemoteTutorService` is the seam if a service ever appears (locked position 7) |
| Docker in production | **V1** | Vercel runs the app; Docker Compose is local Postgres only (locked position 9). A production container appears only with a Python service |
| Custom gesture ML | **Future** | Needs a dataset, a training pipeline, and a Python service; MediaPipe landmarks plus a rule-based FSM cover the five MVP gestures |
| `apps/admin` as a second deployable | **V1** | Authoring UI arrives as a route group inside `apps/web` when doc 10's trigger fires |
| Hosted LLM APIs (any vendor, any tier) | Never (excluded by rule) | Paid or usage-billed; excluded by the no-paid-tools decision of 2026-10-05 and locked position 7. The tutor is template-based in MVP; a locally run open-weights model is the only **V1** option |

Cost: the whole **MVP** runs on free no-card tiers (Vercel Hobby, Neon free Postgres) and open-source software; no metered API or paid tool appears at any tier, and the tutor has no per-call cost.

Also compared and rejected in the owning docs, with no tier because they are not deferred but replaced: TensorFlow.js hand-pose and the legacy `@mediapipe/hands` ([04](04-computer-vision.md#hand-tracking-library)); Babylon.js and Unity WebGL ([05](05-3d-interaction.md#1-library-decision)); Redux, Context, Valtio ([03](03-system-architecture.md#state-management)); LangChain, LlamaIndex, and any LLM orchestration layer ([07](07-ai-tutor.md)); headless CMS ([10](10-3d-content-system.md#content-versioning)); third-party analytics ([14](14-evaluation-methodology.md#64-logger-transport)); Clerk and Auth0 ([03](03-system-architecture.md#authentication)); Turborepo until CI time justifies it ([16](16-folder-structure.md#workspace-tooling)).

## Final Architecture Diagram

Solid nodes and edges are **MVP**. Dashed nodes are **V1** or **Future** seams that exist in the design but not in the MVP build. The trust boundary is the HTTPS line between the learner device and everything else; edge labels on the crossing edges name exactly what passes.

```mermaid
flowchart TD
  subgraph Device["Learner device: trusted with video, untrusted by the server"]
    L["Learner"]
    W["Webcam 720p"]
    CAP["Camera capture<br/>getUserMedia 640x360"]
    VW["Vision worker<br/>HandLandmarker WASM GPU"]
    FSM["Gesture FSM<br/>One-Euro, hysteresis"]
    MA["Mouse adapter<br/>control condition"]
    SC["R3F scene<br/>raycast, drag plane, sockets"]
    LE["Learning engine<br/>evaluate, mastery"]
    HUD["HUD<br/>prompts, hints, cv_status"]
    LG["Event logger<br/>batched, consent-gated"]
    ST["Zustand stores<br/>session, lesson, scene"]
  end

  subgraph Server["Vercel: Next.js route handlers"]
    RS["POST /api/session<br/>DELETE /api/session/:id"]
    RT["POST /api/tutor<br/>validate, cap, log"]
    TUT["TutorService (template)<br/>packages/tutor, in-process"]
    RA["POST /api/attempts<br/>PUT /api/progress"]
    RE["POST /api/events"]
    RC["GET /api/content/*"]
    AUTH["Auth.js"]
  end

  PG[("Postgres on Neon<br/>research_sessions, lesson_attempts, progress,<br/>event_logs, instrument_responses,<br/>consent_records, ai_interactions")]
  CT[("content tables")]
  STATIC["Same-origin static<br/>mediapipe .task .wasm, draco,<br/>public/models GLB (MVP)"]
  CDN["Object storage + CDN (V1)<br/>GLB per modelId"]
  LOCAL["Local model (V1, measured)<br/>Ollama on lab laptop or WebLLM"]
  PY["services/ Python<br/>RemoteTutorService or RemoteVisionService"]

  L -->|hand| W
  L -->|mouse, keyboard| MA
  W -->|video frames| CAP
  CAP -->|ImageBitmap| VW
  VW -->|landmarks| FSM
  FSM -->|InteractionEvent| SC
  MA -->|InteractionEvent| SC
  SC -->|hover_result| FSM
  SC -->|SceneEvent| LE
  LE -->|EvaluationResult| HUD
  HUD -->|scene commands via engine| SC
  SC -.->|SceneState| ST
  LE -.-> ST
  HUD -.-> ST
  FSM -->|cv_status| HUD
  LE -->|LogEvent| LG
  FSM -->|LogEvent| LG
  SC -->|LogEvent| LG
  HUD -->|renders to| L

  STATIC -->|pinned assets, same origin| VW
  STATIC -->|GLB, versioned path| SC
  CDN -.->|GLB, immutable key| SC

  HUD -->|SessionRequest: consent version, assignment_code| RS
  HUD -->|TutorRequest: SceneState, task, evaluation| RT
  LE -->|attempt rows, mastery| RA
  LG -->|LogEvent batch, no landmarks| RE

  RT -->|hint(req), same process, no network| TUT
  RT -.->|TUTOR_ENGINE=local, same TutorRequest| LOCAL
  RT -->|ai_interactions row| PG
  RS --> PG
  RA --> PG
  RE --> PG
  RC -.-> CT
  RT -.->|same TutorRequest JSON| PY
  AUTH -.-> PG

  classDef v1 stroke-dasharray: 6 4,stroke:#888,color:#555
  class RC,AUTH,CT,PY,CDN,LOCAL v1
```

| Element | Tier | Notes |
|---|---|---|
| Learner, webcam, camera capture, vision worker, gesture FSM, mouse adapter, scene, learning engine, HUD, logger, stores | **MVP** | All in the browser; frames and landmarks never leave the worker and FSM. Module contents in [16](16-folder-structure.md#directory-guide) |
| Route handlers `session`, `tutor`, `attempts`, `events` (`progress` is **V1**) | **MVP** | Validate with Zod, verify `sessionId` against the cookie, write rows; no business logic |
| Postgres tables | **MVP** | Six MVP tables: `research_sessions`, `lesson_attempts`, `event_logs`, `instrument_responses`, `consent_records`, `ai_interactions`, plus `progress` (**V1**), as named in [09](09-database.md) |
| Same-origin static assets | **MVP** | `public/mediapipe/`, `public/draco/`, `public/models/` (GLB for the pilot); CSP allows `'self'` and `'wasm-unsafe-eval'` only |
| Object storage and CDN | **V1** | Cloudflare R2 before the main study; one immutable key per model id; `NEXT_PUBLIC_ASSET_BASE_URL` switches the loader ([10 GLB hosting](10-3d-content-system.md#glb-hosting)) |
| `TutorService` (template), `packages/tutor` | **MVP** | Called in-process by `/api/tutor` only; templates over the hint ladder and manifest data per [07](07-ai-tutor.md); no network egress |
| Local model (Ollama or WebLLM) | **V1**, measured | Selected by `TUTOR_ENGINE=local` and `TUTOR_LOCAL_URL` in the same route handler, only after it meets the 3.5 s hint and 30 fps budgets; a hosted metered API is never an option |
| `GET /api/content/*`, content tables | **V1** | Appear when the authoring UI exists; the engine keeps consuming the same `Lesson` JSON |
| Auth.js | **V1** | Accounts for a multi-lesson product; `research_sessions.user_id` stays nullable |
| `services/` Python | **V1/Future** | Swapped in by environment variable behind `TutorService` or `VisionService`; the only reason is custom gesture training or Python-only inference |

What crosses the trust boundary, and what never does, is specified in [03](03-system-architecture.md#what-crosses-the-trust-boundary): session requests, tutor requests with `SceneState`, attempt and progress rows, and `LogEvent` batches go up; static assets come down; video, `ImageBitmap`s, landmarks, cursor trails, and learner identity never cross.

## Migration path

**MVP** is everything solid in the diagram: one Next.js deploy on Vercel Hobby, in-browser MediaPipe and R3F, a deterministic engine over lesson JSON in the repo, one tutor route calling the template engine in-process, Postgres on a free tier holding only pseudonymous research data, and GLBs served from `apps/web/public/` on Vercel's edge cache. **V1** is reached without rewriting any of it: accounts arrive through Auth.js with a nullable `user_id`, content moves from files to tables behind `GET /api/content/*` while the engine keeps reading the same `Lesson` type, the authoring UI is a route group in the same app, the four postponed gestures are added to the FSM, server-side mastery recompute imports the same `packages/learning`, a locally run open-weights model may replace the template engine behind the same route once measured, Cloudflare R2's free tier absorbs the first pressure (GLB bandwidth, per [Scalability](15-risks-security-scalability.md#scalability)), and Playwright, Sentry, and Turborepo are added when their trigger fires. **Future** is where the seams are used rather than merely kept: a Python service in `services/` behind `RemoteTutorService` or `RemoteVisionService` for custom gesture models, pose tracking in the same worker contract, and the VR, AR, mobile, and multiplayer directions in [Future Expansion](18-future-expansion.md), none of which changes an `InteractionEvent`, a `SceneEvent`, or a lesson file.

## Related

- [System Architecture](03-system-architecture.md): component diagram and the per-module alternatives tables this file summarises.
- [Computer Vision Architecture](04-computer-vision.md), [3D Interaction Architecture](05-3d-interaction.md), [AI Tutor](07-ai-tutor.md), [3D Content Architecture](10-3d-content-system.md), [Evaluation Methodology](14-evaluation-methodology.md): owning docs for each row's full checklist.
- [Database Architecture](09-database.md): Neon versus Supabase decision and the seven tables in the diagram.
- [Technical Risks, Security and Privacy, Scalability](15-risks-security-scalability.md): CSP, threat model, what breaks first.
- [Project Folder Structure](16-folder-structure.md): where each technology lives in the repo.
- [Development Roadmap](13-roadmap.md) and [Future Expansion](18-future-expansion.md): when each dashed element is built.
