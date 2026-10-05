/**
 * PUT /api/progress: upsert the per-objective mastery cache. V1.
 *
 * MVP does not call this route: mastery is recomputed from lesson_attempts
 * (docs/03, "Progress Service"; docs/09 progress table). When V1 arrives it
 * validates with `ProgressRowSchema` from @grasp/types and calls
 * `upsertProgress()` from @grasp/db, with the server recomputing mastery
 * via the isomorphic @grasp/learning package for integrity.
 *
 * TODO V1 (not scheduled in Phase D).
 */
export async function PUT() {
  return Response.json(
    { error: "not implemented", todo: "V1 (docs/03 Progress Service)" },
    { status: 501 },
  );
}
