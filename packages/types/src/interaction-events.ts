/**
 * Interaction-event contract: gesture FSM or mouse adapter -> R3F scene.
 * Source: doc 04 "Interaction-event contract"; mediapipe-hands skill section 8.
 * The worker never sees the scene graph; the scene never sees landmarks.
 */

/** Normalized viewport coords, mirrored, clamped 0..1. */
export type Cursor = { x: number; y: number };

/** Optional metadata attached to every interaction event (additive, doc 04). */
export type EventMeta = {
  /** Worker timestamp, ms (performance.now based). */
  t?: number;
  /** Presence confidence of the primary hand, 0..1. */
  confidence?: number;
};

export type InteractionEvent = EventMeta &
  (
    /** open_palm or unknown hand: neutral cursor only, consumed via a ref, never logged per frame. */
    | { type: "cursor"; cursor: Cursor }
    /** point: raycast and highlight. */
    | { type: "hover"; cursor: Cursor }
    /** pinch entered over a grabbable component or empty space (empty space orbits). */
    | { type: "grab_start"; cursor: Cursor }
    /** pinch_drag; zHintDelta in handSize-ratio units, dead-zoned, low gain only (locked position 4). */
    | { type: "grab_move"; cursor: Cursor; zHintDelta: number }
    /** "lost" is the grace-period auto-release after tracking loss; the scene must settle, never snap. */
    | { type: "grab_end"; cursor: Cursor; reason: GrabEndReason }
    | { type: "tracking_lost" }
    | { type: "tracking_regained" }
    | { type: "hand_count"; n: number }
  );

export type GrabEndReason = "release" | "lost";

export type InteractionEventType = InteractionEvent["type"];

/** The eight CV states from doc 04 "Failure states". */
export type CvState =
  | "initialising"
  | "no_camera"
  | "no_hand"
  | "hand_too_far"
  | "hand_too_close"
  | "low_confidence"
  | "tracking_lost"
  | "ok";

export type CvHint = "move_closer" | "move_back" | "face_the_light" | "show_one_hand";

/** Separate channel from interaction events; emitted on change and at most every 250 ms. */
export type CvStatus = {
  type: "cv_status";
  state: CvState;
  /** How long this state has persisted, ms. */
  sinceMs: number;
  hint?: CvHint;
  /** Mean luminance of a 32x18 downsample, one number; pixels are never retained. */
  luminance?: number;
};

/** The only message the main thread sends back to the vision worker. */
export type HoverResult = {
  type: "hover_result";
  hoveredId: string | null;
  isGrabbable: boolean;
  t: number;
};

/** The five MVP gestures (locked position 3). V1 names are listed so logs can carry them later. */
export type GestureName =
  | "open_palm" | "point" | "pinch" | "pinch_drag" | "release"
  | "fist" | "swipe" | "wrist_rotate" | "two_hand_scale";
