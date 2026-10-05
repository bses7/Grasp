/**
 * Learning-engine contracts: engine -> HUD, logger, progress client, and the lesson_attempts row.
 * Source: lesson-schema skill section 5; doc 06 "Runtime position and persistence"; doc 09 lesson_attempts.
 */
import type { ActivityKind, HintLevel, TaskExpect, TaskType } from "./content";

export type Outcome = "correct" | "partial" | "incorrect";

/** Event summary the engine stores and sends to the tutor; never landmarks, never positions. */
export type ActualSummary = {
  type: string;
  componentId?: string;
  socketId?: string;
  hotspotId?: string;
};

export type Feedback = {
  outcome: Outcome;
  expected: TaskExpect;
  actual: ActualSummary;
  /** null when correct; otherwise min(hintsUsed + 1, 3). */
  nextHintLevel: HintLevel | null;
};

export type EvaluationResult = {
  correct: boolean;
  partial: boolean;
  /** After hint penalty. */
  score: number;
  feedback: Feedback;
};

/** One row of lesson_attempts (doc 09). The server stores; it does not grade. */
export type AttemptRecord = {
  sessionId: string;
  lessonId: string;
  lessonHash: string;
  activityId: string;
  activityKind: Extract<ActivityKind, "guided" | "challenge" | "assessment">;
  taskId: string;
  taskType: TaskType;
  objectiveId: string;
  /** Resets after remediation (doc 06); t disambiguates repeats. */
  attemptNo: number;
  /** True for the synthesised prerequisite micro-task; excluded from mastery. */
  microTask: boolean;
  /** True for the retry after remediation. */
  remediated: boolean;
  outcome: Outcome;
  score: number;
  /** The task's scoring.correct, for normalisation. */
  scoreMax: number;
  hintsUsed: number;
  /** task_start to this attempt. */
  durationMs: number;
  actual: ActualSummary;
  /** ms since session start. */
  t: number;
};

/** Per-objective mastery (doc 06): weighted mean of latest normalised scores, assessment tasks weighted 2x. */
export type MasteryRecord = {
  objectiveId: string;
  /** 0..1; null means not started. */
  mastery: number | null;
  masteryThreshold: number;
  mastered: boolean;
  attemptsCount: number;
  /** t of the newest contributing attempt, ms since session start. */
  lastAttemptT: number | null;
};

/**
 * Per-task mutable state the engine threads through `evaluate()`
 * (lesson-schema §5): attempts so far, hints revealed, and the ordered
 * steps collected for a `sequence` task.
 */
export type AttemptState = {
  attempts: number;
  hintsUsed: number;
  steps: { componentId: string; socketId?: string }[];
};
