/**
 * Exports one session's six MVP tables as a single JSON document, the same shape GET /api/session/:id/export returns,
 * for the participant-export requirement in doc 09 "Retention, deletion, and export" and doc 14 section 7.
 * Usage: pnpm research:export <sessionId | participantCode | sessionCode> [out.json]   (DATABASE_URL, default local Postgres)
 */
import { writeFileSync } from "node:fs";
import { closeDb, createDb, exportSession, findSession } from "../../packages/db/src/index";

const [key, out] = process.argv.slice(2);
if (!key) {
  console.error("usage: pnpm research:export <sessionId | participantCode | sessionCode> [out.json]");
  process.exit(1);
}
const db = createDb({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/grasp" });
const id = await findSession(db, key);
if (!id) {
  console.error(`no session for ${key}`);
  await closeDb(db);
  process.exit(1);
}
const file = out ?? `grasp-data-${id.slice(0, 8)}.json`;
writeFileSync(file, JSON.stringify(await exportSession(db, id), null, 2));
console.log(`wrote ${file}`);
await closeDb(db);
