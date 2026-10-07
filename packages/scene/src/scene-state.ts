/**
 * SceneState snapshot and diff, doc 05 sections 4 and 9 (M7, M10).
 * SceneState is the only scene information that leaves the browser (to the
 * tutor route) and what the research logger samples at 1 Hz. Positions are
 * rounded to 0.1 scene units; no pixels, no landmarks.
 */
import type { CameraPose, SceneState, Vec3 } from "@grasp/types";
import { Spherical, Vector3, type Camera, type Object3D } from "three";
import type { SocketOccupancy } from "./sockets";

export type SnapshotInput = {
  modelId: string;
  camera: Camera;
  components: ReadonlyMap<string, Object3D>;
  occupancy: SocketOccupancy;
  hovered: string | null;
  grabbed: string | null;
  lastEvent: SceneState["lastEvent"];
};

/** Build a compact, JSON-serialisable snapshot from live scene refs. */
export function snapshotSceneState(input: SnapshotInput): SceneState {
  const occupantSocket = new Map<string, string>();
  for (const [socketId, componentId] of Object.entries(input.occupancy)) {
    if (componentId) occupantSocket.set(componentId, socketId);
  }
  const components: SceneState["components"] = {};
  for (const [id, o] of input.components) {
    components[id] = { socketId: occupantSocket.get(id) ?? null, position: round3(o.position), visible: o.visible };
  }
  return {
    modelId: input.modelId,
    camera: cameraPose(input.camera),
    components,
    hovered: input.hovered,
    grabbed: input.grabbed,
    lastEvent: input.lastEvent,
  };
}

/** Orbit pose around the model origin, degrees and scene units (the manifest's defaultCamera convention). */
function cameraPose(camera: Camera): CameraPose {
  const s = new Spherical().setFromVector3(new Vector3().copy(camera.position));
  const deg = (r: number) => Math.round((r * 180) / Math.PI);
  return { azimuth: deg(s.theta), elevation: deg(Math.PI / 2 - s.phi), distance: Math.round(s.radius * 10) / 10 };
}

function round3(v: Vector3): Vec3 {
  const r = (n: number) => Math.round(n * 10) / 10 + 0; // + 0 turns -0 into 0
  return [r(v.x), r(v.y), r(v.z)];
}

/** Keys of SceneState that changed between two snapshots; empty when equal. */
export type SceneStateDiff = {
  changed: (keyof SceneState)[];
  components: string[];
};

/** Cheap diff so the store updates only on discrete events, never per frame. */
export function diffSceneState(a: SceneState, b: SceneState): SceneStateDiff {
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  const changed = (Object.keys(b) as (keyof SceneState)[]).filter((k) => !same(a[k], b[k]));
  const ids = new Set([...Object.keys(a.components), ...Object.keys(b.components)]);
  const components = [...ids].filter((id) => !same(a.components[id], b.components[id]));
  return { changed, components };
}
