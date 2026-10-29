/**
 * POST /api/session: create or resume an anonymous research session (doc 03 "Authentication", doc 09
 * research_sessions) and return what the lesson page needs to resume from the attempt log.
 *
 * Two bodies (step 4.6):
 * - from the consent form, `{ sessionId, lessonId, assignmentCode, consent }`: creates the session with the phase
 *   and condition the researcher's code encodes, plus its consent_records row, in one transaction. A used code
 *   answers 409; dev codes (DG, DM) get a unique suffix so the developer can reuse them.
 * - from the lesson page, `{ sessionId, lessonId, condition }`: resumes only. Order: the httpOnly cookie's session,
 *   then the body's sessionId (the localStorage fallback doc 03 names), each only if it ran the same lesson in the
 *   same condition and has a consent record. Otherwise 404, and the page sends the learner to /consent.
 */
import { contentHash, loadLesson, loadManifest } from "@grasp/content";
import { and, asc, consentRecords, eq, eventLogs, lessonAttempts, max, researchSessions } from "@grasp/db";
import type { AttemptRecord } from "@grasp/types";
import { z } from "zod";
import { CONSENT_VERSION, parseAssignmentCode } from "@/lib/consent";
import { badRequest, cookieSessionId, getDb, participantCode, SESSION_COOKIE, unavailable } from "@/lib/db";

const Resume = z.object({ sessionId: z.uuid(), lessonId: z.string().min(1), condition: z.enum(["gesture", "mouse"]) });
const Create = z.object({
  sessionId: z.uuid(),
  lessonId: z.string().min(1),
  assignmentCode: z.string().max(20),
  consent: z.object({ version: z.literal(CONSENT_VERSION), logging: z.boolean() }),
});
const Body = z.union([Create, Resume]);


export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const { lessonId } = parsed.data;
  const assignment = "assignmentCode" in parsed.data ? parseAssignmentCode(parsed.data.assignmentCode) : null;
  if ("assignmentCode" in parsed.data && !assignment) return Response.json({ error: "unknown session code" }, { status: 400 });
  const condition = assignment?.condition ?? (parsed.data as z.infer<typeof Resume>).condition;
  let lesson;
  try {
    lesson = loadLesson(lessonId);
  } catch {
    return Response.json({ error: `unknown lesson ${lessonId}` }, { status: 404 });
  }
  const db = getDb();
  if (!db) return unavailable();

  try {
    const lessonHash = await contentHash(loadManifest(lesson.modelId), lesson);
    const sameRun = async (id: string) => {
      const [hit] = await db
        .select({ session: researchSessions, logging: consentRecords.consentLogging })
        .from(researchSessions)
        .innerJoin(consentRecords, and(eq(consentRecords.sessionId, researchSessions.id), eq(consentRecords.consentVersion, researchSessions.consentVersion)))
        .where(and(eq(researchSessions.id, id), eq(researchSessions.lessonId, lessonId), eq(researchSessions.condition, condition)));
      return hit;
    };
    let row: typeof researchSessions.$inferSelect;
    let consentLogging: boolean;
    const resumed = !assignment;
    if (!assignment) {
      const cookieId = cookieSessionId(request);
      const hit = (cookieId && (await sameRun(cookieId))) || (await sameRun(parsed.data.sessionId));
      if (!hit) return Response.json({ error: "no consented session; start at /consent" }, { status: 404 });
      ({ session: row, logging: consentLogging } = hit);
    } else {
      const { consent } = parsed.data as z.infer<typeof Create>;
      // A body id already used by another session gets a fresh one.
      const taken = await db.query.researchSessions.findFirst({ where: eq(researchSessions.id, parsed.data.sessionId) });
      const id = taken ? crypto.randomUUID() : parsed.data.sessionId;
      const code = assignment.studyPhase === "dev" ? `${assignment.code}-${id.slice(0, 8)}` : assignment.code;
      if (await db.query.researchSessions.findFirst({ where: eq(researchSessions.assignmentCode, code), columns: { id: true } })) {
        return Response.json({ error: "this session code was already used" }, { status: 409 });
      }
      const now = new Date();
      row = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(researchSessions)
          .values({
            id,
            participantCode: participantCode(),
            assignmentCode: code,
            condition,
            studyPhase: assignment.studyPhase,
            consentVersion: consent.version,
            lessonId,
            lessonHash,
            appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
            startedAt: now,
          })
          .returning();
        // ponytail: tutor payload consent is asked when the tutor ships (Phase 5); false until then.
        await tx.insert(consentRecords).values({ sessionId: id, consentVersion: consent.version, consentLogging: consent.logging, consentTutorPayloads: false, agreedAt: now });
        return created!;
      });
      consentLogging = consent.logging;
    }
    const id = row.id;
    const attempts = await db.select().from(lessonAttempts).where(eq(lessonAttempts.sessionId, id)).orderBy(asc(lessonAttempts.t));
    const [{ last }] = await db.select({ last: max(eventLogs.seq) }).from(eventLogs).where(eq(eventLogs.sessionId, id));

    const body = {
      sessionId: id,
      resumed,
      condition,
      studyPhase: row.studyPhase,
      consentLogging,
      participantCode: row.participantCode,
      lessonHash: row.lessonHash,
      contentChanged: row.lessonHash !== lessonHash,
      elapsedMs: Date.now() - row.startedAt.getTime(),
      nextSeq: last === null ? 0 : last + 1,
      skipped: row.skippedTaskIds,
      attempts: attempts.map(
        (a): AttemptRecord => ({
          sessionId: a.sessionId,
          lessonId: a.lessonId,
          lessonHash: a.lessonHash,
          activityId: a.activityId,
          activityKind: a.activityKind as AttemptRecord["activityKind"],
          taskId: a.taskId,
          taskType: a.taskType as AttemptRecord["taskType"],
          objectiveId: a.objectiveId,
          attemptNo: a.attemptNo,
          microTask: a.microTask,
          remediated: a.remediated,
          outcome: a.outcome as AttemptRecord["outcome"],
          score: Number(a.score),
          scoreMax: Number(a.scoreMax),
          hintsUsed: a.hintsUsed,
          durationMs: a.durationMs,
          actual: a.actual,
          t: a.t,
        }),
      ),
    };
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return Response.json(body, {
      headers: { "set-cookie": `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secure}` },
    });
  } catch (err) {
    console.error("POST /api/session", err);
    return unavailable();
  }
}
