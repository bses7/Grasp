/**
 * Content loaders. In MVP, content is imported from content/ at build time; these functions wrap that
 * import so the app, route handlers, and scripts share one path (doc 10 "Authoring workflow", doc 16).
 */
import type { Lesson, ModelManifest } from "@grasp/types";

/** Loads and validates content/models/<modelId>.json. Doc 10; Phase D at M9 (real heart GLB and manifest). */
export function loadManifest(modelId: string): ModelManifest {
  void modelId;
  throw new Error("TODO Phase D: loadManifest");
}

/** Loads and validates content/lessons/<subject>/<topic>/<lessonId>.json. Doc 10; Phase D at M9. */
export function loadLesson(lessonId: string): Lesson {
  void lessonId;
  throw new Error("TODO Phase D: loadLesson");
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
