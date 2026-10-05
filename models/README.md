# models/

Compressed GLB outputs, one directory per model id: `models/<modelId>/<file>.glb` (for example `models/heart_v1/heart.glb`). The path is identical to the object-storage key used at V1.

- Produced by `pnpm models:optimize` (scripts/models/optimize.sh: dedup, prune, weld, simplify, Draco or meshopt) from the Blender export in `content/source/`.
- Validated by `pnpm content:validate` and CI: each file must stay under 5 MB and under 150k triangles; mesh names must equal the component ids in the manifest under `content/models/`.
- Copied to `apps/web/public/models/` for the MVP (served by Vercel with immutable headers); mirrored to object storage behind a CDN at V1.
- GLBs are committed directly (no Git LFS for MVP, decided 2026-10-04); `.blend` sources are git-ignored.

The heart GLB arrives at prototype milestone M9 (docs/17-first-prototype-plan.md). Candidate source models and licence notes: content/models/HEART_CANDIDATES.md.
