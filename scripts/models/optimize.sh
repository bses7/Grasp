#!/usr/bin/env bash
# GLB optimisation pipeline from the r3f-interaction skill section 9 and doc 10 "Authoring workflow".
#
#   Blender: name each separable part by its component id (left_ventricle, ...); apply transforms; origin at
#            part centroid; empties named socket_<id> at rest poses; export glTF 2.0 binary, +Y up, no cameras/lights.
#   Here:    dedup -> prune -> weld -> simplify (only if > 150k tris) -> draco (or meshopt) -> [KTX2, optional]
#   Target:  < 5 MB per model, < 150k triangles, <= 4 materials (locked position 6).
#   Loader:  Drei useGLTF with the Draco decoder self-hosted under apps/web/public/draco/.
#
# Usage: pnpm models:optimize <input.glb> <output.glb> [--draco | --meshopt]
#        SIMPLIFY_RATIO=0.5 pnpm models:optimize in.glb out.glb   # opt in to simplification for > 150k tris
set -euo pipefail

IN="${1:-}"
OUT="${2:-}"
CODEC="${3:---draco}"
if [[ -z "$IN" || -z "$OUT" ]]; then
  echo "usage: pnpm models:optimize <input.glb> <output.glb> [--draco | --meshopt]" >&2
  exit 2
fi

# Pinned major. Promote to a root devDependency (@gltf-transform/cli ^4.5.0) once this runs more than occasionally.
GT="pnpm dlx @gltf-transform/cli@4"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Remove duplicate accessors, materials, textures.
$GT dedup "$IN" "$TMP/1.glb"
# 2. Drop unreferenced nodes, meshes, materials (Blender exports often carry empties and unused materials).
$GT prune "$TMP/1.glb" "$TMP/2.glb"
# 3. Merge coincident vertices so simplification and compression work on clean topology.
$GT weld "$TMP/2.glb" "$TMP/3.glb"
# 4. Simplify only when the triangle budget is exceeded. Check with: $GT inspect "$TMP/3.glb"
if [[ -n "${SIMPLIFY_RATIO:-}" ]]; then
  $GT simplify --ratio "$SIMPLIFY_RATIO" --error 0.001 "$TMP/3.glb" "$TMP/4.glb"
else
  cp "$TMP/3.glb" "$TMP/4.glb"
fi
# 5. Geometry compression. Draco is the MVP default (decoder under public/draco/); meshopt is the alternative.
if [[ "$CODEC" == "--meshopt" ]]; then
  $GT meshopt "$TMP/4.glb" "$OUT"
else
  $GT draco "$TMP/4.glb" "$OUT"
fi
# 6. Optional in MVP: texture compression to KTX2 (needs KTX-Software on PATH).
#    $GT etc1s "$OUT" "$OUT"

# Budget check: the same 5 MB rule CI enforces on models/.
SIZE=$(wc -c < "$OUT")
if (( SIZE > 5242880 )); then
  echo "FAIL: $OUT is $SIZE bytes, over the 5 MB budget (locked position 6)" >&2
  exit 1
fi
echo "OK: $OUT is $SIZE bytes"
