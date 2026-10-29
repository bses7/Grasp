/**
 * Server-only database access for route handlers (doc 09, doc 16: packages never open connections).
 * One postgres.js client per server process; null when DATABASE_URL is unset, so the routes answer 503 and
 * the lesson runs unsaved instead of crashing.
 */
import { createDb, type Db } from "@grasp/db";
import { z } from "zod";
import { getEnv } from "./env";

let db: Db | null | undefined;

export function getDb(): Db | null {
  if (db === undefined) {
    const url = getEnv().DATABASE_URL;
    db = url ? createDb({ connectionString: url }) : null;
  }
  return db;
}

/** The anonymous research session lives in this httpOnly, SameSite=Strict cookie (doc 03 "Authentication"). */
export const SESSION_COOKIE = "grasp_session";

const Uuid = z.uuid();

/** Unambiguous characters for the printed participant code. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const participantCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

/** The cookie's sessionId, or null when absent or malformed. */
export function cookieSessionId(request: Request): string | null {
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === SESSION_COOKIE)?.[1];
  return raw && Uuid.safeParse(raw).success ? raw : null;
}

export const unavailable = () => Response.json({ error: "database unavailable" }, { status: 503 });
export const forbidden = () => Response.json({ error: "session does not match the cookie" }, { status: 403 });
export const badRequest = (error: z.ZodError) => Response.json({ error: z.prettifyError(error) }, { status: 400 });
