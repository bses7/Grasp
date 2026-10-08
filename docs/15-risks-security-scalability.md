# Technical Risks, Security and Privacy, Scalability

This file gathers the fourteen technical challenges from the brief into one table that agrees with the thresholds already fixed in [Computer Vision Architecture](04-computer-vision.md) and [3D Interaction Architecture](05-3d-interaction.md), adds a project-level risk register, states the threat model and privacy guarantees of a webcam-based education app, and says what breaks first when the system grows. Tier: mostly **MVP** for risks and security; scalability is explicitly a **V1** concern, and the MVP is designed only for the pilot and main study described in [Evaluation Methodology](14-evaluation-methodology.md).

## Technical Risks

### The fourteen challenges

The CV rows (1–5, 10, 11) restate decisions owned by doc 04; the 3D and performance rows (6–9) restate doc 05. Numbers here are copied, not re-derived. If a threshold changes in the owning doc, this table follows it.

| # | Challenge | Why it is hard here | Practical solution(s) | Tier | Owning doc |
|---|---|---|---|---|---|
| 1 | Webcam occlusion | Sleeves, the second hand, and the hand leaving the frame mid-drag hide landmarks; a lost grab must not be graded as a drop | MVP gestures decide only on wrist, thumb, and index landmarks (0, 4, 8, 9), the most reliably tracked points. Hands touching three frame edges are rejected. `LOST` state holds the grabbed component for a 1 s grace period, then emits `grab_end` with `reason: "lost"`, which settles and never snaps; the scene emits `drop`, never `place`. Cover-fit makes frame edges unreachable, which is where tracking is worst | **MVP** | [04 failure-state signals](04-computer-vision.md#failure-state-signals), [04 state machine](04-computer-vision.md#gesture-state-machine) |
| 2 | Poor lighting | Backlit windows and dim rooms make detection flicker; the learner cannot fix this by gesturing better | Rule: presence confidence mean < 0.7 over 2 s, or ≥ 4 detection flickers in 2 s, with frame luminance from a 32×18 downsample outside 40–200 → `cv_status: "low_confidence"`, hint `face_the_light`. Calibration step 1 checks confidence ≥ 0.7 before the lesson starts. The study standardises room and lighting | **MVP** | [04 failure-state signals](04-computer-vision.md#failure-state-signals), [04 calibration](04-computer-vision.md#calibration-proposal) |
| 3 | Different hand sizes | A fixed pinch threshold is tight for large adult hands and loose for small ones | All distances are divided by `handSize = dist2(l[0], l[9])`. Optional 5 s calibration sets per-session pinch thresholds `enter = closedPinch + 0.3 × (openPinch − closedPinch)`, `exit = closedPinch + 0.6 × (…)`, clamped to [0.18, 0.55]; defaults 0.25/0.40 if skipped. Persisting calibration per user is **V1** | **MVP** | [04 calibration](04-computer-vision.md#calibration-proposal) |
| 4 | Multiple people in frame | One webcam cannot tell whose hand is whose; a bystander's closer hand can steal the cursor | `numHands: 2`; primary = last frame's primary, else the larger `handSize`; switch only after the primary is lost > 500 ms. `hand_count` logged; hint `show_one_hand` if `hand_count > 1` persists 3 s during a task. HUD shows whose hand is tracked. Limitation: the heuristic fails when a bystander is closer than the learner | **MVP** | [04 multi-hand handling](04-computer-vision.md#multi-hand-and-multi-person-handling) |
| 5 | Camera latency | One camera interval, one inference, one render: 80–110 ms finger-to-screen, perceivable for fine work | Inference in a Web Worker at 640×360 so render never waits; One-Euro with `beta` 5.0 so lag shrinks when the hand moves; scene lerp 0.5 per frame. Tasks are coarse grab-and-place with snap sockets; tracing tasks are excluded from the MVP because of this latency. `e2eMsP50` logged with target ≤ 100 ms | **MVP** | [04 pipeline](04-computer-vision.md#pipeline), [14 CV metrics](14-evaluation-methodology.md#21-computer-vision-metrics) |
| 6 | Browser performance | MediaPipe and R3F share one integrated GPU and must together hold 30 fps | Worker inference; `frameloop="demand"` with `invalidate()` on events; zero React commits per frame during drag (refs and transient Zustand subscriptions); `dpr={[1, 1.5]}`; no shadows, baked AO; ≤ 50 draw calls, ≤ 150k triangles; budgets p95 frame ≤ 33 ms, render ≤ 12 ms, inference ≤ 33 ms, measured per minute and logged | **MVP** | [05 render performance budget](05-3d-interaction.md#10-render-performance-budget) |
| 7 | Mobile compatibility | Phone GPUs are weaker, Safari's worker GPU path is partial, and a hand held in front of a phone camera covers the screen the learner needs to see | Not designed for in the MVP: desktop browser, laptop, 720p webcam is the stated target. Main-thread alternate-frame fallback and feature detection keep the page from breaking on unsupported browsers. The `InputSource` adapter is the seam for a touch adapter (**V1**); a native mobile path is **Future** | **MVP** scope exclusion, **V1** touch, **Future** mobile | [05 library decision](05-3d-interaction.md#1-library-decision), [18 future expansion](18-future-expansion.md) |
| 8 | GPU limitations | Intel UHD 620 class graphics is the reference; some laptops fall back to CPU inference at 30–45 ms per frame | Degrade ladder applied in order: dpr → 1.0, disable outline (already **V1**), ask the CV layer to skip alternate frames. Post-processing off; one directional plus one hemisphere light. `device_info.gpuTier` and `perf_sample.delegate` logged so study results can be analysed against hardware | **MVP** | [05 render performance budget](05-3d-interaction.md#10-render-performance-budget) |
| 9 | Large GLB files | A detailed heart from a marketplace is often 50–200 MB; time to first interaction must be ≤ 5 s on 10 Mbps | Blender → gltf-transform `dedup, prune, weld, simplify --ratio 0.5` → Draco (meshopt if decode p95 > 300 ms) → CI size check < 5 MB and ≤ 150k triangles, ≤ 4 materials, textures ≤ 2048². Served from `apps/web/public/models/` on Vercel's edge cache for the pilot (**MVP**) and from object storage behind a CDN before the main study (**V1**, [10 GLB hosting](10-3d-content-system.md#glb-hosting)), with versioned paths and immutable cache headers; decoder self-hosted under `public/draco/` | **MVP** | [05 GLB pipeline](05-3d-interaction.md#8-glb-authoring-and-compression-pipeline), [10 3D Content Architecture](10-3d-content-system.md) |
| 10 | Gesture ambiguity | A loosening pinch looks like `point`; an edge-on hand looks like `fist`; a repositioning move looks like `swipe` | Fixed precedence pinch > point > open_palm; hysteresis enter 0.25 / exit 0.40; hold frames pinch 2, point 3, open_palm 3; `grab_start` only over a grabbable component or empty space, never over HUD. `fist`, `swipe`, `wrist_rotate`, `two_hand_scale` postponed to **V1** because each is confusable with an MVP gesture. False-start rate (closed grabs that never moved, `grab_move_summary.firstMoveMs` null, ÷ closed grabs, excluding grabs ended by tracking loss; decided 2026-10-07, was no `grab_move` within 300 ms) logged, target ≤ 0.10 | **MVP** | [04 gesture specifications](04-computer-vision.md#gesture-specifications) |
| 11 | Depth estimation | MediaPipe `z` is relative and noisy; apparent hand size is confounded by hand size and wrist angle; a 720p webcam has no stereo baseline | Locked position 4: camera-facing drag plane at the grabbed component's depth; low-gain z-hint from `handSize` change with `Z_GAIN` 0.3, `Z_MAX` 0.15 scene units per frame, ±0.03 dead zone; sockets supply the correct depth on release; workspace bounds and optional axis locks. Ground-plane drag is **V1**; depth hardware is **Future**. Limitation: no task may require placing one component behind another by depth alone | **MVP** | [05 depth estimation](05-3d-interaction.md#5-depth-estimation-and-its-limitations) |
| 12 | Accessibility | Gesture input is unusable for learners with limited arm mobility, tremor, or no webcam; highlights alone exclude colour-blind learners | Every interaction event has a mouse and keyboard equivalent (Tab/Enter select, Space grab, arrows move, PageUp/PageDown z-hint, R/X/Esc commands); dwell selection removes the need to pinch for `identify`; ARIA live region announces focus and feedback; reduced-motion disables tween easing; high-contrast highlight colour; text and icon always accompany a highlight. The mouse path is also the research control condition, so it is first-class, not a fallback | **MVP** | [05 mouse and keyboard equivalents](05-3d-interaction.md#7-mouse-and-keyboard-equivalents), [11 UI/UX Architecture](11-ui-ux.md) |
| 13 | Privacy | A webcam pointed at a learner, in a product that also stores learning data, is the worst case for user trust | Video never leaves the device and is never written anywhere; landmarks never persisted; consent screen precedes `getUserMedia`; camera preview and tracking indicator always visible; one-key camera-off; MediaPipe assets self-hosted so no third party sees learner IPs; the tutor is an in-process template engine that receives `SceneState` only, so no third-party processor exists. Detail below | **MVP** | [Security and Privacy](#security-and-privacy) in this file, [14 ethics](14-evaluation-methodology.md#7-ethics-consent-and-data-minimisation) |
| 14 | Student data protection | Learning data about identifiable students carries legal duties; the MVP must not accidentally acquire them | MVP has no accounts and no identity fields; data keyed by random `sessionId`; link to a person is an offline key held by the researcher; delete and export endpoints keyed by `sessionId`; 5-year retention stated in consent; no third-party analytics. Minors require parental consent and separate approval at **V1**; data residency at **V1** | **MVP** / **V1** | [Student-data obligations](#student-data-protection-obligations) in this file, [09 Database Architecture](09-database.md) |

Two weak assumptions in the brief, stated once: it treats "mobile compatibility" as a challenge to solve rather than a scope decision, and it lists "privacy" and "student data protection" as technical challenges when they are mostly design and governance choices. This file treats mobile as an MVP exclusion with a seam, and privacy as a set of guarantees the architecture enforces, not a problem to be mitigated after the fact.

### Project risk register

Project-level risks, not component risks. Likelihood and impact are the developer's judgement at Phase B; the trigger column says when to reopen the row.

| # | Risk | Likelihood | Impact | Mitigation | Trigger to revisit | Tier |
|---|---|---|---|---|---|---|
| R1 | Tracking quality too poor for the study (a null result means "tracking broke", not "gesture does not help") | Medium | High: the research question becomes unanswerable | Pilot of 8–12 per group before any main-study participant; calibration gate ≥ 0.80 accuracy or one re-run; standardised room and lighting; per-protocol exclusion pre-registered at lost fraction > 0.20; thresholds tuned from pilot logs and then frozen | Pilot median lost fraction > 0.05 or calibration accuracy < 0.90; false-start rate > 0.10 | **MVP** |
| R2 | 30 fps combined budget missed on the reference laptop | Medium | High: cursor stutter inflates gesture-condition error and TLX | Worker inference, demand frameloop, zero React commits per frame, degrade ladder (section 10 of doc 05); measure from the first prototype milestone, not at the end | `frameMsP95` > 33 ms or `inferenceMsP95` > 33 ms on the reference device in any milestone | **MVP** |
| R3 | GLB sourcing: no heart model with clean, separable, licensable meshes under 5 MB | Medium | High: the largest single content effort; blocks every milestone after the first | Start with a CC-licensed or purchased base model and split it in Blender; the smallest prototype needs only three components and three sockets; the manifest tolerates coarse geometry | Two weeks without a validated manifest that passes the `lesson-schema` checklist | **MVP** |
| R4 | Local-model latency (**V1**): a locally run open-weights tutor misses the 3.5 s hint budget or steals frame time from MediaPipe and R3F | Medium, if attempted | Low: the template engine remains the default, so the only loss is the spike's time | The **MVP** tutor is the deterministic template engine with no network call and millisecond latency, so this risk does not exist in the pilot. A **V1** local model (Ollama on the lab laptop or WebLLM) is adopted only after a measured spike passes the 3.5 s p95 hint and 30 fps budgets ([AI Tutor](07-ai-tutor.md)); a hosted metered API is never the fallback | Spike log shows `ai_interactions.latency_ms` p95 > 3.5 s or `perf_sample.frameMsP95` > 33 ms with the local engine on | **V1** |
| R5 | Vercel Hobby limits (function duration, bandwidth, non-commercial terms) bite during data collection | Low | Medium: a short outage mid-session | The template tutor answers in milliseconds, far inside the timeout; GLB and WASM are cached immutably so repeat loads cost nothing, and GLB moves to Cloudflare R2's zero-egress free tier at **V1** before the main study; verify current Hobby limits the week before the pilot; if a cap is approached, space sessions and pull the R2 step forward rather than buy a plan (no paid tools, 2026-10-05) | Any function timeout in logs, or bandwidth above 50% of the plan cap in a study week | **MVP** |
| R6 | Solo-developer time: Phases C–E plus content plus the study exceed available hours | High | High: the project stalls at a demo | Locked position 10 fixes the smallest prototype; every module is a library not a service; content in JSON and GLB not an authoring UI; mouse condition reuses the entire scene; cut gestures, not tasks, when behind | Any milestone in [First Prototype Plan](17-first-prototype-plan.md) slips more than two weeks | **MVP** |
| R7 | Ethics approval delay | Medium | Medium: main study waits; pilot with friends can proceed under the full consent form | Submit after the pilot checklist passes but before pre-registration; use the consent skeleton in `research-protocol`; keep the pilot explicitly non-publishable if approval is pending | No decision 8 weeks after submission | **MVP** pilot, **V1** main |
| R8 | Novelty effect inflates gesture-condition engagement and SUS | High | Medium: results overstate benefit | One-week retention test; engagement reported alongside gain; two-sided hypothesis; limitation stated in the paper; multi-session classroom study is **Future** | Retention gain in the gesture group falls below post-test gain by more than the mouse group's drop | **MVP** |

## Security and Privacy

### Threat model

The system is a webcam-based education app that stores research data and generates tutor text in-process from templates. There is no third-party processor of learner data in **MVP**: no analytics, no model vendor, no metered API. The learner's device is trusted with video; the server trusts nothing from the client except the session cookie it minted.

| Asset | Where it lives | Who wants it or can damage it | Entry point | Control | Tier |
|---|---|---|---|---|---|
| Live video stream | Browser memory only | Bystander reading the screen; a compromised dependency exfiltrating frames; the developer by accident (debug code) | `getUserMedia`; any `fetch`/`sendBeacon`/IndexedDB call | Consent before camera; CSP `connect-src` limited to own origin and CDN; automated test that intercepts `fetch`, `sendBeacon`, and IndexedDB during a lesson and asserts no binary payloads; no `canvas.toDataURL` or `MediaRecorder` in the codebase (lint rule) | **MVP** |
| Landmarks | Worker memory, one frame at a time | Same as above; a researcher tempted to "just log them for tuning" | Logger types | `LogEvent` payload type has no array fields; route handler rejects payloads with arrays or > 32 keys; `gesture_debug` stream is developer-only and never enabled for participants | **MVP** |
| Research data (`event_logs`, `lesson_attempts`, `progress`, `instrument_responses`) | Postgres | A participant spoofing another's session; a network attacker; a leaked database URL | `/api/events`, `/api/attempts`, `/api/progress` | `sessionId` in httpOnly SameSite=Strict cookie; body `sessionId` must match cookie; Zod validation of every payload; TLS everywhere; database URL only in server env; no identity fields exist to leak | **MVP** |
| Consent records | Postgres `consent_records` | Dispute over whether consent was given; accidental deletion | `/api/session` | Append-only row with `consent_version`, `agreed_at`; withdrawal sets `withdrawn_at` and triggers cascade delete of data, not of the consent row | **MVP** |
| Anonymisation key (sessionId → person) | Paper or encrypted file held offline by the researcher | Anyone who re-identifies participants | None in the app | Never stored in the app or database; stated in the ethics application | **MVP** |
| Tutor route availability | `/api/tutor` on Vercel | A participant or bot hammering the route to fill `ai_interactions` or exhaust function invocations | `/api/tutor` | Per-session rate limit and call cap (1 per attempt, 3 per task, 12 per session); payload schema rejects free text; the template engine is cheap enough that abuse costs compute minutes, not money; there is no API key or spend to protect and no third-party egress from the route | **MVP** |
| Tutor output integrity | `packages/tutor` output | Lesson or manifest text that would reveal an answer below level 3; at **V1**, prompt injection through `SceneState` strings into a local model | `/api/tutor` | The template engine quotes only manifest `description` and lesson `hints`, both author-controlled and build-time validated, and the template test suite asserts no reveal below level 3; `SceneState` carries ids and numbers only; the tutor never decides correctness (locked position 5), so a bad hint cannot change a grade; the same Zod output check stays in place for a **V1** engine | **MVP** |
| Content integrity (GLB, lesson JSON, MediaPipe `.task` and WASM) | Repo and CDN | Supply-chain tampering; CDN compromise serving a different model | Static asset fetch | Self-hosted, version-pinned, content-hashed filenames; Subresource Integrity on the WASM loader where the bundler allows; lesson JSON validated at build | **MVP** |
| Availability during a study session | Vercel, Postgres provider | Outage mid-participant | External | Logger buffers and downloads JSON at session end as fallback; static hints work without the tutor route; lesson JSON and GLB cached after first load; the tutor itself has no external dependency | **MVP** |

Actors deliberately out of scope for the MVP: a participant tampering with their own client-side evaluation (a study participant is not an adversary; server-side recompute from `lesson_attempts` is **V1**), and nation-state or targeted attacks on a hobby deployment.

### Browser-side guarantees

These are enforced by code structure, not policy, so they survive a tired developer.

| Guarantee | How it is enforced | Verified by | Tier |
|---|---|---|---|
| No video frame leaves the device | Frames go `getUserMedia → ImageBitmap → worker → discard`. The worker has no network access by code review and the CSP `connect-src` list; nothing in `packages/vision` imports `fetch` | Integration test intercepting `fetch`, `sendBeacon`, `XMLHttpRequest`, IndexedDB, and `localStorage` writes during a scripted lesson | **MVP** |
| Landmarks never persisted | Landmarks are local variables inside `onFrame`; the only outputs of the worker are `InteractionEvent`, `CvStatus`, and scalar `perf_sample` fields | TypeScript: `LogEvent.payload` values are `string \| number \| boolean \| null`, so an array of landmarks does not type-check | **MVP** |
| No pixels retained for lighting checks | Luminance is a single number from a 32×18 downsample discarded per frame | Code review; `cv_status.luminance` is one number | **MVP** |
| Camera is never opened without consent | The consent screen is a route guard before the lesson route; `sessionStore.consent` must be set before `getUserMedia` is called; mouse condition never calls it | Unit test on the guard; manual check in the pilot checklist | **MVP** |
| Learner can always see and stop the camera | Preview thumbnail and tracking indicator always on screen; one-key camera-off stops the `MediaStream` tracks and ends tracking | UX spec in [11](11-ui-ux.md) | **MVP** |
| Logging respects consent | The logger is the only module that calls `/api/events` and drops everything when `consent.logging` is false | Unit test | **MVP** |
| Cursor trails cannot reconstruct hand motion | `grab_move` is summarised once per drag (`durationMs`, `pathLengthNorm`, `zHintAbsSum`); `drop` carries no position; `SceneState` positions are rounded to 0.1 units and sampled at 1 Hz | Schema contracts in [14](14-evaluation-methodology.md#61-schema) | **MVP** |

### Consent storage and pseudonymous sessions

| Element | Design | Tier |
|---|---|---|
| Consent record | `consent_records` row: `id`, `session_id`, `consent_version`, `agreed_at`, `withdrawn_at`. The consent text for each version is a file in the repo, so the exact wording a participant saw can be reproduced | **MVP** |
| Session identity | `sessionId` is a random UUID with no relationship to name, email, IP, or device. Stored in an httpOnly SameSite=Strict cookie, mirrored to `localStorage` as a server-verified fallback. The server never stores IP addresses or user agents in participant rows; `device_info` logs a coarse GPU tier and camera resolution only | **MVP** |
| Condition assignment | The app receives only `condition` for a `sessionId`; the blocked randomisation sequence lives offline | **MVP** |
| Retention test linkage | The participant re-enters their printed code at S2; the server resolves it to `sessionId` for the retention form only | **MVP** |
| Accounts | None in MVP. In **V1**, `research_sessions.user_id` is nullable and separable so account data and research data can be deleted independently | **V1** |

### Retention, deletion, and export

| Endpoint or rule | Behaviour | Tier |
|---|---|---|
| `DELETE /api/session/:id` | Cascades to `lesson_attempts`, `progress`, `event_logs`, `instrument_responses`, `ai_interactions`; leaves the `consent_records` row with `withdrawn_at` set as proof the request was honoured. Callable with the `sessionId` alone; the researcher invokes it on a participant's request and confirms within 7 days | **MVP** |
| `GET /api/session/:id/export` | Returns the participant's rows from all tables as one JSON file | **MVP** |
| Retention period | 5 years after publication, then a scripted bulk delete; stated in the consent form. Shorter if the approving institution requires | **MVP** |
| Local developer data | Docker Compose Postgres volume is wiped between pilot runs; no production dumps on the laptop | **MVP** |
| Backups | Provider point-in-time recovery only (Neon or Supabase default). Deletion requests are therefore honoured in live data immediately and in backups when the retention window expires (7 days on free tiers); stated in the consent text | **MVP** |

### Secrets handling

The MVP holds exactly two secrets, `DATABASE_URL` and `SESSION_COOKIE_SECRET`. There is no third-party API key and no third-party egress at any tier: the tutor is in-process in **MVP**, and a **V1** local model at `TUTOR_LOCAL_URL` is reached without a credential only by an app instance running on the lab laptop with `TUTOR_ENGINE=local`; the hosted deployment always uses `template`.

| Rule | Detail | Tier |
|---|---|---|
| Server-only | Both secrets are read through `apps/web/lib/env.ts` only; never prefixed `NEXT_PUBLIC_`; never logged. `TUTOR_ENGINE` and `TUTOR_LOCAL_URL` are configuration, not secrets, and are also server-only | **MVP** |
| Local development | `.env.local` is gitignored; Docker Compose reads an `.env` file that is also gitignored; a committed `.env.example` lists variable names without values | **MVP** |
| Abuse limits | Per-session call cap and a token-bucket rate limit in the tutor route handler; request body schema allows no free text, so the route cannot be used as a general proxy; there is no spend to cap | **MVP** |
| Rotation | Rotate the cookie secret and database credential on any suspected exposure and at the end of each study phase; both are Vercel environment variables, so rotation is a redeploy | **MVP** |
| Database URL | Drizzle reads it from server env only; the Neon role is scoped to the one database | **MVP** |

### Content Security Policy and headers

The CSP must allow WebAssembly compilation, a Web Worker, blob URLs for `ImageBitmap` and GLB loading, and self-hosted MediaPipe assets, while blocking everything else. Policy, sent per request from `apps/web/proxy.ts` with a fresh nonce:

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<per-request>' 'strict-dynamic' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self' blob: https://cdn.<your-domain>;
  img-src 'self' blob: data:;
  media-src 'self' blob:;
  font-src 'self';
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  form-action 'self';

Permissions-Policy: camera=(self), microphone=(), geolocation=()
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

| Directive | Why | Tier |
|---|---|---|
| `script-src 'nonce-…' 'strict-dynamic'` | The App Router hydrates through inline scripts, so `'self'` alone blocks every page (found at M0). Next.js reads the nonce from the request's CSP header and tags its own scripts; this requires every page to render dynamically (`await connection()` in the root layout). Avoids `'unsafe-inline'` for scripts | **MVP** |
| `script-src 'wasm-unsafe-eval'` | Required for `WebAssembly.instantiate`; avoids the far broader `'unsafe-eval'`. Next.js dev mode needs `'unsafe-eval'`; add it only when `NODE_ENV !== "production"` | **MVP** |
| `worker-src 'self' blob:` | The vision worker is bundled from the same origin; some bundlers load workers through blob URLs | **MVP** |
| `connect-src` | Own origin for route handlers plus the CDN host for GLB, Draco, `.task`, and WASM. No third-party API is called from the browser or the server in **MVP**, so nothing else appears. This single line is the structural guarantee that video cannot be posted anywhere unexpected. `blob:` is added (2026-10-07, found at M9) because three.js `GLTFLoader` fetches each texture embedded in a .glb through a same-document blob URL; a blob URL reads only data the page already holds and cannot reach any server, so the guarantee is unchanged. A **V1** WebLLM engine would need its model files self-hosted under the same origin or CDN host, not fetched from a public hub, to keep this line unchanged | **MVP** |
| `style-src 'unsafe-inline'` | Drei `Html` and R3F inject inline styles. Replace with a nonce if a later audit requires; low priority because there is no user-generated HTML | **MVP** |
| COOP/COEP | Not set. The default MediaPipe Tasks Vision WASM does not require `SharedArrayBuffer`. If a multi-threaded build is adopted for speed, `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` become necessary and the CDN must send `Cross-Origin-Resource-Policy: cross-origin` | **V1** if needed |
| `Permissions-Policy: camera=(self)` | Camera available to this origin only, never to embedded frames | **MVP** |

### Dependency pinning and supply chain

| Rule | Detail | Tier |
|---|---|---|
| Exact versions | `@mediapipe/tasks-vision`, `three`, `@react-three/fiber`, and `@react-three/drei` pinned to exact versions in `package.json`; lockfile committed; CI installs with `--frozen-lockfile`. The template tutor adds no dependency | **MVP** |
| Self-hosted model assets | `hand_landmarker.task` and the WASM bundle copied into `public/mediapipe/<version>/` at the pinned version, not fetched from a Google CDN at runtime. Filenames carry the version so cache invalidation is a path change | **MVP** |
| Thresholds frozen with versions | A MediaPipe version bump can shift landmark statistics; the pinned version is recorded in `research_sessions` via `device_info` and no bump happens between pilot freeze and study end | **MVP** |
| Audit cadence | Monthly dependency review outside study weeks; none during data collection | **MVP** |
| Runtime pin | Node version pinned in `package.json` `engines` and `.nvmrc`; Docker base image pinned by digest | **MVP** |

### Student-data protection obligations

The MVP collects no personal data in the legal sense from inside the app, which is the strongest position. The obligations below are stated as GDPR-style principles because they generalise; the approving institution supplies jurisdiction-specific wording.

| Principle | How the MVP meets it | V1 change when accounts and minors arrive |
|---|---|---|
| Lawful basis and consent | Written informed consent per `research-protocol`; version recorded; declining exits before the camera | Parental consent plus child assent for minors; separate ethics approval; age-appropriate consent text |
| Purpose limitation | Data used for the study and the product's own feedback loop only; no analytics vendors | Teacher dashboards need a new purpose statement and consent line |
| Data minimisation | Events and scalars only; no video, images, landmarks, identity, IP, or free text | Account email is the only identity field; stored in `users`, separable from `research_sessions` |
| Storage limitation | 5-year retention then deletion; scripted | Per-account deletion on request; inactive-account purge policy |
| Integrity and confidentiality | TLS, httpOnly cookies, server-only secrets, Zod validation, no third parties | Row-level security if Supabase is chosen; audit log on exports |
| Accountability | Consent text, retention period, and threat model in the repo; data-flow diagram in [03](03-system-architecture.md) | Data-processing record naming Vercel and the Postgres provider as processors; no model vendor appears because the tutor runs in-process (**MVP**) or on the lab laptop (**V1**) |
| Data subject rights | Export and delete endpoints keyed by `sessionId` | Same endpoints keyed by account; self-service from a settings screen |
| Data residency | Not controlled on free tiers | Postgres region chosen in the participants' jurisdiction; stated in the ethics application |

### What is logged versus never logged

| Logged (with consent) | Never logged |
|---|---|
| `sessionId`, `condition`, `consent_version` | Name, email, IP address, precise user agent, device identifiers |
| Task events: `task_start`, `task_attempt` (correct, partial, score, attemptNo, hintsUsed, componentId, socketId), `task_end`, `hint_shown`, `mastery_computed` | Video frames, images, canvas captures |
| Scene events: `select`, `grab_start`, `grab_move_summary` (one per drag), `grab_end`, `place`, `drop` (no position) | Per-frame cursor positions or landmark coordinates in any form |
| Vision events: `gesture_emit` on state transitions, `tracking_lost`, `tracking_regained` (duration), `hand_count`, `calibration_prompt` | Per-frame gesture classifications, hand bounding boxes, luminance images |
| `perf_sample` scalars every 5 s; `device_info` once (coarse GPU tier, camera resolution, worker path) | GPU model strings or anything that fingerprints the device |
| `tutor_message` payload, emitted by the tutor client on receipt: `{ interactionId, taskId, kind, hintLevel, status, latencyMs, source }` (shape owned by [07](07-ai-tutor.md)) | Tutor message text in the research log; learner free text of any kind (the MVP tutor accepts none) |
| `ai_interactions`: `engine`, `template_version`, `status`, `latency_ms`, `kind`; `usage_json` (nullable, null in **MVP**, **V1** local-engine diagnostics only); the `SceneState` sent, under its own consent line (owned by [07](07-ai-tutor.md) and [09](09-database.md)) | Any field that links `ai_interactions` to identity; any cost figure; any copy of the payload outside the researcher's own database (no third-party processor exists) |
| `instrument_responses`: test items, SUS, TLX, satisfaction, coded open answers | Open-answer text that names people or places (redacted by the researcher before entry) |

## Scalability

Scalability is a **V1** concern. The MVP serves a pilot of about 24 participants and a main study of about 130, one at a time in one room. The design below says what fails first if usage grows beyond that and the cheapest fix for each, so that the fix is known but not built.

Rule that bounds every fix below: no paid tools or usage-billed services anywhere in the project, at any tier (user decision 2026-10-05); every "cheap fix" is a free tier, caching, archiving, or a code change, never a plan upgrade or a metered API.

### What breaks first

| Constraint | Fails when | Symptom | Cheap fix | Tier of fix |
|---|---|---|---|---|
| GLB and WASM bandwidth | Thousands of first loads per month: each is about 5 MB GLB plus roughly 10 MB MediaPipe assets | App-plan bandwidth cap approached | Immutable cache headers in MVP so repeat loads are free; move GLB from `public/` to a zero-egress object store (Cloudflare R2) behind a CDN before the main study, per [10 GLB hosting](10-3d-content-system.md#glb-hosting); Draco keeps GLB small | **MVP** headers, **V1** object storage |
| Postgres free tier | Storage: at 1–3 k events per session and ~300 bytes per row, 130 sessions is roughly 50–120 MB, well inside a 500 MB free tier; 5,000 sessions is not. Compute: free tiers suspend after inactivity, adding a cold start to the first request | First request after idle takes seconds; storage warnings | Batched inserts already in MVP; archive completed sessions to JSON in object storage (R2 free tier) and delete rows after export, which keeps the live database under the free cap indefinitely | **MVP** batching, **V1** archive |
| Route-handler timeouts | Long-running export or delete over large sessions | 504 on `/api/session/:id/export` | The hosted `/api/tutor` runs only the millisecond template engine, so it never waits on a model; `TUTOR_ENGINE=local` (**V1**) applies only to an app instance running on the lab laptop alongside the model, where latency is bounded by the laptop and measured before adoption; paginate export. Neither a paid plan nor a Python service is the fix (locked position 1) | **V1** |
| Vercel Hobby terms and bandwidth | Non-commercial use only; bandwidth cap | Account warning | A research pilot is non-commercial; verify current limits before the pilot; bandwidth is removed by moving GLB to R2's free tier, and sessions are spaced if function invocations approach the cap | **V1** |
| Event ingest rate | A classroom of 30 learners batching every 10 s is trivial; 1,000 concurrent learners is 100 requests per second of small inserts | Connection limits on the serverless driver | Connection pooling is provided by Neon's serverless driver or Supabase's pooler; batch size can rise to 200 events; a queue is not needed below thousands of concurrent users | **V1** |
| Content as files | Dozens of lessons authored by several people | Pull requests become the authoring UI, which does not suit non-developers | Move lesson JSON and manifests into tables behind `GET /api/content/*` with the same Zod schemas; GLB stays on object storage. See [10](10-3d-content-system.md#content-versioning) | **V1** |

### Scaling path

| Stage | Users | Architecture change | What stays the same | Tier |
|---|---|---|---|---|
| Pilot and main study | ≤ 130 sessions, 1 concurrent | None for the pilot: Vercel Hobby, free Postgres, GLB from `public/`; object storage behind a CDN added before the main study | Everything | **MVP** (object storage **V1**) |
| Classroom product | Hundreds of accounts, ≤ 30 concurrent | Accounts (Auth.js or Supabase Auth); content tables and authoring UI; server-side mastery recompute from `lesson_attempts`; session archive to object storage so hosting and Postgres stay on free tiers; optionally the measured local-model tutor | Single Next.js app; libraries not services; browser-side CV; tutor behind `TutorService`; zero spend | **V1** |
| Multi-school or research platform | Thousands of accounts, hundreds concurrent | Would need capacity beyond free tiers (replicas, multi-region CDN, always-on inference); under the no-paid-tools rule this stage is a design seam only, reachable by self-hosting on institution-owned hardware; optional Python service behind the `TutorService`/`VisionService` seam; teacher dashboards on aggregated tables | Lesson JSON schema; interaction-event vocabulary; privacy guarantees | **Future** |

Limitation stated plainly: every row above assumes the browser-side CV design holds. If a future gesture set needs server-side inference, cost scales with video minutes rather than with requests, and the privacy guarantees in this file no longer hold as written. That is why pose tracking and custom models are **Future** and gated on the same seam.

### What the MVP will not be designed for

- More than one concurrent classroom or more than a few dozen concurrent sessions.
- Multi-region deployment, uptime SLAs, or on-call. A study session that fails is re-run; the logger's local JSON download is the recovery path.
- Horizontal database scaling, sharding, or read replicas.
- Real-time multiplayer, shared scenes, or teacher live views (**Future** seam in [18](18-future-expansion.md)).
- Content authoring by anyone other than the developer; lesson JSON and GLB live in the repo.
- Server-side anti-cheat or recompute of mastery; a participant is not an adversary.
- Mobile browsers, touch input, or tablets.
- Offline-first operation beyond cached static assets.
- Data residency controls, enterprise SSO, or audit logging beyond the consent and deletion records.

## Open questions

1. Resolved: docs 03, 09 and 14 all use `DELETE /api/session/:id` with a client-generated UUID validated by the server.
2. Will the Postgres provider be Neon or Supabase? Both satisfy locked position 9; the choice affects which pooler, backup window, and row-level-security option the V1 column above refers to.
3. Does the ethics application require data residency at the pilot stage? If so, the Postgres region must be chosen before the first pilot participant, which is earlier than the **V1** tag above assumes.

## Related

- [System Architecture](03-system-architecture.md): trust boundary, route handlers, and the `TutorService` seam this file's threat model protects.
- [Computer Vision Architecture](04-computer-vision.md): source of rows 1–5, 10, and 11 and of every CV threshold quoted here.
- [3D Interaction Architecture](05-3d-interaction.md): source of rows 6–9 and 11, the performance budget, and the GLB pipeline.
- [AI Tutor](07-ai-tutor.md): template engine, guardrails, and the **V1** local-model measurement gate referenced in R4.
- [Database Architecture](09-database.md): tables named in the deletion cascade and the `ai_interactions` consent line.
- [3D Content Architecture](10-3d-content-system.md): content-as-files versus content-in-tables.
- [UI/UX Architecture](11-ui-ux.md): consent screen, camera indicator, and accessibility settings.
- [Evaluation Methodology](14-evaluation-methodology.md): ethics requirements, event-log schema, and the metrics the risk-register triggers use.
- [Project Folder Structure](16-folder-structure.md) and [Recommended Technology Stack](19-tech-stack-and-final-diagram.md): where the headers, env files, and pinned dependencies live.
- [Future Expansion](18-future-expansion.md): seams for mobile, multiplayer, and dashboards that this file declines to design for.
