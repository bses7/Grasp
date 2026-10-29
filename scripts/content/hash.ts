/**
 * Prints the contentHash (SHA-256 over canonical lesson plus manifest JSON) for every lesson. The session route
 * computes the same value and stores it as lesson_hash on research_sessions and lesson_attempts, so a
 * participant's session is pinned to exact content. Doc 10 "Content versioning", doc 09.
 */
import { contentHash, LESSON_IDS, loadLesson, loadManifest } from "../../packages/content/src/loaders";

for (const id of LESSON_IDS) {
  const lesson = loadLesson(id);
  console.log(`${await contentHash(loadManifest(lesson.modelId), lesson)}  ${id}`);
}
