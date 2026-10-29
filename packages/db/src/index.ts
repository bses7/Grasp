/**
 * @grasp/db: Drizzle schema and client factory, shared by route handlers and scripts/ (doc 09, doc 16).
 * Server-only; never imported from client components.
 */
export * from "./schema";
export * from "./client";
export * from "./privacy";
/** Query operators re-exported so route handlers use the same drizzle-orm instance as the schema. */
export { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";
