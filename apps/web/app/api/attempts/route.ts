/**
 * POST /api/attempts: persist one evaluated attempt (docs/03 data flow step
 * 11; docs/09 lesson_attempts; lesson-schema section 5).
 *
 * Validates with `AttemptRowSchema` from @grasp/types (task id, outcome,
 * score, timing, hints used, sessionId matching the cookie) and calls
 * `insertLessonAttempt()` from @grasp/db. MVP recomputes mastery from
 * lesson_attempts with `mastery()` from @grasp/learning; no progress table
 * write here.
 *
 * TODO Phase D, doc 13 Phase 4.
 */
export async function POST() {
  return Response.json(
    { error: "not implemented", todo: "Phase D, doc 13 Phase 4" },
    { status: 501 },
  );
}
