/**
 * Tutor contracts: HUD -> POST /api/tutor -> TutorService. Source: doc 07 "Request and response payloads".
 * The tutor explains, hints, and summarises from structured state. It never decides correctness and never sees video.
 */
import type { HintLevel, TaskExpect, TaskType } from "./content";
import type { ActualSummary, Outcome } from "./learning";
import type { SceneState } from "./scene-events";

/** hint and explain_mistake are MVP; question and summary are V1. */
export type TutorRequestKind = "hint" | "explain_mistake" | "question" | "summary";

export type TutorRequest = {
  /** Random session UUID (research-protocol section 4); never an account id. Verified against the cookie server-side. */
  sessionId: string;
  lessonId: string;
  activityId: string;
  kind: TutorRequestKind;
  /** From feedback.nextHintLevel; 3 may reveal. */
  hintLevel: HintLevel;
  task: {
    id: string;
    type: TaskType;
    prompt: string;
    objectiveStatement: string;
    /** The task's expect block, verbatim. */
    expect: TaskExpect;
  };
  /** From the engine; null for a pre-attempt hint request. */
  evaluation: {
    outcome: Outcome;
    expected: TaskExpect;
    actual: ActualSummary;
    attemptNo: number;
    hintsUsed: number;
  } | null;
  /** Positions are rounded to one decimal server-side before prompting. */
  scene: SceneState;
  /** V1 only; max 280 chars; treated as untrusted data. */
  question?: string;
  locale: "en";
};

export type TutorResponseKind = "hint" | "explain_mistake" | "answer" | "summary" | "refusal";

export type TutorResponse = {
  kind: TutorResponseKind;
  /** <= 320 characters, plain sentences, no markdown. */
  text: string;
  /** Every component the text names; must be a subset of manifest ids. */
  referencedComponentIds: string[];
  /** Component ids the HUD may pulse; empty at hint level 1. */
  highlight: string[];
  /** Must be false when hintLevel < 3. */
  revealsAnswer: boolean;
};

/** What the HUD receives; never the raw model output. */
export type TutorHudMessage = {
  source: "tutor" | "static";
  text: string;
  highlight: string[];
  /** ai_interactions.id, present when source is "tutor". */
  interactionId?: string;
};

/** ai_interactions.status (doc 07, doc 09). */
export type TutorCallStatus =
  | "ok" | "fallback_timeout" | "fallback_error" | "fallback_invalid" | "capped";
