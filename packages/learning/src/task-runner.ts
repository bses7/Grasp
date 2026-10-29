/**
 * Drives one lesson from scene events (docs/06 "Learning evaluation pseudocode", `onSceneEvent`).
 * Pure TypeScript with no DOM or React: the app feeds it scene events and time, and renders what it returns.
 * It never sees interaction events (so never `grab_end.reason`); tracking loss reaches it only as
 * `drop.cause == "lost"`, which `countsAsAttempt` discards.
 *
 * - Hint ladder: after an incorrect attempt the next hint is revealed; `requestHint` reveals one on demand.
 *   Either way `hintsUsed` rises and the correct score pays `hintPenalty` per level (doc 06 "Hints").
 * - Repeated failure (guided, challenge): worked example, a synthesised micro-task (one attempt, scored 0),
 *   then a retry with attempts reset and `hintsUsed = 3`; a second exhaustion fails the task.
 * - Sequence tasks: each matching step is progress, not an attempt (`onSceneEvent` returns null and
 *   `sequenceProgress` rises); a wrong step, or the last one, is graded as one attempt, and a wrong one
 *   clears the steps for the retry.
 * - `skip` ("Skip for now", doc 11 failure state 7) closes the open task without an attempt; it stays out
 *   of every later `nextTask` and is listed in `skipped` for the results screen. `toAssessment` jumps to the
 *   assessment activity (the 15-minute prompt's "assess" choice).
 * - `resume` rebuilds the runner from a saved attempt log after a reload (roadmap Phase 4: "a cold reload
 *   resumes the current task from the attempt log").
 * - Task-less activities (introduction, explore) complete by time through `tick`; the runner stops at the
 *   `mastery` activity, where the app renders mastery and unlock decisions.
 */
import type { Activity, AttemptRecord, AttemptState, EvaluationResult, Hint, Lesson, SceneEvent, Task } from "@grasp/types";
import { countsAsAttempt } from "./counts-as-attempt";
import { evaluate } from "./evaluate";
import { nextHint } from "./hints";
import { RETRY_HINTS_USED, shouldRemediate, synthesiseMicroTask } from "./remediation";
import { GRADED_ACTIVITY_KINDS, isActivityComplete, maxAttemptsFor, nextActivity, nextTask } from "./sequencing";

export type Remediation = {
  /** The failed task: the scene animates its `expect` (place: into the socket and back). */
  workedExample: Task;
  /** Now the open task; one attempt, scored 0. */
  microTask: Task;
};

export type Verdict = {
  task: Task;
  result: EvaluationResult;
  attemptNo: number;
  maxAttempts: number;
  /** The component the attempt was about, for feedback at that component. */
  componentId: string | null;
  /** True for the remediation micro-task. */
  micro: boolean;
  /** Hint revealed by this incorrect attempt, if the ladder has one. */
  hint: Hint | null;
  remediation: Remediation | null;
  /**
   * retry: same task again. remediate: worked example, then `remediation.microTask` is the open task.
   * next_task: the next task is open. next_activity: a task-less activity is current (see `tick`).
   * lesson_complete: the mastery activity, or the end of a lesson without one.
   */
  next: "retry" | "remediate" | "next_task" | "next_activity" | "lesson_complete";
};

export type TaskRunnerOptions = { sessionId: string; lessonHash: string };

export class TaskRunner {
  readonly attempts: AttemptRecord[] = [];
  private activityIndex = 0;
  private states = new Map<string, AttemptState>();
  private taskStartedAt = new Map<string, number>();
  private activityStartedAt = 0;
  private remediated = new Set<string>();
  private micro: { task: Task; original: Task } | null = null;
  /** Task ids closed by `skip`, in order. */
  readonly skipped: string[] = [];

  constructor(
    readonly lesson: Lesson,
    private readonly opts: TaskRunnerOptions,
  ) {}

  /** Begin the lesson at time `t` (ms since session start); call once before feeding events. */
  start(t: number): void {
    this.activityStartedAt = t;
    this.settle(t);
  }

  get activity(): Activity | null {
    return this.lesson.activities[this.activityIndex] ?? null;
  }

  /** The open task (the micro-task during remediation), or null in a task-less activity or when done. */
  get task(): Task | null {
    if (this.micro) return this.micro.task;
    const a = this.activity;
    return a && a.kind !== "mastery" ? nextTask(this.withoutSkipped(a), this.attempts) : null;
  }

  /** Attempts used on the open task so far (resets for the retry after remediation; 0 on a micro-task). */
  get attemptsUsed(): number {
    const t = this.task;
    return t && !this.micro ? (this.states.get(t.id)?.attempts ?? 0) : 0;
  }

  /** Highest hint level revealed on the open task (3 on a remediated retry; 0 on a micro-task). */
  get hintsUsed(): number {
    const t = this.task;
    return t && !this.micro ? (this.states.get(t.id)?.hintsUsed ?? 0) : 0;
  }

