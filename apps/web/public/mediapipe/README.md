# public/mediapipe

Self-hosted MediaPipe Tasks Vision runtime assets (docs/04, docs/15 "Dependency pinning"). Nothing is hot-linked from a Google CDN; the CSP allows `worker-src 'self'` and `script-src 'self' 'wasm-unsafe-eval'` only.

Files that belong here (never committed unpinned; the version is part of the path):

| File | Source |
|---|---|
| `hand_landmarker.task` | `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` |
| `wasm/vision_wasm_internal.js`, `wasm/vision_wasm_internal.wasm` | `node_modules/@mediapipe/tasks-vision/wasm/` |
| `wasm/vision_wasm_nosimd_internal.js`, `wasm/vision_wasm_nosimd_internal.wasm` | same (fallback for CPUs without SIMD) |

Pinned package version: `@mediapipe/tasks-vision` as recorded in `pnpm-lock.yaml` (spec `^1.0.0`; pin exact before the pilot per docs/15). Record the version in `VERSION.txt` next to the files so a mismatch between `.task`, WASM and the JS API is visible.

Copy command, from the repo root after `pnpm install`:

```sh
cp -r node_modules/.pnpm/@mediapipe+tasks-vision@*/node_modules/@mediapipe/tasks-vision/wasm apps/web/public/mediapipe/wasm
```

The worker initialises with `FilesetResolver.forVisionTasks("/mediapipe/wasm")` and `modelAssetPath: "/mediapipe/hand_landmarker.task"`. TODO Phase D M1.
