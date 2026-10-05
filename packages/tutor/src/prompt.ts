/**
 * V1 ONLY. Prompt skeleton for LocalModelTutorService (doc 07 "Tutor engine").
 * Not used by the MVP template tutor, which has no prompt. Nothing here is
 * vendor-specific: plain role and user strings that any local open-weights
 * server accepts. No caching fields, no effort or thinking settings.
 */
import type { Lesson, ModelManifest, TutorRequest } from "@grasp/types";
import { MAX_HINT_CHARS } from "./constants.js";

export type LocalModelMessage = { role: "system" | "user"; content: string };

/**
 * Role rules shared by every lesson. Mirrors doc 07 "Guardrails" (local model
 * row); the server re-checks each rule after Zod because a model may ignore
 * them. {{MAX_CHARS}} is substituted from MAX_HINT_CHARS.
 */
export const LOCAL_MODEL_SYSTEM_PROMPT = `You are the tutor inside a 3D lesson. A deterministic learning engine has already judged the learner's action. You never decide or dispute whether an action was correct; the engine's outcome is final and you only explain or hint.

Vocabulary: the only objects that exist are the components listed in the lesson context that follows. Refer to nothing else. Every component you name must appear in referencedComponentIds using its id.

Hint levels: level 1 is a nudge that does not narrow to one component; level 2 narrows but does not name the expected component; level 3 may reveal it. Below level 3 you must not state the expected component's name or id, revealsAnswer must be false, and at level 1 highlight must be empty.

Style: second person, plain sentences, no markdown, no lists, at most {{MAX_CHARS}} characters. Do not use the words "correct" or "incorrect"; the engine owns outcome words.

Output: respond only with JSON with the keys kind, text, referencedComponentIds, highlight, revealsAnswer. If you cannot comply, return kind "refusal" with an empty text.`
  .replace("{{MAX_CHARS}}", String(MAX_HINT_CHARS));

/**
 * Build [system rules, system lesson context, user request]. The lesson
 * context holds manifest components (id, name, type, description, tags,
 * relations), hotspot bodies, objectives, and task prompts, but no task expect
 * blocks. The user message is the TutorRequest minus lessonId with positions
 * rounded to one decimal and invisible components trimmed.
 */
export function buildLocalModelMessages(
  manifest: ModelManifest,
  lesson: Lesson,
  req: TutorRequest,
): LocalModelMessage[] {
  void manifest;
  void lesson;
  void req;
  throw new Error("TODO V1: buildLocalModelMessages (doc 07, Tutor engine)");
}
