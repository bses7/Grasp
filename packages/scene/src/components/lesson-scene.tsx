/**
 * <LessonScene>, the package's single mount point (M5).
 * Owns the R3F Canvas (frameloop="demand", dpr from SCENE_CONSTANTS), the
 * interactable raycaster, the drag plane, sockets, hotspots, and the orbit rig.
 * Consumes InteractionEvents from an InputSource in apps/web; emits SceneEvents
 * and SceneState. It never grades.
 *
 * Scaffold: no Canvas is mounted. Phase D replaces the placeholder div.
 */
import type {
  InteractionEvent,
  ModelManifest,
  SceneCommand,
  SceneEvent,
  SceneState,
} from "@grasp/types";
import type { Viewport } from "../coords";

export type LessonSceneReadyHandle = {
  /** Feed one interaction event through the doc 05 section 6 pseudocode. */
  dispatch(event: InteractionEvent): void;
  /** Engine → scene command (doc 05 section 4). */
  apply(cmd: SceneCommand): void;
  /** Current compact snapshot for the tutor and the research logger. */
  snapshot(): SceneState;
};

export type LessonSceneProps = {
  manifest: ModelManifest;
  /** Activity-level scene flags from lesson JSON; defaults mirror lesson-schema. */
  allowGrab?: boolean;
  allowOrbit?: boolean;
  socketVisual?: "ghost" | "ring" | "none";
  /** Base URL for GLB and draco decoder assets; default "/models" and "/draco". */
  assetBaseUrl?: string;
  /** Disables capabilities listed in STUDY_PARITY_DISABLES (camera dolly). */
  studyParity?: boolean;
  reducedMotion?: boolean;
  viewport?: Partial<Viewport>;
  onSceneEvent: (event: SceneEvent) => void;
  onSceneState?: (state: SceneState) => void;
  onReady: (handle: LessonSceneReadyHandle) => void;
};

export function LessonScene(_props: LessonSceneProps) {
  return <div data-todo="LessonScene M5" />;
}
