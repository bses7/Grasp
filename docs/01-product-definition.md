# Product Definition

Grasp is a browser-based learning system in which a learner's hand gestures, read from an ordinary webcam, manipulate 3D educational models, and every manipulation is evaluated against a declared learning objective. This file defines the product: vision, problem, users, the learning-science case for and against gesture-controlled 3D, the differentiator, the learning philosophy, use cases, and one worked session on the heart lesson. It mostly concerns **MVP**; target users and use cases are also tagged **V1** and **Future**.

## Assumptions in the brief that this document does not accept uncritically

| Assumption in the brief | Position | Consequence for this document |
|---|---|---|
| Gesture control is inherently more educational than a mouse | Unproven. Embodied-cognition effects are real but small and task-dependent; gesture input also adds motor and tracking load. | Educational value is argued as a hypothesis; the mouse condition in the study (locked position 8) is treated as a first-class product feature, not a control afterthought. |
| Thirteen listed subjects can share one platform | Partly. Subjects whose learning is *spatial assembly, identification, or ordering of parts* fit the five task types. Sign language, laboratory procedure, and architecture need different evaluation primitives. | **MVP** is one subject. **V1** adds subjects that fit the existing schema without new task types. Sign language is **Future** and probably a different product. |
| An AI tutor is needed in the MVP | Not needed to validate the core loop. Static hints in lesson JSON cover levels 1–3. The tutor is useful once learners get stuck in ways the author did not anticipate. | Tutor is **MVP** in the product definition because the brief and locked position 7 require it, but it is excluded from the smallest viable prototype and gated behind a feature flag so the study can run with it off. |
| Gamification helps learning | Weak and mixed evidence; points and badges reliably raise short-term engagement, not retention, and can crowd out intrinsic motivation. | Rewards in [08](08-gamification.md) must derive from mastery and never feed back into it. XP is **V1** except for a progress indicator. |

## Product Vision

A learner opens a web page, grants camera access, and within a minute is pinching a 3D heart chamber out of place and putting it back where it belongs. The system knows whether the placement was right because the lesson author declared, in data, which component belongs in which socket. The learner's hands are the input device; the model is the worksheet; the feedback is immediate and specific to the action taken.

The long-run vision (**Future**) is a content format, not an app: any subject whose knowledge can be expressed as *parts, where they go, and in what order* can be authored as a model manifest plus lesson JSON and taught through the same engine. The near-run vision (**MVP**) is one heart lesson that demonstrates the loop end to end and produces publishable evidence about whether gesture input helps.

## Problem Statement

| Problem | Who has it | Why existing tools fall short |
|---|---|---|
| Spatial anatomy is learned from flat diagrams, so learners memorise a canonical view and cannot recognise the structure from another angle or in a specimen | Secondary and first-year health-science students | Textbooks and slide decks are 2D; most quiz tools test recall of labels, not spatial relations |
| Interactive 3D viewers exist but do not teach: the learner rotates and reads, with no task, no evaluation, no feedback on action | Same learners; teachers who assign the viewer and get no evidence back | Viewers are reference tools. Adding a quiz alongside them tests recall, not manipulation |
| Physical models and dissection give manipulation but are expensive, scarce, and give no feedback unless an instructor is present | Schools and colleges with limited lab time | Cost and supervision do not scale to homework |
| Evidence on whether embodied interaction improves learning is thin and confounded with "3D" and "novelty" | Researchers in learning science and HCI | Most studies compare 3D to 2D, not gesture to mouse on an identical 3D task |

The core problem Grasp addresses is the second row: 3D learning content that cannot evaluate what the learner does with it. Gesture input is the chosen interaction modality and the research question, not the problem being solved.

## Target Users

Narrow for **MVP**, widen only after the loop is validated.

