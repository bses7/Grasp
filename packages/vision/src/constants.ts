/**
 * Starting thresholds and filter parameters for the CV layer.
 * Source: docs/04-computer-vision.md and the mediapipe-hands skill.
 * Every value here is provisional and is tuned from logged sessions
 * (doc 04 "What to log for tuning"; M11 tuning pass in doc 17).
 */

export type OneEuroParams = {
  readonly minCutoff: number; // Hz
  readonly beta: number; // speed coefficient, scaled for normalized 0..1 units
  readonly dCutoff: number; // Hz
};

export const VISION_CONSTANTS = {
  // Pinch hysteresis (pinchDist = dist3(l[4], l[8]) / handSize)
  PINCH_ENTER: 0.25,
  PINCH_EXIT: 0.4,
  DRAG_START_DIST: 0.01, // normalized cursor displacement since grab_start

  // Hold-frame debounce per gesture (consecutive frames before a state is entered)
  HOLD_FRAMES: {
    open_palm: 3,
    point: 3,
    pinch: 2,
    pinch_drag: 1,
    release: 2,
  },

  // One-Euro filters. beta = 5.0 (changed from the 0.007 pixel-unit value; doc 04 smoothing)
  ONE_EURO_LANDMARKS: { minCutoff: 1.0, beta: 5.0, dCutoff: 1.0 } as OneEuroParams,
  ONE_EURO_CURSOR: { minCutoff: 1.5, beta: 5.0, dCutoff: 1.0 } as OneEuroParams,
  ONE_EURO_Z_HINT: { minCutoff: 0.5, beta: 1.0, dCutoff: 1.0 } as OneEuroParams,
  Z_HINT_DEAD_ZONE: 0.03, // handSize ratio units

  // Feature ratios
  FINGER_EXTENDED_RATIO: 1.1, // tip-to-wrist > pip-to-wrist * ratio
  THUMB_EXTENDED_RATIO: 1.4, // dist(l[4], l[17]) / handSize

  // HandLandmarker options and hand filtering
  NUM_HANDS: 2,
  PRESENCE_FLOOR: 0.6, // also used for minHandDetectionConfidence and minTrackingConfidence
  HAND_BOX_MIN_FRAC: 0.08, // of frame width; smaller = hand_too_far
  HAND_BOX_MAX_FRAC: 0.6, // of frame width; larger = hand_too_close
  HAND_SIZE_MATCH_FRAC: 0.25, // two hands must be within this to count as one person (V1)
  HOVER_RESULT_MAX_AGE_FRAMES: 2,

  // Timing (ms)
  NO_HAND_TIMEOUT_MS: 500,
  LOST_GRACE_MS: 1000,
  DISTANCE_PERSIST_MS: 1000, // hand_too_far / hand_too_close must persist this long
  MULTI_HAND_HINT_MS: 3000, // hand_count > 1 before show_one_hand
  DWELL_SELECT_MS: 600,
  CV_STATUS_MIN_INTERVAL_MS: 250, // cv_status at most 4 Hz

  // Lighting rule (low_confidence)
  LOW_CONFIDENCE_MEAN: 0.7,
  LOW_CONFIDENCE_WINDOW_MS: 2000,
  LOW_CONFIDENCE_FLICKER_COUNT: 4,
  LUMINANCE_MIN: 40,
  LUMINANCE_MAX: 200,
  LUMINANCE_SAMPLE: { width: 32, height: 18 },

  // Camera and budget
  CAMERA: { width: 640, height: 360, fps: 30, facingMode: "user" },
  INFERENCE_P95_BUDGET_MS: 33,

  // Threshold calibration (doc 04 "Threshold calibration proposal")
  CALIBRATION: {
    STEP_MS: 2000, // open_palm step, then pinch step
    ENTER_FRACTION: 0.3, // enter = closed + f * (open - closed)
    EXIT_FRACTION: 0.6,
    CLAMP_MIN: 0.18,
    CLAMP_MAX: 0.55,
  },
} as const;
