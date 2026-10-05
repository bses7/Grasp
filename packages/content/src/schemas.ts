/**
 * Zod 4 schemas mirroring packages/types/src/content.ts. These validate lesson JSON at build time
 * (scripts/content/validate.ts) and are the source for JSON Schema export at V1 (doc 10, services/README.md).
 * Cross-reference checks (socket ids exist, objectives have tasks, GLB mesh names) are the validator's job, not Zod's.
 */
import { z } from "zod";
import type { Lesson, ModelManifest } from "@grasp/types";

/** snake_case, as the glossary requires for component, socket, and hotspot ids. */
export const SnakeCaseId = z.string().regex(/^[a-z][a-z0-9_]*$/, "expected snake_case id");

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const SocketVisualSchema = z.enum(["ghost", "ring", "none"]);

export const TransformSchema = z.object({
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: z.number().positive().optional(),
});

export const ComponentSchema = z.object({
  id: SnakeCaseId,
  name: z.string().min(1),
  type: z.string().min(1),
  interactable: z.boolean(),
  grabbable: z.boolean(),
  highlightable: z.boolean(),
  description: z.string(),
  tags: z.array(z.string()),
  relations: z.array(z.object({ type: z.string(), target: SnakeCaseId })).optional(),
  restSocketId: SnakeCaseId.optional(),
});

export const SocketSchema = z.object({
  id: SnakeCaseId,
  transform: TransformSchema,
  radius: z.number().positive(),
  accepts: z.array(SnakeCaseId).min(1),
  visual: SocketVisualSchema,
});

export const HotspotSchema = z.object({
  id: SnakeCaseId,
  componentId: SnakeCaseId,
  localPosition: Vec3Schema,
  label: z.string().min(1),
  kind: z.enum(["info", "task"]),
  body: z.string().optional(),
});

export const ModelManifestSchema = z.object({
  id: SnakeCaseId,
  subject: z.string().min(1),
  file: z.string().regex(/\.glb$/, "manifest file must be a .glb"),
  units: z.enum(["m", "cm"]),
  defaultCamera: z.object({ azimuth: z.number(), elevation: z.number(), distance: z.number() }),
  components: z.array(ComponentSchema).min(1),
  sockets: z.array(SocketSchema),
  hotspots: z.array(HotspotSchema),
  poses: z.record(z.string(), z.record(z.string(), TransformSchema)),
  animations: z.array(z.object({ id: z.string(), clip: z.string(), description: z.string() })).optional(),
});

export const BloomSchema = z.enum(["remember", "understand", "apply", "analyze"]);

export const ObjectiveSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  bloom: BloomSchema,
  masteryThreshold: z.number().min(0).max(1),
});

export const ActivityKindSchema = z.enum(["introduction", "explore", "guided", "challenge", "assessment", "mastery"]);

export const ActivitySceneSchema = z.object({
  pose: z.string().min(1),
  visibleComponents: z.array(SnakeCaseId).optional(),
  socketsVisible: z.boolean().optional(),
  socketVisual: SocketVisualSchema.optional(),
  allowOrbit: z.boolean(),
  allowGrab: z.boolean(),
  dragMode: z.enum(["camera_plane", "ground_plane"]).optional(),
});

export const ActivityCompletionSchema = z.union([
  z.object({ allTasks: z.literal(true) }),
  z.object({ minCorrect: z.number().int().min(1) }),
  z.object({ time: z.number().positive() }),
]);

export const HintLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const HintSchema = z.object({
  level: HintLevelSchema,
  text: z.string().optional(),
  highlight: z.array(SnakeCaseId).optional(),
  cameraTo: SnakeCaseId.optional(),
  tutor: z.boolean().optional(),
});

export const TaskScoringSchema = z.object({
  correct: z.number().positive(),
  partial: z.number().min(0).optional(),
  hintPenalty: z.number().min(0).optional(),
});

const TaskBaseSchema = z.object({
  id: z.string().min(1),
  objectiveId: z.string().min(1),
  prompt: z.string().min(1),
  hints: z.array(HintSchema),
  maxAttempts: z.number().int().min(1).optional(),
  timeLimitSec: z.number().positive().optional(),
  remediation: z.object({ microTaskId: z.string().optional(), animationId: z.string().optional() }).optional(),
  scoring: TaskScoringSchema,
});

export const TaskSchema = z.discriminatedUnion("type", [
  TaskBaseSchema.extend({
    type: z.literal("identify"),
    expect: z.object({ componentId: z.union([SnakeCaseId, z.array(SnakeCaseId).min(1)]) }),
  }),
  TaskBaseSchema.extend({
    type: z.literal("place"),
    expect: z.object({ componentId: SnakeCaseId, socketId: SnakeCaseId }),
  }),
  TaskBaseSchema.extend({
    type: z.literal("remove"),
    expect: z.object({ componentId: SnakeCaseId, awayFromSocketId: SnakeCaseId }),
  }),
  TaskBaseSchema.extend({
    type: z.literal("sequence"),
    expect: z.object({
      steps: z.array(z.object({ componentId: SnakeCaseId, socketId: SnakeCaseId.optional() })).min(2),
      strictOrder: z.boolean(),
    }),
  }),
  TaskBaseSchema.extend({
    type: z.literal("compare"),
    expect: z.object({
      componentIds: z.tuple([SnakeCaseId, SnakeCaseId]),
      attribute: z.string().min(1),
      answer: SnakeCaseId,
    }),
  }),
]);

export const ActivitySchema = z.object({
  id: z.string().min(1),
  kind: ActivityKindSchema,
  title: z.string().min(1),
  narration: z.array(z.string().max(220, "narration cards are at most 220 characters")).optional(),
  scene: ActivitySceneSchema,
  tasks: z.array(TaskSchema),
  completion: ActivityCompletionSchema,
});

export const LessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)+$/, "expected dotted lowercase id with version suffix"),
  modelId: SnakeCaseId,
  title: z.string().min(1),
  estimatedMinutes: z.number().int().min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  objectives: z.array(ObjectiveSchema).min(1),
  activities: z.array(ActivitySchema).min(1),
  prerequisites: z.array(z.string()).optional(),
});

/* Compile-time guard: the inferred schema shapes must be assignable to the shared types. */
type AssertAssignable<T, _U extends T> = true;
type _ManifestMirrorsType = AssertAssignable<ModelManifest, z.infer<typeof ModelManifestSchema>>;
type _LessonMirrorsType = AssertAssignable<Lesson, z.infer<typeof LessonSchema>>;
