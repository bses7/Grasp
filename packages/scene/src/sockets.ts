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
import type { Socket, Transform } from "@grasp/types";
import { Euler, Quaternion, Vector3, type Object3D } from "three";

export type SocketOccupancy = Record<string, string | null>;

/** Snap forgiveness: a part snaps within radius x this, so "close" is enough (user feedback 2026-10-29). */
export const SNAP_TOLERANCE = 1.5;

/**
 * Nearest socket whose `accepts` includes the component and whose distance to
 * the component origin is under `radius * SNAP_TOLERANCE`. Returns null when none qualifies.
 * With `viewDir` (the camera's forward), depth along it is ignored: the drag plane faces the camera, so the
 * learner can line a part up on screen but cannot change its depth, and a depth gap must not block the snap.
 * Nearest wins, so overlapping ranges (aorta and pulmonary artery sockets) still pick the closer one.
 * Called by endGrab on release, and on each grab_move to light the ring the part would snap into
 * (a few sockets, so the per-frame cost is negligible).
 */
export function nearestAcceptingSocket(
  component: Object3D,
  sockets: readonly Socket[],
  occupancy: SocketOccupancy = {},
  viewDir?: Vector3,
): Socket | null {
  const id = component.userData.componentId as string | undefined;
  if (!id) return null;
  let best: Socket | null = null;
  let bestDist = Infinity;
  for (const s of sockets) {
    const occupant = occupancy[s.id];
    if (!s.accepts.includes(id) || (occupant && occupant !== id)) continue;
    const gap = component.position.clone().sub(new Vector3(...s.transform.position));
    if (viewDir) gap.addScaledVector(viewDir, -gap.dot(viewDir));
    const d = gap.length();
    if (d < s.radius * SNAP_TOLERANCE && d < bestDist) [best, bestDist] = [s, d];
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
  return tweenTo(component, socket.transform, durationMs, onStep);
}

/** Ease-out tween of position and rotation to `to`; used by snap (150 ms) and reset (400 ms). */
export function tweenTo(component: Object3D, to: Transform, durationMs: number, onStep: () => void): Promise<void> {
  const fromPos = component.position.clone();
  const fromRot = component.quaternion.clone();
  const toPos = new Vector3(...to.position);
  const toRot = new Quaternion().setFromEuler(new Euler(...to.rotation));
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
