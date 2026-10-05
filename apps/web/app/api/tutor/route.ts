/**
 * POST /api/tutor: the single place a tutor engine is chosen, behind the
 * TutorService seam (docs/03, "The seam for a Python service"; docs/07
 * templates and guardrails; locked position 7). In MVP it calls
 * `TemplateTutorService` from @grasp/tutor in-process: deterministic
 * templates over the lesson hint ladder and manifest data, no network egress.
 *
 * Validates the body with `TutorRequestSchema` from @grasp/types, rejects
 * when body.sessionId differs from the cookie, enforces the per-session call
 * caps, then:
 *
 *   const tutor: TutorService = env.TUTOR_SERVICE_URL
 *     ? new RemoteTutorService(env.TUTOR_SERVICE_URL)        // V1/Future Python seam
 *     : env.TUTOR_ENGINE === "local" && env.TUTOR_LOCAL_URL
 *       ? new LocalTutorService(env.TUTOR_LOCAL_URL)          // V1, only after measurement
 *       : new TemplateTutorService();                         // MVP
 *   tutor.hint(req) | tutor.explain(req) | tutor.summarise(req)
 *
 * Writes an ai_interactions row (engine = "template" | "local:<name>") and
 * returns TutorResponse. A hosted metered LLM API is never a branch here, and
 * no model vendor name or price appears in this repository.
 *
 * TODO Phase D, doc 13 Phase 5.
 */
export async function POST() {
  return Response.json(
    { error: "not implemented", todo: "Phase D, doc 13 Phase 5" },
    { status: 501 },
  );
}
