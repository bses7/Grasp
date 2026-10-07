# Heart model candidates (MVP)

Shortlist of openly licensed human heart models that can be adapted into `heart.glb` per the asset limits in [docs/10-3d-content-system.md](../../docs/10-3d-content-system.md): under 5 MB compressed, under 150k triangles, 4 materials or fewer, and the ten component ids as separable meshes (`left_ventricle`, `right_ventricle`, `left_atrium`, `right_atrium`, `aorta`, `pulmonary_artery`, `pulmonary_veins`, `superior_vena_cava`, `inferior_vena_cava`, `septum`). Nothing was downloaded; figures come from the listing pages on 2026-10-04. Tier: **MVP**.

## Candidates

| # | Name / URL | Licence (exact) | Attribute to | Formats | Size | Parts separate? | Suitability |
|---|---|---|---|---|---|---|---|
| 1 | [Human Heart 3D Model](https://sketchfab.com/3d-models/human-heart-3d-model-dbe2a848511644e2923b613d2d12ff09) | CC Attribution 4.0 | Haiqa Arif (@ansarihaiqaarif) | OBJ, FBX, STL, BLEND | 364.7k tris | Unverified; "external and internal structures" | Best editing start (native .blend); needs one decimation pass to 0.4 |
| 2 | [Human heart](https://sketchfab.com/3d-models/human-heart-3342c8c438904ee2b3b6b68fedf30531) | CC Attribution 4.0 | Freddan755 (Mälardalen Univ. illustration student) | Sketchfab auto-convert (glTF) | 54.5k tris | Unverified; likely one shell | Already inside budget; educational intent |
| 3 | [Human Heart Internal Structure](https://sketchfab.com/3d-models/human-heart-internal-structure-3d-model-21d346f72230432e8ed5fe448b03cca5) | CC Attribution 4.0 | Haiqa Arif | FBX, OBJ, STL | 500k tris | Unverified; cutaway shows chambers, valves, septum | Useful as septum reference only; cutaway is not an assembled heart |
| 4 | [Realistic Human Heart](https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089) (also on [Wikimedia Commons as STL](https://commons.wikimedia.org/wiki/File:3D_model_of_a_human_heart.stl), 1.08 MB) | CC Attribution 4.0 | neshallads | Sketchfab glTF; STL on Commons | 22.6k tris | STL is one shell | Lightest; Commons note says "may not be accurate" |
| 5 | [Anatomically Correct Human Heart](https://sketchfab.com/3d-models/anatomically-correct-human-heart-54fa880728d14c11afff78be8721620a) | CC Attribution 4.0 | Pigcraft (@s8819296) | Sketchfab glTF | 1M tris | Unverified; external only | Too heavy (needs 0.15 ratio); external only, no septum |
| 6 | [BodyParts3D heart set](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html) via [Me-TEE-Meshes](https://github.com/mbrockman1/Me-TEE-Meshes) | CC Attribution-ShareAlike 2.1 Japan | "BodyParts3D, Copyright The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan" | OBJ, one file per FMA id | 266k tris total; heart wall 146k | Great vessels (aorta, PA, SVC, IVC, pulmonary veins) are separate; wall is ventricular + two atrial walls, no septum | Vessels already split; chambers still need cutting; SA licence |
| 7 | [Z-Anatomy template](https://github.com/Z-Anatomy/The-blend) | CC BY-SA 4.0 (derived from #6) | Z-Anatomy and BodyParts3D (both lines required) | .blend template | Whole-body file, large | Same split as #6 | Heavier download than #6 for the same heart |
| 8 | [NIH 3D entry 3DPX-022787](https://3d.nih.gov/entries/3DPX-022787) | CC0 1.0 (Public Domain) | Sourav Pan (Biology Notes Online), optional | Unspecified (print file) | Unknown | Unknown; likely solid print shell | Only CC0 source found; unverified quality |
| 9 | [Human heart for Cycles](https://blendswap.com/blend/12579) | CC-BY | daylanKifky | .blend (2.7x) | 8.05 MB source | Author says parts are shown clearly; object split unverified | Old Blender; conversion risk |

Excluded: CU Anschutz and UMCG/Dundee scans (CC BY-NC-SA, non-commercial clause), "Lowpoly Human Heart" by l0r3l3i (Sketchfab Free Standard, not CC).

## Recommendation

| Role | Candidate | Why |
|---|---|---|
| Primary | #1 Haiqa Arif, Human Heart 3D Model | CC-BY, ships a native .blend, has interior detail so a `septum` mesh can be cut rather than invented, one `simplify --ratio 0.4` pass lands near 146k tris |
| Backup | #2 Freddan755, Human heart | CC-BY, already under every limit with no decimation; falls back to a hand-built septum plate if the shell is exterior only |
| SA fallback | #6 BodyParts3D via Me-TEE-Meshes | Only source with vessels pre-separated; use if both CC-BY models prove unsplittable |

## Licence obligations

| Item | CC-BY 4.0 (#1, #2) | CC BY-SA 2.1 JP (#6, #7) |
|---|---|---|
| In-app attribution (About panel and GLB `asset.extras`) | "Heart model: 'Human Heart 3D Model' by Haiqa Arif, Sketchfab, CC BY 4.0. Modified: separated into components, decimated." | "BodyParts3D, Copyright The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan. Modified." plus Z-Anatomy line if #7 |
| Derived GLB licence | Free choice; recommend CC-BY 4.0 to keep the chain simple | Must be CC BY-SA (2.1 JP or, as Z-Anatomy does, 4.0); share-alike attaches to the GLB only, not to code, lesson JSON, or the paper |
| Research publication | No issue | Acceptable: publishing the GLB openly is what a study would do anyway; the only cost is that a future commercial closed asset cannot be derived from it |

## Blender adaptation steps (primary, #1)

1. Open the .blend; delete cameras, lights, and any non-heart props. Set units to metres, scale heart to about 0.12 m tall.
2. Edit mode, select by loose parts and by material; use knife/bisect to split the shell into the ten meshes. Cut the interventricular wall from the interior geometry for `septum`; close cut edges with Fill so each part is watertight.
3. Rename each object exactly to its component id. Merge any materials down to 4 or fewer; bake AO into the base texture.
4. Object > Apply > All Transforms; Set Origin > Origin to Geometry for each part.
5. Add an empty named `socket_<componentId>` at each part's rest pose (Snap cursor to selected, add empty); parent nothing.
6. Decimate (ratio 0.4) or leave for `gltf-transform simplify`; check tri count under 150k.
7. Export glTF 2.0 binary, +Y up, no cameras or lights, textures at 2048 px or lower.
8. Run `gltf-transform dedup → prune → weld → simplify (if needed) → draco`; verify under 5 MB; diff node names against `heart_v1.json` (lesson-schema checklist).

## Unverified

- Whether #1, #2, or #9 are multi-object files; only visible after download.
- Material and texture counts for #1 (listing says "high-resolution textures"; expect to merge).
- NIH entry #8 format, size, and quality.
- BodyParts3D offers no chamber subdivision beyond ventricular and atrial walls; a `septum` would need to be cut from the ventricular wall.
- Whether CC BY-SA 2.1 JP adaptations may be relicensed to CC BY-SA 4.0 (Z-Anatomy does so; not checked against the licence text).

## Verified after download (2026-10-07)

Downloaded candidates live in `content/source/heart_candidates/` (git-ignored). Inspected with `/dev/model/heart_v1`.

| Candidate | File | Size | Triangles | Parts | Finding |
|---|---|---|---|---|---|
| #2 Freddan755 | `human_heart.glb` | 7.4 MB (5.0 MB of it PNG textures) | 54,452 | 11 meshes, 10 materials | **Selected.** `gltf-transform optimize --compress draco --texture-compress webp --texture-size 1024 --join false --flatten false --simplify false --instance false` gives 0.9 MB with all 11 parts and all triangles. |
| #1 Haiqa Arif | `human heart.glb` | 12.7 MB | 364,698 | 1 mesh | AI-generated (Tripo); one shell; rejected |
| #5 Pigcraft | `anatomically_correct_human_heart.glb` | 67.9 MB | 1,000,046 | 14 meshes, all named `tripo_node_…` | AI-generated (Tripo); arbitrary chunks, not anatomy; rejected |
| jalmer, Beating-heart (CC BY 4.0, not in the shortlist) | `beating-heart.glb` | 5.5 MB | 34,401 | 1 mesh + animation | One shell; rejected for MVP (animation reference only) |

First identification of the #2 parts (to confirm on the review page): `Line001` aorta, `Line002` pulmonary_artery, `Object001` left_ventricle, `Object002` right_ventricle, `Line010` inferior_vena_cava, `Line003` superior_vena_cava (medium), `Line007`/`Line008`/`Line009`/`Line8` pulmonary_veins (medium), `Box002` remaining body (scenery). There are no separate atria or septum meshes; M9 needs only aorta, pulmonary_artery and left_ventricle, which are separate.

Attribution: "Heart model: 'Human heart' by Freddan755, Sketchfab, CC BY 4.0. Modified: renamed parts, compressed."

### #9 checked (2026-10-07): "Human heart for Cycles" by elZancudo

`content/source/heart_candidates/human-heart-for-cycles/Human_heart.blend`, CC BY 3.0 (credit "elZancudo"). Objects: `Aorta`, `Ventriculos` (both ventricles in one mesh, plus the pulmonary trunk as a second material), `Auricula der` / `Auricula izq` (right and left atria), `Arteritas` / `Venitas` (coronary vessels), 86,080 triangles with modifiers applied. Materials are Cycles networks (Diffuse + Fresnel + Mix), which the glTF exporter cannot read, so a plain export loses every texture; `scripts/models/blend-to-glb.py` rebuilds them as Principled BSDF and exports 9.7 MB, 0.4 MB after compression. **Reserve for Phase 4** (only model with separate atria); not used for M9 because the left ventricle would have to be cut out of `Ventriculos`.

## Decision (2026-10-07): #9 elZancudo, split, is `heart_v1`

Chosen over #2 Freddan755 for the better model and the separate atria. `scripts/models/split-heart-cycles.py` separated it (pulmonary trunk by material; ventricles cut along the LAD groove with a planar septum; atrium names corrected; `socket_*` empties at the assembled pose), `scripts/models/blend-to-glb.py` exported it, and `gltf-transform optimize ... --prune false` compressed it to `models/heart_v1/heart.glb`: 0.39 MB, 86,388 triangles, 8 meshes (6 components plus coronary arteries and veins as scenery). `pnpm content:scaffold models/heart_v1/heart.glb --prune` refreshed `content/models/heart_v1.json` from it. Freddan755's model remains the fallback. Source files: `content/source/heart_candidates/Human_heart.blend` (original) and `Human_heart_split.blend`.

Attribution: "Heart model: 'Human heart for Cycles' by elZancudo, Blend Swap, CC BY 3.0. Modified: separated into components, ventricles split, compressed."
