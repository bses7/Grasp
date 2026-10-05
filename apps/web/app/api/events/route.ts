/**
 * POST /api/events: research log ingest (docs/03 data flow step 10; docs/09
 * event_logs; research-protocol section 4).
 *
 * Validates a batch with `LogEventBatchSchema` from @grasp/types (array of
 * LogEvent, max 50, sessionId matching the cookie; landmarks and video are
 * not valid event payloads) and calls `insertEventLogs()` from @grasp/db.
 * Accepts `sendBeacon` bodies (text/plain) as well as application/json.
 *
 * TODO Phase D M10 (event log) for the client buffer; this route in doc 13
 * Phase 4.
 */
export async function POST() {
  return Response.json(
    { error: "not implemented", todo: "Phase D M10 / doc 13 Phase 4" },
    { status: 501 },
  );
}
