/**
 * POST /api/tutor: the single place a tutor engine is chosen, behind the TutorService seam (docs/03, "The seam
 * for a Python service"; docs/07 templates and guardrails; locked position 7). In MVP it calls
 * `TemplateTutorService` from @grasp/tutor in-process: deterministic templates over the lesson hint ladder and
 * manifest data, no network egress. A hosted metered LLM API is never a branch here.
 *
 * Validates the body, rejects a sessionId that differs from the cookie, loads the task from the lesson by id (the
 * body's copy of prompt and expect is never trusted), enforces the call caps (1 per attempt, 3 per task, 12 per
 * session), runs the engine, and writes one ai_interactions row for every call, capped or failed included. A
 * resolver throw or a guardrail failure answers the static hint with status fallback_invalid. Payload columns stay
 * null without consent_tutor_payloads.
 * ponytail: TUTOR_ENGINE=local and TUTOR_SERVICE_URL are not branches yet; the V1 engines still throw, so the
 * route always runs the template engine. Add the branch with the V1 local-model gate.
 */
import { loadLesson, loadManifest } from "@grasp/content";
import { aiInteractions, and, consentRecords, eq, isNull, sql } from "@grasp/db";
import { MAX_CALLS_PER_ATTEMPT, MAX_CALLS_PER_LESSON, MAX_CALLS_PER_TASK, TEMPLATE_VERSION, TemplateTutorService, staticFallback } from "@grasp/tutor";
import type { TutorCallStatus, TutorRequest } from "@grasp/types";
import { z } from "zod";
import type { TutorReply } from "@/lib/api-client";
import { badRequest, cookieSessionId, forbidden, getDb, unavailable } from "@/lib/db";

const Id = z.string().min(1).max(80);
const Body = z.object({
  sessionId: z.uuid(),
  lessonId: Id,
  activityId: Id,
  kind: z.enum(["hint", "explain_mistake"]),
  hintLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // Only the id is used; the rest is replaced from the lesson.
  task: z.object({ id: Id }).passthrough(),
  evaluation: z
    .object({
      outcome: z.enum(["correct", "partial", "incorrect"]),
      actual: z.object({ type: Id, componentId: Id.optional(), socketId: Id.optional(), hotspotId: Id.optional() }),
      attemptNo: z.int().min(1).max(100),
      hintsUsed: z.int().min(0).max(3),
      stepNo: z.int().min(1).max(50).optional(),
    })
    .nullable(),
  // SceneState: ids and numbers; the template engine reads none of it, so it is bounded, not shaped.
  scene: z.record(z.string(), z.unknown()).refine((s) => JSON.stringify(s).length < 8000, "scene too large"),
  locale: z.literal("en"),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error);
  const body = parsed.data;
  if (body.sessionId !== cookieSessionId(request)) return forbidden();
  if (body.kind === "explain_mistake" && (!body.evaluation || body.evaluation.outcome === "correct")) {
    return Response.json({ error: "explain_mistake needs an incorrect or partial evaluation" }, { status: 400 });
  }
  let lesson, manifest;
  try {
    lesson = loadLesson(body.lessonId);
    manifest = loadManifest(lesson.modelId);
  } catch {
    return Response.json({ error: `unknown lesson ${body.lessonId}` }, { status: 404 });
  }
  const activity = lesson.activities.find((a) => a.id === body.activityId);
  const task = activity?.tasks.find((t) => t.id === body.task.id);
  if (!activity || !task) return Response.json({ error: "unknown activity or task" }, { status: 404 });
  // Correct attempts and assessment never call the tutor (doc 07); guided and challenge do.
  if (activity.kind !== "guided" && activity.kind !== "challenge") return Response.json({ error: "no tutor in this activity" }, { status: 400 });

  const req: TutorRequest = {
    ...body,
    task: { id: task.id, type: task.type, prompt: task.prompt, objectiveStatement: lesson.objectives.find((o) => o.id === task.objectiveId)?.statement ?? "", expect: task.expect },
    evaluation: body.evaluation && { ...body.evaluation, expected: task.expect },
    scene: body.scene as unknown as TutorRequest["scene"],
  };
  const db = getDb();
  if (!db) return unavailable();

  try {
    const sessionId = body.sessionId;
    // Only a consented, not withdrawn session gets a tutor; its consent also gates the payload columns.
    const consent = await db.query.consentRecords.findFirst({
      where: and(eq(consentRecords.sessionId, sessionId), isNull(consentRecords.withdrawnAt)),
      columns: { consentTutorPayloads: true },
    });
    if (!consent) return forbidden();
    const attemptNo = body.evaluation?.attemptNo ?? null;
    const [counts] = await db
      .select({
        lesson: sql<number>`count(*)::int`,
        task: sql<number>`count(*) filter (where ${aiInteractions.taskId} = ${task.id})::int`,
        attempt: sql<number>`count(*) filter (where ${aiInteractions.taskId} = ${task.id} and ${aiInteractions.attemptNo} = ${attemptNo})::int`,
      })
      .from(aiInteractions)
      // Capped rows are logged but are not calls, so they never count toward a cap.
      .where(and(eq(aiInteractions.sessionId, sessionId), eq(aiInteractions.lessonId, lesson.id), sql`${aiInteractions.status} <> 'capped'`));
    const capped =
      counts!.lesson >= MAX_CALLS_PER_LESSON || counts!.task >= MAX_CALLS_PER_TASK || (attemptNo !== null && counts!.attempt >= MAX_CALLS_PER_ATTEMPT);

    const started = performance.now();
    let status: TutorCallStatus = capped ? "capped" : "ok";
    let response = staticFallback(req, task);
    if (!capped) {
      try {
        const tutor = new TemplateTutorService({ manifest, lesson });
        response = body.kind === "hint" ? await tutor.hint(req) : await tutor.explainMistake(req);
      } catch (err) {
        console.warn("tutor fallback:", err instanceof Error ? err.message : err);
        status = "fallback_invalid";
      }
    }
    const latencyMs = Math.round(performance.now() - started);

    const [row] = await db
      .insert(aiInteractions)
      .values({
        sessionId,
        lessonId: lesson.id,
        activityId: activity.id,
        taskId: task.id,
        attemptNo,
        kind: body.kind,
        hintLevel: body.hintLevel,
        engine: "template",
        templateVersion: TEMPLATE_VERSION,
        status,
        latencyMs,
        ...(consent.consentTutorPayloads && { requestJson: req as unknown as Record<string, unknown>, responseJson: response as unknown as Record<string, unknown>, deliveredText: response.text }),
      })
      .returning({ id: aiInteractions.id });
    const reply: TutorReply = { status, source: status === "ok" ? "tutor" : "static", interactionId: row!.id, latencyMs, response };
    return Response.json(reply);
  } catch (err) {
    console.error("POST /api/tutor", err);
    return unavailable();
  }
}
