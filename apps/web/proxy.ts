import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";

/**
 * Request interceptor for CSP and security headers (docs/15, "Content Security
 * Policy and headers"). Next.js 16 renamed `middleware.ts` to `proxy.ts` and the
 * export from `middleware` to `proxy`; confirmed against
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy (v16.3).
 *
 * HSTS is left to Vercel, which sets it for every deployment.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== "production" });

  // The request copy is how Next learns the nonce during SSR (pages must render dynamically; see app/layout.tsx).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()",
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = {
  // Pages and route handlers only; static assets, images and the self-hosted
  // MediaPipe/Draco/GLB files under public/ do not need these headers.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mediapipe|draco|models).*)",
  ],
};
