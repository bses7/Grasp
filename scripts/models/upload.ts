/**
 * V1: mirrors models/<modelId>/<file>.glb to object storage behind a CDN at the identical key, with immutable
 * cache headers, so NEXT_PUBLIC_ASSET_BASE_URL can switch from /models to the CDN without renaming anything.
 * MVP serves GLBs from apps/web/public/models (copied by hand or by this script's --local mode).
 * Doc 10 "GLB hosting", doc 15 "Scalability" (GLB bandwidth is what breaks first); Phase D after M9, V1 for the CDN.
 */
console.log("TODO Phase D: copy models/ to apps/web/public/models (MVP) and upload to object storage (V1) (doc 10)");
process.exit(0);
