/**
 * /api/tutor against local Postgres (doc 07 request flow, roadmap Phase 5 deliverable "the fallback demonstrated
 * by forcing the cap"): a mistake is explained once per attempt, a second call on the same attempt is capped and
 * answers the static hint, every call writes an ai_interactions row, and payload columns stay null without
 * consent_tutor_payloads. Skipped when no database answers, like the A21 test.
 */
import { loadLesson } from "@grasp/content";
import { aiInteractions, closeDb, consentRecords, createDb, eq, researchSessions } from "@grasp/db";
import { afterAll, describe, expect, it, vi } from "vitest";

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/grasp";
vi.stubEnv("DATABASE_URL", url);
const db = createDb({ connectionString: url });
const up = await db.$client`select 1`.then(
  () => true,
  () => false,
);
afterAll(() => closeDb(db));

const { POST } = await import("./route");
const { SESSION_COOKIE } = await import("@/lib/db");

const call = (sessionId: string, body: Record<string, unknown>, cookieId = sessionId) =>
  POST(
    new Request("http://localhost/api/tutor", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${cookieId}` },
      body: JSON.stringify({
        sessionId,
        lessonId: "anatomy.heart.chambers_v1",
        activityId: "act_guided",
        kind: "explain_mistake",
        hintLevel: 1,
        task: { id: "t_g1", prompt: "forged" },
        evaluation: { outcome: "incorrect", actual: { type: "select", componentId: "right_ventricle" }, attemptNo: 1, hintsUsed: 0 },
        scene: { modelId: "heart_v1" },
        locale: "en",
        ...body,
      }),
    }),
  );

describe.skipIf(!up)("POST /api/tutor", () => {
  it("explains, caps the second call on an attempt with the static hint, and logs every call", async () => {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(researchSessions).values({
      id, participantCode: `T${id.slice(0, 5)}`.toUpperCase(), assignmentCode: `TEST-${id}`, condition: "mouse", studyPhase: "dev",
      consentVersion: "test", lessonId: "anatomy.heart.chambers_v1", lessonHash: "h", appVersion: "test", startedAt: now,
    });
    await db.insert(consentRecords).values({ sessionId: id, consentVersion: "test", consentLogging: true, consentTutorPayloads: false, agreedAt: now });

    const first = await (await call(id, {})).json();
    expect(first).toMatchObject({ status: "ok", source: "tutor" });
    expect(first.response.text).toMatch(/^You selected the Right Ventricle/);

    const again = await (await call(id, {})).json();
    expect(again).toMatchObject({ status: "capped", source: "static" });
    const g1 = loadLesson("anatomy.heart.chambers_v1").activities.flatMap((a) => a.tasks).find((t) => t.id === "t_g1")!;
    expect(again.response.text).toBe(g1.hints.find((h) => h.level === 1)!.text);

    expect((await call(id, {}, crypto.randomUUID())).status).toBe(403); // cookie and body disagree
    expect((await call(crypto.randomUUID(), {})).status).toBe(403); // no consented session
    const rows = await db.select().from(aiInteractions).where(eq(aiInteractions.sessionId, id));
    expect(rows.map((r) => r.status).sort()).toEqual(["capped", "ok"]);
    expect(rows.every((r) => r.requestJson === null && r.deliveredText === null && r.engine === "template")).toBe(true);

    await db.delete(researchSessions).where(eq(researchSessions.id, id));
    await db.delete(consentRecords).where(eq(consentRecords.sessionId, id));
  });
});
