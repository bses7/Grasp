/**
 * Participant export and withdrawal (doc 09 "Retention, deletion, and export", doc 14 section 7), shared by the
 * cookie-gated routes and the researcher's scripts (by participant code).
 */
import { asc, eq, or } from "drizzle-orm";
import type { Db } from "./client";
import { aiInteractions, consentRecords, eventLogs, instrumentResponses, lessonAttempts, researchSessions } from "./schema";

/**
 * Session id for a session id, a printed participant code, or the researcher's assignment code (e.g. PG-014, so a
 * participant who stopped before the results screen can still be found); null when none matches.
 */
export async function findSession(db: Db, key: string): Promise<string | null> {
  const code = key.trim().toUpperCase();
  const row = await db.query.researchSessions.findFirst({
    where: /^[0-9a-f-]{36}$/i.test(key)
      ? eq(researchSessions.id, key)
      : or(eq(researchSessions.participantCode, code), eq(researchSessions.assignmentCode, code)),
    columns: { id: true },
  });
  return row?.id ?? null;
}

/** The six MVP tables for one session as one JSON-ready document. */
export async function exportSession(db: Db, id: string) {
  const [session] = await db.select().from(researchSessions).where(eq(researchSessions.id, id));
  return {
    session: session ?? null,
    consent: await db.select().from(consentRecords).where(eq(consentRecords.sessionId, id)),
    attempts: await db.select().from(lessonAttempts).where(eq(lessonAttempts.sessionId, id)).orderBy(asc(lessonAttempts.t)),
    events: await db.select().from(eventLogs).where(eq(eventLogs.sessionId, id)).orderBy(asc(eventLogs.seq)),
    instruments: await db.select().from(instrumentResponses).where(eq(instrumentResponses.sessionId, id)),
    tutor: await db.select().from(aiInteractions).where(eq(aiInteractions.sessionId, id)),
  };
}

/**
 * Withdrawal: stamp withdrawn_at on the consent rows, then delete the session, which cascades to every other
 * table. One transaction. The consent rows stay as proof the request was honoured.
 */
export async function withdrawSession(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(consentRecords).set({ withdrawnAt: new Date() }).where(eq(consentRecords.sessionId, id));
    await tx.delete(researchSessions).where(eq(researchSessions.id, id));
  });
}
