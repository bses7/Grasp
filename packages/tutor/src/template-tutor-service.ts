import type { Lesson, ModelManifest, TutorRequest, TutorResponse } from "@grasp/types";
import type { TutorService } from "./tutor-service";

export type TemplateTutorServiceOptions = {
  /** Loaded by the caller from @grasp/content by req.lessonId; the request never supplies vocabulary. */
  manifest: ModelManifest;
  lesson: Lesson;
};

/**
 * MVP TutorService: deterministic templates resolved from manifest data
 * (doc 07 "The template tutor"). Pure, synchronous inside, no I/O. It runs
 * inside the /api/tutor route handler, which validates the request, enforces
 * the call caps, writes the ai_interactions row, and returns the response.
 * summarise (optional, V1) is not implemented here.
 *
 * Template keys (src/templates.ts):
 *   MISTAKE_TEMPLATES[taskType][outcome]   level-1 body, what the learner did
 *     identify.incorrect | identify.partial | place.incorrect | place.partial
 *     remove.incorrect | remove.partial | sequence.incorrect | sequence.partial
 *     compare.incorrect | compare.partial
 *   SEQUENCE_START_TEMPLATE                sequence broke at step 1
 *   NARROW_CLAUSES[relationKind]           level-2 clause appended to the body
 *     opposite_of | connects_to | connects_from | contains | tag_contrast | none
 *   REVEAL_TEMPLATES[taskType]             level-3 sentence; fills highlight
 *   HINT_FALLBACK                          hint with tutor: true and no text
 *
 * Resolution (Phase D): pick body by (task.type, evaluation.outcome); at level 2
 * append the clause for the relation from the selected component to the
 * expected one, falling back to a tag contrast, then to the prompt; at level 3
 * append the reveal sentence and set highlight. Drop {selectedDescription}
 * below level 3 if it names the expected component. Every response goes
 * through parseTutorResponse; a throw means the HUD keeps the static hint.
 *
 * Invariants: never grades, never sees video or landmarks, never names a
 * component outside the manifest, identical output for identical requests.
 */
export class TemplateTutorService implements TutorService {
  private readonly manifest: ModelManifest;
  private readonly lesson: Lesson;

  constructor(options: TemplateTutorServiceOptions) {
    this.manifest = options.manifest;
    this.lesson = options.lesson;
  }

  /** Return the authored hint at req.hintLevel, or HINT_FALLBACK for tutor: true without text. */
  async hint(req: TutorRequest): Promise<TutorResponse> {
    void req;
    void this.lesson;
    throw new Error("TODO Phase D: TemplateTutorService.hint (doc 07, M5)");
  }

  /** Compose body + narrowing clause or reveal sentence from the template keys above. */
  async explainMistake(req: TutorRequest): Promise<TutorResponse> {
    void req;
    void this.manifest;
    throw new Error("TODO Phase D: TemplateTutorService.explainMistake (doc 07, M5)");
  }
}
