/**
 * Content loaders. In MVP, content is imported from content/ at build time; these functions wrap that
 * import so the app, route handlers, and scripts share one path (doc 10 "Authoring workflow", doc 16).
 */
import type { Lesson, ModelManifest } from "@grasp/types";
import chambersV1 from "../../../content/lessons/anatomy/heart/chambers_v1.json";
import prototypeV0 from "../../../content/lessons/anatomy/heart/prototype_v0.json";
import heartV1 from "../../../content/models/heart_v1.json";
import { LessonSchema, ModelManifestSchema } from "./schemas";

// ponytail: an explicit registry; a new manifest or lesson file is one line here. Switch to a build-time
// glob if content grows past a handful of files.
const MANIFESTS: Record<string, unknown> = { heart_v1: heartV1 };
const LESSONS: Record<string, unknown> = {
  "anatomy.heart.chambers_v1": chambersV1,
  "anatomy.heart.prototype_v0": prototypeV0,
};

export const MANIFEST_IDS = Object.keys(MANIFESTS);

/** Loads and validates content/models/<modelId>.json. Doc 10; Phase D at M9 (real heart GLB and manifest). */
export function loadManifest(modelId: string): ModelManifest {
  const raw = MANIFESTS[modelId];
  if (!raw) throw new Error(`unknown model manifest "${modelId}"; known: ${MANIFEST_IDS.join(", ")}`);
  return ModelManifestSchema.parse(raw);
}

/** Loads and validates content/lessons/<subject>/<topic>/<lessonId>.json. Doc 10; Phase D at M9. */
export function loadLesson(lessonId: string): Lesson {
  const raw = LESSONS[lessonId];
  if (!raw) throw new Error(`unknown lesson "${lessonId}"; known: ${Object.keys(LESSONS).join(", ")}`);
  return LessonSchema.parse(raw);
}

/**
 * SHA-256 over the canonical JSON of lesson plus manifest; stored as lesson_hash on research_sessions
 * and lesson_attempts so a row pins the exact content a participant saw. Doc 10 "Content versioning", doc 09; Phase D after M11.
 */
export function contentHash(manifest: ModelManifest, lesson: Lesson): string {
  void manifest;
  void lesson;
  throw new Error("TODO Phase D: contentHash");
}
