/**
 * MediaPipe hand landmark indices and the feature functions built on them.
 * Formulas: mediapipe-hands skill section 5; doc 04 "Gesture detection pseudocode".
 * Landmarks exist only in worker memory for the current frame; nothing here persists them.
 */
import { VISION_CONSTANTS } from "./constants";

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
  return dist2(l[Landmark.WRIST]!, l[Landmark.MIDDLE_MCP]!);
}

/** dist3(l[THUMB_TIP], l[INDEX_TIP]) / handSize. */
export function pinchDist(l: HandLandmarks): number {
  return dist3(l[Landmark.THUMB_TIP]!, l[Landmark.INDEX_TIP]!) / handSize(l);
}

/** Tip farther from wrist than PIP by FINGER_EXTENDED_RATIO. */
export function fingerExtended(l: HandLandmarks, finger: Finger): boolean {
  const [pip, tip] = FINGER_JOINTS[finger];
  const wrist = l[Landmark.WRIST]!;
  return dist2(l[tip]!, wrist) > dist2(l[pip]!, wrist) * VISION_CONSTANTS.FINGER_EXTENDED_RATIO;
}

const FINGER_JOINTS: Record<Finger, [Landmark, Landmark]> = {
  index: [Landmark.INDEX_PIP, Landmark.INDEX_TIP],
  middle: [Landmark.MIDDLE_PIP, Landmark.MIDDLE_TIP],
  ring: [Landmark.RING_PIP, Landmark.RING_TIP],
  pinky: [Landmark.PINKY_PIP, Landmark.PINKY_TIP],
};

/** Thumb tip far from the pinky MCP: dist2(l[4], l[17]) / handSize > THUMB_EXTENDED_RATIO. */
export function thumbExtended(l: HandLandmarks): boolean {
  return dist2(l[Landmark.THUMB_TIP]!, l[Landmark.PINKY_MCP]!) / handSize(l) > VISION_CONSTANTS.THUMB_EXTENDED_RATIO;
}

/** Count of index..pinky extended (0..4). */
export function extendedCount(l: HandLandmarks): number {
  return (["index", "middle", "ring", "pinky"] as const).filter((f) => fingerExtended(l, f)).length;
}

/** Mean of WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP. */
export function palmCenter(l: HandLandmarks): Point3 {
  const ids = [Landmark.WRIST, Landmark.INDEX_MCP, Landmark.MIDDLE_MCP, Landmark.RING_MCP, Landmark.PINKY_MCP];
  const sum = ids.reduce((acc, i) => ({ x: acc.x + l[i]!.x, y: acc.y + l[i]!.y, z: acc.z + l[i]!.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / ids.length, y: sum.y / ids.length, z: sum.z / ids.length };
}

/**
 * Midpoint of THUMB_TIP and INDEX_TIP: the one cursor source, in every gesture state.
 * Doc 04 originally switched between INDEX_TIP (index extended), palmCenter (index folded) and this
 * midpoint (pinching). The index curls 2-4 frames before a pinch confirms, so the switch made the cursor
 * jump 0.16-0.29 frame widths, from fingertip to palm, at the moment of grab_start, and grabs missed
 * (measured in fixtures/pinches-20.json and pinch-grab-object.json, 2026-10-07). One source never jumps,
 * and it marks the spot where the pinch will close.
 */
export function pinchMidpoint(l: HandLandmarks): Point3 {
  const a = l[Landmark.THUMB_TIP]!;
  const b = l[Landmark.INDEX_TIP]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function dist2(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dist3(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