| Segment | Tier | Who | What they need from the product | What they do not need yet |
|---|---|---|---|---|
| Late-secondary biology learner (16–18) | **MVP** | Studying circulatory anatomy for a school qualification; has a laptop with webcam; no account | One 12-minute lesson that works first time in a bedroom with a window behind them | Accounts, progress across lessons, badges |
| First-year undergraduate biology or nursing learner | **MVP** | Needs chamber, vessel, and blood-path knowledge before practicals | Same lesson; honest mastery report; a mouse fallback when tracking fails | Clinical depth, valves, pathology |
| Developer-researcher (the user) | **MVP** | Builds the platform alone; runs the gesture-vs-mouse study | Deterministic evaluation, event logs, consent flow, identical lesson under both conditions | A teacher dashboard |
| Study participant (16+) | **MVP** | Recruited for the study; may be any of the above | Consent screen, visible camera indicator, a way to delete their data | Anything beyond the one lesson |
| Secondary and tertiary teacher | **V1** | Assigns lessons; wants to see who mastered what | Class view of per-objective mastery; lesson library across a few subjects | Authoring tools |
| Lesson author (subject specialist) | **V1** | Writes manifests and lesson JSON for a new model | Validation tooling from the `lesson-schema` checklist; authoring documentation | A visual editor |
| Vocational and industrial trainee | **Future** | Learns assembly and disassembly of equipment | `remove` and `sequence` tasks on engineering models; possibly two-hand gestures | |
| Learners under 16; learners with motor impairments as a primary audience | **Future** | | Parental consent flow; input alternatives designed with them | |

Explicitly not a target in any tier: casual consumers looking for a 3D encyclopaedia. That is a viewer, which the guiding principle excludes.

## Educational value: why CV-controlled 3D could beat 2D, and where it may not

The honest claim is: *3D manipulation with action-level feedback should outperform 2D label recall for spatial anatomy; whether gesture input adds anything over a mouse is the open question the study exists to answer.*

### Mechanisms the design relies on

| Mechanism | What the literature says | How Grasp applies it | Strength of evidence | Tier |
|---|---|---|---|---|
| Embodied cognition and gesture congruence | Learning improves when the physical action is congruent with the concept (for example tracing a path to learn a sequence), more than when motion is incidental. Effects are moderate in lab studies, smaller in classrooms | `sequence` task for the blood path requires selecting chambers in flow order; `place` tasks move the vessel to where it attaches | Moderate for congruent gesture; thin for webcam-tracked hands specifically | **MVP** hypothesis |
| Dual coding | Paired verbal and spatial representations are recalled better than either alone | Every component has a name, a description, and a 3D location; hotspots pair text with a place on the mesh | Strong | **MVP** |
| Generative learning (enacting, self-explaining) | Learners who produce something (reassemble, order, explain) retain more than those who view the same material | The `challenge` activity exploded pose forces reassembly from memory; tutor prompts ask the learner to explain a wrong placement | Strong for enacting; moderate for self-explanation prompts | **MVP** |
| Retrieval practice | Low-stakes recall attempts beat restudy for retention | `assessment` activity has 1 attempt, no hints, no sockets visible; one-week retention test in the study | Strong | **MVP** |
| Worked examples and faded guidance | Novices learn more from guided examples; guidance should fade as competence rises (expertise-reversal effect) | `guided` shows ghost sockets and three hint levels; `challenge` shows rings only and one hint; `assessment` shows nothing | Strong | **MVP** |
| Cognitive load management | Learning suffers when working memory is spent on the interface rather than the content | Five gestures only; one object grabbed at a time; feedback at the object, not in a separate panel | Strong principle; the gesture modality itself is the load risk (below) | **MVP** |
| Spatial-ability compensation | Interactive 3D helps learners with lower spatial ability more than higher, in some meta-analyses; others find the reverse for uncontrolled rotation | Orbit is constrained (one axis pair, snapped home view); the study records a short spatial-ability measure as a covariate if time allows | Mixed | **V1** analysis |

### Where 3D over 2D is likely to help

- Relations that are occluded in any single 2D view: the left atrium sits behind the aorta and pulmonary artery; the septum is only visible with chambers removed.
- Transfer to a different view or a physical specimen, because the learner has encoded the object, not one picture of it.
- Feedback on the *action*: "right part, wrong socket" is a diagnosis a label quiz cannot make.

### Honest caveats

| Caveat | Why it matters | Mitigation and who tests it |
|---|---|---|
| Gesture input may add extraneous load | Holding an arm up, maintaining a pinch, and coping with tracking jitter use working memory that should go to anatomy | NASA-TLX in both conditions; tracking-lost seconds logged as a predictor (RQ3 in `research-protocol`); the mouse condition is the comparison |
| Novelty effect | First exposure to gesture control is engaging regardless of learning | One-week retention test; a 5-minute calibration tutorial before the lesson to burn off some novelty |
| Confounding 3D with gesture | Most prior studies did not separate them | Identical lesson JSON, model, tutor, and feedback under both input conditions; only the input layer differs |
| Spatial ability ceiling | Learners with high spatial ability may gain little from any 3D treatment | Pre-test stratification; report subgroup effects as exploratory |
| Single lesson, single domain | Results will not generalise beyond heart chambers without replication | Stated as a limitation in [14](14-evaluation-methodology.md); **V1** adds a second lesson |

