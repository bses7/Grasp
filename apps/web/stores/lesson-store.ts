import { create } from "zustand";

/**
 * lessonStore (docs/03 "State management"): current activity and task,
 * attempts per task, hints used, per-objective mastery. Updated on discrete
 * events only. XP is V1 and never feeds mastery (lesson-schema section 5).
 * Identifiers follow lesson-schema: lessonId "anatomy.heart.chambers_v1",
 * objectiveId "obj_identify_chambers", taskId "t_g3".
 * TODO Phase D M8 (place check and feedback) and doc 13 Phase 4.
 */
export type LessonState = {
  lessonId: string | null;
  activityId: string | null;
  taskId: string | null;
  attemptsByTask: Record<string, number>;
  hintsUsedByTask: Record<string, number>;
  masteryByObjective: Record<string, number>;
  reset: () => void;
};

const initial = {
  lessonId: null,
  activityId: null,
  taskId: null,
  attemptsByTask: {},
  hintsUsedByTask: {},
  masteryByObjective: {},
};

export const useLessonStore = create<LessonState>()((set) => ({
  ...initial,
  reset: () => set(initial),
}));
