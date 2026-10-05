# Model manifests

One JSON file per model, named by its id (`heart_v1.json`). The shape is `ModelManifest` in the `lesson-schema` skill, plus a top-level `"version": 1`. A manifest changes only when the 3D asset changes; pedagogy lives in `content/lessons/`. A changed GLB is a new id (`heart_v2`), never an edit in place ([docs/10](../../docs/10-3d-content-system.md#content-versioning)).

## Mesh-naming rule

Every separable part in the GLB is one mesh (or one parent empty) whose node name **equals the component id exactly**, in `snake_case`: `left_ventricle`, `aorta`, `superior_vena_cava`. Socket empties are named `socket_<componentId>`. Fixed scenery may use any other name. `pnpm content:validate` diffs the GLB node list against `components[].id`; extra unnamed nodes pass, missing ones fail. A `camelCase` id passes TypeScript and fails at runtime, so the validator is the only guard.

## Vocabulary per subject

`type` and `tags` are free strings in the schema so it stays subject-neutral; each subject fixes its own list here so authors and the tutor prompt use one vocabulary. Add a subject by adding a table, not a schema field.

### anatomy

| Field | Allowed values | Meaning |
|---|---|---|
| `type` | `chamber` | A blood-holding cavity: atria and ventricles |
| `type` | `vessel` | An artery or vein entering or leaving the model |
| `type` | `valve` | A one-way flap between chambers or into a vessel (used by `anatomy.heart.valves_v1`) |
| `type` | `wall` | A dividing or enclosing muscular structure such as the septum |
| `tags` | `oxygenated` | Carries or holds oxygen-rich blood |
| `tags` | `deoxygenated` | Carries or holds oxygen-poor blood |
| `tags` | `artery` | Vessel carrying blood away from the heart |
| `tags` | `vein` | Vessel carrying blood toward the heart |
| `tags` | `systemic_circuit` | Part of the heart-to-body-and-back loop |
| `tags` | `pulmonary_circuit` | Part of the heart-to-lungs-and-back loop |

`compare.attribute` values used by lessons: `wall_thickness`. Add new attributes here when a lesson introduces them.

`relations[].type` values: `connects_to`, `opposite_of`, `contains`.

## Heart model candidates

The researched shortlist, licence obligations, attribution strings, and Blender adaptation steps live in [HEART_CANDIDATES.md](HEART_CANDIDATES.md). Primary: Haiqa Arif, "Human Heart 3D Model" (CC-BY 4.0); backup: Freddan755, "Human heart" (CC-BY 4.0). No source ships the four chambers or the septum pre-separated; all need cutting in Blender per the steps there. Final pick is confirmed at prototype milestone M9.
