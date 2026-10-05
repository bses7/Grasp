# public/mediapipe

Self-hosted MediaPipe Tasks Vision runtime assets (docs/04, docs/15 "Dependency pinning"). Nothing is hot-linked from a Google CDN; the CSP allows `connect-src 'self'` only.

Populated by `pnpm assets:sync` (`scripts/assets/sync-public.ts`), which `pnpm dev` and `pnpm build` run first. Git-ignored.

```text
<version>/hand_landmarker.task   downloaded once from the pinned float16/1 model URL
<version>/wasm/                  copied from @mediapipe/tasks-vision in packages/vision
```

The version lives in one place, `packages/vision/src/assets.ts` (`MEDIAPIPE_VERSION`), and must equal the exact `@mediapipe/tasks-vision` pin in `packages/vision/package.json`; the sync script fails otherwise. It is in the path so the immutable cache headers in `infrastructure/vercel.json` stay safe across bumps. Use `MEDIAPIPE_WASM_URL` and `HAND_LANDMARKER_TASK_URL` from `@grasp/vision`, never literal paths.
