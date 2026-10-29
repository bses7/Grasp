/**
 * Database client factory. postgres.js driver for local Docker Postgres and Neon over TCP (doc 09 "Postgres hosting").
 * The only callers are apps/web route handlers and scripts/; packages never open connections (doc 16, Package boundaries).
 */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

export type DbClientOptions = {
  /** Postgres connection string; from DATABASE_URL. */
  connectionString: string;
  /** Serverless functions should keep this at 1 (doc 09, Drizzle checklist point 6). */
  maxConnections?: number;
};

/** Creates a Drizzle client over postgres.js. Doc 09. */
export function createDb({ connectionString, maxConnections = 1 }: DbClientOptions): Db {
  // connect_timeout: a missing local Postgres fails fast, so the lesson falls back to running unsaved.
  return drizzle(postgres(connectionString, { max: maxConnections, connect_timeout: 3 }), { schema });
}

/** Closes the underlying pool; scripts call this before exit. */
export async function closeDb(db: Db): Promise<void> {
  await db.$client.end();
}
