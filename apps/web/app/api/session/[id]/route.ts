import { and, eq, researchSessions, sql, withdrawSession } from "@grasp/db";
import { z } from "zod";
import { badRequest, cookieSessionId, forbidden, getDb, SESSION_COOKIE, unavailable } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/session/:code: resolve a printed participant code for the retention form only (doc 03 session
 * lifecycle). Arrives with the retention page; not part of step 4.5.
 */
export async function GET(_request: Request, _context: RouteContext) {
  return Response.json({ error: "not implemented", todo: "retention form (doc 13 Phase 4, S2)" }, { status: 501 });
}

const Progress = z.union([z.strictObject({ skip: z.string().min(1).max(100) }), z.strictObject({ ended: z.literal(true) })]);

/**
 * PATCH /api/session/:id: lesson progress that is not an attempt, kept for every consented session (not the
 * consent-gated event log): `{ skip: taskId }` records a skipped task for resume; `{ ended: true }` stamps ended_at
 * once, when the lesson reaches its results. The id must equal the cookie's.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || cookieSessionId(request) !== id) return forbidden();
  const parsed = Progress.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const db = getDb();
  if (!db) return unavailable();
  try {
    const body = parsed.data;
    await ("skip" in body
      ? db
          .update(researchSessions)
          .set({ skippedTaskIds: sql`array_append(${researchSessions.skippedTaskIds}, ${body.skip})` })
          .where(and(eq(researchSessions.id, id), sql`not (${body.skip} = any(${researchSessions.skippedTaskIds}))`))
      : db
          .update(researchSessions)
          .set({ endedAt: new Date() })
          .where(and(eq(researchSessions.id, id), sql`${researchSessions.endedAt} is null`)));
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("PATCH /api/session/:id", err);
    return unavailable();
  }
}

/**
 * DELETE /api/session/:id: participant withdrawal. The id must equal the cookie's sessionId; the delete cascades
 * to every table that references the session through its foreign keys (doc 09, doc 15), the consent_records row
 * stays with withdrawn_at set, and the cookie is cleared. The researcher deletes by participant code with
 * `pnpm research:delete`.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || cookieSessionId(request) !== id) return forbidden();
  const db = getDb();
  if (!db) return unavailable();
  try {
    await withdrawSession(db, id);
    console.info("session deleted"); // the audit line doc 09 names; the id itself is not logged
    return new Response(null, { status: 204, headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` } });
  } catch (err) {
    console.error("DELETE /api/session/:id", err);
    return unavailable();
  }
}
