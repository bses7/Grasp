import type { NextConfig } from "next";
import { resolve } from "node:path";

// One .env at the repo root for the whole monorepo; Next only auto-loads apps/web/.env.
// Already-set variables win (Vercel injects its own; there is no root .env there).
try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../.env"));
} catch {}

/**
 * Next.js config for the single deployable app (docs/16-folder-structure.md).
 *
 * - `transpilePackages`: workspace packages ship TypeScript source, no build step.
 * - `serverExternalPackages`: postgres.js must not be bundled into route handlers.
 * - `/dev/*` routes (content review page, docs/10) are excluded in production by
 *   the redirect below; the files still exist but are unreachable when
 *   NODE_ENV === "production".
 * - Security headers and CSP live in `proxy.ts`, not here, so the dev-only
 *   `'unsafe-eval'` toggle is one `if` (docs/15, Content Security Policy).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@grasp/types",
    "@grasp/content",
    "@grasp/vision",
    "@grasp/scene",
    "@grasp/learning",
    "@grasp/tutor",
    "@grasp/ui",
    "@grasp/db",
  ],
  serverExternalPackages: ["postgres"],
  async redirects() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/dev/:path*", destination: "/", permanent: false }];
  },
};

export default nextConfig;
