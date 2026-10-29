/**
 * Researcher-side withdrawal (doc 14 section 7: the participant quotes their code, the researcher deletes; confirm
 * within 7 days). Same effect as DELETE /api/session/:id: every research row goes, the consent row stays with
 * withdrawn_at set as proof.
 * Usage: pnpm research:delete <sessionId | participantCode | sessionCode>   (DATABASE_URL, default local Postgres)
 */
import { closeDb, createDb, findSession, withdrawSession } from "../../packages/db/src/index";

const [key] = process.argv.slice(2);
if (!key) {
  console.error("usage: pnpm research:delete <sessionId | participantCode | sessionCode>");
  process.exit(1);
}
const db = createDb({ connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/grasp" });
const id = await findSession(db, key);
if (id) await withdrawSession(db, id);
console.log(id ? `deleted session ${id.slice(0, 8)}…; consent record kept with withdrawn_at` : `no session for ${key}`);
await closeDb(db);
process.exit(id ? 0 : 1);
