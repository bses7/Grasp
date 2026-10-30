/**
 * Typed browser-side clients for the route handlers in app/api (doc 03 "Backend modules"). This file and
 * lib/logger-transport.ts are the only client code that calls the network (doc 16, package boundaries).
 * Same origin only; the httpOnly session cookie travels with every request.
 */
import { HINT_LATENCY_BUDGET_MS } from "@grasp/tutor";
import type { AttemptRecord, StudyCondition, TutorCallStatus, TutorRequest, TutorResponse } from "@grasp/types";

export type SessionInfo = {
  sessionId: string;
  resumed: boolean;
  condition: StudyCondition;
  /** `dev` sessions (developer codes DG, DM) may "Try again" after the results. */
  studyPhase: "pilot" | "main" | "dev";
  /** The participant agreed to the event log; without it the logger drops every event. */
  consentLogging: boolean;
  participantCode: string | null;
  lessonHash: string;
  /** The lesson or manifest changed since this session started; its attempts may not match the content. */
  contentChanged: boolean;
  /** ms since the session started on the server's clock, so a resumed log keeps one time base. */
  elapsedMs: number;
  nextSeq: number;
  attempts: AttemptRecord[];
  skipped: string[];
};

/** A failed request; `status` lets callers tell "no consented session" (404) or "code used" (409) from an outage. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new ApiError(res.status, `${res.url}: ${res.status} ${await res.text().catch(() => "")}`);
  return res;
}

/**
 * Create the session from the consent form (with the researcher's code and the consent given), or resume the
 * consented session for this lesson and condition (POST /api/session; 404 when there is none).
 */
export async function createSession(
  body:
    | { sessionId: string; lessonId: string; condition: StudyCondition }
    | { sessionId: string; lessonId: string; assignmentCode: string; consent: { version: string; logging: boolean } },
): Promise<SessionInfo> {
  const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await ok(res)).json() as Promise<SessionInfo>;
}

/** Persist attempts; `id` makes a retry idempotent (POST /api/attempts). */
export async function postAttempts(attempts: (AttemptRecord & { id: string })[]): Promise<void> {
  await ok(await fetch("/api/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attempts }) }));
}

/** "Try again" for a dev session: a fresh session with the same consent; the cookie moves to it. */
export async function restartSession(sessionId: string): Promise<{ sessionId: string }> {
  return (await ok(await fetch(`/api/session/${sessionId}/restart`, { method: "POST" }))).json() as Promise<{ sessionId: string }>;
}

/** Lesson progress that is not an attempt (PATCH /api/session/:id); keepalive so a skip right before a reload lands. */
export async function updateSession(sessionId: string, body: { skip: string } | { ended: true }): Promise<void> {
  await ok(await fetch(`/api/session/${sessionId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }));
}

/** What POST /api/tutor answers: the tutor's text (source "tutor") or the static hint it fell back to. */
export type TutorReply = { status: TutorCallStatus; source: "tutor" | "static"; interactionId: string; latencyMs: number; response: TutorResponse };

/**
 * One tutor call (doc 07 request flow). Times out at HINT_LATENCY_BUDGET_MS with no retry; the caller keeps the
 * static hint on any rejection.
 */
export async function askTutor(req: TutorRequest): Promise<TutorReply> {
  const res = await fetch("/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(HINT_LATENCY_BUDGET_MS),
  });
  return (await ok(res)).json() as Promise<TutorReply>;
}

/** Withdraw: delete the session and everything under it (DELETE /api/session/:id). */
export async function withdrawSession(sessionId: string): Promise<void> {
  await ok(await fetch(`/api/session/${sessionId}`, { method: "DELETE" }));
}
