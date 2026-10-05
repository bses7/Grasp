/**
 * Applies the committed SQL migrations in packages/db/migrations to DATABASE_URL with drizzle-orm's migrator.
 * Run by hand before the deploy that needs it, never on cold start (doc 09 "Seed and migration strategy").
 * Generate migrations with `pnpm --filter @grasp/db generate`. Phase D after M11.
 */
console.log("TODO Phase D: run drizzle migrations against DATABASE_URL (doc 09)");
process.exit(0);
