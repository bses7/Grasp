/**
 * Content contracts: model manifest and lesson. Source: lesson-schema skill sections 2-4;
 * refined in docs 06 and 10. Subject-neutral by design: new subjects need new JSON and GLBs, not new fields.
 */
import type { SocketVisual, Vec3 } from "./scene-events";

export type Transform = { position: Vec3; rotation: Vec3; scale?: number };

export type ComponentRelation = { type: string; target: string };

export type Component = {
  /** snake_case; must equal the mesh name in the GLB. */
  id: string;
  name: string;
  /** Subject-specific vocabulary: "chamber" | "vessel" | "valve" | "atom" | "gear" ... */
  type: string;
  interactable: boolean;
  grabbable: boolean;
  highlightable: boolean;
  /** Short, factual; the tutor may quote it. */
  description: string;
  tags: string[];
  relations?: ComponentRelation[];
  restSocketId?: string;
};

export type Socket = {
  id: string;
  transform: Transform;
  /** Snap distance in scene units. */
  radius: number;
  /** Every component that may physically snap here, including distractors; correctness is only the task's expect. */
  accepts: string[];
  visual: SocketVisual;
};

export type Hotspot = {
  id: string;
  componentId: string;
  localPosition: Vec3;
  label: string;
  kind: "info" | "task";
  body?: string;
};

export type ModelAnimation = { id: string; clip: string; description: string };

export type ModelManifest = {
  id: string;
  subject: string;
  file: string;
  units: "m" | "cm";
  defaultCamera: { azimuth: number; elevation: number; distance: number };
  components: Component[];
  sockets: Socket[];
  hotspots: Hotspot[];
  /** Named poses ("assembled", "exploded") -> componentId -> Transform. */
  poses: Record<string, Record<string, Transform>>;
  animations?: ModelAnimation[];
};

export type Bloom = "remember" | "understand" | "apply" | "analyze";

export type Objective = { id: string; statement: string; bloom: Bloom; masteryThreshold: number };

export type ActivityKind = "introduction" | "explore" | "guided" | "challenge" | "assessment" | "mastery";

export type DragMode = "camera_plane" | "ground_plane";

export type ActivityScene = {
  pose: string;
  visibleComponents?: string[];
  socketsVisible?: boolean;
  socketVisual?: SocketVisual;
  allowOrbit: boolean;
  allowGrab: boolean;
  /** Default camera_plane; ground_plane is V1. */
  dragMode?: DragMode;
};

export type ActivityCompletion = { allTasks: true } | { minCorrect: number } | { time: number };

export type Activity = {
  id: string;
  kind: ActivityKind;
  title: string;
  narration?: string[];
  scene: ActivityScene;
  tasks: Task[];
  completion: ActivityCompletion;
};

export type HintLevel = 1 | 2 | 3;

export type Hint = {
  level: HintLevel;
  text?: string;
  highlight?: string[];
  cameraTo?: string;
  /** Ask the tutor to phrase the hint; text or highlight must also be present as the offline fallback. */
  tutor?: boolean;
};

export type TaskType = "identify" | "place" | "remove" | "sequence" | "compare";

export type TaskScoring = { correct: number; partial?: number; hintPenalty?: number };

/** V1: authored override of the repeated-failure policy; MVP synthesises remediation from expect (doc 06). */
export type TaskRemediation = { microTaskId?: string; animationId?: string };

export type TaskBase = {
  id: string;
  objectiveId: string;
  prompt: string;
  hints: Hint[];
  /** Default 3 in guided, 1 in assessment. */
  maxAttempts?: number;
  timeLimitSec?: number;
  remediation?: TaskRemediation;
  scoring: TaskScoring;
};

export type IdentifyExpect = { componentId: string | string[] };
export type PlaceExpect = { componentId: string; socketId: string };
export type RemoveExpect = { componentId: string; awayFromSocketId: string };
export type SequenceExpect = { steps: { componentId: string; socketId?: string }[]; strictOrder: boolean };
export type CompareExpect = { componentIds: [string, string]; attribute: string; answer: string };

export type Task =
  | (TaskBase & { type: "identify"; expect: IdentifyExpect })
  | (TaskBase & { type: "place"; expect: PlaceExpect })
  | (TaskBase & { type: "remove"; expect: RemoveExpect })
  | (TaskBase & { type: "sequence"; expect: SequenceExpect })
  | (TaskBase & { type: "compare"; expect: CompareExpect });

export type TaskExpect = Task["expect"];

export type Difficulty = 1 | 2 | 3;

export type Lesson = {
  /** Dotted lowercase with version suffix: "anatomy.heart.chambers_v1". Immutable once used in a study. */
  id: string;
  modelId: string;
  title: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  objectives: Objective[];
  /** Ordered. */
  activities: Activity[];
  prerequisites?: string[];
};
