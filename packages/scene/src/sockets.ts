/**
 * Sockets and snapping, doc 05 section 3.5 (M5).
 *
 * `accepts` is permissive by design: it lists every component that may
 * physically snap into a socket, including distractors (the heart manifest lets
 * every chamber socket accept all four chambers and both great-vessel sockets
 * accept both vessels). A socket accepting a component is NOT correctness.
 * Correctness is decided by the learning engine comparing { componentId,
 * socketId } to the task's expect block. This file never decides it.
 */
import type { Socket } from "@grasp/types";
import type { Object3D } from "three";

export type SocketOccupancy = Record<string, string | null>;

/**
 * Nearest socket whose `accepts` includes the component and whose distance to
 * the component origin is under `radius`. Returns null when none qualifies.
 * Called only from endGrab with reason "release"; never during a drag.
 */
export function nearestAcceptingSocket(
  _component: Object3D,
  _sockets: readonly Socket[],
): Socket | null {
  throw new Error("TODO Phase D: nearestAcceptingSocket (doc 05, M5)");
}

/**
 * Tween the component's position and rotation to the socket transform over
 * SNAP_EASE_MS (instant under reduced motion), then mark the socket occupied.
 * Wrong placements snap too so the model stays tidy; the engine flags them.
 */
export function snapTo(_component: Object3D, _socket: Socket): Promise<void> {
  throw new Error("TODO Phase D: snapTo (doc 05, M5)");
}

/** Visual for a socket given the manifest default and the activity override. */
export function resolveSocketVisual(
  _socket: Socket,
  _activityOverride?: Socket["visual"],
): Socket["visual"] {
  throw new Error("TODO Phase D: resolveSocketVisual (doc 05, M9)");
}