  /** Steps collected so far on an open sequence task (0 otherwise), for the HUD's "2 of 4". */
  get sequenceProgress(): number {
    const t = this.task;
    return t?.type === "sequence" && !this.micro ? (this.states.get(t.id)?.steps.length ?? 0) : 0;
  }

  /** The lesson is over: at the mastery activity, or past the last activity. */
  get done(): boolean {
    const a = this.activity;
    return !a || a.kind === "mastery";
  }

  /** Advance time-completed activities (`{ time: s }`). True if the activity changed. */
  tick(now: number): boolean {
    const before = this.activityIndex;
    this.settle(now);
    return before !== this.activityIndex;
  }

  /**
   * Rebuild from a saved attempt log (oldest first) and the skipped task ids, instead of `start`. Opens at the
   * activity of the last attempt, or the first activity if there is none, then moves past completed ones.
   * A reload between remediation and its micro-task counts the micro-task as done: the retry opens with
   * attempts reset and every hint used, as after `gradeMicro`.
   */
  resume(attempts: readonly AttemptRecord[], skipped: readonly string[], t: number): void {
    this.attempts.push(...attempts);
    this.skipped.push(...skipped);
    for (const a of attempts) if (a.remediated) this.remediated.add(a.taskId);
    const tasks = new Map(this.lesson.activities.flatMap((a) => a.tasks.map((task) => [task.id, { task, activity: a }] as const)));
    for (const [id, { task, activity }] of tasks) {
      const mine = attempts.filter((a) => a.taskId === id && !a.microTask);
      if (!mine.length) continue;
      const remediated = this.remediated.has(id);
      const round = mine.filter((a) => a.remediated === remediated);
      const exhausted = !remediated && round.length >= maxAttemptsFor(activity, task) && shouldRemediate(activity.kind, round.length, maxAttemptsFor(activity, task), false);
      if (exhausted) this.remediated.add(id);
      this.states.set(
        id,
        exhausted
          ? { attempts: 0, hintsUsed: RETRY_HINTS_USED, steps: [] }
          : { attempts: round.length, hintsUsed: hintsAfter(task, round.at(-1)), steps: [] },
      );
    }
    const last = attempts.at(-1);
    const i = last ? this.lesson.activities.findIndex((a) => a.id === last.activityId) : 0;
    this.activityIndex = Math.max(0, i);
    this.activityStartedAt = t;
    this.settle(t);
  }

  /** Close the open task (the original during remediation) without an attempt, and move on. */
  skip(t: number): Verdict["next"] | null {
    const task = this.micro?.original ?? this.task;
    if (!task) return null;
    this.micro = null;
    this.skipped.push(task.id);
    this.settle(t);
    return this.afterAdvance();
  }

  /** End a task-less `{ continue: true }` activity (the learner's Continue button). False if that is not open. */
  proceed(t: number): boolean {
    const a = this.activity;
    if (!a || a.tasks.length || !("continue" in a.completion)) return false;
    this.activityIndex++;
    this.activityStartedAt = t;
    this.settle(t);
    return true;
  }

  /** Jump to the assessment activity (no-op without one, or once there). */
  toAssessment(t: number): boolean {
    const i = this.lesson.activities.findIndex((a) => a.kind === "assessment");
    if (i < 0 || i <= this.activityIndex) return false;
    this.micro = null;
    this.activityIndex = i;
    this.activityStartedAt = t;
    this.settle(t);
    return true;
  }

  /** Reveal the next hint on request; it costs the same penalty as an earned one. Null if none is left. */
  requestHint(): Hint | null {
    const task = this.task;
    if (!task || this.micro) return null;
    const s = this.stateFor(task);
    const h = nextHint(task, s.hintsUsed);
    if (h) s.hintsUsed = h.level;
    return h;
  }

  /** Grade one scene event against the open task; null when it is not an attempt (see countsAsAttempt). */
  onSceneEvent(event: SceneEvent): Verdict | null {
    const activity = this.activity;
    const task = this.task;
    if (!activity || !task || !countsAsAttempt(task, event)) return null;
    if (this.micro) return this.gradeMicro(activity, this.micro, event);

    const s = this.stateFor(task);
    if (task.type === "sequence" && isSequenceProgress(task, s.steps, event)) {
      s.steps.push(stepOf(event)!);
      return null;
    }
    const result = evaluate(task, event, s);
    const maxAttempts = maxAttemptsFor(activity, task);
    this.record(activity, task, s, result, event.t, false);
    const base = { task, result, attemptNo: s.attempts, maxAttempts, componentId: result.feedback.actual.componentId ?? null, micro: false };

    if (!result.correct && s.attempts < maxAttempts) {
      const hint = nextHint(task, s.hintsUsed);
      if (hint) s.hintsUsed = hint.level;
      s.steps = [];
      return { ...base, hint, remediation: null, next: "retry" };
    }
    if (!result.correct && shouldRemediate(activity.kind, s.attempts, maxAttempts, this.remediated.has(task.id))) {
      this.remediated.add(task.id);
      const microTask = synthesiseMicroTask(task, s);
      this.micro = { task: microTask, original: task };
      this.taskStartedAt.set(microTask.id, event.t);
      return { ...base, hint: null, remediation: { workedExample: task, microTask }, next: "remediate" };
    }
    this.settle(event.t);
    return { ...base, hint: null, remediation: null, next: this.afterAdvance() };
  }

