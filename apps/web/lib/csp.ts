/**
 * Content Security Policy string (docs/15, "Content Security Policy and headers").
 *
 * The policy must allow WebAssembly compilation, the vision Web Worker, blob
 * URLs for ImageBitmap and GLB loading, and self-hosted MediaPipe assets from
 * this origin, while blocking everything else. `connect-src 'self'` is the
 * structural guarantee that no video frame can be posted anywhere; the tutor
 * is an in-process template engine behind `/api/tutor`, so no third-party
 * origin ever appears here.
 *
 * V1: when GLBs move to object storage behind a CDN, pass the CDN origin as
 * `assetOrigin` and it is appended to `connect-src` and `img-src`.
 */
export type CspOptions = {
  /**
   * Per-request nonce from proxy.ts. The App Router hydrates through inline scripts, so without it
   * `script-src 'self'` blocks every page. Next reads the nonce back from this header and tags its scripts.
   */
  nonce: string;
  /** Next.js dev mode needs 'unsafe-eval' for React Refresh; never in production. */
  dev: boolean;
  /** Absolute origin of the asset CDN, e.g. "https://cdn.example.org". V1 only. */
  assetOrigin?: string;
};

export function buildCsp({ nonce, dev, assetOrigin }: CspOptions): string {
  // 'strict-dynamic' lets nonce-trusted bundles load their chunks; 'self' is the CSP2 fallback.
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'"];
  if (dev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'"];
  const imgSrc = ["'self'", "data:", "blob:"];
  if (assetOrigin) {
    connectSrc.push(assetOrigin);
    imgSrc.push(assetOrigin);
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "worker-src": ["'self'", "blob:"],
    "connect-src": connectSrc,
    "img-src": imgSrc,
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'"],
    // Drei <Html> and R3F inject inline styles; replace with a nonce if audited.
    "style-src": ["'self'", "'unsafe-inline'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
