# Evaluation Methodology

This file turns Grasp into a measurement instrument. It defines every metric as a formula over the event-log schema so an engineer can implement it without interpretation, fixes the academic study design (between-subjects, gesture versus mouse, identical heart lesson), names the threats to validity and their mitigations, and states the instrumentation and ethics requirements that the other docs must honour. Tier: mostly **MVP** (pilot-ready logging and instruments) with the main study at **V1**.

## 1. What the evaluation must answer

| ID | Research question | Primary measure | Tier |
|---|---|---|---|
| RQ1 (learning) | Does gesture-based 3D interaction produce higher post-test and one-week retention scores than mouse-based interaction on the identical lesson? | Post-test and retention score, pre-test as covariate | **MVP** pilot, **V1** main |
| RQ2 (process) | Do interaction patterns (time per task, error types, hint use) differ between conditions, and do they mediate learning gain? | Task-level event-log metrics | **MVP** pilot, **V1** main |
| RQ3 (usability and load) | How do SUS and NASA-TLX compare, and does tracking quality predict either? | SUS, raw TLX, tracking-lost seconds, false-start rate (`grab_move_summary.firstMoveMs` null, a closed grab that never moved; section 2.1) | **MVP** pilot, **V1** main |

The mouse condition (locked position 8) is non-negotiable. The intervention bundles two things: an interactive 3D model with declarative evaluation, and embodied gesture input. Without a control that keeps the first and removes the second, any gain is attributable to "interactive 3D" in general, which is already well studied, and the study says nothing about gesture control. Both conditions run the same lesson JSON, GLB, engine, tutor and feedback. Only the input layer differs.

One weak assumption in the brief: it implies gesture control should improve learning. The honest hypothesis is two-sided. Gesture input may add extraneous cognitive load (RQ3) that cancels any embodiment benefit. The design below can detect either outcome.

## 2. Metric groups

Notation: `E` is the ordered set of `LogEvent` records for one session (schema in section 6). `n(type)` is the count of events of that type; `t(e)` is the event's `t` field in ms; `Σ` sums over matching events. Lesson duration `T = t(last activity_end) − t(first activity_start)`. Learner-facing instruments (tests, SUS, TLX) are stored as `instrument_responses`, not as events.

### 2.1 Computer Vision metrics

These apply to the gesture condition only. The mouse condition emits no `tracking_*`, `gesture_*` or `perf_sample.inference*` fields.

**Ground truth for gesture accuracy.** There is no way to score a classifier without knowing what the hand actually did, and video is never stored. The ground truth therefore comes from the **calibration tutorial** every gesture-condition participant completes before the lesson: a scripted sequence of 20 prompts (`open_palm` ×4, `point` ×4, `pinch` ×4, `pinch_drag` ×4, `release` ×4, shuffled, each with a 3 s response window). The tutorial emits `calibration_prompt { promptNo, expectedGesture, windowMs }` and the vision layer emits `gesture_emit { gesture, confidence }` on every state-machine transition. Within a window, the first `gesture_emit` is the classifier's answer; no emission is a miss. This measures accuracy under cooperative, scripted conditions, which is an upper bound; in-lesson quality is estimated from the proxy metrics below. A participant-pressed "that was not me" key (`misfire_report`) gives in-lesson false-positive ground truth at **V1**.

