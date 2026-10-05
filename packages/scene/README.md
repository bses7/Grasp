# @grasp/scene

React Three Fiber scene for Grasp: coordinate chain, raycasting, camera-facing drag plane, sockets and snapping, hotspots, orbit rig, scene commands, and the `SceneState` snapshot. Specified in [docs/05-3d-interaction.md](../../docs/05-3d-interaction.md); milestones from [docs/17-first-prototype-plan.md](../../docs/17-first-prototype-plan.md).

Invariant: **the scene reports; it never grades.** It emits `select`, `place`, `drop`, `hover` and a `SceneState` snapshot. Correctness is decided only by `@grasp/learning` against lesson JSON. A socket's `accepts` is permissive and includes distractors; `place` into an accepting socket is not a verdict.

Boundary (doc 16): imports only `@grasp/types`, `@grasp/content`, `@grasp/ui`, three, R3F, Drei. Never imports `@grasp/learning` or `@grasp/tutor`. No network calls; GLB and decoder paths are passed in by `apps/web`.

## Status

Phase C scaffold. Types, constants, and the key map are real; every function throws `TODO Phase D: <name> (doc 05, M<n>)`. `<LessonScene>` renders a placeholder `div`, not a Canvas.

## Contents by milestone

| Milestone | Files | Delivers |
|---|---|---|
| M5 mouse drag | `drag-plane.ts`, `sockets.ts`, `components/component-mesh.tsx`, `components/socket-marker.tsx`, `components/mouse-controls.tsx`, `components/lesson-scene.tsx` | Three primitives, three ring sockets, `MouseControls` key map (Esc, Tab, Enter, Space, arrows, PageUp/PageDown, +/-, wheel, R, X), snap on `grab_end`, `place` or `drop` |
| M6 cursor raycast | `coords.ts`, `raycast.ts`, `commands.ts` (`highlight`) | Mirror, cover-fit, clamp, NDC; one shared raycaster on `INTERACTABLE_LAYER`; emissive tint; `hover_result` back to the worker |
| M7 gesture grab | `drag-plane.ts` (`moveGrab` z-hint, bounds), `scene-state.ts` | `Z_GAIN` 0.3, `Z_MAX` 0.15; `grab_end` with `reason: "lost"` settles without a socket search and emits `drop` with `cause: "lost"`; `SceneState` snapshot and diff |
| M8 place check | `commands.ts` (`reset`) | Engine-driven reset over 400 ms; no scene code knows the verdict |
| M9 real heart GLB | `commands.ts` (`setPose`, `cameraTo`, `setVisible`), `sockets.ts` (`resolveSocketVisual`), model loader | Drei `useGLTF` with self-hosted Draco decoder; mesh names equal `components[].id` |
| Phase 4 (post-prototype) | `components/orbit-rig.tsx`, `components/hotspot.tsx` | Orbit on empty space, hotspot markers and labels, dwell select |

Interfaces kept stable: input is `InteractionEvent` (`mediapipe-hands` section 8 plus doc 04's `cursor` event and `grab_end.reason`); output is `SceneEvent` and `SceneState` (`r3f-interaction` section 11 with `hotspotId` and `cause` on `lastEvent`). All types come from `@grasp/types`.

## GLB pipeline

Blender (one mesh per component named by `componentId`, `socket_<id>` empties, +Y up) → `scripts/models/optimize.sh` (gltf-transform dedup, prune, weld, simplify, Draco) → validate names and size (< 5 MB, ≤ 150k triangles) → `apps/web/public/models/`. Full pipeline: [doc 05 section 8](../../docs/05-3d-interaction.md#8-glb-authoring-and-compression-pipeline); manifest schema and hosting: [doc 10](../../docs/10-3d-content-system.md).

## Performance budget

30 fps combined with CV (locked position 6): `frameloop="demand"`, `dpr=[1, 1.5]`, no shadows, no post-processing in MVP, zero React commits during a drag. Table and degrade ladder in [doc 05 section 10](../../docs/05-3d-interaction.md#10-render-performance-budget).
