# Gamification

Gamification in Grasp is a thin layer that makes mastery and effort visible. Every reward is computed from attempt scores, per-objective mastery, and effort events produced by the [learning engine](06-learning-engine.md); no reward ever changes a score, a mastery value, or what learning content is available. This file mostly concerns **V1**: the MVP ships mastery levels and a progress view only, because the research study ([14](14-evaluation-methodology.md)) needs both conditions to see an identical, minimal reward layer and the brief's own roadmap places gamification at Phase 6.

## The one rule

```text
reward      = f(attempt scores, mastery, effort events)        // one-way
unlock(lesson) = all prerequisite objectives mastered           // reads mastery only
mastery     never reads XP, levels, badges, or quests
```

No content of any kind (lessons, activities, hotspots, poses, hints, the tutor, cosmetics) sits behind a reward; cosmetic unlockables are rejected ([Open questions](#open-questions)). If a mechanic below cannot be expressed as a pure function of engine events, it is rejected.

## The ten mechanics considered

| Mechanic | Learning behaviour reinforced | Risk | Decision | Tier |
|---|---|---|---|---|
| XP | Completing tasks and persisting through remediation; gives a visible running total within a lesson | Extrinsic reward crowding out interest; grinding easy tasks for points | Keep, derived only from task scores ([XP ledger](#xp-ledger)); never spent, never gates | **V1** |
| Levels | A coarse summary of cumulative XP so long-term effort is visible across lessons | Levels read as rank; learners compare and the slow condition in the study feels penalised | Keep as cosmetic titles only, not computed for study sessions | **V1** |
| Badges | Evidence of mastery on a specific objective, or a specific productive behaviour (recovering after remediation, revisiting a weak objective) | Badge-hunting; a "no hints" badge teaches hint avoidance | Keep a small fixed set tied to mastery and recovery; reject any badge for speed or hint avoidance | **V1** |
| Streaks | Daily return | Loss aversion drives compulsive check-ins, not learning; a missed day punishes | Reject as daily streaks. The return-visit goal is met by review quests, which are driven by content due for retrieval, not by a counter | Rejected |
| Challenges | Harder variants of mastered content | Name collision: `challenge` is already an activity kind in the glossary | Reject as a separate mechanic; the challenge activity and difficulty levers in [06](06-learning-engine.md#difficulty-levers-that-are-content-only) already do this | Rejected |
| Achievements | One-off milestones: first lesson mastered, all heart objectives mastered | Indistinguishable from badges; two systems to maintain | Merge with badges into one `achievements` table ([09](09-database.md)); the word "achievement" is the storage name, "badge" the UI name | **V1** |
| Unlockable content | Progression feeling | If learning content is unlocked by XP, a struggling learner is locked out of exactly what they need | Learning content unlocks by mastery only (engine rule, **MVP**). Cosmetic unlockables (HUD accent colours, hand-cursor styles) were considered and are rejected (2026-10-30, see [Open questions](#open-questions)) | **MVP** rule; cosmetics rejected |
| Progress maps | Seeing which objectives are mastered, developing, or untouched across lessons; supports self-regulated choice of what to review | A map that shows locked nodes as a path can feel like a gate even when it is mastery-driven | Keep as a mastery visualisation; MVP is a per-objective list in the mastery activity, V1 is a topic map | **MVP** list, **V1** map |
| Mastery levels | Communicates distance to the threshold so the learner knows what to retry | Labels can feel like grades | Keep; bands on the engine's mastery number, no extra computation | **MVP** |
| Quests | Retrieval practice: a short, generated review of weak or ageing objectives | Could become busywork if generated too often | Keep as review quests generated deterministically from mastery and age; at most one offered per day | **V1** |

Not in the brief's list but considered: leaderboards (rejected, see anti-patterns), and a tutor-praise channel (rejected; the tutor explains, it does not reward).

## Mastery levels

Bands on the per-objective mastery value from the engine. The engine computes the number; this layer only labels it.

| Band | Condition | Learner sees | Tier |
|---|---|---|---|
| Not started | no attempts on the objective's tasks | grey | **MVP** |
| Developing | mastery < 0.5 | "Keep practising". **MVP**: the Review list names missed tasks, and in dev sessions only a "Review the parts you missed" button pulses their components (it is offered whenever any graded task was missed, in any band). Re-offering the objective's explore and guided activities is **V1**, for `learner` sessions only; never in pilot or study sessions, per [06 results](06-learning-engine.md#progress-mastery-and-the-separation-from-xp) | **MVP** |
| Approaching | 0.5 ≤ mastery < `masteryThreshold` | "Nearly there"; the specific failed tasks named | **MVP** |
| Mastered | mastery ≥ `masteryThreshold` | green; prerequisite satisfied for dependent lessons | **MVP** |
| Retained | Mastered again in a review quest ≥ 7 days later | gold outline | **V1** |

"Retained" is the band that justifies quests: it rewards spaced retrieval, which is the behaviour most strongly associated with durable learning and the one the one-week retention test in the study measures.

## Event to reward table

All inputs are `lesson_attempts` rows, `progress` rows, and engine outputs from [06](06-learning-engine.md) (mastery, `isLessonMastered`). Event names in the first column are labels for the moment a row is written; rewards never read `event_logs` ([Inputs](#inputs)). Nothing here writes back.

| Engine event (label) | Reward | Rule | Tier |
|---|---|---|---|
| `task_attempt` with `correct: true` | XP = `score` | Score already includes hint penalties; no second penalty | **V1** |
| `task_attempt` with `partial: true` | XP = `score` | Partial credit is already in the score | **V1** |
| `task_attempt` after remediation, correct | XP = `score`, no bonus; badge `recovered:<objectiveId>` | An XP bonus would pay a fail-then-recover learner more than a first-try learner, since the retry already scores up to `scoring.correct`. Recovery is recognised by the badge only | **V1** |
| `activity_end` for explore with every hotspot viewed | XP 5 effort | Rewards reading the model before being tested; capped once per activity. Deferred: hotspot views exist only in the consent-gated `event_logs`, which rewards may not read ([V1 reward spec](#v1-reward-spec)) | Deferred |
| `hint_shown`, `tutor_message` | 0 | Help-seeking is neither rewarded nor punished here | **V1** |
| Objective reaches Mastered | badge `mastered:<objectiveId>` | One per objective, ever | **V1** |
| All objectives of a lesson Mastered | achievement `lesson:<lessonId>`; next lesson unlocked by the engine rule, not by this row | The unlock is mastery-driven and would happen without the achievement | **MVP** unlock, **V1** achievement |
| Objective reaches Retained | badge `retained:<objectiveId>` | Requires a review quest attempt ≥ 7 days after first mastery | **V1** |
| Task failed after second exhaustion | 0 XP, no loss | Nothing is ever subtracted | **V1** |
| Cumulative XP crosses a threshold | level title only | Thresholds in a config file, not in lesson JSON ([values](#xp-and-levels)) | **V1** |

## Review quests

A quest is a generated mini-lesson, not authored content: the generator picks up to three objectives that are Approaching, or Mastered more than seven days ago without a Retained band, and assembles their assessment-kind tasks into a single activity with `maxAttempts: 1`, `hints: []`, sockets hidden. Quest attempts are real `task_attempt` events, so they update mastery exactly like any assessment task. The quest is offered on the progress map at most once per day and can be ignored without penalty.

| Option for driving return visits | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Daily streak counter | Simple, familiar | Rewards showing up, not learning; punishes absence | High | Rejected |
| Review quests from mastery age | Each return is retrieval practice on content due for review | Needs a scheduler and a generator (~150 lines) | Medium | **Recommended, V1** |
| Push or email reminders | Reaches absent learners | Needs contact details and consent; operational cost | Low | **Future** |

Eight-point check for review quests: appropriate because retrieval practice is the strongest evidence-based mechanic available; limited because it only works once more than one lesson's worth of objectives exists; negligible browser cost (it reuses the engine); accessibility-neutral; privacy-neutral (uses stored attempts, nothing new); scales with lessons; a solo developer can build the generator in a day; it is necessary only in V1, which is why the MVP ships without it.

## Research consideration

During study sessions (locked position 8) the reward layer is reduced to the **MVP** set: mastery bands and the per-objective progress list. XP, levels, badges, and quests are not computed for study sessions ([Study-flag rule](#study-flag-rule)), so that neither condition receives a differently paced reward stream. The gesture condition is slower per task; any reward that correlates with speed or with task count per minute would systematically favour the mouse condition.

## Phase 6 audit: MVP reward surface as built

Roadmap Phase 6 audit, 2026-10-30, against `apps/web/app/(study)/lesson/[lessonId]/lesson-client.tsx`, `packages/learning/src/mastery.ts` and `sequencing.ts`, and `packages/types/src/log-events.ts`. Verdict: the **MVP** reward layer is exactly mastery bands plus the progress list. There are no XP, levels, badges, streaks, quests or points anywhere in code. The check is `apps/web/lib/reward-surface.test.ts`.

### Element map

| Element as built | Code | Doc 08 row | Doc 11 | Tier |
|---|---|---|---|---|
| Band chip per objective: "Not started" (–), "Keep practising" (↻, below 0.5), "Nearly there" (◐, 0.5 up to the threshold), "Mastered" (✓). Icon plus word, never colour alone | `band`, `Results` | [Mastery levels](#mastery-levels): all four **MVP** bands. "Grey" is built as a dashed outline and "green" as the `success-ink` fill, as doc 11 specifies | [Results medals](11-ui-ux.md#major-screens) | **MVP** |
| Mastery meter per objective, 0–100 %, `role="meter"` | `Results` | Mastery levels (it shows the engine's number; no extra computation) | Score / Progress row: mastery bar | **MVP** |
| Review list: graded tasks that were skipped or have no correct attempt | `Results` | Approaching: "the failed tasks named". Built for every band, which is a superset | Score / Progress row: "Review" list | **MVP** |
| Burst on a correct answer outside assessment: "Perfect fit!" for `place`, "That's it!" otherwise | `Burst` | Not a reward row: it is formative feedback on one attempt ([06 feedback](06-learning-engine.md)). It carries no value and accumulates nothing | Feedback row, feedback vocabulary | **MVP** |
| Assessment: "Recorded." for every outcome, no burst | `FeedbackLine` | Not a reward row; keeps assessment from teaching to the test | Assessment row | **MVP** |
| Level path: one node per activity; done, current and upcoming differ in shape | `LevelPath` | [Progress maps](#the-ten-mechanics-considered): the in-lesson half of the **MVP** list | Progress visualisation (consideration 4) | **MVP** |
| Remediation copy "No points this time, and that is fine." | remediation dialog | Event to reward, "Task failed after second exhaustion": 0, no loss. MVP has no points. The copy, from docs 02 and 11, means the attempt scores 0 | Remediation dialog | **MVP** |
| `mastery_computed` per objective at lesson end | lesson-client session effect | Input that rewards may later read, never the reverse | n/a | **MVP** |
| Next-lesson text on results, from `isLessonMastered`: "Every objective is mastered, so the next lesson is unlocked. Next lesson coming soon." or "Master every objective above to unlock the next lesson. Next lesson coming soon." | `Results`; `isUnlocked` reads `prerequisites` and mastered lesson ids only | "All objectives of a lesson Mastered": **MVP** unlock, surfaced as text | Next lesson row (**MVP** placeholder per [02 stage 13](02-learning-experience.md)) | **MVP** |
| Dev-only "Review the parts you missed": hides results and re-pulses the missed tasks' components every 4 s until "← Back to results" | `Results` | Not tied to a band: offered whenever any graded task was missed. It is a review aid with no value attached. Re-offering whole activities (Developing band) is **V1** | Score / Progress row, dev session state | **MVP** (dev only) |

### Checks

| Check | Result | Evidence |
|---|---|---|
| Mastery and unlock read attempts only | Pass | `computeMastery` takes `AttemptRecord[]`; `isUnlocked` takes mastered lesson ids; imports are `@grasp/types` and `./sequencing` only (test 1) |
| Both arms see the identical surface | Pass | `Results`, `band`, `Burst`, `LevelPath`, `FeedbackLine` never read `input` or `condition` (test 2) |
| No reward event in the log | Pass | No entry of `LOG_EVENT_TYPES` in `@grasp/db` matches a reward word (test 3). That list is hand-synced with `LogEventType` in `packages/types/src/log-events.ts`, so the test covers the type only while the two agree |
| Study-mode flag that hides any XP line (roadmap) | Not built, on purpose | MVP has no XP line, so there is nothing to hide. In **V1** the reward layer is derived server-side from `study_phase` ([study-flag rule](#study-flag-rule)) |

### Does the burst correlate a reward with speed?

No. The learning-design reading agrees: a burst is knowledge-of-result for one action. It is contingent on a correct action, not on time, and it is not a stream paced by the clock. Both arms get the same tasks and the same rule.

One refinement to "the same count in both arms". The burst also fires on a correct remediation micro-task, with the sub-line "Now try the original task again." So bursts per lesson = correct non-assessment attempts, micro-tasks included. For `chambers_v1` that is 8 for a learner with no remediation (3 guided plus 5 challenge tasks), plus one per correct micro-task. That count depends on errors, not speed. Errors may differ by arm, but the extra bursts go to the learner who struggled, so the burst does not favour the faster arm. A burst on recovery is also the right pedagogy: it marks the prerequisite as met before the retry. Burst count is not an analysis variable and is not logged as one.

The audit found two gaps: no next-lesson text on results, and no dev-only "Review the parts you missed". Both were built during Phase 6 and are mapped in the element table above.

## V1 reward spec

Everything in this section is **V1**, designed and not built. It refines the [Event to reward table](#event-to-reward-table) where the two differ.

### Inputs

| Rule | Tier |
|---|---|
| Rewards read `lesson_attempts`, `progress`, and `achievements` only, and only rows from `learner` sessions (see [Study-flag rule](#study-flag-rule)). They never read `event_logs`, which is research data and consent-gated | **V1** |
| "Per user, ever" means a user's `learner` sessions. Attempts from that user's earlier `pilot` or `main` sessions (linked through `research_sessions.user_id`) never count toward XP, badges, or quests | **V1** |
| No reward rule reads `AttemptRecord.durationMs`, `t`, `timeLimitSec`, or any event rate. The only clock input is quest age in whole days | **V1** |
| Rewards are computed server-side from stored attempts and written to `achievements`. XP is computed, never stored as a column ([09 progress](09-database.md)) | **V1** |

### XP ledger

| Rule | Value | Why | Tier |
|---|---|---|---|
| XP per task per user | best `score` over all non-micro-task attempts, ever, so at most `scoring.correct` | Retries and lesson replays earn only improvements, so easy tasks cannot be farmed | **V1** |
| Recovery effort | no XP bonus; the `recovered:<objectiveId>` badge instead | A correct remediated retry already scores up to `scoring.correct`, so any bonus would pay failing first more than getting it right first | **V1** |
| Micro-task attempts | 0 | They are scored 0 and are excluded from mastery already | **V1** |
| Timed tasks (`timeLimitSec`, a **V1** difficulty lever in [06](06-learning-engine.md#difficulty-levers-that-are-content-only)) | a timed-out attempt scores 0 and earns 0, like any incorrect attempt | Indirect speed path, see [Speed](#speed) | **V1** |
| Hints, tutor calls | 0, and no penalty beyond the score's `hintPenalty` | Help-seeking is neutral | **V1** |
| Total | sum over tasks. `chambers_v1` maximum: 140 | One lesson is about one level early on | **V1** |

### XP and levels

Planned file: `packages/learning/src/rewards/config.ts` (not created). It is code-owned and outside `content/` so that no lesson can tune its own rewards. The mastery module must never import it, and test 1 above already enforces that.

| Level | XP from | Title | Tier |
|---|---|---|---|
| 1 | 0 | Newcomer | **V1** |
| 2 | 100 | Explorer | **V1** |
| 3 | 300 | Builder | **V1** |
| 4 | 600 | Navigator | **V1** |
| 5 | 1000 | Specialist | **V1** |
| 6 | 1500 | Expert | **V1** |

Titles are subject-neutral and purely cosmetic. They unlock nothing.

### Badges

The list is fixed. Ids are the `achievements.key` values in [09](09-database.md); each key is awarded at most once per user (unique `(user_id, key)`).

| Id | UI name | Award rule (evaluated after each stored attempt) | Behaviour reinforced | Tier |
|---|---|---|---|---|
| `mastered:<objectiveId>` | Mastered | `progress.mastered` becomes true for the objective for the first time | Reaching the threshold | **V1** |
| `recovered:<objectiveId>` | Came back | an attempt with `remediated: true`, `microTask: false`, `outcome: "correct"` on a task of the objective | Persisting through remediation | **V1** |
| `lesson:<lessonId>` | Lesson mastered | `isLessonMastered` is true for the lesson. The unlock happens anyway, by the engine rule | Finishing a topic to the threshold | **V1** |
| `retained:<objectiveId>` | Retained | a quest attempt (its `activity_id` starts with `quest:`) on a task of the objective, after which `progress.mastered` is true, with `created_at` at least 7 days after `mastered:<objectiveId>`'s `awarded_at` | Spaced retrieval | **V1** |
| `returned` | Back for review | the first completed review quest: for some `quest:<date>:<n>`, the user has attempts on `n` distinct task ids with that `activity_id` | Choosing to review | **V1** |

No other badge may be added without a row here naming the learning behaviour. Speed, no-hint, streak and login badges stay rejected ([Anti-patterns](#anti-patterns)).

### Review-quest scheduling

| Step | Rule | Tier |
|---|---|---|
| Eligible | Approaching objectives whose last attempt was at least 1 day ago; Mastered objectives without `retained:` whose `mastered:` badge is at least 7 days old | **V1** |
| Order | Approaching by lowest mastery first, then Mastered by oldest badge first; take up to 3 objectives | **V1** |
| Tasks | up to 2 assessment-kind tasks per objective from the current lesson version, as one activity with `maxAttempts: 1`, `hints: []`, `socketVisual: "none"` | **V1** |
| Offer | generated on the first progress-map load of the user's local calendar day; at most one per day; it expires at day end; ignoring it costs nothing | **V1** |
| Marker | quest attempts are stored with `activity_id = "quest:<yyyy-mm-dd>:<n>"`, where `n` is the quest's task count; each row keeps its task's own `lesson_id`. The prefix `quest:` is reserved: the content validator rejects authored activity ids that start with it | **V1** |
| Completion | a quest is complete when the user has attempts on `n` distinct task ids with its `activity_id`; derived from `lesson_attempts`, nothing extra stored | **V1** |
| Effect | attempts are real `lesson_attempts` with `activityKind: "assessment"` and the lesson's own task ids, so `computeMastery` (which matches by task id) weights them 2× and counts the latest, exactly as assessment tasks. "Latest" must change in **V1**: `AttemptRecord.t` is ms since the session started, so it cannot order a quest attempt in a later `learner` session against earlier sessions' attempts. V1 cross-session mastery orders attempts by `lesson_attempts.created_at` (absolute time), and `computeMastery`'s ordering key changes from `t` to it | **V1** |
| Study | offered only in `learner` sessions, never in pilot, main, or dev. A quest is extra retrieval practice, and it would contaminate the one-week retention test | **V1** |

### Study-flag rule

| Rule | Tier |
|---|---|
| Rewards belong to a new non-study session type: the V1 migration extends the `research_sessions.study_phase` check to (`pilot`, `main`, `dev`, `learner`). `learner` is a signed-in user's ordinary session; the server sets it when no assignment code is entered. It is not research data | **V1** |
| The reward layer is derived in `POST /api/session` and returned in the session boot, not stored: `learner` gives `full`; `pilot`, `main`, and `dev` give `bands`. A stored column is not kept because it would be a pure function of `study_phase` and could drift from it. Nothing on the client can set it: no request body field, query parameter, or local storage, unlike `?tutor=off` | **V1** |
| Dev sessions are purged and excluded from analysis ([09](09-database.md)), so they never carry rewards. Reward UI is tested against a `learner` session on a local database | **V1** |
| With `bands`, the server computes no XP, writes no `achievements` rows, and offers no quests, so there is nothing hidden to reveal | **V1** |
| The reward-surface test gains a check: no reward component reads `input` or `condition`, and the flag's only writer is the session route | **V1** |

### Speed

No reward rule reads time, in any tier. No rule reads a duration, a time remaining, or a rate. No surface shows XP per minute or per day. The one time-based input, quest age, is counted in days and rewards coming back, not going fast.

One indirect path remains. In a task with `timeLimitSec`, the score depends on finishing in time, so XP inherits that dependence through the score. Timed tasks give no bonus for time left, and a timed-out attempt earns 0. The study is unaffected: `chambers_v1` has no timed tasks, and study sessions compute no rewards at all.

## Anti-patterns

Each of these is rejected, with the learning reason.

| Anti-pattern | Why rejected |
|---|---|
| Leaderboards | Normative comparison depresses persistence in lower-ranked learners and rewards speed, which penalises gesture input |
| Daily streaks with loss on a missed day | Loss aversion produces compliance, not retrieval; the review quest covers the legitimate goal |
| XP for time on page or frames rendered | Rewards idling in the scene; nothing is learned |
| Badges for using no hints | Teaches hint avoidance; help-seeking is a productive behaviour |
| Badges for speed | Confounds the study and encourages guessing over looking |
| XP-gated or badge-gated lessons, hotspots, or tutor access | Locks struggling learners out of exactly the content they need; violates the one rule |
| Randomised rewards, loot boxes, spinners | Variable-ratio reinforcement is a compulsion mechanic with no learning content |
| Subtracting XP on failure | Punishes attempts; the engine already withholds score for wrong answers |
| Points for asking the tutor questions | Invites request spam that uses up the per-session tutor call caps ([07](07-ai-tutor.md)) before a real explanation is needed, and adds noise to `ai_interactions` and the `tutor_message` log |
| Badges for logging in or completing a profile | Rewards nothing that evidences learning |
| Rewards authored inside lesson JSON | Would let content tune XP independently of learning; rewards must stay a derivative of engine output |
| Tutor-generated praise or reward decisions | The tutor explains; letting it decide rewards would make a non-deterministic component part of scoring |

## Open questions

- Resolved 2026-10-30 (learning-designer recommendation): no cosmetic unlockables in **V1**. The learning case is nil. Every accent colour and cursor style would need its own contrast and dwell-ring legibility check ([11](11-ui-ux.md)), and that time is better spent on a second lesson. Level titles remain as the only cosmetic. Reopen only if retention data shows a need.

## Related

- [06 Learning engine](06-learning-engine.md): the mastery function and effort events every reward derives from
- [02 Learning experience](02-learning-experience.md): the mastery stage of the learner journey
- [09 Database](09-database.md): `achievements` and `progress` tables
- [11 UI/UX](11-ui-ux.md): how mastery bands and the progress list are rendered in the HUD
- [14 Evaluation methodology](14-evaluation-methodology.md): why the reward layer is held constant during study sessions
