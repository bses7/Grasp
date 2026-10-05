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
import { Euler, Quaternion, Vector3, type Object3D } from "three";

export type SocketOccupancy = Record<string, string | null>;

/**
 * Nearest socket whose `accepts` includes the component and whose distance to
 * the component origin is under `radius`. Returns null when none qualifies.
 * Called only from endGrab with reason "release"; never during a drag.
 */
export function nearestAcceptingSocket(
  component: Object3D,
  sockets: readonly Socket[],
  occupancy: SocketOccupancy = {},
): Socket | null {
  const id = component.userData.componentId as string | undefined;
  if (!id) return null;
  let best: Socket | null = null;
  let bestDist = Infinity;
  for (const s of sockets) {
    const occupant = occupancy[s.id];
    if (!s.accepts.includes(id) || (occupant && occupant !== id)) continue;
    const [x, y, z] = s.transform.position;
    const d = component.position.distanceTo(new Vector3(x, y, z));
    if (d < s.radius && d < bestDist) [best, bestDist] = [s, d];
  }
  return best;
}

/**
 * Tween the component's position and rotation to the socket transform over `durationMs`
 * (pass 0 under reduced motion). `onStep` is R3F's invalidate() so the demand frameloop draws
 * each step. Occupancy is updated by endGrab, not here.
 * Wrong placements snap too so the model stays tidy; the engine flags them.
 */
export function snapTo(
  component: Object3D,
  socket: Socket,
  durationMs: number,
  onStep: () => void,
): Promise<void> {
  const fromPos = component.position.clone();
  const fromRot = component.quaternion.clone();
  const toPos = new Vector3(...socket.transform.position);
  const toRot = new Quaternion().setFromEuler(new Euler(...socket.transform.rotation));
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const k = durationMs <= 0 ? 1 : Math.min(1, (now - start) / durationMs);
      const e = 1 - (1 - k) ** 3; // ease-out cubic
      component.position.lerpVectors(fromPos, toPos, e);
      component.quaternion.slerpQuaternions(fromRot, toRot, e);
      onStep();
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    step(start);
  });
}

/** Visual for a socket given the manifest default and the activity override. */
export function resolveSocketVisual(
  _socket: Socket,
  _activityOverride?: Socket["visual"],
): Socket["visual"] {
  throw new Error("TODO Phase D: resolveSocketVisual (doc 05, M9)");
}
