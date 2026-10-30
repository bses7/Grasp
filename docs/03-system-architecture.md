# System Architecture

Grasp is a single Next.js application. Everything that touches the webcam, the 3D scene, and learning evaluation runs in the browser; the server is a handful of route handlers that mint research sessions, answer tutor requests from the template engine in `packages/tutor`, and persist attempts, progress, and event logs to Postgres. No third-party API is called anywhere in the MVP. GLB models and MediaPipe assets are static files served from the app's own `public/` directory in **MVP**, moving to object storage behind a CDN in **V1**. This file mostly concerns **MVP**; where a boundary exists only so that **V1** can attach something later, it says so.

## Component diagram

```mermaid
flowchart TD
  subgraph Browser["Browser (learner device, trusted with video, untrusted by server)"]
    CAM["Camera capture<br/>getUserMedia 640x360"]
    VW["Vision worker<br/>HandLandmarker WASM/GPU"]
    FSM["Gesture FSM<br/>One-Euro, hysteresis"]
    MOUSE["Mouse adapter<br/>(control condition)"]
    SCENE["R3F scene<br/>raycast, drag plane, sockets"]
    ENGINE["Learning engine<br/>deterministic evaluate()"]
    HUD["HUD / UI<br/>prompts, hints, feedback"]
    LOG["Event logger<br/>batched, consent-gated"]
    STORE["Zustand stores<br/>session, lesson, scene"]
  end

  subgraph Server["Server (Vercel, Next.js route handlers)"]
    RS["POST /api/session<br/>consent + session code, or resume"]
    RT["POST /api/tutor<br/>validate, cap, log"]
    TUT["TutorService (template)<br/>packages/tutor, in-process"]
    RA["POST /api/attempts<br/>PUT /api/progress (V1)"]
    RE["POST /api/events<br/>research log ingest"]
    RD["/api/session/:id<br/>PATCH progress, DELETE, GET export, POST restart"]
  end

  PG[("Postgres<br/>Neon or Supabase")]
  STATIC["apps/web/public on Vercel (MVP)<br/>GLB, Draco, MediaPipe WASM"]
  CDN["Object storage + CDN (V1)<br/>same assets, before main study"]
  LOCAL["Local model (V1, measured)<br/>lab-laptop app instance only"]

  CAM -->|ImageBitmap| VW
  VW -->|landmarks| FSM
  FSM -->|InteractionEvent| SCENE
  MOUSE -->|InteractionEvent| SCENE
  SCENE -->|SceneEvent| ENGINE
  ENGINE -->|EvaluationResult| HUD
  SCENE -.->|SceneState| STORE
  ENGINE -.-> STORE
  HUD -.-> STORE
  ENGINE -->|LogEvent| LOG
  FSM -->|tracking_lost etc.| LOG
  STATIC -->|GLB, .task, .wasm| Browser
  CDN -.->|V1 replaces STATIC| Browser

  HUD -->|TutorRequest| RT
  RT -->|same process, no network| TUT
  RT -.->|TUTOR_ENGINE=local| LOCAL
  RT --> PG
  LOG -->|LogEvent batch| RE
  ENGINE -->|attempt rows| RA
  Browser --> RS
  Browser --> RD
  RS --> PG
  RA --> PG
  RE --> PG
  RD --> PG

  classDef v1 stroke-dasharray: 6 4,stroke:#888,color:#555
  class LOCAL,CDN v1
```