## Key differentiator

The learner's 3D action is the answer. The learning engine compares `{componentId, socketId}` or an ordered list of `select` events to an expectation in lesson JSON and returns correct, partial, or incorrect with the expected and actual values. No multiple-choice overlay, no AI grading, no "did you look at it long enough".

| Category | Representative products | What they evaluate | What Grasp evaluates instead | Tier of our advantage |
|---|---|---|---|---|
| 3D anatomy viewers | Complete Anatomy, Visible Body, BioDigital | Mostly nothing; some bolt on label quizzes | The placement, selection, or ordering act itself | **MVP** |
| LMS quizzes | Moodle, Google Forms | Recall of text labels | Spatial correctness with partial credit for right part, wrong place | **MVP** |
| VR anatomy labs | Headset-based dissection apps | Varies; often free exploration | Same class of evaluation but with a webcam and no headset cost | **MVP** |
| Gesture demos | MediaPipe showcase apps | Nothing; interaction is the end | Interaction is the means; every gesture serves a task | **MVP** |
| Teacher-led physical models | Plastic hearts, dissection | The instructor evaluates | Deterministic evaluation available at home, with logs | **MVP**, class view **V1** |

Secondary differentiators: the content format is subject-neutral (**V1**), the AI tutor reasons over structured scene state rather than video (**MVP**, privacy by construction), and the product doubles as an instrumented research apparatus (**MVP**).

## Core learning philosophy

The brief's philosophy maps one-to-one onto activity kinds in the `lesson-schema` and onto a learning mechanism.

| Philosophy stage | Activity kind | What the learner does | Mechanism | Evidence captured | Tier |
|---|---|---|---|---|---|
| Learn by seeing | `introduction` | Reads three narration cards; orbits the assembled heart with `pinch_drag` on empty space | Dual coding; orientation | `activity_start`, `activity_end`, orbit count | **MVP** |
| Interact by doing | `explore` | Hovers with `point`; reads hotspots `hs_lv_wall`, `hs_septum` | Dual coding; pre-training of names before tasks | Hotspots viewed | **MVP** |
| Experiment | `guided` | `identify` and `place` with ghost sockets and hints | Worked example, faded guidance | `task_attempt` with outcome, hints used | **MVP** |
| Receive feedback | every task | Sees correct, partial, or incorrect at the object, with expected versus actual | Immediate, action-level feedback | `task_attempt.feedback` | **MVP** |
| Understand | `challenge`, tutor | Reassembles from the exploded pose; orders the blood path; may press "Explain" to have the tutor explain the last wrong attempt | Generative learning; self-explanation | `task_attempt`, `tutor_message` | **MVP** (tutor flag-gated) |
| Demonstrate knowledge | `assessment`, `mastery` | One attempt per task, no hints, no sockets shown; sees per-objective mastery | Retrieval practice; transfer | Mastery per objective | **MVP** |

The ordering is fixed in the MVP lesson. **V1** allows an author to repeat `guided` → `challenge` cycles for longer lessons.

## Major use cases

Every use case names the objective it serves and the 3D action that is evidence of it. "Explore the model" is not a use case; it is a scene state that other use cases occur in.

