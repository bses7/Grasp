/**
 * POST /api/session/:id/restart: "Try again" after the results, dev sessions only (a retake would contaminate pilot
 * or study data, so those answer 403). Creates a fresh session for the same lesson and condition, copies the
 * consent given for this one (same version and logging choice), and moves the cookie to it. The old session stays.
 */
import { and, consentRecords, eq, researchSessions } from "@grasp/db";
import { z } from "zod";
import { cookieSessionId, forbidden, getDb, participantCode, SESSION_COOKIE, unavailable } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || cookieSessionId(request) !== id) return forbidden();
  const db = getDb();
  if (!db) return unavailable();
  try {
    const [old] = await db
      .select({ s: researchSessions, c: consentRecords })
      .from(researchSessions)
      .innerJoin(consentRecords, and(eq(consentRecords.sessionId, researchSessions.id), eq(consentRecords.consentVersion, researchSessions.consentVersion)))
      .where(eq(researchSessions.id, id));
    if (!old || old.s.studyPhase !== "dev") return forbidden();
    const fresh = crypto.randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(researchSessions).values({
        ...old.s,
        id: fresh,
        participantCode: participantCode(),
        assignmentCode: `${old.s.assignmentCode.split("-")[0]}-${fresh.slice(0, 8)}`,
        startedAt: now,
        endedAt: null,
        skippedTaskIds: [],
        createdAt: now,
      });
      await tx.insert(consentRecords).values({ ...old.c, id: undefined, sessionId: fresh, agreedAt: now, createdAt: now });
    });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return Response.json(
      { sessionId: fresh },
      { headers: { "set-cookie": `${SESSION_COOKIE}=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secure}` } },
    );
  } catch (err) {
    console.error("POST /api/session/:id/restart", err);
    return unavailable();
  }
}