The trust boundary is the HTTP line between the two subgraphs. Video, `ImageBitmap`s, and landmarks exist only above it. Landmarks go to the gesture FSM and, through the `showHands` option (opt-in at the vision API, always on in the lesson's camera preview), to the camera preview overlay, which draws and drops them each frame ([04 Landmark preview overlay](04-computer-vision.md#landmark-preview-overlay)). The only objects that cross it are listed in [What crosses the trust boundary](#what-crosses-the-trust-boundary).

## What runs where and why

| Concern | Runs in | Why | Tier |
|---|---|---|---|
| Camera capture, hand landmarking, gesture classification | Browser (Web Worker) | Locked position 2: video never leaves the device. Also removes server GPU cost and round-trip latency, which would make a 30 fps cursor impossible. | **MVP** |
| 3D rendering, raycasting, drag plane, snapping | Browser (main thread) | Only the browser has the GPU and the cursor. | **MVP** |
| Learning evaluation (`evaluate(task, event)`) | Browser, from lesson JSON | Locked position 5: deterministic and declarative. Running it client-side gives instant feedback and works offline. The same `learning` package is isomorphic so the server can recompute mastery from stored attempts in **V1** for integrity. | **MVP** |
| Mastery computation | Browser (MVP), server recompute (**V1**) | Trivial arithmetic over attempts; a study participant is not an adversary. XP is **V1** per [Gamification](08-gamification.md) and is not computed in MVP. | **MVP** |
| Session recording and condition capture | Server | Randomisation is done offline by the researcher (blocked list, per `research-protocol`). The researcher enters a pre-assigned session code that encodes the study phase and condition ([format](#session-create-and-resume)); the server validates the code, records `condition` once, and rejects reuse. Nothing random happens on the server. | **MVP** |
| Tutor hints and mistake explanations | `POST /api/tutor` route handler: validates the `TutorRequest`, checks the cookie and the consent record, loads the task from the lesson by id, enforces the per-session call caps, calls `TemplateTutorService` from `packages/tutor` in-process (templates over the lesson hint ladder and manifest `description`, `relations`, `tags`), writes the `ai_interactions` row, returns a `TutorReply`. The lesson page emits the `tutor_message` LogEvent on receipt | Locked position 7: deterministic templates, no paid LLM API, no network egress. The engine is pure TypeScript and could run in the browser; it sits behind the route so validation, caps, and `ai_interactions` logging exist in one place. `TUTOR_ENGINE=local` (**V1**, measured) applies only to an app instance running on the lab laptop alongside the model; the hosted deployment always uses `template`. | **MVP** |
| Attempt, progress, and event persistence | Server to Postgres | Research data must survive the tab closing and be exportable per session. | **MVP** |
| Content (lesson JSON, model manifests) | Repo, imported at build time | One author, few lessons, versioned with the code. See [content versioning](10-3d-content-system.md#content-versioning). | **MVP** |
| GLB, Draco decoder, MediaPipe `.task` and WASM | `apps/web/public/` on Vercel, same origin | One heart GLB under 5 MB plus ~10 MB of MediaPipe assets fits Vercel's static hosting and edge cache; same origin keeps CSP simple; versions are pinned in the repo. | **MVP** |
| Same assets on object storage behind a CDN | Cloudflare R2 or similar, CORS-allowed, before the main study | Needed once there are several models or the Vercel bandwidth cap is in sight; self-hosted so no third-party CDN sees learner IPs. See [Scalability](15-risks-security-scalability.md#scalability). | **V1** |
| Accounts, teacher dashboards, content tables | Server | Not needed to validate the core loop or run the study. | **V1** |
| Python inference or gesture-model training | Separate service behind `TutorService`/`VisionService` seam | Locked position 1: only if MediaPipe gestures prove insufficient. | **V1/Future** |

## Data flow

### One task attempt (place `aorta` into `socket_aorta`)

| Step | Component | Input | Output | Crosses trust boundary |
|---|---|---|---|---|
| 1 | Camera capture | video frame | `ImageBitmap` posted to worker | No |
| 2 | Vision worker | bitmap, timestamp | 21 landmarks, handedness, confidence | No |
| 3 | Gesture FSM | smoothed landmarks | `pinch` entered with cursor over `aorta` → `{ type: "grab_start", cursor }` | No |
| 4 | R3F scene | `grab_start` | raycast hits `aorta`; drag plane created; `aorta` detached from any socket | No |
| 5 | Gesture FSM → scene | `pinch_drag` frames | `{ type: "grab_move", cursor, zHintDelta }` × N; position updated via refs, zero React renders | No |
| 6 | Gesture FSM → scene | `release` | `{ type: "grab_end", cursor }`; nearest accepting socket within radius is `socket_aorta`; snap | No |
| 7 | Scene → engine | `{ type: "place", componentId: "aorta", socketId: "socket_aorta" }` | `evaluate(task t_g3, event)` → `{ correct: true, score: 15, feedback }` | No |
| 8 | Engine → HUD, stores | `EvaluationResult` | feedback card; lesson store advances to next task; mastery recomputed for `obj_place_vessels` | No |
| 9 | Engine → logger | `task_attempt` LogEvent `{ taskId, correct, partial, score, attemptNo, hintsUsed }` | queued | No |
| 10 | Logger → server | `LogBuffer` (`@grasp/learning`) flushes every 10 s or at 50 queued, in batches of at most 50; on `pagehide` `navigator.sendBeacon` sends the rest as `text/plain`; every `fetch` uses `keepalive: true`, because a batch already in flight at `pagehide` has left the queue, so the beacon cannot resend it, and without `keepalive` a reload cancelled it (the metrics script found the resulting `seq` gaps); events are queued only while the session has logging consent; a failed POST keeps the events queued, except a 403 (session withdrawn, without logging consent, or not this cookie's), which drops the batch instead of retrying forever | `POST /api/events` → `event_logs` rows, `on conflict do nothing` on `(session_id, seq)` | Yes, events only |
| 11 | Engine → server | attempt row with a client-generated `id`, batches of at most 50 | `POST /api/attempts` → `lesson_attempts` row, `on conflict do nothing` so a retry writes once; on page close the lesson page beacons any attempt not yet saved, so a reload resumes with it; `PUT /api/progress` → `progress` upsert (**V1**; MVP recomputes mastery from `lesson_attempts`) | Yes |

In the mouse condition, steps 1 to 3 are replaced by the mouse adapter emitting identical `InteractionEvent`s from pointer events. Steps 4 to 11 are byte-for-byte the same, which is what makes the research comparison valid.

### One tutor call (mistake explanation)

As built in roadmap Phase 5, **MVP**. The example is an incorrect `place` in a guided activity.

```mermaid
sequenceDiagram
  participant L as Learner
  participant E as Learning engine
  participant H as Lesson page (callTutor)
  participant R as POST /api/tutor
  participant S as TemplateTutorService
  participant P as Postgres

  L->>E: place(right_atrium, socket_left_atrium)
  E->>H: EvaluationResult outcome=incorrect, nextHintLevel=2
  H->>H: show static feedback, plus any earned hint from authored text (no call)
  H->>R: TutorRequest kind=explain_mistake (askTutor, 3.5 s timeout)
  R->>R: Zod-validate body, body sessionId must equal cookie
  R->>R: load lesson, task and objective by id (body copy not trusted)
  R->>P: consent_records row, not withdrawn? (else 403)
  R->>P: count non-capped ai_interactions (caps 1 per attempt, 3 per task, 12 per lesson session)
  R->>S: explainMistake(req) unless capped
  S-->>R: TutorResponse, or throws (guardrail)
  R->>P: insert ai_interactions (engine=template, template_version, status, latency_ms)
  R-->>H: TutorReply { status, source, interactionId, latencyMs, response }
  H->>H: source=tutor: replace feedback text for 10 s, pulse highlight
  H->>H: emit LogEvent tutor_message { interactionId, status, source, taskId, kind, hintLevel, latencyMs }
  Note over H,P: tutor_message reaches Postgres through the logger's /api/events batch, not through /api/tutor
  Note over H,R: timeout or network error: static text stays, and tutor_message has status fallback_timeout or fallback_error, interactionId null. Usually no row exists, but the timeout aborts only the client, so a slow route can still insert a late row that the log cannot join
```

When the tutor is called (owned by [AI Tutor](07-ai-tutor.md)):

| Trigger | Calls `/api/tutor`? | Tier |
|---|---|---|
| Incorrect or partial attempt in a guided or challenge activity (not the remediation micro-task) | Yes, `kind=explain_mistake` at `feedback.nextHintLevel` | **MVP** |
| Earned hint after a failed attempt, including a level-2 `tutor: true` hint | No. The authored text is shown; that attempt's `explain_mistake` call covers it | **MVP** |
| Learner requests a hint with `tutor: true` and no authored `text` | Yes, `kind=hint`. No such hint exists in `chambers_v1`, so this path does not run in the pilot | **MVP** |
| Correct attempt, assessment activity, unsaved run, `?tutor=off` | No | **MVP** |

The tutor never receives video, landmarks, or a verdict to make. The route rebuilds the task prompt, objective statement, and `expect` from the lesson by id, and takes only the engine's outcome and actual-event summary from the body, plus the compact `SceneState` (bounded at 8,000 characters; the template engine reads none of it). In **MVP** the engine is a function invocation inside the route handler: the request leaves the browser only to reach the app's own origin, and nothing leaves the deployment. A capped call or a guardrail failure answers the static hint (`staticFallback`) with status `capped` or `fallback_invalid`, still with a row. The lesson page, not the route, emits the `tutor_message` LogEvent on every outcome, with scalar fields only, so the research log carries metadata and never the text. Template design, the manifest fields it may quote, guardrails, and the **V1** local-model measurement gate are owned by [AI Tutor](07-ai-tutor.md).

The tutor on/off switch is the `?tutor=off` URL flag, used only for the Phase 5 parity check. It is not recorded per session, because the tutor is on in both study arms and the study build never sets the flag (user decision 2026-10-30). There is no "Explain" button: mistakes are explained automatically, and the 1-per-attempt cap would leave such a button nothing to do (user decision 2026-10-30).

### What crosses the trust boundary

| Object | Direction | Contents | Never contains |
|---|---|---|---|
| `SessionRequest` / `SessionResponse` | both | Create (consent form): `{ sessionId, lessonId, assignmentCode, consent: { version, logging } }`. Resume (lesson page): `{ sessionId, lessonId, condition }`. Response `{ sessionId, resumed, condition, studyPhase, consentLogging, participantCode, lessonHash, contentChanged, elapsedMs, nextSeq, attempts, skipped }`, see [Session create and resume](#session-create-and-resume) | name, email, pre-test scores (MVP has no accounts; randomisation is offline) |
| `TutorRequest` / `TutorReply` | both | lesson, activity and task ids, hint level, `SceneState`, engine evaluation summary; returns `TutorReply { status, source, interactionId, latencyMs, response }` with text, referenced and highlight component ids | video, landmarks, free-text identity |
| `AttemptRow`, `ProgressRow` | up | task id, outcome, score, timing, hints used; per-objective mastery | landmarks |
| `LogEvent[]` | up | research-protocol event schema | video, images, raw landmark streams |
| GLB, `.task`, `.wasm`, Draco | down | static assets | anything learner-specific |

## Frontend modules

| Module | Chosen implementation | Role | Tier |
|---|---|---|---|
| Framework | Next.js (App Router) | Pages, static asset serving, route handlers, one deploy | **MVP** |
| UI runtime | React 19 | Component model for HUD and screens | **MVP** |
| 3D | React Three Fiber + Drei + Three.js | Declarative scene; GLTF loading, HTML overlays, orbit rig. Details in [3D Interaction Architecture](05-3d-interaction.md) | **MVP** |
| Computer vision | `@mediapipe/tasks-vision` HandLandmarker, self-hosted WASM, in a Web Worker | Landmarks → gestures → interaction events. Details in [Computer Vision Architecture](04-computer-vision.md) | **MVP** |
| Input adapter (control condition) | Mouse adapter in the `vision` package | Emits the same `InteractionEvent` vocabulary from pointer and keyboard | **MVP** |
| State management | Zustand with transient subscriptions for per-frame data; React state for UI | See [State management](#state-management) | **MVP** |
| UI system | Tailwind CSS + Radix primitives (unstyled, accessible) | HUD, dialogs, consent flow; no design-system lock-in. Visual direction in [UI/UX Architecture](11-ui-ux.md) | **MVP** |
| Learning engine | `packages/learning` (pure TypeScript, no DOM) | `evaluate`, mastery, activity sequencing from lesson JSON | **MVP** |
| Event logger | `packages/learning/logger` | `LogBuffer` buffers `LogEvent` and drops every event while its injected consent callback is false; `apps/web/lib/logger-transport.ts` batches to `/api/events`. The lesson page passes `() => boot.consentLogging`, the flag `POST /api/session` returns from `consent_records` | **MVP** |
| Schema validation | Zod | Validates lesson JSON at build time and API payloads at runtime; one schema library on both sides | **MVP** |

## Backend modules

| Module (brief's name) | Chosen implementation | Tier | Notes |
|---|---|---|---|
| FastAPI | **Not used in MVP.** Next.js route handlers (Node runtime) | **MVP** | See [Backend runtime decision](#backend-runtime-nextjs-route-handlers-versus-fastapi) |
| Authentication | Anonymous research sessions; `sessionId` UUID in an httpOnly cookie | **MVP** | Accounts via Auth.js or Supabase Auth in **V1**; see [Authentication](#authentication) |
| Learning Engine | Same `packages/learning` imported by route handlers | **MVP** (client) / **V1** (server recompute) | No separate service; it is a library |
| AI Service | `POST /api/tutor` route handler calling `TemplateTutorService` from `packages/tutor` in-process, behind the `TutorService` interface; `LocalModelTutorService` (Ollama or WebLLM) is **V1** after measurement | **MVP** | Cookie and consent checked; call-capped per session; logs to `ai_interactions`; no third-party call |
| Progress Service | `POST /api/attempts` route handler; Drizzle ORM to Postgres. `PUT /api/progress` and the `progress` cache table are **V1**; MVP recomputes mastery from `lesson_attempts` | **MVP** | Tables in [Database Architecture](09-database.md) |
| Content Service | Static JSON imported at build; GLB in `apps/web/public/` (CDN in **V1**). No route handler | **MVP** | Becomes `GET /api/content/*` over tables in **V1** when an authoring UI exists |
| Research log ingest | `POST /api/events` batch insert; `DELETE /api/session/:id` | **MVP** | Required by `research-protocol` data rules |

Database access uses Drizzle ORM over `postgres.js` (one connection per function instance, 3 s connect timeout) for both local Docker Postgres and Neon; the client lives in `apps/web/lib/db.ts` over `createDb` from `@grasp/db`. The driver choice is argued in [Database Architecture](09-database.md#orm-and-migrations-drizzle-prisma-or-raw-sql). The ORM choice carries its own checklist in [Recommended Technology Stack](19-tech-stack-and-final-diagram.md).

## Backend runtime: Next.js route handlers versus FastAPI

Decision (locked position 1): the **MVP** backend is Next.js route handlers inside the same deployable. FastAPI is **V1/Future**, attached only if Python-only inference or custom gesture-model training becomes necessary.

The brief assumes FastAPI because CV platforms usually do server-side inference. Here inference is in the browser by design, so the server does no numerical work at all. It validates JSON, calls one HTTP API, and writes rows.

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Next.js route handlers (same app) | One repo, one deploy, one language, shared Zod schemas and `types` package; free on Vercel; serverless scales to zero | Cold starts (~300 ms) on free tier; no Python ecosystem; a **V1** local model is never reached from the hosted deployment, only from an app instance running on the lab laptop with `TUTOR_ENGINE=local` | Excellent | **Recommended, MVP** |
| FastAPI service alongside Next.js | Python ML ecosystem; async; good for future model training | Second deployable, second language, CORS, separate auth, paid hosting (Fly, Railway) or always-on container; duplicated types | Poor for MVP | **V1/Future** behind seam |
| Supabase Edge Functions / Postgres RPC | Close to the DB; no extra deploy | Deno runtime diverges from Next.js code; splits logic across two places | Fair | Reject for MVP |
| tRPC inside Next.js | End-to-end types | Extra abstraction over five endpoints; route handlers plus Zod give the same safety | Fair | Reject |

Eight-point checklist for Next.js route handlers:

| Point | Assessment |
|---|---|
| 1 Appropriate | The server's whole job is five small JSON endpoints; a framework already in the repo covers it |
| 2 Limitations | Cold starts; Node-only (no Python); the hosted deployment runs only the millisecond template tutor, so a **V1** local model requires an app instance on the lab laptop |
| 3 Browser performance | None; server code does not ship to the client |
| 4 Accessibility | None directly |
| 5 Privacy | Same origin as the app, so no CORS surface; the database URL and cookie secret stay server-side; no third-party API receives learner data; logs can be deleted per session in one place |
| 6 Scalability | Serverless; scales to the study's tens of concurrent users without configuration. See [Scalability](15-risks-security-scalability.md#scalability) |
| 7 Complexity | Lowest possible: a file per endpoint, shared types |
| 8 Necessary? | Yes: something must validate payloads, enforce call caps, and write to Postgres. The simpler alternative, no backend at all, is locked position 10 and is exceeded only when persistence is added; the template tutor alone would not justify a server |

### The seam for a Python service

Every server-side capability that a Python service might one day replace is behind a TypeScript interface in `packages/tutor` and `packages/learning`, instantiated once in the route handler. The route handler is the only code that knows which implementation is live.

```ts
// packages/tutor/src/tutor-service.ts (declared identically in doc 07 "Tutor engine")
export interface TutorService {
  /** Return the authored hint at req.hintLevel (level 3 may reveal). MVP. */
  hint(req: TutorRequest): Promise<TutorResponse>;
  /** Explain an incorrect or partial attempt without contradicting the engine. MVP. */
  explainMistake(req: TutorRequest): Promise<TutorResponse>;
  /** Narrate per-objective mastery for the mastery screen. Optional; V1. */
  summarise?(req: TutorRequest): Promise<TutorResponse>;
}

// MVP, built: deterministic templates over the lesson hint ladder and manifest data; no network
new TemplateTutorService({ manifest, lesson });

// V1, stub that throws until the 3.5 s hint and 30 fps budgets are measured:
// open-weights model on the lab laptop (TUTOR_LOCAL_URL); engine column "local:<modelName>"
new LocalModelTutorService({ baseUrl, modelName });

// V1/Future, stub that throws: forwards the same JSON to a Python service (TUTOR_SERVICE_URL)
new RemoteTutorService({ baseUrl });
```

As built, `apps/web/app/api/tutor/route.ts` has no engine branch: it always constructs `TemplateTutorService` per request, and a `ponytail:` comment in the route records that the `TUTOR_ENGINE=local` and `TUTOR_SERVICE_URL` branches are added with the **V1** local-model gate. The route is still the only place an engine is chosen, so adding them touches that one file.

A hosted metered LLM API is never one of the branches; no model vendor name or price appears in this repository. The same pattern applies to a hypothetical `VisionService` (server-side landmark post-processing or a custom gesture classifier) and to server-side mastery recompute. The contract is the JSON types in `packages/types`; a Python service would implement them with Pydantic models generated from the same Zod schemas via JSON Schema. The **V1** intent is that swapping is an environment variable plus one branch in the route, not a refactor; today there is nothing to swap to. The folder placement is in [Project Folder Structure](16-folder-structure.md).

Limitation stated plainly: `TUTOR_ENGINE=local` applies only to an app instance running on the lab laptop alongside the model; the hosted deployment always uses `template`. A **V1** local model is therefore bounded by the lab laptop's inference speed; if measurement shows it cannot meet the 3.5 s hint budget, the answer is to keep the template engine, not a paid plan or a Python service.

## State management

Decision: Zustand for application state, with transient (non-rendering) subscriptions and refs for per-frame data. Ordinary React state for local UI such as open dialogs. **MVP**.

The hard constraint comes from the performance budget (locked position 6): the cursor and the grabbed object's pose change 30 times per second and must never cause a React re-render. Any store that funnels per-frame data through React state will fail the budget regardless of how elegant it is.

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Zustand | Tiny (~1 KB); `subscribe` without re-render for per-frame data; works outside React (worker message handler can write to it); already idiomatic in the R3F ecosystem | Few conventions; easy to put too much in one store | Excellent | **Recommended, MVP** |
| React Context + `useReducer` | No dependency | Every consumer re-renders on any change; unusable for per-frame data | Fair | Reject |
| Redux Toolkit | Mature devtools, strict patterns | Boilerplate; per-frame dispatch is an anti-pattern; heavier bundle | Poor | Reject |
| Jotai | Atomic, minimal | Less natural for a worker writing from outside React; smaller R3F community | Good | Acceptable, not chosen |
| Valtio (proxy) | Mutation-style API | Proxy overhead per frame; subtle re-render behaviour | Good | Reject |

Three stores, each small:

| Store | Holds | Update frequency | Read by |
|---|---|---|---|
| `sessionStore` | `sessionId`, `condition`, consent flags, camera permission state | Rarely | Nobody yet: `apps/web/stores/session-store.ts` exists but is unused. The lesson page holds these facts in the `boot` object returned by `POST /api/session`, and the logger reads consent from there, so the server row stays the single source of the consent flag |
| `lessonStore` | current activity and task, attempts per task, hints used, per-objective mastery (XP is **V1**) | On discrete events | HUD, engine, progress client |
| `sceneStore` | `SceneState` (hovered, grabbed, component socket occupancy, camera), tracking status | Per event; cursor position via a ref, not the store | Scene, HUD indicators, tutor client |

Eight-point checklist for Zustand:

| Point | Assessment |
|---|---|
| 1 Appropriate | Separates per-frame refs from rendered state cleanly; the R3F community default |
| 2 Limitations | No enforced structure; must document which fields are transient |
| 3 Browser performance | Negligible; the pattern exists precisely to protect the frame budget |
| 4 Accessibility | None directly; HUD state updates on discrete events feed ARIA live regions in [UI/UX Architecture](11-ui-ux.md) |
| 5 Privacy | None; nothing persists beyond the tab unless sent through the logger |
| 6 Scalability | N/A (client-side) |
| 7 Complexity | Three files, no boilerplate |
| 8 Necessary? | A shared store is needed because the worker, scene, engine, and HUD all read the same facts. The simpler alternative (props and refs only) breaks down once the HUD needs scene facts |

## Authentication

Decision: the **MVP** has no user accounts. Each study participant gets an anonymous research session: the client generates a v4 `sessionId` UUID (so the logger can buffer events before the first round trip), the server validates its format and uniqueness and records it in the `research_sessions` table with condition, consent version, and timestamps, and echoes it back in an httpOnly, SameSite=Strict cookie. This follows the recommendation in [Database Architecture](09-database.md#open-questions). The anonymisation key that links `sessionId` to a consent form is kept offline by the researcher, per `research-protocol`. Accounts arrive in **V1**.

The brief assumes authentication is a foundational service. For a study with ~130 participants who each use the product once or twice, accounts add a login screen, password handling, and a link between identity and process data that the ethics design wants to avoid.

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Anonymous research sessions (cookie + `research_sessions` row) | Zero login friction; data minimisation by construction; one route handler | No cross-device continuity; retention test (S2) needs the participant's code re-entered | Excellent | **Recommended, MVP** |
| Auth.js (NextAuth) with email magic link | Free; lives in the same Next.js app; adapters for Drizzle | Email provider needed; session table; moderate setup | Good | **V1** candidate |
| Supabase Auth | Free tier; pairs with Supabase Postgres; row-level security | Couples to Supabase hosting; RLS adds a learning curve | Good | **V1** candidate if Supabase is the chosen Postgres |
| Clerk / Auth0 | Polished UI, orgs, SSO | Paid beyond small free tier; third party holds student identity | Poor | Reject |

Session lifecycle for the study:

| Event | Server action |
|---|---|
| Consent accepted, researcher enters session code | `/consent` posts the create body to `POST /api/session`, which validates the client-generated `sessionId` and the pre-assigned session code (from the researcher's offline blocked-randomisation list) and inserts the `research_sessions` row (with `study_phase` and `condition` from the code, `consent_version`) and its `consent_records` row in one transaction; the unique `assignment_code` makes a study code single-use (409 on reuse); sets cookie. Declining shows a plain exit screen and stores nothing |
| Lesson in progress | All writes carry `sessionId` from the cookie; route handlers reject payloads whose body `sessionId` differs from the cookie |
| Retention test (+7 days) | Participant enters their printed code; `GET /api/session/:code` resolves `sessionId` for the retention form only (not built yet; answers 501) |
| Results screen | Shows the `participant_code`; a dev session (only) also offers "Try again", which calls `POST /api/session/:id/restart` (cookie-gated, 403 for pilot and main sessions): a fresh session for the same lesson and condition, the consent record copied, the cookie moved; the old session stays |
| Export | `GET /api/session/:id/export`, where `id` must equal the cookie's (403 otherwise), returns the six MVP tables as one JSON attachment. The researcher exports by session id or participant code with `pnpm research:export <id\|code> [out.json]`. Both call `exportSession` in `packages/db/src/privacy.ts` |
| Withdrawal | `DELETE /api/session/:id`, where `id` must equal the cookie's (403 otherwise), calls `withdrawSession` (`packages/db/src/privacy.ts`): in one transaction it stamps `consent_records.withdrawn_at` and deletes the `research_sessions` row, which cascades to `event_logs`, `instrument_responses`, `lesson_attempts`, `ai_interactions` (and `progress` once it exists in **V1**); the consent row is kept; the cookie is cleared. A participant who has left the device quotes the participant code, or the researcher looks up the session code they assigned (e.g. `PG-014`, for someone who stopped before the results screen), and runs `pnpm research:delete <id\|participant code\|session code>`, which calls the same function. No page has a withdraw button yet |

### Session create and resume

As built in roadmap steps 4.5 (persistence and resume) and 4.6 (consent), **MVP**. The 4.5 interim (dev rows with `consent_version = 'none'` and ungated logging) is gone: every session now starts at `/consent`.

| Concern | Behaviour |
|---|---|
| Cookie | `grasp_session`: httpOnly, `SameSite=Strict`, `Max-Age` 30 days, `Secure` in production |
| Consent text | `apps/web/lib/consent.ts`: `CONSENT_VERSION = "pilot-v1"`, title and paragraphs in the repo, so the wording a participant saw is reproducible from the version; a wording change means a new version. The event-log opt-in is a separate checkbox, unticked by default. The form does not ask for tutor payloads, so `consent_tutor_payloads` is always written `false` and the `ai_interactions` payload columns stay null (user decision 2026-10-30): the tutor text is rebuildable from the event log plus `research_sessions.lesson_hash` plus `ai_interactions.template_version`. Asking for it later means a new consent version |
| Session code format | `<phase><condition>-<number>`: phase `P` pilot, `S` main study, `D` dev; condition `G` gesture, `M` mouse; e.g. `PG-014` (number zero-padded to 3). Parsed by `parseAssignmentCode` in `apps/web/lib/consent.ts`, shared by the form and the route. Dev codes `DG` and `DM` need no number; the route stores them as `<code>-<first 8 of id>` (e.g. `DM-1a2b3c4d`) so the developer can reuse them. The parser also accepts 1–4 digits and an optional hyphen (`pg14` → `PG-014`). The app never randomises |
| Create request | From the consent form: `{ sessionId, lessonId, assignmentCode, consent: { version, logging } }`; `consent.version` must equal `CONSENT_VERSION`. A malformed code answers 400, a used one 409. A body id already taken gets a fresh server UUID. The form then stores `sessionId` in `localStorage` keyed by lesson and condition, sets the `sessionStorage` flag `grasp.consent`, and opens the lesson in the code's condition |
| Resume request | From the lesson page: `{ sessionId, lessonId, condition }`. Order: the cookie's session, then the body `sessionId`, each only if that row ran the same lesson in the same condition **and** has a `consent_records` row for its `consent_version`. Otherwise 404 and the page redirects to `/consent`; resume never creates a row |
| Camera gate | The lesson page mounts the lesson, and with it the camera preview and its "Start camera" button, only after a consented session resumes. If the database fails after consent in the same tab (`grasp.consent` set), the lesson runs unsaved with logging off |
| New row | `participant_code` (6 characters), `assignment_code`, `study_phase` and `condition` from the code, `consent_version`, `lesson_hash`, `app_version` from the deploy commit or `dev` |
| Response | `sessionId`, `resumed`, `condition`, `studyPhase`, `consentLogging` (from the consent record), `participantCode`, `lessonHash`, `contentChanged` (stored hash differs from current content), `elapsedMs` (server clock since `started_at`, so the client keeps one time base for `t`), `nextSeq` (`max(seq) + 1`), `attempts` (`lesson_attempts` ordered by `t`), `skipped` (`research_sessions.skipped_task_ids`) |
| Progress (`PATCH /api/session/:id`) | Cookie-gated like the delete. `{ skip: taskId }` appends the task to `skipped_task_ids` once (sent when the learner presses Skip on the remediation card); `{ ended: true }` stamps `ended_at` once (sent when the lesson reaches its results). Both are lesson progress, written for every consented session whatever the logging choice; the client sends them with `keepalive` and only for a saved session |
| Rebuild | `TaskRunner.resume` in `@grasp/learning` replays the attempt log: opens at the activity of the last attempt with attempts and revealed hint level restored; a reload between remediation and its micro-task counts the micro-task as done |
| Write guard | `/api/attempts` and `/api/events` reject (403) any row whose `sessionId` differs from the cookie's; the logger transport drops a batch on 403 rather than retrying |
| Unsaved attempts on close | On `pagehide` the lesson page beacons every attempt not yet acknowledged by `/api/attempts`; the client `id` makes the write idempotent, so a reload resumes with it |
| Logging and consent | Two gates. Client: the lesson page calls `createLoggerTransport(() => boot.consentLogging)`, and `LogBuffer` drops every event while that is false, so nothing is queued or sent. Server: `/api/events` answers 403 unless the session has a non-withdrawn consent record with `consent_logging = true`. Attempts (`/api/attempts`) are saved for every consented session, because taking part, not the log opt-in, covers them |
| Database unavailable | No `DATABASE_URL` or Postgres down: every route answers 503 within the 3 s connect timeout, and the lesson runs unsaved with a visible "Not saving" chip |

Limitation: a resumed session whose content changed (`contentChanged`) is still resumed against the new content; the client does not act on the flag yet, and the stored `lesson_hash` keeps the original value, so analysis can detect it.

Eight-point checklist for anonymous sessions:

| Point | Assessment |
|---|---|
| 1 Appropriate | The study design is pseudonymous; the product should match it |
| 2 Limitations | No account recovery; a cleared cookie mid-session loses continuity (mitigated by also storing `sessionId` in `localStorage`, keyed by lesson and condition, as a fallback the server verifies against the same lesson and condition) |
| 3 Browser performance | None |
| 4 Accessibility | Removes a login barrier |
| 5 Privacy | Strongest option: no identity collected by the product at all |
| 6 Scalability | Trivial; one row per participant |
| 7 Complexity | One route handler, one table |
| 8 Necessary? | Yes, because attempts and logs must be grouped per participant and deletable on request. The simpler alternative, client-only `localStorage`, fails the research requirement that data survive the device |

## Module interfaces

The modules communicate through six typed messages, all defined in `packages/types` and specified in the skills and sibling docs listed. This file only fixes which module produces and consumes each.

| Interface | Producer → Consumer | Specification | Tier |
|---|---|---|---|
| `InteractionEvent` (`cursor`, `hover`, `grab_start`, `grab_move`, `grab_end`, `tracking_lost`, `tracking_regained`, `hand_count`; `cursor` is the additive per-frame neutral-pointer position from `open_palm`, consumed via a ref, never logged per frame) | Gesture FSM or mouse adapter → R3F scene | `mediapipe-hands` §8; [Computer Vision Architecture](04-computer-vision.md) | **MVP** |
| `SceneEvent` (`select`, `place`, `drop`, with `componentId`, `socketId?`, `hotspotId?`) | R3F scene → learning engine | `r3f-interaction` §3–5; [3D Interaction Architecture](05-3d-interaction.md) | **MVP** |
| `SceneState` (model id, camera, component occupancy, hovered, grabbed, last event) | R3F scene → `sceneStore` → tutor client | `r3f-interaction` §11 | **MVP** |
| `EvaluationResult` (`correct`, `partial`, `score`, `feedback.outcome`, `feedback.expected`, `feedback.actual`, `feedback.nextHintLevel`) | Learning engine → HUD, logger, progress client | `lesson-schema` §5; [Learning Engine](06-learning-engine.md) | **MVP** |
| `TutorRequest` / `TutorResponse` / `TutorReply` | Lesson page (`askTutor`) → `POST /api/tutor` → `TutorService`; reply back to the lesson page | Shape below; templates and guardrails in [AI Tutor](07-ai-tutor.md) | **MVP** |
| `LogEvent` | Engine, FSM, HUD → logger → `POST /api/events` | `research-protocol` §4; [Evaluation Methodology](14-evaluation-methodology.md) | **MVP** |

Minimal tutor contract, so that the seam above is concrete (abridged from `packages/types/src/tutor.ts` and `apps/web/lib/api-client.ts`; doc 07 owns the field rules):

```ts
type TutorRequest = {
  sessionId: string;            // must equal the cookie's session
  lessonId: string; activityId: string;
  kind: "hint" | "explain_mistake" | "question" | "summary";   // MVP sends the first two
  hintLevel: 1 | 2 | 3;         // from feedback.nextHintLevel
  task: { id: string; type: TaskType; prompt: string; objectiveStatement: string; expect: TaskExpect }; // route reloads all but id
  evaluation: { outcome; expected; actual; attemptNo; hintsUsed; stepNo? } | null;   // null for a hint request
  scene: SceneState;
  locale: "en";
};

type TutorResponse = {
  kind: "hint" | "explain_mistake" | "answer" | "summary" | "refusal";
  text: string;                 // <= 320 characters, plain sentences
  referencedComponentIds: string[];
  highlight: string[];          // component ids the HUD may pulse; empty at level 1
  revealsAnswer: boolean;       // false below level 3
};

type TutorReply = {             // what /api/tutor returns
  status: "ok" | "capped" | "fallback_invalid";   // the client adds fallback_timeout, fallback_error
  source: "tutor" | "static";   // "tutor" only when status is ok
  interactionId: string;        // ai_interactions.id
  latencyMs: number;
  response: TutorResponse;
};
```

Rules that the interfaces enforce:

- The engine never imports from `vision` or `scene`; it consumes `SceneEvent` and lesson JSON only, so it runs identically for gesture and mouse conditions and in unit tests.
- The scene never grades. `place` into a wrong socket is still reported as `place`; the engine decides `partial`.
- The tutor client (`callTutor` on the lesson page) is the only module that reads `SceneState` for transmission. Positions are already rounded to one decimal place by the scene snapshot (`round3` in `packages/scene/src/scene-state.ts`), which keeps payloads near 1 KB.
- The logger transport is the only module that calls `/api/events`, and its `LogBuffer` drops everything while the session's `consentLogging` is false; the route repeats the check server-side (see [Session create and resume](#session-create-and-resume)). Only four files call the network at all, which a test asserts (see [15 Browser-side guarantees](15-risks-security-scalability.md#browser-side-guarantees)).

## Open questions

1. Resolved 2026-10-05 by the no-paid-tools rule: the hosted deployment runs only the millisecond template tutor; a **V1** local model runs behind an app instance on the lab laptop and is measured against the 3.5 s hint budget before adoption; a paid plan is not an option.
2. Neon versus Supabase: both satisfy locked position 9. Supabase bundles Auth for **V1**; Neon has the cleaner serverless driver and branching for schema changes. [Database Architecture](09-database.md) will recommend one; the choice does not affect this file.

## Related

- [Computer Vision Architecture](04-computer-vision.md): produces `InteractionEvent`.
- [3D Interaction Architecture](05-3d-interaction.md): consumes `InteractionEvent`, produces `SceneEvent` and `SceneState`.
- [Learning Engine](06-learning-engine.md): `evaluate`, mastery, hint sequencing.
- [AI Tutor](07-ai-tutor.md): template engine, scene-state payload, guardrails, and the **V1** local-model gate behind `TutorService`.
- [Database Architecture](09-database.md): tables named here (`research_sessions`, `lesson_attempts`, `progress`, `event_logs`, `ai_interactions`).
- [3D Content Architecture](10-3d-content-system.md): manifest and lesson files the engine and scene load.
- [Technical Risks, Security and Privacy, Scalability](15-risks-security-scalability.md): threat model, CSP, what breaks first.
- [Project Folder Structure](16-folder-structure.md): where `vision`, `scene`, `learning`, `tutor`, `content`, `types` live.
- [Recommended Technology Stack and Final Architecture Diagram](19-tech-stack-and-final-diagram.md): per-technology checklists.