| ID | Use case | Learning objective (Bloom) | Task type | 3D action evidencing it | Evaluation | Tier |
|---|---|---|---|---|---|---|
| UC1 | Name a chamber on request | `obj_identify_chambers` (remember) | `identify` | `point` hover dwell 600 ms or `pinch` on `left_ventricle`, emitting `select` | `componentId` equals expected | **MVP** |
| UC2 | Attach a great vessel where it belongs | `obj_place_vessels` (apply) | `place` | `pinch` `aorta`, `pinch_drag` to `socket_aorta`, `release`; scene emits `place` | `componentId` and `socketId` both match; partial if only the component matches | **MVP** |
| UC3 | Rebuild the heart from parts | `obj_identify_chambers` (apply level of the same objective) | `place` ×4 | Four `place` events from the exploded pose into chamber sockets with rings only | Per task as UC2 | **MVP** |
| UC4 | Order the blood path | `obj_blood_path` (analyze) | `sequence` | `select` `right_atrium` → `right_ventricle` → `left_atrium` → `left_ventricle` | Ordered match, `strictOrder: true` | **MVP** |
| UC5 | Judge a structural difference | `obj_identify_chambers` (understand) | `compare` | `select` one of `left_ventricle`, `right_ventricle` for `wall_thickness` | Equals `answer` | **MVP** |
| UC6 | Detach a part to reveal what is behind it | valves objective in `anatomy.heart.valves_v1` (apply) | `remove` | `pinch` `aorta`, drag away, `release` off-socket, emitting `drop` away from `socket_aorta`; `septum` becomes visible | `socketId` not equal to `awayFromSocketId` | **V1** (second lesson) |
| UC7 | Recover from tracking loss without losing work | Not a learning objective; a precondition for all of the above | any | `tracking_lost` while `pinch_drag`; grabbed component held 1 s, then auto-released off-socket; learner resumes | No `place` is ever emitted on loss | **MVP** |
| UC8 | Complete the identical lesson with a mouse | Research control; accessibility | all | Click equals `select`, click-drag equals `pinch_drag`, mouse-up equals `release` | Identical lesson JSON and engine | **MVP** |
| UC9 | Run a study session | RQ1–RQ3 in `research-protocol` | all | Consent, condition assignment, lesson, logs exported as `LogEvent[]` | Not applicable | **MVP** |
| UC10 | Assemble a water molecule | chemistry bonding objective (apply) | `place`, `sequence` | `place` `hydrogen_1`, `hydrogen_2` onto bond sockets of `oxygen` | As UC2 and UC4 | **V1** |
| UC11 | Disassemble and reassemble an engine | mechanical assembly objective (analyze) | `remove`, `sequence` | Ordered `drop` and `place` events on `piston`, `crankshaft`, valves | Ordered match | **V1** |
| UC12 | Review a class's mastery | Teacher goal, not a learner objective | none | None; reads aggregated mastery | Not applicable | **V1** |
| UC13 | Produce a sign | Sign-language production objective | none that exists | Hand shape matched to a reference pose | Needs pose matching, not scene events | **Future**; likely a separate product |

## Example learning session

Learner: first-year nursing student, gesture condition, laptop with 720p webcam, lesson `anatomy.heart.chambers_v1` from the `lesson-schema` reference. Times are indicative.

