/**
 * A21 integration test (doc 12): withdrawal deletes the session's rows from every research table and keeps the
 * consent record with withdrawn_at. Runs against DATABASE_URL (default local Postgres on 5433); skipped when no
 * database answers, so `pnpm test` stays green without Docker.
 */
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, closeDb } from "./client";
import { exportSession, withdrawSession } from "./privacy";
import { consentRecords, eventLogs, lessonAttempts, researchSessions } from "./schema";

const db = createDb({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/grasp" });
const up = await db.$client`select 1`.then(
  () => true,
  () => false,
);
afterAll(() => closeDb(db));

describe.skipIf(!up)("withdrawSession (A21)", () => {
  it("cascades over the research tables and keeps the consent record", async () => {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(researchSessions).values({
      id, participantCode: `T${id.slice(0, 5)}`.toUpperCase(), assignmentCode: `TEST-${id}`, condition: "mouse", studyPhase: "dev",
      consentVersion: "test", lessonId: "l", lessonHash: "h", appVersion: "test", startedAt: now,
    });
    await db.insert(consentRecords).values({ sessionId: id, consentVersion: "test", consentLogging: true, consentTutorPayloads: false, agreedAt: now });
    await db.insert(eventLogs).values({ sessionId: id, seq: 0, t: 0, type: "task_start", payload: { taskId: "x" } });
    await db.insert(lessonAttempts).values({
      sessionId: id, lessonId: "l", lessonHash: "h", activityId: "a", activityKind: "guided", taskId: "x", taskType: "place",
      objectiveId: "o", attemptNo: 1, outcome: "correct", score: "1", scoreMax: "1", hintsUsed: 0, durationMs: 1, actual: { type: "place" }, t: 0,
    });
    expect((await exportSession(db, id)).events).toHaveLength(1);

    await withdrawSession(db, id);
    const after = await exportSession(db, id);
    expect(after.session).toBeNull();
    expect([after.events, after.attempts, after.instruments, after.tutor]).toEqual([[], [], [], []]);
    expect(after.consent).toHaveLength(1);
    expect(after.consent[0]!.withdrawnAt).toBeInstanceOf(Date);

    await db.delete(consentRecords).where(eq(consentRecords.sessionId, id)); // test cleanup
  });
});
