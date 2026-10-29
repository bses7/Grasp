/**
 * Per-session research metrics (doc 14 section 2; doc 12 A3 and A16; roadmap step 4.7), computed by sessionMetrics
 * in @grasp/learning from event_logs and instrument_responses.
 *
 *   pnpm research:metrics <sessionId | participantCode | grasp-log-*.json>   full metrics for one session as JSON
 *   pnpm research:metrics --phase dev|pilot|main                            one summary line per session
 *
 * From the database it also checks that every task_attempt event has its lesson_attempts row. Exits 1 when a
 * session fails a check (seq gap, attempt outside its task, place while tracking was lost, attempt rows missing).
 * DATABASE_URL, default local Postgres.
 */
import { existsSync, readFileSync } from "node:fs";
import type { LogEvent } from "@grasp/types";
import {
  asc, closeDb, createDb, eq, eventLogs, findSession, instrumentResponses, lessonAttempts, researchSessions, type Db,
} from "../../packages/db/src/index";
import { sessionMetrics } from "../../packages/learning/src/index";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: pnpm research:metrics <sessionId | participantCode | log.json> | --phase dev|pilot|main");
  process.exit(1);
}

if (args[0]!.endsWith(".json") && existsSync(args[0]!)) {
  const m = sessionMetrics(JSON.parse(readFileSync(args[0]!, "utf8")) as LogEvent[]);
  console.log(JSON.stringify(m, null, 2));
  process.exit(m.ok ? 0 : 1);
}

const db = createDb({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/grasp" });

async function forSession(db: Db, id: string) {
  const [session] = await db.select().from(researchSessions).where(eq(researchSessions.id, id));
  const rows = await db.select().from(eventLogs).where(eq(eventLogs.sessionId, id)).orderBy(asc(eventLogs.seq));
  const events = rows.map((r): LogEvent => ({ sessionId: id, condition: session!.condition as LogEvent["condition"], seq: r.seq, t: r.t, type: r.type as LogEvent["type"], payload: r.payload as LogEvent["payload"] }));
  const instruments = await db.select().from(instrumentResponses).where(eq(instrumentResponses.sessionId, id));
  const attemptRows = (await db.select({ id: lessonAttempts.id }).from(lessonAttempts).where(eq(lessonAttempts.sessionId, id))).length;
  const m = sessionMetrics(events, instruments);
  // Every graded attempt is logged twice: as a task_attempt event (consent-gated) and as a lesson_attempts row.
  const attemptsMatch = !events.length || attemptRows === m.checks.attempts;
  return { session: session!, m: { ...m, checks: { ...m.checks, attemptRows }, ok: m.ok && attemptsMatch } };
}

let failed = false;
if (args[0] === "--phase") {
  const sessions = await db.select({ id: researchSessions.id }).from(researchSessions).where(eq(researchSessions.studyPhase, args[1] ?? "pilot"));
  for (const { id } of sessions) {
    const { session, m } = await forSession(db, id);
    failed ||= !m.ok;
    const pct = (x: number | null) => (x === null ? "  n/a" : `${Math.round(x * 100)}%`.padStart(5));
    console.log(
      [
        session.participantCode,
        session.condition.padEnd(7),
        `events ${String(m.checks.events).padStart(4)}`,
        `attempts ${m.checks.attempts}/${m.checks.attemptRows}`,
        `place ${pct(m.interaction.placementAccuracy)}`,
        `identify ${pct(m.interaction.selectionAccuracy)}`,
        `mastery ${pct(m.learning.masteryRate)}`,
        `lost ${pct(m.cv?.trackingLostFraction ?? null)}`,
        `p95 ${m.cv?.inferenceMsP95 ?? "n/a"}`,
        m.ok ? "OK" : "FAIL",
      ].join("  "),
    );
  }
  if (!sessions.length) console.log(`no ${args[1]} sessions`);
} else {
  const id = await findSession(db, args[0]!);
  if (!id) {
    console.error(`no session for ${args[0]}`);
    failed = true;
  } else {
    const { m } = await forSession(db, id);
    console.log(JSON.stringify(m, null, 2));
    failed = !m.ok;
  }
}
await closeDb(db);
process.exit(failed ? 1 : 0);
