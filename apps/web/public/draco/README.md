# public/draco

Draco decoder for Drei `useGLTF(url, "/draco/")` (docs/05, docs/10 GLB compression). Self-hosted so the CSP stays `'self'`.

Copy from the pinned `three` package after `pnpm install`:

```sh
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js apps/web/public/draco/
```

Files: `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`. If the pipeline in `scripts/models/optimize.sh` switches to meshopt, this directory is unused and `useGLTF` gets the meshopt decoder from `three` instead.
