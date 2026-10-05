# Source files

Blender `.blend` files for every model. **Git-ignored** for MVP (the `models/` and `content/source/` LFS question in [docs/16](../../docs/16-folder-structure.md#open-questions) is open; until resolved, keep sources outside version control or in a personal backup). Nothing in the build reads this directory.

## Naming

| Thing | Rule | Example |
|---|---|---|
| File | `<modelId>.blend`; a new GLB is a new model id | `heart_v1.blend` |
| Separable part | one mesh or one parent empty, named exactly the component id in `snake_case` | `left_ventricle` |
| Socket | an empty named `socket_<componentId>` at the rest pose | `socket_aorta` |
| Fixed scenery | any name that is not a component id | `pericardium_shell` |

## Export checklist (docs/10 authoring workflow, steps 1 to 3)

- [ ] Every separable part is its own mesh or parent empty, named per the table above.
- [ ] A `socket_<componentId>` empty exists at each grabbable part's rest pose.
- [ ] All transforms applied; each part's origin set to its centroid.
- [ ] At most 4 materials; ambient occlusion baked into textures, no reliance on real-time shadows.
- [ ] Scale so 1 unit = 1 cm when the manifest says `units: "cm"`.
- [ ] Export glTF 2.0, format glTF Binary (`.glb`), +Y up.
- [ ] Custom properties off; cameras and lights excluded; modifiers applied.
- [ ] Animations exported only if the manifest will reference them.
- [ ] Output named `<file>.raw.glb` (e.g. `heart.raw.glb`), then run `pnpm models:optimize` (`dedup`, `prune`, `weld`, `simplify --ratio 0.5` only above 150k triangles, `draco` or `meshopt`; textures at most 2048 px).
- [ ] Result under 5 MB, saved as `models/<modelId>/<file>.glb` and copied to `apps/web/public/models/<modelId>/`.
- [ ] `pnpm content:scaffold <file>.glb` to produce or diff the manifest; `pnpm content:validate` passes.
- [ ] Reviewed on `/dev/model/<modelId>` with a mouse before any gesture test.
