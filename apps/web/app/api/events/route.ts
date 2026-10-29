/**
 * POST /api/events: research log ingest (doc 03 data flow step 10; doc 09 event_logs; research-protocol §4).
 * Body: a batch of at most 50 LogEvents, as application/json or a `sendBeacon` text/plain string, every
 * sessionId equal to the cookie's. Payload values are scalars only, so no landmark or coordinate stream fits.
 * The session must have logging consent that is not withdrawn (doc 09 consent_logging; the client logger
 * already drops events without it, this is the server-side check), else 403. Inserts are idempotent on (session_id, seq), so a retried batch is harmless. (ended_at is stamped by
 * PATCH /api/session/:id, which does not depend on logging consent.)
 * ponytail: one generic payload check (scalar values, bounded size); the per-type strict() schemas of doc 14
 * §6.1 are not built. The metrics script (4.7) tolerates missing keys (a metric goes null), so add them when a
 * malformed payload is actually seen.
 */
import { and, consentRecords, eq, eventLogs, isNull, LOG_EVENT_TYPES, researchSessions, sql } from "@grasp/db";
import { z } from "zod";
import { badRequest, cookieSessionId, forbidden, getDb, unavailable } from "@/lib/db";

const Scalar = z.union([z.string().max(300), z.number(), z.boolean(), z.null()]);
const Event = z.strictObject({
  sessionId: z.uuid(),
  condition: z.enum(["gesture", "mouse"]),
  seq: z.int().min(0),
  t: z.int(),
  type: z.enum(LOG_EVENT_TYPES),
  payload: z
    .record(z.string().max(40), Scalar)
    .refine((p) => Object.keys(p).length <= 16, "too many payload keys")
    .refine((p) => !("ua" in p), "no user agent (doc 14 device_info, data minimisation)"),
});
const Batch = z.array(Event).min(1).max(50);

export async function POST(request: Request) {
  const text = await request.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* rejected below */
  }
  const parsed = Batch.safeParse(json);
  if (!parsed.success) return badRequest(parsed.error);
  const sessionId = cookieSessionId(request);
  if (!sessionId || parsed.data.some((e) => e.sessionId !== sessionId)) return forbidden();
  const db = getDb();
  if (!db) return unavailable();
  try {
    const consent = await db.query.consentRecords.findFirst({
      where: and(eq(consentRecords.sessionId, sessionId), eq(consentRecords.consentLogging, true), isNull(consentRecords.withdrawnAt)),
      columns: { id: true },
    });
    if (!consent) return forbidden();
    await db
      .insert(eventLogs)
      .values(parsed.data.map(({ sessionId: s, seq, t, type, payload }) => ({ sessionId: s, seq, t, type, payload })))
      .onConflictDoNothing();
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("POST /api/events", err);
    return unavailable();
  }
}
