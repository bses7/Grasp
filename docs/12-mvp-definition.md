# MVP Definition

The MVP is one twelve-minute heart lesson, `anatomy.heart.chambers_v1`, on one model, `heart_v1`, driven by five hand gestures or by an equivalent mouse-and-keyboard path, evaluated deterministically from lesson JSON, with a hint-and-explanation tutor behind a feature flag and the instrumentation needed to run the pilot study in [14](14-evaluation-methodology.md). This file fixes exactly what is inside that boundary, what is outside it and which tier it moves to, the measurable criteria for calling the MVP done, and how it grows out of the smallest viable prototype in [00](00-executive-summary.md). Everything in the scope tables is **MVP** unless a row says otherwise.

## Scope principle

The MVP exists to answer two questions and nothing else: can the core loop (gesture → interaction event → scene event → deterministic verdict → feedback) be learned from, and can a pilot study be run on it. Every row below either serves the loop or the pilot. The brief asks for "5–10 components, 3–5 gestures, basic AI tutor"; the MVP takes the upper end on components (ten, six movable) because `identify` tasks need distractors, the upper end on gestures (five) because `open_palm` and `point` are what make selection possible without a pinch, and the narrowest reading of "basic AI tutor" that the brief and locked position 7 allow.

Two assumptions in the brief are weak and shape this scope. First, the brief treats the tutor as part of the core product; the pedagogy works with static hints, so the tutor is in the MVP only because the brief requires it, and it is flagged so the study can run with it off ([01](01-product-definition.md), [07](07-ai-tutor.md)). Second, the brief's MVP list omits a control condition; for this project the mouse path is not an accessibility extra but a hard **MVP** requirement, because without it the study cannot attribute anything to gesture input (locked position 8).

## MVP scope

### Domain and environment

