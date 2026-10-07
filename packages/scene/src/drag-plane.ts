/**
 * Camera-facing drag plane, doc 05 sections 3.2, 5, and 6 (M5 mouse, M7 gesture).
 * Locked position 4: manipulation happens on a plane through the grabbed
 * component with normal equal to the camera view direction; palm size is a
 * low-gain z-hint only. Snap happens only on grab_end.
 *
 * Positions are in the model group's space, which is the world space: LessonScene keeps the
 * component parent at the origin with no rotation or scale.
 */
import type { SceneEvent, Socket, Vec3 } from "@grasp/types";
import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from "three";
import { SCENE_CONSTANTS } from "./constants";
import type { Ndc } from "./coords";
import { nearestAcceptingSocket, type SocketOccupancy } from "./sockets";

export type GrabState = {
  componentId: string;
  object: Object3D;
  dragPlane: Plane;
  grabOffset: Vector3;
  /** Socket the component was detached from, already marked empty. */
  detachedFromSocketId: string | null;
  /** Position at grab_start; axis locks hold these coordinates. */
  startPosition: Vector3;
};

export type AxisLocks = { x?: boolean; y?: boolean; z?: boolean };

const raycaster = new Raycaster();
const ndcVec = new Vector2();
const hitPoint = new Vector3();
const forward = new Vector3();
const target = new Vector3();

function cursorRayHit(ndc: Ndc, camera: Camera, plane: Plane): Vector3 | null {
  raycaster.setFromCamera(ndcVec.set(ndc.x, ndc.y), camera);
  return raycaster.ray.intersectPlane(plane, hitPoint);
}

/**
 * Build the plane and offset, detach from any socket, mark it empty.
 * Returns null when the cursor ray misses the plane (cannot happen for a hit object in front of the camera).
 */
export function beginGrab(
  componentId: string,
  object: Object3D,
  ndc: Ndc,
  camera: Camera,
  occupancy: SocketOccupancy,
): GrabState | null {
  camera.getWorldDirection(forward);
  const dragPlane = new Plane().setFromNormalAndCoplanarPoint(forward, object.position);
  const hit = cursorRayHit(ndc, camera, dragPlane);
  if (!hit) return null;

  let detachedFromSocketId: string | null = null;
  for (const [socketId, occupant] of Object.entries(occupancy)) {
    if (occupant === componentId) {
      occupancy[socketId] = null;
      detachedFromSocketId = socketId;
    }
  }
  return {
    componentId,
    object,
    dragPlane,
    grabOffset: object.position.clone().sub(hit),
    detachedFromSocketId,
    startPosition: object.position.clone(),
  };
}

/**
 * p = intersect(ray, dragPlane) + grabOffset
 * p += camera.forward * clamp(zHintDelta * Z_GAIN, -Z_MAX, Z_MAX)
 * p = clampToBounds(p); p = applyAxisLocks(p)
 * object.position = lerp(object.position, p, DRAG_LERP)   // refs only, no React state
 */
export function moveGrab(grab: GrabState, ndc: Ndc, camera: Camera, zHintDelta: number, locks: AxisLocks = {}): void {
  const hit = cursorRayHit(ndc, camera, grab.dragPlane);
  if (!hit) return;
  const { Z_GAIN, Z_MAX, WORKSPACE_BOUNDS, DRAG_LERP } = SCENE_CONSTANTS;
  target.copy(hit).add(grab.grabOffset);
  if (zHintDelta !== 0) {
    const dz = Math.min(Z_MAX, Math.max(-Z_MAX, zHintDelta * Z_GAIN));
    target.addScaledVector(camera.getWorldDirection(forward), dz);
  }
  target.clamp(new Vector3(...WORKSPACE_BOUNDS.min), new Vector3(...WORKSPACE_BOUNDS.max));
  if (locks.x) target.x = grab.startPosition.x;
  if (locks.y) target.y = grab.startPosition.y;
  if (locks.z) target.z = grab.startPosition.z;
  grab.object.position.lerp(target, DRAG_LERP);
}

/**
 * Recompute the grab offset from a new cursor so the component does not jump (doc 04 LOST rule:
 * after tracking_regained the hand is rarely where it was when tracking dropped).
 */
export function rebaseGrab(grab: GrabState, ndc: Ndc, camera: Camera): void {
  const hit = cursorRayHit(ndc, camera, grab.dragPlane);
  if (hit) grab.grabOffset.copy(grab.object.position).sub(hit);
}

export type GrabEndResult = Extract<SceneEvent, { type: "place" } | { type: "drop" }>;

/**
 * reason === "release": nearest accepting socket within radius → mark it occupied and return place
 *   plus the socket to snap to; otherwise settle in place and return drop with cause "release".
 * reason === "lost": the worker-owned grace period expired (doc 04). Skip the
 *   socket search entirely, settle in place, return drop with cause "lost".
 *   A place can never result from a loss; the engine discards cause "lost" drops.
 * The scene owns no grace timer of its own.
 */
export function endGrab(
  grab: GrabState,
  reason: "release" | "lost",
  sockets: readonly Socket[],
  occupancy: SocketOccupancy,
  t: number,
): { event: GrabEndResult; snapTo: Socket | null } {
  const { componentId, object } = grab;
  const socket = reason === "release" ? nearestAcceptingSocket(object, sockets, occupancy) : null;
  if (socket) {
    occupancy[socket.id] = componentId;
    return { event: { type: "place", componentId, socketId: socket.id, t }, snapTo: socket };
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  const position: Vec3 = [round(object.position.x), round(object.position.y), round(object.position.z)];
  return { event: { type: "drop", componentId, position, cause: reason, t }, snapTo: null };
}
