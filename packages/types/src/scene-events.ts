/**
 * Scene contracts: R3F scene -> learning engine (SceneEvent), scene -> tutor (SceneState),
 * engine -> scene (SceneCommand). Source: doc 05 section 4; r3f-interaction skill section 11.
 * The scene reports; it never grades.
 */

export type SelectMethod = "grab" | "dwell" | "click";

export type DropCause = "release" | "lost";

export type SocketVisual = "ghost" | "ring" | "none";

export type Vec3 = [number, number, number];

/** Exactly one of componentId or hotspotId is set on a select. */
export type SelectTarget =
  | { componentId: string; hotspotId?: never }
  | { hotspotId: string; componentId?: never };

export type SceneEvent =
  | ({ type: "select"; method: SelectMethod; t: number } & SelectTarget)
  /** grab_end snapped into a socket; the engine decides whether the socket is the right one. */
  | { type: "place"; componentId: string; socketId: string; t: number }
  /** grab_end outside any accepting socket, or any grab_end with reason "lost" (cause "lost", socket search skipped). */
  | { type: "drop"; componentId: string; position: Vec3; cause: DropCause; t: number }
  /** hoveredId changed (not per frame). */
  | { type: "hover"; componentId: string | null; t: number };

export type SceneEventType = SceneEvent["type"];

export type CameraPose = { azimuth: number; elevation: number; distance: number };

export type ComponentState = {
  socketId: string | null;
  position: Vec3;
  visible: boolean;
};

/** Compact, JSON-serialisable, no pixels. The only scene information that leaves the browser. */
export type SceneState = {
  modelId: string;
  camera: CameraPose;
  components: Record<string, ComponentState>;
  /** componentId or hotspotId. */
  hovered: string | null;
  grabbed: string | null;
  lastEvent: {
    type: string;
    componentId?: string;
    socketId?: string;
    hotspotId?: string;
    /** Present on drop only. */
    cause?: DropCause;
    t: number;
  } | null;
};

/** Commands the engine issues to the scene. They carry no lesson logic. */
export type SceneCommand =
  | { type: "setPose"; pose: string }
  /**
   * Without `style`: the hint pulse (doc 13 Phase 4). With an outcome style: one feedback tint at the
   * component (doc 11 feedback vocabulary); the engine decided the outcome, the scene only shows it.
   */
  | { type: "highlight"; ids: string[]; durationMs?: number; style?: "correct" | "partial" | "incorrect" }
  /** target is a componentId or hotspotId. */
  | { type: "cameraTo"; target: string }
  | { type: "setSocketVisual"; socketId: string; visual: SocketVisual }
  | { type: "setVisible"; ids: string[]; visible: boolean }
  | { type: "reset" }
  /** V1: named clip from the manifest animations[]. */
  | { type: "playAnimation"; animationId: string };

export type SceneCommandType = SceneCommand["type"];
