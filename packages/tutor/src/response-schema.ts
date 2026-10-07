import { z } from "zod";
import type { TutorResponse } from "@grasp/types";
import { MAX_HINT_CHARS } from "./constants";

const componentId = z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case component id");

/**
 * Shape of a tutor reply per docs/07-ai-tutor.md "Request and response
 * payloads". Applied to every engine's output (template in MVP, local model
 * in V1) before anything reaches the HUD.
 *
 * Context-dependent guardrails (ids are in the manifest, no reveal below
 * hint level 3, empty highlight at level 1) need the manifest and the request,
 * so they live in a Phase D check that runs after this parse. For the
 * template engine most of them hold by construction (templates.test.ts).
 */
export const tutorResponseSchema = z.object({
  kind: z.enum(["hint", "explain_mistake", "answer", "summary", "refusal"]),
  text: z.string().max(MAX_HINT_CHARS),
  referencedComponentIds: z.array(componentId),
  highlight: z.array(componentId),
  revealsAnswer: z.boolean(),
}) satisfies z.ZodType<TutorResponse>;

/**
 * Parse raw engine output. Throws ZodError on failure; the caller maps a
 * throw to status "fallback_invalid" and the static hint. Never retried.
 */
export function parseTutorResponse(raw: unknown): TutorResponse {
  return tutorResponseSchema.parse(raw);
}
