/**
 * Typed browser-side clients for the route handlers in app/api (docs/03,
 * "Backend modules"). This file and lib/logger-transport.ts are the only
 * client code that calls the network (docs/16, package boundaries).
 *
 * Payload types are `unknown` until @grasp/types lands the Zod-derived
 * request shapes (TutorRequest, AttemptRow, LogEvent).
 *
 * TODO Phase D, doc 13 Phase 4-5: implement with fetch against same origin,
 * sending the sessionId from sessionStore and reading the httpOnly cookie
 * server-side; reject on non-2xx with the route's error body.
 */
const NOT_IMPLEMENTED = "api-client: not implemented (Phase D)";

export async function createSession(_payload: unknown): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function resolveSessionCode(_code: string): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function withdrawSession(_sessionId: string): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function requestTutor(_request: unknown): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function postAttempt(_attempt: unknown): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}

/** V1: MVP recomputes mastery from lesson_attempts; no progress upsert. */
export async function putProgress(_progress: unknown): Promise<never> {
  throw new Error(NOT_IMPLEMENTED);
}