| Time | Activity | What happens | Scene events | Engine result |
|---|---|---|---|---|
| 0:00 | Pre-lesson | Consent screen; camera preview with tracking indicator; 5-minute calibration tutorial (open palm, point, pinch a practice cube into a ring) | `hand_count`, `perf_sample` | None |
| 0:00 | `act_intro` | Three narration cards. Learner orbits with `pinch_drag` on empty space. Completion after 20 s | `activity_start`, `activity_end` | None |
| 0:20 | `act_explore` | Learner hovers `point` over `left_ventricle`; `hs_lv_wall` label appears; reads "about three times thicker". Hovers `septum`, reads `hs_septum`. Completion at 60 s | `select` on two hotspots | None |
| 1:20 | `act_guided` t_g1 `identify` "Point to the left ventricle" | Learner dwells on `right_ventricle` (learner's left, a common mirror error) | `select right_ventricle` | Incorrect. Hint 1: "It is one of the two lower chambers." `hintsUsed = 1` |
| 1:45 | t_g1 attempt 2 | Learner dwells on `left_ventricle` | `select left_ventricle` | Correct. Score 10 − 1×2 = 8 |
| 2:00 | t_g2 `identify` "Point to the right atrium" | Correct first time | `select right_atrium` | Correct, 10 |
| 2:15 | t_g3 `place` "Pinch the aorta and attach it" | `aorta` starts detached beside the heart. Learner pinches, drags; depth is held on the camera-facing plane; releases beside `socket_pulmonary_artery`, which accepts both great vessels, so the aorta snaps there and stays. Banner: "Right part, wrong place"; the socket is flagged | `grab_start`, `grab_move` ×n, `place aorta socket_pulmonary_artery` | Partial (right component, wrong socket), score 5. Hint 1: "The aorta leaves from the left ventricle at the top." `hintsUsed = 1` |
| 2:50 | t_g3 attempt 2 | Learner re-grabs `aorta` out of the wrong socket, releases at `socket_aorta` | `place aorta socket_aorta` | Correct. 15 − 1×3 = 12 |
| 3:10 | `act_challenge` t_c1–t_c4 `place` | Exploded pose, rings only. `left_ventricle`, `right_ventricle`, `right_atrium` correct first time. `left_atrium` released too far from any ring; it settles where dropped | Three `place` events, one `drop left_atrium` | 10, 10, 0 (incorrect, hint 1 shown), 10 |
| 5:00 | t_c3 attempt 2 | Learner re-grabs `left_atrium`, releases inside the `socket_left_atrium` ring | `place left_atrium socket_left_atrium` | Correct, 10 (no `hintPenalty` on this task) |
| 5:30 | t_c5 `sequence` blood path | Learner selects `right_atrium`, then `left_atrium`, skipping the right ventricle | `select right_atrium`, `select left_atrium` | Incorrect at step 2. Hint 1: "Blood from the body arrives on the right side first." `hintsUsed = 1` |
| 5:50 | Tutor (flag on) | Learner presses the "Explain" pill. The HUD sends the last `task_attempt` and the scene state to `/api/tutor` in one same-origin round trip; the template engine ([07 worked example 6](07-ai-tutor.md#worked-examples)) returns the level-2 text: "The order broke at step 2: the Left Atrium does not follow the Right Atrium. The Right Atrium connects directly to the part you need; follow the flow one step on." | `tutor_message { kind: "explain_mistake", hintLevel: 2, source: "tutor" }` | None; tutor never grades |
| 6:10 | t_c5 attempt 2 | `right_atrium` → `right_ventricle` → `left_atrium` → `left_ventricle` | Four `select` events | Correct, 20 |
| 7:30 | `act_assess` t_a1–t_a4 | Assembled pose, no sockets visible, no hints, 1 attempt each. `identify right_ventricle` correct; `identify left_atrium` correct; `place pulmonary_artery` correct; `compare` thicker wall: `left_ventricle` correct | `select`, `place`, `select` | 10, 10, 15, 10 |
| 10:30 | `act_mastery` | Per-objective mastery shown (below). Next lesson unlocked | `activity_end` | Mastery computed |
| 11:00 | Post-lesson (study) | Post-test, SUS, NASA-TLX; retention test link for +7 days | None | None |

Mastery, computed as the weighted mean of the latest score fraction per task with assessment tasks weighted 2×:

| Objective | Tasks and latest fraction | Weighted mean | Threshold | Result |
|---|---|---|---|---|
| `obj_identify_chambers` | t_g1 0.8, t_g2 1.0, t_c1 1.0, t_c2 1.0, t_c3 1.0 (latest attempt), t_c4 1.0, t_a1 1.0 ×2, t_a2 1.0 ×2, t_a4 1.0 ×2 | (5.8 + 6.0) / 12 = 0.98 | 0.80 | Mastered |
| `obj_place_vessels` | t_g3 0.8, t_a3 1.0 ×2 | 2.8 / 3 = 0.93 | 0.80 | Mastered |
| `obj_blood_path` | t_c5 1.0 | 1.0 | 0.70 | Mastered, on one task; the mastery screen says so |

Under the mouse condition the session is identical except that `pinch_drag` is click-drag and dwell-select is a click. The same `LogEvent` stream is produced, which is what makes the two conditions comparable.

## Open questions

1. Resolved: the tutor is on for both arms in the pilot, with the `tutorEnabled` flag recorded per session ([12 open questions](12-mvp-definition.md#open-questions)). The template engine is deterministic, so identical mistakes produce identical text in both arms.
2. Is a second lesson (`anatomy.heart.valves_v1`) **V1** or late **MVP**? The mastery screen references it, so a placeholder "coming soon" is needed if it stays **V1**.

## Related

- [00 Executive summary](00-executive-summary.md): hardest problems and smallest prototype.
- [02 Learning experience](02-learning-experience.md): the thirteen journey stages and seven failure states that the use cases above pass through.
- [06 Learning engine](06-learning-engine.md): the evaluation rules the example session relies on.
- [07 AI tutor](07-ai-tutor.md): the tutor's scope and the flag that disables it.
- [08 Gamification](08-gamification.md): rewards that derive from mastery.
- [12 MVP definition](12-mvp-definition.md): exact scope and exclusions.
- [14 Evaluation methodology](14-evaluation-methodology.md): the study that tests the educational-value hypothesis.