  /** The micro-task gets one attempt whatever its outcome, then the original task is retried. */
  private gradeMicro(activity: Activity, m: { task: Task; original: Task }, event: SceneEvent): Verdict {
    const s: AttemptState = { attempts: 0, hintsUsed: 0, steps: [] };
    const result = evaluate(m.task, event, s);
    this.record(activity, m.task, s, result, event.t, true);
    this.micro = null;
    this.states.set(m.original.id, { attempts: 0, hintsUsed: RETRY_HINTS_USED, steps: [] });
    this.taskStartedAt.set(m.original.id, event.t);
    return {
      task: m.task,
      result,
      attemptNo: 1,
      maxAttempts: 1,
      componentId: result.feedback.actual.componentId ?? null,
      micro: true,
      hint: null,
      remediation: null,
      next: "retry",
    };
  }

  private withoutSkipped(a: Activity): Activity {
    return this.skipped.length ? { ...a, tasks: a.tasks.filter((x) => !this.skipped.includes(x.id)) } : a;
  }

  private afterAdvance(): Verdict["next"] {
    return this.task ? "next_task" : this.done ? "lesson_complete" : "next_activity";
  }

  private stateFor(task: Task): AttemptState {
    let s = this.states.get(task.id);
    if (!s) this.states.set(task.id, (s = { attempts: 0, hintsUsed: 0, steps: [] }));
    return s;
  }

  private record(activity: Activity, task: Task, state: AttemptState, result: EvaluationResult, t: number, micro: boolean): void {
    const kind = activity.kind;
    if (!(GRADED_ACTIVITY_KINDS as readonly string[]).includes(kind)) return;
    this.attempts.push({
      sessionId: this.opts.sessionId,
      lessonId: this.lesson.id,
      lessonHash: this.opts.lessonHash,
      activityId: activity.id,
      activityKind: kind as AttemptRecord["activityKind"],
      taskId: task.id,
      taskType: task.type,
      objectiveId: task.objectiveId,
      attemptNo: state.attempts,
      microTask: micro,
      remediated: !micro && this.remediated.has(task.id),
      outcome: result.feedback.outcome,
      score: result.score,
      scoreMax: task.scoring.correct,
      hintsUsed: state.hintsUsed,
      durationMs: Math.round(t - (this.taskStartedAt.get(task.id) ?? t)),
      actual: result.feedback.actual,
      t: Math.round(t), // stored as an integer ms (attempts.t); the page clock is fractional
    });
  }

  /** Move past completed activities (stopping at `mastery`) and stamp the start of the newly open task. */
  private settle(t: number): void {
    if (this.micro) return;
    for (let a = this.activity; a && a.kind !== "mastery"; a = this.activity) {
      const elapsed = t - this.activityStartedAt;
      a = this.withoutSkipped(a);
      // With tasks: done when none is open (or the completion rule is met early). Without: by its rule (time).
      const complete = a.tasks.length ? !nextTask(a, this.attempts) || isActivityComplete(a, this.attempts, elapsed) : isActivityComplete(a, this.attempts, elapsed);
      if (!complete) break;
      const following = nextActivity(this.lesson, a.id);
      this.activityIndex = following ? this.lesson.activities.indexOf(following) : this.lesson.activities.length;
      this.activityStartedAt = t;
    }
    const open = this.task;
    if (open && !this.taskStartedAt.has(open.id)) this.taskStartedAt.set(open.id, t);
  }
}

type Step = { componentId: string; socketId?: string };
const stepKey = (x: Step) => `${x.componentId}@${x.socketId ?? ""}`;
const stepOf = (e: SceneEvent): Step | null =>
  e.type === "place" ? { componentId: e.componentId, socketId: e.socketId } : "componentId" in e && e.componentId ? { componentId: e.componentId } : null;

/** The event extends the sequence's steps without completing it or going wrong. */
function isSequenceProgress(task: Extract<Task, { type: "sequence" }>, steps: Step[], event: SceneEvent): boolean {
  const step = stepOf(event);
  if (!step) return false;
  const next = [...steps, step].map(stepKey);
  const want = task.expect.steps.map(stepKey);
  if (next.length >= want.length) return false;
  if (task.expect.strictOrder) return next.every((k, i) => k === want[i]);
  return next.every((k) => want.includes(k) && !!want.splice(want.indexOf(k), 1));
}

/** Hint level open after a saved attempt: an incorrect one revealed the next level, as `onSceneEvent` does. */
function hintsAfter(task: Task, last: AttemptRecord | undefined): number {
  if (!last) return 0;
  return last.outcome === "correct" ? last.hintsUsed : (nextHint(task, last.hintsUsed)?.level ?? last.hintsUsed);
}
