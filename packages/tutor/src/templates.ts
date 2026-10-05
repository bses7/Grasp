import type { TaskType } from "@grasp/types";

/**
 * Template strings for the MVP template tutor (doc 07 "The template tutor").
 * Templates contain no subject nouns: every noun arrives through a placeholder
 * filled from manifest data (component name, description, tags) or the task
 * prompt. templates.test.ts enforces the allowed placeholder set and that no
 * body or narrowing clause can reveal the answer.
 */

export const TASK_TYPES: readonly TaskType[] = ["identify", "place", "remove", "sequence", "compare"];
/** Outcomes that reach the tutor; "correct" never does. */
export const EXPLAIN_OUTCOMES = ["incorrect", "partial"] as const;
export type ExplainOutcome = (typeof EXPLAIN_OUTCOMES)[number];
export const ALLOWED_PLACEHOLDERS = [
  "selectedName", "selectedDescription", "expectedName", "selectedTag", "expectedTag",
  "socketRegion", "restRegion", "stepNo", "priorStepName", "attribute", "prompt",
] as const;
export type Placeholder = (typeof ALLOWED_PLACEHOLDERS)[number];

/** Placeholders that name the answer; permitted only in REVEAL_TEMPLATES (hint level 3). */
export const REVEAL_PLACEHOLDERS: readonly Placeholder[] = ["expectedName", "restRegion"];
export const PLACEHOLDER_RE = /\{([a-zA-Z]+)\}/g;

/** Level-1 body: what the learner did. Total over task type x outcome so the resolver never misses. */
export const MISTAKE_TEMPLATES: Record<TaskType, Record<ExplainOutcome, string>> = {
  identify: {
    incorrect: "You selected the {selectedName}: {selectedDescription} That is not the part the task asks for.",
    partial: "You selected the {selectedName}. Look again at the task: {prompt}",
  },
  place: {
    incorrect: "You moved the {selectedName}, which is not the part the task asks for. {selectedDescription}",
    partial: "The {selectedName} is the right part, but that socket is in the {socketRegion} and is not where it belongs.",
  },
  remove: {
    incorrect: "You moved the {selectedName}, but the task asks you to detach a different part. {selectedDescription}",
    partial: "You detached the {selectedName} but it settled back into its socket. Drop it further away.",
  },
  sequence: {
    incorrect: "The order broke at step {stepNo}: the {selectedName} does not follow the {priorStepName}.",
    partial: "The parts are right but the order is not. It broke at step {stepNo}, after the {priorStepName}.",
  },
  compare: {
    incorrect: "You chose the {selectedName}. {selectedDescription} The question is about {attribute}, so compare the two parts on that alone.",
    partial: "You chose the {selectedName}. Look again at the task: {prompt}",
  },
};

/** Variant used when a sequence breaks at step 1 (no prior step exists). */
export const SEQUENCE_START_TEMPLATE = "The sequence starts with a different part than the {selectedName}.";

/** Level-2 narrowing clause, keyed by the relation found from selected to expected. Never names the answer. */
export const NARROW_CLAUSES = {
  opposite_of: "The part you need is the counterpart of the {selectedName} on the other side.",
  connects_to: "The {selectedName} connects directly to the part you need; follow the flow one step on.",
  connects_from: "The part you need connects directly into the {selectedName}; follow the flow one step back.",
  contains: "The part you need is inside the {selectedName}.",
  tag_contrast: "The part you chose is {selectedTag}; the part you need is {expectedTag}.",
  none: "Reread the task: {prompt}",
} as const;
export type NarrowKey = keyof typeof NARROW_CLAUSES;

/** Level-3 reveal sentence; the only templates allowed to use REVEAL_PLACEHOLDERS. */
export const REVEAL_TEMPLATES: Record<TaskType, string> = {
  identify: "The part you need is the {expectedName}; it is highlighted now.",
  place: "The {expectedName} belongs in the {restRegion}; its socket is highlighted now.",
  remove: "Detach the {expectedName}; it is highlighted now.",
  sequence: "Step {stepNo} is the {expectedName}; it is highlighted now.",
  compare: "The answer is the {expectedName}; it is highlighted now.",
};

/** Used for a hint with tutor: true and no authored text. */
export const HINT_FALLBACK = "Look again at the task: {prompt}";

/** Substitute placeholders; a missing value is left unresolved so validation can catch it. */
export function fillTemplate(template: string, values: Partial<Record<Placeholder, string>>): string {
  return template.replace(PLACEHOLDER_RE, (whole, key: string) => values[key as Placeholder] ?? whole);
}
