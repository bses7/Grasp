/**
 * POST /api/session: mint an anonymous research session (docs/03,
 * "Authentication"; docs/09 research_sessions).
 *
 * Validates with `CreateSessionSchema` from @grasp/types (client-generated
 * v4 sessionId, pre-assigned session code, consent version), calls
 * `createResearchSession()` from @grasp/db, which records the condition the
 * code encodes and marks the code used, then sets an httpOnly SameSite=Strict
 * cookie carrying sessionId.
 *
 * TODO Phase D, doc 13 Phase 4.
 */
export async function POST() {
  return Response.json(
    { error: "not implemented", todo: "Phase D, doc 13 Phase 4" },
    { status: 501 },
  );
}
