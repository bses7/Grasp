/**
 * MediaPipe hand landmark indices and the feature functions built on them.
 * Formulas: mediapipe-hands skill section 5; doc 04 "Gesture detection pseudocode".
 * Landmarks exist only in worker memory for the current frame; nothing here persists them.
 */

export enum Landmark {
  WRIST = 0,
  THUMB_CMC = 1,
  THUMB_MCP = 2,
  THUMB_IP = 3,
  THUMB_TIP = 4,
  INDEX_MCP = 5,
  INDEX_PIP = 6,
  INDEX_DIP = 7,
  INDEX_TIP = 8,
  MIDDLE_MCP = 9,
  MIDDLE_PIP = 10,
  MIDDLE_DIP = 11,
  MIDDLE_TIP = 12,
  RING_MCP = 13,
  RING_PIP = 14,
  RING_DIP = 15,
  RING_TIP = 16,
  PINKY_MCP = 17,
  PINKY_PIP = 18,
  PINKY_DIP = 19,
  PINKY_TIP = 20,
}

/** Normalized image coordinates: x, y in 0..1 (origin top-left); z relative, not metric. */
export type Point3 = { readonly x: number; readonly y: number; readonly z: number };

/** Exactly 21 points, indexed by `Landmark`. */
export type HandLandmarks = readonly Point3[];

/** Fingers that `fingerExtended` can test (thumb has its own rule). */
export type Finger = "index" | "middle" | "ring" | "pinky";

/** dist2(l[WRIST], l[MIDDLE_MCP]); the scale reference every other feature is divided by. */
export function handSize(l: HandLandmarks): number {
  void l;
  throw new Error("TODO Phase D: handSize (doc 04, M2)");
}

/** dist3(l[THUMB_TIP], l[INDEX_TIP]) / handSize. */
export function pinchDist(l: HandLandmarks): number {
  void l;
  throw new Error("TODO Phase D: pinchDist (doc 04, M2)");
}

/** Tip farther from wrist than PIP by FINGER_EXTENDED_RATIO. */
export function fingerExtended(l: HandLandmarks, finger: Finger): boolean {
  void l;
  void finger;
  throw new Error("TODO Phase D: fingerExtended (doc 04, M2)");
}

/** Count of index..pinky extended (0..4). */
export function extendedCount(l: HandLandmarks): number {
  void l;
  throw new Error("TODO Phase D: extendedCount (doc 04, M2)");
}

/** Mean of WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP. */
export function palmCenter(l: HandLandmarks): Point3 {
  void l;
  throw new Error("TODO Phase D: palmCenter (doc 04, M2)");
}

/** Raw cursor: pinch midpoint while pinching, INDEX_TIP when pointing, else palmCenter. */
export function cursorFor(l: HandLandmarks, pinchActive: boolean): Point3 {
  void l;
  void pinchActive;
  throw new Error("TODO Phase D: cursorFor (doc 04, M2)");
}
