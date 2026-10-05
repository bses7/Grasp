/**
 * Database client factory. postgres.js driver for local Docker Postgres and Neon over TCP (doc 09 "Postgres hosting").
 * The only callers are apps/web route handlers and scripts/; packages never open connections (doc 16, Package boundaries).
 */
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

export type DbClientOptions = {
  /** Postgres connection string; from DATABASE_URL. */
  connectionString: string;
  /** Serverless functions should keep this at 1 (doc 09, Drizzle checklist point 6). */
  maxConnections?: number;
};

/** Creates a Drizzle client over postgres.js. Doc 09; Phase D after M11 (first persistence milestone). */
export function createDb(options: DbClientOptions): Db {
  void options;
  throw new Error("TODO Phase D: createDb");
}

/** Closes the underlying pool; scripts call this before exit. Doc 09; Phase D after M11. */
export async function closeDb(db: Db): Promise<void> {
  void db;
  throw new Error("TODO Phase D: closeDb");
}
