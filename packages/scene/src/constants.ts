/**
 * Tunable constants for the scene package (doc 05 sections 3, 6, 10).
 * All values are starting points; M11 tunes them from pilot logs.
 * Scene units follow the model manifest (`heart_v1` uses centimetres).
 */
export const SCENE_CONSTANTS = {
  /** Low-gain depth hint from palm-size change (locked position 4). */
  Z_GAIN: 0.3,
  /** Max z-hint displacement per frame, scene units. */
  Z_MAX: 0.15,
  /** Degrees of azimuth per full canvas width of cursor travel. */
  ORBIT_GAIN_DEG: 180,
  /** Elevation clamp for the orbit rig, degrees. */
  ORBIT_ELEVATION_MAX_DEG: 80,
  /** Lerp factor applied to the drag target on top of CV One-Euro smoothing. */
  DRAG_LERP: 0.5,
  /** Snap tween into a socket on grab_end. */
  SNAP_EASE_MS: 150,
  /** Reset tween back to the activity's initial poses. */
  RESET_TWEEN_MS: 400,
  /** Hint pulse: emissive intensity at 1 Hz for this long. */
  HINT_PULSE_MS: 3000,
  /** Dwell on a hovered component or hotspot before a select is emitted. */
  DWELL_SELECT_MS: 600,
  /** Consecutive agreeing frames before hoveredId changes. */
  HOVER_DEBOUNCE_FRAMES: 2,
  /** Demand frameloop goes idle after this long without events. */
  IDLE_AFTER_MS: 2000,
  /** Renderer device-pixel-ratio range (doc 05 section 10). */
  DPR_RANGE: [1, 1.5],
  /** Keyboard nudge per arrow press, scene units; Shift multiplies by 4. */
  KEY_STEP: 0.5,
  KEY_STEP_SHIFT_MULTIPLIER: 4,
  /** Magnifies a central camera region onto the full canvas; tuned at M11. */
  REACH_SCALE: 1.0,
  /** Capabilities disabled when the session carries the studyParity flag. */
  STUDY_PARITY_DISABLES: ["dolly"],
  /** Axis-aligned workspace bounds, scene units, centred on the model. */
  WORKSPACE_BOUNDS: {
    min: [-30, -30, -30],
    max: [30, 30, 30],
  },
} as const;

export type SceneConstants = typeof SCENE_CONSTANTS;
export type StudyParityCapability = SceneConstants["STUDY_PARITY_DISABLES"][number];
