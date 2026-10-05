/**
 * Two calibration steps that run before a gesture-condition lesson (doc 04 "Threshold calibration proposal").
 * 1. Threshold calibration: ~5 s capture of handSize and pinchDist medians; mandatory in the
 *    gesture condition, skipped in the mouse condition, skippable only in development.
 * 2. Calibration tutorial: 20 scripted prompts that give doc 14 its gesture-accuracy ground truth.
 * Both compute scalars in the worker; no landmarks are retained.
 */

import type { VISION_CONSTANTS } from "./constants";

export type MvpGesture = "open_palm" | "point" | "pinch" | "pinch_drag" | "release";

export type ThresholdCalibrationResult = {
  readonly calibHandSize: number; // median handSize during open_palm step; zHint baseline
  readonly openPinch: number; // median pinchDist during open_palm step
  readonly closedPinch: number; // median pinchDist during pinch step
  readonly pinchEnter: number; // closed + ENTER_FRACTION * (open - closed), clamped
  readonly pinchExit: number; // closed + EXIT_FRACTION * (open - closed), clamped
  readonly presenceMean: number; // < LOW_CONFIDENCE_MEAN triggers lighting guidance before the lesson
  readonly luminance: number;
  readonly usedDefaults: boolean; // true when skipped in development
};

export type ThresholdCalibrationSample = {
  readonly handSize: number;
  readonly pinchDist: number;
  readonly presence: number;
  readonly luminance: number | null;
};

/** Fold per-frame samples from the two 2 s steps into per-session thresholds. */
export function thresholdCalibration(
  openPalmSamples: readonly ThresholdCalibrationSample[],
  pinchSamples: readonly ThresholdCalibrationSample[],
  constants: typeof VISION_CONSTANTS.CALIBRATION,
): ThresholdCalibrationResult {
  void openPalmSamples;
  void pinchSamples;
  void constants;
  throw new Error("TODO Phase D: thresholdCalibration (doc 04, post-M11; doc 13 Phase 4)");
}

export type CalibrationPrompt = {
  readonly id: string;
  readonly promptNo: number; // 1..20, logged as calibration_prompt.promptNo (doc 14)
  readonly expectedGesture: MvpGesture;
  readonly windowMs: number; // response window; first gesture_emit inside it is the answer
};

const WINDOW_MS = 3000;

/**
 * Fixed order rather than a per-participant shuffle: identical sequences keep accuracy
 * comparable across participants, and every `release` is placed directly after a `pinch`
 * or `pinch_drag` so it is physically possible. Four prompts per gesture, 20 total.
 * The mouse condition uses the same 20 prompts with mouse actions (doc 14 open question 3).
 */
const ORDER: readonly MvpGesture[] = [
  "open_palm", "point", "pinch", "release", "open_palm",
  "pinch_drag", "release", "point", "pinch", "release",
  "open_palm", "point", "pinch_drag", "release", "pinch",
  "open_palm", "pinch_drag", "point", "pinch_drag", "pinch",
];

export const calibrationTutorial: readonly CalibrationPrompt[] = ORDER.map((expectedGesture, i) => ({
  id: `cp_${String(i + 1).padStart(2, "0")}`,
  promptNo: i + 1,
  expectedGesture,
  windowMs: WINDOW_MS,
}));