| Item | Value | Tier |
|---|---|---|
| Subject | Human anatomy | **MVP** |
| Topic | The four chambers of the heart and the great vessels | **MVP** |
| Learners | Late-secondary (16–18) and first-year undergraduate biology or nursing learners; study participants 16+; the developer-researcher ([01](01-product-definition.md#target-users)) | **MVP** |
| 3D environment | One full-bleed React Three Fiber scene, dark theme, one directional plus one hemisphere light, no shadows, no post-processing, demand frameloop when idle ([05 §10](05-3d-interaction.md#10-render-performance-budget)) | **MVP** |
| Screens | Landing, Learning environment (all six activity kinds), Feedback (in-scene), Assessment (same environment, stricter rules), Results, plus the consent, calibration, test, questionnaire and retention pages the pilot needs ([11](11-ui-ux.md#major-screens)) | **MVP** |
| Platforms | Desktop Chrome and Edge on a laptop with an integrated GPU and a 720p webcam; Safari with the main-thread half-rate CV fallback | **MVP** |
| Content delivery | Lesson JSON and manifest bundled at build time; GLB, Draco decoder, MediaPipe `.task` and WASM served from `apps/web/public/` on Vercel ([10](10-3d-content-system.md#content-versioning)); object storage behind a CDN is **V1**, before the main study | **MVP** |

### Model `heart_v1`: components and sockets

One GLB, under 5 MB Draco-compressed, under 150k triangles, with ten named components, six sockets, two hotspots and two poses. The full manifest is `.claude/skills/lesson-schema/references/heart-example.json`; the authoring pipeline is [05 §8](05-3d-interaction.md#8-glb-authoring-and-compression-pipeline).

| Component id | Type | Grabbable | Rest socket | Role in the lesson | Tier |
|---|---|---|---|---|---|
| `left_ventricle` | chamber | yes | `socket_left_ventricle` | `identify` t_g1; `place` t_c1; `sequence` t_c5; `compare` t_a4 | **MVP** |
| `right_ventricle` | chamber | yes | `socket_right_ventricle` | `place` t_c2; `sequence` t_c5; `identify` t_a1; `compare` t_a4 | **MVP** |
| `left_atrium` | chamber | yes | `socket_left_atrium` | `place` t_c3; `sequence` t_c5; `identify` t_a2 | **MVP** |
| `right_atrium` | chamber | yes | `socket_right_atrium` | `identify` t_g2; `place` t_c4; `sequence` t_c5 | **MVP** |
| `aorta` | vessel | yes | `socket_aorta` | `place` t_g3 | **MVP** |
| `pulmonary_artery` | vessel | yes | `socket_pulmonary_artery` | `place` t_a3 | **MVP** |
| `pulmonary_veins` | vessel | no | none | Distractor; selectable for exploration | **MVP** |
| `superior_vena_cava` | vessel | no | none | Distractor | **MVP** |
| `inferior_vena_cava` | vessel | no | none | Distractor | **MVP** |
| `septum` | wall | no | none | Distractor; hotspot `hs_septum` | **MVP** |

Six of ten are grabbable. The four fixed components are deliberate: they give `identify` tasks distractors and keep the challenge activity to six placements, within the ≤ 8 grabbable soft limit in [10](10-3d-content-system.md#asset-limits).

| Socket id | Radius (cm) | Accepts | Visual | Why the `accepts` list is permissive | Tier |
|---|---|---|---|---|---|
| `socket_left_ventricle` | 1.5 | all four chambers | ghost | A chamber dropped in the wrong chamber socket snaps and the engine returns `partial` ("right part, wrong place"), which is the diagnostic feedback a label quiz cannot give | **MVP** |
| `socket_right_ventricle` | 1.5 | all four chambers | ghost | same | **MVP** |
| `socket_left_atrium` | 1.2 | all four chambers | ghost | same | **MVP** |
| `socket_right_atrium` | 1.2 | all four chambers | ghost | same | **MVP** |
| `socket_aorta` | 1.2 | `aorta`, `pulmonary_artery` | ghost | The two great arteries are the classic confusion pair | **MVP** |
| `socket_pulmonary_artery` | 1.2 | `aorta`, `pulmonary_artery` | ghost | same | **MVP** |

Hotspots `hs_lv_wall` and `hs_septum` (kind `info`) and poses `assembled` and `exploded` complete the manifest. No animation clips in MVP (**V1**).

GLB sourcing is the open question [10](10-3d-content-system.md#open-questions) assigns to this file. Decision:

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Adapt a CC-BY or CC0 heart model, split and rename meshes in Blender | Days, not weeks; anatomically reviewed by someone else; licence permits redistribution with attribution | Mesh topology may not separate cleanly at chamber boundaries; attribution must ship in the app | Good | **Recommended, MVP** |
| Commission a modeller | Clean separable parts to spec | Paid; excluded by the no-paid-tools rule at every tier | Poor | Rejected if the adapted model fails the review page |
| Build from scratch in Blender | Full control | Weeks of non-engineering work for one developer | Poor | Reject |

Limitation: a split CC model will need manual retopology at the cut lines, and the triangle budget may force `simplify` on scenery. Confirm the licence allows modification and redistribution before the first commit.

### Gestures

Locked position 3. Specifications, thresholds and the state machine are in [04](04-computer-vision.md#gesture-specifications).

| Gesture id | Hand state | Interaction event | What it does in the lesson | Tier |
|---|---|---|---|---|
| `open_palm` | fingers spread, palm to camera | `cursor` | Neutral cursor; never selects; cancels a pending dwell | **MVP** |
| `point` | index extended, others folded | `hover`; dwell 600 ms → `select` | Hover highlight and label; commits `identify`, `compare` and `sequence` answers | **MVP** |
| `pinch` | thumb tip touches index tip | `grab_start` | Grabs a grabbable component (also emits `select`); on empty space begins orbit | **MVP** |
| `pinch_drag` | held pinch while moving | `grab_move` | Moves the component on the camera-facing drag plane; orbits the model when nothing is grabbed | **MVP** |
| `release` | thumb and index separate | `grab_end` | Drops; snaps into a socket within radius → `place`, otherwise `drop` | **MVP** |

Also in scope: the 5-second two-step calibration (on by default for study participants), the One-Euro filter, pinch hysteresis, the 1 s tracking-loss grace period that can never produce a `place`, the `cv_status` channel for failure states 1, 2 and 5, and the primary-hand rule for a second hand or person.

### Selection and manipulation capabilities

The twelve capabilities from [05 §3](05-3d-interaction.md#3-the-twelve-capabilities), with the MVP slice of each.

| # | Capability | MVP slice | Not in MVP | Tier |
|---|---|---|---|---|
| 1 | Object selection | `point` dwell or `pinch` on a component; click; Tab + Enter | | **MVP** |
| 2 | Raycasting | One raycast per frame on the interactable layer | `three-mesh-bvh` acceleration | **MVP** |
| 3 | Object grabbing | `pinch` on a grabbable; mouse down; Space | | **MVP** |
| 4 | Object movement | Drag plane at object depth, low-gain z-hint, workspace bounds | Ground-plane drag mode | **MVP** |
| 5 | Object rotation | Whole-model orbit via `pinch_drag` on empty space, drag, or arrows | Per-component rotation (`wrist_rotate`, Q/E) | orbit **MVP**, component **V1** |
| 6 | Object scaling | Camera dolly (wheel, +/−), whole model only; disabled in study sessions by a flag for parity ([05 §3](05-3d-interaction.md#3-the-twelve-capabilities)) | `two_hand_scale` gesture; per-component scaling never | dolly **MVP**, gesture **V1** |
| 7 | Component highlighting | Emissive tint on hover; 1 Hz pulse on hint | Outline post-processing | **MVP** |
| 8 | Object snapping | Nearest accepting socket within radius on `grab_end`; 150 ms tween | | **MVP** |
| 9 | Component separation | `assembled` ↔ `exploded` pose tween; drag out of socket | Slider-driven partial explode | **MVP** |
| 10 | Guided animations | Camera tween to `cameraTo`; pose tweens; engine-driven worked example | GLB animation clips | tweens **MVP**, clips **V1** |
| 11 | Resetting scenes | Engine `reset()` to the activity's initial snapshot; R key; HUD button | | **MVP** |
| 12 | Interactive hotspots | `hs_lv_wall`, `hs_septum`; `point` dwell or click opens the body text | `kind: "task"` hotspots | **MVP** |

Limitation stated plainly: a learner cannot move a part toward or away from the camera on purpose. Every task in the lesson is completable because sockets supply depth and orbit exposes any hidden socket (locked position 4).

### Guided learning and the interactive task set

The lesson tree is owned by [06](06-learning-engine.md#example-lesson-tree). The MVP ships all six activities and all twelve tasks exactly as in the heart example.

| Activity | Kind | Scene | Tasks | Learning job | Tier |
|---|---|---|---|---|---|
| `act_intro` | introduction | assembled, orbit only | none; 3 narration cards; completion ≥ 20 s | Activate prior knowledge; learn orbit | **MVP** |
| `act_explore` | explore | assembled, hotspots on | none; completion ≥ 60 s | Build a spatial model without grading | **MVP** |
| `act_guided` | guided | assembled, ghost sockets, grab on, 3 attempts, hints 1–3 | `t_g1` identify `left_ventricle`; `t_g2` identify `right_atrium` (level-2 hint `tutor: true`); `t_g3` place `aorta` → `socket_aorta` (level-3 hint `tutor: true`) | Worked practice with faded support | **MVP** |
| `act_challenge` | challenge | exploded, sockets visible, 1 hint max | `t_c1`–`t_c4` place the four chambers; `t_c5` sequence `right_atrium` → `right_ventricle` → `left_atrium` → `left_ventricle`, strict order | Independent reassembly from memory; blood-path analysis | **MVP** |
| `act_assess` | assessment | assembled, sockets hidden, 1 attempt, no hints | `t_a1` identify `right_ventricle`; `t_a2` identify `left_atrium`; `t_a3` place `pulmonary_artery`; `t_a4` compare wall thickness, answer `left_ventricle` | Unaided evidence that feeds mastery at 2× weight | **MVP** |
| `act_mastery` | mastery | assembled | none; per-objective mastery shown | Close the loop on objectives, not tasks | **MVP** |

Task-type coverage: `identify` ×5, `place` ×6, `sequence` ×1, `compare` ×1. `remove` has no task in this lesson because anatomy has no meaningful removal; the engine supports it and the mouse adapter exercises it in tests so a **V1** mechanical lesson needs no engine change.

Also **MVP** from [06](06-learning-engine.md): the three-level hint ladder with `hintPenalty`; the deterministic template fallback for `tutor: true` hints; the repeated-failure policy (worked example → synthesised `identify` micro-task → retry → mark failed); the 15-minute soft prompt (no hard cap: at 15 minutes the learner is offered the choice to proceed to the assessment, the assessment always runs in full, and the prompt and choice are logged as `time_prompt`; pre-registered); `countsAsAttempt` rules so a tracking-loss `drop` is never graded.

### Basic assessment

| Element | MVP behaviour | Tier |
|---|---|---|
| Assessment activity | `act_assess`: four tasks, `maxAttempts: 1`, `hints: []`, sockets hidden, neutral "Recorded" feedback until the activity ends ([11](11-ui-ux.md#feedback-vocabulary)) | **MVP** |
| Scoring | Per task from `scoring.correct` / `partial`; normalised by `scoring.correct` for mastery | **MVP** |
| Objectives | `obj_identify_chambers` (remember, threshold 0.8), `obj_place_vessels` (apply, 0.8), `obj_blood_path` (analyze, 0.7) | **MVP** |
| Mastery rule | Weighted mean of latest normalised scores across guided, challenge and assessment tasks, assessment at 2×; untouched tasks excluded | **MVP** |
| Unlock | `anatomy.heart.valves_v1` named as the next lesson; the unlock rule runs but the target lesson does not exist | rule **MVP**, lesson **V1** |
| Study instruments | Pre, post and retention knowledge forms, SUS, raw NASA-TLX, satisfaction and open questions, in-app, writing to `instrument_responses` | **MVP** (pilot) |

Limitation: the in-lesson assessment evidences remember through analyze for structural knowledge only; the 15-item external forms carry the study's learning measure, not the in-lesson score ([14 §2.3](14-evaluation-methodology.md#23-learning-metrics)).

### Progress tracking

| Element | MVP behaviour | Where | Tier |
|---|---|---|---|
| Per-objective mastery | Recomputed from attempts on every evaluation; shown as four bands (not started, developing, approaching, mastered) on the mastery activity and results screen | engine, [08](08-gamification.md#mastery-levels) | **MVP** |
| Attempts persisted | In memory, mirrored to `localStorage` by `sessionId`, posted to the attempts route; resumable after reload | [06](06-learning-engine.md#runtime-position-and-persistence), [03](03-system-architecture.md) | **MVP** |
| Progress row | Activity cursor and mastery per objective, upserted per session | [09](09-database.md) | **MVP** |
| Research event log | Every `LogEvent` type in [14 §6.1](14-evaluation-methodology.md#61-schema), batched every 10 s or 50 events, `sendBeacon` on unload, end-of-session JSON download fallback, consent-gated | logger | **MVP** |
| Progress chip and results screen | "Task n of m"; mastery bars with objective statements; per-task outcome list; "Review the parts you missed" | [11](11-ui-ux.md) | **MVP** |
| Anonymous session | Client-generated `sessionId` UUID, validated and recorded by the server on first contact; condition locked per session; delete and export by `sessionId` | [03](03-system-architecture.md#authentication), [09](09-database.md) | **MVP** |

Nothing above reads XP. The progress indicator is the only reward-adjacent element in the MVP.

### Basic AI tutor

Locked positions 5 and 7. Template design, the manifest fields it may quote, guardrails and the **V1** local-model measurement gate are in [07](07-ai-tutor.md); this file fixes only the scope. No paid LLM API is used at any tier.

| Element | MVP scope | Tier |
|---|---|---|
| Engine | `TemplateTutorService` in `packages/tutor`: deterministic templates filled from the lesson hint ladder and manifest `description`, `relations` (`opposite_of`, `connects_to`), `tags`; runs inside the `/api/tutor` route handler, one same-origin round trip per call, no third-party egress. A locally run open-weights model (Ollama on the lab laptop or WebLLM) is **V1**, only after it meets the 3.5 s hint and 30 fps budgets | **MVP** engine, **V1** local model |
| Call kinds | `hint` (when a task hint has `tutor: true`) and `explain_mistake` (after `incorrect` or `partial` in guided or challenge, or when the learner presses the "Explain" pill for the last attempt) | **MVP** |
| Inputs | Task prompt, `expect`, engine `evaluation`, `SceneState`, hint level. Never video, landmarks, or a verdict to make. The MVP never accepts learner free text; the "Explain" pill is the only learner-initiated call, and the free-text "Ask tutor" pill is **V1** | **MVP** |
| Output | ≤ 320 characters, structured JSON, manifest-only vocabulary, no reveal below level 3; validated server-side even though the template cannot produce anything else, so the check is identical for a **V1** engine | **MVP** |
| Fallback | Static hint shown at 0 ms; the template result arrives from `/api/tutor` and replaces it; any cap, route failure or validation failure leaves the static hint in place with a logged `status` | **MVP** |
| Call caps | 1 call per attempt, 3 per task, 12 per session, enforced in the route; kept not for cost (there is none) but so `ai_interactions` rows are comparable with a **V1** local engine | **MVP** |
| Feature flag | `tutorEnabled` per session; off produces the identical lesson with static hints only | **MVP** |
| Parity | No `condition` reaches the tutor; both study arms get identical behaviour when the flag is on | **MVP** |
| Logging | `tutor_message` metadata in the event log; request and delivered text in `ai_interactions` only with consent | **MVP** |

Pilot decision (resolved, see open questions): the tutor is on for both arms. Because the template engine is deterministic, it adds no non-reproducible component to a study whose lesson is otherwise reproducible from the event log.

### Mouse and keyboard control path

An **MVP** requirement, not an accessibility afterthought. The `InputSource` adapter emits the identical interaction-event vocabulary from pointer and keyboard input, so the scene, engine, tutor, logger and lesson JSON have no condition branch ([05 §7](05-3d-interaction.md#7-mouse-and-keyboard-equivalents), [11](11-ui-ux.md#mouse-and-keyboard-parity)).

| Requirement | MVP behaviour | Tier |
|---|---|---|
| Event parity | `hover`, `grab_start`, `grab_move`, `grab_end` from mouse; `select` carries `method: "click"` for analysis | **MVP** |
| Capability parity | Camera dolly (wheel, +/−) disabled in study sessions by a flag because no MVP gesture equivalent exists; Q/E per-component rotation is **V1** with `wrist_rotate` | **MVP** |
| Keyboard floor | Tab focus in manifest order, Enter select, Space grab and drop, arrows move, Esc cancel, R reset, H hint | **MVP** |
| Condition lock | Input mode switch shown as a label, locked to the assigned condition during a study session | **MVP** |
| Mouse calibration | 20 click-and-drag prompts matching the gesture tutorial for timing parity | **MVP** |
| Camera-denied path | Landing offers "Use mouse instead"; failure states 1, 2 and 5 do not occur in mouse mode | **MVP** |

### Pilot-ready instrumentation

The twelve items in [14 §8](14-evaluation-methodology.md#8-what-the-mvp-must-contain-for-the-pilot-to-be-runnable) are all **MVP**. Summarised:

| Item | Tier |
|---|---|
| Consent screen with version stamp before `getUserMedia` | **MVP** |
| Condition set from a researcher-entered pre-assigned code | **MVP** |
| 20-prompt calibration tutorial emitting `calibration_prompt` and `gesture_emit`; mouse equivalent | **MVP** |
| Event logger with `seq`, batching, `sendBeacon`, JSON download | **MVP** |
| Route handler validating payload contracts into the research event table | **MVP** |
| In-app pre/post test, SUS, TLX, satisfaction screens; forms A/B/C | **MVP** |
| Online retention page keyed by `sessionId` | **MVP** |
| Three 15-item knowledge forms, piloted for equivalence | **MVP** (Phase E materials) |
| Delete and export endpoints by `sessionId` | **MVP** |
| 15-minute soft prompt offering the assessment, logged as `time_prompt`; no hard cap | **MVP** |
| Metrics script that recomputes every [14 §2](14-evaluation-methodology.md#2-metric-groups) metric for one session from the database | **MVP** |
| Camera preview, landmark overlay, tracking-active dot, one-key camera off | **MVP** |

### Infrastructure

| Item | MVP | Tier |
|---|---|---|
| App | One Next.js deployment on Vercel free tier; route handlers for session, tutor, attempts, progress, events, delete | **MVP** |
| Database | Neon or Supabase free Postgres (choice in [09](09-database.md)); Drizzle ORM | **MVP** |
| Assets | GLB, Draco decoder, MediaPipe files served from `apps/web/public/` on Vercel, pinned versions; object storage behind a CDN before the main study | **MVP** files, **V1** CDN |
| Local development | Docker Compose for Postgres | **MVP** |
| Content | JSON and GLB in the repo, `contentHash` stamped on every attempt and event | **MVP** |

## What is NOT in the MVP

| Item | Moves to | Reason |
|---|---|---|
| Accounts and sign-in | **V1** | Participants use the product once or twice; anonymous `sessionId` is stronger data minimisation and removes a login screen. Auth.js or Supabase Auth when cross-session progress is needed |
| Dashboard and lesson map | **V1** | One lesson has nothing to map; the results screen covers progress |
| Additional lessons and subjects (`anatomy.heart.valves_v1`, chemistry, mechanical) | **V1** | Second lesson arrives for study replication; new subjects only if they fit the five task types without engine changes |
| Pose tracking | **Future** | Locked position 2; doubles inference cost and no heart task needs the body |
| `fist`, `swipe`, `wrist_rotate`, `two_hand_scale` | **V1** | Each is a false-positive source with no MVP task that needs it; reset and navigation have HUD buttons ([04](04-computer-vision.md#mvp-and-postponed-set)) |
| Per-component rotation and scaling | **V1** rotation; scaling never per component | Sockets supply rotation on snap; component scale has no learning value in anatomy |
| XP, levels, badges, streaks beyond mastery bands | **V1**; daily streaks rejected outright | Reward pacing would differ between conditions and confound the study; evidence for retention benefit is weak ([08](08-gamification.md)) |
| Tutor chat (free-text questions), concept explanation, progress summary | **V1** | A template engine cannot answer free text; needs the measured local model, injection hardening and a chat UI; not required to validate the loop |
| Tutor quiz generation and personalised paths | **Future** | Generated `expect` blocks break deterministic evaluation; hallucinated anatomy in an assessment is a learning harm |
| FastAPI or any Python service | **V1/Future** behind the `TutorService`/`VisionService` seam | Locked position 1; the server does no numerical work |
| Paid infrastructure or any metered API (hosting tiers, Postgres tiers, CDN, LLM APIs) | Not at any tier (user decision 2026-10-05) | Free no-card tiers and open-source software only; the template tutor answers in milliseconds, so the 10 s Hobby timeout never bites |
| Mobile | **V1** tablet with touch as mouse-equivalent; **Future** phone camera | Mobile GPUs and front cameras cannot meet the 30 fps combined budget; touch has no hand-tracking story |
| Authoring UI | **V1** validation tooling and docs; **Future** visual editor | One author, one lesson; JSON with schema autocomplete and `pnpm content:validate` is cheaper |
| Teacher dashboards and class views | **V1** | Needs accounts and more than one lesson |
| VR, AR, voice, eye tracking, multiplayer | **Future** | Seams only, per [18](18-future-expansion.md) |
| Ground-plane drag mode, GLB animation clips, outline post-processing, `three-mesh-bvh` | **V1** | Each is gated on a measured need the heart lesson does not produce |
| `misfire_report` key, parental consent, data-residency controls | **V1** | Not needed for an adult pilot |
| Time limits per task (`timeLimitSec`) | **V1**, and never in the study lesson | Gesture is slower than mouse; a per-task limit confounds the comparison |

## MVP acceptance criteria

The MVP is done when every row passes on the reference laptop (integrated GPU, Intel Iris Xe or UHD 620 class, 720p webcam, Chrome) with a person other than the developer. Sources: [00](00-executive-summary.md#smallest-viable-prototype) prototype criteria, [05 §10](05-3d-interaction.md#10-render-performance-budget) budget, [14 §2](14-evaluation-methodology.md#2-metric-groups) targets, [14 §5](14-evaluation-methodology.md#5-pilot-versus-main-study) pilot exit criteria, [07](07-ai-tutor.md) tutor guardrails.

| ID | Criterion | Target | Measured by | Source |
|---|---|---|---|---|
| A1 | Lesson completable end to end in the gesture condition | All 12 tasks reachable; at least one correct `place` per socket type across three testers | Session event log | 00, 06 |
| A2 | Lesson completable end to end in the mouse condition with no missing affordance | Every task completable by mouse and by keyboard alone | Pilot checklist item 2 | 14 §5 |
| A3 | Event log reconstructs every attempt | Metrics script reproduces every section-2 metric for a session without ambiguity | Metrics script | 14 §8 |
| A4 | Main-thread frame time with hand in view | p95 ≤ 33 ms during a drag | `perf_sample.frameMsP95` | 05 §10, 00 |
| A5 | Render time | p95 ≤ 12 ms | `r3f-perf` in dev; `gl.info` in prod | 05 §10 |
| A6 | CV inference latency | p95 ≤ 33 ms in the worker path (doc 05 targets ≤ 15 ms internally; 33 ms is the acceptance bound) | `perf_sample.inferenceMsP95` | 14 §2.1, 05 §10 |
| A7 | End-to-end latency | p50 ≤ 100 ms capture to scene apply | `perf_sample.e2eMsP50` | 14 §2.1 |
| A8 | Effective frame rate | mean ≥ 30 fps | `perf_sample.fps` | 14 §2.1 |
| A9 | React commits during drag | 0 per frame | React Profiler, debug assertion | 05 §10 |
| A10 | Draw calls and triangles | ≤ 50 calls, ≤ 150k triangles on screen | `gl.info.render` | 05 §10 |
| A11 | GLB size and load | < 5 MB compressed; time to first interaction ≤ 5 s on 10 Mbps | CI check; `performance.mark` | 05 §10, 10 |
| A12 | Dropped frames | ≤ 30 per minute (delta > 50 ms) | logged | 05 §10 |
| A13 | Gesture accuracy in calibration | ≥ 0.90 overall; precision and recall ≥ 0.90 for `pinch` and `release` | `calibration_prompt` vs `gesture_emit` | 14 §2.1 |
| A14 | Pinch false-start rate | ≤ 0.10 of closed grabs | a closed grab that never moved: `grab_move_summary.firstMoveMs` null, decided 2026-10-07 (was: no `grab_move` within 300 ms) | 14 §2.1, 00 |
| A15 | Tracking stability | ≤ 2 `tracking_lost` per minute; lost fraction ≤ 0.05; jitter ≤ 0.005 | `tracking_*`, `perf_sample.jitterNorm` | 14 §2.1 |
| A16 | Tracking loss never grades | No `place` emitted during or after `tracking_lost` until `tracking_regained` | Replay test on logged sessions | 00, 04, 05 |
| A17 | Three placements first try | 3 of 3 correct within 2 minutes by a non-developer with a window behind them | Observed session | 00 |
| A18 | Template tutor coverage and fallback | Every `tutor: true` hint and every `explain_mistake` in guided or challenge produces a row with `engine = template`; `status = ok` on 100% of uncapped calls; every cap or error leaves the static hint with a logged `status`. (The 3.5 s p95 latency bound is re-scoped to **V1**: it gates a local model before adoption and is not an MVP criterion) | `ai_interactions.engine`, `status` | 07 |
| A19 | Tutor guardrails | 0 replies with a non-manifest id or an answer reveal below level 3 across the pilot; the template unit tests cover every task and hint level in the lesson | Template test suite; `ai_interactions` review | 07 |
| A20 | Privacy invariants | No `fetch`, `sendBeacon` or IndexedDB write carries image data or landmark arrays during a lesson | Automated interception test | 14 §7 |
| A21 | Consent and deletion | Consent precedes camera permission; `DELETE` by `sessionId` cascades across all research tables | Manual check; integration test | 14 §7, 03 |
| A22 | Session fits the protocol | S1 ≤ 45 minutes including instruments; lesson ≤ 15 minutes | Pilot timing | 14 §3.2 |
| A23 | Form equivalence | Pilot means of forms A/B/C within 1 point | Pilot data | 14 §5 |
| A24 | Tracking works for every pilot participant's lighting | 0 participants excluded for lost fraction > 0.20 after the lighting overlay | Pilot data | 14 §4 |

A1–A21 are engineering acceptance and gate Phase 7 of [13](13-roadmap.md). A22–A24 are pilot exit criteria and gate the main study.

## Relationship to the smallest viable prototype

The prototype in [00](00-executive-summary.md#smallest-viable-prototype) (locked position 10) is a strict subset of the MVP, chosen so that the riskiest link in the chain is tested before anything that depends on it is built. Nothing in the prototype is thrown away; each MVP element is an addition.

| Dimension | Smallest viable prototype | MVP | What the step adds |
|---|---|---|---|
| Pages | One route, no navigation | Landing, learning environment, results, consent, calibration, instruments, retention | Screens and the session lifecycle |
| Components | 3 grabbable (`aorta`, `pulmonary_artery`, `left_ventricle`); the rest static scenery | 6 grabbable, 4 fixed distractors | Four more sockets and the `exploded` pose |
| Sockets | 3 | 6 | Permissive `accepts` lists that produce `partial` |
| Gestures | `pinch`, `pinch_drag`, `release` | plus `open_palm`, `point` | Hover, dwell select, neutral cursor; the full state machine |
| Task types | `place` only, 3 tasks, hints empty | `identify`, `place`, `sequence`, `compare` across 12 tasks; `remove` supported | Lesson JSON, activities, hint ladder, remediation, mastery |
| Feedback | Snap or settle; colour and text at the object | Full feedback vocabulary; assessment "Recorded" override; failure states 1–7 | HUD, hand-state chip, pre-commit cues |
| Mouse path | Click-drag does the same | Full parity table, keyboard floor, condition lock, mouse calibration | Study-grade control condition |
| Persistence | None | Anonymous sessions, attempts, progress, research event log, instruments | Postgres, route handlers, consent |
| AI tutor | None | Template hint and mistake explanation behind a flag | Route, template engine, guardrails, fallback |
| Perf readout | `r3f-perf` overlay, console `perf_sample` every 5 s | `perf_sample` and `device_info` in the research log | Same numbers, persisted |
| Success test | 3 placements first try; p95 frame and inference ≤ 33 ms; false starts ≤ 10%; no `place` on loss | A1–A24 above | Learning, study and privacy criteria |

The prototype's stop/go rule carries into the MVP unchanged: if a non-developer with a window behind them cannot make three placements on the first try, the gesture modality is at risk and the project pivots to validating the learning engine on the mouse path before more CV work. The build order that takes the prototype to the MVP is Phases 1–5 of [13](13-roadmap.md); the exact milestone sequence for the prototype itself is [17](17-first-prototype-plan.md).

## Open questions

1. Resolved 2026-10-04 (user decision), unchanged by the 2026-10-05 move to the template tutor: the tutor is **on for both arms** in the pilot, with the flag recorded per session; revisit only if `ai_interactions` shows guardrail failures above the A19 threshold.
2. Heart model: resolved to **adapt a CC-licensed model**; the candidate shortlist and licence check are recorded in `content/models/README.md` (Phase C) and the final pick is made at prototype milestone M9.

## Related

- [00 Executive summary](00-executive-summary.md): smallest viable prototype and the three hardest problems this scope is built around
- [01 Product definition](01-product-definition.md): target users and the assumptions challenged
- [04 Computer vision](04-computer-vision.md), [05 3D interaction](05-3d-interaction.md): gesture and capability specifications summarised here
- [06 Learning engine](06-learning-engine.md), [10 3D content system](10-3d-content-system.md): lesson tree, manifest, validation
- [07 AI tutor](07-ai-tutor.md): tutor scope, template engine, guardrails, local-model gate
- [08 Gamification](08-gamification.md): mastery bands, the only reward layer in MVP
- [11 UI/UX](11-ui-ux.md): screens that ship first
- [13 Roadmap](13-roadmap.md): the phases that build this scope
- [14 Evaluation methodology](14-evaluation-methodology.md): instrumentation and pilot criteria adopted as acceptance
- [17 First prototype plan](17-first-prototype-plan.md): milestone sequence for the prototype subset
