/**
 * Camera-facing drag plane, doc 05 sections 3.2, 5, and 6 (M5 mouse, M7 gesture).
 * Locked position 4: manipulation happens on a plane through the grabbed
 * component with normal equal to the camera view direction; palm size is a
 * low-gain z-hint only. Snap happens only on grab_end.
 */
import type { SceneEvent } from "@grasp/types";
import type { Camera, Object3D, Plane, Vector3 } from "three";
import type { Ndc } from "./coords";

export type GrabState = {
  componentId: string;
  object: Object3D;
  dragPlane: Plane;
  grabOffset: Vector3;
  /** Socket the component was detached from, already marked empty. */
  detachedFromSocketId: string | null;
};

export type AxisLocks = { x?: boolean; y?: boolean; z?: boolean };

/**
 * Build the plane and offset, detach from any socket, mark it empty.
 * Returns null when the hit is not grabbable; the caller still emits select.
 */
export function beginGrab(
  _componentId: string,
  _object: Object3D,
  _ndc: Ndc,
  _camera: Camera,
): GrabState | null {
  throw new Error("TODO Phase D: beginGrab (doc 05, M5)");
}

/**
 * p = intersect(ray, dragPlane) + grabOffset
 * p += camera.forward * clamp(zHintDelta * Z_GAIN, -Z_MAX, Z_MAX)
 * p = clampToBounds(p); p = applyAxisLocks(p)
 * object.position = lerp(object.position, p, DRAG_LERP)   // refs only, no React state
 */
export function moveGrab(
  _grab: GrabState,
  _ndc: Ndc,
  _camera: Camera,
  _zHintDelta: number,
  _locks?: AxisLocks,
): void {
  throw new Error("TODO Phase D: moveGrab (doc 05, M7)");
}

export type GrabEndResult = Extract<SceneEvent, { type: "place" } | { type: "drop" }>;

/**
 * reason === "release": nearest accepting socket within radius → snap (150 ms)
 *   and return place; otherwise settle in place and return drop with cause "release".
 * reason === "lost": the worker-owned grace period expired (doc 04). Skip the
 *   socket search entirely, settle in place, return drop with cause "lost".
 *   A place can never result from a loss; the engine discards cause "lost" drops.
 * The scene owns no grace timer of its own.
 */
export function endGrab(_grab: GrabState, _reason: "release" | "lost"): GrabEndResult {
  throw new Error("TODO Phase D: endGrab (doc 05, M7)");
}
