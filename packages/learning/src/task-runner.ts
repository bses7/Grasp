/**
 * Drives one lesson from scene events (docs/06 "Learning evaluation pseudocode", `onSceneEvent`).
 * Pure TypeScript with no DOM or React: the app feeds it scene events and renders what it returns.
 * It never sees interaction events (so never `grab_end.reason`); tracking loss reaches it only as
 * `drop.cause == "lost"`, which `countsAsAttempt` discards.
 *
 * M8 scope: evaluate, record the attempt, advance on correct or once `maxAttempts` is used up.
 * ponytail: no hint ladder, remediation or mastery yet (doc 17 excludes them from the prototype;
 * doc 13 Phase 4); a task that runs out of attempts is simply marked failed.
 */
import type { Activity, AttemptRecord, AttemptState, EvaluationResult, Lesson, SceneEvent, Task } from "@grasp/types";
import { countsAsAttempt } from "./counts-as-attempt";
import { evaluate } from "./evaluate";
import { GRADED_ACTIVITY_KINDS, isActivityComplete, maxAttemptsFor, nextActivity, nextTask } from "./sequencing";

export type Verdict = {
  task: Task;
  result: EvaluationResult;
  attemptNo: number;
  maxAttempts: number;
  /** The component the attempt was about, for feedback at that component. */
  componentId: string | null;
  /** What the runner did after grading. */
  next: "retry" | "next_task" | "lesson_complete";
};

export type TaskRunnerOptions = { sessionId: string; lessonHash: string };

export class TaskRunner {
  readonly attempts: AttemptRecord[] = [];
  private activityIndex = 0;
  private states = new Map<string, AttemptState>();
  private taskStartedAt = new Map<string, number>();
  private activityStartedAt = 0;

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

  /** The open task in the current activity, or null when the lesson is complete. */
  get task(): Task | null {
    const a = this.activity;
    return a ? nextTask(a, this.attempts) : null;
  }

  /** Grade one scene event against the open task; null when it is not an attempt (see countsAsAttempt). */
  onSceneEvent(event: SceneEvent): Verdict | null {
    const activity = this.activity;
    const task = this.task;
    if (!activity || !task || !countsAsAttempt(task, event)) return null;

    const state = this.stateFor(task);
    const result = evaluate(task, event, state);
    const maxAttempts = maxAttemptsFor(activity, task);
    this.record(activity, task, state, result, event.t);

    const done = result.correct || state.attempts >= maxAttempts;
    this.settle(event.t);
    return {
      task,
      result,
      attemptNo: state.attempts,
      maxAttempts,
      componentId: result.feedback.actual.componentId ?? null,
      next: !done ? "retry" : this.task ? "next_task" : "lesson_complete",
    };
  }

  private stateFor(task: Task): AttemptState {
    let s = this.states.get(task.id);
    if (!s) this.states.set(task.id, (s = { attempts: 0, hintsUsed: 0, steps: [] }));
    return s;
  }

  private record(activity: Activity, task: Task, state: AttemptState, result: EvaluationResult, t: number): void {
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
      microTask: false,
      remediated: false,
      outcome: result.feedback.outcome,
      score: result.score,
      scoreMax: task.scoring.correct,
      hintsUsed: state.hintsUsed,
      durationMs: Math.round(t - (this.taskStartedAt.get(task.id) ?? t)),
      actual: result.feedback.actual,
      t,
    });
  }

  /** Move past completed activities and stamp the start time of the task that is now open. */
  private settle(t: number): void {
    for (let a = this.activity; a; a = this.activity) {
      if (nextTask(a, this.attempts) && !isActivityComplete(a, this.attempts, t - this.activityStartedAt)) break;
      // ponytail: activities with no tasks (narration, explore) are skipped; they arrive with their UI in Phase 4.
      const following = nextActivity(this.lesson, a.id);
      this.activityIndex = following ? this.lesson.activities.indexOf(following) : this.lesson.activities.length;
      this.activityStartedAt = t;
    }
    const open = this.task;
    if (open && !this.taskStartedAt.has(open.id)) this.taskStartedAt.set(open.id, t);
  }
}
