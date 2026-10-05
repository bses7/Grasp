import { z } from "zod";

/**
 * Server-only environment parsing (docs/16, apps/web/lib). Route handlers and
 * the tutor seam read env through `getEnv()`; nothing else touches
 * `process.env`. Browser-visible values are prefixed NEXT_PUBLIC_.
 *
 * Parsing is lazy so `next build` succeeds on a machine without secrets; the
 * first server request that needs a missing value fails loudly instead.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Neon or local Docker Compose Postgres (docs/09). */
  DATABASE_URL: z.url().optional(),
  /**
   * Tutor engine behind /api/tutor (locked position 7). "template" is the MVP
   * (deterministic, in-process, no network). "local" is V1 only, after
   * measurement, and requires TUTOR_LOCAL_URL. No hosted LLM API exists here.
   */
  TUTOR_ENGINE: z.enum(["template", "local"]).default("template"),
  /** V1 only: base URL of a locally run open-weights model (Ollama on the lab laptop). */
  TUTOR_LOCAL_URL: z.url().optional(),
  /** When set, /api/tutor uses RemoteTutorService (docs/03, Python seam). V1. */
  TUTOR_SERVICE_URL: z.url().optional(),
  /** Where GLBs are served from; "/models" in MVP, a CDN origin in V1. */
  NEXT_PUBLIC_ASSET_BASE_URL: z.string().default("/models"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("lib/env.ts is server-only; do not import it from client code");
  }
  if (!cached) cached = serverEnvSchema.parse(process.env);
  return cached;
}
