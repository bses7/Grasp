type RouteContext = { params: Promise<{ id: string }> };

const NOT_IMPLEMENTED = { error: "not implemented", todo: "Phase D, doc 13 Phase 4" };

/**
 * GET /api/session/:code: resolve a printed session code to a sessionId for
 * the retention form only (docs/03 session lifecycle). Validates `:id` with
 * `SessionCodeSchema` from @grasp/types and calls
 * `resolveSessionCode()` from @grasp/db.
 */
export async function GET(_request: Request, _context: RouteContext) {
  return Response.json(NOT_IMPLEMENTED, { status: 501 });
}

/**
 * DELETE /api/session/:id: participant withdrawal. Verifies the sessionId
 * against the cookie, then `deleteResearchSession()` from @grasp/db cascades
 * to lesson_attempts, progress, event_logs, ai_interactions (docs/09, docs/15
 * data retention and deletion).
 */
export async function DELETE(_request: Request, _context: RouteContext) {
  return Response.json(NOT_IMPLEMENTED, { status: 501 });
}
