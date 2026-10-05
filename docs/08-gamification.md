# Gamification

Gamification in Grasp is a thin layer that makes mastery and effort visible. Every reward is computed from attempt scores, per-objective mastery, and effort events produced by the [learning engine](06-learning-engine.md); no reward ever changes a score, a mastery value, or what learning content is available. This file mostly concerns **V1**: the MVP ships mastery levels and a progress view only, because the research study ([14](14-evaluation-methodology.md)) needs both conditions to see an identical, minimal reward layer and the brief's own roadmap places gamification at Phase 6.

## The one rule

```text
reward      = f(attempt scores, mastery, effort events)        // one-way
unlock(lesson) = all prerequisite objectives mastered           // reads mastery only
mastery     never reads XP, levels, badges, or quests
```

Learning content (lessons, activities, hotspots, poses, hints, the tutor) is never behind a reward. Only cosmetics may be. If a mechanic below cannot be expressed as a pure function of engine events, it is rejected.

## The ten mechanics considered

| Mechanic | Learning behaviour reinforced | Risk | Decision | Tier |
|---|---|---|---|---|
| XP | Completing tasks and persisting through remediation; gives a visible running total within a lesson | Extrinsic reward crowding out interest; grinding easy tasks for points | Keep, derived only from task scores and capped effort events; never spent, never gates | **V1** |
| Levels | A coarse summary of cumulative XP so long-term effort is visible across lessons | Levels read as rank; learners compare and the slow condition in the study feels penalised | Keep as cosmetic titles only, hidden during study sessions | **V1** |
| Badges | Evidence of mastery on a specific objective, or a specific productive behaviour (recovering after remediation, revisiting a weak objective) | Badge-hunting; a "no hints" badge teaches hint avoidance | Keep a small fixed set tied to mastery and recovery; reject any badge for speed or hint avoidance | **V1** |
| Streaks | Daily return | Loss aversion drives compulsive check-ins, not learning; a missed day punishes | Reject as daily streaks. The return-visit goal is met by review quests, which are driven by content due for retrieval, not by a counter | Rejected |
| Challenges | Harder variants of mastered content | Name collision: `challenge` is already an activity kind in the glossary | Reject as a separate mechanic; the challenge activity and difficulty levers in [06](06-learning-engine.md#difficulty-levers-that-are-content-only) already do this | Rejected |
| Achievements | One-off milestones: first lesson mastered, all heart objectives mastered | Indistinguishable from badges; two systems to maintain | Merge with badges into one `achievements` table ([09](09-database.md)); the word "achievement" is the storage name, "badge" the UI name | **V1** |
| Unlockable content | Progression feeling | If learning content is unlocked by XP, a struggling learner is locked out of exactly what they need | Learning content unlocks by mastery only (engine rule, **MVP**). Cosmetic unlockables (HUD accent colours, hand-cursor styles) by XP | **V1** cosmetic |
| Progress maps | Seeing which objectives are mastered, developing, or untouched across lessons; supports self-regulated choice of what to review | A map that shows locked nodes as a path can feel like a gate even when it is mastery-driven | Keep as a mastery visualisation; MVP is a per-objective list in the mastery activity, V1 is a topic map | **MVP** list, **V1** map |
| Mastery levels | Communicates distance to the threshold so the learner knows what to retry | Labels can feel like grades | Keep; bands on the engine's mastery number, no extra computation | **MVP** |
| Quests | Retrieval practice: a short, generated review of weak or ageing objectives | Could become busywork if generated too often | Keep as review quests generated deterministically from mastery and age; at most one offered per day | **V1** |

Not in the brief's list but considered: leaderboards (rejected, see anti-patterns), and a tutor-praise channel (rejected; the tutor explains, it does not reward).

## Mastery levels

Bands on the per-objective mastery value from the engine. The engine computes the number; this layer only labels it.

| Band | Condition | Learner sees | Tier |
|---|---|---|---|
| Not started | no attempts on the objective's tasks | grey | **MVP** |
| Developing | mastery < 0.5 | "Keep practising"; the objective's explore and guided activities offered | **MVP** |
| Approaching | 0.5 ≤ mastery < `masteryThreshold` | "Nearly there"; the specific failed tasks named | **MVP** |
| Mastered | mastery ≥ `masteryThreshold` | green; prerequisite satisfied for dependent lessons | **MVP** |
| Retained | Mastered again in a review quest ≥ 7 days later | gold outline | **V1** |

"Retained" is the band that justifies quests: it rewards spaced retrieval, which is the behaviour most strongly associated with durable learning and the one the one-week retention test in the study measures.

## Event to reward table

All inputs are `LogEvent` types from the `research-protocol` schema or engine outputs from [06](06-learning-engine.md). Nothing here writes back.

| Engine event | Reward | Rule | Tier |
|---|---|---|---|
| `task_attempt` with `correct: true` | XP = `score` | Score already includes hint penalties; no second penalty | **V1** |
| `task_attempt` with `partial: true` | XP = `score` | Partial credit is already in the score | **V1** |
| `task_attempt` after remediation, correct | XP = `score` + 5 effort | Rewards recovering, not failing | **V1** |
| `activity_end` for explore with every hotspot viewed | XP 5 effort | Rewards reading the model before being tested; capped once per activity | **V1** |
| `hint_shown`, `tutor_message` | 0 | Help-seeking is neither rewarded nor punished here | **V1** |
| Objective reaches Mastered | badge `mastered:<objectiveId>` | One per objective, ever | **V1** |
| All objectives of a lesson Mastered | achievement `lesson:<lessonId>`; next lesson unlocked by the engine rule, not by this row | The unlock is mastery-driven and would happen without the achievement | **MVP** unlock, **V1** achievement |
| Objective reaches Retained | badge `retained:<objectiveId>` | Requires a review quest attempt ≥ 7 days after first mastery | **V1** |
| Task failed after second exhaustion | 0 XP, no loss | Nothing is ever subtracted | **V1** |
| Cumulative XP crosses a threshold | level title; cosmetic unlock | Thresholds in a config file, not in lesson JSON | **V1** |

## Review quests

A quest is a generated mini-lesson, not authored content: the generator picks up to three objectives that are Approaching, or Mastered more than seven days ago without a Retained band, and assembles their assessment-kind tasks into a single activity with `maxAttempts: 1`, `hints: []`, sockets hidden. Quest attempts are real `task_attempt` events, so they update mastery exactly like any assessment task. The quest is offered on the progress map at most once per day and can be ignored without penalty.

| Option for driving return visits | Pros | Cons | Fit for solo dev | Verdict |
|---|---|---|---|---|
| Daily streak counter | Simple, familiar | Rewards showing up, not learning; punishes absence | High | Rejected |
| Review quests from mastery age | Each return is retrieval practice on content due for review | Needs a scheduler and a generator (~150 lines) | Medium | **Recommended, V1** |
| Push or email reminders | Reaches absent learners | Needs contact details and consent; operational cost | Low | **Future** |

Eight-point check for review quests: appropriate because retrieval practice is the strongest evidence-based mechanic available; limited because it only works once more than one lesson's worth of objectives exists; negligible browser cost (it reuses the engine); accessibility-neutral; privacy-neutral (uses stored attempts, nothing new); scales with lessons; a solo developer can build the generator in a day; it is necessary only in V1, which is why the MVP ships without it.

## Research consideration

During study sessions (locked position 8) the reward layer is reduced to the **MVP** set: mastery bands and the per-objective progress list. XP, levels, and badges are hidden by a session flag so that neither condition receives a differently paced reward stream. The gesture condition is slower per task; any reward that correlates with speed or with task count per minute would systematically favour the mouse condition.

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
| Points for asking the tutor questions | Invites prompt spam and inflates API cost |
| Badges for logging in or completing a profile | Rewards nothing that evidences learning |
| Rewards authored inside lesson JSON | Would let content tune XP independently of learning; rewards must stay a derivative of engine output |
| Tutor-generated praise or reward decisions | The tutor explains; letting it decide rewards would make a non-deterministic component part of scoring |

## Open questions

- Should cosmetic unlockables exist at all in V1, or is the maintenance cost better spent on more lessons? The learning case for them is nil; the only argument is retention.

## Related

- [06 Learning engine](06-learning-engine.md): the mastery function and effort events every reward derives from
- [02 Learning experience](02-learning-experience.md): the mastery stage of the learner journey
- [09 Database](09-database.md): `achievements` and `progress` tables
- [11 UI/UX](11-ui-ux.md): how mastery bands and the progress list are rendered in the HUD
- [14 Evaluation methodology](14-evaluation-methodology.md): why the reward layer is held constant during study sessions
