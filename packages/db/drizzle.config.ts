import { defineConfig } from "drizzle-kit";

// Doc 09 "Seed and migration strategy": `drizzle-kit generate` writes numbered SQL files to ./migrations,
// committed and reviewed like code; `drizzle-kit migrate` applies them as a manual step before a deploy,
// never automatically on cold start.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/grasp",
  },
  strict: true,
  verbose: true,
});
