# public/draco

Draco decoder for Drei `useGLTF(url, "/draco/")` (docs/05, docs/10 GLB compression). Self-hosted so the CSP stays `'self'`.

Copied from the pinned `three` in packages/scene by `pnpm assets:sync` (runs before `pnpm dev` and `pnpm build`; git-ignored). Files: `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`. If the pipeline in `scripts/models/optimize.sh` switches to meshopt, this directory is unused and `useGLTF` gets the meshopt decoder from `three` instead.
