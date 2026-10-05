import type { TutorRequest, TutorResponse } from "@grasp/types";

/**
 * Call kinds from docs/07-ai-tutor.md "Request and response payloads".
 * MVP: hint, explain_mistake. V1: question, summary.
 */
export type TutorKind = "hint" | "explain_mistake" | "question" | "summary";

/**
 * Which engine fills the seam (doc 07 "Tutor engine").
 * "template": deterministic templates from manifest data (MVP, default).
 * "local": open-weights model on the lab laptop behind /api/tutor (V1, gated).
 * A hosted metered API is not a member of this union and never will be.
 */
export type TutorEngine = "template" | "local";

/**
 * The seam between the /api/tutor route handler and whichever engine phrases
 * the text. In every tier the engine runs inside the route handler on our own
 * server (same origin, no third-party egress). Implementations:
 * TemplateTutorService (MVP), LocalModelTutorService (V1, lab-laptop instance
 * only), RemoteTutorService (V1/Future Python seam).
 *
 * Quoted verbatim in docs/07-ai-tutor.md "Tutor engine" and copied by doc 03;
 * keep the three signatures and their comments identical in all three places.
 *
 * Invariants (locked positions 5 and 7): implementations never decide
 * correctness and never receive video or landmarks. Every method resolves with
 * a validated TutorResponse or rejects; the route maps a rejection to the
 * static fallback. They never pass unvalidated text through to the HUD.
 */
export interface TutorService {
  /** Return the authored hint at req.hintLevel (level 3 may reveal). MVP. */
  hint(req: TutorRequest): Promise<TutorResponse>;
  /** Explain an incorrect or partial attempt without contradicting the engine. MVP. */
  explainMistake(req: TutorRequest): Promise<TutorResponse>;
  /** Narrate per-objective mastery for the mastery screen. Optional; V1. */
  summarise?(req: TutorRequest): Promise<TutorResponse>;
}