| Metric | Formula over `E` | Target | Tier |
|---|---|---|---|
| Gesture accuracy | `TP / n(calibration_prompt)` where TP = windows whose first `gesture_emit.gesture == expectedGesture` | ≥ 0.90 in pilot | **MVP** |
| Precision (per gesture g) | `TP_g / (TP_g + FP_g)`; `FP_g` = windows where first emit is `g` but `expectedGesture != g`, plus `gesture_emit` of `g` outside any window during calibration | ≥ 0.90 for `pinch`, `release` | **MVP** |
| Recall (per gesture g) | `TP_g / n(calibration_prompt where expectedGesture == g)` | ≥ 0.90 | **MVP** |
| False-positive rate (in lesson, proxy) | `falseStarts / n(grab_move_summary)`, over closed grabs only (numerator and denominator both from `grab_move_summary`, so a grab still open at session end counts in neither; a grab ended by tracking loss, i.e. a summary immediately preceded by `grab_end` with `reason: "lost"`, is excluded from both, because that is failure state 5, not a misread pinch), gesture condition only (the replay script prints n/a for mouse logs); falseStart = a `grab_move_summary` with `firstMoveMs == null` (the grab closed without the cursor ever travelling `DRAG_START_DIST`, 0.01 normalised); any later first move is a deliberate drag, not a false start (changed 2026-10-07, M11: the earlier `firstMoveMs > 300` clause flagged 4 of 9 real drags in the developer's gesture log, all first moving at 304 to 400 ms, two ending in correct placements; under this rule that log scores 0 of 9, and 0 of 6 once its three camera-cover grabs ended by tracking loss are excluded). Implemented as `falseStartRate()` in `packages/learning/src/logger.ts`; `scripts/research/replay-log.ts` reports it per session | ≤ 0.10 | **MVP** |
| False-positive rate (reported) | `n(misfire_report) / (n(grab_start) + n(select))` | report only | **V1** |
| Tracking stability: lost rate | `n(tracking_lost) / (T / 60000)` per minute | ≤ 2 per min | **MVP** |
| Tracking stability: lost fraction | `Σ tracking_regained.payload.durationMs / T` | ≤ 0.05 | **MVP** |
| Tracking stability: cursor jitter | mean of `perf_sample.jitterNorm` (RMS cursor displacement in normalised units over the sample window while state is IDLE or HOVER and velocity < 0.02 width/s); computed in the worker from the cursor, never from stored landmarks | ≤ 0.005 | **MVP** |
| Inference latency | median and 95th percentile of `perf_sample.inferenceMsP50` and `inferenceMsP95` across the session | p95 ≤ 33 ms | **MVP** |
| End-to-end latency | median of `perf_sample.e2eMsP50`: bitmap capture timestamp to scene apply timestamp, measured in the main thread | p50 ≤ 100 ms | **MVP** |
| Effective frame rate | mean `perf_sample.fps`; `n(hand_count where n > 1)` reported alongside | ≥ 30 | **MVP** |

Limitation: calibration accuracy is measured once on a cooperative hand and overstates in-lesson accuracy. The false-start proxy undercounts false positives followed by a drag. Under the never-moved rule, an accidental pinch that travels 0.01 normalised counts as a drag, so the rate is a lower bound and the ≤ 0.10 target is checked against a lower-bound proxy; no-hit pinches (misses, `componentId == null`) do count, grabs ended by tracking loss do not. It also overcounts deliberate pinch-to-select: a `select` with `method: "grab"` in an `identify` task never moves, so it counts as a false start. Once identify tasks exist (Phase 4), the analysis restricts the rate to grabs with `componentId != null` during `place` tasks; the prototype has only place tasks, so the bias is absent there. Both limitations are reported as such.

### 2.2 3D Interaction metrics

Apply to both conditions. The mouse condition maps pointer events to the same interaction-event vocabulary (`hover`, `grab_start`, `grab_move`, `grab_end`), so these formulas are condition-neutral. That mapping is a requirement on [05-3d-interaction.md](05-3d-interaction.md).

| Metric | Formula over `E` | Tier |
|---|---|---|
| Interaction success rate | `n(place) / n(grab_start where payload.componentId != null)`; a grab ending in `drop` or in `grab_end.reason == "lost"` counts as unsuccessful. Drops with `drop.cause == "lost"` (the scene field in [05](05-3d-interaction.md)) are reported separately as loss-caused; the engine does not evaluate them as task attempts, so they never appear as `task_attempt.correct == false` | **MVP** |
| Selection accuracy | `n(task_attempt where taskType == "identify" and correct) / n(task_attempt where taskType == "identify")` | **MVP** |
| Placement accuracy | `n(task_attempt where taskType == "place" and correct) / n(task_attempt where taskType == "place")`; `partial` reported separately as right component, wrong socket | **MVP** |
| Task completion time | per task: `t(task_end) − t(task_start)`; session: median over tasks, reported by task type | **MVP** |
| Time to first attempt | `t(first task_attempt for taskId) − t(task_start)`; separates "thinking" from "doing" | **MVP** |
| Attempts per task | `n(task_attempt for taskId)`; mean over tasks completed | **MVP** |
| Orbit use | `n(grab_move_summary where componentId == null and firstMoveMs != null)` (the hand moved, so it orbited) and the summed `durationMs` of those summaries. Misses are reported separately: `n(grab_move_summary where componentId == null and firstMoveMs == null)`. Once orbit ships, every no-hit pinch is an orbit ([05](05-3d-interaction.md)), so the split comes from movement, with no extra field. The M10 prototype has no orbit, so there every null `componentId` is a miss | **MVP** |

Limitation: gesture-condition task time includes time lost to tracking failures. Report raw time and active time (`raw − Σ tracking_regained.durationMs` within the task); active time is the pre-registered primary.

### 2.3 Learning metrics

Scores come from `instrument_responses`; mastery and task completion come from the engine's events.

| Metric | Formula | Tier |
|---|---|---|
| Pre-test score | sum of correct items on form assigned at S1 start, 0–15 | **MVP** |
| Post-test score | sum of correct items on form assigned at S1 end, 0–15 | **MVP** |
| Normalised gain | `(post − pre) / (15 − pre)`; undefined if `pre == 15` (exclude, pre-registered) | **MVP** |
| Knowledge retention | retention-test score at S2 (+7 days), 0–15; relative retention `retention / post` reported secondarily | **MVP** |
| Task completion | `n(distinct taskId with task_attempt.correct) / n(distinct taskId with task_start)` over non-introduction activities | **MVP** |
| Mastery rate | from `mastery_computed { objectiveId, mastery, threshold }` emitted at the mastery activity: `n(objectives where mastery ≥ threshold) / n(objectives)`; mastery itself is computed by the engine per the [lesson-schema](06-learning-engine.md) rule, weighted mean of latest attempt scores with assessment tasks at 2× | **MVP** |
| Per-objective mastery | `mastery_computed.payload.mastery` per objective, used in RQ2 mediation | **MVP** |
| Hint dependence | `n(hint_shown) / n(task_start)`; by hint level | **MVP** |

Limitation: a 15-item test has a ceiling. Pilot means above 12 on the post-test mean the test must be lengthened or hardened before the main study.

### 2.4 UX metrics

| Metric | Instrument and formula | Tier |
|---|---|---|
| SUS | 10 items, 1–5. `score = 2.5 × Σ_i ((odd i: r_i − 1), (even i: 5 − r_i))`, 0–100 | **MVP** |
| Task difficulty (NASA-TLX, raw) | six subscales (mental, physical, temporal, performance, effort, frustration) on 21-point scales ×5 → 0–100; `rawTLX = mean of six`; no pairwise weighting | **MVP** |
| Engagement: active ratio | `(T − idle) / T` where idle = Σ gaps > 10 s with no logged interaction event (`grab_start`, `grab_move_summary`, `grab_end`, `select`, `place`, `drop`, `hint_shown`, `tutor_message`). `hover` is never logged, so it cannot count (changed 2026-10-29, step 4.7) | **MVP** |
| Engagement: voluntary exploration | total time in the `explore` activity, `t(activity_end) − t(activity_start)`, and `n(select where hotspotId != null)`. Explore has no minimum duration: it ends when the learner presses "Start the lesson" (`completion: { continue: true }` in `chambers_v1`), so all of it is voluntary (changed 2026-10-29, step 4.7) | **MVP** |
| Engagement: tutor use | `n(tutor_message where payload.kind in ("hint", "explain_mistake") and payload.source == "tutor")` (`tutorUse`); by `kind` and `hintLevel`. `source == "static"` messages (`status` `capped`, `fallback_invalid`, `fallback_timeout` or `fallback_error`: the learner kept the static text already on screen) are counted separately (`tutorStaticFallbacks`) and broken down by `status`. In `chambers_v1` every requested `tutor: true` hint carries authored text and is served statically without a call, so no `hint`-kind `tutor_message` occurs and tutor use is almost entirely `explain_mistake`: it measures mistakes in guided and challenge tasks, not help-seeking. Hint-seeking is read from `hint_shown` | **MVP** |
| User satisfaction | single item "I would use this again" 1–7, plus three open questions (hardest part, when tracking failed, suggestions), coded thematically | **MVP** |
| Perceived tracking quality | single item 1–7, gesture condition only; correlated with lost fraction as a manipulation check. Not computed yet: the instrument item is not defined | **MVP** |

Limitation: SUS and TLX are self-report and novelty-sensitive; they are interpreted alongside log metrics, never alone.

### 2.5 Implementation and documented simplifications

Every metric above is computed by `sessionMetrics(events, instrumentRows)` in `packages/learning/src/metrics.ts` (roadmap step 4.7, built 2026-10-29). It is pure; a metric whose inputs were not logged is `null` (every CV metric in the mouse condition, calibration metrics until the tutorial exists, test scores until the instrument pages exist). `scripts/research/metrics.ts` feeds it:

| Command | Output | Tier |
|---|---|---|
| `pnpm research:metrics <sessionId \| participantCode>` | all metrics for one session from `event_logs` and `instrument_responses`, as JSON | **MVP** |
| `pnpm research:metrics <grasp-log-*.json>` | the same from a downloaded event log (no instrument rows, no attempt-row check) | **MVP** |
| `pnpm research:metrics --phase dev\|pilot\|main` | one summary line per session in that phase | **MVP** |

Where the implementation is simpler than the formulas above (all **MVP**, each reported as a limitation when results are written up):

| Metric | Implemented as | Effect |
|---|---|---|
| Precision (2.1) | false positives counted only inside calibration prompt windows; emits outside any window are not counted | precision is an upper bound |
| Engagement active ratio (2.4) | logged interaction events only; no `hover` | a learner who only hovers counts as idle |
| Voluntary exploration (2.4) | total explore time, no minimum subtracted | matches the lesson; no bias |
| Perceived tracking quality (2.4) | not computed | added when the satisfaction instrument defines the item |

**Reconstruction checks** (doc 12 A3 and A16). The script exits 1 when any session fails one:

| Check | Fails when |
|---|---|
| Sequence integrity | `seq` has a gap or a duplicate |
| Attempt inside its task | a `task_attempt` is not between its own `task_start` and `task_end` |
| No placement while lost | a `place` falls between `tracking_lost` and `tracking_regained` |
| Event log matches attempt table | the number of `task_attempt` events differs from the session's `lesson_attempts` rows (database runs only; skipped for a session with no events) |

The first run on real recorded sessions failed sequence integrity: a batch in flight when the page reloaded was cancelled, and the `sendBeacon` on `pagehide` cannot resend events already taken from the queue. Fixed by sending every batch with `fetch(..., { keepalive: true })` in `apps/web/lib/logger-transport.ts`. Sessions recorded before the fix keep their gaps; they are reported, not repaired.

## 3. Academic study design

### 3.1 Design choice

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Between-subjects, gesture vs mouse, one lesson | No carry-over of heart knowledge; one lesson and one model suffice; clean attribution to input modality | Needs ~2× participants; individual differences add noise (handled by pre-test covariate) | Good: one lesson to build and maintain | **Recommended, MVP** (locked position 8) |
| Within-subjects, two lessons (heart, lungs) | Half the participants; each learner is own control | Needs a second model and a matched-difficulty lesson; order and lesson-difficulty confounds | Poor: doubles content work | Rejected for MVP; **Future** |
| Crossover on the same lesson | Fewest participants | Second exposure to identical content makes the second post-test meaningless | Poor | Rejected |
| Gesture only, pre/post | Cheapest | Cannot separate gesture from 3D interactivity; the central question is unanswerable | Trivial | Rejected; violates locked position 8 |

### 3.2 Protocol

| Element | Specification | Tier |
|---|---|---|
| Conditions | A: gesture (webcam, five MVP gestures). B: mouse and keyboard (click, drag, arrow keys, Enter). Identical lesson `anatomy.heart.chambers_v1`, model `heart_v1`, tutor, hints, feedback | **MVP** |
| Scene parity | In `pilot` and `main` sessions the lesson page sets the scene's `studyParity`, which turns off camera dolly (wheel, + / −), the X explode key and every extra gesture (`fist` turn, two-hand zoom, explode and twist), in both conditions, so both conditions share the same scene capabilities. The unsaved fallback fails closed to the same behaviour. Extra gestures run only in `dev` sessions and are never logged (user decision 2026-10-30) | **MVP** |
| Participants | Age 16+, no formal cardiac anatomy beyond school level, normal or corrected vision, able to use one hand freely. Minors with parental consent at **V1** | **MVP** / **V1** |
| Randomisation | Pre-test is scored first; participants are assigned within pre-test tertile (0–5, 6–10, 11–15) using a blocked sequence (block size 4) generated before recruitment. The blocked randomisation list is kept offline by the researcher and never enters the app or database. The app receives only a pre-assigned session code that the researcher types on the consent screen, format `<P|S|D><G|M>-NNN` (phase: pilot, main study, developer; condition: gesture, mouse; list number), for example `PG-014`. `parseAssignmentCode` in `apps/web/lib/consent.ts` derives `study_phase` and `condition`; the app generates the `sessionId` UUID and records all three on `research_sessions`. The app never randomises. Pilot and main-study codes are single-use (a reused code is refused with 409); developer codes (`DG`, `DM`) get a unique suffix so they can be reused | **MVP** |
| Session 1 (≤ 45 min, in person) | consent (5) → demographics (2) → pre-test form X (6) → calibration tutorial, gesture or mouse (5) → lesson (12–15) → post-test form Y (6) → SUS, TLX, satisfaction, open questions (6) | **MVP** |
| Session 2 (+7 days ±1, online) | retention test form Z (6), one question on any heart study since S1 | **MVP** |
| Instruments | Three parallel 15-item knowledge forms (labelled-diagram identification, blood-path ordering, short multiple choice), SUS, raw NASA-TLX, satisfaction, open questions | **MVP** |
| Form counterbalancing | Forms A/B/C assigned to pre/post/retention in a Latin square across participants, balanced within condition | **MVP** |
| Setting | Same room, laptop, webcam and lighting for all gesture participants; mouse participants use the same laptop with the webcam covered | **MVP** |

### 3.3 Sample size

Assumption: a medium effect, Cohen's `d = 0.5`, on post-test between conditions; `α = 0.05` two-sided; power `0.80`. An independent-samples t-test needs 64 per group (128 total). With ANCOVA and a pre–post correlation of `r ≈ 0.5`, the required n falls to roughly `64 × (1 − r²) ≈ 48` per group. The pre-registered target is **64 per group** so the design is powered even if pre-test correlates weakly. Plan for 15% attrition at S2 and recruit 75 per group.

This is a large commitment for a solo researcher. If recruitment caps at 30 per group, the study is pre-registered as an effect-size estimation study with confidence intervals, not a hypothesis test. Saying so up front is better than an underpowered null.

### 3.4 Analysis plan (pre-registered)

| Level | Analysis | Tier |
|---|---|---|
| Primary (RQ1) | ANCOVA: post-test ~ condition + pre-test. Repeated for retention. Report adjusted means, Cohen's d, 95% CI | **MVP** pilot (descriptive only), **V1** |
| Secondary (RQ3) | SUS and raw TLX: Welch t-test or Mann-Whitney if non-normal. TLX subscales reported with Holm correction | **V1** |
| Secondary (RQ2) | Mixed-effects logistic model: `task_attempt.correct ~ condition × taskType + (1 | participant) + (1 | taskId)` | **V1** |
| Exploratory | Within gesture group: normalised gain ~ tracking lost fraction + false-start rate. Mediation of condition → active time → gain | **V1** |
| Sensitivity | Intention-to-treat (all assigned) and per-protocol (exclude gesture participants with lost fraction > 0.20, threshold pre-registered) | **V1** |
| Pre-registration | Hypotheses, exclusions, primary outcome, analysis code template and the knowledge forms are registered (OSF or AsPredicted) after the pilot and before the first main-study participant | **V1** |

Pilot data are reported separately and never pooled into the main analysis.

**Exclusion: sessions before scene parity (MVP).** Before 2026-10-30 the lesson page never passed `studyParity`, so a `pilot` or `main` session from that time may have used dolly or X explode, and no log event records either. Any `research_sessions` row with `study_phase` in (`pilot`, `main`) and `created_at` < `2026-10-30` is excluded from every analysis, or, if it cannot be removed, flagged and reported separately. The twelve local `pilot` rows that exist now are development test data, not participants: delete each with `pnpm research:delete <code>` before the first pilot participant. The pilot proper has not started.

## 4. Threats to validity

| Threat | Why it matters here | Mitigation | Tier |
|---|---|---|---|
| Novelty effect | Gesture control is unusual; engagement and SUS may reflect novelty, not learning | Retention test at +7 days; report engagement alongside gain; note in limitations. **Future**: multi-session classroom study | **MVP** |
| Tracking failures confound the gesture condition | Poor lighting or a small hand degrades the treatment; a null may mean "tracking broke", not "gesture does not help" | Calibration tutorial with accuracy gate (≥ 0.80 or re-run once); standardised room and lighting; log lost fraction per participant; pre-registered per-protocol exclusion; exploratory regression on lost fraction | **MVP** |
| Test-form non-equivalence | Pre/post/retention differences could be form difficulty | Three forms counterbalanced in a Latin square; pilot check that form means differ by ≤ 1 point; swap items if not | **MVP** |
| Teaching to the test | Items that echo lesson wording inflate post-test | Items written from a textbook, not from lesson narration; diagram orientations differ from the model's default camera | **MVP** |
| Experimenter effects | The researcher built the gesture system and may unconsciously help that group | Scripted session; on-screen instructions deliver all content; researcher sits out of view after calibration and intervenes only for hardware failure, which is logged | **MVP** |
| Time-on-task imbalance | Gesture is slower, so gesture learners get more exposure, or a hard cap would truncate them before the assessment | No hard cap. At 15 min of lesson time a soft prompt offers the learner the choice to proceed to the assessment; the assessment always runs in full. The prompt and the choice are logged as a `time_prompt` event; the rule is pre-registered. This keeps the 45-min session feasible (most learners accept the prompt) while slower gesture learners are never cut off before the assessment that produces the primary outcome. Active time logged and used as covariate in a secondary model; `time_prompt.choice` and completion rate reported per condition | **MVP** |
| Mouse familiarity | Mouse participants start fluent; gesture participants learn a new input during the lesson | 5 min calibration tutorial for both conditions; time-to-first-attempt reported as a fluency measure | **MVP** |
| Small sample, pilot over-interpretation | 8–12 per group cannot support inference | Pilot reported descriptively; no p-values; its only purpose is to fix instruments and tracking | **MVP** |
| Differential attrition at S2 | Frustrated gesture participants may skip retention | Online S2 takes 6 min; reminder at day 6; attrition by condition reported; ITT analysis | **V1** |
| Ceiling and floor effects | 15 items; school-level learners may know chambers already | Pre-test stratification; pilot item analysis (drop items with p > 0.9 or < 0.2) | **MVP** |
| Reward layer differs between arms | Rewards that differ, or that pay out faster for faster input, would confound condition with motivation ([08-gamification.md](08-gamification.md)) | Identical reward surface in both arms: in MVP that is mastery bands, the mastery bar, the Review list, the correct-answer burst and the level path. None of them reads the condition; `apps/web/lib/reward-surface.test.ts` checks this. No reward may correlate with speed or tasks per minute. The burst is feedback on one correct action, and its count is correct non-assessment attempts plus correct remediation micro-tasks, so it depends on errors, not on time. **V1**: XP, levels and badges are not computed at all in pilot or main sessions; otherwise a gesture arm that is slower per task would get a differently paced reward stream | **MVP** / **V1** |
| Self-selection and Hawthorne | Technology enthusiasts volunteer; observation changes behaviour | Recruitment text says "a 3D anatomy lesson" without naming gestures; assignment hidden until after pre-test; identical setting for both conditions so observation effects do not differ | **MVP** |

Tutor wording is not a threat in MVP: the template engine ([07-ai-tutor.md](07-ai-tutor.md)) returns byte-identical text for the same mistake at the same hint level in both arms, and the tutor is on in both arms, so tutor variability cannot differ between conditions. The text is not stored: `ai_interactions.request_json` and `delivered_text` are always null in MVP, because the consent form does not ask `consent_tutor_payloads` (user decision 2026-10-30). Each message is instead rebuilt from the event log, the lesson and manifest pinned by `research_sessions.lesson_hash`, and the template set pinned by `ai_interactions.template_version`. Pairing rule: an `explain_mistake` `tutor_message` belongs to the last `task_attempt` with the same `taskId` at or before `t − latencyMs` (the request time). The payload has no `attemptNo`, and a slow reply can land after the learner's next attempt, so the nearest preceding attempt is not reliable. That `task_attempt` supplies component, socket, attempt number and hints used. For a `sequence` task, `stepNo` = the number of step events (`select` or `place`, whichever the step expects) between the later of that task's `task_start` and its previous `task_attempt`, and the paired attempt, plus 1. A `tutor_message` with `source: "static"` changed nothing on screen. For `explain_mistake` the learner kept the static feedback-card text already shown (the `staticFallback` text is never displayed for that kind). For `hint` it is the authored hint. Both are rebuilt from the lesson alone. Any **V1** local model must pass the same reproducibility gate before study use; a non-deterministic engine would need the payload consent.

## 5. Pilot versus main study

| Aspect | Pilot | Main study |
|---|---|---|
| Tier | **MVP** | **V1** |
| Sample | 8–12 per group, convenience | 64 per group, stratified random assignment |
| Purpose | Fix tracking thresholds, verify event log reconstructs each attempt, check form equivalence, time the session, confirm the mouse condition has no missing affordances | Test RQ1–RQ3 |
| Analysis | Descriptive only: means, lost fractions, calibration accuracy, item difficulty | Pre-registered plan in 3.4 |
| Ethics | Informed consent and the same data rules; institutional approval if results may be published | Institutional approval required; minors only under separate approval |
| Exit criteria | All items on the pilot checklist in the `research-protocol` skill pass; thresholds frozen; forms frozen; pre-registration filed | Target n reached or recruitment window closed |
| Changes allowed after | Anything, documented in the research-protocol change log | None to instruments, lesson or thresholds without an amendment |

## 6. Event-log schema and instrumentation requirements

### 6.1 Schema

This extends the `research-protocol` schema with the events needed for the metrics above. It is the contract between the vision, scene, engine and tutor layers and the database.

```ts
type LogEvent = {
  sessionId: string;              // random UUID; identity link only via offline consent key
  condition: "gesture" | "mouse";
  seq: number;                    // monotonic per session; detects loss and reordering
  t: number;                      // ms since session start (performance.now based)
  type:
    // engine
    | "activity_start" | "activity_end" | "task_start" | "task_attempt" | "task_end"
    | "hint_shown" | "mastery_computed" | "time_prompt"
    // scene (both conditions)
    | "select" | "grab_start" | "grab_move_summary" | "grab_end" | "place" | "drop" | "scene_reset"
    // vision (gesture condition only)
    | "gesture_emit" | "calibration_prompt" | "tracking_lost" | "tracking_regained"
    | "hand_count" | "misfire_report"
    // tutor
    | "tutor_message"
    // performance (both conditions; inference fields null for mouse)
    | "perf_sample" | "device_info";
  payload: Record<string, string | number | boolean | null>;
};

// payload contracts
// task_start        { taskId, taskType, objectiveId, activityId, activityKind }
// task_attempt      { taskId, taskType, attemptNo, correct, partial, score, hintsUsed, componentId, socketId }
// task_end          { taskId, outcome: "correct" | "incorrect" | "skipped" }
// hint_shown        { taskId, level, source: "static" | "tutor" }   // "tutor" unused in MVP: applyHint always logs "static"; tutor use is read from tutor_message
// mastery_computed  { objectiveId, mastery, threshold }
// time_prompt       { lessonMs, activityId, taskId, choice: "continue" | "assess" }   // once, at 15 min of lesson time
// select            { componentId, hotspotId, method: "grab" | "dwell" | "click" }   // absent id logged as null (M10)
// grab_start        { componentId }            // null = no component hit; orbit if its grab_move_summary.firstMoveMs != null, miss if null (see Orbit use, 2.2); prototype has no orbit
// grab_move_summary { componentId, durationMs, pathLengthNorm, zHintAbsSum, firstMoveMs }   // one per drag, on grab_end; firstMoveMs = int ms from grab_start to first grab_move, null if never moved (added 2026-10-07, M10, false-start rate)
// grab_end          { componentId, reason: "release" | "lost" }   // union owned by doc 04
// place             { componentId, socketId }
// drop              { componentId, cause: "release" | "lost" }   // cause owned by doc 05; position omitted: not needed for any metric
// scene_reset       { taskId }                 // model returned to its initial pose; ends any active grab
// gesture_emit      { gesture, confidence }    // state-machine transitions only, never per frame
// calibration_prompt{ promptNo, expectedGesture, windowMs }
// tracking_regained { durationMs }
// hand_count        { n }
// tutor_message     { interactionId, taskId, kind, hintLevel, status, latencyMs, source }   // exactly these keys, never the text; emitted on every call outcome; enums owned by doc 07 (kind: hint | explain_mistake; status: ok | capped | fallback_invalid from the route, fallback_timeout | fallback_error from the client; source: tutor | static); interactionId: string | null, null on fallback_timeout and fallback_error (usually no ai_interactions row; AbortSignal.timeout aborts only the client, so a slow route can still insert a late row that this event cannot join); latencyMs measured by the client
// perf_sample (5 s) { fps, frameMsP95, inferenceMsP50, inferenceMsP95, e2eMsP50, jitterNorm, delegate, path: "worker" | "main_thread_fallback" | null }
// device_info (once){ gpuTier, cameraWidth, cameraHeight, workerPath: boolean }   // no user agent (dropped 2026-10-29: fingerprinting risk, no metric needs it; perf_sample.delegate and path carry the performance context); gpuTier null in the prototype: no GPU fingerprinting yet; decide before the pilot. Mouse arm: cameraWidth/cameraHeight null, workerPath false and meaningless
```

Rules the schema enforces: no landmark coordinates anywhere; `grab_move` is summarised per drag, not per frame (a cursor trail would reconstruct hand motion and is a privacy and volume problem); neither tutor text nor the `SceneState` request enters the research log; the route handler writes one `ai_interactions` row ([09-database.md](09-database.md)) per call reaching it, capped included, joined to the event log through `tutor_message.interactionId`, and its consent-gated `request_json` and `delivered_text` columns are null in MVP (section 4); `drop` carries no position. The tutor runs inside the `/api/tutor` route handler with no third-party egress ([07-ai-tutor.md](07-ai-tutor.md)), so no tutor data leaves the researcher's own deployment.

### 6.2 What each layer must emit

```mermaid
flowchart LR
  V[Vision worker] -->|gesture_emit tracking_* hand_count perf| L[Event logger]
  S[Scene R3F] -->|select grab_* place drop| L
  G[Learning engine] -->|activity_* task_* hint_shown mastery_computed| L
  A[Tutor client every outcome] -->|tutor_message metadata| L
  M[Mouse adapter] -->|same interaction events| S
  L -->|batch POST every 10 s or 50 events| R["Route handler /api/events"]
  L -->|session end| D[JSON download fallback]
  R --> P[(Postgres event_logs)]
```

| Layer and owner | Must emit | Must not emit | Tier |
|---|---|---|---|
| Vision ([04](04-computer-vision.md), cv-engineer) | `gesture_emit` on every state-machine transition with confidence; `tracking_lost` / `tracking_regained` with duration; `hand_count` on change; `perf_sample` fields `inferenceMsP50/P95`, `jitterNorm`, `delegate`; `calibration_prompt` from the tutorial; `grab_end.reason == "lost"` on grace-period auto-release | landmarks, per-frame gestures, bitmaps | **MVP** |
| Scene ([05](05-3d-interaction.md), three-engineer) | `select` with `method`; `grab_start` with `componentId` or null; `grab_move_summary` once per drag; `grab_end`; `place`; `drop` with `cause` so the engine can skip loss-caused drops; `scene_reset`; `perf_sample.fps`, `frameMsP95`, `e2eMsP50`. A mouse adapter that produces the identical interaction-event stream from pointer and keyboard input, so the scene code has no condition branch | cursor positions per frame | **MVP** |
| Engine ([06](06-learning-engine.md), learning-designer) | `activity_start/end`, `task_start`, `task_attempt` with the full evaluation result, `task_end` with outcome, `hint_shown` with level and source, `mastery_computed` per objective, `time_prompt` with the learner's choice | free-text | **MVP** |
| Tutor ([07](07-ai-tutor.md), ai-tutor-architect) | `tutor_message` with exactly `{ interactionId, taskId, kind, hintLevel, status, latencyMs, source }`, all scalars, emitted by `callTutor` in the lesson client on every outcome: `ok`, `capped` or `fallback_invalid` from the `/api/tutor` reply, and `fallback_timeout` or `fallback_error` (with `interactionId: null`) when the call times out or fails. Usually no `ai_interactions` row exists then, but `AbortSignal.timeout` aborts only the client, so a slow route can still insert a late row that no `tutor_message` joins; analyses count such unjoined rows rather than assume none. `SessionLogger.log` throws on any object-valued payload value, so a nested field cannot reach `/api/events` and reject a batch. Matches [07](07-ai-tutor.md) | message text, `SceneState` payload, `request_json` (the route handler writes `ai_interactions`; its payload columns are null in MVP) | **MVP** |
| App shell ([03](03-system-architecture.md), platform-architect) | `device_info` once; `condition` derived from the pre-assigned session code; `sessionId` as a client-generated UUID that the server validates and records in `research_sessions` before accepting events; batching, retry and the end-of-session download | identity fields | **MVP** |

### 6.3 What the database must store

Requirements on [09-database.md](09-database.md). Table names follow the glossary convention.

| Table | Purpose | Key columns | Tier |
|---|---|---|---|
| `research_sessions` | one row per study session | `id` (= client-generated `sessionId`, validated by the server), `participant_code` (random 6 characters, shown to the learner on the results screen; the key for deletion and export), `assignment_code`, `condition`, `study_phase` (`dev` / `pilot` / `main`; `dev` rows are excluded from every analysis and purged freely, as in [09-database.md](09-database.md)), `consent_version`, `started_at`, `ended_at` (results reached; independent of logging consent), `skipped_task_ids` (for resume), `calibration_accuracy`, `s2_completed` | **MVP** |
| `event_logs` | append-only event stream | `id`, `session_id`, `seq`, `t`, `type`, `payload` JSONB; unique on `(session_id, seq)` | **MVP** |
| `instrument_responses` | tests and questionnaires | `id`, `session_id`, `instrument` (`pre` / `post` / `retention` / `sus` / `tlx` / `satisfaction` / `open`), `form` (A/B/C), `item_no`, `response`, `correct` | **MVP** |
| `consent_records` | proof of consent without identity; kept after withdrawal with `withdrawn_at` set (no foreign key to the deleted session) | `id`, `session_id`, `consent_version`, `consent_logging`, `consent_tutor_payloads` (always false in MVP by user decision 2026-10-30: the consent form does not ask it, so `ai_interactions` payload columns stay null; tutor text is rebuilt as in section 4), `agreed_at`, `withdrawn_at` | **MVP** |
| `users` linkage | optional join from an account to sessions | `research_sessions.user_id` nullable, separable, never required | **V1** |

Constraints: no table holds a name, email or free-text identity. `event_logs.payload` is checked at the route handler by one generic rule (at most 16 keys, scalar values only, strings ≤ 300 characters, no `ua` key); the per-type contracts above are not yet enforced there, and the metrics script tolerates missing keys by returning `null`. Events are accepted only for a session whose consent record has `consent_logging` true and no `withdrawn_at` (403 otherwise).

Deletion and export (roadmap step 4.6, built 2026-10-29), all **MVP**, shared code in `packages/db/src/privacy.ts`:

| Who | Delete | Export |
|---|---|---|
| Participant, from the browser that created the session | `DELETE /api/session/:id` (`:id` must equal the session cookie, else 403) | `GET /api/session/:id/export` (same rule) |
| Researcher, on a participant's request | `pnpm research:delete <participantCode | sessionCode | sessionId>\|<participantCode | sessionCode | sessionId>` | `pnpm research:export <participantCode | sessionCode | sessionId>\|<participantCode | sessionCode | sessionId>` |

Deletion runs in one transaction: it stamps `withdrawn_at` on the consent record, then deletes the `research_sessions` row, which cascades to `event_logs`, `lesson_attempts`, `instrument_responses` and `ai_interactions` ([09-database.md](09-database.md)). The consent record stays as proof that the request was honoured. Export returns those six tables for one session as one JSON document.

`lesson_attempts` is research data, not only resume state. It is written for every consented session whether or not the learner opted in to the event log, because resume depends on it. It holds each graded attempt (task, outcome, score, hints used, duration, the component and socket chosen), so RQ1 task-level outcomes and RQ2 attempt counts exist for every participant; RQ2 process metrics that need the event stream (time to first attempt, orbit use, tracking loss, engagement) exist only for participants who opted in. The consent text discloses this ("your answers in the lesson" are recorded; the action log is the separate opt-in). Analyses report the opt-in rate by condition, because a condition difference in opt-in would bias every event-log metric. For opted-in sessions the event log is the system of record and the metrics script checks that it agrees with `lesson_attempts`.

### 6.4 Logger transport

| Option | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Own route handler + Postgres (Next.js, Neon/Supabase free tier) | Full schema control, deletion by key, no third party sees data, fits locked positions 1 and 9 | Must write batching and retry | Good; ~200 lines | **Recommended, MVP** |
| Third-party analytics (PostHog, Mixpanel) | Dashboards for free | Data leaves to a processor; consent text and ethics approval become harder; custom schema fights the tool | Easy but wrong for research data | Rejected |
| Local JSON download only | Zero backend | Researcher collects files by hand; loss if browser closes; no S2 linkage | Fine as fallback | **MVP fallback** at session end |

Eight-point check: appropriate because events are small (1–3 k per session) and the backend exists anyway; limited by free-tier connection caps, hence batching; negligible browser cost (one `fetch` per 10 s, `sendBeacon` on unload); no accessibility impact; privacy-positive since data stays in the researcher's own Postgres; scales to thousands of sessions untouched; low complexity; necessary because a study without reliable logs is not a study, with download-only kept as the simpler fallback.

## 7. Ethics, consent and data minimisation

These are design requirements that [15-risks-security-scalability.md](15-risks-security-scalability.md) references for its privacy and student-data sections.

| Requirement | Specification | Tier |
|---|---|---|
| No video storage | Frames go `getUserMedia → ImageBitmap → worker → discard`. Nothing is written to disk, IndexedDB, canvas capture or network. Verified (doc 12 A20) by `apps/web/lib/privacy.test.ts`: a static scan that allows network calls only from four named files and finds no `indexedDB`, `MediaRecorder`, `captureStream` or canvas export anywhere in the app and packages; and a scripted drag with tracking loss run through the real logger and transport with `fetch` and `sendBeacon` intercepted, asserting that every body is scalar JSON with no landmark-like key or number array, and that nothing is sent without logging consent. **V1**: full-page interception of a live lesson (Playwright) | **MVP** |
| Landmarks never persisted | Landmarks are computed in the worker. For the learner's own preview only, the lesson page asks the worker (`showHands`) to post each frame's landmarks to the main thread, where `camera-preview.tsx` draws them over the video and drops them; they never reach the lesson state, the logger or the network, and are gone by the next frame. The logger type system has no landmark field and the route handler accepts scalar payloads only. The calibration tutorial and jitter metric compute derived scalars in the worker | **MVP** |
| Pseudonymous session key | `sessionId` is a client-generated UUID, validated (format, uniqueness) and recorded by the server on first contact. The link to a person (consent form, S2 contact) is a paper or offline encrypted key held by the researcher, never stored in the app or database | **MVP** |
| Consent before camera | `/consent` shows the versioned text (`CONSENT_VERSION = "pilot-v1"` in `apps/web/lib/consent.ts`, from the `research-protocol` skeleton) before the lesson page, which is the only study page that opens the camera (the developer page `/prototype` also opens it without consent, so production builds answer 404 there), and only when the learner presses "Start camera". Agreeing to take part is required; logging the action log is a separate checkbox, unticked by default. Without it the client drops every event and `/api/events` refuses them (403). Agreeing creates the session and its consent record in one transaction. Declining shows a plain exit screen and stores nothing. A lesson URL opened without a consented session redirects to `/consent` | **MVP** |
| Visible camera status | Camera preview thumbnail and a tracking-active indicator are always on screen; a one-key camera-off control stops the stream and ends tracking immediately (UX in [11-ui-ux.md](11-ui-ux.md)) | **MVP** |
| Deletion on request | The participant code is shown on the results screen; the consent text tells the participant to quote it. The researcher runs `pnpm research:delete <code>` with that code, or with the session code they assigned (e.g. `PG-014`) when the participant stopped before the results screen; the participant's own browser can also call `DELETE /api/session/:id`. Both delete every research row and keep the consent record with `withdrawn_at` (6.3). Confirmation returned within 7 days | **MVP** |
| Export on request | `pnpm research:export <code>` for the researcher, `GET /api/session/:id/export` for the participant's own browser; one JSON document of the six tables (6.3) | **MVP** |
| Retention period | Logs and instrument responses retained 5 years after publication, then deleted; stated in the consent form | **MVP** |
| Institutional approval | Required before any data intended for publication is collected; a hobby pilot with friends still uses the full consent form and data rules | **MVP** |
| Minors | Parental consent plus child assent, separate approval, age-appropriate consent text; not before **V1** | **V1** |
| Tutor payload minimisation | Tutor requests carry `SceneState` and task context only (see [07-ai-tutor.md](07-ai-tutor.md)); no identity, no learner free text in MVP. The request is served by the `/api/tutor` route handler in the researcher's own deployment with no third-party egress; `request_json` would be stored in `ai_interactions` only under `consent_tutor_payloads`, which MVP never asks, so it is always null. The tutor is on in both arms; `?tutor=off` is a developer URL flag, not a study condition, and is not recorded per session | **MVP** |
| Data residency | Postgres region chosen in the participant's jurisdiction where the provider allows; stated in the ethics application | **V1** |

The consent text skeleton in the `research-protocol` skill is the baseline; the final wording is set by the approving institution.

## 8. What the MVP must contain for the pilot to be runnable

| Item | Owner doc | Tier |
|---|---|---|
| Consent screen with version stamp, shown before camera permission. Built 2026-10-29 (step 4.6), section 7 | 11, 03 | **MVP** |
| Condition selection by pre-assigned session code (researcher types the code from the offline randomisation list; app derives `condition`, generates the `sessionId`, records both). Built 2026-10-29 (step 4.6), section 3.2 | 03 | **MVP** |
| Calibration tutorial with 20 scripted prompts emitting `calibration_prompt` and `gesture_emit`; mouse equivalent with 20 click-and-drag prompts for timing parity | 04, 11 | **MVP** |
| Mouse adapter producing the identical interaction-event stream | 05 | **MVP** |
| Event logger with batching, `seq`, `sendBeacon` on unload, and end-of-session JSON download | 03 | **MVP** |
| Route handler validating payloads and writing to `event_logs` (generic scalar check built; per-type contracts pending, to add before the pilot freezes the payload contract) | 03, 09 | **MVP** |
| In-app pre/post test, SUS, TLX, satisfaction screens writing to `instrument_responses`, with form A/B/C selectable | 11 | **MVP** |
| Online retention test page keyed by `sessionId` | 11 | **MVP** |
| Three 15-item knowledge forms, piloted for equivalence | research materials, Phase E | **MVP** |
| Delete and export, by the participant's own cookie (`sessionId`) and by the researcher (`participant_code`). Built 2026-10-29 (step 4.6), section 6.3 | 03, 09 | **MVP** |
| Soft time prompt at 15 min of lesson time offering the choice to proceed to the assessment, emitting `time_prompt`; no hard cap; assessment always runs in full | 06 | **MVP** |
| A metrics script that reads `event_logs` and `instrument_responses` for one session and prints every metric in section 2; this is the test that the log "reconstructs each attempt without ambiguity". Built 2026-10-29 (step 4.7): `pnpm research:metrics`, with the simplifications and checks in section 2.5 | Phase E | **MVP** |

Not needed for the pilot: accounts, dashboards, `misfire_report`, data-residency controls, parental consent flow.

## Open questions

1. Resolved 2026-10-04 (user decision): an institutional review is available to the researcher; consent wording follows that institution's template once obtained.
2. Resolved 2026-10-04 (user decision): 64 per group is feasible for the researcher's recruitment pool; the pre-registration keeps the planned sample.
3. Resolved 2026-10-04: the mouse calibration tutorial matches the gesture tutorial in prompt count and duration (same 20 prompts, mouse actions) so session length is a constant across arms.

## Related

- [04-computer-vision.md](04-computer-vision.md): gesture state machine, tracking-lost grace period, CV events this doc consumes.
- [05-3d-interaction.md](05-3d-interaction.md): interaction-event vocabulary, SceneState snapshot, mouse adapter requirement.
- [06-learning-engine.md](06-learning-engine.md): task evaluation and mastery rule that produce `task_attempt` and `mastery_computed`.
- [07-ai-tutor.md](07-ai-tutor.md): tutor payload minimisation and `tutor_message` metadata.
- [09-database.md](09-database.md): the research tables and the `DELETE /api/session/:id` and export endpoints.
- [11-ui-ux.md](11-ui-ux.md): consent, camera-status and instrument screens.
- [12-mvp-definition.md](12-mvp-definition.md): pilot-readiness items in section 8 are MVP scope.
- [15-risks-security-scalability.md](15-risks-security-scalability.md): privacy and student-data challenges reference section 7.
